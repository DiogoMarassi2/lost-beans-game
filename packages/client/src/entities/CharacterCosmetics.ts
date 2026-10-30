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

/**
 * Constrói o modelo 3D do Cabelo
 * Totalmente esculpido com geometrias orgânicas, curvas suaves e camadas (sem formas quadradas).
 */
export function buildHairModel(type: HairType): THREE.Group {
  const group = new THREE.Group();
  if (type === "bald") return group;

  // Material principal rico, com brilho acetinado natural de cabelo
  const hairMat = new THREE.MeshStandardMaterial({
    color: DEFAULT_HAIR_COLOR,
    roughness: 0.42,
    metalness: 0.12,
  });

  // Material secundário levemente iluminado para mechas de destaque
  const hairMatHighlight = new THREE.MeshStandardMaterial({
    color: DEFAULT_HAIR_HIGHLIGHT_COLOR,
    roughness: 0.38,
    metalness: 0.15,
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1) RASPADO CURTO (BUZZCUT / FADE)
  // ───────────────────────────────────────────────────────────────────────────
  if (type === "buzzcut") {
    // Calota craniana ajustada e suave
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.514, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.46),
      hairMat,
    );
    dome.position.y = 1.12;

    // Linha frontal da testa (arco suave que acompanha a curvatura da cabeça)
    const hairline = new THREE.Mesh(
      new THREE.TorusGeometry(0.485, 0.024, 8, 24, Math.PI * 0.65),
      hairMat,
    );
    hairline.position.set(0, 1.34, 0.14);
    hairline.rotation.x = Math.PI / 2.3;

    // Costeletas limpas e afiladas nas têmporas
    const sideburnL = new THREE.Mesh(new THREE.CapsuleGeometry(0.026, 0.12, 6, 8), hairMat);
    sideburnL.position.set(-0.48, 1.06, 0.10);
    sideburnL.rotation.z = -0.1;

    const sideburnR = new THREE.Mesh(new THREE.CapsuleGeometry(0.026, 0.12, 6, 8), hairMat);
    sideburnR.position.set(0.48, 1.06, 0.10);
    sideburnR.rotation.z = 0.1;

    // Acabamento suave da nuca
    const napeArc = new THREE.Mesh(
      new THREE.TorusGeometry(0.488, 0.025, 8, 24, Math.PI * 0.75),
      hairMat,
    );
    napeArc.position.set(0, 1.10, -0.10);
    napeArc.rotation.x = -Math.PI / 2.3;

    group.add(dome, hairline, sideburnL, sideburnR, napeArc);
    return group;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 2) CABELO MÉDIO (TEXTURED FLOW & SIDE PART)
  // ───────────────────────────────────────────────────────────────────────────
  if (type === "medium") {
    // Base de volume arredondada
    const crown = new THREE.Mesh(
      new THREE.SphereGeometry(0.522, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.48),
      hairMat,
    );
    crown.position.y = 1.14;

    // Mechas esculpidas do topo fluindo naturalmente para a lateral
    const topLock1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.32, 8, 12), hairMatHighlight);
    topLock1.position.set(-0.10, 1.55, 0.18);
    topLock1.rotation.set(-0.15, 0.25, -0.35);

    const topLock2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.36, 8, 12), hairMat);
    topLock2.position.set(0.10, 1.56, 0.16);
    topLock2.rotation.set(-0.12, 0.20, -0.28);

    const topLock3 = new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.30, 8, 12), hairMatHighlight);
    topLock3.position.set(0.28, 1.51, 0.14);
    topLock3.rotation.set(-0.10, 0.15, -0.42);

    // Franja lateral fluida em degradê acima da testa
    const fringe1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.046, 0.28, 8, 10), hairMatHighlight);
    fringe1.position.set(-0.06, 1.36, 0.44);
    fringe1.rotation.set(0.1, 0.35, -0.65);

    const fringe2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.042, 0.26, 8, 10), hairMat);
    fringe2.position.set(0.14, 1.32, 0.43);
    fringe2.rotation.set(0.12, 0.25, -0.55);

    const fringe3 = new THREE.Mesh(new THREE.CapsuleGeometry(0.038, 0.22, 8, 10), hairMatHighlight);
    fringe3.position.set(0.32, 1.28, 0.40);
    fringe3.rotation.set(0.15, 0.18, -0.45);

    // Mechas laterais curvadas abraçando a cabeça
    const sideL = new THREE.Mesh(new THREE.CapsuleGeometry(0.058, 0.26, 8, 10), hairMat);
    sideL.position.set(-0.46, 1.22, 0.10);
    sideL.rotation.set(0.10, 0, 0.18);

    const sideR = new THREE.Mesh(new THREE.CapsuleGeometry(0.062, 0.28, 8, 10), hairMat);
    sideR.position.set(0.46, 1.20, 0.10);
    sideR.rotation.set(0.10, 0, -0.18);

    // Volume traseiro suave
    const backLock = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.32, 8, 10), hairMat);
    backLock.position.set(0, 1.22, -0.44);
    backLock.rotation.set(-0.15, 0, 0);

    group.add(
      crown,
      topLock1,
      topLock2,
      topLock3,
      fringe1,
      fringe2,
      fringe3,
      sideL,
      sideR,
      backLock,
    );
    return group;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 3) COM TOPETE (POMPADOUR ROCKABILLY ESCULPIDO)
  // ───────────────────────────────────────────────────────────────────────────
  if (type === "pompadour") {
    // Base bem ajustada ao crânio
    const base = new THREE.Mesh(
      new THREE.SphereGeometry(0.518, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.48),
      hairMat,
    );
    base.position.y = 1.12;

    // Grande corpo ondulado do topete (onda frontal fluida)
    const waveFront = new THREE.Mesh(new THREE.SphereGeometry(0.24, 18, 14), hairMatHighlight);
    waveFront.scale.set(1.15, 1.05, 1.35);
    waveFront.position.set(0, 1.48, 0.30);
    waveFront.rotation.x = -0.32;

    const waveArch = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.36, 10, 14), hairMat);
    waveArch.position.set(0, 1.55, 0.12);
    waveArch.rotation.x = Math.PI / 2.3;

    // Ranhuras elegantes penteadas para trás (dão textura e brilho realista de pomada)
    const ribCenter = new THREE.Mesh(new THREE.CapsuleGeometry(0.042, 0.44, 8, 10), hairMatHighlight);
    ribCenter.position.set(0, 1.59, 0.16);
    ribCenter.rotation.x = 0.65;

    const ribL = new THREE.Mesh(new THREE.CapsuleGeometry(0.038, 0.40, 8, 10), hairMat);
    ribL.position.set(-0.11, 1.56, 0.15);
    ribL.rotation.set(0.62, 0.12, 0.15);

    const ribR = new THREE.Mesh(new THREE.CapsuleGeometry(0.038, 0.40, 8, 10), hairMat);
    ribR.position.set(0.11, 1.56, 0.15);
    ribR.rotation.set(0.62, -0.12, -0.15);

    // Rolo frontal suave virado na ponta
    const frontRoll = new THREE.Mesh(
      new THREE.TorusGeometry(0.13, 0.042, 10, 20, Math.PI),
      hairMatHighlight,
    );
    frontRoll.position.set(0, 1.45, 0.40);
    frontRoll.rotation.x = 0.4;

    // Laterais penteadas rente
    const sweepL = new THREE.Mesh(new THREE.CapsuleGeometry(0.046, 0.28, 8, 10), hairMat);
    sweepL.position.set(-0.43, 1.28, 0.15);
    sweepL.rotation.set(-0.4, -0.3, 0.1);

    const sweepR = new THREE.Mesh(new THREE.CapsuleGeometry(0.046, 0.28, 8, 10), hairMat);
    sweepR.position.set(0.43, 1.28, 0.15);
    sweepR.rotation.set(-0.4, 0.3, -0.1);

    group.add(base, waveFront, waveArch, ribCenter, ribL, ribR, frontRoll, sweepL, sweepR);
    return group;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 4) COMPRIDO (LONG FLOWING LOCKS)
  // ───────────────────────────────────────────────────────────────────────────
  if (type === "long") {
    // Calota superior com divisão central suave
    const crown = new THREE.Mesh(
      new THREE.SphereGeometry(0.524, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.50),
      hairMat,
    );
    crown.position.y = 1.13;

    // Mechas longas da frente caindo pelos ombros esquerdo e direito
    // Lado Esquerdo: cascata em 3 segmentos curvados
    const leftUpper = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.32, 8, 10), hairMatHighlight);
    leftUpper.position.set(-0.45, 1.16, 0.16);
    leftUpper.rotation.set(0.20, 0, 0.14);

    const leftMid = new THREE.Mesh(new THREE.CapsuleGeometry(0.060, 0.30, 8, 10), hairMat);
    leftMid.position.set(-0.43, 0.88, 0.20);
    leftMid.rotation.set(0.14, 0, 0.08);

    const leftTip = new THREE.Mesh(new THREE.CapsuleGeometry(0.050, 0.26, 8, 10), hairMatHighlight);
    leftTip.position.set(-0.39, 0.64, 0.22);
    leftTip.rotation.set(-0.06, 0, -0.10);

    // Lado Direito: cascata em 3 segmentos curvados
    const rightUpper = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.32, 8, 10), hairMatHighlight);
    rightUpper.position.set(0.45, 1.16, 0.16);
    rightUpper.rotation.set(0.20, 0, -0.14);

    const rightMid = new THREE.Mesh(new THREE.CapsuleGeometry(0.060, 0.30, 8, 10), hairMat);
    rightMid.position.set(0.43, 0.88, 0.20);
    rightMid.rotation.set(0.14, 0, -0.08);

    const rightTip = new THREE.Mesh(new THREE.CapsuleGeometry(0.050, 0.26, 8, 10), hairMatHighlight);
    rightTip.position.set(0.39, 0.64, 0.22);
    rightTip.rotation.set(-0.06, 0, 0.10);

    // Manto de mechas fluidas nas costas (múltiplas mechas cilíndricas/capsulares com curvatura)
    const backCenterUp = new THREE.Mesh(new THREE.CapsuleGeometry(0.088, 0.44, 8, 12), hairMat);
    backCenterUp.position.set(0, 1.08, -0.44);

    const backCenterLow = new THREE.Mesh(new THREE.CapsuleGeometry(0.078, 0.42, 8, 12), hairMatHighlight);
    backCenterLow.position.set(0, 0.72, -0.46);

    const backLeft = new THREE.Mesh(new THREE.CapsuleGeometry(0.080, 0.46, 8, 12), hairMat);
    backLeft.position.set(-0.20, 0.84, -0.42);
    backLeft.rotation.z = 0.12;

    const backRight = new THREE.Mesh(new THREE.CapsuleGeometry(0.080, 0.46, 8, 12), hairMat);
    backRight.position.set(0.20, 0.84, -0.42);
    backRight.rotation.z = -0.12;

    const backOuterL = new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.38, 8, 10), hairMatHighlight);
    backOuterL.position.set(-0.35, 0.88, -0.34);
    backOuterL.rotation.z = 0.18;

    const backOuterR = new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.38, 8, 10), hairMatHighlight);
    backOuterR.position.set(0.35, 0.88, -0.34);
    backOuterR.rotation.z = -0.18;

    group.add(
      crown,
      leftUpper,
      leftMid,
      leftTip,
      rightUpper,
      rightMid,
      rightTip,
      backCenterUp,
      backCenterLow,
      backLeft,
      backRight,
      backOuterL,
      backOuterR,
    );
    return group;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 5) TIGELA (ROUNDED BOWL CUT / MODERN CROP)
  // ───────────────────────────────────────────────────────────────────────────
  if (type === "bowl") {
    // Cúpula superior arredondada com volume homogêneo
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.530, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.44),
      hairMat,
    );
    dome.position.y = 1.14;

    // Borda contínua arredondada da tigela (Torus frontal que dá a volta com acabamento suave)
    const fringeRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.485, 0.052, 12, 28, Math.PI * 0.72),
      hairMatHighlight,
    );
    fringeRim.position.set(0, 1.27, 0.08);
    fringeRim.rotation.x = Math.PI / 2 + 0.14;

    // Curvas laterais conectadas suavemente
    const sideRimL = new THREE.Mesh(new THREE.CapsuleGeometry(0.052, 0.28, 8, 10), hairMat);
    sideRimL.position.set(-0.46, 1.24, 0.04);
    sideRimL.rotation.set(0.08, 0, 0.10);

    const sideRimR = new THREE.Mesh(new THREE.CapsuleGeometry(0.052, 0.28, 8, 10), hairMat);
    sideRimR.position.set(0.46, 1.24, 0.04);
    sideRimR.rotation.set(0.08, 0, -0.10);

    // Contorno traseiro da tigela
    const backRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.488, 0.052, 12, 28, Math.PI * 0.75),
      hairMat,
    );
    backRim.position.set(0, 1.23, -0.08);
    backRim.rotation.x = -Math.PI / 2 - 0.14;

    // Franja frontal em mechas sutis arredondadas (sem quinas duras)
    const bangCenter = new THREE.Mesh(new THREE.CapsuleGeometry(0.038, 0.24, 6, 8), hairMatHighlight);
    bangCenter.position.set(0, 1.30, 0.44);
    bangCenter.rotation.z = Math.PI / 2;

    const bangL = new THREE.Mesh(new THREE.CapsuleGeometry(0.036, 0.20, 6, 8), hairMat);
    bangL.position.set(-0.20, 1.28, 0.42);
    bangL.rotation.set(0, 0.2, Math.PI / 2 + 0.1);

    const bangR = new THREE.Mesh(new THREE.CapsuleGeometry(0.036, 0.20, 6, 8), hairMat);
    bangR.position.set(0.20, 1.28, 0.42);
    bangR.rotation.set(0, -0.2, Math.PI / 2 - 0.1);

    group.add(dome, fringeRim, sideRimL, sideRimR, backRim, bangCenter, bangL, bangR);
    return group;
  }

  return group;
}

/**
 * Interface para fatias de lofting contínuo de barbas e bigodes (aspecto inteiriço).
 */
interface BeardLoftSlice {
  center: [number, number, number];
  rx: number;
  ry: number;
  rz?: number;
}

/**
 * Constrói malhas contínuas e unificadas (inteiriças) sem emendas ou cápsulas soltas.
 */
function createBeardLoftMesh(slices: BeardLoftSlice[], radialSegments = 16): THREE.BufferGeometry {
  const geom = new THREE.BufferGeometry();
  const numSlices = slices.length;
  const vertices: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i < numSlices; i++) {
    const s = slices[i]!;
    const [cx, cy, cz] = s.center;
    const rz = s.rz ?? Math.min(s.rx, s.ry);

    for (let j = 0; j < radialSegments; j++) {
      const u = (j / radialSegments) * Math.PI * 2;
      const lx = Math.cos(u) * s.rx;
      const ly = Math.sin(u) * s.ry;
      const sinU = Math.sin(u);
      // Volume frontal completo e projeção de ancoragem controlada na face traseira
      const fwd = (sinU >= 0 ? sinU : sinU * 0.3) * rz;
      vertices.push(cx + lx, cy + ly, cz + fwd);
    }
  }

  // Tampa inicial
  const startCenter = slices[0]!.center;
  const startCenterIdx = vertices.length / 3;
  vertices.push(startCenter[0], startCenter[1], startCenter[2]);
  for (let j = 0; j < radialSegments; j++) {
    const nextJ = (j + 1) % radialSegments;
    indices.push(startCenterIdx, j, nextJ);
  }

  // Quads do corpo
  for (let i = 0; i < numSlices - 1; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const nextJ = (j + 1) % radialSegments;
      const c1 = i * radialSegments + j;
      const c2 = i * radialSegments + nextJ;
      const c3 = (i + 1) * radialSegments + j;
      const c4 = (i + 1) * radialSegments + nextJ;

      indices.push(c1, c3, c2);
      indices.push(c2, c3, c4);
    }
  }

  // Tampa final
  const endSliceIdx = numSlices - 1;
  const endCenter = slices[endSliceIdx]!.center;
  const endCenterIdx = vertices.length / 3;
  vertices.push(endCenter[0], endCenter[1], endCenter[2]);
  for (let j = 0; j < radialSegments; j++) {
    const nextJ = (j + 1) % radialSegments;
    const curr = endSliceIdx * radialSegments + j;
    const next = endSliceIdx * radialSegments + nextJ;
    indices.push(endCenterIdx, next, curr);
  }

  geom.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

/** 1) Grande Bigode Único Contínuo */
function createUnifiedMustacheGeo(scale = 1.0): THREE.BufferGeometry {
  const slices: BeardLoftSlice[] = [
    { center: [-0.22 * scale, 0.935, 0.468], rx: 0.020 * scale, ry: 0.024 * scale, rz: 0.030 * scale },
    { center: [-0.16 * scale, 0.948, 0.505], rx: 0.042 * scale, ry: 0.062 * scale, rz: 0.052 * scale },
    { center: [-0.08 * scale, 0.965, 0.530], rx: 0.046 * scale, ry: 0.075 * scale, rz: 0.060 * scale },
    { center: [0.0, 0.958, 0.538], rx: 0.040 * scale, ry: 0.070 * scale, rz: 0.058 * scale },
    { center: [0.08 * scale, 0.965, 0.530], rx: 0.046 * scale, ry: 0.075 * scale, rz: 0.060 * scale },
    { center: [0.16 * scale, 0.948, 0.505], rx: 0.042 * scale, ry: 0.062 * scale, rz: 0.052 * scale },
    { center: [0.22 * scale, 0.935, 0.468], rx: 0.020 * scale, ry: 0.024 * scale, rz: 0.030 * scale },
  ];
  return createBeardLoftMesh(slices, 16);
}

/** 2) Cavanhaque Grande Único de Peça Inteiriça */
function createUnifiedGoateeGeo(scale = 1.0): THREE.BufferGeometry {
  const slices: BeardLoftSlice[] = [
    { center: [0, 0.885, 0.525], rx: 0.060 * scale, ry: 0.028, rz: 0.042 * scale },
    { center: [0, 0.830, 0.540], rx: 0.100 * scale, ry: 0.038, rz: 0.058 * scale },
    { center: [0, 0.760, 0.552], rx: 0.150 * scale, ry: 0.048, rz: 0.072 * scale },
    { center: [0, 0.700, 0.552], rx: 0.160 * scale, ry: 0.050, rz: 0.075 * scale },
    { center: [0, 0.650, 0.538], rx: 0.130 * scale, ry: 0.042, rz: 0.065 * scale },
    { center: [0, 0.610, 0.518], rx: 0.090 * scale, ry: 0.032, rz: 0.050 * scale },
  ];
  return createBeardLoftMesh(slices, 16);
}

/** 3) Conectores Verticais Contínuos do Bigode ao Cavanhaque */
function createSideConnectorGeo(side: "left" | "right", scale = 1.0): THREE.BufferGeometry {
  const sign = side === "left" ? -1 : 1;
  const slices: BeardLoftSlice[] = [
    { center: [sign * 0.14 * scale, 0.94, 0.508], rx: 0.032 * scale, ry: 0.028 * scale, rz: 0.040 * scale },
    { center: [sign * 0.13 * scale, 0.86, 0.518], rx: 0.035 * scale, ry: 0.032 * scale, rz: 0.045 * scale },
    { center: [sign * 0.12 * scale, 0.78, 0.528], rx: 0.038 * scale, ry: 0.035 * scale, rz: 0.048 * scale },
  ];
  return createBeardLoftMesh(slices, 12);
}

/** 4) Arco Contínuo da Mandíbula de Orelha a Orelha */
function createJawlineArchGeo(scale = 1.0, isThick = false): THREE.BufferGeometry {
  const rMult = (isThick ? 1.25 : 1.0) * scale;
  // Cada ponto é projetado radialmente para fora da cápsula da cabeça (raio 0.50)
  // com distância radial garantida entre 0.536 e 0.551 em todas as fatias
  const slices: BeardLoftSlice[] = [
    { center: [-0.485, 1.06, 0.230], rx: 0.036 * rMult, ry: 0.040 * rMult, rz: 0.042 * rMult },
    { center: [-0.460, 0.94, 0.285], rx: 0.042 * rMult, ry: 0.046 * rMult, rz: 0.048 * rMult },
    { center: [-0.405, 0.82, 0.365], rx: 0.046 * rMult, ry: 0.048 * rMult, rz: 0.054 * rMult },
    { center: [-0.290, 0.72, 0.465], rx: 0.048 * rMult, ry: 0.050 * rMult, rz: 0.058 * rMult },
    { center: [-0.150, 0.67, 0.530], rx: 0.050 * rMult, ry: 0.050 * rMult, rz: 0.062 * rMult },
    { center: [0.0, 0.65, 0.548], rx: 0.052 * rMult, ry: 0.052 * rMult, rz: 0.065 * rMult },
    { center: [0.150, 0.67, 0.530], rx: 0.050 * rMult, ry: 0.050 * rMult, rz: 0.062 * rMult },
    { center: [0.290, 0.72, 0.465], rx: 0.048 * rMult, ry: 0.050 * rMult, rz: 0.058 * rMult },
    { center: [0.405, 0.82, 0.365], rx: 0.046 * rMult, ry: 0.048 * rMult, rz: 0.054 * rMult },
    { center: [0.460, 0.94, 0.285], rx: 0.042 * rMult, ry: 0.046 * rMult, rz: 0.048 * rMult },
    { center: [0.485, 1.06, 0.230], rx: 0.036 * rMult, ry: 0.040 * rMult, rz: 0.042 * rMult },
  ];
  return createBeardLoftMesh(slices, 16);
}

/** 5) Preenchimento Lateral das Bochechas (Inteiriço) */
function createCheekContourGeo(side: "left" | "right", scale = 1.0): THREE.BufferGeometry {
  const sign = side === "left" ? -1 : 1;
  const slices: BeardLoftSlice[] = [
    { center: [sign * 0.44, 1.02, 0.315], rx: 0.042 * scale, ry: 0.038 * scale, rz: 0.045 * scale },
    { center: [sign * 0.36, 0.92, 0.412], rx: 0.048 * scale, ry: 0.042 * scale, rz: 0.052 * scale },
    { center: [sign * 0.24, 0.84, 0.495], rx: 0.045 * scale, ry: 0.038 * scale, rz: 0.048 * scale },
  ];
  return createBeardLoftMesh(slices, 12);
}

/** 6) Barbão Comprido e Cheio (Cascata até o peito de peça inteiriça) */
function createUnifiedLongBeardGeo(scale = 1.0): THREE.BufferGeometry {
  const slices: BeardLoftSlice[] = [
    { center: [0, 0.78, 0.555], rx: 0.16 * scale, ry: 0.045, rz: 0.075 * scale },
    { center: [0, 0.70, 0.585], rx: 0.19 * scale, ry: 0.055, rz: 0.090 * scale },
    { center: [0, 0.60, 0.595], rx: 0.20 * scale, ry: 0.055, rz: 0.095 * scale },
    { center: [0, 0.50, 0.585], rx: 0.18 * scale, ry: 0.055, rz: 0.090 * scale },
    { center: [0, 0.40, 0.560], rx: 0.15 * scale, ry: 0.048, rz: 0.080 * scale },
    { center: [0, 0.30, 0.530], rx: 0.10 * scale, ry: 0.038, rz: 0.065 * scale },
  ];
  return createBeardLoftMesh(slices, 16);
}

/** 7) Preenchimento Anatômico do Queixo (100% frontal em lofting, sem penetração esférica) */
function createChinPadGeo(scale = 1.0): THREE.BufferGeometry {
  const slices: BeardLoftSlice[] = [
    { center: [0, 0.74, 0.540], rx: 0.13 * scale, ry: 0.035 * scale, rz: 0.050 * scale },
    { center: [0, 0.69, 0.555], rx: 0.16 * scale, ry: 0.042 * scale, rz: 0.062 * scale },
    { center: [0, 0.64, 0.550], rx: 0.15 * scale, ry: 0.040 * scale, rz: 0.065 * scale },
    { center: [0, 0.59, 0.530], rx: 0.11 * scale, ry: 0.032 * scale, rz: 0.052 * scale },
  ];
  return createBeardLoftMesh(slices, 16);
}

/**
 * Constrói o modelo 3D da Barba
 * Formato clássico e natural de barbas normais com aspecto 100% inteiriço,
 * sem gomos soltos ou cápsulas desconexas.
 */
export function buildBeardModel(type: BeardType): THREE.Group {
  const group = new THREE.Group();
  if (type === "none") return group;

  // Material acetinado escuro com polygonOffset agressivo para evitar qualquer Z-fighting com o corpo
  const beardMat = new THREE.MeshStandardMaterial({
    color: DEFAULT_HAIR_COLOR,
    roughness: 0.55,
    metalness: 0.06,
    polygonOffset: true,
    polygonOffsetFactor: -2.0,
    polygonOffsetUnits: -8.0,
  });

  const addMesh = (geo: THREE.BufferGeometry) => {
    const m = new THREE.Mesh(geo, beardMat);
    m.castShadow = true;
    m.renderOrder = 2;
    group.add(m);
    return m;
  };

  // 1) GRANDE BIGODE ÚNICO (Peça contínua, encorpada e imponente sob o nariz)
  if (type === "mustache") {
    addMesh(createUnifiedMustacheGeo(1.08));
    return group;
  }

  // 2) CAVANHAQUE GRANDE ÚNICO (Peça sólida inteiriça no queixo e sob o lábio)
  if (type === "goatee") {
    addMesh(createUnifiedGoateeGeo(1.08));
    return group;
  }

  // 3) CAVANHAQUE + BIGODE (Circle Beard interligado clássico)
  if (type === "goatee_mustache") {
    addMesh(createUnifiedMustacheGeo(1.02));
    addMesh(createUnifiedGoateeGeo(1.02));
    addMesh(createSideConnectorGeo("left", 1.0));
    addMesh(createSideConnectorGeo("right", 1.0));
    return group;
  }

  // 4) BARBA CURTA COMPLETA (Designer Stubble / Barba Cerrada Alinhada de orelha a orelha)
  if (type === "full_short") {
    addMesh(createUnifiedMustacheGeo(0.98));
    addMesh(createUnifiedGoateeGeo(0.96));
    addMesh(createJawlineArchGeo(0.98, false));
    addMesh(createSideConnectorGeo("left", 0.95));
    addMesh(createSideConnectorGeo("right", 0.95));
    return group;
  }

  // 5) BARBA CHEIA COMPLETA E TODA INTERLIGADA (Volume denso, maciço e 100% contínuo)
  if (type === "full_medium") {
    addMesh(createUnifiedMustacheGeo(1.14));
    addMesh(createUnifiedGoateeGeo(1.15));
    addMesh(createJawlineArchGeo(1.05, true));
    addMesh(createCheekContourGeo("left", 1.05));
    addMesh(createCheekContourGeo("right", 1.05));
    addMesh(createSideConnectorGeo("left", 1.1));
    addMesh(createSideConnectorGeo("right", 1.1));
    // Preenchimento contínuo anatômico sob a mandíbula sem penetração esférica
    addMesh(createChinPadGeo(1.05));
    return group;
  }

  // 6) BARBÃO COMPLETO, CHEIO, INTERLIGADO E COMPRIDO (Estilo Viking / Lenhador majestoso)
  if (type === "full_thick") {
    addMesh(createUnifiedMustacheGeo(1.20));
    addMesh(createJawlineArchGeo(1.12, true));
    addMesh(createCheekContourGeo("left", 1.12));
    addMesh(createCheekContourGeo("right", 1.12));
    addMesh(createSideConnectorGeo("left", 1.15));
    addMesh(createSideConnectorGeo("right", 1.15));
    addMesh(createUnifiedLongBeardGeo(1.18));
    // Preenchimento contínuo sob o queixo sem esfera invasiva
    addMesh(createChinPadGeo(1.15));
    return group;
  }

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
