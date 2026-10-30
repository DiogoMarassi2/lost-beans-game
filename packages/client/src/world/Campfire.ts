import * as THREE from "three";
import { createRadialTexture, seededRandom } from "./textures";

/**
 * Fogueira central animada: chamas procedurais, brasas subindo e luz tremeluzente.
 * É o ponto de referência visual da arena (e o ponto de nascimento dos jogadores).
 */
export class Campfire {
  readonly group = new THREE.Group();

  private readonly light: THREE.PointLight;
  private readonly groundGlow: THREE.PointLight;
  private readonly flames: THREE.Mesh[] = [];
  private readonly embers: THREE.Points;
  private readonly emberData: { speed: number; phase: number; life: number }[] = [];
  private readonly glow: THREE.Sprite;
  static readonly EMBERS = 30;

  constructor(x = 0, z = 0) {
    this.group.position.set(x, 0, z);
    const rand = seededRandom(5);

    // Pedras ao redor
    const stoneMat = new THREE.MeshStandardMaterial({ color: "#4b4756", roughness: 0.9 });
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.17 + rand() * 0.07, 0), stoneMat);
      stone.position.set(Math.cos(a) * 0.62, 0.1, Math.sin(a) * 0.62);
      stone.rotation.set(rand() * 3, rand() * 3, rand() * 3);
      stone.scale.y = 0.7;
      stone.castShadow = true;
      this.group.add(stone);
    }

    // Toras cruzadas
    const logMat = new THREE.MeshStandardMaterial({ color: "#3b2416", roughness: 1, emissive: "#ff3b00", emissiveIntensity: 0.15 });
    for (let i = 0; i < 4; i++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.0, 7), logMat);
      const a = (i / 4) * Math.PI;
      log.rotation.set(Math.PI / 2 - 0.35, a, 0, "YXZ");
      log.position.y = 0.18;
      log.castShadow = true;
      this.group.add(log);
    }

    // Chamas: cones aditivos que pulsam
    const flameColors = ["#ff4b1f", "#ff8a1f", "#ffd25c"];
    flameColors.forEach((c, i) => {
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.32 - i * 0.08, 1.1 - i * 0.2, 8, 1, true),
        new THREE.MeshBasicMaterial({
          color: c,
          transparent: true,
          opacity: 0.85 - i * 0.1,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
          fog: false,
        }),
      );
      flame.position.y = 0.55 - i * 0.07;
      this.flames.push(flame);
      this.group.add(flame);
    });

    // Halo de brilho
    this.glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: createRadialTexture("rgba(255,150,60,0.9)", "rgba(255,80,20,0)"),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
      }),
    );
    this.glow.scale.set(3.2, 3.2, 1);
    this.glow.position.y = 0.6;
    this.group.add(this.glow);

    // Luz quente tremeluzente da fogueira
    this.light = new THREE.PointLight("#ff9d4a", 85, 28, 1.25);
    this.light.position.y = 1.0;
    this.light.castShadow = false;
    this.group.add(this.light);

    // Brilho quente suave no chão ao redor das pedras e toras
    this.groundGlow = new THREE.PointLight("#ff7a22", 35, 14, 1.4);
    this.groundGlow.position.y = 0.35;
    this.groundGlow.castShadow = false;
    this.group.add(this.groundGlow);

    // Brasas
    const positions = new Float32Array(Campfire.EMBERS * 3);
    for (let i = 0; i < Campfire.EMBERS; i++) {
      this.emberData.push({ speed: 0.6 + rand() * 1.1, phase: rand() * Math.PI * 2, life: rand() });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.embers = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: "#ffb15c",
        size: 0.09,
        map: createRadialTexture(),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.group.add(this.embers);
  }

  update(dt: number, t: number): void {
    // Tremeluzir com ruído barato (soma de senos)
    const flicker = 0.75 + Math.sin(t * 13) * 0.08 + Math.sin(t * 7.3 + 1.2) * 0.1 + Math.sin(t * 23.1) * 0.05;
    this.light.intensity = 85 * flicker;
    this.groundGlow.intensity = 35 * flicker;
    this.light.position.x = Math.sin(t * 5.1) * 0.05;
    this.light.position.z = Math.cos(t * 4.3) * 0.05;
    this.glow.material.opacity = 0.55 + flicker * 0.3;

    this.flames.forEach((f, i) => {
      const k = 1 + Math.sin(t * (9 + i * 3) + i) * 0.12 + Math.sin(t * 17 + i * 2) * 0.06;
      f.scale.set(1 / Math.sqrt(k), k, 1 / Math.sqrt(k));
      f.rotation.y = t * (1.5 + i);
    });

    const pos = this.embers.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < this.emberData.length; i++) {
      const d = this.emberData[i]!;
      d.life += dt * d.speed * 0.45;
      if (d.life > 1) d.life -= 1;
      const y = 0.3 + d.life * 3.2;
      const r = 0.15 + d.life * 0.5;
      pos.setXYZ(i, Math.cos(d.phase + t * 0.8) * r * Math.sin(d.life * 4), y, Math.sin(d.phase + t * 0.7) * r);
    }
    pos.needsUpdate = true;
  }
}
