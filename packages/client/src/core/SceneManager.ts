import * as THREE from "three";

/**
 * SceneManager: renderizador Three.js, cena, neblina e iluminação sombria global.
 * O conteúdo da arena (chão, obstáculos, fogueira) é montado pelos módulos em `world/`.
 */
export class SceneManager {
  readonly scene = new THREE.Scene();
  readonly renderer: THREE.WebGLRenderer;
  /** Chamado com (largura, altura) sempre que a janela é redimensionada. */
  onResize: ((width: number, height: number) => void) | null = null;

  static readonly FOG_COLOR = new THREE.Color("#0b0916");

  private readonly moon: THREE.DirectionalLight;

  constructor(private readonly container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    // Limita o pixel ratio a 1.25 (em telas Retina economiza até 65% de processamento da GPU mantendo boa nitidez)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
    const initialWidth = container.clientWidth || window.innerWidth;
    const initialHeight = container.clientHeight || window.innerHeight;
    this.renderer.setSize(initialWidth, initialHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    // ─── Atmosfera ─────────────────────────────────────────────────────────
    this.scene.background = new THREE.Color("#16142a");
    // Neblina linear: visibilidade total perto do jogador (0 a 32m), desaparecendo suavemente na borda (95m)
    this.scene.fog = new THREE.Fog(new THREE.Color("#16142a"), 32, 95);

    // ─── Iluminação equilibrada ("Dark Fall Guys"): visível, vibrante e atmosférico ───
    const hemi = new THREE.HemisphereLight("#8ea0ff", "#372d4c", 2.2);
    this.scene.add(hemi);

    const ambient = new THREE.AmbientLight("#675f9e", 1.6);
    this.scene.add(ambient);

    // Luar azulado nítido projetando sombras longas
    this.moon = new THREE.DirectionalLight("#b6ccff", 2.9);
    this.moon.position.set(-16, 26, -14);
    this.moon.castShadow = true;
    this.moon.shadow.mapSize.set(1024, 1024);
    const s = 36;
    const cam = this.moon.shadow.camera;
    cam.left = -s;
    cam.right = s;
    cam.top = s;
    cam.bottom = -s;
    cam.near = 1;
    cam.far = 90;
    this.moon.shadow.bias = -0.0008;
    this.moon.shadow.normalBias = 0.03;
    this.scene.add(this.moon, this.moon.target);

    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => this.handleResize());
      ro.observe(this.container);
    }
    window.addEventListener("resize", this.handleResize);
    requestAnimationFrame(() => this.handleResize());
  }

  get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  get aspect(): number {
    const w = this.container.clientWidth || window.innerWidth;
    const h = Math.max(1, this.container.clientHeight || window.innerHeight);
    return w / h;
  }

  add(...objects: THREE.Object3D[]): void {
    this.scene.add(...objects);
  }

  remove(...objects: THREE.Object3D[]): void {
    this.scene.remove(...objects);
  }

  render(camera: THREE.Camera): void {
    this.renderer.render(this.scene, camera);
  }

  private handleResize = (): void => {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    this.onResize?.(w, h);
  };
}
