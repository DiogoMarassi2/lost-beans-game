import { Schema, type } from "@colyseus/schema";

/**
 * Estado sincronizado de um zumbi na rede.
 */
export class ZombieSchema extends Schema {
  @type("string") id = "";
  @type("string") type = "standard";
  @type("float32") x = 0;
  @type("float32") y = 0;
  @type("float32") z = 0;
  @type("float32") rotation = 0;
  @type("uint16") hp = 3;
  @type("uint16") maxHp = 3;
  @type("string") state = "alive"; // "alive" | "dead"
  @type("boolean") attacking = false;
  @type("boolean") exploded = false;
  @type("boolean") isAggro = false;

  // Propriedades internas do servidor (não sincronizadas na rede)
  corpseTimer = 0;
  attackCooldown = 0;

  // Propriedades do Zumbi Rastejador e Zumbi Morteiro
  slimeTrailTimer = 0;
  lastSlimeX = 0;
  lastSlimeZ = 0;
  spitCooldown = 0.8;
  mortarCooldown = 0.5;
  summonCooldown = 6.0;

  // IA de Patrulha / Perseguição
  aiMode: "wandering" | "chasing" = "wandering";
  isHunter = false; // Se true, foi spawnado como caçador direto
  /** Zumbi de horda que pode esquecer o jogador: segundos restantes de perseguição garantida (nasce longe, a ≥22m). */
  huntGraceTimer = 0;
  patrolTargetX = 0;
  patrolTargetZ = 0;
  patrolTimer = 0;
  patrolState: "walking" | "idle" = "walking";
  idleTimer = 0;
  anchorX = 0;
  anchorZ = 0;

  // Limiares de vida para invocação de reforços de chefes (70%, 50% e 10%)
  bossTriggered70 = false;
  bossTriggered50 = false;
  bossTriggered10 = false;
}
