import { Schema, type } from "@colyseus/schema";
import { SLIME_PUDDLE_LIFETIME, SLIME_PUDDLE_RADIUS } from "@dark-beans/shared";

/**
 * Estado sincronizado de uma poça de gosma ácida no chão.
 */
export class SlimePuddleSchema extends Schema {
  @type("string") id = "";
  @type("float32") x = 0;
  @type("float32") y = 0;
  @type("float32") z = 0;
  @type("float32") radius = SLIME_PUDDLE_RADIUS;
  @type("float32") lifetime = SLIME_PUDDLE_LIFETIME;
  @type("float32") maxLifetime = SLIME_PUDDLE_LIFETIME;
}
