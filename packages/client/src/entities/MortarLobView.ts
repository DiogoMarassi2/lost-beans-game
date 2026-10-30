import * as THREE from "three";
import { lerp } from "@dark-beans/shared";
import { createRadialTexture, createRingTexture } from "../world/textures";

/**
 * Representação visual 3D do projétil de morteiro de gosma disparado em arco parabólico:
 * - Bomba de lodo viscosa pesada brilhando em verde-limão radioativo.
 * - Retículo/indicador de impacto holográfico no chão na posição do alvo.
 * - Trajetória parabólica matemática precisa com rotação orgânica contínua.
 * - Efeito de antecipação que permite ao jogador identificar e desviar do impacto.
 */
export class MortarLobView {
  readonly root = new THREE.Group();

  private readonly bombMesh: THREE.Mesh;
  private readonly glow: THREE.Sprite;
  private readonly targetReticle: THREE.Mesh;
  private readonly reticleMat: THREE.MeshBasicMaterial;
  private readonly droplets: THREE.Mesh[] = [];

  private startX: number;
  private startY: number;
  private startZ: number;
  private targetX: number;
  private targetY: number;
  private targetZ: number;
  private duration: number;
  private peakHeight: number;
  private progress: number;
  private localElapsed = 0;
  private splashRadius: number;

  constructor(
    startX: number,
    startY: number,
    startZ: number,
    targetX: number,
    targetY: number,
    targetZ: number,
    duration = 1.0,
    peakHeight = 3.5,
    splashRadius = 3.2,
  ) {
    this.startX = startX;
    this.startY = startY;
    this.startZ = startZ;
    this.targetX = targetX;
    this.targetY = targetY;
    this.targetZ = targetZ;
    this.duration = Math.max(0.1, duration);
    this.peakHeight = peakHeight;
    this.splashRadius = splashRadius;
    this.progress = 0;

    const isHuge = splashRadius > 4.5;

    // 1) Bomba pesada de gosma ácida (muito maior se for disparo do Chefe)
    const bombGeo = new THREE.DodecahedronGeometry(isHuge ? 0.65 : 0.3, 1);
    const bombMat = new THREE.MeshBasicMaterial({
      color: isHuge ? 0x9eff00 : 0xc6ff00,
      fog: false,
    });
    this.bombMesh = new THREE.Mesh(bombGeo, bombMat);
    this.root.add(this.bombMesh);

    // 2) Halo de brilho cáustico ao redor da bomba
    this.glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: createRadialTexture("rgba(198, 255, 0, 1)", "rgba(50, 160, 20, 0)"),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
    );
    this.glow.scale.set(isHuge ? 3.5 : 1.6, isHuge ? 3.5 : 1.6, 1);
    this.bombMesh.add(this.glow);

    // 3) Gotículas orbitais de gosma ácida
    const dropGeo = new THREE.SphereGeometry(isHuge ? 0.14 : 0.08, 6, 6);
    const dropMat = new THREE.MeshBasicMaterial({ color: 0x88ff11, fog: false });
    const dropCount = isHuge ? 6 : 3;
    for (let i = 0; i < dropCount; i++) {
      const drop = new THREE.Mesh(dropGeo, dropMat);
      this.bombMesh.add(drop);
      this.droplets.push(drop);
    }

    // 4) Retículo de perigo no chão mostrando a zona de impacto do morteiro proporcional ao raio de dano
    const reticleSize = splashRadius * 2;
    const reticleGeo = new THREE.PlaneGeometry(reticleSize, reticleSize);
    reticleGeo.rotateX(-Math.PI / 2);
    this.reticleMat = new THREE.MeshBasicMaterial({
      map: createRingTexture(),
      color: isHuge ? 0xff2200 : 0xff4422,
      transparent: true,
      opacity: isHuge ? 0.85 : 0.75,
      depthWrite: false,
      fog: false,
    });
    this.targetReticle = new THREE.Mesh(reticleGeo, this.reticleMat);
    this.targetReticle.position.set(targetX, targetY + 0.03, targetZ);
    this.root.add(this.targetReticle);

    this.updatePosition();
  }

  get targetPosition(): { x: number; y: number; z: number } {
    return { x: this.targetX, y: this.targetY, z: this.targetZ };
  }

  get radius(): number {
    return this.splashRadius;
  }

  sync(
    startX: number,
    startY: number,
    startZ: number,
    targetX: number,
    targetY: number,
    targetZ: number,
    duration: number,
    peakHeight: number,
    progress: number,
    splashRadius?: number,
  ): void {
    this.startX = startX;
    this.startY = startY;
    this.startZ = startZ;
    this.targetX = targetX;
    this.targetY = targetY;
    this.targetZ = targetZ;
    this.duration = Math.max(0.1, duration);
    this.peakHeight = peakHeight;
    this.progress = Math.max(this.progress, progress);
    if (splashRadius !== undefined) {
      this.splashRadius = splashRadius;
    }
    this.targetReticle.position.set(targetX, targetY + 0.03, targetZ);
  }

  update(dt: number, t: number): void {
    this.localElapsed += dt;
    const computedProg = Math.min(1, this.localElapsed / this.duration);
    this.progress = Math.max(this.progress, computedProg);

    this.updatePosition();

    // Rotação orgânica contínua da bomba ao cair
    this.bombMesh.rotation.x += dt * 7;
    this.bombMesh.rotation.z += dt * 5;

    // Gotículas orbitando a bomba em queda
    for (let i = 0; i < this.droplets.length; i++) {
      const drop = this.droplets[i]!;
      const a = t * 8 + (i / this.droplets.length) * Math.PI * 2;
      drop.position.set(Math.cos(a) * 0.35, Math.sin(a) * 0.28, Math.sin(a * 2) * 0.15);
    }

    // Pulsação e contração do anel de impacto no chão
    const ringScale = 1.3 - this.progress * 0.45 + Math.sin(t * 16) * 0.08;
    this.targetReticle.scale.setScalar(Math.max(0.4, ringScale));
    const pulseOpacity = 0.5 + Math.sin(t * 18) * 0.35;
    this.reticleMat.opacity = pulseOpacity * (0.4 + this.progress * 0.6);
  }

  private updatePosition(): void {
    const k = this.progress;
    const x = lerp(this.startX, this.targetX, k);
    const z = lerp(this.startZ, this.targetZ, k);
    const baseY = lerp(this.startY, this.targetY, k);
    const arcY = 4 * this.peakHeight * k * (1 - k);
    const y = baseY + arcY;

    this.bombMesh.position.set(x, y, z);
  }

  dispose(): void {
    this.bombMesh.geometry.dispose();
    (this.bombMesh.material as THREE.Material).dispose();
    (this.glow.material as THREE.Material).dispose();
    this.targetReticle.geometry.dispose();
    this.reticleMat.dispose();
    for (const d of this.droplets) {
      d.geometry.dispose();
      (d.material as THREE.Material).dispose();
    }
    if (this.root.parent) {
      this.root.parent.remove(this.root);
    }
  }
}
