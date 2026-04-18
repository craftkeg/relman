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

## Stack

- Vite + React
- GitHub Pages (deploy on push to `main`)

## License

MIT
