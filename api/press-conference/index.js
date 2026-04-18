const AZURE_ENDPOINT = process.env.AZURE_FOUNDRY_ENDPOINT || "";
const AZURE_KEY = process.env.AZURE_FOUNDRY_API_KEY || "";
const DEPLOYMENT = process.env.AZURE_FOUNDRY_DEPLOYMENT || "gpt-oss-120b";
const API_VERSION = process.env.AZURE_FOUNDRY_API_VERSION || "2024-12-01-preview";

const ALLOWED_ORIGINS = [
  "https://craftkeg.github.io",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
];

function corsHeaders(req) {
  const origin = req.headers["origin"] || "";
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

module.exports = async function (context, req) {
  const cors = corsHeaders(req);

  if (req.method === "OPTIONS") {
    context.res = { status: 204, headers: cors };
    return;
  }

  if (!AZURE_ENDPOINT || !AZURE_KEY) {
    context.res = {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Azure credentials not configured on the proxy." }),
    };
    return;
  }

  const url = `${AZURE_ENDPOINT.replace(/\/$/, "")}/openai/deployments/${DEPLOYMENT}/chat/completions?api-version=${API_VERSION}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": AZURE_KEY },
      body: JSON.stringify(req.body),
    });

    const data = await response.text();
    context.res = {
      status: response.status,
      headers: { ...cors, "Content-Type": "application/json" },
      body: data,
    };
  } catch (err) {
    context.res = {
      status: 502,
      headers: { ...cors, "Content-Type": "application/json" },
      body: JSON.stringify({ error: `Proxy error: ${err.message}` }),
    };
  }
};
