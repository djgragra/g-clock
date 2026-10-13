# G-Clock

Free desktop app (Windows / macOS / Linux): a **studio clock for radio presenters**. The classic 60-minute dial with stopset markers, news headlines from the feeds you choose, optional weather, an On Air / Rec switch and a recording timer with programs, blocks and a 3·2·1 pre-roll.

By Graziano Melzi · [OnAir Garage](https://onairgarage.com) — contact: hello@onairgarage.com

![G-Clock: the studio dial, the next fixed event, headlines and weather](docs/screenshots/01-on-air.png)

## Features

- **The studio dial**, on the left, as in Studio Clock: 60 minute segments that fill as the hour goes by (green, orange, red), the current minute filling second by second. In the centre, the time left to the end of the hour; in the last minutes it says END OF HOUR.
- **Stopsets** (ad breaks, news, jingles): you choose the minutes of the hour (for example `0, 30`). They are the larger markers on the dial, turn red when close and during their minute the centre shows the stopset name. The centre counts down to the next one.
- **Stopset schedules by day and hour**: other sets of minutes for certain days and hours (for example `0, 20, 40` on weekday afternoons and `15, 45` at the weekend). The first schedule that fits the time of the clock applies, the default minutes apply outside them, and the dial redraws itself when a schedule starts or ends. A schedule can run past midnight (it belongs to the day it starts). Without schedules nothing changes.
- **Fixed events**: events at a time of day (news at 18:00, ad block at 18:20, a guest on air), each on the days you choose. Under the dial the clock shows the next one with a countdown, warns you **once** (the bar turns red at the number of seconds you choose for that event, 60 by default) and says NOW for ten seconds when it is time. Times follow the time zone of the clock; a change of summer time moves nothing (they are wall-clock times).
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
- **Backup** (Settings → Backup): export or import the whole configuration (settings, programs, buttons, feeds, cities, events, schedules) as `g-clock-backup-YYYY-MM-DD.json`. On import you choose between **replacing everything** and **adding only the missing items**. The file holds no passwords or keys: the app uses none. Files made by older versions still import.
- **Help & About** (Settings): version, system, licence, credits, links, **Copy support info** (version, system, language, last update check and last error; never your settings, addresses or file names) and **Open logs folder**. Daily log files, 5 MB at most each, 7 days kept.
- A small pill in the header says how many of your feeds answered; with no feed at all the headlines column shows a welcome with a button to add one.
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

G-Clock looks for a new release once a day (Settings → Updates, can be switched off). A thin strip under the header says a new version is out and offers **Download and install**, **Remind me later** (24 hours), **Skip this version** and the release notes. The download shows a progress bar and a Cancel button, and the installer is checked against the SHA-256 in the release's `SHA256SUMS.txt`: a file that does not match, a cancelled or interrupted download leaves nothing behind (no `.part` file; one left by an earlier run, for example when the app was closed in the middle of a download, is removed at the next start). **Close and install** first makes a safety copy of your settings in the app's data folder (the last 3 are kept); on Windows it closes G-Clock and starts the installer, on macOS it opens the disk image, on Linux it shows the AppImage. The first start after an update shows **What's new**. Nothing is installed without a click, and the strip never covers the dial: it stays out of the way in full screen and while the recording timer runs.

## Development

Requires [Node.js](https://nodejs.org) 18+.

```bash
npm install
npm start
npm test        # unit tests: settings validation, schedules and events, backup, guided update, logs, feed parsing, dial and timer arithmetic, translations
```

`dev/make-logo.mjs` draws `assets/logo.svg` and `dev/make-icons.mjs` generates every icon from it; `dev/make-screenshots.mjs` renders the interface with fictitious data for `docs/screenshots/`.

Build installers (output in `release/`):

```bash
npm run dist:win     # NSIS installer
npm run dist:mac     # dmg
npm run dist:linux   # AppImage
```

Releases are built by GitHub Actions: from the Actions tab run *Build installers* with the version (it must equal the one in `package.json` and be higher than the latest release), or push a `v*` tag.

## Third-party

- Electron (MIT), electron-store (MIT), fast-xml-parser (MIT).
- Fonts bundled locally: Barlow Condensed and Share Tech Mono, SIL Open Font License 1.1 (`renderer/fonts/OFL-*.txt`).
- Weather data: [Open-Meteo.com](https://open-meteo.com/), CC BY 4.0. Open-Meteo's free API is for non-commercial use.
- Each news publisher sets its own terms for its feed.

## Italiano

Orologio da studio per i conduttori radiofonici: il classico quadrante a 60 spicchi con gli stopset, titoli dai feed RSS che scegli tu, meteo facoltativo (spento di default), interruttore On Air / Rec e timer di registrazione con programmi a blocchi e pre-roll 3·2·1. Stopset diversi per giorno e fascia oraria, eventi fissi con conto alla rovescia (notiziario alle 18:00, pubblicità alle 18:20…), backup della configurazione, aggiornamento guidato con avviso sotto l’intestazione. Pulsanti configurabili per aprire pagine web (ospite remoto, webcam di studio…), logo personalizzabile, impostazioni importabili/esportabili in JSON. Scarica l'installer dalla pagina [Releases](https://github.com/djgragra/g-clock/releases). L'app non è firmata: su macOS usa clic destro → Apri (o il comando `xattr` sopra); su Windows SmartScreen → "Ulteriori informazioni" → "Esegui comunque". Quando esce una nuova versione, l'app la segnala con una striscia sotto l'intestazione: "Scarica e installa" scarica l'installer giusto, ne controlla lo SHA-256 e prima di installare salva una copia di sicurezza delle impostazioni; non si installa nulla senza di te.

## License

[MIT](LICENSE) © 2026 Graziano Melzi
