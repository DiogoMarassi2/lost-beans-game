import http from "node:http";
import express from "express";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { ROOM_NAME, SERVER_PORT } from "@dark-beans/shared";
import { ArenaRoom } from "./rooms/ArenaRoom";

const port = Number(process.env.PORT) || SERVER_PORT;

const app = express();
app.get("/health", (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

const httpServer = http.createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

// Cada código de sala (?room=CODIGO) mapeia para uma instância isolada de ArenaRoom.
gameServer.define(ROOM_NAME, ArenaRoom).filterBy(["code"]);

gameServer
  .listen(port)
  .then(() => {
    console.log(`🧟 Lost Beans server rodando em ws://localhost:${port}`);
  })
  .catch((err: unknown) => {
    console.error("Falha ao iniciar o servidor:", err);
    process.exit(1);
  });
