/**
 * Post-match press quotes via Azure OpenAI / AI Foundry (chat completions).
 *
 * Flow:
 * 1. `npm run dev` + `.env.local` → browser calls `/api/azure-foundry/...` (Vite proxies to Azure, adds api-key).
 * 2. Production static build (e.g. GitHub Pages) → same path usually 404s; use dev or host a real proxy.
 *
 * Env (.env.local, restart dev server):
 *   VITE_AZURE_FOUNDRY_ENDPOINT=https://YOUR-RESOURCE.cognitiveservices.azure.com
 *   AZURE_FOUNDRY_API_KEY=...   (recommended: not bundled into the browser; Vite proxy injects it)
 *   Or: VITE_AZURE_FOUNDRY_API_KEY=...   (works in dev; avoid for production builds)
 *   VITE_AZURE_FOUNDRY_DEPLOYMENT=gpt-oss-120b
 *   VITE_AZURE_FOUNDRY_API_VERSION=2024-12-01-preview   (optional)
 */

const SYSTEM = `You are a football manager giving a post-match press conference. Speak in short, punchy quotes like a real Championship Manager press conference. 2-3 sentences max. Never break character. Vary your tone based on the result and context — frustrated after losses, cautiously optimistic after draws, proud after big wins. Reference specific match events when mentioned.`;

function readConfig() {
  return {
    endpoint: (import.meta.env.VITE_AZURE_FOUNDRY_ENDPOINT || "").replace(/\/$/, ""),
    apiKey: import.meta.env.VITE_AZURE_FOUNDRY_API_KEY || "",
    deployment: import.meta.env.VITE_AZURE_FOUNDRY_DEPLOYMENT || "gpt-oss-120b",
    apiVersion: import.meta.env.VITE_AZURE_FOUNDRY_API_VERSION || "2024-12-01-preview",
  };
}

function buildUserPrompt(matchData) {
  return [
    `We ${matchData.result} ${matchData.score} ${matchData.venue} to ${matchData.opponent}.`,
    matchData.goals ? `Goals: ${matchData.goals}.` : "",
    `Team morale is ${matchData.morale}.`,
    `We are ${matchData.position} in the table.`,
    matchData.extra || "",
  ]
    .filter(Boolean)
    .join(" ");
}

const OFFLINE = {
  won: [
    "The lads were magnificent today. That's the kind of performance that keeps us up.",
    "Three points, clean sheet mentality. I couldn't ask for more.",
    "We executed the game plan perfectly. Full credit to the players.",
  ],
  lost: [
    "I'm not going to make excuses. We weren't good enough today, simple as that.",
    "Disappointing. We need to have a long hard look at ourselves before Saturday.",
    "The goals we conceded were schoolboy stuff. We have to be better.",
  ],
  drew: [
    "A point away from home, I'll take that. We showed character to hang in there.",
    "Mixed feelings. We had chances to win it but at least we didn't lose.",
    "It's a fair result. Neither side did enough to win the game.",
  ],
};

function offlineQuote(matchData) {
  const list = OFFLINE[matchData.result] || OFFLINE.drew;
  const quote = list[Math.floor(Math.random() * list.length)];
  return quote;
}

/**
 * @returns {{ ok: false, quote: string, detail: string } | { ok: true, quote: string }}
 */
export async function fetchPressConferenceQuote(matchData, options = {}) {
  const { signal } = options;
  const { endpoint, apiKey, deployment, apiVersion } = readConfig();

  // Dev: only the endpoint must be in VITE_* (browser). The proxy adds api-key from AZURE_FOUNDRY_API_KEY or VITE_* in .env.local (never log the key).
  if (import.meta.env.DEV) {
    if (!endpoint) {
      return {
        ok: false,
        quote: offlineQuote(matchData),
        detail:
          "Add VITE_AZURE_FOUNDRY_ENDPOINT to .env.local (and AZURE_FOUNDRY_API_KEY for the proxy), then restart npm run dev.",
      };
    }
  } else if (!endpoint || !apiKey) {
    return {
      ok: false,
      quote: offlineQuote(matchData),
      detail:
        "No Azure config in this build (static hosting needs a proxy or injected env with endpoint + key).",
    };
  }

  const path = `/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`;
  const url = import.meta.env.DEV ? `/api/azure-foundry${path}` : `${endpoint}${path}`;
  const headers = { "Content-Type": "application/json" };
  if (!import.meta.env.DEV) headers["api-key"] = apiKey;

  const body = JSON.stringify({
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: buildUserPrompt(matchData) },
    ],
    max_tokens: 120,
    temperature: 0.9,
  });

  try {
    const response = await fetch(url, { method: "POST", headers, body, signal });

    if (!response.ok) {
      const snippet = (await response.text()).slice(0, 280);
      const detail = `HTTP ${response.status}${snippet ? ` — ${snippet}` : ""}`;
      return { ok: false, quote: offlineQuote(matchData), detail };
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) {
      return {
        ok: false,
        quote: offlineQuote(matchData),
        detail: "Model returned no text (check deployment and response format).",
      };
    }
    return { ok: true, quote: text };
  } catch (err) {
    if (err?.name === "AbortError") throw err;
    const detail =
      import.meta.env.PROD
        ? `Request failed (${err?.message || err}). A static site cannot reach Azure from the browser (CORS / no proxy). Use npm run dev with .env.local, or deploy a small API proxy.`
        : `Request failed (${err?.message || err}). Check dev server is running and vite.config proxy matches your endpoint.`;
    console.error("[press-conference]", detail);
    return { ok: false, quote: offlineQuote(matchData), detail };
  }
}

/** @deprecated use fetchPressConferenceQuote */
export async function generatePressConference(matchData) {
  const r = await fetchPressConferenceQuote(matchData);
  return { quote: r.quote, fromApi: r.ok };
}

export function getFallbackQuote(matchData) {
  return { quote: offlineQuote(matchData), fromApi: false };
}
