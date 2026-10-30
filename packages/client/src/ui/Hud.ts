import {
  formatInGameClock,
  getAmmoCost,
  getArmorRepairCost,
  getArmorUpgradeCost,
  getHordeStatus,
  GUN_TIERS,
  KNIFE_TIERS,
  MAGAZINE_SIZE,
  MAX_GUN_LEVEL,
  MAX_KNIFE_LEVEL,
  MAX_PLAYERS,
  PLAYER_MAX_HP,
  SHOP_POS,
} from "@dark-beans/shared";
import type { NetArenaState, NetPlayer, NetStatus } from "../network/NetworkManager";

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) {
    console.warn(`[Hud] Elemento #${id} não encontrado no DOM`);
    return document.createElement("div") as unknown as T;
  }
  return el as T;
};

const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export const GUN_ICONS: Record<number, string> = {
  1: `<svg class="inv-slot__icon inv-slot__icon--pistol" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="currentColor" d="M21 7h-7l-1-2H3v6l2 1v6h4v-5h2l4-2h6V7zm-2 2h-3l-2 1h-2v2H7V9H5V7h6l1 2h7V9z"/></svg>`,
  2: `<svg class="inv-slot__icon inv-slot__icon--pistol" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="currentColor" d="M22 8h-4V7h-6l-1-2H2v6l2 1v6h4v-5h2l4-2h8V8zm-6 2h-2l-2 1h-2v2H6V9H4V7h7l1 2h4v1z"/></svg>`,
  3: `<svg class="inv-slot__icon inv-slot__icon--pistol" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="#e2e8f0" d="M22 6H5L4 8v4l2 1v7h5v-5h3l5-3V6zm-3 2v2l-4 2h-3v2H7V9h12V8z"/></svg>`,
  4: `<svg class="inv-slot__icon inv-slot__icon--pistol" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="currentColor" d="M21 7h-2V5H4v7h5v10h4v-10h4l4-2V7zM6 7h11v3h-5v2h-2V9H6V7z"/></svg>`,
  5: `<svg class="inv-slot__icon inv-slot__icon--pistol" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="currentColor" d="M22 7h-5l-1-2H3v6h3v3h3v-3h2l3 9h4l-2.5-9h4V7zm-8 2h3v2h-3V9zM5 7h9l1 2H5V7z"/></svg>`,
  6: `<svg class="inv-slot__icon inv-slot__icon--pistol" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="currentColor" d="M23 8h-5V6l-3 1H2v4h3v2h3v-2h3l2 8h3.5l-1.5-8h6V8zM4 9h9v2H4V9zm14 0h3v1h-3V9z"/></svg>`,
  7: `<svg class="inv-slot__icon inv-slot__icon--pistol" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="#38bdf8" d="M23 9h-4V7h-4V5h-3v2H2v4h4v2h2v-2h4l2 9h4l-2-9h7V9zM6 9h4v2H6V9zm8-2h2v2h-2V7zm5 4h2v1h-2v-1z"/><circle cx="15" cy="4" r="1.5" fill="#ff0055"/></svg>`,
};

export const KNIFE_ICONS: Record<number, string> = {
  1: `<svg class="inv-slot__icon inv-slot__icon--knife" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="currentColor" d="M20.71 4.04c-.39-.39-1.02-.39-1.41 0l-7.07 7.07-1.42-1.41 1.42-1.42a1 1 0 0 0-1.42-1.41l-1.41 1.41-1.42-1.41a1 1 0 0 0-1.41 1.41l1.41 1.42-4.24 4.24a3 3 0 0 0 0 4.24l.71.71a3 3 0 0 0 4.24 0l4.24-4.24 1.42 1.41a1 1 0 0 0 1.41-1.41l-1.41-1.42 1.41-1.41a1 1 0 0 0 0-1.42l-1.41-1.41 7.07-7.07c.39-.39.39-1.03 0-1.42z"/></svg>`,
  2: `<svg class="inv-slot__icon inv-slot__icon--knife" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="currentColor" d="M21.7 3.3c-.4-.4-1-.4-1.4 0l-8.5 8.5-1.4-1.4 1.4-1.4-1.4-1.4-1.4 1.4-1.4-1.4-1.4 1.4 1.4 1.4-5 5c-1.2 1.2-1.2 3.1 0 4.2l.7.7c1.2 1.2 3.1 1.2 4.2 0l5-5 1.4 1.4 1.4-1.4-1.4-1.4 1.4-1.4-1.4-1.4 8.5-8.5c.4-.4.4-1 0-1.4z"/></svg>`,
  3: `<svg class="inv-slot__icon inv-slot__icon--knife" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="currentColor" d="M21 3c-5 0-9 4-10 9l-3-1-4 4 3 3-4 4 3 3 4-4 3 3 4-4-1-3c5-1 9-5 9-10zm-15 15c-.6 0-1-.4-1-1s.4-1 1-1 1 .4 1 1-.4 1-1 1z"/></svg>`,
  4: `<svg class="inv-slot__icon inv-slot__icon--knife" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="currentColor" d="M22 2l-14 14-2-2-4 4 3 3-3 3 2 2 3-3 3 3 4-4-2-2 13-17z"/></svg>`,
  5: `<svg class="inv-slot__icon inv-slot__icon--knife" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="#f8fafc" d="M22.5 1.5c-4 2-10 8-13 13l-1.5-.5-4.5 4.5 1.5 1.5-3 3 2 2 3-3 1.5 1.5 4.5-4.5-.5-1.5c5-3 11-9 13-13l-3-3z"/><circle cx="8" cy="14" r="1.5" fill="#fbc531"/></svg>`,
  6: `<svg class="inv-slot__icon inv-slot__icon--knife" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="#00f0ff" d="M21.5 2.5l-8 8-1.5-1.5-4 4 1.5 1.5-6 6 3 3 6-6 1.5 1.5 4-4-1.5-1.5 8-8z"/><path fill="currentColor" d="M7 15l-4 4 2 2 4-4-2-2z"/></svg>`,
  7: `<svg class="inv-slot__icon inv-slot__icon--knife" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="#ff007f" d="M22 2l-6 3 3 3-5 5-2-2-5 5 2 2-6 6 3 3 6-6 2 2 5-5-2-2 5-5 3 3 3-6z"/><circle cx="13" cy="11" r="2" fill="#ffd700"/></svg>`,
};

const ITEM_ICONS: Record<string, string> = {
  knife: KNIFE_ICONS[1]!,
  pistol: GUN_ICONS[1]!,
  bandage: `<svg class="inv-slot__icon inv-slot__icon--bandage" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 16H6c-.55 0-1-.45-1-1V6c0-.55.45-1 1-1h12c.55 0 1 .45 1 1v12c0 .55-.45 1-1 1zm-7-2h2v-3h3v-2h-3V9h-2v3H8v2h3v3z"/></svg>`,
  c4: `<svg class="inv-slot__icon inv-slot__icon--c4" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="2" fill="#475569"/><rect x="5" y="8" width="5" height="8" rx="1" fill="#94a3b8"/><rect x="12" y="9" width="7" height="4" rx="1" fill="#0f172a"/><circle cx="17.5" cy="11" r="1.5" fill="#ef4444"/><path d="M10 6V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2" stroke="#cbd5e1" stroke-width="1.5" fill="none"/></svg>`,
  armor: `<svg class="inv-slot__icon inv-slot__icon--armor" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3zm0 2.18l6 2.25v4.66c0 4.14-2.73 8.01-6 9.07-3.27-1.06-6-4.93-6-9.07V6.43l6-2.25z"/></svg>`,
  defibrillator: `<svg class="inv-slot__icon inv-slot__icon--defibrillator" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" fill="#eab308"/><rect x="5" y="7" width="14" height="10" rx="1" fill="#0f172a"/><path d="M6 12h2.5l1.5-3 2 6 1.5-4 1 2H18" fill="none" stroke="#22d3ee" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M13 1l-3 5h3l-2 5 5-6h-3z" fill="#facc15"/></svg>`,
  plant_sprout: `<svg class="inv-slot__icon inv-slot__icon--plant" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="#15803d" d="M12 22v-8c0-3 2-5 5-5 0 3-2 5-5 5z"/><path fill="#22c55e" d="M12 14c0-3-2-5-5-5 0 3 2 5 5 5z"/><path fill="#4ade80" d="M12 11c0-4 3-7 7-7 0 4-3 7-7 7z"/><path fill="#86efac" d="M12 11c0-4-3-7-7-7 0 4 3 7 7 7z"/><circle cx="12" cy="11" r="1.5" fill="#fef08a"/></svg>`,
  spider_head: `<svg class="inv-slot__icon inv-slot__icon--spider" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="#18181b" d="M12 3c-4.5 0-8 3.5-8 8 0 3.2 1.8 6 4.5 7.2L8 21l3-1.5V21h2v-1.5l3 1.5-.5-2.8c2.7-1.2 4.5-4 4.5-7.2 0-4.5-3.5-8-8-8z"/><path fill="#e2e8f0" d="M9 17l-1 4 2.5-2z M15 17l1 4-2.5-2z"/><circle cx="9.5" cy="10" r="1.5" fill="#ef4444"/><circle cx="14.5" cy="10" r="1.5" fill="#ef4444"/><circle cx="7.5" cy="12.5" r="1.1" fill="#f87171"/><circle cx="16.5" cy="12.5" r="1.1" fill="#f87171"/><circle cx="10" cy="13" r="0.9" fill="#fca5a5"/><circle cx="14" cy="13" r="0.9" fill="#fca5a5"/></svg>`,
  werewolf_tooth: `<svg class="inv-slot__icon inv-slot__icon--tooth" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="#7f1d1d" d="M6 4c0-1 2-2 6-2s6 1 6 2v3H6V4z"/><path fill="#fef3c7" d="M6 7c1 4 3 10 6 15 3-5 5-11 6-15H6z"/><path fill="#fde68a" d="M8 7c1 3.5 2.5 8.5 4 12V7H8z"/><path fill="#dc2626" d="M11 18c.5 1.5 1 4 1 4s.5-2.5 1-4c-.5-.5-1.5-.5-2 0z"/></svg>`,
  sack: `<svg class="inv-slot__icon inv-slot__icon--sack" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="#92400e" d="M8 3l1 3h6l1-3h-8z"/><path fill="#facc15" d="M8 6h8v2H8z"/><path fill="#b45309" d="M8 8c-3 1-5 4-5 8 0 4 3.5 6 9 6s9-2 9-6c0-4-2-7-5-8H8z"/><path fill="#78350f" d="M6 13c1 3 3 5 6 5s5-2 6-5c-2-1-4-1.5-6-1.5S8 12 6 13z"/><path fill="#d97706" d="M12 9c2 0 4 .5 5 1.5-1 3-3 4.5-5 4.5s-4-1.5-5-4.5c1-1 3-1.5 5-1.5z"/></svg>`,
  flare: `<svg class="inv-slot__icon inv-slot__icon--flare" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><rect x="9.5" y="8" width="5" height="13" rx="1.5" fill="#dc2626"/><rect x="9.5" y="14" width="5" height="2.5" fill="#ffffff"/><rect x="9" y="7" width="6" height="1.8" rx="0.5" fill="#991b1b"/><path d="M12 1c-1.5 2-2.8 3.5-2.8 5.2 0 1.5 1.2 2.8 2.8 2.8s2.8-1.3 2.8-2.8c0-1.7-1.3-3.2-2.8-5.2z" fill="#facc15"/><path d="M12 3c-.7 1-1.4 1.8-1.4 2.8 0 .8.6 1.4 1.4 1.4s1.4-.6 1.4-1.4c0-1-.7-1.8-1.4-2.8z" fill="#fff7ed"/><circle cx="6" cy="4" r="1.1" fill="#f97316"/><circle cx="18" cy="4" r="1.1" fill="#f97316"/><circle cx="7.5" cy="7.5" r="0.9" fill="#fbbf24"/><circle cx="16.5" cy="7.5" r="0.9" fill="#fbbf24"/></svg>`,
  sinalizador: `<svg class="inv-slot__icon inv-slot__icon--flare" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><rect x="9.5" y="8" width="5" height="13" rx="1.5" fill="#dc2626"/><rect x="9.5" y="14" width="5" height="2.5" fill="#ffffff"/><rect x="9" y="7" width="6" height="1.8" rx="0.5" fill="#991b1b"/><path d="M12 1c-1.5 2-2.8 3.5-2.8 5.2 0 1.5 1.2 2.8 2.8 2.8s2.8-1.3 2.8-2.8c0-1.7-1.3-3.2-2.8-5.2z" fill="#facc15"/><path d="M12 3c-.7 1-1.4 1.8-1.4 2.8 0 .8.6 1.4 1.4 1.4s1.4-.6 1.4-1.4c0-1-.7-1.8-1.4-2.8z" fill="#fff7ed"/><circle cx="6" cy="4" r="1.1" fill="#f97316"/><circle cx="18" cy="4" r="1.1" fill="#f97316"/><circle cx="7.5" cy="7.5" r="0.9" fill="#fbbf24"/><circle cx="16.5" cy="7.5" r="0.9" fill="#fbbf24"/></svg>`,
};

/**
 * HUD em HTML/CSS sobreposto ao canvas: console de status simplificado (traços de vida e munição),
 * código da sala, copiar link, lista de sobreviventes, status de rede, mira customizada, moedas,
 * relógio acelerado de sobrevivência e alerta de hordas.
 */
export class Hud {
  private readonly root = $("hud");
  private readonly playerList = $<HTMLUListElement>("hud-player-list");
  private readonly playerCount = $("hud-player-count");
  private readonly net = $("hud-net");
  private readonly netText = $("hud-net-text");
  private readonly crosshair = $("crosshair");

  // Relógio Acelerado de Sobrevivência e Indicador de Horda pequeno
  private readonly clockWidget = $("hud-clock-widget");
  private readonly clockTime = $("hud-clock-time");
  private readonly hordeBadge = $("hud-horde-badge");
  private lastAlertedHorde = 0;

  // Console tático minimalista do jogador local: traços de armadura, vida e números de munição
  private readonly armorRow = $("hud-armor-row");
  private readonly hpPips = $("hud-hp-pips");
  private readonly ammoRow = $("hud-ammo-row");
  private readonly ammoCur = $("hud-ammo-current");
  private readonly ammoMax = $("hud-ammo-max");
  private readonly ammoReserve = $("hud-ammo-reserve");
  private readonly reloadTrack = $("hud-reload-track");
  private readonly reloadFill = $("hud-reload-fill");
  private readonly coinsVal = $("hud-coins-val");

  // Slots do Inventário (quadrados com apenas o símbolo do item: 4 slots)
  private readonly invSlots: HTMLElement[] = [
    $("inv-slot-0"),
    $("inv-slot-1"),
    $("inv-slot-2"),
    $("inv-slot-3"),
  ];

  // Elementos da Mini Loja de Equipamentos Minimalista em 2 Abas
  private readonly shopPrompt = $("hud-shop-prompt");
  private readonly doorPrompt = $("hud-door-prompt");
  private readonly doorPromptText = $("hud-door-prompt-text");
  private readonly doorPromptName = $("hud-door-prompt-name");
  private readonly bookPrompt = $("hud-book-prompt");
  private readonly revivePrompt = $("hud-revive-prompt");
  private readonly revivePromptName = $("hud-revive-prompt-name");
  private readonly webbedBanner = $("hud-webbed-banner");

  // Notificação de Resgate por Helicóptero (Substitui o timer no topo quando acionado)
  private readonly rescueWidget = $("hud-rescue-widget");
  private readonly rescueTitle = $("hud-rescue-title");
  private readonly rescueText = $("hud-rescue-text");
  private readonly shopModal = $("shop-modal");
  private readonly shopCoinsVal = $("shop-coins-val");

  // Itens da Loja Minimalista (Equipamentos)
  private readonly shopGunTitle = $("shop-gun-title");
  private readonly shopGunIcon = $("shop-gun-icon");
  private readonly shopGunLevel = $("shop-gun-level");
  private readonly shopGunStat = $("shop-gun-stat");
  private readonly btnBuyGun = $<HTMLButtonElement>("btn-buy-gun");
  private readonly btnBuyGunText = $("btn-buy-gun-text");

  private readonly shopKnifeTitle = $("shop-knife-title");
  private readonly shopKnifeIcon = $("shop-knife-icon");
  private readonly shopKnifeLevel = $("shop-knife-level");
  private readonly shopKnifeStat = $("shop-knife-stat");
  private readonly btnBuyKnife = $<HTMLButtonElement>("btn-buy-knife");
  private readonly btnBuyKnifeText = $("btn-buy-knife-text");

  private readonly btnBuyAmmo = $<HTMLButtonElement>("btn-buy-ammo");
  private readonly btnBuyAmmoText = $("btn-buy-ammo-text");

  private readonly shopBandageCount = $("shop-bandage-count");
  private readonly btnBuyBandage = $<HTMLButtonElement>("btn-buy-bandage");
  private readonly btnBuyBandageText = $("btn-buy-bandage-text");

  private readonly shopC4Count = $("shop-c4-count");
  private readonly btnBuyC4 = $<HTMLButtonElement>("btn-buy-c4");
  private readonly btnBuyC4Text = $("btn-buy-c4-text");

  private readonly shopArmorStatus = $("shop-armor-status");
  private readonly shopArmorStat = $("shop-armor-stat");
  private readonly btnBuyArmor = $<HTMLButtonElement>("btn-buy-armor");
  private readonly btnBuyArmorText = $("btn-buy-armor-text");
  private readonly btnRepairArmor = $<HTMLButtonElement>("btn-repair-armor");
  private readonly btnRepairArmorText = $("btn-repair-armor-text");

  private readonly shopDefibrillatorStatus = $("shop-defibrillator-status");
  private readonly btnBuyDefibrillator = $<HTMLButtonElement>("btn-buy-defibrillator");
  private readonly btnBuyDefibrillatorText = $("btn-buy-defibrillator-text");

  private readonly shopFlareStatus = $("shop-flare-status");
  private readonly shopFlareStat = $("shop-flare-stat");
  private readonly btnBuyFlare = $<HTMLButtonElement>("btn-buy-flare");
  private readonly btnBuyFlareText = $("btn-buy-flare-text");
  private readonly roomCode = $("hud-room-code");

  private latestPlayer: NetPlayer | null = null;
  private latestState: NetArenaState | null = null;
  private localId: string | null = null;

  onSelectSlot?: (slot: number) => void;
  onBuyItem?: (item: string) => void;
  onOpenShop?: () => void;
  onCloseShop?: () => void;
  onHordeAlert?: () => void;

  private rosterSignature = "";

  constructor() {
    this.initPips();
    this.initInventoryClicks();
    this.initShopClicks();
    this.rescueWidget.classList.add("hidden");
    this.rescueWidget.classList.add("is-hidden");
    this.clockWidget.classList.remove("hidden");
    this.clockWidget.classList.remove("is-hidden");
  }

  private initShopClicks(): void {
    $("btn-close-shop").addEventListener("click", () => this.closeShop());
    $("shop-backdrop").addEventListener("click", () => this.closeShop());

    // Prompt clicável na tela: clicar no badge [E] Loja abre a loja
    this.shopPrompt.addEventListener("click", (e) => {
      e.stopPropagation();
      this.openShop();
    });

    // Ações de compra de equipamentos
    const triggerBuy = (item: string, e?: Event) => {
      e?.stopPropagation();
      e?.preventDefault();
      this.onBuyItem?.(item);
    };

    this.btnBuyGun.addEventListener("click", (e) => triggerBuy("gun_upgrade", e));
    this.btnBuyKnife.addEventListener("click", (e) => triggerBuy("knife_upgrade", e));
    this.btnBuyAmmo.addEventListener("click", (e) => triggerBuy("ammo", e));
    this.btnBuyBandage.addEventListener("click", (e) => triggerBuy("bandage", e));
    this.btnBuyC4.addEventListener("click", (e) => triggerBuy("c4", e));
    this.btnBuyArmor.addEventListener("click", (e) => triggerBuy("armor_upgrade", e));
    this.btnRepairArmor.addEventListener("click", (e) => triggerBuy("armor_repair", e));
    this.btnBuyDefibrillator.addEventListener("click", (e) => triggerBuy("defibrillator", e));
    this.btnBuyFlare.addEventListener("click", (e) => triggerBuy("flare", e));

    // Permite clicar em qualquer área do card do item para efetuar a compra
    const cards = document.querySelectorAll<HTMLElement>(".shop-card[data-buy]");
    cards.forEach((card) => {
      card.addEventListener("click", (e) => {
        const item = card.getAttribute("data-buy");
        if (!item) return;
        const btn = card.querySelector<HTMLButtonElement>(".btn-shop-buy");
        if (btn && btn.disabled) return;
        triggerBuy(item, e);
      });
    });
  }

  setShopPromptVisible(visible: boolean): void {
    this.shopPrompt.classList.toggle("hidden", !visible);
  }

  setDoorPromptVisible(visible: boolean, actionText = "Open Door", doorName = ""): void {
    if (!visible) {
      this.doorPrompt.classList.add("hidden");
      return;
    }
    this.doorPromptText.textContent = actionText;
    this.doorPromptName.textContent = doorName;
    this.doorPrompt.classList.remove("hidden");
  }

  setBookPromptVisible(visible: boolean): void {
    this.bookPrompt.classList.toggle("hidden", !visible);
  }

  setRevivePromptVisible(visible: boolean, friendName = ""): void {
    if (!visible) {
      this.revivePrompt.classList.add("hidden");
      return;
    }
    this.revivePromptName.textContent = friendName ? ` - ${friendName}` : "";
    this.revivePrompt.classList.remove("hidden");
  }

  isShopOpen(): boolean {
    return !this.shopModal.classList.contains("hidden");
  }

  openShop(): void {
    this.shopModal.classList.remove("hidden");
    if (this.latestPlayer) this.updateShop(this.latestPlayer);
    this.onOpenShop?.();
  }

  closeShop(): void {
    this.shopModal.classList.add("hidden");
    this.onCloseShop?.();
  }

  toggleShop(): void {
    if (this.isShopOpen()) {
      this.closeShop();
    } else {
      this.openShop();
    }
  }

  private initInventoryClicks(): void {
    this.invSlots.forEach((slotEl, idx) => {
      slotEl.addEventListener("click", () => {
        this.onSelectSlot?.(idx);
      });
    });
  }

  private initPips(): void {
    // 4 pips de armadura permanente (começa em 4, melhora até 14 na loja)
    this.armorRow.innerHTML = "";
    for (let i = 0; i < 4; i++) {
      const pip = document.createElement("div");
      pip.className = "armor-pip is-active";
      this.armorRow.appendChild(pip);
    }

    // 10 pips individuais de vida (traços na cor)
    this.hpPips.innerHTML = "";
    for (let i = 0; i < PLAYER_MAX_HP; i++) {
      const pip = document.createElement("div");
      pip.className = "hp-pip is-active";
      this.hpPips.appendChild(pip);
    }
  }

  show(): void {
    this.root.classList.remove("hidden");
    this.crosshair.classList.remove("hidden");
    document.body.classList.add("in-game");
  }

  setCrosshairVisible(visible: boolean): void {
    if (visible) {
      this.crosshair.classList.remove("hidden");
      document.body.classList.add("in-game");
    } else {
      this.crosshair.classList.add("hidden");
      document.body.classList.remove("in-game");
    }
  }

  setStatus(status: NetStatus): void {
    this.net.classList.toggle("is-online", status === "online");
    this.net.classList.toggle("is-offline", status === "offline");
    this.netText.textContent =
      status === "online" ? "Connected" : status === "connecting" ? "Connecting…" : status === "offline" ? "Disconnected" : "—";
  }

  /** Reconstrói a lista apenas quando algo visível muda (nome, cor, vida, entradas/saídas). */
  updatePlayers(state: NetArenaState, localId: string | null): void {
    this.latestState = state;
    this.localId = localId;
    if (this.latestPlayer) {
      this.updateShop(this.latestPlayer);
    }

    const rows: { id: string; name: string; color: string; hp: number }[] = [];
    state.players.forEach((p, id) => {
      if (p.inWorld) {
        rows.push({ id, name: p.name, color: p.color, hp: p.hp });
      }
    });
    rows.sort((a, b) => (a.id === localId ? -1 : b.id === localId ? 1 : 0));

    const signature = rows.map((r) => `${r.id}|${r.name}|${r.color}|${r.hp}`).join(";");
    if (signature === this.rosterSignature) return;
    this.rosterSignature = signature;

    this.playerCount.textContent = `${rows.length}/${MAX_PLAYERS}`;
    this.playerList.innerHTML = rows
      .map((r) => {
        const pct = Math.max(0, Math.min(100, (r.hp / PLAYER_MAX_HP) * 100));
        const me = r.id === localId;
        return `
          <li class="player-item${me ? " is-me" : ""}" style="--c:${escapeHtml(r.color)}">
            <span class="player-item__avatar"></span>
            <span class="player-item__body">
              <span class="player-item__name">${escapeHtml(r.name)}${me ? "<small>YOU</small>" : ""}</span>
              <span class="hp-bar"><span class="hp-bar__fill" style="--hp:${pct}%"></span></span>
            </span>
          </li>`;
      })
      .join("");
  }

  /** Atualiza o relógio acelerado do jogo e o estado das hordas oficiais */
  updateGameState(state: NetArenaState): void {
    // 0) Código da sala no canto superior direito
    if (state.code && this.roomCode.textContent !== state.code) {
      this.roomCode.textContent = state.code;
    }

    // 1) Relógio acelerado de sobrevivência
    const gameTime = state.gameTime ?? 0;
    const clock = formatInGameClock(gameTime);
    this.clockTime.textContent = clock.formatted;

    // 2) Indicador de status da Horda Oficial com base na progressão (aviso pequeno mantido abaixo do horário)
    const currentHorde = state.currentHorde ?? 0;
    const status = getHordeStatus(gameTime, currentHorde);
    this.hordeBadge.textContent = status.badgeText;
    this.hordeBadge.classList.toggle("is-active", status.isActive);

    // 3) Som e tremor ao iniciar horda (banners grandes de tela foram removidos a pedido)
    if (state.hordeAlert && currentHorde > this.lastAlertedHorde) {
      this.lastAlertedHorde = currentHorde;
      this.onHordeAlert?.();
    }

    // 4) Notificação de Resgate por Helicóptero: substitui o timer no topo central da tela APENAS quando o sinalizador ascende de fato
    const flareActive = Boolean(state.flareTriggered);
    const heliStatus = state.helicopterStatus ?? "none";
    const rescueInProgress = flareActive && heliStatus !== "none" && !state.gameWon;

    if (rescueInProgress) {
      // O timer normal some
      this.clockWidget.classList.add("hidden");
      this.clockWidget.classList.add("is-hidden");
      // A notificação de resgate entra exatamente no lugar do timer
      this.rescueWidget.classList.remove("hidden");
      this.rescueWidget.classList.remove("is-hidden");

      if (heliStatus === "incoming") {
        const secs = Math.max(0, Math.ceil(state.rescueTimer ?? 0));
        this.rescueTitle.textContent = "RESGATE A CAMINHO";
        this.rescueText.textContent = `POUSO EM ${secs}s`;
        this.rescueWidget.classList.toggle("is-critical", secs <= 10);
      } else if (heliStatus === "landing") {
        this.rescueTitle.textContent = "HELICÓPTERO DESCENDO";
        this.rescueText.textContent = "POUSO NO NORTE!";
        this.rescueWidget.classList.remove("is-critical");
      } else if (heliStatus === "landed") {
        this.rescueTitle.textContent = "HELICÓPTERO POUSOU!";
        this.rescueText.textContent = "CORRAM PARA O NORTE!";
        this.rescueWidget.classList.add("is-critical");
      } else {
        this.rescueWidget.classList.add("hidden");
        this.rescueWidget.classList.add("is-hidden");
        this.clockWidget.classList.remove("hidden");
        this.clockWidget.classList.remove("is-hidden");
      }
    } else {
      // Enquanto o sinalizador NÃO for acionado (ou o jogo tiver terminado), o resgate fica 100% oculto e só o timer normal de sobrevivência aparece
      this.rescueWidget.classList.add("hidden");
      this.rescueWidget.classList.add("is-hidden");
      this.clockWidget.classList.remove("hidden");
      this.clockWidget.classList.remove("is-hidden");
    }
  }

  /** Atualiza o console tático do jogador local: armadura cinza, traços de vida e munição */
  updateLocalStatus(player: NetPlayer): void {
    const hp = Math.max(0, Math.min(PLAYER_MAX_HP, Math.round(player.hp)));
    const activeSlot = player.activeSlot ?? 0;
    const activeItem = (activeSlot === 0 ? player.slot0 : activeSlot === 1 ? player.slot1 : player.slot2) ?? "";

    // 1) Atualiza Armadura (HUD de armadura permanente em cima da vida)
    // O usuário começa com 4 pontos. Ao perder os 4, começa a perder vida, mas a armadura não se perde.
    const maxArmor = Math.max(4, Math.min(14, Math.round(player.maxArmor ?? 4)));
    const armor = Math.max(0, Math.min(maxArmor, Math.round(player.armor ?? 0)));

    this.armorRow.classList.remove("is-hidden");
    if (this.armorRow.children.length !== maxArmor) {
      this.armorRow.innerHTML = "";
      for (let i = 0; i < maxArmor; i++) {
        const pip = document.createElement("div");
        pip.className = "armor-pip";
        this.armorRow.appendChild(pip);
      }
    }

    const armorChildren = this.armorRow.children;
    for (let i = 0; i < armorChildren.length; i++) {
      const pip = armorChildren[i] as HTMLElement;
      pip.classList.toggle("is-active", i < armor);
    }

    // 2) Atualiza Traços de Vida (10 traços na cor ou dourados se estiver imortal)
    const isGod = !!player.isGodMode;
    const hpChildren = this.hpPips.children;
    for (let i = 0; i < hpChildren.length; i++) {
      const pip = hpChildren[i] as HTMLElement;
      const active = isGod || i < hp;
      pip.classList.toggle("is-active", active);
      pip.classList.toggle("is-godmode", isGod);
      pip.classList.toggle("is-warning", !isGod && active && hp > 2 && hp <= 5);
      pip.classList.toggle("is-danger", !isGod && active && hp <= 2);
    }

    // 3) Atualiza Número de Balas (x de y e balas reservas)
    const hasPistol = player.slot0 === "pistol" || player.slot1 === "pistol" || player.slot2 === "pistol";
    if (hasPistol) {
      const ammo = Math.max(0, Math.min(MAGAZINE_SIZE, Math.round(player.ammo ?? 0)));
      const maxAmmo = player.maxAmmo ?? MAGAZINE_SIZE;
      const reserve = Math.max(0, Math.round(player.reserveAmmo ?? 0));
      const reloading = player.reloading === true;
      const reloadProgress = Math.max(0, Math.min(1, player.reloadProgress ?? 0));

      this.ammoCur.textContent = `${ammo}`;
      this.ammoMax.textContent = `${maxAmmo}`;
      this.ammoReserve.textContent = `${reserve}`;

      this.ammoCur.classList.toggle("is-empty", ammo === 0);
      this.ammoCur.classList.toggle("is-low", ammo > 0 && ammo <= 3);
      this.ammoReserve.classList.toggle("is-empty", reserve === 0);
      this.ammoRow.classList.toggle("is-dimmed", activeItem !== "pistol");

      if (reloading) {
        this.reloadTrack.classList.remove("is-hidden");
        this.reloadFill.style.width = `${Math.round(reloadProgress * 100)}%`;
      } else {
        this.reloadTrack.classList.add("is-hidden");
        this.reloadFill.style.width = "0%";
      }
    } else {
      // Quando ainda não tiver pistola no inventário
      this.ammoCur.textContent = "—";
      this.ammoMax.textContent = "—";
      this.ammoReserve.textContent = "0";
      this.ammoRow.classList.add("is-dimmed");
      this.reloadTrack.classList.add("is-hidden");
    }

    // 4) Atualiza as moedas na HUD
    this.latestPlayer = player;
    const coins = Math.max(0, Math.round(player.coins ?? 0));
    this.coinsVal.textContent = `${coins}`;

    // 5) Atualiza os Quadrados do Inventário (apenas o símbolo, sem nomes)
    this.updateInventory(player);

    // 6) Atualiza a loja se ela estiver aberta na tela
    if (this.isShopOpen()) {
      this.updateShop(player);
    }

    // 7) Alerta de paralisia de teia
    const isWebbed = (player.webbedTimer ?? 0) > 0;
    this.webbedBanner.classList.toggle("hidden", !isWebbed);
  }

  /** Atualiza dados, botões e custos da Mini Loja Minimalista */
  updateShop(player: NetPlayer): void {
    const coins = Math.max(0, Math.round(player.coins ?? 0));
    this.shopCoinsVal.textContent = `${coins}`;

    // 1) Arma de fogo (7 níveis com progressão visual e de atributos)
    const gLvl = Math.max(1, Math.min(MAX_GUN_LEVEL, player.gunLevel ?? 1));
    const gunTier = GUN_TIERS.find((t) => t.level === gLvl) ?? GUN_TIERS[0]!;
    const nextGunTier = GUN_TIERS.find((t) => t.level === gLvl + 1);

    this.shopGunTitle.textContent = gunTier.name;
    this.shopGunLevel.textContent = gLvl >= MAX_GUN_LEVEL ? `Lvl. ${gLvl} [MAX]` : `Lvl. ${gLvl}`;
    this.shopGunStat.textContent = `${gunTier.damage} Damage · ${gunTier.maxAmmo} Bullets · ${gunTier.fireCooldown}s`;
    this.shopGunIcon.innerHTML = GUN_ICONS[gLvl] ?? GUN_ICONS[1]!;

    if (nextGunTier) {
      this.btnBuyGun.disabled = coins < nextGunTier.upgradeCost;
      this.btnBuyGunText.textContent = `🪙 ${nextGunTier.upgradeCost}`;
    } else {
      this.btnBuyGun.disabled = true;
      this.btnBuyGunText.textContent = "✓ MAX";
    }

    // 2) Faca de Combate (7 níveis com progressão visual e de atributos)
    const kLvl = Math.max(1, Math.min(MAX_KNIFE_LEVEL, player.knifeLevel ?? 1));
    const knifeTier = KNIFE_TIERS.find((t) => t.level === kLvl) ?? KNIFE_TIERS[0]!;
    const nextKnifeTier = KNIFE_TIERS.find((t) => t.level === kLvl + 1);

    this.shopKnifeTitle.textContent = knifeTier.name;
    this.shopKnifeLevel.textContent = kLvl >= MAX_KNIFE_LEVEL ? `Lvl. ${kLvl} [MAX]` : `Lvl. ${kLvl}`;
    this.shopKnifeStat.textContent = `${knifeTier.damage} Damage · ${knifeTier.range.toFixed(1)}m · ${knifeTier.cooldown}s`;
    this.shopKnifeIcon.innerHTML = KNIFE_ICONS[kLvl] ?? KNIFE_ICONS[1]!;

    if (nextKnifeTier) {
      this.btnBuyKnife.disabled = coins < nextKnifeTier.upgradeCost;
      this.btnBuyKnifeText.textContent = `🪙 ${nextKnifeTier.upgradeCost}`;
    } else {
      this.btnBuyKnife.disabled = true;
      this.btnBuyKnifeText.textContent = "✓ MAX";
    }

    // 3) Munição (+1 Pente de reserva: preço sempre fixo em 1 moeda)
    const ammoCost = getAmmoCost(gLvl);
    this.btnBuyAmmo.disabled = coins < ammoCost;
    this.btnBuyAmmoText.textContent = `🪙 ${ammoCost}`;

    // 4) Bandagem Médica (+3 HP)
    const bCount = player.bandageCount ?? 0;
    const isBandageFull = bCount >= 3;
    this.shopBandageCount.textContent = isBandageFull ? "3/3 [FULL]" : `${bCount}/3`;
    this.btnBuyBandage.disabled = coins < 2 || isBandageFull;
    this.btnBuyBandageText.textContent = isBandageFull ? "✓ FULL" : "🪙 2";

    // 5) C4 Explosivo Tático (+1 C4 com timer de 5s e distração)
    const c4Count = player.c4Count ?? 0;
    const isC4Full = c4Count >= 3;
    this.shopC4Count.textContent = isC4Full ? "3/3 [FULL]" : `${c4Count}/3`;
    this.btnBuyC4.disabled = coins < 3 || isC4Full;
    this.btnBuyC4Text.textContent = isC4Full ? "✓ FULL" : "🪙 3";

    // 6) Armadura (Upgrade permanente: 4 ➔ 6 ➔ 8 ➔ 10 ➔ 12 ➔ 14)
    const armor = player.armor ?? 0;
    const maxArmor = player.maxArmor ?? 4;
    const isMax = maxArmor >= 14;
    const nextMax = Math.min(14, maxArmor + 2);
    const armorCost = getArmorUpgradeCost(maxArmor) ?? 0;
    const repairCost = getArmorRepairCost(maxArmor);
    const isArmorFull = armor >= maxArmor;
    this.shopArmorStatus.textContent = `${armor}/${maxArmor} Pts`;
    this.shopArmorStat.textContent = isMax ? `Máximo (${maxArmor} Pts)` : `Upgrade: +2 Pts (${maxArmor} ➔ ${nextMax})`;
    this.btnBuyArmor.disabled = coins < armorCost || isMax;
    this.btnBuyArmorText.textContent = isMax ? "✓ Nível Máx" : `🪙 ${armorCost}`;
    this.btnRepairArmor.disabled = coins < repairCost || isArmorFull;
    this.btnRepairArmorText.textContent = isArmorFull ? "✓ FULL" : `🪙 ${repairCost}`;

    // 6.5) Desfibrilador (Dispositivo Médico para Reviver Amigo Morto - 30 moedas)
    const hasDefibrillator = player.slot2 === "defibrillator" || player.slot3 === "defibrillator";
    this.shopDefibrillatorStatus.textContent = hasDefibrillator ? "Equipped" : "Utilitário";
    this.shopDefibrillatorStatus.classList.toggle("is-active", hasDefibrillator);
    this.btnBuyDefibrillator.disabled = coins < 30 || hasDefibrillator;
    this.btnBuyDefibrillatorText.textContent = hasDefibrillator ? "Equipped" : "🪙 30";

    // 7) Sinalizador (Desbloqueio Cooperativo: 2 jogadores perto da loja, cada um com 2 drops diferentes)
    const BOSS_RELICS = ["plant_sprout", "spider_head", "werewolf_tooth", "sack"];
    const RELIC_NAMES: Record<string, string> = {
      plant_sprout: "🌱 Sprout",
      spider_head: "🕷️ Head",
      werewolf_tooth: "🐺 Tooth",
      sack: "🎒 Sack",
    };

    const getRelics = (p: NetPlayer): string[] => {
      const relics: string[] = [];
      if (p.slot2 && BOSS_RELICS.includes(p.slot2) && !relics.includes(p.slot2)) relics.push(p.slot2);
      if (p.slot3 && BOSS_RELICS.includes(p.slot3) && !relics.includes(p.slot3)) relics.push(p.slot3);
      return relics;
    };

    const hasFlareEquipped =
      player.slot3 === "flare" ||
      player.slot3 === "sinalizador" ||
      player.slot2 === "flare" ||
      player.slot2 === "sinalizador";

    let anyPlayerHasFlare = hasFlareEquipped;
    let partnerNear: NetPlayer | null = null;
    let partnerRelics: string[] = [];

    if (this.latestState) {
      this.latestState.players.forEach((other, otherId) => {
        if (
          other.slot3 === "flare" ||
          other.slot3 === "sinalizador" ||
          other.slot2 === "flare" ||
          other.slot2 === "sinalizador"
        ) {
          anyPlayerHasFlare = true;
        }

        if (otherId !== this.localId && (other.hp ?? 0) > 0 && !partnerNear) {
          const dist = Math.hypot(other.x - SHOP_POS.x, other.z - SHOP_POS.z);
          if (dist <= SHOP_POS.radius + 4.0) {
            partnerNear = other;
            partnerRelics = getRelics(other);
          }
        }
      });
    }

    const myRelics = getRelics(player);
    const combined = new Set([...myRelics, ...partnerRelics]);
    const isCoopReady =
      !anyPlayerHasFlare &&
      myRelics.length === 2 &&
      partnerNear !== null &&
      partnerRelics.length === 2 &&
      combined.size === 4 &&
      BOSS_RELICS.every((br) => combined.has(br));

    if (hasFlareEquipped) {
      this.shopFlareStatus.textContent = "✓ Owned";
      this.shopFlareStatus.className = "shop-badge is-owned";
      this.btnBuyFlare.disabled = true;
      this.btnBuyFlareText.textContent = "✓ OWNED";
      this.btnBuyFlare.classList.remove("is-ready");
      this.shopFlareStat.textContent = "Flare equipped in Slot 4";
    } else if (anyPlayerHasFlare) {
      this.shopFlareStatus.textContent = "✓ Rescue Ready";
      this.shopFlareStatus.className = "shop-badge is-owned";
      this.btnBuyFlare.disabled = true;
      this.btnBuyFlareText.textContent = "✓ EQUIPPED";
      this.btnBuyFlare.classList.remove("is-ready");
      this.shopFlareStat.textContent = "Teammate already has the Flare";
    } else if (isCoopReady) {
      this.shopFlareStatus.textContent = "READY (2P)";
      this.shopFlareStatus.className = "shop-badge is-ready";
      this.btnBuyFlare.disabled = false;
      this.btnBuyFlareText.textContent = "🔥 UNLOCK";
      this.btnBuyFlare.classList.add("is-ready");
      const myNames = myRelics.map((r) => RELIC_NAMES[r] ?? r).join(" + ");
      const partnerNames = partnerRelics.map((r) => RELIC_NAMES[r] ?? r).join(" + ");
      this.shopFlareStat.innerHTML = `<strong>You (${myNames}) + Teammate (${partnerNames})</strong>`;
    } else {
      this.btnBuyFlare.disabled = true;
      this.btnBuyFlare.classList.remove("is-ready");
      this.shopFlareStatus.className = "shop-badge";

      if (!partnerNear) {
        this.shopFlareStatus.textContent = `You: ${myRelics.length}/2`;
        this.btnBuyFlareText.textContent = "🔒 2P at Shop";
        const myDropsStr = myRelics.length > 0 ? myRelics.map((r) => RELIC_NAMES[r] ?? r).join(" and ") : "no drops";
        this.shopFlareStat.textContent = `Requires 2 players near shop (You have ${myDropsStr})`;
      } else {
        this.shopFlareStatus.textContent = `${myRelics.length}/2 & ${partnerRelics.length}/2`;
        this.btnBuyFlareText.textContent = `🔒 ${combined.size}/4 Drops`;
        this.shopFlareStat.textContent = `You have ${myRelics.length}/2 · Teammate has ${partnerRelics.length}/2 drops`;
      }
    }
  }

  /** Atualiza o estado visual dos 4 quadrados de inventário */
  updateInventory(player: NetPlayer): void {
    const activeSlot = player.activeSlot ?? 0;
    const items = [player.slot0 ?? "", player.slot1 ?? "", player.slot2 ?? "", player.slot3 ?? ""];

    for (let i = 0; i < 4; i++) {
      const slotEl = this.invSlots[i];
      if (!slotEl) continue;
      const isActive = i === activeSlot;
      const item = items[i];

      slotEl.classList.toggle("is-active", isActive);
      slotEl.classList.toggle("is-empty", !item);

      let html = `<span class="inv-slot__empty-dot"></span>`;
      if (item === "knife") {
        const kLvl = player.knifeLevel ?? 1;
        html = KNIFE_ICONS[kLvl] ?? KNIFE_ICONS[1]!;
      } else if (item === "pistol") {
        const gLvl = player.gunLevel ?? 1;
        html = GUN_ICONS[gLvl] ?? GUN_ICONS[1]!;
      } else if (item === "bandage") {
        const bCount = player.bandageCount ?? 1;
        html = `${ITEM_ICONS.bandage}<span class="inv-slot__badge">${bCount}</span>`;
      } else if (item === "c4") {
        const c4Count = player.c4Count ?? 1;
        html = `${ITEM_ICONS.c4}<span class="inv-slot__badge">${c4Count}</span>`;
      } else if (item && ITEM_ICONS[item]) {
        html = ITEM_ICONS[item];
      }

      if (slotEl.innerHTML !== html) {
        slotEl.innerHTML = html;
      }
    }
  }

  updateCrosshair(x: number, y: number): void {
    this.crosshair.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }

  toast(_message: string, _ms = 2200): void {
    // Nenhuma mensagem flutuante deve aparecer no topo da tela
  }

  getFormattedSurvivalTime(): string {
    return this.clockTime.textContent || "00:00";
  }

  getCurrentHordeText(): string {
    return this.hordeBadge.textContent || "Horde 1";
  }
}
