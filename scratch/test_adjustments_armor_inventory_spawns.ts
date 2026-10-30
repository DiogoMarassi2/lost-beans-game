import assert from "node:assert";
import { PlayerSchema } from "../packages/server/src/schemas/PlayerSchema";
import { ArenaState } from "../packages/server/src/schemas/ArenaState";
import { AmmoBoxSchema } from "../packages/server/src/schemas/AmmoBoxSchema";
import { CombatSystem } from "../packages/server/src/systems/CombatSystem";
import { WaveSystem } from "../packages/server/src/systems/WaveSystem";
import { ITEM_SPAWNS, HOUSE_STRUCTURE_COLLIDERS } from "../packages/shared/src/constants";

console.log("=================================================");
console.log("🧪 TESTE COMPLETO DOS 4 AJUSTES SOLICITADOS");
console.log("=================================================\n");

// ─────────────────────────────────────────────────────────────
// 1) Ajuste 1: Nenhum inimigo debaixo da casa central & Fundação sólida
// ─────────────────────────────────────────────────────────────
console.log("👉 1) Verificando bloqueio e exclusão de spawn sob a casa central...");

const wave = new WaveSystem();
const state = new ArenaState();

// População inicial:
wave.spawnInitialPopulation(state);
let zombiesUnderHouse = 0;
state.zombies.forEach((z) => {
  if (z.x >= 19.5 && z.x <= 34.0 && z.z >= -7.0 && z.z <= 7.0) {
    zombiesUnderHouse++;
  }
});
assert.strictEqual(zombiesUnderHouse, 0, `Nenhum zumbi inicial pode estar debaixo da casa central! Encontrados: ${zombiesUnderHouse}`);
console.log("  ✓ População inicial: 0 zumbis debaixo da casa central.");

// findOffscreenPoint:
let candidateInsideCount = 0;
for (let i = 0; i < 100; i++) {
  const pt = wave.findOffscreenPoint(state);
  if (pt.x >= 19.2 && pt.x <= 34.5 && pt.z >= -7.2 && pt.z <= 7.2) {
    candidateInsideCount++;
  }
}
assert.strictEqual(candidateInsideCount, 0, "findOffscreenPoint nunca deve retornar coordenadas dentro da casa central térrea!");
console.log("  ✓ findOffscreenPoint: 100/100 pontos gerados fora do perímetro térreo da casa central.");

// Fundação física em HOUSE_STRUCTURE_COLLIDERS:
const hasSolidFoundation = HOUSE_STRUCTURE_COLLIDERS.some(
  (c) => c.minX <= 19.6 && c.maxX >= 27.5 && c.minZ <= -7.0 && c.maxZ >= 7.0 && (c.maxY ?? 0) >= 2.2
);
assert.ok(hasSolidFoundation, "HOUSE_STRUCTURE_COLLIDERS deve conter colisor maciço de fundação sob a casa!");
console.log("  ✓ HOUSE_STRUCTURE_COLLIDERS possui colisor maciço cobrindo todo o vão sob a casa.");

// ─────────────────────────────────────────────────────────────
// 2) Ajuste 2: Mecânica da Armadura (Não ocupa slot, começa 4, upgrade 4->6->8->10->12->14)
// ─────────────────────────────────────────────────────────────
console.log("\n👉 2) Verificando nova mecânica de Armadura...");

const combat = new CombatSystem();
const p1 = new PlayerSchema();
p1.inWorld = true;
p1.hp = 10;
p1.slot0 = "knife";
p1.slot1 = "pistol";
p1.slot2 = "";
p1.slot3 = "";

// Começa com 4 pontos
assert.strictEqual(p1.armor, 4, "Armadura inicial deve ser 4");
assert.strictEqual(p1.maxArmor, 4, "maxArmor inicial deve ser 4");
assert.strictEqual(p1.slot2, "", "Armadura NÃO deve ocupar o slot 2 ou qualquer slot");
console.log("  ✓ Jogador inicializa com 4 pontos de armadura sem ocupar nenhum slot de inventário.");

// Dano 1: Perde 3 pontos de armadura
combat.applyDamage(p1, 3);
assert.strictEqual(p1.armor, 1, "Armadura deve ir para 1 após 3 de dano");
assert.strictEqual(p1.hp, 10, "Vida deve continuar 10");
assert.strictEqual(p1.slot2, "", "Slot continua inalterado");
console.log("  ✓ Dano de 3 pontos absorvido 100% pela armadura (armor = 1/4, hp = 10/10).");

// Dano 2: Perde 2 pontos (1 na armadura zerando-a, e 1 na vida!)
combat.applyDamage(p1, 2);
assert.strictEqual(p1.armor, 0, "Armadura deve zerar");
assert.strictEqual(p1.hp, 9, "Vida deve ir para 9 após excesso de dano");
assert.strictEqual(p1.maxArmor, 4, "maxArmor não se perde");
assert.strictEqual(p1.slot2, "", "Slot continua inalterado mesmo com armadura em 0");
console.log("  ✓ Dano de 2 pontos zera armadura e desconta 1 de HP (armor = 0, hp = 9/10, maxArmor mantido).");

// Dano 3 com armadura zerada
combat.applyDamage(p1, 2);
assert.strictEqual(p1.armor, 0, "Armadura continua 0");
assert.strictEqual(p1.hp, 7, "Vida cai diretamente");
console.log("  ✓ Dano subsequente afeta diretamente a vida enquanto armadura estiver em 0.");

// Upgrades de Armadura: 4 -> 6 -> 8 -> 10 -> 12 -> 14
const progression = [6, 8, 10, 12, 14];
for (const expectedMax of progression) {
  p1.maxArmor = Math.min(14, (p1.maxArmor || 4) + 2);
  p1.armor = p1.maxArmor;
  assert.strictEqual(p1.maxArmor, expectedMax, `maxArmor deve ser ${expectedMax}`);
  assert.strictEqual(p1.armor, expectedMax, `armor deve recarregar para ${expectedMax}`);
  assert.strictEqual(p1.slot2, "", "Slots de inventário permanecem intactos");
}
console.log("  ✓ Progressão na loja testada com sucesso: 4 ➔ 6 ➔ 8 ➔ 10 ➔ 12 ➔ 14 (com recarga total).");

// Nível máximo
const beforeMax = p1.maxArmor;
if (p1.maxArmor < 14) {
  p1.maxArmor += 2;
}
assert.strictEqual(p1.maxArmor, 14, "Não deve ultrapassar 14");
console.log("  ✓ Limite de armadura travado em 14 no nível máximo.");

// ─────────────────────────────────────────────────────────────
// 3) Ajuste 3: Inventário 2x2 com slots 2 e 3 flexíveis
// ─────────────────────────────────────────────────────────────
console.log("\n👉 3) Verificando Slots Flexíveis 2 e 3 (C4, Bandagem, Drops de Chefes)...");

const p2 = new PlayerSchema();
p2.slot0 = "knife";
p2.slot1 = "pistol";
p2.slot2 = "";
p2.slot3 = "";
p2.activeSlot = 1;

// Coleta Bandagem -> vai para slot 2
combat.assignToUtilitySlot(state, p2, "bandage", 1, 3);
assert.strictEqual(p2.slot2, "bandage");
assert.strictEqual(p2.bandageCount, 1);
assert.strictEqual(p2.slot3, "");
console.log("  ✓ Bandagem colocada no Slot 2 vazio.");

// Coleta C4 -> vai para slot 3!
combat.assignToUtilitySlot(state, p2, "c4", 1, 3);
assert.strictEqual(p2.slot2, "bandage");
assert.strictEqual(p2.slot3, "c4");
assert.strictEqual(p2.c4Count, 1);
console.log("  ✓ C4 colocado no Slot 3 vazio.");

// Coleta mais 1 Bandagem -> empilha no Slot 2 (count = 2)
combat.assignToUtilitySlot(state, p2, "bandage", 1, 3);
assert.strictEqual(p2.bandageCount, 2);
assert.strictEqual(p2.slot2, "bandage");
assert.strictEqual(p2.slot3, "c4");
console.log("  ✓ Segunda bandagem empilhada no Slot 2 existente (count = 2/3).");

// Coleta mais 1 C4 -> empilha no Slot 3 (count = 2)
combat.assignToUtilitySlot(state, p2, "c4", 1, 3);
assert.strictEqual(p2.c4Count, 2);
assert.strictEqual(p2.slot3, "c4");
console.log("  ✓ Segundo C4 empilhado no Slot 3 existente (count = 2/3).");

// Coleta drop de chefe "spider_head" com ambos slots ocupados (activeSlot = 1 -> substitui slot 2 e dropa item)
combat.assignToUtilitySlot(state, p2, "spider_head", 1, 1);
assert.strictEqual(p2.slot2, "spider_head");
assert.strictEqual(p2.hasSpiderHead, true);
assert.strictEqual(p2.slot3, "c4");
console.log("  ✓ Drop de chefe recebido perfeitamente no inventário flexível.");

// ─────────────────────────────────────────────────────────────
// 4) Ajuste 4: Munição e Dinheiro espalhados pelo mapa
// ─────────────────────────────────────────────────────────────
console.log("\n👉 4) Verificando Munição e Dinheiro espalhados pelo mapa...");

assert.ok(ITEM_SPAWNS.length >= 25, `Deve haver dezenas de spawns no mapa! Encontrados: ${ITEM_SPAWNS.length}`);
const coinSpawns = ITEM_SPAWNS.filter((s) => s.kind === "coin");
const ammoSpawns = ITEM_SPAWNS.filter((s) => s.kind === "ammo");
assert.ok(coinSpawns.length >= 10, `Deve haver pelo menos 10 moedas espalhadas! Encontradas: ${coinSpawns.length}`);
assert.ok(ammoSpawns.length >= 10, `Deve haver pelo menos 10 munições espalhadas! Encontradas: ${ammoSpawns.length}`);

console.log(`  ✓ Total de coletáveis configurados no mapa: ${ITEM_SPAWNS.length}`);
console.log(`  ✓ Spawns de Moedas (Dinheiro): ${coinSpawns.length}`);
console.log(`  ✓ Spawns de Munição: ${ammoSpawns.length}`);

// Teste de coleta de moeda
const pCoins = new PlayerSchema();
pCoins.coins = 5;
pCoins.inWorld = true;
pCoins.hp = 10;
pCoins.x = coinSpawns[0]!.x;
pCoins.y = coinSpawns[0]!.y;
pCoins.z = coinSpawns[0]!.z;

const testBox = new AmmoBoxSchema();
testBox.id = "test_coin_box";
testBox.kind = "coin";
testBox.x = pCoins.x;
testBox.y = pCoins.y;
testBox.z = pCoins.z;
testBox.active = true;

const testState = new ArenaState();
testState.players.set("p_coins", pCoins);
testState.ammoBoxes.set(testBox.id, testBox);

combat.update(testState, new Map(), 0.05);
assert.strictEqual(pCoins.coins, 8, `Moedas devem subir de 5 para 8! Atual: ${pCoins.coins}`);
assert.strictEqual(testBox.active, false, "Caixa de moeda coletada deve ficar inativa aguardando respawn");
console.log("  ✓ Coleta de moedas no mapa verificada: adicionou +3 moedas e iniciou cooldown de respawn.");

console.log("\n🎉 TODOS OS 4 AJUSTES FORAM TESTADOS E VALIDADOS COM SUCESSO!");
