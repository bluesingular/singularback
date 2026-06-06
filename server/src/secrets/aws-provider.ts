/**
 * server/src/secrets/aws-provider.ts
 *
 * AWS Secrets Manager provider.
 * Uses the existing @aws-sdk/client-s3 credential chain for auth
 * (env: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_SESSION_TOKEN).
 *
 * Remote import: the operator supplies an AWS secret ARN or name as externalRef.
 * Swwarm fetches the value server-side at resolution time — credential never
 * passes through the LLM context (RULE 2).
 *
 * Requires env vars:
 *   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION (or AWS_DEFAULT_REGION)
 */

import { createHmac, createHash } from "node:crypto";
import { unprocessable } from "../errors.js";
import type { SecretProviderModule } from "./types.js";

const SERVICE   = "secretsmanager";
const ALGORITHM = "AWS4-HMAC-SHA256";

function getConfig() {
  const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION;
  const accessKey = process.env.AWS_ACCESS_KEY_ID;
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY;
  const sessionToken = process.env.AWS_SESSION_TOKEN;

  if (!region || !accessKey || !secretKey) {
    throw unprocessable(
      "AWS Secrets Manager requires AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY and AWS_REGION environment variables.",
    );
  }
  return { region, accessKey, secretKey, sessionToken };
}

// ── AWS Signature V4 ──────────────────────────────────────────────────────────

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data).digest();
}

function sha256hex(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

function signingKey(secretKey: string, dateStamp: string, region: string, service: string): Buffer {
  const kDate    = hmac(`AWS4${secretKey}`, dateStamp);
  const kRegion  = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, "aws4_request");
}

async function awsSecretsRequest(action: string, body: object, cfg: ReturnType<typeof getConfig>): Promise<unknown> {
  const { region, accessKey, secretKey, sessionToken } = cfg;

  const now        = new Date();
  const amzDate    = now.toISOString().replace(/[:-]|\.\d{3}/g, "").slice(0, 15) + "Z";
  const dateStamp  = amzDate.slice(0, 8);
  const host       = `secretsmanager.${region}.amazonaws.com`;
  const endpoint   = `https://${host}`;
  const payload    = JSON.stringify(body);
  const payloadHash = sha256hex(payload);

  const headers: Record<string, string> = {
    "content-type":        "application/x-amz-json-1.1",
    "host":                host,
    "x-amz-date":          amzDate,
    "x-amz-target":        `secretsmanager.${action}`,
    "x-amz-content-sha256": payloadHash,
  };
  if (sessionToken) headers["x-amz-security-token"] = sessionToken;

  const sortedHeaders = Object.keys(headers).sort();
  const canonicalHeaders = sortedHeaders.map((k) => `${k}:${headers[k]}`).join("\n") + "\n";
  const signedHeadersStr = sortedHeaders.join(";");

  const canonicalRequest = [
    "POST", "/", "",
    canonicalHeaders,
    signedHeadersStr,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${region}/${SERVICE}/aws4_request`;
  const stringToSign = [
    ALGORITHM,
    amzDate,
    credentialScope,
    sha256hex(canonicalRequest),
  ].join("\n");

  const signature = hmac(signingKey(secretKey, dateStamp, region, SERVICE), stringToSign).toString("hex");
  const authHeader = `${ALGORITHM} Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeadersStr}, Signature=${signature}`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { ...headers, Authorization: authHeader },
    body: payload,
  });

  const json = await res.json() as any;
  if (!res.ok) {
    throw new Error(`AWS Secrets Manager error: ${json.__type ?? res.statusText} — ${json.Message ?? ""}`);
  }
  return json;
}

// ── Provider ──────────────────────────────────────────────────────────────────

export const awsSecretsManagerProvider: SecretProviderModule = {
  id: "aws_secrets_manager",
  descriptor: {
    id:                  "aws_secrets_manager",
    label:               "AWS Secrets Manager",
    requiresExternalRef: true,
  },

  async createVersion({ value, externalRef }) {
    if (!externalRef) throw unprocessable("AWS Secrets Manager requires a secret ARN or name as externalRef.");
    const cfg = getConfig();
    // Store value in AWS — create or update
    try {
      await awsSecretsRequest("PutSecretValue", {
        SecretId:     externalRef,
        SecretString: value,
      }, cfg);
    } catch (err: any) {
      if (err.message?.includes("ResourceNotFoundException")) {
        await awsSecretsRequest("CreateSecret", {
          Name:         externalRef,
          SecretString: value,
          Description:  "Managed by Swwarm",
        }, cfg);
      } else {
        throw err;
      }
    }
    // Don't store plaintext locally — material is just a pointer
    return {
      material:     { provider: "aws_secrets_manager", ref: externalRef },
      valueSha256:  createHash("sha256").update(value).digest("hex"),
      externalRef,
    };
  },

  async resolveVersion({ externalRef }) {
    if (!externalRef) throw unprocessable("AWS Secrets Manager: externalRef (ARN/name) is required for resolution.");
    const cfg = getConfig();
    const result = await awsSecretsRequest("GetSecretValue", { SecretId: externalRef }, cfg) as any;
    const secret = result.SecretString ?? result.SecretBinary;
    if (!secret) throw new Error("AWS Secrets Manager: secret has no string value");
    return String(secret);
  },
};
