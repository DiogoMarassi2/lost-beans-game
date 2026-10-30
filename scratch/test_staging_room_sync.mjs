import { Client } from "/Users/diogomarassi/Desktop/jogo/node_modules/colyseus.js/build/esm/index.mjs";

const ROOM_NAME = "arena";
const SERVER_PORT = 2567;

async function runTest() {
  console.log("=== INICIANDO TESTE DO SISTEMA DE SALA E CUSTOMIZAÇÃO EM TEMPO REAL ===");
  const endpoint = `ws://localhost:${SERVER_PORT}`;
  const clientA = new Client(endpoint);
  const clientB = new Client(endpoint);

  const roomCode = "TEST" + Math.floor(1000 + Math.random() * 9000);
  console.log(`[Teste] Código da sala gerado: ${roomCode}`);

  // 1. Jogador 1 conecta na sala durante o staging
  console.log("[Teste] Conectando Jogador 1 (Feijão Azul)...");
  const roomA = await clientA.joinOrCreate(ROOM_NAME, {
    code: roomCode,
    name: "Feijão Líder",
    color: "#2563eb",
    hair: "spiky",
    eyes: "round_large",
    beard: "full_medium",
    hat: "fisherman",
  });
  console.log(`[Teste] Jogador 1 conectado! SessionId: ${roomA.sessionId}`);

  // 2. Jogador 2 conecta na mesma sala
  console.log("[Teste] Conectando Jogador 2 (Feijão Vermelho)...");
  const roomB = await clientB.joinOrCreate(ROOM_NAME, {
    code: roomCode,
    name: "Feijão Aliado",
    color: "#ef4444",
    hair: "bowl",
    eyes: "oval_small",
    beard: "none",
    hat: "beanie",
  });
  console.log(`[Teste] Jogador 2 conectado! SessionId: ${roomB.sessionId}`);

  // Aguarda sincronização de estado
  await new Promise((r) => setTimeout(r, 600));

  // Valida que ambos estão no state.players
  const playersInA = Array.from(roomA.state.players.values());
  const playersInB = Array.from(roomB.state.players.values());
  console.log(`[Teste] Jogadores vistos por A: ${playersInA.length}`);
  console.log(`[Teste] Jogadores vistos por B: ${playersInB.length}`);

  if (playersInA.length !== 2 || playersInB.length !== 2) {
    throw new Error(`Esperado 2 jogadores em cada cliente, obteve A: ${playersInA.length}, B: ${playersInB.length}`);
  }

  const p1 = playersInA.find((p) => p.name === "Feijão Líder");
  const p2 = playersInA.find((p) => p.name === "Feijão Aliado");
  console.log(`[Teste] Verificação dos jogadores: P1=${p1?.name} (${p1?.color}), P2=${p2?.name} (${p2?.color})`);

  // 3. Testa atualização de aparência/nome em tempo real no staging
  console.log("[Teste] Jogador 1 altera nome e cor no staging...");
  roomA.send("update_appearance", {
    name: "Líder Dourado",
    color: "#f59e0b",
    hair: "long",
  });

  await new Promise((r) => setTimeout(r, 600));

  const updatedP1InB = roomB.state.players.get(roomA.sessionId);
  console.log(`[Teste] Estado de P1 visto por Jogador B: Nome='${updatedP1InB?.name}', Cor='${updatedP1InB?.color}', Cabelo='${updatedP1InB?.hair}'`);

  if (updatedP1InB?.name !== "Líder Dourado" || updatedP1InB?.color !== "#f59e0b" || updatedP1InB?.hair !== "long") {
    throw new Error("Atualização de cosméticos em tempo real no staging falhou!");
  }

  console.log("✓ Sincronização em tempo real de cosméticos e sala no staging: APROVADO COM SUCESSO!");

  await roomA.leave();
  await roomB.leave();
  console.log("=== TESTE CONCLUÍDO COM 100% DE SUCESSO ===");
  process.exit(0);
}

runTest().catch((err) => {
  console.error("ERRO NO TESTE:", err);
  process.exit(1);
});
