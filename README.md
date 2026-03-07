# LiveRun

![LiveRun demo](demo.gif)

Real-time run tracking. An Apple Watch app streams GPS, heart rate, pace, and elevation data to a live web dashboard with a 3D map, stats, km splits, and cheers.

## Prerequisites

- [Specific](https://specific.dev): `curl -fsSL https://specific.dev/install.sh | sh`
- A [Mapbox](https://mapbox.com) access token

## Getting Started

```bash
npm install
specific dev
```

You'll be prompted to enter your Mapbox token on first run. Specific handles the database, real-time sync, and dev server — all configured in `specific.hcl`.

## Deploy to Specific Cloud

```bash
specific deploy
```
