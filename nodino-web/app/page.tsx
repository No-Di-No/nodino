'use client';

import { useEffect, useState } from 'react';
import { GameState, Player } from '@/lib/engine';
import { socket } from '@/lib/socket';
import Board from '@/components/Board';
import styles from './page.module.css';

type EndReason = 'won' | 'draw' | 'opponent_disconnected';

export default function HomePage() {
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [mySymbol, setMySymbol] = useState<Player | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [endInfo, setEndInfo] = useState<{ reason: EndReason; winner: Player | null } | null>(
    null,
  );
  const [joinCodeInput, setJoinCodeInput] = useState('');

  useEffect(() => {
    function onRoomCreated({ roomCode, yourSymbol }: { roomCode: string; yourSymbol: Player }) {
      setRoomCode(roomCode);
      setMySymbol(yourSymbol);
    }

    function onRoomJoined({
      roomCode,
      yourSymbol,
      state,
    }: {
      roomCode: string;
      yourSymbol: Player;
      state: GameState;
    }) {
      setRoomCode(roomCode);
      setMySymbol(yourSymbol);
      setGameState(state);
      setErrorMessage(null);
    }

    function onRoomError({ message }: { message: string }) {
      setErrorMessage(message);
    }

    function onStateUpdate({ state }: { state: GameState }) {
      setGameState(state);
    }

    function onGameEnded({ reason, winner }: { reason: EndReason; winner: Player | null }) {
      setEndInfo({ reason, winner: winner ?? null });
    }

    socket.on('room:created', onRoomCreated);
    socket.on('room:joined', onRoomJoined);
    socket.on('room:error', onRoomError);
    socket.on('state:update', onStateUpdate);
    socket.on('game:ended', onGameEnded);

    return () => {
      socket.off('room:created', onRoomCreated);
      socket.off('room:joined', onRoomJoined);
      socket.off('room:error', onRoomError);
      socket.off('state:update', onStateUpdate);
      socket.off('game:ended', onGameEnded);
    };
  }, []);

  function handleCreateRoom() {
    setErrorMessage(null);
    socket.emit('room:create');
  }

  function handleJoinRoom() {
    if (!joinCodeInput.trim()) return;
    setErrorMessage(null);
    socket.emit('room:join', { roomCode: joinCodeInput.trim().toUpperCase() });
  }

  if (endInfo) {
    return <EndScreen endInfo={endInfo} mySymbol={mySymbol} />;
  }

  if (gameState && mySymbol && roomCode) {
    return <Board state={gameState} mySymbol={mySymbol} roomCode={roomCode} />;
  }

  return (
    <Lobby
      roomCode={roomCode}
      joinCodeInput={joinCodeInput}
      errorMessage={errorMessage}
      onJoinCodeChange={setJoinCodeInput}
      onCreateRoom={handleCreateRoom}
      onJoinRoom={handleJoinRoom}
    />
  );
}

function Lobby({
  roomCode,
  joinCodeInput,
  errorMessage,
  onJoinCodeChange,
  onCreateRoom,
  onJoinRoom,
}: {
  roomCode: string | null;
  joinCodeInput: string;
  errorMessage: string | null;
  onJoinCodeChange: (value: string) => void;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
}) {
  // Se abbiamo già un roomCode ma non siamo ancora entrati in partita
  // (nessun gameState), significa che siamo il creatore in attesa
  // dell'avversario: nascondiamo i controlli di creazione/ingresso.
  const isWaiting = roomCode !== null;

  return (
    <main className={styles.wrapper}>
      <h1 className={styles.brand}>Nodino</h1>
      <p className={styles.tagline}>sciogli il nodo — ultimate tic tac toe</p>

      {isWaiting ? (
        <div className={styles.card}>
          <p className={styles.waitingHint}>codice stanza</p>
          <p className={styles.waitingCode}>{roomCode}</p>
          <p className={styles.waitingHint}>in attesa dell'avversario...</p>
        </div>
      ) : (
        <div className={styles.card}>
          <button className={styles.primaryButton} onClick={onCreateRoom}>
            Crea una stanza
          </button>

          <div className={styles.divider}>oppure</div>

          <div className={styles.joinRow}>
            <input
              className={styles.codeInput}
              value={joinCodeInput}
              onChange={(e) => onJoinCodeChange(e.target.value)}
              placeholder="Codice"
              maxLength={5}
            />
            <button className={styles.secondaryButton} onClick={onJoinRoom}>
              Entra
            </button>
          </div>

          {errorMessage && <p className={styles.errorText}>{errorMessage}</p>}
        </div>
      )}
    </main>
  );
}

function EndScreen({
  endInfo,
  mySymbol,
}: {
  endInfo: { reason: EndReason; winner: Player | null };
  mySymbol: Player | null;
}) {
  let message: string;
  if (endInfo.reason === 'opponent_disconnected') {
    message = "L'avversario si è disconnesso. Hai vinto per abbandono.";
  } else if (endInfo.reason === 'draw') {
    message = 'Partita in parità.';
  } else if (endInfo.winner === mySymbol) {
    message = 'Hai vinto!';
  } else {
    message = "Ha vinto l'avversario.";
  }

  return (
    <main className={styles.wrapper}>
      <h1 className={styles.brand}>Nodino</h1>
      <div className={styles.card}>
        <p className={styles.endMessage}>{message}</p>
        <button className={styles.primaryButton} onClick={() => window.location.reload()}>
          Nuova partita
        </button>
      </div>
    </main>
  );
}
