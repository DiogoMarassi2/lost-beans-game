import * as THREE from "three";
import type { SoundManager } from "../core/SoundManager";

/**
 * Representação visual e sonora 3D de uma C4 plantada no chão:
 * - Bloco de explosivo militar C-4 com receptor tático e timer digital
 * - LED vermelho e PointLight que piscam com frequência acelerada conforme o tempo esgota
 * - Emite bipes sonoros sincronizados com a luz
 * - Ao detonar: onda de choque, bola de fogo volumétrica expansiva e clarão
 */
export class C4MineView {
  readonly root: THREE.Group;
  private readonly mineBody: THREE.Group;
  private readonly ledMesh: THREE.Mesh;
  private readonly ledLight: THREE.PointLight;
  private readonly ledMaterial: THREE.MeshBasicMaterial;

  // Efeito de explosão pós-detonação
  private explosionGroup: THREE.Group | null = null;
  private fireballMesh: THREE.Mesh | null = null;
  private shockwaveMesh: THREE.Mesh | null = null;
  private explosionLight: THREE.PointLight | null = null;
  private explosionTimer = 0;
  private hasTriggeredDetonation = false;

  private localTimer = 5.0;
  private beepCooldown = 0.5;
  private flashTimer = 0;

  constructor(
    public readonly x: number,
    public readonly y: number,
    public readonly z: number,
    private readonly sound?: SoundManager,
    private readonly onExplodeCameraShake?: () => void,
  ) {
    this.root = new THREE.Group();
    this.root.position.set(x, y + 0.02, z);

    this.mineBody = new THREE.Group();

    // 1) Placa base de suporte
    const baseMat = new THREE.MeshStandardMaterial({ color: "#1e293b", roughness: 0.8 });
    const baseMesh = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.03, 0.36), baseMat);
    baseMesh.position.y = 0.015;
    this.mineBody.add(baseMesh);

    // 2) Bloco de massa explosiva C-4 (cor cáqui/oliva militar)
    const c4Mat = new THREE.MeshStandardMaterial({ color: "#525252", roughness: 0.9 });
    const c4Block = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.3), c4Mat);
    c4Block.position.y = 0.07;
    this.mineBody.add(c4Block);

    // Faixas de fixação / advertência amarela
    const stripeMat = new THREE.MeshStandardMaterial({ color: "#eab308", roughness: 0.5 });
    const stripe1 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.102, 0.304), stripeMat);
    stripe1.position.set(-0.12, 0.07, 0);
    const stripe2 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.102, 0.304), stripeMat);
    stripe2.position.set(0.12, 0.07, 0);
    this.mineBody.add(stripe1, stripe2);

    // 3) Módulo detonador com visor digital e antena
    const detMat = new THREE.MeshStandardMaterial({ color: "#0f172a", roughness: 0.5 });
    const detBox = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.18), detMat);
    detBox.position.set(0, 0.14, 0);
    this.mineBody.add(detBox);

    // Antena metálica fina
    const antMat = new THREE.MeshStandardMaterial({ color: "#94a3b8", metalness: 0.8, roughness: 0.2 });
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.2, 8), antMat);
    ant.position.set(0.06, 0.22, 0.06);
    this.mineBody.add(ant);

    // 4) LED Vermelho piscante de alarme / atração de zumbis
    this.ledMaterial = new THREE.MeshBasicMaterial({ color: "#ef4444" });
    this.ledMesh = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), this.ledMaterial);
    this.ledMesh.position.set(-0.04, 0.175, 0.04);
    this.mineBody.add(this.ledMesh);

    this.ledLight = new THREE.PointLight("#ff0033", 4.5, 4.0, 2);
    this.ledLight.position.set(-0.04, 0.25, 0.04);
    this.mineBody.add(this.ledLight);

    this.mineBody.scale.set(1.65, 1.65, 1.65);
    this.root.add(this.mineBody);
  }

  sync(timer: number, _maxTimer: number, exploded: boolean): void {
    if (exploded && !this.hasTriggeredDetonation) {
      this.triggerExplosionEffect();
    }
    // Re-sincroniza a contagem local caso divirja significativamente da do servidor
    if (Math.abs(this.localTimer - timer) > 0.3) {
      this.localTimer = timer;
    }
  }

  private triggerExplosionEffect(): void {
    this.hasTriggeredDetonation = true;
    this.mineBody.visible = false;
    this.sound?.playExplosion();
    this.onExplodeCameraShake?.();

    // Cria malhas visuais de explosão devastadora
    this.explosionGroup = new THREE.Group();

    // 1) Bola de fogo volumétrica em expansão
    const fireGeo = new THREE.DodecahedronGeometry(0.8, 1);
    const fireMat = new THREE.MeshBasicMaterial({
      color: "#ff5500",
      transparent: true,
      opacity: 0.95,
    });
    this.fireballMesh = new THREE.Mesh(fireGeo, fireMat);
    this.fireballMesh.position.y = 0.6;
    this.explosionGroup.add(this.fireballMesh);

    // 2) Anel de choque no solo
    const ringGeo = new THREE.RingGeometry(0.4, 0.8, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: "#f59e0b",
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    this.shockwaveMesh = new THREE.Mesh(ringGeo, ringMat);
    this.shockwaveMesh.position.y = 0.05;
    this.explosionGroup.add(this.shockwaveMesh);

    // 3) Clarão de fogo e calor intenso
    this.explosionLight = new THREE.PointLight("#ff6600", 25, 12, 1.5);
    this.explosionLight.position.set(0, 1.2, 0);
    this.explosionGroup.add(this.explosionLight);

    this.root.add(this.explosionGroup);
  }

  update(dt: number): void {
    if (!this.hasTriggeredDetonation) {
      this.localTimer = Math.max(0, this.localTimer - dt);

      // Frequência dinâmica acelerada conforme a contagem regressiva se esgota:
      // 5s..3s: 1.0Hz (intervalo 1.0s)
      // 3s..1.8s: 2.2Hz (intervalo 0.45s)
      // 1.8s..0.8s: 4.5Hz (intervalo 0.22s)
      // 0.8s..0s: 8.0Hz (intervalo 0.125s)
      const interval =
        this.localTimer > 3.0 ? 1.0 : this.localTimer > 1.8 ? 0.45 : this.localTimer > 0.8 ? 0.22 : 0.125;

      this.beepCooldown -= dt;
      if (this.beepCooldown <= 0) {
        this.beepCooldown = interval;
        this.flashTimer = Math.min(0.06, interval * 0.45);
        this.sound?.playC4Beep();
      }

      this.flashTimer -= dt;
      const isLit = this.flashTimer > 0;
      this.ledMesh.visible = isLit;
      this.ledLight.visible = isLit;
      this.ledMaterial.color.set(isLit ? "#ff1122" : "#330005");
    }

    if (this.hasTriggeredDetonation && this.explosionGroup) {
      this.explosionTimer += dt;
      const progress = Math.min(1, this.explosionTimer / 0.55);

      if (this.fireballMesh) {
        // Expande até o raio devastador de 6 metros
        const scale = 0.8 + progress * 5.4;
        this.fireballMesh.scale.set(scale, scale * 0.8, scale);
        (this.fireballMesh.material as THREE.MeshBasicMaterial).opacity = (1 - progress) * 0.9;
      }

      if (this.shockwaveMesh) {
        const ringScale = 0.8 + progress * 6.2;
        this.shockwaveMesh.scale.set(ringScale, ringScale, ringScale);
        (this.shockwaveMesh.material as THREE.MeshBasicMaterial).opacity = (1 - progress) * 0.85;
      }

      if (this.explosionLight) {
        this.explosionLight.intensity = (1 - progress) * 25;
      }

      if (progress >= 1) {
        this.explosionGroup.visible = false;
      }
    }
  }

  dispose(): void {
    if (this.fireballMesh) {
      this.fireballMesh.geometry.dispose();
      (this.fireballMesh.material as THREE.Material).dispose();
    }
    if (this.shockwaveMesh) {
      this.shockwaveMesh.geometry.dispose();
      (this.shockwaveMesh.material as THREE.Material).dispose();
    }
    if (this.explosionLight) {
      this.explosionLight.dispose();
    }
    this.root.clear();
  }
}
