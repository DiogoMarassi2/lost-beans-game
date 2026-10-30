import * as THREE from "three";
import { createRadialTexture, seededRandom } from "./textures";

/**
 * Partículas de ambiente: vagalumes esverdeados e poeira flutuando na neblina.
 * Um único draw call com posições animadas na CPU (barato para ~260 pontos).
 */
export class Ambience {
  readonly points: THREE.Points;
  private readonly base: Float32Array;
  private readonly phases: Float32Array;
  static readonly COUNT = 260;

  constructor() {
    const rand = seededRandom(77);
    const n = Ambience.COUNT;
    this.base = new Float32Array(n * 3);
    this.phases = new Float32Array(n);
    const colors = new Float32Array(n * 3);
    const c = new THREE.Color();

    for (let i = 0; i < n; i++) {
      this.base[i * 3] = -35 + rand() * 115;
      this.base[i * 3 + 1] = 0.3 + rand() * 4.5;
      this.base[i * 3 + 2] = -22 + rand() * 44;
      this.phases[i] = rand() * Math.PI * 2;
      if (rand() > 0.35) c.set("#b6ff7a"); // vagalume
      else c.set("#9aa4ff"); // poeira lunar
      colors.set([c.r, c.g, c.b], i * 3);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.base.slice(), 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    this.points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: 0.14,
        map: createRadialTexture(),
        vertexColors: true,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.points.frustumCulled = false;
  }

  update(t: number): void {
    const pos = this.points.geometry.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < Ambience.COUNT; i++) {
      const p = this.phases[i]!;
      arr[i * 3] = this.base[i * 3]! + Math.sin(t * 0.3 + p) * 1.2;
      arr[i * 3 + 1] = this.base[i * 3 + 1]! + Math.sin(t * 0.9 + p * 2) * 0.35;
      arr[i * 3 + 2] = this.base[i * 3 + 2]! + Math.cos(t * 0.25 + p) * 1.2;
    }
    pos.needsUpdate = true;
    const mat = this.points.material as THREE.PointsMaterial;
    mat.opacity = 0.65 + Math.sin(t * 2) * 0.15;
  }
}
