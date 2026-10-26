# G-Clock manual

G-Clock is a **studio clock for radio presenters**: the classic 60-minute dial with stopset markers, news headlines from the feeds you choose, optional weather, an On Air / Rec switch, a recording timer with programs, blocks and a 3·2·1 pre-roll, and an optional **MicTime timer** that times a speech from a MIDI message, a key or an audio level. It is a free desktop app for Windows, macOS and Linux from OnAir Garage.

## Install and first launch

Download the installer for your system from the [Releases](https://github.com/djgragra/g-clock/releases) page and check it against `SHA256SUMS.txt`:
`G-Clock-Setup-<V>.exe` (Windows), `G-Clock-<V>-arm64.dmg` (Mac with Apple silicon), `G-Clock-<V>.dmg` (Mac with Intel), `G-Clock-<V>.AppImage` (Linux).
The app is free and has no Apple or Microsoft certificate, so the first launch may show a warning.

- **Windows**: run the installer. If SmartScreen says "Windows protected your PC", click *More info* → *Run anyway*.
- **macOS**: open the disk image and drag the app to Applications. The app is signed ad hoc, which is what an Apple silicon Mac needs to open it. The first start still shows the "unidentified developer" notice: open *System Settings → Privacy & Security*, scroll down and click *Open Anyway* (right-click → Open no longer exists on macOS 15 and later). If an earlier version says the app is "damaged", run this once in Terminal: `xattr -cr "/Applications/G-Clock.app" && codesign --force --deep -s - "/Applications/G-Clock.app"`
- **Linux**: make the AppImage executable (`chmod +x G-Clock-*.AppImage`) and run it.

The language follows the system (English, Italiano, Español) and can be changed in *Settings*. The theme is dark by default, with light and system available. The app is made for a wide screen (16:9); on a tall window the dial goes on top and the headlines below.

## The studio dial

The dial on the left works as in a studio clock: 60 minute segments that fill as the hour goes by (green, orange, red), with the current minute filling second by second. In the centre you see the time left to the end of the hour, and in the last minutes it says END OF HOUR. The date and time are large in the header, in 24 or 12 hours and in any time zone you choose in *Settings → General*, together with the option to show seconds.

- **Stopsets** (ad breaks, news, jingles): you choose the minutes of the hour (for example `0, 30`). They are the larger markers on the dial, they turn red when close, and during their minute the centre shows the stopset name. The centre counts down to the next one. In the last seconds you choose (*blink when seconds left*, 60 by default, 0 = never) the countdown and the marker blink; with "reduce motion" on in the system nothing blinks.
- **Stopset schedules by day and hour**: other sets of minutes for certain days and hours (for example `0, 20, 40` on weekday afternoons and `15, 45` at the weekend). The first schedule that fits the time of the clock applies, the default minutes apply outside them, and the dial redraws itself when a schedule starts or ends. A schedule can run past midnight (it belongs to the day it starts).
- **Fixed events**: events at a time of day (news at 18:00, an ad block at 18:20, a guest on air), each on the days you choose. Under the dial the clock shows the next one (*NEXT*) with a countdown, warns you **once** (the bar turns red at the number of seconds you choose for that event, 60 by default) and says NOW for ten seconds when it is time. Times follow the time zone of the clock.

## Headlines and weather

- **Headlines**, in the middle: the RSS / Atom feeds you add (https only), one tab per source, a page of six at a time turning every few seconds, plus a scrolling ticker at the bottom. Only title, source, time and link are shown; a click opens the article in your browser. The app reads the feeds itself. A small pill in the header says how many of your feeds answered; with no feed at all the column shows a welcome with a button to add one.
- **Weather** (optional, **off by default**), on the right: you search for places and the app finds them with Open-Meteo's geocoding. The Open-Meteo credit is always visible while the weather is on.
- **Messages for the announcer** (*Settings → Messages*): up to nine saved short messages (120 characters each), shown large under the dial on the On Air screen. Keys `1`–`9` (or the buttons under the dial) show the saved message with that number; the same key again takes it off. `M` types a one-off message (press Enter to show it, Esc to cancel) and `0`, or a click on the message, clears it. What is on screen is not saved: after a restart the strip is empty. Saved messages are part of the backup. The message stays visible in *clock only*.
- **Clock only** (*Settings → General*, or key `C` on the On Air screen): the dial alone, with no headlines, ticker, weather or feed status, for a wall screen. Feeds and cities stay configured and come back when you switch it off.

## ON AIR and REC

The **ON AIR / REC** switch (key `O`) changes the screen. **REC** replaces the dial with the recording timer:

- **free time** with quick times, or a **program** made of blocks (opening, interview, closing…), each with its own time;
- a visual 3·2·1 pre-roll, pause and resume, overrun in red, optional beeps;
- **end block**, redo and back; click a block to record out of order; several takes per block;
- **dynamic timing**: what a block runs over or under is taken from, or given to, the next ones;
- a **report** at the end of the program: copy it, save it as text or as **CSV** for a spreadsheet (one row per block, in seconds, and a TOTAL row);
- programs are created and edited in the app, and can be imported and exported as JSON.

Space starts and pauses, `N` ends the block, `R` resets.

## MicTime timer

In *Settings → MicTime* (**off by default**) you switch on the timer of the MicTime app, with the same options, inside G-Clock. The first signal starts the count, the next one stops it, the total stays on screen for a few seconds (or until the next start) and the timer returns to zero. It appears under the dial and, while recording, as a chip in the header.

- **Signals**: a **MIDI message** (choose the input; start, stop, reset, next step, previous step and restart on a note, a controller or a program change, with *Learn*, any channel or one, and a monitor of the incoming messages), a **key** you choose (global, working with another program in front where the system allows it, or with the window in front) and the **level of an audio input** (threshold and hold time).
- **Time limits and programs**: a program is a list of steps with a name and a limit (for example Opening 00:45, News 01:00, Interview 03:00); after every speech the next step is armed by itself; up to 8 programs of 40 steps; or a single time limit with no program. The figures are grey at zero, change to a warning colour before the limit (10 seconds by default), to red past it, and blink slowly when it is passed by a lot; with "reduce motion" a steady red frame is shown instead.
- While it is off, nothing is listened to: no MIDI, no key, no microphone, and the system permissions are refused. The audio level needs the microphone permission of the system; the audio is never recorded, saved or sent.

## Your buttons and your logo

- **Your buttons** open a web page in your browser (a remote guest link, a studio camera, the station site…), each with a note that explains what it is for, plus ready-made ideas to fill the form (*Add*, *Open* to test).
- **Your logo**: a PNG, JPG or SVG, resized to 512 px at most and kept only on your computer (*Settings → General*).
- *Always on top*, full screen (`F` or `F11`) and *Keep the screen on* are in *Settings → General*.

## Settings

Press `S` or the settings button. The settings are in tabs, among them General (language, theme, time format, time zone, always on top, clock only, keep the screen on, logo), the sections for stopsets, events, messages, feeds, weather and buttons, MicTime, Updates, Backup and Help & About.

**Backup** (*Settings → Backup*): *Export* saves the whole configuration (settings, programs, buttons, feeds, cities, events, schedules, and the MicTime timer with its MIDI messages, keys, programs and colours) as `g-clock-backup-YYYY-MM-DD.json`. On import you choose between **replacing everything** and **adding only the missing items**. The file holds no passwords or keys: the app uses none.

**Help & About** shows the version, the system, the licence, the credits and the links, *Copy support info* (version, system, language, last update check and last error: never your settings, addresses or file names) and *Open logs folder* (daily log files, 5 MB at most each, 7 days kept). The tip card has a jar and a button: both open the support page of the website in the language of the app; nothing is asked inside the app.

## Privacy and network

G-Clock only contacts the news feeds **you** configured (https), `geocoding-api.open-meteo.com` and `api.open-meteo.com` **only if you turn the weather on**, and GitHub to check for a new release (you can switch this off in *Settings*). The window itself has no network access at all; everything remote goes through the main process, which accepts https addresses only. No accounts, no analytics, no telemetry.

## Updates

The app looks for a new version 15 seconds after it starts and then every 24 hours. A banner offers *Download and install*, *Remind me later* (24 hours) and *Skip this version*, with a progress bar and *Cancel*. The file is checked against `SHA256SUMS.txt`. *Close and install* saves a safety copy of the settings first. After the update a *What's new* window appears once. Nothing is installed without a click.

## Limits

- The clock follows the computer's clock: keep it synchronised. Times of fixed events follow the time zone of the clock, and a change of summer time moves nothing (they are wall-clock times).
- Headlines need an internet connection and https addresses; a feed that does not answer is shown in the pill and the other tabs keep working.
- The weather and the MicTime timer are off until you switch them on here.

## Troubleshooting

| Problem | What to do |
|---|---|
| macOS: "the app is damaged / cannot be opened" | Open *System Settings → Privacy & Security → Open Anyway*; for an earlier version, run in Terminal `xattr -cr "/Applications/G-Clock.app" && codesign --force --deep -s - "/Applications/G-Clock.app"`. |
| Windows: "Windows protected your PC" | *More info* → *Run anyway*. |
| Linux: the AppImage does not start | Make it executable (`chmod +x`) and install FUSE (`libfuse2`) if your system needs it. |
| No headlines | Add a feed (https) in the settings; the pill in the header says how many feeds answer. |
| The MIDI message does not arrive | In *Settings → MicTime* check the monitor of the incoming messages and press *Learn* again. |
| The update download failed with "checksum mismatch" | The file was deleted automatically. Try again, or download the installer by hand from the releases page. |

## Contacts

Graziano Melzi · OnAir Garage — `https://onairgarage.com` — `hello@onairgarage.com`. Tool page: `https://onairgarage.com/tools/g-clock/`. MIDI specification of the MicTime timer: `https://github.com/djgragra/mictime/blob/main/docs/MIDI-SPEC.md`. Source code and releases: `https://github.com/djgragra/g-clock`. Licence: MIT © 2026 Graziano Melzi.
