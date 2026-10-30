import * as THREE from "three";
import { HELICOPTER_RESCUE_POS, HELICOPTER_SKY_ALTITUDE } from "@dark-beans/shared";

/**
 * Representação visual e sonora 3D de alta qualidade do Helicóptero de Resgate e do Heliponto.
 * - Heliponto tático com círculo de concreto, marcação "H", balizas luminosas e anel de evacuação
 * - Aeronave de resgate completa: fuselagem tática, cockpit com vidros reflexivos,
 *   esquis de pouso metálicos, viga de cauda, rotor principal com blur de movimento e rotor de cauda
 * - Holofote de busca cônico com SpotLight projetado no solo
 * - Luzes estroboscópicas de navegação (vermelho, verde, branco)
 * - Partículas de poeira/downwash geradas pelo vento das pás perto do solo
 */
export class HelicopterView {
  readonly root: THREE.Group;
  private readonly helipadGroup: THREE.Group;
  private readonly heliGroup: THREE.Group;

  // Rotores
  private readonly mainRotorGroup: THREE.Group;
  private readonly tailRotorGroup: THREE.Group;
  private readonly rotorBlurDisc: THREE.Mesh;

  // Luzes da aeronave
  private readonly searchlight: THREE.SpotLight;
  private readonly searchlightTarget: THREE.Object3D;
  private readonly searchlightCone: THREE.Mesh;
  private readonly strobeRed: THREE.PointLight;
  private readonly strobeGreen: THREE.PointLight;
  private readonly strobeWhite: THREE.PointLight;

  // Heliponto
  private readonly helipadBeaconLights: THREE.PointLight[] = [];
  private readonly rescueZoneRing: THREE.Mesh;
  private readonly rescueZoneMat: THREE.MeshBasicMaterial;

  // Poeira de downwash
  private readonly dustParticles: THREE.Points;
  private readonly dustGeo: THREE.BufferGeometry;

  // Estado
  private rotorSpeed = 0;
  private animTimer = 0;
  private strobeTimer = 0;

  constructor() {
    this.root = new THREE.Group();

    // ─── 1. Heliponto no Solo (X: 12, Z: -25) ─────────────────────────
    this.helipadGroup = new THREE.Group();
    this.helipadGroup.position.set(HELICOPTER_RESCUE_POS.x, 0.03, HELICOPTER_RESCUE_POS.z);

    // Base de concreto circular
    const padGeo = new THREE.CylinderGeometry(HELICOPTER_RESCUE_POS.radius + 0.3, HELICOPTER_RESCUE_POS.radius + 0.3, 0.06, 36);
    const padMat = new THREE.MeshStandardMaterial({
      color: "#272e38",
      roughness: 0.9,
      metalness: 0.1,
    });
    const padMesh = new THREE.Mesh(padGeo, padMat);
    padMesh.receiveShadow = true;
    this.helipadGroup.add(padMesh);

    // Borda amarela e preta tática
    const borderGeo = new THREE.RingGeometry(HELICOPTER_RESCUE_POS.radius - 0.25, HELICOPTER_RESCUE_POS.radius + 0.32, 36);
    const borderMat = new THREE.MeshBasicMaterial({
      color: "#eab308",
      side: THREE.DoubleSide,
    });
    const borderMesh = new THREE.Mesh(borderGeo, borderMat);
    borderMesh.rotation.x = -Math.PI / 2;
    borderMesh.position.y = 0.035;
    this.helipadGroup.add(borderMesh);

    // Anel interno branco
    const innerRingGeo = new THREE.RingGeometry(HELICOPTER_RESCUE_POS.radius - 1.2, HELICOPTER_RESCUE_POS.radius - 1.05, 36);
    const innerRingMat = new THREE.MeshBasicMaterial({ color: "#f8fafc", side: THREE.DoubleSide });
    const innerRingMesh = new THREE.Mesh(innerRingGeo, innerRingMat);
    innerRingMesh.rotation.x = -Math.PI / 2;
    innerRingMesh.position.y = 0.036;
    this.helipadGroup.add(innerRingMesh);

    // Letra "H" no centro do Heliponto
    const hGroup = new THREE.Group();
    hGroup.position.y = 0.038;
    const hMat = new THREE.MeshBasicMaterial({ color: "#f8fafc" });
    // Pernas laterais do H
    const hLeg1 = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 2.8), hMat);
    hLeg1.rotation.x = -Math.PI / 2;
    hLeg1.position.x = -0.85;
    const hLeg2 = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 2.8), hMat);
    hLeg2.rotation.x = -Math.PI / 2;
    hLeg2.position.x = 0.85;
    // Barra transversal do H
    const hBar = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.5), hMat);
    hBar.rotation.x = -Math.PI / 2;
    hGroup.add(hLeg1, hLeg2, hBar);
    this.helipadGroup.add(hGroup);

    // Balizas perimetrais de balizamento (8 LEDs ao redor da pista de pouso)
    const numBeacons = 8;
    for (let i = 0; i < numBeacons; i++) {
      const angle = (i / numBeacons) * Math.PI * 2;
      const bx = Math.cos(angle) * (HELICOPTER_RESCUE_POS.radius + 0.1);
      const bz = Math.sin(angle) * (HELICOPTER_RESCUE_POS.radius + 0.1);

      const postMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.08, 0.35, 8),
        new THREE.MeshStandardMaterial({ color: "#0f172a", roughness: 0.7 }),
      );
      postMesh.position.set(bx, 0.175, bz);

      const lampMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 8, 8),
        new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? "#38bdf8" : "#f59e0b" }),
      );
      lampMesh.position.set(bx, 0.35, bz);

      const beaconLight = new THREE.PointLight(i % 2 === 0 ? "#38bdf8" : "#f59e0b", 0.8, 4.0);
      beaconLight.position.set(bx, 0.45, bz);

      this.helipadGroup.add(postMesh, lampMesh, beaconLight);
      this.helipadBeaconLights.push(beaconLight);
    }

    // Anel pulsante indicador de área de resgate
    const zoneGeo = new THREE.RingGeometry(HELICOPTER_RESCUE_POS.radius - 0.15, HELICOPTER_RESCUE_POS.radius + 0.05, 48);
    this.rescueZoneMat = new THREE.MeshBasicMaterial({
      color: "#22c55e",
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.65,
    });
    this.rescueZoneRing = new THREE.Mesh(zoneGeo, this.rescueZoneMat);
    this.rescueZoneRing.rotation.x = -Math.PI / 2;
    this.rescueZoneRing.position.y = 0.045;
    this.helipadGroup.add(this.rescueZoneRing);

    this.root.add(this.helipadGroup);

    // ─── 2. Aeronave Helicóptero Militar de Evacuação ──────────────────
    this.heliGroup = new THREE.Group();
    this.heliGroup.position.set(HELICOPTER_RESCUE_POS.x, HELICOPTER_SKY_ALTITUDE, HELICOPTER_RESCUE_POS.z);
    this.heliGroup.rotation.y = Math.PI * 0.15; // Levemente inclinado para visual isométrico cinematográfico

    // Materiais do Helicóptero
    const hullMat = new THREE.MeshStandardMaterial({
      color: "#1c2b23", // Verde-oliva militar escuro de forças especiais
      roughness: 0.6,
      metalness: 0.4,
    });
    const stripeRescueMat = new THREE.MeshStandardMaterial({
      color: "#f97316", // Faixa de resgate laranja de alta visibilidade
      roughness: 0.4,
      metalness: 0.2,
    });
    const cockpitGlassMat = new THREE.MeshStandardMaterial({
      color: "#0f172a",
      roughness: 0.15,
      metalness: 0.85,
    });
    const metalMat = new THREE.MeshStandardMaterial({
      color: "#475569",
      roughness: 0.4,
      metalness: 0.7,
    });
    const bladeMat = new THREE.MeshStandardMaterial({
      color: "#0f172a",
      roughness: 0.3,
      metalness: 0.5,
    });

    // 2.1) Cabine Principal / Fuselagem
    const bodyGeo = new THREE.BoxGeometry(1.6, 1.4, 3.8);
    const bodyMesh = new THREE.Mesh(bodyGeo, hullMat);
    bodyMesh.position.set(0, 1.35, 0);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    this.heliGroup.add(bodyMesh);

    // Nariz aerodinâmico frontal
    const noseGeo = new THREE.ConeGeometry(0.9, 1.2, 4);
    const noseMesh = new THREE.Mesh(noseGeo, hullMat);
    noseMesh.rotation.x = -Math.PI / 2;
    noseMesh.rotation.z = Math.PI / 4;
    noseMesh.position.set(0, 1.25, -2.4);
    this.heliGroup.add(noseMesh);

    // Cockpit / Vidros da frente
    const windshieldGeo = new THREE.BoxGeometry(1.4, 0.7, 0.85);
    const windshield = new THREE.Mesh(windshieldGeo, cockpitGlassMat);
    windshield.position.set(0, 1.45, -1.6);
    windshield.rotation.x = -Math.PI / 7;
    this.heliGroup.add(windshield);

    // Janelas laterais
    const sideWin1 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.5, 1.2), cockpitGlassMat);
    sideWin1.position.set(-0.81, 1.4, -0.6);
    const sideWin2 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.5, 1.2), cockpitGlassMat);
    sideWin2.position.set(0.81, 1.4, -0.6);
    this.heliGroup.add(sideWin1, sideWin2);

    // Faixas decorativas de resgate (laranja e branco)
    const stripeGeo = new THREE.BoxGeometry(1.62, 0.28, 1.4);
    const stripeMesh = new THREE.Mesh(stripeGeo, stripeRescueMat);
    stripeMesh.position.set(0, 1.35, 0.4);
    this.heliGroup.add(stripeMesh);

    // Letreiro "RESCUE" / Cruz estilizada lateral
    const crossMat = new THREE.MeshBasicMaterial({ color: "#ef4444" });
    const crossH1 = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.12), crossMat);
    crossH1.position.set(-0.82, 1.35, 0.4);
    crossH1.rotation.y = -Math.PI / 2;
    const crossV1 = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.4), crossMat);
    crossV1.position.set(-0.82, 1.35, 0.4);
    crossV1.rotation.y = -Math.PI / 2;

    const crossH2 = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.12), crossMat);
    crossH2.position.set(0.82, 1.35, 0.4);
    crossH2.rotation.y = Math.PI / 2;
    const crossV2 = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.4), crossMat);
    crossV2.position.set(0.82, 1.35, 0.4);
    crossV2.rotation.y = Math.PI / 2;
    this.heliGroup.add(crossH1, crossV1, crossH2, crossV2);

    // 2.2) Viga da Cauda (Tail Boom)
    const boomGeo = new THREE.CylinderGeometry(0.3, 0.5, 4.4, 8);
    const boomMesh = new THREE.Mesh(boomGeo, hullMat);
    boomMesh.rotation.x = Math.PI / 2;
    boomMesh.position.set(0, 1.45, 3.8);
    boomMesh.castShadow = true;
    this.heliGroup.add(boomMesh);

    // Estabilizador Vertical da cauda
    const vertFinGeo = new THREE.BoxGeometry(0.1, 1.3, 0.9);
    const vertFinMesh = new THREE.Mesh(vertFinGeo, hullMat);
    vertFinMesh.position.set(0, 2.0, 5.8);
    vertFinMesh.rotation.x = -Math.PI / 8;
    this.heliGroup.add(vertFinMesh);

    // Estabilizador Horizontal da cauda
    const horizFinGeo = new THREE.BoxGeometry(1.8, 0.08, 0.6);
    const horizFinMesh = new THREE.Mesh(horizFinGeo, hullMat);
    horizFinMesh.position.set(0, 1.6, 5.2);
    this.heliGroup.add(horizFinMesh);

    // 2.3) Esquis de Pouso (Skids metálicos)
    const skidGeo = new THREE.CylinderGeometry(0.06, 0.06, 4.2, 8);
    const skidLeft = new THREE.Mesh(skidGeo, metalMat);
    skidLeft.rotation.x = Math.PI / 2;
    skidLeft.position.set(-0.95, 0.12, 0);

    // Ponta curva frontal do esqui esquerdo
    const tipLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.6, 8), metalMat);
    tipLeft.rotation.x = Math.PI / 2.7;
    tipLeft.position.set(-0.95, 0.28, -2.2);

    const skidRight = new THREE.Mesh(skidGeo, metalMat);
    skidRight.rotation.x = Math.PI / 2;
    skidRight.position.set(0.95, 0.12, 0);

    const tipRight = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.6, 8), metalMat);
    tipRight.rotation.x = Math.PI / 2.7;
    tipRight.position.set(0.95, 0.28, -2.2);

    // Suportes conectores entre fuselagem e esquis
    const strutGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.8, 8);
    const strutFL = new THREE.Mesh(strutGeo, metalMat);
    strutFL.position.set(-0.7, 0.45, -0.9);
    strutFL.rotation.z = -Math.PI / 8;

    const strutFR = new THREE.Mesh(strutGeo, metalMat);
    strutFR.position.set(0.7, 0.45, -0.9);
    strutFR.rotation.z = Math.PI / 8;

    const strutBL = new THREE.Mesh(strutGeo, metalMat);
    strutBL.position.set(-0.7, 0.45, 1.1);
    strutBL.rotation.z = -Math.PI / 8;

    const strutBR = new THREE.Mesh(strutGeo, metalMat);
    strutBR.position.set(0.7, 0.45, 1.1);
    strutBR.rotation.z = Math.PI / 8;

    this.heliGroup.add(skidLeft, tipLeft, skidRight, tipRight, strutFL, strutFR, strutBL, strutBR);

    // 2.4) Rotor Principal Superior (Main Rotor)
    this.mainRotorGroup = new THREE.Group();
    this.mainRotorGroup.position.set(0, 2.3, -0.2);

    // Mastro mecânico
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.45, 12), metalMat);
    this.mainRotorGroup.add(mast);

    // Cubo central das pás
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.15, 12), metalMat);
    hub.position.y = 0.22;
    this.mainRotorGroup.add(hub);

    // 4 Pás longas com pontas pintadas de amarelo de alerta
    const bladeLength = 3.6;
    const tipLength = 0.6;
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      const bladeArm = new THREE.Group();
      bladeArm.rotation.y = angle;

      // Corpo da pá (preto fosco)
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.035, bladeLength - tipLength), bladeMat);
      blade.position.set(0, 0.22, (bladeLength - tipLength) / 2 + 0.35);

      // Ponta de advertência amarela
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.036, tipLength), borderMat);
      tip.position.set(0, 0.22, bladeLength - tipLength / 2 + 0.35);

      bladeArm.add(blade, tip);
      this.mainRotorGroup.add(bladeArm);
    }

    // Disco semitransparente de borrão de rotação rápida (Motion Blur)
    const blurGeo = new THREE.CircleGeometry(3.9, 36);
    const blurMat = new THREE.MeshBasicMaterial({
      color: "#334155",
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    });
    this.rotorBlurDisc = new THREE.Mesh(blurGeo, blurMat);
    this.rotorBlurDisc.rotation.x = -Math.PI / 2;
    this.rotorBlurDisc.position.y = 0.23;
    this.mainRotorGroup.add(this.rotorBlurDisc);

    this.heliGroup.add(this.mainRotorGroup);

    // 2.5) Rotor de Cauda Traseiro (Tail Rotor)
    this.tailRotorGroup = new THREE.Group();
    this.tailRotorGroup.position.set(0.18, 2.35, 5.9);

    const tailHub = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.1, 8), metalMat);
    tailHub.rotation.z = Math.PI / 2;
    this.tailRotorGroup.add(tailHub);

    for (let i = 0; i < 2; i++) {
      const tailArm = new THREE.Group();
      tailArm.rotation.x = i * Math.PI;
      const tBlade = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.75, 0.12), bladeMat);
      tBlade.position.y = 0.38;
      tailArm.add(tBlade);
      this.tailRotorGroup.add(tailArm);
    }
    this.heliGroup.add(this.tailRotorGroup);

    // 2.6) Holofote de Busca Frontal (Searchlight)
    this.searchlightTarget = new THREE.Object3D();
    this.searchlightTarget.position.set(HELICOPTER_RESCUE_POS.x, 0, HELICOPTER_RESCUE_POS.z);
    this.root.add(this.searchlightTarget);

    this.searchlight = new THREE.SpotLight("#ffffff", 4.0, 50, Math.PI / 6, 0.4, 1.2);
    this.searchlight.position.set(0, 0.7, -1.8);
    this.searchlight.target = this.searchlightTarget;
    this.heliGroup.add(this.searchlight);

    // Cone volumétrico falso de feixe de luz
    const coneGeo = new THREE.ConeGeometry(3.2, 12, 16, 1, true);
    const coneMat = new THREE.MeshBasicMaterial({
      color: "#e2e8f0",
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.searchlightCone = new THREE.Mesh(coneGeo, coneMat);
    this.searchlightCone.position.set(0, -5.5, -2.5);
    this.searchlightCone.rotation.x = Math.PI / 12;
    this.heliGroup.add(this.searchlightCone);

    // Luzes estroboscópicas de navegação
    this.strobeRed = new THREE.PointLight("#ef4444", 0.6, 5);
    this.strobeRed.position.set(-1.0, 1.35, 0);

    this.strobeGreen = new THREE.PointLight("#22c55e", 0.6, 5);
    this.strobeGreen.position.set(1.0, 1.35, 0);

    this.strobeWhite = new THREE.PointLight("#ffffff", 1.2, 8);
    this.strobeWhite.position.set(0, 2.6, 6.0);

    this.heliGroup.add(this.strobeRed, this.strobeGreen, this.strobeWhite);

    this.root.add(this.heliGroup);

    // ─── 3. Poeira de Downwash (Partículas perto do solo) ──────────────
    const particleCount = 80;
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 0.5 + Math.random() * (HELICOPTER_RESCUE_POS.radius + 1.5);
      positions[i * 3] = HELICOPTER_RESCUE_POS.x + Math.cos(angle) * r;
      positions[i * 3 + 1] = 0.1 + Math.random() * 1.8;
      positions[i * 3 + 2] = HELICOPTER_RESCUE_POS.z + Math.sin(angle) * r;
    }
    this.dustGeo = new THREE.BufferGeometry();
    this.dustGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const dustMat = new THREE.PointsMaterial({
      color: "#cbd5e1",
      size: 0.35,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.dustParticles = new THREE.Points(this.dustGeo, dustMat);
    this.root.add(this.dustParticles);

    // Inicialmente oculto até o sinalizador ser disparado
    this.heliGroup.visible = false;
  }

  /**
   * Atualização frame a frame do helicóptero e heliponto.
   */
  update(
    dt: number,
    state: {
      status?: string;
      x?: number;
      y?: number;
      z?: number;
      rescueTimer?: number;
      livingInRescue?: number;
      totalLiving?: number;
    },
  ): void {
    const status = state.status ?? "none";
    this.animTimer += dt;
    this.strobeTimer += dt;

    // Pisca os faróis estroboscópicos
    const strobeActive = Math.sin(this.strobeTimer * 8.0) > 0.4;
    this.strobeWhite.intensity = strobeActive ? 2.5 : 0.1;
    this.strobeRed.intensity = strobeActive ? 1.5 : 0.2;
    this.strobeGreen.intensity = strobeActive ? 1.5 : 0.2;

    // Balizas perimetrais do heliponto piscam em padrão alternado
    this.helipadBeaconLights.forEach((light, idx) => {
      const phase = (this.animTimer * 3.0 + idx * 0.7) % (Math.PI * 2);
      light.intensity = 0.4 + 0.6 * Math.sin(phase);
    });

    // Anel indicador de resgate: pulsa verde suave quando o helicóptero estiver pousado
    if (status === "landed") {
      const pulse = 0.45 + 0.45 * Math.sin(this.animTimer * 5.0);
      this.rescueZoneMat.opacity = pulse;
      this.rescueZoneMat.color.set(state.livingInRescue && state.livingInRescue > 0 ? "#10b981" : "#22c55e");
    } else {
      this.rescueZoneMat.opacity = 0.25;
      this.rescueZoneMat.color.set("#eab308");
    }

    // O helicóptero nos céus só deve aparecer faltando 10 segundos para pousar (rescueTimer <= 10.0)
    const rescueTimer = state.rescueTimer ?? 0;
    const isVisibleNow =
      (status === "incoming" && rescueTimer <= 10.0) ||
      status === "landing" ||
      status === "landed" ||
      status === "escaped";

    if (!isVisibleNow) {
      this.heliGroup.visible = false;
      this.searchlightCone.visible = false;
      this.dustParticles.visible = false;
      return;
    }

    this.heliGroup.visible = true;

    // Sincroniza coordenadas
    const targetX = state.x ?? HELICOPTER_RESCUE_POS.x;
    const targetY = state.y ?? HELICOPTER_SKY_ALTITUDE;
    const targetZ = state.z ?? HELICOPTER_RESCUE_POS.z;

    this.heliGroup.position.set(targetX, targetY, targetZ);

    // Rotação dinâmica e aceleração das pás do helicóptero
    const maxRotorSpeed = 38.0; // rad/s
    if (status === "landing" || status === "landed" || status === "escaped") {
      this.rotorSpeed = THREE.MathUtils.lerp(this.rotorSpeed, maxRotorSpeed, dt * 2.5);
    } else if (status === "incoming") {
      this.rotorSpeed = THREE.MathUtils.lerp(this.rotorSpeed, maxRotorSpeed * 0.8, dt * 1.5);
    }

    this.mainRotorGroup.rotation.y += this.rotorSpeed * dt;
    this.tailRotorGroup.rotation.x += this.rotorSpeed * 1.6 * dt;

    // Disco de motion blur das pás
    const blurOpacity = Math.max(0, Math.min(0.45, (this.rotorSpeed / maxRotorSpeed) * 0.45));
    (this.rotorBlurDisc.material as THREE.MeshBasicMaterial).opacity = blurOpacity;

    // Leve oscilação aerodinâmica em voo
    if (status === "landing" || status === "incoming" || status === "escaped") {
      const swayRoll = Math.sin(this.animTimer * 2.5) * 0.05;
      const swayPitch = Math.cos(this.animTimer * 1.8) * 0.04;
      this.heliGroup.rotation.z = swayRoll;
      this.heliGroup.rotation.x = swayPitch;
    } else if (status === "landed") {
      this.heliGroup.rotation.z = THREE.MathUtils.lerp(this.heliGroup.rotation.z, 0, dt * 5);
      this.heliGroup.rotation.x = THREE.MathUtils.lerp(this.heliGroup.rotation.x, 0, dt * 5);
    }

    // Holofote de busca
    if (status === "landing" || status === "landed") {
      this.searchlight.intensity = 4.0;
      this.searchlightCone.visible = true;
      (this.searchlightCone.material as THREE.MeshBasicMaterial).opacity = 0.15 + 0.05 * Math.sin(this.animTimer * 4);
    } else {
      this.searchlight.intensity = 0.5;
      this.searchlightCone.visible = false;
    }

    // Poeira levantada perto do solo (downwash quando Y < 10)
    if (targetY < 10 && (status === "landing" || status === "landed" || status === "escaped")) {
      this.dustParticles.visible = true;
      const dustMat = this.dustParticles.material as THREE.PointsMaterial;
      const intensity = Math.max(0, 1 - targetY / 10);
      dustMat.opacity = intensity * 0.4;

      const posAttr = this.dustGeo.getAttribute("position") as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      for (let i = 0; i < arr.length; i += 3) {
        // Expansão centrífuga pelo vento
        const dx = arr[i] - HELICOPTER_RESCUE_POS.x;
        const dz = arr[i + 2] - HELICOPTER_RESCUE_POS.z;
        const dist = Math.hypot(dx, dz);
        if (dist > HELICOPTER_RESCUE_POS.radius + 2.5) {
          const angle = Math.random() * Math.PI * 2;
          const r = 0.4 + Math.random() * 1.5;
          arr[i] = HELICOPTER_RESCUE_POS.x + Math.cos(angle) * r;
          arr[i + 1] = 0.1;
          arr[i + 2] = HELICOPTER_RESCUE_POS.z + Math.sin(angle) * r;
        } else {
          arr[i] += (dx / (dist + 0.01)) * dt * 4.0;
          arr[i + 1] += (Math.random() - 0.3) * dt * 2.0;
          arr[i + 2] += (dz / (dist + 0.01)) * dt * 4.0;
        }
      }
      posAttr.needsUpdate = true;
    } else {
      this.dustParticles.visible = false;
    }
  }

  dispose(): void {
    this.root.clear();
  }
}
