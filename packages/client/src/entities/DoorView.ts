import * as THREE from "three";
import { damp, lerp, type DoorDefinition } from "@dark-beans/shared";

/**
 * Representação visual e animação 3D de portas interativas.
 * Suporta folhas duplas rústicas de madeira com ferragens em ferro forjado e maçanetas de latão,
 * com animação suave de abertura e fechamento físico.
 */
export class DoorView {
  readonly root = new THREE.Group();
  readonly id: string;
  readonly config: DoorDefinition;

  private readonly leftHinge = new THREE.Group();
  private readonly rightHinge = new THREE.Group();

  private currentAngle = 0;
  private targetAngle = 0;
  private openState = false;

  constructor(config: DoorDefinition) {
    this.config = config;
    this.id = config.id;
    this.root.name = `DoorView_${config.id}`;
    this.root.position.set(config.x, config.y, config.z);

    const halfWidth = config.width / 2;
    const leafWidth = halfWidth - 0.02;
    const leafHeight = config.height;
    const leafThickness = 0.08;

    // ─── Materiais com visual rústico e atmosférico ─────────────────────────
    const woodColor = config.id === "door_cabin" ? "#4a3b2c" : "#362a1d";
    const woodMat = new THREE.MeshStandardMaterial({
      color: woodColor,
      roughness: 0.85,
      metalness: 0.05,
    });

    const darkTrimMat = new THREE.MeshStandardMaterial({
      color: "#241b14",
      roughness: 0.9,
    });

    const ironMat = new THREE.MeshStandardMaterial({
      color: "#22232a",
      roughness: 0.45,
      metalness: 0.85,
    });

    const brassMat = new THREE.MeshStandardMaterial({
      color: "#d4a742",
      roughness: 0.35,
      metalness: 0.8,
    });

    // ─── Folha Esquerda (Sul: Z negativo) ───────────────────────────────────
    this.leftHinge.position.set(0, 0, -halfWidth);

    // Prancha de madeira principal
    const leftPlank = new THREE.Mesh(
      new THREE.BoxGeometry(leafThickness, leafHeight, leafWidth),
      woodMat,
    );
    leftPlank.position.set(0, leafHeight / 2, leafWidth / 2);
    leftPlank.castShadow = true;
    leftPlank.receiveShadow = true;

    // Travessas horizontais de reforço (estilo celeiro / fortificação)
    const crossGeo = new THREE.BoxGeometry(leafThickness + 0.02, 0.12, leafWidth - 0.04);
    const leftCrossTop = new THREE.Mesh(crossGeo, darkTrimMat);
    leftCrossTop.position.set(0, leafHeight * 0.8, leafWidth / 2);
    const leftCrossMid = new THREE.Mesh(crossGeo, darkTrimMat);
    leftCrossMid.position.set(0, leafHeight * 0.5, leafWidth / 2);
    const leftCrossBot = new THREE.Mesh(crossGeo, darkTrimMat);
    leftCrossBot.position.set(0, leafHeight * 0.2, leafWidth / 2);

    // Dobradiças de ferro forjado
    const hingeGeo = new THREE.BoxGeometry(leafThickness + 0.03, 0.06, 0.28);
    const leftHingeTop = new THREE.Mesh(hingeGeo, ironMat);
    leftHingeTop.position.set(0, leafHeight * 0.8, 0.14);
    const leftHingeBot = new THREE.Mesh(hingeGeo, ironMat);
    leftHingeBot.position.set(0, leafHeight * 0.2, 0.14);

    // Maçaneta / ferrolho de latão na borda interna
    const handleGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.16, 8);
    const leftHandle = new THREE.Mesh(handleGeo, brassMat);
    leftHandle.rotation.x = Math.PI / 2;
    leftHandle.position.set(leafThickness / 2 + 0.04, leafHeight * 0.5, leafWidth - 0.08);

    this.leftHinge.add(
      leftPlank,
      leftCrossTop,
      leftCrossMid,
      leftCrossBot,
      leftHingeTop,
      leftHingeBot,
      leftHandle,
    );

    // ─── Folha Direita (Norte: Z positivo) ──────────────────────────────────
    this.rightHinge.position.set(0, 0, halfWidth);

    // Prancha de madeira principal
    const rightPlank = new THREE.Mesh(
      new THREE.BoxGeometry(leafThickness, leafHeight, leafWidth),
      woodMat,
    );
    rightPlank.position.set(0, leafHeight / 2, -leafWidth / 2);
    rightPlank.castShadow = true;
    rightPlank.receiveShadow = true;

    // Travessas horizontais de reforço
    const rightCrossTop = new THREE.Mesh(crossGeo, darkTrimMat);
    rightCrossTop.position.set(0, leafHeight * 0.8, -leafWidth / 2);
    const rightCrossMid = new THREE.Mesh(crossGeo, darkTrimMat);
    rightCrossMid.position.set(0, leafHeight * 0.5, -leafWidth / 2);
    const rightCrossBot = new THREE.Mesh(crossGeo, darkTrimMat);
    rightCrossBot.position.set(0, leafHeight * 0.2, -leafWidth / 2);

    // Dobradiças de ferro forjado
    const rightHingeTop = new THREE.Mesh(hingeGeo, ironMat);
    rightHingeTop.position.set(0, leafHeight * 0.8, -0.14);
    const rightHingeBot = new THREE.Mesh(hingeGeo, ironMat);
    rightHingeBot.position.set(0, leafHeight * 0.2, -0.14);

    // Maçaneta / trinco na borda interna
    const rightHandle = new THREE.Mesh(handleGeo, brassMat);
    rightHandle.rotation.x = Math.PI / 2;
    rightHandle.position.set(leafThickness / 2 + 0.04, leafHeight * 0.5, -leafWidth + 0.08);

    this.rightHinge.add(
      rightPlank,
      rightCrossTop,
      rightCrossMid,
      rightCrossBot,
      rightHingeTop,
      rightHingeBot,
      rightHandle,
    );

    this.root.add(this.leftHinge, this.rightHinge);

    // Aplica estado inicial
    this.setOpen(config.initialOpen ?? false, true);
  }

  /** Atualiza o estado da porta (aberta ou fechada) com animação suave. */
  setOpen(isOpen: boolean, immediate = false): void {
    this.openState = isOpen;
    // Ângulo de abertura (~88 graus para abrir completamente a passagem)
    const openAngle = Math.PI * 0.49;
    this.targetAngle = isOpen ? openAngle : 0;

    if (immediate) {
      this.currentAngle = this.targetAngle;
      this.applyAngles();
    }
  }

  isOpen(): boolean {
    return this.openState;
  }

  /** Atualiza interpolação da animação a cada quadro */
  update(dt: number): void {
    if (Math.abs(this.currentAngle - this.targetAngle) > 0.001) {
      this.currentAngle = lerp(this.currentAngle, this.targetAngle, damp(12, dt));
      this.applyAngles();
    }
  }

  private applyAngles(): void {
    // A folha esquerda gira para dentro (negativo) e a direita para dentro (positivo)
    // Para a casinha inicial (X=-21.95), o interior é para -X
    this.leftHinge.rotation.y = -this.currentAngle;
    this.rightHinge.rotation.y = this.currentAngle;
  }
}
