import {
  AMMO_BOX_RADIUS,
  AMMO_BOX_RESPAWN_TIME,
  BULLET_DAMAGE,
  BULLET_LIFETIME,
  BULLET_RADIUS,
  BULLET_SPEED,
  C4_COUNTDOWN_SECONDS,
  C4_EXPLOSION_DAMAGE,
  C4_EXPLOSION_RADIUS,
  C4_PLANT_COOLDOWN,
  CORPSE_DECAY_TIME,
  DEFIBRILLATOR_REVIVE_RADIUS,
  ENEMY_CONFIGS,
  findRandomItemSpot,
  GUN_TIERS,
  KNIFE_TIERS,
  MAGAZINE_SIZE,
  MAP_MAX_X,
  MAP_MAX_Z,
  MAP_MIN_X,
  MAP_MIN_Z,
  OBSTACLES,
  PLAYER_MAX_HP,
  RANDOM_ITEM_MIN_SPACING,
  RELOAD_TIME,
  type BoxCollider,
  type EnemyTypeId,
  type InputMessage,
  getStaticCollidersNear,
} from "@dark-beans/shared";
import type { ArenaState } from "../schemas/ArenaState";
import { AmmoBoxSchema } from "../schemas/AmmoBoxSchema";
import { BulletSchema } from "../schemas/BulletSchema";
import { C4MineSchema } from "../schemas/C4MineSchema";
import type { PlayerSchema } from "../schemas/PlayerSchema";
import type { ZombieSchema } from "../schemas/ZombieSchema";

/**
 * Sistema de combate autoritativo:
 * - Suporta múltiplos itens no inventário: Faca de Combate, Pistola Tática e Bandagem Médica.
 * - Faca: golpe corpo a corpo rápido em cone frontal, 1 de dano, alerta zumbi ao acertar.
 * - Pistola: disparo balístico de projéteis, consumo de pentes e recarga.
 * - Bandagem: cura +3 HP (até o máximo de 10) e consome a bandagem.
 * - Coleta de itens e armas no mapa (Pistola, Bandagens e Caixas de Munição).
 */
export class CombatSystem {
  private readonly cooldowns = new Map<string, number>();
  /**
   * Disparos de cada jogador que ainda podem causar dano. O acerto é detectado no cliente (que vê o
   * zumbi onde ele está na tela dele) e confirmado aqui via applyClientHit, consumindo um disparo.
   */
  private readonly shotCredits = new Map<string, { damage: number; firedAt: number }[]>();
  private clock = 0;
  private readonly reloadTimers = new Map<string, number>();
  private bulletIdCounter = 0;
  private c4IdCounter = 0;
  private dropCounter = 0;
  onPlayerRevived?: (
    reviverId: string,
    reviver: PlayerSchema,
    revivedId: string,
    revived: PlayerSchema
  ) => void;

  update(
    state: ArenaState,
    inputs: Map<string, InputMessage>,
    dt: number,
    extraColliders?: readonly BoxCollider[],
  ): void {
    this.clock += dt;

    // 1) Atualiza cooldowns de ataque/uso de itens
    for (const [id, cd] of this.cooldowns) {
      if (cd > 0) this.cooldowns.set(id, Math.max(0, cd - dt));
    }

    // 1.5) Atualiza temporizador das C4s plantadas no mundo (5 segundos até explosão)
    if (state.c4Mines) {
      const c4ToRemove: string[] = [];
      state.c4Mines.forEach((c4, mineId) => {
        if (!c4.exploded) {
          c4.timer -= dt;
          if (c4.timer <= 0) {
            c4.timer = 0;
            c4.exploded = true;
            this.detonateC4(state, c4);
          }
        } else {
          c4.removeTimer -= dt;
          if (c4.removeTimer <= 0) {
            c4ToRemove.push(mineId);
          }
        }
      });
      for (const id of c4ToRemove) {
        state.c4Mines.delete(id);
      }
    }

    // 2) Atualiza recargas ativas da pistola
    for (const [id, timer] of this.reloadTimers) {
      const player = state.players.get(id);
      if (!player || player.hp <= 0 || !player.inWorld) {
        this.reloadTimers.delete(id);
        continue;
      }
      const newTimer = timer - dt;
      if (newTimer <= 0) {
        // Recarga concluída! Consome balas da reserva para encher o pente
        this.reloadTimers.delete(id);
        const needed = (player.maxAmmo || MAGAZINE_SIZE) - player.ammo;
        const toLoad = Math.min(needed, Math.max(0, player.reserveAmmo));
        player.ammo += toLoad;
        player.reserveAmmo = Math.max(0, player.reserveAmmo - toLoad);
        player.reloading = false;
        player.reloadProgress = 0;
      } else {
        this.reloadTimers.set(id, newTimer);
        player.reloading = true;
        player.reloadProgress = Math.max(0, Math.min(1, 1 - newTimer / RELOAD_TIME));
      }
    }

    // 3) Processa solicitações manuais de recarga (tecla R) - apenas se pistola estiver ativa
    state.players.forEach((player, id) => {
      if (player.hp <= 0 || !player.inWorld) return;
      const input = inputs.get(id);
      const activeItem =
        player.activeSlot === 0
          ? player.slot0
          : player.activeSlot === 1
          ? player.slot1
          : player.activeSlot === 2
          ? player.slot2
          : player.slot3;

      if (
        activeItem === "pistol" &&
        input?.reloading &&
        !player.reloading &&
        player.ammo < (player.maxAmmo || MAGAZINE_SIZE) &&
        player.reserveAmmo > 0
      ) {
        this.startReload(player, id);
      }
    });

    // 4) Ação do item ativo (Ataque corpo a corpo, Disparo de pistola, ou Uso de bandagem)
    state.players.forEach((player, id) => {
      if (player.hp <= 0 || !player.inWorld) return;
      const input = inputs.get(id);
      if (!input || !input.shooting) return;

      const cd = this.cooldowns.get(id) ?? 0;
      if (cd > 0) return;

      const activeItem =
        player.activeSlot === 0
          ? player.slot0
          : player.activeSlot === 1
          ? player.slot1
          : player.activeSlot === 2
          ? player.slot2
          : player.slot3;

      // ─── 4.1) FACA DE COMBATE (Corpo a Corpo - 7 Níveis) ─────────────────
      if (activeItem === "knife") {
        const kLvl = player.knifeLevel || 1;
        const tier = KNIFE_TIERS.find((t) => t.level === kLvl) ?? KNIFE_TIERS[0]!;
        const knifeCooldownTime = tier.cooldown;
        const knifeRange = tier.range;
        const knifeDamage = tier.damage;

        this.cooldowns.set(id, knifeCooldownTime);
        const aimAngle = input.aimAngle;

        state.zombies.forEach((zombie) => {
          if (zombie.state !== "alive") return;
          const dx = zombie.x - player.x;
          const dz = zombie.z - player.z;
          const dist = Math.hypot(dx, dz);
          const config = ENEMY_CONFIGS[zombie.type as EnemyTypeId] ?? ENEMY_CONFIGS.standard;

          if (dist <= knifeRange + config.radius && Math.abs(zombie.y - player.y) < 1.35) {
            // Verifica ângulo dentro do cone frontal (~66 graus)
            const toAngle = Math.atan2(dx, dz);
            let diff = Math.abs(toAngle - aimAngle);
            while (diff > Math.PI) diff = Math.abs(diff - Math.PI * 2);

            if (diff < 1.15) {
              zombie.hp = Math.max(0, zombie.hp - knifeDamage);
              if (zombie.hp === 0) {
                this.handleZombieDeath(state, zombie, player);
              } else {
                zombie.isAggro = true;
                zombie.aiMode = "chasing";
              }
            }
          }
        });
        return;
      }

      // ─── 4.2) BANDAGEM MÉDICA (Uso de Cura) ─────────────────────────────
      if (activeItem === "bandage") {
        if (player.hp < PLAYER_MAX_HP && player.bandageCount > 0) {
          this.cooldowns.set(id, 0.7);
          player.hp = Math.min(PLAYER_MAX_HP, player.hp + 3);
          player.bandageCount -= 1;
          if (player.bandageCount <= 0) {
            // Esvazia o slot específico que continha a bandagem
            if (player.activeSlot === 2) player.slot2 = "";
            else if (player.activeSlot === 3) player.slot3 = "";
            player.activeSlot = player.slot1 ? 1 : 0;
          }
        }
        return;
      }

      // ─── 4.3) C4 EXPLOSIVO COM DISTRAÇÃO (Plante no chão) ────────────────
      if (activeItem === "c4") {
        if (player.c4Count > 0) {
          this.cooldowns.set(id, C4_PLANT_COOLDOWN);
          player.c4Count -= 1;
          if (player.c4Count <= 0) {
            if (player.activeSlot === 2) player.slot2 = "";
            else if (player.activeSlot === 3) player.slot3 = "";
            // Alterna de volta para a arma de fogo ou faca
            player.activeSlot = player.slot1 ? 1 : 0;
          }

          // Posiciona a C4 no chão a 0.85m à frente do jogador na direção em que está mirando
          const aimAngle = input.aimAngle;
          const plantX = player.x + Math.sin(aimAngle) * 0.85;
          const plantZ = player.z + Math.cos(aimAngle) * 0.85;
          const plantY = player.y;

          this.plantC4(state, plantX, plantY, plantZ, id);
        }
        return;
      }

      // ─── 4.3.5) DISPOSITIVO DESFIBRILADOR (Reanimação de amigo caído) ───────────
      if (activeItem === "defibrillator") {
        this.tryDefibrillate(state, id, player);
        return;
      }

      // ─── 4.3) ARMA DE FOGO (Pistola, Deagle, Uzi, SMG, Rifle, Rifle Avançado - 7 Níveis) ───
      if (activeItem === "pistol") {
        if (player.reloading) return;

        if (player.ammo <= 0) {
          if (player.reserveAmmo > 0) {
            this.startReload(player, id);
          }
          return;
        }

        // Dispara projétil e consome 1 bala do pente
        player.ammo = Math.max(0, player.ammo - 1);
        const gLvl = player.gunLevel || 1;
        const tier = GUN_TIERS.find((t) => t.level === gLvl) ?? GUN_TIERS[0]!;
        this.cooldowns.set(id, tier.fireCooldown);

        const angle = input.aimAngle;
        const sin = Math.sin(angle);
        const cos = Math.cos(angle);

        // Muzzle distance estendida para rifles mais longos
        const muzzleDist = gLvl >= 6 ? 0.95 : gLvl >= 3 ? 0.85 : 0.75;
        const bullet = new BulletSchema();
        bullet.id = `b_${++this.bulletIdCounter}`;
        bullet.playerId = id;
        bullet.x = player.x + sin * muzzleDist;
        bullet.z = player.z + cos * muzzleDist;
        bullet.angle = angle;
        bullet.lifetime = 0;
        bullet.vx = sin * BULLET_SPEED;
        bullet.vz = cos * BULLET_SPEED;
        bullet.damage = tier.damage;

        state.bullets.set(bullet.id, bullet);

        let credits = this.shotCredits.get(id);
        if (!credits) this.shotCredits.set(id, (credits = []));
        credits.push({ damage: tier.damage, firedAt: this.clock });
        return;
      }

      // ─── 4.4) SINALIZADOR DE RESGATE (Slot 4 - Emite fumaça vermelha ao usar) ───
      if (activeItem === "flare" || activeItem === "sinalizador") {
        if (!player.flareActive) {
          player.flareActive = true;
          this.cooldowns.set(id, 0.4);
          console.log(`[CombatSystem] 🚨🔥 ${player.name} usou o SINALIZADOR! Fumaça vermelha acionada.`);
        }
        return;
      }
    });

    // 5) Simulação física e ciclo de vida das balas
    const toRemove: string[] = [];

    state.bullets.forEach((bullet, id) => {
      bullet.lifetime += dt;
      bullet.x += bullet.vx * dt;
      bullet.z += bullet.vz * dt;

      // Limite de tempo de vida ou borda do mapa
      if (
        bullet.lifetime >= BULLET_LIFETIME ||
        bullet.x <= MAP_MIN_X ||
        bullet.x >= MAP_MAX_X ||
        bullet.z <= MAP_MIN_Z ||
        bullet.z >= MAP_MAX_Z
      ) {
        toRemove.push(id);
        return;
      }

      // Colisão com obstáculos circulares da arena
      for (const obs of OBSTACLES) {
        const dx = bullet.x - obs.x;
        const dz = bullet.z - obs.z;
        const minDist = obs.r + BULLET_RADIUS;
        if (dx * dx + dz * dz < minDist * minDist) {
          toRemove.push(id);
          return;
        }
      }

      // Colisão com paredes da casa e carros do ferro velho
      for (const box of getStaticCollidersNear(bullet.x, bullet.z)) {
        if (
          bullet.x >= box.minX - BULLET_RADIUS &&
          bullet.x <= box.maxX + BULLET_RADIUS &&
          bullet.z >= box.minZ - BULLET_RADIUS &&
          bullet.z <= box.maxZ + BULLET_RADIUS
        ) {
          toRemove.push(id);
          return;
        }
      }

      // Colisão com portas fechadas
      if (extraColliders) {
        for (const box of extraColliders) {
          if (
            bullet.x >= box.minX - BULLET_RADIUS &&
            bullet.x <= box.maxX + BULLET_RADIUS &&
            bullet.z >= box.minZ - BULLET_RADIUS &&
            bullet.z <= box.maxZ + BULLET_RADIUS
          ) {
            toRemove.push(id);
            return;
          }
        }
      }

      // Colisão com zumbis vivos: a bala some, mas o dano vem do acerto confirmado pelo cliente
      state.zombies.forEach((zombie) => {
        if (zombie.state !== "alive") return;
        const config = ENEMY_CONFIGS[zombie.type as EnemyTypeId] ?? ENEMY_CONFIGS.standard;
        const dx = bullet.x - zombie.x;
        const dz = bullet.z - zombie.z;
        const minDist = config.radius + BULLET_RADIUS;
        if (dx * dx + dz * dz < minDist * minDist && !toRemove.includes(id)) toRemove.push(id);
      });
    });

    for (const id of toRemove) {
      state.bullets.delete(id);
    }

    // 6) Atualiza caixas de munição, armas e bandagens no mapa e coleta pelos jogadores
    if (state.ammoBoxes) {
      const boxesToDelete: string[] = [];
      state.ammoBoxes.forEach((box) => {
        if (!box.active) {
          box.respawnTimer -= dt;
          if (box.respawnTimer <= 0) {
            // Itens sorteados reaparecem em um novo local aleatório do mapa
            if (box.id.startsWith("item_rand_")) {
              const others: { x: number; z: number }[] = [];
              state.ammoBoxes.forEach((b) => {
                if (b !== box && b.active) others.push(b);
              });
              const spot = findRandomItemSpot(others, RANDOM_ITEM_MIN_SPACING);
              if (spot) {
                box.x = spot.x;
                box.y = spot.y;
                box.z = spot.z;
              }
            }
            box.active = true;
            box.respawnTimer = 0;
          }
          return;
        }

        if (box.pickupDelay > 0) {
          box.pickupDelay -= dt;
          return;
        }

        // Verifica colisão com jogadores vivos no mundo
        state.players.forEach((player) => {
          if (player.hp <= 0 || !player.inWorld) return;
          const dy = Math.abs(player.y - box.y);
          if (dy < 1.25) {
            const dx = player.x - box.x;
            const dz = player.z - box.z;
            if (dx * dx + dz * dz < AMMO_BOX_RADIUS * AMMO_BOX_RADIUS) {
              const kind = box.kind || "ammo";

              if (kind === "ammo") {
                // Adiciona balas de reserva
                player.reserveAmmo += player.maxAmmo || MAGAZINE_SIZE;
                if (box.id.startsWith("dropped_")) {
                  boxesToDelete.push(box.id);
                } else {
                  box.active = false;
                  box.respawnTimer = AMMO_BOX_RESPAWN_TIME;
                }
              } else if (kind === "coin") {
                // Dinheiro coletado do chão (+3 moedas para compras na loja)
                player.coins += 3;
                if (box.id.startsWith("dropped_")) {
                  boxesToDelete.push(box.id);
                } else {
                  box.active = false;
                  box.respawnTimer = 30; // Respawn em 30s
                }
              } else if (kind === "pistol") {
                // Se já tem pistola no inventário, abastece munição
                if (player.slot1 === "pistol" || player.slot0 === "pistol") {
                  player.reserveAmmo += player.maxAmmo || MAGAZINE_SIZE;
                } else {
                  player.slot1 = "pistol";
                  player.ammo = player.maxAmmo || MAGAZINE_SIZE;
                  player.activeSlot = 1;
                }
                if (box.id.startsWith("dropped_")) {
                  boxesToDelete.push(box.id);
                } else {
                  box.active = false;
                  box.respawnTimer = AMMO_BOX_RESPAWN_TIME;
                }
              } else if (
                kind === "bandage" ||
                kind === "c4" ||
                kind === "defibrillator" ||
                kind === "plant_sprout" ||
                kind === "spider_head" ||
                kind === "werewolf_tooth" ||
                kind === "sack" ||
                kind === "flare" ||
                kind === "sinalizador"
              ) {
                const normKind = kind === "sinalizador" ? "flare" : kind;
                const ok = this.assignToUtilitySlot(state, player, normKind, 1, 3);
                if (ok) {
                  if (box.id.startsWith("dropped_")) {
                    boxesToDelete.push(box.id);
                  } else {
                    box.active = false;
                    box.respawnTimer = AMMO_BOX_RESPAWN_TIME;
                  }
                }
              }
            }
          }
        });
      });
      for (const id of boxesToDelete) {
        state.ammoBoxes.delete(id);
      }
    }
  }

  /**
   * Adiciona um item utilitário aos slots flexíveis 2 e 3 (índices 2 e 3 do inventário).
   * Slots 0 e 1 são fixos (faca e arma).
   * Itens empilháveis (bandage, c4) agrupam no mesmo slot se já existirem.
   * Se os slots 2 e 3 estiverem cheios, substitui o slot atualmente ativo (se for 2 ou 3) ou o slot 2,
   * dropando o item anterior no chão para nada se perder.
   */
  assignToUtilitySlot(
    state: ArenaState,
    player: PlayerSchema,
    kind: string,
    countToAdd = 1,
    maxStack = 3
  ): boolean {
    // 1) Se for item empilhável (bandage ou c4)
    if (kind === "bandage" || kind === "c4") {
      if (player.slot2 === kind) {
        if (kind === "bandage") {
          if (player.bandageCount >= maxStack) return false;
          player.bandageCount = Math.min(maxStack, player.bandageCount + countToAdd);
        } else {
          if (player.c4Count >= maxStack) return false;
          player.c4Count = Math.min(maxStack, player.c4Count + countToAdd);
        }
        return true;
      }
      if (player.slot3 === kind) {
        if (kind === "bandage") {
          if (player.bandageCount >= maxStack) return false;
          player.bandageCount = Math.min(maxStack, player.bandageCount + countToAdd);
        } else {
          if (player.c4Count >= maxStack) return false;
          player.c4Count = Math.min(maxStack, player.c4Count + countToAdd);
        }
        return true;
      }
    }

    // 2) Escolhe o slot de destino entre slot2 e slot3
    let targetSlot: 2 | 3 = 2;
    if (!player.slot2) {
      targetSlot = 2;
    } else if (!player.slot3) {
      targetSlot = 3;
    } else {
      // Ambos cheios: se o jogador estiver no slot 3, substitui o 3; senão o 2
      targetSlot = player.activeSlot === 3 ? 3 : 2;
      const oldItem = targetSlot === 2 ? player.slot2 : player.slot3;
      if (oldItem && oldItem !== kind) {
        this.dropItem(state, player.x, player.y, player.z, oldItem);
      }
    }

    if (targetSlot === 2) {
      player.slot2 = kind;
    } else {
      player.slot3 = kind;
    }

    if (kind === "bandage") {
      player.bandageCount = countToAdd;
    } else if (kind === "c4") {
      player.c4Count = countToAdd;
    }

    // Registra relíquias de chefes obtidas
    if (kind === "plant_sprout") player.hasPlantSprout = true;
    else if (kind === "spider_head") player.hasSpiderHead = true;
    else if (kind === "werewolf_tooth") player.hasWerewolfTooth = true;
    else if (kind === "sack") player.hasSack = true;

    return true;
  }

  /**
   * Spawna um item no chão da arena com pequeno atraso para evitar auto-coleta imediata.
   */
  dropItem(state: ArenaState, x: number, y: number, z: number, kind: string): void {
    if (!kind) return;
    this.dropCounter++;
    const dropId = `dropped_${kind}_${this.dropCounter}_${Date.now()}`;
    const drop = new AmmoBoxSchema();
    drop.id = dropId;
    const angle = Math.random() * Math.PI * 2;
    const dist = 0.55 + Math.random() * 0.35;
    drop.x = x + Math.cos(angle) * dist;
    drop.y = y;
    drop.z = z + Math.sin(angle) * dist;
    drop.kind = kind;
    drop.active = true;
    drop.respawnTimer = 0;
    drop.pickupDelay = 1.2; // 1.2s de atraso para evitar pegar imediatamente de volta
    state.ammoBoxes.set(dropId, drop);
    console.log(`[CombatSystem] 📦 Item '${kind}' dropou no chão em (${drop.x.toFixed(1)}, ${drop.z.toFixed(1)})`);
  }

  /**
   * Reanima o amigo morto mais próximo dentro do raio de alcance com vida cheia.
   * Consome o desfibrilador após o uso com sucesso.
   */
  tryDefibrillate(state: ArenaState, id: string, player: PlayerSchema): boolean {
    if (!player.inWorld || player.hp <= 0) return false;
    const cd = this.cooldowns.get(id) ?? 0;
    if (cd > 0) return false;

    // Encontra o amigo morto mais próximo (hp <= 0 e inWorld === true)
    let closestDead: PlayerSchema | null = null;
    let closestDeadId = "";
    let closestDeadDist = Infinity;
    const REVIVE_MAX_DIST = DEFIBRILLATOR_REVIVE_RADIUS;

    state.players.forEach((other, otherId) => {
      if (otherId === id || !other.inWorld || other.hp > 0) return;
      const d = Math.hypot(player.x - other.x, player.z - other.z);
      if (d <= REVIVE_MAX_DIST && d < closestDeadDist) {
        closestDeadDist = d;
        closestDead = other;
        closestDeadId = otherId;
      }
    });

    if (closestDead) {
      const friend = closestDead as PlayerSchema;
      this.cooldowns.set(id, 1.0);

      // Consome o desfibrilador do slot atual
      if (player.activeSlot === 0) player.slot0 = "";
      else if (player.activeSlot === 1) player.slot1 = "";
      else if (player.activeSlot === 2) player.slot2 = "";
      else if (player.activeSlot === 3) player.slot3 = "";
      player.activeSlot = player.slot1 ? 1 : 0;

      // Revive o amigo com vida cheia e armadura restaurada!
      friend.hp = PLAYER_MAX_HP;
      friend.armor = friend.maxArmor || 4;
      friend.webbedTimer = 0;

      console.log(`[CombatSystem] ⚡⚡ CLEAR! ${player.name} usou o Desfibrilador e reviveu ${friend.name}!`);
      this.onPlayerRevived?.(id, player, closestDeadId, friend);
      return true;
    }

    return false;
  }

  plantC4(state: ArenaState, x: number, y: number, z: number, ownerId: string): void {
    const mine = new C4MineSchema();
    mine.id = `c4_${++this.c4IdCounter}`;
    mine.x = x;
    mine.y = y;
    mine.z = z;
    mine.timer = C4_COUNTDOWN_SECONDS;
    mine.maxTimer = C4_COUNTDOWN_SECONDS;
    mine.ownerId = ownerId;
    mine.exploded = false;
    mine.removeTimer = 0.5;

    state.c4Mines.set(mine.id, mine);
    console.log(`[CombatSystem] 💣 C4 plantada em (${x.toFixed(1)}, ${z.toFixed(1)}) por ${ownerId}! Detonação em 5 segundos.`);
  }

  detonateC4(state: ArenaState, c4: C4MineSchema): void {
    console.log(`[CombatSystem] 💥 KABOOM! C4 detonada em (${c4.x.toFixed(1)}, ${c4.z.toFixed(1)})!`);
    const blastRadius = C4_EXPLOSION_RADIUS;
    const blastDmg = C4_EXPLOSION_DAMAGE;
    const owner = state.players.get(c4.ownerId);

    // Dano devastador nos zumbis dentro do raio de detonação
    state.zombies.forEach((zombie) => {
      if (zombie.state !== "alive") return;
      const dx = zombie.x - c4.x;
      const dz = zombie.z - c4.z;
      const dist = Math.hypot(dx, dz);
      const config = ENEMY_CONFIGS[zombie.type as EnemyTypeId] ?? ENEMY_CONFIGS.standard;

      if (dist <= blastRadius + config.radius) {
        zombie.hp = Math.max(0, zombie.hp - blastDmg);
        if (zombie.hp === 0) {
          this.handleZombieDeath(state, zombie, owner);
        } else {
          zombie.isAggro = true;
          zombie.aiMode = "chasing";
        }
      }
    });

    // Dano moderado a jogadores desavisados muito próximos à detonação (aviso tático: afaste-se!)
    state.players.forEach((player) => {
      if (player.hp <= 0 || !player.inWorld) return;
      const dx = player.x - c4.x;
      const dz = player.z - c4.z;
      const dist = Math.hypot(dx, dz);
      if (dist <= 3.2) {
        const pDmg = dist < 1.6 ? 2 : 1;
        this.applyDamage(player, pDmg);
      }
    });
  }

  applyDamage(target: PlayerSchema, rawDamage: number): void {
    if (target.isGodMode) {
      target.hp = PLAYER_MAX_HP;
      return;
    }
    let dmg = rawDamage;
    if (target.armor > 0) {
      if (target.armor >= dmg) {
        target.armor -= dmg;
        return;
      } else {
        dmg -= target.armor;
        target.armor = 0;
      }
    }
    if (dmg > 0) {
      target.hp = Math.max(0, target.hp - dmg);
    }
  }

  startReload(player: PlayerSchema, id: string): void {
    if (player.reloading || player.ammo >= (player.maxAmmo || MAGAZINE_SIZE) || player.reserveAmmo <= 0) return;
    this.reloadTimers.set(id, RELOAD_TIME);
    player.reloading = true;
    player.reloadProgress = 0;
  }

  triggerReload(playerId: string, state: ArenaState): void {
    const player = state.players.get(playerId);
    if (!player || player.hp <= 0) return;
    this.startReload(player, playerId);
  }

  /**
   * Aplica o dano de um tiro que acertou um zumbi na tela do atirador. Cada disparo real feito pelo
   * servidor vale um acerto; acertos sem disparo correspondente, de zumbis mortos ou longe demais
   * do atirador são ignorados.
   */
  applyClientHit(state: ArenaState, playerId: string, zombieId: unknown): void {
    const credits = this.shotCredits.get(playerId);
    if (!credits || typeof zombieId !== "string") return;
    // Margem para o ping: a bala local pode ter voado até BULLET_LIFETIME antes do acerto chegar
    while (credits.length > 0 && this.clock - credits[0]!.firedAt > BULLET_LIFETIME + 1.5) credits.shift();
    const shot = credits[0];
    const player = state.players.get(playerId);
    const zombie = state.zombies.get(zombieId);
    if (!shot || !player || !zombie || zombie.state !== "alive") return;

    const maxRange = BULLET_SPEED * BULLET_LIFETIME + 4;
    if ((zombie.x - player.x) ** 2 + (zombie.z - player.z) ** 2 > maxRange * maxRange) return;

    credits.shift();
    zombie.hp = Math.max(0, zombie.hp - (shot.damage || BULLET_DAMAGE));
    if (zombie.hp === 0) {
      this.handleZombieDeath(state, zombie, player);
    } else {
      // Se tomou tiro e sobreviveu, fica furioso e persegue o atirador!
      zombie.isAggro = true;
      zombie.aiMode = "chasing";
    }
  }

  removePlayer(playerId: string): void {
    this.cooldowns.delete(playerId);
    this.shotCredits.delete(playerId);
    this.reloadTimers.delete(playerId);
  }

  reset(): void {
    this.cooldowns.clear();
    this.shotCredits.clear();
    this.reloadTimers.clear();
  }

  /**
   * Finaliza um zumbi morto: altera estado para "dead", concede moedas ao algoz
   * e dropa relíquias caso seja um dos 4 chefes.
   */
  private handleZombieDeath(state: ArenaState, zombie: ZombieSchema, killer?: PlayerSchema): void {
    zombie.state = "dead";
    zombie.corpseTimer = CORPSE_DECAY_TIME;
    const config = ENEMY_CONFIGS[zombie.type as EnemyTypeId] ?? ENEMY_CONFIGS.standard;
    const reward = config.isBoss ? 25 : config.id === "tank" ? 3 : (config.id === "spitter" || config.id === "mortar") ? 2 : 1;
    if (killer) {
      killer.coins += reward;
    }
    this.handleZombieDrop(state, zombie);
  }

  /**
   * Dropar item específico do chefe no chão da arena:
   * - Homem do Pântano (boss) -> Muda de planta ("plant_sprout")
   * - Rainha Aracnídea (spider_boss) -> Cabeça da aranha ("spider_head")
   * - Lobisomem (werewolf_boss) -> Dente do lobisomem ("werewolf_tooth")
   * - Homem do Saco (sack_boss) -> Saco ("sack")
   */
  private handleZombieDrop(state: ArenaState, zombie: ZombieSchema): void {
    let dropKind = "";
    if (zombie.type === "boss") {
      dropKind = "plant_sprout";
    } else if (zombie.type === "spider_boss") {
      dropKind = "spider_head";
    } else if (zombie.type === "werewolf_boss") {
      dropKind = "werewolf_tooth";
    } else if (zombie.type === "sack_boss") {
      dropKind = "sack";
    }

    if (!dropKind) return;

    this.dropCounter++;
    const dropId = `dropped_relic_${dropKind}_${this.dropCounter}_${Date.now()}`;
    const drop = new AmmoBoxSchema();
    drop.id = dropId;
    drop.x = zombie.x;
    drop.y = zombie.y;
    drop.z = zombie.z;
    drop.kind = dropKind;
    drop.active = true;
    drop.respawnTimer = 0;
    drop.pickupDelay = 0.5; // Meio segundo de atraso para o item se materializar antes de ser coletado
    state.ammoBoxes.set(dropId, drop);
    console.log(`[CombatSystem] 🏆 Chefe ${zombie.type} dropou relíquia: ${dropKind} em (${drop.x.toFixed(1)}, ${drop.z.toFixed(1)})`);
  }
}
