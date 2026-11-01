# Neolithic Engine

A self-running fantasy world on a dedicated Galaxy S21, where about 700 years of history play out over one real day. Stick-figure bands forage, settle, farm, raid, worship and form city-states, followed through quick glances and a written chronicle.

Created from a copy of `artificial-life` at commit `ca3e97f`.

## Requirements
- Node.js 20.19+ or 22.12+
- npm
- Git

## Start
```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Headless simulation
```bash
npm run sim -- --seed 3 --years 50
```

## Always-on server
```bash
npm run server
```

Runs the simulation server at `http://localhost:8080`. The world keeps running with nobody watching, is saved to `./data` every 5 minutes and on shutdown, and resumes where it was after a restart.

## Checks
```bash
npm run verify
```
