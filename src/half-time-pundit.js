/**
 * Half-time pundit panel — 3 pundits discuss the first half, TV broadcast style.
 *
 * Dev:  browser → /api/azure-foundry/… → Vite proxy → Azure
 * Prod: browser → VITE_PRESS_API_URL (Azure Function proxy) → Azure
 * No API: offline canned pundit conversations
 */

const PUNDITS = {
  "🏴󠁧󠁢󠁥󠁮󠁧󠁿 English Premier League": ["Gary Neville", "Jamie Carragher", "Ian Wright"],
  "🇮🇹 Italian Serie A": ["Alessandro Del Piero", "Luca Toni", "Gianluca Vialli"],
  "🇪🇸 Spanish La Liga": ["Guillem Balagué", "Álvaro Benito", "Miguel Ángel Nadal"],
  "🇫🇷 French Ligue 1": ["Thierry Henry", "Marcel Desailly", "Robert Pirès"],
  "🇩🇪 German Bundesliga": ["Lothar Matthäus", "Jens Lehmann", "Stefan Effenberg"],
  "🏴󠁧󠁢󠁳󠁣󠁴󠁿 Scottish Premier": ["Ally McCoist", "Chris Sutton", "Pat Nevin"],
};
const DEFAULT_PUNDITS = ["Gary Neville", "Jamie Carragher", "Ian Wright"];

function getPundits(league) {
  return PUNDITS[league] || DEFAULT_PUNDITS;
}

function buildSystemPrompt(names) {
  return `You are writing a half-time TV pundit discussion between three pundits: ${names[0]}, ${names[1]}, and ${names[2]}. Write a short, natural conversation — each pundit speaks once or twice. They should agree, disagree, build on each other's points. Be direct, opinionated, knowledgeable. Reference specific match events when mentioned. Never break character. Format each line as:\n${names[0]}: "quote"\n${names[1]}: "quote"\netc. Do not add narration or stage directions. 4-6 lines of dialogue total.`;
}

function readConfig() {
  return {
    endpoint: (import.meta.env.VITE_AZURE_FOUNDRY_ENDPOINT || "").replace(/\/$/, ""),
    deployment: import.meta.env.VITE_AZURE_FOUNDRY_DEPLOYMENT || "gpt-oss-120b",
    apiVersion: import.meta.env.VITE_AZURE_FOUNDRY_API_VERSION || "2024-12-01-preview",
    pressApiUrl: (import.meta.env.VITE_PRESS_API_URL || "").replace(/\/$/, ""),
  };
}

function buildPunditPrompt(htData) {
  return [
    `Half time: ${htData.homeTeam} ${htData.score} ${htData.awayTeam}.`,
    htData.events ? `First half: ${htData.events}.` : "",
    `You are analysing from the perspective of ${htData.playerTeam}, who are ${htData.position} in the table.`,
    htData.venue === "at home" ? `${htData.playerTeam} are at home.` : `${htData.playerTeam} are away.`,
  ]
    .filter(Boolean)
    .join(" ");
}

const OFFLINE = {
  winning: [
    [
      "{0}: \"They've been the better side by a distance. Controlled that first half from start to finish.\"",
      "{1}: \"The pressing has been relentless. The opposition can't get out of their own half.\"",
      "{2}: \"Manager's got his tactics spot on. Don't change a thing at the break.\"",
      "{0}: \"Exactly. Stay compact, stay disciplined, and this game is theirs.\"",
    ],
    [
      "{0}: \"Clinical when it mattered. You can't ask for more than that.\"",
      "{1}: \"The movement up front has been superb. Defenders don't know who to pick up.\"",
      "{2}: \"They need to stay focused though. I've seen too many teams sit back and invite pressure.\"",
      "{1}: \"Agreed. Keep the foot on the throat. Don't give them a sniff.\"",
    ],
  ],
  losing: [
    [
      "{0}: \"They've been second best all half. Something has to change tactically.\"",
      "{1}: \"The midfield is being overrun. No protection for the back four at all.\"",
      "{2}: \"The manager needs to be brave here. Maybe a formation change, get another body in midfield.\"",
      "{0}: \"They look nervous. Need a big character to grab hold of this game.\"",
    ],
    [
      "{0}: \"The manager will be tearing strips off them in that dressing room.\"",
      "{2}: \"And rightly so. The intensity just hasn't been there from the first whistle.\"",
      "{1}: \"They're not competing for second balls, they're not winning their individual battles.\"",
      "{0}: \"Fifteen minutes to regroup. They need to come out a completely different side.\"",
    ],
  ],
  drawing: [
    [
      "{0}: \"Tight first half. Neither side willing to commit too many bodies forward.\"",
      "{1}: \"It's been very cagey. You can see both managers have done their homework.\"",
      "{2}: \"Someone needs to take a risk in the second half or this could end goalless.\"",
      "{0}: \"The team that shows more ambition after the break will nick this, I'm sure of it.\"",
    ],
    [
      "{1}: \"Not a lot in it so far. Decent battle in the middle of the park.\"",
      "{2}: \"I'd like to see them get their creative players on the ball more though.\"",
      "{0}: \"Agreed. Too many sideways passes. They need to play forward.\"",
      "{1}: \"One moment of quality could decide this. It's there for the taking.\"",
    ],
  ],
  goalless: [
    [
      "{0}: \"Not much to write home about that half. Very frustrating watch.\"",
      "{1}: \"All a bit sterile. Plenty of possession but no end product.\"",
      "{2}: \"Someone needs to grab this game by the scruff of the neck.\"",
      "{0}: \"The manager might want to think about a change. Something to unlock this.\"",
      "{1}: \"Needs more creativity. Get someone on who can pick a pass.\"",
    ],
    [
      "{2}: \"Dour half of football. The final ball has been lacking from both sides.\"",
      "{0}: \"Neither keeper has had a save to make. That tells you everything.\"",
      "{1}: \"They need to be more direct. Stop trying to walk it in and put some balls in the box.\"",
      "{0}: \"Absolutely. Take a shot, test the keeper. Force something to happen.\"",
    ],
  ],
};

function offlinePundit(htData, names) {
  const list = OFFLINE[htData.situation] || OFFLINE.drawing;
  const convo = list[Math.floor(Math.random() * list.length)];
  return convo.map(line =>
    line.replace("{0}", names[0]).replace("{1}", names[1]).replace("{2}", names[2])
  );
}

/** Parse AI response into individual pundit lines. */
function parseConversation(text, names) {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const parsed = [];
  for (const line of lines) {
    const isPunditLine = names.some(n => line.startsWith(n + ":") || line.startsWith(n + " :"));
    if (isPunditLine) {
      parsed.push(line);
    } else if (parsed.length > 0) {
      parsed[parsed.length - 1] += " " + line;
    }
  }
  return parsed.length >= 2 ? parsed : null;
}

function extractText(data) {
  const choice = data?.choices?.[0];
  if (!choice) return "";
  if (!choice.message) return typeof choice.text === "string" ? choice.text.trim() : "";
  const msg = choice.message;
  if (typeof msg.content === "string" && msg.content.trim()) return msg.content.trim();
  if (Array.isArray(msg.content)) {
    const joined = msg.content
      .map(p => (typeof p === "string" ? p : p?.text || p?.content || ""))
      .join("");
    if (joined.trim()) return joined.trim();
  }
  if (typeof msg.reasoning_content === "string" && msg.reasoning_content.trim()) {
    const sentences = msg.reasoning_content.trim().split(/(?<=[.!?])\s+/).filter(Boolean);
    const tail = sentences.length >= 2 ? sentences.slice(-2).join(" ") : msg.reasoning_content.trim();
    return tail.length > 400 ? tail.slice(-400).trim() : tail;
  }
  return "";
}

/**
 * @param {object} htData - { homeTeam, awayTeam, playerTeam, score, situation, venue, events, position }
 * @param {string} league - league key for pundit names
 * @returns {Promise<{ ok: boolean, lines: string[] }>}
 */
export async function fetchHalfTimePundit(htData, league, options = {}) {
  const { signal } = options;
  const names = getPundits(league);
  const { endpoint, deployment, apiVersion, pressApiUrl } = readConfig();

  const useProxy = !import.meta.env.DEV && pressApiUrl;

  if (import.meta.env.DEV) {
    if (!endpoint) return { ok: false, lines: offlinePundit(htData, names) };
  } else if (!pressApiUrl) {
    return { ok: false, lines: offlinePundit(htData, names) };
  }

  let url;
  if (useProxy) {
    url = pressApiUrl;
  } else {
    const path = `/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`;
    url = `/api/azure-foundry${path}`;
  }

  const body = JSON.stringify({
    messages: [
      { role: "system", content: buildSystemPrompt(names) },
      { role: "user", content: buildPunditPrompt(htData) },
    ],
    max_tokens: 1024,
    temperature: 0.9,
  });

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal,
    });
    if (!response.ok) return { ok: false, lines: offlinePundit(htData, names) };
    const data = await response.json();
    const text = extractText(data);
    const parsed = text ? parseConversation(text, names) : null;
    return parsed ? { ok: true, lines: parsed } : { ok: false, lines: offlinePundit(htData, names) };
  } catch (err) {
    if (err?.name === "AbortError") throw err;
    return { ok: false, lines: offlinePundit(htData, names) };
  }
}

export function getFallbackPundit(htData, league) {
  return { ok: false, lines: offlinePundit(htData, getPundits(league)) };
}
