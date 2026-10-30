import {
  generateRoomCode,
  PLAYER_NAME_MAX,
  sanitizeRoomCode,
  type CharacterAppearance,
  type EyeType,
  type HairType,
  type BeardType,
  type HatType,
} from "@dark-beans/shared";
import {
  BEAN_COLOR_PALETTE,
  BEARD_OPTIONS,
  EYE_OPTIONS,
  HAIR_OPTIONS,
  HAT_OPTIONS,
} from "../entities/CharacterCosmetics";
import { CharacterPreview } from "./CharacterPreview";
import type { NetworkManager, NetArenaState, NetPlayer } from "../network/NetworkManager";

const NAME_KEY = "lost-beans:name";
const LEGACY_NAME_KEY = "dark-beans:name";
const CUSTOM_KEY = "lost-beans:customization";
const SETTINGS_KEY = "lost-beans:settings";

export interface GameSettings {
  masterVolume: number;
  sfxVolume: number;
  mouseSensitivity: number;
}

const DEFAULT_APPEARANCE: Required<CharacterAppearance> = {
  color: "#2563eb",
  hair: "bald",
  eyes: "oval_medium",
  beard: "none",
  hat: "none",
};

const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 1.0,
  sfxVolume: 1.0,
  mouseSensitivity: 1.0,
};

/**
 * Menu Principal Completo do Lost Beans:
 * 1) Tela Inicial: Logo, Brand e botão limpo JOGAR (sem ícones, sem campos de nome)
 * 2) Tela Dividida ao clicar em JOGAR:
 *    - Esquerda: Criação de Personagem com nome e preview 3D interativo
 *    - Direita: Gerenciamento da Sala (Criar sala ou Inserir código/IP + Lista de jogadores em tempo real)
 * 3) Rodapé Minimalista: Botão de configurações (ícone engrenagem todo branco) + Saiba mais sobre mim (ícone todo branco)
 */
export class MainMenu {
  private readonly root = document.getElementById("main-menu")!;

  // Telas do Menu
  private readonly panelHome = document.getElementById("menu-panel-home")!;
  private readonly panelStaging = document.getElementById("menu-panel-staging")!;
  private readonly modalSettings = document.getElementById("modal-settings")!;

  // Tela Inicial (Home)
  private readonly btnHomePlay = document.getElementById("btn-home-play") as HTMLButtonElement;

  // Lado Esquerdo: Criação de Personagem
  private readonly stagingInputName = document.getElementById("staging-input-name") as HTMLInputElement;
  private characterPreview: CharacterPreview | null = null;
  private appearance: Required<CharacterAppearance>;

  // Lado Direito: Sala & Sobreviventes
  private readonly btnTabCreate = document.getElementById("btn-tab-create") as HTMLButtonElement;
  private readonly btnTabJoin = document.getElementById("btn-tab-join") as HTMLButtonElement;
  private readonly paneCreate = document.getElementById("staging-mode-create")!;
  private readonly paneJoin = document.getElementById("staging-mode-join")!;
  private readonly stagingCreatedCode = document.getElementById("staging-created-code")!;
  private readonly btnCopyStagingCode = document.getElementById("btn-copy-staging-code") as HTMLButtonElement;
  private readonly stagingInputCode = document.getElementById("staging-input-code") as HTMLInputElement;
  private readonly btnStagingConnect = document.getElementById("btn-staging-connect-room") as HTMLButtonElement;
  private readonly stagingPlayerList = document.getElementById("staging-player-list") as HTMLUListElement;
  private readonly stagingPlayerCount = document.getElementById("staging-player-count")!;
  private readonly stagingRoomError = document.getElementById("staging-room-error")!;
  private readonly btnStartMatch = document.getElementById("btn-start-match") as HTMLButtonElement;
  private readonly btnStagingBack = document.getElementById("btn-staging-back") as HTMLButtonElement;

  // Rodapé Minimalista e Configurações
  private readonly btnBottomSettings = document.getElementById("btn-bottom-settings") as HTMLButtonElement;
  private readonly btnBottomAbout = document.getElementById("btn-bottom-about") as HTMLButtonElement;
  private readonly btnCloseSettings = document.getElementById("btn-close-settings") as HTMLButtonElement;
  private readonly sliderMaster = document.getElementById("setting-master-vol") as HTMLInputElement;
  private readonly sliderSfx = document.getElementById("setting-sfx-vol") as HTMLInputElement;
  private readonly sliderSens = document.getElementById("setting-mouse-sens") as HTMLInputElement;
  private readonly btnFullscreen = document.getElementById("btn-toggle-fullscreen") as HTMLButtonElement;

  private settings: GameSettings;
  private readonly network: NetworkManager;
  private readonly onStartGameCallback: () => void;
  private readonly onVolumeChangeCallback: ((vol: number) => void) | null;
  private readonly onSensitivityChangeCallback: ((sens: number) => void) | null;

  private currentRoomCode: string = "";
  private isConnecting: boolean = false;

  constructor(
    network: NetworkManager,
    initialInvitedRoom: string | null,
    onStartGame: () => void,
    onVolumeChange?: (vol: number) => void,
    onSensitivityChange?: (sens: number) => void,
  ) {
    this.network = network;
    this.onStartGameCallback = onStartGame;
    this.onVolumeChangeCallback = onVolumeChange ?? null;
    this.onSensitivityChangeCallback = onSensitivityChange ?? null;

    // Carrega nome salvo
    const savedName = localStorage.getItem(NAME_KEY) || localStorage.getItem(LEGACY_NAME_KEY) || "";
    if (this.stagingInputName) {
      this.stagingInputName.value = savedName.slice(0, PLAYER_NAME_MAX);
      this.stagingInputName.maxLength = PLAYER_NAME_MAX;
    }

    this.appearance = this.loadAppearance();
    this.settings = this.loadSettings();

    // Aplica volumes salvos
    if (this.onVolumeChangeCallback) {
      this.onVolumeChangeCallback(this.settings.masterVolume);
    }
    if (this.onSensitivityChangeCallback) {
      this.onSensitivityChangeCallback(this.settings.mouseSensitivity);
    }

    // Inicializa preview 3D do personagem
    const previewCanvas = document.getElementById("character-preview-canvas") as HTMLCanvasElement;
    if (previewCanvas) {
      this.characterPreview = new CharacterPreview(previewCanvas);
      this.characterPreview.setAppearance(this.appearance);
    }

    this.setupHomeEvents(initialInvitedRoom);
    this.setupCharacterCreation();
    this.setupRoomManagement(initialInvitedRoom);
    this.setupSettingsAndDock();
  }

  private loadAppearance(): Required<CharacterAppearance> {
    try {
      const raw = localStorage.getItem(CUSTOM_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          color: typeof parsed.color === "string" ? parsed.color : DEFAULT_APPEARANCE.color,
          hair: (parsed.hair as HairType) || DEFAULT_APPEARANCE.hair,
          eyes: (parsed.eyes as EyeType) || DEFAULT_APPEARANCE.eyes,
          beard: (parsed.beard as BeardType) || DEFAULT_APPEARANCE.beard,
          hat: (parsed.hat as HatType) || DEFAULT_APPEARANCE.hat,
        };
      }
    } catch {}
    return { ...DEFAULT_APPEARANCE };
  }

  private saveAppearance(): void {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(this.appearance));
  }

  private loadSettings(): GameSettings {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          masterVolume: typeof parsed.masterVolume === "number" ? parsed.masterVolume : DEFAULT_SETTINGS.masterVolume,
          sfxVolume: typeof parsed.sfxVolume === "number" ? parsed.sfxVolume : DEFAULT_SETTINGS.sfxVolume,
          mouseSensitivity: typeof parsed.mouseSensitivity === "number" ? parsed.mouseSensitivity : DEFAULT_SETTINGS.mouseSensitivity,
        };
      }
    } catch {}
    return { ...DEFAULT_SETTINGS };
  }

  private saveSettings(): void {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
  }

  private getPlayerName(): string {
    const raw = this.stagingInputName?.value.trim() || "";
    return raw.slice(0, PLAYER_NAME_MAX) || "Brave Bean";
  }

  private savePlayerName(): string {
    const name = this.getPlayerName();
    localStorage.setItem(NAME_KEY, name);
    return name;
  }

  /**
   * Configura ações da tela inicial (Home)
   */
  private setupHomeEvents(initialInvitedRoom: string | null): void {
    this.btnHomePlay?.addEventListener("click", async () => {
      // Transiciona para a tela dividida
      this.panelHome.classList.add("hidden");
      this.panelStaging.classList.remove("hidden");

      // Inicia animação 3D de rotação do personagem
      this.characterPreview?.start();
      this.characterPreview?.resize();

      if (initialInvitedRoom) {
        // Se entrou com link de convite, seleciona Entrar em Sala e conecta
        this.selectRoomTab("join");
        if (this.stagingInputCode) {
          this.stagingInputCode.value = initialInvitedRoom;
        }
        await this.connectToRoom(initialInvitedRoom);
      } else {
        // Modo padrão: Criar Sala
        this.selectRoomTab("create");
        const newCode = generateRoomCode();
        this.currentRoomCode = newCode;
        if (this.stagingCreatedCode) {
          this.stagingCreatedCode.textContent = newCode;
        }
        await this.connectToRoom(newCode);
      }
    });
  }

  /**
   * Configura o editor de personagem (Lado Esquerdo da tela dividida)
   */
  private setupCharacterCreation(): void {
    // Atualização de nome em tempo real
    this.stagingInputName?.addEventListener("input", () => {
      const name = this.savePlayerName();
      if (this.network.sessionId) {
        this.network.sendUpdateAppearance(this.appearance, name);
      }
      this.updateLocalPlayerInList();
    });

    // 1) Paleta de Cores
    const colorGrid = document.getElementById("customizer-colors");
    if (colorGrid) {
      colorGrid.innerHTML = "";
      BEAN_COLOR_PALETTE.forEach((item) => {
        const dot = document.createElement("button");
        dot.type = "button";
        dot.className = "color-swatch";
        dot.style.backgroundColor = item.hex;
        dot.title = item.name;
        dot.setAttribute("aria-label", item.name);
        if (item.hex.toLowerCase() === this.appearance.color.toLowerCase()) {
          dot.classList.add("is-selected");
        }

        dot.addEventListener("click", () => {
          colorGrid.querySelectorAll(".color-swatch").forEach((s) => s.classList.remove("is-selected"));
          dot.classList.add("is-selected");
          this.appearance.color = item.hex;
          this.characterPreview?.setAppearance(this.appearance);
          this.saveAppearance();

          // Transmite nova cor para a sala se estiver conectado
          if (this.network.sessionId) {
            this.network.sendUpdateAppearance(this.appearance, this.getPlayerName());
          }
          this.updateLocalPlayerInList();
        });
        colorGrid.appendChild(dot);
      });
    }

    // Dicionário de Ícones Minimalistas 100% Brancos para todas as opções cosméticas
    const OPTION_SVGS: Record<string, string> = {
      // Cabelos
      bald: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M5 5l14 14"/></svg>`,
      buzzcut: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 15c0-4 3.1-7 7-7s7 3 7 7"/><path d="M8 8l1-3M12 8V4M16 8l-1-3"/></svg>`,
      buzz: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 15c0-4 3.1-7 7-7s7 3 7 7"/><path d="M8 8l1-3M12 8V4M16 8l-1-3"/></svg>`,
      medium: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 16c0-5 3.6-9 8-9s8 4 8 9"/><path d="M8 7c1 2 2.5 3 4 3s3-1 4-3"/></svg>`,
      pompadour: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 16c0-4 2.5-7 7-7s7 3 7 7"/><path d="M7 9l3-5 2 4 3-5 2 6"/></svg>`,
      spiky: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 16c0-4 2.5-7 7-7s7 3 7 7"/><path d="M7 9l3-5 2 4 3-5 2 6"/></svg>`,
      long: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19V11c0-4.4 3.6-8 8-8s8 3.6 8 8v8"/><path d="M7 11c1 2 2.5 3 5 3s4-1 5-3"/></svg>`,
      bowl: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 13c0-4.4 3.6-8 8-8s8 3.6 8 8H4z"/><path d="M4 13v3M20 13v3"/></svg>`,

      // Olhos
      oval_large: `<svg viewBox="0 0 24 24" width="22" height="22" fill="#ffffff" aria-hidden="true"><ellipse cx="8" cy="12" rx="2.5" ry="5"/><ellipse cx="16" cy="12" rx="2.5" ry="5"/></svg>`,
      oval_medium: `<svg viewBox="0 0 24 24" width="22" height="22" fill="#ffffff" aria-hidden="true"><ellipse cx="8.5" cy="12" rx="2" ry="3.5"/><ellipse cx="15.5" cy="12" rx="2" ry="3.5"/></svg>`,
      oval_small: `<svg viewBox="0 0 24 24" width="22" height="22" fill="#ffffff" aria-hidden="true"><ellipse cx="9" cy="12" rx="1.5" ry="2.2"/><ellipse cx="15" cy="12" rx="1.5" ry="2.2"/></svg>`,
      round_large: `<svg viewBox="0 0 24 24" width="22" height="22" fill="#ffffff" aria-hidden="true"><circle cx="7.5" cy="12" r="4"/><circle cx="16.5" cy="12" r="4"/></svg>`,
      round_medium: `<svg viewBox="0 0 24 24" width="22" height="22" fill="#ffffff" aria-hidden="true"><circle cx="8" cy="12" r="3"/><circle cx="16" cy="12" r="3"/></svg>`,
      round_small: `<svg viewBox="0 0 24 24" width="22" height="22" fill="#ffffff" aria-hidden="true"><circle cx="9" cy="12" r="1.8"/><circle cx="15" cy="12" r="1.8"/></svg>`,

      // Barbas
      none: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M5 5l14 14"/></svg>`,
      mustache: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 14c2-2 5-1 8 1 3-2 6-3 8-1-1 3-4 4-8 2-4 2-7 1-8-2z"/></svg>`,
      goatee_mustache: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 11c2-1 4 0 7 1 3-1 5-2 7-1-1 2-3 3-7 2-4 1-6 0-7-2z"/><path d="M9 16c1 2 2 3 3 3s2-1 3-3"/></svg>`,
      goatee: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14c1 3 2 5 3 5s2-2 3-5"/></svg>`,
      full_short: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 10c0 4 2.5 8 6 8s6-4 6-8"/><path d="M9 13h6"/></svg>`,
      short_full: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 10c0 4 2.5 8 6 8s6-4 6-8"/><path d="M9 13h6"/></svg>`,
      full_medium: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 9c0 6 3 11 7 11s7-5 7-11"/><path d="M8 12c1 1.5 2.5 2 4 2s3-.5 4-2"/></svg>`,
      medium_full: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 9c0 6 3 11 7 11s7-5 7-11"/><path d="M8 12c1 1.5 2.5 2 4 2s3-.5 4-2"/></svg>`,
      full_thick: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8c0 7 3.5 13 8 13s8-6 8-13"/><path d="M6 11c2 2 4 3 6 3s4-1 6-3"/></svg>`,
      heavy_full: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8c0 7 3.5 13 8 13s8-6 8-13"/><path d="M6 11c2 2 4 3 6 3s4-1 6-3"/></svg>`,

      // Chapéus
      bucket: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 17l4-2h12l4 2"/><path d="M6 15l1.5-6h9l1.5 6"/><path d="M7.5 9h9"/></svg>`,
      fisherman: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 17l4-2h12l4 2"/><path d="M6 15l1.5-6h9l1.5 6"/><path d="M7.5 9h9"/></svg>`,
      tophat: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 18h20"/><path d="M6 18V8h12v10"/><path d="M6 14h12"/></svg>`,
      top_hat: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 18h20"/><path d="M6 18V8h12v10"/><path d="M6 14h12"/></svg>`,
      cap: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 15c0-4 3.5-7 8-7 3 0 5.8 1.5 7 4l3 3H4z"/><circle cx="12" cy="8" r="1" fill="#fff"/></svg>`,
      beanie: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 14c0-4.5 3-8 7-8s7 3.5 7 8"/><rect x="4" y="14" width="16" height="4" rx="2"/><circle cx="12" cy="5" r="1.5" fill="#fff"/></svg>`,
    };

    // 2) Gerador de Botões de Opção com Ícones Minimalistas Brancos (sem texto)
    const setupCategoryButtons = <T extends string>(
      containerId: string,
      options: { id: T; name: string }[],
      currentValue: T,
      onSelect: (val: T) => void,
    ) => {
      const container = document.getElementById(containerId);
      if (!container) return;
      container.innerHTML = "";

      options.forEach((opt) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "cosmetic-option-btn";
        btn.innerHTML = OPTION_SVGS[opt.id] || "";
        btn.title = opt.name;
        btn.setAttribute("aria-label", opt.name);

        if (opt.id === currentValue) {
          btn.classList.add("is-selected");
        }

        btn.addEventListener("click", () => {
          container.querySelectorAll(".cosmetic-option-btn").forEach((b) => b.classList.remove("is-selected"));
          btn.classList.add("is-selected");
          onSelect(opt.id);
          this.characterPreview?.setAppearance(this.appearance);
          this.saveAppearance();

          if (this.network.sessionId) {
            this.network.sendUpdateAppearance(this.appearance, this.getPlayerName());
          }
        });
        container.appendChild(btn);
      });
    };

    setupCategoryButtons("customizer-hair-options", HAIR_OPTIONS, this.appearance.hair, (v) => {
      this.appearance.hair = v;
    });

    setupCategoryButtons("customizer-eyes-options", EYE_OPTIONS, this.appearance.eyes, (v) => {
      this.appearance.eyes = v;
    });

    setupCategoryButtons("customizer-beard-options", BEARD_OPTIONS, this.appearance.beard, (v) => {
      this.appearance.beard = v;
    });

    setupCategoryButtons("customizer-hat-options", HAT_OPTIONS, this.appearance.hat, (v) => {
      this.appearance.hat = v;
    });

    // Abas de navegação no personalizador
    const tabBtns = document.querySelectorAll(".customizer-tab-btn");
    const tabPanes = document.querySelectorAll(".customizer-tab-pane");

    tabBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetTab = btn.getAttribute("data-tab");
        tabBtns.forEach((b) => b.classList.remove("is-active"));
        tabPanes.forEach((p) => p.classList.add("hidden"));

        btn.classList.add("is-active");
        document.getElementById(`tab-${targetTab}`)?.classList.remove("hidden");
      });
    });
  }

  /**
   * Configura o gerenciamento de sala (Lado Direito da tela dividida)
   */
  private setupRoomManagement(initialInvitedRoom: string | null): void {
    // Alternar para Criar Sala
    this.btnTabCreate?.addEventListener("click", async () => {
      this.selectRoomTab("create");
      const newCode = generateRoomCode();
      this.currentRoomCode = newCode;
      if (this.stagingCreatedCode) {
        this.stagingCreatedCode.textContent = newCode;
      }
      await this.connectToRoom(newCode);
    });

    // Alternar para Entrar em Sala
    this.btnTabJoin?.addEventListener("click", () => {
      this.selectRoomTab("join");
      this.stagingInputCode?.focus();
    });

    // Copiar código / link da sala
    this.btnCopyStagingCode?.addEventListener("click", async () => {
      const code = this.currentRoomCode || this.stagingCreatedCode?.textContent || "";
      if (!code) return;

      const url = new URL(window.location.href);
      url.search = "";
      url.searchParams.set("room", code);

      try {
        await navigator.clipboard.writeText(url.toString());
        const originalText = this.btnCopyStagingCode.textContent;
        this.btnCopyStagingCode.textContent = "Copied! ✓";
        setTimeout(() => {
          this.btnCopyStagingCode.textContent = originalText;
        }, 2000);
      } catch {
        // Fallback para clipboard
        prompt("Copy room link:", url.toString());
      }
    });

    // Conectar à sala informada no campo (código ou IP)
    const handleJoinAction = async () => {
      const typed = sanitizeRoomCode(this.stagingInputCode.value);
      if (!typed) {
        this.stagingRoomError.textContent = "Enter room code or IP address.";
        this.stagingInputCode.focus();
        return;
      }
      await this.connectToRoom(typed);
    };

    this.btnStagingConnect?.addEventListener("click", handleJoinAction);
    this.stagingInputCode?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void handleJoinAction();
      }
    });

    // Botão ENTRAR NA ARENA (Começar partida)
    this.btnStartMatch?.addEventListener("click", async () => {
      if (!this.network.sessionId) {
        const code = this.currentRoomCode || generateRoomCode();
        await this.connectToRoom(code);
      }
      this.network.sendEnterWorld();
      this.onStartGameCallback();
      this.hide();
    });

    // Botão Voltar ao Início
    this.btnStagingBack?.addEventListener("click", () => {
      this.network.leave();
      this.characterPreview?.stop();
      this.panelStaging.classList.add("hidden");
      this.panelHome.classList.remove("hidden");
      this.clearPlayerList();
    });

    if (initialInvitedRoom && this.stagingInputCode) {
      this.stagingInputCode.value = initialInvitedRoom;
    }
  }

  private selectRoomTab(tab: "create" | "join"): void {
    if (tab === "create") {
      this.btnTabCreate?.classList.add("is-active");
      this.btnTabJoin?.classList.remove("is-active");
      this.paneCreate?.classList.remove("hidden");
      this.paneJoin?.classList.add("hidden");
    } else {
      this.btnTabJoin?.classList.add("is-active");
      this.btnTabCreate?.classList.remove("is-active");
      this.paneJoin?.classList.remove("hidden");
      this.paneCreate?.classList.add("hidden");
    }
    this.stagingRoomError.textContent = "";
  }

  /**
   * Conecta à sala no servidor e passa a monitorar os jogadores em tempo real
   */
  private async connectToRoom(code: string): Promise<void> {
    if (this.isConnecting) return;
    this.isConnecting = true;
    this.stagingRoomError.textContent = "";
    this.setBusy(true);

    try {
      const name = this.savePlayerName();
      this.currentRoomCode = code;

      // Se já estava conectado em outra sala, sai da anterior
      if (this.network.sessionId && this.network.code !== code) {
        this.network.leave();
      }

      await this.network.connect(name, code, this.appearance);

      if (this.stagingCreatedCode) {
        this.stagingCreatedCode.textContent = this.network.code;
      }

      // Atualiza lista imediatamente
      if (this.network.state) {
        this.onNetworkStateChange(this.network.state);
      }
    } catch (err) {
      console.error(err);
      this.stagingRoomError.textContent = "Could not connect to room. Check code or IP.";
    } finally {
      this.isConnecting = false;
      this.setBusy(false);
    }
  }

  private setBusy(busy: boolean): void {
    if (this.btnStartMatch) this.btnStartMatch.disabled = busy;
    if (this.btnStagingConnect) this.btnStagingConnect.disabled = busy;
    if (this.btnTabCreate) this.btnTabCreate.disabled = busy;
  }

  /**
   * Chamado em tempo real pelo loop de rede sempre que a lista de jogadores mudar
   */
  onNetworkStateChange(state: NetArenaState): void {
    if (!this.stagingPlayerList || !this.stagingPlayerCount) return;

    this.stagingPlayerList.innerHTML = "";
    const players: { id: string; player: NetPlayer }[] = [];

    state.players.forEach((player, id) => {
      players.push({ id, player });
    });

    this.stagingPlayerCount.textContent = `${players.length}/8`;

    if (players.length === 0) {
      const emptyLi = document.createElement("li");
      emptyLi.className = "staging-player-empty";
      emptyLi.textContent = "Connecting and waiting for survivors...";
      this.stagingPlayerList.appendChild(emptyLi);
      return;
    }

    players.forEach(({ id, player }) => {
      const isLocal = id === this.network.sessionId;
      const li = document.createElement("li");
      li.className = `staging-player-item${isLocal ? " is-me" : ""}`;
      li.dataset.sessionId = id;

      const dot = document.createElement("span");
      dot.className = "staging-player-dot";
      dot.style.backgroundColor = player.color || "#2563eb";

      const nameSpan = document.createElement("span");
      nameSpan.className = "staging-player-name";
      nameSpan.textContent = player.name || "Survivor";

      li.appendChild(dot);
      li.appendChild(nameSpan);

      if (isLocal) {
        const badge = document.createElement("span");
        badge.className = "staging-player-badge";
        badge.textContent = "You";
        li.appendChild(badge);
      }

      const statusBadge = document.createElement("span");
      statusBadge.className = "staging-player-status";
      statusBadge.textContent = player.inWorld ? "⚔️ In Arena" : "🎨 In Menu";
      statusBadge.style.cssText = player.inWorld
        ? "font-size: 11px; color: #4ade80; margin-left: auto; font-weight: 600;"
        : "font-size: 11px; color: #94a3b8; margin-left: auto;";
      li.appendChild(statusBadge);

      this.stagingPlayerList.appendChild(li);
    });
  }

  private updateLocalPlayerInList(): void {
    if (!this.network.sessionId || !this.stagingPlayerList) return;
    const localLi = this.stagingPlayerList.querySelector(`li[data-session-id="${this.network.sessionId}"]`);
    if (localLi) {
      const dot = localLi.querySelector(".staging-player-dot") as HTMLElement;
      if (dot) dot.style.backgroundColor = this.appearance.color;
      const nameSpan = localLi.querySelector(".staging-player-name") as HTMLElement;
      if (nameSpan) nameSpan.textContent = this.getPlayerName();
    }
  }

  private clearPlayerList(): void {
    if (this.stagingPlayerList) {
      this.stagingPlayerList.innerHTML = "";
    }
    if (this.stagingPlayerCount) {
      this.stagingPlayerCount.textContent = "0/8";
    }
  }

  /**
   * Configura o rodapé minimalista e o modal de configurações
   */
  private setupSettingsAndDock(): void {
    // Engrenagem minimalista: abre/fecha modal de configurações
    this.btnBottomSettings?.addEventListener("click", () => {
      this.modalSettings.classList.toggle("hidden");
    });

    // Saiba mais sobre mim: botão minimalista todo branco (não precisa funcionar ainda)
    this.btnBottomAbout?.addEventListener("click", () => {
      console.log("[Lost Beans] About me coming soon.");
    });

    // Fechar modal de configurações
    this.btnCloseSettings?.addEventListener("click", () => {
      this.modalSettings.classList.add("hidden");
    });

    // Volume Geral
    if (this.sliderMaster) {
      this.sliderMaster.value = `${Math.round(this.settings.masterVolume * 100)}`;
      this.sliderMaster.addEventListener("input", () => {
        const val = parseFloat(this.sliderMaster.value) / 100;
        this.settings.masterVolume = val;
        this.saveSettings();
        this.onVolumeChangeCallback?.(val);
      });
    }

    // Volume SFX
    if (this.sliderSfx) {
      this.sliderSfx.value = `${Math.round(this.settings.sfxVolume * 100)}`;
      this.sliderSfx.addEventListener("input", () => {
        const val = parseFloat(this.sliderSfx.value) / 100;
        this.settings.sfxVolume = val;
        this.saveSettings();
      });
    }

    // Sensibilidade do Mouse
    if (this.sliderSens) {
      this.sliderSens.value = `${Math.round(this.settings.mouseSensitivity * 100)}`;
      this.sliderSens.addEventListener("input", () => {
        const val = parseFloat(this.sliderSens.value) / 100;
        this.settings.mouseSensitivity = val;
        this.saveSettings();
        this.onSensitivityChangeCallback?.(val);
      });
    }

    // Alternar Tela Cheia
    if (this.btnFullscreen) {
      this.btnFullscreen.addEventListener("click", () => {
        if (!document.fullscreenElement) {
          void document.documentElement.requestFullscreen();
          this.btnFullscreen.textContent = "Exit Fullscreen";
        } else {
          void document.exitFullscreen();
          this.btnFullscreen.textContent = "Fullscreen";
        }
      });
    }
  }

  getAppearance(): Required<CharacterAppearance> {
    return { ...this.appearance };
  }

  hide(): void {
    this.characterPreview?.stop();
    this.root.classList.add("is-leaving");
    window.setTimeout(() => this.root.classList.add("hidden"), 600);
  }

  show(): void {
    this.root.classList.remove("hidden", "is-leaving");
    this.panelStaging.classList.add("hidden");
    this.panelHome.classList.remove("hidden");
  }
}
