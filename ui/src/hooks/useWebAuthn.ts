/**
 * Client-only biometric gate for approvals.
 * Calls navigator.credentials.get with userVerification: "required".
 * No server round-trip — just verifies the user is physically present.
 */
export async function requestBiometric(): Promise<boolean> {
  if (!window.PublicKeyCredential) return true; // unsupported — don't block

  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);

  try {
    await navigator.credentials.get({
      publicKey: {
        challenge,
        timeout: 60000,
        userVerification: "required",
        rpId: window.location.hostname,
      },
    });
    return true;
  } catch {
    return false;
  }
}

export function isBiometricAvailable(): boolean {
  return typeof window !== "undefined" && Boolean(window.PublicKeyCredential);
}
