import {
  calculateElevation,
  C4_DISTRACTION_RADIUS,
  ENEMY_CONFIGS,
  getRoofImpactY,
  HORDE_1_DELAY_AFTER_CABIN_DOOR_SECONDS,
  HORDE_1_TRIGGER_REAL_SECONDS,
  HORDE_2_TRIGGER_REAL_SECONDS,
  HORDE_3_TRIGGER_REAL_SECONDS,
  HORDE_4_TRIGGER_REAL_SECONDS,
  HORDE_5_TRIGGER_REAL_SECONDS,
  HORDE_6_TRIGGER_REAL_SECONDS,
  HORDE_7_TRIGGER_REAL_SECONDS,
  HORDE_8_TRIGGER_REAL_SECONDS,
  HORDE_9_TRIGGER_REAL_SECONDS,
  HORDE_10_TRIGGER_REAL_SECONDS,
  HORDE_11_TRIGGER_REAL_SECONDS,
  HORDE_12_TRIGGER_REAL_SECONDS,
  HORDE_13_TRIGGER_REAL_SECONDS,
  isInsideCoveredBuilding,
  MAP_MAX_X,
  MAP_MAX_Z,
  MAP_MIN_X,
  MAP_MIN_Z,
  MORTAR_COOLDOWN,
  MORTAR_DAMAGE,
  MORTAR_FLIGHT_SPEED,
  MORTAR_MAX_RANGE,
  MORTAR_MIN_RANGE,
  MORTAR_SPLASH_RADIUS,
  OBSTACLES,
  PLAYER_RADIUS,
  PLAYER_MAX_HP,
  resolveStatic,
  separateCircles,
  SLIME_DAMAGE_PER_SEC,
  SLIME_PUDDLE_LIFETIME,
  SLIME_PUDDLE_RADIUS,
  SPIT_COOLDOWN,
  SPIT_DAMAGE,
  SPIT_LIFETIME,
  SPIT_RADIUS,
  SPIT_SPEED,
  stepMovement,
  WEB_PARALYZE_DURATION,
  WEB_SPIT_DAMAGE,
  WEB_SPIT_SPEED,
  ZOMBIE_ATTACK_COOLDOWN,
  type BoxCollider,
  type EnemyTypeId,
  getStaticCollidersNear,
} from "@dark-beans/shared";
import type { ArenaState } from "../schemas/ArenaState";
import type { PlayerSchema } from "../schemas/PlayerSchema";
import { MortarLobSchema } from "../schemas/MortarLobSchema";
import { SlimePuddleSchema } from "../schemas/SlimePuddleSchema";
import { SpitProjectileSchema } from "../schemas/SpitProjectileSchema";
import { ZombieSchema } from "../schemas/ZombieSchema";
import { C4MineSchema } from "../schemas/C4MineSchema";
import { AmmoBoxSchema } from "../schemas/AmmoBoxSchema";

interface PendingHordeWave {
  triggerGameTime: number;
  hordeNumber: number;
  enemies: EnemyTypeId[];
  isReinforcement: boolean;
  alertText?: string;
}

interface PendingSpawnBatch {
  triggerGameTime: number;
  enemies: EnemyTypeId[];
  baseAngle: number;
}

/**
 * Sistema avançado de IA e ondas de zumbis:
 * - População inicial pré-alocada pelo mapa em zonas temáticas (floresta, trilha, casa, ferro velho).
 * - Movimento de patrulha autônomo ("aleatório mas definido") com pontos âncora e pausas naturais de observação.
 * - Dinâmica de proximidade (Aggro Radius): inimigos só perseguem quando o sobrevivente se aproxima o suficiente (ou quando levam tiro).
 * - Respawns contínuos fora da visão: a maioria entra no mapa patrulhando por proximidade, e apenas uma minoria (~25%) age como caçadores diretos.
 * - Mecânica de perda de rastro: se o sobrevivente despistar e correr muito para longe (>22m), o zumbi perde o rastro e volta a patrulhar.
 * - Física sólida de não-sobreposição (Zumbi x Zumbi e Zumbi x Jogador).
 * - Suporte a múltiplos tipos de inimigos (Standard, Suicida explosivo, Brutamontes tank).
 */
export class WaveSystem {
  private zombieIdCounter = 0;
  private puddleIdCounter = 0;
  private spitIdCounter = 0;
  private mortarIdCounter = 0;

  private hasInitialSpawned = false;
  private horde1Triggered = false;
  private horde2Triggered = false;
  private horde3Triggered = false;
  private horde4Triggered = false;
  private horde5Triggered = false;
  private horde6Triggered = false;
  private horde7Triggered = false;
  private horde8Triggered = false;
  private horde9Triggered = false;
  private horde10Triggered = false;
  private horde11Triggered = false;
  private horde12Triggered = false;
  private horde13Triggered = false;
  private hordeAlertTimer = 0;
  /** O relógio das hordas só começa a correr quando a porta da casinha inicial é aberta. */
  private hordeClockStarted = false;

  /** Fila de levas e reforços escalonados (+15s) para hordas fluidas e dinâmicas */
  private pendingWaves: PendingHordeWave[] = [];

  /** Fila de lotes de zumbis escalonados com calma (+0s, +2s, +5s...) para todas as hordas */
  private pendingBatches: PendingSpawnBatch[] = [];

  /** Limite máximo de zumbis simultâneos vivos no mapa para comportar hordas densas e intensas. */
  static readonly MAX_ACTIVE_ZOMBIES = 50;

  /** Distância mínima (em metros) para garantir que o zumbi nasça fora da visão/câmera do jogador. */
  static readonly MIN_OFFSCREEN_DIST = 22.0;
  /** Distância além da qual um zumbi não-caçador perde o rastro do jogador. */
  static readonly LOSE_TRACK_DIST = 22.0;
  /** Perseguição garantida (s) para zumbis de horda que podem esquecer, já que nascem fora da tela (≥22m). */
  static readonly HORDE_HUNT_GRACE_SECONDS = 20.0;
  /** Ao chegar a esta distância do alvo, o zumbi de horda encerra a perseguição garantida. */
  static readonly HORDE_HUNT_ENGAGE_DIST = 15.0;

  /**
   * Verifica se um chefe específico ainda está vivo na arena.
   */
  private isBossAlive(state: ArenaState, bossType: EnemyTypeId): boolean {
    for (const [, z] of state.zombies) {
      if (z.type === bossType && z.state !== "dead" && z.hp > 0) {
        return true;
      }
    }
    return false;
  }

  update(state: ArenaState, dt: number, doorColliders?: readonly BoxCollider[]): void {
    const livingPlayers: PlayerSchema[] = [];
    state.players.forEach((p) => {
      if (p.inWorld && p.hp > 0) livingPlayers.push(p);
    });

    // Se nenhum jogador entrou no mundo ainda (estão na criação/staging de personagem),
    // ou se todos os jogadores no mundo morreram, pausa completamente a simulação
    if (livingPlayers.length === 0) {
      return;
    }

    // 1) Inicialização: Spawna zumbis simples já em movimento pelo mapa na primeira iteração com jogadores ativos
    if (!this.hasInitialSpawned) {
      this.hasInitialSpawned = true;
      this.spawnInitialPopulation(state);
    }

    // 2) Relógio do Jogo Acelerado e Disparo das Hordas Oficiais
    // (congelado até alguém abrir a porta da casinha inicial)
    if (this.hordeClockStarted) {
      state.gameTime += dt;
    }

      // Desativa o alerta de horda após 4.2 segundos do disparo
      if (state.hordeAlert) {
        this.hordeAlertTimer += dt;
        if (this.hordeAlertTimer >= 4.2) {
          state.hordeAlert = false;
          state.hordeAlertText = "";
          this.hordeAlertTimer = 0;
        }
      }

      // Processa levas pendentes e reforços programados (+15s)
      for (let i = this.pendingWaves.length - 1; i >= 0; i--) {
        const wave = this.pendingWaves[i]!;
        if (state.gameTime >= wave.triggerGameTime) {
          this.pendingWaves.splice(i, 1);
          console.log(
            `[WaveSystem] 🚀 Disparando onda da Horda ${wave.hordeNumber} (reforço: ${wave.isReinforcement})!`
          );
          this.spawnHordeWave(state, wave.enemies);
          if (wave.alertText) {
            state.hordeAlert = true;
            state.hordeAlertText = wave.alertText;
            this.hordeAlertTimer = 0;
          }
        }
      }

      // Processa lotes de zumbis escalonados com calma no tempo (+0s, +2s, +5s...)
      for (let i = this.pendingBatches.length - 1; i >= 0; i--) {
        const batch = this.pendingBatches[i]!;
        if (state.gameTime >= batch.triggerGameTime) {
          this.pendingBatches.splice(i, 1);
          this.executeSpawnBatch(state, batch.enemies, batch.baseAngle);
        }
      }

      // 1ª Horda Oficial: dispara 60s após a porta da casinha inicial ser aberta
      if (state.gameTime >= HORDE_1_TRIGGER_REAL_SECONDS && !this.horde1Triggered) {
        this.horde1Triggered = true;
        this.hordeAlertTimer = 0;
        state.currentHorde = 1;
        state.hordeState = "horde";
        state.hordeAlert = true;
        state.hordeAlertText = "HORDA 1 INICIADA!";
        this.triggerHorde(state, 1);
      }

      // 2ª Horda Oficial: dispara às 06:00 (60 segundos reais)
      if (state.gameTime >= HORDE_2_TRIGGER_REAL_SECONDS && !this.horde2Triggered) {
        this.horde2Triggered = true;
        this.hordeAlertTimer = 0;
        state.currentHorde = 2;
        state.hordeState = "horde";
        state.hordeAlert = true;
        state.hordeAlertText = "HORDA 2 INICIADA!";
        this.triggerHorde(state, 2);
      }

      // 3ª Horda Oficial: dispara às 14:20 (215 segundos reais / Meio-dia)
      if (state.gameTime >= HORDE_3_TRIGGER_REAL_SECONDS && !this.horde3Triggered) {
        this.horde3Triggered = true;
        this.hordeAlertTimer = 0;
        state.currentHorde = 3;
        state.hordeState = "horde";
        state.hordeAlert = true;
        state.hordeAlertText = "HORDA 3: MEIO-DIA TÓXICO!";
        this.triggerHorde(state, 3);
      }

      // 4ª Horda Oficial: dispara às 19:00 (285 segundos reais / Anoitecer) - aguarda derrota do Monstro do Pântano
      if (
        state.gameTime >= HORDE_4_TRIGGER_REAL_SECONDS &&
        !this.horde4Triggered &&
        !this.isBossAlive(state, "boss")
      ) {
        this.horde4Triggered = true;
        this.hordeAlertTimer = 0;
        state.currentHorde = 4;
        state.hordeState = "horde";
        state.hordeAlert = true;
        state.hordeAlertText = "HORDA 4: ANOITECER SANGRENTO!";
        this.triggerHorde(state, 4);
      }

      // 5ª Horda Oficial: dispara às 23:40 (355 segundos reais)
      if (state.gameTime >= HORDE_5_TRIGGER_REAL_SECONDS && !this.horde5Triggered) {
        this.horde5Triggered = true;
        this.hordeAlertTimer = 0;
        state.currentHorde = 5;
        state.hordeState = "horde";
        state.hordeAlert = true;
        state.hordeAlertText = "HORDA 5: CALAMIDADE TÓXICA!";
        this.triggerHorde(state, 5);
      }

      // 6ª Horda Oficial: dispara às 28:20 (425 segundos reais / Alvorada do Terror)
      if (state.gameTime >= HORDE_6_TRIGGER_REAL_SECONDS && !this.horde6Triggered) {
        this.horde6Triggered = true;
        this.hordeAlertTimer = 0;
        state.currentHorde = 6;
        state.hordeState = "horde";
        state.hordeAlert = true;
        state.hordeAlertText = "HORDA 6: ALVORADA DO TERROR!";
        this.triggerHorde(state, 6);
      }

      // 7ª Horda Oficial: dispara às 33:00 (495 segundos reais / Tempestade Biológica) - aguarda derrota da Rainha Aracnídea
      if (
        state.gameTime >= HORDE_7_TRIGGER_REAL_SECONDS &&
        !this.horde7Triggered &&
        !this.isBossAlive(state, "spider_boss")
      ) {
        this.horde7Triggered = true;
        this.hordeAlertTimer = 0;
        state.currentHorde = 7;
        state.hordeState = "horde";
        state.hordeAlert = true;
        state.hordeAlertText = "HORDA 7: TEMPESTADE BIOLÓGICA!";
        this.triggerHorde(state, 7);
      }

      // 8ª Horda Oficial: dispara às 37:40 (565 segundos reais / Cerco Blindado)
      if (state.gameTime >= HORDE_8_TRIGGER_REAL_SECONDS && !this.horde8Triggered) {
        this.horde8Triggered = true;
        this.hordeAlertTimer = 0;
        state.currentHorde = 8;
        state.hordeState = "horde";
        state.hordeAlert = true;
        state.hordeAlertText = "HORDA 8: CERCO BLINDADO!";
        this.triggerHorde(state, 8);
      }

      // 9ª Horda Oficial: dispara às 42:20 (635 segundos reais / Lua de Sangue)
      if (state.gameTime >= HORDE_9_TRIGGER_REAL_SECONDS && !this.horde9Triggered) {
        this.horde9Triggered = true;
        this.hordeAlertTimer = 0;
        state.currentHorde = 9;
        state.hordeState = "horde";
        state.hordeAlert = true;
        state.hordeAlertText = "HORDA 9: LUA DE SANGUE!";
        this.triggerHorde(state, 9);
      }

      // 10ª Horda Oficial: dispara às 47:00 (705 segundos reais) - aguarda derrota do Lobisomem Alfa
      if (
        state.gameTime >= HORDE_10_TRIGGER_REAL_SECONDS &&
        !this.horde10Triggered &&
        !this.isBossAlive(state, "werewolf_boss")
      ) {
        this.horde10Triggered = true;
        this.hordeAlertTimer = 0;
        state.currentHorde = 10;
        state.hordeState = "horde";
        state.hordeAlert = true;
        state.hordeAlertText = "HORDA 10: FÚRIA DA MATILHA!";
        this.triggerHorde(state, 10);
      }

      // 11ª Horda Oficial: dispara às 51:40 (775 segundos reais / Pesadelo das Profundezas)
      if (state.gameTime >= HORDE_11_TRIGGER_REAL_SECONDS && !this.horde11Triggered) {
        this.horde11Triggered = true;
        this.hordeAlertTimer = 0;
        state.currentHorde = 11;
        state.hordeState = "horde";
        state.hordeAlert = true;
        state.hordeAlertText = "HORDA 11: PESADELO DAS PROFUNDEZAS!";
        this.triggerHorde(state, 11);
      }

      // 12ª Horda Oficial: dispara às 56:20 (845 segundos reais / Eclipse Sombrio)
      if (state.gameTime >= HORDE_12_TRIGGER_REAL_SECONDS && !this.horde12Triggered) {
        this.horde12Triggered = true;
        this.hordeAlertTimer = 0;
        state.currentHorde = 12;
        state.hordeState = "horde";
        state.hordeAlert = true;
        state.hordeAlertText = "HORDA 12: ECLIPSE SOMBRIO!";
        this.triggerHorde(state, 12);
      }

      // 13ª Horda Oficial: dispara às 61:00 (915 segundos reais) - aguarda derrota do Homem do Saco
      if (
        state.gameTime >= HORDE_13_TRIGGER_REAL_SECONDS &&
        !this.horde13Triggered &&
        !this.isBossAlive(state, "sack_boss")
      ) {
        this.horde13Triggered = true;
        this.hordeAlertTimer = 0;
        state.currentHorde = 13;
        state.hordeState = "horde";
        state.hordeAlert = true;
        state.hordeAlertText = "HORDA 13: O CATACLISMA FINAL!";
        this.triggerHorde(state, 13);
      }

    // 3) Processamento de IA, Perseguição, Patrulha e Ataque
    const corpsesToRemove: string[] = [];

    state.zombies.forEach((zombie, id) => {
      // Se estiver morto, avança o temporizador de decaimento do corpo (10 segundos)
      if (zombie.state === "dead") {
        zombie.attacking = false;
        zombie.corpseTimer -= dt;
        if (zombie.corpseTimer <= 0) {
          corpsesToRemove.push(id);
        }
        return;
      }

      // Atualiza cooldown de ataque e estado de animação de golpe
      if (zombie.attackCooldown > 0) {
        zombie.attackCooldown -= dt;
      }
      if (zombie.attackCooldown <= ZOMBIE_ATTACK_COOLDOWN - 0.25) {
        zombie.attacking = false;
      }

      // Atualiza temporizadores de tiro à distância
      if (zombie.spitCooldown > 0) {
        zombie.spitCooldown -= dt;
      }
      if (zombie.mortarCooldown > 0) {
        zombie.mortarCooldown -= dt;
      }

      const config = ENEMY_CONFIGS[zombie.type as EnemyTypeId] ?? ENEMY_CONFIGS.standard;

      // Rastro contínuo de gosma venenosa no chão deixada pelo rastejador ao se mover
      if (config.slimeTrail && zombie.state === "alive") {
        zombie.slimeTrailTimer += dt;
        const distMoved = Math.hypot(zombie.x - zombie.lastSlimeX, zombie.z - zombie.lastSlimeZ);
        if (distMoved >= 1.05 || (zombie.slimeTrailTimer >= 1.1 && distMoved >= 0.2)) {
          zombie.slimeTrailTimer = 0;
          zombie.lastSlimeX = zombie.x;
          zombie.lastSlimeZ = zombie.z;
          this.spawnSlimePuddle(state, zombie.x, zombie.y, zombie.z);
        }
      }

      // Invocação contínua de zumbis comuns pelo Chefe enquanto estiver vivo e em combate
      if (zombie.type === "boss" && zombie.state === "alive" && zombie.isAggro) {
        zombie.summonCooldown -= dt;
        if (zombie.summonCooldown <= 0) {
          zombie.summonCooldown = 8.0 + Math.random() * 2.5;

          // Limite de segurança de zumbis simultâneos no mapa
          let livingZombieCount = 0;
          state.zombies.forEach((z) => {
            if (z.state === "alive") livingZombieCount++;
          });

          if (livingZombieCount < 26) {
            // Spawna 2 zumbis comuns ao redor do Chefe
            const summonAngles = [
              zombie.rotation + Math.PI * 0.45 + (Math.random() - 0.5) * 0.4,
              zombie.rotation - Math.PI * 0.45 + (Math.random() - 0.5) * 0.4,
            ];
            for (const ang of summonAngles) {
              const spawnDist = 2.6 + Math.random() * 0.8;
              const sx = zombie.x + Math.sin(ang) * spawnDist;
              const sz = zombie.z + Math.cos(ang) * spawnDist;
              const minion = this.spawnEnemy(state, "standard", sx, sz);
              minion.isHunter = true;
              minion.isAggro = true;
              minion.aiMode = "chasing";
            }
          }
        }
      }

      // Invocação contínua de pequenas aranhas pela Rainha Aracnídea enquanto estiver viva e em combate
      if (zombie.type === "spider_boss" && zombie.state === "alive" && zombie.isAggro) {
        zombie.summonCooldown -= dt;
        if (zombie.summonCooldown <= 0) {
          zombie.summonCooldown = 7.0 + Math.random() * 2.0;

          let livingSpiderCount = 0;
          state.zombies.forEach((z) => {
            if (z.type === "spider" && z.state === "alive") livingSpiderCount++;
          });

          if (livingSpiderCount < 10) {
            // Spawna 2 pequenas aranhas escuras flanqueando a aranha gigante
            const summonAngles = [
              zombie.rotation + Math.PI * 0.5 + (Math.random() - 0.5) * 0.3,
              zombie.rotation - Math.PI * 0.5 + (Math.random() - 0.5) * 0.3,
            ];
            for (const ang of summonAngles) {
              const spawnDist = 1.8 + Math.random() * 0.6;
              const sx = zombie.x + Math.sin(ang) * spawnDist;
              const sz = zombie.z + Math.cos(ang) * spawnDist;
              const spiderMinion = this.spawnEnemy(state, "spider", sx, sz);
              spiderMinion.isHunter = true;
              spiderMinion.isAggro = true;
              spiderMinion.aiMode = "chasing";
            }
          }
        }
      }

      // Invocação contínua de lobos pelo Chefe Lobisomem enquanto estiver vivo e em combate
      if (zombie.type === "werewolf_boss" && zombie.state === "alive" && zombie.isAggro) {
        zombie.summonCooldown -= dt;
        if (zombie.summonCooldown <= 0) {
          zombie.summonCooldown = 8.0 + Math.random() * 2.5;

          let livingWolfCount = 0;
          state.zombies.forEach((z) => {
            if (z.type === "wolf" && z.state === "alive") livingWolfCount++;
          });

          if (livingWolfCount < 8) {
            // Spawna 2 lobos rápidos flanqueando o Lobisomem
            const summonAngles = [
              zombie.rotation + Math.PI * 0.45 + (Math.random() - 0.5) * 0.3,
              zombie.rotation - Math.PI * 0.45 + (Math.random() - 0.5) * 0.3,
            ];
            for (const ang of summonAngles) {
              const spawnDist = 2.6 + Math.random() * 0.8;
              const sx = zombie.x + Math.sin(ang) * spawnDist;
              const sz = zombie.z + Math.cos(ang) * spawnDist;
              const wolfMinion = this.spawnEnemy(state, "wolf", sx, sz);
              wolfMinion.isHunter = true;
              wolfMinion.isAggro = true;
              wolfMinion.aiMode = "chasing";
            }
          }
        }
      }

      // Invocação contínua de reforços pelo Homem do Saco enquanto estiver vivo e em combate
      if (zombie.type === "sack_boss" && zombie.state === "alive" && zombie.isAggro) {
        zombie.summonCooldown -= dt;
        if (zombie.summonCooldown <= 0) {
          zombie.summonCooldown = 8.0 + Math.random() * 2.5;

          let livingCount = 0;
          state.zombies.forEach((z) => {
            if (z.state === "alive") livingCount++;
          });

          if (livingCount < 26) {
            const summonAngles = [
              zombie.rotation + Math.PI * 0.45 + (Math.random() - 0.5) * 0.3,
              zombie.rotation - Math.PI * 0.45 + (Math.random() - 0.5) * 0.3,
            ];
            for (const ang of summonAngles) {
              const spawnDist = 2.6 + Math.random() * 0.8;
              const sx = zombie.x + Math.sin(ang) * spawnDist;
              const sz = zombie.z + Math.cos(ang) * spawnDist;
              const minion = this.spawnEnemy(state, "tank", sx, sz);
              minion.isHunter = true;
              minion.isAggro = true;
              minion.aiMode = "chasing";
            }
          }
        }
      }

      // ─── Reforços de vida de todos os Chefes nos limiares de 70%, 50% e 10% ───
      const isBossType =
        zombie.type === "boss" ||
        zombie.type === "spider_boss" ||
        zombie.type === "werewolf_boss" ||
        zombie.type === "sack_boss" ||
        config.isBoss;

      if (isBossType && zombie.state === "alive" && zombie.hp > 0 && zombie.maxHp > 0) {
        const hpPct = (zombie.hp / zombie.maxHp) * 100;
        if (hpPct <= 70 && !zombie.bossTriggered70) {
          zombie.bossTriggered70 = true;
          this.spawnBossThresholdReinforcements(state, zombie, 70);
        }
        if (hpPct <= 50 && !zombie.bossTriggered50) {
          zombie.bossTriggered50 = true;
          this.spawnBossThresholdReinforcements(state, zombie, 50);
        }
        if (hpPct <= 10 && !zombie.bossTriggered10) {
          zombie.bossTriggered10 = true;
          this.spawnBossThresholdReinforcements(state, zombie, 10);
        }
      }

      // ─── 3.0) PRIORIDADE ABSOLUTA: C4 EXPLOSIVA COM DISTRAÇÃO ─────────────
      // Se houver uma C4 armada no mapa (contagem de 5s), ela atrai os zumbis
      // em uma distância considerável, tirando completamente o foco do jogador!
      let activeC4: C4MineSchema | null = null;
      let minC4DistSq = Infinity;

      if (state.c4Mines) {
        for (const c4 of state.c4Mines.values()) {
          if (!c4.exploded && c4.timer > 0) {
            const dx = c4.x - zombie.x;
            const dz = c4.z - zombie.z;
            const distSq = dx * dx + dz * dz;
            if (distSq <= C4_DISTRACTION_RADIUS * C4_DISTRACTION_RADIUS && distSq < minC4DistSq) {
              minC4DistSq = distSq;
              activeC4 = c4;
            }
          }
        }
      }

      // Encontra o sobrevivente vivo mais próximo
      let closestPlayer: PlayerSchema | null = null;
      let minDistSq = Infinity;

      for (const player of livingPlayers) {
        const dx = player.x - zombie.x;
        const dz = player.z - zombie.z;
        const distSq = dx * dx + dz * dz;
        if (distSq < minDistSq) {
          minDistSq = distSq;
          closestPlayer = player;
        }
      }

      // Se houver C4 chamando a atenção, ela é o alvo prioritário!
      const targetPos: { x: number; y: number; z: number } | null = activeC4
        ? { x: activeC4.x, y: activeC4.y, z: activeC4.z }
        : closestPlayer
        ? { x: closestPlayer.x, y: closestPlayer.y, z: closestPlayer.z }
        : null;

      const dist = activeC4
        ? Math.sqrt(minC4DistSq)
        : Math.sqrt(minDistSq);

      // Raio de detecção por proximidade baseado no tipo do zumbi
      const detectionRadius = activeC4
        ? C4_DISTRACTION_RADIUS
        : (config.id === "runner" ? 9.5 : config.id === "tank" ? 7.5 : config.id === "spitter" ? 11.5 : config.id === "mortar" ? 19.5 : config.id === "boss" ? 18.0 : 8.5);

      // ─── 3.1) Transição de Proximidade (Wandering -> Chasing) ─────────────
      if (!zombie.isAggro && targetPos) {
        const sameLevel = Math.abs(targetPos.y - zombie.y) < 4.5;
        if (dist <= detectionRadius && sameLevel) {
          zombie.isAggro = true;
          zombie.aiMode = "chasing";
          // "quando avista o alvo atira": prepara o primeiro tiro imediatamente!
          if (config.firesMortar) {
            zombie.mortarCooldown = 0.05;
          }
          if (config.spitsSlime) {
            zombie.spitCooldown = Math.min(zombie.spitCooldown, 0.4);
          }
        }
      }

      // ─── 3.2) Modo: PERSEGUIÇÃO AGRESSIVA (Aggro ativo) ─────────────────
      if (zombie.isAggro && targetPos) {
        // Se o sobrevivente despistou o zumbi e fugiu para muito longe (>22m), e não houver C4 chamando atenção e não for caçador direto, perde o rastro!
        if (zombie.huntGraceTimer > 0) {
          zombie.huntGraceTimer = dist <= WaveSystem.HORDE_HUNT_ENGAGE_DIST ? 0 : zombie.huntGraceTimer - dt;
        }
        if (!activeC4 && !zombie.isHunter && zombie.huntGraceTimer <= 0 && dist > WaveSystem.LOSE_TRACK_DIST) {
          zombie.isAggro = false;
          zombie.aiMode = "wandering";
          zombie.anchorX = zombie.x;
          zombie.anchorZ = zombie.z;
          this.pickPatrolWaypoint(zombie);
        } else {
          // Persegue o alvo (C4 ou jogador) a toda velocidade
          const dx = targetPos.x - zombie.x;
          const dz = targetPos.z - zombie.z;

          if (dist > 0.01) {
            // O Chefe Golias Abominável avança pelo flanco esquerdo da clareira
            // Se o sobrevivente estiver dentro ou além da casa (X > 12.0), o Chefe avança até a clareira em frente à casa (X = 12.0)
            let navTargetX = targetPos.x;
            let navTargetZ = targetPos.z;

            if ((zombie.type === "boss" || zombie.type === "spider_boss" || zombie.type === "werewolf_boss" || zombie.type === "sack_boss") && navTargetX > 12.0) {
              navTargetX = 12.0;
              navTargetZ = Math.max(MAP_MIN_Z + 3.0, Math.min(MAP_MAX_Z - 3.0, targetPos.z));
            }

            const ndx = navTargetX - zombie.x;
            const ndz = navTargetZ - zombie.z;
            const ndist = Math.hypot(ndx, ndz);

            // Mira sempre para o alvo direto (jogador ou C4)
            zombie.rotation = Math.atan2(dx, dz);

            let moveSpeed = config.speed;
            if (config.firesMortar && zombie.type !== "boss") {
              moveSpeed = zombie.attacking ? 0 : config.speed * 0.5;
            } else if (zombie.type === "boss" || zombie.type === "spider_boss" || zombie.type === "werewolf_boss" || zombie.type === "sack_boss") {
              // Chefe pausa brevemente apenas durante o recuo do disparo ou golpe
              moveSpeed = zombie.attacking ? 0 : config.speed;
            }

            if (moveSpeed > 0 && ndist > 0.4) {
              const moveDirX = ndx / ndist;
              const moveDirZ = ndz / ndist;
              const pos = { x: zombie.x, y: zombie.y, z: zombie.z };
              stepMovement(pos, moveDirX, moveDirZ, moveSpeed, dt, config.radius, doorColliders);

              if (zombie.type === "boss" || zombie.type === "spider_boss" || zombie.type === "werewolf_boss" || zombie.type === "sack_boss") {
                // Restrição estrita de cenário: o Chefe nunca invade a casa nem o ferro-velho à direita
                pos.x = Math.min(12.5, Math.max(MAP_MIN_X + 2.5, pos.x));
              }

              zombie.x = pos.x;
              zombie.y = pos.y ?? 0;
              zombie.z = pos.z;
            }
          }

          // Se estiver atacando a C4, zumbis atacam a bomba esperando a explosão
          if (activeC4 && dist <= 1.35) {
            zombie.attacking = true;
            zombie.attackCooldown = 0.4;
          }

          // Ataques e tiros mirados contra o jogador (apenas se não houver C4 distraindo)
          if (!activeC4 && closestPlayer) {
            // Cuspe à distância do Zumbi Rastejador (bola de gosma que causa 2 de dano)
            if (config.spitsSlime && dist >= 3.0 && dist <= 14.0 && zombie.spitCooldown <= 0) {
              const sameLevelSpit = Math.abs(closestPlayer.y - zombie.y) < 2.0;
              if (sameLevelSpit) {
                zombie.spitCooldown = SPIT_COOLDOWN + Math.random() * 0.8;
                zombie.attacking = true;
                zombie.attackCooldown = 0.55;
                const spitAngle = Math.atan2(dx, dz);
                zombie.rotation = spitAngle;
                this.spawnSpitProjectile(state, zombie.x, zombie.y, zombie.z, spitAngle);
              }
            }

            // Cuspe de teia paralisante da Rainha Aracnídea
            if (config.spitsWeb && dist >= 3.5 && dist <= 17.0 && zombie.spitCooldown <= 0) {
              const sameLevelSpit = Math.abs(closestPlayer.y - zombie.y) < 3.0;
              if (sameLevelSpit) {
                zombie.spitCooldown = 3.6 + Math.random() * 0.8;
                zombie.attacking = true;
                zombie.attackCooldown = 0.55;
                const spitAngle = Math.atan2(dx, dz);
                zombie.rotation = spitAngle;
                this.spawnSpitProjectile(state, zombie.x, zombie.y, zombie.z, spitAngle, "web");
              }
            }

            // Disparo de morteiro em parábola do Zumbi Morteiro e do Chefe Golias (bomba de gosma com dano e poça de ácido)
            const isBoss = zombie.type === "boss";
            const mortarMinRange = isBoss ? 3.5 : MORTAR_MIN_RANGE;
            const mortarMaxRange = isBoss ? 24.0 : MORTAR_MAX_RANGE;

            if (config.firesMortar && dist >= mortarMinRange && dist <= mortarMaxRange && zombie.mortarCooldown <= 0) {
              const playerSheltered = isInsideCoveredBuilding(closestPlayer.x, closestPlayer.z, closestPlayer.y);
              const sameLevelMortar = Math.abs(closestPlayer.y - zombie.y) < 6.0;
              // O Chefe bombardeia o prédio mesmo se o jogador estiver abrigado no interior ou telhado!
              if (sameLevelMortar && (!playerSheltered || isBoss)) {
                zombie.mortarCooldown = (isBoss ? 4.5 : MORTAR_COOLDOWN) + Math.random() * 0.8;
                zombie.attacking = true;
                zombie.attackCooldown = 0.75;
                const mortarAngle = Math.atan2(dx, dz);
                zombie.rotation = mortarAngle;
                this.spawnMortarLob(state, zombie, closestPlayer);
              }
            }

            // Ataque corpo a corpo ao alcançar o sobrevivente
            const reach = config.attackRange ?? (PLAYER_RADIUS + config.radius + 0.15);
            const sameLevel = Math.abs(closestPlayer.y - zombie.y) < 1.35;
            if (sameLevel && dist <= reach && zombie.attackCooldown <= 0 && closestPlayer.hp > 0) {
              if (config.explodes) {
                zombie.exploded = true;
                zombie.state = "dead";
                zombie.hp = 0;
                zombie.corpseTimer = 0.8;
                livingPlayers.forEach((p) => {
                  const pdx = p.x - zombie.x;
                  const pdz = p.z - zombie.z;
                  const pdist = Math.hypot(pdx, pdz);
                  if (pdist <= reach + 0.5 && Math.abs(p.y - zombie.y) < 1.4) {
                    this.applyDamage(p, 3);
                  }
                });
              } else {
                zombie.attacking = true;
                zombie.attackCooldown = ZOMBIE_ATTACK_COOLDOWN;
                this.applyDamage(closestPlayer, config.damage || 1);
                if (zombie.type === "sack_boss") {
                  this.disarmPlayerFirearm(state, closestPlayer);
                }
              }
            }
          }
        }
      } else if (!zombie.isAggro) {
        // ─── 3.3) Modo: PATRULHA AUTÔNOMA ("Movimento aleatório mas definido") ──
        if (zombie.patrolState === "idle") {
          zombie.idleTimer -= dt;
          if (zombie.idleTimer <= 0) {
            this.pickPatrolWaypoint(zombie);
          }
        } else {
          zombie.patrolTimer -= dt;
          const toWpX = zombie.patrolTargetX - zombie.x;
          const toWpZ = zombie.patrolTargetZ - zombie.z;
          const wpDist = Math.hypot(toWpX, toWpZ);

          if (wpDist <= 0.6 || zombie.patrolTimer <= 0) {
            // Chegou ao waypoint ou timeout por obstáculo: pausa para olhar ao redor
            zombie.patrolState = "idle";
            zombie.idleTimer = 1.6 + Math.random() * 2.4; // Pausa de 1.6s a 4.0s
          } else {
            const dirX = toWpX / wpDist;
            const dirZ = toWpZ / wpDist;
            zombie.rotation = Math.atan2(dirX, dirZ);

            // Caminhada calma de patrulha
            const wanderSpeed = zombie.type === "boss" ? config.speed * 0.6 : config.speed * 0.45;
            const pos = { x: zombie.x, y: zombie.y, z: zombie.z };
            stepMovement(pos, dirX, dirZ, wanderSpeed, dt, config.radius, doorColliders);
            if (zombie.type === "boss") {
              pos.x = Math.min(12.5, Math.max(MAP_MIN_X + 2.5, pos.x));
            }
            zombie.x = pos.x;
            zombie.y = pos.y ?? 0;
            zombie.z = pos.z;
          }
        }
      }
    });

    // 4) Física de não-sobreposição:
    // Zumbi x Zumbi: zumbis não se sobrepõem entre si
    // Zumbi x Jogador: zumbis não sobrepõem o jogador
    const aliveZombies = Array.from(state.zombies.values()).filter((z) => z.state === "alive");

    for (let iter = 0; iter < 2; iter++) {
      // 4.1) Zumbi x Zumbi
      for (let i = 0; i < aliveZombies.length; i++) {
        const za = aliveZombies[i]!;
        const ca = ENEMY_CONFIGS[za.type as EnemyTypeId] ?? ENEMY_CONFIGS.standard;
        for (let j = i + 1; j < aliveZombies.length; j++) {
          const zb = aliveZombies[j]!;
          const cb = ENEMY_CONFIGS[zb.type as EnemyTypeId] ?? ENEMY_CONFIGS.standard;
          if (Math.abs(za.y - zb.y) > 1.2) continue;
          separateCircles(za, ca.radius, zb, cb.radius);
        }
      }

      // 4.2) Zumbi x Jogador (apenas se estiverem no mesmo plano de altura)
      for (const zombie of aliveZombies) {
        const cz = ENEMY_CONFIGS[zombie.type as EnemyTypeId] ?? ENEMY_CONFIGS.standard;
        for (const player of livingPlayers) {
          if (Math.abs(player.y - zombie.y) > 1.2) continue;
          separateCircles(player, PLAYER_RADIUS, zombie, cz.radius);
        }
      }

      // 4.3) Resolução de colisões estáticas com obstáculos da arena e elevação do terreno
      for (const zombie of aliveZombies) {
        const cz = ENEMY_CONFIGS[zombie.type as EnemyTypeId] ?? ENEMY_CONFIGS.standard;
        resolveStatic(zombie, cz.radius, doorColliders);
        if (zombie.type === "boss") {
          zombie.x = Math.min(12.5, Math.max(MAP_MIN_X + 2.5, zombie.x));
          zombie.z = Math.min(MAP_MAX_Z - 2.5, Math.max(MAP_MIN_Z + 2.5, zombie.z));
        }
        zombie.y = calculateElevation(zombie.x, zombie.z, zombie.y);
      }
      for (const player of livingPlayers) {
        resolveStatic(player, PLAYER_RADIUS, doorColliders);
        player.y = calculateElevation(player.x, player.z, player.y);
      }
    }

    // 5) Remove corpos cujo tempo de decaimento se esgotou
    for (const id of corpsesToRemove) {
      state.zombies.delete(id);
    }

    // 6) Atualiza tiros de morteiro de gosma disparados pelo Zumbi Morteiro
    this.updateMortarLobs(state, livingPlayers, dt);

    // 7) Atualiza poças de gosma ácida no chão e dano por segundo nos sobreviventes
    this.updateSlimePuddles(state, livingPlayers, dt);

    // 8) Atualiza projéteis de cuspe de gosma disparados pelo Zumbi Rastejador
    this.updateSpitProjectiles(state, livingPlayers, dt);
  }

  /**
   * Spawna uma densa população inicial de zumbis patrulhando estrategicamente distribuídos pelas zonas do mapa.
   * Quantidade consideravelmente aumentada (65 zumbis) para que a floresta transmita ameaça imediata antes das hordas oficiais.
   */
  private spawnInitialPopulation(state: ArenaState): void {
    const initialPlacements: { type: EnemyTypeId; x: number; z: number }[] = [
      // ─── Zona 1: Bosque Ocidental & Arredores da Cabana / Fogueira (10 zumbis) ───
      { type: "standard", x: -19.0, z: 16.0 },
      { type: "standard", x: -15.5, z: 22.0 },
      { type: "standard", x: -10.0, z: 15.0 },
      { type: "standard", x: -13.0, z: 9.5 },
      { type: "standard", x: -19.0, z: -16.0 },
      { type: "standard", x: -16.0, z: -22.0 },
      { type: "standard", x: -10.5, z: -15.5 },
      { type: "standard", x: -13.5, z: -9.0 },
      { type: "standard", x: -9.5, z: -3.5 },
      { type: "standard", x: -8.0, z: 4.5 },

      // ─── Zona 2: Trilha Central & Entorno do Posto Comercial da Loja (12 zumbis) ──
      { type: "standard", x: -4.5, z: 14.0 },
      { type: "standard", x: 1.5, z: 18.5 },
      { type: "standard", x: 6.0, z: 11.0 },
      { type: "standard", x: 10.5, z: 20.0 },
      { type: "standard", x: -5.0, z: -13.0 },
      { type: "standard", x: 0.5, z: -19.0 },
      { type: "standard", x: 5.5, z: -12.5 },
      { type: "standard", x: 9.0, z: -22.0 },
      { type: "standard", x: -2.0, z: -4.5 },
      { type: "standard", x: 4.0, z: 5.5 },
      { type: "standard", x: 8.5, z: -3.0 },
      { type: "standard", x: 11.0, z: 3.5 },

      // ─── Zona 3: Casa Abandonada Central, Quintal e Ruínas (14 zumbis) ───────────
      { type: "standard", x: 16.0, z: 14.5 },
      { type: "standard", x: 22.5, z: 22.0 },
      { type: "standard", x: 28.0, z: 12.0 },
      { type: "standard", x: 34.0, z: 18.0 },
      { type: "standard", x: 15.0, z: -8.5 },
      { type: "standard", x: 18.5, z: 7.0 },
      { type: "standard", x: 21.0, z: -10.5 },
      { type: "standard", x: 25.5, z: 10.5 },
      { type: "standard", x: 36.5, z: -5.5 },
      { type: "standard", x: 36.0, z: 5.0 },
      { type: "standard", x: 16.5, z: -20.0 },
      { type: "standard", x: 24.0, z: -15.5 },
      { type: "standard", x: 30.0, z: -22.5 },
      { type: "standard", x: 36.5, z: -13.0 },

      // ─── Zona 4: Ferro Velho, Carcaças de Carros & Trilha Leste (14 zumbis) ───────
      { type: "standard", x: 44.0, z: 16.0 },
      { type: "standard", x: 52.0, z: 22.0 },
      { type: "standard", x: 60.0, z: 14.5 },
      { type: "standard", x: 68.0, z: 20.0 },
      { type: "standard", x: 45.0, z: -4.0 },
      { type: "standard", x: 49.0, z: 5.0 },
      { type: "standard", x: 54.0, z: -8.0 },
      { type: "standard", x: 58.0, z: 3.0 },
      { type: "standard", x: 63.0, z: -5.0 },
      { type: "standard", x: 69.0, z: 4.0 },
      { type: "standard", x: 46.0, z: -18.5 },
      { type: "standard", x: 55.0, z: -22.0 },
      { type: "standard", x: 64.0, z: -16.0 },
      { type: "standard", x: 72.0, z: -11.0 },

      // ─── Zona 5: Checkpoint Militar de Quarentena & Borda Oriental (15 zumbis) ────
      { type: "standard", x: 80.0, z: -4.5 },
      { type: "standard", x: 84.0, z: 6.5 },
      { type: "standard", x: 88.0, z: -2.0 },
      { type: "standard", x: 92.0, z: 5.0 },
      { type: "standard", x: 97.0, z: -5.0 },
      { type: "standard", x: 102.0, z: 3.0 },
      { type: "standard", x: 107.0, z: -4.0 },
      { type: "standard", x: 82.0, z: 18.0 },
      { type: "standard", x: 90.0, z: 22.5 },
      { type: "standard", x: 100.0, z: 16.0 },
      { type: "standard", x: 108.0, z: 21.0 },
      { type: "standard", x: 81.0, z: -19.0 },
      { type: "standard", x: 89.0, z: -23.0 },
      { type: "standard", x: 98.0, z: -17.0 },
      { type: "standard", x: 106.0, z: -22.0 },
    ];

    for (const p of initialPlacements) {
      const zombie = this.spawnEnemy(state, p.type, p.x, p.z);
      zombie.isHunter = false;
      zombie.isAggro = false;
      zombie.aiMode = "wandering";
      zombie.anchorX = p.x;
      zombie.anchorZ = p.z;

      // Varia o estado inicial para que não andem todos de forma sincronizada
      zombie.patrolState = Math.random() < 0.5 ? "walking" : "idle";
      zombie.idleTimer = Math.random() * 2.0;
      this.pickPatrolWaypoint(zombie);
    }
  }

  /**
   * Dispara uma horda oficial controlada com múltiplas levas espaçadas e dinâmicas:
   * - Leva 1: Disparo imediato com zumbis cercando por 360°.
   * - Leva 2: Reforços 15 segundos depois para manter a fluidez do combate.
   */
  private triggerHorde(state: ArenaState, hordeNumber: number): void {
    console.log(`[WaveSystem] ⚠️ HORDA ${hordeNumber} DISPARADA! (tempo de jogo: ${state.gameTime.toFixed(1)}s)`);

    if (hordeNumber === 1) {
      // 1ª Horda Oficial (15s): 5 levas intensas até +48s
      // Leva 1 imediata (+0s): 5 zumbis
      this.spawnHordeWave(state, ["standard", "standard", "standard", "standard", "runner"]);

      // Leva 2 (+12s): 5 zumbis
      this.pendingWaves.push({
        triggerGameTime: state.gameTime + 12.0,
        hordeNumber: 1,
        enemies: ["standard", "standard", "runner", "standard", "runner"],
        isReinforcement: true,
        alertText: "HORDA 1: REFORÇOS!",
      });

      // Leva 3 (+24s): 6 zumbis
      this.pendingWaves.push({
        triggerGameTime: state.gameTime + 24.0,
        hordeNumber: 1,
        enemies: ["standard", "runner", "spitter", "standard", "standard", "runner"],
        isReinforcement: true,
      });

      // Leva 4 (+36s): 6 zumbis
      this.pendingWaves.push({
        triggerGameTime: state.gameTime + 36.0,
        hordeNumber: 1,
        enemies: ["standard", "runner", "runner", "standard", "standard", "spitter"],
        isReinforcement: true,
      });

      // Leva 5 - Clímax (+48s): 6 zumbis
      this.pendingWaves.push({
        triggerGameTime: state.gameTime + 48.0,
        hordeNumber: 1,
        enemies: ["runner", "runner", "spitter", "standard", "standard", "standard"],
        isReinforcement: true,
        alertText: "HORDA 1: ONDA FINAL!",
      });
    } else if (hordeNumber === 2) {
      // 2ª Horda Oficial (85s): 5 levas intensas até +48s
      // Leva 1 imediata (+0s): 7 zumbis
      this.spawnHordeWave(state, [
        "standard",
        "standard",
        "runner",
        "runner",
        "spitter",
        "standard",
        "standard",
      ]);

      // Leva 2 (+12s): 7 zumbis
      this.pendingWaves.push({
        triggerGameTime: state.gameTime + 12.0,
        hordeNumber: 2,
        enemies: ["standard", "runner", "runner", "spitter", "spitter", "standard", "runner"],
        isReinforcement: true,
        alertText: "HORDA 2: REFORÇOS!",
      });

      // Leva 3 (+24s): 8 zumbis
      this.pendingWaves.push({
        triggerGameTime: state.gameTime + 24.0,
        hordeNumber: 2,
        enemies: ["standard", "runner", "runner", "spitter", "mortar", "standard", "standard", "runner"],
        isReinforcement: true,
      });

      // Leva 4 (+36s): 8 zumbis
      this.pendingWaves.push({
        triggerGameTime: state.gameTime + 36.0,
        hordeNumber: 2,
        enemies: ["standard", "runner", "spitter", "mortar", "tank", "standard", "runner", "runner"],
        isReinforcement: true,
      });

      // Leva 5 - Clímax (+48s): 8 zumbis com brutamontes
      this.pendingWaves.push({
        triggerGameTime: state.gameTime + 48.0,
        hordeNumber: 2,
        enemies: ["tank", "mortar", "spitter", "runner", "runner", "runner", "standard", "standard"],
        isReinforcement: true,
        alertText: "HORDA 2: BRUTAMONTES DETECTADO!",
      });
    } else if (hordeNumber === 3) {
      // 3ª Horda Oficial (155s): 5 levas intensas até +48s
      // Leva 1 imediata (+0s): 8 zumbis
      this.spawnHordeWave(state, [
        "standard",
        "standard",
        "runner",
        "runner",
        "spitter",
        "mortar",
        "standard",
        "runner",
      ]);

      // Leva 2 (+12s): 8 zumbis
      this.pendingWaves.push({
        triggerGameTime: state.gameTime + 12.0,
        hordeNumber: 3,
        enemies: ["standard", "runner", "runner", "spitter", "spitter", "mortar", "standard", "tank"],
        isReinforcement: true,
        alertText: "HORDA 3: REFORÇOS!",
      });

      // Leva 3 (+24s): 9 zumbis
      this.pendingWaves.push({
        triggerGameTime: state.gameTime + 24.0,
        hordeNumber: 3,
        enemies: ["tank", "runner", "runner", "spitter", "spitter", "mortar", "mortar", "standard", "standard"],
        isReinforcement: true,
      });

      // Leva 4 (+36s): 9 zumbis
      this.pendingWaves.push({
        triggerGameTime: state.gameTime + 36.0,
        hordeNumber: 3,
        enemies: ["tank", "runner", "runner", "runner", "spitter", "mortar", "standard", "standard", "runner"],
        isReinforcement: true,
      });

      // Leva 5 - Clímax (+48s): 10 zumbis e O Monstro do Pântano desperta após a Horda 3!
      this.pendingWaves.push({
        triggerGameTime: state.gameTime + 48.0,
        hordeNumber: 3,
        enemies: ["boss", "tank", "tank", "mortar", "mortar", "spitter", "spitter", "runner", "runner", "standard"],
        isReinforcement: true,
        alertText: "☠ O MONSTRO DO PÂNTANO DESPERTOU!",
      });
    } else if (hordeNumber === 4) {
      // 4ª Horda Oficial (285s): 5 levas intensas até +48s
      // Leva 1 imediata (+0s): 9 zumbis
      this.spawnHordeWave(state, [
        "tank",
        "runner",
        "runner",
        "spitter",
        "spitter",
        "mortar",
        "standard",
        "standard",
        "runner",
      ]);

      // Leva 2 (+12s): 10 zumbis
      this.pendingWaves.push({
        triggerGameTime: state.gameTime + 12.0,
        hordeNumber: 4,
        enemies: ["runner", "runner", "runner", "spitter", "spitter", "mortar", "mortar", "standard", "standard", "tank"],
        isReinforcement: true,
        alertText: "HORDA 4: REFORÇOS!",
      });

      // Leva 3 (+24s): 10 zumbis
      this.pendingWaves.push({
        triggerGameTime: state.gameTime + 24.0,
        hordeNumber: 4,
        enemies: ["tank", "tank", "runner", "runner", "runner", "spitter", "mortar", "standard", "standard", "runner"],
        isReinforcement: true,
      });

      // Leva 4 (+36s): 11 zumbis
      this.pendingWaves.push({
        triggerGameTime: state.gameTime + 36.0,
        hordeNumber: 4,
        enemies: ["tank", "mortar", "mortar", "spitter", "spitter", "runner", "runner", "runner", "standard", "standard", "tank"],
        isReinforcement: true,
      });

      // Leva 5 - Clímax (+48s): 12 zumbis
      this.pendingWaves.push({
        triggerGameTime: state.gameTime + 48.0,
        hordeNumber: 4,
        enemies: ["tank", "tank", "mortar", "mortar", "spitter", "spitter", "runner", "runner", "runner", "runner", "standard", "standard"],
        isReinforcement: true,
        alertText: "HORDA 4: CLÍMAX SANGRENTO!",
      });
    } else if (hordeNumber === 5) {
      // 5ª Horda Oficial (355s): 5 levas intensas
      // Leva 1 imediata (+0s): 10 zumbis
      this.spawnHordeWave(state, [
        "tank",
        "tank",
        "mortar",
        "mortar",
        "runner",
        "runner",
        "spitter",
        "spitter",
        "standard",
        "standard",
      ]);

      // Leva 2 (+12s): 10 zumbis
      this.pendingWaves.push({
        triggerGameTime: state.gameTime + 12.0,
        hordeNumber: 5,
        enemies: ["tank", "mortar", "mortar", "spitter", "spitter", "runner", "runner", "runner", "runner", "standard"],
        isReinforcement: true,
        alertText: "HORDA 5: REFORÇOS TÓXICOS!",
      });

      // Leva 3 (+24s): 11 zumbis
      this.pendingWaves.push({
        triggerGameTime: state.gameTime + 24.0,
        hordeNumber: 5,
        enemies: ["tank", "tank", "mortar", "mortar", "spitter", "spitter", "runner", "runner", "runner", "standard", "standard"],
        isReinforcement: true,
      });

      // Leva 4 (+36s): 11 zumbis
      this.pendingWaves.push({
        triggerGameTime: state.gameTime + 36.0,
        hordeNumber: 5,
        enemies: ["tank", "tank", "tank", "mortar", "mortar", "spitter", "spitter", "runner", "runner", "runner", "runner"],
        isReinforcement: true,
      });

      // Leva 5 - Clímax (+48s): Leva final de pressão
      this.pendingWaves.push({
        triggerGameTime: state.gameTime + 48.0,
        hordeNumber: 5,
        enemies: ["tank", "tank", "mortar", "mortar", "spitter", "spitter", "runner", "runner", "runner", "runner", "standard", "standard"],
        isReinforcement: true,
        alertText: "HORDA 5: CLÍMAX DO TERROR!",
      });
    } else if (hordeNumber === 6) {
      // 6ª Horda Oficial (425s): 5 levas intensas até +48s
      // Leva 1 imediata (+0s): 11 zumbis
      this.spawnHordeWave(state, [
        "tank",
        "tank",
        "mortar",
        "mortar",
        "spitter",
        "spitter",
        "spider",
        "spider",
        "runner",
        "runner",
        "standard",
      ]);

      // Leva 2 (+12s): 11 zumbis
      this.pendingWaves.push({
        triggerGameTime: state.gameTime + 12.0,
        hordeNumber: 6,
        enemies: ["tank", "tank", "mortar", "spitter", "spitter", "spider", "spider", "runner", "runner", "runner", "standard"],
        isReinforcement: true,
        alertText: "HORDA 6: REFORÇOS ARACNÍDEOS!",
      });

      // Leva 3 (+24s): 12 zumbis
      this.pendingWaves.push({
        triggerGameTime: state.gameTime + 24.0,
        hordeNumber: 6,
        enemies: ["tank", "tank", "mortar", "mortar", "spitter", "spitter", "spider", "spider", "spider", "runner", "runner", "standard"],
        isReinforcement: true,
      });

      // Leva 4 (+36s): 12 zumbis
      this.pendingWaves.push({
        triggerGameTime: state.gameTime + 36.0,
        hordeNumber: 6,
        enemies: ["tank", "tank", "tank", "mortar", "mortar", "spitter", "spider", "spider", "spider", "spider", "runner", "runner"],
        isReinforcement: true,
      });

      // Leva 5 - Clímax (+48s): A Rainha Aracnídea desperta após a Horda 6!
      this.pendingWaves.push({
        triggerGameTime: state.gameTime + 48.0,
        hordeNumber: 6,
        enemies: ["spider_boss", "spider", "spider", "spider", "spider", "tank", "tank", "mortar", "runner", "runner"],
        isReinforcement: true,
        alertText: "🕷️ A RAINHA ARACNÍDEA DESPERTOU!",
      });
    } else if (hordeNumber === 7) {
      // 7ª Horda Oficial (495s): 5 levas intensas até +48s
      // Leva 1 imediata (+0s): 12 zumbis
      this.spawnHordeWave(state, [
        "tank",
        "tank",
        "mortar",
        "mortar",
        "spitter",
        "spitter",
        "spitter",
        "runner",
        "runner",
        "runner",
        "runner",
        "standard",
      ]);

      // Leva 2 (+12s): 12 zumbis
      this.pendingWaves.push({
        triggerGameTime: state.gameTime + 12.0,
        hordeNumber: 7,
        enemies: ["tank", "tank", "mortar", "mortar", "spitter", "spitter", "spitter", "runner", "runner", "runner", "runner", "runner"],
        isReinforcement: true,
        alertText: "HORDA 7: REFORÇOS!",
      });

      // Leva 3 (+24s): 12 zumbis
      this.pendingWaves.push({
        triggerGameTime: state.gameTime + 24.0,
        hordeNumber: 7,
        enemies: ["tank", "tank", "tank", "mortar", "mortar", "spitter", "spitter", "runner", "runner", "runner", "runner", "runner"],
        isReinforcement: true,
      });

      // Leva 4 (+36s): 13 zumbis
      this.pendingWaves.push({
        triggerGameTime: state.gameTime + 36.0,
        hordeNumber: 7,
        enemies: ["tank", "tank", "tank", "mortar", "mortar", "spitter", "spitter", "spitter", "runner", "runner", "runner", "runner", "standard"],
        isReinforcement: true,
      });

      // Leva 5 - Clímax (+48s): 13 zumbis
      this.pendingWaves.push({
        triggerGameTime: state.gameTime + 48.0,
        hordeNumber: 7,
        enemies: ["tank", "tank", "tank", "tank", "mortar", "mortar", "spitter", "spitter", "runner", "runner", "runner", "runner", "runner"],
        isReinforcement: true,
        alertText: "HORDA 7: TEMPESTADE BIOLÓGICA!",
      });
    } else if (hordeNumber === 8) {
      // 8ª Horda Oficial (565s): 5 levas de cerco blindado
      // Leva 1 imediata (+0s): 12 zumbis
      this.spawnHordeWave(state, [
        "tank",
        "tank",
        "mortar",
        "mortar",
        "spitter",
        "spider",
        "spider",
        "spider",
        "spider",
        "runner",
        "runner",
        "standard",
      ]);

      // Leva 2 (+12s): 12 inimigos
      this.pendingWaves.push({
        triggerGameTime: state.gameTime + 12.0,
        hordeNumber: 8,
        enemies: ["tank", "tank", "mortar", "mortar", "spitter", "spitter", "spider", "spider", "spider", "runner", "runner", "runner"],
        isReinforcement: true,
        alertText: "HORDA 8: REFORÇOS BLINDADOS!",
      });

      // Leva 3 (+24s): 13 inimigos
      this.pendingWaves.push({
        triggerGameTime: state.gameTime + 24.0,
        hordeNumber: 8,
        enemies: ["tank", "tank", "tank", "mortar", "mortar", "spitter", "spider", "spider", "spider", "runner", "runner", "runner", "runner"],
        isReinforcement: true,
      });

      // Leva 4 (+36s): 13 inimigos
      this.pendingWaves.push({
        triggerGameTime: state.gameTime + 36.0,
        hordeNumber: 8,
        enemies: ["tank", "tank", "tank", "mortar", "mortar", "spitter", "spider", "spider", "spider", "spider", "runner", "runner", "runner"],
        isReinforcement: true,
      });

      // Leva 5 - Clímax (+48s): 13 inimigos
      this.pendingWaves.push({
        triggerGameTime: state.gameTime + 48.0,
        hordeNumber: 8,
        enemies: ["tank", "tank", "tank", "mortar", "mortar", "spitter", "spitter", "spider", "spider", "runner", "runner", "runner", "standard"],
        isReinforcement: true,
        alertText: "HORDA 8: CLÍMAX DO CERCO!",
      });
    } else if (hordeNumber === 9) {
      // 9ª Horda Oficial (635s): 5 levas intensas até +48s
      // Leva 1 imediata (+0s): 13 zumbis
      this.spawnHordeWave(state, [
        "tank",
        "tank",
        "tank",
        "mortar",
        "mortar",
        "spitter",
        "spitter",
        "wolf",
        "wolf",
        "wolf",
        "runner",
        "runner",
        "standard",
      ]);

      // Leva 2 (+12s): 13 inimigos
      this.pendingWaves.push({
        triggerGameTime: state.gameTime + 12.0,
        hordeNumber: 9,
        enemies: ["tank", "tank", "tank", "mortar", "mortar", "spitter", "spitter", "wolf", "wolf", "wolf", "runner", "runner", "runner"],
        isReinforcement: true,
        alertText: "HORDA 9: MATILHA EM CERCO!",
      });

      // Leva 3 (+24s): 14 inimigos
      this.pendingWaves.push({
        triggerGameTime: state.gameTime + 24.0,
        hordeNumber: 9,
        enemies: ["tank", "tank", "tank", "tank", "mortar", "mortar", "spitter", "spitter", "wolf", "wolf", "wolf", "runner", "runner", "runner"],
        isReinforcement: true,
      });

      // Leva 4 (+36s): 14 inimigos
      this.pendingWaves.push({
        triggerGameTime: state.gameTime + 36.0,
        hordeNumber: 9,
        enemies: ["tank", "tank", "tank", "tank", "mortar", "mortar", "mortar", "spitter", "wolf", "wolf", "wolf", "wolf", "runner", "runner"],
        isReinforcement: true,
      });

      // Leva 5 - Clímax (+48s): O Lobisomem Alfa desperta após a Horda 9!
      this.pendingWaves.push({
        triggerGameTime: state.gameTime + 48.0,
        hordeNumber: 9,
        enemies: ["werewolf_boss", "wolf", "wolf", "wolf", "wolf", "wolf", "tank", "tank", "mortar", "runner"],
        isReinforcement: true,
        alertText: "🌕 O LOBISOMEM ALFA DESPERTOU!",
      });
    } else if (hordeNumber === 10) {
      // 10ª Horda Oficial (705s): 5 levas de fúria lupina
      // Leva 1 imediata (+0s): matilha pesada
      this.spawnHordeWave(state, [
        "tank",
        "tank",
        "mortar",
        "spitter",
        "wolf",
        "wolf",
        "wolf",
        "wolf",
        "runner",
        "runner",
        "standard",
        "standard",
      ]);

      // Leva 2 (+12s): 13 inimigos
      this.pendingWaves.push({
        triggerGameTime: state.gameTime + 12.0,
        hordeNumber: 10,
        enemies: ["tank", "tank", "mortar", "mortar", "spitter", "spitter", "wolf", "wolf", "wolf", "wolf", "runner", "runner", "runner"],
        isReinforcement: true,
        alertText: "HORDA 10: REFORÇOS SELVAGENS!",
      });

      // Leva 3 (+24s): 14 inimigos
      this.pendingWaves.push({
        triggerGameTime: state.gameTime + 24.0,
        hordeNumber: 10,
        enemies: ["tank", "tank", "tank", "mortar", "mortar", "spitter", "wolf", "wolf", "wolf", "wolf", "runner", "runner", "runner", "runner"],
        isReinforcement: true,
      });

      // Leva 4 (+36s): 14 inimigos
      this.pendingWaves.push({
        triggerGameTime: state.gameTime + 36.0,
        hordeNumber: 10,
        enemies: ["tank", "tank", "tank", "mortar", "mortar", "spitter", "wolf", "wolf", "wolf", "wolf", "wolf", "runner", "runner", "runner"],
        isReinforcement: true,
      });

      // Leva 5 - Clímax (+48s): 14 inimigos
      this.pendingWaves.push({
        triggerGameTime: state.gameTime + 48.0,
        hordeNumber: 10,
        enemies: ["wolf", "wolf", "wolf", "wolf", "wolf", "wolf", "tank", "tank", "mortar", "mortar", "spitter", "runner", "runner", "standard"],
        isReinforcement: true,
        alertText: "HORDA 10: CLÍMAX DA MATILHA!",
      });
    } else if (hordeNumber === 11) {
      // 11ª Horda Oficial (775s): 5 levas intensas até +48s
      // Leva 1 imediata (+0s): 14 inimigos
      this.spawnHordeWave(state, [
        "tank",
        "tank",
        "mortar",
        "mortar",
        "spitter",
        "spitter",
        "wolf",
        "wolf",
        "spider",
        "spider",
        "runner",
        "runner",
        "runner",
        "standard",
      ]);

      // Leva 2 (+12s): 14 inimigos
      this.pendingWaves.push({
        triggerGameTime: state.gameTime + 12.0,
        hordeNumber: 11,
        enemies: ["tank", "tank", "mortar", "mortar", "wolf", "wolf", "wolf", "spider", "spider", "spider", "runner", "runner", "runner", "runner"],
        isReinforcement: true,
        alertText: "HORDA 11: REFORÇOS DAS PROFUNDEZAS!",
      });

      // Leva 3 (+24s): 15 inimigos
      this.pendingWaves.push({
        triggerGameTime: state.gameTime + 24.0,
        hordeNumber: 11,
        enemies: ["tank", "tank", "tank", "mortar", "mortar", "wolf", "wolf", "wolf", "spider", "spider", "spider", "runner", "runner", "runner", "runner"],
        isReinforcement: true,
      });

      // Leva 4 (+36s): 15 inimigos
      this.pendingWaves.push({
        triggerGameTime: state.gameTime + 36.0,
        hordeNumber: 11,
        enemies: ["tank", "tank", "tank", "tank", "mortar", "mortar", "wolf", "wolf", "spider", "spider", "spider", "runner", "runner", "runner", "runner"],
        isReinforcement: true,
      });

      // Leva 5 - Clímax (+48s): 15 inimigos
      this.pendingWaves.push({
        triggerGameTime: state.gameTime + 48.0,
        hordeNumber: 11,
        enemies: ["tank", "tank", "tank", "tank", "mortar", "mortar", "wolf", "wolf", "wolf", "spider", "spider", "runner", "runner", "runner", "runner"],
        isReinforcement: true,
        alertText: "HORDA 11: CLÍMAX DAS PROFUNDEZAS!",
      });
    } else if (hordeNumber === 12) {
      // 12ª Horda Oficial (845s): 5 levas intensas até +48s
      // Leva 1 imediata (+0s): 15 inimigos
      this.spawnHordeWave(state, [
        "tank",
        "tank",
        "tank",
        "mortar",
        "mortar",
        "spitter",
        "spitter",
        "wolf",
        "wolf",
        "wolf",
        "spider",
        "spider",
        "runner",
        "runner",
        "runner",
      ]);

      // Leva 2 (+12s): 15 inimigos
      this.pendingWaves.push({
        triggerGameTime: state.gameTime + 12.0,
        hordeNumber: 12,
        enemies: ["tank", "tank", "tank", "mortar", "mortar", "spitter", "spitter", "wolf", "wolf", "wolf", "spider", "spider", "runner", "runner", "runner"],
        isReinforcement: true,
        alertText: "HORDA 12: REFORÇOS DO ECLIPSE!",
      });

      // Leva 3 (+24s): 15 inimigos
      this.pendingWaves.push({
        triggerGameTime: state.gameTime + 24.0,
        hordeNumber: 12,
        enemies: ["tank", "tank", "tank", "tank", "mortar", "mortar", "wolf", "wolf", "wolf", "spider", "spider", "runner", "runner", "runner", "runner"],
        isReinforcement: true,
      });

      // Leva 4 (+36s): 16 inimigos
      this.pendingWaves.push({
        triggerGameTime: state.gameTime + 36.0,
        hordeNumber: 12,
        enemies: ["tank", "tank", "tank", "tank", "mortar", "mortar", "spitter", "wolf", "wolf", "wolf", "spider", "spider", "runner", "runner", "runner", "runner"],
        isReinforcement: true,
      });

      // Leva 5 - Clímax (+48s): O Homem do Saco chega após a Horda 12!
      this.pendingWaves.push({
        triggerGameTime: state.gameTime + 48.0,
        hordeNumber: 12,
        enemies: ["sack_boss", "tank", "tank", "tank", "mortar", "mortar", "wolf", "wolf", "spider", "spider", "runner", "runner"],
        isReinforcement: true,
        alertText: "☠ O HOMEM DO SACO CHEGOU!",
      });
    } else if (hordeNumber === 13) {
      // 13ª Horda Oficial (915s): O Cataclisma Supremo
      // Leva 1 imediata (+0s): guarda de elite
      this.spawnHordeWave(state, [
        "tank",
        "tank",
        "tank",
        "mortar",
        "mortar",
        "spitter",
        "spitter",
        "wolf",
        "wolf",
        "spider",
        "spider",
        "runner",
        "runner",
        "standard",
      ]);

      // Leva 2 (+12s): 16 inimigos
      this.pendingWaves.push({
        triggerGameTime: state.gameTime + 12.0,
        hordeNumber: 13,
        enemies: ["tank", "tank", "tank", "tank", "mortar", "mortar", "spitter", "spitter", "wolf", "wolf", "wolf", "spider", "spider", "runner", "runner", "runner"],
        isReinforcement: true,
        alertText: "HORDA 13: O HORROR SE APROXIMA!",
      });

      // Leva 3 (+24s): 16 inimigos
      this.pendingWaves.push({
        triggerGameTime: state.gameTime + 24.0,
        hordeNumber: 13,
        enemies: ["tank", "tank", "tank", "tank", "mortar", "mortar", "mortar", "spitter", "wolf", "wolf", "spider", "spider", "runner", "runner", "runner", "runner"],
        isReinforcement: true,
      });

      // Leva 4 (+36s): 16 inimigos
      this.pendingWaves.push({
        triggerGameTime: state.gameTime + 36.0,
        hordeNumber: 13,
        enemies: ["tank", "tank", "tank", "tank", "mortar", "mortar", "mortar", "spitter", "wolf", "wolf", "wolf", "spider", "spider", "runner", "runner", "runner"],
        isReinforcement: true,
      });

      // Leva 5 - Fim e Clímax Supremo (+48s)
      this.pendingWaves.push({
        triggerGameTime: state.gameTime + 48.0,
        hordeNumber: 13,
        enemies: ["tank", "tank", "tank", "tank", "mortar", "mortar", "wolf", "wolf", "spider", "spider", "runner", "runner"],
        isReinforcement: true,
        alertText: "☠ CLÍMAX FINAL: O CATACLISMA SUPREMO!",
      });
    }
  }

  /**
   * Divide uma lista de inimigos de uma horda em lotes escalonados com calma:
   * - Lote 1: Primeiros inimigos (vanguarda/batedores) nascem imediatamente (+0s).
   * - Lote 2: Próximos inimigos nascem após 2.5 a 3 segundos.
   * - Lote 3: Próximos inimigos nascem após 5.5 a 6 segundos.
   * - Lotes 4 e 5: nascem a cada 3 a 3.5 segundos adicionais (+9.0s, +12.0s...).
   *
   * Os inimigos são ordenados pelo nível de ameaça crescente (comuns -> rápidos -> cuspidor -> morteiro -> brutamontes)
   * para criar uma escalada dramática natural e permitir reação tática aos sobreviventes.
   */
  private splitIntoStaggeredBatches(enemies: EnemyTypeId[]): { delay: number; enemies: EnemyTypeId[] }[] {
    if (enemies.length === 0) return [];

    const isBossType = (type: EnemyTypeId) =>
      type === "boss" || type === "spider_boss" || type === "werewolf_boss" || type === "sack_boss";

    const bosses = enemies.filter(isBossType);
    const nonBosses = enemies.filter((e) => !isBossType(e));

    // Se houver apenas chefes na lista, nascem imediatamente (+0s)
    if (nonBosses.length === 0) {
      return [{ delay: 0.0, enemies: bosses }];
    }

    const THREAT_ORDER: Record<EnemyTypeId, number> = {
      spider: 1,
      standard: 2,
      wolf: 3,
      runner: 4,
      spitter: 5,
      mortar: 6,
      tank: 7,
      boss: 8,
      spider_boss: 9,
      werewolf_boss: 10,
      sack_boss: 10,
    };
    const sorted = [...nonBosses].sort((a, b) => (THREAT_ORDER[a] ?? 1) - (THREAT_ORDER[b] ?? 1));

    const total = sorted.length;
    let delays: number[];
    let batchCount: number;

    if (total <= 4) {
      batchCount = 2;
      delays = [0.0, 3.0];
    } else if (total <= 8) {
      batchCount = 3;
      delays = [0.0, 3.0, 6.0];
    } else if (total <= 13) {
      batchCount = 4;
      delays = [0.0, 2.5, 5.5, 9.0];
    } else {
      batchCount = 5;
      delays = [0.0, 2.5, 5.5, 9.0, 12.0];
    }

    const batches: { delay: number; enemies: EnemyTypeId[] }[] = [];
    const baseSize = Math.floor(total / batchCount);
    const remainder = total % batchCount;
    let cursor = 0;

    for (let b = 0; b < batchCount; b++) {
      // Distribui o resto nos lotes finais para que os especiais e brutamontes venham no clímax
      const size = baseSize + (b >= batchCount - remainder ? 1 : 0);
      if (size <= 0) continue;
      const batchEnemies = sorted.slice(cursor, cursor + size);
      cursor += size;
      batches.push({
        delay: delays[b] ?? (delays[delays.length - 1]! + (b - delays.length + 1) * 3.0),
        enemies: batchEnemies,
      });
    }

    // Chefes sempre entram no primeiro lote imediato (+0s) para surgirem no exato momento do alerta
    if (bosses.length > 0) {
      if (batches.length > 0) {
        batches[0]!.enemies.unshift(...bosses);
      } else {
        batches.push({ delay: 0.0, enemies: bosses });
      }
    }

    return batches;
  }

  /**
   * Spawna uma leva de horda distribuída em lotes escalonados com calma (+0s, +2s, +5s...),
   * com cada lote surgindo a uma distância segura da câmera fora do campo de visão.
   */
  spawnHordeWave(state: ArenaState, enemies: EnemyTypeId[]): void {
    if (enemies.length === 0) return;

    const baseAngle = Math.random() * Math.PI * 2;
    const batches = this.splitIntoStaggeredBatches(enemies);

    batches.forEach((batch, idx) => {
      // Cada lote surge de uma direção angular variada para cercar gradualmente os sobreviventes
      const batchAngle = baseAngle + (idx / Math.max(1, batches.length)) * Math.PI * 1.5;
      if (batch.delay <= 0.05) {
        // Primeiro lote: spawna imediatamente (+0s)
        this.executeSpawnBatch(state, batch.enemies, batchAngle);
      } else {
        // Lotes subsequentes: escalonados (+2s, +5s, +8s, +11s...)
        this.pendingBatches.push({
          triggerGameTime: state.gameTime + batch.delay,
          enemies: batch.enemies,
          baseAngle: batchAngle,
        });
      }
    });
  }

  /**
   * Executa fisicamente o spawn de um lote de inimigos em posições fora da tela.
   */
  private executeSpawnBatch(state: ArenaState, enemies: EnemyTypeId[], baseAngle: number): void {
    const count = enemies.length;
    enemies.forEach((type, i) => {
      let pt: { x: number; z: number };
      if (type === "boss" || type === "spider_boss" || type === "werewolf_boss" || type === "sack_boss") {
        pt = this.findBossOffscreenPoint(state);
      } else {
        // Distribui os ângulos ao longo de 360° com leve jitter para garantir cerco variado
        const preferredAngle = baseAngle + (i / Math.max(1, count)) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
        pt = this.findOffscreenPoint(state, preferredAngle);
      }
      const zombie = this.spawnEnemy(state, type, pt.x, pt.z);
      const isBoss = type === "boss" || type === "spider_boss" || type === "werewolf_boss" || type === "sack_boss";
      // Chefes sempre caçam; 50% dos zumbis comuns da horda podem esquecer o jogador se ele fugir para longe
      zombie.isHunter = isBoss || Math.random() < 0.5;
      zombie.huntGraceTimer = zombie.isHunter ? 0 : WaveSystem.HORDE_HUNT_GRACE_SECONDS;
      zombie.isAggro = true;
      zombie.aiMode = "chasing";
    });
  }

  /**
   * Escolhe um ponto aleatório mas definido dentro do raio da zona de patrulha do zumbi.
   */
  private pickPatrolWaypoint(zombie: ZombieSchema): void {
    const angle = Math.random() * Math.PI * 2;
    const dist = 3.5 + Math.random() * 5.0;
    let targetX = zombie.anchorX + Math.cos(angle) * dist;
    let targetZ = zombie.anchorZ + Math.sin(angle) * dist;

    // Garante que o waypoint fique dentro dos limites caminháveis da arena (Chefe sempre à esquerda da casa)
    if (zombie.type === "boss" || zombie.type === "spider_boss" || zombie.type === "werewolf_boss" || zombie.type === "sack_boss") {
      targetX = Math.max(MAP_MIN_X + 3.0, Math.min(10.5, targetX));
    } else {
      targetX = Math.max(MAP_MIN_X + 2.5, Math.min(MAP_MAX_X - 2.5, targetX));
    }
    targetZ = Math.max(MAP_MIN_Z + 2.5, Math.min(MAP_MAX_Z - 2.5, targetZ));

    const pt = { x: targetX, y: 0, z: targetZ };
    resolveStatic(pt, 0.5);

    zombie.patrolTargetX = pt.x;
    zombie.patrolTargetZ = pt.z;
    zombie.patrolState = "walking";
    zombie.patrolTimer = 5.0 + Math.random() * 3.5; // Tempo limite para tentar chegar ao ponto
  }

  /**
   * Spawna um inimigo em uma posição fora da tela dos jogadores vivos.
   */
  spawnOffscreenZombie(state: ArenaState, type: EnemyTypeId, isHunter = false): ZombieSchema {
    const pt = this.findOffscreenPoint(state);
    const zombie = this.spawnEnemy(state, type, pt.x, pt.z);
    zombie.isHunter = isHunter;

    if (isHunter) {
      // Minoria: caçador direto com aggro imediato
      zombie.isAggro = true;
      zombie.aiMode = "chasing";
    } else {
      // Maioria: entra patrulhando e só persegue por proximidade
      zombie.isAggro = false;
      zombie.aiMode = "wandering";

      // O ponto âncora é direcionado para 9 metros adentro do mapa em direção ao centro de ação
      const enterAngle = Math.atan2(0 - pt.z, 20 - pt.x);
      zombie.anchorX = Math.max(MAP_MIN_X + 4.0, Math.min(MAP_MAX_X - 4.0, pt.x + Math.cos(enterAngle) * 9.0));
      zombie.anchorZ = Math.max(MAP_MIN_Z + 4.0, Math.min(MAP_MAX_Z - 4.0, pt.z + Math.sin(enterAngle) * 9.0));
      this.pickPatrolWaypoint(zombie);
    }

    return zombie;
  }

  /**
   * Encontra um ponto fora da tela dos jogadores vivos.
   * Suporta ângulo preferencial para cercar o sobrevivente a partir de múltiplas direções (N, S, L, O).
   * Possui fallback inteligente distribuído pelas 4 bordas para nunca agrupar no mesmo local.
   */
  findOffscreenPoint(state: ArenaState, preferredAngle?: number): { x: number; z: number } {
    const livingPlayers: { x: number; z: number }[] = [];
    state.players.forEach((p) => {
      if (p.hp > 0 && p.inWorld) livingPlayers.push({ x: p.x, z: p.z });
    });

    const minX = MAP_MIN_X + 2.5;
    const maxX = MAP_MAX_X - 2.5;
    const minZ = MAP_MIN_Z + 2.5;
    const maxZ = MAP_MAX_Z - 2.5;
    const minD = WaveSystem.MIN_OFFSCREEN_DIST;
    const minDSq = minD * minD;

    if (livingPlayers.length > 0) {
      const avgPlayer = {
        x: livingPlayers.reduce((sum, p) => sum + p.x, 0) / livingPlayers.length,
        z: livingPlayers.reduce((sum, p) => sum + p.z, 0) / livingPlayers.length,
      };

      // Tenta 48 candidatos respeitando o ângulo preferencial e a distância mínima da câmera (>= 22m)
      for (let attempt = 0; attempt < 48; attempt++) {
        let x = 0;
        let z = 0;

        const angle =
          preferredAngle !== undefined && attempt < 16
            ? preferredAngle + (Math.random() - 0.5) * 0.45
            : Math.random() * Math.PI * 2;

        if (attempt < 28) {
          // Raio ao redor dos jogadores (entre 22m e 30m)
          const r = minD + Math.random() * 8.0;
          let testX = avgPlayer.x + Math.cos(angle) * r;
          let testZ = avgPlayer.z + Math.sin(angle) * r;

          // Se passar dos limites de Z (-15.5 a 15.5), ajusta no eixo X para manter a distância >= minD
          if (testZ > maxZ || testZ < minZ) {
            const clampedZ = testZ > maxZ ? maxZ : minZ;
            const dz = clampedZ - avgPlayer.z;
            const remainingD2 = minDSq - dz * dz;
            if (remainingD2 > 0) {
              const neededDx = Math.sqrt(remainingD2) + 1.5;
              const signX = Math.cos(angle) >= 0 ? 1 : -1;
              let targetX = avgPlayer.x + signX * neededDx;
              if (targetX > maxX) targetX = avgPlayer.x - neededDx;
              else if (targetX < minX) targetX = avgPlayer.x + neededDx;
              testX = targetX;
            }
            testZ = clampedZ;
          }

          x = Math.max(minX, Math.min(maxX, testX));
          z = Math.max(minZ, Math.min(maxZ, testZ));
        } else {
          // Borda externa do mapa (distribuída pelas 4 faces: Sul, Leste, Norte, Oeste)
          const side = Math.floor(Math.random() * 4);
          if (side === 0) {
            x = minX + Math.random() * (maxX - minX);
            z = minZ;
          } else if (side === 1) {
            x = maxX;
            z = minZ + Math.random() * (maxZ - minZ);
          } else if (side === 2) {
            x = minX + Math.random() * (maxX - minX);
            z = maxZ;
          } else {
            x = minX;
            z = minZ + Math.random() * (maxZ - minZ);
          }
        }

        const candidate = { x, y: 0, z };
        resolveStatic(candidate, 0.6);
        x = Math.max(minX, Math.min(maxX, candidate.x));
        z = Math.max(minZ, Math.min(maxZ, candidate.z));

        // Descarta qualquer ponto dentro da fundação/térreo da casa central (X: 19.2 a 34.5, Z: -7.2 a 7.2)
        if (x >= 19.2 && x <= 34.5 && z >= -7.2 && z <= 7.2) {
          continue;
        }

        // Verifica se está fora da visão de TODOS os jogadores vivos
        const isFarFromAll = livingPlayers.every((p) => {
          const dx = p.x - x;
          const dz = p.z - z;
          return dx * dx + dz * dz >= minDSq;
        });

        if (isFarFromAll) {
          return { x, z };
        }
      }
    }

    // Fallback inteligente: avalia 16 pontos pelas 4 bordas do mapa e escolhe o mais distante dos jogadores
    let bestPoint = { x: maxX, z: maxZ };
    let bestDistSq = 0;

    for (let f = 0; f < 16; f++) {
      const side = f % 4;
      let fx = 0;
      let fz = 0;
      if (side === 0) {
        fx = minX + Math.random() * (maxX - minX);
        fz = minZ;
      } else if (side === 1) {
        fx = maxX;
        fz = minZ + Math.random() * (maxZ - minZ);
      } else if (side === 2) {
        fx = minX + Math.random() * (maxX - minX);
        fz = maxZ;
      } else {
        fx = minX;
        fz = minZ + Math.random() * (maxZ - minZ);
      }

      let minPlayerDistSq = Infinity;
      for (const p of livingPlayers) {
        const dSq = (p.x - fx) ** 2 + (p.z - fz) ** 2;
        if (dSq < minPlayerDistSq) minPlayerDistSq = dSq;
      }

      if (minPlayerDistSq > bestDistSq || livingPlayers.length === 0) {
        bestDistSq = minPlayerDistSq;
        bestPoint = { x: fx, z: fz };
      }
    }

    return bestPoint;
  }

  /**
   * Encontra um ponto fora da tela dos jogadores estritamente no flanco esquerdo da casa (X <= 9.0).
   * O Chefe colossal surge dos confins da floresta ou extremidades oeste/norte/sul e marcha para a clareira.
   */
  findBossOffscreenPoint(state: ArenaState): { x: number; z: number } {
    const livingPlayers: { x: number; z: number }[] = [];
    state.players.forEach((p) => {
      if (p.hp > 0 && p.inWorld) livingPlayers.push({ x: p.x, z: p.z });
    });

    const minX = -18.0; // Desobstruído: nunca atrás da cabana (cabana é X: -27.4 a -21.6, Z: -3.1 a 3.1)
    const maxX = 9.0;   // Limite leste seguro antes da casa abandonada
    const minZ = MAP_MIN_Z + 2.5; // -15.5
    const maxZ = MAP_MAX_Z - 2.5; // 15.5

    // Flancos estratégicos da clareira com caminhos 100% livres e sem obstáculos:
    const fixedFlanks: { x: number; z: number }[] = [
      { x: -18.0, z: 12.0 },  // Bosque noroeste (acima da cabana)
      { x: -18.0, z: -12.0 }, // Bosque sudoeste (abaixo da cabana)
      { x: -10.0, z: 14.5 },  // Clareira norte
      { x: -10.0, z: -14.5 }, // Clareira sul
      { x: -2.0, z: 14.5 },   // Borda norte da arena central
      { x: -2.0, z: -14.5 },  // Borda sul da arena central
      { x: 5.0, z: 14.5 },    // Borda nordeste
      { x: 5.0, z: -14.5 },   // Borda sudeste
      { x: 8.5, z: 0 },       // Entrada da trilha a leste
    ];

    const candidates = [...fixedFlanks].sort(() => Math.random() - 0.5);

    // Candidatos aleatórios adicionais distribuídos nas bordas norte e sul da clareira
    for (let k = 0; k < 20; k++) {
      candidates.push({
        x: -18.0 + Math.random() * (maxX - (-18.0)),
        z: Math.random() < 0.5 ? minZ + Math.random() * 2.0 : maxZ - Math.random() * 2.0,
      });
    }

    // Busca o candidato com distância segura fora da tela dos jogadores (>= 12m a 22m)
    for (const distThreshold of [22.0, 19.5, 16.5, 12.0]) {
      for (const cand of candidates) {
        const isSafe =
          livingPlayers.length === 0 ||
          livingPlayers.every((p) => {
            const dx = p.x - cand.x;
            const dz = p.z - cand.z;
            return dx * dx + dz * dz >= distThreshold * distThreshold;
          });

        if (isSafe) {
          const pt = { x: cand.x, y: 0, z: cand.z };
          resolveStatic(pt, 1.65);
          pt.x = Math.max(minX, Math.min(maxX, pt.x));
          pt.z = Math.max(minZ, Math.min(maxZ, pt.z));
          return pt;
        }
      }
    }

    const fallback = { x: -2.0, y: 0, z: 14.5 };
    resolveStatic(fallback, 1.65);
    return fallback;
  }

  /**
   * Método reutilizável para criar qualquer tipo de inimigo com base nas configurações compartilhadas.
   */
  spawnEnemy(state: ArenaState, type: EnemyTypeId, x: number, z: number): ZombieSchema {
    const config = ENEMY_CONFIGS[type] ?? ENEMY_CONFIGS.standard;
    const zombie = new ZombieSchema();
    zombie.id = `z_${++this.zombieIdCounter}`;
    zombie.type = type;
    zombie.hp = config.maxHp;
    zombie.maxHp = config.maxHp;
    zombie.state = "alive";

    const pos = { x, y: 0, z };
    resolveStatic(pos, config.radius);
    zombie.x = pos.x;
    zombie.y = calculateElevation(pos.x, pos.z, 0);
    zombie.z = pos.z;
    zombie.rotation = 0;
    zombie.lastSlimeX = pos.x;
    zombie.lastSlimeZ = pos.z;
    zombie.mortarCooldown = 2.5 + Math.random() * 1.5;
    zombie.spitCooldown = 2.0 + Math.random() * 1.5;
    zombie.attackCooldown = 0.6 + Math.random() * 0.4;

    if (type === "boss") {
      zombie.summonCooldown = 5.0; // Primeiro summon após 5s de combate
      zombie.mortarCooldown = 1.5;
    }

    state.zombies.set(zombie.id, zombie);
    return zombie;
  }

  /**
   * Aplica dano ao jogador considerando absorção do colete balístico / armadura.
   */
  applyDamage(target: PlayerSchema, rawDamage: number): void {
    if (target.isGodMode) {
      target.hp = PLAYER_MAX_HP;
      return;
    }
    let dmg = rawDamage;
    if (target.armor > 0) {
      const absorb = Math.min(target.armor, dmg);
      target.armor -= absorb;
      dmg -= absorb;
    }
    if (dmg > 0) {
      target.hp = Math.max(0, target.hp - dmg);
    }
  }

  /**
   * Mecânica exclusiva do Homem do Saco: derruba a arma de fogo do jogador no chão.
   * A arma cai no chão como coletável tático e o jogador fica desarmado ou com a faca!
   */
  disarmPlayerFirearm(state: ArenaState, player: PlayerSchema): void {
    let gunSlot = -1;
    if (player.slot1 === "pistol") gunSlot = 1;
    else if (player.slot0 === "pistol") gunSlot = 0;
    else if (player.slot2 === "pistol") gunSlot = 2;

    if (gunSlot !== -1) {
      if (gunSlot === 0) player.slot0 = "";
      else if (gunSlot === 1) player.slot1 = "";
      else if (gunSlot === 2) player.slot2 = "";

      // Força a troca imediata para a faca (slot 0)
      player.activeSlot = 0;

      // Spawna a arma no chão arremessada para longe como um coletável tático
      this.puddleIdCounter++;
      const dropId = `dropped_gun_${this.puddleIdCounter}_${Date.now()}`;
      const drop = new AmmoBoxSchema();
      drop.id = dropId;
      const angle = Math.random() * Math.PI * 2;
      const tossDist = 2.8 + Math.random() * 1.2; // 2.8m a 4.0m de distância
      drop.x = player.x + Math.cos(angle) * tossDist;
      drop.y = player.y;
      drop.z = player.z + Math.sin(angle) * tossDist;
      drop.kind = "pistol";
      drop.active = true;
      drop.respawnTimer = 0;
      drop.pickupDelay = 1.8; // 1.8 segundos antes de poder ser coletada novamente
      state.ammoBoxes.set(dropId, drop);
      console.log(`[WaveSystem] ☠ O Homem do Saco derrubou a arma de ${player.name}! Pistola caída em (${drop.x.toFixed(1)}, ${drop.z.toFixed(1)})`);
    }
  }

  /**
   * Spawna uma poça de gosma ácida no chão.
   */
  spawnSlimePuddle(state: ArenaState, x: number, y: number, z: number, radius = SLIME_PUDDLE_RADIUS): void {
    // Evita duplicar poças muito próximas no mesmo local
    for (const p of state.slimePuddles.values()) {
      const dSq = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (dSq < 0.4 * 0.4 && Math.abs(p.y - y) < 0.8) {
        p.lifetime = SLIME_PUDDLE_LIFETIME; // Renova a duração da poça existente
        return;
      }
    }

    const puddle = new SlimePuddleSchema();
    puddle.id = `puddle_${++this.puddleIdCounter}`;
    puddle.x = x;

    const roofY = getRoofImpactY(x, z);
    if (roofY !== null && y >= roofY - 0.6) {
      puddle.y = roofY + 0.02; // Permanece sobre o topo do telhado
    } else {
      puddle.y = calculateElevation(x, z, y) + 0.02;
    }

    puddle.z = z;
    puddle.radius = radius;
    puddle.lifetime = SLIME_PUDDLE_LIFETIME;
    puddle.maxLifetime = SLIME_PUDDLE_LIFETIME;
    state.slimePuddles.set(puddle.id, puddle);
  }

  /**
   * Dispara um projétil de cuspe de gosma ou teia paralisante em direção ao sobrevivente.
   */
  spawnSpitProjectile(
    state: ArenaState,
    x: number,
    y: number,
    z: number,
    angle: number,
    kind: "slime" | "web" = "slime",
  ): void {
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    const spit = new SpitProjectileSchema();
    spit.id = `spit_${++this.spitIdCounter}`;
    spit.kind = kind;

    const forwardOffset = kind === "web" ? 1.05 : 0.65;
    spit.x = x + sin * forwardOffset;
    spit.y = y + (kind === "web" ? 0.8 : 0.35);
    spit.z = z + cos * forwardOffset;
    spit.angle = angle;

    const speed = kind === "web" ? WEB_SPIT_SPEED : SPIT_SPEED;
    spit.vx = sin * speed;
    spit.vz = cos * speed;
    spit.lifetime = 0;
    spit.damage = kind === "web" ? WEB_SPIT_DAMAGE : SPIT_DAMAGE;
    state.spitProjectiles.set(spit.id, spit);
  }

  /**
   * Atualiza as poças de gosma ácida e aplica 1 dano por segundo aos jogadores que pisarem nelas.
   */
  private updateSlimePuddles(state: ArenaState, livingPlayers: PlayerSchema[], dt: number): void {
    const toRemove: string[] = [];
    state.slimePuddles.forEach((puddle, id) => {
      puddle.lifetime -= dt;
      if (puddle.lifetime <= 0) {
        toRemove.push(id);
      }
    });
    for (const id of toRemove) {
      state.slimePuddles.delete(id);
    }

    // Se pisar na gosma, toma dano por segundo
    for (const player of livingPlayers) {
      let isSteppingOnSlime = false;
      for (const puddle of state.slimePuddles.values()) {
        const dx = player.x - puddle.x;
        const dz = player.z - puddle.z;
        const distSq = dx * dx + dz * dz;
        const hitRadius = puddle.radius + PLAYER_RADIUS * 0.45;
        if (distSq <= hitRadius * hitRadius && Math.abs(player.y - puddle.y) < 1.0) {
          // Se o jogador estiver dentro de uma casa e a poça estiver no telhado acima, o teto isola a gosma
          if (isInsideCoveredBuilding(player.x, player.z, player.y) && puddle.y > player.y + 0.9) {
            continue;
          }
          isSteppingOnSlime = true;
          break;
        }
      }

      if (isSteppingOnSlime) {
        if (player.slimeDamageTimer <= 0) {
          // Assim que encosta na gosma, toma dano instantaneamente!
          this.applyDamage(player, SLIME_DAMAGE_PER_SEC);
          player.slimeDamageTimer = 1.0; // Próximo dano após 1 segundo
        } else {
          player.slimeDamageTimer -= dt;
        }
      } else {
        if (player.slimeDamageTimer > 0) {
          player.slimeDamageTimer = Math.max(0, player.slimeDamageTimer - dt);
        }
      }
    }
  }

  /**
   * Atualiza os projéteis de cuspe de gosma, colisão com jogadores e impacto com o ambiente.
   */
  private updateSpitProjectiles(state: ArenaState, livingPlayers: PlayerSchema[], dt: number): void {
    const toRemove: string[] = [];

    state.spitProjectiles.forEach((spit, id) => {
      spit.lifetime += dt;
      spit.x += spit.vx * dt;
      spit.z += spit.vz * dt;

      // 1) Expiração ou limites do mapa
      if (
        spit.lifetime >= SPIT_LIFETIME ||
        spit.x <= MAP_MIN_X ||
        spit.x >= MAP_MAX_X ||
        spit.z <= MAP_MIN_Z ||
        spit.z >= MAP_MAX_Z
      ) {
        toRemove.push(id);
        if (spit.kind !== "web") {
          this.spawnSlimePuddle(state, spit.x, spit.y, spit.z);
        }
        return;
      }

      // 2) Colisão com obstáculos circulares da arena
      for (const obs of OBSTACLES) {
        const dx = spit.x - obs.x;
        const dz = spit.z - obs.z;
        const minDist = obs.r + SPIT_RADIUS;
        if (dx * dx + dz * dz < minDist * minDist) {
          toRemove.push(id);
          if (spit.kind !== "web") {
            this.spawnSlimePuddle(state, spit.x, spit.y, spit.z);
          }
          return;
        }
      }

      // 3) Colisão com paredes da casa e veículos
      for (const box of getStaticCollidersNear(spit.x, spit.z)) {
        if (
          spit.x >= box.minX - SPIT_RADIUS &&
          spit.x <= box.maxX + SPIT_RADIUS &&
          spit.z >= box.minZ - SPIT_RADIUS &&
          spit.z <= box.maxZ + SPIT_RADIUS
        ) {
          toRemove.push(id);
          if (spit.kind !== "web") {
            this.spawnSlimePuddle(state, spit.x, spit.y, spit.z);
          }
          return;
        }
      }

      // 4) Colisão com jogadores vivos
      for (const player of livingPlayers) {
        const dx = spit.x - player.x;
        const dz = spit.z - player.z;
        const distSq = dx * dx + dz * dz;
        const hitRadius = SPIT_RADIUS + PLAYER_RADIUS;
        if (distSq <= hitRadius * hitRadius && Math.abs(spit.y - player.y) < 1.4) {
          toRemove.push(id);
          this.applyDamage(player, spit.damage);
          if (spit.kind === "web") {
            player.webbedTimer = WEB_PARALYZE_DURATION; // 1.8 segundos paralisado!
          } else {
            this.spawnSlimePuddle(state, spit.x, spit.y, spit.z);
          }
          return;
        }
      }
    });

    for (const id of toRemove) {
      state.spitProjectiles.delete(id);
    }
  }

  /**
   * Dispara uma bomba de morteiro em arco parabólico em direção ao sobrevivente.
   */
  spawnMortarLob(state: ArenaState, zombie: ZombieSchema, target: PlayerSchema): void {
    const dx = target.x - zombie.x;
    const dz = target.z - zombie.z;
    const dist = Math.hypot(dx, dz);
    const dirX = dist > 0.01 ? dx / dist : 0;
    const dirZ = dist > 0.01 ? dz / dist : 1;

    const isBoss = zombie.type === "boss";

    const lob = new MortarLobSchema();
    lob.id = `m_${++this.mortarIdCounter}`;
    lob.startX = zombie.x + dirX * (isBoss ? 1.0 : 0.45);
    lob.startY = zombie.y + (isBoss ? 2.8 : 1.25); // canhão do chefe é bem alto
    lob.startZ = zombie.z + dirZ * (isBoss ? 1.0 : 0.45);

    // Dispara no local do jogador com leve dispersão natural
    lob.targetX = target.x + (Math.random() - 0.5) * (isBoss ? 0.8 : 0.4);
    lob.targetZ = target.z + (Math.random() - 0.5) * (isBoss ? 0.8 : 0.4);

    // Se o ponto de queda coincidir com a projeção de um telhado sólido, impacta sobre o telhado
    const roofY = getRoofImpactY(lob.targetX, lob.targetZ);
    if (roofY !== null) {
      lob.targetY = roofY;
    } else {
      lob.targetY = calculateElevation(lob.targetX, lob.targetZ, target.y);
    }

    // O projétil do chefe tem um arco alto e dura um pouco mais no ar para permitir reação tática e esquiva
    lob.duration = isBoss
      ? Math.max(1.35, Math.min(2.5, 0.8 + dist * 0.075))
      : Math.max(0.65, dist / MORTAR_FLIGHT_SPEED);
    lob.peakHeight = (isBoss ? 5.8 : 2.2) + dist * 0.16;
    lob.progress = 0;
    lob.elapsed = 0;
    lob.splashRadius = isBoss ? 5.8 : MORTAR_SPLASH_RADIUS;
    lob.damage = isBoss ? 3 : MORTAR_DAMAGE;

    state.mortarLobs.set(lob.id, lob);
  }

  /**
   * Atualiza as bombas de morteiro de gosma ao longo do arco parabólico e resolve o impacto no solo.
   */
  private updateMortarLobs(state: ArenaState, livingPlayers: PlayerSchema[], dt: number): void {
    const toRemove: string[] = [];

    state.mortarLobs.forEach((lob, id) => {
      lob.elapsed += dt;
      lob.progress = Math.min(1, lob.elapsed / Math.max(0.01, lob.duration));

      // Ao atingir o solo ou o telhado no término da parábola
      if (lob.progress >= 1) {
        toRemove.push(id);

        const splash = lob.splashRadius || MORTAR_SPLASH_RADIUS;
        const hitRadius = splash + PLAYER_RADIUS * 0.45;

        // 1) Se o tiro acertar o personagem, toma dano do tiro
        for (const player of livingPlayers) {
          // Se o jogador estiver abrigado dentro de uma casa sob o teto, o tiro aéreo não o atinge diretamente
          if (isInsideCoveredBuilding(player.x, player.z, player.y)) {
            continue;
          }

          const dx = player.x - lob.targetX;
          const dz = player.z - lob.targetZ;
          const distSq = dx * dx + dz * dz;
          if (distSq <= hitRadius * hitRadius && Math.abs(player.y - lob.targetY) < 2.0) {
            this.applyDamage(player, lob.damage);
            // "e ja começa a tomar dano por segundo": zera slimeDamageTimer para sofrer imediatamente a poça
            player.slimeDamageTimer = 0;
          }
        }

        // 2) Quando o tiro cai, fica uma poça de gosma no chão (ou sobre o telhado) com área ampliada
        this.spawnSlimePuddle(state, lob.targetX, lob.targetY, lob.targetZ, splash);

        // Se for o disparo gigante do Chefe, cria respingos cáusticos adicionais ao redor para formar uma zona tóxica colossal
        if (splash > 4.5) {
          const clusterAngles = [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3];
          for (const ang of clusterAngles) {
            const rx = lob.targetX + Math.cos(ang) * 2.2;
            const rz = lob.targetZ + Math.sin(ang) * 2.2;
            const ry = calculateElevation(rx, rz, lob.targetY);
            this.spawnSlimePuddle(state, rx, ry, rz, 2.4);
          }
        }
      }
    });

    for (const id of toRemove) {
      state.mortarLobs.delete(id);
    }
  }

  /**
   * Inicia o relógio das hordas (chamado quando a porta da casinha inicial é aberta).
   * Avança o relógio para exatamente HORDE_1_DELAY_AFTER_CABIN_DOOR_SECONDS antes da 1ª Horda,
   * preservando os intervalos de todas as hordas seguintes.
   */
  startHordeClock(state: ArenaState): void {
    if (this.hordeClockStarted) return;
    this.hordeClockStarted = true;
    state.gameTime = Math.max(
      state.gameTime,
      HORDE_1_TRIGGER_REAL_SECONDS - HORDE_1_DELAY_AFTER_CABIN_DOOR_SECONDS,
    );
    console.log(
      `[WaveSystem] 🚪 Porta da casinha aberta! Horda 1 em ${HORDE_1_DELAY_AFTER_CABIN_DOOR_SECONDS}s.`,
    );
  }

  /**
   * Reseta completamente o sistema de hordas para o estado inicial da partida:
   * - Relógio do jogo volta a 0 (00:00)
   * - Hordas voltam a 0 (estado de preparação para Horda 1)
   * - Limpa todas as levas e lotes de zumbis programados
   * - Remove todos os zumbis, poças ácidas, projéteis e morteiros da arena
   * - Recria a população inicial calma de zumbis patrulhando
   */
  resetMatch(state: ArenaState): void {
    this.hordeClockStarted = false;
    state.gameTime = 0;
    state.currentHorde = 0;
    state.hordeState = "preparing";
    state.hordeAlert = false;
    state.hordeAlertText = "";
    this.hordeAlertTimer = 0;

    this.horde1Triggered = false;
    this.horde2Triggered = false;
    this.horde3Triggered = false;
    this.horde4Triggered = false;
    this.horde5Triggered = false;
    this.horde6Triggered = false;
    this.horde7Triggered = false;
    this.horde8Triggered = false;
    this.horde9Triggered = false;
    this.horde10Triggered = false;
    this.horde11Triggered = false;
    this.horde12Triggered = false;
    this.horde13Triggered = false;

    this.pendingWaves = [];
    this.pendingBatches = [];

    // Limpa todas as entidades geradas pelo WaveSystem
    state.zombies.clear();
    state.slimePuddles.clear();
    state.spitProjectiles.clear();
    state.mortarLobs.clear();

    // Recria a população inicial calma de zumbis patrulhando as zonas do mapa
    this.hasInitialSpawned = true;
    this.spawnInitialPopulation(state);

    console.log("[WaveSystem] Partida reiniciada com sucesso para o início do jogo!");
  }

  /**
   * Método de depuração para forçar o disparo de uma horda específica imediatamente.
   * Se hordeNumber === 5 e immediateBoss === true, antecipa a chegada do Chefe para 1.2 segundos.
   */
  debugTriggerHorde(state: ArenaState, hordeNumber = 5, immediateBoss = false): void {
    // Garante que as levas agendadas avancem mesmo sem abrir a porta
    this.hordeClockStarted = true;
    console.log(`[WaveSystem] 🛠️ DEBUG: Forçando disparo da Horda ${hordeNumber} (immediateBoss: ${immediateBoss})`);
    if (hordeNumber === 99) {
      const pt = this.findBossOffscreenPoint(state);
      const boss = this.spawnEnemy(state, "sack_boss", pt.x, pt.z);
      boss.isHunter = true;
      boss.isAggro = true;
      boss.aiMode = "chasing";
      state.hordeAlert = true;
      state.hordeAlertText = "☠ O HOMEM DO SACO CHEGOU (DEBUG)!";
      return;
    }

    state.currentHorde = hordeNumber;
    state.hordeState = "horde";
    state.hordeAlert = true;
    state.hordeAlertText = `HORDA ${hordeNumber} INICIADA (DEBUG)!`;
    this.hordeAlertTimer = 0;
    this.triggerHorde(state, hordeNumber);

    if ((hordeNumber === 3 || hordeNumber === 6 || hordeNumber === 9 || hordeNumber === 12) && immediateBoss) {
      for (const wave of this.pendingWaves) {
        if (
          wave.hordeNumber === hordeNumber &&
          (wave.enemies.includes("boss") ||
            wave.enemies.includes("spider_boss") ||
            wave.enemies.includes("werewolf_boss") ||
            wave.enemies.includes("sack_boss"))
        ) {
          wave.triggerGameTime = state.gameTime + 1.2;
        }
      }
    }
  }

  /**
   * Spawna reforços imediatos quando um chefe atinge os limiares de vida (70%, 50% e 10%),
   * evitando que qualquer chefe fique sozinho e tornando o confronto muito mais desafiador.
   */
  spawnBossThresholdReinforcements(state: ArenaState, boss: ZombieSchema, threshold: 70 | 50 | 10): void {
    const bossType = boss.type as EnemyTypeId;
    const livingPlayers: PlayerSchema[] = [];
    state.players.forEach((p) => {
      if (p.inWorld && p.hp > 0) livingPlayers.push(p);
    });
    if (livingPlayers.length === 0) return;

    let minionTypes: EnemyTypeId[] = [];
    let alertText = "";

    if (bossType === "boss") {
      // Monstro do Pântano (Swamp Monster)
      if (threshold === 70) {
        minionTypes = ["standard", "standard", "runner", "runner", "spitter"];
        alertText = "☠ O MONSTRO DO PÂNTANO RUGIU! ZUMBIS DE REFORÇO SURGEM! (70% VIDA)";
      } else if (threshold === 50) {
        minionTypes = ["tank", "spitter", "spitter", "runner", "runner", "standard", "standard"];
        alertText = "☠ O MONSTRO DO PÂNTANO ESTÁ ENFURECIDO! UMA ONDA DE ZUMBIS SE APROXIMA! (50% VIDA)";
      } else if (threshold === 10) {
        minionTypes = ["tank", "tank", "mortar", "mortar", "runner", "runner", "runner"];
        alertText = "☠ FÚRIA CRÍTICA DO MONSTRO DO PÂNTANO! HORDA PESADA AO RESGATE! (10% VIDA)";
      }
    } else if (bossType === "spider_boss") {
      // Rainha Aracnídea (Spider Queen)
      if (threshold === 70) {
        minionTypes = ["spider", "spider", "spider", "spider", "runner", "runner"];
        alertText = "🕷 A RAINHA ARACNÍDEA CHAMA SUA NINHADA! ARANHAS INVADEM A ARENA! (70% VIDA)";
      } else if (threshold === 50) {
        minionTypes = ["spider", "spider", "spider", "spider", "spider", "spitter", "spitter", "tank"];
        alertText = "🕷 NINHADA VENENOSA DA RAINHA ARACNÍDEA DESPERTA! (50% VIDA)";
      } else if (threshold === 10) {
        minionTypes = ["spider", "spider", "spider", "spider", "spider", "spider", "tank", "tank", "runner", "runner"];
        alertText = "🕷 NINHADA TOTAL DA RAINHA ARACNÍDEA EM FÚRIA MORTAL! (10% VIDA)";
      }
    } else if (bossType === "werewolf_boss") {
      // Lobisomem Alfa (Werewolf)
      if (threshold === 70) {
        minionTypes = ["wolf", "wolf", "wolf", "wolf", "runner", "runner"];
        alertText = "🌕 UIVO SANGRENTO DO LOBISOMEM! A MATILHA SE APROXIMA! (70% VIDA)";
      } else if (threshold === 50) {
        minionTypes = ["wolf", "wolf", "wolf", "wolf", "wolf", "tank", "runner", "runner"];
        alertText = "🌕 A MATILHA EM FEROCIDADE TOTAL! LOBOS E CORREDORES CERCOS! (50% VIDA)";
      } else if (threshold === 10) {
        minionTypes = ["wolf", "wolf", "wolf", "wolf", "wolf", "wolf", "tank", "tank", "spitter", "runner"];
        alertText = "🌕 CLÍMAX DA CAÇADA! TODA A MATILHA ATACA EM DESESPERO! (10% VIDA)";
      }
    } else if (bossType === "sack_boss") {
      // Homem do Saco (Sack Man)
      if (threshold === 70) {
        minionTypes = ["tank", "tank", "runner", "runner", "spitter", "spitter"];
        alertText = "☠ O HOMEM DO SACO SOLTA GARGALHADAS SINISTRAS! REFORÇOS SURGEM! (70% VIDA)";
      } else if (threshold === 50) {
        minionTypes = ["tank", "tank", "mortar", "mortar", "runner", "runner", "spitter", "spitter"];
        alertText = "☠ PESADELO DO HOMEM DO SACO! HORDA BLINDADA DE REFORÇO! (50% VIDA)";
      } else if (threshold === 10) {
        minionTypes = ["tank", "tank", "tank", "mortar", "mortar", "mortar", "runner", "runner", "runner"];
        alertText = "☠ HORROR SUPREMO DO HOMEM DO SACO! ONDA DESTRUIDORA FINAL! (10% VIDA)";
      }
    } else {
      // Qualquer outro chefe genérico
      minionTypes = threshold === 70
        ? ["standard", "standard", "runner", "runner"]
        : threshold === 50
        ? ["tank", "spitter", "runner", "runner", "standard"]
        : ["tank", "tank", "mortar", "runner", "runner"];
      alertText = `⚠ CHEFE EM ${threshold}% DE VIDA! REFORÇOS INVOCADOS!`;
    }

    // Exibe banner de alerta na HUD para os sobreviventes
    state.hordeAlert = true;
    state.hordeAlertText = alertText;
    this.hordeAlertTimer = 0;

    // Spawna cada inimigo do grupo de reforço
    minionTypes.forEach((type, idx) => {
      const angle = (idx / minionTypes.length) * Math.PI * 2;
      const pt = this.findOffscreenPoint(state, angle);
      const minion = this.spawnEnemy(state, type, pt.x, pt.z);
      minion.isHunter = true;
      minion.isAggro = true;
      minion.aiMode = "chasing";
      let nearestDistSq = Infinity;
      let targetP: PlayerSchema = livingPlayers[0];
      for (const p of livingPlayers) {
        const dSq = (p.x - pt.x) ** 2 + (p.z - pt.z) ** 2;
        if (dSq < nearestDistSq) {
          nearestDistSq = dSq;
          targetP = p;
        }
      }
      minion.patrolTargetX = targetP.x;
      minion.patrolTargetZ = targetP.z;
    });

    console.log(`[WaveSystem] 🚨 CHEFE ${bossType.toUpperCase()} atingiu ${threshold}% de vida! Spawnando ${minionTypes.length} reforços.`);
  }
}
