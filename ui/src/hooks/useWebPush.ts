import { useState, useCallback } from "react";
import { useCompany } from "../context/CompanyContext";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function useWebPush() {
  const { selectedCompanyId } = useCompany();
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  const subscribe = useCallback(async () => {
    if (!VAPID_PUBLIC_KEY) return;
    if (!selectedCompanyId) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as BufferSource,
      });

      await fetch(`/api/companies/${selectedCompanyId}/push/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          endpoint: sub.endpoint,
          p256dh: btoa(
            String.fromCharCode(...new Uint8Array(sub.getKey("p256dh")!)),
          ),
          auth: btoa(
            String.fromCharCode(...new Uint8Array(sub.getKey("auth")!)),
          ),
        }),
      });

      setSubscribed(true);
    } catch (err) {
      console.error("WebPush subscribe failed", err);
    } finally {
      setLoading(false);
    }
  }, [selectedCompanyId]);

  const unsubscribe = useCallback(async () => {
    if (!selectedCompanyId) return;
    if (!("serviceWorker" in navigator)) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) return;

      await fetch(`/api/companies/${selectedCompanyId}/push/unsubscribe`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });

      await sub.unsubscribe();
      setSubscribed(false);
    } catch (err) {
      console.error("WebPush unsubscribe failed", err);
    } finally {
      setLoading(false);
    }
  }, [selectedCompanyId]);

  return { subscribed, loading, subscribe, unsubscribe };
}
