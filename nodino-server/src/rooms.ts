import { createInitialState, GameState, Player } from './engine.js';

/**
 * Gestione delle stanze di gioco in memoria. Nessuna persistenza qui:
 * le stanze vivono solo finché il processo server è attivo, esattamente
 * come deciso nel progetto (i guest non hanno bisogno di recupero partita).
 */

interface Room {
  code: string;
  players: {
    X: string | null; // socketId, null se lo slot è ancora libero
    O: string | null;
  };
  state: GameState;
  status: 'waiting' | 'in_progress' | 'ended';
}

// Tutte le stanze attive, indicizzate per codice.
const rooms = new Map<string, Room>();

// Mappa inversa: da socketId a { roomCode, symbol }, per risolvere
// rapidamente "chi era questo socket" al momento della disconnessione,
// senza dover scorrere tutte le stanze.
const socketToRoom = new Map<string, { roomCode: string; symbol: Player }>();

const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // esclusi caratteri ambigui (0/O, 1/I)
const ROOM_CODE_LENGTH = 5;

function generateRoomCode(): string {
  let code: string;
  do {
    code = Array.from(
      { length: ROOM_CODE_LENGTH },
      () => ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)],
    ).join('');
  } while (rooms.has(code));
  return code;
}

export function createRoom(): Room {
  const room: Room = {
    code: generateRoomCode(),
    players: { X: null, O: null },
    state: createInitialState(),
    status: 'waiting',
  };
  rooms.set(room.code, room);
  return room;
}

export type JoinRoomResult =
  | { ok: true; room: Room; symbol: Player }
  | { ok: false; error: string };

export function joinRoom(roomCode: string, socketId: string): JoinRoomResult {
  const room = rooms.get(roomCode);

  if (!room) {
    return { ok: false, error: 'Stanza non trovata.' };
  }
  if (room.status === 'ended') {
    return { ok: false, error: 'Questa partita è già terminata.' };
  }

  // Doppio join dello stesso socket sulla stessa stanza: non è un errore,
  // restituiamo semplicemente l'assegnazione già esistente.
  const existing = socketToRoom.get(socketId);
  if (existing && existing.roomCode === roomCode) {
    return { ok: true, room, symbol: existing.symbol };
  }

  const freeSymbol: Player | null = room.players.X === null ? 'X' : room.players.O === null ? 'O' : null;

  if (freeSymbol === null) {
    return { ok: false, error: 'Stanza piena.' };
  }

  room.players[freeSymbol] = socketId;
  socketToRoom.set(socketId, { roomCode, symbol: freeSymbol });

  if (room.players.X !== null && room.players.O !== null) {
    room.status = 'in_progress';
  }

  return { ok: true, room, symbol: freeSymbol };
}

export function getRoomBySocketId(socketId: string): { room: Room; symbol: Player } | null {
  const entry = socketToRoom.get(socketId);
  if (!entry) return null;

  const room = rooms.get(entry.roomCode);
  if (!room) return null;

  return { room, symbol: entry.symbol };
}

export function removeRoom(roomCode: string): void {
  const room = rooms.get(roomCode);
  if (!room) return;

  // Ripulisce anche la mappa inversa per entrambi i giocatori della stanza.
  if (room.players.X) socketToRoom.delete(room.players.X);
  if (room.players.O) socketToRoom.delete(room.players.O);

  rooms.delete(roomCode);
}
