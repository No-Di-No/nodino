import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import cors from 'cors';
import { applyMove, InvalidMoveError } from './engine.js';
import { createRoom, joinRoom, getRoomBySocketId, removeRoom } from './rooms.js';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*', // da restringere al dominio Vercel una volta in produzione
  },
});

app.get('/', (_req, res) => {
  res.send('ok');
});

io.on('connection', (socket) => {
  socket.on('room:create', () => {
    const room = createRoom();
    // Chi crea la stanza deve comunque essere registrato come giocatore
    // (altrimenti il server non sa "chi è" quando arriveranno le sue mosse).
    const result = joinRoom(room.code, socket.id);
    if (!result.ok) return; // non può fallire: la stanza è appena stata creata vuota

    socket.join(room.code);
    socket.emit('room:created', { roomCode: room.code, yourSymbol: result.symbol });
  });

  socket.on('room:join', ({ roomCode }: { roomCode: string }) => {
    const result = joinRoom(roomCode, socket.id);

    if (!result.ok) {
      socket.emit('room:error', { message: result.error });
      return;
    }

    socket.join(result.room.code);
    socket.emit('room:joined', {
      roomCode: result.room.code,
      yourSymbol: result.symbol,
      state: result.room.state,
    });

    // Il giocatore che aveva creato la stanza è ancora in attesa: gli mandiamo
    // lo stato aggiornato così sa che la partita è iniziata. `socket.to` (a
    // differenza di `io.to`) esclude il mittente, quindi arriva solo a lui.
    if (result.room.status === 'in_progress') {
      socket.to(result.room.code).emit('state:update', { state: result.room.state });
    }
  });

  socket.on('move:make', ({ boardIndex, cellIndex }: { boardIndex: number; cellIndex: number }) => {
    const entry = getRoomBySocketId(socket.id);
    if (!entry) return; // socket non associato a nessuna partita

    const { room, symbol } = entry;

    if (room.state.currentPlayer !== symbol) {
      socket.emit('room:error', { message: 'Non è il tuo turno.' });
      return;
    }

    try {
      room.state = applyMove(room.state, { boardIndex, cellIndex, player: symbol });
    } catch (err) {
      if (err instanceof InvalidMoveError) {
        socket.emit('room:error', { message: err.message });
        return;
      }
      throw err;
    }

    io.to(room.code).emit('state:update', { state: room.state });

    if (room.state.status !== 'in_progress') {
      io.to(room.code).emit('game:ended', {
        reason: room.state.status === 'won' ? 'won' : 'draw',
        winner: room.state.winner,
      });
      removeRoom(room.code);
    }
  });

  socket.on('disconnect', () => {
    const entry = getRoomBySocketId(socket.id);
    if (!entry) return;

    const { room, symbol } = entry;

    if (room.status === 'in_progress') {
      const winner = symbol === 'X' ? 'O' : 'X';
      io.to(room.code).emit('game:ended', {
        reason: 'opponent_disconnected',
        winner,
      });
    }

    removeRoom(room.code);
  });
});

const PORT = process.env.PORT ?? 3001;
httpServer.listen(PORT, () => {
  console.log(`Nodino server in ascolto sulla porta ${PORT}`);
});
