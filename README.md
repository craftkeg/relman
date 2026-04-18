# Relegation Manager

A Championship Manager 01/02-style football management game built with React. You take over a struggling side at gameweek 19 with 19 games to survive relegation.

## Play

Live on GitHub Pages: **https://craftkeg.github.io/relman/**

## Features

- Squad selection, formation, and tactical instructions
- Text-based match engine with live commentary
- League table, fixtures, and results
- Press conferences (AI-generated via Azure OpenAI)
- Auto-save and career history

## Development

```bash
npm install
npm run dev
```

Runs on `http://localhost:5173/relman/`.

### Environment variables (optional)

For press conference features, create `.env.local`:

```
VITE_AZURE_FOUNDRY_ENDPOINT=https://your-resource.cognitiveservices.azure.com
VITE_AZURE_FOUNDRY_DEPLOYMENT=your-deployment
AZURE_FOUNDRY_API_KEY=your-key
```

## Azure Function Proxy (press conferences on live site)

The GitHub Pages build is static, so AI press conference quotes need a server-side proxy to hold the API key. An Azure Function in `api/` handles this.

### Deploy the function

1. Create an Azure Function App (Node.js 18+, Consumption plan)
2. Set app settings:
   - `AZURE_FOUNDRY_ENDPOINT` — your Azure OpenAI resource URL
   - `AZURE_FOUNDRY_API_KEY` — API key from Azure Portal
   - `AZURE_FOUNDRY_DEPLOYMENT` — model deployment name (default: `gpt-oss-120b`)
3. Deploy the `api/` folder (VS Code Azure extension, `func azure functionapp publish`, or GitHub Actions)
4. Set `VITE_PRESS_API_URL` in the GitHub Pages build environment to your function URL, e.g. `https://your-func.azurewebsites.net/api/press-conference`

### Local dev

No function needed locally — the Vite dev proxy handles it via `.env.local`.

## Stack

- Vite + React
- GitHub Pages (deploy on push to `main`)
- Azure Function (press conference AI proxy)

## License

MIT
