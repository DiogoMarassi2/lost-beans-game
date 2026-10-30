import * as THREE from "three";
import type { BeardType, EyeType, HairType, HatType } from "@dark-beans/shared";

/** Cores padrão recomendadas para o Feijão */
export const BEAN_COLOR_PALETTE = [
  { name: "Sapphire Blue", hex: "#2563eb" },
  { name: "Neon Cyan", hex: "#06b6d4" },
  { name: "Emerald Green", hex: "#10b981" },
  { name: "Forest Green", hex: "#15803d" },
  { name: "Golden Yellow", hex: "#eab308" },
  { name: "Flame Orange", hex: "#f97316" },
  { name: "Crimson Red", hex: "#ef4444" },
  { name: "Bubblegum Pink", hex: "#ec4899" },
  { name: "Amethyst Purple", hex: "#8b5cf6" },
  { name: "Snow White", hex: "#f8fafc" },
  { name: "Titanium Gray", hex: "#64748b" },
  { name: "Onyx Black", hex: "#1e293b" },
];

export const HAIR_OPTIONS: { id: HairType; name: string }[] = [
  { id: "bald", name: "Bald" },
  { id: "buzzcut", name: "Buzz Cut" },
  { id: "medium", name: "Medium Hair" },
  { id: "pompadour", name: "Pompadour" },
  { id: "long", name: "Long Hair" },
  { id: "bowl", name: "Bowl Cut" },
];

export const EYE_OPTIONS: { id: EyeType; name: string }[] = [
  { id: "oval_large", name: "Large Oval" },
  { id: "oval_medium", name: "Medium Oval" },
  { id: "oval_small", name: "Small Oval" },
  { id: "round_large", name: "Large Round" },
  { id: "round_medium", name: "Medium Round" },
  { id: "round_small", name: "Small Round" },
];

export const BEARD_OPTIONS: { id: BeardType; name: string }[] = [
  { id: "none", name: "Clean Shaven" },
  { id: "mustache", name: "Full Mustache" },
  { id: "goatee", name: "Goatee" },
  { id: "goatee_mustache", name: "Goatee & Mustache" },
  { id: "full_short", name: "Short Full Beard" },
  { id: "full_medium", name: "Medium Full Beard" },
  { id: "full_thick", name: "Long Thick Beard" },
];

export const HAT_OPTIONS: { id: HatType; name: string }[] = [
  { id: "none", name: "None" },
  { id: "bucket", name: "Bucket Hat" },
  { id: "tophat", name: "Top Hat" },
  { id: "cap", name: "Cap" },
  { id: "beanie", name: "Beanie" },
];

export const DEFAULT_HAIR_COLOR = "#1c1917"; // Castanho escuro / espresso profundo
export const DEFAULT_HAIR_HIGHLIGHT_COLOR = "#282321"; // Tom iluminado para mechas e contornos

// ─── Superfície da cabeça do feijão ─────────────────────────────────────────
// Cabelos e barbas são UMA malha contínua cada, moldada como uma "capa" sobre a cápsula
// do corpo (raio 0.5, cúpula centrada em y = 1.1). A forma de cada estilo vem de um campo
// de espessura h(s, φ): onde h > 0 há fios; onde h < 0 a capa fica escondida sob a pele.
//   s = distância ao longo da superfície a partir do topo da cabeça (metros)
//   φ = ângulo em torno do eixo vertical (0 = frente/+Z, +π/2 = lado +X)
const HEAD_R = 0.5;
const HEAD_CENTER_Y = 1.1;
const HEAD_EQUATOR_S = (Math.PI * HEAD_R) / 2;
/** Profundidade sob a pele usada para esconder as partes da capa sem fios
 *  (folga para as faces planas da cápsula de baixa resolução do corpo). */
const TUCK = -0.05;

const smooth01 = (x: number): number => {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
};
const smoothstep = (a: number, b: number, x: number): number => smooth01((x - a) / (b - a));

/** Ponto e normal da superfície da cápsula na coordenada (s, φ). */
function headSurface(s: number, phi: number, out: THREE.Vector3, normal: THREE.Vector3): void {
  const dx = Math.sin(phi);
  const dz = Math.cos(phi);
  if (s <= HEAD_EQUATOR_S) {
    const th = s / HEAD_R;
    normal.set(Math.sin(th) * dx, Math.cos(th), Math.sin(th) * dz);
    out.set(normal.x * HEAD_R, HEAD_CENTER_Y + normal.y * HEAD_R, normal.z * HEAD_R);
  } else {
    normal.set(dx, 0, dz);
    out.set(dx * HEAD_R, HEAD_CENTER_Y - (s - HEAD_EQUATOR_S), dz * HEAD_R);
  }
}

/** Altura (y) na superfície da cabeça para uma distância s a partir do topo. */
const yAtS = (s: number): number =>
  s <= HEAD_EQUATOR_S ? HEAD_CENTER_Y + Math.cos(s / HEAD_R) * HEAD_R : HEAD_CENTER_Y - (s - HEAD_EQUATOR_S);

interface ShellOptions {
  sMin: number;
  sMax: number;
  phiMin: number;
  phiMax: number;
  /** Fecha a malha ao redor da cabeça (φ cobrindo 360°). */
  wrap: boolean;
  nS: number;
  nPhi: number;
  /** Espessura dos fios acima da pele (negativo = escondido). */
  height: (s: number, phi: number) => number;
  /** Limita a espessura num ponto (ex.: cabelo achatado sob o chapéu). */
  clamp?: (base: THREE.Vector3, normal: THREE.Vector3, h: number) => number;
  /** Multiplicador de brilho por vértice (mechas e sulcos sutis na mesma malha). */
  shade?: (s: number, phi: number) => number;
}

/** Gera uma malha única e contínua sobre a superfície da cabeça. */
function buildHeadShell(o: ShellOptions): THREE.BufferGeometry {
  const cols = o.wrap ? o.nPhi : o.nPhi + 1;
  const rows = o.nS + 1;
  const positions = new Float32Array(rows * cols * 3);
  const colors = new Float32Array(rows * cols * 3);
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();

  for (let i = 0; i < rows; i++) {
    const s = o.sMin + ((o.sMax - o.sMin) * i) / o.nS;
    for (let j = 0; j < cols; j++) {
      const phi = o.phiMin + ((o.phiMax - o.phiMin) * j) / o.nPhi;
      headSurface(s, phi, p, n);
      let h = o.height(s, phi);
      if (o.clamp && h > 0) h = o.clamp(p, n, h);
      if (h <= 0 && p.y < 0.5) {
        const dy = 0.5 - p.y;
        h -= HEAD_R - Math.sqrt(Math.max(0, HEAD_R * HEAD_R - dy * dy));
      }
      p.addScaledVector(n, h);
      const k = (i * cols + j) * 3;
      positions[k] = p.x;
      positions[k + 1] = p.y;
      positions[k + 2] = p.z;
      const c = o.shade ? o.shade(s, phi) : 1;
      colors[k] = c;
      colors[k + 1] = c;
      colors[k + 2] = c;
    }
  }

  const indices: number[] = [];
  for (let i = 0; i < o.nS; i++) {
    for (let j = 0; j < o.nPhi; j++) {
      const j2 = o.wrap ? (j + 1) % o.nPhi : j + 1;
      const a = i * cols + j;
      const b = i * cols + j2;
      const c = (i + 1) * cols + j;
      const d = (i + 1) * cols + j2;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  // No topo (s = 0) todos os vértices coincidem: normal aponta para cima
  if (o.sMin === 0) {
    const normals = geo.getAttribute("normal") as THREE.BufferAttribute;
    for (let j = 0; j < cols; j++) normals.setXYZ(j, 0, 1, 0);
  }
  return geo;
}

/** Converte "cobertura" (distância até a borda, em metros) em espessura com borda definida. */
const coverHeight = (edgeDist: number, thickness: number, softness = 0.03): number =>
  TUCK + (thickness - TUCK) * smooth01(edgeDist / softness);

/**
 * Volume interno de cada chapéu: o cabelo precisa caber aqui dentro.
 * Retorna null se o chapéu não cobre aquela altura (cabelo livre abaixo da aba).
 */
function hatInterior(hat: HatType): ((x: number, y: number, z: number) => boolean) | null {
  const radial = (x: number, z: number) => Math.hypot(x, z);
  switch (hat) {
    case "cap":
      // Copa esférica do boné (raio 0.52 centrada em y = 1.14), até a borda em y ≈ 1.205
      return (x, y, z) => y < 1.2 || Math.hypot(x, y - 1.14, z) < 0.507;
    case "beanie":
      // Barra dobrada (cilindro) + cúpula elipsoidal do gorro
      return (x, y, z) => {
        if (y < 1.31) return true;
        if (y < 1.38) return radial(x, z) < 0.53;
        return (x * x + z * z) / 0.485 ** 2 + ((y - 1.38) / 0.56) ** 2 < 1;
      };
    case "bucket":
      // Copa cilíndrica + interior da aba caída
      return (x, y, z) => {
        if (y < 1.34) return true;
        if (y < 1.43) return radial(x, z) < 0.52;
        return radial(x, z) < 0.46 && y < 1.64;
      };
    case "tophat":
      // Cilindro alto da cartola acima da aba
      return (x, y, z) => y < 1.44 || (radial(x, z) < 0.37 && y < 1.9);
    default:
      return null;
  }
}

/** Achata a espessura do cabelo até caber dentro do chapéu (busca binária ao longo da normal). */
function makeHatClamp(hat: HatType): ShellOptions["clamp"] {
  const inside = hatInterior(hat);
  if (!inside) return undefined;
  const q = new THREE.Vector3();
  const fits = (base: THREE.Vector3, normal: THREE.Vector3, h: number) => {
    q.copy(base).addScaledVector(normal, h);
    return inside(q.x, q.y, q.z);
  };
  return (base, normal, h) => {
    if (fits(base, normal, h)) return h;
    if (!fits(base, normal, 0)) return TUCK;
    let lo = 0;
    let hi = h;
    for (let i = 0; i < 10; i++) {
      const mid = (lo + hi) / 2;
      if (fits(base, normal, mid)) lo = mid;
      else hi = mid;
    }
    return lo;
  };
}

/**
 * Constrói o modelo 3D do Cabelo
 * Cada estilo é uma única malha contínua (sem peças sobrepostas), com volume, franja e
 * mechas esculpidas diretamente no campo de espessura. Com chapéu, o cabelo é achatado
 * para dentro dele e só aparece abaixo da aba.
 */
export function buildHairModel(type: HairType, hat: HatType = "none"): THREE.Group {
  const group = new THREE.Group();
  if (type === "bald") return group;

  const hairMat = new THREE.MeshStandardMaterial({
    color: DEFAULT_HAIR_COLOR,
    roughness: 0.5,
    metalness: 0.08,
    vertexColors: true,
  });

  // Mistura frente (0) → nuca (1) em função do ângulo
  const backness = (phi: number) => (1 - Math.cos(phi)) / 2;

  let opts: Omit<ShellOptions, "sMin" | "phiMin" | "phiMax" | "wrap" | "nPhi"> | null = null;

  // ───────────────────────────────────────────────────────────────────────────
  // 1) RASPADO CURTO (BUZZCUT): capa fina e uniforme com costeletas
  // ───────────────────────────────────────────────────────────────────────────
  if (type === "buzzcut") {
    const edge = (phi: number) => {
      const a = Math.abs(phi);
      const sideburn = 0.1 * Math.exp(-(((a - 1.33) / 0.12) ** 2));
      return 0.47 + 0.44 * smooth01(backness(phi) * 1.4) + sideburn;
    };
    opts = {
      sMax: 1.05,
      nS: 90,
      height: (s, phi) => coverHeight(edge(phi) - s, 0.026, 0.02),
      shade: (s) => 1.15 - 0.15 * smoothstep(0, 0.9, s),
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 2) CABELO MÉDIO: volume no topo, franja varrida para o lado e pontas na nuca
  // ───────────────────────────────────────────────────────────────────────────
  if (type === "medium") {
    const edge = (phi: number) => {
      const a = Math.abs(phi);
      // Franja assimétrica (desce mais sobre o lado direito) com pontas em mechas
      const front = 0.5 + 0.06 * smoothstep(-0.6, 0.5, phi) - 0.02 * smoothstep(0.5, 0.9, phi);
      const tips = 0.03 * Math.max(0, Math.sin(phi * 11 + 0.6)) ** 2;
      const sides = 0.86;
      const back = 0.99 + 0.035 * Math.max(0, Math.sin(phi * 9)) ** 2;
      const toSide = smoothstep(0.55, 1.2, a);
      const toBack = smoothstep(1.6, 2.6, a);
      return (front + tips) * (1 - toSide) + (sides * (1 - toBack) + back * toBack) * toSide;
    };
    // Mechas varridas da risca (φ ≈ -0.5) para a direita
    const strand = (s: number, phi: number) => Math.sin(phi * 16 - s * 9);
    opts = {
      sMax: 1.1,
      nS: 110,
      height: (s, phi) => {
        const lift = 0.075 - 0.03 * smoothstep(0.2, 0.9, s);
        const part = 0.025 * Math.exp(-(((phi + 0.5) / 0.07) ** 2)) * (1 - smoothstep(0.1, 0.5, s));
        const t = lift * (1 + 0.1 * strand(s, phi)) - part;
        return coverHeight(edge(phi) - s, t);
      },
      shade: (s, phi) => 1.0 + 0.16 * strand(s, phi) + 0.18 * (1 - smoothstep(0, 0.6, s)),
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 3) TOPETE (POMPADOUR): laterais rentes e um grande topete único na frente
  // ───────────────────────────────────────────────────────────────────────────
  if (type === "pompadour") {
    const edge = (phi: number) => 0.45 + 0.42 * smooth01(backness(phi) * 1.5);
    const comb = (s: number, phi: number) => Math.sin(phi * 22) * (1 - smoothstep(0.5, 0.8, s));
    opts = {
      sMax: 1.0,
      nS: 120,
      height: (s, phi) => {
        const front = Math.exp(-((phi / 0.75) ** 2));
        const quiff = 0.2 * Math.exp(-(((s - 0.34) / 0.17) ** 2)) * front;
        const crown = 0.06 * (1 - smoothstep(0.3, 0.75, s));
        const t = 0.03 + crown + quiff;
        return coverHeight(edge(phi) - s, t * (1 + 0.05 * comb(s, phi)), 0.018);
      },
      shade: (s, phi) => 1.0 + 0.14 * comb(s, phi) + 0.22 * Math.exp(-(((s - 0.3) / 0.16) ** 2)) * Math.exp(-((phi / 0.7) ** 2)),
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 4) COMPRIDO: risca no meio, mechas emoldurando o rosto e caindo até os ombros
  // ───────────────────────────────────────────────────────────────────────────
  if (type === "long") {
    // Distância até a borda: calota até a testa ∪ cortina que cai dos lados e da nuca
    const edgeDist = (s: number, phi: number) => {
      const a = Math.abs(phi);
      const forehead = 0.49 - s;
      const length = 1.27 + 0.04 * smoothstep(1.0, 2.8, a) + 0.035 * Math.max(0, Math.sin(phi * 13)) ** 2;
      const curtain = Math.min(length - s, (a - 0.86) * HEAD_R);
      return Math.max(forehead, curtain);
    };
    const strand = (s: number, phi: number) => Math.sin(phi * 14 + s * 2.5);
    opts = {
      sMax: 1.4,
      nS: 140,
      height: (s, phi) => {
        const part = 0.03 * Math.exp(-((phi / 0.06) ** 2)) * (1 - smoothstep(0.05, 0.5, s));
        const flare = 0.05 * smoothstep(0.75, 1.3, s);
        const t = (0.055 + flare) * (1 + 0.12 * strand(s, phi)) - part;
        return coverHeight(edgeDist(s, phi), t);
      },
      shade: (s, phi) => 1.0 + 0.16 * strand(s, phi) + 0.16 * (1 - smoothstep(0, 0.6, s)),
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 5) TIGELA (BOWL CUT): cúpula uniforme com barra reta e franja cheia
  // ───────────────────────────────────────────────────────────────────────────
  if (type === "bowl") {
    const edge = (phi: number) => {
      return 0.56 + 0.13 * smooth01(backness(phi) * 1.3);
    };
    opts = {
      sMax: 0.9,
      nS: 110,
      height: (s, phi) => {
        const t = 0.07 + 0.02 * (1 - smoothstep(0, 0.5, s));
        return coverHeight(edge(phi) - s, t, 0.02);
      },
      shade: (s, phi) => 1.0 + 0.08 * Math.sin(phi * 26) + 0.2 * (1 - smoothstep(0, 0.5, s)),
    };
  }

  if (!opts) return group;

  const mesh = new THREE.Mesh(
    buildHeadShell({
      ...opts,
      sMin: 0,
      phiMin: -Math.PI,
      phiMax: Math.PI,
      wrap: true,
      nS: Math.round(opts.sMax / 0.006),
      nPhi: 256,
      clamp: makeHatClamp(hat),
    }),
    hairMat,
  );
  mesh.castShadow = true;
  group.add(mesh);
  return group;
}

/**
 * Formas da barba no "plano do rosto": u = posição horizontal ao longo da pele (metros,
 * 0 = centro) e y = altura. Cada função devolve a distância (aprox.) até a borda: > 0 dentro.
 */
const beardShapes = {
  mustache: (u: number, y: number, scale: number) => {
    const w = 0.22 * scale;
    const k = Math.abs(u) / w;
    const yc = 0.905 - 0.05 * k * k;
    const half = 0.042 * scale * Math.sqrt(Math.max(0, 1 - k ** 2.5)) * (1 - 0.25 * Math.exp(-((u / 0.03) ** 2)));
    return half - Math.abs(y - yc);
  },
  goatee: (u: number, y: number, scale: number) => {
    // Mais largo sob o lábio, afinando em ponta arredondada no queixo
    const top = 0.84;
    const bottom = 0.84 - 0.2 * scale;
    const t = smooth01((top - y) / (top - bottom));
    const halfW = 0.11 * scale * (1 - 0.65 * t * t);
    return Math.min(halfW - Math.abs(u), top - y, y - bottom);
  },
  /** Bigode ligado ao cavanhaque pelas laterais da boca (circle beard) */
  ring: (u: number, y: number) => {
    const dx = u / 0.2;
    const dy = (y - 0.82) / 0.13;
    const r = Math.sqrt(dx * dx + dy * dy);
    return (1 - r) * 0.13;
  },
  /** Barba cheia: das costeletas, pela mandíbula, até o queixo */
  full: (u: number, y: number, chinY: number, cheek: number) => {
    const au = Math.abs(u);
    // Linha das bochechas subindo até as costeletas; mandíbula subindo até sob a orelha
    const top = 0.93 + 0.13 * smoothstep(0.18, 0.6, au) + cheek;
    const bottom = chinY + (0.9 - chinY) * smoothstep(0.1, 0.62, au) ** 1.3;
    // Costeleta termina arredondada na frente da orelha
    const ear = 0.66 - au - 0.6 * Math.max(0, y - 0.98) ** 2;
    return Math.min(top - y, y - bottom, ear);
  },
  mouth: (u: number, y: number, width: number) => {
    const dx = u / width;
    const dy = (y - 0.858) / 0.022;
    return (Math.sqrt(dx * dx + dy * dy) - 1) * 0.022;
  },
};

/**
 * Constrói o modelo 3D da Barba
 * Cada estilo é uma única malha contínua moldada ao rosto (bigode, cavanhaque e barba
 * saem do mesmo campo de espessura, sem gomos soltos nem peças sobrepostas).
 */
export function buildBeardModel(type: BeardType): THREE.Group {
  const group = new THREE.Group();
  if (type === "none") return group;

  const beardMat = new THREE.MeshStandardMaterial({
    color: DEFAULT_HAIR_COLOR,
    roughness: 0.6,
    metalness: 0.05,
    vertexColors: true,
    polygonOffset: true,
    polygonOffsetFactor: -2.0,
    polygonOffsetUnits: -8.0,
  });

  // Espessura (metros) de cada região conforme o estilo
  let thickness: (u: number, y: number) => number;
  let sMax = 1.2;

  const fiber = (u: number) => 1 + 0.08 * Math.sin(u * 70);
  const soft = 0.012;
  const layer = (d: number, t: number) => (d > 0 ? t * smooth01(d / soft) : -1);

  if (type === "mustache") {
    thickness = (u, y) => layer(beardShapes.mustache(u, y, 1.05), 0.045 * fiber(u));
  } else if (type === "goatee") {
    thickness = (u, y) =>
      Math.max(
        layer(beardShapes.goatee(u, y, 1.0), 0.045 * fiber(u)),
      );
  } else if (type === "goatee_mustache") {
    thickness = (u, y) => {
      const ring = Math.min(beardShapes.ring(u, y), beardShapes.mouth(u, y, 0.1));
      return Math.max(
        layer(ring, 0.04 * fiber(u)),
        layer(beardShapes.mustache(u, y, 1.0), 0.05),
        layer(beardShapes.goatee(u, y, 0.95), 0.045 * fiber(u)),
      );
    };
  } else {
    const cfg =
      type === "full_short"
        ? { t: 0.026, chinY: 0.69, cheek: 0.0, must: 0.042 }
        : type === "full_medium"
        ? { t: 0.05, chinY: 0.62, cheek: 0.02, must: 0.062 }
        : { t: 0.07, chinY: 0.4, cheek: 0.03, must: 0.08 };
    const isLong = type === "full_thick";
    if (isLong) sMax = 1.6;

    thickness = (u, y) => {
      let chinY = cfg.chinY;
      if (isLong) {
        // Ponta arredondada com mechas irregulares na base
        chinY += 0.3 * (u / 0.3) ** 2 + 0.02 * Math.sin(u * 45);
      }
      const body = Math.min(beardShapes.full(u, y, chinY, cfg.cheek), beardShapes.mouth(u, y, 0.09));
      // Mais volume no queixo do que nas costeletas
      const bulk = cfg.t * (0.45 + 0.55 * (1 - smoothstep(0.1, 0.6, Math.abs(u))));
      const hang = isLong ? 0.07 * smoothstep(0.8, 0.5, y) : 0;
      return Math.max(
        layer(body, (bulk + hang) * fiber(u)),
        layer(beardShapes.mustache(u, y, 1.1), cfg.must),
      );
    };
  }

  const geo = buildHeadShell({
    sMin: 0.68,
    sMax,
    phiMin: -1.75,
    phiMax: 1.75,
    wrap: false,
    nS: Math.round((sMax - 0.68) / 0.006),
    nPhi: 200,
    height: (s, phi) => {
      const t = thickness(phi * HEAD_R, yAtS(s));
      return t > 0 ? t : TUCK;
    },
    shade: (s, phi) => 0.95 + 0.12 * Math.sin(phi * HEAD_R * 70) + 0.1 * smoothstep(0.75, 1.0, yAtS(s)),
  });

  const mesh = new THREE.Mesh(geo, beardMat);
  mesh.castShadow = true;
  mesh.renderOrder = 2;
  group.add(mesh);
  return group;
}

/**
 * Constrói o modelo 3D do Chapéu
 */
export function buildHatModel(type: HatType): THREE.Group {
  const group = new THREE.Group();
  if (type === "none") return group;

  if (type === "bucket") {
    // Chapéu de pescador (Bucket Hat)
    const bucketMat = new THREE.MeshStandardMaterial({ color: "#44513a", roughness: 0.8 }); // verde oliva / cáqui
    const bandMat = new THREE.MeshStandardMaterial({ color: "#2d3725", roughness: 0.9 });

    // Aba caída para baixo
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.54, 0.12, 24, 1, true), bucketMat);
    brim.position.y = 1.40;

    // Copa cilíndrica com topo plano
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.51, 0.22, 24), bucketMat);
    crown.position.y = 1.54;

    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.515, 0.525, 0.05, 24, 1, true), bandMat);
    band.position.y = 1.46;

    group.add(brim, crown, band);
    return group;
  }

  if (type === "tophat") {
    // Cartola elegante preta com fita carmesim
    const hatMat = new THREE.MeshStandardMaterial({ color: "#18181b", roughness: 0.4, metalness: 0.2 });
    const ribbonMat = new THREE.MeshStandardMaterial({ color: "#dc2626", roughness: 0.3 });

    // Aba larga circular
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.64, 0.64, 0.03, 24), hatMat);
    brim.position.y = 1.46;

    // Cilindro alto
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.40, 0.44, 24), hatMat);
    body.position.y = 1.69;

    // Fita de cetim vermelha na base
    const ribbon = new THREE.Mesh(new THREE.CylinderGeometry(0.405, 0.41, 0.07, 24, 1, true), ribbonMat);
    ribbon.position.y = 1.50;

    group.add(brim, body, ribbon);
    return group;
  }

  if (type === "cap") {
    // Boné com aba para a frente
    const capMat = new THREE.MeshStandardMaterial({ color: "#1d4ed8", roughness: 0.7 }); // Azul atlético
    const buttonMat = new THREE.MeshStandardMaterial({ color: "#f8fafc", roughness: 0.5 });

    // Copa do boné arredondada
    const crown = new THREE.Mesh(new THREE.SphereGeometry(0.52, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.46), capMat);
    crown.position.y = 1.14;

    // Aba estendida para a frente
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.03, 0.34), capMat);
    visor.position.set(0, 1.38, 0.60);
    visor.rotation.x = 0.12;

    // Botão central no topo
    const button = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), buttonMat);
    button.position.set(0, 1.65, 0);

    group.add(crown, visor, button);
    return group;
  }

  if (type === "beanie") {
    // Touca de frio / gorro aconchegante com pompom
    const knitMat = new THREE.MeshStandardMaterial({ color: "#ea580c", roughness: 0.95 }); // Laranja aconchegante
    const cuffMat = new THREE.MeshStandardMaterial({ color: "#c2410c", roughness: 0.95 });
    const pomMat = new THREE.MeshStandardMaterial({ color: "#f8fafc", roughness: 0.9 });

    // Barra dobrada (cuff)
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.55, 0.14, 22), cuffMat);
    cuff.position.y = 1.38;

    // Cúpula do gorro
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.51, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.50), knitMat);
    dome.position.y = 1.38;
    dome.scale.set(1.0, 1.15, 1.0);

    // Pompom no topo
    const pom = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), pomMat);
    pom.position.set(0, 1.76, 0);

    group.add(cuff, dome, pom);
    return group;
  }

  return group;
}

/**
 * Atualiza o formato e escala dos olhos expressivos do feijão
 */
export function applyEyeStyle(eyesGroup: THREE.Group, eyeType: EyeType): void {
  let scaleX = 1.0;
  let scaleY = 1.25;
  let pupilRadius = 0.068;

  switch (eyeType) {
    case "oval_large":
      scaleX = 1.18;
      scaleY = 1.48;
      pupilRadius = 0.076;
      break;
    case "oval_medium":
      scaleX = 1.0;
      scaleY = 1.25;
      pupilRadius = 0.068;
      break;
    case "oval_small":
      scaleX = 0.82;
      scaleY = 1.02;
      pupilRadius = 0.054;
      break;
    case "round_large":
      scaleX = 1.32;
      scaleY = 1.32;
      pupilRadius = 0.082;
      break;
    case "round_medium":
      scaleX = 1.06;
      scaleY = 1.06;
      pupilRadius = 0.066;
      break;
    case "round_small":
      scaleX = 0.78;
      scaleY = 0.78;
      pupilRadius = 0.050;
      break;
  }

  // Percorre os dois olhos filhos no grupo
  for (let i = 0; i < eyesGroup.children.length; i++) {
    const eyeMesh = eyesGroup.children[i] as THREE.Mesh;
    if (eyeMesh) {
      eyeMesh.scale.set(scaleX, scaleY, 0.7);

      // Atualiza pupila dentro do olho
      const pupil = eyeMesh.children[0] as THREE.Mesh | undefined;
      if (pupil) {
        pupil.scale.set(pupilRadius / 0.068, pupilRadius / 0.068, 1);
      }
    }
  }
}
