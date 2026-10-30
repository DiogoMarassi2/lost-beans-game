import * as THREE from "three";
import { createRadialTexture } from "../world/textures";

/**
 * Representação visual de coletáveis no chão da arena:
 * - Pistola ("pistol"): caixa tática com pistola preta flutuante e aura ciano.
 * - Bandagem ("bandage"): maleta de primeiros socorros branca com cruz vermelha e aura verde suave.
 * - Munição ("ammo"): caixa militar verde-oliva com cartucho dourado e aura âmbar.
 * - Muda de Planta ("plant_sprout"): broto botânico com folhas esmeralda e aura do pântano.
 * - Cabeça da Aranha ("spider_head"): crânio/cefalotórax de aranha com quelíceras pontiagudas, olhos de rubi e aura carmesim/violeta.
 * - Dente do Lobisomem ("werewolf_tooth"): canino afiado colossal com raiz manchada e aura âmbar ancestral.
 * - Saco ("sack"): fardo rústico de estopa amarrado com corda de palha e aura misteriosa de andarilho.
 */
export class AmmoBoxView {
  readonly root = new THREE.Group();
  readonly kind: string;
  private readonly crateMesh: THREE.Mesh;
  private readonly floatingIcon: THREE.Group;
  private readonly glow: THREE.Sprite;
  private baseY: number;
  private active = true;

  constructor(x: number, y: number, z: number, kind = "ammo") {
    this.kind = kind;
    this.baseY = y + 0.35;
    this.root.position.set(x, this.baseY, z);

    this.floatingIcon = new THREE.Group();
    this.floatingIcon.position.y = 0.52;

    if (kind === "pistol") {
      // ─── Base tática de arma ──────────────────────────────────────────
      const baseGeo = new THREE.BoxGeometry(0.75, 0.22, 0.5);
      const baseMat = new THREE.MeshStandardMaterial({
        color: "#1e293b",
        metalness: 0.7,
        roughness: 0.3,
      });
      this.crateMesh = new THREE.Mesh(baseGeo, baseMat);
      this.crateMesh.castShadow = true;
      this.root.add(this.crateMesh);

      // Faixa ciano brilhante
      const stripeGeo = new THREE.BoxGeometry(0.77, 0.05, 0.52);
      const stripeMat = new THREE.MeshBasicMaterial({ color: "#38bdf8" });
      this.crateMesh.add(new THREE.Mesh(stripeGeo, stripeMat));

      // Pistola 3D flutuante e giratória
      const gunMat = new THREE.MeshStandardMaterial({ color: "#0f172a", roughness: 0.3, metalness: 0.8 });
      const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.52), gunMat);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, 0.12), gunMat);
      grip.position.set(0, -0.15, -0.14);
      grip.rotation.x = 0.35;
      this.floatingIcon.add(barrel, grip);
      this.root.add(this.floatingIcon);

      // Aura ciano
      this.glow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: createRadialTexture("rgba(56, 189, 248, 0.85)", "rgba(56, 189, 248, 0)"),
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          fog: false,
        }),
      );
      this.glow.position.y = 0.45;
      this.glow.scale.set(1.9, 1.9, 1);
      this.root.add(this.glow);
    } else if (kind === "bandage") {
      // ─── Maleta de Primeiros Socorros ─────────────────────────────────
      const caseGeo = new THREE.BoxGeometry(0.6, 0.35, 0.4);
      const caseMat = new THREE.MeshStandardMaterial({
        color: "#f8fafc",
        roughness: 0.4,
        metalness: 0.1,
      });
      this.crateMesh = new THREE.Mesh(caseGeo, caseMat);
      this.crateMesh.castShadow = true;
      this.root.add(this.crateMesh);

      // Cruz vermelha na maleta
      const redMat = new THREE.MeshBasicMaterial({ color: "#ef4444" });
      const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.01), redMat);
      const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.01), redMat);
      crossH.position.set(0, 0, 0.205);
      crossV.position.set(0, 0, 0.205);
      this.crateMesh.add(crossH, crossV);

      // Rolo de bandagem flutuante
      const rollGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.25, 14);
      const rollMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.8 });
      const roll = new THREE.Mesh(rollGeo, rollMat);
      roll.rotation.x = Math.PI / 2;
      this.floatingIcon.add(roll);
      this.root.add(this.floatingIcon);

      // Aura esmeralda/verde cura
      this.glow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: createRadialTexture("rgba(52, 211, 153, 0.85)", "rgba(52, 211, 153, 0)"),
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          fog: false,
        }),
      );
      this.glow.position.y = 0.45;
      this.glow.scale.set(1.9, 1.9, 1);
      this.root.add(this.glow);
    } else if (kind === "defibrillator") {
      // ─── Desfibrilador Médico (Drop no chão) ─────────────────────────
      const caseGeo = new THREE.BoxGeometry(0.55, 0.28, 0.38);
      const caseMat = new THREE.MeshStandardMaterial({
        color: "#eab308",
        roughness: 0.35,
        metalness: 0.2,
      });
      this.crateMesh = new THREE.Mesh(caseGeo, caseMat);
      this.crateMesh.castShadow = true;
      this.root.add(this.crateMesh);

      // Faixa preta com monitor de ECG
      const monitorGeo = new THREE.BoxGeometry(0.36, 0.16, 0.385);
      const monitorMat = new THREE.MeshBasicMaterial({ color: "#0f172a" });
      const monitor = new THREE.Mesh(monitorGeo, monitorMat);
      monitor.position.set(0, 0.02, 0);
      this.crateMesh.add(monitor);

      // Pás flutuantes giratórias
      const paddleMat = new THREE.MeshStandardMaterial({ color: "#eab308", roughness: 0.4 });
      const plateMat = new THREE.MeshStandardMaterial({ color: "#f8fafc", metalness: 0.9, roughness: 0.1 });
      const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.06), paddleMat);
      const pl1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.01), plateMat);
      pl1.position.z = 0.032;
      p1.add(pl1);
      p1.position.set(-0.1, 0, 0);

      const p2 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.06), paddleMat);
      const pl2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.01), plateMat);
      pl2.position.z = 0.032;
      p2.add(pl2);
      p2.position.set(0.1, 0, 0);

      this.floatingIcon.add(p1, p2);
      this.root.add(this.floatingIcon);

      // Aura elétrica ciano vibrante
      this.glow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: createRadialTexture("rgba(34, 211, 238, 0.9)", "rgba(14, 165, 233, 0)"),
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          fog: false,
        }),
      );
      this.glow.position.y = 0.45;
      this.glow.scale.set(2.0, 2.0, 1);
      this.root.add(this.glow);
    } else if (kind === "plant_sprout") {
      // ─── Muda de Planta (Drop do Homem do Pântano) ────────────────────
      const baseGeo = new THREE.CylinderGeometry(0.38, 0.44, 0.16, 8);
      const baseMat = new THREE.MeshStandardMaterial({
        color: "#1e2d1a",
        roughness: 0.9,
        metalness: 0.05,
      });
      this.crateMesh = new THREE.Mesh(baseGeo, baseMat);
      this.crateMesh.castShadow = true;
      this.root.add(this.crateMesh);

      const mossRing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.39, 0.45, 0.03, 8),
        new THREE.MeshBasicMaterial({ color: "#15803d" }),
      );
      mossRing.position.y = 0.05;
      this.crateMesh.add(mossRing);

      // Caule curvo e verdejante
      const stemMat = new THREE.MeshStandardMaterial({
        color: "#166534",
        roughness: 0.6,
        metalness: 0.1,
      });
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.055, 0.42, 8), stemMat);
      stem.rotation.z = 0.12;
      stem.position.set(-0.02, 0.04, 0);

      // Folha 1 (esquerda)
      const leaf1Mat = new THREE.MeshStandardMaterial({
        color: "#22c55e",
        roughness: 0.4,
        emissive: "#15803d",
        emissiveIntensity: 0.3,
      });
      const leaf1 = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), leaf1Mat);
      leaf1.scale.set(1.5, 0.25, 0.8);
      leaf1.position.set(-0.11, 0.08, 0.05);
      leaf1.rotation.set(0.2, 0.4, 0.5);

      // Folha 2 (direita)
      const leaf2Mat = new THREE.MeshStandardMaterial({
        color: "#4ade80",
        roughness: 0.4,
        emissive: "#22c55e",
        emissiveIntensity: 0.3,
      });
      const leaf2 = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), leaf2Mat);
      leaf2.scale.set(1.6, 0.25, 0.9);
      leaf2.position.set(0.12, 0.14, -0.04);
      leaf2.rotation.set(-0.2, -0.4, -0.5);

      // Broto luminescente no topo
      const bud = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 10, 8),
        new THREE.MeshBasicMaterial({ color: "#86efac" }),
      );
      bud.position.set(0.02, 0.26, 0);

      this.floatingIcon.add(stem, leaf1, leaf2, bud);
      this.root.add(this.floatingIcon);

      // Aura mística do pântano
      this.glow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: createRadialTexture("rgba(74, 222, 128, 0.9)", "rgba(34, 197, 94, 0)"),
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          fog: false,
        }),
      );
      this.glow.position.y = 0.48;
      this.glow.scale.set(2.1, 2.1, 1);
      this.root.add(this.glow);
    } else if (kind === "spider_head") {
      // ─── Cabeça da Aranha (Drop da Rainha Aracnídea) ──────────────────
      const baseGeo = new THREE.CylinderGeometry(0.4, 0.46, 0.16, 6);
      const baseMat = new THREE.MeshStandardMaterial({
        color: "#16111f",
        roughness: 0.85,
        metalness: 0.2,
      });
      this.crateMesh = new THREE.Mesh(baseGeo, baseMat);
      this.crateMesh.castShadow = true;
      this.root.add(this.crateMesh);

      const runeRing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.41, 0.47, 0.03, 6),
        new THREE.MeshBasicMaterial({ color: "#7f1d1d" }),
      );
      runeRing.position.y = 0.05;
      this.crateMesh.add(runeRing);

      // Cefalotórax / crânio de quitina escura
      const headMat = new THREE.MeshStandardMaterial({
        color: "#0f0d14",
        roughness: 0.25,
        metalness: 0.4,
      });
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), headMat);
      head.scale.set(1.1, 0.9, 1.25);

      // Quelíceras / presas curvas de marfim
      const fangMat = new THREE.MeshStandardMaterial({
        color: "#f1f5f9",
        roughness: 0.2,
        metalness: 0.1,
      });
      const fangL = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.24, 6), fangMat);
      fangL.position.set(-0.1, -0.16, 0.24);
      fangL.rotation.set(0.4, 0.2, -0.15);

      const fangR = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.24, 6), fangMat);
      fangR.position.set(0.1, -0.16, 0.24);
      fangR.rotation.set(0.4, -0.2, 0.15);

      // Olhos rubi reluzentes
      const eyeMat = new THREE.MeshBasicMaterial({ color: "#ff0033" });
      const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), eyeMat);
      eyeL.position.set(-0.075, 0.04, 0.27);
      const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), eyeMat);
      eyeR.position.set(0.075, 0.04, 0.27);

      const sideEyeMat = new THREE.MeshBasicMaterial({ color: "#ff2255" });
      const eyeSL = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), sideEyeMat);
      eyeSL.position.set(-0.15, 0.01, 0.22);
      const eyeSR = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), sideEyeMat);
      eyeSR.position.set(0.15, 0.01, 0.22);

      this.floatingIcon.add(head, fangL, fangR, eyeL, eyeR, eyeSL, eyeSR);
      this.root.add(this.floatingIcon);

      // Aura violeta e carmesim
      this.glow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: createRadialTexture("rgba(168, 85, 247, 0.9)", "rgba(239, 68, 68, 0)"),
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          fog: false,
        }),
      );
      this.glow.position.y = 0.48;
      this.glow.scale.set(2.2, 2.2, 1);
      this.root.add(this.glow);
    } else if (kind === "werewolf_tooth") {
      // ─── Dente do Lobisomem (Drop do Lobisomem) ───────────────────────
      const baseGeo = new THREE.CylinderGeometry(0.38, 0.44, 0.16, 8);
      const baseMat = new THREE.MeshStandardMaterial({
        color: "#292524",
        roughness: 0.9,
        metalness: 0.1,
      });
      this.crateMesh = new THREE.Mesh(baseGeo, baseMat);
      this.crateMesh.castShadow = true;
      this.root.add(this.crateMesh);

      const goldCollar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.39, 0.45, 0.03, 8),
        new THREE.MeshBasicMaterial({ color: "#d97706" }),
      );
      goldCollar.position.y = 0.05;
      this.crateMesh.add(goldCollar);

      // Raiz do dente (base orgânica avermelhada)
      const rootMat = new THREE.MeshStandardMaterial({
        color: "#7f1d1d",
        roughness: 0.65,
        metalness: 0.05,
      });
      const rootMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.18, 8), rootMat);
      rootMesh.position.y = 0.16;

      // Corpo principal do canino em marfim
      const toothMat = new THREE.MeshStandardMaterial({
        color: "#fef3c7",
        roughness: 0.25,
        metalness: 0.15,
      });
      const toothBody = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.08, 0.26, 8), toothMat);
      toothBody.position.y = -0.04;

      // Ponta afiada e agressivamente curvada
      const tipMesh = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.28, 8), toothMat);
      tipMesh.position.set(0, -0.28, 0.04);
      tipMesh.rotation.x = 0.25;

      // Mancha de sangue seca na ponta
      const bloodTip = new THREE.Mesh(
        new THREE.ConeGeometry(0.05, 0.12, 8),
        new THREE.MeshBasicMaterial({ color: "#991b1b" }),
      );
      bloodTip.position.set(0, -0.34, 0.055);
      bloodTip.rotation.x = 0.25;

      this.floatingIcon.add(rootMesh, toothBody, tipMesh, bloodTip);
      this.root.add(this.floatingIcon);

      // Aura âmbar bestial
      this.glow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: createRadialTexture("rgba(245, 158, 11, 0.95)", "rgba(217, 119, 6, 0)"),
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          fog: false,
        }),
      );
      this.glow.position.y = 0.48;
      this.glow.scale.set(2.2, 2.2, 1);
      this.root.add(this.glow);
    } else if (kind === "sack") {
      // ─── Saco (Drop do Homem do Saco) ─────────────────────────────────
      const baseGeo = new THREE.BoxGeometry(0.65, 0.16, 0.65);
      const baseMat = new THREE.MeshStandardMaterial({
        color: "#451a03",
        roughness: 0.95,
        metalness: 0.05,
      });
      this.crateMesh = new THREE.Mesh(baseGeo, baseMat);
      this.crateMesh.castShadow = true;
      this.root.add(this.crateMesh);

      // Fardo de estopa marrom rústico
      const sackMat = new THREE.MeshStandardMaterial({
        color: "#854d0e",
        roughness: 0.85,
        metalness: 0.05,
      });
      const sackBody = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 10), sackMat);
      sackBody.scale.set(1.1, 1.25, 0.95);

      // Dobras e volumes do recheio do saco
      const bulgeMat = new THREE.MeshStandardMaterial({ color: "#78350f", roughness: 0.9 });
      const bulge1 = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), bulgeMat);
      bulge1.position.set(0.09, -0.06, 0.1);

      const bulge2 = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), bulgeMat);
      bulge2.position.set(-0.08, 0.04, -0.09);

      // Corda amarela amarrada firmemente na boca do saco
      const ropeMat = new THREE.MeshStandardMaterial({
        color: "#facc15",
        roughness: 0.7,
        metalness: 0.1,
      });
      const rope = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.035, 6, 14), ropeMat);
      rope.rotation.x = Math.PI / 2;
      rope.position.y = 0.24;

      // Friso de estopa franzido acima do nó
      const ruffledMat = new THREE.MeshStandardMaterial({ color: "#92400e", roughness: 0.9 });
      const ruffled = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.14, 8), ruffledMat);
      ruffled.rotation.x = Math.PI;
      ruffled.position.y = 0.31;

      this.floatingIcon.add(sackBody, bulge1, bulge2, rope, ruffled);
      this.root.add(this.floatingIcon);

      // Aura bronze mística
      this.glow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: createRadialTexture("rgba(217, 119, 6, 0.85)", "rgba(180, 83, 9, 0)"),
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          fog: false,
        }),
      );
      this.glow.position.y = 0.46;
      this.glow.scale.set(2.0, 2.0, 1);
      this.root.add(this.glow);
    } else if (kind === "flare" || kind === "sinalizador") {
      // ─── Sinalizador de Emergência ────────────────────────────────────
      const baseGeo = new THREE.BoxGeometry(0.65, 0.2, 0.45);
      const baseMat = new THREE.MeshStandardMaterial({
        color: "#1e1b24",
        roughness: 0.7,
        metalness: 0.3,
      });
      this.crateMesh = new THREE.Mesh(baseGeo, baseMat);
      this.crateMesh.castShadow = true;
      this.root.add(this.crateMesh);

      const stripeGeo = new THREE.BoxGeometry(0.67, 0.05, 0.47);
      const stripeMat = new THREE.MeshBasicMaterial({ color: "#ef4444" });
      this.crateMesh.add(new THREE.Mesh(stripeGeo, stripeMat));

      // Tubo do sinalizador flutuante
      const flareMat = new THREE.MeshStandardMaterial({ color: "#dc2626", roughness: 0.5, metalness: 0.3 });
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.42, 10), flareMat);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.1, 10), new THREE.MeshStandardMaterial({ color: "#ffffff" }));
      band.position.y = 0.02;

      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 10), new THREE.MeshBasicMaterial({ color: "#facc15" }));
      flame.position.y = 0.28;

      const spark = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), new THREE.MeshBasicMaterial({ color: "#ff4400" }));
      spark.position.y = 0.36;

      this.floatingIcon.add(tube, band, flame, spark);
      this.root.add(this.floatingIcon);

      // Aura vermelha radiante de emergência
      this.glow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: createRadialTexture("rgba(239, 68, 68, 0.95)", "rgba(249, 115, 22, 0)"),
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          fog: false,
        }),
      );
      this.glow.position.y = 0.48;
      this.glow.scale.set(2.2, 2.2, 1);
      this.root.add(this.glow);
    } else if (kind === "coin") {
      // ─── Moeda Dourada / Dinheiro do Apocalipse ───────────────────────
      const plateGeo = new THREE.CylinderGeometry(0.32, 0.38, 0.12, 16);
      const plateMat = new THREE.MeshStandardMaterial({
        color: "#1e293b",
        metalness: 0.6,
        roughness: 0.4,
      });
      this.crateMesh = new THREE.Mesh(plateGeo, plateMat);
      this.crateMesh.castShadow = true;
      this.root.add(this.crateMesh);

      // Moeda de ouro 3D grande e brilhante
      const coinGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.06, 24);
      const coinMat = new THREE.MeshStandardMaterial({
        color: "#f59e0b",
        metalness: 0.9,
        roughness: 0.18,
        emissive: "#d97706",
        emissiveIntensity: 0.45,
      });
      const coin = new THREE.Mesh(coinGeo, coinMat);
      coin.rotation.z = Math.PI / 2; // Em pé flutuando e girando!
      coin.castShadow = true;

      // Anel em relevo na moeda
      const ringGeo = new THREE.TorusGeometry(0.18, 0.02, 8, 24);
      const ringMat = new THREE.MeshBasicMaterial({ color: "#fef08a" });
      const ring1 = new THREE.Mesh(ringGeo, ringMat);
      ring1.position.z = 0.032;
      const ring2 = new THREE.Mesh(ringGeo, ringMat);
      ring2.position.z = -0.032;
      coin.add(ring1, ring2);

      this.floatingIcon.add(coin);
      this.root.add(this.floatingIcon);

      // Aura dourada brilhante
      this.glow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: createRadialTexture("rgba(250, 204, 21, 0.95)", "rgba(234, 179, 8, 0)"),
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          fog: false,
        }),
      );
      this.glow.position.y = 0.45;
      this.glow.scale.set(1.9, 1.9, 1);
      this.root.add(this.glow);
    } else {
      // ─── Caixa militar clássica de munição ────────────────────────────
      const crateGeo = new THREE.BoxGeometry(0.7, 0.45, 0.45);
      const crateMat = new THREE.MeshStandardMaterial({
        color: "#2d4a2d",
        roughness: 0.6,
        metalness: 0.3,
      });
      this.crateMesh = new THREE.Mesh(crateGeo, crateMat);
      this.crateMesh.castShadow = true;
      this.root.add(this.crateMesh);

      const stripeGeo = new THREE.BoxGeometry(0.72, 0.12, 0.47);
      const stripeMat = new THREE.MeshStandardMaterial({
        color: "#f59e0b",
        roughness: 0.4,
        metalness: 0.2,
      });
      const stripe = new THREE.Mesh(stripeGeo, stripeMat);
      this.crateMesh.add(stripe);

      // Cartucho dourado giratório
      const tipGeo = new THREE.ConeGeometry(0.09, 0.22, 8);
      const bodyGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.32, 8);
      const brassMat = new THREE.MeshStandardMaterial({
        color: "#f39c12",
        metalness: 0.85,
        roughness: 0.2,
        emissive: "#b9770e",
        emissiveIntensity: 0.4,
      });
      const tipMesh = new THREE.Mesh(tipGeo, brassMat);
      tipMesh.position.y = 0.26;
      const bodyMesh = new THREE.Mesh(bodyGeo, brassMat);
      this.floatingIcon.add(tipMesh, bodyMesh);
      this.root.add(this.floatingIcon);

      // Aura âmbar
      this.glow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: createRadialTexture("rgba(245, 158, 11, 0.85)", "rgba(245, 158, 11, 0)"),
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          fog: false,
        }),
      );
      this.glow.position.y = 0.4;
      this.glow.scale.set(1.8, 1.8, 1);
      this.root.add(this.glow);
    }
  }

  /** Move o item para uma nova posição (itens que reaparecem em locais aleatórios). */
  setPosition(x: number, y: number, z: number): void {
    this.baseY = y + 0.35;
    this.root.position.set(x, this.baseY, z);
  }

  sync(active: boolean): void {
    if (this.active !== active) {
      this.active = active;
      this.root.visible = active;
    }
  }

  animate(t: number): void {
    if (!this.active) return;
    this.root.position.y = this.baseY + Math.sin(t * 2.5) * 0.08;
    this.floatingIcon.rotation.y = t * 2.0;
    const pulse = 1.6 + Math.sin(t * 3.5) * 0.3;
    this.glow.scale.set(pulse, pulse, 1);
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
  }
}
