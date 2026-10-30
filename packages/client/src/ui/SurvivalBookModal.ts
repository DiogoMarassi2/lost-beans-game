export interface BookSpread {
  spreadIndex: number;
  romanIndicator: string;
  leftPageHtml: string;
  rightPageHtml: string;
}

export const BOOK_SPREADS: BookSpread[] = [
  // ─── SPREAD 1: BASIC RULES & EQUIPMENT ─────────────────────────────────────────
  {
    spreadIndex: 0,
    romanIndicator: "Pages I & II of VIII",
    leftPageHtml: `
      <div class="handwritten-page-inner">
        <h2 class="handwritten-title">The Forest Siege</h2>

        <p class="handwritten-p">
          You awoke in this old cabin. The entire forest reserve has been overtaken by toxic mist and starving zombies.
        </p>

        <p class="handwritten-p">
          <strong>Initial Time:</strong> You have over 1 initial minute of peace before the first attack. Use this time to read, plan, and arm yourself.
        </p>

        <p class="handwritten-p">
          <strong>The Hordes:</strong> At every full hour on the clock, the siren sounds and a new horde surrounds the area for nearly 1 minute of combat. Between hordes, there is a 15-second lull to reload ammo and heal up.
        </p>

        <p class="handwritten-p">
          <strong>Locking Doors:</strong> Press [E] at the cabin doors to lock or unlock them. Locked doors block the monsters' advance.
        </p>

        <p class="handwritten-p">
          <strong>Reviving Teammates:</strong> Fallen survivors don't disappear—their body stays on the ground. A teammate can buy a <strong>Defibrillator</strong> at the shop (🪙 30, Slot 3), walk up to their body, and press <strong>[Left Click]</strong> to shock them back to life!
        </p>
      </div>
    `,
    rightPageHtml: `
      <div class="handwritten-page-inner">
        <h2 class="handwritten-title">Equipment & Spoils</h2>

        <p class="handwritten-p">
          <strong>The 4 Belt Slots:</strong><br>
          • <strong>[1] Knife:</strong> Silent melee combat without spending bullets.<br>
          • <strong>[2] Gun:</strong> Pistol, shotgun, or rifle.<br>
          • <strong>[3] Tactical:</strong> Bandages, C4 mines, vest, Defibrillator, and boss relics.<br>
          • <strong>[4] Special:</strong> Exclusive for boss relics or the Flare.
        </p>

        <p class="handwritten-p">
          <strong>Boss Drop Rule:</strong> When picking up a relic from the ground, it always enters Slot 3 first. If Slots 3 and 4 are both occupied, the old item in Slot 3 drops to the ground and Slot 4 remains untouched.
        </p>

        <p class="handwritten-p">
          <strong>Central Campfire:</strong> Collect coins dropped by the undead to purchase ammunition and medicine.
        </p>

        <div class="handwritten-signature">
          — M. Vance, Park Ranger
        </div>
      </div>
    `,
  },

  // ─── SPREAD 2: THE 4 GUARDIAN BOSSES ────────────────────────────────────────────────
  {
    spreadIndex: 1,
    romanIndicator: "Pages III & IV of VIII",
    leftPageHtml: `
      <div class="handwritten-page-inner">
        <h2 class="handwritten-title">The Bosses — Swamp and Spider</h2>

        <h3 class="handwritten-subtitle">1. Swamp Monster (After Horde 3 ⚬ 300 HP)</h3>
        <p class="handwritten-p">
          Colossus of roots and peat. Slow, but vomits acidic mud that scorches the ground. Keep your distance and shoot the core. Drops the <strong>Ancient Plant Sprout</strong>.
        </p>

        <div class="handwritten-sketch-box">
          <svg class="handwritten-sketch-svg" width="95" height="48" viewBox="0 0 130 90" fill="none" stroke="#15110e" stroke-linecap="round" stroke-linejoin="round">
            <path d="M 40,75 C 38,62 36,46 45,36 C 50,30 58,28 65,28 C 74,28 82,32 86,38 C 94,48 91,62 88,75" stroke-width="2" />
            <path d="M 52,28 C 50,20 54,14 62,13 C 68,12 73,16 75,22 C 78,16 84,18 83,26" stroke-width="1.8" />
            <ellipse cx="58" cy="33" rx="2.5" ry="3.5" fill="#15110e" />
            <ellipse cx="70" cy="34" rx="2.5" ry="3.5" fill="#15110e" />
            <path d="M 57,44 C 62,47 67,46 72,43" stroke-width="1.8" />
            <path d="M 43,38 C 30,44 24,54 22,66 C 21,72 23,78 26,80 C 27,81 30,76 32,71 C 34,65 37,56 41,50" stroke-width="1.8" />
            <path d="M 87,40 C 98,46 104,56 106,67 C 107,73 105,79 101,81 C 99,82 96,76 95,70 C 93,62 90,54 87,48" stroke-width="1.8" />
            <path d="M 48,46 C 55,49 57,58 55,68" stroke-width="1.4" />
            <path d="M 78,44 C 73,49 71,59 74,70" stroke-width="1.4" />
            <path d="M 28,84 C 45,80 82,80 102,84" stroke-width="1.6" />
          </svg>
          <span class="sketch-caption">(The Swamp Monster)</span>
        </div>

        <h3 class="handwritten-subtitle">2. Spider Queen (After Horde 6 ⚬ 600 HP)</h3>
        <p class="handwritten-p">
          Predatory giant spider. Spits web cocoons that <strong>paralyze</strong> survivors on the ground. Don't let her get close! Drops the <strong>Spider Head</strong>.
        </p>

        <div class="handwritten-sketch-box">
          <svg class="handwritten-sketch-svg" width="95" height="48" viewBox="0 0 130 90" fill="none" stroke="#15110e" stroke-linecap="round" stroke-linejoin="round">
            <ellipse cx="64" cy="50" rx="9" ry="11" stroke-width="2" />
            <ellipse cx="64" cy="27" rx="14" ry="16" stroke-width="2" />
            <path d="M 56,22 C 64,25 72,22 72,22" stroke-width="1.4" />
            <path d="M 54,28 C 64,32 74,28 74,28" stroke-width="1.4" />
            <circle cx="61" cy="56" r="1.5" fill="#15110e" />
            <circle cx="67" cy="56" r="1.5" fill="#15110e" />
            <path d="M 60,60 C 59,65 57,69 54,71" stroke-width="1.8" />
            <path d="M 68,60 C 69,65 71,69 74,71" stroke-width="1.8" />
            <path d="M 57,47 C 42,38 32,32 18,36 C 13,46 10,60 8,72" stroke-width="1.8" />
            <path d="M 56,50 C 44,48 30,46 19,57 C 14,64 12,74 11,83" stroke-width="1.8" />
            <path d="M 71,47 C 86,38 96,32 110,36 C 115,46 118,60 120,72" stroke-width="1.8" />
            <path d="M 72,50 C 84,48 98,46 109,57 C 114,64 116,74 117,83" stroke-width="1.8" />
          </svg>
          <span class="sketch-caption">(The Spider Queen)</span>
        </div>
      </div>
    `,
    rightPageHtml: `
      <div class="handwritten-page-inner">
        <h2 class="handwritten-title">The Bosses — Alpha and Sack Man</h2>

        <h3 class="handwritten-subtitle">3. Alpha Werewolf (After Horde 9 ⚬ 900 HP)</h3>
        <p class="handwritten-p">
          Agile and bloodthirsty beast. Delivers long leaps and devastating claw strikes. Use shotguns to intercept him mid-air and dodge his lunges. Drops the <strong>Wolf Tooth</strong>.
        </p>

        <div class="handwritten-sketch-box">
          <svg class="handwritten-sketch-svg" width="95" height="48" viewBox="0 0 130 90" fill="none" stroke="#15110e" stroke-linecap="round" stroke-linejoin="round">
            <path d="M 38,58 C 34,55 30,52 22,50 C 18,49 14,52 16,55 C 20,57 26,60 30,64 C 33,67 38,67 43,65" stroke-width="1.8" />
            <path d="M 22,50 L 24,53 L 26,51 L 28,54 L 30,52" stroke-width="1.4" />
            <polygon points="34,45 37,45 35,48" fill="#15110e" />
            <path d="M 45,38 C 47,26 53,16 57,12 C 59,18 57,28 55,36" stroke-width="1.8" />
            <path d="M 56,36 C 65,37 75,40 84,45 C 93,51 100,60 106,72" stroke-width="2" />
            <path d="M 43,65 C 47,72 53,78 62,82 C 72,85 85,85 96,82" stroke-width="1.8" />
            <path d="M 48,70 C 44,74 38,76 30,77 C 24,78 18,74 14,70" stroke-width="1.8" />
            <path d="M 14,70 C 10,71 8,74 6,78" stroke-width="2" />
            <path d="M 112,14 C 107,19 107,27 112,32 C 109,30 105,24 107,18 C 108,16 110,15 112,14 Z" stroke-width="1.4" fill="#15110e" fill-opacity="0.15" />
          </svg>
          <span class="sketch-caption">(The Alpha Werewolf)</span>
        </div>

        <h3 class="handwritten-subtitle">4. Sack Man (After Horde 12 ⚬ 1200 HP)</h3>
        <p class="handwritten-p">
          The executioner of the wastelands. Tattered trench coat and a colossal sack of souls. His area attacks shatter the ground and can disarm you. Drops the <strong>Mysterious Sack</strong>.
        </p>

        <div class="handwritten-sketch-box">
          <svg class="handwritten-sketch-svg" width="95" height="48" viewBox="0 0 130 90" fill="none" stroke="#15110e" stroke-linecap="round" stroke-linejoin="round">
            <path d="M 40,28 C 48,22 62,22 72,28 C 76,30 78,32 82,31" stroke-width="1.8" />
            <path d="M 46,25 C 47,16 53,13 60,13 C 66,13 69,17 68,24" stroke-width="1.8" />
            <circle cx="52" cy="36" r="1.5" fill="#15110e" />
            <circle cx="61" cy="36" r="1.5" fill="#15110e" />
            <path d="M 46,38 C 42,46 39,56 36,70 C 35,76 33,83 31,88" stroke-width="2" />
            <path d="M 66,40 C 68,48 69,58 70,72 C 70,78 71,84 71,88" stroke-width="1.8" />
            <path d="M 68,36 C 76,32 86,34 94,40 C 104,48 108,60 106,72 C 104,80 96,86 86,86 C 78,86 72,82 69,76" stroke-width="2" />
            <rect x="84" y="52" width="12" height="10" stroke-width="1.4" stroke-dasharray="2 2" />
            <path d="M 33,60 L 26,88" stroke-width="1.8" />
          </svg>
          <span class="sketch-caption">(The Sack Man)</span>
        </div>
      </div>
    `,
  },

  // ─── SPREAD 3: FLARE & CO-OP COOPERATION ─────────────────────────────────────────
  {
    spreadIndex: 2,
    romanIndicator: "Pages V & VI of VIII",
    leftPageHtml: `
      <div class="handwritten-page-inner">
        <h2 class="handwritten-title">The Escape Plan</h2>

        <p class="handwritten-p">
          The land exits are permanently barricaded. The only path out of the valley is calling in military air extraction.
        </p>

        <p class="handwritten-p">
          <strong>Step 1: Collect All 4 Boss Relics</strong><br>
          Eliminate the Swamp Monster, Spider Queen, Werewolf, and Sack Man to gather the four legendary items.
        </p>

        <p class="handwritten-p">
          <strong>Step 2: Co-op Unlock at the Shop</strong><br>
          Both survivors must stand together near the shop. Each player must hold <strong>exactly 2 boss relics</strong> in their slots (no duplicates). When both are in range, the shop unlocks the <strong>Rescue Flare</strong> for purchase into Slot 4.
        </p>

        <p class="handwritten-p">
          Without the flare, the rescue helicopter will never know your location!
        </p>
      </div>
    `,
    rightPageHtml: `
      <div class="handwritten-page-inner">
        <h2 class="handwritten-title">The Military Flare</h2>

        <p class="handwritten-p">
          <strong>How to Deploy:</strong><br>
          1. Press <strong>[4]</strong> to equip the Rescue Flare.<br>
          2. Click the <strong>Left Mouse Button</strong> to pull the safety pin.
        </p>

        <p class="handwritten-p">
          <strong>The Red Smoke:</strong><br>
          Thick crimson smoke billows into the sky. It marks your ground coordinates for the extraction flight squadron.
        </p>

        <p class="handwritten-p">
          <strong>Prepare for Battle:</strong><br>
          The smoke alerts every remaining zombie in the area. Hold the line!
        </p>

        <div class="handwritten-sketch-box">
          <svg class="handwritten-sketch-svg" width="95" height="52" viewBox="0 0 130 96" fill="none" stroke="#15110e" stroke-linecap="round" stroke-linejoin="round">
            <path d="M 20,90 C 45,88 85,88 115,90" stroke-width="1.3" />
            <rect x="56" y="58" width="18" height="32" rx="2" stroke-width="2" />
            <line x1="56" y1="66" x2="74" y2="66" stroke-width="1.5" />
            <line x1="56" y1="82" x2="74" y2="82" stroke-width="1.5" />
            <path d="M 60,58 C 60,54 70,54 70,58" stroke-width="1.8" />
            <path d="M 63,46 C 54,42 50,34 56,28 C 62,22 55,16 62,10 C 68,5 78,6 82,12 C 86,18 78,24 84,30 C 90,36 82,42 70,46" stroke-width="1.8" />
            <path d="M 45,28 C 42,22 45,14 52,11 C 58,8 60,3 55,2" stroke-width="1.3" stroke-dasharray="3 2" />
            <path d="M 88,24 C 95,20 98,12 94,6 C 90,1 84,2 80,0" stroke-width="1.3" stroke-dasharray="3 2" />
          </svg>
          <span class="sketch-caption">(Military Rescue Flare)</span>
        </div>
      </div>
    `,
  },

  // ─── SPREAD 4: THE RESCUE HELICOPTER & CO-OP EXTRACTION ────────────────────────
  {
    spreadIndex: 3,
    romanIndicator: "Pages VII & VIII of VIII",
    leftPageHtml: `
      <div class="handwritten-page-inner">
        <h2 class="handwritten-title">The Rescue Helicopter</h2>

        <p class="handwritten-p">
          <strong>The 30-Second Flight:</strong><br>
          From the exact second you deploy the flare, the military rescue helicopter takes <strong>30 real-world seconds</strong> to fly over the valley.
        </p>

        <p class="handwritten-p">
          <strong>Northern Helipad:</strong><br>
          The helicopter descends from the sky onto the circular landing pad located at the <strong>very top of the map (North)</strong>, equipped with high-intensity beacon lights and a searchlight.
        </p>

        <p class="handwritten-p">
          <strong>Arrival Notification:</strong><br>
          During the 30s countdown, the top survival timer is replaced by the tactical flight status displaying the incoming landing sequence.
        </p>
      </div>
    `,
    rightPageHtml: `
      <div class="handwritten-page-inner">
        <h2 class="handwritten-title">Co-op Boarding & Escape</h2>

        <p class="handwritten-p">
          <strong>Run Together With Your Teammate:</strong><br>
          Once the aircraft touches down, the rescue zone is armed. <strong>Both you and your friend must sprint to the helicopter together!</strong>
        </p>

        <p class="handwritten-p">
          <strong>The Victory Condition:</strong><br>
          The pilot will hold the doors open on the ground until all surviving friends enter the helipad ring. As soon as both arrive, the helicopter takes off into the sky and the nightmare ends: <strong>THE GAME IS WON!</strong>
        </p>

        <div class="handwritten-sketch-box">
          <svg class="handwritten-sketch-svg" width="105" height="52" viewBox="0 0 140 85" fill="none" stroke="#15110e" stroke-linecap="round" stroke-linejoin="round">
            <!-- Pás do rotor girando -->
            <line x1="20" y1="18" x2="120" y2="18" stroke-width="2.5" />
            <line x1="68" y1="18" x2="68" y2="28" stroke-width="2" />
            <ellipse cx="70" cy="18" rx="46" ry="5" stroke-width="1.2" stroke-dasharray="3 3" />
            <!-- Corpo do helicóptero -->
            <path d="M 40,42 C 40,28 60,26 84,28 C 96,30 102,36 104,44 C 104,54 94,58 78,58 C 55,58 40,54 40,42 Z" stroke-width="2" />
            <path d="M 82,32 C 92,34 98,38 98,44 L 80,44 Z" stroke-width="1.5" />
            <!-- Viga da cauda e rotor traseiro -->
            <path d="M 42,36 L 16,30 L 14,24 L 20,24" stroke-width="1.8" />
            <line x1="14" y1="20" x2="14" y2="34" stroke-width="2" />
            <!-- Esquis de pouso -->
            <line x1="48" y1="68" x2="98" y2="68" stroke-width="2.5" />
            <path d="M 98,68 C 104,68 107,64 108,60" stroke-width="2" />
            <line x1="56" y1="58" x2="52" y2="68" stroke-width="1.8" />
            <line x1="86" y1="58" x2="84" y2="68" stroke-width="1.8" />
            <!-- Heliponto no chão com letra H -->
            <ellipse cx="70" cy="76" rx="48" ry="8" stroke-width="1.5" stroke-dasharray="4 2" />
            <path d="M 64,72 L 64,80 M 76,72 L 76,80 M 64,76 L 76,76" stroke-width="1.8" />
          </svg>
          <span class="sketch-caption">(Rescue Helicopter & Helipad)</span>
        </div>

        <div class="handwritten-signature">
          — Extraction Squadron Alpha
        </div>
      </div>
    `,
  },
];

export class SurvivalBookModal {
  private readonly modal = document.getElementById("book-modal")!;
  private readonly backdrop = document.getElementById("book-modal-backdrop")!;
  private readonly closeBtn = document.getElementById("btn-close-book")!;
  private readonly prevBtn = document.getElementById("btn-book-prev") as HTMLButtonElement;
  private readonly nextBtn = document.getElementById("btn-book-next") as HTMLButtonElement;
  private readonly pageIndicator = document.getElementById("book-page-indicator")!;
  private readonly leftPage = document.getElementById("book-left-page")!;
  private readonly rightPage = document.getElementById("book-right-page")!;
  private readonly spreadContainer = document.getElementById("book-spread-container")!;

  private currentSpread = 0;
  private isOpen = false;

  onOpen?: () => void;
  onTurnPage?: () => void;

  constructor() {
    this.closeBtn.addEventListener("click", () => this.close());
    this.backdrop.addEventListener("click", () => this.close());

    this.prevBtn.addEventListener("click", () => this.prevSpread());
    this.nextBtn.addEventListener("click", () => this.nextSpread());

    // Permite folhear clicando nas bordas das páginas
    this.leftPage.addEventListener("click", (e) => {
      // Se clicou na metade externa esquerda, volta folha
      const rect = this.leftPage.getBoundingClientRect();
      if (e.clientX - rect.left < rect.width * 0.3) {
        this.prevSpread();
      }
    });

    this.rightPage.addEventListener("click", (e) => {
      // Se clicou na metade externa direita, avança folha
      const rect = this.rightPage.getBoundingClientRect();
      if (rect.right - e.clientX < rect.width * 0.3) {
        this.nextSpread();
      }
    });

    window.addEventListener("keydown", (e) => {
      if (!this.isOpen) return;
      if (e.code === "Escape" || e.code === "KeyE") {
        e.preventDefault();
        this.close();
      } else if (e.code === "ArrowLeft" || e.code === "KeyA") {
        e.preventDefault();
        this.prevSpread();
      } else if (e.code === "ArrowRight" || e.code === "KeyD") {
        e.preventDefault();
        this.nextSpread();
      }
    });

    this.render();
  }

  isModalOpen(): boolean {
    return this.isOpen;
  }

  open(spreadIndex = 0): void {
    this.currentSpread = Math.max(0, Math.min(BOOK_SPREADS.length - 1, spreadIndex));
    this.isOpen = true;
    this.modal.classList.remove("hidden");
    this.onOpen?.();
    this.render();
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.modal.classList.add("hidden");
  }

  toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  prevSpread(): void {
    if (this.currentSpread > 0) {
      this.currentSpread--;
      this.animateTurn("left");
      this.onTurnPage?.();
      this.render();
    }
  }

  nextSpread(): void {
    if (this.currentSpread < BOOK_SPREADS.length - 1) {
      this.currentSpread++;
      this.animateTurn("right");
      this.onTurnPage?.();
      this.render();
    }
  }

  private animateTurn(direction: "left" | "right"): void {
    this.spreadContainer.classList.remove("anim-flip-left", "anim-flip-right");
    // Força reflow
    void this.spreadContainer.offsetWidth;
    this.spreadContainer.classList.add(direction === "right" ? "anim-flip-right" : "anim-flip-left");
  }

  private render(): void {
    const spread = BOOK_SPREADS[this.currentSpread]!;
    this.pageIndicator.textContent = spread.romanIndicator;
    this.leftPage.innerHTML = spread.leftPageHtml;
    this.rightPage.innerHTML = spread.rightPageHtml;

    this.prevBtn.disabled = this.currentSpread === 0;
    this.nextBtn.disabled = this.currentSpread === BOOK_SPREADS.length - 1;
  }
}
