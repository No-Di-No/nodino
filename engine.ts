/**
 * Motore di gioco puro per Ultimate Tic Tac Toe.
 *
 * Nessuna dipendenza da Node/Express/Socket.io: pensato per essere
 * importato sia lato server (validazione autoritativa) sia, in futuro,
 * lato client (feedback locale immediato) - un'unica fonte di verità
 * per le regole del gioco.
 */

export type Player = 'X' | 'O';
export type CellValue = '' | Player;
export type SubBoardResult = '' | Player | 'draw';
export type GameStatus = 'in_progress' | 'won' | 'draw';

export interface Move {
  boardIndex: number; // 0-8: quale sotto-griglia
  cellIndex: number;  // 0-8: quale cella dentro la sotto-griglia
  player: Player;
}

export interface GameState {
  cells: CellValue[];              // 81 celle totali (9 sotto-griglie x 9 celle)
  subBoardWinners: SubBoardResult[]; // 9 elementi
  activeBoard: number | null;      // sotto-griglia in cui si deve giocare, null = libera scelta
  currentPlayer: Player;
  status: GameStatus;
  winner: Player | null;
}

export class InvalidMoveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidMoveError';
  }
}

// Le 8 combinazioni vincenti di una griglia 3x3 (righe, colonne, diagonali)
const WIN_LINES: [number, number, number][] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // righe
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // colonne
  [0, 4, 8], [2, 4, 6],            // diagonali
];

export function createInitialState(startingPlayer: Player = 'X'): GameState {
  return {
    cells: Array(81).fill(''),
    subBoardWinners: Array(9).fill(''),
    activeBoard: null,
    currentPlayer: startingPlayer,
    status: 'in_progress',
    winner: null,
  };
}

/** Estrae le 9 celle di una sotto-griglia dall'array flat di 81 elementi. */
function getSubBoardCells(cells: CellValue[], boardIndex: number): CellValue[] {
  const start = boardIndex * 9;
  return cells.slice(start, start + 9);
}

/**
 * Controlla se in una griglia 3x3 (9 celle) c'è un vincitore.
 * Funziona sia per le sotto-griglie (CellValue[]) sia per la meta-griglia,
 * a patto di passare un array di 9 valori 'X' | 'O' | '' (i 'draw' vanno
 * pre-filtrati a '' da chi chiama, vedi checkOverallWinner).
 */
function checkGridWinner(nineCells: ('' | Player)[]): Player | null {
  for (const [a, b, c] of WIN_LINES) {
    const v = nineCells[a];
    if (v !== '' && v === nineCells[b] && v === nineCells[c]) {
      return v;
    }
  }
  return null;
}

function isGridFull(nineCells: ('' | Player)[]): boolean {
  return nineCells.every((v) => v !== '');
}

/** Determina se una mossa è legale nello stato corrente. Lancia InvalidMoveError se non lo è. */
function assertValidMove(state: GameState, move: Move): void {
  if (state.status !== 'in_progress') {
    throw new InvalidMoveError('La partita è già conclusa.');
  }
  if (move.player !== state.currentPlayer) {
    throw new InvalidMoveError('Non è il turno di questo giocatore.');
  }
  if (move.boardIndex < 0 || move.boardIndex > 8 || move.cellIndex < 0 || move.cellIndex > 8) {
    throw new InvalidMoveError('Indice di board o cella fuori range.');
  }
  if (state.activeBoard !== null && move.boardIndex !== state.activeBoard) {
    throw new InvalidMoveError('Devi giocare nella sotto-griglia attiva.');
  }
  if (state.subBoardWinners[move.boardIndex] !== '') {
    throw new InvalidMoveError('Questa sotto-griglia è già decisa.');
  }
  const flatIndex = move.boardIndex * 9 + move.cellIndex;
  if (state.cells[flatIndex] !== '') {
    throw new InvalidMoveError('Questa cella è già occupata.');
  }
}

/**
 * Applica una mossa allo stato corrente e restituisce un NUOVO stato
 * (nessuna mutazione dell'oggetto originale). Lancia InvalidMoveError
 * se la mossa non è legale.
 */
export function applyMove(state: GameState, move: Move): GameState {
  assertValidMove(state, move);

  const flatIndex = move.boardIndex * 9 + move.cellIndex;
  const newCells = state.cells.slice();
  newCells[flatIndex] = move.player;

  // Ricalcola l'esito della sotto-griglia appena toccata
  const subCells = getSubBoardCells(newCells, move.boardIndex) as ('' | Player)[];
  const subWinner = checkGridWinner(subCells);
  const newSubBoardWinners = state.subBoardWinners.slice();
  if (subWinner) {
    newSubBoardWinners[move.boardIndex] = subWinner;
  } else if (isGridFull(subCells)) {
    newSubBoardWinners[move.boardIndex] = 'draw';
  }

  // Ricalcola l'esito generale sulla meta-griglia (i 'draw' non contano come mossa di nessuno)
  const metaCells = newSubBoardWinners.map((r) => (r === 'draw' ? '' : r)) as ('' | Player)[];
  const overallWinner = checkGridWinner(metaCells);

  // La prossima sotto-griglia attiva è quella corrispondente alla cella scelta,
  // a meno che non sia già decisa: in tal caso il prossimo gioca dove vuole.
  const nextActiveBoard =
    newSubBoardWinners[move.cellIndex] === '' ? move.cellIndex : null;

  let status: GameStatus = 'in_progress';
  let winner: Player | null = null;

  if (overallWinner) {
    status = 'won';
    winner = overallWinner;
  } else if (newSubBoardWinners.every((r) => r !== '')) {
    status = 'draw';
  }

  return {
    cells: newCells,
    subBoardWinners: newSubBoardWinners,
    activeBoard: status === 'in_progress' ? nextActiveBoard : state.activeBoard,
    currentPlayer: status === 'in_progress' ? (move.player === 'X' ? 'O' : 'X') : state.currentPlayer,
    status,
    winner,
  };
}
