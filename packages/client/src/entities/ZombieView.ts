import * as THREE from "three";
import {
  clamp,
  CORPSE_DECAY_TIME,
  damp,
  ENEMY_CONFIGS,
  lerp,
  lerpAngle,
  type EnemyTypeId,
} from "@dark-beans/shared";
import { createRadialTexture } from "../world/textures";

interface Snapshot {
  t: number;
  x: number;
  y: number;
  z: number;
  rot: number;
}

/**
 * Representação visual 3D de um Zumbi ("Feijão Zumbi"):
 * - Visual "Dark Fall Guys" cartunesco e sombrio.
 * - Olhos tóxicos brilhantes que se destacam na escuridão.
 * - Animação procedural de passos mancos e arrastados (shambling).
 * - Feedback de dano (flash branco/vermelho ao levar tiro + barra de vida).
 * - Animação de queda ao morrer: tomba no chão, olhos apagam e permanece
 *   como cadáver por 10 segundos antes de sumir.
 */
export class ZombieView {
  readonly root = new THREE.Group();

  private readonly type: string;
  private readonly yaw = new THREE.Group();
  private readonly wobble = new THREE.Group();
  private readonly bodyMesh: THREE.Mesh;
  private readonly bodyMat: THREE.MeshStandardMaterial;
  private readonly eyeMat: THREE.MeshBasicMaterial;
  private readonly handL: THREE.Mesh;
  private readonly handR: THREE.Mesh;
  private readonly hpBar: THREE.Sprite;
  private readonly shadow: THREE.Mesh;
  private readonly volatileCore?: THREE.Mesh;
  private readonly toxicGland?: THREE.Mesh;
  private readonly mortarCannon?: THREE.Group;
  private readonly bossMeshes: THREE.Mesh[] = [];
  private readonly bossPustules: THREE.Mesh[] = [];
  private readonly bossCores: THREE.Mesh[] = [];

  // Elementos arácnidos estilo Don't Starve (Rainha Aracnídea e Pequena Aranha)
  private readonly isSpider: boolean;
  private readonly isSpiderBoss: boolean;
  private readonly spiderGroup = new THREE.Group();
  private readonly spiderLegs: {
    group: THREE.Group;
    upper: THREE.Mesh;
    lower: THREE.Mesh;
    basePitch: number;
    baseYaw: number;
    baseRoll: number;
    side: number;
    legIdx: number;
  }[] = [];
  private readonly spiderFangs: THREE.Mesh[] = [];
  private readonly spiderEyes: THREE.Mesh[] = [];
  private spiderAbdomen?: THREE.Mesh;
  private spiderSilkGlands: THREE.Mesh[] = [];

  // Elementos lupinos estilo Don't Starve (Lobisomem Alfa e Lobo Faminto)
  private readonly isWerewolf: boolean;
  private readonly isWolf: boolean;
  private readonly isCanine: boolean;
  private readonly werewolfGroup = new THREE.Group();
  private werewolfTorso?: THREE.Group;
  private werewolfHead?: THREE.Group;
  private werewolfArmL?: THREE.Group;
  private werewolfArmR?: THREE.Group;
  private werewolfLegL?: THREE.Group;
  private werewolfLegR?: THREE.Group;
  private readonly wolfLegs: THREE.Group[] = [];
  private werewolfTail?: THREE.Group;
  private werewolfJaw?: THREE.Mesh;
  private readonly werewolfEyes: THREE.Mesh[] = [];

  // Elementos orgânicos do Monstro do Pântano (Chefe da Gosma)
  private readonly isSwampBoss: boolean;
  private readonly swampGroup = new THREE.Group();
  private swampTorso?: THREE.Group;
  private swampHead?: THREE.Group;
  private swampArmL?: THREE.Group;
  private swampArmR?: THREE.Group;
  private swampLegL?: THREE.Group;
  private swampLegR?: THREE.Group;
  private readonly swampBeardVines: { mesh: THREE.Mesh; baseRx: number; baseRz: number; phase: number }[] = [];
  private readonly swampEyes: THREE.Mesh[] = [];

  // Elementos do Homem do Saco (Chefe Andarilho com Saco Marrom)
  private readonly isSackBoss: boolean;
  private readonly sackBossGroup = new THREE.Group();
  private sackTorso?: THREE.Group;
  private sackHead?: THREE.Group;
  private sackHat?: THREE.Group;
  private sackArmL?: THREE.Group;
  private sackArmR?: THREE.Group;
  private sackBag?: THREE.Group;
  private sackLegL?: THREE.Group;
  private sackLegR?: THREE.Group;
  private readonly sackEyes: THREE.Mesh[] = [];

  // Efeitos 3D de explosão do zumbi suicida
  private hasExploded = false;
  private explosionGroup?: THREE.Group;
  private explosionTimer = 0;
  private explosionSparks: { mesh: THREE.Mesh; vx: number; vy: number; vz: number }[] = [];
  private fireballCore?: THREE.Mesh;
  private fireballOuter?: THREE.Mesh;
  private shockwaveRing?: THREE.Mesh;

  private snapshots: Snapshot[] = [];
  private x = 0;
  private y = 0;
  private z = 0;
  private rot = 0;
  private displayRot = 0;
  private prevX = 0;
  private prevZ = 0;
  private walkPhase = 0;
  private hasPose = false;

  private currentHp: number;
  private maxHp: number;
  private currentState: "alive" | "dead" = "alive";

  // Efeitos visuais de dano, ataque e morte
  private hitFlashTimer = 0;
  private attackTimer = 0;
  private isAttacking = false;
  private isAggro = false;
  private deathProgress = 0; // 0 = em pé, 1 = caído no chão
  private corpseTimer = CORPSE_DECAY_TIME;
  private readonly baseColor: THREE.Color;
  private readonly baseEyeColor: THREE.Color;
  private readonly configRadius: number;

  constructor(type: string, initialHp: number, maxHp: number) {
    this.type = type;
    const config = ENEMY_CONFIGS[type as EnemyTypeId] ?? ENEMY_CONFIGS.standard;
    this.currentHp = initialHp;
    this.maxHp = maxHp;
    this.baseColor = new THREE.Color(config.color);
    this.baseEyeColor = new THREE.Color(config.eyeColor);
    this.configRadius = config.radius;

    this.root.add(this.yaw);
    this.yaw.add(this.wobble);
    this.root.scale.setScalar(config.scale);

    // ─── Corpo cápsula ──────────────────────────────────────────────────
    this.bodyMat = new THREE.MeshStandardMaterial({
      color: this.baseColor,
      roughness: 0.6,
      metalness: 0.05,
      emissive: this.baseColor,
      emissiveIntensity: type === "runner" ? 0.35 : 0.1,
    });
    const isBoss = type === "boss";
    this.isSwampBoss = isBoss;
    this.isSackBoss = type === "sack_boss";
    const isCrawler = type === "spitter";
    this.isSpiderBoss = type === "spider_boss";
    this.isSpider = type === "spider" || this.isSpiderBoss;
    this.isWerewolf = type === "werewolf_boss";
    this.isWolf = type === "wolf";
    this.isCanine = this.isWerewolf || this.isWolf;

    // O Chefe usa proporções musculosas e imponentes (não uma bola achatada)
    const bodyRadius = isBoss ? 0.48 : (config.radius * 0.9);
    const bodyHeight = isBoss ? 0.92 : 0.6;
    const bodyGeo = new THREE.CapsuleGeometry(bodyRadius, bodyHeight, 12, 18);
    this.bodyMesh = new THREE.Mesh(bodyGeo, this.bodyMat);

    if (isCrawler) {
      // Inimigo Rastejador: postura horizontal baixa, rastejando no chão
      this.bodyMesh.position.set(0, 0.32, -0.05);
      this.bodyMesh.rotation.x = Math.PI / 2.3;
    } else if (isBoss) {
      // Chefe Colossal: tronco musculoso erguido e ligeiramente curvado para frente
      this.bodyMesh.position.set(0, 0.95, -0.05);
      this.bodyMesh.rotation.x = 0.12;
    } else {
      this.bodyMesh.position.y = 0.8;
    }
    this.bodyMesh.castShadow = true;
    this.bodyMesh.receiveShadow = true;

    if (!this.isSpider && !this.isCanine && !this.isSwampBoss && !this.isSackBoss) {
      this.wobble.add(this.bodyMesh);
    }

    if (this.isSpider) {
      this.bodyMesh.visible = false;
      this.eyeMat = new THREE.MeshBasicMaterial({ color: 0xff002b, fog: false });

      // ─── MODELAGEM ARÁCNIDA ESTILO DON'T STARVE ────────────────────────
      const spiderChitinColor = this.isSpiderBoss ? 0x14101a : 0x0a090e;
      const spiderChitinMat = new THREE.MeshStandardMaterial({
        color: spiderChitinColor,
        roughness: 0.55,
        metalness: 0.15,
        emissive: this.isSpiderBoss ? 0x220e26 : 0x000000,
        emissiveIntensity: this.isSpiderBoss ? 0.35 : 0.0,
      });

      // 1) Cefalotórax (Cabeça/Tórax com carapaça quitinosa projetada ligeiramente à frente)
      const headRadius = this.isSpiderBoss ? 0.58 : 0.26;
      const headGeo = new THREE.SphereGeometry(headRadius, 14, 12);
      headGeo.scale(1.08, 0.74, 1.25);
      const headMesh = new THREE.Mesh(headGeo, spiderChitinMat);
      const headY = this.isSpiderBoss ? 0.60 : 0.24;
      const headZ = this.isSpiderBoss ? 0.30 : 0.14;
      headMesh.position.set(0, headY, headZ);
      headMesh.castShadow = true;
      this.spiderGroup.add(headMesh);

      // Cristas quitinosas afiadas na cabeça da Rainha Aracnídea
      if (this.isSpiderBoss) {
        const ridgeMat = new THREE.MeshStandardMaterial({
          color: 0x2d1838,
          roughness: 0.4,
          metalness: 0.3,
          emissive: 0x4a1555,
          emissiveIntensity: 0.3,
        });
        const ridgeGeo = new THREE.ConeGeometry(0.09, 0.28, 5);
        for (let i = -1; i <= 1; i++) {
          const spike = new THREE.Mesh(ridgeGeo, ridgeMat);
          spike.position.set(i * 0.22, headY + 0.32, (headZ - 0.03) - Math.abs(i) * 0.08);
          spike.rotation.set(-0.2, 0, i * 0.25);
          this.spiderGroup.add(spike);
        }
      }

      // 2) Abdômen Bulboso e Pesado (reduzido sutilmente para balancear com a cabeça)
      const abdoRadius = this.isSpiderBoss ? 0.82 : 0.32;
      const abdoGeo = new THREE.SphereGeometry(abdoRadius, 16, 14);
      abdoGeo.scale(1.08, 0.98, 1.28);
      this.spiderAbdomen = new THREE.Mesh(abdoGeo, spiderChitinMat);
      const abdoZ = this.isSpiderBoss ? -0.92 : -0.36;
      const abdoY = this.isSpiderBoss ? 0.78 : 0.31;
      this.spiderAbdomen.position.set(0, abdoY, abdoZ);
      this.spiderAbdomen.rotation.x = -0.15;
      this.spiderAbdomen.castShadow = true;
      this.spiderGroup.add(this.spiderAbdomen);

      // Glândulas de seda bioluminescentes na traseira da Rainha
      if (this.isSpiderBoss) {
        const glandMat = new THREE.MeshBasicMaterial({ color: 0xf1f5f9, fog: false });
        const glandGeo = new THREE.DodecahedronGeometry(0.12, 0);
        for (const [gx, gy, gz] of [
          [0, abdoY + 0.12, abdoZ - 0.95],
          [-0.20, abdoY, abdoZ - 0.82],
          [0.20, abdoY, abdoZ - 0.82],
        ]) {
          const gland = new THREE.Mesh(glandGeo, glandMat);
          gland.position.set(gx, gy, gz);
          this.spiderGroup.add(gland);
          this.spiderSilkGlands.push(gland);
        }
      }

      // 3) Olhos Vermelhos Sinistros em Cluster (Assinatura Don't Starve!)
      const spiderEyeMat = new THREE.MeshBasicMaterial({
        color: this.isSpiderBoss ? 0xff0033 : 0xff2244,
        fog: false,
      });
      const eyeConfigs = this.isSpiderBoss
        ? [
            { r: 0.11, x: -0.16, y: headY + 0.12, z: headZ + 0.60 },
            { r: 0.11, x: 0.16, y: headY + 0.12, z: headZ + 0.60 },
            { r: 0.075, x: -0.32, y: headY + 0.08, z: headZ + 0.50 },
            { r: 0.075, x: 0.32, y: headY + 0.08, z: headZ + 0.50 },
            { r: 0.065, x: -0.38, y: headY + 0.22, z: headZ + 0.40 },
            { r: 0.065, x: 0.38, y: headY + 0.22, z: headZ + 0.40 },
            { r: 0.07, x: -0.12, y: headY + 0.26, z: headZ + 0.50 },
            { r: 0.07, x: 0.12, y: headY + 0.26, z: headZ + 0.50 },
          ]
        : [
            { r: 0.052, x: -0.075, y: headY + 0.06, z: headZ + 0.25 },
            { r: 0.052, x: 0.075, y: headY + 0.06, z: headZ + 0.25 },
            { r: 0.038, x: -0.14, y: headY + 0.04, z: headZ + 0.21 },
            { r: 0.038, x: 0.14, y: headY + 0.04, z: headZ + 0.21 },
            { r: 0.035, x: -0.06, y: headY + 0.12, z: headZ + 0.21 },
            { r: 0.035, x: 0.06, y: headY + 0.12, z: headZ + 0.21 },
          ];

      for (const ec of eyeConfigs) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(ec.r, 8, 8), spiderEyeMat);
        eye.position.set(ec.x, ec.y, ec.z);
        this.spiderGroup.add(eye);
        this.spiderEyes.push(eye);
      }

      // 4) Quelíceras e Presas Farpadas (Fangs móveis)
      const fangMat = new THREE.MeshStandardMaterial({
        color: 0xf1f5f9,
        roughness: 0.3,
        metalness: 0.2,
        emissive: 0x991b1b,
        emissiveIntensity: 0.3,
      });
      const fangRadius = this.isSpiderBoss ? 0.075 : 0.035;
      const fangLen = this.isSpiderBoss ? 0.42 : 0.19;
      const fangGeo = new THREE.ConeGeometry(fangRadius, fangLen, 6);
      fangGeo.rotateX(Math.PI);
      for (const side of [-1, 1]) {
        const fang = new THREE.Mesh(fangGeo, fangMat);
        const fx = side * (this.isSpiderBoss ? 0.16 : 0.08);
        const fy = headY - (this.isSpiderBoss ? 0.15 : 0.06);
        const fz = this.isSpiderBoss ? headZ + 0.55 : headZ + 0.25;
        fang.position.set(fx, fy, fz);
        fang.rotation.set(0.3, 0, -side * 0.2);
        this.spiderGroup.add(fang);
        this.spiderFangs.push(fang);
      }

      // 5) 8 Patas Articuladas: 2 patas frontais na cabeça + 6 patas ao longo do corpo (3 de cada lado)
      const legPairConfigs = [
        // Par 0: As 2 patas frontais (na cabeça, projetadas para frente e para os lados)
        {
          rootX: this.isSpiderBoss ? 0.46 : 0.19,
          rootY: headY - (this.isSpiderBoss ? 0.04 : 0.015),
          rootZ: headZ + (this.isSpiderBoss ? 0.22 : 0.09),
          yaw: Math.PI * 0.18,
          pitch: 0.35,
          roll: 0.48,
          upperLen: this.isSpiderBoss ? 0.95 : 0.39,
          lowerLen: this.isSpiderBoss ? 1.25 : 0.50,
          upperRad: this.isSpiderBoss ? 0.075 : 0.033,
        },
        // Par 1: Patas do corpo 1 (dianteira do corpo / flanco anterior, 1 de cada lado)
        {
          rootX: this.isSpiderBoss ? 0.72 : 0.29,
          rootY: headY + (this.isSpiderBoss ? 0.02 : 0.01),
          rootZ: headZ - (this.isSpiderBoss ? 0.24 : 0.10),
          yaw: Math.PI * 0.40,
          pitch: 0.44,
          roll: 0.58,
          upperLen: this.isSpiderBoss ? 1.05 : 0.43,
          lowerLen: this.isSpiderBoss ? 1.35 : 0.55,
          upperRad: this.isSpiderBoss ? 0.072 : 0.031,
        },
        // Par 2: Patas do corpo 2 (meio do corpo / flanco central do abdômen, 1 de cada lado)
        {
          rootX: this.isSpiderBoss ? 0.82 : 0.33,
          rootY: abdoY - (this.isSpiderBoss ? 0.05 : 0.02),
          rootZ: abdoZ + (this.isSpiderBoss ? 0.32 : 0.13),
          yaw: Math.PI * 0.62,
          pitch: 0.46,
          roll: 0.62,
          upperLen: this.isSpiderBoss ? 1.15 : 0.47,
          lowerLen: this.isSpiderBoss ? 1.45 : 0.59,
          upperRad: this.isSpiderBoss ? 0.075 : 0.033,
        },
        // Par 3: Patas do corpo 3 (traseira do corpo / flanco posterior do abdômen, 1 de cada lado)
        {
          rootX: this.isSpiderBoss ? 0.76 : 0.30,
          rootY: abdoY - (this.isSpiderBoss ? 0.10 : 0.04),
          rootZ: abdoZ - (this.isSpiderBoss ? 0.18 : 0.07),
          yaw: Math.PI * 0.86,
          pitch: 0.38,
          roll: 0.56,
          upperLen: this.isSpiderBoss ? 1.10 : 0.45,
          lowerLen: this.isSpiderBoss ? 1.40 : 0.57,
          upperRad: this.isSpiderBoss ? 0.070 : 0.030,
        },
      ];

      let legIndexCounter = 0;
      for (const side of [-1, 1]) {
        for (let l = 0; l < 4; l++) {
          const lConf = legPairConfigs[l]!;
          const legGroup = new THREE.Group();
          legGroup.position.set(side * lConf.rootX, lConf.rootY, lConf.rootZ);

          const legMat = spiderChitinMat;

          const upperRad = lConf.upperRad;
          const upperGeo = new THREE.CylinderGeometry(upperRad * 0.85, upperRad, lConf.upperLen, 7);
          upperGeo.translate(0, lConf.upperLen * 0.5, 0);

          const lowerRad = this.isSpiderBoss ? 0.062 : 0.026;
          const lowerGeo = new THREE.ConeGeometry(lowerRad, lConf.lowerLen, 7);
          lowerGeo.rotateX(Math.PI);
          lowerGeo.translate(0, -lConf.lowerLen * 0.5, 0);

          const upperMesh = new THREE.Mesh(upperGeo, legMat);
          upperMesh.castShadow = true;
          legGroup.add(upperMesh);

          const jointMesh = new THREE.Mesh(
            new THREE.SphereGeometry(upperRad * 1.25, 7, 7),
            spiderChitinMat,
          );
          jointMesh.position.set(0, lConf.upperLen, 0);
          legGroup.add(jointMesh);

          if (this.isSpiderBoss) {
            const barb = new THREE.Mesh(
              new THREE.ConeGeometry(0.045, 0.22, 5),
              spiderChitinMat,
            );
            barb.position.set(0, lConf.upperLen + 0.05, 0);
            barb.rotation.z = side * 0.5;
            legGroup.add(barb);
          }

          const lowerGroup = new THREE.Group();
          lowerGroup.position.set(0, lConf.upperLen, 0);
          const lowerMesh = new THREE.Mesh(lowerGeo, legMat);
          lowerMesh.castShadow = true;
          lowerGroup.add(lowerMesh);
          lowerGroup.rotation.z = side * (this.isSpiderBoss ? 1.12 : 0.98);
          legGroup.add(lowerGroup);

          const baseYaw = side * lConf.yaw;
          const basePitch = lConf.pitch;
          const baseRoll = lConf.roll;
          legGroup.rotation.set(basePitch * (l > 1 ? -0.25 : 0.25), baseYaw, -side * baseRoll);

          this.spiderGroup.add(legGroup);
          this.spiderLegs.push({
            group: legGroup,
            upper: upperMesh,
            lower: lowerMesh,
            basePitch,
            baseYaw,
            baseRoll,
            side,
            legIdx: legIndexCounter++,
          });
        }
      }

      this.wobble.add(this.spiderGroup);
    }

    // ─── MODELAGEM LUPINA ESTILO DON'T STARVE (Lobisomem Alfa e Lobo Faminto) ──
    if (this.isCanine) {
      this.bodyMesh.visible = false;
      this.eyeMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, fog: false });

      const furDarkColor = this.isWerewolf ? 0x3d2213 : 0x4e2c18;
      const furManeColor = this.isWerewolf ? 0x24130a : 0x2d170a;
      const furChestColor = this.isWerewolf ? 0x5a351e : 0x6e3d22;

      const furMat = new THREE.MeshStandardMaterial({
        color: furDarkColor,
        roughness: 0.85,
        metalness: 0.05,
        emissive: this.isWerewolf ? 0x1f1008 : 0x000000,
        emissiveIntensity: 0.25,
      });

      const maneMat = new THREE.MeshStandardMaterial({
        color: furManeColor,
        roughness: 0.9,
      });

      const chestMat = new THREE.MeshStandardMaterial({
        color: furChestColor,
        roughness: 0.8,
      });

      const clawMat = new THREE.MeshStandardMaterial({
        color: 0x120c08,
        roughness: 0.35,
        metalness: 0.4,
      });

      const fangMat = new THREE.MeshStandardMaterial({
        color: 0xf3f4f6,
        roughness: 0.3,
        emissive: 0x5a180d,
        emissiveIntensity: 0.15,
      });

      const eyeGlowMat = new THREE.MeshBasicMaterial({
        color: this.isWerewolf ? 0xf59e0b : 0xfbbf24,
        fog: false,
      });

      const pupilMat = new THREE.MeshBasicMaterial({
        color: 0x000000,
        fog: false,
      });

      if (this.isWerewolf) {
        // ─── LOBISOMEM ALFA (CHEFE BÍPEDE ENCURVADO E ATERRORIZANTE) ─────────
        this.werewolfTorso = new THREE.Group();
        this.werewolfTorso.position.set(0, 0.95, 0);
        this.werewolfTorso.rotation.x = 0.22; // Curvado para frente em postura de fera

        // Tronco musculoso
        const torsoMesh = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.50, 0.65, 10, 16),
          furMat,
        );
        torsoMesh.scale.set(1.24, 1.0, 0.95);
        torsoMesh.castShadow = true;
        this.werewolfTorso.add(torsoMesh);

        // Peito com pelos eriçados
        const chestPlating = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.38, 0),
          chestMat,
        );
        chestPlating.scale.set(1.15, 1.25, 0.45);
        chestPlating.position.set(0, 0.24, 0.36);
        this.werewolfTorso.add(chestPlating);

        // Tufos de pelo espetados na corcunda / costas (Estilo Don't Starve!)
        const spineSpikes = [
          { y: 0.45, z: -0.38, len: 0.48, rad: 0.14, pitch: -0.35 },
          { y: 0.22, z: -0.44, len: 0.52, rad: 0.15, pitch: -0.40 },
          { y: -0.02, z: -0.42, len: 0.46, rad: 0.13, pitch: -0.45 },
          { y: -0.25, z: -0.38, len: 0.38, rad: 0.11, pitch: -0.50 },
        ];
        for (const sp of spineSpikes) {
          const spikeGeo = new THREE.ConeGeometry(sp.rad, sp.len, 5);
          spikeGeo.rotateX(sp.pitch);
          const spikeMesh = new THREE.Mesh(spikeGeo, maneMat);
          spikeMesh.position.set(0, sp.y, sp.z);
          spikeMesh.castShadow = true;
          this.werewolfTorso.add(spikeMesh);
        }

        // Tufos nos ombros
        for (const side of [-1, 1]) {
          const shoulderTuft = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.42, 5), maneMat);
          shoulderTuft.position.set(side * 0.48, 0.38, -0.15);
          shoulderTuft.rotation.set(-0.2, 0, side * 0.55);
          this.werewolfTorso.add(shoulderTuft);
        }

        this.werewolfGroup.add(this.werewolfTorso);

        // Cabeça feroz de lobo
        this.werewolfHead = new THREE.Group();
        this.werewolfHead.position.set(0, 1.58, 0.25);

        // Crânio
        const cranium = new THREE.Mesh(new THREE.DodecahedronGeometry(0.32, 1), furMat);
        cranium.scale.set(1.0, 0.92, 1.15);
        cranium.castShadow = true;
        this.werewolfHead.add(cranium);

        // Tufos de bochecha pontiagudos nas laterais da cabeça
        for (const side of [-1, 1]) {
          const cheekTuft = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.38, 4), maneMat);
          cheekTuft.position.set(side * 0.30, -0.05, 0.05);
          cheekTuft.rotation.set(0.15, 0, side * 0.95);
          this.werewolfHead.add(cheekTuft);
        }

        // Focinho alongado
        const snout = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.20, 0.44), furMat);
        snout.position.set(0, -0.05, 0.34);
        snout.castShadow = true;
        this.werewolfHead.add(snout);

        // Trufa do nariz preta
        const nose = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.09, 0.10), clawMat);
        nose.position.set(0, 0.02, 0.55);
        this.werewolfHead.add(nose);

        // Mandíbula e presas
        this.werewolfJaw = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.11, 0.40), furMat);
        this.werewolfJaw.position.set(0, -0.16, 0.30);
        this.werewolfJaw.rotation.x = 0.15;
        this.werewolfHead.add(this.werewolfJaw);

        // Presas superiores e inferiores
        for (const side of [-1, 1]) {
          const upperFang = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.18, 5), fangMat);
          upperFang.position.set(side * 0.09, -0.13, 0.46);
          upperFang.rotation.x = Math.PI;
          this.werewolfHead.add(upperFang);

          const lowerFang = new THREE.Mesh(new THREE.ConeGeometry(0.040, 0.16, 5), fangMat);
          lowerFang.position.set(side * 0.08, 0.06, 0.14);
          this.werewolfJaw.add(lowerFang);
        }

        // Orelhas de lobo pontiagudas
        for (const side of [-1, 1]) {
          const ear = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.34, 4), furMat);
          ear.scale.set(1.0, 1.0, 0.45);
          ear.position.set(side * 0.20, 0.32, -0.06);
          ear.rotation.set(-0.25, 0, side * 0.32);
          this.werewolfHead.add(ear);
        }

        // Olhos amarelos ferozes com fenda vertical
        for (const side of [-1, 1]) {
          const eye = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8), eyeGlowMat);
          eye.position.set(side * 0.13, 0.08, 0.26);
          this.werewolfHead.add(eye);
          this.werewolfEyes.push(eye);

          const pupil = new THREE.Mesh(new THREE.PlaneGeometry(0.025, 0.085), pupilMat);
          pupil.position.set(side * 0.13, 0.08, 0.325);
          this.werewolfHead.add(pupil);
        }

        this.werewolfGroup.add(this.werewolfHead);

        // Braços longos e musculosos com garras lacerantes
        for (const side of [-1, 1]) {
          const armGroup = new THREE.Group();
          armGroup.position.set(side * 0.58, 1.35, 0.05);

          const upperArm = new THREE.Mesh(
            new THREE.CylinderGeometry(0.15, 0.13, 0.55, 8),
            furMat,
          );
          upperArm.position.y = -0.25;
          upperArm.castShadow = true;
          armGroup.add(upperArm);

          const foreArm = new THREE.Mesh(
            new THREE.CylinderGeometry(0.14, 0.11, 0.58, 8),
            furMat,
          );
          foreArm.position.set(0, -0.68, 0.15);
          foreArm.rotation.x = 0.45;
          foreArm.castShadow = true;
          armGroup.add(foreArm);

          // Pata com 4 garras pontiagudas curvas
          for (let c = -1.5; c <= 1.5; c += 1) {
            const claw = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.22, 4), clawMat);
            claw.position.set(c * 0.06, -0.96, 0.32);
            claw.rotation.set(0.65, 0, c * 0.12);
            claw.castShadow = true;
            armGroup.add(claw);
          }

          this.werewolfGroup.add(armGroup);
          if (side === -1) this.werewolfArmL = armGroup;
          else this.werewolfArmR = armGroup;
        }

        // Pernas digitígradas
        for (const side of [-1, 1]) {
          const legGroup = new THREE.Group();
          legGroup.position.set(side * 0.35, 0.85, -0.10);

          const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.16, 0.52, 8), furMat);
          thigh.position.set(0, -0.22, -0.08);
          thigh.rotation.x = -0.32;
          thigh.castShadow = true;
          legGroup.add(thigh);

          const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.55, 8), furMat);
          shin.position.set(0, -0.58, 0.08);
          shin.rotation.x = 0.38;
          shin.castShadow = true;
          legGroup.add(shin);

          const foot = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.14, 0.38), furMat);
          foot.position.set(0, -0.80, 0.22);
          foot.castShadow = true;
          legGroup.add(foot);

          for (let c = -1; c <= 1; c++) {
            const claw = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.16, 4), clawMat);
            claw.position.set(c * 0.08, -0.82, 0.41);
            claw.rotation.x = Math.PI / 2;
            legGroup.add(claw);
          }

          this.werewolfGroup.add(legGroup);
          if (side === -1) this.werewolfLegL = legGroup;
          else this.werewolfLegR = legGroup;
        }

        // Cauda espessa espetada
        this.werewolfTail = new THREE.Group();
        this.werewolfTail.position.set(0, 0.68, -0.35);
        const tailSegments = 4;
        for (let t = 0; t < tailSegments; t++) {
          const rad = 0.13 - t * 0.02;
          const tailPart = new THREE.Mesh(new THREE.ConeGeometry(rad, 0.32, 5), maneMat);
          tailPart.position.set(0, -t * 0.18, -t * 0.14);
          tailPart.rotation.x = -0.65 + t * 0.25;
          tailPart.castShadow = true;
          this.werewolfTail.add(tailPart);
        }
        this.werewolfGroup.add(this.werewolfTail);

      } else {
        // ─── LOBO FAMINTO (MINION QUADRÚPEDE ESTILO HOUND DE DON'T STARVE) ──
        this.werewolfTorso = new THREE.Group();
        this.werewolfTorso.position.set(0, 0.46, 0);

        // Tronco do lobo
        const houndBody = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.24, 0.48, 8, 12),
          furMat,
        );
        houndBody.rotation.x = Math.PI / 2.3;
        houndBody.castShadow = true;
        this.werewolfTorso.add(houndBody);

        // Espinhos de pelo eriçado nas costas (Hound Don't Starve)
        for (let i = 0; i < 4; i++) {
          const spike = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.28, 4), maneMat);
          spike.position.set(0, 0.18, 0.15 - i * 0.14);
          spike.rotation.x = -0.35;
          this.werewolfTorso.add(spike);
        }

        this.werewolfGroup.add(this.werewolfTorso);

        // Cabeça do lobo
        this.werewolfHead = new THREE.Group();
        this.werewolfHead.position.set(0, 0.54, 0.34);

        const houndSkull = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 1), furMat);
        houndSkull.scale.set(0.9, 0.85, 1.15);
        this.werewolfHead.add(houndSkull);

        const snout = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.32), furMat);
        snout.position.set(0, -0.04, 0.22);
        this.werewolfHead.add(snout);

        const nose = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, 0.06), clawMat);
        nose.position.set(0, 0.01, 0.37);
        this.werewolfHead.add(nose);

        this.werewolfJaw = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.28), furMat);
        this.werewolfJaw.position.set(0, -0.12, 0.20);
        this.werewolfJaw.rotation.x = 0.2;
        this.werewolfHead.add(this.werewolfJaw);

        // Presas superiores e inferiores
        for (const side of [-1, 1]) {
          const fang = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.12, 4), fangMat);
          fang.position.set(side * 0.06, -0.09, 0.30);
          fang.rotation.x = Math.PI;
          this.werewolfHead.add(fang);

          const lFang = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.10, 4), fangMat);
          lFang.position.set(side * 0.05, 0.04, 0.08);
          this.werewolfJaw.add(lFang);
        }

        // Orelhas pontudas
        for (const side of [-1, 1]) {
          const ear = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.24, 4), furMat);
          ear.position.set(side * 0.14, 0.22, -0.04);
          ear.rotation.set(-0.2, 0, side * 0.35);
          this.werewolfHead.add(ear);
        }

        // Olhos amarelos
        for (const side of [-1, 1]) {
          const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), eyeGlowMat);
          eye.position.set(side * 0.09, 0.06, 0.18);
          this.werewolfHead.add(eye);
          this.werewolfEyes.push(eye);
        }

        this.werewolfGroup.add(this.werewolfHead);

        // 4 Patas caninas (FL, FR, RL, RR)
        const legOffsets = [
          { x: -0.17, y: 0.36, z: 0.20 },
          { x: 0.17, y: 0.36, z: 0.20 },
          { x: -0.16, y: 0.36, z: -0.22 },
          { x: 0.16, y: 0.36, z: -0.22 },
        ];
        for (const off of legOffsets) {
          const legG = new THREE.Group();
          legG.position.set(off.x, off.y, off.z);

          const legMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.045, 0.38, 6), furMat);
          legMesh.position.y = -0.18;
          legMesh.castShadow = true;
          legG.add(legMesh);

          const paw = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.06, 0.14), furMat);
          paw.position.set(0, -0.34, 0.04);
          legG.add(paw);

          this.werewolfGroup.add(legG);
          this.wolfLegs.push(legG);
        }

        // Cauda pontiaguda do lobo
        this.werewolfTail = new THREE.Group();
        this.werewolfTail.position.set(0, 0.48, -0.32);
        const tailPart = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.30, 4), maneMat);
        tailPart.rotation.x = -1.2;
        this.werewolfTail.add(tailPart);
        this.werewolfGroup.add(this.werewolfTail);
      }

      this.wobble.add(this.werewolfGroup);
    }

    if (!isBoss && !this.isSpider && !this.isCanine) {
      // Manchas escuras / apodrecidas no corpo (somente zumbis comuns)
      const rotColor = type === "runner" ? "#4a0d0d" : isCrawler ? "#1f3815" : "#223d1a";
      const rotBlob = new THREE.Mesh(
        new THREE.SphereGeometry(0.25, 12, 10),
        new THREE.MeshStandardMaterial({ color: rotColor, roughness: 0.8 }),
      );
      rotBlob.scale.set(0.9, 1.2, 0.4);
      if (isCrawler) {
        rotBlob.position.set(0.12, 0.35, 0.15);
      } else {
        rotBlob.position.set(0.12, 0.65, 0.32);
      }
      this.wobble.add(rotBlob);

      // ─── Olhos para zumbis normais ────────────────────────────────────
      const eyeColor = new THREE.Color(config.eyeColor);
      this.eyeMat = new THREE.MeshBasicMaterial({ color: eyeColor, fog: false });
      const eyeSocket = new THREE.Group();
      if (isCrawler) {
        eyeSocket.position.set(0, 0.42, 0.4);
      } else {
        eyeSocket.position.set(0, 1.1, 0.36);
      }

      for (const side of [-1, 1]) {
        const eyeRad = type === "runner" ? 0.12 : isCrawler ? 0.12 : 0.11;
        const eye = new THREE.Mesh(new THREE.SphereGeometry(eyeRad, 12, 10), this.eyeMat);
        eye.position.set(side * 0.16, 0, 0);
        eyeSocket.add(eye);
      }
      this.wobble.add(eyeSocket);
    } else {
      this.eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000, fog: false });
    }

    // ─── Adornos e acessórios por tipo ──────────────────────────────────
    if (type === "tank") {
      // Ombreiras musculosas / carapaça deformada do Brutamontes
      const shoulderGeo = new THREE.DodecahedronGeometry(0.28, 0);
      const shoulderMat = new THREE.MeshStandardMaterial({
        color: "#182615",
        roughness: 0.85,
      });
      const shoulderL = new THREE.Mesh(shoulderGeo, shoulderMat);
      shoulderL.position.set(-0.52, 1.0, 0);
      shoulderL.castShadow = true;
      const shoulderR = new THREE.Mesh(shoulderGeo, shoulderMat);
      shoulderR.position.set(0.52, 1.0, 0);
      shoulderR.castShadow = true;
      this.wobble.add(shoulderL, shoulderR);
    } else if (type === "runner") {
      // Núcleo volátil / tumor químico explosivo pulsante nas costas
      const coreGeo = new THREE.DodecahedronGeometry(0.22, 1);
      const coreMat = new THREE.MeshBasicMaterial({
        color: "#ffaa00",
        fog: false,
      });
      this.volatileCore = new THREE.Mesh(coreGeo, coreMat);
      this.volatileCore.position.set(0, 0.95, -0.32);
      this.wobble.add(this.volatileCore);

      // Cinto/tiras de contenção dos compostos explosivos
      const beltGeo = new THREE.TorusGeometry(0.42, 0.045, 6, 16);
      beltGeo.rotateX(Math.PI / 2);
      const beltMat = new THREE.MeshStandardMaterial({ color: "#1a0808", roughness: 0.9 });
      const belt = new THREE.Mesh(beltGeo, beltMat);
      belt.position.y = 0.75;
      this.wobble.add(belt);
    } else if (isCrawler) {
      // Glândula / vesícula de gosma ácida verde nas costas do rastejador
      const glandGeo = new THREE.SphereGeometry(0.24, 12, 10);
      glandGeo.scale(1.2, 0.8, 1.1);
      const glandMat = new THREE.MeshBasicMaterial({
        color: "#39ff14",
        fog: false,
      });
      this.toxicGland = new THREE.Mesh(glandGeo, glandMat);
      this.toxicGland.position.set(0, 0.44, -0.15);
      this.wobble.add(this.toxicGland);
    } else if (type === "mortar") {
      // Canhão biológico de morteiro montado no ombro apontado para o alto
      this.mortarCannon = new THREE.Group();
      this.mortarCannon.position.set(0.34, 1.05, -0.12);
      this.mortarCannon.rotation.x = -Math.PI / 4.2; // ~43 graus para o céu
      this.mortarCannon.rotation.y = 0.12;

      // Tubo do canhão
      const barrelGeo = new THREE.CylinderGeometry(0.14, 0.2, 0.72, 8);
      const barrelMat = new THREE.MeshStandardMaterial({
        color: "#283416",
        roughness: 0.85,
      });
      const barrel = new THREE.Mesh(barrelGeo, barrelMat);
      barrel.position.y = 0.36;
      barrel.castShadow = true;
      this.mortarCannon.add(barrel);

      // Boca iluminada do canhão com gosma radioativa
      const muzzleGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.04, 8);
      const muzzleMat = new THREE.MeshBasicMaterial({ color: 0xc6ff00, fog: false });
      const muzzle = new THREE.Mesh(muzzleGeo, muzzleMat);
      muzzle.position.y = 0.72;
      this.mortarCannon.add(muzzle);

      this.wobble.add(this.mortarCannon);
    } else if (type === "boss") {
      // ─── MODELO GRÁFICO COMPLETO: MONSTRO DO PÂNTANO (HOMEM DO PÂNTANO) ──
      // Estética de lenda urbana 100% orgânica: colosso compacto coberto de musgo, lodo, folhas,
      // casca de mangue podre, barba espessa de cipós pendentes e exatamente 2 pequenos olhos vermelhos profundos.

      const swampBarkMat = new THREE.MeshStandardMaterial({
        color: "#111b0e", // Casca de mangue/madeira encharcada escura
        roughness: 0.96,
        metalness: 0.0,
      });
      const swampMossDeepMat = new THREE.MeshStandardMaterial({
        color: "#162b13", // Musgo denso e turfa escura úmida
        roughness: 0.95,
        metalness: 0.0,
      });
      const swampMossOliveMat = new THREE.MeshStandardMaterial({
        color: "#203a18", // Musgo verde-oliva e lodo
        roughness: 0.9,
        metalness: 0.0,
      });
      const swampFoliageMat = new THREE.MeshStandardMaterial({
        color: "#2a4d20", // Folhagens de brejo, samambaias e folhas caídas
        roughness: 0.85,
        metalness: 0.0,
      });
      const swampVineMat = new THREE.MeshStandardMaterial({
        color: "#182e14", // Cipós retorcidos e trepadeiras
        roughness: 0.95,
        metalness: 0.0,
      });
      const swampOozeMat = new THREE.MeshStandardMaterial({
        color: "#2d5e1b", // Cistos orgânicos de lodo e gosma tóxica
        roughness: 0.6,
        metalness: 0.0,
        emissive: "#14330b",
        emissiveIntensity: 0.35,
      });
      // Apenas 2 olhos vermelhos pequenos e incandescentes (solicitado):
      const swampEyeMat = new THREE.MeshBasicMaterial({
        color: 0xff0000,
        fog: false,
      });

      // ─── 1) TORSO FORTE, GRANDE E COMPACTO ──────────────────────────────
      this.swampTorso = new THREE.Group();
      this.swampTorso.position.set(0, 0.95, -0.05);

      // Núcleo orgânico do corpo (curvado e compacto)
      const coreBody = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.48, 0.72, 8, 14),
        swampMossDeepMat,
      );
      coreBody.rotation.x = 0.14;
      coreBody.castShadow = true;
      this.swampTorso.add(coreBody);

      // Corcunda maciça de raízes e turfa nas costas
      const backHump = new THREE.Mesh(
        new THREE.SphereGeometry(0.50, 10, 8),
        swampBarkMat,
      );
      backHump.position.set(0, 0.28, -0.22);
      backHump.scale.set(1.05, 0.95, 1.15);
      backHump.castShadow = true;
      this.swampTorso.add(backHump);

      // Massa peitoral volumosa de musgo saliente
      const chestMoss = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.52, 1),
        swampMossOliveMat,
      );
      chestMoss.position.set(0, 0.22, 0.18);
      chestMoss.scale.set(1.05, 0.95, 0.85);
      chestMoss.castShadow = true;
      this.swampTorso.add(chestMoss);

      // Dobras de musgo e lodo no baixo ventre
      const bellyMoss = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.46, 1),
        swampMossDeepMat,
      );
      bellyMoss.position.set(0, -0.16, 0.22);
      bellyMoss.scale.set(1.0, 0.85, 0.80);
      bellyMoss.castShadow = true;
      this.swampTorso.add(bellyMoss);

      // Tufos de folhagens e aglomerados de plantas de brejo por todo o corpo
      const foliagePatches = [
        { x: -0.34, y: 0.38, z: 0.28, r: 0.20, rx: 0.2, ry: -0.4 },
        { x: 0.34, y: 0.35, z: 0.30, r: 0.19, rx: -0.3, ry: 0.4 },
        { x: -0.42, y: 0.05, z: 0.24, r: 0.17, rx: 0.1, ry: -0.2 },
        { x: 0.42, y: 0.02, z: 0.26, r: 0.18, rx: -0.2, ry: 0.3 },
        { x: 0.0, y: 0.52, z: -0.18, r: 0.24, rx: -0.3, ry: 0.0 },
        { x: -0.36, y: 0.25, z: -0.28, r: 0.21, rx: 0.2, ry: 0.5 },
        { x: 0.36, y: 0.22, z: -0.28, r: 0.21, rx: 0.2, ry: -0.5 },
        { x: -0.25, y: -0.25, z: 0.15, r: 0.16, rx: 0.1, ry: -0.1 },
        { x: 0.25, y: -0.25, z: 0.15, r: 0.16, rx: 0.1, ry: 0.1 },
        { x: 0.0, y: 0.12, z: -0.36, r: 0.22, rx: 0.3, ry: 0.0 },
      ];
      for (const fp of foliagePatches) {
        const clump = new THREE.Mesh(new THREE.DodecahedronGeometry(fp.r, 1), swampFoliageMat);
        clump.position.set(fp.x, fp.y, fp.z);
        clump.rotation.set(fp.rx, fp.ry, 0);
        clump.castShadow = true;
        this.swampTorso.add(clump);
      }

      // Cipós transversais envolvendo o tronco
      for (let v = 0; v < 4; v++) {
        const vineTorus = new THREE.Mesh(
          new THREE.TorusGeometry(0.52 - v * 0.03, 0.045, 6, 16),
          swampVineMat,
        );
        vineTorus.position.set(0, -0.18 + v * 0.18, 0.02);
        vineTorus.rotation.x = Math.PI / 2 + (v - 1.5) * 0.16;
        vineTorus.rotation.y = (v - 1.5) * 0.22;
        this.swampTorso.add(vineTorus);
      }

      // Cistos e nódulos orgânicos de lodo verde borbulhante nas costas
      const oozeCysts = [
        { x: -0.24, y: 0.44, z: -0.25, r: 0.14 },
        { x: 0.24, y: 0.42, z: -0.26, r: 0.13 },
        { x: -0.36, y: 0.18, z: -0.18, r: 0.10 },
        { x: 0.35, y: 0.15, z: -0.20, r: 0.11 },
        { x: 0.0, y: 0.32, z: -0.35, r: 0.15 },
      ];
      for (const cyst of oozeCysts) {
        const oozeMesh = new THREE.Mesh(new THREE.SphereGeometry(cyst.r, 8, 8), swampOozeMat);
        oozeMesh.position.set(cyst.x, cyst.y, cyst.z);
        this.swampTorso.add(oozeMesh);
        this.bossCores.push(oozeMesh);
      }

      // ─── 2) CABEÇA DO HOMEM DO PÂNTANO, 2 OLHOS VERMELHOS E BARBA DE CIPÓS ─
      this.swampHead = new THREE.Group();
      this.swampHead.position.set(0, 0.48, 0.38);

      // Crânio sombrio de madeira podre e turfa
      const skullGeo = new THREE.DodecahedronGeometry(0.32, 1);
      skullGeo.scale(1.05, 0.85, 1.15);
      const skull = new THREE.Mesh(skullGeo, swampBarkMat);
      skull.castShadow = true;
      this.swampHead.add(skull);

      // Sobrancelha pesada de musgo saliente sobre os olhos (cria a cavidade sombria)
      const browMoss = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.16, 0.26), swampMossDeepMat);
      browMoss.position.set(0, 0.12, 0.24);
      browMoss.rotation.x = 0.22;
      browMoss.castShadow = true;
      this.swampHead.add(browMoss);

      // Tufos de folhagens no topo da cabeça
      for (const hSide of [-1, 0, 1]) {
        const topLeaf = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.30, 4), swampFoliageMat);
        topLeaf.position.set(hSide * 0.13, 0.24, 0.02);
        topLeaf.rotation.x = -0.3;
        topLeaf.rotation.z = hSide * 0.25;
        this.swampHead.add(topLeaf);
      }

      // Mandíbula inferior de madeira podre
      const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.16, 0.34), swampBarkMat);
      jaw.position.set(0, -0.16, 0.16);
      jaw.rotation.x = 0.18;
      this.swampHead.add(jaw);

      // ─── APENAS 2 OLHOS VERMELHOS PEQUENOS (Solicitado pelo usuário) ───
      // Cravados profundamente nas cavidades sombrias sob a sobrancelha de musgo
      for (const eyeSide of [-1, 1]) {
        const smallRedEye = new THREE.Mesh(
          new THREE.SphereGeometry(0.040, 8, 8),
          swampEyeMat,
        );
        smallRedEye.position.set(eyeSide * 0.11, 0.04, 0.28);
        this.swampHead.add(smallRedEye);
        this.swampEyes.push(smallRedEye);
      }

      // ─── BARBA EM FORMATO DE PLANTA, COMO CIPÓS (Característica central) ───
      // Cascata densa de cipós e raízes pendentes descendo da mandíbula e queixo pelo peitoral
      const beardOffsets = [
        // Fios centrais longos (descem pelo peito até o abdômen)
        { x: 0.0, y: -0.22, z: 0.32, len: 0.68, rad: 0.032, rx: 0.16, rz: 0.0, ph: 0.0 },
        { x: -0.06, y: -0.21, z: 0.31, len: 0.62, rad: 0.030, rx: 0.18, rz: -0.08, ph: 0.6 },
        { x: 0.06, y: -0.21, z: 0.31, len: 0.60, rad: 0.030, rx: 0.18, rz: 0.08, ph: 1.2 },
        { x: -0.12, y: -0.19, z: 0.28, len: 0.54, rad: 0.028, rx: 0.14, rz: -0.14, ph: 1.8 },
        { x: 0.12, y: -0.19, z: 0.28, len: 0.52, rad: 0.028, rx: 0.14, rz: 0.14, ph: 2.4 },
        // Fios intermediários
        { x: -0.03, y: -0.24, z: 0.35, len: 0.70, rad: 0.028, rx: 0.22, rz: -0.04, ph: 0.9 },
        { x: 0.03, y: -0.24, z: 0.35, len: 0.68, rad: 0.028, rx: 0.22, rz: 0.04, ph: 1.5 },
        { x: -0.09, y: -0.22, z: 0.33, len: 0.50, rad: 0.026, rx: 0.16, rz: -0.10, ph: 2.1 },
        { x: 0.09, y: -0.22, z: 0.33, len: 0.48, rad: 0.026, rx: 0.16, rz: 0.10, ph: 2.7 },
        // Fios laterais das bochechas e mandíbula
        { x: -0.17, y: -0.16, z: 0.24, len: 0.42, rad: 0.024, rx: 0.08, rz: -0.20, ph: 3.2 },
        { x: 0.17, y: -0.16, z: 0.24, len: 0.40, rad: 0.024, rx: 0.08, rz: 0.20, ph: 3.8 },
        { x: -0.22, y: -0.13, z: 0.18, len: 0.35, rad: 0.022, rx: 0.05, rz: -0.26, ph: 4.4 },
        { x: 0.22, y: -0.13, z: 0.18, len: 0.33, rad: 0.022, rx: 0.05, rz: 0.26, ph: 5.0 },
      ];

      for (const b of beardOffsets) {
        const vineGeo = new THREE.ConeGeometry(b.rad, b.len, 5);
        vineGeo.rotateX(Math.PI); // Inverte para apontar para baixo
        const vineMesh = new THREE.Mesh(vineGeo, swampVineMat);
        vineMesh.position.set(b.x, b.y - b.len * 0.45, b.z);
        vineMesh.rotation.x = b.rx;
        vineMesh.rotation.z = b.rz;
        vineMesh.castShadow = true;
        this.swampHead.add(vineMesh);
        this.swampBeardVines.push({ mesh: vineMesh, baseRx: b.rx, baseRz: b.rz, phase: b.ph });

        // Folhas brotando do cipó da barba
        const leafBud = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.10, 3), swampFoliageMat);
        leafBud.position.set(b.x, b.y - b.len * 0.55, b.z + 0.02);
        leafBud.rotation.set(0.5, 0, b.rz * 2);
        this.swampHead.add(leafBud);
      }

      this.swampTorso.add(this.swampHead);
      this.swampGroup.add(this.swampTorso);

      // ─── 3) BRAÇOS BRUTAIS E ARTICULADOS COBERTOS DE MUSGO E CIPÓS ────────
      for (const side of [-1, 1] as const) {
        const armGroup = new THREE.Group();
        armGroup.position.set(side * 0.52, 1.25, 0.05);

        // Braço superior de tronco podre
        const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.16, 0.58, 7), swampBarkMat);
        upperArm.position.set(0, -0.29, 0);
        upperArm.castShadow = true;
        armGroup.add(upperArm);

        // Cotovelo nodoso com tufo de musgo
        const elbow = new THREE.Mesh(new THREE.DodecahedronGeometry(0.14, 0), swampMossOliveMat);
        elbow.position.set(0, -0.60, -0.04);
        armGroup.add(elbow);

        // Antebraço grosso
        const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.24, 0.52, 7), swampBarkMat);
        forearm.position.set(0, -0.86, 0.08);
        forearm.rotation.x = 0.25;
        forearm.castShadow = true;
        armGroup.add(forearm);

        // Cipós espirais envolvendo o antebraço
        const vineArmCoil = new THREE.Mesh(
          new THREE.TorusGeometry(0.22, 0.04, 6, 12),
          swampVineMat,
        );
        vineArmCoil.position.set(0, -0.82, 0.08);
        vineArmCoil.rotation.x = Math.PI / 2 + 0.25;
        armGroup.add(vineArmCoil);

        // Palma/nó de madeira da mão (achatada para garras, sem esfera)
        const handBurl = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 1), swampBarkMat);
        handBurl.scale.set(0.9, 0.6, 1.15);
        handBurl.position.set(0, -1.15, 0.16);
        handBurl.castShadow = true;
        armGroup.add(handBurl);

        // 4 Dedos de raiz/madeira pontiaguda curvados para agarrar e esmagar
        for (let d = -1.5; d <= 1.5; d++) {
          const finger = new THREE.Mesh(new THREE.ConeGeometry(0.048, 0.38, 4), swampBarkMat);
          finger.rotation.x = Math.PI / 2 + 0.35;
          finger.rotation.z = d * 0.15;
          finger.position.set(d * 0.09, -1.22, 0.30);
          finger.castShadow = true;
          armGroup.add(finger);
        }

        // Cipós pendentes que caem do antebraço e balançam
        for (let av = 0; av < 3; av++) {
          const hangVine = new THREE.Mesh(
            new THREE.CylinderGeometry(0.02, 0.012, 0.45 + av * 0.12, 4),
            swampVineMat,
          );
          hangVine.position.set(side * 0.08, -0.75 - av * 0.10, -0.05 + av * 0.10);
          hangVine.rotation.z = side * 0.18;
          armGroup.add(hangVine);
        }

        this.swampGroup.add(armGroup);
        if (side === -1) this.swampArmL = armGroup;
        else this.swampArmR = armGroup;
      }

      // ─── 4) PERNAS ARTICULADAS E PÉS DE RAÍZES ENRAIZADAS NO SOLO ────────
      for (const side of [-1, 1] as const) {
        const legGroup = new THREE.Group();
        legGroup.position.set(side * 0.36, 0.65, -0.05);

        // Perna pesada de tronco nodoso
        const legMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.65, 8), swampBarkMat);
        legMesh.position.set(0, -0.32, 0);
        legMesh.castShadow = true;
        legGroup.add(legMesh);

        // Joelho de musgo
        const kneeMoss = new THREE.Mesh(new THREE.DodecahedronGeometry(0.19, 1), swampMossDeepMat);
        kneeMoss.position.set(0, -0.22, 0.14);
        legGroup.add(kneeMoss);

        // Pé largo enraizado no lodo
        const foot = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.16, 0.48), swampBarkMat);
        foot.position.set(0, -0.56, 0.12);
        foot.castShadow = true;
        legGroup.add(foot);

        // 3 Garras orgânicas de raiz fincadas no solo
        for (let c = -1; c <= 1; c++) {
          const rootClaw = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.24, 4), swampBarkMat);
          rootClaw.rotation.x = Math.PI / 2 + 0.1;
          rootClaw.position.set(c * 0.11, -0.58, 0.35);
          legGroup.add(rootClaw);
        }

        this.swampGroup.add(legGroup);
        if (side === -1) this.swampLegL = legGroup;
        else this.swampLegR = legGroup;
      }

      // ─── 5) ANEL DE LAMA E PÂNTANO NO SOLO ──────────────────────────────
      const swampPuddle = new THREE.Mesh(
        new THREE.RingGeometry(0.6, 1.8, 24),
        new THREE.MeshBasicMaterial({
          color: 0x14280e,
          transparent: true,
          opacity: 0.55,
          side: THREE.DoubleSide,
          depthWrite: false,
          fog: false,
        }),
      );
      swampPuddle.rotation.x = -Math.PI / 2;
      swampPuddle.position.y = 0.02;
      this.swampGroup.add(swampPuddle);

      this.wobble.add(this.swampGroup);
    } else if (type === "sack_boss") {
      // ─── MODELAGEM: O HOMEM DO SACO (CHEFE DA LENDA URBANA) ────────────
      // Aparência de andarilho/mendigo sinistro e macabro:
      // Sobretudo surrado marrom-acinzentado, calças remendadas, chapéu velho amassado,
      // barba desgrenhada, 2 olhos amarelados sinistros e um GRANDE SACO MARROM volumoso nas costas.

      const coatMat = new THREE.MeshStandardMaterial({
        color: 0x362c22, // Sobretudo surrado e envelhecido
        roughness: 0.95,
        metalness: 0.0,
      });
      const coatRaggedMat = new THREE.MeshStandardMaterial({
        color: 0x282018, // Farrapos e bordas escuras da barra do casaco
        roughness: 0.98,
      });
      const patchMat = new THREE.MeshStandardMaterial({
        color: 0x443a2f, // Remendos de pano no casaco
        roughness: 0.9,
      });
      const shirtMat = new THREE.MeshStandardMaterial({
        color: 0x4f4940, // Camisa manchada
        roughness: 0.9,
      });
      const trousersMat = new THREE.MeshStandardMaterial({
        color: 0x231e1a, // Calças esfarrapadas
        roughness: 0.95,
      });
      const skinMat = new THREE.MeshStandardMaterial({
        color: 0x766a5e, // Pele cadavérica e enrugada de andarilho
        roughness: 0.85,
      });
      const hairMat = new THREE.MeshStandardMaterial({
        color: 0x8a837c, // Barba e cabelos desgrenhados grisalhos
        roughness: 0.95,
      });
      const hatMat = new THREE.MeshStandardMaterial({
        color: 0x221a14, // Chapéu de aba amassado
        roughness: 0.96,
      });
      const burlapSackMat = new THREE.MeshStandardMaterial({
        color: 0x633f20, // Saco marrom de estopa rústica e grossa
        roughness: 0.96,
        metalness: 0.0,
      });
      const burlapLumpMat = new THREE.MeshStandardMaterial({
        color: 0x54351b, // Protuberâncias / sombras do saco
        roughness: 0.95,
      });
      const ropeMat = new THREE.MeshStandardMaterial({
        color: 0xc4a376, // Corda de sisal amarrada
        roughness: 0.9,
      });
      const sackEyeMat = new THREE.MeshBasicMaterial({
        color: 0xffcc00, // Olhos amarelos malévolos brilhantes
        fog: false,
      });

      // ─── 1) TRONCO ENCURVADO E SOBRETUDO ESFARRAPADO ───────────────────
      this.sackTorso = new THREE.Group();
      this.sackTorso.position.set(0, 0.96, 0);
      this.sackTorso.rotation.x = 0.22; // Postura inclinada/esgueirando-se de andarilho

      // Corpo principal (tórax sob o sobretudo)
      const torsoCoat = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.38, 0.68, 8, 14),
        coatMat,
      );
      torsoCoat.scale.set(1.15, 1.0, 0.95);
      torsoCoat.castShadow = true;
      this.sackTorso.add(torsoCoat);

      // Peito com camisa desgastada visível na gola aberta
      const chestShirt = new THREE.Mesh(
        new THREE.BoxGeometry(0.30, 0.38, 0.25),
        shirtMat,
      );
      chestShirt.position.set(0, 0.20, 0.16);
      this.sackTorso.add(chestShirt);

      // Lapelas abertas do sobretudo
      for (const lapelSide of [-1, 1]) {
        const lapel = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, 0.42, 0.08),
          coatMat,
        );
        lapel.position.set(lapelSide * 0.18, 0.18, 0.24);
        lapel.rotation.set(0.1, 0, lapelSide * -0.25);
        this.sackTorso.add(lapel);
      }

      // Remendos costurados no sobretudo
      const patch1 = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.14), patchMat);
      patch1.position.set(-0.24, 0.05, 0.28);
      patch1.rotation.y = -0.4;
      this.sackTorso.add(patch1);

      const patch2 = new THREE.Mesh(new THREE.PlaneGeometry(0.20, 0.16), patchMat);
      patch2.position.set(0.22, -0.15, 0.26);
      patch2.rotation.y = 0.35;
      this.sackTorso.add(patch2);

      // Corda de sisal amarrada na cintura como cinto
      const ropeBelt = new THREE.Mesh(
        new THREE.TorusGeometry(0.42, 0.04, 6, 16),
        ropeMat,
      );
      ropeBelt.position.set(0, -0.12, 0);
      ropeBelt.rotation.x = Math.PI / 2;
      this.sackTorso.add(ropeBelt);

      // Nó e pontas pendentes da corda da cintura
      const ropeKnot = new THREE.Mesh(new THREE.DodecahedronGeometry(0.06, 0), ropeMat);
      ropeKnot.position.set(0.14, -0.12, 0.40);
      this.sackTorso.add(ropeKnot);

      const ropeEnd = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.28, 4), ropeMat);
      ropeEnd.position.set(0.15, -0.24, 0.40);
      ropeEnd.rotation.z = -0.15;
      this.sackTorso.add(ropeEnd);

      // Barra do sobretudo longo esfarrapado (desce até as pernas)
      const skirtCoat = new THREE.Mesh(
        new THREE.CylinderGeometry(0.38, 0.52, 0.65, 8, 1, true),
        coatMat,
      );
      skirtCoat.position.set(0, -0.42, 0);
      this.sackTorso.add(skirtCoat);

      // Farrapos triangulares pendentes da barra do casaco
      for (let f = 0; f < 8; f++) {
        const fAngle = (f / 8) * Math.PI * 2;
        const fray = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.24, 3), coatRaggedMat);
        fray.rotation.x = Math.PI;
        fray.position.set(Math.cos(fAngle) * 0.48, -0.72, Math.sin(fAngle) * 0.44);
        this.sackTorso.add(fray);
      }

      // ─── 2) CABEÇA SINISTRA, BARBA DESGRENHADA E CHAPÉU AMASSADO ───────
      this.sackHead = new THREE.Group();
      this.sackHead.position.set(0, 0.52, 0.22);

      // Crânio enrugado e magro
      const skull = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24, 1), skinMat);
      skull.scale.set(0.95, 1.05, 1.05);
      skull.castShadow = true;
      this.sackHead.add(skull);

      // Nariz adunco comprido e encurvado
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.20, 4), skinMat);
      nose.position.set(0, 0.02, 0.26);
      nose.rotation.x = Math.PI / 2 + 0.35;
      this.sackHead.add(nose);

      // Mandíbula e bochechas ossudas
      const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.20), skinMat);
      jaw.position.set(0, -0.12, 0.12);
      this.sackHead.add(jaw);

      // Barba comprida e desgrenhada de andarilho
      const beardCenter = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.50, 4), hairMat);
      beardCenter.rotation.x = Math.PI - 0.2;
      beardCenter.position.set(0, -0.32, 0.18);
      this.sackHead.add(beardCenter);

      for (const bSide of [-1, 1]) {
        const beardSide = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.42, 4), hairMat);
        beardSide.rotation.set(Math.PI - 0.15, 0, bSide * 0.25);
        beardSide.position.set(bSide * 0.11, -0.28, 0.14);
        this.sackHead.add(beardSide);

        // Mechas de cabelo caindo dos lados da cabeça sob o chapéu
        const hairStrand = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.38, 3), hairMat);
        hairStrand.rotation.set(Math.PI - 0.3, 0, bSide * 0.4);
        hairStrand.position.set(bSide * 0.20, -0.12, 0.02);
        this.sackHead.add(hairStrand);
      }

      // Olhos amarelos malévolos brilhando nas sombras profundas
      for (const eyeSide of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 8), sackEyeMat);
        eye.position.set(eyeSide * 0.09, 0.05, 0.20);
        this.sackHead.add(eye);
        this.sackEyes.push(eye);
      }

      // Chapéu velho de mendigo amassado (abala para baixo, sombreando os olhos)
      this.sackHat = new THREE.Group();
      this.sackHat.position.set(0, 0.18, 0.02);
      this.sackHat.rotation.set(0.15, 0, 0.04);

      // Aba larga irregular do chapéu
      const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.46, 0.03, 14), hatMat);
      hatBrim.scale.set(1.0, 1.0, 1.15);
      hatBrim.castShadow = true;
      this.sackHat.add(hatBrim);

      // Copa amassada do chapéu
      const hatCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.26, 8), hatMat);
      hatCrown.position.set(0, 0.13, -0.04);
      hatCrown.rotation.x = -0.18;
      hatCrown.castShadow = true;
      this.sackHat.add(hatCrown);

      // Faixa desgastada no chapéu
      const hatBand = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.025, 4, 12), ropeMat);
      hatBand.position.set(0, 0.03, -0.03);
      hatBand.rotation.x = Math.PI / 2 - 0.18;
      this.sackHat.add(hatBand);

      this.sackHead.add(this.sackHat);
      this.sackTorso.add(this.sackHead);
      this.sackBossGroup.add(this.sackTorso);

      // ─── 3) O GRANDE SACO MARROM NAS COSTAS (Elemento Central!) ─────────
      // O saco marrom volumoso e pesado apoiado no ombro/costas
      this.sackBag = new THREE.Group();
      this.sackBag.position.set(0.34, 1.18, -0.15);

      // Corpo principal do saco de estopa (bojudo e pesado)
      const bagBody = new THREE.Mesh(
        new THREE.SphereGeometry(0.52, 12, 10),
        burlapSackMat,
      );
      bagBody.scale.set(1.12, 1.48, 1.08);
      bagBody.castShadow = true;
      this.sackBag.add(bagBody);

      // Protuberâncias no saco (dá a impressão assustadora de algo preso se debatendo)
      const bagLump1 = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), burlapLumpMat);
      bagLump1.position.set(0.15, -0.22, 0.22);
      bagLump1.scale.set(1.1, 0.8, 1.0);
      this.sackBag.add(bagLump1);

      const bagLump2 = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), burlapLumpMat);
      bagLump2.position.set(-0.18, 0.10, -0.25);
      this.sackBag.add(bagLump2);

      const bagLump3 = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), burlapLumpMat);
      bagLump3.position.set(0.22, 0.28, -0.12);
      this.sackBag.add(bagLump3);

      // Boca franzida e amarrada do saco
      const bagNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.28, 0.32, 8), burlapSackMat);
      bagNeck.position.set(0, 0.72, 0.08);
      bagNeck.rotation.z = -0.25;
      this.sackBag.add(bagNeck);

      // Corda de sisal amarrada na boca do saco
      const bagRope = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.045, 6, 12), ropeMat);
      bagRope.position.set(-0.04, 0.76, 0.08);
      bagRope.rotation.x = Math.PI / 2;
      this.sackBag.add(bagRope);

      // Sobra de estopa esgarçada acima do nó da corda
      const bagRuffle = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.24, 7), burlapSackMat);
      bagRuffle.position.set(-0.08, 0.92, 0.08);
      bagRuffle.rotation.z = 0.35;
      this.sackBag.add(bagRuffle);

      // Alça de corda que prende o saco ao redor do peitoral
      const strap = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.035, 6, 16), ropeMat);
      strap.position.set(-0.24, 0, 0.20);
      strap.rotation.set(0.65, 0.85, 0);
      this.sackBag.add(strap);

      this.sackBossGroup.add(this.sackBag);

      // ─── 4) BRAÇOS DO HOMEM DO SACO ────────────────────────────────────
      // Braço Esquerdo (Livre, ossudo, mão em garra curvada esticada para frente)
      this.sackArmL = new THREE.Group();
      this.sackArmL.position.set(-0.52, 1.25, 0.02);

      const upperArmL = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.52, 7), coatMat);
      upperArmL.position.set(0, -0.26, 0);
      upperArmL.castShadow = true;
      this.sackArmL.add(upperArmL);

      const forearmL = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.09, 0.52, 7), skinMat);
      forearmL.position.set(0, -0.68, 0.12);
      forearmL.rotation.x = 0.35;
      forearmL.castShadow = true;
      this.sackArmL.add(forearmL);

      // Mão ossuda e magra com dedos longos e curvados
      const handLMesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.18), skinMat);
      handLMesh.position.set(0, -0.96, 0.25);
      this.sackArmL.add(handLMesh);

      for (let f = -1.5; f <= 1.5; f++) {
        const finger = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.22, 4), skinMat);
        finger.position.set(f * 0.045, -1.04, 0.34);
        finger.rotation.x = Math.PI / 2 + 0.3;
        this.sackArmL.add(finger);
      }
      this.sackBossGroup.add(this.sackArmL);

      // Braço Direito (Segura a boca do saco marrom no ombro)
      this.sackArmR = new THREE.Group();
      this.sackArmR.position.set(0.48, 1.25, 0.02);

      const upperArmR = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.52, 7), coatMat);
      upperArmR.position.set(0, -0.24, -0.05);
      upperArmR.rotation.x = -0.35; // Puxado para trás segurando o saco
      upperArmR.castShadow = true;
      this.sackArmR.add(upperArmR);

      const forearmR = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.10, 0.48, 7), coatMat);
      forearmR.position.set(-0.06, -0.52, 0.05);
      forearmR.rotation.set(-0.85, 0.25, 0.2);
      forearmR.castShadow = true;
      this.sackArmR.add(forearmR);

      // Mão segurando firmemente a corda do saco
      const handRMesh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.14), skinMat);
      handRMesh.position.set(-0.12, -0.72, 0.10);
      this.sackArmR.add(handRMesh);

      this.sackBossGroup.add(this.sackArmR);

      // ─── 5) PERNAS ESFARRAPADAS E SAPATOS VELHOS ────────────────────────
      for (const legSide of [-1, 1] as const) {
        const legGroup = new THREE.Group();
        legGroup.position.set(legSide * 0.26, 0.65, -0.04);

        // Perna da calça esfarrapada
        const legMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.65, 7), trousersMat);
        legMesh.position.set(0, -0.32, 0);
        legMesh.castShadow = true;
        legGroup.add(legMesh);

        // Remendo no joelho
        const kneePatch = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.12), patchMat);
        kneePatch.position.set(0, -0.22, 0.13);
        legGroup.add(kneePatch);

        // Sapato velho deformado e enlameado
        const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.38), hatMat);
        shoe.position.set(0, -0.58, 0.08);
        shoe.castShadow = true;
        legGroup.add(shoe);

        this.sackBossGroup.add(legGroup);
        if (legSide === -1) this.sackLegL = legGroup;
        else this.sackLegR = legGroup;
      }

      this.wobble.add(this.sackBossGroup);
    }

    const armMat = new THREE.MeshStandardMaterial({
      color: this.baseColor.clone().multiplyScalar(0.85),
      roughness: 0.7,
    });
    const isTank = type === "tank";
    const armLength = isTank ? 0.75 : isCrawler ? 0.65 : 0.55;
    const armRad = isTank ? 0.12 : isCrawler ? 0.09 : 0.08;
    const armGeo = new THREE.CylinderGeometry(armRad, armRad * 1.35, armLength, 8);
    armGeo.rotateX(Math.PI / 2); // Aponta para frente
    this.handL = new THREE.Mesh(armGeo, armMat);
    this.handR = new THREE.Mesh(armGeo, armMat);
    const handX = isTank ? 0.44 : isCrawler ? 0.38 : 0.32;
    const handY = isCrawler ? 0.14 : 0.8;
    const handZ = isTank ? 0.55 : isCrawler ? 0.38 : 0.45;
    this.handL.position.set(-handX, handY, handZ);
    this.handR.position.set(handX, handY, handZ);
    this.handL.castShadow = this.handR.castShadow = true;
    this.wobble.add(this.handL, this.handR);

    this.handL.visible = !this.isSpider && !this.isCanine && !this.isSwampBoss && !this.isSackBoss;
    this.handR.visible = !this.isSpider && !this.isCanine && !this.isSwampBoss && !this.isSackBoss;

    // ─── Sombra no chão ─────────────────────────────────────────────────
    const shadowSize = (isBoss || this.isSackBoss) ? 3.0 : (this.isSpiderBoss ? 3.2 : this.isWerewolf ? 3.2 : (this.isSpider || this.isWolf) ? 1.3 : 1.6);
    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(shadowSize, shadowSize),
      new THREE.MeshBasicMaterial({
        map: createRadialTexture("rgba(0,0,0,0.6)", "rgba(0,0,0,0)"),
        transparent: true,
        depthWrite: false,
      }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.01;
    this.root.add(this.shadow);

    if (this.isSpider) {
      this.handL.visible = false;
      this.handR.visible = false;
    }

    // ─── Barra de vida flutuante ─────────────────────────────────────────
    this.hpBar = new THREE.Sprite(
      new THREE.SpriteMaterial({ transparent: true, depthWrite: false, fog: false }),
    );
    this.hpBar.position.y = this.isWerewolf
      ? 2.25
      : (isBoss || this.isSackBoss)
        ? 2.45
        : this.isSpiderBoss
          ? 2.15
          : isTank
            ? 2.6
            : (isCrawler || this.isWolf)
              ? 1.4
              : this.isSpider
                ? 1.05
                : type === "mortar"
                  ? 2.25
                  : 2.05;
    const barScaleX = this.isWerewolf ? 1.18 : (isBoss || this.isSpiderBoss || this.isSackBoss) ? 1.85 : 1.4;
    const barScaleY = this.isWerewolf ? 0.24 : (isBoss || this.isSpiderBoss || this.isSackBoss) ? 0.38 : 0.28;
    this.hpBar.scale.set(barScaleX, barScaleY, 1);
    this.root.add(this.hpBar);
    this.drawHpBar(this.currentHp, this.maxHp);
  }

  get position(): { x: number; y: number; z: number } {
    return { x: this.x, y: this.y, z: this.z };
  }

  get radius(): number {
    return this.configRadius;
  }

  get isAlive(): boolean {
    return this.currentState === "alive" && !this.hasExploded;
  }

  private triggerExplosion(): void {
    // Oculta corpo, sombra e barra de vida imediatamente ao explodir
    this.wobble.visible = false;
    this.shadow.visible = false;
    this.hpBar.visible = false;

    this.explosionGroup = new THREE.Group();
    this.explosionGroup.position.set(0, 0.8, 0);

    // 1) Bola de fogo central incandescente
    const coreGeo = new THREE.SphereGeometry(0.5, 12, 10);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xffea44,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      fog: false,
    });
    this.fireballCore = new THREE.Mesh(coreGeo, coreMat);
    this.explosionGroup.add(this.fireballCore);

    // 2) Esfera de explosão externa (laranja/vermelha)
    const outerGeo = new THREE.SphereGeometry(0.85, 14, 12);
    const outerMat = new THREE.MeshBasicMaterial({
      color: 0xff3b00,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      fog: false,
    });
    this.fireballOuter = new THREE.Mesh(outerGeo, outerMat);
    this.explosionGroup.add(this.fireballOuter);

    // 3) Onda de choque no chão (anel expansivo)
    const ringGeo = new THREE.RingGeometry(0.25, 0.55, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xff7722,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      fog: false,
    });
    this.shockwaveRing = new THREE.Mesh(ringGeo, ringMat);
    this.shockwaveRing.rotation.x = -Math.PI / 2;
    this.shockwaveRing.position.y = -0.72; // Rente ao solo
    this.explosionGroup.add(this.shockwaveRing);

    // 4) Fagulhas e estilhaços expelidos
    const sparkGeo = new THREE.DodecahedronGeometry(0.08, 0);
    const sparkMat = new THREE.MeshBasicMaterial({
      color: 0xffdd44,
      fog: false,
    });
    for (let i = 0; i < 12; i++) {
      const sparkMesh = new THREE.Mesh(sparkGeo, sparkMat);
      const angle = (i / 12) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const speed = 4.0 + Math.random() * 5.0;
      const upSpeed = 2.5 + Math.random() * 4.5;
      this.explosionSparks.push({
        mesh: sparkMesh,
        vx: Math.cos(angle) * speed,
        vy: upSpeed,
        vz: Math.sin(angle) * speed,
      });
      this.explosionGroup.add(sparkMesh);
    }

    this.root.add(this.explosionGroup);
    this.explosionTimer = 0;
  }

  get attacking(): boolean {
    return this.attackTimer > 0;
  }

  get aggressive(): boolean {
    return this.isAggro;
  }

  /** Atualiza dados autoritativos vindos do servidor. Retorna true se acabou de explodir. */
  sync(
    x: number,
    y: number,
    z: number,
    rotation: number,
    hp: number,
    state: "alive" | "dead",
    attacking?: boolean,
    exploded?: boolean,
    isAggro?: boolean,
  ): boolean {
    this.isAggro = !!isAggro;
    let justExploded = false;
    if (exploded && !this.hasExploded) {
      this.hasExploded = true;
      this.triggerExplosion();
      justExploded = true;
    }

    if (!this.hasPose) {
      this.x = x;
      this.y = y;
      this.z = z;
      this.rot = rotation;
      this.displayRot = rotation;
      this.prevX = x;
      this.prevZ = z;
      this.root.position.set(x, y, z);
      this.hasPose = true;
    }

    // Feedback de dano
    if (hp < this.currentHp && state === "alive") {
      this.hitFlashTimer = 0.12;
    }

    // Gatilho de animação de ataque corpo a corpo
    if (attacking && !this.isAttacking && state === "alive") {
      this.attackTimer = 0.32;
    }
    this.isAttacking = !!attacking;

    if (hp !== this.currentHp || this.currentState !== state) {
      this.currentHp = hp;
      this.currentState = state;
      this.drawHpBar(this.currentHp, this.maxHp);
    }

    this.snapshots.push({ t: performance.now(), x, y, z, rot: rotation });
    if (this.snapshots.length > 25) this.snapshots.shift();

    return justExploded;
  }

  /** Interpola entre snapshots da rede */
  interpolate(renderTime: number): void {
    const s = this.snapshots;
    if (s.length === 0) return;
    while (s.length >= 2 && s[1]!.t <= renderTime) s.shift();
    const a = s[0]!;
    const b = s[1];
    if (!b || renderTime <= a.t) {
      this.x = a.x;
      this.y = a.y;
      this.z = a.z;
      this.rot = a.rot;
      return;
    }
    const k = clamp((renderTime - a.t) / Math.max(1, b.t - a.t), 0, 1);
    this.x = lerp(a.x, b.x, k);
    this.y = lerp(a.y, b.y, k);
    this.z = lerp(a.z, b.z, k);
    this.rot = lerpAngle(a.rot, b.rot, k);
  }

  animate(dt: number, t: number): void {
    if (dt <= 0) return;
    this.root.position.set(this.x, this.y, this.z);

    // ─── Efeito de Explosão Ativa ──────────────────────────────────────
    if (this.hasExploded && this.explosionGroup) {
      this.explosionTimer += dt;
      const progress = Math.min(1, this.explosionTimer / 0.7);

      if (this.fireballCore && this.fireballOuter && this.shockwaveRing) {
        const coreScale = 1 + progress * 2.8;
        this.fireballCore.scale.setScalar(coreScale);
        (this.fireballCore.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - progress * 1.5);

        const outerScale = 1 + progress * 4.2;
        this.fireballOuter.scale.setScalar(outerScale);
        (this.fireballOuter.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - progress);

        const ringScale = 1 + progress * 7.0;
        this.shockwaveRing.scale.setScalar(ringScale);
        (this.shockwaveRing.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - progress * 1.25);
      }

      for (const spark of this.explosionSparks) {
        spark.mesh.position.x += spark.vx * dt;
        spark.mesh.position.y += spark.vy * dt;
        spark.mesh.position.z += spark.vz * dt;
        spark.vy -= 14 * dt; // gravidade
        spark.mesh.scale.setScalar(Math.max(0.1, 1 - progress));
      }

      if (progress >= 1) {
        this.explosionGroup.visible = false;
      }
      return;
    }

    // ─── Efeito de dano (Hit Flash) ────────────────────────────────────
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= dt;
      this.bodyMat.color.set("#ff4d4d");
      this.bodyMat.emissive.set("#ff2222");
      this.bodyMat.emissiveIntensity = 0.9;
    } else {
      this.bodyMat.color.copy(this.baseColor);
      this.bodyMat.emissive.copy(this.baseColor);
      if (this.type === "runner") {
        // Pulsação de perigo instável antes de explodir (mais urgente se em perseguição)
        const pulseFreq = this.isAggro ? 15 : 6;
        const pulse = Math.sin(t * pulseFreq) * 0.5 + 0.5;
        this.bodyMat.emissiveIntensity = this.isAggro ? (0.28 + pulse * 0.45) : (0.12 + pulse * 0.2);
      } else {
        this.bodyMat.emissiveIntensity = this.isAggro ? 0.22 : 0.1;
      }
    }

    // Olhos tóxicos brilhantes: mais intensos ao focar no sobrevivente
    if (this.currentState === "alive") {
      if (this.isAggro) {
        this.eyeMat.color.copy(this.baseEyeColor).multiplyScalar(1.4);
      } else {
        this.eyeMat.color.copy(this.baseEyeColor);
      }
    }

    // Pulsação do núcleo volátil nas costas do Zumbi Suicida
    if (this.volatileCore) {
      const pulseFreq = this.isAggro ? 18 : 6;
      const pulse = Math.sin(t * pulseFreq) * 0.5 + 0.5;
      const red = this.isAggro ? 1.0 : 0.85;
      const green = this.isAggro ? 0.15 + pulse * 0.5 : 0.45 + pulse * 0.3;
      (this.volatileCore.material as THREE.MeshBasicMaterial).color.setRGB(red, green, 0.0);
      this.volatileCore.scale.setScalar(0.85 + pulse * (this.isAggro ? 0.35 : 0.15));
    }

    // Pulsação da glândula de veneno do Zumbi Rastejador
    if (this.toxicGland) {
      const pulseFreq = this.isAggro ? 12 : 5;
      const pulse = Math.sin(t * pulseFreq) * 0.5 + 0.5;
      const g = this.isAggro ? 1.0 : 0.85;
      (this.toxicGland.material as THREE.MeshBasicMaterial).color.setRGB(0.15, g, 0.05);
      this.toxicGland.scale.setScalar(0.9 + pulse * 0.22);
    }

    const isCrawler = this.type === "spitter";

    // ─── ANIMAÇÃO ESPECIAL PARA ARANHAS (Don't Starve) ───────────────────
    if (this.isSpider) {
      if (this.currentState === "dead") {
        this.hpBar.visible = false;
        this.deathProgress = Math.min(1, this.deathProgress + dt * 4.0);
        const curl = this.deathProgress;
        this.wobble.position.y = lerp(0, -0.06, curl);
        this.wobble.rotation.x = -0.2 * curl;
        this.wobble.rotation.z = 0.3 * curl;

        for (const leg of this.spiderLegs) {
          leg.group.rotation.z = lerp(leg.group.rotation.z, leg.side * 1.5, curl * 0.2);
          leg.group.rotation.x = lerp(leg.group.rotation.x, -0.8, curl * 0.2);
        }
        for (const eye of this.spiderEyes) {
          (eye.material as THREE.MeshBasicMaterial).color.set("#150508");
        }
        this.corpseTimer -= dt;
        if (this.corpseTimer < 2.5) {
          const sink = (2.5 - Math.max(0, this.corpseTimer)) / 2.5;
          this.wobble.position.y = -0.06 - sink * 0.35;
          this.shadow.scale.setScalar(Math.max(0, 1 - sink));
        }
        return;
      }

      // Olhos mais incandescentes em perseguição
      const eyeMatColor = this.isSpiderBoss ? "#ff0033" : "#ff2244";
      for (const eye of this.spiderEyes) {
        (eye.material as THREE.MeshBasicMaterial).color.set(this.isAggro ? "#ff0000" : eyeMatColor);
      }

      // Ataque de mordida ou cuspe de teia: empina as patas dianteiras e abre quelíceras
      if (this.attackTimer > 0) {
        this.attackTimer -= dt;
        const progress = 1 - Math.max(0, this.attackTimer) / 0.32;
        const strike = Math.sin(progress * Math.PI);

        this.displayRot = lerpAngle(this.displayRot, this.rot, damp(18, dt));
        this.yaw.rotation.y = this.displayRot;

        this.wobble.position.y = strike * (this.isSpiderBoss ? 0.32 : 0.15);
        this.wobble.rotation.x = -strike * 0.38;

        for (let fi = 0; fi < this.spiderFangs.length; fi++) {
          const fang = this.spiderFangs[fi]!;
          const side = fi === 0 ? -1 : 1;
          fang.rotation.z = -side * (0.2 + strike * 0.45);
        }

        for (const leg of this.spiderLegs) {
          if (leg.legIdx === 0 || leg.legIdx === 4) {
            leg.group.rotation.x = -strike * 0.9;
            leg.group.rotation.z = -leg.side * (leg.baseRoll + strike * 0.5);
          }
        }
        return;
      }

      const vx = (this.x - this.prevX) / dt;
      const vz = (this.z - this.prevZ) / dt;
      this.prevX = this.x;
      this.prevZ = this.z;
      const speed = Math.hypot(vx, vz);
      const moving = speed > 0.08;

      this.displayRot = lerpAngle(this.displayRot, this.rot, damp(14, dt));
      this.yaw.rotation.y = this.displayRot;

      if (moving) {
        const cadence = this.isSpiderBoss ? 9.5 : 15.0;
        this.walkPhase += dt * cadence;

        const bob = Math.abs(Math.sin(this.walkPhase * 2));
        this.wobble.position.y = bob * (this.isSpiderBoss ? 0.08 : 0.04);
        this.wobble.rotation.z = Math.sin(this.walkPhase) * (this.isSpiderBoss ? 0.04 : 0.07);
        this.wobble.rotation.y = Math.cos(this.walkPhase) * 0.05;

        for (const leg of this.spiderLegs) {
          const isSetA = leg.legIdx === 0 || leg.legIdx === 2 || leg.legIdx === 5 || leg.legIdx === 7;
          const phase = isSetA ? this.walkPhase : this.walkPhase + Math.PI;
          const stepForward = Math.sin(phase);
          const stepLift = Math.max(0, Math.cos(phase));

          leg.group.rotation.y = leg.baseYaw + stepForward * 0.28;
          leg.group.rotation.x = (leg.legIdx % 4 > 1 ? -0.2 : 0.2) - stepLift * 0.35;
          leg.group.rotation.z = -leg.side * (leg.baseRoll + stepLift * 0.20);
        }

        for (let fi = 0; fi < this.spiderFangs.length; fi++) {
          const fang = this.spiderFangs[fi]!;
          const side = fi === 0 ? -1 : 1;
          fang.rotation.z = -side * (0.2 + Math.sin(this.walkPhase * 1.5) * 0.08);
        }
      } else {
        this.wobble.position.y = Math.sin(t * 2.0) * (this.isSpiderBoss ? 0.03 : 0.015);
        this.wobble.rotation.x = Math.sin(t * 1.5) * 0.02;

        if (this.spiderAbdomen) {
          const abPulse = 1.0 + Math.sin(t * 2.5) * 0.035;
          this.spiderAbdomen.scale.set(1.08 * abPulse, 0.98 * abPulse, 1.28);
        }

        if (this.spiderSilkGlands.length > 0) {
          const gPulse = 1.0 + Math.sin(t * 4.0) * 0.18;
          for (const g of this.spiderSilkGlands) {
            g.scale.setScalar(gPulse);
          }
        }

        for (let fi = 0; fi < this.spiderFangs.length; fi++) {
          const fang = this.spiderFangs[fi]!;
          const side = fi === 0 ? -1 : 1;
          fang.rotation.z = -side * (0.2 + Math.sin(t * 2.0) * 0.04);
        }

        for (const leg of this.spiderLegs) {
          leg.group.rotation.y = leg.baseYaw;
          leg.group.rotation.x = leg.legIdx % 4 > 1 ? -0.1 : 0.1;
          leg.group.rotation.z = -leg.side * leg.baseRoll;
        }
      }
      return;
    }

    // ─── ANIMAÇÃO ESPECIAL PARA LOBISOMEM E LOBOS (Don't Starve) ───────────
    if (this.isCanine) {
      if (this.currentState === "dead") {
        this.hpBar.visible = false;
        this.deathProgress = Math.min(1, this.deathProgress + dt * 4.0);
        const fall = this.deathProgress;
        if (this.isWerewolf) {
          // O Lobisomem tomba de joelhos e despenca com o peito no chão
          this.wobble.position.y = lerp(0, -0.35, fall);
          this.wobble.rotation.x = lerp(0, 1.35, fall);
          this.wobble.rotation.z = lerp(0, 0.25, fall);
          if (this.werewolfArmL) this.werewolfArmL.rotation.x = lerp(0, 0.8, fall);
          if (this.werewolfArmR) this.werewolfArmR.rotation.x = lerp(0, 0.8, fall);
        } else {
          // O Lobo tomba de lado com as patas esticadas
          this.wobble.position.y = lerp(0, -0.15, fall);
          this.wobble.rotation.z = lerp(0, 1.45, fall);
        }
        for (const eye of this.werewolfEyes) {
          (eye.material as THREE.MeshBasicMaterial).color.set("#221508");
        }
        this.corpseTimer -= dt;
        if (this.corpseTimer < 2.5) {
          const sink = (2.5 - Math.max(0, this.corpseTimer)) / 2.5;
          this.wobble.position.y = (this.isWerewolf ? -0.35 : -0.15) - sink * 0.4;
          this.shadow.scale.setScalar(Math.max(0, 1 - sink));
        }
        return;
      }

      // Olhos ferozes incandescentes
      for (const eye of this.werewolfEyes) {
        (eye.material as THREE.MeshBasicMaterial).color.set(this.isAggro ? "#ff9900" : "#f59e0b");
      }

      // Ataque feroz: golpe de garras cortantes (Lobisomem) ou bote com mordida rápida (Lobo)
      if (this.attackTimer > 0) {
        this.attackTimer -= dt;
        const progress = 1 - Math.max(0, this.attackTimer) / 0.32;
        const strike = Math.sin(progress * Math.PI);

        this.displayRot = lerpAngle(this.displayRot, this.rot, damp(18, dt));
        this.yaw.rotation.y = this.displayRot;

        if (this.isWerewolf) {
          // Empina o tronco e desfere o corte duplo brutal com as garras
          this.wobble.position.y = strike * 0.25;
          this.wobble.rotation.x = -0.35 + strike * 0.75;
          if (this.werewolfHead) {
            this.werewolfHead.rotation.x = -strike * 0.45;
          }
          if (this.werewolfJaw) {
            this.werewolfJaw.rotation.x = strike * 0.55;
          }
          if (this.werewolfArmL) {
            this.werewolfArmL.rotation.x = 0.4 + strike * 1.5;
            this.werewolfArmL.rotation.z = 0.3 - strike * 0.8;
          }
          if (this.werewolfArmR) {
            this.werewolfArmR.rotation.x = 0.2 + strike * 1.7;
            this.werewolfArmR.rotation.z = -0.3 + strike * 0.8;
          }
        } else {
          // Bote do lobo: projeta corpo à frente e fecha mandíbula
          this.wobble.position.y = strike * 0.2;
          this.wobble.rotation.x = strike * 0.45;
          if (this.werewolfHead) {
            this.werewolfHead.rotation.x = -strike * 0.3;
          }
          if (this.werewolfJaw) {
            this.werewolfJaw.rotation.x = strike * 0.5;
          }
        }
        return;
      }

      const vx = (this.x - this.prevX) / dt;
      const vz = (this.z - this.prevZ) / dt;
      this.prevX = this.x;
      this.prevZ = this.z;
      const speed = Math.hypot(vx, vz);
      const moving = speed > 0.08;

      this.displayRot = lerpAngle(this.displayRot, this.rot, damp(15, dt));
      this.yaw.rotation.y = this.displayRot;

      if (moving) {
        const cadence = this.isWerewolf ? 10.0 : 16.0;
        this.walkPhase += dt * cadence;

        if (this.isWerewolf) {
          // Passada bípede pesada e predatória com balanço de ombros e garras oscilando
          const bob = Math.abs(Math.sin(this.walkPhase));
          this.wobble.position.y = bob * 0.08;
          this.wobble.rotation.z = Math.sin(this.walkPhase) * 0.06;
          this.wobble.rotation.x = 0.18 + Math.cos(this.walkPhase * 2) * 0.04;

          const armSwing = Math.sin(this.walkPhase) * 0.65;
          if (this.werewolfArmL) {
            this.werewolfArmL.rotation.x = armSwing;
            this.werewolfArmL.rotation.z = 0.15;
          }
          if (this.werewolfArmR) {
            this.werewolfArmR.rotation.x = -armSwing;
            this.werewolfArmR.rotation.z = -0.15;
          }
          if (this.werewolfLegL) {
            this.werewolfLegL.rotation.x = -armSwing * 0.8;
          }
          if (this.werewolfLegR) {
            this.werewolfLegR.rotation.x = armSwing * 0.8;
          }
          if (this.werewolfTail) {
            this.werewolfTail.rotation.y = Math.sin(this.walkPhase) * 0.25;
            this.werewolfTail.rotation.x = -0.3 + Math.abs(Math.cos(this.walkPhase)) * 0.15;
          }
          if (this.werewolfHead) {
            this.werewolfHead.rotation.y = Math.sin(this.walkPhase) * 0.08;
            this.werewolfHead.rotation.x = 0.1 + Math.sin(this.walkPhase * 2) * 0.05;
          }
        } else {
          // Galope quadrúpede rápido do lobo (Hound)
          const gallop = Math.sin(this.walkPhase);
          this.wobble.position.y = Math.abs(gallop) * 0.08;
          this.wobble.rotation.x = Math.cos(this.walkPhase) * 0.12;

          if (this.wolfLegs.length === 4) {
            this.wolfLegs[0]!.rotation.x = gallop * 0.7;
            this.wolfLegs[1]!.rotation.x = -gallop * 0.7;
            this.wolfLegs[2]!.rotation.x = -gallop * 0.8;
            this.wolfLegs[3]!.rotation.x = gallop * 0.8;
          }
          if (this.werewolfTail) {
            this.werewolfTail.rotation.y = Math.sin(this.walkPhase * 2) * 0.35;
          }
        }
      } else {
        // Respiração pesada no idle
        this.wobble.position.y = Math.sin(t * 2.2) * (this.isWerewolf ? 0.03 : 0.015);
        this.wobble.rotation.x = this.isWerewolf ? 0.18 + Math.sin(t * 1.8) * 0.02 : 0;
        this.wobble.rotation.z = 0;

        if (this.isWerewolf) {
          if (this.werewolfArmL) this.werewolfArmL.rotation.x = 0.2 + Math.sin(t * 2.0) * 0.05;
          if (this.werewolfArmR) this.werewolfArmR.rotation.x = 0.2 + Math.sin(t * 2.0 + 1) * 0.05;
          if (this.werewolfTail) this.werewolfTail.rotation.y = Math.sin(t * 1.5) * 0.18;
          if (this.werewolfHead) this.werewolfHead.rotation.x = 0.05 + Math.sin(t * 1.8) * 0.04;
          if (this.werewolfJaw) this.werewolfJaw.rotation.x = 0.12 + Math.sin(t * 2.5) * 0.05;
        } else {
          if (this.wolfLegs.length === 4) {
            for (const l of this.wolfLegs) l.rotation.x = 0;
          }
          if (this.werewolfTail) this.werewolfTail.rotation.y = Math.sin(t * 3.0) * 0.25;
        }
      }
      return;
    }

    // ─── ANIMAÇÃO ESPECIAL PARA O MONSTRO DO PÂNTANO (HOMEM DO PÂNTANO) ─
    if (this.isSwampBoss) {
      if (this.currentState === "dead") {
        this.hpBar.visible = false;
        this.deathProgress = Math.min(1, this.deathProgress + dt * 2.5);
        const collapse = this.deathProgress;
        // O Monstro do Pântano se desfaz e afunda lentamente na lama negra
        this.wobble.position.y = lerp(0, -0.45, collapse);
        this.wobble.rotation.x = lerp(0, 0.45, collapse);
        this.wobble.rotation.z = lerp(0, 0.25, collapse);
        if (this.swampArmL) this.swampArmL.rotation.x = lerp(0, -0.3, collapse);
        if (this.swampArmR) this.swampArmR.rotation.x = lerp(0, -0.3, collapse);
        for (const eye of this.swampEyes) {
          (eye.material as THREE.MeshBasicMaterial).color.set("#1a0300");
        }
        this.corpseTimer -= dt;
        if (this.corpseTimer < 3.0) {
          const sink = (3.0 - Math.max(0, this.corpseTimer)) / 3.0;
          this.wobble.position.y = -0.45 - sink * 0.65;
          this.shadow.scale.setScalar(Math.max(0, 1 - sink));
        }
        return;
      }

      // Olhos vermelhos incandescentes que pulsam com malícia
      const eyeIntensity = this.isAggro ? 1.0 : 0.75 + Math.sin(t * 3.0) * 0.25;
      for (const eye of this.swampEyes) {
        (eye.material as THREE.MeshBasicMaterial).color.setRGB(eyeIntensity, 0, 0);
      }

      // Ataque: pancada esmagadora com ambos os braços de nó de madeira erguidos e golpe no chão
      if (this.attackTimer > 0) {
        this.attackTimer -= dt;
        const progress = 1 - Math.max(0, this.attackTimer) / 0.38;
        const slam = Math.sin(progress * Math.PI);

        this.displayRot = lerpAngle(this.displayRot, this.rot, damp(18, dt));
        this.yaw.rotation.y = this.displayRot;

        // Ergue o torso e desaba golpeando o solo
        this.wobble.position.y = slam * 0.25;
        this.wobble.rotation.x = -0.2 + slam * 0.65;

        if (this.swampArmL) {
          this.swampArmL.rotation.x = -0.8 + slam * 2.2;
          this.swampArmL.rotation.z = 0.2 - slam * 0.4;
        }
        if (this.swampArmR) {
          this.swampArmR.rotation.x = -0.8 + slam * 2.2;
          this.swampArmR.rotation.z = -0.2 + slam * 0.4;
        }
        if (this.swampTorso) {
          this.swampTorso.rotation.x = 0.14 + slam * 0.35;
        }

        // Barba de cipós chicoteia com o impacto brutal
        for (const vine of this.swampBeardVines) {
          vine.mesh.rotation.x = vine.baseRx + slam * 0.7;
        }
        return;
      }

      const vx = (this.x - this.prevX) / dt;
      const vz = (this.z - this.prevZ) / dt;
      this.prevX = this.x;
      this.prevZ = this.z;
      const speed = Math.hypot(vx, vz);
      const moving = speed > 0.08;

      this.displayRot = lerpAngle(this.displayRot, this.rot, damp(12, dt));
      this.yaw.rotation.y = this.displayRot;

      if (moving) {
        // Passada pesada, lenta, titânica e aterradora
        const cadence = this.isAggro ? 6.5 : 4.0;
        this.walkPhase += dt * cadence;

        // Balanço colossal de peso de um pé ao outro
        const bob = Math.abs(Math.sin(this.walkPhase));
        this.wobble.position.y = bob * 0.12;
        this.wobble.rotation.z = Math.sin(this.walkPhase) * 0.08;
        this.wobble.rotation.x = 0.14 + Math.cos(this.walkPhase * 2) * 0.04;

        // Braços de nós de madeira balançam organicamente
        const armSwing = Math.sin(this.walkPhase) * 0.55;
        if (this.swampArmL) {
          this.swampArmL.rotation.x = armSwing;
          this.swampArmL.rotation.z = 0.08 + Math.cos(this.walkPhase) * 0.03;
        }
        if (this.swampArmR) {
          this.swampArmR.rotation.x = -armSwing;
          this.swampArmR.rotation.z = -0.08 - Math.cos(this.walkPhase) * 0.03;
        }

        // Pernas de tronco dão passadas firmes no brejo
        if (this.swampLegL) {
          this.swampLegL.rotation.x = -armSwing * 0.75;
        }
        if (this.swampLegR) {
          this.swampLegR.rotation.x = armSwing * 0.75;
        }

        // Ondulação fluida e orgânica da barba de cipós ao caminhar
        for (const vine of this.swampBeardVines) {
          const swayX = Math.sin(this.walkPhase + vine.phase) * 0.22;
          const swayZ = Math.cos(this.walkPhase * 0.5 + vine.phase) * 0.15;
          vine.mesh.rotation.x = vine.baseRx + swayX;
          vine.mesh.rotation.z = vine.baseRz + swayZ;
        }
      } else {
        // Respiração lenta, profunda e assustadora da besta do pântano
        this.wobble.position.y = Math.sin(t * 1.6) * 0.04;
        this.wobble.rotation.x = 0.14 + Math.sin(t * 1.6) * 0.025;
        this.wobble.rotation.z = Math.sin(t * 0.8) * 0.015;

        if (this.swampArmL) {
          this.swampArmL.rotation.x = 0.12 + Math.sin(t * 1.6) * 0.04;
          this.swampArmL.rotation.z = 0.06;
        }
        if (this.swampArmR) {
          this.swampArmR.rotation.x = 0.12 + Math.sin(t * 1.6 + 0.5) * 0.04;
          this.swampArmR.rotation.z = -0.06;
        }
        if (this.swampLegL) this.swampLegL.rotation.x = 0;
        if (this.swampLegR) this.swampLegR.rotation.x = 0;

        // Cipós da barba oscilando suavemente na brisa podre do brejo
        for (const vine of this.swampBeardVines) {
          const swayX = Math.sin(t * 2.0 + vine.phase) * 0.08;
          const swayZ = Math.cos(t * 1.4 + vine.phase) * 0.06;
          vine.mesh.rotation.x = vine.baseRx + swayX;
          vine.mesh.rotation.z = vine.baseRz + swayZ;
        }

        // Pulso suave das glândulas de lodo
        const coreScale = 1.0 + Math.sin(t * 3.5) * 0.12;
        for (const c of this.bossCores) {
          c.scale.setScalar(coreScale);
        }
      }
      return;
    }

    // ─── ANIMAÇÃO ESPECIAL: O HOMEM DO SACO (CHEFE DA LENDA URBANA) ─────
    if (this.isSackBoss) {
      if (this.currentState === "dead") {
        this.hpBar.visible = false;
        this.deathProgress = Math.min(1, this.deathProgress + dt * 2.8);
        const collapse = this.deathProgress;
        // Homem do Saco desaba de joelhos e tomba com o saco caído ao lado
        this.wobble.position.y = lerp(0, -0.35, collapse);
        this.wobble.rotation.x = lerp(0, 0.85, collapse);
        this.wobble.rotation.z = lerp(0, 0.25, collapse);

        if (this.sackBag) {
          this.sackBag.position.set(0.55 * collapse, 1.18 - 0.95 * collapse, -0.15 + 0.35 * collapse);
          this.sackBag.rotation.z = 1.35 * collapse;
        }
        if (this.sackArmL) this.sackArmL.rotation.x = lerp(0, 0.6, collapse);
        if (this.sackArmR) this.sackArmR.rotation.x = lerp(-0.35, 0.4, collapse);

        for (const eye of this.sackEyes) {
          (eye.material as THREE.MeshBasicMaterial).color.set("#241600");
        }
        this.corpseTimer -= dt;
        if (this.corpseTimer < 3.0) {
          const sink = (3.0 - Math.max(0, this.corpseTimer)) / 3.0;
          this.wobble.position.y = -0.35 - sink * 0.45;
          this.shadow.scale.setScalar(Math.max(0, 1 - sink));
        }
        return;
      }

      // Olhos amarelos malévolos brilhando e pulsando na escuridão
      const eyeIntensity = this.isAggro ? 1.0 : 0.72 + Math.sin(t * 3.5) * 0.28;
      for (const eye of this.sackEyes) {
        (eye.material as THREE.MeshBasicMaterial).color.setRGB(eyeIntensity, eyeIntensity * 0.8, 0);
      }

      // ─── ATAQUE BRUTAL COM O SACO MARROM (Golpe de longo alcance!) ──────
      if (this.attackTimer > 0) {
        this.attackTimer -= dt;
        const progress = 1 - Math.max(0, this.attackTimer) / 0.42;
        const swing = Math.sin(progress * Math.PI); // Arco suave do golpe

        this.displayRot = lerpAngle(this.displayRot, this.rot, damp(18, dt));
        this.yaw.rotation.y = this.displayRot;

        // Avanço frontal do corpo com giro de tronco
        this.wobble.position.z = swing * 0.58;
        this.wobble.position.y = swing * 0.12;
        this.wobble.rotation.y = (progress < 0.3 ? -0.35 : progress < 0.7 ? 0.65 : 0) * swing;
        this.wobble.rotation.x = 0.22 + swing * 0.35;

        // Braço direito arremessa o grande saco marrom num arco amplo frontal
        if (this.sackArmR) {
          this.sackArmR.rotation.x = -0.35 + (progress < 0.3 ? -0.8 : 1.8) * swing;
          this.sackArmR.rotation.y = -swing * 0.9;
        }

        // O saco marrom se projeta violentamente à frente varrendo o ar!
        if (this.sackBag) {
          const bagForward = swing * 1.15;
          const bagSwingY = -swing * 0.35;
          const bagSwingX = -swing * 0.45;
          this.sackBag.position.set(0.34 + bagSwingX, 1.18 + bagSwingY, -0.15 + bagForward);
          this.sackBag.rotation.set(-swing * 0.85, swing * 0.95, swing * 1.35);
        }

        // Braço esquerdo se abre em contra-balanço com dedos em garra
        if (this.sackArmL) {
          this.sackArmL.rotation.x = -swing * 0.75;
          this.sackArmL.rotation.z = -0.45 * swing;
        }
        return;
      }

      const vx = (this.x - this.prevX) / dt;
      const vz = (this.z - this.prevZ) / dt;
      this.prevX = this.x;
      this.prevZ = this.z;
      const speed = Math.hypot(vx, vz);
      const moving = speed > 0.08;

      this.displayRot = lerpAngle(this.displayRot, this.rot, damp(12, dt));
      this.yaw.rotation.y = this.displayRot;

      if (moving) {
        // Passada ágil, larga e rústica de andarilho
        const cadence = this.isAggro ? 7.2 : 4.6;
        this.walkPhase += dt * cadence;

        const step = Math.sin(this.walkPhase);
        const bob = Math.abs(step);
        this.wobble.position.y = bob * 0.08;
        this.wobble.rotation.z = step * 0.04;
        this.wobble.rotation.x = 0.22 + Math.cos(this.walkPhase * 2) * 0.03;

        // O grande saco marrom balança nas costas com inércia física
        if (this.sackBag) {
          this.sackBag.position.set(0.34, 1.18 + bob * 0.05, -0.15);
          this.sackBag.rotation.z = step * 0.16;
          this.sackBag.rotation.x = Math.cos(this.walkPhase) * 0.12;
        }

        // Braço esquerdo balança tentando agarrar
        if (this.sackArmL) {
          this.sackArmL.rotation.x = -step * 0.50;
          this.sackArmL.rotation.z = 0.10;
        }

        // Braço direito compensa o balanço do saco
        if (this.sackArmR) {
          this.sackArmR.rotation.x = -0.35 + step * 0.12;
          this.sackArmR.rotation.z = -0.05;
        }

        // Pernas dão passadas firmes
        if (this.sackLegL) {
          this.sackLegL.rotation.x = -step * 0.65;
        }
        if (this.sackLegR) {
          this.sackLegR.rotation.x = step * 0.65;
        }
      } else {
        // Respiração ofegante no idle
        this.wobble.position.y = Math.sin(t * 1.8) * 0.025;
        this.wobble.rotation.x = 0.22 + Math.sin(t * 1.8) * 0.02;
        this.wobble.rotation.z = 0;

        if (this.sackBag) {
          this.sackBag.position.set(0.34, 1.18 + Math.sin(t * 1.8) * 0.025, -0.15);
          this.sackBag.rotation.set(0, 0, Math.sin(t * 1.2) * 0.04);
        }
        if (this.sackArmL) {
          this.sackArmL.rotation.x = Math.sin(t * 2.0) * 0.05;
          this.sackArmL.rotation.z = 0.08;
        }
        if (this.sackArmR) {
          this.sackArmR.rotation.x = -0.35 + Math.sin(t * 1.8) * 0.03;
        }
        if (this.sackLegL) this.sackLegL.rotation.x = 0;
        if (this.sackLegR) this.sackLegR.rotation.x = 0;
      }
      return;
    }

    // ─── Estado: MORTO (Queda e decomposição após 10 segundos) ──────────
    if (this.currentState === "dead") {
      this.hpBar.visible = false;
      this.eyeMat.color.set("#151a14"); // Apaga os olhos
      if (this.volatileCore) (this.volatileCore.material as THREE.MeshBasicMaterial).color.set("#331100");
      if (this.toxicGland) (this.toxicGland.material as THREE.MeshBasicMaterial).color.set("#152b12");

      if (isCrawler) {
        // Rastejador tomba e permanece colado ao solo
        this.deathProgress = Math.min(1, this.deathProgress + dt * 4.5);
        this.wobble.position.y = lerp(0.32, 0.1, this.deathProgress);
        this.wobble.rotation.x = Math.PI / 2.3 + (Math.PI / 4) * this.deathProgress;
        this.handL.position.y = 0.04;
        this.handR.position.y = 0.04;
        this.corpseTimer -= dt;
        if (this.corpseTimer < 2.5) {
          const sink = (2.5 - Math.max(0, this.corpseTimer)) / 2.5;
          this.wobble.position.y = 0.1 - sink * 0.35;
          this.shadow.scale.setScalar(Math.max(0, 1 - sink));
        }
        return;
      }

      // Animação de queda suave para trás (zumbis bípedes)
      this.deathProgress = Math.min(1, this.deathProgress + dt * 4.5);
      const fall = this.deathProgress;

      // Inclina o feijão para trás até deitar no chão
      this.wobble.rotation.x = -Math.PI / 2 * fall;
      this.wobble.position.y = lerp(0, 0.28, fall);

      // Braços caem relaxados para os lados
      this.handL.position.set(-0.35, 0.15, 0.1);
      this.handR.position.set(0.35, 0.15, 0.1);
      this.handL.rotation.z = 0.4 * fall;
      this.handR.rotation.z = -0.4 * fall;

      // Nos últimos 2.5 segundos do tempo de 10s, o corpo afunda levemente no chão
      this.corpseTimer -= dt;
      if (this.corpseTimer < 2.5) {
        const sink = (2.5 - Math.max(0, this.corpseTimer)) / 2.5;
        this.wobble.position.y = 0.28 - sink * 0.45;
        this.shadow.scale.setScalar(Math.max(0, 1 - sink));
      }
      return;
    }

    // ─── Animação de Ataque / Bote / Cuspe ──────────────────────────────
    if (this.attackTimer > 0) {
      this.attackTimer -= dt;
      const progress = 1 - Math.max(0, this.attackTimer) / 0.32;
      const strike = Math.sin(progress * Math.PI); // pico suave no meio do golpe

      this.displayRot = lerpAngle(this.displayRot, this.rot, damp(18, dt));
      this.yaw.rotation.y = this.displayRot;

      if (isCrawler) {
        // Rastejador ergue o torso e dá o bote frontal de cuspe
        this.wobble.position.z = strike * 0.38;
        this.wobble.position.y = strike * 0.18;
        this.wobble.rotation.x = Math.PI / 2.3 - strike * 0.42;
        this.handL.position.z = 0.38 + strike * 0.28;
        this.handR.position.z = 0.38 + strike * 0.28;
        return;
      }

      if (this.type === "mortar" && this.mortarCannon) {
        // Zumbi Morteiro: recuo do canhão de morteiro ao disparar para cima
        this.wobble.rotation.x = -strike * 0.22;
        this.wobble.position.z = -strike * 0.15;
        this.mortarCannon.position.z = -0.12 - strike * 0.18;
        this.handL.position.z = 0.45;
        this.handR.position.z = 0.45 - strike * 0.14;
        return;
      }

      // Avanço rápido para frente com recuo
      this.wobble.position.z = strike * 0.45;
      this.wobble.position.y = strike * 0.12;
      this.wobble.rotation.x = 0.2 + strike * 0.42; // Inclina para morder

      // Garras dão o bote para frente
      this.handL.position.z = 0.45 + strike * 0.4;
      this.handR.position.z = 0.45 + strike * 0.4;
      this.handL.rotation.x = -strike * 0.6;
      this.handR.rotation.x = -strike * 0.6;
      this.handL.position.x = -0.32 + strike * 0.1;
      this.handR.position.x = 0.32 - strike * 0.1;
      return;
    }

    // ─── Estado: VIVO (Passo manco, Corrida frenética ou Rastejamento viscoso) ─
    const vx = (this.x - this.prevX) / dt;
    const vz = (this.z - this.prevZ) / dt;
    this.prevX = this.x;
    this.prevZ = this.z;
    const speed = Math.hypot(vx, vz);
    const moving = speed > 0.08;

    this.displayRot = lerpAngle(this.displayRot, this.rot, damp(12, dt));
    this.yaw.rotation.y = this.displayRot;
    this.wobble.position.z = 0;
    this.handL.position.x = isCrawler ? -0.38 : -0.32;
    this.handR.position.x = isCrawler ? 0.38 : 0.32;
    this.handL.rotation.x = 0;
    this.handR.rotation.x = 0;

    const isRunner = this.type === "runner";

    if (moving) {
      if (isCrawler) {
        // Animação de rastejamento: serpenteia com os braços cavando e puxando o chão
        this.walkPhase += dt * (this.isAggro ? 4.2 : 2.5);
        const crawl = Math.sin(this.walkPhase);
        const wiggle = Math.cos(this.walkPhase);

        this.wobble.position.y = Math.abs(crawl) * 0.05;
        this.wobble.rotation.y = wiggle * 0.18; // Serpenteando
        this.wobble.rotation.z = wiggle * 0.12;

        this.handL.position.z = 0.38 + crawl * 0.22;
        this.handR.position.z = 0.38 - crawl * 0.22;
        this.handL.position.y = 0.14 + Math.max(0, -wiggle) * 0.08;
        this.handR.position.y = 0.14 + Math.max(0, wiggle) * 0.08;
      } else {
        // Cadência mais rápida quando agressivo em perseguição; passo mais calmo quando patrulhando
        const chaseCadence = isRunner ? 8.5 : (this.type === "boss" ? 2.2 : this.type === "tank" ? 3.4 : 4.5);
        const wanderCadence = isRunner ? 4.2 : (this.type === "boss" ? 1.4 : this.type === "tank" ? 2.0 : 2.6);
        const cadence = this.isAggro ? chaseCadence : wanderCadence;

        this.walkPhase += dt * cadence;
        const step = Math.sin(this.walkPhase);
        const limp = Math.sin(this.walkPhase * 0.5);

        if (isRunner && this.isAggro) {
          // Corrida frenética inclinada para frente (somente ao perseguir)
          this.wobble.position.y = Math.abs(step) * 0.18;
          this.wobble.rotation.z = step * 0.08;
          this.wobble.rotation.x = 0.32 + Math.cos(this.walkPhase) * 0.08;

          this.handL.position.z = 0.48 + Math.sin(this.walkPhase) * 0.14;
          this.handR.position.z = 0.48 - Math.sin(this.walkPhase) * 0.14;
        } else {
          // Andar arrastado e manco característico de zumbi
          this.wobble.position.y = Math.abs(step) * 0.14;
          this.wobble.rotation.z = step * 0.15 + limp * 0.1;
          this.wobble.rotation.x = 0.12 + Math.cos(this.walkPhase) * 0.05;

          // Braços balançam ameaçadoramente
          this.handL.position.z = 0.45 + Math.sin(this.walkPhase) * 0.08;
          this.handR.position.z = 0.45 - Math.sin(this.walkPhase) * 0.08;
        }
      }
    } else {
      // Idle respiração
      if (this.type === "boss") {
        // Respiração pesada e imponente do Chefe Colossal
        this.wobble.position.y = Math.sin(t * 1.5) * 0.05;
        this.wobble.rotation.x = 0.12 + Math.sin(t * 1.5) * 0.03;
        this.wobble.rotation.z = Math.sin(t * 0.8) * 0.02;
        this.handL.position.z = 0.65 + Math.sin(t * 1.5) * 0.04;
        this.handR.position.z = 0.65 - Math.sin(t * 1.5) * 0.04;

        // Pulsação bioluminescente das pústulas e bocas dos canhões
        const coreScale = 1.0 + Math.sin(t * 4.0) * 0.18;
        for (const c of this.bossCores) {
          c.scale.setScalar(coreScale);
        }
        const pustuleScale = 1.0 + Math.sin(t * 3.2) * 0.15;
        for (const p of this.bossPustules) {
          p.scale.setScalar(pustuleScale);
        }
      } else if (isCrawler) {
        this.wobble.position.y = Math.sin(t * 1.5) * 0.02;
        this.wobble.rotation.y = Math.sin(t * 0.8) * 0.06;
      } else {
        this.wobble.position.y = Math.sin(t * 1.8) * 0.03;
        this.wobble.rotation.x = (isRunner && this.isAggro) ? 0.2 : 0.08;
        this.wobble.rotation.z = Math.sin(t * 1.2) * 0.04;
      }
    }
  }

  /** Desenha a barra de vida (formato épico para o Chefe ou segmentada para os demais zumbis) */
  private drawHpBar(hp: number, maxHp: number): void {
    const isEpicBoss = this.type === "boss" || this.type === "spider_boss" || this.type === "werewolf_boss" || this.type === "sack_boss" || maxHp >= 20;
    const canvas = document.createElement("canvas");
    canvas.width = isEpicBoss ? 240 : 160;
    canvas.height = isEpicBoss ? 48 : 32;
    const ctx = canvas.getContext("2d")!;

    if (isEpicBoss) {
      // ─── BARRA DE VIDA DE CHEFE ÉPICA ──────────────────────────────────
      const isWerewolf = this.type === "werewolf_boss";
      const outerX = isWerewolf ? 12 : 4;
      const outerY = isWerewolf ? 7 : 6;
      const outerW = isWerewolf ? 216 : 232;
      const outerH = isWerewolf ? 34 : 36;
      const innerX = isWerewolf ? 16 : 8;
      const innerY = isWerewolf ? 10 : 10;
      const innerW = isWerewolf ? 208 : 224;
      const innerH = isWerewolf ? 28 : 28;

      // Fundo escuro com borda metálica
      ctx.fillStyle = "rgba(12, 6, 16, 0.88)";
      ctx.beginPath();
      ctx.roundRect(outerX, outerY, outerW, outerH, isWerewolf ? 8 : 10);
      ctx.fill();

      // Borda ameaçadora
      ctx.strokeStyle = isWerewolf
        ? "rgba(245, 158, 11, 0.85)"
        : this.type === "spider_boss"
          ? "rgba(235, 30, 80, 0.85)"
          : this.type === "sack_boss"
            ? "rgba(215, 140, 50, 0.85)"
            : "rgba(50, 185, 30, 0.85)";
      ctx.lineWidth = isWerewolf ? 2.0 : 2.5;
      ctx.beginPath();
      ctx.roundRect(outerX, outerY, outerW, outerH, isWerewolf ? 8 : 10);
      ctx.stroke();

      // Trilho interior
      ctx.fillStyle = "rgba(35, 10, 15, 0.95)";
      ctx.beginPath();
      ctx.roundRect(innerX, innerY, innerW, innerH, isWerewolf ? 6 : 8);
      ctx.fill();

      // Gradiente de vida
      const pct = Math.max(0, Math.min(1, hp / maxHp));
      if (pct > 0) {
        const barWidth = innerW * pct;
        const grad = ctx.createLinearGradient(innerX, 0, innerX + barWidth, 0);
        if (isWerewolf) {
          grad.addColorStop(0, "#451a03");
          grad.addColorStop(0.5, "#d97706");
          grad.addColorStop(1, "#f59e0b");
        } else if (this.type === "spider_boss") {
          grad.addColorStop(0, "#4a042e");
          grad.addColorStop(0.5, "#9f1239");
          grad.addColorStop(1, "#f43f5e");
        } else if (this.type === "sack_boss") {
          grad.addColorStop(0, "#2c1a0e");
          grad.addColorStop(0.5, "#6b3e1b");
          grad.addColorStop(1, "#c47a32");
        } else {
          grad.addColorStop(0, "#0c1e0a");
          grad.addColorStop(0.5, "#224c15");
          grad.addColorStop(1, "#4ade18");
        }

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(innerX, innerY, barWidth, innerH, isWerewolf ? 6 : 8);
        ctx.fill();

        // Brilho superior
        ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
        ctx.beginPath();
        ctx.roundRect(innerX + 2, innerY + 2, Math.max(0, barWidth - 4), isWerewolf ? 5 : 6, 2);
        ctx.fill();
      }

      // Texto estilizado de chefe com contorno
      ctx.fillStyle = "#ffffff";
      ctx.font = isWerewolf ? "bold 13.5px sans-serif" : "bold 15px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(0, 0, 0, 0.95)";
      ctx.shadowBlur = 4;
      const title = isWerewolf
        ? `WEREWOLF: ${hp} / ${maxHp}`
        : this.type === "spider_boss"
        ? `☠ SPIDER QUEEN: ${hp} / ${maxHp}`
        : this.type === "sack_boss"
        ? `☠ SACK MAN: ${hp} / ${maxHp}`
        : `☠ SWAMP MONSTER: ${hp} / ${maxHp}`;
      ctx.fillText(title, 120, 24);
    } else {
      // ─── BARRAS SEGMENTADAS (2 para suicida, 3 para normal, 4 para rastejador, 8 para tank) ─
      ctx.fillStyle = "rgba(10, 8, 20, 0.75)";
      ctx.beginPath();
      ctx.roundRect(4, 4, 152, 24, 8);
      ctx.fill();

      const padding = 7;
      const totalW = 160 - padding * 2;
      const gap = Math.max(2, Math.min(4, Math.floor(32 / maxHp)));
      const segW = (totalW - (maxHp - 1) * gap) / maxHp;

      for (let i = 0; i < maxHp; i++) {
        const x = padding + i * (segW + gap);
        const filled = i < hp;
        const fillColor = maxHp === 2 ? "#ff4d22" : (maxHp === 4 ? "#39ff14" : (maxHp > 3 ? "#f59e0b" : "#8cff6b"));
        ctx.fillStyle = filled ? fillColor : "rgba(255, 255, 255, 0.12)";
        ctx.beginPath();
        ctx.roundRect(x, 7, segW, 18, 4);
        ctx.fill();
      }
    }

    const mat = this.hpBar.material;
    mat.map?.dispose();
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    mat.map = tex;
    mat.needsUpdate = true;
  }

  dispose(): void {
    this.root.removeFromParent();
    this.bodyMesh.geometry.dispose();
    this.bodyMat.dispose();
    this.eyeMat.dispose();
    this.handL.geometry.dispose();
    (this.handL.material as THREE.Material).dispose();
    this.handR.geometry.dispose();
    (this.handR.material as THREE.Material).dispose();
    this.shadow.geometry.dispose();
    (this.shadow.material as THREE.MeshBasicMaterial).map?.dispose();
    (this.shadow.material as THREE.Material).dispose();
    this.hpBar.material.map?.dispose();
    this.hpBar.material.dispose();

    if (this.volatileCore) {
      this.volatileCore.geometry.dispose();
      (this.volatileCore.material as THREE.Material).dispose();
    }

    if (this.fireballCore) {
      this.fireballCore.geometry.dispose();
      (this.fireballCore.material as THREE.Material).dispose();
    }
    if (this.fireballOuter) {
      this.fireballOuter.geometry.dispose();
      (this.fireballOuter.material as THREE.Material).dispose();
    }
    if (this.shockwaveRing) {
      this.shockwaveRing.geometry.dispose();
      (this.shockwaveRing.material as THREE.Material).dispose();
    }
    for (const s of this.explosionSparks) {
      s.mesh.geometry.dispose();
      (s.mesh.material as THREE.Material).dispose();
    }

    for (const m of this.bossMeshes) {
      m.geometry.dispose();
      if (Array.isArray(m.material)) {
        m.material.forEach((mat) => mat.dispose());
      } else {
        (m.material as THREE.Material).dispose();
      }
    }
    for (const p of this.bossPustules) {
      p.geometry.dispose();
      (p.material as THREE.Material).dispose();
    }
    for (const c of this.bossCores) {
      c.geometry.dispose();
      (c.material as THREE.Material).dispose();
    }

    this.spiderGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((mat) => mat.dispose());
        } else {
          (obj.material as THREE.Material)?.dispose();
        }
      }
    });

    this.werewolfGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((mat) => mat.dispose());
        } else {
          (obj.material as THREE.Material)?.dispose();
        }
      }
    });

    this.swampGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((mat) => mat.dispose());
        } else {
          (obj.material as THREE.Material)?.dispose();
        }
      }
    });

    this.sackBossGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((mat) => mat.dispose());
        } else {
          (obj.material as THREE.Material)?.dispose();
        }
      }
    });
  }
}
