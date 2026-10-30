import * as THREE from "three";
import type { CharacterAppearance, EyeType, HairType, BeardType, HatType } from "@dark-beans/shared";
import {
  applyEyeStyle,
  buildBeardModel,
  buildHairModel,
  buildHatModel,
} from "../entities/CharacterCosmetics";

/**
 * Visualizador 3D em tempo real do feijão para a tela de customização de personagem.
 * Permite girar o personagem com o mouse/touch e visualizar cosméticos instantaneamente.
 */
export class CharacterPreview {
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;

  private readonly root = new THREE.Group();
  private readonly wobble = new THREE.Group();
  private readonly bodyMesh: THREE.Mesh;
  private readonly bodyMat: THREE.MeshStandardMaterial;
  private readonly bellyMesh: THREE.Mesh;
  private readonly bellyMat: THREE.MeshStandardMaterial;
  private readonly eyesGroup = new THREE.Group();
  private readonly hairGroup = new THREE.Group();
  private readonly beardGroup = new THREE.Group();
  private readonly hatGroup = new THREE.Group();
  private readonly handL: THREE.Mesh;
  private readonly handR: THREE.Mesh;

  private currentHair: string = "bald";
  private currentEyes: string = "oval_medium";
  private currentBeard: string = "none";
  private currentHat: string = "none";
  private currentColor: string = "#2563eb";

  private animFrameId: number | null = null;
  private isRunning = false;
  private rotY = 0;
  private targetRotY = 0;
  private isDragging = false;
  private lastPointerX = 0;
  private clock = new THREE.Clock();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width || 300;
    const height = rect.height || 360;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 20);
    this.camera.position.set(0, 1.05, 3.2);
    this.camera.lookAt(0, 0.95, 0);

    // ─── Iluminação de Estúdio 3D ─────────────────────────────────────────
    const amb = new THREE.AmbientLight("#f1f5f9", 1.2);

    const keyLight = new THREE.DirectionalLight("#fff4e0", 2.2);
    keyLight.position.set(2, 4, 3);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(512, 512);

    const rimLight = new THREE.DirectionalLight("#38bdf8", 1.8);
    rimLight.position.set(-3, 2, -2);

    const fillLight = new THREE.DirectionalLight("#a855f7", 0.8);
    fillLight.position.set(0, -2, 2);

    this.scene.add(amb, keyLight, rimLight, fillLight);

    // ─── Plataforma / Sombra ──────────────────────────────────────────────
    const discGeo = new THREE.CylinderGeometry(0.85, 0.90, 0.05, 32);
    const discMat = new THREE.MeshStandardMaterial({ color: "#1e1b2e", roughness: 0.6, metalness: 0.3 });
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.position.y = 0.08;
    disc.receiveShadow = true;
    this.scene.add(disc);

    // ─── Estrutura do Feijão ──────────────────────────────────────────────
    this.root.add(this.wobble);
    this.scene.add(this.root);

    const c = new THREE.Color(this.currentColor);
    this.bodyMat = new THREE.MeshStandardMaterial({
      color: c,
      roughness: 0.35,
      metalness: 0.05,
      emissive: c,
      emissiveIntensity: 0.18,
    });
    this.bodyMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 0.6, 8, 20), this.bodyMat);
    this.bodyMesh.position.y = 0.8;
    this.bodyMesh.castShadow = true;
    this.bodyMesh.receiveShadow = true;
    this.wobble.add(this.bodyMesh);

    this.bellyMat = new THREE.MeshStandardMaterial({
      color: c.clone().lerp(new THREE.Color("#ffffff"), 0.45),
      roughness: 0.4,
      emissive: c,
      emissiveIntensity: 0.12,
    });
    this.bellyMesh = new THREE.Mesh(new THREE.SphereGeometry(0.36, 20, 16), this.bellyMat);
    this.bellyMesh.scale.set(1, 1.15, 0.5);
    this.bellyMesh.position.set(0, 0.62, 0.3);
    this.wobble.add(this.bellyMesh);

    // Olhos
    this.eyesGroup.position.set(0, 1.12, 0.38);
    const eyeWhite = new THREE.MeshBasicMaterial({ color: "#ffffff" });
    const pupilMat = new THREE.MeshBasicMaterial({ color: "#111018" });
    const sparkleMat = new THREE.MeshBasicMaterial({ color: "#ffffff" });
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), eyeWhite);
      eye.scale.set(1, 1.25, 0.7);
      eye.position.set(side * 0.17, 0, 0);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.068, 12, 10), pupilMat);
      pupil.position.set(0, -0.01, 0.09);
      const sparkle = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), sparkleMat);
      sparkle.position.set(0.025, 0.03, 0.14);
      eye.add(pupil, sparkle);
      this.eyesGroup.add(eye);
    }
    this.wobble.add(this.eyesGroup);

    // Mãos
    const handMat = new THREE.MeshStandardMaterial({
      color: c.clone().multiplyScalar(0.85),
      roughness: 0.45,
      emissive: c,
      emissiveIntensity: 0.15,
    });
    const handGeo = new THREE.SphereGeometry(0.12, 12, 10);
    this.handL = new THREE.Mesh(handGeo, handMat);
    this.handR = new THREE.Mesh(handGeo, handMat);
    this.handL.position.set(-0.55, 0.72, 0.1);
    this.handR.position.set(0.55, 0.72, 0.1);
    this.wobble.add(this.handL, this.handR);

    // Grupos cosméticos
    this.wobble.add(this.hairGroup, this.beardGroup, this.hatGroup);

    // ─── Controles de Rotação por Arraste (Pointer Events) ───────────────
    canvas.addEventListener("pointerdown", (e) => {
      this.isDragging = true;
      this.lastPointerX = e.clientX;
      canvas.setPointerCapture(e.pointerId);
    });

    canvas.addEventListener("pointermove", (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.lastPointerX;
      this.lastPointerX = e.clientX;
      this.targetRotY += dx * 0.018;
    });

    const stopDrag = (e: PointerEvent) => {
      if (this.isDragging) {
        this.isDragging = false;
        try {
          canvas.releasePointerCapture(e.pointerId);
        } catch {}
      }
    };
    canvas.addEventListener("pointerup", stopDrag);
    canvas.addEventListener("pointercancel", stopDrag);

    // Resize observer para manter nitidez
    const ro = new ResizeObserver(() => this.resize());
    ro.observe(canvas);
  }

  setAppearance(app: CharacterAppearance): void {
    if (app.color && app.color !== this.currentColor) {
      this.currentColor = app.color;
      const c = new THREE.Color(app.color);
      this.bodyMat.color.copy(c);
      this.bodyMat.emissive.copy(c);
      this.bellyMat.color.copy(c.clone().lerp(new THREE.Color("#ffffff"), 0.45));
      this.bellyMat.emissive.copy(c);

      const hMat = this.handL.material as THREE.MeshStandardMaterial;
      hMat.color.copy(c.clone().multiplyScalar(0.85));
      hMat.emissive.copy(c);
    }

    const hair = (app.hair || "bald") as HairType;
    if (hair !== this.currentHair) {
      this.currentHair = hair;
      while (this.hairGroup.children.length > 0) {
        this.hairGroup.remove(this.hairGroup.children[0]!);
      }
      this.hairGroup.add(buildHairModel(hair));
    }

    const eyes = (app.eyes || "oval_medium") as EyeType;
    if (eyes !== this.currentEyes) {
      this.currentEyes = eyes;
      applyEyeStyle(this.eyesGroup, eyes);
    }

    const beard = (app.beard || "none") as BeardType;
    if (beard !== this.currentBeard) {
      this.currentBeard = beard;
      while (this.beardGroup.children.length > 0) {
        this.beardGroup.remove(this.beardGroup.children[0]!);
      }
      this.beardGroup.add(buildBeardModel(beard));
    }

    const hat = (app.hat || "none") as HatType;
    if (hat !== this.currentHat) {
      this.currentHat = hat;
      while (this.hatGroup.children.length > 0) {
        this.hatGroup.remove(this.hatGroup.children[0]!);
      }
      this.hatGroup.add(buildHatModel(hat));
    }
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.renderer.setSize(rect.width, rect.height, false);
    this.camera.aspect = rect.width / rect.height;
    this.camera.updateProjectionMatrix();
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.clock.start();

    const loop = () => {
      if (!this.isRunning) return;
      const t = this.clock.getElapsedTime();

      // Rotação suave interpolada (sem rotação automática; gira apenas com interação do usuário)
      this.rotY += (this.targetRotY - this.rotY) * 0.15;
      this.root.rotation.y = this.rotY;

      // Animação procedural de respiração e balanço leve
      const breath = Math.sin(t * 2.4) * 0.025;
      this.wobble.position.y = breath;
      this.wobble.scale.set(1 - breath * 0.5, 1 + breath, 1 - breath * 0.5);

      // Movimento suave das mãozinhas
      this.handL.position.y = 0.72 + Math.sin(t * 2.4 + 0.4) * 0.03;
      this.handR.position.y = 0.72 + Math.sin(t * 2.4 - 0.4) * 0.03;

      this.renderer.render(this.scene, this.camera);
      this.animFrameId = requestAnimationFrame(loop);
    };

    this.animFrameId = requestAnimationFrame(loop);
  }

  stop(): void {
    this.isRunning = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  dispose(): void {
    this.stop();
    this.renderer.dispose();
  }
}
