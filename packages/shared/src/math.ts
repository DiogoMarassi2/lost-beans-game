/**
 * Funções matemáticas utilitárias puras (sem dependência de Three.js ou Colyseus).
 */
import { ROOM_CODE_LENGTH } from "./constants";

export const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Normaliza um ângulo para o intervalo (-PI, PI]. */
export const wrapAngle = (a: number): number => {
  const TAU = Math.PI * 2;
  a = ((a % TAU) + TAU) % TAU;
  return a > Math.PI ? a - TAU : a;
};

/** Interpola ângulos pelo caminho mais curto. */
export const lerpAngle = (a: number, b: number, t: number): number =>
  a + wrapAngle(b - a) * t;

/**
 * Fator de suavização independente de framerate.
 * `sharpness` maior = converge mais rápido. Use como `t` em `lerp`.
 */
export const damp = (sharpness: number, dt: number): number => 1 - Math.exp(-sharpness * dt);

/** Garante que um número vindo da rede é finito, caso contrário retorna `fallback`. */
export const finiteOr = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

/** Alfabeto sem caracteres ambíguos (0/O, 1/I/L). */
const ROOM_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export const generateRoomCode = (length = ROOM_CODE_LENGTH): string => {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ROOM_ALPHABET[Math.floor(Math.random() * ROOM_ALPHABET.length)];
  }
  return out;
};

/** Sanitiza um código de sala vindo da URL. Retorna `null` se inválido. */
export const sanitizeRoomCode = (raw: string | null | undefined): string | null => {
  if (!raw) return null;
  const code = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
  return code.length >= 3 ? code : null;
};
