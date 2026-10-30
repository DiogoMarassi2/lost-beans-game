import { Schema, type } from "@colyseus/schema";
import { MAGAZINE_SIZE, PLAYER_MAX_HP } from "@dark-beans/shared";

/**
 * Estado sincronizado de um jogador. O servidor só conhece números e strings:
 * nada de cores de material, malhas ou luzes.
 */
export class PlayerSchema extends Schema {
  @type("string") name = "";
  @type("string") color = "#ffffff";
  @type("string") hair = "bald";
  @type("string") eyes = "oval_medium";
  @type("string") beard = "none";
  @type("string") hat = "none";
  @type("float32") x = 0;
  @type("float32") y = 0;
  @type("float32") z = 0;
  @type("float32") aimAngle = 0;
  @type("uint8") hp = PLAYER_MAX_HP;
  @type("boolean") isGodMode = false;
  @type("boolean") inWorld = false;
  @type("boolean") moving = false;
  @type("uint8") ammo = MAGAZINE_SIZE;
  @type("uint8") maxAmmo = MAGAZINE_SIZE;
  @type("uint16") reserveAmmo = MAGAZINE_SIZE;
  @type("boolean") reloading = false;
  @type("float32") reloadProgress = 0;

  // Inventário tático de 4 slots: 0 (faca), 1 (arma de fogo), 2 (utilitários/consumíveis), 3 (exclusivo para itens de chefe / sinalizador)
  @type("uint8") activeSlot = 0;
  @type("string") slot0 = "knife";
  @type("string") slot1 = "pistol";
  @type("string") slot2 = "";
  @type("string") slot3 = "";
  @type("boolean") flareActive = false;
  @type("uint8") bandageCount = 0;
  @type("uint8") c4Count = 0;

  // Relíquias de chefes coletadas para comprar o Sinalizador na Loja
  @type("boolean") hasPlantSprout = false;
  @type("boolean") hasSpiderHead = false;
  @type("boolean") hasWerewolfTooth = false;
  @type("boolean") hasSack = false;

  // Moedas obtidas matando zumbis para gastar na loja
  @type("uint16") coins = 0;

  // Níveis de melhoria de equipamento (progressão)
  @type("uint8") knifeLevel = 1;
  @type("uint8") gunLevel = 1;

  // Armadura permanente do sobrevivente (não ocupa slot; começa com 4, melhora na loja: 4 -> 6 -> 8 -> 10 -> 12 -> 14)
  @type("uint8") armor = 4;
  @type("uint8") maxArmor = 4;

  // Tempo restante em segundos sob paralisia de teia da aranha
  @type("float32") webbedTimer = 0;

  // Acumulador de tempo sobre poça de gosma para aplicar 1 dano por segundo
  slimeDamageTimer = 0;
}
