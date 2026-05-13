/**
 * G11 — Multi-modal input extraction.
 *
 * Converts uploaded files into text (or image content blocks) that can be
 * injected into the context assembly pipeline.
 *
 * Supported types:
 *   PDF         application/pdf          → text via pdf-parse (dynamic import)
 *   Image       image/*                  → base64 content block for multimodal LLMs
 *   Voice       audio/*                  → transcript via OpenAI Whisper
 *   Spreadsheet text/csv, .xlsx          → JSON row table as text
 *
 * RULE 2: credentials never reach LLM.
 * RULE 1: gdprFlag=true when skill.gdprRequired — caller must enforce model routing.
 */

import pino from "pino";

const log = pino({ name: "extract-input" });

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ExtractionOptions {
  gdprRequired?: boolean;
  companyId?:   string;
  taskId?:      string;
}

export interface ExtractionResult {
  /** Extracted text — always present (empty string if image-only) */
  text:      string;
  mimeType:  string;
  byteSize:  number;
  gdprFlag:  boolean;
  /** Only set for images — base64 payload for multimodal LLM calls */
  imageData?: { base64: string; mimeType: string };
}

export class UnsupportedTypeError extends Error {
  constructor(public readonly mimeType: string) {
    super(`Unsupported MIME type for extraction: ${mimeType}`);
    this.name = "UnsupportedTypeError";
  }
}

export class ExtractionError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "ExtractionError";
  }
}

// ── PDF ───────────────────────────────────────────────────────────────────────

const PDF_MAGIC = Buffer.from("%PDF");

/**
 * Extracts plain text from a PDF buffer using pdf-parse (dynamic import).
 * Falls back to an ExtractionError if pdf-parse is not installed.
 */
export async function extractPdf(
  buffer: Buffer,
  opts: ExtractionOptions = {},
): Promise<ExtractionResult> {
  // Validate magic bytes
  if (!buffer.slice(0, 4).equals(PDF_MAGIC)) {
    throw new ExtractionError("Buffer does not start with PDF signature (%PDF)");
  }

  let text = "";
  try {
    // Dynamic import so absence of pdf-parse doesn't crash startup
    // @ts-ignore — pdf-parse has no bundled types; catch handles missing module
    const pdfParse = (await import("pdf-parse")).default;
    const result = await pdfParse(buffer);
    text = result.text.trim();
  } catch (err: any) {
    if (err?.code === "ERR_MODULE_NOT_FOUND" || err?.message?.includes("Cannot find module")) {
      throw new ExtractionError(
        "PDF extraction requires the pdf-parse package: pnpm add pdf-parse",
        err,
      );
    }
    throw new ExtractionError(`PDF parsing failed: ${err?.message ?? err}`, err);
  }

  log.info({ byteSize: buffer.byteLength, chars: text.length, ...opts }, "extract-input: PDF");

  return {
    text,
    mimeType: "application/pdf",
    byteSize: buffer.byteLength,
    gdprFlag: opts.gdprRequired ?? false,
  };
}

// ── Image ─────────────────────────────────────────────────────────────────────

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
]);

/**
 * Validates an image buffer via sharp and returns a base64 content block
 * for injection into a multimodal LLM call.
 *
 * The `text` field is intentionally empty — callers must use `imageData`
 * to build the multimodal message.
 */
export async function extractImage(
  buffer: Buffer,
  mimeType: string,
  opts: ExtractionOptions = {},
): Promise<ExtractionResult> {
  if (!ALLOWED_IMAGE_TYPES.has(mimeType)) {
    throw new UnsupportedTypeError(mimeType);
  }

  // Validate and normalise via sharp (already installed)
  const sharp = (await import("sharp")).default;
  const metadata = await sharp(buffer).metadata();
  if (!metadata.width || !metadata.height) {
    throw new ExtractionError("Image could not be decoded");
  }

  const base64 = buffer.toString("base64");
  log.info(
    { mimeType, width: metadata.width, height: metadata.height, byteSize: buffer.byteLength, ...opts },
    "extract-input: image",
  );

  return {
    text:      "",
    mimeType,
    byteSize:  buffer.byteLength,
    gdprFlag:  opts.gdprRequired ?? false,
    imageData: { base64, mimeType },
  };
}

// ── Voice (Whisper) ───────────────────────────────────────────────────────────

const ALLOWED_AUDIO_TYPES = new Set([
  "audio/wav",
  "audio/wave",
  "audio/mpeg",
  "audio/mp4",
  "audio/mp3",
  "audio/webm",
  "audio/ogg",
  "audio/flac",
]);

const AUDIO_EXT: Record<string, string> = {
  "audio/wav":   "wav",
  "audio/wave":  "wav",
  "audio/mpeg":  "mp3",
  "audio/mp3":   "mp3",
  "audio/mp4":   "mp4",
  "audio/webm":  "webm",
  "audio/ogg":   "ogg",
  "audio/flac":  "flac",
};

/**
 * Transcribes an audio buffer using the OpenAI Whisper API.
 * Requires OPENAI_API_KEY in the environment.
 * GDPR note: audio may contain personal data — enforce model routing at call site.
 */
export async function transcribeVoice(
  buffer: Buffer,
  mimeType: string,
  opts: ExtractionOptions = {},
): Promise<ExtractionResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new ExtractionError("OPENAI_API_KEY is not set — Whisper transcription unavailable");
  }

  if (!ALLOWED_AUDIO_TYPES.has(mimeType)) {
    throw new UnsupportedTypeError(mimeType);
  }

  const ext = AUDIO_EXT[mimeType] ?? "wav";

  // Build FormData for Whisper endpoint
  const { FormData, Blob } = await import("node:buffer").then(
    // Node 18+ has Blob globally; FormData is in node:buffer since Node 18.11
    async () => {
      // @ts-ignore — node-fetch has no bundled types in this ESM context
      const nodeFetch = await import("node-fetch").catch(() => null);
      return nodeFetch
        ? { FormData: nodeFetch.default as any, Blob: globalThis.Blob ?? Buffer }
        : { FormData: globalThis.FormData, Blob: globalThis.Blob };
    },
  );

  const form = new globalThis.FormData();
  const blob = new globalThis.Blob([new Uint8Array(buffer)], { type: mimeType });
  form.append("file", blob, `audio.${ext}`);
  form.append("model", "whisper-1");
  form.append("response_format", "text");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new ExtractionError(`Whisper API error ${response.status}: ${body}`);
  }

  const text = (await response.text()).trim();
  log.info({ byteSize: buffer.byteLength, chars: text.length, ...opts }, "extract-input: voice");

  return {
    text,
    mimeType,
    byteSize:  buffer.byteLength,
    gdprFlag:  opts.gdprRequired ?? true, // voice almost always contains personal data
  };
}

// ── Spreadsheet ───────────────────────────────────────────────────────────────

/**
 * Parses a CSV or XLSX buffer into a JSON row table and returns it as
 * formatted text for injection into the task context.
 *
 * CSV: built-in string parsing (no package needed).
 * XLSX: dynamic import of the `xlsx` package (pnpm add xlsx if needed).
 */
export async function extractSpreadsheet(
  buffer: Buffer,
  mimeType: string,
  opts: ExtractionOptions = {},
): Promise<ExtractionResult> {
  let rows: string[][] = [];

  if (mimeType === "text/csv" || mimeType === "text/plain") {
    rows = parseCsv(buffer.toString("utf8"));
  } else if (
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "application/vnd.ms-excel"
  ) {
    try {
      // @ts-ignore — xlsx has no bundled types; catch handles missing module
      const XLSX = await import("xlsx");
      const wb = XLSX.read(buffer, { type: "buffer" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      // @ts-ignore
      rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as string[][];
    } catch (err: any) {
      if (err?.code === "ERR_MODULE_NOT_FOUND" || err?.message?.includes("Cannot find module")) {
        throw new ExtractionError(
          "XLSX extraction requires the xlsx package: pnpm add xlsx",
          err,
        );
      }
      throw new ExtractionError(`XLSX parsing failed: ${err?.message ?? err}`, err);
    }
  } else {
    throw new UnsupportedTypeError(mimeType);
  }

  if (rows.length === 0) {
    return { text: "(empty spreadsheet)", mimeType, byteSize: buffer.byteLength, gdprFlag: opts.gdprRequired ?? false };
  }

  const headers = rows[0];
  const dataRows = rows.slice(1);

  const text = [
    `Headers: ${headers.join(" | ")}`,
    `Rows: ${dataRows.length}`,
    "",
    dataRows
      .slice(0, 100) // cap at 100 rows in context
      .map((row) => headers.map((h, i) => `${h}: ${row[i] ?? ""}`).join(", "))
      .join("\n"),
  ].join("\n");

  log.info(
    { mimeType, rowCount: dataRows.length, byteSize: buffer.byteLength, ...opts },
    "extract-input: spreadsheet",
  );

  return {
    text,
    mimeType,
    byteSize: buffer.byteLength,
    gdprFlag: opts.gdprRequired ?? false,
  };
}

function parseCsv(raw: string): string[][] {
  return raw
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      // Naive CSV split — handles quoted fields with commas
      const cols: string[] = [];
      let cur = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          inQuotes = !inQuotes;
        } else if (ch === "," && !inQuotes) {
          cols.push(cur.trim());
          cur = "";
        } else {
          cur += ch;
        }
      }
      cols.push(cur.trim());
      return cols;
    });
}

// ── Router ────────────────────────────────────────────────────────────────────

/**
 * Top-level dispatcher: detects the MIME type and calls the right extractor.
 */
export async function extractInput(
  buffer: Buffer,
  mimeType: string,
  opts: ExtractionOptions = {},
): Promise<ExtractionResult> {
  if (mimeType === "application/pdf") {
    return extractPdf(buffer, opts);
  }
  if (mimeType.startsWith("image/")) {
    return extractImage(buffer, mimeType, opts);
  }
  if (mimeType.startsWith("audio/")) {
    return transcribeVoice(buffer, mimeType, opts);
  }
  if (
    mimeType === "text/csv" ||
    mimeType === "text/plain" ||
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "application/vnd.ms-excel"
  ) {
    return extractSpreadsheet(buffer, mimeType, opts);
  }
  throw new UnsupportedTypeError(mimeType);
}
