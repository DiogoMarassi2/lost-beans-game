import { Schema, type } from "@colyseus/schema";

/**
 * Caixa de munição / pente coletável no chão da arena.
 */
export class AmmoBoxSchema extends Schema {
  @type("string") id = "";
  @type("float32") x = 0;
  @type("float32") y = 0;
  @type("float32") z = 0;
  @type("string") kind = "ammo"; // "ammo" | "pistol" | "bandage"
  @type("boolean") active = true;

  /** Temporizador interno do servidor para reaparecer (não sincronizado) */
  respawnTimer = 0;

  /** Atraso antes que o item recém-derrubado possa ser pego (evita auto-coleta instantânea) */
  pickupDelay = 0;
}

