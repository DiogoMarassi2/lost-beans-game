import * as THREE from "three";

/** PRNG determinístico (mulberry32) para decoração reprodutível. */
export const seededRandom = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Textura procedural de terra/grama morta para o chão (sem assets externos). */
export const createGroundTexture = (): THREE.CanvasTexture => {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const rand = seededRandom(1337);

  ctx.fillStyle = "#3c433b";
  ctx.fillRect(0, 0, size, size);

  // Manchas grandes (lama / grama) desenhadas com wrap para a textura repetir sem costura
  const blob = (x: number, y: number, r: number, color: string) => {
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
        g.addColorStop(0, color);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
      }
    }
  };
  for (let i = 0; i < 26; i++) blob(rand() * size, rand() * size, 40 + rand() * 90, "rgba(42,36,30,0.5)");
  for (let i = 0; i < 22; i++) blob(rand() * size, rand() * size, 30 + rand() * 70, "rgba(68,85,55,0.45)");

  // Ruído fino
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rand() - 0.5) * 22;
    img.data[i] = Math.max(0, Math.min(255, img.data[i]! + n));
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1]! + n));
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2]! + n));
  }
  ctx.putImageData(img, 0, 0);

  // Folhinhas / gravetos
  for (let i = 0; i < 900; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const l = 2 + rand() * 6;
    const a = rand() * Math.PI;
    ctx.strokeStyle = rand() > 0.5 ? "rgba(70,80,50,0.5)" : "rgba(20,16,14,0.5)";
    ctx.lineWidth = 1 + rand();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
};

/** Textura radial suave (para partículas, sombras blob e brilhos). */
export const createRadialTexture = (inner = "rgba(255,255,255,1)", outer = "rgba(255,255,255,0)"): THREE.CanvasTexture => {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
};

/** Anel brilhante (indicador do jogador local no chão). */
export const createRingTexture = (): THREE.CanvasTexture => {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const c = size / 2;
  const g = ctx.createRadialGradient(c, c, c * 0.55, c, c, c);
  g.addColorStop(0, "rgba(255,255,255,0)");
  g.addColorStop(0.55, "rgba(255,255,255,0.9)");
  g.addColorStop(0.7, "rgba(255,255,255,0.35)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
};

/** Textura de madeira com tábuas para os caixotes. */
export const createCrateTexture = (): THREE.CanvasTexture => {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const rand = seededRandom(42);
  ctx.fillStyle = "#5a3d24";
  ctx.fillRect(0, 0, size, size);
  // tábuas horizontais
  for (let i = 0; i < 5; i++) {
    const y = (i * size) / 5;
    ctx.fillStyle = `hsl(28, 40%, ${18 + rand() * 8}%)`;
    ctx.fillRect(0, y + 2, size, size / 5 - 4);
    for (let k = 0; k < 14; k++) {
      ctx.strokeStyle = "rgba(0,0,0,0.18)";
      ctx.beginPath();
      const yy = y + 4 + rand() * (size / 5 - 8);
      ctx.moveTo(0, yy);
      ctx.bezierCurveTo(size * 0.3, yy + rand() * 4 - 2, size * 0.6, yy + rand() * 4 - 2, size, yy);
      ctx.stroke();
    }
  }
  // moldura e X
  ctx.strokeStyle = "#2e1d10";
  ctx.lineWidth = 22;
  ctx.strokeRect(11, 11, size - 22, size - 22);
  ctx.lineWidth = 18;
  ctx.beginPath();
  ctx.moveTo(18, 18);
  ctx.lineTo(size - 18, size - 18);
  ctx.stroke();
  // pregos
  ctx.fillStyle = "#8a8a8a";
  for (const [x, y] of [[14, 14], [size - 14, 14], [14, size - 14], [size - 14, size - 14]] as const) {
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
};
