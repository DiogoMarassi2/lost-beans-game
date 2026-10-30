import assert from "node:assert";
import { ArenaRoom } from "../packages/server/src/rooms/ArenaRoom";
import { PlayerSchema } from "../packages/server/src/schemas/PlayerSchema";
import { HELICOPTER_COUNTDOWN_SECONDS, HELICOPTER_RESCUE_POS, HELICOPTER_SKY_ALTITUDE } from "@dark-beans/shared";

console.log("🚁 Testando mecânica de Resgate por Helicóptero e Vitória...");

// 1) Criar sala e instanciar jogadores
const room = new ArenaRoom();
(room as any).listing = { metadata: {} };
room.onCreate({ code: "RESCU" });

// Jogador 1 (Usuário)
const p1 = new PlayerSchema();
p1.name = "Diogo";
p1.inWorld = true;
p1.hp = 10;
p1.isGodMode = true;
p1.x = 0;
p1.z = 0;
room.state.players.set("session_1", p1);

// Jogador 2 (Amigo)
const p2 = new PlayerSchema();
p2.name = "Amigo";
p2.inWorld = true;
p2.hp = 10;
p2.isGodMode = true;
p2.x = 2;
p2.z = 2;
room.state.players.set("session_2", p2);

// Estado inicial
assert.strictEqual(room.state.flareTriggered, false, "Sinalizador deve começar desligado");
assert.strictEqual(room.state.helicopterStatus, "none", "Helicóptero deve começar como none");
assert.strictEqual(room.state.gameWon, false, "Partida não deve começar vencida");

// 2) Ativação do Sinalizador
p1.flareActive = true;
(room as any).update(0.1);

assert.strictEqual(room.state.flareTriggered, true, "Sinalizador deve ter sido detectado e acionado");
assert.strictEqual(room.state.helicopterStatus, "incoming", "Status deve virar incoming");
assert(room.state.rescueTimer >= 29.8 && room.state.rescueTimer <= 30.0, "Contagem deve iniciar em 30 segundos reais");
assert.strictEqual(room.state.helicopterX, HELICOPTER_RESCUE_POS.x, "Helicóptero deve mirar no heliponto norte");
assert.strictEqual(room.state.helicopterZ, HELICOPTER_RESCUE_POS.z, "Helicóptero Z deve ser -25");
assert.strictEqual(room.state.helicopterY, HELICOPTER_SKY_ALTITUDE, "Helicóptero deve começar no céu (38m)");

console.log("✅ 1. Ativação do sinalizador e início do temporizador de 30s OK");

// 3) Passagem do tempo (simula 15 segundos)
for (let i = 0; i < 150; i++) {
  (room as any).update(0.1);
}
assert(Math.abs(room.state.rescueTimer - 15.0) < 0.2, `Temporizador deve estar em ~15s (atual: ${room.state.rescueTimer})`);
assert.strictEqual(room.state.helicopterStatus, "incoming", "Ainda deve estar em incoming aos 15s");
console.log("✅ 2. Contagem regressiva em andamento OK (~15s restantes)");

// 4) Passagem dos 15 segundos restantes (total 30s)
for (let i = 0; i < 160; i++) {
  (room as any).update(0.1);
}
assert.strictEqual(room.state.rescueTimer, 0, "Temporizador deve ter zerado após 30 segundos");
assert.strictEqual(room.state.helicopterStatus, "landing", "Helicóptero deve ter iniciado descida (landing)");
assert(room.state.helicopterY < HELICOPTER_SKY_ALTITUDE, "Helicóptero deve ter descido abaixo de 38m");
console.log(`✅ 3. Helicóptero avistado e descendo após 30s (altitude: ${room.state.helicopterY.toFixed(1)}m) OK`);

// 5) Descida do helicóptero até o heliponto
for (let i = 0; i < 50; i++) {
  (room as any).update(0.1);
}
assert.strictEqual(room.state.helicopterStatus, "landed", "Helicóptero deve ter pousado (landed)");
assert.strictEqual(room.state.helicopterY, HELICOPTER_RESCUE_POS.y, "Helicóptero deve estar no chão (0.1m)");
console.log("✅ 4. Pouso perfeito do helicóptero no heliponto norte OK");

// 6) Apenas Jogador 1 corre até o helicóptero (Amigo ainda está longe)
p1.x = HELICOPTER_RESCUE_POS.x;
p1.z = HELICOPTER_RESCUE_POS.z;
(room as any).update(0.1);

assert.strictEqual(room.state.gameWon, false, "O jogo NÃO deve acabar se apenas 1 dos 2 jogadores estiver no helicóptero");
assert.strictEqual(room.state.helicopterStatus, "landed", "Helicóptero deve continuar aguardando o amigo");
console.log("✅ 5. Verificação de coop: jogo NÃO encerra enquanto o amigo não chegar OK");

// 7) O amigo chega ao helicóptero junto!
p2.x = HELICOPTER_RESCUE_POS.x + 1.0;
p2.z = HELICOPTER_RESCUE_POS.z + 1.0;
(room as any).update(0.1);

assert.strictEqual(room.state.gameWon, true, "O jogo DEVE acabar quando os 2 chegarem!");
assert.strictEqual(room.state.helicopterStatus, "escaped", "Helicóptero deve decolar com ambos");
assert(room.state.gameWonMessage.length > 0, "Mensagem de vitória deve estar definida");
console.log(`✅ 6. Vitória confirmada! Os 2 chegaram e a mensagem de fim de jogo foi ativada: "${room.state.gameWonMessage}"`);

// 8) Decolagem do helicóptero após a vitória
const prevY = room.state.helicopterY;
(room as any).update(0.5);
assert(room.state.helicopterY > prevY, "Helicóptero deve estar subindo aos céus");
console.log(`✅ 7. Helicóptero decolando com os sobreviventes (altitude subindo para ${room.state.helicopterY.toFixed(1)}m) OK`);

console.log("\n🎉 TODOS OS TESTES DO HELICÓPTERO E VITÓRIA PASSARAM COM 100% DE SUCESSO!");
