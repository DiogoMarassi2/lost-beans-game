import { Schema, type } from "@colyseus/schema";
import { C4_COUNTDOWN_SECONDS } from "@dark-beans/shared";

/**
 * Estado sincronizado de um C4 explosivo plantado no mundo.
 * Realiza contagem regressiva de 5 segundos, atrai zumbis e detona.
 */
export class C4MineSchema extends Schema {
  @type("string") id = "";
  @type("float32") x = 0;
  @type("float32") y = 0;
  @type("float32") z = 0;
  @type("float32") timer = C4_COUNTDOWN_SECONDS;
  @type("float32") maxTimer = C4_COUNTDOWN_SECONDS;
  @type("string") ownerId = "";
  @type("boolean") exploded = false;

  // Buffer pós-explosão para garantir que os clientes recebam o evento de detonação
  removeTimer = 0.5;
}
