import * as THREE from "three";
import { SPIT_SPEED, WEB_SPIT_SPEED } from "@dark-beans/shared";
import { createRadialTexture } from "../world/textures";

/**
 * Representação visual 3D de projéteis lançados:
 * - "slime": Bola ácida verde-veneno fluorescente disparada pelo Zumbi Rastejador.
 * - "web": Bola de teia arácnida prateada e espessa com filamentos adesivos da Rainha Aracnídea.
 */
export class SpitProjectileView {
  readonly root = new THREE.Group();

  private x: number;
  private y: number;
  private z: number;
  private readonly vx: number;
  private readonly vz: number;
  private readonly coreMesh: THREE.Mesh;
  private readonly webWire?: THREE.Mesh;
  private readonly glow: THREE.Sprite;
  private readonly droplets: THREE.Mesh[] = [];

  constructor(x: number, y: number, z: number, angle: number, readonly kind = "slime") {
    this.x = x;
    this.y = y;
    this.z = z;
    const speed = kind === "web" ? WEB_SPIT_SPEED : SPIT_SPEED;
    this.vx = Math.sin(angle) * speed;
    this.vz = Math.cos(angle) * speed;

    this.root.position.set(x, y, z);
    this.root.rotation.y = angle;

    const isWeb = kind === "web";

    // 1) Núcleo viscoso da bola de gosma ou novelo de teia arácnida
    const coreRadius = isWeb ? 0.28 : 0.22;
    const coreGeo = new THREE.DodecahedronGeometry(coreRadius, 1);
    const coreMat = isWeb
      ? new THREE.MeshStandardMaterial({
          color: 0xf1f5f9,
          roughness: 0.8,
          emissive: 0x94a3b8,
          emissiveIntensity: 0.4,
          fog: false,
        })
      : new THREE.MeshBasicMaterial({
          color: 0x39ff14,
          fog: false,
        });
    this.coreMesh = new THREE.Mesh(coreGeo, coreMat);
    this.root.add(this.coreMesh);

    // Se for teia, adiciona filamentos externos de seda entrelaçados
    if (isWeb) {
      const wireGeo = new THREE.IcosahedronGeometry(0.34, 1);
      const wireMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        wireframe: true,
        transparent: true,
        opacity: 0.75,
        fog: false,
      });
      this.webWire = new THREE.Mesh(wireGeo, wireMat);
      this.root.add(this.webWire);
    }

    // 2) Halo de brilho (cáustico para gosma, seda etérea brilhante para teia)
    const glowColorCenter = isWeb ? "rgba(240, 245, 255, 0.95)" : "rgba(80, 255, 30, 0.95)";
    const glowColorEdge = isWeb ? "rgba(180, 205, 235, 0)" : "rgba(20, 100, 15, 0)";
    this.glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: createRadialTexture(glowColorCenter, glowColorEdge),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
    );
    const glowScale = isWeb ? 1.5 : 1.3;
    this.glow.scale.set(glowScale, glowScale, 1);
    this.root.add(this.glow);

    // 3) Gotículas orbitais de gosma ácida ou nós de seda pegajosa
    const dropGeo = new THREE.SphereGeometry(isWeb ? 0.075 : 0.065, 6, 6);
    const dropMat = new THREE.MeshBasicMaterial({
      color: isWeb ? 0xe2e8f0 : 0x66ff33,
      fog: false,
    });
    const count = isWeb ? 4 : 3;
    for (let i = 0; i < count; i++) {
      const drop = new THREE.Mesh(dropGeo, dropMat);
      const angleOffset = (i / count) * Math.PI * 2;
      drop.position.set(Math.cos(angleOffset) * 0.28, Math.sin(angleOffset) * 0.18, -0.15 * i);
      this.root.add(drop);
      this.droplets.push(drop);
    }
  }

  sync(serverX: number, serverY: number, serverZ: number): void {
    const dx = serverX - this.x;
    const dz = serverZ - this.z;
    if (dx * dx + dz * dz > 4) {
      this.x = serverX;
      this.z = serverZ;
    } else {
      this.x += dx * 0.4;
      this.z += dz * 0.4;
    }
    this.y = serverY;
    this.root.position.set(this.x, this.y, this.z);
  }

  update(dt: number, t: number): void {
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    this.root.position.set(this.x, this.y, this.z);

    // Rotação orgânica contínua da gosma
    this.coreMesh.rotation.x += dt * 8;
    this.coreMesh.rotation.z += dt * 6;

    // Rotação das gotículas ao redor do núcleo
    for (let i = 0; i < this.droplets.length; i++) {
      const drop = this.droplets[i]!;
      const a = t * 9 + (i / this.droplets.length) * Math.PI * 2;
      drop.position.x = Math.cos(a) * 0.26;
      drop.position.y = Math.sin(a) * 0.22;
    }
  }

  dispose(): void {
    this.coreMesh.geometry.dispose();
    (this.coreMesh.material as THREE.Material).dispose();
    (this.glow.material as THREE.Material).dispose();
    for (const d of this.droplets) {
      d.geometry.dispose();
      (d.material as THREE.Material).dispose();
    }
    if (this.root.parent) {
      this.root.parent.remove(this.root);
    }
  }
}
