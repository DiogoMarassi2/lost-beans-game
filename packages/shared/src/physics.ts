import {
  DOOR_DEFINITIONS,
  HOUSE_COLLIDERS,
  HOUSE_FLOOR_Y,
  MAP_MAX_X,
  MAP_MAX_Z,
  MAP_MIN_X,
  MAP_MIN_Z,
  OBSTACLES,
  ROOF_STRUCTURES,
  type BoxCollider,
  type RoofStructure,
} from "./constants";
import { clamp } from "./math";

export interface Vec2 {
  x: number;
  z: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Calcula a altura Y do piso para uma dada coordenada (x, z) e altura atual (currentY).
 * - Tábua inclinada (subida): de X=9.8 (Y=0) a X=16.2 (Y=2.4)
 * - Tábua / rampa de descida interna: de X=27.5 (Y=2.4) a X=33.5 (Y=0)
 * - Varanda e 2º andar da casa: Y=2.4 apenas para quem já subiu pela rampa (currentY >= 1.5).
 *   Para quem está no nível do chão (currentY < 1.5), retorna 0, impedindo teletransporte.
 * - Chão: Y=0
 */
export const calculateElevation = (x: number, z: number, currentY = 0): number => {
  // 1) Tábua de madeira inclinada (subida da clareira para a varanda)
  if (x >= 9.8 && x <= 16.2 && z >= -1.4 && z <= 1.4) {
    const t = Math.max(0, Math.min(1, (x - 10.0) / 6.0));
    return t * HOUSE_FLOOR_Y;
  }
  // 2) Tábua / rampa de descida interna (fundos da casa para o chão)
  if (x >= 26.2 && x <= 33.5 && z >= -1.5 && z <= 1.5) {
    if (x < 27.5) {
      return HOUSE_FLOOR_Y;
    }
    const t = Math.max(0, Math.min(1, (33.0 - x) / 5.5));
    return t * HOUSE_FLOOR_Y;
  }
  // 3) Varanda elevada e segundo piso da casa (cobre de X=15.8 até X=34.2, incluindo todo o chão ao lado da escada)
  if (x >= 15.8 && x <= 34.2 && Math.abs(z) <= 7.2) {
    // SÓ está no piso superior se já subiu pela rampa (currentY >= 1.5)
    // Se o personagem estiver no chão (currentY < 1.5), permanece no chão (Y = 0)
    if (currentY >= 1.5) {
      return HOUSE_FLOOR_Y;
    }
    return 0;
  }
  // 4) Torre de Vigia Militar: Rampa de acesso de X=81.2 (Y=0) a X=85.2 (Y=2.4) em Z: [7.8, 10.2]
  if (x >= 81.2 && x <= 85.5 && z >= 7.8 && z <= 10.2) {
    const t = Math.max(0, Math.min(1, (x - 81.5) / 3.7));
    return t * HOUSE_FLOOR_Y;
  }
  // 5) Plataforma elevada da Torre de Vigia (X: 85.0 a 90.0, Z: 6.8 a 11.2)
  if (x >= 85.0 && x <= 90.0 && z >= 6.8 && z <= 11.2) {
    if (currentY >= 1.5) {
      return HOUSE_FLOOR_Y;
    }
    return 0;
  }
  return 0;
};

/** Normaliza um vetor de direção de input; vetores com módulo <= 1 são preservados (suporte a analógico). */
export const normalizeInput = (dx: number, dz: number): Vec2 => {
  dx = clamp(dx, -1, 1);
  dz = clamp(dz, -1, 1);
  const len = Math.hypot(dx, dz);
  if (len > 1) return { x: dx / len, z: dz / len };
  return { x: dx, z: dz };
};

/** Retorna os colisores sólidos das portas que estiverem fechadas. */
export const getActiveDoorColliders = (
  doors?: any,
): BoxCollider[] => {
  const colliders: BoxCollider[] = [];

  for (const def of DOOR_DEFINITIONS) {
    let isOpen = def.initialOpen ?? false;

    if (doors) {
      // 1) Se possui método .get (ex: MapSchema do Colyseus ou Map nativo do JS)
      if (typeof doors.get === "function") {
        const item = doors.get(def.id);
        if (item) {
          if (typeof item.isOpen === "function") {
            isOpen = Boolean(item.isOpen());
          } else if (item.isOpen !== undefined) {
            isOpen = Boolean(item.isOpen);
          }
        }
      }
      // 2) Se for um Array ou coleção iterável
      else if (Array.isArray(doors)) {
        const item = doors.find((d: any) => d && (d.id === def.id || d.config?.id === def.id));
        if (item) {
          if (typeof item.isOpen === "function") {
            isOpen = Boolean(item.isOpen());
          } else if (item.isOpen !== undefined) {
            isOpen = Boolean(item.isOpen);
          }
        }
      }
      // 3) Se for um Record / objeto puro { [id]: { isOpen } }
      else if (typeof doors === "object" && def.id in doors) {
        const item = doors[def.id];
        if (item) {
          if (typeof item.isOpen === "function") {
            isOpen = Boolean(item.isOpen());
          } else if (item.isOpen !== undefined) {
            isOpen = Boolean(item.isOpen);
          }
        }
      }
    }

    if (!isOpen) {
      colliders.push(def.collider);
    }
  }

  return colliders;
};

/** Empurra um círculo para fora de obstáculos circulares, paredes da casa, portas fechadas e limites do mapa. */
export const resolveStatic = (
  pos: Vec2 & { y?: number },
  radius: number,
  extraColliders?: readonly BoxCollider[],
): void => {
  // 1) Obstáculos circulares (árvores, caixotes, barris, lareira)
  for (const o of OBSTACLES) {
    const ox = pos.x - o.x;
    const oz = pos.z - o.z;
    const minDist = radius + o.r;
    const distSq = ox * ox + oz * oz;
    if (distSq < minDist * minDist) {
      const dist = Math.sqrt(distSq) || 0.0001;
      const push = minDist - dist;
      pos.x += (ox / dist) * push;
      pos.z += (oz / dist) * push;
    }
  }

  // 2) Colisores retangulares das paredes da casa e grades da varanda
  const currentY = pos.y ?? calculateElevation(pos.x, pos.z, pos.y ?? 0);
  for (const box of HOUSE_COLLIDERS) {
    if (box.minY !== undefined && currentY < box.minY) continue;
    if (box.maxY !== undefined && currentY > box.maxY) continue;

    const inside =
      pos.x >= box.minX &&
      pos.x <= box.maxX &&
      pos.z >= box.minZ &&
      pos.z <= box.maxZ;

    if (inside) {
      const dLeft = pos.x - box.minX;
      const dRight = box.maxX - pos.x;
      const dBottom = pos.z - box.minZ;
      const dTop = box.maxZ - pos.z;
      const minDist = Math.min(dLeft, dRight, dBottom, dTop);

      if (minDist === dLeft) pos.x = box.minX - radius;
      else if (minDist === dRight) pos.x = box.maxX + radius;
      else if (minDist === dBottom) pos.z = box.minZ - radius;
      else pos.z = box.maxZ + radius;
      continue;
    }

    const cx = clamp(pos.x, box.minX, box.maxX);
    const cz = clamp(pos.z, box.minZ, box.maxZ);
    const dx = pos.x - cx;
    const dz = pos.z - cz;
    const distSq = dx * dx + dz * dz;

    if (distSq < radius * radius) {
      const dist = Math.sqrt(distSq) || 0.0001;
      const push = radius - dist;
      const nx = distSq === 0 ? 1 : dx / dist;
      const nz = distSq === 0 ? 0 : dz / dist;
      pos.x += nx * push;
      pos.z += nz * push;
    }
  }

  // 2.1) Colisores dinâmicos extras (ex: portas fechadas)
  if (extraColliders && extraColliders.length > 0) {
    for (const box of extraColliders) {
      if (box.minY !== undefined && currentY < box.minY) continue;
      if (box.maxY !== undefined && currentY > box.maxY) continue;

      const inside =
        pos.x >= box.minX &&
        pos.x <= box.maxX &&
        pos.z >= box.minZ &&
        pos.z <= box.maxZ;

      if (inside) {
        const dLeft = pos.x - box.minX;
        const dRight = box.maxX - pos.x;
        const dBottom = pos.z - box.minZ;
        const dTop = box.maxZ - pos.z;
        const minDist = Math.min(dLeft, dRight, dBottom, dTop);

        if (minDist === dLeft) pos.x = box.minX - radius;
        else if (minDist === dRight) pos.x = box.maxX + radius;
        else if (minDist === dBottom) pos.z = box.minZ - radius;
        else pos.z = box.maxZ + radius;
        continue;
      }

      const cx = clamp(pos.x, box.minX, box.maxX);
      const cz = clamp(pos.z, box.minZ, box.maxZ);
      const dx = pos.x - cx;
      const dz = pos.z - cz;
      const distSq = dx * dx + dz * dz;

      if (distSq < radius * radius) {
        const dist = Math.sqrt(distSq) || 0.0001;
        const push = radius - dist;
        const nx = distSq === 0 ? 1 : dx / dist;
        const nz = distSq === 0 ? 0 : dz / dist;
        pos.x += nx * push;
        pos.z += nz * push;
      }
    }
  }

  // 2.2) Inimigos colossais (Chefe com raio >= 1.4m) são grandes demais para entrar em casas
  if (radius >= 1.4) {
    for (const roof of ROOF_STRUCTURES) {
      if (roof.name === "shop" || roof.name === "gas_station_canopy") continue; // Estruturas abertas em que o chefe pode passar
      const margin = radius + 0.15;
      if (
        pos.x > roof.minX - margin &&
        pos.x < roof.maxX + margin &&
        pos.z > roof.minZ - margin &&
        pos.z < roof.maxZ + margin
      ) {
        // Encontra a borda externa mais próxima e repele o chefe para fora da estrutura
        const distLeft = Math.abs(pos.x - (roof.minX - margin));
        const distRight = Math.abs(pos.x - (roof.maxX + margin));
        const distBottom = Math.abs(pos.z - (roof.minZ - margin));
        const distTop = Math.abs(pos.z - (roof.maxZ + margin));
        const minDist = Math.min(distLeft, distRight, distBottom, distTop);

        if (minDist === distLeft) pos.x = roof.minX - margin;
        else if (minDist === distRight) pos.x = roof.maxX + margin;
        else if (minDist === distBottom) pos.z = roof.minZ - margin;
        else pos.z = roof.maxZ + margin;
      }
    }
  }

  // 3) Limites retangulares do mapa com progressão
  pos.x = clamp(pos.x, MAP_MIN_X + radius, MAP_MAX_X - radius);
  pos.z = clamp(pos.z, MAP_MIN_Z + radius, MAP_MAX_Z - radius);
};

/**
 * Avança um círculo na direção (dx, dz) com a velocidade dada e resolve colisões estáticas.
 * Atualiza e retorna `pos`.
 */
export const stepMovement = (
  pos: Vec2 & { y?: number },
  dx: number,
  dz: number,
  speed: number,
  dt: number,
  radius: number,
  extraColliders?: readonly BoxCollider[],
): Vec2 & { y?: number } => {
  const dir = normalizeInput(dx, dz);
  pos.x += dir.x * speed * dt;
  pos.z += dir.z * speed * dt;
  pos.y = calculateElevation(pos.x, pos.z, pos.y ?? 0);
  resolveStatic(pos, radius, extraColliders);
  pos.y = calculateElevation(pos.x, pos.z, pos.y ?? 0);
  return pos;
};

/**
 * Separa dois círculos dinâmicos que se sobrepõem, dividindo o empurrão igualmente.
 * Retorna `true` se houve colisão.
 */
export const separateCircles = (a: Vec2, ra: number, b: Vec2, rb: number): boolean => {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const minDist = ra + rb;
  const distSq = dx * dx + dz * dz;
  if (distSq >= minDist * minDist) return false;
  const dist = Math.sqrt(distSq) || 0.0001;
  const half = (minDist - dist) / 2;
  const nx = distSq === 0 ? 1 : dx / dist;
  const nz = distSq === 0 ? 0 : dz / dist;
  a.x -= nx * half;
  a.z -= nz * half;
  b.x += nx * half;
  b.z += nz * half;
  return true;
};

/**
 * Retorna a estrutura com telhado que cobre a posição (x, z, y), se houver.
 * Uma entidade em (x, z, y) está abrigada se estiver sob a projeção horizontal e abaixo da altura do teto (ceilingY).
 */
export const getCoveringRoof = (x: number, z: number, y = 0): RoofStructure | null => {
  for (const roof of ROOF_STRUCTURES) {
    if (x >= roof.minX && x <= roof.maxX && z >= roof.minZ && z <= roof.maxZ) {
      if (y < roof.ceilingY) {
        return roof;
      }
    }
  }
  return null;
};

/**
 * Retorna se o sobrevivente/entidade está abrigado dentro de uma casa/estrutura sob o teto.
 */
export const isInsideCoveredBuilding = (x: number, z: number, y = 0): boolean => {
  return getCoveringRoof(x, z, y) !== null;
};

/**
 * Retorna a altura do topo do telhado para onde um tiro aéreo cairá caso colida com o telhado,
 * ou null se for em céu aberto.
 */
export const getRoofImpactY = (x: number, z: number): number | null => {
  for (const roof of ROOF_STRUCTURES) {
    if (x >= roof.minX && x <= roof.maxX && z >= roof.minZ && z <= roof.maxZ) {
      return roof.roofY;
    }
  }
  return null;
};

/**
 * Sorteia uma posição aleatória no chão (y = 0) onde um item coletável pode aparecer:
 * dentro dos limites do mapa, fora de paredes/obstáculos, fora de rampas e longe de `avoid`.
 * Retorna null se não encontrar um ponto válido após `maxTries` tentativas.
 */
export const findRandomItemSpot = (
  avoid: readonly Vec2[] = [],
  minSpacing = 0,
  maxTries = 60,
): Vec3 | null => {
  const margin = 2.0;
  const clearance = 0.7;
  for (let i = 0; i < maxTries; i++) {
    const x = MAP_MIN_X + margin + Math.random() * (MAP_MAX_X - MAP_MIN_X - margin * 2);
    const z = MAP_MIN_Z + margin + Math.random() * (MAP_MAX_Z - MAP_MIN_Z - margin * 2);

    // Fora de rampas/pisos elevados
    if (calculateElevation(x, z, 0) !== 0) continue;

    // Fora da área sob a casa abandonada (térreo vedado) e do balcão da loja
    const roof = getCoveringRoof(x, z, 0);
    if (roof && (roof.name === "abandoned_house" || roof.name === "shop")) continue;

    // Fora de paredes, obstáculos e colisores (se o resolveStatic empurrar, o ponto é inválido)
    const probe = { x, y: 0, z };
    resolveStatic(probe, clearance);
    if (Math.abs(probe.x - x) > 1e-4 || Math.abs(probe.z - z) > 1e-4) continue;

    // Longe dos outros itens
    if (minSpacing > 0 && avoid.some((a) => Math.hypot(a.x - x, a.z - z) < minSpacing)) continue;

    return { x, y: 0.1, z };
  }
  return null;
};
