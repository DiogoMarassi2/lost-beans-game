import * as THREE from "three";
import { calculateElevation, clamp, damp, lerp, lerpAngle, PLAYER_SPEED } from "@dark-beans/shared";
import { createRadialTexture, createRingTexture } from "../world/textures";
import { buildGunModel, buildKnifeModel } from "./WeaponModels";
import {
  applyEyeStyle,
  buildBeardModel,
  buildHairModel,
  buildHatModel,
} from "./CharacterCosmetics";
import type { BeardType, EyeType, HairType, HatType } from "@dark-beans/shared";

interface Snapshot {
  t: number;
  x: number;
  y: number;
  z: number;
  aim: number;
}

/** Shader do facho de luz falso (cone volumétrico barato, aditivo e com fade nas bordas). */
const BEAM_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vViewDir = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;
const BEAM_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    float along = pow(vUv.y, 1.6);                       // mais forte perto da lanterna
    float edge = pow(abs(dot(vNormal, vViewDir)), 1.4);  // bordas suaves
    gl_FragColor = vec4(uColor, along * edge * uOpacity);
  }
`;

interface SmokeParticle {
  sprite: THREE.Sprite;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  maxAge: number;
  initialScale: number;
  maxScale: number;
  active: boolean;
}

/**
 * Representação visual 3D de um jogador ("feijão").
 * Não decide nada de gameplay: apenas desenha onde o servidor (ou a predição local) mandou
 * e aplica animação procedural de bamboleio estilo Fall Guys.
 *
 * Hierarquia:  root (posição) → yaw (mira) → wobble (pulo/inclinação/squash) → malhas
 */
export class PlayerView {
  readonly root = new THREE.Group();
  readonly isLocal: boolean;

  /** Atraso de renderização para interpolação entre snapshots (ms). */
  static readonly INTERP_DELAY_MS = 110;

  private readonly yaw = new THREE.Group();
  private readonly wobble = new THREE.Group();
  private readonly handL: THREE.Mesh;
  private readonly handR: THREE.Mesh;
  private readonly gun: THREE.Group;
  private readonly gunModelGroup = new THREE.Group();
  private readonly knife: THREE.Group;
  private readonly knifeModelGroup = new THREE.Group();
  private currentGunLevel = 0;
  private currentKnifeLevel = 0;
  private readonly bandageMesh: THREE.Group;
  private readonly c4Mesh: THREE.Group;
  private readonly flareMesh: THREE.Group;
  private readonly defibrillatorMesh: THREE.Group;
  private readonly flareLight: THREE.PointLight;
  private readonly flareSmokeGroup = new THREE.Group();
  private readonly smokeParticles: SmokeParticle[] = [];
  private flareActive = false;
  private flareSmokeTimer = 0;
  private readonly webCocoonGroup: THREE.Group;
  private isWebbed = false;
  private equippedItem:
    | "knife"
    | "pistol"
    | "bandage"
    | "armor"
    | "c4"
    | "defibrillator"
    | "plant_sprout"
    | "spider_head"
    | "werewolf_tooth"
    | "sack"
    | "flare"
    | "sinalizador"
    | "" = "knife";
  private slashTimer = 0;
  private readonly flashlight: THREE.SpotLight;
  private readonly beam: THREE.Mesh;
  private readonly bodyMat: THREE.MeshStandardMaterial;
  private readonly label: THREE.Sprite;
  private readonly ring: THREE.Mesh | null = null;
  private readonly eyes: THREE.Group;
  private readonly muzzleFlash: THREE.Sprite;
  private readonly muzzleLight: THREE.PointLight;
  private readonly baseColor: THREE.Color;
  private readonly bellyMat: THREE.MeshStandardMaterial;
  private recoil = 0;
  private muzzleTimer = 0;
  private hitFlashTimer = 0;

  private readonly hairGroup = new THREE.Group();
  private readonly beardGroup = new THREE.Group();
  private readonly hatGroup = new THREE.Group();
  private currentHair: string = "bald";
  private currentEyes: string = "oval_medium";
  private currentBeard: string = "none";
  private currentHat: string = "none";
  private currentColor: string = "";

  private snapshots: Snapshot[] = [];
  private name = "";

  // Estado exibido
  private x = 0;
  private y = 0;
  private z = 0;
  private aim = 0;
  private displayAim = 0;
  private prevX = 0;
  private prevZ = 0;
  private velX = 0;
  private velZ = 0;
  private walkPhase = 0;
  private walkBlend = 0;
  private blinkTimer = 2 + Math.random() * 3;
  private hasPose = false;
  private dead = false;

  constructor(color: string, name: string, isLocal: boolean) {
    this.isLocal = isLocal;
    this.root.add(this.yaw);
    this.yaw.add(this.wobble);

    const c = new THREE.Color(color);
    this.baseColor = c.clone();

    // ─── Corpo cápsula ──────────────────────────────────────────────────
    this.bodyMat = new THREE.MeshStandardMaterial({
      color: c,
      roughness: 0.35,
      metalness: 0.05,
      emissive: c,
      emissiveIntensity: 0.22,
    });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 0.6, 8, 20), this.bodyMat);
    body.position.y = 0.8;
    body.castShadow = true;
    body.receiveShadow = true;
    this.wobble.add(body);

    // Barriguinha mais clara
    this.bellyMat = new THREE.MeshStandardMaterial({
      color: c.clone().lerp(new THREE.Color("#ffffff"), 0.45),
      roughness: 0.4,
      emissive: c,
      emissiveIntensity: 0.15,
    });
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.36, 20, 16), this.bellyMat);
    belly.scale.set(1, 1.15, 0.5);
    belly.position.set(0, 0.62, 0.3);
    this.wobble.add(belly);

    // ─── Olhos expressivos (sempre brilhantes no escuro) ───────────────
    this.eyes = new THREE.Group();
    this.eyes.position.set(0, 1.12, 0.38);
    const eyeWhite = new THREE.MeshBasicMaterial({ color: "#ffffff" });
    const pupilMat = new THREE.MeshBasicMaterial({ color: "#111018" });
    const sparkleMat = new THREE.MeshBasicMaterial({ color: "#ffffff" });
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), eyeWhite);
      eye.scale.set(1, 1.2, 0.7);
      eye.position.set(side * 0.17, 0, 0);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.068, 12, 10), pupilMat);
      pupil.position.set(0, -0.01, 0.09);
      const sparkle = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), sparkleMat);
      sparkle.position.set(0.025, 0.03, 0.14);
      eye.add(pupil, sparkle);
      this.eyes.add(eye);
    }
    this.wobble.add(this.eyes);
    this.wobble.add(this.hairGroup, this.beardGroup, this.hatGroup);

    // ─── Mãos flutuantes + arma com lanterna ────────────────────────────
    const handMat = new THREE.MeshStandardMaterial({
      color: c.clone().multiplyScalar(0.85),
      roughness: 0.45,
      emissive: c,
      emissiveIntensity: 0.15,
    });
    const handGeo = new THREE.SphereGeometry(0.12, 12, 10);
    this.handL = new THREE.Mesh(handGeo, handMat);
    this.handR = new THREE.Mesh(handGeo, handMat);
    this.handL.castShadow = this.handR.castShadow = true;
    this.wobble.add(this.handL, this.handR);

    this.gun = new THREE.Group();
    // Clarão do disparo (Muzzle Flash)
    this.muzzleFlash = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: createRadialTexture("rgba(255, 240, 150, 1)", "rgba(255, 120, 0, 0)"),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
    );
    this.muzzleFlash.position.set(0, 0, 0.42);
    this.muzzleFlash.scale.set(0.7, 0.7, 1);
    this.muzzleFlash.visible = false;

    this.muzzleLight = new THREE.PointLight("#ffb044", 6, 4, 2);
    this.muzzleLight.position.set(0, 0, 0.45);
    this.muzzleLight.visible = false;

    this.gun.add(this.gunModelGroup, this.muzzleFlash, this.muzzleLight);
    this.gun.position.set(0.12, 0.78, 0.6);
    this.wobble.add(this.gun);

    // ─── Faca de Combate Tática ─────────────────────────────────────────
    this.knife = new THREE.Group();
    this.knife.add(this.knifeModelGroup);
    this.knife.position.set(0.24, 0.72, 0.55);
    this.wobble.add(this.knife);

    // Inicializa os modelos 3D no nível 1 (Pistola Básica e Canivete)
    this.setWeaponLevels(1, 1);

    // ─── Bandagem Médica de Campo ───────────────────────────────────────
    this.bandageMesh = new THREE.Group();
    const rollMat = new THREE.MeshStandardMaterial({ color: "#f8fafc", roughness: 0.85 });
    const rollGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.18, 14);
    rollGeo.rotateX(Math.PI / 2);
    const roll = new THREE.Mesh(rollGeo, rollMat);

    const redMat = new THREE.MeshBasicMaterial({ color: "#ef4444" });
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.09, 0.01), redMat);
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.03, 0.01), redMat);
    crossH.position.set(0, 0, 0.092);
    crossV.position.set(0, 0, 0.092);
    this.bandageMesh.add(roll, crossH, crossV);
    this.bandageMesh.position.set(0.08, 0.76, 0.52);
    this.wobble.add(this.bandageMesh);

    // ─── C4 Explosivo Tático na Mão ─────────────────────────────────────
    this.c4Mesh = new THREE.Group();
    const c4BlockMat = new THREE.MeshStandardMaterial({ color: "#374151", roughness: 0.85 });
    // Bloco principal de C4 robusto e tático (ampliado para excelente visibilidade na mão)
    const c4Brick = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.20), c4BlockMat);

    // Faixas de advertência amarela militar
    const c4StripeMat = new THREE.MeshStandardMaterial({ color: "#eab308", roughness: 0.5 });
    const c4StripeL = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.144, 0.204), c4StripeMat);
    c4StripeL.position.x = -0.09;
    const c4StripeR = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.144, 0.204), c4StripeMat);
    c4StripeR.position.x = 0.09;

    // Pack do detonador eletrônico superior
    const detPackMat = new THREE.MeshStandardMaterial({ color: "#0f172a", roughness: 0.4 });
    const detPack = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.05, 0.13), detPackMat);
    detPack.position.set(0.02, 0.095, 0.01);

    // Antena do detonador
    const antMat = new THREE.MeshStandardMaterial({ color: "#cbd5e1", metalness: 0.8, roughness: 0.2 });
    const detAntenna = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.14, 8), antMat);
    detAntenna.position.set(0.06, 0.17, 0.04);

    // LED vermelho de alerta do detonador
    const c4Led = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), new THREE.MeshBasicMaterial({ color: "#ef4444" }));
    c4Led.position.set(-0.02, 0.12, 0.04);

    this.c4Mesh.add(c4Brick, c4StripeL, c4StripeR, detPack, detAntenna, c4Led);
    this.c4Mesh.position.set(0.08, 0.72, 0.53);
    this.wobble.add(this.c4Mesh);

    // ─── Sinalizador de Resgate na Mão ──────────────────────────────────
    this.flareMesh = new THREE.Group();
    const flareBodyGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.32, 10);
    const flareBodyMat = new THREE.MeshStandardMaterial({ color: "#dc2626", roughness: 0.6, metalness: 0.2 });
    const flareTube = new THREE.Mesh(flareBodyGeo, flareBodyMat);

    const stripeGeo = new THREE.CylinderGeometry(0.036, 0.036, 0.08, 10);
    const stripeMat = new THREE.MeshStandardMaterial({ color: "#f8fafc", roughness: 0.5 });
    const flareStripe = new THREE.Mesh(stripeGeo, stripeMat);
    flareStripe.position.y = 0.02;

    const tipGeo = new THREE.ConeGeometry(0.045, 0.12, 10);
    const tipMat = new THREE.MeshBasicMaterial({ color: "#fef08a" });
    const flareFlame = new THREE.Mesh(tipGeo, tipMat);
    flareFlame.position.y = 0.21;

    const sparkMat = new THREE.MeshBasicMaterial({ color: "#ff4400" });
    const spark = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 6), sparkMat);
    spark.position.y = 0.27;

    this.flareMesh.add(flareTube, flareStripe, flareFlame, spark);
    this.flareMesh.position.set(0.18, 0.78, 0.5);
    this.flareMesh.visible = false;
    this.wobble.add(this.flareMesh);

    // ─── Desfibrilador Médico nos Braços/Mãos ─────────────────────────
    this.defibrillatorMesh = new THREE.Group();

    const createPaddle = (isRight: boolean) => {
      const paddleGroup = new THREE.Group();
      // Base ergonômica amarela de emergência médica
      const baseMat = new THREE.MeshStandardMaterial({ color: "#eab308", roughness: 0.35, metalness: 0.2 });
      const baseMesh = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.16, 0.07), baseMat);

      // Placa condutora de choque metálica prateada
      const plateMat = new THREE.MeshStandardMaterial({ color: "#f1f5f9", roughness: 0.15, metalness: 0.95 });
      const plateMesh = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.14, 0.015), plateMat);
      plateMesh.position.set(0, 0, 0.04);

      // Alça ergonômica preta isolada
      const handleMat = new THREE.MeshStandardMaterial({ color: "#0f172a", roughness: 0.6 });
      const handleMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.12, 8), handleMat);
      handleMesh.position.set(0, 0, -0.05);
      handleMesh.rotation.x = Math.PI / 2;

      // Botão de choque vermelho na alça
      const btnMat = new THREE.MeshStandardMaterial({ color: "#ef4444", roughness: 0.3 });
      const btnMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.015, 8), btnMat);
      btnMesh.position.set(0, 0.045, -0.05);

      // Indicador luminoso de carga pronta (LED ciano/elétrico)
      const ledMat = new THREE.MeshBasicMaterial({ color: "#22d3ee" });
      const ledMesh = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), ledMat);
      ledMesh.position.set(isRight ? 0.035 : -0.035, 0.05, 0.04);

      paddleGroup.add(baseMesh, plateMesh, handleMesh, btnMesh, ledMesh);
      paddleGroup.position.set(isRight ? 0.16 : -0.16, 0, 0.12);
      paddleGroup.rotation.y = isRight ? -0.25 : 0.25;
      return paddleGroup;
    };

    const paddleL = createPaddle(false);
    const paddleR = createPaddle(true);

    // Cabo espiral flexível unindo as duas pás
    const wireMat = new THREE.MeshStandardMaterial({ color: "#1e293b", roughness: 0.8 });
    const wireGeo = new THREE.TorusGeometry(0.12, 0.01, 6, 16, Math.PI);
    const wireMesh = new THREE.Mesh(wireGeo, wireMat);
    wireMesh.position.set(0, -0.05, 0.06);
    wireMesh.rotation.x = Math.PI / 2;

    this.defibrillatorMesh.add(paddleL, paddleR, wireMesh);
    this.defibrillatorMesh.position.set(0, 0.72, 0.42);
    this.defibrillatorMesh.visible = false;
    this.wobble.add(this.defibrillatorMesh);

    // Luz de ignição do sinalizador
    this.flareLight = new THREE.PointLight("#ff2200", 0, 8.0, 1.8);
    this.flareLight.position.set(0, 0.32, 0);
    this.flareMesh.add(this.flareLight);

    // Emissor de fumaça vermelha do sinalizador
    const smokeTex = createRadialTexture("rgba(239, 45, 45, 0.88)", "rgba(185, 28, 28, 0)");
    this.root.add(this.flareSmokeGroup);
    for (let i = 0; i < 35; i++) {
      const mat = new THREE.SpriteMaterial({
        map: smokeTex,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const sp = new THREE.Sprite(mat);
      sp.visible = false;
      this.flareSmokeGroup.add(sp);
      this.smokeParticles.push({
        sprite: sp,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        age: 0,
        maxAge: 1,
        initialScale: 0.35,
        maxScale: 1.8,
        active: false,
      });
    }

    // Inicia equipado apenas com a faca!
    this.setEquippedItem("knife");

    // ─── Luz de aura (ilumina o próprio personagem e mãos suavemente) ──
    const aura = new THREE.PointLight(c, 1.4, 4.0, 1.8);
    aura.position.set(0, 0.9, 0.2);
    this.yaw.add(aura);

    // ─── Lanterna (SpotLight potente acoplada à mira) ───────────────────
    this.flashlight = new THREE.SpotLight("#fff0c4", isLocal ? 160 : 100, 26, 0.52, 0.65, 1.2);
    this.flashlight.position.set(0.12, 0.7, 0.85);
    this.flashlight.target.position.set(0.12, 0, 9);
    if (isLocal) {
      // Sombras só na lanterna local: N lanternas com sombra custariam N shadow maps
      this.flashlight.castShadow = true;
      this.flashlight.shadow.mapSize.set(1024, 1024);
      this.flashlight.shadow.bias = -0.0015;
      this.flashlight.shadow.camera.near = 0.3;
    }
    this.yaw.add(this.flashlight, this.flashlight.target);

    // Facho volumétrico falso para o feixe "aparecer" na neblina
    const beamLen = 9;
    const beamGeo = new THREE.ConeGeometry(Math.tan(0.48) * beamLen, beamLen, 24, 1, true);
    beamGeo.translate(0, -beamLen / 2, 0); // ponta na origem
    beamGeo.rotateX(-Math.PI / 2 + 0.08); // aponta para +Z, levemente para baixo
    this.beam = new THREE.Mesh(
      beamGeo,
      new THREE.ShaderMaterial({
        vertexShader: BEAM_VERT,
        fragmentShader: BEAM_FRAG,
        uniforms: {
          uColor: { value: new THREE.Color("#ffdf9e") },
          uOpacity: { value: isLocal ? 0.35 : 0.22 },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    );
    this.beam.position.set(0.12, 0.7, 0.85);
    this.beam.renderOrder = 2;
    this.yaw.add(this.beam);

    // ─── Sombra blob no chão (ancora o boneco no escuro) ────────────────
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 1.5),
      new THREE.MeshBasicMaterial({
        map: createRadialTexture("rgba(0,0,0,0.65)", "rgba(0,0,0,0)"),
        transparent: true,
        depthWrite: false,
      }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.01;
    this.root.add(shadow);

    // ─── Anel indicador do jogador local ────────────────────────────────
    if (isLocal) {
      this.ring = new THREE.Mesh(
        new THREE.PlaneGeometry(1.9, 1.9),
        new THREE.MeshBasicMaterial({
          map: createRingTexture(),
          color: c,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          fog: false,
        }),
      );
      this.ring.rotation.x = -Math.PI / 2;
      this.ring.position.y = 0.02;
      this.root.add(this.ring);
    }

    // ─── Nome flutuante ─────────────────────────────────────────────────
    this.label = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, fog: false }));
    this.label.position.y = 2.15;
    this.label.renderOrder = 10;
    this.root.add(this.label);
    this.setName(name, color);
    // ─── Casulo / Fios de Teia Paralisante em Volta do Jogador ────────────
    this.webCocoonGroup = new THREE.Group();
    const webSilkMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.85,
      metalness: 0.1,
      transparent: true,
      opacity: 0.85,
      emissive: 0xffffff,
      emissiveIntensity: 0.25,
      fog: false,
    });

    const ringGeo1 = new THREE.TorusGeometry(0.48, 0.045, 8, 20);
    const ring1 = new THREE.Mesh(ringGeo1, webSilkMat);
    ring1.rotation.set(0.4, 0.3, 0.5);
    ring1.position.set(0, 0.8, 0);

    const ringGeo2 = new THREE.TorusGeometry(0.52, 0.04, 8, 20);
    const ring2 = new THREE.Mesh(ringGeo2, webSilkMat);
    ring2.rotation.set(-0.5, 0.4, -0.6);
    ring2.position.set(0, 0.55, 0);

    const strandGeo = new THREE.CylinderGeometry(0.025, 0.025, 1.1, 6);
    const strand1 = new THREE.Mesh(strandGeo, webSilkMat);
    strand1.rotation.z = 0.55;
    strand1.position.set(0, 0.65, 0.35);

    const strand2 = new THREE.Mesh(strandGeo, webSilkMat);
    strand2.rotation.z = -0.55;
    strand2.position.set(0, 0.65, 0.35);

    const knotGeo = new THREE.DodecahedronGeometry(0.14, 0);
    const knot1 = new THREE.Mesh(knotGeo, webSilkMat);
    knot1.position.set(-0.25, 0.08, 0.1);
    const knot2 = new THREE.Mesh(knotGeo, webSilkMat);
    knot2.position.set(0.25, 0.08, 0.1);

    this.webCocoonGroup.add(ring1, ring2, strand1, strand2, knot1, knot2);
    this.webCocoonGroup.visible = false;
    this.wobble.add(this.webCocoonGroup);

    this.updateHands(0);
  }

  setWebbed(webbed: boolean): void {
    if (this.isWebbed !== webbed) {
      this.isWebbed = webbed;
      this.webCocoonGroup.visible = webbed;
    }
  }

  // ─── API de dados ─────────────────────────────────────────────────────

  setName(name: string, color?: string): void {
    if (name === this.name) return;
    this.name = name;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    const font = "700 44px Outfit, system-ui, sans-serif";
    ctx.font = font;
    const w = Math.ceil(ctx.measureText(name).width) + 48;
    canvas.width = w;
    canvas.height = 72;
    ctx.font = font;
    ctx.fillStyle = "rgba(10,8,20,0.6)";
    const r = 30;
    ctx.beginPath();
    ctx.roundRect(4, 6, w - 8, 60, r);
    ctx.fill();
    ctx.fillStyle = color ?? "#ffffff";
    ctx.beginPath();
    ctx.arc(28, 36, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f4f1ff";
    ctx.textBaseline = "middle";
    ctx.fillText(name, 44, 38);

    const mat = this.label.material;
    mat.map?.dispose();
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    mat.map = tex;
    mat.needsUpdate = true;
    const h = 0.36;
    this.label.scale.set((w / 72) * h, h, 1);
  }

  /** Adiciona um snapshot autoritativo recebido do servidor (jogadores remotos). */
  pushSnapshot(t: number, x: number, y: number, z: number, aim: number): void {
    if (!this.hasPose) this.setPose(x, y, z, aim, true);
    this.snapshots.push({ t, x, y, z, aim });
    if (this.snapshots.length > 30) this.snapshots.shift();
  }

  /** Interpola entre os dois snapshots que cercam `renderTime` (passado ~110ms). */
  interpolate(renderTime: number): void {
    const s = this.snapshots;
    if (s.length === 0) return;
    // Descarta snapshots antigos, mantendo um antes do renderTime
    while (s.length >= 2 && s[1]!.t <= renderTime) s.shift();
    const a = s[0]!;
    const b = s[1];
    if (!b || renderTime <= a.t) {
      this.setPose(a.x, a.y, a.z, a.aim);
      return;
    }
    const k = clamp((renderTime - a.t) / Math.max(1, b.t - a.t), 0, 1);
    this.setPose(lerp(a.x, b.x, k), lerp(a.y, b.y, k), lerp(a.z, b.z, k), lerpAngle(a.aim, b.aim, k));
  }

  /** Define diretamente a pose exibida (predição do jogador local). */
  setPose(x: number, y: number, z: number, aim: number, teleport = false): void {
    this.x = x;
    this.y = y;
    this.z = z;
    this.aim = aim;
    if (teleport || !this.hasPose) {
      this.prevX = x;
      this.prevZ = z;
      this.displayAim = aim;
      this.root.position.set(x, y, z);
      this.hasPose = true;
    }
  }

  get position(): { x: number; y: number; z: number } {
    return { x: this.x, y: this.y, z: this.z };
  }

  /** Define se o jogador está morto (faz o boneco cair no chão e apaga a lanterna) */
  setDead(isDead: boolean): void {
    if (this.dead === isDead) return;
    this.dead = isDead;
    this.flashlight.visible = !isDead;
    this.beam.visible = !isDead;
    if (isDead) {
      this.knife.visible = false;
      this.gun.visible = false;
      this.bandageMesh.visible = false;
      this.c4Mesh.visible = false;
      this.flareMesh.visible = false;
      this.defibrillatorMesh.visible = false;
    } else {
      this.wobble.rotation.z = 0;
      this.wobble.position.y = 0;
      this.label.position.y = 2.15;
      this.setEquippedItem(this.equippedItem);
    }
  }

  // ─── Animação procedural ──────────────────────────────────────────────

  animate(dt: number, t: number): void {
    if (dt <= 0) return;
    this.root.position.set(this.x, this.y, this.z);

    if (this.dead) {
      this.wobble.rotation.z = lerp(this.wobble.rotation.z, Math.PI / 2, damp(8, dt));
      this.wobble.position.y = lerp(this.wobble.position.y, -0.4, damp(8, dt));
      this.handL.position.set(-0.35, -0.2, 0.1);
      this.handR.position.set(0.35, -0.2, 0.1);
      this.label.position.y = lerp(this.label.position.y, 0.65, damp(8, dt));
      return;
    }

    // Velocidade observada (suavizada) — base para a animação de andar
    const vx = (this.x - this.prevX) / dt;
    const vz = (this.z - this.prevZ) / dt;
    this.prevX = this.x;
    this.prevZ = this.z;
    const vt = damp(12, dt);
    this.velX = lerp(this.velX, vx, vt);
    this.velZ = lerp(this.velZ, vz, vt);
    const speed = Math.hypot(this.velX, this.velZ);
    const speed01 = clamp(speed / PLAYER_SPEED, 0, 1);

    this.walkBlend = lerp(this.walkBlend, speed01 > 0.15 ? 1 : 0, damp(10, dt));
    this.walkPhase += dt * (6 + speed01 * 8);

    // Mira suave (o corpo gira um pouco atrasado → mais "fofo")
    this.displayAim = lerpAngle(this.displayAim, this.aim, damp(this.isLocal ? 25 : 14, dt));
    this.yaw.rotation.y = this.displayAim;

    // Velocidade no espaço local do personagem (frente/lado) para inclinar o corpo
    const sin = Math.sin(this.displayAim);
    const cos = Math.cos(this.displayAim);
    const forward = (this.velX * sin + this.velZ * cos) / PLAYER_SPEED;
    const side = (this.velX * cos - this.velZ * sin) / PLAYER_SPEED;

    const wb = this.walkBlend;
    const step = Math.sin(this.walkPhase);
    const bounce = Math.abs(step);

    // 1) Altura do chão sob o personagem para cálculo visual de pulo e projeção de sombra
    const groundElevation = calculateElevation(this.x, this.z, this.y);
    const jumpOffset = Math.max(0, this.y - groundElevation);
    const isAirborne = jumpOffset > 0.05;

    this.wobble.rotation.x = forward * 0.2 * wb;

    // Andar saltitante Fall Guys ou postura aerodinâmica de pulo
    if (isAirborne) {
      const airSquash = 1.0 + Math.min(0.28, jumpOffset * 0.22);
      this.wobble.scale.set(1 / Math.sqrt(airSquash), airSquash, 1 / Math.sqrt(airSquash));
      this.wobble.position.y = 0;
      this.wobble.rotation.z = -side * 0.15;
    } else {
      const idle = Math.sin(t * 2.2) * 0.02;
      this.wobble.position.y = bounce * 0.2 * wb;
      this.wobble.rotation.z = step * 0.16 * wb - side * 0.12;
      const squash = 1 + (idle * (1 - wb)) + Math.cos(this.walkPhase * 2) * 0.06 * wb;
      this.wobble.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
    }

    this.updateHands(t);

    // Piscar
    this.blinkTimer -= dt;
    const blinking = this.blinkTimer < 0.12;
    this.eyes.scale.y = blinking ? 0.12 : 1;
    if (this.blinkTimer < 0) this.blinkTimer = 2 + Math.random() * 4;

    // Recuo da arma e clarão do tiro
    if (this.recoil > 0.001) {
      this.recoil = lerp(this.recoil, 0, damp(22, dt));
    }
    if (this.muzzleTimer > 0) {
      this.muzzleTimer -= dt;
      if (this.muzzleTimer <= 0) {
        this.muzzleFlash.visible = false;
        this.muzzleLight.visible = false;
      }
    }
    if (this.slashTimer > 0) {
      this.slashTimer = Math.max(0, this.slashTimer - dt);
    }

    // Dano sofrido: feijão pisca em vermelho e estremece
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= dt;
      this.bodyMat.color.set("#ff2222");
      this.bodyMat.emissive.set("#ff0000");
      this.bodyMat.emissiveIntensity = 1.3;
      this.wobble.rotation.x -= 0.16;
    } else {
      this.bodyMat.color.copy(this.baseColor);
      this.bodyMat.emissive.copy(this.baseColor);
      this.bodyMat.emissiveIntensity = 0.22;
    }

    // Paralisado pela teia: tremor de esforço tentando se mover
    if (this.isWebbed) {
      this.wobble.position.x += Math.sin(t * 35) * 0.028;
      this.wobble.rotation.z += Math.cos(t * 30) * 0.035;
    }

    // Lanterna "respira" com o passo; anel/sombra projetado no chão com atenuação no ar
    this.beam.position.y = 0.7 + this.wobble.position.y;
    this.flashlight.position.y = 0.7 + this.wobble.position.y;
    if (this.ring) {
      this.ring.position.y = (groundElevation - this.y) + 0.02;
      const shadowScale = Math.max(0.4, 1.0 - jumpOffset * 0.35);
      const pulse = 1 + Math.sin(t * 3) * 0.06;
      this.ring.scale.set(pulse * shadowScale, pulse * shadowScale, 1);
      (this.ring.material as THREE.MeshBasicMaterial).opacity = Math.max(
        0.18,
        (0.55 + Math.sin(t * 3) * 0.15) * shadowScale,
      );
    }

    // ─── Atualização do Sinalizador e da Fumaça Vermelha Contínua ──────────
    if (this.flareActive) {
      this.flareLight.intensity = 2.8 + Math.sin(t * 22) * 0.9;
      this.flareSmokeTimer -= dt;
      if (this.flareSmokeTimer <= 0) {
        this.flareSmokeTimer = 0.055;
        let p = this.smokeParticles.find((part) => !part.active);
        if (!p) {
          let oldest = -1;
          for (const cand of this.smokeParticles) {
            if (cand.age > oldest) {
              oldest = cand.age;
              p = cand;
            }
          }
        }
        if (p) {
          p.x = this.x + (Math.random() - 0.5) * 0.2;
          p.y = this.y + 0.95 + (Math.random() - 0.5) * 0.15;
          p.z = this.z + (Math.random() - 0.5) * 0.2;
          p.vx = (Math.random() - 0.5) * 0.5 + this.velX * 0.25;
          p.vy = 1.7 + Math.random() * 1.3; // Sobe velozmente formando uma coluna densa
          p.vz = (Math.random() - 0.5) * 0.5 + this.velZ * 0.25;
          p.age = 0;
          p.maxAge = 1.8 + Math.random() * 0.7;
          p.initialScale = 0.4 + Math.random() * 0.15;
          p.maxScale = 1.9 + Math.random() * 0.6;
          p.active = true;
          p.sprite.visible = true;
        }
      }
    } else {
      this.flareLight.intensity = 0;
    }

    for (const p of this.smokeParticles) {
      if (!p.active) continue;
      p.age += dt;
      if (p.age >= p.maxAge) {
        p.active = false;
        p.sprite.visible = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vx += (Math.random() - 0.5) * 0.3 * dt;
      p.vz += (Math.random() - 0.5) * 0.3 * dt;
      p.sprite.position.set(p.x - this.x, p.y - this.y, p.z - this.z);
      const prog = p.age / p.maxAge;
      const s = lerp(p.initialScale, p.maxScale, prog);
      p.sprite.scale.set(s, s, 1);
      const alpha = Math.max(0, Math.min(0.85, (1 - prog) * 1.3));
      (p.sprite.material as THREE.SpriteMaterial).opacity = alpha;
    }
  }

  /** Ativa ou desativa a fumaça vermelha de resgate e a luz do sinalizador */
  setFlareActive(active: boolean): void {
    this.flareActive = active;
    if (this.flareLight) {
      this.flareLight.intensity = active ? 2.8 : 0;
    }
  }

  isFlareActive(): boolean {
    return this.flareActive;
  }

  /** Atualiza a aparência visual customizada do feijão (cor, cabelo, olhos, barba e chapéu) */
  setAppearance(appearance: {
    color?: string;
    hair?: string;
    eyes?: string;
    beard?: string;
    hat?: string;
  }): void {
    if (appearance.color && appearance.color !== this.currentColor) {
      this.currentColor = appearance.color;
      const c = new THREE.Color(appearance.color);
      // baseColor é a cor que o corpo volta a ter a cada quadro (fora do flash de dano)
      this.baseColor.copy(c);
      this.bodyMat.color.copy(c);
      this.bodyMat.emissive.copy(c);
      this.bellyMat.color.copy(c.clone().lerp(new THREE.Color("#ffffff"), 0.45));
      this.bellyMat.emissive.copy(c);
      if (this.ring) (this.ring.material as THREE.MeshBasicMaterial).color.copy(c);
      if (this.handL && this.handR) {
        const hMat = this.handL.material as THREE.MeshStandardMaterial;
        hMat.color.copy(c.clone().multiplyScalar(0.85));
        hMat.emissive.copy(c);
      }
    }

    const hair = (appearance.hair || "bald") as HairType;
    const hat = (appearance.hat || "none") as HatType;
    // O cabelo é refeito também quando o chapéu muda (fica achatado dentro dele)
    if (hair !== this.currentHair || hat !== this.currentHat) {
      this.currentHair = hair;
      while (this.hairGroup.children.length > 0) {
        this.hairGroup.remove(this.hairGroup.children[0]!);
      }
      this.hairGroup.add(buildHairModel(hair, hat));
    }

    const eyes = (appearance.eyes || "oval_medium") as EyeType;
    if (eyes !== this.currentEyes) {
      this.currentEyes = eyes;
      applyEyeStyle(this.eyes, eyes);
    }

    const beard = (appearance.beard || "none") as BeardType;
    if (beard !== this.currentBeard) {
      this.currentBeard = beard;
      while (this.beardGroup.children.length > 0) {
        this.beardGroup.remove(this.beardGroup.children[0]!);
      }
      this.beardGroup.add(buildBeardModel(beard));
    }

    if (hat !== this.currentHat) {
      this.currentHat = hat;
      while (this.hatGroup.children.length > 0) {
        this.hatGroup.remove(this.hatGroup.children[0]!);
      }
      this.hatGroup.add(buildHatModel(hat));
    }
  }

  /** Atualiza o nível visual 3D da arma e da faca empunhadas pelo personagem */
  setWeaponLevels(gunLevel: number, knifeLevel: number): void {
    const gLvl = Math.max(1, Math.min(7, gunLevel));
    const kLvl = Math.max(1, Math.min(7, knifeLevel));

    if (gLvl !== this.currentGunLevel) {
      this.currentGunLevel = gLvl;
      this.rebuildGun(gLvl);
    }
    if (kLvl !== this.currentKnifeLevel) {
      this.currentKnifeLevel = kLvl;
      this.rebuildKnife(kLvl);
    }
  }

  private rebuildGun(level: number): void {
    while (this.gunModelGroup.children.length > 0) {
      this.gunModelGroup.remove(this.gunModelGroup.children[0]!);
    }
    const { mesh, muzzleZ } = buildGunModel(level);
    this.gunModelGroup.add(mesh);
    this.muzzleFlash.position.set(0, 0, muzzleZ);
    this.muzzleLight.position.set(0, 0, muzzleZ + 0.05);
  }

  private rebuildKnife(level: number): void {
    while (this.knifeModelGroup.children.length > 0) {
      this.knifeModelGroup.remove(this.knifeModelGroup.children[0]!);
    }
    const { mesh } = buildKnifeModel(level);
    this.knifeModelGroup.add(mesh);
  }

  /** Define qual item 3D o boneco está segurando na mão */
  setEquippedItem(
    item:
      | "knife"
      | "pistol"
      | "bandage"
      | "armor"
      | "c4"
      | "defibrillator"
      | "plant_sprout"
      | "spider_head"
      | "werewolf_tooth"
      | "sack"
      | "flare"
      | "sinalizador"
      | "",
  ): void {
    this.equippedItem = item;
    this.knife.visible = item === "knife";
    this.gun.visible = item === "pistol";
    this.bandageMesh.visible = item === "bandage";
    this.c4Mesh.visible = item === "c4";
    this.defibrillatorMesh.visible = item === "defibrillator";
    this.flareMesh.visible = item === "flare" || item === "sinalizador";
  }

  /** Aciona o efeito de dano e flash vermelho no corpo do feijão. */
  triggerHitFlash(): void {
    this.hitFlashTimer = 0.22;
  }

  /** Aciona o efeito de recuo visual e clarão de disparo na arma. */
  triggerRecoil(): void {
    this.recoil = 0.18;
    this.muzzleTimer = 0.07;
    this.muzzleFlash.visible = true;
    this.muzzleLight.visible = true;
  }

  /** Aciona a animação de golpe e estocada da faca. */
  triggerKnifeSlash(): void {
    this.slashTimer = 0.22;
  }

  private updateHands(t: number): void {
    const wb = this.walkBlend;
    const swing = Math.sin(this.walkPhase) * 0.06 * wb;
    const float = Math.sin(t * 3) * 0.02;

    if (this.equippedItem === "knife") {
      const progress = 1 - Math.max(0, this.slashTimer) / 0.22;
      const slash = Math.sin(progress * Math.PI);

      // Mão direita desfere o golpe em arco frontal
      this.handR.position.set(0.24 - slash * 0.35, 0.72 + float, 0.5 + swing + slash * 0.3);
      this.handL.position.set(-0.2, 0.68 - float, 0.35 - swing);
      this.knife.position.set(0.24 - slash * 0.35, 0.72 + float, 0.55 + swing + slash * 0.3);
      this.knife.rotation.set(-slash * 0.7, -slash * 0.8, slash * 0.4);
    } else if (this.equippedItem === "bandage") {
      const healPulse = Math.sin(t * 5) * 0.02;
      this.handR.position.set(0.16, 0.74 + float + healPulse, 0.5);
      this.handL.position.set(-0.02, 0.74 + float + healPulse, 0.5);
      this.bandageMesh.position.set(0.07, 0.74 + float + healPulse, 0.52);
    } else if (this.equippedItem === "c4") {
      const pulse = Math.sin(t * 6) * 0.015;
      this.handR.position.set(0.22, 0.72 + float + pulse, 0.52);
      this.handL.position.set(-0.06, 0.72 + float + pulse, 0.52);
      this.c4Mesh.position.set(0.08, 0.72 + float + pulse, 0.53);
    } else if (this.equippedItem === "flare" || this.equippedItem === "sinalizador") {
      const flicker = Math.sin(t * 18) * 0.012;
      this.handR.position.set(0.2, 0.76 + float + flicker, 0.48);
      this.handL.position.set(-0.2, 0.68 - float, 0.35 - swing);
      this.flareMesh.position.set(0.2, 0.88 + float + flicker, 0.5);
      this.flareMesh.rotation.set(-0.2, 0, 0.08);
    } else if (this.equippedItem === "defibrillator") {
      const hum = Math.sin(t * 16) * 0.01;
      this.handR.position.set(0.20, 0.72 + float + hum, 0.48);
      this.handL.position.set(-0.20, 0.72 + float - hum, 0.48);
      this.defibrillatorMesh.position.set(0, 0.72 + float, 0.46);
    } else if (
      this.equippedItem === "armor" ||
      this.equippedItem === "" ||
      this.equippedItem === "plant_sprout" ||
      this.equippedItem === "spider_head" ||
      this.equippedItem === "werewolf_tooth" ||
      this.equippedItem === "sack"
    ) {
      this.handR.position.set(0.2, 0.68 + float, 0.35 + swing);
      this.handL.position.set(-0.2, 0.68 - float, 0.35 - swing);
    } else {
      // Pistola tática com recuo
      const rec = this.recoil;
      this.handR.position.set(0.24, 0.72 + float, 0.5 + swing - rec * 0.7);
      this.handL.position.set(-0.06, 0.74 - float, 0.66 - swing - rec * 0.5);
      this.gun.position.set(0.12, 0.8 + float, 0.62 + swing * 0.5 - rec);
    }
  }

  dispose(): void {
    this.root.removeFromParent();
    this.root.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Sprite) {
        obj.geometry?.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) {
          (m as THREE.MeshBasicMaterial).map?.dispose();
          m.dispose();
        }
      }
    });
    this.flashlight.dispose();
  }
}
