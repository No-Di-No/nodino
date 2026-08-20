import { io } from 'socket.io-client';

/**
 * Istanza unica della connessione al server di gioco, condivisa da tutta
 * l'app. Creata una sola volta a livello di modulo: importare questo file
 * da più componenti restituisce sempre la stessa connessione, non ne apre
 * di nuove.
 */
export const socket = io(process.env.NEXT_PUBLIC_SERVER_URL!, {
  autoConnect: true,
});
