# Nodino — web

Frontend Next.js del gioco Ultimate Tic Tac Toe per la piattaforma Nodino.

## Setup

```bash
npm install
npm run dev
```

Poi apri http://localhost:3000 — la board gioca in hotseat locale (due giocatori
sullo stesso schermo), nessun collegamento multiplayer ancora.

## Struttura

- `lib/engine.ts` — motore di gioco puro (validazione mosse, stato board).
  Stessa logica che verrà usata lato server per la validazione autoritativa.
- `components/Board.tsx` — componente client, gioca in locale usando il motore.
- `components/Board.module.css` — stile del brand Nodino (palette, font, il
  "filo attivo" che indica la sotto-griglia obbligata).
- `app/` — routing Next.js App Router.

## Prossimi passi

- Collegare la board a Socket.io per il multiplayer remoto (sostituendo la
  chiamata diretta a `applyMove` con l'invio della mossa al server).
- Deploy su Vercel.
