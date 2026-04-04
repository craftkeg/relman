// Press conference — Azure OpenAI / AI Foundry (chat completions).
// Set VITE_AZURE_FOUNDRY_* in .env.local (see comments at bottom). Never commit API keys.

const PRESS_SYSTEM_PROMPT = `You are a football manager giving a post-match press conference. Speak in short, punchy quotes like a real Championship Manager press conference. 2-3 sentences max. Never break character. Vary your tone based on the result and context — frustrated after losses, cautiously optimistic after draws, proud after big wins. Reference specific match events when mentioned.`;

function foundryConfig() {
  const endpoint = (import.meta.env.VITE_AZURE_FOUNDRY_ENDPOINT || "").replace(/\/$/, "");
  const deployment = import.meta.env.VITE_AZURE_FOUNDRY_DEPLOYMENT || "gpt-oss-120b";
  const apiKey = import.meta.env.VITE_AZURE_FOUNDRY_API_KEY || "";
  const apiVersion = import.meta.env.VITE_AZURE_FOUNDRY_API_VERSION || "2024-12-01-preview";
  return { endpoint, deployment, apiKey, apiVersion };
}

/** @returns {{ quote: string, fromApi: boolean }} */
export function getFallbackQuote(matchData) {
  const fallbacks = {
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
  const quotes = fallbacks[matchData.result] || fallbacks.drew;
  const quote = quotes[Math.floor(Math.random() * quotes.length)];
  return { quote, fromApi: false };
}

/**
 * @param {object} matchData
 * @param {"won"|"lost"|"drew"} matchData.result
 * @param {string} matchData.score e.g. "2-1" (your goals first)
 * @param {"at home"|"away"} matchData.venue
 * @param {string} matchData.opponent
 * @param {string} [matchData.goals]
 * @param {string} matchData.morale
 * @param {string} matchData.position e.g. "21st"
 * @param {string} [matchData.extra]
 * @returns {Promise<{ quote: string, fromApi: boolean }>}
 */
export async function generatePressConference(matchData) {
  const prompt = [
    `We ${matchData.result} ${matchData.score} ${matchData.venue} to ${matchData.opponent}.`,
    matchData.goals ? `Goals: ${matchData.goals}.` : "",
    `Team morale is ${matchData.morale}.`,
    `We are ${matchData.position} in the table.`,
    matchData.extra || "",
  ]
    .filter(Boolean)
    .join(" ");

  const { endpoint, deployment, apiKey, apiVersion } = foundryConfig();
  if (!endpoint || !apiKey) return getFallbackQuote(matchData);

  try {
    const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: PRESS_SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        max_tokens: 120,
        temperature: 0.9,
      }),
    });

    if (!response.ok) {
      console.error("Foundry API error:", response.status);
      return getFallbackQuote(matchData);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) return getFallbackQuote(matchData);
    return { quote: text, fromApi: true };
  } catch (err) {
    console.error("Press conference error:", err);
    return getFallbackQuote(matchData);
  }
}

/*
  .env.local (not committed; *.local is gitignored):

  VITE_AZURE_FOUNDRY_ENDPOINT=https://YOUR-RESOURCE.cognitiveservices.azure.com
  VITE_AZURE_FOUNDRY_DEPLOYMENT=gpt-oss-120b
  VITE_AZURE_FOUNDRY_API_KEY=your-key-here
  # optional:
  # VITE_AZURE_FOUNDRY_API_VERSION=2024-12-01-preview
*/
