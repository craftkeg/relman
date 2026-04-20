/**
 * Pre-match press room + dressing room AI quotes.
 *
 * Three small calls:
 *  - fetchJournalistQuestion(ctx)  — opening tabloid-style question
 *  - fetchManagerResponse(ctx, tone) — your reply, tone-shaped
 *  - fetchTeamTalkSpeech(ctx, talkId) — dressing-room speech
 *
 * Reuses the same dev/prod plumbing as press-conference.js — Vite proxy in
 * dev, Azure Function in prod (VITE_PRESS_API_URL). Each call has a small
 * canned fallback so the UI is never blocked.
 */

function readConfig() {
  return {
    endpoint: (import.meta.env.VITE_AZURE_FOUNDRY_ENDPOINT || "").replace(/\/$/, ""),
    deployment: import.meta.env.VITE_AZURE_FOUNDRY_DEPLOYMENT || "gpt-oss-120b",
    apiVersion: import.meta.env.VITE_AZURE_FOUNDRY_API_VERSION || "2024-12-01-preview",
    pressApiUrl: (import.meta.env.VITE_PRESS_API_URL || "").replace(/\/$/, ""),
  };
}

const REPORTERS = {
  "🏴󠁧󠁢󠁥󠁮󠁧󠁿 English Premier League": ["Henry Winter", "Martin Samuel", "Sam Wallace", "Oliver Holt"],
  "🇮🇹 Italian Serie A": ["Fabio Caressa", "Mario Sconcerti", "Carlo Pellegatti"],
  "🇪🇸 Spanish La Liga": ["Sid Lowe", "Cristina Cubero", "Manolo Lama"],
  "🇫🇷 French Ligue 1": ["Pierre Ménès", "Daniel Riolo", "Vincent Duluc"],
  "🇩🇪 German Bundesliga": ["Marcel Reif", "Tobias Escher", "Raphael Honigstein"],
  "🏴󠁧󠁢󠁳󠁣󠁴󠁿 Scottish Premier": ["Keith Jackson", "Hugh Keevins", "Roger Hannah"],
};
const DEFAULT_REPORTERS = ["Henry Winter", "Martin Samuel", "Sam Wallace"];

export function pickReporter(league) {
  const list = REPORTERS[league] || DEFAULT_REPORTERS;
  return list[Math.floor(Math.random() * list.length)];
}

const TONE_LABELS = {
  defiant: "defiant — stick your neck out, back your players, prove the doubters wrong",
  respectful: "respectful — humble, give the opposition full credit, classy",
  mindgames: "mind-games — subtly needle the opposition, hint at their weaknesses, plant a seed of doubt without being rude",
  playdown: "play-it-down — deflect pressure, take the focus off your team, downplay expectations",
};

const TALK_STYLES = {
  win: "confident and clear — you expect three points, set the standard, demand professionalism",
  noloss: "cautious and disciplined — keep it tight, don't lose this one, organisation over flair",
  mustwin: "urgent and intense — this is a must-win, leave nothing in the tank, maximum effort from the first whistle",
  noexpect: "relaxed and liberating — no pressure, play with freedom, enjoy yourselves, express yourselves",
};

function formatRecentForm(form) {
  if (!form || !form.length) return "no recent form";
  return form.join("");
}

function ctxLine(ctx) {
  const home = ctx.venue === "home" ? "at home" : "away";
  return `We are ${ctx.playerTeam} (${ctx.position}${ord(ctx.position)} in the table, recent form ${formatRecentForm(ctx.recentForm)}). Next up: ${ctx.opponent} ${home} (${ctx.opponentPosition}${ord(ctx.opponentPosition)}).`;
}
function ord(n) { return n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"; }

// ── OFFLINE FALLBACKS ───────────────────────────────────────────────

const OFFLINE_QUESTIONS = [
  "Tough fixture coming up — are you under pressure to get a result?",
  "Your form has been mixed lately. What's the message in the dressing room?",
  "Plenty of people writing your side off this weekend. Do they have a point?",
  "How big a game is this for you and the club?",
  "What does your team selection say about your approach to this one?",
  "Are you worried about the gap to safety?",
];

const OFFLINE_RESPONSES = {
  defiant: [
    "I back my players to a man. We'll let the football do the talking on Saturday.",
    "Write us off if you like — we hear it, and we use it. Come and watch us.",
    "I'm not interested in what people outside this dressing room think. We'll be ready.",
  ],
  respectful: [
    "They're a top side, no question. We'll have to be at our absolute best.",
    "Full credit to them — but we've got our own way of playing and we'll stick to it.",
    "We respect them massively. That doesn't mean we're going there to make up the numbers.",
  ],
  mindgames: [
    "They've looked nervous away from home this season. We'll see how they cope when it gets noisy.",
    "Their back four hasn't kept a clean sheet in weeks. We fancy our chances.",
    "Big squad, big budget — but the table doesn't lie. They're there for the taking.",
  ],
  playdown: [
    "It's just three points, same as any other game. We'll prepare the same way.",
    "I'm not getting carried away. One game at a time, that's all we can do.",
    "There's no pressure on us. We'll go out there and give it a go.",
  ],
};

const OFFLINE_TALKS = {
  win: [
    "Right, I want three points today. We've done the work, we know our jobs — now go and execute. No excuses.",
    "Standards. That's all I ask for. Win your battles, do your job, and we get what we deserve.",
  ],
  noloss: [
    "Tight and disciplined today. Don't get drawn into anything daft. Keep our shape, stay compact, see this one out.",
    "We don't need to win this with a flourish. Be professional, defend the box, take what comes our way.",
  ],
  mustwin: [
    "This is the one. Empty the tank. I want every single one of you finishing this game with nothing left in the legs. We need this.",
    "No hiding place today. Win your duel, make your runs, fight for every ball. This is a must-win, simple as that.",
  ],
  noexpect: [
    "Nobody outside this room expects anything from us today. So go and play. No fear, no pressure. Just play.",
    "Express yourselves. Take risks. Enjoy it. We've nothing to lose and everything to gain.",
  ],
};

function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

export function offlineQuestion() { return pickRandom(OFFLINE_QUESTIONS); }
export function offlineResponse(tone) { return pickRandom(OFFLINE_RESPONSES[tone] || OFFLINE_RESPONSES.defiant); }
export function offlineTalk(talkId) { return pickRandom(OFFLINE_TALKS[talkId] || OFFLINE_TALKS.win); }

/** Fallback brief — uses caller-supplied canned advice if available, else a generic line. */
export function offlineBrief(fallbackAdvice) {
  return fallbackAdvice || "Standard prep, boss. We'll know enough once we get out there and compete properly.";
}

// ── RESPONSE EXTRACTION (shared with press-conference.js shape) ─────

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
  // NEVER fall back to reasoning_content — for reasoning models (gpt-oss-120b) it's the model's
  // internal scratch pad ("Let's count...", "Example: ...") and leaking it into the UI looks broken.
  // If real content is empty, return empty and let the caller use its canned offline line.
  return "";
}

/** Strip leading speaker labels, surrounding quotes, "Manager:" etc. */
function cleanQuote(s) {
  if (!s) return "";
  let t = s.trim();
  t = t.replace(/^["“”']+|["“”']+$/g, "").trim();
  t = t.replace(/^(manager|gaffer|boss|coach)\s*:\s*/i, "").trim();
  return t;
}

function looksLikeReasoningLeak(s) {
  if (!s) return false;
  return [
    /let'?s count/i,
    /count words/i,
    /example\s*:/i,
    /that'?s \d+ words/i,
    /under \d+ words/i,
    /output only/i,
    /no preamble/i,
    /let'?s craft/i,
    /potential\s*:/i,
    /the user wants/i,
    /we need to reference/i,
    /maybe:/i,
    /\(\d+\)\s*["\u201c]/,
  ].some((re) => re.test(s));
}

function finalizeText(s) {
  const cleaned = cleanQuote(s);
  if (!cleaned || looksLikeReasoningLeak(cleaned)) return "";
  return cleaned;
}

// ── CORE FETCH ──────────────────────────────────────────────────────

async function callFoundry({ system, user, signal, max_tokens = 512, temperature = 0.9 }) {
  const { endpoint, deployment, apiVersion, pressApiUrl } = readConfig();
  const useProxy = !import.meta.env.DEV && pressApiUrl;

  if (import.meta.env.DEV) {
    if (!endpoint) return { ok: false, text: "", detail: "Missing VITE_AZURE_FOUNDRY_ENDPOINT in .env.local" };
  } else if (!pressApiUrl) {
    return { ok: false, text: "", detail: "Missing VITE_PRESS_API_URL for production proxy" };
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
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    max_tokens,
    temperature,
  });

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal,
    });
    if (!response.ok) {
      const snippet = (await response.text()).slice(0, 200);
      return { ok: false, text: "", detail: `HTTP ${response.status}${snippet ? ` — ${snippet}` : ""}` };
    }
    const data = await response.json();
    const text = extractText(data);
    if (!text) return { ok: false, text: "", detail: "Model returned no usable text" };
    return { ok: true, text, detail: "" };
  } catch (err) {
    if (err?.name === "AbortError") throw err;
    return { ok: false, text: "", detail: `Request failed (${err?.message || err})` };
  }
}

// ── PUBLIC FETCHERS ─────────────────────────────────────────────────

/**
 * @param {object} ctx { playerTeam, opponent, venue, position, opponentPosition, recentForm, league, reporter }
 * @returns {Promise<{ok:boolean, question:string, reporter:string, detail:string}>}
 */
export async function fetchJournalistQuestion(ctx, options = {}) {
  const reporter = ctx.reporter || pickReporter(ctx.league);
  const system = `You are ${reporter}, a sharp football journalist. Ask the manager ONE short pre-match question — under 25 words, punchy, specific to the situation. Reference their league position, opposition, recent form, or pressure if relevant. Do NOT start with 'Boss', 'Gaffer', or the manager's name. Output ONLY the question as it would appear in print — no planning, no meta-commentary, no word counts, no numbered lists, no drafts, no quotes around the whole thing.`;
  const user = ctxLine(ctx);
  const r = await callFoundry({ system, user, signal: options.signal, max_tokens: 1024, temperature: 0.95 });
  const finalText = finalizeText(r.text);
  if (!r.ok || !finalText) return { ok: false, question: offlineQuestion(), reporter, detail: r.detail || "Filtered likely reasoning output" };
  return { ok: true, question: finalText, reporter, detail: "" };
}

/**
 * @param {object} ctx same as above plus { question }
 * @param {"defiant"|"respectful"|"mindgames"|"playdown"} tone
 */
export async function fetchManagerResponse(ctx, tone, options = {}) {
  const toneDesc = TONE_LABELS[tone] || TONE_LABELS.defiant;
  const system = `You are a football manager replying in a pre-match press conference. Tone: ${toneDesc}. Reply in 1-2 short, punchy sentences, in character. Do NOT prefix with 'Manager:' or any speaker label. Output ONLY the reply, no quotes.`;
  const user = `${ctxLine(ctx)} Reporter asks: "${ctx.question || "Are you confident going into this one?"}"`;
  const r = await callFoundry({ system, user, signal: options.signal, max_tokens: 1024, temperature: 0.95 });
  const finalText = finalizeText(r.text);
  if (!r.ok || !finalText) return { ok: false, quote: offlineResponse(tone), detail: r.detail || "Filtered likely reasoning output" };
  return { ok: true, quote: finalText, detail: "" };
}

function formatXIBrief(players) {
  if (!players || !players.length) return "(unknown)";
  return players.slice(0, 4).map(p => {
    const flags = [];
    if (p.inj > 0) flags.push(`INJ ${p.inj}w`);
    if (p.sus > 0) flags.push(`SUS ${p.sus}w`);
    if (p.yc >= 4) flags.push(`${p.yc}YC`);
    if (p.fit < 70) flags.push(`fit ${p.fit}`);
    if (p.frm <= 35) flags.push(`poor form ${p.frm}`);
    if (p.frm >= 75) flags.push(`hot form ${p.frm}`);
    if (p.g >= 5) flags.push(`${p.g} gls`);
    return `${p.nm} (${p.pos}, OVR ${p.ovr}${flags.length ? ", " + flags.join(", ") : ""})`;
  }).join("; ");
}

/**
 * Tactical assistant manager brief — uses opposition + our own XI stats to surface insights.
 * @param {object} ctx ctxLine fields plus { oppFormation, oppMentality, oppPass, oppTackle, oppPress, oppForm: "WDLWW", oppXI, ourXI, fallbackAdvice }
 * @returns {Promise<{ ok: boolean, text: string, detail: string }>}
 */
export async function fetchAssistantBrief(ctx, options = {}) {
  const oppLine = `Opposition: ${ctx.opponent} (${ctx.opponentPosition}${ord(ctx.opponentPosition)}, recent form ${ctx.oppForm || "?"}). Setup: ${ctx.oppFormation || "4-4-2"} ${ctx.oppMentality || "Balanced"}, ${ctx.oppPass || "Mixed"} passing, ${ctx.oppTackle || "Normal"} tackling${ctx.oppPress ? ", high press" : ""}${ctx.oppOffside ? ", offside trap" : ""}.`;
  const oppXILine = `Opposition key XI: ${formatXIBrief(ctx.oppXI)}.`;
  const ourXILine = `Our key XI: ${formatXIBrief(ctx.ourXI)}.`;
  const venueLine = `We are ${ctx.playerTeam} (${ctx.position}${ord(ctx.position)}), playing ${ctx.venue === "home" ? "at home" : "away"}, recent form ${formatRecentForm(ctx.recentForm)}.`;

  const system = `You are an experienced football assistant manager giving the boss a quick pre-match tactical brief in the dressing room corridor. Speak in 2-3 short, punchy sentences. Be SPECIFIC: name a key opposition player or stat that matters (form streak, fitness, yellow cards close to a ban, an injury we can exploit, a defensive weakness). If something looks worth digging into, mention it naturally in passing, but keep the focus on the football rather than the UI. Keep it conversational, not a stat dump. Don't recommend a team-talk style — that's the boss's call. Speak as 'we' and 'us'. No preamble, no bullet points, no quote marks.`;
  const user = `${venueLine} ${oppLine} ${oppXILine} ${ourXILine}`;
  // Bigger budget than the other pre-match calls — this is gpt-oss-120b's biggest prompt of the four
  // (both XIs + opp setup + venue) and as a reasoning model it needs room to think *and* answer.
  const r = await callFoundry({ system, user, signal: options.signal, max_tokens: 2048, temperature: 0.85 });
  const finalText = finalizeText(r.text);
  if (!r.ok || !finalText) {
    return { ok: false, text: offlineBrief(ctx.fallbackAdvice), detail: r.detail || "Filtered likely reasoning output" };
  }
  return { ok: true, text: finalText, detail: "" };
}

/**
 * @param {object} ctx ctxLine fields plus { keyPlayers: [names] }
 * @param {"win"|"noloss"|"mustwin"|"noexpect"} talkId
 */
export async function fetchTeamTalkSpeech(ctx, talkId, options = {}) {
  const styleDesc = TALK_STYLES[talkId] || TALK_STYLES.win;
  const playersLine = ctx.keyPlayers && ctx.keyPlayers.length
    ? ` Key players in the XI: ${ctx.keyPlayers.slice(0, 4).join(", ")}.`
    : "";
  const system = `You are a football manager addressing the dressing room minutes before kickoff. Style: ${styleDesc}. 2-3 short, punchy sentences. Stay in character. You may name a player by surname for emphasis if it feels natural, but do not list them. No stage directions, no prefix labels, no quotes around the speech.`;
  const user = `${ctxLine(ctx)}${playersLine}`;
  const r = await callFoundry({ system, user, signal: options.signal, max_tokens: 1024, temperature: 0.9 });
  const finalText = finalizeText(r.text);
  if (!r.ok || !finalText) return { ok: false, speech: offlineTalk(talkId), detail: r.detail || "Filtered likely reasoning output" };
  return { ok: true, speech: finalText, detail: "" };
}
