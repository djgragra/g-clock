# G-Clock

Free desktop app (Windows / macOS / Linux): a **studio clock for radio presenters**. The classic 60-minute dial with stopset markers, news headlines from the feeds you choose, optional weather, an On Air / Rec switch and a recording timer with programs, blocks and a 3·2·1 pre-roll.

By Graziano Melzi · [OnAir Garage](https://onairgarage.com) — contact: hello@onairgarage.com

## Features

- **The studio dial**, on the left, as in Studio Clock: 60 minute segments that fill as the hour goes by (green, orange, red), the current minute filling second by second. In the centre, the time left to the end of the hour; in the last minutes it says END OF HOUR.
- **Stopsets** (ad breaks, news, jingles): you choose the minutes of the hour (for example `0, 30`). They are the larger markers on the dial, turn red when close and during their minute the centre shows the stopset name. A bar under the columns says when the next one comes and counts down to it.
- **Headlines**, in the middle: the RSS / Atom feeds you add (https only), one tab per source, a page of six at a time turning every few seconds, plus a scrolling ticker at the bottom. Only title, source, time and link are shown; a click opens the article in your browser. The app reads the feeds itself, so there is no CORS problem and no server in between.
- **Weather** (optional, **off by default**), on the right: places found with Open-Meteo's geocoding; the Open-Meteo credit is always visible while it is on.
- **Date and time** large in the header, 24 or 12 hours, any time zone.
- **ON AIR / REC** switch (key `O`). **REC** replaces the dial with the recording timer:
  - **free time** with quick times, or a **program** made of blocks (opening, interview, closing…) each with its own time;
  - visual 3·2·1 pre-roll, pause and resume, overrun in red, optional beeps;
  - **end block**, redo and back; click a block to record out of order; several takes per block;
  - **dynamic timing**: what a block runs over or under is taken from, or given to, the next ones;
  - a **report** at the end of the program (copy it or save it as text);
  - programs are created and edited in the app, and can be imported and exported as JSON.
  Space starts and pauses, `N` ends the block, `R` resets.
- **Your buttons**: buttons that open a web page in your browser (remote guest link, studio camera, station site…), each with a note that explains what it is for, plus ready-made ideas.
- **Your logo**: PNG, JPG or SVG, resized to 512 px at most and stored only on your computer.
- Always on top, full screen (`F` or `F11`), keep the screen awake.
- **Languages**: English (default), Italiano, Español — follows the system, can be changed in Settings.
- Settings and programs stay on your computer; **import / export as JSON** (no passwords or keys: the app uses none).
- Made for a wide screen (16:9). On a tall window the dial goes on top and the headlines below.

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
npm test        # unit tests: settings validation, feed parsing, dial and timer arithmetic, versions, translations
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

Orologio da studio per i conduttori radiofonici: il classico quadrante a 60 spicchi con gli stopset, titoli dai feed RSS che scegli tu, meteo facoltativo (spento di default), interruttore On Air / Rec e timer di registrazione con programmi a blocchi e pre-roll 3·2·1. Pulsanti configurabili per aprire pagine web (ospite remoto, webcam di studio…), logo personalizzabile, impostazioni importabili/esportabili in JSON. Scarica l'installer dalla pagina [Releases](https://github.com/djgragra/g-clock/releases). L'app non è firmata: su macOS usa clic destro → Apri (o il comando `xattr` sopra); su Windows SmartScreen → "Ulteriori informazioni" → "Esegui comunque". Quando esce una nuova versione, l'app la segnala nelle Impostazioni: "Scarica e verifica" scarica l'installer giusto e ne controlla lo SHA-256; non si installa nulla senza di te.

## License

[MIT](LICENSE) © 2026 Graziano Melzi
