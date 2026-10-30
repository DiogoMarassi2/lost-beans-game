import * as THREE from "three";
import { damp, lerp, START_CAMPFIRE_X, START_CAMPFIRE_Z } from "@dark-beans/shared";

/**
 * Câmera angulada estilo Brawl Stars / Helldivers com suporte à verticalidade (Y).
 * - `follow`: acima e atrás do jogador, subindo suavemente ao subir na varanda/casa.
 * - `orbit`: gira lentamente ao redor da fogueira inicial (fundo do lobby).
 */
export class CameraController {
  readonly camera: THREE.PerspectiveCamera;

  /** Deslocamento da câmera em relação ao alvo (mais próximo para destaque do personagem). */
  static readonly OFFSET = new THREE.Vector3(0, 19, 11);
  /** Quanto a câmera se adianta na direção da mira (unidades de mundo). */
  static readonly LOOK_AHEAD = 1.8;

  private mode: "orbit" | "follow" = "orbit";
  private readonly focus = new THREE.Vector3();
  private readonly desiredFocus = new THREE.Vector3();
  private orbitAngle = 0;
  private shake = 0;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(48, aspect, 0.1, 200);
    this.orbitAngle = 0.8;
    const r = 11.5;
    const tx = START_CAMPFIRE_X + Math.sin(this.orbitAngle) * r;
    const tz = START_CAMPFIRE_Z + Math.cos(this.orbitAngle) * r;
    this.camera.position.set(tx, 7.2, tz);
    const lookX = START_CAMPFIRE_X + Math.cos(this.orbitAngle) * 4.8;
    const lookZ = START_CAMPFIRE_Z - Math.sin(this.orbitAngle) * 4.8;
    this.camera.lookAt(lookX, 0.9, lookZ);
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  /** Segue o jogador em (x, y, z) adiantando levemente em direção ao ponto de mira. */
  follow(x: number, y: number, z: number, aimX: number, aimZ: number): void {
    if (this.mode !== "follow") {
      this.mode = "follow";
      this.focus.set(x, y, z);
    }
    let ax = aimX - x;
    let az = aimZ - z;
    const len = Math.hypot(ax, az);
    if (len > 0.001) {
      const k = Math.min(len / 8, 1) * CameraController.LOOK_AHEAD;
      ax = (ax / len) * k;
      az = (az / len) * k;
    }
    this.desiredFocus.set(x + ax, y, z + az);
  }

  orbit(): void {
    this.mode = "orbit";
  }

  addShake(amount: number): void {
    this.shake = Math.min(this.shake + amount, 1);
  }

  update(dt: number): void {
    if (this.mode === "orbit") {
      this.orbitAngle += dt * 0.08;
      const r = 11.5;
      const tx = START_CAMPFIRE_X + Math.sin(this.orbitAngle) * r;
      const tz = START_CAMPFIRE_Z + Math.cos(this.orbitAngle) * r;
      const t = damp(3, dt);
      this.camera.position.set(
        lerp(this.camera.position.x, tx, t),
        lerp(this.camera.position.y, 7.2, t),
        lerp(this.camera.position.z, tz, t),
      );
      // Desloca o olhar tangencialmente para que a fogueira fique completamente visível ao lado do modal
      const lookX = START_CAMPFIRE_X + Math.cos(this.orbitAngle) * 4.8;
      const lookZ = START_CAMPFIRE_Z - Math.sin(this.orbitAngle) * 4.8;
      this.camera.lookAt(lookX, 0.9, lookZ);
      return;
    }

    const t = damp(7, dt);
    this.focus.lerp(this.desiredFocus, t);

    const target = this.focus.clone().add(CameraController.OFFSET);
    this.camera.position.lerp(target, damp(10, dt));

    if (this.shake > 0) {
      const s = this.shake * this.shake * 0.4;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
      this.shake = Math.max(0, this.shake - dt * 2.5);
    }

    this.camera.lookAt(this.focus.x, this.focus.y + 0.4, this.focus.z);
  }
}
