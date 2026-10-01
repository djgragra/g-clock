# G-Clock

Free desktop app (Windows / macOS / Linux): a **big studio clock for radio presenters**. Time and date readable from metres away, an On Air / Rec switch, a recording timer with a 3·2·1 pre-roll, clocks for other cities, a countdown to your next break, news headlines from the RSS feeds you choose, and optional weather.

By Graziano Melzi · [OnAir Garage](https://onairgarage.com) — contact: hello@onairgarage.com

## Features

- **Huge time and date**, 24 or 12 hours, any time zone, seconds on or off. Dark only, high contrast.
- **ON AIR / REC** switch (key `O`).
- **Recording timer** (REC): free time, configurable quick times, visual 3·2·1 pre-roll, pause and resume, overrun shown in red, optional beeps. Space starts and pauses, `R` resets.
- **Break counter** (optional): counts down to the next break at the minutes of the hour you choose (for example `0, 30`), with a warning and a NOW flash.
- **World clocks** strip, fully configurable.
- **News**: headlines from RSS / Atom feeds you add (https only), one big headline at a time. Only title, source, time and link are shown; a click opens the article in your browser. The app reads the feeds itself, so there is no CORS problem and no server in between.
- **Weather** (optional, **off by default**): places found with Open-Meteo's geocoding; Open-Meteo credit always visible while it is on.
- **Your buttons**: add your own buttons that open a web page in your browser (remote guest link, studio camera, station site…), each with a note that explains what it is for, plus ready-made ideas.
- **Your logo**: PNG, JPG or SVG, resized to 512 px at most and stored only on your computer.
- Always on top, full screen (`F11`), keep the screen awake.
- **Languages**: English (default), Italiano, Español — follows the system, can be changed in Settings.
- Settings stay on your computer; **import / export as JSON** (no passwords or keys: the app uses none).

## Privacy and network

G-Clock only contacts:

- the news feeds **you** configured (https);
- `geocoding-api.open-meteo.com` and `api.open-meteo.com`, **only if you turn the weather on**;
- `api.github.com` / `github.com` to check for a new G-Clock release (can be turned off in Settings).

The window itself has no network access at all; everything remote goes through the main process, which accepts https addresses only. No accounts, no analytics, no telemetry.

## Install

Download the installer for your system from the [Releases](https://github.com/djgragra/g-clock/releases) page and check it against `SHA256SUMS.txt`.

The app is free and **not code-signed**, so the first launch may show a warning:

- **macOS**: if you see "app is damaged" or "cannot be opened", right-click the app → *Open*, or run:
  ```bash
  xattr -dr com.apple.quarantine /Applications/G-Clock.app
  ```
- **Windows**: if SmartScreen appears, click *More info* → *Run anyway*.
- **Linux**: `chmod +x G-Clock-*.AppImage`, then run it.

### Updating

G-Clock looks for a new release once a day (Settings → Data & updates). *Download and verify* fetches the installer for your system into Downloads and checks its SHA-256; a file that does not match is deleted. Nothing is installed without you: on Windows *Close and install* runs the installer, on macOS and Linux you open the new file yourself. A notice never covers the clock face while the timer runs.

## Development

Requires [Node.js](https://nodejs.org) 18+.

```bash
npm install
npm start
npm test        # unit tests: settings validation, feed parsing, versions, translations
```

Build installers (output in `release/`):

```bash
npm run dist:win     # NSIS installer
npm run dist:mac     # dmg
npm run dist:linux   # AppImage
```

Releases are built by GitHub Actions when a `v*` tag is pushed (version in `package.json` must match the tag).

## Third-party

- Fonts bundled locally: Barlow Condensed and Share Tech Mono, SIL Open Font License 1.1 (`renderer/fonts/OFL-*.txt`).
- Weather data: [Open-Meteo.com](https://open-meteo.com/), CC BY 4.0. Open-Meteo's free API is for non-commercial use.
- Each news publisher sets its own terms for its feed.

## Italiano

Grande orologio da studio per i conduttori radiofonici: ora e data leggibili da lontano, interruttore On Air / Rec, timer di registrazione con pre-roll 3·2·1, orologi di altre città, conto alla rovescia verso il prossimo break, titoli dai feed RSS che scegli tu e meteo facoltativo (spento di default). Pulsanti configurabili per aprire pagine web (ospite remoto, webcam di studio…), logo personalizzabile, impostazioni importabili/esportabili in JSON. Scarica l'installer dalla pagina [Releases](https://github.com/djgragra/g-clock/releases). L'app non è firmata: su macOS usa clic destro → Apri (o il comando `xattr` sopra); su Windows SmartScreen → "Ulteriori informazioni" → "Esegui comunque". Quando esce una nuova versione, l'app la segnala nelle Impostazioni: "Scarica e verifica" scarica l'installer giusto e ne controlla lo SHA-256; non si installa nulla senza di te.

## License

[MIT](LICENSE) © 2026 Graziano Melzi
