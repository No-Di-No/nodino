'use client';

import { GameState, Player } from '@/lib/engine';
import { socket } from '@/lib/socket';
import styles from './Board.module.css';

interface BoardProps {
  state: GameState;
  mySymbol: Player;
  roomCode: string;
}

/**
 * Board collegata al server: nessuna logica di gioco qui dentro.
 * Ogni click invia una richiesta di mossa via socket, e il componente
 * si limita a ridisegnare quando arriva un nuovo `state` dal genitore
 * (che a sua volta lo riceve dall'evento `state:update`).
 */
export default function Board({ state, mySymbol, roomCode }: BoardProps) {
  const isMyTurn = state.status === 'in_progress' && state.currentPlayer === mySymbol;

  function handleCellClick(boardIndex: number, cellIndex: number) {
    if (!isMyTurn) return;
    socket.emit('move:make', { boardIndex, cellIndex });
  }

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.brand}>Nodino</h1>
      <p className={styles.roomInfo}>
        stanza <strong>{roomCode}</strong> — sei <strong>{mySymbol}</strong>
      </p>

      <StatusLine state={state} mySymbol={mySymbol} />

      <div className={styles.metaGrid}>
        {Array.from({ length: 9 }, (_, boardIndex) => (
          <SubBoard
            key={boardIndex}
            boardIndex={boardIndex}
            state={state}
            isMyTurn={isMyTurn}
            onCellClick={handleCellClick}
          />
        ))}
      </div>
    </div>
  );
}

function StatusLine({ state, mySymbol }: { state: GameState; mySymbol: Player }) {
  if (state.status === 'won') {
    const label = state.winner === mySymbol ? 'Hai vinto!' : "Ha vinto l'avversario.";
    return <p className={styles.status}>{label}</p>;
  }
  if (state.status === 'draw') {
    return <p className={styles.status}>Partita in parità</p>;
  }
  return (
    <p className={styles.status}>
      {state.currentPlayer === mySymbol ? (
        <span className={styles.statusTurn}>Tocca a te</span>
      ) : (
        "Turno dell'avversario"
      )}
    </p>
  );
}

function SubBoard({
  boardIndex,
  state,
  isMyTurn,
  onCellClick,
}: {
  boardIndex: number;
  state: GameState;
  isMyTurn: boolean;
  onCellClick: (boardIndex: number, cellIndex: number) => void;
}) {
  const result = state.subBoardWinners[boardIndex];
  const isDecided = result !== '';
  const isActive =
    state.status === 'in_progress' &&
    !isDecided &&
    (state.activeBoard === null || state.activeBoard === boardIndex);

  const subBoardClasses = [
    styles.subBoard,
    isActive ? styles.subBoardActive : '',
    isDecided ? styles.subBoardDecided : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={subBoardClasses}>
      {isDecided && <SubBoardOverlay result={result} />}
      {Array.from({ length: 9 }, (_, cellIndex) => {
        const flatIndex = boardIndex * 9 + cellIndex;
        const value = state.cells[flatIndex];
        const cellClasses = [
          styles.cell,
          value === 'X' ? styles.cellX : '',
          value === 'O' ? styles.cellO : '',
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <button
            key={cellIndex}
            className={cellClasses}
            disabled={isDecided || value !== '' || !isMyTurn}
            onClick={() => onCellClick(boardIndex, cellIndex)}
            aria-label={`Sotto-griglia ${boardIndex + 1}, cella ${cellIndex + 1}`}
          >
            {value}
          </button>
        );
      })}
    </div>
  );
}

function SubBoardOverlay({ result }: { result: '' | Player | 'draw' }) {
  if (result === 'draw') {
    return <div className={`${styles.subBoardOverlay} ${styles.overlayDraw}`}>=</div>;
  }
  const overlayClass = result === 'X' ? styles.overlayX : styles.overlayO;
  return <div className={`${styles.subBoardOverlay} ${overlayClass}`}>{result}</div>;
}
