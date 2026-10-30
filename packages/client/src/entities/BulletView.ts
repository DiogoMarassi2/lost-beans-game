import * as THREE from "three";
import { BULLET_SPEED } from "@dark-beans/shared";
import { createRadialTexture } from "../world/textures";

/**
 * Representação visual de um projétil no Three.js.
 * - Rastro luminoso alongado (traçante).
 * - Halo brilhante na ponta.
 * - Luz pontual que ilumina a escuridão enquanto a bala viaja.
 * - Dead reckoning local entre os pacotes do servidor (20Hz) para voar a 60/144 FPS suaves.
 */
export class BulletView {
  readonly root = new THREE.Group();

  private x: number;
  private z: number;
  private readonly vx: number;
  private readonly vz: number;
  private readonly mesh: THREE.Mesh;
  private readonly glow: THREE.Sprite;

  constructor(x: number, z: number, angle: number) {
    this.x = x;
    this.z = z;
    this.vx = Math.sin(angle) * BULLET_SPEED;
    this.vz = Math.cos(angle) * BULLET_SPEED;

    this.root.position.set(x, 0.75, z);
    this.root.rotation.y = angle;

    // ─── Projétil traçante (cápsula alongada brilhante) ──────────────────
    const bulletGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.55, 8);
    bulletGeo.rotateX(Math.PI / 2); // Alinha com o eixo Z (frente)
    const bulletMat = new THREE.MeshBasicMaterial({
      color: "#ffffff",
      fog: false,
    });
    this.mesh = new THREE.Mesh(bulletGeo, bulletMat);
    this.root.add(this.mesh);

    // ─── Halo de brilho aditivo ao redor da bala (leve e sem custo de luz dinâmica) ──
    this.glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: createRadialTexture("rgba(255, 220, 100, 1)", "rgba(255, 120, 20, 0)"),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
    );
    this.glow.scale.set(1.4, 1.4, 1);
    this.root.add(this.glow);
  }

  /** Atualiza a posição com o snapshot mais recente do servidor. */
  sync(serverX: number, serverZ: number): void {
    // Corrige desvios sem puxão brusco
    const dx = serverX - this.x;
    const dz = serverZ - this.z;
    if (dx * dx + dz * dz > 4) {
      this.x = serverX;
      this.z = serverZ;
    } else {
      this.x += dx * 0.4;
      this.z += dz * 0.4;
    }
  }

  /** Avança a bala suavemente a cada frame da renderização. */
  update(dt: number): void {
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    this.root.position.set(this.x, 0.75, this.z);
  }

  dispose(): void {
    this.root.removeFromParent();
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.glow.material.map?.dispose();
    this.glow.material.dispose();
  }
}
