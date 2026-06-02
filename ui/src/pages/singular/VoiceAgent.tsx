/**
 * ui/src/pages/singular/VoiceAgent.tsx
 *
 * §16 — Voice-to-Agent screen.
 *
 * CEO taps the mic, speaks a natural-language instruction,
 * and the platform creates a mission or task from the voice note.
 *
 * Three states:
 *   idle     → mic button centred
 *   recording → pulsing red dot, elapsed timer, stop button
 *   result   → transcript + intent card + navigation CTA
 */

import { useState, useRef, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { Mic, MicOff, CheckCircle2, AlertCircle, ArrowRight, RotateCcw } from "lucide-react";
import { useCompany } from "../../context/CompanyContext";
import { voiceApi, type VoiceResult } from "../../api/voice";
import { useNavigate } from "@/lib/router";

type RecordingState = "idle" | "recording" | "processing" | "result" | "error";

function ConfidenceBadge({ c }: { c: "high" | "medium" | "low" }) {
  const map = {
    high:   { label: "High confidence",  cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    medium: { label: "Medium confidence", cls: "bg-amber-50 text-amber-700 border-amber-200" },
    low:    { label: "Low confidence",  cls: "bg-stone-50 text-stone-500 border-stone-200" },
  };
  const { label, cls } = map[c];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {label}
    </span>
  );
}

export default function VoiceAgent() {
  const { selectedCompanyId } = useCompany();
  const navigate = useNavigate();

  const [state, setState]       = useState<RecordingState>("idle");
  const [elapsed, setElapsed]   = useState(0);
  const [result, setResult]     = useState<VoiceResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const mediaRef    = useRef<MediaRecorder | null>(null);
  const chunksRef   = useRef<Blob[]>([]);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  const mutation = useMutation({
    mutationFn: ({ companyId, form }: { companyId: string; form: FormData }) =>
      voiceApi.transcribe(companyId, form),
    onSuccess: (res) => {
      setResult(res.data);
      setState("result");
    },
    onError: () => {
      setErrorMsg("Transcription failed. Check your connection and try again.");
      setState("error");
    },
  });

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];

      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const form = new FormData();
        form.append("audio", blob, "voice.webm");
        setState("processing");
        mutation.mutate({ companyId: selectedCompanyId!, form });
      };

      mr.start(250); // 250ms chunks
      mediaRef.current = mr;
      setElapsed(0);
      setState("recording");

      timerRef.current = setInterval(() => setElapsed((n) => n + 1), 1000);
    } catch {
      setErrorMsg("Microphone unavailable. Please allow access in your browser settings.");
      setState("error");
    }
  }, [selectedCompanyId, mutation]);

  const stopRecording = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    mediaRef.current?.stop();
  }, []);

  const reset = () => { setState("idle"); setResult(null); setErrorMsg(""); setElapsed(0); };

  const fmtElapsed = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const navigateToResult = () => {
    if (!result?.id) return;
    if (result.type === "mission") navigate(`console`);
    else navigate(`taches/${result.id}`);
  };

  return (
    <div className="min-h-screen bg-[#FAFAF7] flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md flex flex-col gap-8">

        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-[#0F0F0D]">Voice note</h1>
          <p className="mt-1 text-sm text-stone-500">
            Speak your instruction — your team will handle it.
          </p>
        </div>

        {/* State: idle */}
        {state === "idle" && (
          <div className="flex flex-col items-center gap-6">
            <button
              onClick={startRecording}
              className="w-24 h-24 rounded-full bg-[#1A4E8C] flex items-center justify-center shadow-lg hover:bg-[#153F70] active:scale-95 transition-all"
            >
              <Mic size={36} className="text-white" />
            </button>
            <p className="text-sm text-stone-400">Tap to speak</p>
          </div>
        )}

        {/* State: recording */}
        {state === "recording" && (
          <div className="flex flex-col items-center gap-6">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-red-500/10 animate-ping absolute inset-0" />
              <button
                onClick={stopRecording}
                className="relative w-24 h-24 rounded-full bg-red-500 flex items-center justify-center shadow-lg hover:bg-red-600 active:scale-95 transition-all"
              >
                <MicOff size={36} className="text-white" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm font-mono text-stone-600">{fmtElapsed(elapsed)}</span>
            </div>
            <p className="text-sm text-stone-400">Speaking… tap to stop</p>
          </div>
        )}

        {/* State: processing */}
        {state === "processing" && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-24 h-24 rounded-full bg-[#1A4E8C]/10 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-[#1A4E8C] border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="text-sm text-stone-500">Analysing…</p>
          </div>
        )}

        {/* State: result */}
        {state === "result" && result && (
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl bg-white border border-stone-100 shadow-sm p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm font-semibold text-[#0F0F0D]">
                    {result.type === "mission" ? "Mission created" :
                     result.type === "task"    ? "Task created" :
                                                 "Needs clarification"}
                  </span>
                </div>
                <ConfidenceBadge c={result.confidence} />
              </div>

              <p className="text-base font-medium text-[#0F0F0D]">{result.title}</p>

              <div className="rounded-xl bg-stone-50 border border-stone-100 p-3">
                <p className="text-xs text-stone-400 mb-1 uppercase tracking-wide">Transcription</p>
                <p className="text-sm text-stone-600 italic">"{result.transcript}"</p>
              </div>
            </div>

            <div className="flex gap-3">
              {result.id && (
                <button
                  onClick={navigateToResult}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#1A9E68] text-white font-medium text-sm hover:bg-[#158A58] transition-colors"
                >
                  View {result.type === "mission" ? "mission" : "task"}
                  <ArrowRight size={14} />
                </button>
              )}
              <button
                onClick={reset}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-stone-200 text-stone-600 font-medium text-sm hover:bg-stone-50 transition-colors"
              >
                <RotateCcw size={14} />
                New note
              </button>
            </div>
          </div>
        )}

        {/* State: error */}
        {state === "error" && (
          <div className="flex flex-col items-center gap-4">
            <div className="rounded-2xl bg-red-50 border border-red-100 p-4 flex items-start gap-3 w-full">
              <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{errorMsg}</p>
            </div>
            <button
              onClick={reset}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-stone-200 text-stone-600 text-sm hover:bg-stone-50 transition-colors"
            >
              <RotateCcw size={14} />
              Réessayer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
