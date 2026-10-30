import { Schema, type } from "@colyseus/schema";
import { MORTAR_DAMAGE } from "@dark-beans/shared";

/**
 * Estado sincronizado de um tiro de morteiro de gosma lançado em arco parabólico.
 */
export class MortarLobSchema extends Schema {
  @type("string") id = "";
  @type("float32") startX = 0;
  @type("float32") startY = 0;
  @type("float32") startZ = 0;
  @type("float32") targetX = 0;
  @type("float32") targetY = 0;
  @type("float32") targetZ = 0;
  @type("float32") duration = 1.0;
  @type("float32") peakHeight = 3.5;
  @type("float32") progress = 0; // 0 a 1
  @type("float32") splashRadius = 3.2;

  // Propriedades internas da simulação física no servidor
  elapsed = 0;
  damage = MORTAR_DAMAGE;
}
