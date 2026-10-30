import {
  calculateElevation,
  damp,
  GRAVITY,
  JUMP_VELOCITY,
  normalizeInput,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  resolveStatic,
  type BoxCollider,
} from "@dark-beans/shared";

/**
 * Predição do jogador local com suporte à altura (Y) e Pulo.
 * Aplica o input imediatamente usando a MESMA física do servidor (pacote shared),
 * eliminando a sensação de atraso.
 */
export class LocalPredictor {
  x = 0;
  y = 0;
  z = 0;
  initialized = false;

  vy = 0;
  isGrounded = true;
  isWebbed = false;

  /** Erro acima do qual a correção é instantânea (ex: teleporte, respawn). */
  static readonly SNAP_DISTANCE = 2.5;

  reset(x: number, z: number, y = 0): void {
    this.x = x;
    this.y = y;
    this.z = z;
    this.vy = 0;
    this.isGrounded = true;
    this.initialized = true;
  }

  step(
    dx: number,
    dz: number,
    dt: number,
    jump: boolean,
    extraColliders?: readonly BoxCollider[],
  ): { jumped: boolean; landed: boolean } {
    let jumped = false;
    let landed = false;

    // Se estiver paralisado pela teia da aranha, anula WASD e Pulo
    if (this.isWebbed) {
      dx = 0;
      dz = 0;
      jump = false;
    }

    // Dispara o Pulo se requisitado e o personagem estiver apoiado no solo
    if (jump && this.isGrounded) {
      this.vy = JUMP_VELOCITY;
      this.isGrounded = false;
      jumped = true;
    }

    // Movimentação horizontal WASD
    const dir = normalizeInput(dx, dz);
    this.x += dir.x * PLAYER_SPEED * dt;
    this.z += dir.z * PLAYER_SPEED * dt;

    // Movimentação vertical (Pulo e Gravidade)
    const groundY = calculateElevation(this.x, this.z, this.y);
    if (!this.isGrounded || this.vy !== 0) {
      this.y += this.vy * dt;
      this.vy -= GRAVITY * dt;
      if (this.y <= groundY) {
        this.y = groundY;
        this.vy = 0;
        if (!this.isGrounded) landed = true;
        this.isGrounded = true;
      } else {
        this.isGrounded = false;
      }
    } else {
      this.y = groundY;
    }

    // Resolve colisões com obstáculos e portas
    resolveStatic(this, PLAYER_RADIUS, extraColliders);

    // Ajuste de altura após colisão com rampas
    const postGroundY = calculateElevation(this.x, this.z, this.y);
    if (this.y < postGroundY) {
      this.y = postGroundY;
      this.vy = 0;
      this.isGrounded = true;
    }

    return { jumped, landed };
  }

  reconcile(serverX: number, serverZ: number, isMoving: boolean, dt: number, serverY?: number): void {
    const ex = serverX - this.x;
    const ez = serverZ - this.z;
    const err = Math.hypot(ex, ez);
    if (err > LocalPredictor.SNAP_DISTANCE) {
      this.x = serverX;
      this.z = serverZ;
      this.y = serverY !== undefined ? serverY : calculateElevation(this.x, this.z, this.y);
      return;
    }
    const t = damp(isMoving ? 2.5 : 8, dt);
    this.x += ex * t;
    this.z += ez * t;
    if (this.isGrounded && serverY !== undefined) {
      this.y += (serverY - this.y) * t;
    }
  }
}
