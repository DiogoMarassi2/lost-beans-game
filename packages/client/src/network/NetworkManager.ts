import { Client, type Room } from "colyseus.js";
import {
  ClientMessage,
  generateRoomCode,
  ROOM_NAME,
  sanitizeRoomCode,
  SERVER_PORT,
  type CharacterAppearance,
  type InputMessage,
  type JoinOptions,
} from "@dark-beans/shared";

/** Visão do cliente sobre um jogador sincronizado (decodificado por reflexão do schema). */
export interface NetPlayer {
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
  maxHp?: number;
  isGodMode?: boolean;
  inWorld?: boolean;
  moving: boolean;
  ammo: number;
  maxAmmo: number;
  reserveAmmo: number;
  reloading: boolean;
  reloadProgress: number;
  activeSlot?: number;
  slot0?: string;
  slot1?: string;
  slot2?: string;
  slot3?: string;
  flareActive?: boolean;
  bandageCount?: number;
  c4Count?: number;
  coins?: number;
  knifeLevel?: number;
  gunLevel?: number;
  armor?: number;
  maxArmor?: number;
  webbedTimer?: number;
  hasPlantSprout?: boolean;
  hasSpiderHead?: boolean;
  hasWerewolfTooth?: boolean;
  hasSack?: boolean;
}

/** Visão do cliente sobre uma caixa de munição ou item coletável sincronizado. */
export interface NetAmmoBox {
  id: string;
  x: number;
  y: number;
  z: number;
  kind?: string;
  active: boolean;
}

/** Visão do cliente sobre uma bala sincronizada. */
export interface NetBullet {
  id: string;
  playerId: string;
  x: number;
  z: number;
  angle: number;
}

/** Visão do cliente sobre um zumbi sincronizado. */
export interface NetZombie {
  id: string;
  type: string;
  x: number;
  y: number;
  z: number;
  rotation: number;
  hp: number;
  maxHp: number;
  state: "alive" | "dead";
  attacking?: boolean;
  exploded?: boolean;
  isAggro?: boolean;
}

/** Visão do cliente sobre uma poça de gosma ácida sincronizada. */
export interface NetSlimePuddle {
  id: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  lifetime: number;
  maxLifetime: number;
}

/** Visão do cliente sobre um projétil de cuspe de gosma sincronizado. */
export interface NetSpitProjectile {
  id: string;
  kind?: string;
  x: number;
  y: number;
  z: number;
  angle: number;
}

/** Visão do cliente sobre uma bomba de gosma em parábola disparada pelo Zumbi Morteiro. */
export interface NetMortarLob {
  id: string;
  startX: number;
  startY: number;
  startZ: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  duration: number;
  peakHeight: number;
  progress: number;
  splashRadius?: number;
}

/** Visão do cliente sobre uma porta interativa sincronizada. */
export interface NetDoor {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  isOpen: boolean;
}

/** Visão do cliente sobre uma C4 explosiva sincronizada. */
export interface NetC4Mine {
  id: string;
  x: number;
  y: number;
  z: number;
  timer: number;
  maxTimer: number;
  ownerId?: string;
  exploded: boolean;
}

/** Visão do cliente sobre o estado da arena. */
export interface NetArenaState {
  code: string;
  doors?: {
    forEach(cb: (door: NetDoor, id: string) => void): void;
    get(id: string): NetDoor | undefined;
    readonly size: number;
  };
  players: {
    forEach(cb: (player: NetPlayer, id: string) => void): void;
    get(id: string): NetPlayer | undefined;
    readonly size: number;
  };
  bullets: {
    forEach(cb: (bullet: NetBullet, id: string) => void): void;
    get(id: string): NetBullet | undefined;
    readonly size: number;
  };
  zombies: {
    forEach(cb: (zombie: NetZombie, id: string) => void): void;
    get(id: string): NetZombie | undefined;
    readonly size: number;
  };
  ammoBoxes?: {
    forEach(cb: (box: NetAmmoBox, id: string) => void): void;
    get(id: string): NetAmmoBox | undefined;
    readonly size: number;
  };
  c4Mines?: {
    forEach(cb: (mine: NetC4Mine, id: string) => void): void;
    get(id: string): NetC4Mine | undefined;
    readonly size: number;
  };
  slimePuddles?: {
    forEach(cb: (puddle: NetSlimePuddle, id: string) => void): void;
    get(id: string): NetSlimePuddle | undefined;
    readonly size: number;
  };
  spitProjectiles?: {
    forEach(cb: (spit: NetSpitProjectile, id: string) => void): void;
    get(id: string): NetSpitProjectile | undefined;
    readonly size: number;
  };
  mortarLobs?: {
    forEach(cb: (lob: NetMortarLob, id: string) => void): void;
    get(id: string): NetMortarLob | undefined;
    readonly size: number;
  };
  gameTime?: number;
  currentHorde?: number;
  hordeState?: string;
  hordeAlert?: boolean;
  hordeAlertText?: string;
  flareTriggered?: boolean;
  rescueTimer?: number;
  helicopterStatus?: string;
  helicopterX?: number;
  helicopterY?: number;
  helicopterZ?: number;
  gameWon?: boolean;
  gameWonMessage?: string;
}

export type NetStatus = "idle" | "connecting" | "online" | "offline";

/**
 * Conecta ao Colyseus, resolve o código da sala pela URL (`?room=CODIGO`)
 * e repassa mudanças de estado para o jogo.
 */
export class NetworkManager {
  code: string;
  readonly endpoint: string;
  room: Room<NetArenaState> | null = null;
  status: NetStatus = "idle";

  onStatus: ((status: NetStatus) => void) | null = null;
  onStateChange: ((state: NetArenaState) => void) | null = null;
  onPlayerRevived:
    | ((data: {
        reviverId: string;
        reviverName: string;
        revivedId: string;
        revivedName: string;
        x: number;
        y: number;
        z: number;
      }) => void)
    | null = null;

  private readonly client: Client;
  private seq = 0;

  constructor() {
    this.code = NetworkManager.getRoomFromUrl() || "";
    this.endpoint = NetworkManager.resolveEndpoint();
    this.client = new Client(this.endpoint);
  }

  /** Lê `?room=` da URL se existir */
  static getRoomFromUrl(): string | null {
    const url = new URL(window.location.href);
    const existing = sanitizeRoomCode(url.searchParams.get("room"));
    return existing || null;
  }

  setRoomCode(code: string): void {
    this.code = sanitizeRoomCode(code) || "";
    const url = new URL(window.location.href);
    if (this.code) {
      url.searchParams.set("room", this.code);
    } else {
      url.searchParams.delete("room");
    }
    window.history.replaceState(null, "", url);
  }

  /** `VITE_SERVER_URL` se definido; senão, mesmo host da página na porta do servidor. */
  static resolveEndpoint(): string {
    const env = import.meta.env.VITE_SERVER_URL as string | undefined;
    if (env) return env;
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    return `${proto}://${window.location.hostname}:${SERVER_PORT}`;
  }

  get shareUrl(): string {
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("room", this.code);
    return url.toString();
  }

  get sessionId(): string | null {
    return this.room?.sessionId ?? null;
  }

  get state(): NetArenaState | null {
    return this.room?.state ?? null;
  }

  /**
   * Conecta a uma sala.
   * - "create": entra na sala com esse código ou cria uma nova.
   * - "join": só entra se a sala já existir (senão lança erro; ver `isRoomNotFoundError`).
   * Se já estiver em outra sala, só sai dela depois que a nova conexão der certo.
   */
  async connect(
    name: string,
    roomCode?: string,
    appearance?: CharacterAppearance,
    mode: "create" | "join" = "create",
  ): Promise<void> {
    const code = sanitizeRoomCode(roomCode) || this.code || generateRoomCode();

    this.setStatus("connecting");
    const options: JoinOptions = {
      code,
      name,
      ...(appearance ?? {}),
    };
    let room: Room<NetArenaState>;
    try {
      // filterBy(["code"]) no servidor: a sala é identificada pelo código
      room =
        mode === "join"
          ? await this.client.join<NetArenaState>(ROOM_NAME, options)
          : await this.client.joinOrCreate<NetArenaState>(ROOM_NAME, options);
    } catch (err) {
      // Continua na sala anterior, se havia uma
      this.setStatus(this.room ? "online" : "offline");
      throw err;
    }

    const previous = this.room;
    this.room = room;
    this.setRoomCode(code);
    this.setStatus("online");
    if (previous && previous !== room) previous.leave();

    room.onStateChange((state) => {
      // Ignora atualizações de uma sala que já foi deixada
      if (this.room === room) this.onStateChange?.(state);
    });
    room.onMessage("player_revived", (data) => {
      this.onPlayerRevived?.(data);
    });
    room.onLeave((leaveCode) => {
      console.warn(`[Network] desconectado da sala (código ${leaveCode})`);
      // Ignora a saída de uma sala antiga (após trocar de sala)
      if (this.room !== room) return;
      this.room = null;
      this.setStatus("offline");
    });
    room.onError((errCode, message) => {
      console.error(`[Network] erro ${errCode}: ${message ?? ""}`);
    });
  }

  /** Erro do servidor quando não existe sala com o código informado. */
  static isRoomNotFoundError(err: unknown): boolean {
    return (err as { code?: number } | null)?.code === 4211;
  }

  sendUpdateAppearance(appearance: CharacterAppearance, name?: string): void {
    this.room?.send("update_appearance", { ...appearance, name });
  }

  leave(): void {
    if (this.room) {
      this.room.leave();
      this.room = null;
      this.setStatus("idle");
    }
  }

  sendInput(input: Omit<InputMessage, "seq">): void {
    if (!this.room) return;
    const msg: InputMessage = { ...input, seq: ++this.seq };
    this.room.send(ClientMessage.Input, msg);
  }

  sendReload(): void {
    if (!this.room) return;
    this.room.send(ClientMessage.Reload);
  }

  sendSelectSlot(slot: number): void {
    if (!this.room) return;
    this.room.send(ClientMessage.SelectSlot, { slot });
  }

  sendBuyItem(item: string): void {
    if (!this.room) return;
    this.room.send(ClientMessage.BuyItem, { item });
  }

  sendInteractDoor(doorId?: string): void {
    if (!this.room) return;
    this.room.send(ClientMessage.InteractDoor, { doorId });
  }

  sendRespawn(): void {
    if (!this.room) return;
    this.room.send(ClientMessage.Respawn, {});
  }

  sendEnterWorld(): void {
    if (!this.room) return;
    this.room.send(ClientMessage.EnterWorld, {});
  }

  sendUseDefibrillator(): void {
    if (!this.room) return;
    this.room.send(ClientMessage.UseDefibrillator, {});
  }

  sendToggleGodMode(): void {
    if (!this.room) return;
    this.room.send("toggle_god_mode", {});
  }

  send(type: string | number, message?: any): void {
    if (!this.room) return;
    this.room.send(type, message);
  }

  private setStatus(status: NetStatus): void {
    this.status = status;
    this.onStatus?.(status);
  }
}
