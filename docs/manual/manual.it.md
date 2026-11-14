# Manuale di G-Clock

G-Clock è un **orologio da studio per i conduttori radiofonici**: il classico quadrante da 60 minuti con i segnalini degli stopset, i titoli delle notizie dai feed che scegli, il meteo facoltativo, un interruttore On Air / Rec, un timer di registrazione con programmi, blocchi e un conto alla rovescia 3·2·1, e un **timer MicTime** facoltativo che cronometra un intervento da un messaggio MIDI, un tasto o un livello audio. È un'app desktop gratuita per Windows, macOS e Linux di OnAir Garage.

## Installazione e primo avvio

Scarica l'installer per il tuo sistema dalla pagina [Releases](https://github.com/djgragra/g-clock/releases) e controllalo con `SHA256SUMS.txt`:
`G-Clock-Setup-<V>.exe` (Windows), `G-Clock-<V>-arm64.dmg` (Mac con Apple silicon), `G-Clock-<V>.dmg` (Mac con Intel), `G-Clock-<V>.AppImage` (Linux).
L'app è gratuita e non ha un certificato Apple o Microsoft, quindi al primo avvio può comparire un avviso.

- **Windows**: avvia l'installer. Se SmartScreen dice «Windows ha protetto il PC», clicca *Ulteriori informazioni* → *Esegui comunque*.
- **macOS**: apri l'immagine disco e trascina l'app in Applicazioni. L'app è firmata ad-hoc, ed è ciò che serve a un Mac Apple silicon per aprirla. Il primo avvio mostra comunque l'avviso «sviluppatore non identificato»: apri *Impostazioni di Sistema → Privacy e sicurezza*, scorri in basso e clicca *Apri comunque* (il clic destro → Apri non esiste più da macOS 15). Se una versione precedente dice che l'app è «danneggiata», esegui una volta nel Terminale: `xattr -cr "/Applications/G-Clock.app" && codesign --force --deep -s - "/Applications/G-Clock.app"`
- **Linux**: rendi eseguibile l'AppImage (`chmod +x G-Clock-*.AppImage`) e avviala.

La lingua segue il sistema (English, Italiano, Español) e si può cambiare in *Impostazioni*. Il tema è scuro per default, con chiaro e di sistema disponibili. L'app è pensata per uno schermo largo (16:9); in una finestra alta il quadrante va in alto e i titoli sotto.

## Il quadrante da studio

Il quadrante a sinistra funziona come in un orologio da studio: 60 segmenti di minuto che si riempiono con il passare dell'ora (verde, arancione, rosso), con il minuto corrente che si riempie secondo per secondo. Al centro vedi il tempo che manca alla fine dell'ora, e negli ultimi minuti compare FINE ORA. Data e ora sono grandi nell'intestazione, a 24 o 12 ore e nel fuso orario che scegli in *Impostazioni → Generale*, insieme all'opzione per mostrare i secondi.

- **Stopset** (stacchi pubblicitari, notizie, jingle): scegli i minuti dell'ora (per esempio `0, 30`). Sono i segnalini più grandi sul quadrante, diventano rossi quando sono vicini e durante il loro minuto il centro mostra il nome dello stopset. Il centro conta alla rovescia fino al successivo. Negli ultimi secondi che scegli (*lampeggia quando mancano secondi*, 60 per default, 0 = mai) il conto alla rovescia e il segnalino lampeggiano; con «riduci animazioni» attivo nel sistema non lampeggia nulla.
- **Programmazioni degli stopset per giorno e ora**: altri gruppi di minuti per certi giorni e ore (per esempio `0, 20, 40` nei pomeriggi feriali e `15, 45` nel fine settimana). Vale la prima programmazione che corrisponde all'ora dell'orologio, fuori da esse valgono i minuti predefiniti, e il quadrante si ridisegna quando una programmazione inizia o finisce. Una programmazione può superare la mezzanotte (appartiene al giorno in cui inizia).
- **Eventi fissi**: eventi a un'ora del giorno (notiziario alle 18:00, blocco pubblicitario alle 18:20, un ospite in onda), ciascuno nei giorni che scegli. Sotto il quadrante l'orologio mostra il prossimo (*PROSSIMO*) con il conto alla rovescia, ti avverte **una volta** (la barra diventa rossa al numero di secondi che scegli per quell'evento, 60 per default) e dice ORA per dieci secondi quando è il momento. Gli orari seguono il fuso orario dell'orologio.

## Titoli e meteo

- **Titoli**, al centro: i feed RSS / Atom che aggiungi (solo https), una scheda per fonte, una pagina di sei alla volta che gira ogni pochi secondi, più un ticker scorrevole in basso. Si vedono solo titolo, fonte, ora e link; un clic apre l'articolo nel browser. L'app legge i feed da sé. Una piccola pillola nell'intestazione dice quanti dei tuoi feed hanno risposto; senza nessun feed la colonna mostra un benvenuto con un pulsante per aggiungerne uno.
- **Meteo** (facoltativo, **spento per default**), a destra: cerchi i luoghi e l'app li trova con la geocodifica di Open-Meteo. Il credito di Open-Meteo è sempre visibile finché il meteo è acceso.
- **Messaggi per lo speaker** (*Impostazioni → Messaggi*): fino a nove messaggi brevi salvati (120 caratteri ciascuno), mostrati in grande sotto il quadrante nella schermata On Air. I tasti `1`–`9` (o i pulsanti sotto il quadrante) mostrano il messaggio salvato con quel numero; lo stesso tasto di nuovo lo toglie. `M` scrive un messaggio al volo (Invio per mostrarlo, Esc per annullare) e `0`, o un clic sul messaggio, lo cancella. Quello che è sullo schermo non viene salvato: dopo un riavvio la striscia è vuota. I messaggi salvati fanno parte del backup. Il messaggio resta visibile anche in *solo orologio*.
- **Solo orologio** (*Impostazioni → Generale*, o tasto `C` nella schermata On Air): il solo quadrante, senza titoli, ticker, meteo né stato dei feed, per uno schermo a muro. Feed e città restano configurati e tornano quando lo spegni.

## ON AIR e REC

L'interruttore **ON AIR / REC** (tasto `O`) cambia schermata. **REC** sostituisce il quadrante con il timer di registrazione:

- **tempo libero** con tempi rapidi, oppure un **programma** fatto di blocchi (apertura, intervista, chiusura…), ciascuno con il suo tempo;
- un conto alla rovescia visivo 3·2·1, pausa e ripresa, sforamento in rosso, beep facoltativi;
- **fine blocco**, rifai e indietro; clicca un blocco per registrare fuori ordine; più take per blocco;
- **tempi dinamici**: quanto un blocco sfora o resta sotto viene tolto o dato ai successivi;
- un **resoconto** alla fine del programma: copialo, salvalo come testo o come **CSV** per un foglio di calcolo (una riga per blocco, in secondi, e una riga TOTALE);
- i programmi si creano e si modificano nell'app, e si possono importare ed esportare come JSON.

Spazio avvia e mette in pausa, `N` chiude il blocco, `R` azzera.

## Timer MicTime

In *Impostazioni → MicTime* (**spento per default**) accendi il timer dell'app MicTime, con le stesse opzioni, dentro G-Clock. Il primo segnale avvia il conteggio, il successivo lo ferma, il totale resta a schermo per qualche secondo (o fino al successivo avvio) e il timer torna a zero. Compare sotto il quadrante e, durante la registrazione, come un chip nell'intestazione.

- **Segnali**: un **messaggio MIDI** (scegli l'ingresso; start, stop, reset, passo successivo, passo precedente e riparti su una nota, un controller o un program change, con *Impara*, qualsiasi canale o uno, e un monitor dei messaggi in arrivo), un **tasto** che scegli (globale, che funziona con un altro programma davanti dove il sistema lo permette, oppure con la finestra davanti) e il **livello di un ingresso audio** (soglia e tempo di tenuta).
- **Tempi limite e programmi**: un programma è un elenco di passi con un nome e un limite (per esempio Apertura 00:45, Notizie 01:00, Intervista 03:00); dopo ogni intervento il passo successivo si arma da solo; fino a 8 programmi di 40 passi; oppure un solo tempo limite senza programma. Le cifre sono grigie a zero, passano a un colore di avviso prima del limite (10 secondi per default), al rosso oltre il limite, e lampeggiano lentamente quando è superato di molto; con «riduci animazioni» si vede invece una cornice rossa fissa.
- Finché è spento non si ascolta nulla: niente MIDI, niente tasto, niente microfono, e i permessi del sistema vengono rifiutati. Il livello audio richiede il permesso del microfono del sistema; l'audio non viene mai registrato, salvato né inviato.

## I tuoi pulsanti e il tuo logo

- **I tuoi pulsanti** aprono una pagina web nel browser (un link per un ospite remoto, una telecamera dello studio, il sito della radio…), ciascuno con una nota che spiega a cosa serve, più idee pronte per compilare il modulo (*Aggiungi*, *Apri* per provare).
- **Il tuo logo**: un PNG, JPG o SVG, ridimensionato al massimo a 512 px e conservato solo sul tuo computer (*Impostazioni → Generale*).
- *Sempre in primo piano*, schermo intero (`F` o `F11`) e *Tieni lo schermo acceso* sono in *Impostazioni → Generale*.

## Impostazioni

Premi `S` o il pulsante delle impostazioni. Le impostazioni sono in schede, tra cui Generale (lingua, tema, formato ora, fuso orario, sempre in primo piano, solo orologio, tieni lo schermo acceso, logo), le sezioni per stopset, eventi, messaggi, feed, meteo e pulsanti, MicTime, Aggiornamenti, Backup e Aiuto e informazioni.

**Backup** (*Impostazioni → Backup*): *Esporta* salva l'intera configurazione (impostazioni, programmi, pulsanti, feed, città, eventi, programmazioni, e il timer MicTime con i suoi messaggi MIDI, tasti, programmi e colori) come `g-clock-backup-AAAA-MM-GG.json`. All'importazione scegli tra **sostituire tutto** e **aggiungere solo ciò che manca**. Il file non contiene password né chiavi: l'app non ne usa.

**Aiuto e informazioni** mostra la versione, il sistema, la licenza, i crediti e i link, *Copia info per assistenza* (versione, sistema, lingua, ultimo controllo aggiornamenti e ultimo errore: mai le tue impostazioni, indirizzi o nomi di file) e *Apri cartella dei log* (file di log giornalieri, al massimo 5 MB ciascuno, 7 giorni conservati). Il riquadro mancia ha un salvadanaio e un pulsante: entrambi aprono la pagina di sostegno del sito nella lingua dell'app; dentro l'app non viene mai chiesto nulla.

## Privacy e rete

G-Clock contatta solo i feed di notizie che **tu** hai configurato (https), `geocoding-api.open-meteo.com` e `api.open-meteo.com` **solo se accendi il meteo**, e GitHub per cercare una nuova release (si può disattivare in *Impostazioni*). La finestra in sé non ha nessun accesso alla rete; tutto ciò che è remoto passa dal processo principale, che accetta solo indirizzi https. Nessun account, nessuna analisi, nessuna telemetria.

## Aggiornamenti

L'app cerca una nuova versione 15 secondi dopo l'avvio e poi ogni 24 ore. Un avviso offre *Scarica e installa*, *Ricordamelo dopo* (24 ore) e *Salta questa versione*, con una barra di avanzamento e *Annulla*. Il file viene controllato con `SHA256SUMS.txt`. *Chiudi e installa* salva prima una copia di sicurezza delle impostazioni. Dopo l'aggiornamento compare una volta la finestra *Novità*. Niente viene installato senza un clic.

## Limiti

- L'orologio segue quello del computer: tienilo sincronizzato. Gli orari degli eventi fissi seguono il fuso orario dell'orologio, e un cambio di ora legale non sposta nulla (sono orari da parete).
- I titoli richiedono una connessione a Internet e indirizzi https; un feed che non risponde viene mostrato nella pillola e le altre schede continuano a funzionare.
- Il meteo e il timer MicTime restano spenti finché non li accendi qui.

## Risoluzione dei problemi

| Problema | Cosa fare |
|---|---|
| macOS: «l'app è danneggiata / non può essere aperta» | Apri *Impostazioni di Sistema → Privacy e sicurezza → Apri comunque*; per una versione precedente, esegui nel Terminale `xattr -cr "/Applications/G-Clock.app" && codesign --force --deep -s - "/Applications/G-Clock.app"`. |
| Windows: «Windows ha protetto il PC» | *Ulteriori informazioni* → *Esegui comunque*. |
| Linux: l'AppImage non si avvia | Rendila eseguibile (`chmod +x`) e installa FUSE (`libfuse2`) se il tuo sistema lo richiede. |
| Nessun titolo | Aggiungi un feed (https) nelle impostazioni; la pillola nell'intestazione dice quanti feed rispondono. |
| Il messaggio MIDI non arriva | In *Impostazioni → MicTime* controlla il monitor dei messaggi in arrivo e premi di nuovo *Impara*. |
| Il download dell'aggiornamento è fallito con «checksum mismatch» | Il file è stato eliminato automaticamente. Riprova, oppure scarica l'installer a mano dalla pagina delle release. |

## Contatti

Graziano Melzi · OnAir Garage — `https://onairgarage.com` — `hello@onairgarage.com`. Pagina dello strumento: `https://onairgarage.com/tools/g-clock/`. Specifica MIDI del timer MicTime: `https://github.com/djgragra/mictime/blob/main/docs/MIDI-SPEC.md`. Codice sorgente e release: `https://github.com/djgragra/g-clock`. Licenza: MIT © 2026 Graziano Melzi.
