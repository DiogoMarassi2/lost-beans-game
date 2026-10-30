import { Schema, type } from "@colyseus/schema";

/**
 * Estado sincronizado de um projétil na rede.
 */
export class BulletSchema extends Schema {
  @type("string") id = "";
  @type("string") playerId = "";
  @type("float32") x = 0;
  @type("float32") z = 0;
  @type("float32") angle = 0;

  // Propriedades internas da simulação no servidor (não serializadas pela rede)
  lifetime = 0;
  vx = 0;
  vz = 0;
  damage = 1;
}
