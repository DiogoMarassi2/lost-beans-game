import * as THREE from "three";

export interface GunModelResult {
  mesh: THREE.Group;
  muzzleZ: number;
}

export interface KnifeModelResult {
  mesh: THREE.Group;
}

/**
 * Construtor procedural 3D de armas de fogo para os 7 tiers de evolução:
 * Nv. 1: Pistola Básica
 * Nv. 2: Pistola Tática (compensador + silenciador)
 * Nv. 3: Desert Eagle (maciça prateada magnum)
 * Nv. 4: Mini Uzi (submetralhadora com pente estendido)
 * Nv. 5: Submetralhadora SMG (estilo MP5/Vector com pente curvo e empunhadura frontal)
 * Nv. 6: Rifle Simples (carabina militar com coronha e longo alcance)
 * Nv. 7: Rifle Tático Avançado (fuzil sci-fi com mira holográfica e supressor integrado)
 */
export function buildGunModel(level: number): GunModelResult {
  const group = new THREE.Group();
  const lvl = Math.max(1, Math.min(7, level));

  if (lvl === 1) {
    // ─── Nv. 1: Pistola Básica ──────────────────────────────────────────
    const gunMat = new THREE.MeshStandardMaterial({ color: "#26232e", roughness: 0.45, metalness: 0.55 });
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.13, 0.42), gunMat);
    barrel.position.set(0, 0, 0.06);
    barrel.castShadow = true;

    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.17, 0.09), gunMat);
    grip.position.set(0, -0.13, -0.10);
    grip.rotation.x = 0.28;

    const torch = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.05, 0.18, 10),
      new THREE.MeshStandardMaterial({ color: "#3a3644", metalness: 0.65, roughness: 0.35 })
    );
    torch.rotation.x = Math.PI / 2;
    torch.position.set(0, -0.09, 0.08);

    const lens = new THREE.Mesh(
      new THREE.CircleGeometry(0.042, 12),
      new THREE.MeshBasicMaterial({ color: "#fff3c4" })
    );
    lens.position.set(0, -0.09, 0.175);

    group.add(barrel, grip, torch, lens);
    return { mesh: group, muzzleZ: 0.30 };
  }

  if (lvl === 2) {
    // ─── Nv. 2: Pistola Tática (Cano estendido + compensador) ───────────
    const bodyMat = new THREE.MeshStandardMaterial({ color: "#1e293b", roughness: 0.35, metalness: 0.7 });
    const slideTopMat = new THREE.MeshStandardMaterial({ color: "#64748b", roughness: 0.25, metalness: 0.85 });
    const compMat = new THREE.MeshStandardMaterial({ color: "#0f172a", roughness: 0.4, metalness: 0.8 });

    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.13, 0.48), bodyMat);
    barrel.position.set(0, 0, 0.09);
    barrel.castShadow = true;

    const slideTop = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.04, 0.46), slideTopMat);
    slideTop.position.set(0, 0.075, 0.09);

    const compensator = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.14, 0.12), compMat);
    compensator.position.set(0, 0, 0.36);

    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.18, 0.09), compMat);
    grip.position.set(0, -0.13, -0.10);
    grip.rotation.x = 0.28;

    const laserUnit = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.06, 0.20),
      new THREE.MeshStandardMaterial({ color: "#0f172a", roughness: 0.5 })
    );
    laserUnit.position.set(0, -0.09, 0.12);

    const laserDot = new THREE.Mesh(
      new THREE.SphereGeometry(0.015, 6, 6),
      new THREE.MeshBasicMaterial({ color: "#00ffcc" })
    );
    laserDot.position.set(0, -0.09, 0.225);

    group.add(barrel, slideTop, compensator, grip, laserUnit, laserDot);
    return { mesh: group, muzzleZ: 0.44 };
  }

  if (lvl === 3) {
    // ─── Nv. 3: Desert Eagle (.50 AE Chrome) ────────────────────────────
    const chromeMat = new THREE.MeshStandardMaterial({
      color: "#e2e8f0",
      roughness: 0.15,
      metalness: 0.95,
    });
    const blackMat = new THREE.MeshStandardMaterial({ color: "#090d16", roughness: 0.8 });

    // Slide maciço e alto
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.17, 0.56), chromeMat);
    slide.position.set(0, 0.02, 0.10);
    slide.castShadow = true;

    // Focinho chanfrado da Deagle
    const muzzleCap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.058, 0.08, 8), chromeMat);
    muzzleCap.rotation.x = Math.PI / 2;
    muzzleCap.position.set(0, 0.02, 0.40);

    // Empunhadura maciça preta ergonômica
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.21, 0.11), blackMat);
    grip.position.set(0, -0.14, -0.11);
    grip.rotation.x = 0.28;

    const triggerGuard = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.09, 0.14),
      chromeMat
    );
    triggerGuard.position.set(0, -0.10, 0.02);

    group.add(slide, muzzleCap, grip, triggerGuard);
    return { mesh: group, muzzleZ: 0.46 };
  }

  if (lvl === 4) {
    // ─── Nv. 4: Mini Uzi (Submetralhadora Compacta) ───────────────────────
    const bodyMat = new THREE.MeshStandardMaterial({ color: "#18181b", roughness: 0.5, metalness: 0.7 });
    const metalMat = new THREE.MeshStandardMaterial({ color: "#3f3f46", roughness: 0.3, metalness: 0.85 });

    // Receptor retangular clássico
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.48), bodyMat);
    body.position.set(0, 0.02, 0.06);
    body.castShadow = true;

    // Alavanca de manejo superior
    const cockingHandle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.08), metalMat);
    cockingHandle.position.set(0, 0.125, 0.04);

    // Pente vertical estendido saindo por baixo da empunhadura
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.26, 0.065), metalMat);
    mag.position.set(0, -0.20, -0.07);
    mag.rotation.x = 0.25;

    // Empunhadura
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.16, 0.09), bodyMat);
    grip.position.set(0, -0.11, -0.07);
    grip.rotation.x = 0.25;

    // Cano com porca ranhurada
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.16, 10), metalMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, 0.36);

    // Coronha dobrada de arame no topo
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.025, 0.40), metalMat);
    stock.position.set(0, 0.11, 0.0);

    group.add(body, cockingHandle, mag, grip, barrel, stock);
    return { mesh: group, muzzleZ: 0.46 };
  }

  if (lvl === 5) {
    // ─── Nv. 5: Submetralhadora SMG (Estilo MP5 Tática) ───────────────────
    const bodyMat = new THREE.MeshStandardMaterial({ color: "#27272a", roughness: 0.4, metalness: 0.65 });
    const darkMat = new THREE.MeshStandardMaterial({ color: "#09090b", roughness: 0.6, metalness: 0.7 });
    const steelMat = new THREE.MeshStandardMaterial({ color: "#52525b", roughness: 0.25, metalness: 0.85 });

    // Receptor principal
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.18, 0.58), bodyMat);
    receiver.position.set(0, 0.02, 0.08);
    receiver.castShadow = true;

    // Cano cilíndrico ventilado
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.22, 10), steelMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, 0.44);

    // Carregador curvo (Banana Mag)
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.09), darkMat);
    mag.position.set(0, -0.16, 0.08);
    mag.rotation.x = -0.22;

    // Empunhadura frontal vertical (Foregrip)
    const foregrip = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.14, 8), darkMat);
    foregrip.position.set(0, -0.12, 0.26);

    // Empunhadura traseira
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.08), darkMat);
    grip.position.set(0, -0.13, -0.11);
    grip.rotation.x = 0.30;

    // Trilho superior e mira traseira
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.35), steelMat);
    rail.position.set(0, 0.12, 0.05);

    group.add(receiver, barrel, mag, foregrip, grip, rail);
    return { mesh: group, muzzleZ: 0.56 };
  }

  if (lvl === 6) {
    // ─── Nv. 6: Rifle Simples (Carabina Militar M4) ───────────────────────
    const oliveMat = new THREE.MeshStandardMaterial({ color: "#2d3728", roughness: 0.5, metalness: 0.5 });
    const metalMat = new THREE.MeshStandardMaterial({ color: "#1e293b", roughness: 0.3, metalness: 0.85 });

    // Receptor central
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.44), metalMat);
    receiver.position.set(0, 0.02, 0.05);
    receiver.castShadow = true;

    // Handguard verde oliva militar
    const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.13, 0.34), oliveMat);
    handguard.position.set(0, 0.02, 0.38);

    // Cano longo de fuzil
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.035, 0.44, 10), metalMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, 0.62);

    // Quebra-chamas na ponta do cano
    const muzzleBrake = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.036, 0.08, 8), metalMat);
    muzzleBrake.rotation.x = Math.PI / 2;
    muzzleBrake.position.set(0, 0.02, 0.84);

    // Alça de mira frontal triangular
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.08, 0.04), metalMat);
    sight.position.set(0, 0.09, 0.64);

    // Carregador curvo STANAG
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.22, 0.10), metalMat);
    mag.position.set(0, -0.16, 0.10);
    mag.rotation.x = -0.18;

    // Coronha traseira completa
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.16, 0.26), oliveMat);
    stock.position.set(0, -0.01, -0.26);

    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.08), metalMat);
    grip.position.set(0, -0.12, -0.08);
    grip.rotation.x = 0.28;

    group.add(receiver, handguard, barrel, muzzleBrake, sight, mag, stock, grip);
    return { mesh: group, muzzleZ: 0.89 };
  }

  // ─── Nv. 7: Rifle Tático Avançado (Fuzil Sci-Fi com Supressor e Holográfica) ───
  const carbonMat = new THREE.MeshStandardMaterial({ color: "#090d16", roughness: 0.2, metalness: 0.9 });
  const titanMat = new THREE.MeshStandardMaterial({ color: "#1e293b", roughness: 0.15, metalness: 0.95 });
  const neonMat = new THREE.MeshBasicMaterial({ color: "#00f0ff" });
  const reticleMat = new THREE.MeshBasicMaterial({ color: "#ff0055" });

  // Corpo monolítico em fibra de carbono
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.19, 0.54), carbonMat);
  body.position.set(0, 0.03, 0.08);
  body.castShadow = true;

  // Frisos luminosos neon no chassi
  const stripeL = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.015, 0.38), neonMat);
  stripeL.position.set(0.068, 0.04, 0.08);
  const stripeR = stripeL.clone();
  stripeR.position.x = -0.068;

  // Supressor longo acústico de titânio
  const suppressor = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.44, 12), titanMat);
  suppressor.rotation.x = Math.PI / 2;
  suppressor.position.set(0, 0.03, 0.58);

  // Mira Holográfica (EOTech) com ponto vermelho
  const sightHood = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.14), carbonMat);
  sightHood.position.set(0, 0.16, 0.10);
  const redDot = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 6), reticleMat);
  redDot.position.set(0, 0.16, 0.10);

  // Angled Foregrip (AFG)
  const afg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 0.16), carbonMat);
  afg.position.set(0, -0.09, 0.28);
  afg.rotation.x = -0.35;

  // Carregador estendido de alta capacidade com janela de munição
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.25, 0.11), titanMat);
  mag.position.set(0, -0.17, 0.09);
  mag.rotation.x = -0.15;
  const magWindow = new THREE.Mesh(new THREE.BoxGeometry(0.074, 0.12, 0.02), neonMat);
  magWindow.position.set(0, -0.17, 0.09);

  // Coronha tática moderna ajustável
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.15, 0.24), carbonMat);
  stock.position.set(0, 0.02, -0.26);

  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.17, 0.08), carbonMat);
  grip.position.set(0, -0.12, -0.07);
  grip.rotation.x = 0.28;

  group.add(body, stripeL, stripeR, suppressor, sightHood, redDot, afg, mag, magWindow, stock, grip);
  return { mesh: group, muzzleZ: 0.82 };
}

/**
 * Construtor procedural 3D de facas e lâminas para os 7 tiers de evolução:
 * Nv. 1: Canivete Tático
 * Nv. 2: Faca Militar Bowie (serrilhada e maior)
 * Nv. 3: Adaga Karambit (garra curva)
 * Nv. 4: Machete Tático (lâmina larga de aço maciço)
 * Nv. 5: Katana de Sobrevivência (espada longa oriental com tsuba dourada)
 * Nv. 6: Lâmina de Plasma (lâmina de energia ciano brilhante)
 * Nv. 7: Hiper-Lâmina Apocalíptica (glaive quântico com luz rubi/dourada)
 */
export function buildKnifeModel(level: number): KnifeModelResult {
  const group = new THREE.Group();
  const lvl = Math.max(1, Math.min(7, level));

  if (lvl === 1) {
    // ─── Nv. 1: Canivete Tático Simples ─────────────────────────────────
    const bladeMat = new THREE.MeshStandardMaterial({ color: "#cbd5e1", roughness: 0.2, metalness: 0.9 });
    const hiltMat = new THREE.MeshStandardMaterial({ color: "#1e293b", roughness: 0.8 });

    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.07, 0.30), bladeMat);
    blade.position.set(0, 0, 0.15);
    blade.castShadow = true;

    const hilt = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.065, 0.16), hiltMat);
    hilt.position.set(0, 0, -0.08);

    group.add(blade, hilt);
    return { mesh: group };
  }

  if (lvl === 2) {
    // ─── Nv. 2: Faca Militar Bowie (Serrilhada) ───────────────────────────
    const bladeMat = new THREE.MeshStandardMaterial({ color: "#e2e8f0", roughness: 0.15, metalness: 0.95 });
    const steelMat = new THREE.MeshStandardMaterial({ color: "#334155", roughness: 0.5, metalness: 0.7 });
    const brassMat = new THREE.MeshStandardMaterial({ color: "#d97706", roughness: 0.3, metalness: 0.9 });

    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.09, 0.40), bladeMat);
    blade.position.set(0, 0, 0.19);
    blade.castShadow = true;

    // Dentes de serra no dorso da lâmina
    for (let i = 0; i < 4; i++) {
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.025, 4), bladeMat);
      tooth.rotation.x = Math.PI / 4;
      tooth.position.set(0, 0.05, 0.08 + i * 0.06);
      group.add(tooth);
    }

    // Guarda dupla de aço
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.035), steelMat);
    guard.position.set(0, 0, -0.01);

    // Cabo com empunhadura militar
    const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.038, 0.18, 8), steelMat);
    hilt.rotation.x = Math.PI / 2;
    hilt.position.set(0, 0, -0.11);

    // Pomo de latão
    const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), brassMat);
    pommel.position.set(0, 0, -0.21);

    group.add(blade, guard, hilt, pommel);
    return { mesh: group };
  }

  if (lvl === 3) {
    // ─── Nv. 3: Adaga Karambit (Garra Curva com Anel) ───────────────────
    const darkBladeMat = new THREE.MeshStandardMaterial({ color: "#0f172a", roughness: 0.3, metalness: 0.9 });
    const edgeMat = new THREE.MeshStandardMaterial({ color: "#f8fafc", roughness: 0.1, metalness: 0.98 });
    const gripMat = new THREE.MeshStandardMaterial({ color: "#1e293b", roughness: 0.85 });

    // Lâmina curva em 3 segmentos angulados para a frente
    const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.07, 0.16), darkBladeMat);
    b1.position.set(0, -0.02, 0.10);
    b1.rotation.x = -0.15;

    const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.065, 0.16), darkBladeMat);
    b2.position.set(0, -0.06, 0.22);
    b2.rotation.x = -0.45;

    const b3 = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.12, 4), edgeMat);
    b3.rotation.x = -Math.PI / 2 - 0.7;
    b3.position.set(0, -0.12, 0.32);

    // Cabo ergonômico
    const hilt = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.07, 0.16), gripMat);
    hilt.position.set(0, 0, -0.06);

    // Anel de retenção de dedo (anel traseiro)
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.014, 8, 16), darkBladeMat);
    ring.position.set(0, 0, -0.16);

    group.add(b1, b2, b3, hilt, ring);
    return { mesh: group };
  }

  if (lvl === 4) {
    // ─── Nv. 4: Machete Tático (Lâmina Longa de Aço Maciço) ─────────────
    const steelMat = new THREE.MeshStandardMaterial({ color: "#94a3b8", roughness: 0.25, metalness: 0.9 });
    const darkWoodMat = new THREE.MeshStandardMaterial({ color: "#2d2013", roughness: 0.7 });
    const brassMat = new THREE.MeshStandardMaterial({ color: "#f59e0b", roughness: 0.3, metalness: 0.85 });

    // Lâmina larga de facão militar
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.13, 0.54), steelMat);
    blade.position.set(0, 0.02, 0.26);
    blade.castShadow = true;

    // Ponta chanfrada agressiva
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.12, 0.10), steelMat);
    tip.position.set(0, 0.05, 0.52);
    tip.rotation.x = 0.55;

    // Cabo de combate com rebites
    const hilt = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.08, 0.18), darkWoodMat);
    hilt.position.set(0, -0.01, -0.08);

    const rivet1 = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.05, 6), brassMat);
    rivet1.rotation.z = Math.PI / 2;
    rivet1.position.set(0, -0.01, -0.05);

    const rivet2 = rivet1.clone();
    rivet2.position.z = -0.11;

    group.add(blade, tip, hilt, rivet1, rivet2);
    return { mesh: group };
  }

  if (lvl === 5) {
    // ─── Nv. 5: Katana de Sobrevivência (Espada Japonesa) ─────────────────
    const bladeMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.06, metalness: 0.98 });
    const goldMat = new THREE.MeshStandardMaterial({ color: "#eab308", roughness: 0.25, metalness: 0.9 });
    const wrapMat = new THREE.MeshStandardMaterial({ color: "#18181b", roughness: 0.9 });

    // Lâmina esbelta e curva de katana
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.06, 0.72), bladeMat);
    blade.position.set(0, 0.02, 0.36);
    blade.castShadow = true;

    const bladeTip = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.08, 4), bladeMat);
    bladeTip.rotation.x = Math.PI / 2;
    bladeTip.position.set(0, 0.02, 0.74);

    // Tsuba (Guarda circular dourada tradicional)
    const tsuba = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.02, 16), goldMat);
    tsuba.rotation.x = Math.PI / 2;
    tsuba.position.set(0, 0.02, 0.01);

    // Tsuka (Cabo longo de duas mãos)
    const tsuka = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.032, 0.24, 10), wrapMat);
    tsuka.rotation.x = Math.PI / 2;
    tsuka.position.set(0, 0.02, -0.12);

    const kashira = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.033, 0.025, 10), goldMat);
    kashira.rotation.x = Math.PI / 2;
    kashira.position.set(0, 0.02, -0.24);

    group.add(blade, bladeTip, tsuba, tsuka, kashira);
    return { mesh: group };
  }

  if (lvl === 6) {
    // ─── Nv. 6: Lâmina de Plasma (Energia Ciano Superaquecida) ───────────
    const hiltMat = new THREE.MeshStandardMaterial({ color: "#0f172a", roughness: 0.3, metalness: 0.9 });
    const plasmaMat = new THREE.MeshBasicMaterial({ color: "#00f0ff" });
    const coreMat = new THREE.MeshStandardMaterial({
      color: "#00f0ff",
      emissive: new THREE.Color("#00f0ff"),
      emissiveIntensity: 1.5,
      roughness: 0.1,
    });

    // Cabo de liga sci-fi
    const hilt = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.075, 0.18), hiltMat);
    hilt.position.set(0, 0, -0.08);

    // Emissor de plasma
    const emitter = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 0.04), hiltMat);
    emitter.position.set(0, 0, 0.02);

    // Lâmina de plasma luminosa
    const plasmaBlade = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.08, 0.52), coreMat);
    plasmaBlade.position.set(0, 0.01, 0.28);

    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 4), plasmaMat);
    tip.rotation.x = Math.PI / 2;
    tip.position.set(0, 0.01, 0.58);

    // Luz pontual ciano que ilumina a mão e o chão suavemente
    const plasmaLight = new THREE.PointLight("#00f0ff", 1.4, 2.2);
    plasmaLight.position.set(0, 0, 0.30);

    group.add(hilt, emitter, plasmaBlade, tip, plasmaLight);
    return { mesh: group };
  }

  // ─── Nv. 7: Hiper-Lâmina Apocalíptica (Glaive Quântico Ruby/Gold) ─────
  const voidMat = new THREE.MeshStandardMaterial({ color: "#050508", roughness: 0.1, metalness: 0.95 });
  const rubyMat = new THREE.MeshStandardMaterial({
    color: "#ff0055",
    emissive: new THREE.Color("#ff0055"),
    emissiveIntensity: 1.8,
    roughness: 0.05,
  });
  const goldMat = new THREE.MeshBasicMaterial({ color: "#ffd700" });

  // Haste longa de titânio
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.035, 0.28, 10), voidMat);
  shaft.rotation.x = Math.PI / 2;
  shaft.position.set(0, 0, -0.12);

  // Guarda com anéis gravitacionais
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.015, 8, 16), goldMat);
  ring.position.set(0, 0, 0.04);

  // Lâmina bidente dupla de plasma carmesim
  const mainBlade = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.11, 0.65), rubyMat);
  mainBlade.position.set(0, 0.03, 0.36);

  const subBlade = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.08, 0.40), rubyMat);
  subBlade.position.set(0, -0.04, 0.28);
  subBlade.rotation.x = -0.15;

  const point1 = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.14, 4), rubyMat);
  point1.rotation.x = Math.PI / 2;
  point1.position.set(0, 0.03, 0.74);

  // Luz radiante que ilumina o ambiente ao redor do sobrevivente
  const radiantLight = new THREE.PointLight("#ff0055", 2.2, 3.0);
  radiantLight.position.set(0, 0, 0.40);

  group.add(shaft, ring, mainBlade, subBlade, point1, radiantLight);
  return { mesh: group };
}
