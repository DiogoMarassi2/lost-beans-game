import * as THREE from "three";
import {
  HOUSE_FLOOR_Y,
  MAP_MAX_X,
  MAP_MAX_Z,
  MAP_MIN_X,
  MAP_MIN_Z,
  OBSTACLES,
  SHOP_POS,
  damp,
  lerp,
  type Obstacle,
} from "@dark-beans/shared";
import { createCrateTexture, createGroundTexture, seededRandom } from "./textures";

/**
 * Monta o cenário de progressão:
 * - Clareira inicial com a lareira à esquerda.
 * - Trilha para a direita (+X) com obstáculos.
 * - Casa abandonada com tábua inclinada (rampa para subir na varanda),
 *   varanda elevada, interior navegável, rampa de descida interna,
 *   e telhado com transparência dinâmica (fade-out estilo Project Zomboid).
 */
export class Arena {
  readonly group = new THREE.Group();

  /** Material do telhado da casa abandonada com opacidade dinâmica */
  private readonly roofMat: THREE.MeshStandardMaterial;
  /** Material do telhado da casinha inicial com opacidade dinâmica */
  private readonly cabinRoofMat: THREE.MeshStandardMaterial;
  /** Material do telhado da tenda médica C.E.D.A. com opacidade dinâmica */
  private readonly medicalTentRoofMat: THREE.MeshStandardMaterial;
  /** Material do telhado do quiosque do posto de combustível com opacidade dinâmica */
  private readonly gasStationRoofMat: THREE.MeshStandardMaterial;
  /** Material do toldo / cobertura vermelha do posto de combustível com opacidade dinâmica */
  private readonly gasStationCanopyRoofMat: THREE.MeshStandardMaterial;
  /** Material da placa do letreiro do posto de combustível com opacidade dinâmica */
  private readonly signPlaqueMat: THREE.MeshStandardMaterial;
  /** Material do telhado da oficina mecânica com opacidade dinâmica */
  private readonly workshopRoofMat: THREE.MeshStandardMaterial;
  /** Material do telhado da casa do sobrevivente do norte com opacidade dinâmica */
  private readonly settlerRoofMat: THREE.MeshStandardMaterial;
  /** Material do teto da cabine de controle da subestação com opacidade dinâmica */
  private readonly substationRoofMat: THREE.MeshStandardMaterial;
  /** Material do telhado da lanchonete Rusty Diner com opacidade dinâmica */
  private readonly dinerRoofMat: THREE.MeshStandardMaterial;
  /** Material do teto do bunker militar com opacidade dinâmica */
  private readonly bunkerRoofMat: THREE.MeshStandardMaterial;
  /** Material do telhado da cabana do caçador do sul com opacidade dinâmica */
  private readonly hunterRoofMat: THREE.MeshStandardMaterial;

  // Faíscas elétricas dinâmicas do poste caído
  private sparkLight?: THREE.PointLight;
  private sparkParticles: THREE.Mesh[] = [];
  private sparkTimer = 0;
  private sparkBurstTime = 0;

  constructor() {
    this.group.name = "Arena";
    this.buildGround();
    this.buildFence();
    for (const [i, o] of OBSTACLES.entries()) this.buildObstacle(o, i);
    this.cabinRoofMat = this.buildStartCabin();
    this.buildShop();
    this.roofMat = this.buildAbandonedHouse();
    this.buildSideBarricades();
    const northRoofs = this.buildExpandedNorthScenery();
    this.gasStationRoofMat = northRoofs.gasStationRoofMat;
    this.gasStationCanopyRoofMat = northRoofs.gasStationCanopyRoofMat;
    this.signPlaqueMat = northRoofs.signPlaqueMat;
    this.workshopRoofMat = northRoofs.workshopRoofMat;
    this.settlerRoofMat = northRoofs.settlerRoofMat;
    this.substationRoofMat = northRoofs.substationRoofMat;
    const southRoofs = this.buildExpandedSouthScenery();
    this.dinerRoofMat = southRoofs.dinerRoofMat;
    this.bunkerRoofMat = southRoofs.bunkerRoofMat;
    this.hunterRoofMat = southRoofs.hunterRoofMat;
    this.buildJunkyard();
    this.medicalTentRoofMat = this.buildMilitaryCheckpoint();
    this.buildOuterDecor();
    this.buildGrass();
    this.buildExtendedPowerGrid();
    this.buildOvergrownVegetation();
    this.buildScatteredDebrisAndTires();
  }

  /** Atualiza o fade dos telhados baseado na posição do jogador */
  update(playerX: number, playerZ: number, dt: number): void {
    // Quando o jogador está na varanda ou dentro da casa abandonada (X: 16 a 34.5, Z: -7 a 7), o telhado fica translúcido
    const insideHouse = playerX >= 16.0 && playerX <= 34.5 && Math.abs(playerZ) <= 7.2;
    const targetOpacity = insideHouse ? 0.12 : 1.0;
    this.roofMat.opacity = lerp(this.roofMat.opacity, targetOpacity, damp(8, dt));

    // Quando o jogador está dentro da casinha inicial (X: -27.5 a -21.0, Z: -3.2 a 3.2), o telhado fica translúcido
    const insideCabin = playerX >= -27.5 && playerX <= -21.0 && Math.abs(playerZ) <= 3.2;
    const targetOpacityCabin = insideCabin ? 0.12 : 1.0;
    this.cabinRoofMat.opacity = lerp(this.cabinRoofMat.opacity, targetOpacityCabin, damp(8, dt));

    // Quando o jogador está dentro da tenda médica C.E.D.A. (X: 96 a 104, Z: -12 a -4), o teto fica translúcido
    const insideTent = playerX >= 95.8 && playerX <= 104.2 && playerZ >= -12.2 && playerZ <= -3.8;
    const targetOpacityTent = insideTent ? 0.15 : 1.0;
    this.medicalTentRoofMat.opacity = lerp(this.medicalTentRoofMat.opacity, targetOpacityTent, damp(8, dt));

    // Quando o jogador entra na casa do sobrevivente do norte (X: -23.5 a -15.5, Z: 23.0 a 31.2)
    const insideSettler = playerX >= -23.5 && playerX <= -15.5 && playerZ >= 23.0 && playerZ <= 31.2;
    this.settlerRoofMat.opacity = lerp(this.settlerRoofMat.opacity, insideSettler ? 0.12 : 1.0, damp(8, dt));

    // Quando o jogador entra no quiosque do posto de combustível (X: -3.4 a 4.4, Z: 26.6 a 32.8)
    const insideGasKiosk = playerX >= -3.4 && playerX <= 4.4 && playerZ >= 26.6 && playerZ <= 32.8;
    this.gasStationRoofMat.opacity = lerp(this.gasStationRoofMat.opacity, insideGasKiosk ? 0.15 : 1.0, damp(8, dt));

    // Quando o jogador passa por baixo do toldo / cobertura vermelha das bombas (X: -4.5 a 4.5, Z: 18.0 a 26.2)
    const underCanopy = playerX >= -4.5 && playerX <= 4.5 && playerZ >= 18.0 && playerZ <= 26.2;
    this.gasStationCanopyRoofMat.opacity = lerp(this.gasStationCanopyRoofMat.opacity, underCanopy ? 0.15 : 1.0, damp(8, dt));
    this.signPlaqueMat.opacity = this.gasStationCanopyRoofMat.opacity;

    // Quando o jogador entra na oficina mecânica em ruínas (X: 23.4 a 33.6, Z: 20.4 a 31.2)
    const insideWorkshop = playerX >= 23.4 && playerX <= 33.6 && playerZ >= 20.4 && playerZ <= 31.2;
    this.workshopRoofMat.opacity = lerp(this.workshopRoofMat.opacity, insideWorkshop ? 0.15 : 1.0, damp(8, dt));

    // Quando o jogador entra na cabine de controle da subestação (X: 85.0 a 92.0, Z: 28.4 a 33.0)
    const insideSubstation = playerX >= 85.0 && playerX <= 92.0 && playerZ >= 28.4 && playerZ <= 33.0;
    this.substationRoofMat.opacity = lerp(this.substationRoofMat.opacity, insideSubstation ? 0.12 : 1.0, damp(8, dt));

    // Quando o jogador entra na cabana do caçador do sul (X: -23.5 a -15.5, Z: -31.2 a -23.0)
    const insideHunter = playerX >= -23.5 && playerX <= -15.5 && playerZ >= -31.2 && playerZ <= -23.0;
    this.hunterRoofMat.opacity = lerp(this.hunterRoofMat.opacity, insideHunter ? 0.12 : 1.0, damp(8, dt));

    // Quando o jogador entra na lanchonete Rusty Diner (X: -4.2 a 4.2, Z: -31.2 a -23.8)
    const insideDiner = playerX >= -4.2 && playerX <= 4.2 && playerZ >= -31.2 && playerZ <= -23.8;
    this.dinerRoofMat.opacity = lerp(this.dinerRoofMat.opacity, insideDiner ? 0.15 : 1.0, damp(8, dt));

    // Quando o jogador entra na casamata / bunker militar (X: 85.0 a 94.0, Z: -32.5 a -25.5)
    const insideBunker = playerX >= 85.0 && playerX <= 94.0 && playerZ >= -32.5 && playerZ <= -25.5;
    this.bunkerRoofMat.opacity = lerp(this.bunkerRoofMat.opacity, insideBunker ? 0.12 : 1.0, damp(8, dt));

    // Atualiza o arco elétrico e faíscas dinâmicas do poste caído
    this.updateSparkEffects(dt);
  }

  private buildGround(): void {
    const tex = createGroundTexture();
    tex.repeat.set(50, 20);
    // Terreno alongado que cobre todo o percurso da clareira até as casas e o checkpoint militar
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(320, 160),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.82, metalness: 0.05, color: "#d2d2d2" }),
    );
    ground.position.set(41.5, 0, 0);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.group.add(ground);

    // Rodovia de asfalto destruído que cruza o mapa
    this.buildRuinedHighway();
  }

  /** Cerca de madeira rústica que cerca o perímetro retangular do mapa */
  private buildFence(): void {
    const woodMat = new THREE.MeshStandardMaterial({ color: "#3a2a20", roughness: 0.95 });
    const rand = seededRandom(7);
    const spacing = 2.4;

    const minX = MAP_MIN_X;
    const maxX = MAP_MAX_X;
    const minZ = MAP_MIN_Z;
    const maxZ = MAP_MAX_Z;

    const postGeo = new THREE.BoxGeometry(0.2, 1.3, 0.2);
    postGeo.translate(0, 0.65, 0);

    const postGroup = new THREE.Group();

    // Segmentos: Norte (Z = maxZ), Sul (Z = minZ), Oeste (X = minX), Leste (X = maxX)
    const sides = [
      { x1: minX, z1: maxZ, x2: maxX, z2: maxZ },
      { x1: minX, z1: minZ, x2: maxX, z2: minZ },
      { x1: minX, z1: minZ, x2: minX, z2: maxZ },
      { x1: maxX, z1: minZ, x2: maxX, z2: maxZ },
    ];

    for (const side of sides) {
      const len = Math.hypot(side.x2 - side.x1, side.z2 - side.z1);
      const count = Math.ceil(len / spacing);
      const dx = (side.x2 - side.x1) / count;
      const dz = (side.z2 - side.z1) / count;
      const ang = Math.atan2(side.x2 - side.x1, side.z2 - side.z1);

      for (let i = 0; i <= count; i++) {
        const post = new THREE.Mesh(postGeo, woodMat);
        post.position.set(side.x1 + dx * i, 0, side.z1 + dz * i);
        post.rotation.set((rand() - 0.5) * 0.12, rand() * Math.PI, (rand() - 0.5) * 0.12);
        post.scale.y = 0.8 + rand() * 0.45;
        post.castShadow = true;
        postGroup.add(post);
      }

      // Trilhos horizontais
      const railGeo = new THREE.BoxGeometry(0.1, 0.1, len);
      for (const h of [0.45, 0.95]) {
        const rail = new THREE.Mesh(railGeo, woodMat);
        rail.position.set((side.x1 + side.x2) / 2, h + (rand() - 0.5) * 0.08, (side.z1 + side.z2) / 2);
        rail.rotation.y = ang;
        rail.castShadow = true;
        postGroup.add(rail);
      }
    }

    this.group.add(postGroup);
  }

  /**
   * Constrói a Casa Abandonada:
   * - Tábua de madeira inclinada para subir do chão até a varanda (X: 10 a 16).
   * - Varanda suspensa com piso de tábuas e guarda-corpo de madeira rústica (Y = 2.4).
   * - Entrada aberta na parede da varanda levando ao segundo piso da casa.
   * - Interior com divisórias e rampa de descida interna (X: 27.5 a 33) até o térreo.
   * - Telhado de duas águas com transparência dinâmica que esmaece quando o jogador entra.
   */
  private buildAbandonedHouse(): THREE.MeshStandardMaterial {
    const houseGroup = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: "#3e2f23", roughness: 0.9 });
    const darkBeamMat = new THREE.MeshStandardMaterial({ color: "#29211a", roughness: 0.95 });
    const floorMat = new THREE.MeshStandardMaterial({ color: "#483b2d", roughness: 0.85 });
    const wallMat = new THREE.MeshStandardMaterial({ color: "#362a1f", roughness: 0.95 });
    const roofMat = new THREE.MeshStandardMaterial({
      color: "#241d27",
      roughness: 0.85,
      transparent: true,
      opacity: 1.0,
      side: THREE.DoubleSide,
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 1) TÁBUA DE MADEIRA INCLINADA (Rampa de subida: X=10 Y=0 até X=16 Y=2.4)
    // ─────────────────────────────────────────────────────────────────────────
    const plankLen = Math.hypot(6.0, HOUSE_FLOOR_Y); // ~6.46m
    const plankAngle = Math.atan2(HOUSE_FLOOR_Y, 6.0); // ~21.8 graus
    const plankWidth = 2.6;

    // Pranchão principal de madeira
    const plankGeo = new THREE.BoxGeometry(plankLen, 0.12, plankWidth);
    const plank = new THREE.Mesh(plankGeo, woodMat);
    plank.position.set(13.0, HOUSE_FLOOR_Y / 2, 0);
    plank.rotation.z = plankAngle;
    plank.castShadow = true;
    plank.receiveShadow = true;
    houseGroup.add(plank);

    // Travessas / ripas de apoio transversais (degraus antiderrapantes de madeira)
    const slatGeo = new THREE.BoxGeometry(0.14, 0.08, plankWidth - 0.1);
    const slatCount = 7;
    for (let i = 1; i <= slatCount; i++) {
      const t = i / (slatCount + 1);
      const slat = new THREE.Mesh(slatGeo, darkBeamMat);
      const sx = 10.0 + t * 6.0;
      const sy = t * HOUSE_FLOOR_Y + 0.08;
      slat.position.set(sx, sy, 0);
      slat.rotation.z = plankAngle;
      slat.castShadow = true;
      houseGroup.add(slat);
    }

    // 1.1) Saias laterais sólidas sob a tábua inclinada (fecham as laterais em Z: ±1.35 impedindo entrar sob a rampa)
    const rampSkirtMat = darkBeamMat;
    for (const zSide of [1.32, -1.32]) {
      for (let s = 0; s < 5; s++) {
        const segX = 10.7 + s * 1.1;
        const segH = ((segX - 10.0) / 6.0) * HOUSE_FLOOR_Y;
        if (segH > 0.15) {
          const skirtSeg = new THREE.Mesh(new THREE.BoxGeometry(1.15, segH, 0.14), rampSkirtMat);
          skirtSeg.position.set(segX, segH / 2, zSide);
          skirtSeg.castShadow = true;
          skirtSeg.receiveShadow = true;
          houseGroup.add(skirtSeg);
        }
      }
    }

    // Pilares de suporte sob a tábua inclinada
    const stilt1 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.3, 6), darkBeamMat);
    stilt1.position.set(13.2, 0.65, 0.95);
    stilt1.castShadow = true;
    const stilt2 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.3, 6), darkBeamMat);
    stilt2.position.set(13.2, 0.65, -0.95);
    stilt2.castShadow = true;
    houseGroup.add(stilt1, stilt2);

    // ─────────────────────────────────────────────────────────────────────────
    // 2) VARANDA ELEVADA (X: 16 a 20, Z: -5 a 5, Y = 2.4)
    // ─────────────────────────────────────────────────────────────────────────
    // Piso da varanda
    const balconyDeck = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.18, 10.4), floorMat);
    balconyDeck.position.set(17.9, HOUSE_FLOOR_Y - 0.09, 0);
    balconyDeck.castShadow = true;
    balconyDeck.receiveShadow = true;
    houseGroup.add(balconyDeck);

    // Pilares grossos de sustentação da varanda
    const pillarPositions = [
      [16.2, 4.8],
      [16.2, -4.8],
      [19.8, 4.8],
      [19.8, -4.8],
    ];
    for (const [px, pz] of pillarPositions) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, HOUSE_FLOOR_Y, 8), darkBeamMat);
      pillar.position.set(px!, HOUSE_FLOOR_Y / 2, pz!);
      pillar.castShadow = true;
      houseGroup.add(pillar);
    }

    // Guarda-corpos da varanda (cerca de proteção com vão na entrada da tábua)
    const railMat = woodMat;
    const balconyRails = [
      // Borda Norte da varanda
      { x: 17.9, y: HOUSE_FLOOR_Y + 0.5, z: 5.0, w: 4.2, h: 0.9, d: 0.12 },
      // Borda Sul da varanda
      { x: 17.9, y: HOUSE_FLOOR_Y + 0.5, z: -5.0, w: 4.2, h: 0.9, d: 0.12 },
      // Borda Oeste Norte (ao lado da tábua)
      { x: 16.0, y: HOUSE_FLOOR_Y + 0.5, z: 3.2, w: 0.12, h: 0.9, d: 3.5 },
      // Borda Oeste Sul (ao lado da tábua)
      { x: 16.0, y: HOUSE_FLOOR_Y + 0.5, z: -3.2, w: 0.12, h: 0.9, d: 3.5 },
    ];
    for (const r of balconyRails) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(r.w, r.h, r.d), railMat);
      rail.position.set(r.x, r.y, r.z);
      rail.castShadow = true;
      houseGroup.add(rail);
    }

    // 2.1) Suportes rústicos da varanda (a passagem da entrada frontal se mantém 100% livre e aberta)

    // ─────────────────────────────────────────────────────────────────────────
    // 3) ESTRUTURA DA CASA (X: 20 a 34, Z: -7 a 7)
    // ─────────────────────────────────────────────────────────────────────────
    // Paredes térreas (fundação fechada)
    const groundWalls = [
      // Parede Norte térrea
      { x: 27.0, y: 1.2, z: 7.0, w: 14.0, h: 2.4, d: 0.35 },
      // Parede Sul térrea
      { x: 27.0, y: 1.2, z: -7.0, w: 14.0, h: 2.4, d: 0.35 },
      // Parede Oeste térrea (sob a varanda)
      { x: 20.0, y: 1.2, z: 0, w: 0.35, h: 2.4, d: 14.0 },
      // Parede Leste térrea (fundo)
      { x: 34.0, y: 1.2, z: 4.2, w: 0.35, h: 2.4, d: 5.6 },
      { x: 34.0, y: 1.2, z: -4.2, w: 0.35, h: 2.4, d: 5.6 },
    ];
    for (const gw of groundWalls) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(gw.w, gw.h, gw.d), wallMat);
      wall.position.set(gw.x, gw.y, gw.z);
      wall.castShadow = true;
      wall.receiveShadow = true;
      houseGroup.add(wall);
    }

    // ─── Preenchimento maciço e sólido da fundação sob o piso térreo (preenche 100% o vão sob a casa) ───
    const foundationBlockMat = new THREE.MeshStandardMaterial({
      color: "#1c1917", // pedra de cantaria / fundação escura e sólida
      roughness: 0.9,
      metalness: 0.1,
    });
    // 1) Bloco maciço sob o salão principal e entrada (X: 19.8 a 27.5, Z: -6.9 a 6.9, altura Y: 0 a 2.38)
    const foundationMain = new THREE.Mesh(new THREE.BoxGeometry(7.6, 2.38, 13.8), foundationBlockMat);
    foundationMain.position.set(23.65, 1.19, 0);
    foundationMain.castShadow = true;
    foundationMain.receiveShadow = true;
    houseGroup.add(foundationMain);

    // 2) Bloco lateral Norte sob o piso ao lado da descida (X: 27.5 a 34.0, Z: 1.45 a 6.9)
    const foundationNorth = new THREE.Mesh(new THREE.BoxGeometry(6.4, 2.38, 5.45), foundationBlockMat);
    foundationNorth.position.set(30.7, 1.19, 4.18);
    foundationNorth.castShadow = true;
    foundationNorth.receiveShadow = true;
    houseGroup.add(foundationNorth);

    // 3) Bloco lateral Sul sob o piso ao lado da descida (X: 27.5 a 34.0, Z: -6.9 a -1.45)
    const foundationSouth = new THREE.Mesh(new THREE.BoxGeometry(6.4, 2.38, 5.45), foundationBlockMat);
    foundationSouth.position.set(30.7, 1.19, -4.18);
    foundationSouth.castShadow = true;
    foundationSouth.receiveShadow = true;
    houseGroup.add(foundationSouth);

    // ─── Piso do segundo andar com abertura / vão para a escada ───────────
    // 1) Piso do salão principal (da entrada até o início da escada: X=20 a 27.5)
    const mainUpperFloor = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.2, 14.0), floorMat);
    mainUpperFloor.position.set(23.75, HOUSE_FLOOR_Y - 0.1, 0);
    mainUpperFloor.castShadow = true;
    mainUpperFloor.receiveShadow = true;
    houseGroup.add(mainUpperFloor);

    // 2) Piso lateral Norte (ao lado esquerdo da escada: X=27.5 a 34.0, Z=1.35 a 7.0)
    const northUpperFloor = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.2, 5.65), floorMat);
    northUpperFloor.position.set(30.75, HOUSE_FLOOR_Y - 0.1, 4.175);
    northUpperFloor.castShadow = true;
    northUpperFloor.receiveShadow = true;
    houseGroup.add(northUpperFloor);

    // 3) Piso lateral Sul (ao lado direito da escada: X=27.5 a 34.0, Z=-7.0 a -1.35)
    const southUpperFloor = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.2, 5.65), floorMat);
    southUpperFloor.position.set(30.75, HOUSE_FLOOR_Y - 0.1, -4.175);
    southUpperFloor.castShadow = true;
    southUpperFloor.receiveShadow = true;
    houseGroup.add(southUpperFloor);

    // Moldura de madeira escura no contorno da abertura da escada
    const trimN = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.22, 0.12), darkBeamMat);
    trimN.position.set(30.75, HOUSE_FLOOR_Y - 0.08, 1.45);
    const trimS = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.22, 0.12), darkBeamMat);
    trimS.position.set(30.75, HOUSE_FLOOR_Y - 0.08, -1.45);
    const trimW = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 2.9), darkBeamMat);
    trimW.position.set(27.5, HOUSE_FLOOR_Y - 0.08, 0);
    houseGroup.add(trimN, trimS, trimW);

    // Paredes do segundo andar
    const upperWalls = [
      // Parede frontal oeste (com porta aberta no centro para a varanda)
      { x: 20.0, y: HOUSE_FLOOR_Y + 1.2, z: 4.2, w: 0.35, h: 2.4, d: 5.6 },
      { x: 20.0, y: HOUSE_FLOOR_Y + 1.2, z: -4.2, w: 0.35, h: 2.4, d: 5.6 },
      // Viga superior sobre a porta da varanda
      { x: 20.0, y: HOUSE_FLOOR_Y + 2.15, z: 0, w: 0.35, h: 0.5, d: 2.8 },
      // Paredes laterais
      { x: 27.0, y: HOUSE_FLOOR_Y + 1.2, z: 7.0, w: 14.0, h: 2.4, d: 0.35 },
      { x: 27.0, y: HOUSE_FLOOR_Y + 1.2, z: -7.0, w: 14.0, h: 2.4, d: 0.35 },
      // Parede dos fundos com saída para a rampa de descida
      { x: 34.0, y: HOUSE_FLOOR_Y + 1.2, z: 4.25, w: 0.35, h: 2.4, d: 5.5 },
      { x: 34.0, y: HOUSE_FLOOR_Y + 1.2, z: -4.25, w: 0.35, h: 2.4, d: 5.5 },
      { x: 34.0, y: HOUSE_FLOOR_Y + 2.15, z: 0, w: 0.35, h: 0.5, d: 3.0 },
    ];
    for (const uw of upperWalls) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(uw.w, uw.h, uw.d), wallMat);
      wall.position.set(uw.x, uw.y, uw.z);
      wall.castShadow = true;
      wall.receiveShadow = true;
      houseGroup.add(wall);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4) ESCADA / RAMPA DE DESCIDA INTERNA (X: 27.5 a 33.0, Y: 2.4 descendo para Y: 0)
    // ─────────────────────────────────────────────────────────────────────────
    const descentLen = Math.hypot(5.5, HOUSE_FLOOR_Y);
    const descentAngle = -Math.atan2(HOUSE_FLOOR_Y, 5.5);
    const descentPlank = new THREE.Mesh(new THREE.BoxGeometry(descentLen, 0.12, 2.7), woodMat);
    descentPlank.position.set(30.25, HOUSE_FLOOR_Y / 2, 0);
    descentPlank.rotation.z = descentAngle;
    descentPlank.castShadow = true;
    descentPlank.receiveShadow = true;
    houseGroup.add(descentPlank);

    // Degraus / ripas transversais de madeira (escada rústica antiderrapante)
    const descentSlatGeo = new THREE.BoxGeometry(0.14, 0.08, 2.6);
    const descentSlatCount = 8;
    for (let i = 1; i <= descentSlatCount; i++) {
      const t = i / (descentSlatCount + 1);
      const slat = new THREE.Mesh(descentSlatGeo, darkBeamMat);
      const sx = 27.5 + t * 5.5;
      const sy = (1 - t) * HOUSE_FLOOR_Y + 0.08;
      slat.position.set(sx, sy, 0);
      slat.rotation.z = descentAngle;
      slat.castShadow = true;
      houseGroup.add(slat);
    }

    // Guarda-corpos de proteção nas laterais da escada no piso superior
    const stairRailMat = woodMat;
    const stairPostGeo = new THREE.BoxGeometry(0.14, 0.95, 0.14);
    const stairRailBarGeo = new THREE.BoxGeometry(6.3, 0.1, 0.08);

    for (const zSide of [1.45, -1.45]) {
      // Postes verticais de apoio
      for (const px of [27.5, 30.7, 33.8]) {
        const post = new THREE.Mesh(stairPostGeo, darkBeamMat);
        post.position.set(px, HOUSE_FLOOR_Y + 0.48, zSide);
        post.castShadow = true;
        houseGroup.add(post);
      }
      // Corrimão superior e barra intermediária
      const topBar = new THREE.Mesh(stairRailBarGeo, stairRailMat);
      topBar.position.set(30.65, HOUSE_FLOOR_Y + 0.9, zSide);
      topBar.castShadow = true;
      const midBar = new THREE.Mesh(stairRailBarGeo, stairRailMat);
      midBar.position.set(30.65, HOUSE_FLOOR_Y + 0.45, zSide);
      midBar.castShadow = true;
      houseGroup.add(topBar, midBar);

      // Longarina / viga inclinada de sustentação lateral da escada
      const stringer = new THREE.Mesh(new THREE.BoxGeometry(descentLen, 0.28, 0.1), darkBeamMat);
      stringer.position.set(30.25, HOUSE_FLOOR_Y / 2 - 0.05, zSide);
      stringer.rotation.z = descentAngle;
      stringer.castShadow = true;
      houseGroup.add(stringer);
    }

    // 4.1) Saias de tábuas vedando os lados Norte e Sul sob a escada de descida até o chão
    // As laterais em Z: ±1.45 impedem passagem sob a casa, mantendo a descida 100% aberta e transitável
    for (const zSide of [1.45, -1.45]) {
      for (let s = 0; s < 6; s++) {
        const segX = 28.0 + s * 0.95;
        const segH = Math.max(0.2, ((33.5 - segX) / 6.0) * HOUSE_FLOOR_Y);
        const skirt = new THREE.Mesh(new THREE.BoxGeometry(1.0, segH, 0.15), darkBeamMat);
        skirt.position.set(segX, segH / 2, zSide);
        skirt.castShadow = true;
        skirt.receiveShadow = true;
        houseGroup.add(skirt);
      }
    }

    // Detalhes internos da casa (caixotes velhos abandonados no cômodo superior)
    const crateMat = new THREE.MeshStandardMaterial({ color: "#544232", roughness: 0.9 });
    const c1 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.0, 1.2), crateMat);
    c1.position.set(23.5, HOUSE_FLOOR_Y + 0.5, 4.8);
    c1.rotation.y = 0.3;
    const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.8, 0.9), crateMat);
    c2.position.set(24.8, HOUSE_FLOOR_Y + 0.4, -4.5);
    c2.rotation.y = -0.4;
    c1.castShadow = c2.castShadow = true;
    houseGroup.add(c1, c2);

    // ─────────────────────────────────────────────────────────────────────────
    // 5) TELHADO COM FADE-OUT DINÂMICO
    // ─────────────────────────────────────────────────────────────────────────
    const roofGroup = new THREE.Group();
    const roofSlopeLen = Math.hypot(7.6, 1.4);
    const roofSlopeAngle = Math.atan2(1.4, 7.6);

    // Água Norte do telhado
    const roofN = new THREE.Mesh(new THREE.BoxGeometry(15.2, 0.16, roofSlopeLen), roofMat);
    roofN.position.set(27.0, HOUSE_FLOOR_Y + 3.1, 3.8);
    roofN.rotation.x = -roofSlopeAngle;
    roofN.castShadow = true;
    roofGroup.add(roofN);

    // Água Sul do telhado
    const roofS = new THREE.Mesh(new THREE.BoxGeometry(15.2, 0.16, roofSlopeLen), roofMat);
    roofS.position.set(27.0, HOUSE_FLOOR_Y + 3.1, -3.8);
    roofS.rotation.x = roofSlopeAngle;
    roofS.castShadow = true;
    roofGroup.add(roofS);

    // Cumeeira central
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(15.3, 0.25, 0.4), roofMat);
    ridge.position.set(27.0, HOUSE_FLOOR_Y + 3.8, 0);
    roofGroup.add(ridge);

    houseGroup.add(roofGroup);
    this.group.add(houseGroup);

    return roofMat;
  }

  private buildObstacle(o: Obstacle, index: number): void {
    switch (o.kind) {
      case "crate":
        this.group.add(this.makeCrate(o, index));
        break;
      case "barrel":
        this.group.add(this.makeBarrel(o));
        break;
      case "tree":
        this.group.add(this.makeTree(o.x, o.z, index, 1));
        break;
      case "campfire":
        // A fogueira é um objeto animado próprio (Campfire.ts)
        break;
    }
  }

  private crateTex: THREE.Texture | null = null;

  private makeCrate(o: Obstacle, index: number): THREE.Object3D {
    this.crateTex ??= createCrateTexture();
    const side = o.r * 1.35;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(side, side, side),
      new THREE.MeshStandardMaterial({ map: this.crateTex, roughness: 0.9 }),
    );
    mesh.position.set(o.x, side / 2, o.z);
    mesh.rotation.y = index * 0.7;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  private makeBarrel(o: Obstacle): THREE.Object3D {
    const g = new THREE.Group();
    g.position.set(o.x, 0, o.z);
    const r = o.r * 0.85;
    const h = 1.3;
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r, h, 20),
      new THREE.MeshStandardMaterial({ color: "#6e2a1e", roughness: 0.55, metalness: 0.45 }),
    );
    body.position.y = h / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);

    const ringMat = new THREE.MeshStandardMaterial({ color: "#2b1a14", roughness: 0.5, metalness: 0.7 });
    for (const y of [0.25, h - 0.25]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r + 0.01, 0.035, 6, 24), ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = y;
      g.add(ring);
    }

    // Tampa com gosma tóxica brilhante
    const goo = new THREE.Mesh(
      new THREE.CircleGeometry(r * 0.85, 20),
      new THREE.MeshStandardMaterial({ color: "#5dff4a", emissive: "#3dff2a", emissiveIntensity: 1.6 }),
    );
    goo.rotation.x = -Math.PI / 2;
    goo.position.y = h + 0.005;
    g.add(goo);
    return g;
  }

  private makeTree(x: number, z: number, seed: number, scale: number, shadow = true): THREE.Object3D {
    const rand = seededRandom(seed * 97 + 13);
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rand() * Math.PI * 2;
    g.scale.setScalar(scale);

    const bark = new THREE.MeshStandardMaterial({ color: "#2b2230", roughness: 1 });
    const trunkH = 4 + rand() * 1.5;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.5, trunkH, 9), bark);
    trunk.position.y = trunkH / 2;
    trunk.rotation.z = (rand() - 0.5) * 0.12;
    trunk.castShadow = shadow;
    g.add(trunk);

    // Raízes
    for (let i = 0; i < 4; i++) {
      const root = new THREE.Mesh(new THREE.ConeGeometry(0.18, 1, 5), bark);
      const a = (i / 4) * Math.PI * 2 + rand();
      root.position.set(Math.cos(a) * 0.45, 0.12, Math.sin(a) * 0.45);
      root.rotation.set(0, -a, Math.PI / 2 - 0.25);
      root.rotation.order = "YXZ";
      root.castShadow = shadow;
      g.add(root);
    }

    // Galhos secos retorcidos
    const branches = 4 + Math.floor(rand() * 3);
    for (let i = 0; i < branches; i++) {
      const len = 1.2 + rand() * 1.4;
      const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.13, len, 6), bark);
      branch.geometry.translate(0, len / 2, 0);
      const y = trunkH * (0.45 + rand() * 0.5);
      branch.position.set(0, y, 0);
      branch.rotation.set(0, rand() * Math.PI * 2, 0.6 + rand() * 0.7, "YXZ");
      branch.castShadow = shadow;
      g.add(branch);

      const sub = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.06, len * 0.55, 5), bark);
      sub.geometry.translate(0, (len * 0.55) / 2, 0);
      sub.position.set(0, len * 0.7, 0);
      sub.rotation.set(0, 0, -0.7 + rand() * 0.3);
      branch.add(sub);
    }
    return g;
  }

  /** Árvores mortas e lápides fora do percurso da cerca (sem sombras para alta performance). */
  private buildOuterDecor(): void {
    const rand = seededRandom(2024);
    for (let i = 0; i < 28; i++) {
      const a = rand() * Math.PI * 2;
      const r = MAP_MAX_Z + 6 + rand() * 25;
      const x = 20 + Math.cos(a) * (r + 15);
      const z = Math.sin(a) * r;
      this.group.add(this.makeTree(x, z, 100 + i, 0.9 + rand() * 0.8, false));
    }

    const stoneMat = new THREE.MeshStandardMaterial({ color: "#4a4858", roughness: 0.95 });
    const crossGeo = new THREE.BoxGeometry(0.15, 1.1, 0.15);
    const armGeo = new THREE.BoxGeometry(0.6, 0.14, 0.14);
    const slabGeo = new THREE.BoxGeometry(0.7, 1, 0.18);
    for (let i = 0; i < 40; i++) {
      const x = -30 + rand() * 145;
      const z = (rand() > 0.5 ? 1 : -1) * (MAP_MAX_Z + 2 + rand() * 10);
      const grave = new THREE.Group();
      grave.position.set(x, 0, z);
      grave.rotation.set((rand() - 0.5) * 0.25, rand() * Math.PI, (rand() - 0.5) * 0.25);
      if (rand() > 0.5) {
        const slab = new THREE.Mesh(slabGeo, stoneMat);
        slab.position.y = 0.45;
        grave.add(slab);
      } else {
        const post = new THREE.Mesh(crossGeo, stoneMat);
        post.position.y = 0.5;
        const arm = new THREE.Mesh(armGeo, stoneMat);
        arm.position.y = 0.7;
        grave.add(post, arm);
      }
      this.group.add(grave);
    }
  }

  /** Tufos de grama seca instanciados (um único draw call leve). */
  private buildGrass(): void {
    const rand = seededRandom(99);
    const count = 380;
    const geo = new THREE.ConeGeometry(0.06, 0.45, 3);
    geo.translate(0, 0.22, 0);
    const mat = new THREE.MeshStandardMaterial({ color: "#3d4a2c", roughness: 1 });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const color = new THREE.Color();
    let n = 0;
    while (n < count) {
      const x = MAP_MIN_X - 5 + rand() * (MAP_MAX_X - MAP_MIN_X + 15);
      const z = MAP_MIN_Z - 5 + rand() * (MAP_MAX_Z - MAP_MIN_Z + 10);
      // Evita grama dentro da casa e da tenda médica
      if (x >= 15 && x <= 35 && Math.abs(z) <= 7.5) continue;
      if (x >= 95.8 && x <= 104.2 && z >= -12.2 && z <= -3.8) continue;
      p.set(x, 0, z);
      e.set((rand() - 0.5) * 0.6, rand() * Math.PI, (rand() - 0.5) * 0.6);
      q.setFromEuler(e);
      const k = 0.6 + rand() * 0.9;
      s.set(k, k * (0.7 + rand() * 0.8), k);
      m.compose(p, q, s);
      mesh.setMatrixAt(n, m);
      color.setHSL(0.2 + rand() * 0.08, 0.25, 0.14 + rand() * 0.1);
      mesh.setColorAt(n, color);
      n++;
    }
    mesh.receiveShadow = true;
    this.group.add(mesh);
  }

  /**
   * Constrói o Ferro Velho ("car graveyard") a leste da casa (X: 37 a 69):
   * - Sedans enferrujados, pickups com sucata na caçamba, vans de entrega abandonadas.
   * - Carros empilhados e carro capotado/tombado de lado com chassi exposto.
   * - Pilhas de pneus velhos, tambores de óleo enferrujados e cercas de chapa de ferro.
   * - Vielas estreitas e caminhos táticos entre as carcaças para despistar zumbis.
   */
  private buildJunkyard(): void {
    const junkGroup = new THREE.Group();
    junkGroup.name = "Junkyard";

    // Materiais reutilizáveis do ferro velho
    const rustMetalMat = new THREE.MeshStandardMaterial({ color: "#3a2c22", roughness: 0.9, metalness: 0.65 });
    const darkChassisMat = new THREE.MeshStandardMaterial({ color: "#1c1714", roughness: 0.95 });
    const tireMat = new THREE.MeshStandardMaterial({ color: "#151515", roughness: 0.95 });
    const rimMat = new THREE.MeshStandardMaterial({ color: "#3d3228", roughness: 0.8, metalness: 0.6 });
    const glassMat = new THREE.MeshStandardMaterial({
      color: "#182026",
      roughness: 0.2,
      metalness: 0.8,
    });
    const headlightMat = new THREE.MeshStandardMaterial({ color: "#ded1a2", roughness: 0.4, emissive: "#403a22", emissiveIntensity: 0.2 });
    const taillightMat = new THREE.MeshStandardMaterial({ color: "#541616", roughness: 0.5 });
    const oilMat = new THREE.MeshBasicMaterial({ color: "#0d0b09", transparent: true, opacity: 0.65, depthWrite: false });

    // Manchas de óleo / graxa no chão sob as carcaças
    const oilPatchGeo = new THREE.CircleGeometry(2.2, 16);
    oilPatchGeo.rotateX(-Math.PI / 2);
    const oilPositions = [
      [39.5, -5.0, 1.8],
      [47.5, -1.0, 2.5],
      [52.5, -6.5, 2.0],
      [60.5, 5.0, 2.4],
      [66.0, 0.5, 2.8],
    ];
    for (const [ox, oz, scale] of oilPositions) {
      const oil = new THREE.Mesh(oilPatchGeo, oilMat);
      oil.position.set(ox!, 0.015, oz!);
      oil.scale.set(scale!, 1, scale! * 0.85);
      junkGroup.add(oil);
    }

    // Helper: Sedan abandonado
    const makeSedan = (x: number, z: number, rotY: number, paintColor: string, isWrecked = false) => {
      const car = new THREE.Group();
      car.position.set(x, 0, z);
      car.rotation.y = rotY;

      const paintMat = new THREE.MeshStandardMaterial({ color: paintColor, roughness: 0.72, metalness: 0.38 });

      // Chassi inferior
      const chassis = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.52, 1.95), paintMat);
      chassis.position.y = 0.55;
      chassis.castShadow = true;
      chassis.receiveShadow = true;
      car.add(chassis);

      // Cabine
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.62, 1.65), paintMat);
      cabin.position.set(-0.15, 1.12, 0);
      cabin.castShadow = true;
      car.add(cabin);

      // Para-brisa dianteiro inclinado
      const frontGlass = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 1.55), glassMat);
      frontGlass.position.set(0.9, 1.05, 0);
      frontGlass.rotation.z = -0.48;
      car.add(frontGlass);

      // Vidro traseiro inclinado
      const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 1.55), glassMat);
      rearGlass.position.set(-1.2, 1.05, 0);
      rearGlass.rotation.z = 0.48;
      car.add(rearGlass);

      // Teto
      const roof = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.06, 1.6), paintMat);
      roof.position.set(-0.15, 1.45, 0);
      car.add(roof);

      // Para-choques
      const fBump = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.24, 2.05), rustMetalMat);
      fBump.position.set(2.15, 0.38, 0);
      const rBump = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.24, 2.05), rustMetalMat);
      rBump.position.set(-2.15, 0.38, 0);
      fBump.castShadow = rBump.castShadow = true;
      car.add(fBump, rBump);

      // Faróis e lanternas
      const hlLeft = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.15, 0.32), headlightMat);
      hlLeft.position.set(2.12, 0.65, 0.68);
      const hlRight = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.15, 0.32), rustMetalMat);
      hlRight.position.set(2.12, 0.65, -0.68);
      const tlLeft = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.15, 0.3), taillightMat);
      tlLeft.position.set(-2.12, 0.65, 0.68);
      const tlRight = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.15, 0.3), taillightMat);
      tlRight.position.set(-2.12, 0.65, -0.68);
      car.add(hlLeft, hlRight, tlLeft, tlRight);

      // Rodas
      const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.24, 12);
      wheelGeo.rotateZ(Math.PI / 2);
      const wheelHubGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.25, 8);
      wheelHubGeo.rotateZ(Math.PI / 2);

      const wheelCoords = [
        [1.25, 0.95],
        [1.25, -0.95],
        [-1.25, 0.95],
        [-1.25, -0.95],
      ];
      wheelCoords.forEach(([wx, wz], idx) => {
        if (isWrecked && idx === 1) return;
        const wGroup = new THREE.Group();
        wGroup.position.set(wx!, 0.38, wz!);
        const tire = new THREE.Mesh(wheelGeo, tireMat);
        const hub = new THREE.Mesh(wheelHubGeo, rimMat);
        tire.castShadow = true;
        wGroup.add(tire, hub);
        car.add(wGroup);
      });

      if (isWrecked) {
        car.rotation.z = 0.08;
      }

      junkGroup.add(car);
      return car;
    };

    // Helper: Caminhonete / Pickup com caçamba cheia de sucata
    const makePickup = (x: number, z: number, rotY: number, paintColor: string) => {
      const pickup = new THREE.Group();
      pickup.position.set(x, 0, z);
      pickup.rotation.y = rotY;

      const paintMat = new THREE.MeshStandardMaterial({ color: paintColor, roughness: 0.75, metalness: 0.35 });

      // Capô dianteiro robusto
      const hood = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.72, 2.05), paintMat);
      hood.position.set(1.25, 0.68, 0);
      hood.castShadow = true;
      pickup.add(hood);

      // Cabine
      const cab = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.95, 2.0), paintMat);
      cab.position.set(-0.25, 1.15, 0);
      cab.castShadow = true;
      pickup.add(cab);

      // Para-brisa dianteiro
      const glass = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.65, 1.8), glassMat);
      glass.position.set(0.6, 1.1, 0);
      glass.rotation.z = -0.42;
      pickup.add(glass);

      // Caçamba traseira
      const bedFloor = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.15, 2.0), rustMetalMat);
      bedFloor.position.set(-1.85, 0.45, 0);
      bedFloor.castShadow = true;
      const bedWallL = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.6, 0.12), paintMat);
      bedWallL.position.set(-1.85, 0.75, 0.95);
      const bedWallR = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.6, 0.12), paintMat);
      bedWallR.position.set(-1.85, 0.75, -0.95);
      const tailgate = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.6, 1.95), paintMat);
      tailgate.position.set(-2.78, 0.75, 0);
      pickup.add(bedFloor, bedWallL, bedWallR, tailgate);

      // Entulhos dentro da caçamba (pneu velho + barril caído)
      const junkTire = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.14, 6, 12), tireMat);
      junkTire.rotation.x = Math.PI / 2 + 0.2;
      junkTire.position.set(-1.5, 0.68, 0.3);
      const junkDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.8, 10), rustMetalMat);
      junkDrum.rotation.z = Math.PI / 2;
      junkDrum.position.set(-2.1, 0.72, -0.2);
      junkTire.castShadow = junkDrum.castShadow = true;
      pickup.add(junkTire, junkDrum);

      // Rodas robustas de caminhonete
      const wheelGeo = new THREE.CylinderGeometry(0.44, 0.44, 0.28, 12);
      wheelGeo.rotateZ(Math.PI / 2);
      const wheelCoords = [
        [1.3, 1.02],
        [1.3, -1.02],
        [-1.7, 1.02],
        [-1.7, -1.02],
      ];
      wheelCoords.forEach(([wx, wz]) => {
        const tire = new THREE.Mesh(wheelGeo, tireMat);
        tire.position.set(wx!, 0.44, wz!);
        tire.castShadow = true;
        pickup.add(tire);
      });

      junkGroup.add(pickup);
      return pickup;
    };

    // Helper: Van / Furgão abandonado
    const makeVan = (x: number, z: number, rotY: number, paintColor: string) => {
      const van = new THREE.Group();
      van.position.set(x, 0, z);
      van.rotation.y = rotY;

      const paintMat = new THREE.MeshStandardMaterial({ color: paintColor, roughness: 0.78, metalness: 0.32 });

      // Corpo retangular alto
      const body = new THREE.Mesh(new THREE.BoxGeometry(4.8, 1.82, 2.15), paintMat);
      body.position.set(-0.1, 1.25, 0);
      body.castShadow = true;
      body.receiveShadow = true;
      van.add(body);

      // Bico dianteiro
      const nose = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.85, 2.1), paintMat);
      nose.position.set(2.4, 0.78, 0);
      nose.castShadow = true;
      van.add(nose);

      // Para-brisa grande
      const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.72, 1.95), glassMat);
      windshield.position.set(2.28, 1.5, 0);
      van.add(windshield);

      // Linha das portas traseiras duplas
      const rearDivider = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.6, 0.08), rustMetalMat);
      rearDivider.position.set(-2.51, 1.25, 0);
      van.add(rearDivider);

      // Para-choques
      const fBump = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.3, 2.2), rustMetalMat);
      fBump.position.set(2.78, 0.42, 0);
      const rBump = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.3, 2.2), rustMetalMat);
      rBump.position.set(-2.52, 0.42, 0);
      fBump.castShadow = rBump.castShadow = true;
      van.add(fBump, rBump);

      // 4 rodas de van
      const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.26, 12);
      wheelGeo.rotateZ(Math.PI / 2);
      for (const [wx, wz] of [
        [1.6, 1.02],
        [1.6, -1.02],
        [-1.4, 1.02],
        [-1.4, -1.02],
      ]) {
        const tire = new THREE.Mesh(wheelGeo, tireMat);
        tire.position.set(wx!, 0.42, wz!);
        tire.castShadow = true;
        van.add(tire);
      }

      junkGroup.add(van);
      return van;
    };

    // Helper: Carro capotado / tombado de lado
    const makeRolledCar = (x: number, z: number, rotY: number, paintColor: string) => {
      const wreck = new THREE.Group();
      wreck.position.set(x, 0.85, z);
      wreck.rotation.set(0, rotY, 1.32);

      const paintMat = new THREE.MeshStandardMaterial({ color: paintColor, roughness: 0.8, metalness: 0.35 });

      // Carroceria
      const body = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.55, 1.95), paintMat);
      body.castShadow = true;
      wreck.add(body);

      const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.65, 1.65), paintMat);
      cabin.position.set(-0.15, 0.58, 0);
      cabin.castShadow = true;
      wreck.add(cabin);

      // Chassi inferior exposto (vigas de aço e escapamento enferrujado)
      const frameL = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.12, 0.15), darkChassisMat);
      frameL.position.set(0, -0.32, 0.55);
      const frameR = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.12, 0.15), darkChassisMat);
      frameR.position.set(0, -0.32, -0.55);
      const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.2, 8), rustMetalMat);
      exhaust.rotation.z = Math.PI / 2;
      exhaust.position.set(-0.2, -0.35, 0.2);
      const muffler = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.18, 0.35), rustMetalMat);
      muffler.position.set(-1.2, -0.35, 0.2);
      wreck.add(frameL, frameR, exhaust, muffler);

      // Rodas restantes ainda presas
      const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.24, 12);
      wheelGeo.rotateZ(Math.PI / 2);
      const w1 = new THREE.Mesh(wheelGeo, tireMat);
      w1.position.set(1.25, -0.15, 0.95);
      const w2 = new THREE.Mesh(wheelGeo, tireMat);
      w2.position.set(-1.25, -0.15, 0.95);
      wreck.add(w1, w2);

      junkGroup.add(wreck);

      // Roda solta jogada no chão ao lado do carro tombado
      const looseTire = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.14, 6, 12), tireMat);
      looseTire.rotation.x = Math.PI / 2;
      looseTire.position.set(x + 1.2, 0.14, z + 1.3);
      looseTire.castShadow = true;
      junkGroup.add(looseTire);
    };

    // Helper: Carros empilhados (pilha de sucata)
    const makeStackedCars = (x: number, z: number, rotY: number) => {
      const stack = new THREE.Group();
      stack.position.set(x, 0, z);
      stack.rotation.y = rotY;

      const lowerMat = new THREE.MeshStandardMaterial({ color: "#4d3a2d", roughness: 0.9, metalness: 0.4 });
      const upperMat = new THREE.MeshStandardMaterial({ color: "#6e3328", roughness: 0.75, metalness: 0.35 });

      // Carro de baixo (amassado, teto achatado)
      const bottomChassis = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.65, 2.05), lowerMat);
      bottomChassis.position.y = 0.35;
      bottomChassis.castShadow = true;
      stack.add(bottomChassis);

      // Carro de cima (descansando inclinado sobre o de baixo)
      const topCar = new THREE.Group();
      topCar.position.set(0.1, 0.95, -0.1);
      topCar.rotation.set(-0.12, 0.18, 0.14);

      const topBody = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.52, 1.9), upperMat);
      topBody.position.y = 0.28;
      topBody.castShadow = true;
      const topCabin = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.6, 1.6), upperMat);
      topCabin.position.set(-0.15, 0.82, 0);
      topCabin.castShadow = true;
      const topWindshield = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.52, 1.5), glassMat);
      topWindshield.position.set(0.85, 0.75, 0);
      topWindshield.rotation.z = -0.45;
      topCar.add(topBody, topCabin, topWindshield);

      // Rodas enferrujadas pendendo
      const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.24, 10);
      wheelGeo.rotateZ(Math.PI / 2);
      const tw1 = new THREE.Mesh(wheelGeo, rimMat);
      tw1.position.set(1.2, 0.18, 0.9);
      const tw2 = new THREE.Mesh(wheelGeo, rimMat);
      tw2.position.set(-1.2, 0.18, 0.9);
      topCar.add(tw1, tw2);

      stack.add(topCar);
      junkGroup.add(stack);
    };

    // Helper: Pilha de pneus velhos
    const makeTireStack = (x: number, z: number, count = 3) => {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      const tireGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.26, 12);
      for (let i = 0; i < count; i++) {
        const t = new THREE.Mesh(tireGeo, tireMat);
        t.position.set((Math.random() - 0.5) * 0.08, 0.13 + i * 0.25, (Math.random() - 0.5) * 0.08);
        t.rotation.y = Math.random() * Math.PI;
        t.castShadow = true;
        g.add(t);
      }
      junkGroup.add(g);
    };

    // Helper: Chapa de cerca de ferro velho (metal ondulado enferrujado)
    const makeScrapFence = (x: number, z: number, width: number, rotY: number) => {
      const f = new THREE.Group();
      f.position.set(x, 0, z);
      f.rotation.y = rotY;

      // Painel ondulado de lata enferrujada
      const sheet = new THREE.Mesh(new THREE.BoxGeometry(width, 1.5, 0.06), rustMetalMat);
      sheet.position.y = 0.75;
      sheet.castShadow = true;
      f.add(sheet);

      // Postes nas pontas
      const postGeo = new THREE.BoxGeometry(0.12, 1.7, 0.12);
      const p1 = new THREE.Mesh(postGeo, darkChassisMat);
      p1.position.set(-width / 2, 0.85, 0);
      const p2 = new THREE.Mesh(postGeo, darkChassisMat);
      p2.position.set(width / 2, 0.85, 0);
      f.add(p1, p2);

      junkGroup.add(f);
    };

    // Helper: Ônibus Escolar Amarelo Abandonado (transição do ferro velho para o checkpoint)
    const makeSchoolBus = (x: number, z: number, rotY: number) => {
      const bus = new THREE.Group();
      bus.position.set(x, 0, z);
      bus.rotation.y = rotY;

      const busYellow = new THREE.MeshStandardMaterial({ color: "#d9971e", roughness: 0.65, metalness: 0.25 });
      const busBlack = new THREE.MeshStandardMaterial({ color: "#181818", roughness: 0.85, metalness: 0.4 });
      const busWhite = new THREE.MeshStandardMaterial({ color: "#e0e0e0", roughness: 0.5 });
      const busGlass = new THREE.MeshStandardMaterial({ color: "#121820", roughness: 0.2, metalness: 0.85 });

      // Corpo principal do ônibus (8.2m de comprimento, 2.5m de largura, 2.3m de altura)
      const body = new THREE.Mesh(new THREE.BoxGeometry(8.2, 2.1, 2.5), busYellow);
      body.position.set(0, 1.45, 0);
      body.castShadow = body.receiveShadow = true;
      bus.add(body);

      // Teto arredondado / curvado
      const roofCap = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.25, 2.35), busWhite);
      roofCap.position.set(0, 2.55, 0);
      roofCap.castShadow = true;
      bus.add(roofCap);

      // Faixas pretas horizontais de reforço lateral (rub rails)
      for (const h of [0.75, 1.35, 1.95]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(8.24, 0.08, 2.54), busBlack);
        rail.position.set(0, h, 0);
        bus.add(rail);
      }

      // Capô dianteiro do motor (focinho do ônibus)
      const hood = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 2.2), busYellow);
      hood.position.set(4.5, 0.95, 0);
      hood.castShadow = true;
      bus.add(hood);

      // Grade do radiador frontal
      const grill = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.75, 1.6), busBlack);
      grill.position.set(5.32, 0.85, 0);
      bus.add(grill);

      // Para-choques frontal maciço
      const fBump = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.4, 2.65), busBlack);
      fBump.position.set(5.35, 0.4, 0);
      fBump.castShadow = true;
      bus.add(fBump);

      // Para-choques traseiro
      const rBump = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.4, 2.65), busBlack);
      rBump.position.set(-4.2, 0.4, 0);
      rBump.castShadow = true;
      bus.add(rBump);

      // Faróis dianteiros redondos
      const hlGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.1, 12);
      hlGeo.rotateZ(Math.PI / 2);
      const hlL = new THREE.Mesh(hlGeo, headlightMat);
      hlL.position.set(5.32, 0.95, 0.75);
      const hlR = new THREE.Mesh(hlGeo, headlightMat);
      hlR.position.set(5.32, 0.95, -0.75);
      bus.add(hlL, hlR);

      // Para-brisa frontal bipartido inclinado
      const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.85, 2.3), busGlass);
      windshield.position.set(3.72, 1.9, 0);
      windshield.rotation.z = -0.15;
      bus.add(windshield);

      // Vidro traseiro e porta de emergência
      const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.75, 1.4), busGlass);
      rearGlass.position.set(-4.12, 1.9, 0);
      bus.add(rearGlass);

      // Fileira de janelas retangulares laterais (Lado Norte e Lado Sul)
      const windowGeo = new THREE.BoxGeometry(0.7, 0.65, 0.08);
      for (let i = -3; i <= 3; i++) {
        const wx = i * 0.95 - 0.2;
        const winN = new THREE.Mesh(windowGeo, busGlass);
        winN.position.set(wx, 1.9, 1.26);
        const winS = new THREE.Mesh(windowGeo, busGlass);
        winS.position.set(wx, 1.9, -1.26);
        bus.add(winN, winS);
      }

      // Rodas
      const busWheelGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.32, 14);
      busWheelGeo.rotateZ(Math.PI / 2);

      const wheelSpots = [
        [3.0, 1.15],
        [3.0, -1.15],
        [-2.4, 1.15],
        [-2.4, -1.15],
      ];
      for (const [wx, wz] of wheelSpots) {
        const w = new THREE.Mesh(busWheelGeo, tireMat);
        w.position.set(wx!, 0.48, wz!);
        w.castShadow = true;
        bus.add(w);
      }

      // Mancha de óleo e marcas sob o ônibus
      const busOil = new THREE.Mesh(new THREE.PlaneGeometry(8.5, 3.2), oilMat);
      busOil.position.set(0, 0.015, 0);
      busOil.rotation.x = -Math.PI / 2;
      bus.add(busOil);

      // Leve inclinação lateral de pneu furado
      bus.rotation.z = 0.04;

      junkGroup.add(bus);
    };

    // ─────────────────────────────────────────────────────────────────────────
    // INSTANCIAÇÃO DOS VEÍCULOS E CENÁRIO DO FERRO VELHO (X: 37 a 74)
    // ─────────────────────────────────────────────────────────────────────────
    // 1) Veículos principais
    makeSedan(39.5, -5.0, 0.15, "#2f4858"); // Carro 1: Sedan Azul
    makePickup(41.0, 5.5, -0.2, "#3e4936"); // Carro 2: Pickup Verde Militar
    makeVan(47.5, -1.0, 0.4, "#6d6860"); // Carro 3: Van Branca atravessada
    makeSedan(48.0, 7.0, 0.05, "#662c24"); // Carro 4: Sedan Vermelho Ferrugem
    makeRolledCar(52.5, -6.5, 0.2, "#4a4a4a"); // Carro 5: Sedan Tombado de Lado
    makePickup(54.5, 2.5, -0.3, "#5a3a28"); // Carro 6: Pickup Ferrugem
    makeSedan(59.5, -3.5, 0.35, "#786832", true); // Carro 7: Sedan Amarelo Táxi (arriado)
    makeVan(60.5, 5.0, -0.1, "#444444"); // Carro 8: Van de Carga Cinza
    makeStackedCars(66.0, 0.5, 0.15); // Carros 9 & 10: Carros Empilhados
    makeSedan(65.5, -6.5, -0.4, "#38322c", true); // Carro 11: Carcaça desmanchada
    makeSchoolBus(70.0, -2.0, -0.15); // Ônibus Escolar Amarelo Abandonado

    // 2) Pilhas de pneus adicionais
    makeTireStack(37.5, 8.5, 4);
    makeTireStack(44.0, -7.5, 3);
    makeTireStack(56.0, -2.0, 3);
    makeTireStack(62.5, 8.5, 4);
    makeTireStack(68.5, -4.0, 3);
    makeTireStack(73.5, 3.5, 4);

    // 3) Cercas de sucata e chapas metálicas nas bordas
    makeScrapFence(46.0, 11.0, 5.5, 0.05);
    makeScrapFence(56.0, 11.5, 6.0, -0.05);
    makeScrapFence(44.0, -11.5, 5.0, 0.1);
    makeScrapFence(58.0, -11.5, 6.5, -0.05);

    this.group.add(junkGroup);
  }

  /**
   * Constrói as barricadas nas laterais da casa:
   * Agora orientadas longitudinalmente ao longo do eixo X (ao longo de Z ≈ 13.0 e Z ≈ -13.0),
   * deixando os becos laterais (Z de 7.2 a 12.6 e Z de -12.6 a -7.2) completamente ABERTOS e desimpedidos
   * para passagem de jogadores e zumbis sem ficarem presos, com vãos de portão para os setores norte e sul expandidos.
   */
  private buildSideBarricades(): void {
    const barricadeGroup = new THREE.Group();
    barricadeGroup.name = "SideBarricades";

    // Materiais
    const grateMat = new THREE.MeshStandardMaterial({ color: "#221d19", roughness: 0.65, metalness: 0.85 });
    const wireMat = new THREE.MeshStandardMaterial({ color: "#4f4942", roughness: 0.5, metalness: 0.8 });
    const dumpsterGreen = new THREE.MeshStandardMaterial({ color: "#2d3826", roughness: 0.75, metalness: 0.45 });
    const dumpsterBlue = new THREE.MeshStandardMaterial({ color: "#23333d", roughness: 0.75, metalness: 0.45 });
    const rustMetalMat = new THREE.MeshStandardMaterial({ color: "#3a2a1d", roughness: 0.9, metalness: 0.6 });
    const trashBagMat = new THREE.MeshStandardMaterial({ color: "#111111", roughness: 0.35, metalness: 0.1 });
    const palletMat = new THREE.MeshStandardMaterial({ color: "#453628", roughness: 0.9 });
    const tireMat = new THREE.MeshStandardMaterial({ color: "#131313", roughness: 0.95 });

    // Helper: Grade de ferro com postes, travessas e barras verticais orientada ao longo do eixo X
    const makeIronGateFenceX = (z: number, xStart: number, xEnd: number) => {
      const g = new THREE.Group();
      const xMin = Math.min(xStart, xEnd);
      const xMax = Math.max(xStart, xEnd);
      const len = xMax - xMin;
      const h = 2.8;

      // Postes principais a cada 2.2m
      const postGeo = new THREE.BoxGeometry(0.14, h, 0.14);
      const postCount = Math.ceil(len / 2.2);
      const postStep = len / postCount;
      for (let i = 0; i <= postCount; i++) {
        const post = new THREE.Mesh(postGeo, grateMat);
        post.position.set(xMin + i * postStep, h / 2, z);
        post.castShadow = true;
        g.add(post);

        // Ponta em lança no topo de cada poste
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 4), grateMat);
        tip.position.set(xMin + i * postStep, h + 0.11, z);
        tip.rotation.y = Math.PI / 4;
        g.add(tip);
      }

      // Trilhos horizontais (inferior, intermediário, superior)
      const railGeo = new THREE.BoxGeometry(len, 0.08, 0.08);
      for (const ry of [0.25, 1.4, 2.65]) {
        const rail = new THREE.Mesh(railGeo, grateMat);
        rail.position.set((xMin + xMax) / 2, ry, z);
        rail.castShadow = true;
        g.add(rail);
      }

      // Barras verticais de ferro (grades) a cada 0.22m
      const barCount = Math.floor(len / 0.22);
      const barStep = len / (barCount + 1);
      const barGeo = new THREE.BoxGeometry(0.04, 2.5, 0.04);
      for (let i = 1; i <= barCount; i++) {
        const bar = new THREE.Mesh(barGeo, grateMat);
        bar.position.set(xMin + i * barStep, 1.45, z);
        bar.castShadow = true;
        g.add(bar);
      }

      // Bobina de arame farpado / concertina no topo
      const coilCount = Math.floor(len / 0.45);
      const coilGeo = new THREE.TorusGeometry(0.24, 0.025, 6, 12);
      for (let i = 0; i <= coilCount; i++) {
        const coil = new THREE.Mesh(coilGeo, wireMat);
        coil.position.set(xMin + i * 0.45, h + 0.2, z);
        coil.rotation.x = Math.PI / 2 + 0.35;
        g.add(coil);
      }

      barricadeGroup.add(g);
    };

    // Helper: Caçamba de lixo industrial (Dumpster)
    const makeDumpster = (x: number, z: number, rotY: number, mat: THREE.Material) => {
      const d = new THREE.Group();
      d.position.set(x, 0, z);
      d.rotation.y = rotY;

      // Caixa principal da caçamba
      const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.35, 1.45), mat);
      body.position.y = 0.8;
      body.castShadow = true;
      body.receiveShadow = true;
      d.add(body);

      // Rodízios / apoios inferiores
      const wheelGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.15, 8);
      for (const [wx, wz] of [
        [1.0, 0.6],
        [-1.0, 0.6],
        [1.0, -0.6],
        [-1.0, -0.6],
      ]) {
        const w = new THREE.Mesh(wheelGeo, rustMetalMat);
        w.position.set(wx!, 0.1, wz!);
        d.add(w);
      }

      // Tampa aberta inclinada
      const lid = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.06, 1.5), rustMetalMat);
      lid.position.set(0.65, 1.62, 0);
      lid.rotation.z = 0.55;
      lid.castShadow = true;
      d.add(lid);

      // Lixo transbordando pela abertura
      const trashMound = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 1), trashBagMat);
      trashMound.scale.set(1.4, 0.7, 1.2);
      trashMound.position.set(0.4, 1.55, 0);
      trashMound.castShadow = true;
      d.add(trashMound);

      barricadeGroup.add(d);
    };

    // Helper: Pilhas de sacos de lixo plásticos
    const makeTrashBagPile = (cx: number, cz: number, count: number) => {
      const g = new THREE.Group();
      const bagGeo = new THREE.DodecahedronGeometry(0.38, 1);
      for (let i = 0; i < count; i++) {
        const bag = new THREE.Mesh(bagGeo, trashBagMat);
        const ang = (i / count) * Math.PI * 2;
        const dist = 0.35 + (i % 2) * 0.25;
        const by = 0.22 + Math.floor(i / 3) * 0.32;
        bag.position.set(cx + Math.cos(ang) * dist, by, cz + Math.sin(ang) * dist);
        bag.scale.set(0.9 + Math.sin(i) * 0.2, 0.75, 0.95 + Math.cos(i) * 0.15);
        bag.rotation.set(Math.sin(i), i * 0.8, Math.cos(i) * 0.5);
        bag.castShadow = true;
        g.add(bag);
      }
      barricadeGroup.add(g);
    };

    // Helper: Muralha de pneus empilhados ao longo do eixo X
    const makeTireWallX = (z: number, xCenter: number, lengthX: number) => {
      const g = new THREE.Group();
      const tireGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.28, 12);
      tireGeo.rotateZ(Math.PI / 2);

      const countX = Math.floor(lengthX / 0.8);
      const stepX = lengthX / countX;

      for (let i = 0; i <= countX; i++) {
        const curX = xCenter - lengthX / 2 + i * stepX;
        const hCount = 3 + (i % 2);
        for (let j = 0; j < hCount; j++) {
          const tire = new THREE.Mesh(tireGeo, tireMat);
          const jz = z + ((j % 2) - 0.5) * 0.25;
          tire.position.set(curX + Math.sin(i * 3 + j) * 0.08, 0.14 + j * 0.27, jz);
          tire.rotation.y = Math.sin(i + j) * 0.3;
          tire.castShadow = true;
          g.add(tire);
        }
      }
      barricadeGroup.add(g);
    };

    // Helper: Palete de madeira encostado
    const makePallet = (x: number, y: number, z: number, rotY: number, rotZ: number) => {
      const p = new THREE.Group();
      p.position.set(x, y, z);
      p.rotation.set(0, rotY, rotZ);

      // Estrutura do palete
      const frameGeo = new THREE.BoxGeometry(1.2, 0.1, 0.1);
      for (const fz of [-0.45, 0, 0.45]) {
        const f = new THREE.Mesh(frameGeo, palletMat);
        f.position.set(0, 0.05, fz);
        p.add(f);
      }
      // Ripas transversais
      const slatGeo = new THREE.BoxGeometry(0.12, 0.04, 1.1);
      for (let s = -0.5; s <= 0.5; s += 0.25) {
        const slat = new THREE.Mesh(slatGeo, palletMat);
        slat.position.set(s, 0.12, 0);
        slat.castShadow = true;
        p.add(slat);
      }
      barricadeGroup.add(p);
    };

    // Helper: Tambor enferrujado
    const makeDrum = (x: number, y: number, z: number, tipped = false) => {
      const drumGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.85, 12);
      const drum = new THREE.Mesh(drumGeo, rustMetalMat);
      if (tipped) {
        drum.rotation.z = Math.PI / 2;
        drum.position.set(x, y + 0.3, z);
      } else {
        drum.position.set(x, y + 0.42, z);
      }
      drum.castShadow = true;
      barricadeGroup.add(drum);
    };

    // ─────────────────────────────────────────────────────────────────────────
    // 1) BARRICADA LONGITUDINAL NORTE (ao longo de Z ≈ 13.0, com vão em X: [25.5, 28.5])
    // O beco lateral de Z: 7.2 a 12.6 fica completamente ABERTO para circulação.
    // ─────────────────────────────────────────────────────────────────────────
    makeIronGateFenceX(13.1, 17.5, 25.5);
    makeIronGateFenceX(13.1, 28.5, 36.0);
    makeDumpster(22.2, 14.3, 0.08, dumpsterGreen);
    makeDumpster(31.6, 14.2, -0.06, dumpsterBlue);
    makeTireWallX(14.2, 21.0, 4.0);
    makeTrashBagPile(19.2, 13.9, 6);
    makeTrashBagPile(24.8, 13.8, 7);
    makeTrashBagPile(34.2, 14.0, 5);
    makePallet(20.0, 0.35, 13.4, 0.1, 0.45);
    makePallet(30.2, 0.35, 13.4, -0.15, -0.35);
    makeDrum(18.5, 0, 13.7);
    makeDrum(35.2, 0, 13.7, true);

    const sheetN = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.8, 0.08), rustMetalMat);
    sheetN.position.set(35.0, 0.9, 13.1);
    sheetN.castShadow = true;
    barricadeGroup.add(sheetN);

    // ─────────────────────────────────────────────────────────────────────────
    // 2) BARRICADA LONGITUDINAL SUL (ao longo de Z ≈ -13.0, com vão em X: [25.5, 28.5])
    // O beco lateral de Z: -12.6 a -7.2 fica completamente ABERTO para circulação.
    // ─────────────────────────────────────────────────────────────────────────
    makeIronGateFenceX(-13.1, 17.5, 25.5);
    makeIronGateFenceX(-13.1, 28.5, 36.0);
    makeTireWallX(-14.2, 21.0, 4.0);
    makeDumpster(22.2, -14.3, -0.08, dumpsterBlue);
    makeDumpster(31.6, -14.2, 0.06, dumpsterGreen);
    makeTrashBagPile(19.2, -13.9, 6);
    makeTrashBagPile(24.8, -13.8, 7);
    makeTrashBagPile(34.2, -14.0, 5);
    makePallet(20.0, 0.35, -13.4, -0.1, 0.45);
    makePallet(30.2, 0.35, -13.4, 0.15, -0.35);
    makeDrum(18.5, 0, -13.7);
    makeDrum(35.2, 0, -13.7, true);

    const sheetS = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.8, 0.08), rustMetalMat);
    sheetS.position.set(35.0, 0.9, -13.1);
    sheetS.castShadow = true;
    barricadeGroup.add(sheetS);

    this.group.add(barricadeGroup);
  }

  /**
   * Constrói a Casinha Inicial de Sobrevivência à esquerda do mapa:
   * - Quarto pequeno de madeira rústica com paredes perimetrais e porta aberta.
   * - Interior detalhado:
   *   - Extintor de incêndio montado na parede com placa de emergência, manômetro e mangueira.
   *   - Mesa de trabalho de sobrevivência com rádio transmissor militar (display verde iluminado),
   *     lamparina com luz acolhedora, caneca metálica e documentos.
   *   - Cadeira rústica de madeira ao lado da mesa.
   *   - Estante metálica com caixas de ração e maleta médica de primeiros socorros.
   *   - Quadro de avisos com mapa tático e notas de sobrevivência na parede.
   *   - Caixote de suprimentos no canto.
   *   - Lâmpada industrial suspensa do teto com luz quente.
   *   - Telhado de duas águas com transparência dinâmica que esmaece quando o jogador entra.
   */
  private buildStartCabin(): THREE.MeshStandardMaterial {
    const cabinGroup = new THREE.Group();
    cabinGroup.name = "StartCabin";

    const woodWallMat = new THREE.MeshStandardMaterial({ color: "#3e2e21", roughness: 0.92 });
    const floorWoodMat = new THREE.MeshStandardMaterial({ color: "#423223", roughness: 0.85 });
    const beamMat = new THREE.MeshStandardMaterial({ color: "#241a12", roughness: 0.95 });
    const metalMat = new THREE.MeshStandardMaterial({ color: "#334155", metalness: 0.65, roughness: 0.4 });
    const extinguisherMat = new THREE.MeshStandardMaterial({ color: "#dc2626", roughness: 0.25, metalness: 0.3 });
    const brassMat = new THREE.MeshStandardMaterial({ color: "#d97706", metalness: 0.7, roughness: 0.3 });
    const roofMat = new THREE.MeshStandardMaterial({
      color: "#28201a",
      roughness: 0.85,
      transparent: true,
      opacity: 1.0,
      side: THREE.DoubleSide,
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 1) PISO E ESTRUTURA DO QUARTO (X: -27.2 a -21.8, Z: -2.9 a 2.9)
    // ─────────────────────────────────────────────────────────────────────────
    const floor = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.1, 5.8), floorWoodMat);
    floor.position.set(-24.5, 0.05, 0);
    floor.receiveShadow = true;
    cabinGroup.add(floor);

    const doormat = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.02, 1.4),
      new THREE.MeshStandardMaterial({ color: "#1c1917", roughness: 0.95 }),
    );
    doormat.position.set(-22.4, 0.11, 0);
    cabinGroup.add(doormat);

    const step = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 1.8), beamMat);
    step.position.set(-21.65, 0.04, 0);
    step.receiveShadow = true;
    cabinGroup.add(step);

    const cornerGeo = new THREE.BoxGeometry(0.26, 2.7, 0.26);
    const corners = [
      [-27.1, 1.35, -2.85],
      [-27.1, 1.35, 2.85],
      [-21.9, 1.35, -2.85],
      [-21.9, 1.35, 2.85],
    ];
    for (const [cx, cy, cz] of corners) {
      const p = new THREE.Mesh(cornerGeo, beamMat);
      p.position.set(cx!, cy!, cz!);
      p.castShadow = true;
      cabinGroup.add(p);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2) PAREDES DO QUARTO
    // ─────────────────────────────────────────────────────────────────────────
    const wallWest = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.7, 5.6), woodWallMat);
    wallWest.position.set(-27.05, 1.35, 0);
    wallWest.castShadow = true;
    wallWest.receiveShadow = true;
    cabinGroup.add(wallWest);

    const wallSouth = new THREE.Mesh(new THREE.BoxGeometry(5.2, 2.7, 0.22), woodWallMat);
    wallSouth.position.set(-24.5, 1.35, -2.85);
    wallSouth.castShadow = true;
    wallSouth.receiveShadow = true;
    cabinGroup.add(wallSouth);

    const wallNorthW = new THREE.Mesh(new THREE.BoxGeometry(1.9, 2.7, 0.22), woodWallMat);
    wallNorthW.position.set(-26.05, 1.35, 2.85);
    wallNorthW.castShadow = true;
    const wallNorthE = new THREE.Mesh(new THREE.BoxGeometry(1.9, 2.7, 0.22), woodWallMat);
    wallNorthE.position.set(-22.95, 1.35, 2.85);
    wallNorthE.castShadow = true;

    const winSill = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 0.22), woodWallMat);
    winSill.position.set(-24.5, 0.45, 2.85);
    const winLintel = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.6, 0.22), woodWallMat);
    winLintel.position.set(-24.5, 2.4, 2.85);

    const winGlass = new THREE.Mesh(
      new THREE.BoxGeometry(1.36, 1.15, 0.04),
      new THREE.MeshStandardMaterial({ color: "#93c5fd", transparent: true, opacity: 0.45, roughness: 0.1 }),
    );
    winGlass.position.set(-24.5, 1.48, 2.85);

    const barGeo = new THREE.CylinderGeometry(0.015, 0.015, 1.2, 6);
    for (const bx of [-24.85, -24.5, -24.15]) {
      const b = new THREE.Mesh(barGeo, metalMat);
      b.position.set(bx, 1.48, 2.85);
      cabinGroup.add(b);
    }
    cabinGroup.add(wallNorthW, wallNorthE, winSill, winLintel, winGlass);

    const wallEastS = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.7, 1.85), woodWallMat);
    wallEastS.position.set(-21.95, 1.35, -1.9);
    wallEastS.castShadow = true;
    const wallEastN = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.7, 1.85), woodWallMat);
    wallEastN.position.set(-21.95, 1.35, 1.9);
    wallEastN.castShadow = true;
    const doorLintel = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.65, 2.0), beamMat);
    doorLintel.position.set(-21.95, 2.38, 0);
    cabinGroup.add(wallEastS, wallEastN, doorLintel);

    const doorPostGeo = new THREE.BoxGeometry(0.24, 2.1, 0.1);
    const doorPostS = new THREE.Mesh(doorPostGeo, beamMat);
    doorPostS.position.set(-21.95, 1.05, -0.98);
    const doorPostN = new THREE.Mesh(doorPostGeo, beamMat);
    doorPostN.position.set(-21.95, 1.05, 0.98);
    cabinGroup.add(doorPostS, doorPostN);

    // ─────────────────────────────────────────────────────────────────────────
    // 3) EXTINTOR DE INCÊNDIO (x = -22.25, z = 1.35)
    // ─────────────────────────────────────────────────────────────────────────
    const extGroup = new THREE.Group();
    extGroup.position.set(-22.25, 1.15, 1.35);
    extGroup.scale.set(1.35, 1.35, 1.35);

    const signMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 0.65, 0.35),
      new THREE.MeshStandardMaterial({ color: "#facc15", roughness: 0.4 }),
    );
    signMesh.position.set(0.01, 0.18, 0);
    const signStripe = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.14, 0.33), extinguisherMat);
    signStripe.position.set(0.012, 0.38, 0);
    extGroup.add(signMesh, signStripe);

    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 0.05), metalMat);
    bracket.position.set(-0.04, 0, 0);
    extGroup.add(bracket);

    const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.52, 16), extinguisherMat);
    cylinder.position.set(-0.13, 0, 0);
    cylinder.castShadow = true;
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      extinguisherMat,
    );
    dome.position.set(-0.13, 0.26, 0);
    extGroup.add(cylinder, dome);

    const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.09, 8), brassMat);
    valve.position.set(-0.13, 0.34, 0);
    const lever = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.16), metalMat);
    lever.position.set(-0.13, 0.38, 0.04);
    lever.rotation.x = -0.2;
    extGroup.add(valve, lever);

    const gauge = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.02, 10),
      new THREE.MeshBasicMaterial({ color: "#f8fafc" }),
    );
    gauge.position.set(-0.13, 0.35, -0.05);
    gauge.rotation.x = Math.PI / 2;
    extGroup.add(gauge);

    const hoseCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.13, 0.35, 0.04),
      new THREE.Vector3(-0.16, 0.28, 0.12),
      new THREE.Vector3(-0.16, 0.12, 0.12),
      new THREE.Vector3(-0.13, 0.02, 0.11),
    ]);
    const hoseMesh = new THREE.Mesh(new THREE.TubeGeometry(hoseCurve, 12, 0.016, 8, false), metalMat);
    extGroup.add(hoseMesh);
    cabinGroup.add(extGroup);

    // ─────────────────────────────────────────────────────────────────────────
    // 4) MESA DE SOBREVIVÊNCIA E ACESSÓRIOS (x = -25.8, z = -1.8)
    // ─────────────────────────────────────────────────────────────────────────
    const tableGroup = new THREE.Group();
    tableGroup.position.set(-25.8, 0, -1.8);

    const tabletop = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 1.1), woodWallMat);
    tabletop.position.y = 0.74;
    tabletop.castShadow = true;
    tabletop.receiveShadow = true;
    tableGroup.add(tabletop);

    const legGeo = new THREE.BoxGeometry(0.09, 0.7, 0.09);
    for (const [lx, ly, lz] of [
      [-0.7, 0.35, -0.45],
      [0.7, 0.35, -0.45],
      [-0.7, 0.35, 0.45],
      [0.7, 0.35, 0.45],
    ]) {
      const leg = new THREE.Mesh(legGeo, beamMat);
      leg.position.set(lx!, ly!, lz!);
      leg.castShadow = true;
      tableGroup.add(leg);
    }
    const apron = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 0.95), beamMat);
    apron.position.y = 0.65;
    tableGroup.add(apron);

    // Rádio transmissor militar (posicionado no canto da mesa)
    const radio = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.15, 0.22),
      new THREE.MeshStandardMaterial({ color: "#2d3748", metalness: 0.5, roughness: 0.4 }),
    );
    radio.position.set(-0.62, 0.86, -0.36);
    radio.castShadow = true;
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.045, 0.02), new THREE.MeshBasicMaterial({ color: "#22c55e" }));
    screen.position.set(-0.62, 0.88, -0.24);
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.007, 0.65, 6), metalMat);
    antenna.position.set(-0.72, 1.2, -0.42);
    antenna.rotation.set(0.1, 0, -0.15);
    tableGroup.add(radio, screen, antenna);

    // Lamparina a óleo (posicionada no canto traseiro direito da mesa)
    const lanternGroup = new THREE.Group();
    lanternGroup.position.set(0.62, 0.78, 0.36);
    const baseLantern = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.06, 10), brassMat);
    baseLantern.position.y = 0.03;
    const glassLantern = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.065, 0.14, 10),
      new THREE.MeshStandardMaterial({ color: "#ffedd5", transparent: true, opacity: 0.65, roughness: 0.1 }),
    );
    glassLantern.position.y = 0.13;
    const capLantern = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.05, 10), brassMat);
    capLantern.position.y = 0.225;
    const handleLantern = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.008, 4, 12, Math.PI), metalMat);
    handleLantern.position.y = 0.25;
    const lanternLight = new THREE.PointLight("#ffaa44", 1.2, 5.5);
    lanternLight.position.y = 0.14;
    lanternGroup.add(baseLantern, glassLantern, capLantern, handleLantern, lanternLight);
    tableGroup.add(lanternGroup);

    const mug = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.04, 0.08, 8),
      new THREE.MeshStandardMaterial({ color: "#94a3b8", metalness: 0.7, roughness: 0.3 }),
    );
    mug.position.set(-0.62, 0.82, 0.32);

    const paper = new THREE.Mesh(
      new THREE.PlaneGeometry(1.08, 0.84),
      new THREE.MeshStandardMaterial({ color: "#e2e8f0", roughness: 0.9 }),
    );
    paper.rotation.x = -Math.PI / 2;
    paper.rotation.z = 0.06;
    paper.position.set(0.06, 0.782, 0.0);

    // ─── Livro Gigante 3D de Sobrevivência (Ocupa grande parte da mesa) ───
    const bookGroup = new THREE.Group();
    bookGroup.position.set(0.06, 0.785, 0.0);
    bookGroup.rotation.y = 0.08;

    const leatherCoverMat = new THREE.MeshStandardMaterial({
      color: "#3b1111", // Couro bordô envelhecido
      roughness: 0.55,
      metalness: 0.15,
    });
    const pagesMat = new THREE.MeshStandardMaterial({
      color: "#fef3c7", // Pergaminho antigo
      roughness: 0.85,
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: "#f59e0b",
      metalness: 0.8,
      roughness: 0.25,
    });

    // Dimensões monumentais do livro: 0.98m x 0.78m (ocupa a maior parte do tampo da mesa)
    const bookWidth = 0.98;
    const bookDepth = 0.78;
    const coverThickness = 0.024;
    const pagesHeight = 0.082;

    // Capa inferior
    const bottomCover = new THREE.Mesh(new THREE.BoxGeometry(bookWidth, coverThickness, bookDepth), leatherCoverMat);
    bottomCover.position.y = coverThickness / 2;
    bottomCover.castShadow = true;

    // Bloco de páginas internas
    const pagesBlock = new THREE.Mesh(new THREE.BoxGeometry(bookWidth - 0.04, pagesHeight, bookDepth - 0.04), pagesMat);
    pagesBlock.position.set(0.01, coverThickness + pagesHeight / 2, 0);
    pagesBlock.castShadow = true;

    // Capa superior
    const topCover = new THREE.Mesh(new THREE.BoxGeometry(bookWidth, coverThickness, bookDepth), leatherCoverMat);
    topCover.position.y = coverThickness + pagesHeight + coverThickness / 2;
    topCover.castShadow = true;

    // Lombada
    const totalBookH = coverThickness * 2 + pagesHeight;
    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.035, totalBookH, bookDepth), leatherCoverMat);
    spine.position.set(-bookWidth / 2 + 0.015, totalBookH / 2, 0);

    // Cantoneiras douradas ornamentais
    const bookCornerGeo = new THREE.BoxGeometry(0.12, 0.032, 0.12);
    const cornerOffsetX = bookWidth / 2 - 0.06;
    const cornerOffsetZ = bookDepth / 2 - 0.06;
    for (const [cx, cz] of [
      [cornerOffsetX, cornerOffsetZ],
      [cornerOffsetX, -cornerOffsetZ],
      [-cornerOffsetX, cornerOffsetZ],
      [-cornerOffsetX, -cornerOffsetZ],
    ]) {
      const corner = new THREE.Mesh(bookCornerGeo, goldMat);
      corner.position.set(cx!, totalBookH + 0.002, cz!);
      bookGroup.add(corner);
    }

    // Emblema dourado central na capa
    const emblem = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.032, 12), goldMat);
    emblem.position.set(0, totalBookH + 0.003, 0);
    bookGroup.add(emblem);

    // Fita de cetim vermelha (marcador de página pendente)
    const ribbonMat = new THREE.MeshStandardMaterial({ color: "#dc2626", roughness: 0.5 });
    const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.012, 0.44), ribbonMat);
    ribbon.position.set(0.14, totalBookH / 2, bookDepth / 2 + 0.12);
    ribbon.rotation.y = 0.12;
    bookGroup.add(ribbon);

    // Brilho quente suave convidativo sobre o diário monumental
    const bookLight = new THREE.PointLight("#f59e0b", 1.2, 3.8);
    bookLight.position.set(0, totalBookH + 0.28, 0);

    bookGroup.add(bottomCover, pagesBlock, topCover, spine, bookLight);
    tableGroup.add(mug, paper, bookGroup);
    cabinGroup.add(tableGroup);

    // Cadeira rústica
    const chairGroup = new THREE.Group();
    chairGroup.position.set(-24.8, 0, -1.8);
    chairGroup.rotation.y = 0.3;
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.04, 0.44), woodWallMat);
    seat.position.y = 0.44;
    seat.castShadow = true;
    chairGroup.add(seat);
    const chairLegGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.44, 6);
    for (const [cx, cy, cz] of [
      [-0.19, 0.22, -0.18],
      [0.19, 0.22, -0.18],
      [-0.19, 0.22, 0.18],
      [0.19, 0.22, 0.18],
    ]) {
      const cl = new THREE.Mesh(chairLegGeo, beamMat);
      cl.position.set(cx!, cy!, cz!);
      cl.castShadow = true;
      chairGroup.add(cl);
    }
    const backPost1 = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.46, 6), beamMat);
    backPost1.position.set(0.19, 0.67, -0.18);
    const backPost2 = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.46, 6), beamMat);
    backPost2.position.set(0.19, 0.67, 0.18);
    const backRail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.42), woodWallMat);
    backRail.position.set(0.19, 0.85, 0);
    chairGroup.add(backPost1, backPost2, backRail);
    cabinGroup.add(chairGroup);

    // ─────────────────────────────────────────────────────────────────────────
    // 5) ESTANTE METÁLICA DE SUPRIMENTOS (x = -25.8, z = 2.4)
    // ─────────────────────────────────────────────────────────────────────────
    const shelfGroup = new THREE.Group();
    shelfGroup.position.set(-25.8, 0, 2.4);

    const shelfPostGeo = new THREE.BoxGeometry(0.04, 1.9, 0.04);
    for (const sx of [-0.65, 0.65]) {
      for (const sz of [-0.2, 0.2]) {
        const post = new THREE.Mesh(shelfPostGeo, metalMat);
        post.position.set(sx, 0.95, sz);
        post.castShadow = true;
        shelfGroup.add(post);
      }
    }
    const shelfPlateGeo = new THREE.BoxGeometry(1.36, 0.03, 0.46);
    for (const sy of [0.1, 0.55, 1.05, 1.55]) {
      const plate = new THREE.Mesh(shelfPlateGeo, metalMat);
      plate.position.y = sy;
      plate.castShadow = true;
      plate.receiveShadow = true;
      shelfGroup.add(plate);
    }
    const medkit = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.22, 0.28),
      new THREE.MeshStandardMaterial({ color: "#f8fafc", roughness: 0.4 }),
    );
    medkit.position.set(-0.25, 1.18, 0);
    medkit.castShadow = true;
    const cross1 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 0.01), extinguisherMat);
    cross1.position.set(-0.25, 1.18, 0.145);
    const cross2 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.14, 0.01), extinguisherMat);
    cross2.position.set(-0.25, 1.18, 0.145);
    shelfGroup.add(medkit, cross1, cross2);

    const boxMat = new THREE.MeshStandardMaterial({ color: "#b45309", roughness: 0.85 });
    const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.35, 0.36), boxMat);
    b1.position.set(0.3, 0.28, 0);
    b1.castShadow = true;
    const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.28, 0.34), boxMat);
    b2.position.set(-0.3, 0.24, 0);
    b2.castShadow = true;
    const battery = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.2, 0.2),
      new THREE.MeshStandardMaterial({ color: "#1e293b", roughness: 0.5 }),
    );
    battery.position.set(0.35, 1.16, 0);
    battery.castShadow = true;
    shelfGroup.add(b1, b2, battery);
    cabinGroup.add(shelfGroup);

    // ─────────────────────────────────────────────────────────────────────────
    // 6) QUADRO DE AVISOS, CAIXOTE E LÂMPADA INDUSTRIAL
    // ─────────────────────────────────────────────────────────────────────────
    const boardGroup = new THREE.Group();
    boardGroup.position.set(-26.86, 1.55, -0.2);
    const corkFrame = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.9, 1.3), beamMat);
    const cork = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 0.82, 1.22),
      new THREE.MeshStandardMaterial({ color: "#a88358", roughness: 0.95 }),
    );
    cork.position.x = 0.02;
    const note1 = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.16, 0.14), new THREE.MeshBasicMaterial({ color: "#fef08a" }));
    note1.position.set(0.035, 0.15, -0.35);
    const note2 = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.35, 0.45), new THREE.MeshBasicMaterial({ color: "#ffffff" }));
    note2.position.set(0.035, -0.05, 0.1);
    boardGroup.add(corkFrame, cork, note1, note2);
    cabinGroup.add(boardGroup);

    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.58, 0.65), woodWallMat);
    crate.position.set(-26.4, 0.29, 0.9);
    crate.rotation.y = 0.18;
    crate.castShadow = true;
    crate.receiveShadow = true;
    cabinGroup.add(crate);

    const ceilingLightGroup = new THREE.Group();
    ceilingLightGroup.position.set(-24.5, 2.55, 0);
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.4, 4), metalMat);
    wire.position.y = -0.2;
    const socket = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.08, 8), metalMat);
    socket.position.y = -0.4;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), new THREE.MeshBasicMaterial({ color: "#ffedd5" }));
    bulb.position.y = -0.46;
    const roomLight = new THREE.PointLight("#ffb86c", 1.8, 9.0);
    roomLight.position.y = -0.48;
    ceilingLightGroup.add(wire, socket, bulb, roomLight);
    cabinGroup.add(ceilingLightGroup);

    const exteriorSign = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.26, 0.95), beamMat);
    exteriorSign.position.set(-21.82, 2.22, 0);
    const signBar = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.04, 0.8), new THREE.MeshBasicMaterial({ color: "#facc15" }));
    signBar.position.set(-21.815, 2.16, 0);
    cabinGroup.add(exteriorSign, signBar);

    // ─────────────────────────────────────────────────────────────────────────
    // 7) TELHADO DE DUAS ÁGUAS COM FADE DINÂMICO
    // ─────────────────────────────────────────────────────────────────────────
    const roofGroup = new THREE.Group();
    const roofLen = 5.8;
    const roofPitchW = 3.35;
    const roofAngle = 0.35;

    const pitchS = new THREE.Mesh(new THREE.BoxGeometry(roofLen, 0.1, roofPitchW), roofMat);
    pitchS.position.set(-24.5, 3.02, -1.45);
    pitchS.rotation.x = -roofAngle;
    pitchS.castShadow = true;

    const pitchN = new THREE.Mesh(new THREE.BoxGeometry(roofLen, 0.1, roofPitchW), roofMat);
    pitchN.position.set(-24.5, 3.02, 1.45);
    pitchN.rotation.x = roofAngle;
    pitchN.castShadow = true;

    const ridge = new THREE.Mesh(new THREE.BoxGeometry(roofLen + 0.1, 0.14, 0.18), beamMat);
    ridge.position.set(-24.5, 3.48, 0);

    const gableW = new THREE.Mesh(new THREE.ConeGeometry(3.0, 0.9, 3), beamMat);
    gableW.position.set(-27.05, 3.15, 0);
    gableW.rotation.y = Math.PI / 2;
    gableW.scale.set(1, 1, 0.08);

    const gableE = new THREE.Mesh(new THREE.ConeGeometry(3.0, 0.9, 3), beamMat);
    gableE.position.set(-21.95, 3.15, 0);
    gableE.rotation.y = Math.PI / 2;
    gableE.scale.set(1, 1, 0.08);

    roofGroup.add(pitchS, pitchN, ridge, gableW, gableE);
    cabinGroup.add(roofGroup);

    this.group.add(cabinGroup);
    return roofMat;
  }

  /**
   * Constrói a Loja de Sobrevivência / Posto de Armas e Equipamentos.
   * Localizado no centro do mapa entre as duas casas (X: 0, Z: 4.0), voltado para a trilha (-Z).
   */
  private buildShop(): void {
    const shopGroup = new THREE.Group();
    shopGroup.position.set(SHOP_POS.x, SHOP_POS.y, SHOP_POS.z);

    const woodPlankMat = new THREE.MeshStandardMaterial({
      color: 0x3d2716,
      roughness: 0.85,
    });
    const postMat = new THREE.MeshStandardMaterial({
      color: 0x2b1c10,
      roughness: 0.8,
    });
    const counterMat = new THREE.MeshStandardMaterial({
      color: 0x4e331e,
      roughness: 0.65,
    });
    const tarpMat = new THREE.MeshStandardMaterial({
      color: 0x273b22, // Lona verde-militar camuflada
      roughness: 0.9,
    });
    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x1f2326,
      metalness: 0.75,
      roughness: 0.35,
    });
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      metalness: 0.85,
      roughness: 0.3,
    });
    const vestMat = new THREE.MeshStandardMaterial({
      color: 0x1a2118,
      roughness: 0.7,
    });

    // 1) Deck / Piso de madeira elevado da loja
    const deck = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.12, 2.2), woodPlankMat);
    deck.position.set(0, 0.06, 0);
    deck.receiveShadow = true;
    shopGroup.add(deck);

    // 2) Quatro pilares de sustentação de madeira rústica
    const postGeo = new THREE.BoxGeometry(0.12, 2.4, 0.12);
    const postPositions = [
      [-1.3, 1.2, -0.95],
      [1.3, 1.2, -0.95],
      [-1.3, 1.3, 0.95],
      [1.3, 1.3, 0.95],
    ];
    for (const [px, py, pz] of postPositions) {
      const p = new THREE.Mesh(postGeo, postMat);
      p.position.set(px, py, pz);
      p.castShadow = true;
      shopGroup.add(p);
    }

    // 3) Toldo / Cobertura de Lona Militar inclinada
    const awning = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.06, 2.3), tarpMat);
    awning.position.set(0, 2.45, 0);
    awning.rotation.x = 0.08; // Leve inclinação para frente
    awning.castShadow = true;
    shopGroup.add(awning);

    // 4) Balcão frontal da loja (onde o sobrevivente apoia os itens)
    const counterTop = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 0.75), counterMat);
    counterTop.position.set(0, 0.95, -0.2);
    counterTop.castShadow = true;
    counterTop.receiveShadow = true;

    const counterBase = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.9, 0.65), woodPlankMat);
    counterBase.position.set(0, 0.45, -0.2);
    counterBase.castShadow = true;
    shopGroup.add(counterTop, counterBase);

    // 5) Detalhes sobre o balcão:
    // 5.1 Caixa registradora / Cofre de latão com moedas
    const cashBox = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.28), brassMat);
    cashBox.position.set(-0.75, 1.05, -0.2);
    cashBox.castShadow = true;
    shopGroup.add(cashBox);

    // 5.2 Caixa de munição aberta com cartuchos dourados
    const ammoBoxWood = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.25), woodPlankMat);
    ammoBoxWood.position.set(0.65, 1.05, -0.2);
    const ammoBullets = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.18), brassMat);
    ammoBullets.position.set(0.65, 1.15, -0.2);
    shopGroup.add(ammoBoxWood, ammoBullets);

    // 5.3 Lampião a querosene pendurado na viga frontal iluminando o balcão
    const lampBeam = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.35, 0.04), metalMat);
    lampBeam.position.set(0, 2.2, -0.9);
    const lampGlass = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.11, 0.22, 8),
      new THREE.MeshStandardMaterial({
        color: 0xffe277,
        emissive: 0xffaa22,
        emissiveIntensity: 1.2,
        roughness: 0.1,
      })
    );
    lampGlass.position.set(0, 1.95, -0.9);
    const shopLight = new THREE.PointLight(0xffb84d, 1.4, 6.5);
    shopLight.position.set(0, 1.95, -0.9);
    shopGroup.add(lampBeam, lampGlass, shopLight);

    // 6) Estante / Parede de fundo (Expositor de Equipamentos e Armas)
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.8, 0.08), woodPlankMat);
    backWall.position.set(0, 1.2, 0.95);
    shopGroup.add(backWall);

    // 6.1 Expositor de Faca Militar na parede
    const knifeBoard = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.22, 0.04), counterMat);
    knifeBoard.position.set(-0.7, 1.4, 0.88);
    const knifeBlade = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.06, 0.03), metalMat);
    knifeBlade.position.set(-0.7, 1.4, 0.91);
    knifeBlade.rotation.z = -0.2;
    shopGroup.add(knifeBoard, knifeBlade);

    // 6.2 Expositor de Fuzil / Carabina na parede
    const gunRack = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.1, 0.05), metalMat);
    gunRack.position.set(0.35, 1.6, 0.88);
    const gunBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.0, 8), metalMat);
    gunBarrel.position.set(0.35, 1.62, 0.92);
    gunBarrel.rotation.z = Math.PI / 2;
    shopGroup.add(gunRack, gunBarrel);

    // 6.3 Colete Balístico / Armadura pendurada em um suporte
    const vestHanger = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.8, 8), postMat);
    vestHanger.position.set(-0.05, 1.2, 0.7);
    const vestBody = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.22), vestMat);
    vestBody.position.set(-0.05, 1.35, 0.7);
    vestBody.castShadow = true;
    shopGroup.add(vestHanger, vestBody);

    // 7) Placa suspensa com o nome da loja: "ARSENAL" / "LOJA"
    const signBoard = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.38, 0.06), counterMat);
    signBoard.position.set(0, 2.15, -0.95);
    const signPlaque = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.26, 0.02),
      new THREE.MeshStandardMaterial({
        color: 0x111612,
        emissive: 0x1f381f,
        emissiveIntensity: 0.6,
        roughness: 0.5,
      })
    );
    signPlaque.position.set(0, 2.15, -0.99);
    shopGroup.add(signBoard, signPlaque);

    // 8) Círculo indicador no chão (Zona de Compra / Interação)
    const ringGeo = new THREE.RingGeometry(0.7, 0.82, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xefb810,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.65,
    });
    const beaconRing = new THREE.Mesh(ringGeo, ringMat);
    beaconRing.rotation.x = -Math.PI / 2;
    beaconRing.position.set(0, 0.02, -1.3);
    shopGroup.add(beaconRing);

    this.group.add(shopGroup);
  }

  /**
   * Constrói a rodovia de asfalto destruído e rachado que atravessa todo o mapa longitudinalmente
   * com faixas centrais amarelas apagadas, fissuras, poças e acostamento de terra.
   */
  private buildRuinedHighway(): void {
    const roadGroup = new THREE.Group();
    roadGroup.name = "RuinedHighway";

    const asphaltMat = new THREE.MeshStandardMaterial({
      color: "#232326",
      roughness: 0.94,
      metalness: 0.05,
    });
    const yellowLineMat = new THREE.MeshBasicMaterial({
      color: "#c29b28",
      transparent: true,
      opacity: 0.75,
    });
    const whiteLineMat = new THREE.MeshBasicMaterial({
      color: "#9a9a9a",
      transparent: true,
      opacity: 0.6,
    });
    const potholeMat = new THREE.MeshBasicMaterial({
      color: "#12100d",
      transparent: true,
      opacity: 0.85,
    });

    // Pista principal de asfalto (X: -28 a 114, largura Z: 6.4m de -3.2 a 3.2)
    const roadLen = 114 - (-28);
    const roadGeo = new THREE.PlaneGeometry(roadLen, 6.4);
    roadGeo.rotateX(-Math.PI / 2);
    const road = new THREE.Mesh(roadGeo, asphaltMat);
    road.position.set((-28 + 114) / 2, 0.005, 0);
    road.receiveShadow = true;
    roadGroup.add(road);

    // Linha central amarela tracejada
    const dashLen = 2.4;
    const dashGap = 2.0;
    const dashGeo = new THREE.PlaneGeometry(dashLen, 0.16);
    dashGeo.rotateX(-Math.PI / 2);

    for (let x = -26; x < 112; x += dashLen + dashGap) {
      // Pula trechos onde há casas ou o ônibus escolar atravessado
      if ((x >= 18 && x <= 33) || (x >= 66 && x <= 74)) continue;
      const dash = new THREE.Mesh(dashGeo, yellowLineMat);
      dash.position.set(x + dashLen / 2, 0.008, 0);
      roadGroup.add(dash);
    }

    // Linhas brancas laterais de acostamento
    const sideLineGeo = new THREE.PlaneGeometry(16, 0.12);
    sideLineGeo.rotateX(-Math.PI / 2);
    for (let x = -26; x < 112; x += 20) {
      if ((x >= 16 && x <= 34) || (x >= 65 && x <= 75)) continue;
      const slN = new THREE.Mesh(sideLineGeo, whiteLineMat);
      slN.position.set(x + 8, 0.008, 3.1);
      const slS = new THREE.Mesh(sideLineGeo, whiteLineMat);
      slS.position.set(x + 8, 0.008, -3.1);
      roadGroup.add(slN, slS);
    }

    // Crateras e buracos com poças de água escura no asfalto
    const potholeGeo = new THREE.CircleGeometry(1.4, 12);
    potholeGeo.rotateX(-Math.PI / 2);
    const holes = [
      [-10.0, 1.2, 1.1],
      [8.0, -1.5, 1.3],
      [43.0, 1.0, 1.5],
      [58.0, -0.8, 1.2],
      [78.0, 1.4, 1.4],
      [90.0, -1.2, 1.6],
      [104.0, 0.5, 1.3],
    ];
    for (const [hx, hz, s] of holes) {
      const p = new THREE.Mesh(potholeGeo, potholeMat);
      p.position.set(hx!, 0.009, hz!);
      p.scale.set(s!, 1, s! * 0.7);
      roadGroup.add(p);
    }

    this.group.add(roadGroup);
  }

  /**
   * Constrói a Zona 5: Checkpoint Militar de Quarentena C.E.D.A. (X: 75 a 115):
   * - Torre de Vigia Militar com rampa de acesso, plataforma de tiro e holofote.
   * - Viatura Blindada Militar (Humvee) camuflada com torre e para-brisa blindado.
   * - Tenda Médica de Campanha C.E.D.A. com interior hospitalar e telhado dinâmico.
   * - Barreiras Antitanque ("Ouriços Tchecos") de vigas de aço cruzadas.
   * - Trincheiras e barricadas de sacos de areia (sandbags).
   * - Muralha e portão colossal de quarentena com avisos biológicos e sinalizador vermelho.
   * - Postes de eletricidade com fiação suspensa e latões de fogo ardentes.
   */
  private buildMilitaryCheckpoint(): THREE.MeshStandardMaterial {
    const cpGroup = new THREE.Group();
    cpGroup.name = "MilitaryCheckpoint";

    // Materiais reutilizáveis do checkpoint militar
    const darkWoodMat = new THREE.MeshStandardMaterial({ color: "#2d241c", roughness: 0.92 });
    const woodPlankMat = new THREE.MeshStandardMaterial({ color: "#45382b", roughness: 0.88 });
    const corrugatedMat = new THREE.MeshStandardMaterial({ color: "#3e3a34", roughness: 0.75, metalness: 0.65 });
    const militaryGreenMat = new THREE.MeshStandardMaterial({ color: "#3b4832", roughness: 0.78, metalness: 0.35 });
    const rustSteelMat = new THREE.MeshStandardMaterial({ color: "#42372e", roughness: 0.8, metalness: 0.7 });
    const tireMat = new THREE.MeshStandardMaterial({ color: "#161616", roughness: 0.95 });
    const glassMat = new THREE.MeshStandardMaterial({ color: "#18242b", roughness: 0.2, metalness: 0.8 });
    const concreteMat = new THREE.MeshStandardMaterial({ color: "#54514c", roughness: 0.92 });
    const sandbagMat = new THREE.MeshStandardMaterial({ color: "#8a7852", roughness: 0.92 });
    const tentFrameMat = new THREE.MeshStandardMaterial({ color: "#282a25", roughness: 0.6, metalness: 0.8 });
    const bioYellowMat = new THREE.MeshStandardMaterial({ color: "#bfa324", roughness: 0.6 });
    const medicalRedMat = new THREE.MeshBasicMaterial({ color: "#cc2222" });
    const medicalWhiteMat = new THREE.MeshStandardMaterial({ color: "#dcdcd8", roughness: 0.6 });
    const lightGlowMat = new THREE.MeshBasicMaterial({ color: "#ffec99" });
    const redBeaconMat = new THREE.MeshBasicMaterial({ color: "#ff1111" });

    // Material com transparência para o teto da tenda médica
    const medicalTentRoofMat = new THREE.MeshStandardMaterial({
      color: "#384030",
      roughness: 0.95,
      transparent: true,
      opacity: 1.0,
      side: THREE.DoubleSide,
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 1) TORRE DE VIGIA MILITAR (WATCHTOWER) (X: 85 a 90, Z: 6.8 a 11.2)
    // ─────────────────────────────────────────────────────────────────────────
    const tower = new THREE.Group();
    tower.position.set(87.0, 0, 9.0);

    // 4 Pilares principais de sustentação
    const legGeo = new THREE.BoxGeometry(0.35, 4.4, 0.35);
    const legCoords = [
      [-1.7, -1.8],
      [1.7, -1.8],
      [-1.7, 1.8],
      [1.7, 1.8],
    ];
    for (const [lx, lz] of legCoords) {
      const leg = new THREE.Mesh(legGeo, darkWoodMat);
      leg.position.set(lx!, 2.2, lz!);
      leg.castShadow = true;
      tower.add(leg);
    }

    // Vigas diagonais de travamento em X
    const braceGeo = new THREE.BoxGeometry(0.12, 0.12, 3.8);
    const bNorth = new THREE.Mesh(braceGeo, darkWoodMat);
    bNorth.position.set(0, 1.2, 1.8);
    bNorth.rotation.y = Math.PI / 2;
    const bSouth = new THREE.Mesh(braceGeo, darkWoodMat);
    bSouth.position.set(0, 1.2, -1.8);
    bSouth.rotation.y = Math.PI / 2;
    const bEast = new THREE.Mesh(braceGeo, darkWoodMat);
    bEast.position.set(1.7, 1.2, 0);
    tower.add(bNorth, bSouth, bEast);

    // Plataforma elevada (Deck de madeira em Y = 2.4m)
    const deckSub = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.18, 4.0), darkWoodMat);
    deckSub.position.y = 2.31;
    deckSub.castShadow = true;
    tower.add(deckSub);

    const deckPlanks = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.08, 3.9), woodPlankMat);
    deckPlanks.position.y = 2.44;
    deckPlanks.receiveShadow = true;
    tower.add(deckPlanks);

    // Guarda-corpos de madeira no piso superior (Y: 2.4m a 3.4m)
    const railPostGeo = new THREE.BoxGeometry(0.12, 1.05, 0.12);
    const railCoords = [
      [-1.85, -1.85],
      [1.85, -1.85],
      [1.85, 1.85],
      [-1.85, 1.85],
      [1.85, 0],
      [0, 1.85],
      [0, -1.85],
    ];
    for (const [rx, rz] of railCoords) {
      const rp = new THREE.Mesh(railPostGeo, darkWoodMat);
      rp.position.set(rx!, 2.95, rz!);
      tower.add(rp);
    }

    const railTopN = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.1, 0.12), darkWoodMat);
    railTopN.position.set(0, 3.4, 1.85);
    const railTopS = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.1, 0.12), darkWoodMat);
    railTopS.position.set(0, 3.4, -1.85);
    const railTopE = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 3.9), darkWoodMat);
    railTopE.position.set(1.85, 3.4, 0);
    tower.add(railTopN, railTopS, railTopE);

    // Parapeito de sacos de areia na borda sul da plataforma (cobertura tática voltada para a estrada)
    const sandbagDeckGeo = new THREE.BoxGeometry(0.65, 0.22, 0.35);
    for (let i = -2; i <= 2; i++) {
      for (let layer = 0; layer < 2; layer++) {
        const sb = new THREE.Mesh(sandbagDeckGeo, sandbagMat);
        sb.position.set(i * 0.7, 2.55 + layer * 0.2, -1.75);
        sb.castShadow = true;
        tower.add(sb);
      }
    }

    // Telhado de chapa ondulada no topo da torre (Y = 4.3m)
    const towerRoof = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.1, 4.5), corrugatedMat);
    towerRoof.position.set(0, 4.35, 0);
    towerRoof.rotation.z = -0.06;
    towerRoof.castShadow = true;
    tower.add(towerRoof);

    // Holofote militar montado na quina sudeste da torre
    const spotFixture = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.35, 10), rustSteelMat);
    spotFixture.position.set(1.8, 3.25, -1.8);
    spotFixture.rotation.x = 0.55;
    spotFixture.rotation.y = -0.4;
    const spotLens = new THREE.Mesh(new THREE.CircleGeometry(0.16, 12), lightGlowMat);
    spotLens.position.set(1.8, 3.12, -1.94);
    spotLens.rotation.x = 0.55;
    tower.add(spotFixture, spotLens);

    // Luz pontual sutil do holofote
    const spotLight = new THREE.PointLight(0xffea99, 1.2, 9.0, 2);
    spotLight.position.set(88.8, 3.2, 7.1);
    cpGroup.add(spotLight);

    // Escada/Rampa de acesso à torre (conecta X: 81.5 até X: 85.2 em Z: 9.0)
    const stairSteps = 8;
    const stepGeo = new THREE.BoxGeometry(0.48, 0.08, 1.8);
    for (let s = 0; s < stairSteps; s++) {
      const stepT = s / (stairSteps - 1);
      const stepX = -5.5 + stepT * 3.7;
      const stepY = stepT * 2.38;
      const step = new THREE.Mesh(stepGeo, woodPlankMat);
      step.position.set(stepX, stepY + 0.04, 0);
      step.castShadow = true;
      tower.add(step);
    }
    // Corrimão inclinado da escada
    const stairRailGeo = new THREE.BoxGeometry(4.1, 0.08, 0.08);
    const stairRailN = new THREE.Mesh(stairRailGeo, darkWoodMat);
    stairRailN.position.set(-3.7, 1.85, 0.95);
    stairRailN.rotation.z = 0.56;
    const stairRailS = new THREE.Mesh(stairRailGeo, darkWoodMat);
    stairRailS.position.set(-3.7, 1.85, -0.95);
    stairRailS.rotation.z = 0.56;
    tower.add(stairRailN, stairRailS);

    cpGroup.add(tower);

    // ─────────────────────────────────────────────────────────────────────────
    // 2) TENDA MÉDICA DE CAMPANHA C.E.D.A. (X: 96 a 104, Z: -12 a -4)
    // ─────────────────────────────────────────────────────────────────────────
    const tent = new THREE.Group();
    tent.position.set(100.0, 0, -8.0);

    // Arcos estruturais de suporte da tenda
    const archGeo = new THREE.CylinderGeometry(3.8, 3.8, 0.08, 16, 1, true, 0, Math.PI);
    archGeo.rotateZ(Math.PI / 2);
    for (const ax of [-3.8, 0, 3.8]) {
      const arch = new THREE.Mesh(archGeo, tentFrameMat);
      arch.position.set(ax, 0, 0);
      tent.add(arch);
    }

    // Paredes verticais de lona militar (Sul, Leste, Oeste e Norte com vão)
    const canvasWallMat = new THREE.MeshStandardMaterial({ color: "#363f2e", roughness: 0.95 });
    const wallSouth = new THREE.Mesh(new THREE.BoxGeometry(8.0, 2.4, 0.1), canvasWallMat);
    wallSouth.position.set(0, 1.2, -3.95);
    const wallEast = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.4, 7.9), canvasWallMat);
    wallEast.position.set(3.95, 1.2, 0);
    const wallWest = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.4, 7.9), canvasWallMat);
    wallWest.position.set(-3.95, 1.2, 0);
    // Parede Norte (com vão de entrada de 2.6m de largura)
    const wallNorthL = new THREE.Mesh(new THREE.BoxGeometry(2.7, 2.4, 0.1), canvasWallMat);
    wallNorthL.position.set(-2.65, 1.2, 3.95);
    const wallNorthR = new THREE.Mesh(new THREE.BoxGeometry(2.7, 2.4, 0.1), canvasWallMat);
    wallNorthR.position.set(2.65, 1.2, 3.95);
    tent.add(wallSouth, wallEast, wallWest, wallNorthL, wallNorthR);

    // Telhado de lona com transparência dinâmica (esmaece quando o jogador entra)
    const tentRoofGeo = new THREE.CylinderGeometry(4.0, 4.0, 8.1, 16, 1, false, 0, Math.PI);
    tentRoofGeo.rotateZ(Math.PI / 2);
    const tentRoof = new THREE.Mesh(tentRoofGeo, medicalTentRoofMat);
    tentRoof.position.set(0, 0, 0);
    tentRoof.castShadow = true;
    tent.add(tentRoof);

    // Cruz Vermelha Médica na lona acima da entrada
    const crossDisc = new THREE.Mesh(new THREE.CircleGeometry(0.65, 16), medicalWhiteMat);
    crossDisc.position.set(0, 2.85, 3.98);
    const crossH = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.24), medicalRedMat);
    crossH.position.set(0, 2.85, 4.0);
    const crossV = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.85), medicalRedMat);
    crossV.position.set(0, 2.85, 4.0);
    tent.add(crossDisc, crossH, crossV);

    // ─── Interior da Tenda Médica ───
    const cotMetalMat = new THREE.MeshStandardMaterial({ color: "#252825", roughness: 0.6, metalness: 0.8 });
    const cotFabricMat = new THREE.MeshStandardMaterial({ color: "#4f5546", roughness: 0.9 });
    const makeHospitalCot = (cx: number, cz: number, rotY: number) => {
      const cot = new THREE.Group();
      cot.position.set(cx, 0, cz);
      cot.rotation.y = rotY;

      // Estrutura tubular
      const frame = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.45, 0.95), cotMetalMat);
      frame.position.y = 0.25;
      frame.castShadow = true;
      cot.add(frame);

      // Colchonete de campanha
      const mat = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.12, 0.88), cotFabricMat);
      mat.position.y = 0.48;
      cot.add(mat);

      // Travesseiro
      const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.08, 0.75), medicalWhiteMat);
      pillow.position.set(-0.75, 0.55, 0);
      cot.add(pillow);

      tent.add(cot);
    };

    makeHospitalCot(-2.2, -1.8, 0);
    makeHospitalCot(-2.2, 1.8, 0);

    // Suporte de Soro (IV Drip Stand)
    const ivPole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.8, 8), cotMetalMat);
    ivPole.position.set(-3.2, 0.9, -0.5);
    const ivBag = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.28, 0.08), medicalWhiteMat);
    ivBag.position.set(-3.2, 1.6, -0.5);
    tent.add(ivPole, ivBag);

    // Mesa de instrumentos e caixas de medicamentos
    const medTable = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.85, 0.75), cotMetalMat);
    medTable.position.set(2.6, 0.42, -2.4);
    medTable.castShadow = true;
    tent.add(medTable);

    // Caixas de primeiros socorros empilhadas
    const medBoxGeo = new THREE.BoxGeometry(0.5, 0.32, 0.4);
    const b1 = new THREE.Mesh(medBoxGeo, militaryGreenMat);
    b1.position.set(2.6, 0.98, -2.4);
    const b2 = new THREE.Mesh(medBoxGeo, bioYellowMat);
    b2.position.set(2.4, 0.16, 2.5);
    tent.add(b1, b2);

    cpGroup.add(tent);

    // ─────────────────────────────────────────────────────────────────────────
    // 3) VIATURA MILITAR BLINDADA (HUMVEE) (X: 79.0, Z: -6.0)
    // ─────────────────────────────────────────────────────────────────────────
    const humvee = new THREE.Group();
    humvee.position.set(79.0, 0, -6.0);
    humvee.rotation.y = 0.22;

    // Chassi inferior robusto
    const hvChassis = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.65, 2.3), militaryGreenMat);
    hvChassis.position.y = 0.65;
    hvChassis.castShadow = true;
    humvee.add(hvChassis);

    // Capô dianteiro inclinado com grade militar
    const hvHood = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.45, 2.15), militaryGreenMat);
    hvHood.position.set(1.55, 1.15, 0);
    hvHood.castShadow = true;
    humvee.add(hvHood);

    // Para-choques reforçado estilo Bullbar
    const hvBullbar = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.65, 2.4), rustSteelMat);
    hvBullbar.position.set(2.4, 0.55, 0);
    hvBullbar.castShadow = true;
    humvee.add(hvBullbar);

    // Cabine blindada com teto angulado
    const hvCabin = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.75, 2.1), militaryGreenMat);
    hvCabin.position.set(-0.35, 1.35, 0);
    hvCabin.castShadow = true;
    humvee.add(hvCabin);

    // Traseira angular (hatchback militar)
    const hvRear = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.6, 2.05), militaryGreenMat);
    hvRear.position.set(-1.8, 1.15, 0);
    hvRear.rotation.z = -0.15;
    humvee.add(hvRear);

    // Para-brisa dianteiro com 2 vigias blindadas
    const hvWindshield = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, 1.95), glassMat);
    hvWindshield.position.set(0.8, 1.4, 0);
    hvWindshield.rotation.z = -0.35;
    humvee.add(hvWindshield);

    // Anel de torreta no teto
    const ringTurret = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.08, 8, 16), rustSteelMat);
    ringTurret.rotation.x = Math.PI / 2;
    ringTurret.position.set(-0.25, 1.78, 0);
    humvee.add(ringTurret);

    // Pneu reserva montado na traseira
    const spareTire = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.28, 12), tireMat);
    spareTire.rotation.z = Math.PI / 2;
    spareTire.position.set(-2.4, 0.95, 0);
    humvee.add(spareTire);

    // 4 Rodas blindadas grandes
    const hvWheelGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.35, 12);
    hvWheelGeo.rotateZ(Math.PI / 2);
    const hvWheelSpots = [
      [1.4, 1.15],
      [1.4, -1.15],
      [-1.4, 1.15],
      [-1.4, -1.15],
    ];
    for (const [wx, wz] of hvWheelSpots) {
      const w = new THREE.Mesh(hvWheelGeo, tireMat);
      w.position.set(wx!, 0.5, wz!);
      w.castShadow = true;
      humvee.add(w);
    }

    // Antena chicote militar inclinada
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 2.2, 6), rustSteelMat);
    antenna.position.set(-2.2, 1.95, 0.9);
    antenna.rotation.z = -0.3;
    humvee.add(antenna);

    cpGroup.add(humvee);

    // ─────────────────────────────────────────────────────────────────────────
    // 4) OURIÇOS TCHECOS (BARRICADAS ANTITANQUE EM VIGA DE AÇO)
    // ─────────────────────────────────────────────────────────────────────────
    const makeCzechHedgehog = (x: number, z: number, rotY: number) => {
      const hg = new THREE.Group();
      hg.position.set(x, 0, z);
      hg.rotation.y = rotY;

      const beamGeo = new THREE.BoxGeometry(0.18, 0.18, 2.3);
      // Viga 1
      const b1 = new THREE.Mesh(beamGeo, rustSteelMat);
      b1.rotation.x = 0.62;
      b1.position.y = 0.65;
      b1.castShadow = true;
      // Viga 2
      const b2 = new THREE.Mesh(beamGeo, rustSteelMat);
      b2.rotation.x = -0.62;
      b2.position.y = 0.65;
      b2.castShadow = true;
      // Viga 3 transversal
      const b3 = new THREE.Mesh(beamGeo, rustSteelMat);
      b3.rotation.z = 0.62;
      b3.position.y = 0.65;
      b3.castShadow = true;

      hg.add(b1, b2, b3);
      cpGroup.add(hg);
    };

    makeCzechHedgehog(76.0, 1.5, 0.4);
    makeCzechHedgehog(77.5, -2.0, -0.3);
    makeCzechHedgehog(93.0, -0.5, 0.8);

    // ─────────────────────────────────────────────────────────────────────────
    // 5) TRINCHEIRAS E BARRICADAS DE SACOS DE AREIA (SANDBAGS)
    // ─────────────────────────────────────────────────────────────────────────
    const makeSandbagWall = (x: number, z: number, length: number, heightLayers: number, rotY: number) => {
      const wall = new THREE.Group();
      wall.position.set(x, 0, z);
      wall.rotation.y = rotY;

      const bagGeo = new THREE.BoxGeometry(0.72, 0.22, 0.38);
      const bagsPerLayer = Math.floor(length / 0.68);

      for (let layer = 0; layer < heightLayers; layer++) {
        const offset = layer % 2 === 0 ? 0 : 0.34;
        for (let i = 0; i < bagsPerLayer; i++) {
          const bag = new THREE.Mesh(bagGeo, sandbagMat);
          bag.position.set(-length / 2 + i * 0.68 + offset, 0.11 + layer * 0.2, (Math.random() - 0.5) * 0.04);
          bag.rotation.y = (Math.random() - 0.5) * 0.08;
          bag.castShadow = true;
          bag.receiveShadow = true;
          wall.add(bag);
        }
      }

      cpGroup.add(wall);
    };

    // Posição de tiro em U no posto avançado (X: 89.5 a 93.5, Z: 2.0 a 4.5)
    makeSandbagWall(91.5, 2.4, 4.0, 3, 0); // Frente voltada para a estrada
    makeSandbagWall(89.9, 3.6, 2.0, 3, Math.PI / 2); // Aba lateral oeste
    // Barricada em frente à tenda médica
    makeSandbagWall(96.5, -2.1, 3.2, 3, 0);

    // ─────────────────────────────────────────────────────────────────────────
    // 6) MURALHA E PORTÃO COLOSSAL DE QUARENTENA FINAL (X: 113 a 115)
    // ─────────────────────────────────────────────────────────────────────────
    const wallGroup = new THREE.Group();
    wallGroup.position.set(113.8, 0, 0);

    // Blocos Jersey de concreto blindado ao longo de toda a borda Z (MAP_MIN_Z a MAP_MAX_Z)
    const jerseyGeo = new THREE.BoxGeometry(1.2, 1.1, 3.6);
    for (let z = MAP_MIN_Z + 1.5; z <= MAP_MAX_Z - 1.5; z += 3.8) {
      const jersey = new THREE.Mesh(jerseyGeo, concreteMat);
      jersey.position.set(0, 0.55, z);
      jersey.castShadow = true;
      jersey.receiveShadow = true;
      wallGroup.add(jersey);
    }

    // Postes de cerca de segurança pesada com concertina no topo
    const fencePostGeo = new THREE.BoxGeometry(0.18, 4.2, 0.18);
    for (let z = MAP_MIN_Z; z <= MAP_MAX_Z; z += 3.6) {
      const fp = new THREE.Mesh(fencePostGeo, rustSteelMat);
      fp.position.set(0.1, 2.1, z);
      fp.castShadow = true;
      wallGroup.add(fp);
    }

    // Portão blindado central (Z: -4.0 a 4.0)
    const gateDoor = new THREE.Mesh(new THREE.BoxGeometry(0.24, 3.4, 8.2), rustSteelMat);
    gateDoor.position.set(0.15, 1.7, 0);
    gateDoor.castShadow = true;
    wallGroup.add(gateDoor);

    // Faixas de aviso de risco biológico amarela/preta no portão
    const stripeMat = new THREE.MeshStandardMaterial({
      color: 0xd4a017,
      roughness: 0.5,
      metalness: 0.3,
    });
    const stripeUpper = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.35, 7.8), stripeMat);
    stripeUpper.position.set(0.16, 2.8, 0);
    const stripeLower = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.35, 7.8), stripeMat);
    stripeLower.position.set(0.16, 0.6, 0);
    wallGroup.add(stripeUpper, stripeLower);

    // Placa de metal com aviso: "ZONA DE QUARENTENA"
    const signBoard = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, 3.2), bioYellowMat);
    signBoard.position.set(-0.05, 3.2, 0);
    const signTextPlaque = new THREE.Mesh(
      new THREE.PlaneGeometry(3.0, 1.0),
      new THREE.MeshStandardMaterial({ color: "#141414", roughness: 0.8 })
    );
    signTextPlaque.rotation.y = -Math.PI / 2;
    signTextPlaque.position.set(-0.11, 3.2, 0);
    wallGroup.add(signBoard, signTextPlaque);

    // Luz estroboscópica / sinalizador vermelho no topo do portão
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.35, 8), redBeaconMat);
    beacon.position.set(0.15, 4.3, 0);
    wallGroup.add(beacon);

    const beaconLight = new THREE.PointLight(0xff2222, 1.2, 8.0, 2);
    beaconLight.position.set(113.8, 4.5, 0);
    cpGroup.add(beaconLight);

    cpGroup.add(wallGroup);

    // 7) A rede de postes e fiação suspensa da rodovia é construída de forma unificada em buildExtendedPowerGrid()

    // ─────────────────────────────────────────────────────────────────────────
    // 8) LATÕES DE FOGO COM BRASAS ARDENTES (BURN BARRELS)
    // ─────────────────────────────────────────────────────────────────────────
    const barrelMetalMat = new THREE.MeshStandardMaterial({ color: "#2d231b", roughness: 0.8, metalness: 0.7 });
    const embersMat = new THREE.MeshBasicMaterial({ color: 0xff4800 });

    const makeBurnBarrel = (bx: number, bz: number) => {
      const bb = new THREE.Group();
      bb.position.set(bx, 0, bz);

      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.15, 12), barrelMetalMat);
      drum.position.y = 0.58;
      drum.castShadow = true;
      bb.add(drum);

      // Fogo / brasas no topo
      const fireCore = new THREE.Mesh(new THREE.CircleGeometry(0.38, 10), embersMat);
      fireCore.rotation.x = -Math.PI / 2;
      fireCore.position.y = 1.12;
      bb.add(fireCore);

      // Luz quente acolhedora
      const fireLight = new THREE.PointLight(0xff7722, 1.4, 7.5, 2);
      fireLight.position.set(0, 1.3, 0);
      bb.add(fireLight);

      cpGroup.add(bb);
    };

    makeBurnBarrel(82.0, 1.0); // Checkpoint da estrada
    makeBurnBarrel(68.0, 3.5); // Perto do ônibus escolar
    makeBurnBarrel(-3.0, 2.0); // Perto da loja militar

    this.group.add(cpGroup);
    return medicalTentRoofMat;
  }

  /**
   * Constrói as estruturas pós-apocalípticas no Setor Norte expandido (Z: 14 a 34):
   * 1) Posto de Combustível Abandonado "Red Rock Fuel" (toldo, bombas retrô, poça de óleo, picape e quiosque).
   * 2) Oficina Mecânica e Garagem em Ruínas "Metro Auto Repair" (galpão, elevador com chassi içado, bancadas e ferramentas).
   * 3) Acampamento de Sobreviventes / Quarentena (tendas militares, fogueira com caldeirão, torre de vigia de toras).
   * 4) Subestação Elétrica Destruída & Alta Tensão (transformadores industriais, poste quebrado, cabos soltos).
   */
  private buildExpandedNorthScenery(): {
    gasStationRoofMat: THREE.MeshStandardMaterial;
    gasStationCanopyRoofMat: THREE.MeshStandardMaterial;
    signPlaqueMat: THREE.MeshStandardMaterial;
    workshopRoofMat: THREE.MeshStandardMaterial;
    settlerRoofMat: THREE.MeshStandardMaterial;
    substationRoofMat: THREE.MeshStandardMaterial;
  } {
    const northGroup = new THREE.Group();
    northGroup.name = "ExpandedNorthScenery";

    // Materiais compartilhados do setor norte
    const steelMat = new THREE.MeshStandardMaterial({ color: "#282a2d", roughness: 0.85, metalness: 0.6 });
    const rustMetalMat = new THREE.MeshStandardMaterial({ color: "#3a281c", roughness: 0.9, metalness: 0.5 });
    const darkWoodMat = new THREE.MeshStandardMaterial({ color: "#2d2319", roughness: 0.95 });
    const woodWallMat = new THREE.MeshStandardMaterial({ color: "#423225", roughness: 0.9 });
    const brickMat = new THREE.MeshStandardMaterial({ color: "#453229", roughness: 0.92 });
    const concreteMat = new THREE.MeshStandardMaterial({ color: "#4a4a48", roughness: 0.9 });
    const oilSlickMat = new THREE.MeshStandardMaterial({ color: "#0d0e12", roughness: 0.25, metalness: 0.8 });

    // Telhados com transparência dinâmica (fade-out ao entrar)
    const settlerRoofMat = new THREE.MeshStandardMaterial({
      color: "#281e18",
      roughness: 0.92,
      transparent: true,
      opacity: 1.0,
      side: THREE.DoubleSide,
    });
    const gasStationRoofMat = new THREE.MeshStandardMaterial({
      color: "#211c25",
      roughness: 0.9,
      transparent: true,
      opacity: 1.0,
      side: THREE.DoubleSide,
    });
    const workshopRoofMat = new THREE.MeshStandardMaterial({
      color: "#242a30",
      roughness: 0.88,
      transparent: true,
      opacity: 1.0,
      side: THREE.DoubleSide,
    });
    const substationRoofMat = new THREE.MeshStandardMaterial({
      color: "#23262a",
      roughness: 0.92,
      transparent: true,
      opacity: 1.0,
      side: THREE.DoubleSide,
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 0) CASA DO SOBREVIVENTE DO NORTE (X: -23.5 a -15.5, Z: 23.0 a 31.2)
    // ─────────────────────────────────────────────────────────────────────────
    const settlerGroup = new THREE.Group();

    // Piso de assoalho de madeira envelhecida
    const sFloor = new THREE.Mesh(new THREE.BoxGeometry(8.0, 0.16, 8.2), darkWoodMat);
    sFloor.position.set(-19.5, 0.08, 27.1);
    sFloor.receiveShadow = true;
    settlerGroup.add(sFloor);

    // Deck da varanda frontal com pequeno degrau
    const sPorch = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.16, 2.2), darkWoodMat);
    sPorch.position.set(-19.5, 0.08, 21.9);
    sPorch.receiveShadow = true;
    settlerGroup.add(sPorch);

    // Pilares da varanda
    for (const px of [-21.4, -17.6]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.8, 0.18), darkWoodMat);
      p.position.set(px, 1.4, 21.0);
      p.castShadow = true;
      settlerGroup.add(p);
    }

    // Paredes da casa (vão de porta na face sul em X: [-20.5, -18.5])
    const sWalls = [
      // Fundo Norte
      { x: -19.5, y: 1.6, z: 30.9, w: 8.0, h: 3.2, d: 0.35 },
      // Lateral Oeste
      { x: -23.2, y: 1.6, z: 27.1, w: 0.35, h: 3.2, d: 7.6 },
      // Lateral Leste
      { x: -15.8, y: 1.6, z: 27.1, w: 0.35, h: 3.2, d: 7.6 },
      // Frente Sul (lado esquerdo)
      { x: -22.0, y: 1.6, z: 23.3, w: 2.5, h: 3.2, d: 0.35 },
      // Frente Sul (lado direito)
      { x: -17.0, y: 1.6, z: 23.3, w: 2.5, h: 3.2, d: 0.35 },
      // Viga superior sobre a porta
      { x: -19.5, y: 2.85, z: 23.3, w: 2.5, h: 0.7, d: 0.35 },
    ];
    for (const sw of sWalls) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(sw.w, sw.h, sw.d), woodWallMat);
      wall.position.set(sw.x, sw.y, sw.z);
      wall.castShadow = true;
      wall.receiveShadow = true;
      settlerGroup.add(wall);
    }

    // Interior da casa: sofá, mesa de centro, balcão de cozinha e cama
    const leatherMat = new THREE.MeshStandardMaterial({ color: "#523223", roughness: 0.85 });
    const couch = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.75, 2.4), leatherMat);
    couch.position.set(-22.1, 0.4, 26.0);
    couch.castShadow = true;
    settlerGroup.add(couch);

    const sTable = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.45, 1.2), darkWoodMat);
    sTable.position.set(-20.5, 0.23, 26.0);
    sTable.castShadow = true;
    settlerGroup.add(sTable);

    // Caneca e lata de comida sobre a mesa
    const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 8), steelMat);
    mug.position.set(-20.5, 0.51, 25.8);
    settlerGroup.add(mug);

    // Balcão de cozinha na parede leste
    const sCounter = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.95, 3.8), darkWoodMat);
    sCounter.position.set(-16.8, 0.48, 27.2);
    sCounter.castShadow = true;
    settlerGroup.add(sCounter);

    // Cama improvisada no quarto norte-leste
    const mattressMat = new THREE.MeshStandardMaterial({ color: "#7a6f5e", roughness: 0.95 });
    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.35, 2.0), mattressMat);
    bed.position.set(-17.5, 0.25, 29.8);
    bed.castShadow = true;
    settlerGroup.add(bed);

    // Lanterna pendurada no teto com iluminação suave
    const sLantern = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.22, 6), rustMetalMat);
    sLantern.position.set(-19.5, 2.8, 27.1);
    const sLight = new THREE.PointLight("#ffaa44", 1.2, 8.0);
    sLight.position.set(-19.5, 2.6, 27.1);
    settlerGroup.add(sLantern, sLight);

    // Telhado de duas águas com fade dinâmico
    const sRoofG = new THREE.Group();
    const sSlopeLen = Math.hypot(4.4, 1.2);
    const sSlopeAngle = Math.atan2(1.2, 4.4);
    // Água Oeste
    const sRoofW = new THREE.Mesh(new THREE.BoxGeometry(sSlopeLen, 0.14, 8.8), settlerRoofMat);
    sRoofW.position.set(-21.6, 3.7, 27.1);
    sRoofW.rotation.z = sSlopeAngle;
    sRoofW.castShadow = true;
    // Água Leste
    const sRoofE = new THREE.Mesh(new THREE.BoxGeometry(sSlopeLen, 0.14, 8.8), settlerRoofMat);
    sRoofE.position.set(-17.4, 3.7, 27.1);
    sRoofE.rotation.z = -sSlopeAngle;
    sRoofE.castShadow = true;
    sRoofG.add(sRoofW, sRoofE);
    settlerGroup.add(sRoofG);

    northGroup.add(settlerGroup);

    // ─────────────────────────────────────────────────────────────────────────
    // 1) POSTO DE COMBUSTÍVEL ABANDONADO "RED ROCK FUEL" (X: -6 a 6, Z: 18 a 32)
    // ─────────────────────────────────────────────────────────────────────────
    const gasStationCanopyRoofMat = new THREE.MeshStandardMaterial({
      color: "#7a2220",
      roughness: 0.82,
      transparent: true,
      opacity: 1.0,
      side: THREE.DoubleSide,
    });
    const signPlaqueMat = new THREE.MeshStandardMaterial({
      color: "#141414",
      roughness: 0.9,
      transparent: true,
      opacity: 1.0,
      side: THREE.DoubleSide,
    });
    const pumpCreamMat = new THREE.MeshStandardMaterial({ color: "#d2c9b4", roughness: 0.75 });

    // Pilares de aço I-beam do toldo
    const pillarGeo = new THREE.BoxGeometry(0.32, 4.0, 0.32);
    for (const [px, pz] of [
      [-3.5, 19.1],
      [3.5, 19.1],
      [-3.5, 25.1],
      [3.5, 25.1],
    ]) {
      const col = new THREE.Mesh(pillarGeo, steelMat);
      col.position.set(px!, 2.0, pz!);
      col.castShadow = true;
      northGroup.add(col);
    }

    // Cobertura do toldo vermelho (fade-out dinâmico quando o jogador passa por baixo)
    const canopyRoof = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.35, 7.6), gasStationCanopyRoofMat);
    canopyRoof.position.set(0, 4.15, 22.1);
    canopyRoof.castShadow = true;
    northGroup.add(canopyRoof);

    // Letreiro do posto no toldo frontal
    const canopySign = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.6, 0.12), gasStationCanopyRoofMat);
    canopySign.position.set(0, 4.45, 18.2);
    const signPlaque = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 0.5), signPlaqueMat);
    signPlaque.position.set(0, 4.45, 18.13);
    signPlaque.rotation.y = Math.PI;
    northGroup.add(canopySign, signPlaque);

    // Ilha de bombas de combustível
    const pumpIsland = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.22, 1.8), concreteMat);
    pumpIsland.position.set(0, 0.11, 21.6);
    pumpIsland.castShadow = true;
    pumpIsland.receiveShadow = true;
    northGroup.add(pumpIsland);

    // 2 Bombas de combustível vintage
    for (const bx of [-1.1, 1.1]) {
      const pump = new THREE.Group();
      pump.position.set(bx, 0.22, 21.6);

      const pumpBody = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.5, 0.65), pumpCreamMat);
      pumpBody.position.y = 0.75;
      pumpBody.castShadow = true;
      pump.add(pumpBody);

      const dial = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.45, 0.68), steelMat);
      dial.position.y = 1.15;
      pump.add(dial);

      // Mangueira de borracha preta
      const hose = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.2, 6), steelMat);
      hose.position.set(0.42, 0.7, 0);
      pump.add(hose);

      northGroup.add(pump);
    }

    // Poça escura de óleo/combustível derramado no chão
    const oilSlick = new THREE.Mesh(new THREE.CircleGeometry(2.1, 16), oilSlickMat);
    oilSlick.rotation.x = -Math.PI / 2;
    oilSlick.position.set(0.8, 0.008, 22.8);
    northGroup.add(oilSlick);

    // Picape enferrujada abandonada ao lado da bomba (X: -3.4, Z: 22.4)
    const truckGroup = new THREE.Group();
    truckGroup.position.set(-3.4, 0, 22.4);
    truckGroup.rotation.y = 0.22;
    const truckBody = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.85, 3.8), rustMetalMat);
    truckBody.position.y = 0.65;
    truckBody.castShadow = true;
    truckGroup.add(truckBody);
    const truckCabin = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.75, 1.7), rustMetalMat);
    truckCabin.position.set(0, 1.45, 0.5);
    truckCabin.castShadow = true;
    truckGroup.add(truckCabin);
    northGroup.add(truckGroup);

    // Quiosque / Loja de Conveniência (X: 0.5, Z: 29.7)
    const kioskGroup = new THREE.Group();
    const kioskWalls = [
      // Fundo Norte
      { x: 0.5, y: 1.6, z: 32.5, w: 7.8, h: 3.2, d: 0.35 },
      // Parede Oeste
      { x: -3.1, y: 1.6, z: 29.7, w: 0.35, h: 3.2, d: 6.2 },
      // Parede Leste
      { x: 4.1, y: 1.6, z: 29.7, w: 0.35, h: 3.2, d: 6.2 },
      // Parede Frontal Sul (vão de porta em [0.2, 2.2])
      { x: -1.6, y: 1.6, z: 26.9, w: 3.6, h: 3.2, d: 0.35 },
      { x: 3.3, y: 1.6, z: 26.9, w: 2.2, h: 3.2, d: 0.35 },
    ];
    for (const kw of kioskWalls) {
      const wMesh = new THREE.Mesh(new THREE.BoxGeometry(kw.w, kw.h, kw.d), brickMat);
      wMesh.position.set(kw.x, kw.y, kw.z);
      wMesh.castShadow = true;
      wMesh.receiveShadow = true;
      kioskGroup.add(wMesh);
    }
    // Balcão e prateleiras dentro do quiosque
    const counter = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.95, 0.7), darkWoodMat);
    counter.position.set(-1.0, 0.48, 28.5);
    counter.castShadow = true;
    kioskGroup.add(counter);
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1.8, 0.45), steelMat);
    shelf.position.set(1.5, 0.9, 32.1);
    shelf.castShadow = true;
    kioskGroup.add(shelf);
    // Telhado do quiosque
    const kioskRoofMesh = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.22, 6.6), gasStationRoofMat);
    kioskRoofMesh.position.set(0.5, 3.25, 29.7);
    kioskRoofMesh.castShadow = true;
    kioskGroup.add(kioskRoofMesh);
    northGroup.add(kioskGroup);

    // ─────────────────────────────────────────────────────────────────────────
    // 2) OFICINA MECÂNICA EM RUÍNAS (X: 22 a 34, Z: 18 a 32)
    // ─────────────────────────────────────────────────────────────────────────
    const workshopGroup = new THREE.Group();
    const corrugatedMat = new THREE.MeshStandardMaterial({ color: "#383f47", roughness: 0.88, metalness: 0.5 });
    const hydraMat = new THREE.MeshStandardMaterial({ color: "#22354a", roughness: 0.7, metalness: 0.8 });
    const carChassisMat = new THREE.MeshStandardMaterial({ color: "#662820", roughness: 0.92, metalness: 0.4 });

    // Paredes da oficina (galpão X: 23.4 a 33.6, Z: 20.4 a 31.2)
    const workshopWalls = [
      // Fundo Norte
      { x: 28.5, y: 1.8, z: 30.9, w: 10.2, h: 3.6, d: 0.35 },
      // Parede Oeste
      { x: 23.7, y: 1.8, z: 25.8, w: 0.35, h: 3.6, d: 10.8 },
      // Parede Leste
      { x: 33.3, y: 1.8, z: 25.8, w: 0.35, h: 3.6, d: 10.8 },
      // Frente Sul (vão de portão rolante em X: [26.2, 30.8])
      { x: 24.8, y: 1.8, z: 20.7, w: 2.8, h: 3.6, d: 0.35 },
      { x: 32.2, y: 1.8, z: 20.7, w: 2.8, h: 3.6, d: 0.35 },
    ];
    for (const ww of workshopWalls) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(ww.w, ww.h, ww.d), corrugatedMat);
      wall.position.set(ww.x, ww.y, ww.z);
      wall.castShadow = true;
      wall.receiveShadow = true;
      workshopGroup.add(wall);
    }
    // Portão rolante meio aberto no vão
    const rollGate = new THREE.Mesh(new THREE.BoxGeometry(4.8, 1.2, 0.12), steelMat);
    rollGate.position.set(28.5, 3.0, 20.7);
    rollGate.castShadow = true;
    workshopGroup.add(rollGate);

    // Elevador automotivo de 2 colunas com chassi içado inclinado
    const liftCol1 = new THREE.Mesh(new THREE.BoxGeometry(0.35, 3.2, 0.35), hydraMat);
    liftCol1.position.set(27.3, 1.6, 25.8);
    const liftCol2 = new THREE.Mesh(new THREE.BoxGeometry(0.35, 3.2, 0.35), hydraMat);
    liftCol2.position.set(29.7, 1.6, 25.8);
    liftCol1.castShadow = true;
    liftCol2.castShadow = true;
    workshopGroup.add(liftCol1, liftCol2);

    // Chassi de carro enferrujado erguido
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.7, 3.8), carChassisMat);
    chassis.position.set(28.5, 1.85, 25.8);
    chassis.rotation.z = 0.14;
    chassis.castShadow = true;
    workshopGroup.add(chassis);

    // Bancada de ferramentas de aço no fundo
    const toolBench = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.95, 0.9), steelMat);
    toolBench.position.set(26.5, 0.48, 30.1);
    toolBench.castShadow = true;
    workshopGroup.add(toolBench);

    // Cilindros de solda (oxigênio verde e acetileno azul)
    const cyl1 = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.35, 8), new THREE.MeshStandardMaterial({ color: "#255c32", roughness: 0.6 }));
    cyl1.position.set(24.3, 0.68, 30.2);
    const cyl2 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.15, 8), new THREE.MeshStandardMaterial({ color: "#224b7a", roughness: 0.6 }));
    cyl2.position.set(24.7, 0.58, 30.2);
    cyl1.castShadow = true;
    cyl2.castShadow = true;
    workshopGroup.add(cyl1, cyl2);

    // Telhado de chapa ondulada da oficina
    const wsRoofMesh = new THREE.Mesh(new THREE.BoxGeometry(10.6, 0.24, 11.2), workshopRoofMat);
    wsRoofMesh.position.set(28.5, 3.7, 25.8);
    wsRoofMesh.castShadow = true;
    workshopGroup.add(wsRoofMesh);
    northGroup.add(workshopGroup);

    // ─────────────────────────────────────────────────────────────────────────
    // 2.5) TRAILER RESIDENCIAL ABANDONADO (vão X: 39 a 45, Z: 23 a 28)
    // ─────────────────────────────────────────────────────────────────────────
    const camperGroup = new THREE.Group();
    camperGroup.position.set(41.8, 0, 25.6);
    const camperMat = new THREE.MeshStandardMaterial({ color: "#8a867b", roughness: 0.6, metalness: 0.4 });
    const camperBody = new THREE.Mesh(new THREE.BoxGeometry(5.2, 2.2, 2.6), camperMat);
    camperBody.position.y = 1.3;
    camperBody.castShadow = true;
    camperGroup.add(camperBody);

    // Janelas panorâmicas do trailer
    const camperWin = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.6), new THREE.MeshBasicMaterial({ color: "#111822" }));
    camperWin.position.set(0, 1.5, 1.31);
    camperGroup.add(camperWin);

    // Toldo de lona esticado na lateral
    const awningMat = new THREE.MeshStandardMaterial({ color: "#8b3a2a", roughness: 0.9, side: THREE.DoubleSide });
    const awning = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.6), awningMat);
    awning.position.set(0, 2.3, 2.1);
    awning.rotation.x = Math.PI / 4;
    camperGroup.add(awning);

    // Pequena fogueira com pedras ao lado do trailer
    const cFire = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.2, 8), darkWoodMat);
    cFire.position.set(-1.8, 0.1, 2.2);
    camperGroup.add(cFire);

    northGroup.add(camperGroup);

    // ─────────────────────────────────────────────────────────────────────────
    // 3) ACAMPAMENTO DE SOBREVIVENTES (X: 50 a 64, Z: 18 a 32)
    // ─────────────────────────────────────────────────────────────────────────
    const campGroup = new THREE.Group();
    const canvasTanMat = new THREE.MeshStandardMaterial({ color: "#827558", roughness: 0.95, side: THREE.DoubleSide });
    const canvasOliveMat = new THREE.MeshStandardMaterial({ color: "#3d4832", roughness: 0.95, side: THREE.DoubleSide });

    // Helper: Tenda militar triangular
    const makeTent = (x: number, z: number, rotY: number, mat: THREE.Material) => {
      const t = new THREE.Group();
      t.position.set(x, 0, z);
      t.rotation.y = rotY;
      const tentGeo = new THREE.ConeGeometry(2.2, 2.2, 4);
      tentGeo.rotateY(Math.PI / 4);
      const tentMesh = new THREE.Mesh(tentGeo, mat);
      tentMesh.scale.set(1.1, 1.0, 1.5);
      tentMesh.position.y = 1.1;
      tentMesh.castShadow = true;
      t.add(tentMesh);
      campGroup.add(t);
    };
    makeTent(58.0, 28.5, 0.15, canvasTanMat);
    makeTent(61.5, 22.0, -0.3, canvasOliveMat);

    // Torre de vigia improvisada de madeira (X: 52.0, Z: 28.0)
    const tower = new THREE.Group();
    tower.position.set(52.0, 0, 28.0);
    const legGeo = new THREE.CylinderGeometry(0.12, 0.15, 3.4, 6);
    for (const [lx, lz] of [
      [0.9, 0.9],
      [-0.9, 0.9],
      [0.9, -0.9],
      [-0.9, -0.9],
    ]) {
      const leg = new THREE.Mesh(legGeo, darkWoodMat);
      leg.position.set(lx!, 1.7, lz!);
      leg.castShadow = true;
      tower.add(leg);
    }
    const platform = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.15, 2.3), darkWoodMat);
    platform.position.y = 3.4;
    platform.castShadow = true;
    tower.add(platform);
    campGroup.add(tower);

    // Fogueira com caldeirão e toras
    const campFire = new THREE.Group();
    campFire.position.set(56.5, 0, 24.5);
    const firePit = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.75, 0.2, 10), concreteMat);
    firePit.position.y = 0.1;
    campFire.add(firePit);
    const coals = new THREE.Mesh(new THREE.CircleGeometry(0.55, 8), new THREE.MeshBasicMaterial({ color: 0xff4800 }));
    coals.rotation.x = -Math.PI / 2;
    coals.position.y = 0.21;
    campFire.add(coals);
    const campLight = new THREE.PointLight(0xff6a22, 1.2, 8, 2);
    campLight.position.set(0, 0.8, 0);
    campFire.add(campLight);
    campGroup.add(campFire);
    northGroup.add(campGroup);

    // ─────────────────────────────────────────────────────────────────────────
    // 3.5) BLINDADO DE TRANSPORTE TOMBADO E BLOQUEIO (vão X: 68 a 76, Z: 22 a 28)
    // ─────────────────────────────────────────────────────────────────────────
    const vanGroup = new THREE.Group();
    vanGroup.position.set(72.2, 1.1, 26.0);
    vanGroup.rotation.z = Math.PI / 2; // Tombado lateralmente
    const vanBody = new THREE.Mesh(new THREE.BoxGeometry(2.2, 4.6, 2.0), new THREE.MeshStandardMaterial({ color: "#2d333b", roughness: 0.85, metalness: 0.5 }));
    vanBody.castShadow = true;
    vanGroup.add(vanBody);
    northGroup.add(vanGroup);

    // Barricadas policiais de madeira e aço
    for (const bz of [22.4, 23.8]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.9, 0.2), new THREE.MeshStandardMaterial({ color: "#b58728", roughness: 0.8 }));
      bar.position.set(69.0, 0.45, bz);
      bar.castShadow = true;
      northGroup.add(bar);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4) SUBESTAÇÃO ELÉTRICA & CABINE DE CONTROLE (X: 82 a 98, Z: 18 a 34)
    // ─────────────────────────────────────────────────────────────────────────
    const subGroup = new THREE.Group();
    const transGreenMat = new THREE.MeshStandardMaterial({ color: "#253b2d", roughness: 0.8, metalness: 0.6 });
    const insulRedMat = new THREE.MeshStandardMaterial({ color: "#8a241e", roughness: 0.5 });

    // 2 Transformadores pesados de alta tensão
    for (const tx of [85.8, 91.8]) {
      const tr = new THREE.Group();
      tr.position.set(tx, 0, 24.8);
      const core = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.2, 2.2), transGreenMat);
      core.position.y = 1.1;
      core.castShadow = true;
      tr.add(core);

      // Aletas de resfriamento e isoladores cerâmicos
      for (const ix of [-0.6, 0, 0.6]) {
        const ins = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.75, 6), insulRedMat);
        ins.position.set(ix, 2.55, 0);
        ins.castShadow = true;
        tr.add(ins);
      }
      subGroup.add(tr);
    }

    // Cabine de controle e distribuição TRANSITÁVEL com porta aberta e interior
    const controlGroup = new THREE.Group();

    // Piso de concreto industrial
    const shedFloor = new THREE.Mesh(new THREE.BoxGeometry(7.0, 0.16, 4.6), concreteMat);
    shedFloor.position.set(88.5, 0.08, 30.7);
    shedFloor.receiveShadow = true;
    controlGroup.add(shedFloor);

    // Paredes da cabine (porta aberta no centro sul em X: [87.5, 89.5])
    const shedWallMat = new THREE.MeshStandardMaterial({ color: "#3a3c3f", roughness: 0.9 });
    const shedWalls = [
      // Fundo Norte
      { x: 88.5, y: 1.5, z: 32.7, w: 7.0, h: 3.0, d: 0.35 },
      // Lateral Oeste
      { x: 85.3, y: 1.5, z: 30.7, w: 0.35, h: 3.0, d: 4.2 },
      // Lateral Leste
      { x: 91.7, y: 1.5, z: 30.7, w: 0.35, h: 3.0, d: 4.2 },
      // Frente Sul (lado esquerdo)
      { x: 86.4, y: 1.5, z: 28.7, w: 2.4, h: 3.0, d: 0.35 },
      // Frente Sul (lado direito)
      { x: 90.7, y: 1.5, z: 28.7, w: 2.2, h: 3.0, d: 0.35 },
      // Viga sobre a porta
      { x: 88.5, y: 2.7, z: 28.7, w: 2.2, h: 0.6, d: 0.35 },
    ];
    for (const sw of shedWalls) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(sw.w, sw.h, sw.d), shedWallMat);
      wall.position.set(sw.x, sw.y, sw.z);
      wall.castShadow = true;
      wall.receiveShadow = true;
      controlGroup.add(wall);
    }

    // Interior da cabine: racks de baterias, console de comando e lâmpada
    const batteryRack = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.8, 2.2), steelMat);
    batteryRack.position.set(86.1, 0.9, 30.7);
    batteryRack.castShadow = true;
    controlGroup.add(batteryRack);

    const consoleDesk = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.9, 0.9), steelMat);
    consoleDesk.position.set(89.5, 0.45, 31.9);
    consoleDesk.castShadow = true;
    controlGroup.add(consoleDesk);

    // Monitores CRT antigos sobre o console
    const crtMonitor = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.4), new THREE.MeshStandardMaterial({ color: "#222" }));
    crtMonitor.position.set(89.5, 1.15, 31.9);
    const screenGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.35), new THREE.MeshBasicMaterial({ color: "#2a7a44" }));
    screenGlow.position.set(89.5, 1.15, 31.69);
    controlGroup.add(crtMonitor, screenGlow);

    // Lâmpada de teto industrial protegida por gaiola amarela
    const subLight = new THREE.PointLight("#ffcc44", 1.4, 7.0);
    subLight.position.set(88.5, 2.6, 30.7);
    controlGroup.add(subLight);

    // Telhado da cabine de controle com fade dinâmico
    const shedRoof = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.22, 5.0), substationRoofMat);
    shedRoof.position.set(88.5, 3.1, 30.7);
    shedRoof.castShadow = true;
    controlGroup.add(shedRoof);

    subGroup.add(controlGroup);
    northGroup.add(subGroup);

    this.group.add(northGroup);
    return { gasStationRoofMat, gasStationCanopyRoofMat, signPlaqueMat, workshopRoofMat, settlerRoofMat, substationRoofMat };
  }

  /**
   * Constrói as estruturas pós-apocalípticas no Setor Sul expandido (Z: -34 a -14):
   * 1) Lanchonete Abandonada "Rusty Diner" (prédio retro streamliner, balcão curvo, banquetas, jukebox, pátio).
   * 2) Pátio de Contêineres de Carga & Cais de Abastecimento (5 grandes contêineres marítimos formando labirinto tático).
   * 3) Silo Agrícola, Tubos Gigantes de Concreto e Trator Pesado com Arado.
   * 4) Depósito Militar de Suprimentos & Casamata Blindada C.E.D.A.
   */
  private buildExpandedSouthScenery(): {
    dinerRoofMat: THREE.MeshStandardMaterial;
    bunkerRoofMat: THREE.MeshStandardMaterial;
    hunterRoofMat: THREE.MeshStandardMaterial;
  } {
    const southGroup = new THREE.Group();
    southGroup.name = "ExpandedSouthScenery";

    // Materiais compartilhados do setor sul
    const steelMat = new THREE.MeshStandardMaterial({ color: "#282a2d", roughness: 0.85, metalness: 0.6 });
    const rustMetalMat = new THREE.MeshStandardMaterial({ color: "#3a281c", roughness: 0.9, metalness: 0.5 });
    const concreteMat = new THREE.MeshStandardMaterial({ color: "#484846", roughness: 0.9 });
    const darkWoodMat = new THREE.MeshStandardMaterial({ color: "#2d2319", roughness: 0.95 });
    const woodLogMat = new THREE.MeshStandardMaterial({ color: "#38281b", roughness: 0.95 });
    const stoneMat = new THREE.MeshStandardMaterial({ color: "#524e49", roughness: 0.92 });

    // Telhados com transparência dinâmica
    const dinerRoofMat = new THREE.MeshStandardMaterial({
      color: "#22272c",
      roughness: 0.85,
      transparent: true,
      opacity: 1.0,
      side: THREE.DoubleSide,
    });
    const bunkerRoofMat = new THREE.MeshStandardMaterial({
      color: "#303233",
      roughness: 0.95,
      transparent: true,
      opacity: 1.0,
      side: THREE.DoubleSide,
    });
    const hunterRoofMat = new THREE.MeshStandardMaterial({
      color: "#241a14",
      roughness: 0.95,
      transparent: true,
      opacity: 1.0,
      side: THREE.DoubleSide,
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 0) CABANA DO CAÇADOR DO SUL (X: -23.5 a -15.5, Z: -31.2 a -23.0)
    // ─────────────────────────────────────────────────────────────────────────
    const hunterGroup = new THREE.Group();

    // Piso rústico de toras escuras
    const hFloor = new THREE.Mesh(new THREE.BoxGeometry(8.0, 0.16, 8.2), darkWoodMat);
    hFloor.position.set(-19.5, 0.08, -27.1);
    hFloor.receiveShadow = true;
    hunterGroup.add(hFloor);

    // Deck da varanda frontal voltada para o norte
    const hPorch = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.16, 2.2), darkWoodMat);
    hPorch.position.set(-19.5, 0.08, -21.9);
    hPorch.receiveShadow = true;
    hunterGroup.add(hPorch);

    // Postes da varanda
    for (const px of [-21.4, -17.6]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.8, 0.18), woodLogMat);
      p.position.set(px, 1.4, -21.0);
      p.castShadow = true;
      hunterGroup.add(p);
    }

    // Paredes de toras de madeira (vão de porta na face norte em X: [-20.5, -18.5])
    const hWalls = [
      // Fundo Sul
      { x: -19.5, y: 1.6, z: -30.9, w: 8.0, h: 3.2, d: 0.35 },
      // Lateral Oeste
      { x: -23.2, y: 1.6, z: -27.1, w: 0.35, h: 3.2, d: 7.6 },
      // Lateral Leste
      { x: -15.8, y: 1.6, z: -27.1, w: 0.35, h: 3.2, d: 7.6 },
      // Frente Norte (lado esquerdo)
      { x: -22.0, y: 1.6, z: -23.3, w: 2.5, h: 3.2, d: 0.35 },
      // Frente Norte (lado direito)
      { x: -17.0, y: 1.6, z: -23.3, w: 2.5, h: 3.2, d: 0.35 },
      // Viga sobre a porta
      { x: -19.5, y: 2.85, z: -23.3, w: 2.5, h: 0.7, d: 0.35 },
    ];
    for (const hw of hWalls) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(hw.w, hw.h, hw.d), woodLogMat);
      wall.position.set(hw.x, hw.y, hw.z);
      wall.castShadow = true;
      wall.receiveShadow = true;
      hunterGroup.add(wall);
    }

    // Interior da cabana: lareira de pedra com fogo acolhedor, cama e mesa
    const fireplace = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.4, 1.2), stoneMat);
    fireplace.position.set(-19.5, 1.2, -30.0);
    fireplace.castShadow = true;
    hunterGroup.add(fireplace);

    const fCavity = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.1, 0.7), new THREE.MeshBasicMaterial({ color: "#111" }));
    fCavity.position.set(-19.5, 0.65, -29.6);
    hunterGroup.add(fCavity);

    const fLight = new THREE.PointLight("#ff6622", 1.8, 9.0);
    fLight.position.set(-19.5, 0.7, -29.3);
    hunterGroup.add(fLight);

    // Cama de caçador no canto sul-leste
    const hCot = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.35, 2.0), darkWoodMat);
    hCot.position.set(-17.5, 0.25, -29.5);
    hCot.castShadow = true;
    hunterGroup.add(hCot);

    // Mesa de madeira redonda com bancos de tronco
    const hTable = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.75, 10), darkWoodMat);
    hTable.position.set(-21.0, 0.38, -26.5);
    hTable.castShadow = true;
    hunterGroup.add(hTable);

    // Telhado de toras inclinadas com fade dinâmico
    const hRoofG = new THREE.Group();
    const hSlopeLen = Math.hypot(4.4, 1.2);
    const hSlopeAngle = Math.atan2(1.2, 4.4);
    // Água Oeste
    const hRoofW = new THREE.Mesh(new THREE.BoxGeometry(hSlopeLen, 0.14, 8.8), hunterRoofMat);
    hRoofW.position.set(-21.6, 3.7, -27.1);
    hRoofW.rotation.z = hSlopeAngle;
    hRoofW.castShadow = true;
    // Água Leste
    const hRoofE = new THREE.Mesh(new THREE.BoxGeometry(hSlopeLen, 0.14, 8.8), hunterRoofMat);
    hRoofE.position.set(-17.4, 3.7, -27.1);
    hRoofE.rotation.z = -hSlopeAngle;
    hRoofE.castShadow = true;
    hRoofG.add(hRoofW, hRoofE);
    hunterGroup.add(hRoofG);

    southGroup.add(hunterGroup);

    // ─────────────────────────────────────────────────────────────────────────
    // 1) LANCHONETE ABANDONADA "RUSTY DINER" (X: -6 a 6, Z: -32 a -18)
    // ─────────────────────────────────────────────────────────────────────────
    const dinerGroup = new THREE.Group();
    const dinerTurquoiseMat = new THREE.MeshStandardMaterial({ color: "#2b5658", roughness: 0.78, metalness: 0.25 });
    const dinerChromeMat = new THREE.MeshStandardMaterial({ color: "#7a878c", roughness: 0.45, metalness: 0.75 });
    const dinerRedVinylMat = new THREE.MeshStandardMaterial({ color: "#781c20", roughness: 0.65 });

    // Paredes da Lanchonete (X: -4.2 a 4.2, Z: -31.2 a -23.8, H: 3.2)
    const dinerWalls = [
      // Fundo Sul
      { x: 0, y: 1.6, z: -30.9, w: 8.4, h: 3.2, d: 0.35 },
      // Parede Oeste
      { x: -3.9, y: 1.6, z: -27.5, w: 0.35, h: 3.2, d: 7.4 },
      // Parede Leste
      { x: 3.9, y: 1.6, z: -27.5, w: 0.35, h: 3.2, d: 7.4 },
      // Frente Norte (vão de porta em X: [-0.5, 1.8])
      { x: -2.3, y: 1.6, z: -24.1, w: 3.6, h: 3.2, d: 0.35 },
      { x: 2.9, y: 1.6, z: -24.1, w: 2.2, h: 3.2, d: 0.35 },
    ];
    for (const dw of dinerWalls) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(dw.w, dw.h, dw.d), dinerTurquoiseMat);
      wall.position.set(dw.x, dw.y, dw.z);
      wall.castShadow = true;
      wall.receiveShadow = true;
      dinerGroup.add(wall);
    }
    // Friso de alumínio horizontal contornando a fachada
    const chromeTrim = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.14, 0.45), dinerChromeMat);
    chromeTrim.position.set(0, 2.2, -24.05);
    dinerGroup.add(chromeTrim);

    // Balcão do diner em ferradura
    const dinerCounter = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.95, 0.75), dinerChromeMat);
    dinerCounter.position.set(0, 0.48, -28.0);
    dinerCounter.castShadow = true;
    dinerGroup.add(dinerCounter);

    // 4 Banquetas de bar com topo de vinil vermelho
    for (let i = 0; i < 4; i++) {
      const stool = new THREE.Group();
      stool.position.set(-1.5 + i * 1.0, 0, -26.8);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.65, 8), dinerChromeMat);
      post.position.y = 0.33;
      const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.12, 12), dinerRedVinylMat);
      seat.position.y = 0.68;
      stool.add(post, seat);
      stool.castShadow = true;
      dinerGroup.add(stool);
    }

    // Jukebox clássica no canto noroeste
    const jukebox = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.6, 0.65), new THREE.MeshStandardMaterial({ color: "#82321e", roughness: 0.6 }));
    jukebox.position.set(-3.1, 0.8, -25.2);
    jukebox.castShadow = true;
    dinerGroup.add(jukebox);

    // Letreiro torto no telhado: "DINER"
    const signBoard = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.85, 0.14), dinerChromeMat);
    signBoard.position.set(0, 3.8, -24.1);
    signBoard.rotation.z = -0.08;
    dinerGroup.add(signBoard);

    // Telhado do diner
    const dinerRoofMesh = new THREE.Mesh(new THREE.BoxGeometry(8.8, 0.24, 7.8), dinerRoofMat);
    dinerRoofMesh.position.set(0, 3.3, -27.5);
    dinerRoofMesh.castShadow = true;
    dinerGroup.add(dinerRoofMesh);
    southGroup.add(dinerGroup);

    // ─────────────────────────────────────────────────────────────────────────
    // 2) PÁTIO DE CONTÊINERES DE CARGA (X: 22 a 34, Z: -32 a -18)
    // ─────────────────────────────────────────────────────────────────────────
    const containerGroup = new THREE.Group();
    const cRedMat = new THREE.MeshStandardMaterial({ color: "#6a251e", roughness: 0.85, metalness: 0.4 });
    const cBlueMat = new THREE.MeshStandardMaterial({ color: "#223d54", roughness: 0.85, metalness: 0.4 });
    const cYellowMat = new THREE.MeshStandardMaterial({ color: "#7a6224", roughness: 0.88, metalness: 0.4 });
    const cGreenMat = new THREE.MeshStandardMaterial({ color: "#2d4228", roughness: 0.88, metalness: 0.4 });

    // Helper: Contêiner industrial de carga de 20 pés (6.0m x 2.4m x 2.6m)
    const makeContainer = (x: number, y: number, z: number, rotY: number, mat: THREE.Material) => {
      const c = new THREE.Group();
      c.position.set(x, y + 1.3, z);
      c.rotation.y = rotY;

      // Caixa principal
      const box = new THREE.Mesh(new THREE.BoxGeometry(6.0, 2.58, 2.4), mat);
      box.castShadow = true;
      box.receiveShadow = true;
      c.add(box);

      // Frisos estruturais externos (quinas de ferro)
      const frame = new THREE.Mesh(new THREE.BoxGeometry(6.06, 2.62, 2.44), steelMat);
      frame.scale.set(0.99, 0.99, 0.99);
      c.add(frame);

      containerGroup.add(c);
    };

    // Layout tático dos 5 contêineres formando labirinto
    makeContainer(25.0, 0, -23.0, 0, cRedMat); // Vermelho base
    makeContainer(31.5, 0, -23.0, 0, cBlueMat); // Azul base
    makeContainer(27.5, 0, -27.4, 0, cYellowMat); // Amarelo atravessado
    makeContainer(25.0, 2.6, -23.0, 0, cBlueMat); // Azul empilhado em cima do vermelho!
    makeContainer(31.5, 0, -31.3, 0, cGreenMat); // Verde militar com caixas

    // Enorme carretel de cabos industriais tombado
    const spool = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.1, 12), darkWoodMat);
    spool.rotation.x = Math.PI / 2;
    spool.position.set(23.2, 0.9, -29.5);
    spool.castShadow = true;
    containerGroup.add(spool);

    southGroup.add(containerGroup);

    // ─────────────────────────────────────────────────────────────────────────
    // 2.5) OFICINA ABERTA DE SUCATAS & GERADOR DIESEL (vão X: 39 a 45, Z: -28 a -23)
    // ─────────────────────────────────────────────────────────────────────────
    const scrapWorkshopGroup = new THREE.Group();
    scrapWorkshopGroup.position.set(42.2, 0, -25.8);

    // Cobertura de chapas de zinco onduladas sobre 4 pilares I-beam
    const shedPillarGeo = new THREE.BoxGeometry(0.18, 3.0, 0.18);
    for (const [px, pz] of [
      [-2.4, -1.8],
      [2.4, -1.8],
      [-2.4, 1.8],
      [2.4, 1.8],
    ]) {
      const sp = new THREE.Mesh(shedPillarGeo, steelMat);
      sp.position.set(px!, 1.5, pz!);
      sp.castShadow = true;
      scrapWorkshopGroup.add(sp);
    }
    const tinRoof = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.12, 4.2), rustMetalMat);
    tinRoof.position.set(0, 3.05, 0);
    tinRoof.rotation.x = 0.08;
    tinRoof.castShadow = true;
    scrapWorkshopGroup.add(tinRoof);

    // Gerador industrial a diesel com fiação e escapamento
    const generator = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 1.2), new THREE.MeshStandardMaterial({ color: "#294336", roughness: 0.7 }));
    generator.position.set(-1.2, 0.6, -0.6);
    generator.castShadow = true;
    scrapWorkshopGroup.add(generator);

    // Bancada de trabalho com morsa e peças
    const wBench = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.9, 0.8), darkWoodMat);
    wBench.position.set(1.1, 0.45, -0.8);
    wBench.castShadow = true;
    scrapWorkshopGroup.add(wBench);

    // Pilha de pneus de caminhão
    for (let t = 0; t < 3; t++) {
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.28, 12), new THREE.MeshStandardMaterial({ color: "#161616", roughness: 0.95 }));
      tire.position.set(1.4, 0.14 + t * 0.28, 1.1);
      tire.castShadow = true;
      scrapWorkshopGroup.add(tire);
    }

    southGroup.add(scrapWorkshopGroup);

    // ─────────────────────────────────────────────────────────────────────────
    // 3) SILO AGRÍCOLA, TRATOR PESADO E TUBOS DE DRENAGEM (X: 50 a 64, Z: -32 a -18)
    // ─────────────────────────────────────────────────────────────────────────
    const farmGroup = new THREE.Group();
    const siloMat = new THREE.MeshStandardMaterial({ color: "#6e757c", roughness: 0.75, metalness: 0.6 });
    const tractorRedMat = new THREE.MeshStandardMaterial({ color: "#8a241e", roughness: 0.85, metalness: 0.5 });
    const tireRubberMat = new THREE.MeshStandardMaterial({ color: "#141414", roughness: 0.95 });

    // Silo Cilíndrico de Grãos (X: 53.5, Z: -24.5)
    const silo = new THREE.Group();
    silo.position.set(53.5, 0, -24.5);
    const siloBody = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 6.0, 16), siloMat);
    siloBody.position.y = 3.0;
    siloBody.castShadow = true;
    silo.add(siloBody);
    const siloCap = new THREE.Mesh(new THREE.ConeGeometry(2.1, 1.2, 16), siloMat);
    siloCap.position.y = 6.6;
    siloCap.castShadow = true;
    silo.add(siloCap);
    farmGroup.add(silo);

    // Trator Agrícola Pesado Vermelho (X: 59.8, Z: -25.0)
    const tractor = new THREE.Group();
    tractor.position.set(59.8, 0, -25.0);
    tractor.rotation.y = -0.25;

    // Chassi e capô do trator
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 2.6), tractorRedMat);
    hood.position.set(0, 1.1, 0.3);
    hood.castShadow = true;
    tractor.add(hood);

    // Rodas traseiras gigantes
    const bigWheelGeo = new THREE.CylinderGeometry(0.9, 0.9, 0.45, 14);
    bigWheelGeo.rotateZ(Math.PI / 2);
    const rwL = new THREE.Mesh(bigWheelGeo, tireRubberMat);
    rwL.position.set(1.0, 0.9, -0.7);
    rwL.castShadow = true;
    const rwR = new THREE.Mesh(bigWheelGeo, tireRubberMat);
    rwR.position.set(-1.0, 0.9, -0.7);
    rwR.castShadow = true;
    tractor.add(rwL, rwR);

    // Rodas dianteiras menores
    const smallWheelGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.32, 12);
    smallWheelGeo.rotateZ(Math.PI / 2);
    const fwL = new THREE.Mesh(smallWheelGeo, tireRubberMat);
    fwL.position.set(0.8, 0.48, 1.3);
    fwL.castShadow = true;
    const fwR = new THREE.Mesh(smallWheelGeo, tireRubberMat);
    fwR.position.set(-0.8, 0.48, 1.3);
    fwR.castShadow = true;
    tractor.add(fwL, fwR);

    // Escapamento vertical
    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.4, 8), steelMat);
    exhaust.position.set(0.55, 2.0, 1.1);
    tractor.add(exhaust);

    // Arado de lâminas enferrujadas engatado na traseira
    const plow = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.45, 0.8), rustMetalMat);
    plow.position.set(0, 0.45, -1.6);
    plow.castShadow = true;
    tractor.add(plow);
    farmGroup.add(tractor);

    // 2 Tubos gigantescos de drenagem de concreto (X: 55.0, Z: -30.2)
    for (const [tx, tz] of [
      [54.0, -30.2],
      [58.2, -30.2],
    ]) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 3.6, 14, 1, true), concreteMat);
      pipe.rotation.z = Math.PI / 2;
      pipe.position.set(tx!, 1.1, tz!);
      pipe.castShadow = true;
      pipe.receiveShadow = true;
      farmGroup.add(pipe);
    }
    southGroup.add(farmGroup);

    // ─────────────────────────────────────────────────────────────────────────
    // 3.5) ESTÁBULO / CELEIRO EM RUÍNAS (vão X: 68 a 76, Z: -29 a -24)
    // ─────────────────────────────────────────────────────────────────────────
    const barnGroup = new THREE.Group();
    barnGroup.position.set(72.5, 0, -26.5);

    // Divisórias de baias e vigas carcomidas
    const stallWoodMat = new THREE.MeshStandardMaterial({ color: "#3f3024", roughness: 0.95 });
    for (const sx of [-1.8, 0, 1.8]) {
      const fencePost = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.2, 0.18), stallWoodMat);
      fencePost.position.set(sx, 1.1, -1.5);
      fencePost.castShadow = true;
      barnGroup.add(fencePost);
    }
    const rails = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.9, 0.12), stallWoodMat);
    rails.position.set(0, 0.65, -1.5);
    rails.castShadow = true;
    barnGroup.add(rails);

    // Fardos de feno redondos dourados
    const hayMat = new THREE.MeshStandardMaterial({ color: "#8a7536", roughness: 0.95 });
    for (const [hx, hz] of [
      [-1.2, 0.6],
      [1.1, 0.8],
      [0.0, 1.2],
    ]) {
      const hay = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 1.1, 10), hayMat);
      hay.rotation.x = Math.PI / 2;
      hay.position.set(hx!, 0.65, hz!);
      hay.castShadow = true;
      barnGroup.add(hay);
    }

    // Bebedouro de água enferrujado
    const trough = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 0.8), steelMat);
    trough.position.set(0, 0.25, -0.2);
    trough.castShadow = true;
    barnGroup.add(trough);

    southGroup.add(barnGroup);

    // ─────────────────────────────────────────────────────────────────────────
    // 4) DEPÓSITO MILITAR DE SUPRIMENTOS & CASAMATA BLINDADA C.E.D.A. (X: 82 a 98, Z: -34 a -18)
    // ─────────────────────────────────────────────────────────────────────────
    const bunkerGroup = new THREE.Group();

    // Piso de chapa de aço xadrez reforçada
    const bFloor = new THREE.Mesh(new THREE.BoxGeometry(9.0, 0.16, 7.0), steelMat);
    bFloor.position.set(89.5, 0.08, -29.0);
    bFloor.receiveShadow = true;
    bunkerGroup.add(bFloor);

    // Paredes de concreto blindado com vão de porta frontal na face norte em X: [88.5, 90.7]
    const bunkerWallMat = new THREE.MeshStandardMaterial({ color: "#363a3d", roughness: 0.92 });
    const bWalls = [
      // Fundo Sul
      { x: 89.5, y: 1.5, z: -32.2, w: 9.0, h: 3.0, d: 0.45 },
      // Lateral Oeste
      { x: 85.3, y: 1.5, z: -29.0, w: 0.45, h: 3.0, d: 6.4 },
      // Lateral Leste
      { x: 93.7, y: 1.5, z: -29.0, w: 0.45, h: 3.0, d: 6.4 },
      // Frente Norte (lado esquerdo)
      { x: 86.8, y: 1.5, z: -25.8, w: 3.5, h: 3.0, d: 0.45 },
      // Frente Norte (lado direito)
      { x: 92.4, y: 1.5, z: -25.8, w: 3.2, h: 3.0, d: 0.45 },
      // Viga sobre a porta blindada
      { x: 89.6, y: 2.7, z: -25.8, w: 2.2, h: 0.6, d: 0.45 },
    ];
    for (const bw of bWalls) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(bw.w, bw.h, bw.d), bunkerWallMat);
      wall.position.set(bw.x, bw.y, bw.z);
      wall.castShadow = true;
      wall.receiveShadow = true;
      bunkerGroup.add(wall);
    }

    // Porta blindada de aço maciço aberta em ângulo de 60 graus
    const blastDoor = new THREE.Mesh(new THREE.BoxGeometry(2.1, 2.3, 0.22), steelMat);
    blastDoor.position.set(90.8, 1.15, -25.0);
    blastDoor.rotation.y = -Math.PI / 3;
    blastDoor.castShadow = true;
    bunkerGroup.add(blastDoor);

    // Interior da casamata: mesa tática de comando, beliches militares e armários
    const planTable = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.9, 1.3), steelMat);
    planTable.position.set(89.7, 0.45, -28.85);
    planTable.castShadow = true;
    bunkerGroup.add(planTable);

    // Mapa tático sobre a mesa com luz de emergência verde militar
    const mapPlane = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.0), new THREE.MeshBasicMaterial({ color: "#2d4d38" }));
    mapPlane.position.set(89.7, 0.91, -28.85);
    mapPlane.rotation.x = -Math.PI / 2;
    bunkerGroup.add(mapPlane);

    const bGlow = new THREE.PointLight("#33ff66", 1.5, 8.0);
    bGlow.position.set(89.7, 1.3, -28.85);
    bunkerGroup.add(bGlow);

    // Beliche militar duplo na parede oeste
    const bunkFrame = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.2, 2.6), steelMat);
    bunkFrame.position.set(86.3, 1.1, -29.8);
    bunkFrame.castShadow = true;
    bunkerGroup.add(bunkFrame);

    // Armários de aço e caixas de suprimentos na parede leste
    const bLocker = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.1, 2.2), steelMat);
    bLocker.position.set(92.9, 1.05, -30.0);
    bLocker.castShadow = true;
    bunkerGroup.add(bLocker);

    // Laje de teto do bunker com fade dinâmico
    const bunkerRoofMesh = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.35, 7.4), bunkerRoofMat);
    bunkerRoofMesh.position.set(89.5, 3.15, -29.0);
    bunkerRoofMesh.castShadow = true;
    bunkerGroup.add(bunkerRoofMesh);

    // Blindado APC Queimado (X: 80.0, Z: -24.4)
    const apcGroup = new THREE.Group();
    apcGroup.position.set(80.0, 0, -24.4);
    apcGroup.rotation.y = 0.35;
    const apcBody = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.4, 5.2), new THREE.MeshStandardMaterial({ color: "#2b2b2b", roughness: 0.95 }));
    apcBody.position.y = 1.2;
    apcBody.castShadow = true;
    apcGroup.add(apcBody);
    // 8 Rodas do blindado
    for (const zOff of [-1.8, -0.6, 0.6, 1.8]) {
      const wL = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.4, 10), tireRubberMat);
      wL.rotation.z = Math.PI / 2;
      wL.position.set(1.5, 0.5, zOff);
      const wR = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.4, 10), tireRubberMat);
      wR.rotation.z = Math.PI / 2;
      wR.position.set(-1.5, 0.5, zOff);
      apcGroup.add(wL, wR);
    }
    bunkerGroup.add(apcGroup);

    // Pilhas de caixas de munição militar (X: 95.5, Z: -26.0)
    const crateOliveMat = new THREE.MeshStandardMaterial({ color: "#3c4832", roughness: 0.85 });
    for (let c = 0; c < 6; c++) {
      const crateMesh = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 0.6), crateOliveMat);
      crateMesh.position.set(95.0 + (c % 2) * 0.95, 0.28 + Math.floor(c / 2) * 0.55, -26.0 + (c % 3) * 0.4);
      crateMesh.castShadow = true;
      bunkerGroup.add(crateMesh);
    }

    southGroup.add(bunkerGroup);

    this.group.add(southGroup);
    return { dinerRoofMat, bunkerRoofMat, hunterRoofMat };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 1) REDE ELÉTRICA EXPANDIDA: POSTES, FIAÇÃO SUSPENSA E POSTES CAÍDOS COM FAÍSCAS
  // ─────────────────────────────────────────────────────────────────────────────
  private buildExtendedPowerGrid(): void {
    const powerGroup = new THREE.Group();
    powerGroup.name = "ExtendedPowerGrid";

    const poleWoodMat = new THREE.MeshStandardMaterial({ color: "#2d2319", roughness: 0.95 });
    const darkCrossarmMat = new THREE.MeshStandardMaterial({ color: "#1c1510", roughness: 0.92 });
    const insMat = new THREE.MeshStandardMaterial({ color: "#eef2f5", roughness: 0.25, metalness: 0.1 });
    const wireMat = new THREE.MeshBasicMaterial({ color: "#080808" });
    const transfMat = new THREE.MeshStandardMaterial({ color: "#343b42", roughness: 0.6, metalness: 0.7 });
    const lampMat = new THREE.MeshStandardMaterial({ color: "#3a352e", roughness: 0.7, metalness: 0.5 });
    const splinterMat = new THREE.MeshStandardMaterial({ color: "#584430", roughness: 0.98 });
    const rustIronMat = new THREE.MeshStandardMaterial({ color: "#38291f", roughness: 0.85, metalness: 0.6 });

    // Helper: Cria um poste de madeira completo com cruzeta, isoladores e acessórios
    const makePole = (
      px: number,
      pz: number,
      opts?: { hasTransformer?: boolean; hasLamp?: boolean; lampAngle?: number },
    ): THREE.Group => {
      const g = new THREE.Group();
      g.position.set(px, 0, pz);

      // Tronco vertical roliço de 6.2m
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 6.2, 8), poleWoodMat);
      trunk.position.y = 3.1;
      trunk.castShadow = true;
      g.add(trunk);

      // Cruzeta horizontal no topo
      const crossarm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 2.4), darkCrossarmMat);
      crossarm.position.set(0, 5.7, 0);
      crossarm.castShadow = true;
      g.add(crossarm);

      // Braçadeiras / mãos-francesas de aço diagonais
      const braceGeo = new THREE.BoxGeometry(0.04, 0.85, 0.04);
      const b1 = new THREE.Mesh(braceGeo, rustIronMat);
      b1.position.set(0, 5.25, 0.45);
      b1.rotation.x = -0.55;
      const b2 = new THREE.Mesh(braceGeo, rustIronMat);
      b2.position.set(0, 5.25, -0.45);
      b2.rotation.x = 0.55;
      g.add(b1, b2);

      // 3 Isoladores cerâmicos vitrificados
      const insGeo = new THREE.CylinderGeometry(0.045, 0.05, 0.14, 6);
      for (const zOff of [-0.9, 0, 0.9]) {
        const ins = new THREE.Mesh(insGeo, insMat);
        ins.position.set(0, 5.84, zOff);
        g.add(ins);
      }

      // Degraus metálicos de escalada no poste
      const stepGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.28, 4);
      for (let s = 0; s < 6; s++) {
        const step = new THREE.Mesh(stepGeo, rustIronMat);
        const yPos = 1.8 + s * 0.65;
        const side = s % 2 === 0 ? 0.2 : -0.2;
        step.position.set(side, yPos, 0);
        step.rotation.z = Math.PI / 2;
        g.add(step);
      }

      // Transformador elétrico de alta tensão
      if (opts?.hasTransformer) {
        const transf = new THREE.Group();
        transf.position.set(0.32, 4.3, 0);

        const canister = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.85, 10), transfMat);
        canister.castShadow = true;
        transf.add(canister);

        // Aletas de dissipação e tampa
        const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 10), transfMat);
        lid.position.y = 0.45;
        transf.add(lid);

        // Buchas de saída de alta tensão no topo do transformador
        for (const bx of [-0.12, 0, 0.12]) {
          const bBush = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.15, 6), insMat);
          bBush.position.set(bx, 0.54, 0);
          transf.add(bBush);
        }
        g.add(transf);
      }

      // Luminária pública de rua enferrujada
      if (opts?.hasLamp) {
        const lamp = new THREE.Group();
        const lampRot = opts.lampAngle ?? (pz > 0 ? -Math.PI / 2 : Math.PI / 2);
        lamp.rotation.y = lampRot;
        lamp.position.set(0, 5.3, 0);

        // Tubo curvo de sustentação
        const armCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0.6, 0.3, 0),
          new THREE.Vector3(1.5, 0.2, 0),
          new THREE.Vector3(1.8, -0.1, 0),
        ]);
        const arm = new THREE.Mesh(new THREE.TubeGeometry(armCurve, 8, 0.03, 4, false), rustIronMat);
        lamp.add(arm);

        // Cúpula / chapéu da luminária
        const shade = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.2, 8), lampMat);
        shade.position.set(1.8, -0.2, 0);
        shade.rotation.x = Math.PI;
        lamp.add(shade);

        g.add(lamp);
      }

      return g;
    };

    // Helper: Cria fiação com catenária curva entre 2 pontos 3D
    const makeWire = (p1: THREE.Vector3, p2: THREE.Vector3, droop = 1.0): THREE.Mesh => {
      const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
      mid.y -= droop;
      const curve = new THREE.CatmullRomCurve3([p1, mid, p2]);
      const geo = new THREE.TubeGeometry(curve, 16, 0.018, 4, false);
      return new THREE.Mesh(geo, wireMat);
    };

    // ─── Linha de Postes Norte (Margem Norte da Rodovia) ───
    const northPoles: Array<[number, number, { hasTransformer?: boolean; hasLamp?: boolean }?]> = [
      [-26.0, 14.5],
      [-15.0, 14.2],
      [-3.0, 14.5, { hasTransformer: true }],
      [12.0, 14.5, { hasLamp: true }],
      [24.0, 14.5],
      [35.0, 14.5, { hasTransformer: true }],
      [53.0, 14.2],
      [73.0, 14.0, { hasLamp: true }],
      [88.0, 14.2, { hasTransformer: true }],
      [102.0, 14.0],
      [114.0, 14.0],
    ];

    for (const [px, pz, opts] of northPoles) {
      powerGroup.add(makePole(px, pz, opts));
    }

    // Fiação dupla suspensa entre os postes da linha Norte
    for (let i = 0; i < northPoles.length - 1; i++) {
      const [x1, z1] = northPoles[i]!;
      const [x2, z2] = northPoles[i + 1]!;
      const spanLen = Math.hypot(x2 - x1, z2 - z1);
      const droop = Math.min(1.4, Math.max(0.6, spanLen * 0.07));
      // Fio Norte externo (Z + 0.9)
      powerGroup.add(makeWire(new THREE.Vector3(x1, 5.84, z1 + 0.9), new THREE.Vector3(x2, 5.84, z2 + 0.9), droop));
      // Fio Norte interno (Z - 0.9)
      powerGroup.add(makeWire(new THREE.Vector3(x1, 5.84, z1 - 0.9), new THREE.Vector3(x2, 5.84, z2 - 0.9), droop * 0.9));
    }

    // ─── Linha de Postes Sul (Margem Sul da Rodovia e Bosque) ───
    const southPoles: Array<[number, number, { hasTransformer?: boolean; hasLamp?: boolean }?]> = [
      [-25.0, -14.2],
      [-12.0, -14.5, { hasTransformer: true }],
      [5.0, -14.5],
      [22.0, -14.2],
      [40.0, -14.0, { hasTransformer: true }],
      [60.0, -13.8],
      [82.0, -14.0, { hasLamp: true }],
      [104.0, -13.8],
    ];

    for (const [px, pz, opts] of southPoles) {
      powerGroup.add(makePole(px, pz, opts));
    }

    // Fiação dupla suspensa entre os postes da linha Sul
    for (let i = 0; i < southPoles.length - 1; i++) {
      const [x1, z1] = southPoles[i]!;
      const [x2, z2] = southPoles[i + 1]!;
      const spanLen = Math.hypot(x2 - x1, z2 - z1);
      const droop = Math.min(1.4, Math.max(0.6, spanLen * 0.07));
      powerGroup.add(makeWire(new THREE.Vector3(x1, 5.84, z1 + 0.9), new THREE.Vector3(x2, 5.84, z2 + 0.9), droop));
      powerGroup.add(makeWire(new THREE.Vector3(x1, 5.84, z1 - 0.9), new THREE.Vector3(x2, 5.84, z2 - 0.9), droop * 0.9));
    }

    // Fiação transversal cruzando a rodovia de Norte a Sul
    powerGroup.add(makeWire(new THREE.Vector3(12.0, 5.84, 14.5), new THREE.Vector3(5.0, 5.84, -14.5), 1.6));
    powerGroup.add(makeWire(new THREE.Vector3(88.0, 5.84, 14.2), new THREE.Vector3(82.0, 5.84, -14.0), 1.6));

    // ─────────────────────────────────────────────────────────────────────────
    // 2) POSTE CAÍDO COM FIOS COM FAÍSCA ELÉTRICA ATIVA (X: 36.8, Z: 9.8)
    // ─────────────────────────────────────────────────────────────────────────
    const fallenPoleGroup = new THREE.Group();
    fallenPoleGroup.position.set(36.8, 0, 9.8);

    // Toco quebrado no chão com farpas de madeira partidas
    const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.55, 8), poleWoodMat);
    stump.position.y = 0.27;
    stump.castShadow = true;
    fallenPoleGroup.add(stump);

    // Farpas do toco
    for (let sp = 0; sp < 4; sp++) {
      const splinter = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.25, 4), splinterMat);
      splinter.position.set((sp % 2 === 0 ? 0.08 : -0.08), 0.58, (sp > 1 ? 0.08 : -0.08));
      fallenPoleGroup.add(splinter);
    }

    // Poste principal caído inclinado contra o meio-fio/chão
    const fallenTrunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.23, 5.8, 8), poleWoodMat);
    fallenTrunk.position.set(-0.8, 0.45, -0.6);
    fallenTrunk.rotation.set(0.2, 0.45, 1.25);
    fallenTrunk.castShadow = true;
    fallenTrunk.receiveShadow = true;
    fallenPoleGroup.add(fallenTrunk);

    // Cruzeta quebrada encostada no chão
    const fallenCross = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 2.3), darkCrossarmMat);
    fallenCross.position.set(-2.8, 0.35, -1.4);
    fallenCross.rotation.set(0.6, 0.8, 0.3);
    fallenCross.castShadow = true;
    fallenPoleGroup.add(fallenCross);

    // Isolador cerâmico quebrado no chão
    const brokenIns = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.1, 5), insMat);
    brokenIns.position.set(-2.9, 0.05, -1.1);
    brokenIns.rotation.z = Math.PI / 2;
    fallenPoleGroup.add(brokenIns);

    // Fio elétrico rompido pendendo da cruzeta até o asfalto/chão
    const sparkWireCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-2.8, 0.4, -1.4),
      new THREE.Vector3(-2.0, 0.3, -1.1),
      new THREE.Vector3(-1.3, 0.15, -0.8),
      new THREE.Vector3(-0.65, 0.04, -0.65),
    ]);
    const sparkWire = new THREE.Mesh(new THREE.TubeGeometry(sparkWireCurve, 12, 0.022, 4, false), wireMat);
    fallenPoleGroup.add(sparkWire);

    // Mancha escura de queimado/chamuscado no solo sob o arco elétrico
    const scorchMat = new THREE.MeshBasicMaterial({ color: "#0c0c0c", transparent: true, opacity: 0.85, depthWrite: false });
    const scorchDecal = new THREE.Mesh(new THREE.CircleGeometry(0.75, 12), scorchMat);
    scorchDecal.position.set(-0.65, 0.014, -0.65);
    scorchDecal.rotation.x = -Math.PI / 2;
    fallenPoleGroup.add(scorchDecal);

    // Ponto de Luz Dinâmico das Faíscas Elétricas (azul/ciano intenso)
    this.sparkLight = new THREE.PointLight(0x70d6ff, 0, 7.5, 2);
    this.sparkLight.position.set(36.15, 0.22, 9.15);
    powerGroup.add(this.sparkLight);

    // Partículas de faísca (diamantes emissores que saltam)
    const sparkGeo = new THREE.OctahedronGeometry(0.045);
    const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (let p = 0; p < 8; p++) {
      const sp = new THREE.Mesh(sparkGeo, sparkMat);
      sp.visible = false;
      powerGroup.add(sp);
      this.sparkParticles.push(sp);
    }

    powerGroup.add(fallenPoleGroup);

    // ─── 3) Segundo Poste Caído (Setor Sul, perto do ônibus escolar tombado X: 70.5, Z: -9.5) ───
    const fallenPole2 = new THREE.Group();
    fallenPole2.position.set(70.5, 0, -9.5);

    const trunk2 = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.23, 6.0, 8), poleWoodMat);
    trunk2.position.set(0, 0.2, 0);
    trunk2.rotation.set(0.05, 0.4, Math.PI / 2);
    trunk2.castShadow = true;
    trunk2.receiveShadow = true;
    fallenPole2.add(trunk2);

    const cross2 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 2.2), darkCrossarmMat);
    cross2.position.set(2.8, 0.15, 0);
    cross2.rotation.y = 0.5;
    cross2.castShadow = true;
    fallenPole2.add(cross2);

    // Fio rompido enrolado no chão
    const coilCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(2.8, 0.15, 0),
      new THREE.Vector3(3.2, 0.04, 0.4),
      new THREE.Vector3(3.5, 0.04, 0.1),
      new THREE.Vector3(3.1, 0.04, -0.3),
      new THREE.Vector3(2.6, 0.04, -0.1),
    ]);
    fallenPole2.add(new THREE.Mesh(new THREE.TubeGeometry(coilCurve, 16, 0.016, 4, false), wireMat));

    powerGroup.add(fallenPole2);

    this.group.add(powerGroup);
  }

  /** Atualiza o piscar do arco elétrico e a dispersão de faíscas dinâmicas */
  private updateSparkEffects(dt: number): void {
    if (!this.sparkLight) return;

    this.sparkTimer -= dt;
    if (this.sparkTimer <= 0) {
      // Dispara uma rajada curta de faíscas (arco elétrico com duração de 0.12s a 0.34s)
      this.sparkBurstTime = 0.12 + Math.random() * 0.22;
      this.sparkTimer = 0.5 + Math.random() * 1.6;
    }

    if (this.sparkBurstTime > 0) {
      this.sparkBurstTime -= dt;
      // Luz intensa piscando em azul e branco
      this.sparkLight.intensity = 2.2 + Math.random() * 4.2;
      this.sparkLight.color.set(Math.random() > 0.3 ? 0x72dcff : 0xffffff);

      // Partículas de faísca saltando ao redor da ponta do fio
      const originX = 36.15;
      const originY = 0.08;
      const originZ = 9.15;
      for (const sp of this.sparkParticles) {
        sp.visible = true;
        const ang = Math.random() * Math.PI * 2;
        const dist = 0.04 + Math.random() * 0.35;
        const h = 0.02 + Math.random() * 0.35;
        sp.position.set(originX + Math.cos(ang) * dist, originY + h, originZ + Math.sin(ang) * dist);
        const s = 0.6 + Math.random() * 0.8;
        sp.scale.setScalar(s);
      }
    } else {
      // Estado inativo: luz apagada com raro zumbido
      this.sparkLight.intensity = Math.random() < 0.08 ? 0.35 : 0.0;
      for (const sp of this.sparkParticles) {
        sp.visible = false;
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2) VEGETAÇÃO RETOMANDO O ESPAÇO: ÁRVORES, TRONCOS CAÍDOS, RAÍZES E CIPÓS
  // ─────────────────────────────────────────────────────────────────────────────
  private buildOvergrownVegetation(): void {
    const vegGroup = new THREE.Group();
    vegGroup.name = "OvergrownVegetation";

    // ─── 1) Árvores Adicionais pela Paisagem ───
    const extraTrees: Array<[number, number, number, number]> = [
      [-28.0, -6.0, 301, 1.1],
      [-24.0, -15.0, 302, 1.2],
      [-20.0, 16.0, 303, 1.05],
      [-12.0, -10.0, 304, 1.15],
      [-9.0, 11.0, 305, 0.95],
      [-3.0, -8.0, 306, 1.0],
      [5.0, 10.0, 307, 1.1],
      [14.0, -10.0, 308, 1.25],
      [18.0, 11.0, 309, 1.0],
      [32.0, -10.0, 310, 1.15],
      [36.0, 12.0, 311, 0.95],
      [46.0, 11.0, 312, 1.05],
      [52.0, -12.0, 313, 1.2],
      [58.0, -10.0, 314, 1.0],
      [65.0, 11.0, 315, 1.1],
      [71.0, 12.0, 316, 0.9],
      [78.0, -10.0, 317, 1.2],
      [84.0, 12.0, 318, 1.05],
      [92.0, -11.0, 319, 1.15],
      [98.0, 12.0, 320, 1.0],
      [105.0, -11.0, 321, 1.25],
      [112.0, 10.0, 322, 1.1],
    ];
    for (const [tx, tz, seed, scale] of extraTrees) {
      vegGroup.add(this.makeTree(tx, tz, seed, scale, true));
    }

    // ─── 2) Troncos Caídos com Musgo e Cogumelos ───
    const logBarkMat = new THREE.MeshStandardMaterial({ color: "#241b15", roughness: 0.98 });
    const mossMat = new THREE.MeshStandardMaterial({ color: "#2d4e1e", roughness: 0.92 });
    const hollowMat = new THREE.MeshStandardMaterial({ color: "#130e0b", roughness: 1.0 });
    const fungusMat = new THREE.MeshStandardMaterial({ color: "#c4a478", roughness: 0.8 });

    const makeFallenLog = (
      lx: number,
      lz: number,
      len: number,
      radius: number,
      rotY: number,
      hasFungi = true,
    ): THREE.Group => {
      const g = new THREE.Group();
      g.position.set(lx, radius * 0.75, lz);
      g.rotation.y = rotY;

      // Tronco horizontal roliço
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.88, radius, len, 8), logBarkMat);
      trunk.rotation.z = Math.PI / 2;
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      g.add(trunk);

      // Cavidade oca na extremidade partida
      const cavity = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.45, radius * 0.5, 0.25, 6), hollowMat);
      cavity.position.set(len / 2 - 0.05, 0, 0);
      cavity.rotation.z = Math.PI / 2;
      g.add(cavity);

      // Camada de musgo aveludado na crista superior do tronco
      const mossGeo = new THREE.CylinderGeometry(radius * 1.03, radius * 1.03, len * 0.72, 8, 1, false, 0, Math.PI);
      const mossMesh = new THREE.Mesh(mossGeo, mossMat);
      mossMesh.position.set(-len * 0.08, 0, 0);
      mossMesh.rotation.z = Math.PI / 2;
      g.add(mossMesh);

      // Cogumelos / orelhas de pau crescendo na casca do tronco
      if (hasFungi) {
        for (let fi = 0; fi < 4; fi++) {
          const fMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.02, 0.04, 6), fungusMat);
          const fPos = -len * 0.25 + fi * (len * 0.18);
          fMesh.position.set(fPos, radius * 0.4, radius * 0.88);
          fMesh.rotation.x = 0.4;
          g.add(fMesh);
        }
      }

      return g;
    };

    vegGroup.add(makeFallenLog(-8.5, -16.0, 5.8, 0.42, 0.35, true));
    vegGroup.add(makeFallenLog(14.5, 16.8, 6.2, 0.45, -0.22, true));
    vegGroup.add(makeFallenLog(58.0, 16.5, 5.2, 0.38, 0.48, true));
    vegGroup.add(makeFallenLog(-17.5, -16.8, 4.6, 0.36, -0.4, false));

    // ─── 3) Raízes Grandes e Expostas no Solo ───
    const rootBarkMat = new THREE.MeshStandardMaterial({ color: "#291e17", roughness: 0.95 });

    const makeRootCluster = (
      cx: number,
      cz: number,
      count: number,
      reach: number,
      seed: number,
    ): THREE.Group => {
      const g = new THREE.Group();
      g.position.set(cx, 0, cz);
      const rand = seededRandom(seed);

      for (let r = 0; r < count; r++) {
        const baseAngle = (r / count) * Math.PI * 2 + rand() * 0.5;
        const rLen = reach * (0.65 + rand() * 0.5);
        const midR = rLen * 0.5;

        // Curva que sobe do solo, ondula no chão e depois mergulha de volta
        const p0 = new THREE.Vector3(Math.cos(baseAngle) * 0.3, 0.08, Math.sin(baseAngle) * 0.3);
        const p1 = new THREE.Vector3(
          Math.cos(baseAngle + 0.2) * midR,
          0.18 + rand() * 0.16,
          Math.sin(baseAngle + 0.2) * midR,
        );
        const p2 = new THREE.Vector3(
          Math.cos(baseAngle - 0.15) * rLen,
          0.02,
          Math.sin(baseAngle - 0.15) * rLen,
        );

        const curve = new THREE.CatmullRomCurve3([p0, p1, p2]);
        const tubeGeo = new THREE.TubeGeometry(curve, 10, 0.08 + rand() * 0.06, 5, false);
        const rootMesh = new THREE.Mesh(tubeGeo, rootBarkMat);
        rootMesh.castShadow = true;
        rootMesh.receiveShadow = true;
        g.add(rootMesh);

        // Raiz secundária menor ramificando
        const subP0 = p1.clone();
        const subAngle = baseAngle + (rand() > 0.5 ? 0.6 : -0.6);
        const subP1 = new THREE.Vector3(
          subP0.x + Math.cos(subAngle) * (rLen * 0.45),
          0.04,
          subP0.z + Math.sin(subAngle) * (rLen * 0.45),
        );
        const subCurve = new THREE.CatmullRomCurve3([subP0, subP1]);
        const subTube = new THREE.Mesh(new THREE.TubeGeometry(subCurve, 6, 0.04, 4, false), rootBarkMat);
        subTube.castShadow = true;
        g.add(subTube);
      }

      return g;
    };

    // Raízes expostas salientes ao redor de árvores antigas, fundações e asfalto
    vegGroup.add(makeRootCluster(-28.0, -10.0, 5, 3.4, 401));
    vegGroup.add(makeRootCluster(-16.0, 12.0, 5, 3.2, 402));
    vegGroup.add(makeRootCluster(21.0, 7.3, 4, 3.0, 403));
    vegGroup.add(makeRootCluster(20.5, -7.3, 4, 2.8, 404));
    vegGroup.add(makeRootCluster(9.0, -7.6, 3, 2.6, 405));
    vegGroup.add(makeRootCluster(-17.5, 22.8, 4, 3.1, 406));
    vegGroup.add(makeRootCluster(-24.0, -15.0, 4, 2.9, 407));

    // ─── 4) Cipós e Plantas que Grudam nas Paredes (Climbing Wall Ivy & Vines) ───
    const vineStemMat = new THREE.MeshStandardMaterial({ color: "#223518", roughness: 0.95 });
    const leafDarkMat = new THREE.MeshStandardMaterial({ color: "#25441b", roughness: 0.85, side: THREE.DoubleSide });
    const leafMidMat = new THREE.MeshStandardMaterial({ color: "#385e26", roughness: 0.85, side: THREE.DoubleSide });
    const leafLightMat = new THREE.MeshStandardMaterial({ color: "#4d7835", roughness: 0.85, side: THREE.DoubleSide });
    const leafMaterials = [leafDarkMat, leafMidMat, leafLightMat];

    const makeWallIvy = (
      wx: number,
      wz: number,
      axis: "x" | "z",
      normal: 1 | -1,
      width: number,
      height: number,
      seed: number,
    ): THREE.Group => {
      const g = new THREE.Group();
      const rand = seededRandom(seed);
      const leafGeo = new THREE.PlaneGeometry(0.18, 0.18);
      const halfW = width / 2;

      // 4 a 6 caules principais subindo pela parede
      const numStems = 4 + Math.floor(rand() * 3);
      for (let s = 0; s < numStems; s++) {
        const spanOff = -halfW + (s / (numStems - 1)) * width + (rand() - 0.5) * 0.4;
        const stemH = height * (0.65 + rand() * 0.35);

        // Pontos de ancoragem subindo e serpenteando na parede
        const pts: THREE.Vector3[] = [];
        const numPts = 6;
        for (let p = 0; p <= numPts; p++) {
          const t = p / numPts;
          const y = t * stemH;
          const lateralWiggle = Math.sin(t * Math.PI * 2 + rand() * 2) * 0.25;
          const wallDist = 0.04 + (rand() - 0.5) * 0.015;

          if (axis === "x") {
            pts.push(new THREE.Vector3(wx + spanOff + lateralWiggle, y, wz + normal * wallDist));
          } else {
            pts.push(new THREE.Vector3(wx + normal * wallDist, y, wz + spanOff + lateralWiggle));
          }
        }

        const stemCurve = new THREE.CatmullRomCurve3(pts);
        const stemMesh = new THREE.Mesh(new THREE.TubeGeometry(stemCurve, 12, 0.024, 4, false), vineStemMat);
        g.add(stemMesh);

        // Folhas agrupadas ao longo da trepadeira grudadas na parede
        for (let l = 1; l < pts.length; l++) {
          const pt = pts[l]!;
          const leavesAtNode = 3 + Math.floor(rand() * 4);
          for (let li = 0; li < leavesAtNode; li++) {
            const leaf = new THREE.Mesh(leafGeo, leafMaterials[li % leafMaterials.length]!);
            const lOffX = (rand() - 0.5) * 0.22;
            const lOffY = (rand() - 0.5) * 0.22;
            const lOffZ = (rand() - 0.5) * 0.22;

            leaf.position.set(
              pt.x + (axis === "x" ? lOffX : normal * 0.02),
              pt.y + lOffY,
              pt.z + (axis === "z" ? lOffZ : normal * 0.02),
            );
            if (axis === "x") {
              leaf.rotation.set((rand() - 0.5) * 0.3, normal > 0 ? 0 : Math.PI, (rand() - 0.5) * 0.6);
            } else {
              leaf.rotation.set((rand() - 0.5) * 0.3, normal > 0 ? Math.PI / 2 : -Math.PI / 2, (rand() - 0.5) * 0.6);
            }
            g.add(leaf);
          }
        }
      }

      // Cipós pendurados (tendrils suspensos) caindo do topo da parede
      for (let h = 0; h < 3; h++) {
        const dropX = axis === "x" ? wx - halfW + rand() * width : wx + normal * 0.08;
        const dropZ = axis === "z" ? wz - halfW + rand() * width : wz + normal * 0.08;
        const dropLen = 0.6 + rand() * 0.8;
        const hangCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(dropX, height, dropZ),
          new THREE.Vector3(dropX + (rand() - 0.5) * 0.15, height - dropLen * 0.5, dropZ + (rand() - 0.5) * 0.15),
          new THREE.Vector3(dropX, height - dropLen, dropZ),
        ]);
        const hangMesh = new THREE.Mesh(new THREE.TubeGeometry(hangCurve, 8, 0.016, 4, false), vineStemMat);
        g.add(hangMesh);
      }

      return g;
    };

    // 4.1) Casa Central Abandonada: Trepadeiras nas paredes norte e sul e nos pilares da varanda
    vegGroup.add(makeWallIvy(25.0, 7.18, "x", 1, 6.5, 4.4, 501));
    vegGroup.add(makeWallIvy(23.5, -7.18, "x", -1, 5.5, 4.4, 502));
    vegGroup.add(makeWallIvy(16.2, 4.8, "z", -1, 1.2, 2.4, 503));
    vegGroup.add(makeWallIvy(16.2, -4.8, "z", -1, 1.2, 2.4, 504));

    // 4.2) Casamata / Bunker Militar: Vegetação trepadeira sobre o concreto brutalista
    vegGroup.add(makeWallIvy(87.0, -25.8, "x", 1, 3.8, 3.0, 505));
    vegGroup.add(makeWallIvy(94.2, -29.0, "z", 1, 4.0, 3.0, 506));

    // 4.3) Casa do Sobrevivente do Norte: Trepadeiras escalando as tábuas
    vegGroup.add(makeWallIvy(-19.5, 31.05, "x", 1, 5.0, 3.4, 507));

    // 4.4) Cabana do Caçador do Sul: Trepadeiras rústicas
    vegGroup.add(makeWallIvy(-19.5, -31.05, "x", -1, 5.0, 3.4, 508));

    // 4.5) Casinha Inicial: Heras na chaminé e parede externa
    vegGroup.add(makeWallIvy(-24.5, 3.15, "x", 1, 3.2, 2.8, 509));

    // ─── 5) Samambaias Selvagens nos Cantos Úmidos ───
    const fernMat = new THREE.MeshStandardMaterial({ color: "#2f5c22", roughness: 0.9, side: THREE.DoubleSide });
    const makeFern = (fx: number, fz: number, scale = 1.0): THREE.Group => {
      const g = new THREE.Group();
      g.position.set(fx, 0, fz);
      g.scale.setScalar(scale);

      // 7 frondes de samambaia curvadas em arco
      for (let i = 0; i < 7; i++) {
        const frond = new THREE.Group();
        const a = (i / 7) * Math.PI * 2;
        frond.rotation.y = a;

        const leafPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.7), fernMat);
        leafPlane.position.set(0, 0.32, 0.28);
        leafPlane.rotation.x = 0.65;
        frond.add(leafPlane);
        g.add(frond);
      }
      return g;
    };

    const fernSpots: Array<[number, number, number]> = [
      [-9.2, -15.2, 1.1],
      [-7.8, -16.5, 0.95],
      [13.8, 16.0, 1.15],
      [15.2, 17.2, 1.0],
      [57.2, 15.8, 1.05],
      [-27.2, -9.0, 1.2],
      [-15.2, 11.2, 1.1],
      [20.2, 7.8, 1.0],
      [19.8, -7.8, 1.0],
      [-23.5, 3.8, 0.9],
      [-18.5, 22.0, 1.1],
      [-18.8, -22.0, 1.1],
    ];
    for (const [fx, fz, fs] of fernSpots) {
      vegGroup.add(makeFern(fx, fz, fs));
    }

    this.group.add(vegGroup);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3) MAIS GRADES, PNEUS JOGADOS E LIXO ESPALHADO
  // ─────────────────────────────────────────────────────────────────────────────
  private buildScatteredDebrisAndTires(): void {
    const debrisGroup = new THREE.Group();
    debrisGroup.name = "ScatteredDebrisAndTires";

    const tireMat = new THREE.MeshStandardMaterial({ color: "#141414", roughness: 0.95 });
    const rustFenceMat = new THREE.MeshStandardMaterial({ color: "#362a20", roughness: 0.85, metalness: 0.7 });
    const wireMeshMat = new THREE.MeshBasicMaterial({ color: "#423b34", wireframe: true });
    const canRedMat = new THREE.MeshStandardMaterial({ color: "#a82218", roughness: 0.45, metalness: 0.85 });
    const canBlueMat = new THREE.MeshStandardMaterial({ color: "#1845a8", roughness: 0.45, metalness: 0.85 });
    const canSilverMat = new THREE.MeshStandardMaterial({ color: "#bbbcc2", roughness: 0.35, metalness: 0.9 });
    const canMaterials = [canRedMat, canBlueMat, canSilverMat];
    const boxMat = new THREE.MeshStandardMaterial({ color: "#544331", roughness: 0.95 });
    const trashBagMat = new THREE.MeshStandardMaterial({ color: "#0d0d0d", roughness: 0.35, metalness: 0.15 });
    const woodScrapMat = new THREE.MeshStandardMaterial({ color: "#423224", roughness: 0.98 });

    // ─── 1) Grades de Arame Farpado e Telas Metálicas ───
    const makeWireFence = (
      x1: number,
      z1: number,
      x2: number,
      z2: number,
      height = 2.2,
    ): THREE.Group => {
      const g = new THREE.Group();
      const len = Math.hypot(x2 - x1, z2 - z1);
      const angle = Math.atan2(z2 - z1, x2 - x1);

      g.position.set((x1 + x2) / 2, 0, (z1 + z2) / 2);
      g.rotation.y = -angle;

      // Tubos metálicos verticais nos cantos e no centro
      const numPosts = Math.max(2, Math.ceil(len / 2.5));
      for (let p = 0; p <= numPosts; p++) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, height, 6), rustFenceMat);
        const pX = -len / 2 + (p / numPosts) * len;
        post.position.set(pX, height / 2, 0);
        post.castShadow = true;
        g.add(post);

        // Haste inclinada no topo para arame farpado
        const barbArm = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 4), rustFenceMat);
        barbArm.position.set(pX, height + 0.15, 0.12);
        barbArm.rotation.x = 0.6;
        g.add(barbArm);
      }

      // Trilho superior e inferior
      for (const ry of [0.15, height]) {
        const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, len, 6), rustFenceMat);
        rail.rotation.z = Math.PI / 2;
        rail.position.set(0, ry, 0);
        g.add(rail);
      }

      // Painel de tela de arame
      const meshPanel = new THREE.Mesh(new THREE.PlaneGeometry(len, height - 0.2), wireMeshMat);
      meshPanel.position.set(0, height / 2, 0);
      g.add(meshPanel);

      return g;
    };

    // Cercas de segurança e grades industriais adicionais
    debrisGroup.add(makeWireFence(23.0, 19.5, 33.0, 19.5, 2.2));
    debrisGroup.add(makeWireFence(42.0, 11.5, 64.0, 11.5, 2.2));
    debrisGroup.add(makeWireFence(85.0, 27.2, 93.0, 27.2, 2.2));
    debrisGroup.add(makeWireFence(85.0, 27.2, 85.0, 33.0, 2.2));

    // Grade amassada / caída no chão perto do ferro velho
    const crushedFence = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 2.0), wireMeshMat);
    crushedFence.position.set(54.0, 0.04, 8.5);
    crushedFence.rotation.set(-Math.PI / 2 + 0.08, 0, 0.35);
    debrisGroup.add(crushedFence);

    // ─── 2) Pneus Jogados (Pilhas e Pneus Soltos Espalhados) ───
    const tireGeo = new THREE.TorusGeometry(0.38, 0.15, 8, 16);

    const makeTire = (
      tx: number,
      ty: number,
      tz: number,
      rotX: number,
      rotY: number,
      rotZ: number,
    ): THREE.Mesh => {
      const tire = new THREE.Mesh(tireGeo, tireMat);
      tire.position.set(tx, ty, tz);
      tire.rotation.set(rotX, rotY, rotZ);
      tire.castShadow = true;
      tire.receiveShadow = true;
      return tire;
    };

    const makeTireStack = (sx: number, sz: number, count = 4): THREE.Group => {
      const g = new THREE.Group();
      g.position.set(sx, 0, sz);
      for (let i = 0; i < count; i++) {
        const offX = (Math.sin(i * 1.7) * 0.05);
        const offZ = (Math.cos(i * 2.1) * 0.05);
        const t = makeTire(offX, 0.14 + i * 0.28, offZ, Math.PI / 2 + (i % 2 === 0 ? 0.06 : -0.06), 0, i * 0.4);
        g.add(t);
      }
      return g;
    };

    // Pilhas de pneus
    debrisGroup.add(makeTireStack(-21.0, 5.8, 4));
    debrisGroup.add(makeTireStack(14.5, -6.5, 5));
    debrisGroup.add(makeTireStack(35.5, 6.8, 4));
    debrisGroup.add(makeTireStack(49.5, -8.2, 5));
    debrisGroup.add(makeTireStack(74.5, 9.5, 4));

    // Pneus soltos, caídos e semi-enterrados no solo
    const looseTires: Array<[number, number, number, number, number, number]> = [
      [-12.0, 0.14, 4.5, Math.PI / 2, 0, 0.3],
      [-5.5, 0.12, -7.5, 1.2, 0.4, -0.6],
      [2.0, 0.14, -9.0, Math.PI / 2, 0, -0.8],
      [8.5, 0.15, 8.2, 0.8, -0.3, 0.5],
      [16.5, 0.14, 6.5, Math.PI / 2, 0, 0.2],
      [28.0, 0.15, 10.5, 1.1, 0.5, -0.4],
      [34.0, 0.14, -6.0, Math.PI / 2, 0, 0.6],
      [43.0, 0.14, -2.5, 1.0, -0.2, 0.7],
      [47.0, 0.14, 4.2, Math.PI / 2, 0, -0.3],
      [52.0, 0.12, -4.5, 0.7, 0.6, -0.2],
      [62.0, 0.14, -7.5, Math.PI / 2, 0, 0.9],
      [66.5, 0.15, 5.5, 1.3, -0.5, 0.4],
      [71.5, 0.14, -3.8, Math.PI / 2, 0, -0.5],
      [79.0, 0.12, 8.5, 0.9, 0.3, -0.7],
      [86.0, 0.14, 5.0, Math.PI / 2, 0, 0.4],
      [93.0, 0.14, -8.5, 1.0, -0.6, 0.2],
      [99.0, 0.14, -10.0, Math.PI / 2, 0, -0.2],
      [107.0, 0.12, 6.5, 0.8, 0.4, 0.6],
    ];
    for (const [tx, ty, tz, rx, ry, rz] of looseTires) {
      debrisGroup.add(makeTire(tx, ty, tz, rx, ry, rz));
    }

    // ─── 3) Mais Lixo Espalhado (Latas, Caixas, Sacos e Pedaços de Madeira) ───
    const rand = seededRandom(777);

    // 3.1) Latas amassadas caídas
    const canGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.12, 6);
    const canSpots: Array<[number, number]> = [
      [-22.5, 4.2], [-20.0, -3.5], [-13.5, 3.2], [-7.5, -6.5],
      [1.5, 4.0], [9.5, -5.5], [17.0, 5.5], [22.5, -6.2],
      [27.0, 8.5], [33.5, -5.0], [38.0, 6.2], [44.5, -3.5],
      [51.0, 5.0], [59.0, -6.0], [67.0, 4.5], [75.0, -5.2],
      [83.0, 6.5], [91.0, -7.0], [101.0, 5.5],
    ];
    for (let i = 0; i < canSpots.length; i++) {
      const [cx, cz] = canSpots[i]!;
      // Cria cluster de 2 a 4 latinhas
      for (let c = 0; c < 3; c++) {
        const can = new THREE.Mesh(canGeo, canMaterials[(i + c) % canMaterials.length]!);
        can.position.set(cx + (rand() - 0.5) * 0.6, 0.04, cz + (rand() - 0.5) * 0.6);
        can.rotation.set(Math.PI / 2, rand() * Math.PI, (rand() - 0.5) * 0.8);
        debrisGroup.add(can);
      }
    }

    // 3.2) Caixas de papelão rasgadas e amassadas
    const boxConfigs: Array<[number, number, number, boolean]> = [
      [-23.0, 5.2, 0.3, false],
      [-10.5, -7.0, 0.8, true],
      [3.0, 5.5, -0.4, false],
      [15.5, -6.0, 0.6, true],
      [29.0, 9.2, 0.2, false],
      [41.0, -4.5, -0.7, true],
      [56.0, 7.2, 0.5, false],
      [76.0, -6.5, -0.3, true],
      [90.0, 7.0, 0.4, false],
      [103.0, -7.5, 0.8, true],
    ];
    for (const [bx, bz, rotY, isFlat] of boxConfigs) {
      const boxH = isFlat ? 0.12 : 0.38;
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, boxH, 0.45), boxMat);
      box.position.set(bx, boxH / 2, bz);
      box.rotation.y = rotY;
      box.castShadow = true;
      debrisGroup.add(box);
    }

    // 3.3) Sacos pretos de lixo rasgados e amontoados
    const trashBagGeo = new THREE.DodecahedronGeometry(0.32, 1);
    const bagSpots: Array<[number, number]> = [
      [-21.5, 6.2],
      [15.0, -7.0],
      [34.5, 7.2],
      [50.0, -8.8],
      [73.5, 8.8],
      [89.0, 6.2],
    ];
    for (const [gx, gz] of bagSpots) {
      for (let b = 0; b < 2; b++) {
        const bag = new THREE.Mesh(trashBagGeo, trashBagMat);
        bag.position.set(gx + (b === 0 ? -0.18 : 0.18), 0.22, gz + (b === 0 ? 0.1 : -0.1));
        bag.scale.set(1.0, 0.75, 1.15);
        bag.castShadow = true;
        debrisGroup.add(bag);
      }
    }

    // 3.4) Pedaços de madeira / tábuas podres e ripas no chão
    const plankSpots: Array<[number, number, number]> = [
      [-19.0, 4.0, 0.4],
      [-6.0, -8.0, -0.6],
      [11.0, 7.0, 0.8],
      [25.0, -7.5, -0.3],
      [38.5, 8.0, 0.5],
      [63.0, -6.5, 0.7],
      [81.0, 7.5, -0.5],
      [97.0, -8.0, 0.2],
    ];
    for (const [px, pz, ry] of plankSpots) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.18), woodScrapMat);
      plank.position.set(px, 0.025, pz);
      plank.rotation.y = ry;
      debrisGroup.add(plank);
    }

    this.group.add(debrisGroup);
  }
}
