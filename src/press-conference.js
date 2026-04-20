/**
 * Post-match press quotes via Azure OpenAI / AI Foundry (chat completions).
 *
 * Dev:  browser → /api/azure-foundry/… → Vite proxy → Azure (adds api-key)
 * Prod: browser → VITE_PRESS_API_URL (Azure Function proxy) → Azure
 *
 * Env (.env.local, restart dev server):
 *   VITE_AZURE_FOUNDRY_ENDPOINT  — Azure resource URL (dev proxy target)
 *   AZURE_FOUNDRY_API_KEY        — server-side only, Vite proxy injects it
 *   VITE_AZURE_FOUNDRY_DEPLOYMENT — model deployment name (default: gpt-oss-120b)
 *   VITE_PRESS_API_URL           — production Azure Function URL (e.g. https://your-func.azurewebsites.net/api/press-conference)
 */

const SYSTEM = `You are a football manager giving a post-match press conference. Speak in short, punchy quotes like a real Championship Manager press conference. 2-3 sentences max. Never break character. Vary your tone based on the result and context — frustrated after losses, cautiously optimistic after draws, proud after big wins. Reference specific match events when mentioned.`;

function readConfig() {
  return {
    endpoint: (import.meta.env.VITE_AZURE_FOUNDRY_ENDPOINT || "").replace(/\/$/, ""),
    apiKey: import.meta.env.VITE_AZURE_FOUNDRY_API_KEY || "",
    deployment: import.meta.env.VITE_AZURE_FOUNDRY_DEPLOYMENT || "gpt-oss-120b",
    apiVersion: import.meta.env.VITE_AZURE_FOUNDRY_API_VERSION || "2024-12-01-preview",
    pressApiUrl: (import.meta.env.VITE_PRESS_API_URL || "").replace(/\/$/, ""),
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

/** Azure / some reasoning models vary: string content, content[], legacy .text, or empty content + reasoning_content. */
function extractChatCompletionText(data) {
  const choice = data?.choices?.[0];
  if (!choice) return { text: "", finishReason: "" };
  const finishReason = choice.finish_reason || choice.finishReason || "";

  if (!choice.message) {
    const t = choice.text;
    return { text: typeof t === "string" ? t.trim() : "", finishReason };
  }

  const msg = choice.message;
  let c = msg.content;

  if (typeof c === "string" && c.trim()) return { text: c.trim(), finishReason };
  if (Array.isArray(c)) {
    const joined = c
      .map((part) => {
        if (typeof part === "string") return part;
        if (part?.type === "text" && part.text) return part.text;
        if (typeof part?.content === "string") return part.content;
        return "";
      })
      .join("");
    if (joined.trim()) return { text: joined.trim(), finishReason };
  }

  // Never use reasoning_content as a fallback — for reasoning models it's the model's internal
  // scratch pad ("Let's count...", "Example: ...") and leaks into the UI looking like a bug.
  return { text: "", finishReason };
}

/**
 * @returns {{ ok: false, quote: string, detail: string } | { ok: true, quote: string }}
 */
export async function fetchPressConferenceQuote(matchData, options = {}) {
  const { signal } = options;
  const { endpoint, apiKey, deployment, apiVersion, pressApiUrl } = readConfig();

  const useProxy = !import.meta.env.DEV && pressApiUrl;

  if (import.meta.env.DEV) {
    if (!endpoint) {
      return {
        ok: false,
        quote: offlineQuote(matchData),
        detail:
          "Add VITE_AZURE_FOUNDRY_ENDPOINT to .env.local (and AZURE_FOUNDRY_API_KEY for the proxy), then restart npm run dev.",
      };
    }
  } else if (!pressApiUrl) {
    return {
      ok: false,
      quote: offlineQuote(matchData),
      detail: "Set VITE_PRESS_API_URL to your Azure Function proxy URL for production builds.",
    };
  }

  let url, headers;
  if (useProxy) {
    url = pressApiUrl;
    headers = { "Content-Type": "application/json" };
  } else {
    const path = `/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`;
    url = `/api/azure-foundry${path}`;
    headers = { "Content-Type": "application/json" };
  }

  const body = JSON.stringify({
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: buildUserPrompt(matchData) },
    ],
    max_tokens: 1024,
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
    const { text, finishReason } = extractChatCompletionText(data);
    if (!text) {
      if (import.meta.env.DEV) {
        console.warn("[press-conference] Empty assistant text; choice[0] keys:", data.choices?.[0] && Object.keys(data.choices[0]));
      }
      return {
        ok: false,
        quote: offlineQuote(matchData),
        detail: `Model returned no usable text${finishReason ? ` (finish_reason: ${finishReason})` : ""}.`,
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
