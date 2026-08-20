# Progetto Nodino

## Cos'è
Sito/piattaforma web che ospita giochi di rompicapo e strategia, pensato per chi ama i puzzle. Nasce con il primo gioco: una versione di **Ultimate Tic Tac Toe** (tris "meta", dove ogni cella è a sua volta un tris e la mossa determina in quale griglia gioca l'avversario dopo).

## Nome del brand: Nodino
- Scelto come nome ombrello della piattaforma (non legato al singolo gioco), in vista dell'espansione futura con altri giochi.
- Richiama "nodo" (da sciogliere, coerente col tema puzzle) in chiave amichevole/diminutiva.
- Pronuncia naturale sia in italiano che in inglese; nessun brand/gioco identico trovato in una prima ricerca.
- Da fare: verificare disponibilità dominio (nodino.it / nodino.com / nodino.gg) e assenza di marchi registrati in classi merceologiche gioco/software.

## Strategia di lancio
- Partire dalla community italiana.
- Espansione futura all'estero (da qui la scelta di un nome pronunciabile anche in inglese).

## Roadmap prodotto
- V1: piattaforma Nodino con dentro il gioco Ultimate Tic Tac Toe (nome interno del gioco ancora da decidere, es. TrisTris/Trisception/MetaTris — non ancora scelto).
- Futuro: aggiungere altri giochi di rompicapo/strategia sotto lo stesso brand Nodino.

## Decisioni tecniche

**Vincoli di partenza**: budget molto piccolo (privilegiare servizi gratuiti entro un certo utilizzo), supporto al multiplayer live.

**Stack scelto**:
- **Frontend**: Next.js + TypeScript (App Router), hosting su Vercel (tier gratuito).
- **Server di gioco**: Node.js + Express + Socket.io, per la gestione realtime delle partite (stanze, connessioni websocket, stato di gioco in memoria durante la partita). Hosting su Render (tier gratuito, con spin-down dopo inattività).
- **Persistenza**: Supabase, usato solo come database Postgres (non si usa il Realtime di Supabase, ci pensa Socket.io). **Non ancora implementata.**
- **Dominio**: unica voce realmente a pagamento nello stack iniziale.

**Perché questo stack**: è il pattern più "classico" per un server di gioco (stato autoritativo lato server, meno rischio di mosse illegali dal client), più facile da trovare in tutorial/community per chi ha ancora poca pratica con JS/TS, e resta interamente su tier gratuiti per iniziare.

**Perché Next.js/React e non HTML/CSS/JS "vanilla"**: valutato esplicitamente e scartato per tre motivi legati al progetto, non per principio:
1. La board di Ultimate Tic Tac Toe ha uno stato complesso (81 celle, 9 sotto-griglie, vincoli di board attiva, esiti a più livelli). Con React basta descrivere "che aspetto ha la UI dato questo stato" e il framework calcola da solo gli aggiornamenti al DOM, evitando sincronizzazione manuale tra stato e classi CSS.
2. Il piano prevede più giochi sotto lo stesso brand: con Next.js aggiungere un gioco è una nuova rotta/cartella che riusa componenti e stile condivisi; in vanilla andrebbe gestito il routing e la duplicazione a mano.
3. Il motore di gioco (`engine.ts`) è pensato per girare identico sia lato client sia lato server: un progetto TypeScript con moduli import/export rende questa condivisione naturale.

Per un progetto con un solo gioco, senza multiplayer né piani di espansione, vanilla JS sarebbe stata una scelta ragionevole (più semplice da leggere, zero build step) — non è il caso di Nodino.

**Flusso di una mossa (architettura di riferimento)**:
1. Il client invia la mossa via websocket (evento Socket.io `move:make`) al server, senza validarla/calcolarla in locale (per ora nessun feedback ottimistico: si aspetta sempre la conferma del server).
2. Il server Node/Express/Socket.io valida la mossa in modo autoritativo con `applyMove` (da `engine.ts`) e aggiorna lo stato della partita tenuto in memoria.
3. Il server trasmette (broadcast) lo stato aggiornato a entrambi i giocatori nella stanza tramite Socket.io (`state:update`).
4. **Da fare**: salvataggio della mossa su Supabase in parallelo, per persistenza/storico (non blocca la risposta agli utenti).
5. Poiché lo stato vive in memoria e il server gratuito può riavviarsi per inattività, ogni mossa andrà salvata su Supabase per poter ricostruire lo stato alla riconnessione (funzionalità di riconnessione non ancora implementata, vedi scope ridotto sotto).

**Alternativa scartata (per ora)**: Supabase come backend "tutto in uno" (Postgres + Realtime + Auth), senza server Node dedicato. Scartata a favore di un server Express/Socket.io per avere più controllo sulla logica di gioco e un pattern più standard, accettando il costo di dover mantenere un piccolo processo sempre attivo (Render).

## Struttura dati e motore di gioco

**Stato di una partita (`GameState`)**:
- `cells`: array flat di 81 elementi (`''` | `'X'` | `'O'`) — le celle delle 9 sotto-griglie
- `subBoardWinners`: array di 9 elementi (`''` | `'X'` | `'O'` | `'draw'`)
- `activeBoard`: indice 0-8 della sotto-griglia in cui si deve giocare, oppure `null` se libera scelta
- `currentPlayer`, `status` (`in_progress`/`won`/`draw`), `winner`

**Perché array flat e non nested**: più semplice da serializzare, salvare come JSON su Postgres e sincronizzare via Socket.io rispetto ad array annidati (9 array da 9).

**Motore (`engine.ts`)**: modulo puro, senza dipendenze da Node/Express/Socket.io, condiviso identico tra `nodino-web/lib/engine.ts` (frontend) e `nodino-server/src/engine.ts` (server) — unica fonte di verità per le regole. Lato server è usato per la validazione autoritativa delle mosse; lato client per ora resta importato solo per i tipi (`GameState`, `Player`), dato che il client non calcola più localmente lo stato (vedi sezione Server multiplayer).

Funzioni principali:
- `createInitialState()`
- `applyMove(state, move)` → nuovo stato, immutabile (non modifica mai l'oggetto ricevuto); lancia `InvalidMoveError` con messaggio specifico se la mossa non è legale (turno sbagliato, cella occupata, board attiva non rispettata, sotto-griglia già decisa, indici fuori range)
- `checkGridWinner` (helper interno) — riusato sia per le sotto-griglie sia per la meta-griglia

**Regola di design — pareggio in una sotto-griglia**: una sotto-griglia pareggiata non conta per nessuno dei due giocatori nella meta-griglia (non è un jolly per nessuno). Motivazione: coerenza logica (un pareggio è "nessuno vince qui"), bilanciamento (evita che un giocatore punti deliberatamente al pareggio locale come scorciatoia), aderenza alle aspettative standard di chi già conosce il gioco.

**`getValidMoves(state)`**: deciso di non implementarla per ora (non serve finché non ci sono bot o hint); si aggiungerà quando servirà.

**Persistenza mosse (per lo step multiplayer)**: alla riconnessione o al riavvio del server Render, lo stato si ricostruirà **ricalcolando da zero la lista delle mosse salvate su Supabase**, rigiocandole attraverso lo stesso `applyMove` usato per la validazione — non si salveranno snapshot dello stato. Motivazione: un'unica fonte di verità per le regole, nessuna duplicazione tra "stato salvato" e "stato calcolato". **Non ancora implementato** (nessuna connessione Supabase per ora).

**Scope attuale, volutamente ridotto**: nessuna gestione utenti, tutti i giocatori sono trattati come guest, identificati solo dal `socketId` della connessione corrente. Se una partita viene chiusa (disconnessione) anche da un solo giocatore, la partita termina subito e l'altro vince per abbandono — nessuna riconnessione o recupero partita per ora.

## Server multiplayer (Express/Socket.io)

**Gestione stanze**: nessun sistema utenti, le stanze si creano/raggiungono tramite un codice generato dal server (5 caratteri alfanumerici maiuscoli, alfabeto scelto escludendo caratteri ambigui come `0`/`O` e `1`/`I`, pensato per essere condiviso a voce/scritto a mano). Un giocatore crea una stanza (diventa X), condivide il codice, il secondo giocatore entra con quel codice (diventa O) e la partita parte subito, senza fase di "pronto?" esplicita.

**Struttura dati delle stanze** (`nodino-server/src/rooms.ts`), tutto in memoria (nessuna persistenza):
- `Map<string, Room>` — le stanze attive, indicizzate per codice. Ogni `Room` contiene `code`, `players.X`/`players.O` (socketId o null), `state` (`GameState`), `status` (`waiting`/`in_progress`/`ended`).
- `Map<socketId, { roomCode, symbol }>` — mappa inversa, per risalire rapidamente da un socket disconnesso a "in quale stanza era, con quale simbolo", senza dover scorrere tutte le stanze. Scelta esplicita rispetto alla ricerca lineare, per tenere la disconnessione una lookup diretta.

Funzioni esposte: `createRoom()`, `joinRoom(roomCode, socketId)` (gestisce anche il doppio join dello stesso socket come richiesta idempotente, non come errore), `getRoomBySocketId(socketId)`, `removeRoom(roomCode)` (pulisce anche la mappa inversa per entrambi i giocatori, per evitare memory leak).

**Contratto eventi Socket.io**:

Dal client al server:
- `room:create` — crea una nuova stanza (chi la crea viene automaticamente registrato come giocatore X).
- `room:join` — payload `{ roomCode }`, entra in una stanza esistente.
- `move:make` — payload `{ boardIndex, cellIndex }` (nessun campo `player`: il server lo deduce dal socket mittente, così un client non può dichiarare falsamente un simbolo che non è il suo).

Dal server al client:
- `room:created` — payload `{ roomCode, yourSymbol }`.
- `room:joined` — payload `{ roomCode, yourSymbol, state }`.
- `room:error` — payload `{ message }` (stanza inesistente, piena, mossa fuori turno, mossa non valida).
- `state:update` — payload `{ state }`, mandato a tutta la stanza dopo ogni mossa valida, e anche al creatore della stanza nel momento in cui il secondo giocatore entra (così la sua UI passa da "in attesa" a board di gioco senza bisogno di ricaricare).
- `game:ended` — payload `{ reason: 'won' | 'draw' | 'opponent_disconnected', winner }`, seguito da rimozione della stanza dalla memoria.

**Gestione disconnessione**: se un giocatore si disconnette a partita `in_progress`, l'altro vince automaticamente per abbandono (`game:ended` con `reason: 'opponent_disconnected'`), poi la stanza viene rimossa. Se la disconnessione avviene mentre la stanza era ancora `waiting` (nessun secondo giocatore mai entrato), la stanza viene semplicemente rimossa senza notifiche.

**CORS**: per ora impostato permissivo (`origin: '*'`) sia su Express sia su Socket.io, da restringere al dominio Vercel reale prima del deploy in produzione.

## Frontend collegato al server

**`lib/socket.ts`**: connessione Socket.io condivisa, istanziata una sola volta a livello di modulo (non dentro un componente, per evitare connessioni duplicate ai re-render), puntata a `NEXT_PUBLIC_SERVER_URL` (variabile d'ambiente, in `.env.local` per sviluppo).

**Separazione stato di sessione / stato di gioco**: `app/page.tsx` tiene lo stato "di sessione" (roomCode, simbolo assegnato, eventuale messaggio di errore/fine partita) e registra i listener sugli eventi Socket.io in un `useEffect` con cleanup (`socket.off` per ogni evento, per evitare che i listener si accumulino ai re-mount). `components/Board.tsx` riceve `state`/`mySymbol`/`roomCode` come props dal genitore, resta "dumb": non calcola più nulla, si limita a mostrare lo stato ricevuto e a inviare `move:make` al click su una cella (con un controllo preventivo `isMyTurn` solo per UX, la validazione vera resta lato server).

**Tre schermate nella stessa pagina**, in base allo stato: lobby (crea/entra in una stanza) → board di gioco (quando `gameState` è valorizzato) → schermata di fine partita (quando arriva `game:ended`).

## Design system

Identità visiva scelta per il brand Nodino, derivata dal concetto di "nodo/filo da sciogliere", applicata sia alla board di gioco sia alla lobby/schermata di fine partita:

- **Colore**: fondo blu inchiostro `#14162B`, pannelli `#1E2140`, linee/bordi `#3A3F6B`, accento X ambra `#F2A340`, accento O verde acqua `#2FBFA0`, testo `#F3F0E8`.
- **Tipografia**: Fraunces (serif con carattere) per il wordmark/titoli, Sora per l'interfaccia, Space Mono per stato partita, coordinate e codice stanza.
- **Elemento distintivo**: la sotto-griglia in cui il giocatore è vincolato a giocare non è solo evidenziata, ma ha un bordo animato ("filo teso") che rende visibile il vincolo di gioco — la regola più caratteristica di Ultimate Tic Tac Toe diventa un elemento visivo coerente col nome Nodino, invece di una semplice evidenziazione generica.

## Stato di avanzamento implementazione

- **Motore di gioco** (`engine.ts`): scritto, funzionante, condiviso identico tra client e server; test automatici valutati ma non implementati (deciso di verificare direttamente tramite l'uso della board invece di una suite formale).
- **Frontend Next.js** (`nodino-web/`): completo per lo scope attuale, verificato con build reale.
  - `lib/engine.ts` — il motore, condiviso (solo i tipi usati lato client per ora)
  - `lib/socket.ts` — connessione Socket.io condivisa
  - `components/Board.tsx` / `Board.module.css` — board collegata al server via socket, stile del design system
  - `app/page.tsx` / `page.module.css` — lobby, gestione eventi socket, schermata di fine partita
  - `app/layout.tsx`, `app/globals.css` — struttura Next.js App Router e token di base
- **Server** (`nodino-server/`): completo per lo scope attuale, verificato con build reale.
  - `src/engine.ts` — copia identica del motore
  - `src/rooms.ts` — gestione stanze in memoria
  - `src/index.ts` — Express + Socket.io, gestione eventi, validazione autoritativa delle mosse
- **Testato manualmente**: partita completa funzionante tra due tab del browser (creazione stanza, ingresso, alternanza mosse, vittoria/pareggio, abbandono per disconnessione).
- **Non ancora fatto**: connessione Supabase (persistenza mosse, schema `games`/`moves`), deploy su Vercel + Render, autenticazione utenti, storico partite, gestione riconnessione.

## Convenzioni di lavoro con Claude
- Quando ci sono modifiche a blocchi di codice già esistenti, Claude deve descrivere la modifica, senza incollare il nuovo codice completo.
- Natura didattica del progetto: quando si lavora su più file/passaggi, Claude deve procedere spiegando passo per passo cosa fare invece di consegnare interi progetti già pronti, salvo indicazione esplicita contraria dell'utente. Se l'utente chiede esplicitamente di scrivere/consegnare i file direttamente, Claude può farlo, ma di default (soprattutto su parti nuove/concettualmente importanti) deve spiegare prima a blocchi cosa serve e perché.

## Prossimi step
1. Verificare dominio e marchio per "Nodino".
2. Decidere il nome interno del gioco Ultimate Tic Tac Toe dentro Nodino.
3. ~~Definire stack tecnico e struttura del sito.~~ Fatto.
4. ~~Definire la struttura dati dello stato di una partita di Ultimate Tic Tac Toe.~~ Fatto.
5. ~~Setup del progetto frontend: struttura cartelle, board hotseat funzionante.~~ Fatto.
6. ~~Logica di gioco in locale (single-player/hotseat).~~ Fatto (poi sostituita dal flusso multiplayer, vedi step 7).
7. ~~Collegare la logica al multiplayer: server Express/Socket.io che riusa `engine.ts` per la validazione autoritativa, gestione stanze, sincronizzazione mosse via Socket.io.~~ Fatto, testato con due tab del browser.
8. Connessione Supabase per salvare le mosse (schema `games` / `moves`).
9. Deploy su Vercel (frontend) + Render (server), con CORS ristretto al dominio reale.
10. Autenticazione utenti, storico partite, gestione riconnessione.