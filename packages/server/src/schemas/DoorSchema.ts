import { Schema, type } from "@colyseus/schema";

/**
 * Estado sincronizado de uma porta interativa com física no mundo.
 */
export class DoorSchema extends Schema {
  @type("string") id = "";
  @type("string") name = "";
  @type("float32") x = 0;
  @type("float32") y = 0;
  @type("float32") z = 0;
  @type("boolean") isOpen = false;
}
