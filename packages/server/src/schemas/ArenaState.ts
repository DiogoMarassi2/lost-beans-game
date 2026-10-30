import { MapSchema, Schema, type } from "@colyseus/schema";
import { PlayerSchema } from "./PlayerSchema";
import { BulletSchema } from "./BulletSchema";
import { ZombieSchema } from "./ZombieSchema";
import { AmmoBoxSchema } from "./AmmoBoxSchema";
import { SlimePuddleSchema } from "./SlimePuddleSchema";
import { SpitProjectileSchema } from "./SpitProjectileSchema";
import { MortarLobSchema } from "./MortarLobSchema";
import { DoorSchema } from "./DoorSchema";
import { C4MineSchema } from "./C4MineSchema";

/**
 * Estado raiz da sala. Apenas o que muda é enviado aos clientes (delta compression).
 */
export class ArenaState extends Schema {
  @type("string") code = "";
  @type({ map: PlayerSchema }) players = new MapSchema<PlayerSchema>();
  @type({ map: BulletSchema }) bullets = new MapSchema<BulletSchema>();
  @type({ map: ZombieSchema }) zombies = new MapSchema<ZombieSchema>();
  @type({ map: AmmoBoxSchema }) ammoBoxes = new MapSchema<AmmoBoxSchema>();
  @type({ map: SlimePuddleSchema }) slimePuddles = new MapSchema<SlimePuddleSchema>();
  @type({ map: SpitProjectileSchema }) spitProjectiles = new MapSchema<SpitProjectileSchema>();
  @type({ map: MortarLobSchema }) mortarLobs = new MapSchema<MortarLobSchema>();
  @type({ map: DoorSchema }) doors = new MapSchema<DoorSchema>();
  @type({ map: C4MineSchema }) c4Mines = new MapSchema<C4MineSchema>();

  // Relógio de jogo acelerado e controle oficial de hordas
  @type("float32") gameTime = 0; // segundos reais decorridos
  @type("uint8") currentHorde = 0; // 0 = preparação (pré-horda), 1 = Horda 1
  @type("string") hordeState = "calm"; // "calm" | "horde"
  @type("boolean") hordeAlert = false;
  @type("string") hordeAlertText = "";

  // Resgate por Helicóptero e Vitória
  @type("boolean") flareTriggered = false;
  @type("float32") rescueTimer = 0; // Contagem regressiva em segundos (30s)
  @type("string") helicopterStatus = "none"; // "none" | "incoming" | "landing" | "landed" | "escaped"
  @type("float32") helicopterX = 12.0;
  @type("float32") helicopterY = 38.0;
  @type("float32") helicopterZ = -25.0;
  @type("boolean") gameWon = false;
  @type("string") gameWonMessage = "";
}

