const CACHE_TTL_MS = 30_000;
let cached = null;
export async function listOllamaModels() {
    const now = Date.now();
    if (cached && cached.expiresAt > now)
        return cached.models;
    try {
        const res = await fetch("http://localhost:11434/api/tags", {
            signal: AbortSignal.timeout(5000),
        });
        if (!res.ok)
            return cached?.models ?? [];
        const data = (await res.json());
        const models = (data.models ?? []).map((m) => ({
            id: m.name,
            label: m.name,
        }));
        cached = { expiresAt: now + CACHE_TTL_MS, models };
        return models;
    }
    catch {
        return cached?.models ?? [];
    }
}
//# sourceMappingURL=models.js.map