/**
 * Contratos de rede entre cliente e servidor.
 */

/** Tipos de mensagens enviadas pelo cliente ao servidor. */
export const ClientMessage = {
  Input: "input",
  Reload: "reload",
  SelectSlot: "select_slot",
  BuyItem: "buy_item",
  InteractDoor: "interact_door",
  Respawn: "respawn",
  DebugTriggerHorde: "debug_trigger_horde",
  EnterWorld: "enter_world",
  UseDefibrillator: "use_defibrillator",
} as const;
export type ClientMessage = (typeof ClientMessage)[keyof typeof ClientMessage];

/**
 * Pacote de input enviado pelo cliente.
 * `dx`/`dz` formam a direção desejada (cada eixo em [-1, 1]); o servidor normaliza.
 * `aimAngle` é o ângulo de mira em radianos, calculado via `Math.atan2(dx, dz)`.
 * `reloading` indica solicitação de recarga (tecla R).
 * `activeSlot` indica o slot do inventário selecionado (0, 1 ou 2).
 */
export interface InputMessage {
  dx: number;
  dz: number;
  aimAngle: number;
  shooting: boolean;
  reloading?: boolean;
  activeSlot?: number;
  jump?: boolean;
  seq: number;
}

export type HairType = "bald" | "buzzcut" | "medium" | "pompadour" | "long" | "bowl";
export type EyeType =
  | "oval_large"
  | "oval_medium"
  | "oval_small"
  | "round_large"
  | "round_medium"
  | "round_small";
export type BeardType =
  | "none"
  | "mustache"
  | "goatee_mustache"
  | "goatee"
  | "full_short"
  | "full_medium"
  | "full_thick";
export type HatType = "none" | "bucket" | "tophat" | "cap" | "beanie";

export interface CharacterAppearance {
  color?: string;
  hair?: HairType;
  eyes?: EyeType;
  beard?: BeardType;
  hat?: HatType;
}

/** Opções enviadas ao entrar/criar uma sala. */
export interface JoinOptions {
  /** Código da sala vindo de `?room=CODIGO`. */
  code: string;
  /** Apelido do jogador. */
  name?: string;
  /** Cor do feijão. */
  color?: string;
  /** Tipo de cabelo. */
  hair?: HairType;
  /** Tipo de olhos. */
  eyes?: EyeType;
  /** Tipo de barba. */
  beard?: BeardType;
  /** Tipo de chapéu. */
  hat?: HatType;
}

/** Visão somente-leitura de um jogador como o cliente a enxerga no estado sincronizado. */
export interface PlayerStateLike {
  id: string;
  name: string;
  color: string;
  hair?: string;
  eyes?: string;
  beard?: string;
  hat?: string;
  x: number;
  y: number;
  z: number;
  aimAngle: number;
  hp: number;
  inWorld?: boolean;
  moving: boolean;
  ammo: number;
  maxAmmo: number;
  reserveAmmo: number;
  reloading: boolean;
  reloadProgress: number;
  activeSlot: number;
  slot0: string;
  slot1: string;
  slot2: string;
  slot3: string;
  flareActive?: boolean;
  bandageCount: number;
  coins: number;
  knifeLevel: number;
  gunLevel: number;
  armor: number;
  maxArmor: number;
  webbedTimer?: number;
  hasPlantSprout?: boolean;
  hasSpiderHead?: boolean;
  hasWerewolfTooth?: boolean;
  hasSack?: boolean;
}

/** Visão de uma caixa de munição ou item coletável sincronizado na rede. */
export interface AmmoBoxStateLike {
  id: string;
  x: number;
  y: number;
  z: number;
  kind?: string;
  active: boolean;
}

/** Visão de uma bala como sincronizada na rede. */
export interface BulletStateLike {
  id: string;
  playerId: string;
  x: number;
  z: number;
  angle: number;
}

/** Visão de um inimigo como sincronizado na rede. */
export interface EnemyStateLike {
  id: string;
  type: string;
  x: number;
  y: number;
  z: number;
  rotation: number;
  hp: number;
  maxHp: number;
  state: "alive" | "dead";
  attacking: boolean;
  exploded?: boolean;
  isAggro?: boolean;
}

/** Visão de uma porta com física e estado sincronizado na rede. */
export interface DoorStateLike {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  isOpen: boolean;
}

