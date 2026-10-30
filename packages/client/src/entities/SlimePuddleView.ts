import * as THREE from "three";
import { SLIME_PUDDLE_RADIUS } from "@dark-beans/shared";

/** Cache de textura compartilhada da poça de gosma para alta performance. */
let sharedSlimeTexture: THREE.CanvasTexture | null = null;

function getSlimeTexture(): THREE.CanvasTexture {
  if (sharedSlimeTexture) return sharedSlimeTexture;

  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const center = size / 2;

  // Gradiente radial orgânico e tóxico
  const grad = ctx.createRadialGradient(center, center, 0, center, center, center * 0.95);
  grad.addColorStop(0, "rgba(75, 255, 40, 0.92)");
  grad.addColorStop(0.35, "rgba(40, 200, 30, 0.78)");
  grad.addColorStop(0.65, "rgba(25, 120, 20, 0.55)");
  grad.addColorStop(0.85, "rgba(15, 65, 12, 0.3)");
  grad.addColorStop(1, "rgba(10, 40, 10, 0)");

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Manchas e bolhas orgânicas escuras e claras para dar textura viscosa
  for (let i = 0; i < 18; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * (center * 0.7);
    const bx = center + Math.cos(angle) * dist;
    const by = center + Math.sin(angle) * dist;
    const br = 3 + Math.random() * 8;

    ctx.fillStyle = i % 2 === 0 ? "rgba(140, 255, 90, 0.6)" : "rgba(10, 50, 15, 0.5)";
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
  }

  sharedSlimeTexture = new THREE.CanvasTexture(canvas);
  sharedSlimeTexture.colorSpace = THREE.SRGBColorSpace;
  return sharedSlimeTexture;
}

/**
 * Representação visual 3D de uma poça de gosma ácida no chão:
 * - Disco orgânico verde tóxico semi-transparente.
 * - Bolhas ácidas que sobem suavemente e estouram.
 * - Fade out gradual nos momentos finais antes de sumir.
 */
export class SlimePuddleView {
  readonly root = new THREE.Group();

  private readonly mesh: THREE.Mesh;
  private readonly puddleMat: THREE.MeshBasicMaterial;
  private readonly bubbles: { mesh: THREE.Mesh; seed: number; speed: number; maxH: number }[] = [];

  private lifetime: number;

  constructor(x: number, y: number, z: number, radius = SLIME_PUDDLE_RADIUS, lifetime = 7.5, _maxLifetime = 7.5) {
    this.lifetime = lifetime;

    this.root.position.set(x, y + 0.02, z);

    // 1) Disco da poça no chão (plano horizontal)
    const geo = new THREE.PlaneGeometry(radius * 2.2, radius * 2.2);
    geo.rotateX(-Math.PI / 2);
    this.puddleMat = new THREE.MeshBasicMaterial({
      map: getSlimeTexture(),
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      fog: false,
    });
    this.mesh = new THREE.Mesh(geo, this.puddleMat);
    this.root.add(this.mesh);

    // 2) Micro-bolhas ácidas que borbulham do chão
    const bubbleMat = new THREE.MeshBasicMaterial({
      color: 0x4dff33,
      transparent: true,
      opacity: 0.75,
      fog: false,
    });
    const bubbleGeo = new THREE.SphereGeometry(0.06, 8, 6);

    for (let i = 0; i < 4; i++) {
      const bMesh = new THREE.Mesh(bubbleGeo, bubbleMat);
      const angle = (i / 4) * Math.PI * 2 + Math.random() * 0.5;
      const dist = (0.2 + Math.random() * 0.45) * radius;
      bMesh.position.set(Math.cos(angle) * dist, 0.02, Math.sin(angle) * dist);
      this.root.add(bMesh);

      this.bubbles.push({
        mesh: bMesh,
        seed: Math.random() * 10,
        speed: 1.2 + Math.random() * 1.5,
        maxH: 0.12 + Math.random() * 0.16,
      });
    }
  }

  sync(x: number, y: number, z: number, lifetime: number, _maxLifetime: number): void {
    this.lifetime = lifetime;
    this.root.position.set(x, y + 0.02, z);
  }

  update(_dt: number, t: number): void {
    // Fade out nos últimos 1.5 segundos
    const fade = Math.min(1, Math.max(0, this.lifetime / 1.5));
    this.puddleMat.opacity = fade * 0.85;
    this.mesh.scale.setScalar(0.75 + 0.25 * fade);

    // Animação das bolhas ácidas
    for (const b of this.bubbles) {
      const phase = ((t * b.speed + b.seed) % 1);
      b.mesh.position.y = phase * b.maxH;
      const bScale = Math.sin(phase * Math.PI) * (0.8 + 0.4 * fade);
      b.mesh.scale.setScalar(Math.max(0.01, bScale));
    }
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.puddleMat.dispose();
    for (const b of this.bubbles) {
      b.mesh.geometry.dispose();
      (b.mesh.material as THREE.Material).dispose();
    }
    if (this.root.parent) {
      this.root.parent.remove(this.root);
    }
  }
}
