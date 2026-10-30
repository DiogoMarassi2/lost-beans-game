import {
  calculateElevation,
  GRAVITY,
  JUMP_VELOCITY,
  normalizeInput,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  resolveStatic,
  separateCircles,
  type BoxCollider,
  type InputMessage,
} from "@dark-beans/shared";
import type { MapSchema } from "@colyseus/schema";
import type { PlayerSchema } from "../schemas/PlayerSchema";

interface PlayerMovementState {
  vy: number;
  isGrounded: boolean;
}

/**
 * Sistema de movimentação autoritativo no servidor:
 * - Movimento direcional WASD com normalização
 * - Mecânica de pulo vertical (Espaço) com gravidade e detecção de solo
 * - Resolução de colisões estáticas com obstáculos, portas e separação entre jogadores
 */
export class MovementSystem {
  private readonly states = new Map<string, PlayerMovementState>();

  update(
    players: MapSchema<PlayerSchema>,
    inputs: ReadonlyMap<string, InputMessage>,
    dt: number,
    extraColliders?: readonly BoxCollider[],
  ): void {
    // 0) Limpa estados de jogadores que saíram
    for (const id of this.states.keys()) {
      if (!players.has(id)) {
        this.states.delete(id);
      }
    }

    // 1) Movimento individual com pulo
    players.forEach((player, id) => {
      const input = inputs.get(id);
      if (!input || player.hp <= 0 || !player.inWorld) {
        player.moving = false;
        return;
      }

      let st = this.states.get(id);
      if (!st) {
        st = {
          vy: 0,
          isGrounded: true,
        };
        this.states.set(id, st);
      }

      // Se estiver paralisado pela teia da aranha, decrementa o timer e bloqueia locomoção e pulo
      if (player.webbedTimer > 0) {
        player.webbedTimer = Math.max(0, player.webbedTimer - dt);
      }
      const isParalyzed = player.webbedTimer > 0;

      // Dispara o Pulo se requisitado e o jogador estiver sobre o solo (bloqueado se paralisado)
      if (input.jump && st.isGrounded && !isParalyzed) {
        st.vy = JUMP_VELOCITY;
        st.isGrounded = false;
      }

      // Movimentação horizontal WASD (imobilizado se paralisado)
      const dir = isParalyzed ? { x: 0, z: 0 } : normalizeInput(input.dx, input.dz);
      player.x += dir.x * PLAYER_SPEED * dt;
      player.z += dir.z * PLAYER_SPEED * dt;
      player.moving = !isParalyzed && (dir.x !== 0 || dir.z !== 0);

      // Movimentação vertical (Pulo e Gravidade)
      const groundY = calculateElevation(player.x, player.z, player.y);
      if (!st.isGrounded || st.vy !== 0) {
        player.y += st.vy * dt;
        st.vy -= GRAVITY * dt;
        if (player.y <= groundY) {
          player.y = groundY;
          st.vy = 0;
          st.isGrounded = true;
        } else {
          st.isGrounded = false;
        }
      } else {
        player.y = groundY;
      }

      // Resolve colisões com obstáculos e portas
      resolveStatic(player, PLAYER_RADIUS, extraColliders);

      // Re-valida altura caso a colisão tenha posicionado o jogador sobre uma rampa
      const postGroundY = calculateElevation(player.x, player.z, player.y);
      if (player.y < postGroundY) {
        player.y = postGroundY;
        st.vy = 0;
        st.isGrounded = true;
      }

      player.moving = input.dx !== 0 || input.dz !== 0;
      player.aimAngle = input.aimAngle;
    });

    // 2) Separação jogador x jogador
    const list = Array.from(players.values());
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]!;
        const b = list[j]!;
        if (!a.inWorld || !b.inWorld) continue;
        if (Math.abs(a.y - b.y) < 1.3) {
          const pa = { x: a.x, z: a.z };
          const pb = { x: b.x, z: b.z };
          if (separateCircles(pa, PLAYER_RADIUS, pb, PLAYER_RADIUS)) {
            resolveStatic(pa, PLAYER_RADIUS, extraColliders);
            resolveStatic(pb, PLAYER_RADIUS, extraColliders);
            a.x = pa.x;
            a.z = pa.z;
            b.x = pb.x;
            b.z = pb.z;
          }
        }
      }
    }
  }

  resetPlayer(id: string): void {
    this.states.set(id, { vy: 0, isGrounded: true });
  }

  removePlayer(id: string): void {
    this.states.delete(id);
  }
}
