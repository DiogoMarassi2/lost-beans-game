import * as THREE from "three";

/**
 * Captura teclado (WASD / setas) e mouse.
 * A mira é obtida via Raycasting do cursor contra o plano matemático do chão (Y = 0),
 * sem Pointer Lock: o cursor continua livre na tela.
 */
export class InputManager {
  /** Posição do cursor em pixels (para a mira customizada do HUD). */
  readonly pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  shooting = false;
  enabled = false;
  private reloadRequested = false;
  private interactRequested = false;
  private escapeRequested = false;
  private jumpRequested = false;
  private scrollDelta = 0;
  private directSlot: number | null = null;

  private readonly keys = new Set<string>();
  private readonly ndc = new THREE.Vector2(0, 0);
  private readonly raycaster = new THREE.Raycaster();
  private readonly groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly aimPoint = new THREE.Vector3();

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly camera: THREE.Camera,
  ) {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.reset);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("wheel", this.onWheel, { passive: false });
    canvas.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  /** Retorna e consome se o jogador apertou a tecla de interação (E) */
  consumeInteract(): boolean {
    const val = this.interactRequested;
    this.interactRequested = false;
    return val;
  }

  /** Retorna e consome se o jogador apertou a tecla Escape */
  consumeEscape(): boolean {
    const val = this.escapeRequested;
    this.escapeRequested = false;
    return val;
  }

  /** Retorna e consome se o jogador apertou a tecla de recarregar (R) */
  consumeReload(): boolean {
    const val = this.reloadRequested;
    this.reloadRequested = false;
    return val;
  }

  /** Retorna e consome se o jogador apertou a tecla de pulo (Espaço) */
  consumeJump(): boolean {
    const val = this.jumpRequested;
    this.jumpRequested = false;
    return val;
  }

  /** Retorna e consome a direção do scroll do mouse (+1 ou -1) */
  consumeScroll(): number {
    const s = this.scrollDelta;
    this.scrollDelta = 0;
    return s;
  }

  /** Retorna e consome seleção direta de slot via teclas 1, 2 ou 3 */
  consumeDirectSlot(): number | null {
    const s = this.directSlot;
    this.directSlot = null;
    return s;
  }

  /** Direção de movimento desejada no plano XZ. W = -Z (para "cima" na tela). */
  getMove(): { dx: number; dz: number } {
    if (!this.enabled) return { dx: 0, dz: 0 };
    const k = this.keys;
    const dx = (k.has("KeyD") || k.has("ArrowRight") ? 1 : 0) - (k.has("KeyA") || k.has("ArrowLeft") ? 1 : 0);
    const dz = (k.has("KeyS") || k.has("ArrowDown") ? 1 : 0) - (k.has("KeyW") || k.has("ArrowUp") ? 1 : 0);
    return { dx, dz };
  }

  /**
   * Interseção do raio do cursor com o plano horizontal na altura do jogador.
   * Recalculado a cada frame porque a câmera e o jogador se movem.
   */
  getAimPoint(playerY = 0): THREE.Vector3 | null {
    this.raycaster.setFromCamera(this.ndc, this.camera);
    this.groundPlane.constant = -playerY;
    return this.raycaster.ray.intersectPlane(this.groundPlane, this.aimPoint);
  }

  private onWheel = (e: WheelEvent): void => {
    if (!this.enabled) return;
    e.preventDefault();
    if (e.deltaY > 0) {
      this.scrollDelta += 1;
    } else if (e.deltaY < 0) {
      this.scrollDelta -= 1;
    }
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (!this.enabled) return;
    if (e.target instanceof HTMLInputElement) return;
    this.keys.add(e.code);
    if (e.code === "KeyR") {
      this.reloadRequested = true;
    }
    if (e.code === "KeyE") {
      this.interactRequested = true;
    }
    if (e.code === "Escape") {
      this.escapeRequested = true;
    }
    if (e.code === "Space") {
      this.jumpRequested = true;
    }
    if (e.code === "Digit1") this.directSlot = 0;
    if (e.code === "Digit2") this.directSlot = 1;
    if (e.code === "Digit3") this.directSlot = 2;
    if (e.code === "Digit4") this.directSlot = 3;

    if (e.code.startsWith("Arrow") || e.code === "Space") e.preventDefault();
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private onPointerMove = (e: PointerEvent): void => {
    this.pointer.x = e.clientX;
    this.pointer.y = e.clientY;
    const rect = this.canvas.getBoundingClientRect();
    this.ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  };

  private onPointerDown = (e: PointerEvent): void => {
    if (e.button === 0 && this.enabled) this.shooting = true;
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (e.button === 0) this.shooting = false;
  };

  private reset = (): void => {
    this.keys.clear();
    this.shooting = false;
    this.reloadRequested = false;
    this.interactRequested = false;
    this.escapeRequested = false;
    this.jumpRequested = false;
    this.scrollDelta = 0;
    this.directSlot = null;
  };
}
