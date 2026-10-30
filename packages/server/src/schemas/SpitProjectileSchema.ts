import { Schema, type } from "@colyseus/schema";
import { SPIT_DAMAGE } from "@dark-beans/shared";

/**
 * Estado sincronizado de um projétil de cuspe de gosma lançado pelo Zumbi Rastejador.
 */
export class SpitProjectileSchema extends Schema {
  @type("string") id = "";
  @type("string") kind = "slime"; // "slime" | "web"
  @type("float32") x = 0;
  @type("float32") y = 0.75;
  @type("float32") z = 0;
  @type("float32") angle = 0;

  // Propriedades internas da simulação física no servidor
  vx = 0;
  vz = 0;
  lifetime = 0;
  damage = SPIT_DAMAGE;
}
