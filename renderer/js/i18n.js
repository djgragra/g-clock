'use strict';

// Interface texts in the three supported languages. English is the reference and the fallback.
// {name} placeholders are filled from the params of GC.t(key, params).
window.GC = window.GC || {};

GC.DICT = {
  en: {
    'common.add': 'Add', 'common.remove': 'Remove', 'common.up': 'Move up',
    'mode.toggle': 'Switch On Air / Rec (O)', 'mode.onair': 'ON AIR', 'mode.rec': 'REC',
    'settings.open': 'Settings (S)', 'settings.title': 'Settings', 'settings.close': 'Close',
    'window.fullscreen': 'Full screen (F11)',

    'timer.start': 'START', 'timer.pause': 'PAUSE', 'timer.resume': 'RESUME', 'timer.reset': 'RESET', 'timer.prerollCancel': 'Space or Esc to cancel',
    'timer.elapsed': 'Elapsed {e} / Target {t}',
    'timer.state.ready': 'READY', 'timer.state.preroll': 'GET READY', 'timer.state.recording': 'RECORDING',
    'timer.state.ending': 'ENDING', 'timer.state.paused': 'PAUSED', 'timer.state.over': 'OVERRUN',
    'break.now': 'NOW',

    'news.loading': 'Loading headlines…', 'news.unavailable': 'Headlines unavailable', 'news.open': 'Open in browser',

    'wx.clear': 'Clear', 'wx.mostlyClear': 'Mostly clear', 'wx.partlyCloudy': 'Partly cloudy', 'wx.overcast': 'Overcast',
    'wx.fog': 'Fog', 'wx.drizzle': 'Drizzle', 'wx.freezingDrizzle': 'Freezing drizzle', 'wx.rainLight': 'Light rain',
    'wx.rain': 'Rain', 'wx.rainHeavy': 'Heavy rain', 'wx.freezingRain': 'Freezing rain', 'wx.snowLight': 'Light snow',
    'wx.snow': 'Snow', 'wx.snowHeavy': 'Heavy snow', 'wx.showers': 'Showers', 'wx.showersHeavy': 'Heavy showers',
    'wx.snowShowers': 'Snow showers', 'wx.thunderstorm': 'Thunderstorm', 'wx.unavailable': 'Unavailable',
    'wx.credit': 'Weather data by Open-Meteo.com',

    'sec.general': 'General', 'sec.breaks': 'Break counter', 'sec.timer': 'Timer', 'sec.cities': 'World clocks',
    'sec.news': 'News', 'sec.weather': 'Weather', 'sec.buttons': 'Buttons', 'sec.data': 'Data & updates', 'sec.about': 'About',

    'general.language': 'Language', 'general.langAuto': 'System', 'general.hourFormat': 'Time format',
    'general.h24': '24 hours', 'general.h12': '12 hours (AM/PM)', 'general.seconds': 'Show seconds',
    'general.timezone': 'Time zone', 'general.tzSystem': 'System time zone',
    'general.timezoneHint': 'Type to search, e.g. Europe/Rome. Leave empty to follow the computer.',
    'general.alwaysOnTop': 'Always on top', 'general.alwaysOnTopHint': 'Keeps the clock above other windows.',
    'general.keepAwake': 'Keep the screen on', 'general.keepAwakeHint': 'Stops the display from going to sleep while G-Clock runs.',
    'general.logo': 'Station logo', 'general.noLogo': 'No logo: the name G-CLOCK is shown.',
    'general.logoChoose': 'Choose image…', 'general.logoRemove': 'Remove logo',
    'general.logoHint': 'PNG, JPG or SVG. Resized to 512 px at most and kept only on this computer.',
    'general.logoRejected': 'This image could not be saved.', 'general.logoError': 'Could not read this image.',

    'breaks.intro': 'Counts down to the next break of your show: ads, news, jingles. You choose at which minutes of the hour they are due.',
    'breaks.enabled': 'Show the counter', 'breaks.marks': 'Minutes of the hour', 'breaks.marksHint': 'Comma separated, 0–59. Example: 0, 30 means on the hour and at half past.',
    'breaks.marksInvalid': 'Use whole numbers from 0 to 59, separated by commas.',
    'breaks.label': 'Name', 'breaks.warn': 'Warn when seconds left', 'breaks.warnHint': 'The counter turns amber and blinks. When the break is due it shows NOW for 10 seconds.',

    'timer.intro': 'The Rec screen has a recording timer: free time, quick times and a 3·2·1 pre-roll.',
    'timer.presets': 'Quick times', 'timer.presetsHint': 'Up to 8, as minutes or mm:ss, separated by commas. Example: 1, 2:30, 5, 10',
    'timer.presetsInvalid': 'Use minutes or mm:ss, separated by commas.',
    'timer.preroll': 'Pre-roll 3·2·1', 'timer.prerollHint': 'Full-screen countdown before the timer starts.',
    'timer.sound': 'Beeps', 'timer.soundHint': 'Short beeps during the pre-roll and when the time is up.',

    'cities.intro': 'Clocks for other cities, shown in a strip at the bottom. The big clock uses the time zone set in General.',
    'cities.name': 'Name', 'cities.tzPlaceholder': 'Time zone, e.g. Asia/Tokyo',
    'cities.tzInvalid': 'Unknown time zone. Pick one from the list.', 'cities.max': 'At most {n} clocks.',

    'news.intro': 'Headlines from the RSS feeds you choose. Only title, source and time are shown; a click opens the article in your browser.',
    'news.enabled': 'Show headlines', 'news.off': 'Off', 'news.error': 'Error: {e}', 'news.ok': '{n} headlines',
    'news.max': 'At most {n} feeds.', 'news.httpsOnly': 'The address must start with https://', 'news.duplicate': 'This feed is already in the list.',
    'news.suggested': 'Suggested feeds', 'news.feedName': 'Name',
    'news.termsHint': 'Each publisher sets its own terms for using its feed: check them before relying on a feed.',
    'news.interval': 'Refresh every (minutes)', 'news.intervalHint': 'From 2 to 120.',
    'news.rotate': 'Headline changes every (seconds)', 'news.rotateHint': 'From 4 to 60. The headline stays while the pointer is over it; arrow keys move through the list.',
    'news.refreshNow': 'Refresh now',

    'wx.intro': 'Optional. Off by default. When it is on, G-Clock asks Open-Meteo for the weather of the places you add (and for the search below).',
    'wx.enabled': 'Show weather', 'wx.enabledHint': 'Requests go to open-meteo.com; no account, key or personal data is sent.',
    'wx.unit': 'Temperature', 'wx.search': 'Search a city', 'wx.searchBtn': 'Search',
    'wx.searchError': 'Search failed. Check the connection.', 'wx.noResults': 'No match.', 'wx.max': 'At most {n} places.',
    'wx.attribution': 'Weather data by Open-Meteo.com, licensed CC BY 4.0. The credit stays visible while the weather is on.',
    'wx.terms': 'Open-Meteo website',

    'btn.intro': 'Buttons for the web pages you reach for during a show: a remote guest link, the studio camera, your station site. Each one opens in your default browser.',
    'btn.how1': 'Label: the short text on the button (up to 24 characters).',
    'btn.how2': 'Address: a web address starting with https:// (http:// also works, for example a camera on your local network).',
    'btn.how3': 'Note: a reminder of what the button is for. It shows when you hover over the button.',
    'btn.label': 'Label', 'btn.note': 'Note: what is it for?', 'btn.max': 'At most {n} buttons.',
    'btn.urlInvalid': 'The address must start with https:// or http://', 'btn.test': 'Open',
    'btn.ideaLabel.cam': 'Webcam', 'btn.ideaLabel.site': 'Station site', 'btn.ideaLabel.chat': 'Listener chat', 'btn.ideaLabel.traffic': 'Traffic',
    'btn.suggestions': 'Ideas (click one to fill the form, then press Add)',
    'btn.ideaFilled': 'Check the address, then press Add.', 'btn.ideaNeedsUrl': 'Type the address of your own page, then press Add.',
    'btn.idea.guest': 'Remote guest link. Replace the address with your own ipDTL studio link.',
    'btn.idea.meet': 'Video call with a remote guest. Use your own meeting link for a fixed room.',
    'btn.idea.jitsi': 'Video room in the browser. Add a room name to the address for a fixed room.',
    'btn.idea.zoom': 'Join a Zoom meeting from the browser.',
    'btn.idea.cam': 'Page that shows the studio camera or the stream. Use the address of your own camera page.',
    'btn.idea.site': 'Your station website, to check what listeners see.',
    'btn.idea.chat': 'Listener chat or requests page. Paste its address.',
    'btn.idea.traffic': 'A traffic or travel-news page you read from on air.',

    'data.intro': 'Settings (feeds, cities, buttons, logo, language, time format…) are stored on this computer. Export them to a file to keep a copy or to set up another computer.',
    'data.export': 'Export settings…', 'data.import': 'Import settings…', 'data.reset': 'Restore defaults…',
    'data.exported': 'Settings exported.', 'data.exportFailed': 'Could not write the file.',
    'data.importForeign': 'This file does not come from G-Clock.', 'data.importInvalid': 'This file could not be read.',
    'data.noCredentials': 'The file holds no passwords or keys: G-Clock does not use any.',
    'upd.title': 'Updates', 'upd.auto': 'Check for updates', 'upd.autoHint': 'Looks at the public GitHub releases of G-Clock once a day. Nothing installs by itself.',
    'upd.check': 'Check now', 'upd.checking': 'Checking…', 'upd.error': 'Could not check for updates.',
    'upd.latest': 'You have the latest version ({v}).', 'upd.available': 'Version {v} is available.',
    'upd.openPage': 'Open download page', 'upd.download': 'Download and verify', 'upd.downloading': 'Downloading…',
    'upd.downloadingPct': 'Downloading… {p}%', 'upd.checksum': 'The download did not match its checksum and was deleted.',
    'upd.failed': 'Download failed.', 'upd.ready': 'Downloaded and verified (saved in Downloads).',
    'upd.install': 'Close and install', 'upd.reveal': 'Show installer',
    'upd.unsigned': 'G-Clock is not code-signed: your system may warn you the first time you open the new version.',
    'upd.toast': 'Version {v} is available: Settings → Data & updates.',

    'about.version': 'Version {v}', 'about.desc': 'A big studio clock for radio presenters: time, recording timer with pre-roll, world clocks and news headlines.',
    'about.author': 'Author', 'about.site': 'Website', 'about.contact': 'Contact', 'about.license': 'License',
    'about.code': 'Source code', 'about.fonts': 'Fonts', 'about.weather': 'Weather data', 'about.keys': 'Keyboard',
    'keys.space': 'Start / pause the timer (Rec)', 'keys.reset': 'Reset the timer (Rec)', 'keys.mode': 'Switch On Air / Rec',
    'keys.fullscreen': 'Full screen', 'keys.settings': 'Settings', 'keys.news': 'Previous / next headline', 'keys.esc': 'Close settings, cancel pre-roll, leave full screen'
  },

  it: {
    'common.add': 'Aggiungi', 'common.remove': 'Rimuovi', 'common.up': 'Sposta su',
    'mode.toggle': 'Passa tra On Air e Rec (O)', 'mode.onair': 'ON AIR', 'mode.rec': 'REC',
    'settings.open': 'Impostazioni (S)', 'settings.title': 'Impostazioni', 'settings.close': 'Chiudi',
    'window.fullscreen': 'Schermo intero (F11)',

    'timer.start': 'AVVIA', 'timer.pause': 'PAUSA', 'timer.resume': 'RIPRENDI', 'timer.reset': 'AZZERA', 'timer.prerollCancel': 'Spazio o Esc per annullare',
    'timer.elapsed': 'Trascorso {e} / Obiettivo {t}',
    'timer.state.ready': 'PRONTO', 'timer.state.preroll': 'ATTENZIONE', 'timer.state.recording': 'IN REGISTRAZIONE',
    'timer.state.ending': 'CHIUSURA', 'timer.state.paused': 'IN PAUSA', 'timer.state.over': 'SFORAMENTO',
    'break.now': 'ORA',

    'news.loading': 'Caricamento titoli…', 'news.unavailable': 'Titoli non disponibili', 'news.open': 'Apri nel browser',

    'wx.clear': 'Sereno', 'wx.mostlyClear': 'Prevalentemente sereno', 'wx.partlyCloudy': 'Parzialmente nuvoloso', 'wx.overcast': 'Coperto',
    'wx.fog': 'Nebbia', 'wx.drizzle': 'Pioggerella', 'wx.freezingDrizzle': 'Pioggerella gelata', 'wx.rainLight': 'Pioggia debole',
    'wx.rain': 'Pioggia', 'wx.rainHeavy': 'Pioggia forte', 'wx.freezingRain': 'Pioggia gelata', 'wx.snowLight': 'Neve debole',
    'wx.snow': 'Neve', 'wx.snowHeavy': 'Neve forte', 'wx.showers': 'Rovesci', 'wx.showersHeavy': 'Rovesci forti',
    'wx.snowShowers': 'Rovesci di neve', 'wx.thunderstorm': 'Temporale', 'wx.unavailable': 'Non disponibile',
    'wx.credit': 'Dati meteo di Open-Meteo.com',

    'sec.general': 'Generali', 'sec.breaks': 'Conto alla rovescia break', 'sec.timer': 'Timer', 'sec.cities': 'Orologi nel mondo',
    'sec.news': 'Notizie', 'sec.weather': 'Meteo', 'sec.buttons': 'Pulsanti', 'sec.data': 'Dati e aggiornamenti', 'sec.about': 'Informazioni',

    'general.language': 'Lingua', 'general.langAuto': 'Sistema', 'general.hourFormat': 'Formato ora',
    'general.h24': '24 ore', 'general.h12': '12 ore (AM/PM)', 'general.seconds': 'Mostra i secondi',
    'general.timezone': 'Fuso orario', 'general.tzSystem': 'Fuso orario del sistema',
    'general.timezoneHint': 'Scrivi per cercare, per esempio Europe/Rome. Lascia vuoto per seguire il computer.',
    'general.alwaysOnTop': 'Sempre in primo piano', 'general.alwaysOnTopHint': 'Tiene l’orologio sopra le altre finestre.',
    'general.keepAwake': 'Tieni lo schermo acceso', 'general.keepAwakeHint': 'Impedisce che lo schermo si spenga mentre G-Clock è aperto.',
    'general.logo': 'Logo della radio', 'general.noLogo': 'Nessun logo: si vede il nome G-CLOCK.',
    'general.logoChoose': 'Scegli immagine…', 'general.logoRemove': 'Rimuovi logo',
    'general.logoHint': 'PNG, JPG o SVG. Ridimensionato a 512 px al massimo e salvato solo su questo computer.',
    'general.logoRejected': 'Non è stato possibile salvare questa immagine.', 'general.logoError': 'Non riesco a leggere questa immagine.',

    'breaks.intro': 'Conta alla rovescia fino al prossimo break della trasmissione: pubblicità, notiziario, jingle. Scegli tu a quali minuti dell’ora cadono.',
    'breaks.enabled': 'Mostra il conto alla rovescia', 'breaks.marks': 'Minuti dell’ora', 'breaks.marksHint': 'Separati da virgole, da 0 a 59. Esempio: 0, 30 vuol dire all’ora esatta e alla mezza.',
    'breaks.marksInvalid': 'Usa numeri interi da 0 a 59, separati da virgole.',
    'breaks.label': 'Nome', 'breaks.warn': 'Avvisa quando mancano (secondi)', 'breaks.warnHint': 'Il conto diventa ambra e lampeggia. All’ora del break mostra ORA per 10 secondi.',

    'timer.intro': 'La schermata Rec ha un timer di registrazione: tempo libero, tempi rapidi e pre-roll 3·2·1.',
    'timer.presets': 'Tempi rapidi', 'timer.presetsHint': 'Fino a 8, in minuti o mm:ss, separati da virgole. Esempio: 1, 2:30, 5, 10',
    'timer.presetsInvalid': 'Usa minuti o mm:ss, separati da virgole.',
    'timer.preroll': 'Pre-roll 3·2·1', 'timer.prerollHint': 'Conto alla rovescia a schermo intero prima che parta il timer.',
    'timer.sound': 'Bip', 'timer.soundHint': 'Brevi bip durante il pre-roll e quando il tempo è finito.',

    'cities.intro': 'Orologi di altre città, in una striscia in basso. L’orologio grande usa il fuso scelto in Generali.',
    'cities.name': 'Nome', 'cities.tzPlaceholder': 'Fuso orario, es. Asia/Tokyo',
    'cities.tzInvalid': 'Fuso orario sconosciuto. Sceglilo dalla lista.', 'cities.max': 'Al massimo {n} orologi.',

    'news.intro': 'Titoli dai feed RSS che scegli tu. Si vedono solo titolo, fonte e ora; un clic apre l’articolo nel browser.',
    'news.enabled': 'Mostra i titoli', 'news.off': 'Spento', 'news.error': 'Errore: {e}', 'news.ok': '{n} titoli',
    'news.max': 'Al massimo {n} feed.', 'news.httpsOnly': 'L’indirizzo deve iniziare con https://', 'news.duplicate': 'Questo feed è già nell’elenco.',
    'news.suggested': 'Feed suggeriti', 'news.feedName': 'Nome',
    'news.termsHint': 'Ogni editore stabilisce le proprie condizioni d’uso del feed: leggile prima di affidarti a un feed.',
    'news.interval': 'Aggiorna ogni (minuti)', 'news.intervalHint': 'Da 2 a 120.',
    'news.rotate': 'Il titolo cambia ogni (secondi)', 'news.rotateHint': 'Da 4 a 60. Il titolo resta fermo mentre il puntatore è sopra; le frecce scorrono l’elenco.',
    'news.refreshNow': 'Aggiorna ora',

    'wx.intro': 'Facoltativo. Spento di default. Quando è attivo, G-Clock chiede a Open-Meteo il meteo dei luoghi che aggiungi (e la ricerca qui sotto).',
    'wx.enabled': 'Mostra il meteo', 'wx.enabledHint': 'Le richieste vanno a open-meteo.com; non vengono inviati account, chiavi o dati personali.',
    'wx.unit': 'Temperatura', 'wx.search': 'Cerca una città', 'wx.searchBtn': 'Cerca',
    'wx.searchError': 'Ricerca non riuscita. Controlla la connessione.', 'wx.noResults': 'Nessun risultato.', 'wx.max': 'Al massimo {n} luoghi.',
    'wx.attribution': 'Dati meteo di Open-Meteo.com, con licenza CC BY 4.0. Il riconoscimento resta visibile finché il meteo è attivo.',
    'wx.terms': 'Sito di Open-Meteo',

    'btn.intro': 'Pulsanti per le pagine web che usi durante la trasmissione: il collegamento con l’ospite remoto, la webcam di studio, il sito della radio. Ognuno si apre nel browser predefinito.',
    'btn.how1': 'Etichetta: il testo breve sul pulsante (fino a 24 caratteri).',
    'btn.how2': 'Indirizzo: un indirizzo web che inizia con https:// (va bene anche http://, per esempio una telecamera nella rete locale).',
    'btn.how3': 'Nota: un promemoria di a cosa serve il pulsante. Compare quando ci passi sopra con il mouse.',
    'btn.label': 'Etichetta', 'btn.note': 'Nota: a cosa serve?', 'btn.max': 'Al massimo {n} pulsanti.',
    'btn.urlInvalid': 'L’indirizzo deve iniziare con https:// o http://', 'btn.test': 'Apri',
    'btn.ideaLabel.cam': 'Webcam', 'btn.ideaLabel.site': 'Sito della radio', 'btn.ideaLabel.chat': 'Chat ascoltatori', 'btn.ideaLabel.traffic': 'Traffico',
    'btn.suggestions': 'Idee (clicca per compilare il modulo, poi premi Aggiungi)',
    'btn.ideaFilled': 'Controlla l’indirizzo, poi premi Aggiungi.', 'btn.ideaNeedsUrl': 'Scrivi l’indirizzo della tua pagina, poi premi Aggiungi.',
    'btn.idea.guest': 'Collegamento con un ospite remoto. Sostituisci l’indirizzo con il tuo link di studio ipDTL.',
    'btn.idea.meet': 'Videochiamata con un ospite remoto. Usa il tuo link per avere una stanza fissa.',
    'btn.idea.jitsi': 'Stanza video nel browser. Aggiungi un nome stanza all’indirizzo per averla fissa.',
    'btn.idea.zoom': 'Entra in una riunione Zoom dal browser.',
    'btn.idea.cam': 'Pagina che mostra la webcam di studio o lo streaming. Usa l’indirizzo della tua pagina.',
    'btn.idea.site': 'Il sito della radio, per controllare cosa vedono gli ascoltatori.',
    'btn.idea.chat': 'Chat degli ascoltatori o pagina delle richieste. Incolla il suo indirizzo.',
    'btn.idea.traffic': 'Una pagina di traffico o viabilità che leggi in diretta.',

    'data.intro': 'Le impostazioni (feed, città, pulsanti, logo, lingua, formato ora…) sono salvate su questo computer. Esportale in un file per tenerne una copia o per configurare un altro computer.',
    'data.export': 'Esporta impostazioni…', 'data.import': 'Importa impostazioni…', 'data.reset': 'Ripristina predefinite…',
    'data.exported': 'Impostazioni esportate.', 'data.exportFailed': 'Impossibile scrivere il file.',
    'data.importForeign': 'Questo file non proviene da G-Clock.', 'data.importInvalid': 'Questo file non si può leggere.',
    'data.noCredentials': 'Il file non contiene password né chiavi: G-Clock non ne usa.',
    'upd.title': 'Aggiornamenti', 'upd.auto': 'Controlla gli aggiornamenti', 'upd.autoHint': 'Guarda le release pubbliche di G-Clock su GitHub una volta al giorno. Non si installa nulla da solo.',
    'upd.check': 'Controlla ora', 'upd.checking': 'Controllo in corso…', 'upd.error': 'Impossibile controllare gli aggiornamenti.',
    'upd.latest': 'Hai l’ultima versione ({v}).', 'upd.available': 'È disponibile la versione {v}.',
    'upd.openPage': 'Apri la pagina di download', 'upd.download': 'Scarica e verifica', 'upd.downloading': 'Download in corso…',
    'upd.downloadingPct': 'Download in corso… {p}%', 'upd.checksum': 'Il file scaricato non corrispondeva al checksum ed è stato eliminato.',
    'upd.failed': 'Download non riuscito.', 'upd.ready': 'Scaricato e verificato (salvato in Download).',
    'upd.install': 'Chiudi e installa', 'upd.reveal': 'Mostra installer',
    'upd.unsigned': 'G-Clock non è firmato digitalmente: il sistema può avvisarti alla prima apertura della nuova versione.',
    'upd.toast': 'È disponibile la versione {v}: Impostazioni → Dati e aggiornamenti.',

    'about.version': 'Versione {v}', 'about.desc': 'Un grande orologio da studio per i conduttori radiofonici: ora, timer di registrazione con pre-roll, orologi nel mondo e titoli delle notizie.',
    'about.author': 'Autore', 'about.site': 'Sito', 'about.contact': 'Contatto', 'about.license': 'Licenza',
    'about.code': 'Codice sorgente', 'about.fonts': 'Font', 'about.weather': 'Dati meteo', 'about.keys': 'Tastiera',
    'keys.space': 'Avvia / pausa del timer (Rec)', 'keys.reset': 'Azzera il timer (Rec)', 'keys.mode': 'Passa tra On Air e Rec',
    'keys.fullscreen': 'Schermo intero', 'keys.settings': 'Impostazioni', 'keys.news': 'Titolo precedente / successivo', 'keys.esc': 'Chiude le impostazioni, annulla il pre-roll, esce dallo schermo intero'
  },

  es: {
    'common.add': 'Añadir', 'common.remove': 'Quitar', 'common.up': 'Subir',
    'mode.toggle': 'Cambiar entre On Air y Rec (O)', 'mode.onair': 'ON AIR', 'mode.rec': 'REC',
    'settings.open': 'Ajustes (S)', 'settings.title': 'Ajustes', 'settings.close': 'Cerrar',
    'window.fullscreen': 'Pantalla completa (F11)',

    'timer.start': 'INICIAR', 'timer.pause': 'PAUSA', 'timer.resume': 'REANUDAR', 'timer.reset': 'REINICIAR', 'timer.prerollCancel': 'Espacio o Esc para cancelar',
    'timer.elapsed': 'Transcurrido {e} / Objetivo {t}',
    'timer.state.ready': 'LISTO', 'timer.state.preroll': 'ATENCIÓN', 'timer.state.recording': 'GRABANDO',
    'timer.state.ending': 'CIERRE', 'timer.state.paused': 'EN PAUSA', 'timer.state.over': 'EXCESO',
    'break.now': 'YA',

    'news.loading': 'Cargando titulares…', 'news.unavailable': 'Titulares no disponibles', 'news.open': 'Abrir en el navegador',

    'wx.clear': 'Despejado', 'wx.mostlyClear': 'Mayormente despejado', 'wx.partlyCloudy': 'Parcialmente nublado', 'wx.overcast': 'Nublado',
    'wx.fog': 'Niebla', 'wx.drizzle': 'Llovizna', 'wx.freezingDrizzle': 'Llovizna helada', 'wx.rainLight': 'Lluvia débil',
    'wx.rain': 'Lluvia', 'wx.rainHeavy': 'Lluvia fuerte', 'wx.freezingRain': 'Lluvia helada', 'wx.snowLight': 'Nieve débil',
    'wx.snow': 'Nieve', 'wx.snowHeavy': 'Nevada fuerte', 'wx.showers': 'Chubascos', 'wx.showersHeavy': 'Chubascos fuertes',
    'wx.snowShowers': 'Chubascos de nieve', 'wx.thunderstorm': 'Tormenta', 'wx.unavailable': 'No disponible',
    'wx.credit': 'Datos meteorológicos de Open-Meteo.com',

    'sec.general': 'General', 'sec.breaks': 'Cuenta atrás del corte', 'sec.timer': 'Temporizador', 'sec.cities': 'Relojes del mundo',
    'sec.news': 'Noticias', 'sec.weather': 'Tiempo', 'sec.buttons': 'Botones', 'sec.data': 'Datos y actualizaciones', 'sec.about': 'Acerca de',

    'general.language': 'Idioma', 'general.langAuto': 'Sistema', 'general.hourFormat': 'Formato de hora',
    'general.h24': '24 horas', 'general.h12': '12 horas (AM/PM)', 'general.seconds': 'Mostrar los segundos',
    'general.timezone': 'Zona horaria', 'general.tzSystem': 'Zona horaria del sistema',
    'general.timezoneHint': 'Escribe para buscar, por ejemplo Europe/Madrid. Déjalo vacío para seguir al ordenador.',
    'general.alwaysOnTop': 'Siempre visible', 'general.alwaysOnTopHint': 'Mantiene el reloj por encima de las demás ventanas.',
    'general.keepAwake': 'Mantener la pantalla encendida', 'general.keepAwakeHint': 'Evita que la pantalla se apague mientras G-Clock está abierto.',
    'general.logo': 'Logo de la emisora', 'general.noLogo': 'Sin logo: se muestra el nombre G-CLOCK.',
    'general.logoChoose': 'Elegir imagen…', 'general.logoRemove': 'Quitar logo',
    'general.logoHint': 'PNG, JPG o SVG. Se reduce a 512 px como máximo y se guarda solo en este ordenador.',
    'general.logoRejected': 'No se pudo guardar esta imagen.', 'general.logoError': 'No se puede leer esta imagen.',

    'breaks.intro': 'Cuenta atrás hasta el próximo corte del programa: publicidad, noticias, sintonías. Tú eliges en qué minutos de la hora caen.',
    'breaks.enabled': 'Mostrar la cuenta atrás', 'breaks.marks': 'Minutos de la hora', 'breaks.marksHint': 'Separados por comas, de 0 a 59. Ejemplo: 0, 30 equivale a la hora en punto y a la media hora.',
    'breaks.marksInvalid': 'Usa números enteros de 0 a 59, separados por comas.',
    'breaks.label': 'Nombre', 'breaks.warn': 'Avisar cuando falten (segundos)', 'breaks.warnHint': 'La cuenta se pone ámbar y parpadea. A la hora del corte muestra YA durante 10 segundos.',

    'timer.intro': 'La pantalla Rec tiene un temporizador de grabación: tiempo libre, tiempos rápidos y pre-roll 3·2·1.',
    'timer.presets': 'Tiempos rápidos', 'timer.presetsHint': 'Hasta 8, en minutos o mm:ss, separados por comas. Ejemplo: 1, 2:30, 5, 10',
    'timer.presetsInvalid': 'Usa minutos o mm:ss, separados por comas.',
    'timer.preroll': 'Pre-roll 3·2·1', 'timer.prerollHint': 'Cuenta atrás a pantalla completa antes de que arranque el temporizador.',
    'timer.sound': 'Pitidos', 'timer.soundHint': 'Pitidos cortos durante el pre-roll y al acabar el tiempo.',

    'cities.intro': 'Relojes de otras ciudades, en una franja inferior. El reloj grande usa la zona horaria elegida en General.',
    'cities.name': 'Nombre', 'cities.tzPlaceholder': 'Zona horaria, p. ej. Asia/Tokyo',
    'cities.tzInvalid': 'Zona horaria desconocida. Elige una de la lista.', 'cities.max': 'Como máximo {n} relojes.',

    'news.intro': 'Titulares de los feeds RSS que tú eliges. Solo se muestran título, fuente y hora; un clic abre el artículo en el navegador.',
    'news.enabled': 'Mostrar titulares', 'news.off': 'Desactivado', 'news.error': 'Error: {e}', 'news.ok': '{n} titulares',
    'news.max': 'Como máximo {n} feeds.', 'news.httpsOnly': 'La dirección debe empezar por https://', 'news.duplicate': 'Este feed ya está en la lista.',
    'news.suggested': 'Feeds sugeridos', 'news.feedName': 'Nombre',
    'news.termsHint': 'Cada editor fija sus propias condiciones de uso del feed: revísalas antes de depender de uno.',
    'news.interval': 'Actualizar cada (minutos)', 'news.intervalHint': 'De 2 a 120.',
    'news.rotate': 'El titular cambia cada (segundos)', 'news.rotateHint': 'De 4 a 60. El titular se detiene mientras el puntero está encima; las flechas recorren la lista.',
    'news.refreshNow': 'Actualizar ahora',

    'wx.intro': 'Opcional. Desactivado por defecto. Al activarlo, G-Clock pide a Open-Meteo el tiempo de los lugares que añadas (y la búsqueda de abajo).',
    'wx.enabled': 'Mostrar el tiempo', 'wx.enabledHint': 'Las peticiones van a open-meteo.com; no se envían cuentas, claves ni datos personales.',
    'wx.unit': 'Temperatura', 'wx.search': 'Buscar una ciudad', 'wx.searchBtn': 'Buscar',
    'wx.searchError': 'La búsqueda falló. Revisa la conexión.', 'wx.noResults': 'Sin resultados.', 'wx.max': 'Como máximo {n} lugares.',
    'wx.attribution': 'Datos meteorológicos de Open-Meteo.com, con licencia CC BY 4.0. El crédito permanece visible mientras el tiempo esté activado.',
    'wx.terms': 'Sitio de Open-Meteo',

    'btn.intro': 'Botones para las páginas web que usas durante el programa: el enlace con un invitado remoto, la cámara del estudio, la web de la emisora. Cada uno se abre en tu navegador predeterminado.',
    'btn.how1': 'Etiqueta: el texto corto del botón (hasta 24 caracteres).',
    'btn.how2': 'Dirección: una dirección web que empiece por https:// (también vale http://, por ejemplo una cámara de tu red local).',
    'btn.how3': 'Nota: un recordatorio de para qué sirve el botón. Aparece al pasar el ratón por encima.',
    'btn.label': 'Etiqueta', 'btn.note': 'Nota: ¿para qué sirve?', 'btn.max': 'Como máximo {n} botones.',
    'btn.urlInvalid': 'La dirección debe empezar por https:// o http://', 'btn.test': 'Abrir',
    'btn.ideaLabel.cam': 'Webcam', 'btn.ideaLabel.site': 'Web de la emisora', 'btn.ideaLabel.chat': 'Chat de oyentes', 'btn.ideaLabel.traffic': 'Tráfico',
    'btn.suggestions': 'Ideas (haz clic para rellenar el formulario y pulsa Añadir)',
    'btn.ideaFilled': 'Revisa la dirección y pulsa Añadir.', 'btn.ideaNeedsUrl': 'Escribe la dirección de tu página y pulsa Añadir.',
    'btn.idea.guest': 'Enlace con un invitado remoto. Sustituye la dirección por tu propio enlace de estudio de ipDTL.',
    'btn.idea.meet': 'Videollamada con un invitado remoto. Usa tu propio enlace para una sala fija.',
    'btn.idea.jitsi': 'Sala de vídeo en el navegador. Añade un nombre de sala a la dirección para tenerla fija.',
    'btn.idea.zoom': 'Entra en una reunión de Zoom desde el navegador.',
    'btn.idea.cam': 'Página que muestra la cámara del estudio o el streaming. Usa la dirección de tu propia página.',
    'btn.idea.site': 'La web de tu emisora, para ver lo que ven los oyentes.',
    'btn.idea.chat': 'Chat de oyentes o página de peticiones. Pega su dirección.',
    'btn.idea.traffic': 'Una página de tráfico o movilidad que lees en directo.',

    'data.intro': 'Los ajustes (feeds, ciudades, botones, logo, idioma, formato de hora…) se guardan en este ordenador. Expórtalos a un archivo para conservar una copia o para configurar otro ordenador.',
    'data.export': 'Exportar ajustes…', 'data.import': 'Importar ajustes…', 'data.reset': 'Restaurar predeterminados…',
    'data.exported': 'Ajustes exportados.', 'data.exportFailed': 'No se pudo escribir el archivo.',
    'data.importForeign': 'Este archivo no procede de G-Clock.', 'data.importInvalid': 'No se puede leer este archivo.',
    'data.noCredentials': 'El archivo no contiene contraseñas ni claves: G-Clock no usa ninguna.',
    'upd.title': 'Actualizaciones', 'upd.auto': 'Buscar actualizaciones', 'upd.autoHint': 'Consulta las versiones públicas de G-Clock en GitHub una vez al día. No se instala nada por sí solo.',
    'upd.check': 'Buscar ahora', 'upd.checking': 'Comprobando…', 'upd.error': 'No se pudo buscar actualizaciones.',
    'upd.latest': 'Tienes la última versión ({v}).', 'upd.available': 'Hay una versión nueva: {v}.',
    'upd.openPage': 'Abrir la página de descarga', 'upd.download': 'Descargar y verificar', 'upd.downloading': 'Descargando…',
    'upd.downloadingPct': 'Descargando… {p}%', 'upd.checksum': 'La descarga no coincidía con su suma de verificación y se eliminó.',
    'upd.failed': 'La descarga falló.', 'upd.ready': 'Descargado y verificado (guardado en Descargas).',
    'upd.install': 'Cerrar e instalar', 'upd.reveal': 'Mostrar instalador',
    'upd.unsigned': 'G-Clock no está firmado digitalmente: el sistema puede avisarte la primera vez que abras la nueva versión.',
    'upd.toast': 'Hay una versión nueva ({v}): Ajustes → Datos y actualizaciones.',

    'about.version': 'Versión {v}', 'about.desc': 'Un gran reloj de estudio para locutores de radio: hora, temporizador de grabación con pre-roll, relojes del mundo y titulares de noticias.',
    'about.author': 'Autor', 'about.site': 'Web', 'about.contact': 'Contacto', 'about.license': 'Licencia',
    'about.code': 'Código fuente', 'about.fonts': 'Fuentes', 'about.weather': 'Datos meteorológicos', 'about.keys': 'Teclado',
    'keys.space': 'Iniciar / pausar el temporizador (Rec)', 'keys.reset': 'Reiniciar el temporizador (Rec)', 'keys.mode': 'Cambiar entre On Air y Rec',
    'keys.fullscreen': 'Pantalla completa', 'keys.settings': 'Ajustes', 'keys.news': 'Titular anterior / siguiente', 'keys.esc': 'Cierra los ajustes, cancela el pre-roll, sale de pantalla completa'
  }
};

let lang = 'en';

// GC.t('timer.elapsed', { e: '01:00', t: '05:00' })
GC.t = (key, params) => {
  let s = GC.DICT[lang]?.[key] ?? GC.DICT.en[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, v);
  return s;
};

// Sets the language and rewrites every element marked with data-i18n / data-i18n-title.
GC.setLanguage = (next) => {
  lang = GC.DICT[next] ? next : 'en';
  document.documentElement.lang = lang;
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = GC.t(el.dataset.i18n);
  for (const el of document.querySelectorAll('[data-i18n-title]')) {
    el.title = GC.t(el.dataset.i18nTitle);
    el.setAttribute('aria-label', el.title);
  }
};
