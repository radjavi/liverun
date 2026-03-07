# LiveRun

![LiveRun demo](demo.gif)

Real-time run tracking. An Apple Watch app streams GPS, heart rate, pace, and elevation data to a live web dashboard with a 3D map, stats, km splits, and cheers.

## Web

The web app (`web/`) is a Next.js app that displays a live 3D Mapbox map, real-time stats, km splits, and cheers. It uses Specific for infrastructure (PostgreSQL with Electric SQL sync).

### Prerequisites

- [Specific](https://specific.dev): `curl -fsSL https://specific.dev/install.sh | sh`
- A [Mapbox](https://mapbox.com) access token

### Getting Started

```bash
cd web
npm install
specific dev
```

You'll be prompted to enter your Mapbox token on first run. Specific handles the database, real-time sync, and dev server — all configured in `specific.hcl`.

### Deploy to Specific Cloud

```bash
cd web
specific deploy
```

Note that this requires a Specific account.

## Apple Watch

The watch app (`watch/`) tracks workouts using HealthKit and CoreLocation, streaming GPS coordinates, heart rate, pace, and elevation in real time to the web dashboard.

### Prerequisites

- Xcode
- Apple Watch (or simulator)

### Getting Started

Open `watch/LiveRun/LiveRun.xcodeproj` in Xcode, select your Apple Watch target, and run.
