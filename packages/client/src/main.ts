import * as THREE from "three";
import {
  BULLET_LIFETIME,
  BULLET_RADIUS,
  ClientMessage,
  DEFIBRILLATOR_REVIVE_RADIUS,
  DOOR_DEFINITIONS,
  getActiveDoorColliders,
  getStaticCollidersNear,
  GUN_TIERS,
  MAP_MAX_X,
  MAP_MAX_Z,
  MAP_MIN_X,
  MAP_MIN_Z,
  OBSTACLES,
  INPUT_SEND_RATE,
  TICK_MS,
  KNIFE_TIERS,
  MAGAZINE_SIZE,
  PLAYER_RADIUS,
  resolveStatic,
  separateCircles,
  SHOP_POS,
  START_CAMPFIRE_X,
  START_CAMPFIRE_Z,
  type DoorDefinition,
} from "@dark-beans/shared";
import { SceneManager } from "./core/SceneManager";
import { CameraController } from "./core/CameraController";
import { InputManager } from "./core/InputManager";
import { LocalPredictor } from "./core/LocalPredictor";
import { SoundManager } from "./core/SoundManager";
import { NetworkManager, type NetArenaState } from "./network/NetworkManager";
import { PlayerView } from "./entities/PlayerView";
import { Arena } from "./world/Arena";
import { Campfire } from "./world/Campfire";
import { Ambience } from "./world/Ambience";
import { Hud } from "./ui/Hud";
import { MainMenu } from "./ui/MainMenu";
import { DeathScreen } from "./ui/DeathScreen";
import { BulletView } from "./entities/BulletView";
import { ZombieView } from "./entities/ZombieView";
import { AmmoBoxView } from "./entities/AmmoBoxView";
import { SlimePuddleView } from "./entities/SlimePuddleView";
import { SpitProjectileView } from "./entities/SpitProjectileView";
import { MortarLobView } from "./entities/MortarLobView";
import { DoorView } from "./entities/DoorView";
import { C4MineView } from "./entities/C4MineView";
import { SurvivalBookModal } from "./ui/SurvivalBookModal";
import { WelcomeAlertModal } from "./ui/WelcomeAlertModal";
import { HelicopterView } from "./entities/HelicopterView";
import { VictoryScreen } from "./ui/VictoryScreen";
import { HELICOPTER_RESCUE_POS } from "@dark-beans/shared";

/** Posição do diário de sobrevivência em cima da mesa na cabana inicial */
const BOOK_POS = { x: -25.8, y: 0.78, z: -1.8, radius: 3.2 };

/**
 * Ponto de entrada: une Rede, Cena e Loop de Render.
 */

// ─── Cena ──────────────────────────────────────────────────────────────────
const sceneManager = new SceneManager(document.getElementById("game-root")!);
const cameraController = new CameraController(sceneManager.aspect);
sceneManager.onResize = (w, h) => cameraController.resize(w, h);

const arena = new Arena();
const campfire = new Campfire(START_CAMPFIRE_X, START_CAMPFIRE_Z);
const ambience = new Ambience();
sceneManager.add(arena.group, campfire.group, ambience.points);

// ─── Input, rede e UI ──────────────────────────────────────────────────────
const sound = new SoundManager();
const input = new InputManager(sceneManager.canvas, cameraController.camera);
const network = new NetworkManager();
const hud = new Hud();
const deathScreen = new DeathScreen();
const victoryScreen = new VictoryScreen();
const welcomeModal = new WelcomeAlertModal();
const helicopterView = new HelicopterView();
sceneManager.add(helicopterView.root);

const bookModal = new SurvivalBookModal();
bookModal.onOpen = () => sound.playPageTurn();
bookModal.onTurnPage = () => sound.playPageTurn();
welcomeModal.onClose = () => {
  input.enabled = true;
};
const predictor = new LocalPredictor();
const views = new Map<string, PlayerView>();
const bulletViews = new Map<string, BulletView>();
/**
 * Balas do jogador local desenhadas na hora do disparo (sem esperar o servidor, que fica a um ping
 * de distância). Só visuais: o dano continua sendo calculado pelo servidor. As balas do jogador
 * local que chegam do servidor não são desenhadas, para não aparecerem em dobro.
 */
const localBullets: { view: BulletView; age: number }[] = [];

const spawnLocalBullet = (gunLevel: number): void => {
  const sin = Math.sin(lastAim);
  const cos = Math.cos(lastAim);
  // Mesma distância do cano usada pelo servidor (CombatSystem)
  const muzzleDist = gunLevel >= 6 ? 0.95 : gunLevel >= 3 ? 0.85 : 0.75;
  const view = new BulletView(predictor.x + sin * muzzleDist, predictor.z + cos * muzzleDist, lastAim);
  sceneManager.add(view.root);
  localBullets.push({ view, age: 0 });
};

/** Avança as balas locais com as mesmas colisões do servidor e remove as que acertaram algo. */
const updateLocalBullets = (dt: number): void => {
  const doorColliders = getActiveDoorColliders(doorViews);
  const hitsBox = (x: number, z: number, box: { minX: number; maxX: number; minZ: number; maxZ: number }) =>
    x >= box.minX - BULLET_RADIUS && x <= box.maxX + BULLET_RADIUS && z >= box.minZ - BULLET_RADIUS && z <= box.maxZ + BULLET_RADIUS;

  for (let i = localBullets.length - 1; i >= 0; i--) {
    const lb = localBullets[i]!;
    lb.age += dt;
    lb.view.update(dt);
    const { x, z } = lb.view.position;

    let done = lb.age >= BULLET_LIFETIME || x <= MAP_MIN_X || x >= MAP_MAX_X || z <= MAP_MIN_Z || z >= MAP_MAX_Z;
    if (!done) done = OBSTACLES.some((o) => (x - o.x) ** 2 + (z - o.z) ** 2 < (o.r + BULLET_RADIUS) ** 2);
    if (!done) done = getStaticCollidersNear(x, z).some((b) => hitsBox(x, z, b));
    if (!done) done = doorColliders.some((b) => hitsBox(x, z, b));
    if (!done) {
      for (const zView of zombieViews.values()) {
        if (!zView.isAlive) continue;
        const r = zView.radius + BULLET_RADIUS;
        if ((x - zView.position.x) ** 2 + (z - zView.position.z) ** 2 < r * r) {
          done = true;
          break;
        }
      }
    }

    if (done) {
      lb.view.dispose();
      localBullets.splice(i, 1);
    }
  }
};
const zombieViews = new Map<string, ZombieView>();
const ammoBoxViews = new Map<string, AmmoBoxView>();
const slimePuddleViews = new Map<string, SlimePuddleView>();
const spitProjectileViews = new Map<string, SpitProjectileView>();
const mortarLobViews = new Map<string, MortarLobView>();
const doorViews = new Map<string, DoorView>();
const c4MineViews = new Map<string, C4MineView>();
const playerHpMap = new Map<string, number>();
const zombieHpMap = new Map<string, number>();

// Inicializa as portas interativas 3D na arena
for (const def of DOOR_DEFINITIONS) {
  const dv = new DoorView(def);
  doorViews.set(def.id, dv);
  sceneManager.add(dv.root);
}

let serverLocal: { x: number; y: number; z: number } | null = null;
let sendAccumulator = 0;
let lastAim = 0;
let localActiveSlot = 0;
let localActiveItem:
  | "knife"
  | "pistol"
  | "bandage"
  | "armor"
  | "c4"
  | "defibrillator"
  | "plant_sprout"
  | "spider_head"
  | "werewolf_tooth"
  | "sack"
  | "flare"
  | "sinalizador"
  | "" = "knife";
let localPrevReloading = false;
let localPrevReserve: number | undefined;
let localPrevCoins: number | undefined;
let localPrevHp: number | undefined;
let localPrevArmor: number | undefined;
let localPrevHadPistol: boolean | undefined;
let localPrevBandageCount: number | undefined;
let localPrevSlot2: string | undefined;
let localPrevSlot3: string | undefined;
let localPrevInWorld = false;
let lastPickupSoundTime = 0;
let dryFireCooldown = 0;
let gunCooldown = 0;
let knifeCooldown = 0;
let bandageCooldown = 0;
let c4Cooldown = 0;
let defibrillatorCooldown = 0;
let prevHeliStatus: string | undefined;

/** Efeito visual de arco elétrico e faíscas ao usar o desfibrilador */
function triggerDefibrillatorSparks(
  fromX: number,
  fromY: number,
  fromZ: number,
  toX: number,
  toY: number,
  toZ: number
) {
  const group = new THREE.Group();

  // 1. Linhas de raio elétrico em zigue-zague entre o desfibrilador e o corpo
  const segments = 8;
  const points: THREE.Vector3[] = [];
  const start = new THREE.Vector3(fromX, fromY, fromZ);
  const end = new THREE.Vector3(toX, toY, toZ);
  points.push(start.clone());

  for (let i = 1; i < segments; i++) {
    const alpha = i / segments;
    const mid = new THREE.Vector3().lerpVectors(start, end, alpha);
    mid.x += (Math.random() - 0.5) * 0.45;
    mid.y += (Math.random() - 0.5) * 0.45 + 0.15;
    mid.z += (Math.random() - 0.5) * 0.45;
    points.push(mid);
  }
  points.push(end.clone());

  const geom = new THREE.BufferGeometry().setFromPoints(points);
  const mat = new THREE.LineBasicMaterial({
    color: 0x22d3ee,
    transparent: true,
    opacity: 1.0,
  });
  const lightningLine = new THREE.Line(geom, mat);
  group.add(lightningLine);

  // 2. Halo elétrico no alvo caído (esfera expansiva de choque)
  const sphereGeom = new THREE.SphereGeometry(0.4, 12, 12);
  const sphereMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    wireframe: true,
    transparent: true,
    opacity: 0.9,
  });
  const sphere = new THREE.Mesh(sphereGeom, sphereMat);
  sphere.position.set(toX, toY + 0.2, toZ);
  group.add(sphere);

  // 3. Faíscas pontuais voando
  const sparkCount = 18;
  const sparkGeom = new THREE.BufferGeometry();
  const sparkPositions = new Float32Array(sparkCount * 3);
  const velocities: { x: number; y: number; z: number }[] = [];
  for (let i = 0; i < sparkCount; i++) {
    sparkPositions[i * 3] = toX + (Math.random() - 0.5) * 0.3;
    sparkPositions[i * 3 + 1] = toY + 0.2 + (Math.random() - 0.5) * 0.3;
    sparkPositions[i * 3 + 2] = toZ + (Math.random() - 0.5) * 0.3;
    velocities.push({
      x: (Math.random() - 0.5) * 4,
      y: Math.random() * 3 + 1,
      z: (Math.random() - 0.5) * 4,
    });
  }
  sparkGeom.setAttribute("position", new THREE.BufferAttribute(sparkPositions, 3));
  const sparkMat = new THREE.PointsMaterial({
    color: 0xfacc15,
    size: 0.14,
    transparent: true,
    opacity: 1,
  });
  const sparkPoints = new THREE.Points(sparkGeom, sparkMat);
  group.add(sparkPoints);

  sceneManager.add(group);

  let elapsed = 0;
  const duration = 0.5;
  const animInterval = setInterval(() => {
    elapsed += 0.03;
    const progress = elapsed / duration;
    if (progress >= 1) {
      clearInterval(animInterval);
      sceneManager.scene.remove(group);
      geom.dispose();
      mat.dispose();
      sphereGeom.dispose();
      sphereMat.dispose();
      sparkGeom.dispose();
      sparkMat.dispose();
      return;
    }

    const scale = 1 + progress * 2.8;
    sphere.scale.set(scale, scale, scale);
    sphereMat.opacity = Math.max(0, 0.9 * (1 - progress));
    mat.opacity = Math.max(0, 1 - progress);
    sparkMat.opacity = Math.max(0, 1 - progress);

    const pos = sparkGeom.attributes.position.array as Float32Array;
    for (let i = 0; i < sparkCount; i++) {
      pos[i * 3] += velocities[i].x * 0.03;
      pos[i * 3 + 1] += velocities[i].y * 0.03;
      pos[i * 3 + 2] += velocities[i].z * 0.03;
      velocities[i].y -= 9.8 * 0.03;
    }
    sparkGeom.attributes.position.needsUpdate = true;
  }, 30);
}

function switchSlot(newSlot: number) {
  const boundedSlot = Math.max(0, Math.min(3, Math.floor(newSlot)));
  const localPlayer = network.sessionId ? network.state?.players.get(network.sessionId) : undefined;
  if (localPlayer) {
    const targetItem =
      boundedSlot === 0
        ? localPlayer.slot0
        : boundedSlot === 1
        ? localPlayer.slot1
        : boundedSlot === 2
        ? localPlayer.slot2
        : localPlayer.slot3;
    if (!targetItem && boundedSlot !== 0) {
      // Slot vazio (ex: sem item coletado), não troca para slot vazio
      return;
    }
  }

  if (boundedSlot === localActiveSlot) return;
  localActiveSlot = boundedSlot;
  sound.playItemSwitch();
  network.sendSelectSlot(boundedSlot);

  if (localPlayer) {
    localPlayer.activeSlot = boundedSlot;
    const item = (
      boundedSlot === 0
        ? localPlayer.slot0
        : boundedSlot === 1
        ? localPlayer.slot1
        : boundedSlot === 2
        ? localPlayer.slot2
        : localPlayer.slot3
    ) as
      | "knife"
      | "pistol"
      | "bandage"
      | "armor"
      | "c4"
      | "defibrillator"
      | "plant_sprout"
      | "spider_head"
      | "werewolf_tooth"
      | "sack"
      | "flare"
      | "sinalizador"
      | "" ?? "";
    localActiveItem = item || "knife";
    const localView = network.sessionId ? views.get(network.sessionId) : undefined;
    if (localView) {
      localView.setWeaponLevels(localPlayer.gunLevel ?? 1, localPlayer.knifeLevel ?? 1);
      localView.setEquippedItem(localActiveItem);
    }
    hud.updateLocalStatus(localPlayer);
  }
}

hud.onSelectSlot = (slot) => {
  switchSlot(slot);
};

hud.onBuyItem = (item) => {
  network.sendBuyItem(item);
};

hud.onHordeAlert = () => {
  const localPlayer = network.sessionId ? network.state?.players.get(network.sessionId) : undefined;
  if (!localPlayer?.inWorld) return;
  sound.playHordeAlarm();
  cameraController.addShake(0.45);
};

hud.onOpenShop = () => {
  if (deathScreen.isVisible()) return;
  sound.playShopOpen();
  const localPlayer = network.sessionId ? network.state?.players.get(network.sessionId) : undefined;
  if (localPlayer) {
    hud.updateLocalStatus(localPlayer);
  }
  network.sendInput({
    dx: 0,
    dz: 0,
    aimAngle: lastAim,
    shooting: false,
    reloading: false,
    activeSlot: localActiveSlot,
  });
};

const triggerMatchRestart = () => {
  sound.playRespawn();
  sound.stopHelicopterSound();
  network.sendRespawn();

  // Limpa imediatamente todas as views 3D antigas de inimigos, projéteis e poças
  for (const [, zView] of zombieViews) zView.dispose();
  zombieViews.clear();
  zombieHpMap.clear();

  for (const [, bView] of bulletViews) bView.dispose();
  bulletViews.clear();
  for (const lb of localBullets) lb.view.dispose();
  localBullets.length = 0;

  for (const [, sView] of spitProjectileViews) sView.dispose();
  spitProjectileViews.clear();

  for (const [, lView] of mortarLobViews) lView.dispose();
  mortarLobViews.clear();

  for (const [, pView] of slimePuddleViews) pView.dispose();
  slimePuddleViews.clear();

  for (const [, cView] of c4MineViews) cView.dispose();
  c4MineViews.clear();

  if (deathScreen.isVisible()) deathScreen.hide();
  if (victoryScreen.isVisible()) victoryScreen.hide();
  welcomeModal.reset();
  hud.setCrosshairVisible(true);
  input.enabled = true;
};

deathScreen.onRestart = triggerMatchRestart;
victoryScreen.onRestart = triggerMatchRestart;
victoryScreen.onLobby = () => {
  window.location.href = window.location.pathname;
};

network.onStatus = (status) => {
  hud.setStatus(status);
  if (status === "offline" && input.enabled) {
    hud.toast("⚠️ Connection lost. Refresh the page to return.", 5000);
    input.enabled = false;
  }
};

network.onPlayerRevived = (data) => {
  sound.playDefibrillatorShock();
  const reviverView = views.get(data.reviverId);
  const fromX = reviverView ? reviverView.root.position.x : data.x;
  const fromY = reviverView ? reviverView.root.position.y + 0.8 : 0.8;
  const fromZ = reviverView ? reviverView.root.position.z : data.z;
  triggerDefibrillatorSparks(fromX, fromY, fromZ, data.x, 0.2, data.z);

  if (data.revivedId === network.sessionId) {
    cameraController.addShake(0.5);
    if (deathScreen.isVisible()) {
      deathScreen.hide();
      hud.setCrosshairVisible(true);
      input.enabled = true;
    }
    hud.toast(`⚡ ${data.reviverName || "Your teammate"} REVIVED YOU WITH THE DEFIBRILLATOR!`, 5000);
  } else if (data.reviverId === network.sessionId) {
    cameraController.addShake(0.2);
    hud.toast(`⚡ YOU REVIVED ${data.revivedName || "YOUR TEAMMATE"}!`, 4000);
  } else {
    hud.toast(`⚡ ${data.reviverName} revived ${data.revivedName}!`, 3500);
  }
};

/** Sincroniza views 3D com o estado autoritativo (chamado a cada patch do servidor, ~20Hz). */
network.onStateChange = (state: NetArenaState) => {
  const now = performance.now();
  const localId = network.sessionId;

  // 1) Jogadores
  state.players.forEach((p, id) => {
    let view = views.get(id);
    if (!view) {
      const isLocal = id === localId;
      view = new PlayerView(p.color, p.name, isLocal);
      view.setAppearance({
        color: p.color,
        hair: p.hair,
        eyes: p.eyes,
        beard: p.beard,
        hat: p.hat,
      });
      views.set(id, view);
      sceneManager.add(view.root);
      if (isLocal) {
        predictor.reset(p.x, p.z, p.y);
        view.setPose(p.x, p.y, p.z, p.aimAngle, true);
        lastAim = p.aimAngle;
      }
    }
    const isDead = p.hp <= 0;
    view.setName(isDead ? `☠ ${p.name}` : p.name, p.color);
    view.setAppearance({
      color: p.color,
      hair: p.hair,
      eyes: p.eyes,
      beard: p.beard,
      hat: p.hat,
    });
    view.setDead(p.hp <= 0);
    view.root.visible = Boolean(p.inWorld);

    // Efeito de impacto quando o personagem perde vida (10 vidas no total)
    const prevHp = playerHpMap.get(id);
    if (prevHp !== undefined && p.hp < prevHp && p.inWorld) {
      view.triggerHitFlash();
      if (view.isLocal) {
        sound.playDamage();
        cameraController.addShake(0.32);
      }
    }
    playerHpMap.set(id, p.hp);

    // Sincroniza qual item 3D o boneco está segurando na mão
    const activeSlot = p.activeSlot ?? 0;
    const rawActiveItem = (
      activeSlot === 0
        ? p.slot0
        : activeSlot === 1
        ? p.slot1
        : activeSlot === 2
        ? p.slot2
        : p.slot3
    ) as
      | "knife"
      | "pistol"
      | "bandage"
      | "armor"
      | "c4"
      | "defibrillator"
      | "plant_sprout"
      | "spider_head"
      | "werewolf_tooth"
      | "sack"
      | "flare"
      | "sinalizador"
      | "" ?? "";
    const activeItem = rawActiveItem || (p.slot0 === "knife" ? "knife" : "");
    view.setWeaponLevels(p.gunLevel ?? 1, p.knifeLevel ?? 1);
    view.setEquippedItem(activeItem);
    view.setFlareActive(Boolean(p.flareActive));

    // Sincroniza estado de paralisia por teia de aranha (visual de casulo e animação de desespero)
    const isWebbed = Boolean(p.webbedTimer && p.webbedTimer > 0);
    view.setWebbed(isWebbed);

    if (view.isLocal) {
      serverLocal = { x: p.x, y: p.y, z: p.z };
      localActiveSlot = activeSlot;
      localActiveItem = activeItem;

      if (!p.inWorld) {
        // Enquanto o jogador está no menu / customização, suprime tela de morte, alarmes e áudios de gameplay
        localPrevHp = p.hp;
        localPrevCoins = p.coins;
        localPrevReserve = p.reserveAmmo;
        localPrevArmor = p.armor ?? 0;
        localPrevBandageCount = p.bandageCount ?? 0;
        localPrevSlot2 = p.slot2;
        localPrevSlot3 = p.slot3;
        localPrevHadPistol = true;
        localPrevInWorld = false;
        return;
      }

      // Ao transicionar pela primeira vez para dentro do mundo:
      if (!localPrevInWorld) {
        predictor.reset(p.x, p.z, p.y);
        view.setPose(p.x, p.y, p.z, p.aimAngle, true);
        lastAim = p.aimAngle;
        localPrevInWorld = true;
        welcomeModal.show();
      }

      // ─── Detecção de Morte / Reinício do Jogador Local ─────────────
      if (p.hp <= 0) {
        let livingAllies = 0;
        state.players.forEach((other, otherId) => {
          if (otherId !== id && other.hp > 0 && other.inWorld) {
            livingAllies++;
          }
        });
        const hasLivingAllies = livingAllies > 0;

        if (!deathScreen.isVisible()) {
          sound.playDeath();
          cameraController.addShake(0.65);
          if (hud.isShopOpen()) hud.closeShop();
          input.enabled = false;
          hud.setCrosshairVisible(false);
          const timeText = hud.getFormattedSurvivalTime();
          const hordeText = hud.getCurrentHordeText();
          deathScreen.show(timeText, hordeText, p.coins ?? 0, hasLivingAllies);
        } else {
          deathScreen.updateMode(hasLivingAllies);
        }
      } else {
        if (deathScreen.isVisible()) {
          deathScreen.hide();
          hud.setCrosshairVisible(true);
          input.enabled = true;
        }
      }

      // Se acabou de renascer após a morte (por reanimação ou reinício do jogo), reseta pose local e reativa equipamentos
      if (localPrevHp !== undefined && localPrevHp <= 0 && p.hp > 0) {
        predictor.reset(p.x, p.z, p.y);
        view.setPose(p.x, p.y, p.z, p.aimAngle, true);
        lastAim = p.aimAngle;
        localActiveSlot = p.activeSlot ?? 0;
        localActiveItem = (p.slot0 === "knife" ? "knife" : "") as any;
        view.setEquippedItem(localActiveItem);
        hud.setCrosshairVisible(true);
        input.enabled = true;
        if (deathScreen.isVisible()) {
          deathScreen.hide();
        }
      }

      // Se o slot atual ficou vazio (ex: Homem do Saco derrubou a pistola), força imediatamente o slot 0 (faca)
      if (!rawActiveItem && p.slot0 === "knife") {
        localActiveSlot = 0;
        localActiveItem = "knife";
        view.setEquippedItem("knife");
      }
      serverLocal = { x: p.x, y: p.y, z: p.z };

      // Se acabou de ser atingido pela teia, reproduz som de armadilha adesiva e tremor na câmera
      const prevWebbed = predictor.isWebbed;
      predictor.isWebbed = isWebbed;
      if (!prevWebbed && isWebbed) {
        sound.playWebTrap();
        cameraController.addShake(0.14);
      }

      // Áudio tático e atualização do display tático de Vida e Munição
      if (!localPrevReloading && p.reloading) {
        // Recarga iniciada (caso iniciada pelo servidor)
      } else if (localPrevReloading && !p.reloading && p.ammo > 0) {
        sound.playReloadDone();
      }
      if (localPrevReserve !== undefined && p.reserveAmmo > localPrevReserve) {
        lastPickupSoundTime = performance.now();
        sound.playAmmoPickup();
      }
      if (localPrevBandageCount !== undefined && (p.bandageCount ?? 0) > localPrevBandageCount) {
        lastPickupSoundTime = performance.now();
        sound.playItemPickup();
      }
      if (localPrevCoins !== undefined && (p.coins ?? 0) > localPrevCoins) {
        sound.playCoinPickup();
      } else if (localPrevCoins !== undefined && (p.coins ?? 0) < localPrevCoins) {
        sound.playShopBuy();
      }

      // Som metálico quando a armadura absorve dano (sem perda de vida no mesmo tick)
      if (
        localPrevArmor !== undefined &&
        (p.armor ?? 0) < localPrevArmor &&
        p.hp > 0 &&
        !(localPrevHp !== undefined && p.hp < localPrevHp)
      ) {
        sound.playArmorHit();
        cameraController.addShake(0.18);
      }

      // Som e resposta tátil quando o jogador local pisa na gosma ácida e toma dano
      if (
        (localPrevHp !== undefined && p.hp < localPrevHp) ||
        (localPrevArmor !== undefined && (p.armor ?? 0) < localPrevArmor)
      ) {
        let onSlime = false;
        for (const puddle of slimePuddleViews.values()) {
          const d = Math.hypot(p.x - puddle.root.position.x, p.z - puddle.root.position.z);
          if (d < 1.25) {
            onSlime = true;
            break;
          }
        }
        if (onSlime) {
          sound.playSlimeBurn();
          cameraController.addShake(0.06);
        }
      }

      // Alerta tático caso o Homem do Saco tenha derrubado a arma de fogo do inventário
      const hadPistol = p.slot0 === "pistol" || p.slot1 === "pistol" || p.slot2 === "pistol";
      if (localPrevHadPistol !== undefined && localPrevHadPistol && !hadPistol) {
        hud.toast("☠ THE SACK MAN KNOCKED YOUR WEAPON AWAY!", 3800);
        cameraController.addShake(0.5);
        sound.playDamage();
      } else if (localPrevHadPistol !== undefined && !localPrevHadPistol && hadPistol) {
        // Recuperou a arma do chão!
        lastPickupSoundTime = performance.now();
        sound.playWeaponPickup();
        hud.toast("🔫 YOU RECOVERED YOUR WEAPON!", 2500);
      }
      localPrevHadPistol = hadPistol;

      localPrevReloading = p.reloading;
      localPrevReserve = p.reserveAmmo;
      localPrevCoins = p.coins;
      localPrevHp = p.hp;
      localPrevArmor = p.armor ?? 0;
      localPrevBandageCount = p.bandageCount ?? 0;

      // Alerta sonoro e mensagem tática quando coletar uma relíquia de chefe no slot 3
      if (localPrevSlot2 !== undefined && localPrevSlot2 !== p.slot2 && p.slot2) {
        lastPickupSoundTime = performance.now();
        sound.playItemPickup();
        if (p.slot2 === "plant_sprout") {
          hud.toast("🌱 YOU COLLECTED AN ANCIENT PLANT SPROUT! (SLOT 3)", 3500);
        } else if (p.slot2 === "spider_head") {
          hud.toast("🕷️ YOU COLLECTED THE SPIDER HEAD! (SLOT 3)", 3500);
        } else if (p.slot2 === "werewolf_tooth") {
          hud.toast("🐺 YOU COLLECTED THE WOLF TOOTH! (SLOT 3)", 3500);
        } else if (p.slot2 === "sack") {
          hud.toast("🎒 YOU COLLECTED THE SACK MAN'S SACK! (SLOT 3)", 3500);
        } else if (p.slot2 === "flare" || p.slot2 === "sinalizador") {
          hud.toast("🏮 YOU ACQUIRED THE FLARE! (SLOT 3)", 4000);
        } else if (p.slot2 === "defibrillator") {
          hud.toast("⚡ DEFIBRILLATOR EQUIPPED! (SLOT 3) - Left Click to revive teammate", 4500);
        }
      }
      localPrevSlot2 = p.slot2;

      // Alerta sonoro e mensagem tática quando coletar ou desbloquear item no slot 4
      if (localPrevSlot3 !== undefined && localPrevSlot3 !== p.slot3 && p.slot3) {
        lastPickupSoundTime = performance.now();
        sound.playItemPickup();
        if (p.slot3 === "plant_sprout") {
          hud.toast("🌱 YOU RECEIVED THE ANCIENT PLANT SPROUT! (SLOT 4)", 3500);
        } else if (p.slot3 === "spider_head") {
          hud.toast("🕷️ YOU RECEIVED THE SPIDER HEAD! (SLOT 4)", 3500);
        } else if (p.slot3 === "werewolf_tooth") {
          hud.toast("🐺 YOU RECEIVED THE WOLF TOOTH! (SLOT 4)", 3500);
        } else if (p.slot3 === "sack") {
          hud.toast("🎒 YOU RECEIVED THE SACK MAN'S SACK! (SLOT 4)", 3500);
        } else if (p.slot3 === "flare" || p.slot3 === "sinalizador") {
          sound.playHordeAlarm();
          hud.toast("🏮 RESCUE FLARE UNLOCKED! (SLOT 4)", 4500);
        }
      }
      localPrevSlot3 = p.slot3;

      hud.updateLocalStatus(p);
    } else {
      view.pushSnapshot(now, p.x, p.y, p.z, p.aimAngle);
    }
  });

  // Remove quem saiu
  for (const [id, view] of views) {
    if (!state.players.get(id)) {
      view.dispose();
      views.delete(id);
      playerHpMap.delete(id);
    }
  }

  // 2) Balas / Projéteis
  if (state.bullets) {
    state.bullets.forEach((b, id) => {
      // Balas do jogador local já foram desenhadas na hora do disparo (localBullets)
      if (b.playerId === network.sessionId) return;
      let bView = bulletViews.get(id);
      if (!bView) {
        bView = new BulletView(b.x, b.z, b.angle);
        bulletViews.set(id, bView);
        sceneManager.add(bView.root);

        // Disparo: recuo visual e som para outros jogadores na rede
        const shooter = views.get(b.playerId);
        if (shooter && !shooter.isLocal) {
          shooter.triggerRecoil();
          sound.playShoot();
        }
      } else {
        bView.sync(b.x, b.z);
      }
    });

    // Remove balas que sumiram no servidor (acertaram obstáculo ou expiraram)
    for (const [id, bView] of bulletViews) {
      if (!state.bullets.get(id)) {
        bView.dispose();
        bulletViews.delete(id);
      }
    }
  }

  // 3) Zumbis / Inimigos
  if (state.zombies) {
    state.zombies.forEach((z, id) => {
      let zView = zombieViews.get(id);
      if (!zView) {
        zView = new ZombieView(z.type, z.hp, z.maxHp);
        zombieViews.set(id, zView);
        sceneManager.add(zView.root);
      }
      const prevHp = zombieHpMap.get(id);
      if (prevHp !== undefined && z.hp < prevHp && z.state === "alive") {
        const local = network.sessionId ? views.get(network.sessionId) : undefined;
        if (local && localActiveItem === "knife") {
          const dist = Math.hypot(z.x - local.position.x, z.z - local.position.z);
          if (dist < 2.4) {
            sound.playKnifeHit();
          }
        }
      }
      zombieHpMap.set(id, z.hp);

      const prevAttacking = zView.attacking;
      const prevAggressive = zView.aggressive;
      const justExploded = zView.sync(z.x, z.y, z.z, z.rotation, z.hp, z.state, z.attacking, z.exploded, z.isAggro);
      if (justExploded) {
        sound.playExplosion();
        const local = network.sessionId ? views.get(network.sessionId) : undefined;
        if (local) {
          const dist = Math.hypot(z.x - local.position.x, z.z - local.position.z);
          if (dist < 14) {
            const intensity = Math.max(0.18, (1 - dist / 14) * 0.7);
            cameraController.addShake(intensity);
          }
        }
      }

      if (z.attacking && !prevAttacking && z.state === "alive") {
        if (z.type === "werewolf_boss") {
          sound.playWerewolfSlash();
        } else if (z.type === "wolf") {
          sound.playWolfSnarl();
        }
      }
      if (z.isAggro && !prevAggressive && z.state === "alive" && z.type === "werewolf_boss") {
        sound.playWerewolfHowl();
      }
    });

    // Remove zumbis cujo corpo se decompôs após 10 segundos
    for (const [id, zView] of zombieViews) {
      if (!state.zombies.get(id)) {
        zView.dispose();
        zombieViews.delete(id);
        zombieHpMap.delete(id);
      }
    }
  }

  // 4) Coletáveis no mapa (Pistola tática, Bandagens e Munição)
  if (state.ammoBoxes) {
    state.ammoBoxes.forEach((box, id) => {
      let bView = ammoBoxViews.get(id);
      if (!bView) {
        bView = new AmmoBoxView(box.x, box.y, box.z, box.kind ?? "ammo");
        ammoBoxViews.set(id, bView);
        sceneManager.add(bView.root);
      }
      if (bView.root.position.x !== box.x || bView.root.position.z !== box.z) {
        bView.setPosition(box.x, box.y, box.z);
      }
      bView.sync(box.active);
    });

    for (const [id, bView] of ammoBoxViews) {
      if (!state.ammoBoxes.get(id)) {
        if (serverLocal) {
          const distToBox = Math.hypot(serverLocal.x - bView.root.position.x, serverLocal.z - bView.root.position.z);
          if (distToBox < 1.8 && performance.now() - lastPickupSoundTime > 120) {
            lastPickupSoundTime = performance.now();
            if (bView.kind === "pistol") {
              sound.playWeaponPickup();
            } else if (bView.kind === "bandage") {
              sound.playItemPickup();
            } else if (bView.kind === "coin") {
              sound.playCoinPickup();
            } else {
              sound.playAmmoPickup();
            }
          }
        }
        bView.dispose();
        ammoBoxViews.delete(id);
      }
    }
  }

  // 5) Poças de gosma ácida no chão
  if (state.slimePuddles) {
    state.slimePuddles.forEach((p, id) => {
      let pView = slimePuddleViews.get(id);
      if (!pView) {
        pView = new SlimePuddleView(p.x, p.y, p.z, p.radius, p.lifetime, p.maxLifetime);
        slimePuddleViews.set(id, pView);
        sceneManager.add(pView.root);
      } else {
        pView.sync(p.x, p.y, p.z, p.lifetime, p.maxLifetime);
      }
    });

    for (const [id, pView] of slimePuddleViews) {
      if (!state.slimePuddles.get(id)) {
        pView.dispose();
        slimePuddleViews.delete(id);
      }
    }
  }

  // 6) Projéteis de cuspe de gosma ácida ou novelos de teia paralisante da Rainha Aracnídea
  if (state.spitProjectiles) {
    state.spitProjectiles.forEach((s, id) => {
      let sView = spitProjectileViews.get(id);
      if (!sView) {
        const kind = s.kind ?? "slime";
        sView = new SpitProjectileView(s.x, s.y, s.z, s.angle, kind);
        spitProjectileViews.set(id, sView);
        sceneManager.add(sView.root);
        if (kind === "web") {
          sound.playWebShoot();
        } else {
          sound.playSlimeSpit();
        }
      } else {
        sView.sync(s.x, s.y, s.z);
      }
    });

    for (const [id, sView] of spitProjectileViews) {
      if (!state.spitProjectiles.get(id)) {
        sView.dispose();
        spitProjectileViews.delete(id);
      }
    }
  }

  // 7) Bombas de morteiro de gosma disparadas em arco parabólico
  if (state.mortarLobs) {
    state.mortarLobs.forEach((lob, id) => {
      let lView = mortarLobViews.get(id);
      if (!lView) {
        lView = new MortarLobView(
          lob.startX,
          lob.startY,
          lob.startZ,
          lob.targetX,
          lob.targetY,
          lob.targetZ,
          lob.duration,
          lob.peakHeight,
          lob.splashRadius || 3.2,
        );
        mortarLobViews.set(id, lView);
        sceneManager.add(lView.root);
        sound.playMortarLaunch();
      } else {
        lView.sync(
          lob.startX,
          lob.startY,
          lob.startZ,
          lob.targetX,
          lob.targetY,
          lob.targetZ,
          lob.duration,
          lob.peakHeight,
          lob.progress,
          lob.splashRadius || 3.2,
        );
      }
    });

    for (const [id, lView] of mortarLobViews) {
      if (!state.mortarLobs.get(id)) {
        sound.playMortarImpact();
        const local = network.sessionId ? views.get(network.sessionId) : undefined;
        if (local) {
          const tPos = lView.targetPosition;
          const dist = Math.hypot(local.position.x - tPos.x, local.position.z - tPos.z);
          const maxDist = lView.radius > 4.5 ? 20 : 14;
          if (dist < maxDist) {
            const baseFactor = 1 - dist / maxDist;
            const maxShake = lView.radius > 4.5 ? 0.75 : 0.45;
            cameraController.addShake(Math.max(0.12, baseFactor * maxShake));
          }
        }
        lView.dispose();
        mortarLobViews.delete(id);
      }
    }
  }

  // 7.5) C4 Explosivas com timer de 5s e distração no chão
  if (state.c4Mines) {
    state.c4Mines.forEach((c4, id) => {
      let cView = c4MineViews.get(id);
      if (!cView) {
        cView = new C4MineView(c4.x, c4.y, c4.z, sound, () => {
          const lp = network.sessionId ? network.state?.players.get(network.sessionId) : undefined;
          if (lp) {
            const dist = Math.hypot(lp.x - c4.x, lp.z - c4.z);
            if (dist < 20) {
              const intensity = Math.max(0.2, 0.75 * (1 - dist / 20));
              cameraController.addShake(intensity);
            }
          }
        });
        c4MineViews.set(id, cView);
        sceneManager.add(cView.root);
      }
      cView.sync(c4.timer, c4.maxTimer, c4.exploded);
    });

    for (const [id, cView] of c4MineViews) {
      if (!state.c4Mines.get(id)) {
        cView.dispose();
        c4MineViews.delete(id);
      }
    }
  }

  // 8) Sincronização do estado das portas (aberta / fechada)
  if (state.doors) {
    state.doors.forEach((door) => {
      const dv = doorViews.get(door.id);
      if (dv) {
        const wasOpen = dv.isOpen();
        dv.setOpen(door.isOpen);
        if (wasOpen !== door.isOpen) {
          if (door.isOpen) sound.playDoorOpen();
          else sound.playDoorClose();
        }
      }
    });
  }

  hud.updatePlayers(state, localId);
  hud.updateGameState(state);
  mainMenu.onNetworkStateChange(state);

  // 9) Vitória no Jogo / Evacuação pelo Helicóptero
  if (state.gameWon) {
    if (!victoryScreen.isVisible()) {
      sound.stopHelicopterSound();
      sound.playVictoryFanfare();
      cameraController.addShake(0.35);
      if (hud.isShopOpen()) hud.closeShop();
      input.enabled = false;
      hud.setCrosshairVisible(false);
      const timeText = hud.getFormattedSurvivalTime();
      const hordeText = hud.getCurrentHordeText();
      const localP = localId ? state.players.get(localId) : undefined;
      victoryScreen.show(timeText, hordeText, localP?.coins ?? 0, state.gameWonMessage || "VOCÊS SOBREVIVERAM! O JOGO ACABOU.");
    }
  } else {
    if (victoryScreen.isVisible()) {
      victoryScreen.hide();
      hud.setCrosshairVisible(true);
      input.enabled = true;
    }
  }

  // 10) Áudio do helicóptero de resgate (sem sirene; surge faltando 10s para pousar)
  const curHeliStatus = state.helicopterStatus ?? "none";
  if (prevHeliStatus !== "landing" && curHeliStatus === "landing") {
    cameraController.addShake(0.2);
  }
  const rescueTimer = state.rescueTimer ?? 0;
  const isNearLanding =
    (curHeliStatus === "incoming" && rescueTimer <= 10.0) ||
    curHeliStatus === "landing" ||
    curHeliStatus === "landed" ||
    curHeliStatus === "escaped";

  if (isNearLanding && !state.gameWon) {
    sound.setHelicopterApproach(rescueTimer, state.helicopterY ?? 38.0, curHeliStatus === "landed");
    sound.startHelicopterSound();
  } else {
    sound.stopHelicopterSound();
  }
  prevHeliStatus = curHeliStatus;
};

const initialInvitedRoom = NetworkManager.getRoomFromUrl();

const mainMenu = new MainMenu(
  network,
  initialInvitedRoom,
  () => {
    input.enabled = true;
    hud.show();
    hud.setStatus("online");
    sound.startAmbientForest();
  },
  (masterVol) => {
    sound.setMasterVolume(masterVol);
  },
  (_mouseSens) => {
    // Escala sensibilidade de rotação se desejado
  },
);
hud.setStatus("idle");

deathScreen.onLobby = () => {
  window.location.href = window.location.pathname; // volta ao menu principal sem sala fixa
};

// ─── Game loop (render a 60/144Hz; simulação autoritativa a 20Hz no servidor) ─
const clock = new THREE.Clock();
const sendInterval = 1 / INPUT_SEND_RATE;
let pendingJump = false;
let grassStepAccumulator = 0.7;
let grassStepLeft = false;

sceneManager.renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);
  const t = clock.elapsedTime;
  if (dryFireCooldown > 0) dryFireCooldown = Math.max(0, dryFireCooldown - dt);
  if (gunCooldown > 0) gunCooldown = Math.max(0, gunCooldown - dt);
  if (knifeCooldown > 0) knifeCooldown = Math.max(0, knifeCooldown - dt);
  if (bandageCooldown > 0) bandageCooldown = Math.max(0, bandageCooldown - dt);
  if (c4Cooldown > 0) c4Cooldown = Math.max(0, c4Cooldown - dt);
  if (defibrillatorCooldown > 0) defibrillatorCooldown = Math.max(0, defibrillatorCooldown - dt);

  const localView = network.sessionId ? views.get(network.sessionId) : undefined;

  if (localView && input.enabled) {
    const localPlayer = network.sessionId ? network.state?.players.get(network.sessionId) : undefined;

    // 0) Proximidade e interação com a Loja de Equipamentos na clareira (tecla [E])
    const distToShop = Math.hypot(predictor.x - SHOP_POS.x, predictor.z - SHOP_POS.z);
    const nearShop = distToShop <= SHOP_POS.radius;
    hud.setShopPromptVisible(nearShop && !hud.isShopOpen());

    if (!nearShop && hud.isShopOpen()) {
      hud.closeShop();
    }

    const isShopping = hud.isShopOpen();

    // 0.1) Proximidade e interação com o Livro de Sobrevivência na Cabana Inicial (tecla [E])
    const distToBook = Math.hypot(predictor.x - BOOK_POS.x, predictor.z - BOOK_POS.z);
    const nearBook = !nearShop && !isShopping && distToBook <= BOOK_POS.radius;
    hud.setBookPromptVisible(nearBook && !bookModal.isModalOpen());

    if (!nearBook && distToBook > BOOK_POS.radius + 1.5 && bookModal.isModalOpen()) {
      bookModal.close();
    }

    // 0.2) Proximidade e interação com as Portas (tecla [E])
    let nearestDoor: DoorDefinition | null = null;
    let nearestDoorDist = Infinity;
    const playerY = localView.root.position.y;
    for (const def of DOOR_DEFINITIONS) {
      const dist = Math.hypot(predictor.x - def.x, predictor.z - def.z);
      if (Math.abs(playerY - def.y) <= 2.2 && dist <= def.interactionRadius && dist < nearestDoorDist) {
        nearestDoor = def;
        nearestDoorDist = dist;
      }
    }

    const showDoorPrompt = !nearShop && !nearBook && !isShopping && nearestDoor !== null;
    if (showDoorPrompt && nearestDoor) {
      const dv = doorViews.get(nearestDoor.id);
      const isOpen = dv ? dv.isOpen() : false;
      hud.setDoorPromptVisible(true, isOpen ? "Close Door" : "Open Door", nearestDoor.shortName);
    } else {
      hud.setDoorPromptVisible(false);
    }

    // 0.3) Proximidade de amigo caído para uso do Desfibrilador
    interface ReviveTargetInfo {
      id: string;
      name: string;
      x: number;
      y: number;
      z: number;
    }
    let reviveTarget: ReviveTargetInfo | null = null;
    let reviveTargetDist = Infinity;
    if (localActiveItem === "defibrillator" && network.state?.players) {
      network.state.players.forEach((p, id) => {
        if (id === network.sessionId) return;
        if (p.hp <= 0 && p.inWorld) {
          const d = Math.hypot(predictor.x - p.x, predictor.z - p.z);
          if (d <= DEFIBRILLATOR_REVIVE_RADIUS && d < reviveTargetDist) {
            reviveTargetDist = d;
            reviveTarget = { id, name: p.name || "Amigo", x: p.x, y: p.y, z: p.z };
          }
        }
      });
    }
    const currentReviveTarget = reviveTarget as ReviveTargetInfo | null;
    hud.setRevivePromptVisible(currentReviveTarget !== null, currentReviveTarget?.name ?? "");

    const interactRequested = input.consumeInteract();
    if (interactRequested) {
      if (nearShop) {
        if (localPlayer) hud.updateLocalStatus(localPlayer);
        hud.toggleShop();
      } else if (nearBook) {
        bookModal.toggle();
      } else if (nearestDoor) {
        const dv = doorViews.get(nearestDoor.id);
        if (dv) {
          const nextState = !dv.isOpen();
          dv.setOpen(nextState);
          if (nextState) sound.playDoorOpen();
          else sound.playDoorClose();
        }
        network.sendInteractDoor(nearestDoor.id);
      }
    }

    const escapeRequested = input.consumeEscape();
    if (escapeRequested) {
      if (welcomeModal.isOpen()) {
        welcomeModal.close();
      } else if (bookModal.isModalOpen()) {
        bookModal.close();
      } else if (isShopping) {
        hud.closeShop();
      }
    }

    if (isShopping || bookModal.isModalOpen() || welcomeModal.isOpen()) {
      input.shooting = false;
    }

    // Troca de item no inventário via roda do mouse (scroll entre 4 slots)
    const scroll = input.consumeScroll();
    if (scroll > 0) {
      switchSlot((localActiveSlot + 1) % 4);
    } else if (scroll < 0) {
      switchSlot((localActiveSlot + 3) % 4);
    }

    // Seleção direta de slot via teclas [1], [2], [3], [4]
    const directSlot = input.consumeDirectSlot();
    if (directSlot !== null) {
      switchSlot(directSlot);
    }

    const reloadRequested = input.consumeReload();

    // Ações de uso / ataque conforme o item equipado (desabilitadas com a loja, diário ou aviso abertos)
    if (!isShopping && !bookModal.isModalOpen() && !welcomeModal.isOpen()) {
      if (localActiveItem === "knife") {
        if (knifeCooldown <= 0 && input.shooting) {
          const kLvl = localPlayer?.knifeLevel ?? 1;
          const tier = KNIFE_TIERS.find((t) => t.level === kLvl) ?? KNIFE_TIERS[0]!;
          knifeCooldown = tier.cooldown;
          localView.triggerKnifeSlash();
          sound.playKnifeSlash();
        }
      } else if (localActiveItem === "bandage") {
        if (bandageCooldown <= 0 && input.shooting) {
          if (localPlayer && (localPlayer.bandageCount ?? 0) > 0 && localPlayer.hp < 10) {
            bandageCooldown = 0.6;
            sound.playHeal();
          }
        }
      } else if (localActiveItem === "c4") {
        if (c4Cooldown <= 0 && input.shooting) {
          if (localPlayer && (localPlayer.c4Count ?? 0) > 0) {
            c4Cooldown = 0.8;
            sound.playC4Plant();
          }
        }
      } else if (localActiveItem === "defibrillator") {
        if (defibrillatorCooldown <= 0 && input.shooting) {
          defibrillatorCooldown = 1.0;
          if (currentReviveTarget) {
            sound.playDefibrillatorShock();
            cameraController.addShake(0.2);
            triggerDefibrillatorSparks(
              predictor.x,
              predictor.y + 0.8,
              predictor.z,
              currentReviveTarget.x,
              currentReviveTarget.y + 0.2,
              currentReviveTarget.z
            );
          }
          network.sendUseDefibrillator();
        }
      } else if (localActiveItem === "flare" || localActiveItem === "sinalizador") {
        if (input.shooting) {
          if (localPlayer && !localPlayer.flareActive) {
            localPlayer.flareActive = true;
            localView.setFlareActive(true);
            sound.playHordeAlarm();
          }
        }
      } else if (localActiveItem === "pistol") {
        const hasPistol = localPlayer && (localPlayer.slot0 === "pistol" || localPlayer.slot1 === "pistol" || localPlayer.slot2 === "pistol");
        if (!hasPistol) {
          localActiveItem = "knife";
          localActiveSlot = 0;
          localView.setEquippedItem("knife");
        } else {
          if (reloadRequested) {
            if (localPlayer && (localPlayer.reserveAmmo ?? 0) <= 0) {
              sound.playDryFire();
            } else if (
              localPlayer &&
              localPlayer.ammo < (localPlayer.maxAmmo || MAGAZINE_SIZE) &&
              (localPlayer.reserveAmmo ?? 0) > 0 &&
              !localPlayer.reloading
            ) {
              sound.playReloadStart();
              network.sendReload();
            } else {
              network.sendReload();
            }
          }

          if (input.shooting) {
            if (localPlayer?.reloading) {
              // Em recarga - não atira
            } else if (localPlayer && localPlayer.ammo === 0) {
              if (dryFireCooldown <= 0) {
                sound.playDryFire();
                dryFireCooldown = 0.32;
              }
            } else if (localPlayer && localPlayer.ammo > 0) {
              if (gunCooldown <= 0) {
                const gLvl = localPlayer.gunLevel || 1;
                const tier = GUN_TIERS.find((t) => t.level === gLvl) ?? GUN_TIERS[0]!;
                gunCooldown = tier.fireCooldown;
                sound.playShoot();
                spawnLocalBullet(gLvl);
                localView.triggerRecoil();
                cameraController.addShake(0.08);
              }
            }
          }
        }
      }
    }

    // 1) Predição local: aplica o input imediatamente com a mesma física do servidor e portas
    const rawMove = input.getMove();
    const move = isShopping ? { dx: 0, dz: 0 } : rawMove;
    const jumpRequested = isShopping ? false : input.consumeJump();

    if (jumpRequested) pendingJump = true;

    // Mira: raycast do mouse no plano da altura do jogador → ângulo via atan2(dx, dz)
    const aimPoint = input.getAimPoint(predictor.y);
    if (aimPoint) {
      const ax = aimPoint.x - predictor.x;
      const az = aimPoint.z - predictor.z;
      if (ax * ax + az * az > 0.04) lastAim = Math.atan2(ax, az);
    }

    // Obtém colisores das portas que estão fechadas no momento
    const activeDoorColliders = getActiveDoorColliders(doorViews);

    const stepResult = predictor.step(
      move.dx,
      move.dz,
      dt,
      jumpRequested,
      activeDoorColliders,
    );
    if (stepResult.jumped) {
      sound.playJump();
    }
    if (stepResult.landed) {
      sound.playLand();
    }

    // Passadas suaves na grama ao caminhar
    const isMoving = (move.dx !== 0 || move.dz !== 0) && !predictor.isWebbed;
    if (predictor.isGrounded && isMoving && !stepResult.jumped && localPlayer && localPlayer.hp > 0) {
      const moveMag = Math.hypot(move.dx, move.dz);
      grassStepAccumulator += dt * 4.1 * moveMag;
      if (grassStepAccumulator >= 1.25) {
        grassStepAccumulator = 0;
        sound.playGrassStep(grassStepLeft);
        grassStepLeft = !grassStepLeft;
      }
    } else {
      grassStepAccumulator = Math.min(grassStepAccumulator, 0.7);
    }

    // Física e separação imediata contra zumbis vivos para resposta tátil instantânea (mesmo nível de altura)
    for (const zView of zombieViews.values()) {
      if (zView.isAlive && Math.abs(predictor.y - zView.position.y) < 1.4) {
        separateCircles(predictor, PLAYER_RADIUS, zView.position, zView.radius);
        resolveStatic(predictor, PLAYER_RADIUS, activeDoorColliders);
      }
    }
    // Latência até a posição do servidor refletir o input: ping + meio tick do servidor (calibrado em simulação)
    predictor.latencyMs = network.rttMs + TICK_MS / 2;
    predictor.record();
    if (serverLocal) predictor.reconcile(serverLocal.x, serverLocal.z, move.dx !== 0 || move.dz !== 0, dt, serverLocal.y);

    localView.setPose(predictor.x, predictor.y, predictor.z, lastAim);

    // 3) Envia input ao servidor em taxa fixa (inclui slot ativo e pulo)
    sendAccumulator += dt;
    if (sendAccumulator >= sendInterval) {
      sendAccumulator %= sendInterval;
      network.sendInput({
        dx: move.dx,
        dz: move.dz,
        aimAngle: lastAim,
        shooting: isShopping ? false : input.shooting,
        reloading: isShopping ? false : reloadRequested,
        activeSlot: localActiveSlot,
        jump: pendingJump,
      });
      pendingJump = false;
    }

    cameraController.follow(predictor.x, predictor.y, predictor.z, aimPoint?.x ?? predictor.x, aimPoint?.z ?? predictor.z);
    arena.update(predictor.x, predictor.z, dt);
  } else if (localView && network.state?.players.get(network.sessionId ?? "")?.hp === 0) {
    const deadLocal = network.state.players.get(network.sessionId ?? "");
    if (deadLocal && deadLocal.inWorld) {
      cameraController.follow(deadLocal.x, deadLocal.y, deadLocal.z, deadLocal.x, deadLocal.z);
      arena.update(deadLocal.x, deadLocal.z, dt);
    } else {
      cameraController.orbit();
    }
    hud.setRevivePromptVisible(false);
  } else {
    cameraController.orbit();
    hud.setRevivePromptVisible(false);
  }

  // 4) Interpolação dos jogadores remotos (~110ms no passado) + animação procedural
  const renderTime = performance.now() - PlayerView.INTERP_DELAY_MS;
  for (const view of views.values()) {
    if (!view.isLocal) view.interpolate(renderTime);
    view.animate(dt, t);
  }

  // 5) Atualização dos projéteis
  for (const bView of bulletViews.values()) {
    bView.update(dt);
  }
  updateLocalBullets(dt);

  // 6) Interpolação e animação dos zumbis
  for (const zView of zombieViews.values()) {
    zView.interpolate(renderTime);
    zView.animate(dt, t);
  }

  // 7) Animação das caixas de munição flutuantes
  for (const boxView of ammoBoxViews.values()) {
    boxView.animate(t);
  }

  // 8) Animação das poças de gosma e borbulhamento ácido
  for (const pView of slimePuddleViews.values()) {
    pView.update(dt, t);
  }

  // 9) Animação dos projéteis de cuspe de gosma em voo
  for (const sView of spitProjectileViews.values()) {
    sView.update(dt, t);
  }

  // 10) Animação das bombas de morteiro de gosma em parábola
  for (const lView of mortarLobViews.values()) {
    lView.update(dt, t);
  }

  // 10.5) Animação das C4s plantadas no chão e efeitos de detonação
  for (const cView of c4MineViews.values()) {
    cView.update(dt);
  }

  // 11) Animação das portas abrindo e fechando
  for (const dv of doorViews.values()) {
    dv.update(dt);
  }

  // 12) Helicóptero de Resgate e Heliponto 3D
  if (network.state) {
    let livingInRescue = 0;
    let totalLiving = 0;
    network.state.players.forEach((p) => {
      if (p.inWorld && p.hp > 0) {
        totalLiving++;
        const d = Math.hypot(p.x - (network.state?.helicopterX ?? HELICOPTER_RESCUE_POS.x), p.z - (network.state?.helicopterZ ?? HELICOPTER_RESCUE_POS.z));
        if (d <= HELICOPTER_RESCUE_POS.radius) livingInRescue++;
      }
    });

    helicopterView.update(dt, {
      status: network.state.helicopterStatus,
      x: network.state.helicopterX,
      y: network.state.helicopterY,
      z: network.state.helicopterZ,
      rescueTimer: network.state.rescueTimer,
      livingInRescue,
      totalLiving,
    });
  }

  campfire.update(dt, t);
  ambience.update(t);
  cameraController.update(dt);
  hud.updateCrosshair(input.pointer.x, input.pointer.y);
  sceneManager.render(cameraController.camera);
});

// ─── Helpers de Debug no Console do Navegador ──────────────────────────────
(window as any).triggerHorde5 = (immediate = false) => {
  network.send(ClientMessage.DebugTriggerHorde, { hordeNumber: 5, immediateBoss: immediate });
  console.log(`[DEBUG] Horda 5 disparada! (immediateBoss: ${immediate})`);
};

(window as any).spawnBoss = () => {
  network.send(ClientMessage.DebugTriggerHorde, { hordeNumber: 5, immediateBoss: true });
  console.log("[DEBUG] Invocando Chefe Monstro do Pântano (Horda 5 clímax imediato)!");
};

(window as any).spawnSwampBoss = (window as any).spawnBoss;

(window as any).triggerHorde8 = (immediate = false) => {
  network.send(ClientMessage.DebugTriggerHorde, { hordeNumber: 8, immediateBoss: immediate });
  console.log(`[DEBUG] Horda 8 disparada! (immediateBoss: ${immediate})`);
};

(window as any).spawnSpiderBoss = () => {
  network.send(ClientMessage.DebugTriggerHorde, { hordeNumber: 8, immediateBoss: true });
  console.log("[DEBUG] Invocando Chefe Rainha Aracnídea (Horda 8 clímax imediato)!");
};

(window as any).triggerHorde10 = (immediate = false) => {
  network.send(ClientMessage.DebugTriggerHorde, { hordeNumber: 10, immediateBoss: immediate });
  console.log(`[DEBUG] Horda 10 disparada! (immediateBoss: ${immediate})`);
};

(window as any).spawnWerewolfBoss = () => {
  network.send(ClientMessage.DebugTriggerHorde, { hordeNumber: 10, immediateBoss: true });
  console.log("[DEBUG] Invocando Chefe Lobisomem (Horda 10 clímax imediato)!");
};

(window as any).triggerHorde11 = (immediate = false) => {
  network.send(ClientMessage.DebugTriggerHorde, { hordeNumber: 11, immediateBoss: immediate });
  console.log(`[DEBUG] Horda 11 disparada! (immediateBoss: ${immediate})`);
};

(window as any).triggerHorde12 = (immediate = false) => {
  network.send(ClientMessage.DebugTriggerHorde, { hordeNumber: 12, immediateBoss: immediate });
  console.log(`[DEBUG] Horda 12 disparada! (immediateBoss: ${immediate})`);
};

(window as any).triggerHorde13 = (immediate = false) => {
  network.send(ClientMessage.DebugTriggerHorde, { hordeNumber: 13, immediateBoss: immediate });
  console.log(`[DEBUG] Horda 13 disparada! (immediateBoss: ${immediate})`);
};

(window as any).spawnSackBoss = () => {
  network.send(ClientMessage.DebugTriggerHorde, { hordeNumber: 13, immediateBoss: true });
  console.log("[DEBUG] Invocando Chefe Homem do Saco (Horda 13 clímax imediato)!");
};

(window as any).dropRelic = (kind: "plant_sprout" | "spider_head" | "werewolf_tooth" | "sack" | "all" = "plant_sprout") => {
  if (kind === "all") {
    (window as any).spawnBossItems();
    return;
  }
  network.send("debug_drop_relic", { kind });
  console.log(`[DEBUG] Drop de relíquia gerado: ${kind}`);
};

(window as any).spawnBossItems = () => {
  network.send("debug_spawn_all_boss_drops", {});
  hud.toast("✨ 4 BOSS ITEMS SPAWNED AROUND YOU!", 3500);
  console.log("[DEBUG] ✨ 4 itens de chefes spawnados no chão ao seu redor!");
  console.log("  🌱 Muda de Planta (Leste: x + 1.5)");
  console.log("  🕷️ Cabeça de Aranha (Norte: z + 1.5)");
  console.log("  🐺 Dente de Lobisomem (Oeste: x - 1.5)");
  console.log("  🎒 Saco do Homem do Saco (Sul: z - 1.5)");
};
(window as any).spawnAllBossDrops = (window as any).spawnBossItems;
(window as any).dropBossItems = (window as any).spawnBossItems;
(window as any).dropAllBossDrops = (window as any).spawnBossItems;
(window as any).spawnBossDrops = (window as any).spawnBossItems;

(window as any).giveAllDrops = () => {
  network.send("debug_give_all_drops", {});
  console.log("[DEBUG] Solicitado todos os 4 drops dos chefes!");
};

(window as any).buyFlare = () => {
  network.sendBuyItem("flare");
  console.log("[DEBUG] Compra de Sinalizador enviada!");
};

(window as any).triggerFlare = () => {
  network.send("debug_trigger_flare", {});
  console.log("[DEBUG] Sinalizador disparado via debug! Resgate em 30s.");
};

(window as any).setRescueTimer = (seconds = 3) => {
  network.send("debug_set_rescue_timer", { seconds });
  console.log(`[DEBUG] Rescue timer ajustado para ${seconds}s.`);
};

(window as any).teleportToHeli = () => {
  network.send("debug_teleport", { x: HELICOPTER_RESCUE_POS.x, z: HELICOPTER_RESCUE_POS.z });
  console.log(`[DEBUG] Teleportado para o heliponto (${HELICOPTER_RESCUE_POS.x}, ${HELICOPTER_RESCUE_POS.z})!`);
};

(window as any).killMe = () => {
  network.send("debug_kill_me", {});
  console.log("[DEBUG] Comando debug_kill_me enviado ao servidor!");
};

(window as any).toggleGodMode = () => {
  network.sendToggleGodMode();
  console.log("[DEBUG] Comando toggle_god_mode enviado ao servidor!");
};

// Atalho de teclado rápido:
// - Tecla X: Ativa / desativa modo imortal (God Mode)
// - Tecla 9 ou F2: Spawna os 4 itens de chefe no chão
window.addEventListener("keydown", (e: KeyboardEvent) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
  if (e.code === "KeyX" || e.key === "x" || e.key === "X") {
    network.sendToggleGodMode();
    console.log("[DEBUG] Tecla X pressionada: alternando modo imortal (God Mode)...");
  }
  if (e.code === "Digit9" || e.code === "F2") {
    (window as any).spawnBossItems();
  }
});

