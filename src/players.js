// Real-player squad data for select leagues.
// To update squads, edit the per-league JSON directly (src/players-epl.json etc).
// See README "Updating squads" for conventions.

import EPL from "./players-epl.json";
import SERIEA from "./players-seriea.json";
import LALIGA from "./players-laliga.json";
import LIGUE1 from "./players-ligue1.json";
import BUNDESLIGA from "./players-bundesliga.json";
import TEAMS from "./teams.json";

const ROSTERS = [
  { key: "🏴󠁧󠁢󠁥󠁮󠁧󠁿 English Premier League", data: EPL, file: "players-epl.json" },
  { key: "🇮🇹 Italian Serie A", data: SERIEA, file: "players-seriea.json" },
  { key: "🇪🇸 Spanish La Liga", data: LALIGA, file: "players-laliga.json" },
  { key: "🇫🇷 French Ligue 1", data: LIGUE1, file: "players-ligue1.json" },
  { key: "🇩🇪 German Bundesliga", data: BUNDESLIGA, file: "players-bundesliga.json" },
];

function stripReadme(roster) {
  const { _readme, ...rest } = roster;
  return rest;
}

function validate(roster, leagueKey, file) {
  const leagueTeams = TEAMS[leagueKey] || [];
  const teamNames = new Set(leagueTeams.map((t) => t.nm));
  const rosterKeys = Object.keys(roster);

  const missing = leagueTeams.filter((t) => !rosterKeys.includes(t.nm));
  if (missing.length) {
    console.warn(`[players] ${file}: no real-squad data for: ${missing.map((t) => t.nm).join(", ")}. These teams will use generated names.`);
  }

  const unknown = rosterKeys.filter((k) => !teamNames.has(k));
  if (unknown.length) {
    console.warn(`[players] ${file}: unknown team keys: ${unknown.join(", ")}. Check spelling vs teams.json.`);
  }

  for (const [team, players] of Object.entries(roster)) {
    const seen = new Set();
    for (const p of players) {
      if (seen.has(p.nm)) {
        console.warn(`[players] ${file}: duplicate name "${p.nm}" in ${team}. Stats tracking uses names as keys — fix the duplicate.`);
      }
      seen.add(p.nm);
    }
  }
}

export const LEAGUE_PLAYERS = {};
for (const { key, data, file } of ROSTERS) {
  const roster = stripReadme(data);
  validate(roster, key, file);
  LEAGUE_PLAYERS[key] = roster;
}
