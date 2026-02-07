# HackHours

HackHours is a local-first, offline coding activity tracker inspired by WakaTime. It runs as a lightweight background watcher, records activity in ChronoDB, and provides rich CLI summaries.

## Features
- Local-first, offline-only storage (ChronoDB JSON files)
- Automatic session tracking with idle detection
- Language, project, and file breakdowns
- Daily/weekly/monthly summaries with ASCII charts
- Cross-platform CLI (Windows/macOS/Linux)

## Install (local dev)
```bash
npm install
```

## Build
```bash
npm run build
```

## Initialize
```bash
hackhours init
```

## Start/Stop Tracking
```bash
hackhours start
hackhours stop
hackhours status
```

## Reports
```bash
hackhours today
hackhours week
hackhours month
hackhours stats --from 2026-02-01 --to 2026-02-28
hackhours languages --from 2026-02-01 --to 2026-02-28
hackhours projects --from 2026-02-01 --to 2026-02-28
```

## Config
Config is stored at `~/.hackhours/config.json`:
```json
{
  "directories": ["C:/work/my-project"],
  "idleMinutes": 2,
  "exclude": ["**/node_modules/**", "**/.git/**"],
  "dataDir": "C:/Users/USER/.hackhours/data"
}
```

## Data Storage (ChronoDB)
Data is stored in `~/.hackhours/data` by default. Collections used:
- `sessions`
- `events`
- `aggregates`

## Shell Completions
```bash
source completions/hackhours.bash
```
For zsh, copy `completions/_hackhours` into your `$fpath`.

## Tests
```bash
npm test
```

## Notes
- `hackhours start` spawns a detached background process.
- Use `hackhours stop` to end tracking cleanly.
