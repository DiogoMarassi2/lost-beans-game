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
    this.history.length = 0;
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

  /**
   * Atraso entre o jogador apertar uma tecla e ver o efeito na posição vinda do servidor
   * (ping + espera pelo próximo envio de input e pelo próximo tick). Atualizado pelo main.
   */
  latencyMs = 0;

  /** Posições previstas recentes, para comparar com o servidor no instante equivalente. */
  private history: { t: number; x: number; z: number }[] = [];
  private lastServerX = NaN;
  private lastServerZ = NaN;
  private lastServerChangeAt = 0;

  /** Registra a posição prevista deste quadro (chamado após step + colisões locais). */
  record(now = performance.now()): void {
    this.history.push({ t: now, x: this.x, z: this.z });
    while (this.history.length > 0 && now - this.history[0]!.t > 1500) this.history.shift();
  }

  /** Posição prevista no instante `t` (a amostra mais próxima não posterior a t). */
  private predictedAt(t: number): { x: number; z: number } {
    let best = this.history[0];
    for (const h of this.history) {
      if (h.t > t) break;
      best = h;
    }
    return best ?? { x: this.x, z: this.z };
  }

  /**
   * Corrige a predição com a posição autoritativa do servidor.
   * A posição do servidor está sempre atrasada (latência); por isso é comparada com onde o
   * jogador estava há `latencyMs`, e não com a posição atual. Assim, andar com ping alto não
   * "puxa o personagem para trás" — só erros reais (colisões, teia, empurrões) são corrigidos.
   */
  reconcile(
    serverX: number,
    serverZ: number,
    _isMoving: boolean,
    dt: number,
    serverY?: number,
    now = performance.now(),
  ): void {
    if (serverX !== this.lastServerX || serverZ !== this.lastServerZ) {
      this.lastServerX = serverX;
      this.lastServerZ = serverZ;
      this.lastServerChangeAt = now;
    }

    // Servidor parado há mais que a latência: compara com a posição atual (ambos em repouso)
    const settled = now - this.lastServerChangeAt > this.latencyMs + 150;
    const ref = settled ? { x: this.x, z: this.z } : this.predictedAt(this.lastServerChangeAt - this.latencyMs);
    const ex = serverX - ref.x;
    const ez = serverZ - ref.z;

    if (Math.hypot(ex, ez) > LocalPredictor.SNAP_DISTANCE) {
      this.x = serverX;
      this.z = serverZ;
      this.y = serverY !== undefined ? serverY : calculateElevation(this.x, this.z, this.y);
      this.history.length = 0;
      return;
    }

    const t = damp(6, dt);
    const cx = ex * t;
    const cz = ez * t;
    this.x += cx;
    this.z += cz;
    // Aplica a mesma correção ao histórico para não corrigir o mesmo erro duas vezes
    for (const h of this.history) {
      h.x += cx;
      h.z += cz;
    }
    if (this.isGrounded && serverY !== undefined) {
      this.y += (serverY - this.y) * t;
    }
  }
}
