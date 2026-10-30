import { Room, type Client } from "colyseus";
import {
  C4_BUY_COST,
  C4_MAX_CARRY,
  ClientMessage,
  DEFIBRILLATOR_BUY_COST,
  DOOR_DEFINITIONS,
  finiteOr,
  getActiveDoorColliders,
  getAmmoCost,
  GUN_TIERS,
  HELICOPTER_COUNTDOWN_SECONDS,
  HELICOPTER_RESCUE_POS,
  HELICOPTER_SKY_ALTITUDE,
  ITEM_SPAWNS,
  KNIFE_TIERS,
  MAGAZINE_SIZE,
  MAX_GUN_LEVEL,
  MAX_KNIFE_LEVEL,
  MAX_PLAYERS,
  PLAYER_COLORS,
  PLAYER_MAX_HP,
  PLAYER_NAME_MAX,
  PLAYER_RADIUS,
  resolveStatic,
  sanitizeRoomCode,
  SHOP_POS,
  START_CABIN_X,
  START_CABIN_Z,
  TICK_MS,
  wrapAngle,
  type InputMessage,
  type JoinOptions,
} from "@dark-beans/shared";
import { ArenaState } from "../schemas/ArenaState";
import { AmmoBoxSchema } from "../schemas/AmmoBoxSchema";
import { DoorSchema } from "../schemas/DoorSchema";
import { PlayerSchema } from "../schemas/PlayerSchema";
import { MovementSystem } from "../systems/MovementSystem";
import { CombatSystem } from "../systems/CombatSystem";
import { WaveSystem } from "../systems/WaveSystem";

/**
 * Sala da arena: gerencia conexões e roda o Game Loop autoritativo,
 * delegando a lógica de negócio aos Systems.
 */
export class ArenaRoom extends Room<ArenaState> {
  override maxClients = MAX_PLAYERS;

  /** Último input recebido de cada cliente (não sincronizado na rede). */
  private readonly inputs = new Map<string, InputMessage>();
  private readonly movement = new MovementSystem();
  private readonly combat = new CombatSystem();
  private readonly wave = new WaveSystem();
  private joinCounter = 0;

  override onCreate(options: JoinOptions): void {
    const code = sanitizeRoomCode(options?.code) ?? "LOBBY";
    this.setState(new ArenaState());
    this.state.code = code;
    void this.setMetadata({ code });

    // Spawna caixas de munição, armas e bandagens colecionáveis no mapa
    for (const spawn of ITEM_SPAWNS) {
      const box = new AmmoBoxSchema();
      box.id = spawn.id;
      box.kind = spawn.kind;
      box.x = spawn.x;
      box.y = spawn.y;
      box.z = spawn.z;
      box.active = true;
      this.state.ammoBoxes.set(box.id, box);
    }

    // Posição inicial do helicóptero de resgate no céu
    this.state.helicopterX = HELICOPTER_RESCUE_POS.x;
    this.state.helicopterY = HELICOPTER_SKY_ALTITUDE;
    this.state.helicopterZ = HELICOPTER_RESCUE_POS.z;
    this.state.helicopterStatus = "none";

    // Inicializa as portas interativas com física
    for (const def of DOOR_DEFINITIONS) {
      const door = new DoorSchema();
      door.id = def.id;
      door.name = def.name;
      door.x = def.x;
      door.y = def.y;
      door.z = def.z;
      door.isOpen = def.initialOpen ?? false;
      this.state.doors.set(door.id, door);
    }

    // Callback de reanimação de jogadores via Desfibrilador
    this.combat.onPlayerRevived = (reviverId, reviver, revivedId, revived) => {
      this.broadcast("player_revived", {
        reviverId,
        reviverName: reviver.name,
        revivedId,
        revivedName: revived.name,
        x: revived.x,
        y: revived.y,
        z: revived.z,
      });
    };

    this.onMessage(ClientMessage.Input, (client, raw: Partial<InputMessage>) => {
      if (!raw || typeof raw !== "object") return;
      let effectiveSlot = raw.activeSlot;
      if (typeof raw.activeSlot === "number" && raw.activeSlot >= 0 && raw.activeSlot < 4) {
        const p = this.state.players.get(client.sessionId);
        if (p) {
          const item =
            raw.activeSlot === 0
              ? p.slot0
              : raw.activeSlot === 1
              ? p.slot1
              : raw.activeSlot === 2
              ? p.slot2
              : p.slot3;
          if (item) {
            p.activeSlot = raw.activeSlot;
          } else {
            // Slot vazio (ex: Homem do Saco derrubou a arma), força faca (slot 0)
            p.activeSlot = 0;
            effectiveSlot = 0;
          }
        }
      }
      this.inputs.set(client.sessionId, {
        dx: Math.max(-1, Math.min(1, finiteOr(raw.dx, 0))),
        dz: Math.max(-1, Math.min(1, finiteOr(raw.dz, 0))),
        aimAngle: wrapAngle(finiteOr(raw.aimAngle, 0)),
        shooting: raw.shooting === true,
        reloading: raw.reloading === true,
        activeSlot: effectiveSlot,
        jump: raw.jump === true,
        seq: finiteOr(raw.seq, 0),
      });
    });

    this.onMessage(ClientMessage.Reload, (client) => {
      this.combat.triggerReload(client.sessionId, this.state);
    });

    this.onMessage(ClientMessage.SelectSlot, (client, data: { slot?: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (p && typeof data?.slot === "number" && data.slot >= 0 && data.slot < 4) {
        const item =
          data.slot === 0 ? p.slot0 : data.slot === 1 ? p.slot1 : data.slot === 2 ? p.slot2 : p.slot3;
        if (item) {
          p.activeSlot = data.slot;
        } else {
          p.activeSlot = 0;
        }
      }
    });

    // ─── Mini Loja / Compra de Equipamentos ─────────────────────────────
    this.onMessage(ClientMessage.BuyItem, (client, data: { item?: string }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || p.hp <= 0) return;

      // Valida proximidade da loja na clareira (com tolerância generosa para evitar falhas por jitter ou repulsão)
      const dist = Math.hypot(p.x - SHOP_POS.x, p.z - SHOP_POS.z);
      if (dist > SHOP_POS.radius + 4.0) {
        console.warn(`[ArenaRoom] Compra rejeitada: ${p.name} fora de alcance (${dist.toFixed(2)}m)`);
        return;
      }

      const item = data?.item;

      // 1) Faca Melhor (Até o nível 7)
      if (item === "knife_upgrade") {
        const curLvl = p.knifeLevel || 1;
        if (curLvl < MAX_KNIFE_LEVEL) {
          const nextTier = KNIFE_TIERS.find((t) => t.level === curLvl + 1);
          if (nextTier && p.coins >= nextTier.upgradeCost) {
            p.coins -= nextTier.upgradeCost;
            p.knifeLevel += 1;
            if (p.slot0 !== "knife") p.slot0 = "knife";
            console.log(`[ArenaRoom] ${p.name} melhorou Faca para Nv. ${p.knifeLevel} (${nextTier.name})`);
          }
        }
      }
      // 2) Arma Melhor (Até o nível 7: Pistola -> Deagle -> Uzi -> SMG -> Rifle -> Rifle Avançado)
      else if (item === "gun_upgrade") {
        const curLvl = p.gunLevel || 1;
        if (curLvl < MAX_GUN_LEVEL) {
          const nextTier = GUN_TIERS.find((t) => t.level === curLvl + 1);
          if (nextTier && p.coins >= nextTier.upgradeCost) {
            p.coins -= nextTier.upgradeCost;
            p.gunLevel += 1;
            p.maxAmmo = nextTier.maxAmmo;
            p.ammo = p.maxAmmo;
            p.reserveAmmo += p.maxAmmo;
            // Equipa no slot 1 (ou primeiro disponível)
            if (p.slot0 !== "pistol" && p.slot1 !== "pistol" && p.slot2 !== "pistol") {
              if (!p.slot1) p.slot1 = "pistol";
              else if (!p.slot2) p.slot2 = "pistol";
              else p.slot1 = "pistol";
            }
            console.log(`[ArenaRoom] ${p.name} melhorou Arma para Nv. ${p.gunLevel} (${nextTier.name})`);
          }
        }
      }
      // 3) Bandagem Médica
      else if (item === "bandage") {
        const cost = 2;
        if (p.coins >= cost) {
          const ok = this.combat.assignToUtilitySlot(this.state, p, "bandage", 1, 3);
          if (ok) {
            p.coins -= cost;
            console.log(`[ArenaRoom] ${p.name} comprou Bandagem (${p.bandageCount}/3)`);
          }
        }
      }
      // 4) C4 Explosivo Tático (Timer 5s + Distração)
      else if (item === "c4") {
        const cost = C4_BUY_COST;
        if (p.coins >= cost) {
          const ok = this.combat.assignToUtilitySlot(this.state, p, "c4", 1, C4_MAX_CARRY);
          if (ok) {
            p.coins -= cost;
            console.log(`[ArenaRoom] ${p.name} comprou C4 Explosivo (${p.c4Count}/${C4_MAX_CARRY})`);
          }
        }
      }
      // 5) Armadura (Upgrade permanente: 4 ➔ 6 ➔ 8 ➔ 10 ➔ 12 ➔ 14)
      else if (item === "armor") {
        const cost = 5;
        if (p.maxArmor < 14) {
          if (p.coins >= cost) {
            p.coins -= cost;
            p.maxArmor = Math.min(14, (p.maxArmor || 4) + 2);
            p.armor = p.maxArmor; // Recarrega totalmente os pontos de armadura
            console.log(`[ArenaRoom] 🛡️ ${p.name} melhorou a Armadura para ${p.maxArmor} Pts!`);
          }
        }
      }
      // 5) Munição (Comprada apenas na loja: +1 pente na reserva; preço fixo em 1 moeda)
      else if (item === "ammo") {
        const cost = getAmmoCost(p.gunLevel);
        if (p.coins >= cost) {
          p.coins -= cost;
          p.reserveAmmo += p.maxAmmo || MAGAZINE_SIZE;
          console.log(`[ArenaRoom] ${p.name} comprou Munição por ${cost} moeda`);
        }
      }
      // 5.5) Desfibrilador (Dispositivo Médico para Reviver Amigo Morto - 30 moedas)
      else if (item === "defibrillator") {
        const cost = DEFIBRILLATOR_BUY_COST;
        if (p.coins >= cost) {
          const ok = this.combat.assignToUtilitySlot(this.state, p, "defibrillator", 1, 1);
          if (ok) {
            p.coins -= cost;
            console.log(`[ArenaRoom] ⚡ ${p.name} comprou o Desfibrilador por ${cost} moedas!`);
          }
        }
      }
      // 6) Sinalizador (Desbloqueio Cooperativo: 2 jogadores perto da loja, cada um com 2 drops diferentes)
      else if (item === "flare" || item === "sinalizador") {
        const BOSS_RELICS = ["plant_sprout", "spider_head", "werewolf_tooth", "sack"];
        const getRelics = (target: PlayerSchema): string[] => {
          const relics: string[] = [];
          if (target.slot2 && BOSS_RELICS.includes(target.slot2) && !relics.includes(target.slot2)) {
            relics.push(target.slot2);
          }
          if (target.slot3 && BOSS_RELICS.includes(target.slot3) && !relics.includes(target.slot3)) {
            relics.push(target.slot3);
          }
          return relics;
        };

        const isNearShop = (target: PlayerSchema): boolean => {
          const d = Math.hypot(target.x - SHOP_POS.x, target.z - SHOP_POS.z);
          return d <= SHOP_POS.radius + 4.0;
        };

        if (!isNearShop(p)) {
          console.warn(`[ArenaRoom] ${p.name} tentou comprar Sinalizador fora do raio da loja.`);
          return;
        }

        const pRelics = getRelics(p);
        if (pRelics.length !== 2) {
          console.warn(`[ArenaRoom] ${p.name} tentou comprar Sinalizador, mas possui ${pRelics.length}/2 drops de chefes.`);
          return;
        }

        // Busca o parceiro: outro jogador vivo e perto da loja que possua os outros 2 drops diferentes
        let partner: PlayerSchema | null = null;
        let partnerRelics: string[] = [];

        this.state.players.forEach((other, otherId) => {
          if (otherId === client.sessionId || other.hp <= 0 || partner) return;
          if (isNearShop(other)) {
            const r = getRelics(other);
            if (r.length === 2) {
              const combined = new Set([...pRelics, ...r]);
              if (combined.size === 4 && BOSS_RELICS.every((br) => combined.has(br))) {
                partner = other;
                partnerRelics = r;
              }
            }
          }
        });

        if (partner && partnerRelics.length === 2) {
          const partnerPlayer = partner as PlayerSchema;

          // Consome os 2 drops do jogador que comprou
          if (BOSS_RELICS.includes(p.slot2)) p.slot2 = "";
          if (BOSS_RELICS.includes(p.slot3)) p.slot3 = "";
          p.hasPlantSprout = false;
          p.hasSpiderHead = false;
          p.hasWerewolfTooth = false;
          p.hasSack = false;

          // Consome os 2 drops do parceiro cooperativo
          if (BOSS_RELICS.includes(partnerPlayer.slot2)) partnerPlayer.slot2 = "";
          if (BOSS_RELICS.includes(partnerPlayer.slot3)) partnerPlayer.slot3 = "";
          partnerPlayer.hasPlantSprout = false;
          partnerPlayer.hasSpiderHead = false;
          partnerPlayer.hasWerewolfTooth = false;
          partnerPlayer.hasSack = false;

          // Entrega o Sinalizador em um dos slots utilitários do jogador que clicou
          this.combat.assignToUtilitySlot(this.state, p, "flare", 1, 1);
          console.log(`[ArenaRoom] 🏮✨ SINALIZADOR DESBLOQUEADO! ${p.name} e ${partnerPlayer.name} uniram os 4 drops perto da loja! Sinalizador concedido a ${p.name}.`);
        } else {
          console.warn(`[ArenaRoom] ${p.name} tentou comprar Sinalizador, mas o parceiro cooperativo não está perto com os outros 2 drops.`);
        }
      }
    });

    // ─── Interação com Portas (Abrir / Fechar com a tecla [E]) ─────────
    this.onMessage(ClientMessage.InteractDoor, (client, data: { doorId?: string }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || p.hp <= 0) return;

      let targetDoor: DoorSchema | undefined;
      if (typeof data?.doorId === "string") {
        targetDoor = this.state.doors.get(data.doorId);
      }
      if (!targetDoor) {
        // Encontra a porta mais próxima do jogador
        let minDist = Infinity;
        this.state.doors.forEach((door) => {
          const def = DOOR_DEFINITIONS.find((d) => d.id === door.id);
          const radius = def ? def.interactionRadius : 3.0;
          const dist = Math.hypot(p.x - door.x, p.z - door.z);
          if (dist <= radius + 0.8 && dist < minDist) {
            minDist = dist;
            targetDoor = door;
          }
        });
      }

      if (!targetDoor) return;

      const def = DOOR_DEFINITIONS.find((d) => d.id === targetDoor!.id);
      const maxReach = (def?.interactionRadius ?? 2.8) + 1.2;
      const dist = Math.hypot(p.x - targetDoor.x, p.z - targetDoor.z);
      if (dist > maxReach) {
        console.warn(`[ArenaRoom] Interação com porta recusada: fora de alcance (${dist.toFixed(2)}m)`);
        return;
      }

      targetDoor.isOpen = !targetDoor.isOpen;
      console.log(`[ArenaRoom] ${p.name} ${targetDoor.isOpen ? "ABRIU" : "FECHOU"} a porta '${targetDoor.name}'`);
    });

    // ─── Respawn / Reinício do jogo após morte ─────────────────────────
    this.onMessage(ClientMessage.Respawn, (client) => {
      const deadPlayer = this.state.players.get(client.sessionId);
      if (!deadPlayer) return;

      // Conta outros sobreviventes ainda vivos na sala
      let livingCount = 0;
      this.state.players.forEach((p, sid) => {
        if (sid !== client.sessionId && p.hp > 0) {
          livingCount++;
        }
      });

      const resetPlayerState = (p: PlayerSchema, sessionId: string) => {
        p.hp = PLAYER_MAX_HP;
        p.coins = 0;
        p.armor = 4;
        p.maxArmor = 4;
        p.webbedTimer = 0;
        p.reloading = false;
        p.reloadProgress = 0;

        p.hasPlantSprout = false;
        p.hasSpiderHead = false;
        p.hasWerewolfTooth = false;
        p.hasSack = false;

        p.slot0 = "knife";
        p.slot1 = "pistol";
        p.slot2 = "";
        p.slot3 = "";
        p.flareActive = false;
        p.knifeLevel = 1;
        p.gunLevel = 1;
        p.ammo = MAGAZINE_SIZE;
        p.reserveAmmo = MAGAZINE_SIZE;
        p.activeSlot = 0;
        p.bandageCount = 0;
        p.c4Count = 0;

        const clientIndex = Array.from(this.state.players.keys()).indexOf(sessionId);
        const safeIndex = clientIndex >= 0 ? clientIndex : 0;
        const offsetX = ((safeIndex % 3) - 1) * 0.55;
        const offsetZ = (Math.floor(safeIndex / 3) - 0.5) * 0.55;
        const pos = {
          x: START_CABIN_X + offsetX,
          z: START_CABIN_Z + offsetZ,
        };
        resolveStatic(pos, PLAYER_RADIUS);
        p.x = pos.x;
        p.y = 0;
        p.z = pos.z;
        p.aimAngle = Math.PI / 2;

        this.movement.resetPlayer(sessionId);
        this.combat.removePlayer(sessionId);
        this.inputs.set(sessionId, {
          dx: 0,
          dz: 0,
          aimAngle: Math.PI / 2,
          shooting: false,
          reloading: false,
          activeSlot: 0,
          jump: false,
          seq: 0,
        });
      };

      if (livingCount > 0) {
        // Cooperativo: O corpo do personagem deve permanecer caído até alguém reviver ou o jogo reiniciar
        console.log(`[ArenaRoom] Respawn individual bloqueado para ${deadPlayer.name}: aliados ainda vivos! Corpo permanece caído até reviver.`);
        return;
      }

      // Se todos estiverem mortos (modo solo ou wipe da equipe): reinicia toda a partida
      this.state.players.forEach((p, sessionId) => {
        resetPlayerState(p, sessionId);
      });

      // 2) Reseta o sistema de hordas, zumbis, tempo e combate para o início da partida
      this.wave.resetMatch(this.state);
      this.combat.reset();

      // 3) Limpa projéteis e minas C4
      this.state.bullets.clear();
      this.state.c4Mines.clear();

      // 4) Reseta portas interativas para o estado inicial
      for (const def of DOOR_DEFINITIONS) {
        const door = this.state.doors.get(def.id);
        if (door) {
          door.isOpen = def.initialOpen ?? false;
        }
      }

      // 5) Reseta todas as caixas de munição e coletáveis no mapa
      this.state.ammoBoxes.clear();
      for (const spawn of ITEM_SPAWNS) {
        const box = new AmmoBoxSchema();
        box.id = spawn.id;
        box.kind = spawn.kind;
        box.x = spawn.x;
        box.y = spawn.y;
        box.z = spawn.z;
        box.active = true;
        this.state.ammoBoxes.set(box.id, box);
      }

      // 6) Reseta helicóptero de resgate e status de vitória
      this.state.flareTriggered = false;
      this.state.rescueTimer = 0;
      this.state.helicopterStatus = "none";
      this.state.helicopterX = HELICOPTER_RESCUE_POS.x;
      this.state.helicopterY = HELICOPTER_SKY_ALTITUDE;
      this.state.helicopterZ = HELICOPTER_RESCUE_POS.z;
      this.state.gameWon = false;
      this.state.gameWonMessage = "";

      console.log(`[ArenaRoom] Partida reiniciada para o início do jogo a pedido de ${client.sessionId}!`);
    });

    // ─── Debug: Forçar Disparo de Horda (ex: Horda 5 para testes rápidos) ─
    this.onMessage(ClientMessage.DebugTriggerHorde, (_client, data: { hordeNumber?: number; immediateBoss?: boolean }) => {
      const hNum = data?.hordeNumber ?? 5;
      const immediateBoss = data?.immediateBoss ?? false;
      this.wave.debugTriggerHorde(this.state, hNum, immediateBoss);
    });

    // ─── Entrada no Mundo / Início Real da Partida ──────────────────────
    this.onMessage(ClientMessage.EnterWorld, (client) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      if (!p.inWorld) {
        p.inWorld = true;
        p.hp = PLAYER_MAX_HP;
        console.log(`[ArenaRoom ${this.state.code}] 🎮 ${p.name} (${client.sessionId}) ENTROU NO MUNDO!`);
      }
    });

    // ─── Uso do Desfibrilador para Reanimar Amigo ───────────────────────
    this.onMessage(ClientMessage.UseDefibrillator, (client) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || p.hp <= 0 || !p.inWorld) return;
      const curItem =
        p.activeSlot === 0 ? p.slot0 : p.activeSlot === 1 ? p.slot1 : p.activeSlot === 2 ? p.slot2 : p.slot3;
      if (curItem !== "defibrillator") return;

      this.combat.tryDefibrillate(this.state, client.sessionId, p);
    });

    // ─── Debug: Morte do jogador para teste de Game Over ──────────────
    this.onMessage("debug_kill_me", (client) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      p.hp = 0;
      console.log(`[DEBUG] ${p.name} eliminado via debug_kill_me!`);
    });

    // ─── Tecla X / Debug: Modo Imortal (God Mode) ─────────────────────
    this.onMessage("toggle_god_mode", (client) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      p.isGodMode = !p.isGodMode;
      if (p.isGodMode) {
        p.hp = PLAYER_MAX_HP;
      }
      console.log(`[DEBUG] ⚡ God Mode para ${p.name}: ${p.isGodMode ? "ATIVADO (IMORTAL)" : "DESATIVADO"}`);
    });

    // ─── Debug: Spawn de Relíquia de Chefe ─────────────────────────────
    this.onMessage("debug_drop_relic", (client, data: { kind?: string; x?: number; z?: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      if (data?.kind === "all" || data?.kind === "bosses") {
        const BOSS_ITEMS = [
          { kind: "plant_sprout", dx: 1.5, dz: 0 },    // Leste
          { kind: "spider_head", dx: 0, dz: 1.5 },     // Norte
          { kind: "werewolf_tooth", dx: -1.5, dz: 0 }, // Oeste
          { kind: "sack", dx: 0, dz: -1.5 },           // Sul
        ];
        const now = Date.now();
        BOSS_ITEMS.forEach((item, index) => {
          const drop = new AmmoBoxSchema();
          drop.id = `dropped_boss_item_${item.kind}_${now}_${index}`;
          drop.x = p.x + item.dx;
          drop.y = p.y;
          drop.z = p.z + item.dz;
          drop.kind = item.kind;
          drop.active = true;
          drop.respawnTimer = 0;
          drop.pickupDelay = 0;
          this.state.ammoBoxes.set(drop.id, drop);
        });
        console.log(`[DEBUG] Todos os 4 drops de chefes gerados próximos a ${p.name}`);
        return;
      }
      const kind = data?.kind ?? "plant_sprout";
      const drop = new AmmoBoxSchema();
      drop.id = `dropped_relic_${kind}_${Date.now()}`;
      drop.x = typeof data?.x === "number" ? data.x : p.x + 1.2;
      drop.y = p.y;
      drop.z = typeof data?.z === "number" ? data.z : p.z;
      drop.kind = kind;
      drop.active = true;
      drop.respawnTimer = 0;
      drop.pickupDelay = 0;
      this.state.ammoBoxes.set(drop.id, drop);
      console.log(`[DEBUG] Drop de relíquia gerado: ${kind} próximo a ${p.name}`);
    });

    // ─── Debug: Spawn de todos os 4 itens de chefes ao redor do jogador ─
    this.onMessage("debug_spawn_all_boss_drops", (client) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      const BOSS_ITEMS = [
        { kind: "plant_sprout", dx: 1.5, dz: 0 },    // Leste
        { kind: "spider_head", dx: 0, dz: 1.5 },     // Norte
        { kind: "werewolf_tooth", dx: -1.5, dz: 0 }, // Oeste
        { kind: "sack", dx: 0, dz: -1.5 },           // Sul
      ];
      const now = Date.now();
      BOSS_ITEMS.forEach((item, index) => {
        const drop = new AmmoBoxSchema();
        drop.id = `dropped_boss_item_${item.kind}_${now}_${index}`;
        drop.x = p.x + item.dx;
        drop.y = p.y;
        drop.z = p.z + item.dz;
        drop.kind = item.kind;
        drop.active = true;
        drop.respawnTimer = 0;
        drop.pickupDelay = 0;
        this.state.ammoBoxes.set(drop.id, drop);
      });
      console.log(`[DEBUG] 4 itens de chefes spawnados no chão ao lado de ${p.name}!`);
    });

    // ─── Debug: Conceder todos os 4 drops dos chefes ───────────────────
    this.onMessage("debug_give_all_drops", (client) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      p.hasPlantSprout = true;
      p.hasSpiderHead = true;
      p.hasWerewolfTooth = true;
      p.hasSack = true;
      console.log(`[DEBUG] Todos os 4 drops dos chefes concedidos a ${p.name}`);
    });

    // ─── Debug: Conceder moedas para testes ────────────────────────────
    this.onMessage("debug_give_coins", (client, data: { amount?: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      p.coins += data?.amount ?? 50;
      console.log(`[DEBUG] Concedido ${data?.amount ?? 50} moedas para ${p.name}`);
    });

    // ─── Debug: Teleportar jogador para testes de proximidade ─────────
    this.onMessage("debug_teleport", (client, data: { x: number; z: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      p.x = data.x;
      p.z = data.z;
      console.log(`[DEBUG] Teleportado ${p.name} para (${p.x}, ${p.z})`);
    });

    // ─── Atualização de Aparência / Nome em Tempo Real no Lobby ────────
    this.onMessage("update_appearance", (client, data: { name?: string; color?: string; hair?: string; eyes?: string; beard?: string; hat?: string }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      if (typeof data.name === "string" && data.name.trim()) {
        p.name = this.sanitizeName(data.name, 0);
      }
      if (typeof data.color === "string" && /^#[0-9a-fA-F]{6}$/.test(data.color)) {
        p.color = data.color;
      }
      if (typeof data.hair === "string") p.hair = data.hair;
      if (typeof data.eyes === "string") p.eyes = data.eyes;
      if (typeof data.beard === "string") p.beard = data.beard;
      if (typeof data.hat === "string") p.hat = data.hat;
    });

    // ─── Debug: Forçar Disparo do Sinalizador ─────────────────────────
    this.onMessage("debug_trigger_flare", (client) => {
      const p = this.state.players.get(client.sessionId);
      if (p) {
        p.flareActive = true;
      }
      this.state.flareTriggered = true;
      this.state.rescueTimer = HELICOPTER_COUNTDOWN_SECONDS;
      this.state.helicopterStatus = "incoming";
      this.state.helicopterX = HELICOPTER_RESCUE_POS.x;
      this.state.helicopterY = HELICOPTER_SKY_ALTITUDE;
      this.state.helicopterZ = HELICOPTER_RESCUE_POS.z;
      console.log(`[DEBUG] 🚁 Sinalizador disparado via debug! Resgate em ${HELICOPTER_COUNTDOWN_SECONDS}s`);
    });

    // ─── Debug: Ajustar temporizador do helicóptero ───────────────────
    this.onMessage("debug_set_rescue_timer", (_client, data: { seconds?: number }) => {
      this.state.flareTriggered = true;
      this.state.rescueTimer = data?.seconds ?? 3.0;
      this.state.helicopterStatus = "incoming";
      console.log(`[DEBUG] 🚁 Temporizador de resgate ajustado para ${this.state.rescueTimer}s`);
    });

    this.setPatchRate(TICK_MS);
    this.setSimulationInterval((deltaMs) => this.update(deltaMs / 1000), TICK_MS);

    console.log(`[ArenaRoom] sala ${code} criada (${this.roomId})`);
  }

  override onJoin(client: Client, options: JoinOptions): void {
    const player = new PlayerSchema();
    const index = this.joinCounter++;

    const sanitizeCosmetic = (val: unknown, allowed: string[], fallback: string): string => {
      return typeof val === "string" && allowed.includes(val) ? val : fallback;
    };

    player.name = this.sanitizeName(options?.name, index);
    player.color =
      typeof options?.color === "string" && /^#[0-9a-fA-F]{6}$/.test(options.color)
        ? options.color
        : this.pickColor();
    player.hair = sanitizeCosmetic(options?.hair, ["bald", "buzzcut", "medium", "pompadour", "long", "bowl"], "bald");
    player.eyes = sanitizeCosmetic(
      options?.eyes,
      ["oval_large", "oval_medium", "oval_small", "round_large", "round_medium", "round_small"],
      "oval_medium",
    );
    player.beard = sanitizeCosmetic(
      options?.beard,
      ["none", "mustache", "goatee_mustache", "goatee", "full_short", "full_medium", "full_thick"],
      "none",
    );
    player.hat = sanitizeCosmetic(options?.hat, ["none", "bucket", "tophat", "cap", "beanie"], "none");

    // Começa já com a faca mais básica e a arma mais básica (carregada com balas)
    player.slot0 = "knife";
    player.slot1 = "pistol";
    player.slot2 = "";
    player.knifeLevel = 1;
    player.gunLevel = 1;
    player.ammo = MAGAZINE_SIZE;
    player.reserveAmmo = MAGAZINE_SIZE;

    // Nasce dentro da casinha inicial à esquerda do mapa (pequeno quarto com porta)
    const offsetX = ((index % 3) - 1) * 0.55;
    const offsetZ = (Math.floor(index / 3) - 0.5) * 0.55;
    const pos = {
      x: START_CABIN_X + offsetX,
      z: START_CABIN_Z + offsetZ,
    };
    resolveStatic(pos, PLAYER_RADIUS);
    player.x = pos.x;
    player.y = 0;
    player.z = pos.z;
    player.aimAngle = Math.PI / 2; // Olhando para a porta (+X, em direção à saída da casa)
    player.inWorld = false; // Começa no menu/staging, só entra no mundo ao clicar 'ENTRAR NA ARENA'

    this.state.players.set(client.sessionId, player);
    console.log(`[ArenaRoom ${this.state.code}] ${player.name} entrou (${this.clients.length}/${this.maxClients})`);
  }

  override onLeave(client: Client): void {
    const player = this.state.players.get(client.sessionId);
    this.state.players.delete(client.sessionId);
    this.inputs.delete(client.sessionId);
    this.movement.removePlayer(client.sessionId);
    this.combat.removePlayer(client.sessionId);
    console.log(`[ArenaRoom ${this.state.code}] ${player?.name ?? client.sessionId} saiu`);
  }

  override onDispose(): void {
    console.log(`[ArenaRoom] sala ${this.state.code} encerrada`);
  }

  private update(dt: number): void {
    // Limita dt para evitar "teleportes" se o processo engasgar
    const safeDt = Math.min(dt, 0.1);

    // Contabiliza apenas jogadores que efetivamente entraram no mundo da arena
    let activeInWorldCount = 0;
    let livingInWorldCount = 0;
    this.state.players.forEach((p) => {
      if (p.inWorld) {
        activeInWorldCount++;
        if (p.hp > 0) livingInWorldCount++;
      }
    });

    // Se nenhum jogador entrou no mundo ainda (estão todos na criação/staging de personagem),
    // o jogo NÃO começa ao fundo! A simulação fica completamente congelada/aguardando.
    if (activeInWorldCount === 0) {
      return;
    }

    // Se a partida foi vencida, o helicóptero decola e a vitória é mantida
    if (this.state.gameWon) {
      if (this.state.helicopterStatus === "escaped") {
        this.state.helicopterY = Math.min(HELICOPTER_SKY_ALTITUDE + 10, this.state.helicopterY + 14.0 * safeDt);
      }
      return;
    }

    // Se todos os sobreviventes ativos no mundo estiverem mortos, pausa a simulação
    if (livingInWorldCount === 0) {
      return;
    }

    const doorColliders = getActiveDoorColliders(this.state.doors);
    this.movement.update(this.state.players, this.inputs, safeDt, doorColliders);
    this.combat.update(this.state, this.inputs, safeDt, doorColliders);
    this.wave.update(this.state, safeDt, doorColliders);

    // ─── Lógica do Helicóptero de Resgate e Evacuação ──────────────────
    this.updateHelicopterRescue(safeDt);
  }

  /**
   * Gerencia a contagem de 30 segundos da vida real após o sinalizador ser disparado,
   * a descida do helicóptero do céu até a parte de cima do mapa (heliponto) e a verificação
   * se todos os jogadores vivos alcançaram o helicóptero para vencer o jogo.
   */
  private updateHelicopterRescue(dt: number): void {
    // 1) Detecta ativação do sinalizador por qualquer sobrevivente em jogo
    if (!this.state.flareTriggered) {
      for (const p of this.state.players.values()) {
        if (p.inWorld && p.flareActive) {
          this.state.flareTriggered = true;
          this.state.rescueTimer = HELICOPTER_COUNTDOWN_SECONDS;
          this.state.helicopterStatus = "incoming";
          this.state.helicopterX = HELICOPTER_RESCUE_POS.x;
          this.state.helicopterY = HELICOPTER_SKY_ALTITUDE;
          this.state.helicopterZ = HELICOPTER_RESCUE_POS.z;
          console.log(`[ArenaRoom ${this.state.code}] 🚨🔥 SINALIZADOR ATIVADO por ${p.name}! Helicóptero de resgate descerá em ${HELICOPTER_COUNTDOWN_SECONDS} segundos!`);
          break;
        }
      }
    }

    // 2) Contagem regressiva de 30 segundos reais
    if (this.state.helicopterStatus === "incoming") {
      this.state.rescueTimer = Math.max(0, this.state.rescueTimer - dt);
      if (this.state.rescueTimer <= 0) {
        this.state.helicopterStatus = "landing";
        console.log(`[ArenaRoom ${this.state.code}] 🚁 O Helicóptero de Resgate chegou aos céus e está pousando na parte de cima do mapa!`);
      }
    }

    // 3) Descida suave do helicóptero das nuvens até o solo (heliponto no norte)
    else if (this.state.helicopterStatus === "landing") {
      const descentSpeed = 9.5; // m/s
      this.state.helicopterY = Math.max(HELICOPTER_RESCUE_POS.y, this.state.helicopterY - descentSpeed * dt);
      if (this.state.helicopterY <= HELICOPTER_RESCUE_POS.y + 0.05) {
        this.state.helicopterY = HELICOPTER_RESCUE_POS.y;
        this.state.helicopterStatus = "landed";
        console.log(`[ArenaRoom ${this.state.code}] 🚁 Helicóptero POUSOU na parte de cima (${HELICOPTER_RESCUE_POS.x}, ${HELICOPTER_RESCUE_POS.z})! Aguardando os sobreviventes entrarem!`);
      }
    }

    // 4) Helicóptero no solo: verifica se o usuário e seu amigo chegaram
    else if (this.state.helicopterStatus === "landed") {
      const livingPlayers: PlayerSchema[] = [];
      this.state.players.forEach((p) => {
        if (p.inWorld && p.hp > 0) {
          livingPlayers.push(p);
        }
      });

      if (livingPlayers.length > 0) {
        const atHelicopter = livingPlayers.filter((p) => {
          const dist = Math.hypot(p.x - this.state.helicopterX, p.z - this.state.helicopterZ);
          return dist <= HELICOPTER_RESCUE_POS.radius;
        });

        // Se todos os sobreviventes vivos em campo alcançaram o helicóptero
        if (atHelicopter.length === livingPlayers.length) {
          this.state.gameWon = true;
          this.state.helicopterStatus = "escaped";
          this.state.gameWonMessage = "VOCÊS SOBREVIVERAM! O JOGO ACABOU.";
          console.log(`[ArenaRoom ${this.state.code}] 🏆🚁 VITÓRIA ABSOLUTA! Todos os ${livingPlayers.length} sobrevivente(s) entraram no helicóptero! Evacuação concluída.`);
        }
      }
    }
  }

  private sanitizeName(raw: unknown, index: number): string {
    const name = typeof raw === "string" ? raw.replace(/[^\p{L}\p{N} _\-.]/gu, "").trim().slice(0, PLAYER_NAME_MAX) : "";
    return name || `Bean ${index + 1}`;
  }

  private pickColor(): string {
    const used = new Set<string>();
    this.state.players.forEach((p) => used.add(p.color));
    return PLAYER_COLORS.find((c) => !used.has(c)) ?? PLAYER_COLORS[this.joinCounter % PLAYER_COLORS.length]!;
  }
}
