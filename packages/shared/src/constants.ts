/**
 * Constantes vitais do jogo, compartilhadas entre cliente e servidor.
 * Qualquer regra que ambos precisem concordar mora aqui.
 */

// ─── Rede ────────────────────────────────────────────────────────────────────
/** Nome da sala registrada no Colyseus. */
export const ROOM_NAME = "arena";
/** Porta padrão do servidor Colyseus. */
export const SERVER_PORT = 2567;
/** Frequência da simulação autoritativa no servidor (ticks por segundo). */
export const TICK_RATE = 20;
/** Duração de um tick em milissegundos. */
export const TICK_MS = 1000 / TICK_RATE;
/** Frequência máxima com que o cliente envia inputs (envios por segundo). */
export const INPUT_SEND_RATE = 30;
/** Máximo de jogadores por sala. */
export const MAX_PLAYERS = 8;
/** Tamanho do código da sala compartilhado via `?room=CODIGO`. */
export const ROOM_CODE_LENGTH = 5;

// ─── Arena / Mapa Progressivo ────────────────────────────────────────────────
/** Limites retangulares do mapa com progressão para a direita (+X). */
export const MAP_MIN_X = -32;
export const MAP_MAX_X = 115;
export const MAP_MIN_Z = -36;
export const MAP_MAX_Z = 36;

/** Posição central da casinha de sobrevivência inicial à esquerda do mapa. */
export const START_CABIN_X = -24.5;
export const START_CABIN_Z = 0;

/** Posição inicial da lareira / fogueira na clareira do lado de fora da casinha. */
export const START_CAMPFIRE_X = -15;
export const START_CAMPFIRE_Z = 0;

/** Posição da Loja de Equipamentos (posto de comércio tático centralizado entre as duas casas). */
export const SHOP_POS = { x: 0, y: 0, z: 4.0, radius: 4.2 } as const;

/** Altura da varanda e segundo piso das casas abandonadas (metros). */
export const HOUSE_FLOOR_Y = 2.4;

// ─── Helicóptero de Resgate e Evacuação Final ─────────────────────────────
/** Tempo real em segundos desde a ativação do sinalizador até o helicóptero descer (30 segundos da vida real). */
export const HELICOPTER_COUNTDOWN_SECONDS = 30.0;
/** Coordenadas do heliponto / local de pouso na parte de cima do mapa. */
export const HELICOPTER_RESCUE_POS = { x: 12.0, y: 0.1, z: -25.0, radius: 4.2 } as const;
/** Altitude inicial do helicóptero quando é acionado no céu. */
export const HELICOPTER_SKY_ALTITUDE = 38.0;

/** Metade do lado (legado mantido para compatibilidade). */
export const ARENA_HALF = 30;
/** Raio do círculo no qual os jogadores nascem. */
export const SPAWN_RADIUS = 3.5;

// ─── Jogador ─────────────────────────────────────────────────────────────────
/** Velocidade do jogador em unidades por segundo. */
export const PLAYER_SPEED = 6;
/** Raio de colisão do jogador (círculo no plano XZ). */
export const PLAYER_RADIUS = 0.55;
/** Altura total visual da cápsula do jogador. */
export const PLAYER_HEIGHT = 1.6;
/** Vida máxima do jogador (10 vidas). */
export const PLAYER_MAX_HP = 10;

// ─── Pulo e Dash ─────────────────────────────────────────────────────────────
/** Velocidade inicial do pulo em unidades por segundo (eixo Y). */
export const JUMP_VELOCITY = 6.8;
/** Aceleração da gravidade aplicada ao jogador durante o pulo (unidades/s²). */
export const GRAVITY = 21.0;

/** Intervalo entre ataques do zumbi contra o jogador em segundos. */
export const ZOMBIE_ATTACK_COOLDOWN = 1.0;
/** Distância de alcance do ataque corpo a corpo do zumbi. */
export const ZOMBIE_ATTACK_RANGE = 1.15;
/** Comprimento máximo do apelido. */
export const PLAYER_NAME_MAX = 14;

/** Paleta de cores dos "feijões" (atribuída por ordem de entrada). */
export const PLAYER_COLORS: readonly string[] = [
  "#ff6b6b", // coral
  "#4ecdc4", // turquesa
  "#ffd93d", // amarelo-ouro
  "#a78bfa", // lavanda
  "#ff9f43", // laranja
  "#6bcb77", // verde-menta
  "#f78fb3", // rosa
  "#54a0ff", // azul-céu
];

// ─── Combate e Projéteis ─────────────────────────────────────────────────────
/** Intervalo mínimo entre disparos em segundos para a pistola básica (ex: 0.44s ≈ 2.2 tiros/s). */
export const FIRE_COOLDOWN = 0.44;
/** Velocidade do projétil em unidades por segundo. */
export const BULLET_SPEED = 28;
/** Raio de colisão do projétil (círculo no plano XZ). */
export const BULLET_RADIUS = 0.25;
/** Tempo de vida máximo da bala em segundos. */
export const BULLET_LIFETIME = 1.3;
/** Dano causado por cada bala. */
export const BULLET_DAMAGE = 1; // 1 tiro = 1 ponto de vida
/** Capacidade do pente / carregador (número de balas por pente). */
export const MAGAZINE_SIZE = 12;
/** Quantidade inicial de balas na reserva (0 = começa com apenas 1 pente no total). */
export const STARTING_RESERVE_AMMO = 0;
/** Duração da recarga do pente em segundos. */
export const RELOAD_TIME = 1.6;

// ─── Caixas de Munição e Itens Coletáveis no Mapa ─────────────────────────
// ─── Caixas de Munição e Itens Coletáveis no Mapa ─────────────────────────
export type ItemKind = "ammo" | "pistol" | "bandage" | "knife" | "coin";

export const ITEM_PICKUP_RADIUS = 1.25;
export const ITEM_RESPAWN_TIME = 25; // Segundos para reaparecer
export interface ItemSpawn {
  id: string;
  kind: "ammo" | "pistol" | "bandage" | "coin";
  x: number;
  y: number;
  z: number;
}
export const ITEM_SPAWNS: readonly ItemSpawn[] = [
  // ─── Cabana Inicial (Interior e Pátio) ───
  { id: "item_cabin_coin_1", kind: "coin", x: -24.5, y: 0.1, z: -0.5 },
  { id: "item_cabin_ammo_1", kind: "ammo", x: -25.5, y: 0.1, z: 1.5 },
  { id: "item_cabin_yard_coin", kind: "coin", x: -18.5, y: 0.1, z: -4.0 },

  // ─── Loja do Mercador / Área Central ───
  { id: "item_shop_front_ammo", kind: "ammo", x: 4.5, y: 0.1, z: -5.5 },
  { id: "item_shop_side_coin", kind: "coin", x: -4.5, y: 0.1, z: 6.0 },

  // ─── Casa Central Abandonada (Piso Superior e Varanda) ───
  { id: "item_house_upper_ammo_1", kind: "ammo", x: 24.0, y: HOUSE_FLOOR_Y + 0.1, z: -3.0 },
  { id: "item_house_upper_coin_1", kind: "coin", x: 29.0, y: HOUSE_FLOOR_Y + 0.1, z: 3.5 },
  { id: "item_house_balcony_ammo", kind: "ammo", x: 17.5, y: HOUSE_FLOOR_Y + 0.1, z: -2.0 },
  { id: "item_house_yard_ammo", kind: "ammo", x: 15.0, y: 0.1, z: -12.0 },
  { id: "item_house_yard_coin", kind: "coin", x: 36.0, y: 0.1, z: 10.0 },

  // ─── Ferro Velho e Carros Abandonados (Setor Leste) ───
  { id: "item_junkyard_ammo_1", kind: "ammo", x: 44.0, y: 0.1, z: 2.0 },
  { id: "item_junkyard_coin_1", kind: "coin", x: 55.0, y: 0.1, z: -3.0 },
  { id: "item_junkyard_ammo_2", kind: "ammo", x: 62.0, y: 0.1, z: 5.0 },
  { id: "item_bus_coin", kind: "coin", x: 64.5, y: 0.1, z: -2.0 },
  { id: "item_bus_ammo", kind: "ammo", x: 74.5, y: 0.1, z: 1.5 },

  // ─── Checkpoint Militar e Tenda Médica C.E.D.A. (Extremo Leste) ───
  { id: "item_military_tent_ammo", kind: "ammo", x: 100.0, y: 0.1, z: -8.0 },
  { id: "item_military_tent_coin", kind: "coin", x: 98.0, y: 0.1, z: -10.0 },
  { id: "item_watchtower_ammo", kind: "ammo", x: 87.5, y: 0.1, z: 9.0 },
  { id: "item_trench_sandbags_coin", kind: "coin", x: 91.5, y: 0.1, z: 3.5 },
  { id: "item_humvee_ammo", kind: "ammo", x: 78.0, y: 0.1, z: -5.5 },

  // ─── Setor Norte: Casa do Sobrevivente ───
  { id: "item_north_house_coin", kind: "coin", x: -19.5, y: 0.1, z: 27.0 },
  { id: "item_north_house_ammo", kind: "ammo", x: -17.5, y: 0.1, z: 25.5 },
  { id: "item_north_yard_coin", kind: "coin", x: -19.5, y: 0.1, z: 21.0 },

  // ─── Setor Norte: Posto de Combustível Red Rock Fuel ───
  { id: "item_gas_station_store_coin", kind: "coin", x: 1.0, y: 0.1, z: 29.5 },
  { id: "item_gas_station_store_ammo", kind: "ammo", x: -1.5, y: 0.1, z: 29.5 },
  { id: "item_gas_pumps_ammo", kind: "ammo", x: 0.0, y: 0.1, z: 24.0 },

  // ─── Setor Norte: Oficina Mecânica ───
  { id: "item_workshop_inside_ammo", kind: "ammo", x: 28.5, y: 0.1, z: 22.5 },
  { id: "item_workshop_inside_coin", kind: "coin", x: 31.0, y: 0.1, z: 28.5 },
  { id: "item_workshop_yard_coin", kind: "coin", x: 22.0, y: 0.1, z: 19.0 },

  // ─── Setor Norte: Subestação Elétrica ───
  { id: "item_substation_cabin_coin", kind: "coin", x: 88.5, y: 0.1, z: 31.0 },
  { id: "item_substation_cabin_ammo", kind: "ammo", x: 90.0, y: 0.1, z: 30.0 },
  { id: "item_substation_outside_ammo", kind: "ammo", x: 88.5, y: 0.1, z: 25.0 },

  // ─── Setor Sul: Cabana do Caçador ───
  { id: "item_hunter_cabin_ammo", kind: "ammo", x: -19.5, y: 0.1, z: -27.0 },
  { id: "item_hunter_cabin_coin", kind: "coin", x: -17.5, y: 0.1, z: -25.5 },
  { id: "item_hunter_yard_coin", kind: "coin", x: -19.5, y: 0.1, z: -21.0 },

  // ─── Setor Sul: Lanchonete Rusty Diner ───
  { id: "item_diner_inside_coin", kind: "coin", x: 0.0, y: 0.1, z: -26.0 },
  { id: "item_diner_inside_ammo", kind: "ammo", x: -2.0, y: 0.1, z: -29.0 },
  { id: "item_diner_patio_coin", kind: "coin", x: 3.0, y: 0.1, z: -22.5 },

  // ─── Setor Sul: Pátio de Contêineres de Carga ───
  { id: "item_containers_ammo", kind: "ammo", x: 25.0, y: 0.1, z: -26.0 },
  { id: "item_containers_coin", kind: "coin", x: 32.0, y: 0.1, z: -26.0 },

  // ─── Setor Sul: Casamata / Depósito Militar C.E.D.A. ───
  { id: "item_bunker_ammo", kind: "ammo", x: 90.0, y: 0.1, z: -28.0 },
  { id: "item_bunker_coin", kind: "coin", x: 100.0, y: 0.1, z: -25.0 },
];
/** Quantidade de caixas de munição espalhadas aleatoriamente pelo mapa (sorteadas a cada partida e a cada reaparecimento). */
export const RANDOM_AMMO_COUNT = 40;
/** Quantidade de moedas espalhadas aleatoriamente pelo mapa (sorteadas a cada partida e a cada reaparecimento). */
export const RANDOM_COIN_COUNT = 40;
/** Distância mínima entre dois itens sorteados (evita aglomerados). */
export const RANDOM_ITEM_MIN_SPACING = 4.0;

export const AMMO_SPAWNS = ITEM_SPAWNS;
export const AMMO_BOX_RADIUS = ITEM_PICKUP_RADIUS;
export const AMMO_BOX_RESPAWN_TIME = ITEM_RESPAWN_TIME;

// ─── Tipos e Configurações de Inimigos ───────────────────────────────────────
export type EnemyTypeId =
  | "standard"
  | "runner"
  | "tank"
  | "spitter"
  | "mortar"
  | "boss"
  | "spider_boss"
  | "spider"
  | "werewolf_boss"
  | "wolf"
  | "sack_boss";

export interface EnemyConfig {
  id: EnemyTypeId;
  name: string;
  maxHp: number;
  speed: number;
  radius: number;
  damage: number;
  color: string;
  eyeColor: string;
  scale: number;
  attackRange: number;
  explodes?: boolean;
  crawls?: boolean;
  spitsSlime?: boolean;
  slimeTrail?: boolean;
  firesMortar?: boolean;
  spitsWeb?: boolean;
  isBoss?: boolean;
  isSpider?: boolean;
  isWerewolf?: boolean;
  isWolf?: boolean;
  isSackBoss?: boolean;
  stealsGun?: boolean;
}

/** Dicionário extensível de tipos de inimigos com características próprias. */
export const ENEMY_CONFIGS: Record<EnemyTypeId, EnemyConfig> = {
  standard: {
    id: "standard",
    name: "Bean Zombie",
    maxHp: 3, // Morre com 3 tiros
    speed: 2.2,
    radius: 0.55,
    damage: 1, // 1 ponto de dano
    color: "#4e7a3b",
    eyeColor: "#9eff57",
    scale: 1.0,
    attackRange: 1.25,
  },
  runner: {
    id: "runner",
    name: "Suicide Runner",
    maxHp: 2, // Apenas 2 de vida
    speed: 3.9, // Bem mais rápido
    radius: 0.45,
    damage: 3, // 3 de dano direto na explosão
    color: "#b02a2a", // Vermelho incendiário / instável
    eyeColor: "#ffe600", // Olhos amarelos incandescentes
    scale: 0.88,
    attackRange: 1.35, // Raio para detonar perto do jogador
    explodes: true,
  },
  tank: {
    id: "tank",
    name: "Brute Zombie",
    maxHp: 8, // Muito mais vida: morre com 8 tiros
    speed: 1.5,
    radius: 0.85, // Maior colisão
    damage: 1,
    color: "#253b20", // Verde-oliva escuro e imponente
    eyeColor: "#ff6600", // Olhos âmbar brilhantes
    scale: 1.55, // 55% maior que o zumbi padrão
    attackRange: 2.1, // Alcance de ataque muito maior (2.1m)
  },
  spitter: {
    id: "spitter",
    name: "Crawler Zombie",
    maxHp: 4,
    speed: 1.25, // Rasteja lentamente
    radius: 0.65,
    damage: 1,
    color: "#384d26", // Verde-pântano necrótico
    eyeColor: "#39ff14", // Verde radioativo / tóxico vibrante
    scale: 1.0,
    attackRange: 1.25,
    crawls: true,
    spitsSlime: true,
    slimeTrail: true,
  },
  mortar: {
    id: "mortar",
    name: "Mortar Zombie",
    maxHp: 3,
    speed: 1.85, // Anda bípede com passada firme
    radius: 0.55,
    damage: 1,
    color: "#3f4c28", // Verde-oliva militar bio-químico
    eyeColor: "#c6ff00", // Verde-limão tóxico radioativo
    scale: 1.05,
    attackRange: 1.3,
    firesMortar: true,
  },
  boss: {
    id: "boss",
    name: "Swamp Monster (Boss)",
    maxHp: 300, // 1º Chefe: 300 de vida
    speed: 1.25, // Passadas lentas, pesadas e imponentes
    radius: 1.65, // Forte, grande e compacto: diâmetro 3.3m (não entra em portas/casas!)
    damage: 2, // Golpe esmagador
    color: "#162712", // Verde-pântano escuro, musgo e turfa
    eyeColor: "#ff1100", // Apenas 2 olhos vermelhos pequenos ameaçadores
    scale: 2.3, // Forte, grande e compacto
    attackRange: 2.6, // Alcance estendido de braços de cipó
    firesMortar: true, // Dispara gosma explosiva em área ampliada
    isBoss: true,
  },
  spider_boss: {
    id: "spider_boss",
    name: "Spider Queen (Boss)",
    maxHp: 600, // 2º Chefe: 600 de vida
    speed: 1.9, // Passada predatória ágil com 8 patas
    radius: 1.35, // Aranha gigante (diâmetro 2.7m com as patas, não entra em portas)
    damage: 2, // Mordida peçonhenta com quelíceras
    color: "#121017", // Quitina negra profunda estilo Don't Starve
    eyeColor: "#ff1c3b", // Múltiplos olhos vermelhos reluzentes
    scale: 2.1,
    attackRange: 2.3,
    spitsWeb: true, // Cospe projéteis de teia paralisante
    isBoss: true,
    isSpider: true,
  },
  spider: {
    id: "spider",
    name: "Black Spider",
    maxHp: 2, // Morre com 2 tiros
    speed: 3.3, // Rápida e errática no chão
    radius: 0.45, // Menor que o zumbi feijão
    damage: 1, // Dano normal
    color: "#0a090e", // Carvão escuro profundo / aranha estilo Don't Starve
    eyeColor: "#ff2a4a", // Olhinhos brilhantes rubi
    scale: 0.72,
    attackRange: 1.15,
    isSpider: true,
  },
  werewolf_boss: {
    id: "werewolf_boss",
    name: "Werewolf (Boss)",
    maxHp: 900, // 3º Chefe: 900 de vida
    speed: 2.3, // Rápido, predatório e intimidador
    radius: 1.55, // Grande porte (diâmetro 3.1m, não passa por portas)
    damage: 2, // Laceramento brutal de garras
    color: "#3e2312", // Pelagem marrom escura estilo Don't Starve
    eyeColor: "#f59e0b", // Olhos âmbar brilhantes e ferozes
    scale: 2.65, // Imponente e amedrontador
    attackRange: 2.6, // Alcance longo de garras
    isBoss: true,
    isWerewolf: true,
  },
  wolf: {
    id: "wolf",
    name: "Wolf",
    maxHp: 3, // Morre com 3 tiros
    speed: 3.8, // Muito veloz (estilo Hound de Don't Starve)
    radius: 0.65, // Porte proporcional ao zumbi rastejador
    damage: 1, // Dano de mordida por contato
    color: "#4e2c18", // Marrom escuro rústico
    eyeColor: "#fbbf24", // Olhos amarelos penetrantes
    scale: 1.38, // Dimensionado ao tamanho do zumbi rastejador
    attackRange: 1.35,
    isWolf: true,
  },
  sack_boss: {
    id: "sack_boss",
    name: "Sack Man (Boss)",
    maxHp: 1200, // 4º Chefe: 1200 de vida
    speed: 2.15, // Passada rápida e sinistra de andarilho
    radius: 1.45, // Grande porte (não passa por portas)
    damage: 2, // Pancada pesada com o saco
    color: "#3a3026", // Sobretudo marrom surrado de mendigo
    eyeColor: "#ffcc00", // Olhos amarelados malévolos sob o chapéu
    scale: 2.35, // Chefe alto, imponente e curvado
    attackRange: 2.7, // Alcance estendido com o balanço do saco
    isBoss: true,
    isSackBoss: true,
    stealsGun: true,
  },
};

/** Tempo em segundos que o corpo do inimigo permanece caído no chão antes de sumir. */
export const CORPSE_DECAY_TIME = 10;

// ─── Gosma Tóxica e Cuspe do Zumbi Rastejador ─────────────────────────────
/** Duração da poça de gosma no chão em segundos. */
export const SLIME_PUDDLE_LIFETIME = 7.5;
/** Raio de dano da poça de gosma no chão. */
export const SLIME_PUDDLE_RADIUS = 0.9;
/** Dano por segundo causado ao pisar na gosma. */
export const SLIME_DAMAGE_PER_SEC = 1;
/** Velocidade da bola de cuspe de gosma. */
export const SPIT_SPEED = 10.5;
/** Raio de colisão da bola de gosma. */
export const SPIT_RADIUS = 0.35;
/** Dano direto causado pelo impacto da bola de gosma. */
export const SPIT_DAMAGE = 2;
/** Tempo de vida máximo do projétil de cuspe em segundos. */
export const SPIT_LIFETIME = 1.8;
/** Intervalo entre cuspes do rastejador em segundos. */
export const SPIT_COOLDOWN = 3.6;

// ─── Teia Paralisante da Aranha Gigante ────────────────────────────────────
/** Duração da paralisia causada pela teia no sobrevivente (em segundos). */
export const WEB_PARALYZE_DURATION = 1.8;
/** Velocidade do tiro de teia lançado pela aranha gigante. */
export const WEB_SPIT_SPEED = 12.0;
/** Dano direto causado pelo impacto da teia. */
export const WEB_SPIT_DAMAGE = 1;

// ─── Morteiro de Gosma (Tiro em Parábola) ──────────────────────────────────
/** Distância mínima para disparar o morteiro (em metros). */
export const MORTAR_MIN_RANGE = 0.8;
/** Distância máxima de alcance do morteiro (em metros). */
export const MORTAR_MAX_RANGE = 20.0;
/** Intervalo entre disparos do morteiro em segundos. */
export const MORTAR_COOLDOWN = 3.4;
/** Dano direto causado pelo impacto da bomba de morteiro. */
export const MORTAR_DAMAGE = 2;
/** Raio de impacto do projétil de morteiro. */
export const MORTAR_SPLASH_RADIUS = 1.35;
/** Velocidade horizontal de referência para tempo de voo. */
export const MORTAR_FLIGHT_SPEED = 11.5;

// ─── Obstáculos estáticos e Colisores da Casa ──────────────────────────────
export type ObstacleKind = "crate" | "barrel" | "tree" | "campfire";
export interface Obstacle {
  x: number;
  z: number;
  r: number;
  kind: ObstacleKind;
}

/** Colisor retangular (AABB) com suporte opcional a faixa de altura [minY, maxY]. */
export interface BoxCollider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  minY?: number;
  maxY?: number;
}

/** Estrutura com cobertura/telhado sólido que protege entidades abaixo contra disparos aéreos de morteiro. */
export interface RoofStructure {
  name: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  roofY: number; // Altura do topo do telhado onde projéteis impactam
  ceilingY: number; // Altura interna do teto abaixo da qual o jogador está abrigado
}

/** Estruturas com telhado sólido na arena (Casinha Inicial, Casa Abandonada e Loja). */
export const ROOF_STRUCTURES: ReadonlyArray<RoofStructure> = [
  // Casinha Inicial à esquerda (quarto fechado de sobrevivência)
  {
    name: "start_cabin",
    minX: -27.5,
    maxX: -21.2,
    minZ: -3.2,
    maxZ: 3.2,
    roofY: 3.15,
    ceilingY: 2.7,
  },
  // Casa Abandonada (interior coberto pelo telhado de madeira)
  {
    name: "abandoned_house",
    minX: 19.4,
    maxX: 34.6,
    minZ: -7.4,
    maxZ: 7.4,
    roofY: 5.5,
    ceilingY: 5.0,
  },
  // Loja de Sobrevivência (toldo / cobertura militar centralizada)
  {
    name: "shop",
    minX: -1.6,
    maxX: 1.6,
    minZ: 2.8,
    maxZ: 5.2,
    roofY: 2.45,
    ceilingY: 2.35,
  },
  // Tenda Médica de Campanha C.E.D.A.
  {
    name: "medical_tent",
    minX: 95.8,
    maxX: 104.2,
    minZ: -12.2,
    maxZ: -3.8,
    roofY: 3.3,
    ceilingY: 2.9,
  },
  // Teto da Torre de Vigia Militar
  {
    name: "watchtower",
    minX: 84.8,
    maxX: 90.2,
    minZ: 6.6,
    maxZ: 11.4,
    roofY: 4.4,
    ceilingY: 4.1,
  },
  // Posto de Combustível Abandonado (Quiosque de Conveniência)
  {
    name: "gas_station_kiosk",
    minX: -3.4,
    maxX: 4.4,
    minZ: 26.6,
    maxZ: 32.8,
    roofY: 3.4,
    ceilingY: 3.1,
  },
  // Posto de Combustível Abandonado (Toldo / Cobertura Vermelha das Bombas)
  {
    name: "gas_station_canopy",
    minX: -4.5,
    maxX: 4.5,
    minZ: 18.0,
    maxZ: 26.2,
    roofY: 4.3,
    ceilingY: 3.9,
  },
  // Oficina Mecânica em Ruínas
  {
    name: "auto_workshop",
    minX: 23.4,
    maxX: 33.6,
    minZ: 20.4,
    maxZ: 31.2,
    roofY: 3.8,
    ceilingY: 3.5,
  },
  // Lanchonete Rusty Diner
  {
    name: "rusty_diner",
    minX: -4.2,
    maxX: 4.2,
    minZ: -31.2,
    maxZ: -23.8,
    roofY: 3.2,
    ceilingY: 2.9,
  },
  // Casamata / Bunker Militar Subterrâneo
  {
    name: "military_bunker",
    minX: 85.0,
    maxX: 94.0,
    minZ: -32.5,
    maxZ: -25.5,
    roofY: 3.2,
    ceilingY: 2.8,
  },
  // Cabine de Controle da Subestação Elétrica
  {
    name: "substation_control",
    minX: 85.0,
    maxX: 92.0,
    minZ: 28.4,
    maxZ: 33.0,
    roofY: 3.2,
    ceilingY: 2.8,
  },
  // Casa do Sobrevivente do Norte (Settler's House)
  {
    name: "settler_house",
    minX: -23.5,
    maxX: -15.5,
    minZ: 23.0,
    maxZ: 31.2,
    roofY: 3.6,
    ceilingY: 3.1,
  },
  // Cabana do Caçador do Sul (Hunter's Cabin)
  {
    name: "hunter_cabin",
    minX: -23.5,
    maxX: -15.5,
    minZ: -31.2,
    maxZ: -23.0,
    roofY: 3.6,
    ceilingY: 3.1,
  },
];

/** Obstáculos circulares no chão ao longo do percurso da lareira até o checkpoint militar. */
export const OBSTACLES: ReadonlyArray<Obstacle> = [
  // Lareira / fogueira inicial
  { x: START_CAMPFIRE_X, z: START_CAMPFIRE_Z, r: 0.8, kind: "campfire" },
  // Bosque e árvores ao redor da clareira inicial
  { x: -28, z: -10, r: 0.8, kind: "tree" },
  { x: -28, z: 10, r: 0.8, kind: "tree" },
  { x: -16, z: -12, r: 0.8, kind: "tree" },
  { x: -16, z: 12, r: 0.8, kind: "tree" },
  { x: -25, z: -4, r: 1.0, kind: "crate" },
  { x: -20, z: 5, r: 0.7, kind: "barrel" },
  // Trilha seguindo para a direita (+X)
  { x: -8, z: -8, r: 0.8, kind: "tree" },
  { x: -6, z: 9, r: 0.8, kind: "tree" },
  { x: 0, z: -11, r: 1.0, kind: "crate" },
  { x: 3, z: 11, r: 0.7, kind: "barrel" },
  { x: 7, z: -8, r: 0.8, kind: "tree" },
  { x: 8, z: 9, r: 0.8, kind: "tree" },
  // ─── Ferro Velho (depois da casa) ──────────────────────────────────────────
  { x: 42, z: -10, r: 0.8, kind: "barrel" },
  { x: 43.5, z: 9.5, r: 1.0, kind: "crate" },
  { x: 50, z: -11, r: 1.0, kind: "crate" },
  { x: 55, z: 9.0, r: 0.8, kind: "barrel" },
  { x: 63, z: -10, r: 0.8, kind: "barrel" },
  { x: 67, z: 7.5, r: 1.0, kind: "crate" },
  // ─── Checkpoint Militar (X: 75 a 115) ──────────────────────────────────
  { x: 76, z: 12.0, r: 0.8, kind: "tree" },
  { x: 80, z: -12.0, r: 0.8, kind: "barrel" },
  { x: 86, z: -2.0, r: 1.0, kind: "crate" },
  { x: 94, z: 11.0, r: 0.8, kind: "barrel" },
  { x: 106, z: 7.5, r: 1.0, kind: "crate" },
  { x: 108, z: -10.0, r: 0.8, kind: "barrel" },
];

/**
 * Colisores das paredes da casa e grades da varanda.
 * A casa fica entre X: 20 e 34, Z: -7 e 7.
 * A varanda fica entre X: 16 e 20, Z: -5 e 5.
 * A tábua inclinada (subida) conecta X: 10 até X: 16 em Z: [-1.3, 1.3].
 * A rampa de descida interna conecta X: 27.5 até X: 33 em Z: [-1.3, 1.3].
 */
export const HOUSE_STRUCTURE_COLLIDERS: ReadonlyArray<BoxCollider> = [
  // ─── 1) Fundação sólida sob a casa (veda 100% o vão térreo y < 2.35 sob os pisos suspensos) ───
  // Lateral Norte contínua ao longo de toda a casa (X: 19.6 a 34.2, Z: 1.45 a 7.0)
  { minX: 19.6, maxX: 34.2, minZ: 1.45, maxZ: 7.0, maxY: 2.35 },
  // Lateral Sul contínua ao longo de toda a casa (X: 19.6 a 34.2, Z: -7.0 a -1.45)
  { minX: 19.6, maxX: 34.2, minZ: -7.0, maxZ: -1.45, maxY: 2.35 },
  // Vão térreo sob o salão frontal/oeste em Z central (X: 19.6 a 26.2, Z: -1.45 a 1.45, maxY: 2.05).
  // Mantém o canal da escada (X >= 26.2 a 34.0 em Z: [-1.45, 1.45]) 100% livre para subir e descer sem parede invisível.
  { minX: 19.6, maxX: 26.2, minZ: -1.45, maxZ: 1.45, maxY: 2.05 },

  // ─── 2) Grades da Varanda (bloqueiam quem está em cima y >= 2.0) ─────────
  // Grade Norte da varanda
  { minX: 15.7, maxX: 20.0, minZ: 4.7, maxZ: 5.2, minY: 2.0 },
  // Grade Sul da varanda
  { minX: 15.7, maxX: 20.0, minZ: -5.2, maxZ: -4.7, minY: 2.0 },
  // Grade Oeste da varanda (aberta no meio em Z: [-1.3, 1.3] para entrada da tábua)
  { minX: 15.7, maxX: 16.2, minZ: 1.3, maxZ: 5.0, minY: 2.0 },
  { minX: 15.7, maxX: 16.2, minZ: -5.0, maxZ: -1.3, minY: 2.0 },

  // ─── 3) Paredes superiores da Casa (y >= 2.0) ────────────────────────────
  // Parede frontal superior (com vão de porta em Z: [-1.3, 1.3])
  { minX: 19.7, maxX: 20.3, minZ: 1.3, maxZ: 7.0, minY: 2.0 },
  { minX: 19.7, maxX: 20.3, minZ: -7.0, maxZ: -1.3, minY: 2.0 },
  // Paredes laterais superiores
  { minX: 19.7, maxX: 34.2, minZ: 6.7, maxZ: 7.2, minY: 2.0 },
  { minX: 19.7, maxX: 34.2, minZ: -7.2, maxZ: -6.7, minY: 2.0 },
  // Parede de trás superior (com vão para rampa de descida)
  { minX: 33.7, maxX: 34.2, minZ: 1.45, maxZ: 7.0, minY: 2.0 },
  { minX: 33.7, maxX: 34.2, minZ: -7.0, maxZ: -1.45, minY: 2.0 },

  // Guarda-corpos da escada interna (no piso superior y >= 1.8, impedem cair no vão da escada pela lateral)
  { minX: 27.4, maxX: 33.8, minZ: 1.45, maxZ: 1.65, minY: 1.8 },
  { minX: 27.4, maxX: 33.8, minZ: -1.65, maxZ: -1.45, minY: 1.8 },
];

/**
 * Colisores dos carros abandonados e sucatas do ferro velho (X: 37 a 69).
 */
export const JUNKYARD_COLLIDERS: ReadonlyArray<BoxCollider> = [
  // Carro 1: Sedan Azul (X: 39.5, Z: -5.0)
  { minX: 37.3, maxX: 41.7, minZ: -6.2, maxZ: -3.8 },
  // Carro 2: Pickup Verde (X: 41.0, Z: 5.5)
  { minX: 38.6, maxX: 43.4, minZ: 4.3, maxZ: 6.7 },
  // Carro 3: Van Branca atravessada (X: 47.5, Z: -1.0)
  { minX: 44.8, maxX: 50.2, minZ: -2.8, maxZ: 0.8 },
  // Carro 4: Sedan Vermelho (X: 48.0, Z: 7.0)
  { minX: 45.9, maxX: 50.1, minZ: 5.9, maxZ: 8.1 },
  // Carro 5: Sedan Tombado (X: 52.5, Z: -6.5)
  { minX: 50.5, maxX: 54.5, minZ: -7.6, maxZ: -5.4 },
  // Carro 6: Pickup Ferrugem (X: 54.5, Z: 2.5)
  { minX: 52.2, maxX: 56.8, minZ: 1.3, maxZ: 3.7 },
  // Carro 7: Sedan Amarelo (X: 59.5, Z: -3.5)
  { minX: 57.3, maxX: 61.7, minZ: -4.8, maxZ: -2.2 },
  // Carro 8: Van Cinza (X: 60.5, Z: 5.0)
  { minX: 58.0, maxX: 63.0, minZ: 3.8, maxZ: 6.2 },
  // Carros 9 e 10: Carros Empilhados (X: 66.0, Z: 0.5)
  { minX: 63.8, maxX: 68.2, minZ: -0.8, maxZ: 1.8 },
  // Carro 11: Carcaça / Esqueleto de Carro (X: 65.5, Z: -6.5)
  { minX: 63.5, maxX: 67.5, minZ: -7.8, maxZ: -5.2 },
];

/**
 * Colisores das barricadas laterais da casa (grades, lixo e pneus).
 * Agora orientadas longitudinalmente ao longo do eixo X, mantendo passagem aberta nos becos laterais
 * (Norte: Z de 7.2 a 12.6; Sul: Z de -12.6 a -7.2) para que zumbis e jogadores circulem livremente.
 */
export const SIDE_BARRICADE_COLLIDERS: ReadonlyArray<BoxCollider> = [
  // Cerca longitudinal Norte (ao longo de Z ≈ 13.0, com vão de portão aberto em X: [25.5, 28.5])
  { minX: 17.5, maxX: 25.5, minZ: 12.8, maxZ: 13.4 },
  { minX: 28.5, maxX: 36.0, minZ: 12.8, maxZ: 13.4 },
  // Caçambas e pilhas de pneus no flanco externo norte
  { minX: 20.8, maxX: 23.6, minZ: 13.4, maxZ: 15.2 },
  { minX: 30.0, maxX: 33.2, minZ: 13.4, maxZ: 14.8 },

  // Cerca longitudinal Sul (ao longo de Z ≈ -13.0, com vão de portão aberto em X: [25.5, 28.5])
  { minX: 17.5, maxX: 25.5, minZ: -13.4, maxZ: -12.8 },
  { minX: 28.5, maxX: 36.0, minZ: -13.4, maxZ: -12.8 },
  // Caçambas e pilhas de pneus no flanco externo sul
  { minX: 20.8, maxX: 23.6, minZ: -15.2, maxZ: -13.4 },
  { minX: 30.0, maxX: 33.2, minZ: -14.8, maxZ: -13.4 },
];

/**
 * Colisores da casinha inicial à esquerda do mapa (X: -27.4 a -21.6, Z: -3.1 a 3.1).
 * Quarto de sobrevivência com paredes perimetrais, mesa, armário e vão de porta na parede leste (+X).
 */
export const START_CABIN_COLLIDERS: ReadonlyArray<BoxCollider> = [
  // 1) Parede Oeste (Fundos da casa)
  { minX: -27.4, maxX: -26.7, minZ: -3.0, maxZ: 3.0 },
  // 2) Parede Norte
  { minX: -27.4, maxX: -21.7, minZ: 2.7, maxZ: 3.1 },
  // 3) Parede Sul
  { minX: -27.4, maxX: -21.7, minZ: -3.1, maxZ: -2.7 },
  // 4) Parede Leste (Frente, voltada para +X): com porta em Z: [-1.05, 1.05] (vão livre de 2.1m)
  { minX: -22.3, maxX: -21.7, minZ: 1.05, maxZ: 3.0 },
  { minX: -22.3, maxX: -21.7, minZ: -3.0, maxZ: -1.05 },

  // 5) Mesa de Sobrevivência (encostada na parede sul)
  { minX: -26.7, maxX: -24.9, minZ: -2.5, maxZ: -1.2 },
  // 6) Armário / Estante metálica (na parede norte)
  { minX: -26.6, maxX: -25.0, minZ: 2.1, maxZ: 2.7 },
];

/** Colisor do balcão e bancada da Loja de Equipamentos (centralizada entre as duas casas). */
export const SHOP_COLLIDERS: ReadonlyArray<BoxCollider> = [
  { minX: -1.2, maxX: 1.2, minZ: 3.4, maxZ: 4.6 },
];

/** Colisores do Ônibus Escolar Amarelo tombado na transição para o ferro velho (X: 66 a 74). */
export const SCHOOL_BUS_COLLIDERS: ReadonlyArray<BoxCollider> = [
  { minX: 66.0, maxX: 74.0, minZ: -3.4, maxZ: -0.6 },
];

/**
 * Colisores das estruturas do Checkpoint Militar de Quarentena (X: 75 a 115):
 * - Viatura blindada (Humvee)
 * - Tenda médica C.E.D.A. (paredes perimetrais com vão de porta)
 * - Torre de vigia (pilares no térreo e guarda-corpos no piso superior)
 * - Ouriços tchecos e barricadas de sacos de areia
 * - Muralha e portão colossal de quarentena
 */
export const CHECKPOINT_COLLIDERS: ReadonlyArray<BoxCollider> = [
  // 1) Viatura Blindada Humvee (X: 79.0, Z: -6.0)
  { minX: 76.8, maxX: 81.2, minZ: -7.5, maxZ: -4.5 },

  // 2) Tenda Médica C.E.D.A. (X: 96.0 a 104.0, Z: -12.0 a -4.0)
  // Parede Sul (fundos da tenda)
  { minX: 95.8, maxX: 104.2, minZ: -12.2, maxZ: -11.6 },
  // Parede Leste
  { minX: 103.6, maxX: 104.2, minZ: -12.0, maxZ: -4.0 },
  // Parede Oeste
  { minX: 95.8, maxX: 96.4, minZ: -12.0, maxZ: -4.0 },
  // Parede Norte (com vão de porta aberta em X: [98.5, 101.5])
  { minX: 95.8, maxX: 98.5, minZ: -4.4, maxZ: -3.8 },
  { minX: 101.5, maxX: 104.2, minZ: -4.4, maxZ: -3.8 },

  // 3) Torre de Vigia Militar (X: 85.0 a 90.0, Z: 6.8 a 11.2)
  // Pilares de sustentação no térreo (maxY: 2.2)
  { minX: 84.8, maxX: 85.8, minZ: 10.4, maxZ: 11.4, maxY: 2.2 }, // NW
  { minX: 89.2, maxX: 90.2, minZ: 10.4, maxZ: 11.4, maxY: 2.2 }, // NE
  { minX: 84.8, maxX: 85.8, minZ: 6.6, maxZ: 7.6, maxY: 2.2 },   // SW
  { minX: 89.2, maxX: 90.2, minZ: 6.6, maxZ: 7.6, maxY: 2.2 },   // SE
  // Parapeitos/Guarda-corpos no piso superior da torre (minY: 2.0)
  { minX: 84.8, maxX: 90.2, minZ: 10.8, maxZ: 11.4, minY: 2.0 }, // Norte
  { minX: 89.4, maxX: 90.2, minZ: 6.8, maxZ: 11.2, minY: 2.0 },  // Leste
  { minX: 84.8, maxX: 90.2, minZ: 6.6, maxZ: 7.2, minY: 2.0 },   // Sul
  { minX: 84.8, maxX: 85.4, minZ: 6.6, maxZ: 7.8, minY: 2.0 },   // Oeste lateral sul
  { minX: 84.8, maxX: 85.4, minZ: 10.2, maxZ: 11.4, minY: 2.0 }, // Oeste lateral norte

  // 4) Barreiras de Sacos de Areia (Sandbags)
  // Trincheira em U no posto avançado (X: 89.0 a 93.5, Z: 2.0 a 4.5)
  { minX: 89.5, maxX: 93.5, minZ: 2.0, maxZ: 2.8 },
  { minX: 89.5, maxX: 90.3, minZ: 2.8, maxZ: 4.5 },
  // Barricada em frente à tenda médica
  { minX: 95.0, maxX: 98.0, minZ: -2.5, maxZ: -1.7 },

  // 5) Ouriços Tchecos (Obstáculos Antitanque)
  { minX: 75.3, maxX: 76.7, minZ: 0.8, maxZ: 2.2 },
  { minX: 77.0, maxX: 78.4, minZ: -2.7, maxZ: -1.3 },
  { minX: 92.5, maxX: 93.9, minZ: -1.2, maxZ: 0.2 },

  // 6) Muralha & Portão Blindado de Quarentena Final (bloqueio total no leste X: 113.5 a 115 através de todo o mapa expandido)
  { minX: 113.5, maxX: 115.5, minZ: -36.5, maxZ: 36.5 },
];

/**
 * Colisores das novas construções pós-apocalípticas no Setor Norte (Z: 14 a 34):
 * - Posto de Combustível Abandonado "Red Rock Fuel" (quiosque, bombas, picape e pilares)
 * - Oficina Mecânica e Garagem em Ruínas (galpão, bancadas, elevador com chassi)
 * - Acampamento de Sobreviventes / Quarentena (tendas, torre de madeira, sacos de areia)
 * - Subestação Elétrica Destruída (transformadores e cabine de controle)
 */
export const EXPANDED_NORTH_COLLIDERS: ReadonlyArray<BoxCollider> = [
  // 0) Casa do Sobrevivente do Norte (X: -23.5 a -15.5, Z: 23.0 a 31.2)
  // Paredes de madeira (vão de porta na face sul em X: [-20.5, -18.5])
  { minX: -23.5, maxX: -15.5, minZ: 30.6, maxZ: 31.2 }, // Fundo Norte
  { minX: -23.5, maxX: -22.9, minZ: 23.0, maxZ: 31.2 }, // Parede Oeste
  { minX: -16.1, maxX: -15.5, minZ: 23.0, maxZ: 31.2 }, // Parede Leste
  { minX: -23.5, maxX: -20.5, minZ: 23.0, maxZ: 23.6 }, // Frente Sul (lado esquerdo)
  { minX: -18.5, maxX: -15.5, minZ: 23.0, maxZ: 23.6 }, // Frente Sul (lado direito)
  // Mobília interna da casa do sobrevivente
  { minX: -22.9, maxX: -21.4, minZ: 24.5, maxZ: 27.5 }, // Sofá rasgado
  { minX: -17.5, maxX: -16.1, minZ: 25.0, maxZ: 29.5 }, // Bancada de cozinha
  { minX: -18.5, maxX: -16.5, minZ: 29.2, maxZ: 30.6 }, // Cama improvisada

  // 1) Posto de Combustível Abandonado "Red Rock Fuel" (X: -6 a 6, Z: 18 a 32)
  // Quiosque de conveniência (vão de porta em X: [0.2, 2.2])
  { minX: -3.4, maxX: 0.2, minZ: 26.6, maxZ: 27.2 },
  { minX: 2.2, maxX: 4.4, minZ: 26.6, maxZ: 27.2 },
  { minX: -3.4, maxX: 4.4, minZ: 32.2, maxZ: 32.8 }, // Fundo
  { minX: -3.4, maxX: -2.8, minZ: 26.6, maxZ: 32.8 }, // Parede Oeste
  { minX: 3.8, maxX: 4.4, minZ: 26.6, maxZ: 32.8 }, // Parede Leste
  // Ilha de bombas de combustível
  { minX: -1.8, maxX: 1.8, minZ: 20.8, maxZ: 22.4 },
  // Pilares de aço do toldo
  { minX: -3.8, maxX: -3.2, minZ: 18.8, maxZ: 19.4 },
  { minX: 3.2, maxX: 3.8, minZ: 18.8, maxZ: 19.4 },
  { minX: -3.8, maxX: -3.2, minZ: 24.8, maxZ: 25.4 },
  { minX: 3.2, maxX: 3.8, minZ: 24.8, maxZ: 25.4 },
  // Picape enferrujada ao lado da bomba
  { minX: -4.5, maxX: -2.2, minZ: 21.0, maxZ: 23.8 },

  // 2) Oficina Mecânica em Ruínas (X: 22 a 34, Z: 18 a 32)
  // Galpão (com vão de portão rolante em X: [26.2, 30.8])
  { minX: 23.4, maxX: 33.6, minZ: 30.6, maxZ: 31.2 }, // Fundo
  { minX: 23.4, maxX: 24.0, minZ: 20.4, maxZ: 31.2 }, // Oeste
  { minX: 33.0, maxX: 33.6, minZ: 20.4, maxZ: 31.2 }, // Leste
  { minX: 23.4, maxX: 26.2, minZ: 20.4, maxZ: 21.0 }, // Frente Oeste
  { minX: 30.8, maxX: 33.6, minZ: 20.4, maxZ: 21.0 }, // Frente Leste
  // Elevador automotivo e carcaça içada
  { minX: 27.2, maxX: 29.8, minZ: 24.2, maxZ: 27.4 },
  // Bancada de aço no fundo
  { minX: 24.5, maxX: 28.5, minZ: 29.6, maxZ: 30.6 },

  // 2.5) Trailer Residencial Abandonado (Camper Trailer no vão X: 39 a 45)
  { minX: 39.0, maxX: 44.5, minZ: 24.0, maxZ: 27.2 },

  // 3) Acampamento de Sobreviventes (X: 50 a 64, Z: 18 a 32)
  // Base da torre de vigia improvisada
  { minX: 50.8, maxX: 53.2, minZ: 26.8, maxZ: 29.2 },
  // Barricadas de sacos de areia
  { minX: 54.0, maxX: 58.5, minZ: 21.0, maxZ: 21.8 },
  { minX: 59.5, maxX: 63.5, minZ: 24.5, maxZ: 25.3 },

  // 3.5) Blindado de Transporte Tombado e Bloqueio Policial (vão X: 68 a 76)
  { minX: 70.0, maxX: 74.5, minZ: 24.5, maxZ: 27.5 },
  { minX: 68.0, maxX: 70.0, minZ: 22.0, maxZ: 23.0 },

  // 4) Subestação Elétrica Destruída (X: 82 a 98, Z: 18 a 34)
  // Transformadores de alta tensão
  { minX: 84.0, maxX: 87.5, minZ: 23.0, maxZ: 26.5 },
  { minX: 90.0, maxX: 93.5, minZ: 23.0, maxZ: 26.5 },
  // Cabine de Controle e Distribuição (prédio transitável com vão de porta em X: [87.5, 89.5])
  { minX: 85.0, maxX: 92.0, minZ: 32.4, maxZ: 33.0 }, // Fundo Norte
  { minX: 85.0, maxX: 85.6, minZ: 28.4, maxZ: 33.0 }, // Parede Oeste
  { minX: 91.4, maxX: 92.0, minZ: 28.4, maxZ: 33.0 }, // Parede Leste
  { minX: 85.0, maxX: 87.5, minZ: 28.4, maxZ: 29.0 }, // Frente Sul (lado esquerdo)
  { minX: 89.5, maxX: 92.0, minZ: 28.4, maxZ: 29.0 }, // Frente Sul (lado direito)
  // Equipamentos internos da cabine
  { minX: 85.6, maxX: 86.8, minZ: 29.5, maxZ: 31.8 }, // Racks de baterias industriais
  { minX: 88.0, maxX: 91.0, minZ: 31.4, maxZ: 32.4 }, // Console de comando
];

/**
 * Colisores das novas construções pós-apocalípticas no Setor Sul (Z: -34 a -14):
 * - Cabana do Caçador do Sul (toras de madeira, lareira de pedra, cama e mesa)
 * - Lanchonete Abandonada "Rusty Diner" (paredes, balcão curvo, caçamba e pátio)
 * - Pátio de Contêineres de Carga (4 grandes contêineres industriais empilhados e alinhados)
 * - Oficina Aberta de Sucata e Gerador Diesel
 * - Silo Agrícola, Tubos de Concreto e Trator Pesado
 * - Celeiro / Estábulo em Ruínas
 * - Depósito Militar de Suprimentos & Casamata Blindada C.E.D.A.
 */
export const EXPANDED_SOUTH_COLLIDERS: ReadonlyArray<BoxCollider> = [
  // 0) Cabana do Caçador do Sul (X: -23.5 a -15.5, Z: -31.2 a -23.0)
  // Paredes rústicas de toras (vão de porta na face norte em X: [-20.5, -18.5])
  { minX: -23.5, maxX: -15.5, minZ: -31.2, maxZ: -30.6 }, // Fundo Sul
  { minX: -23.5, maxX: -22.9, minZ: -31.2, maxZ: -23.0 }, // Parede Oeste
  { minX: -16.1, maxX: -15.5, minZ: -31.2, maxZ: -23.0 }, // Parede Leste
  { minX: -23.5, maxX: -20.5, minZ: -23.6, maxZ: -23.0 }, // Frente Norte (lado esquerdo)
  { minX: -18.5, maxX: -15.5, minZ: -23.6, maxZ: -23.0 }, // Frente Norte (lado direito)
  // Mobília interna da cabana do caçador
  { minX: -20.5, maxX: -18.5, minZ: -30.6, maxZ: -29.2 }, // Lareira de alvenaria
  { minX: -18.5, maxX: -16.5, minZ: -30.5, maxZ: -28.5 }, // Cama rústica
  { minX: -21.8, maxX: -20.2, minZ: -27.5, maxZ: -25.5 }, // Mesa de caça com cadeiras

  // 1) Lanchonete Abandonada "Rusty Diner" (X: -6 a 6, Z: -32 a -18)
  // Paredes (vão de porta em X: [-0.5, 1.8])
  { minX: -4.2, maxX: 4.2, minZ: -31.2, maxZ: -30.6 }, // Fundo
  { minX: -4.2, maxX: -3.6, minZ: -31.2, maxZ: -23.8 }, // Oeste
  { minX: 3.6, maxX: 4.2, minZ: -31.2, maxZ: -23.8 }, // Leste
  { minX: -4.2, maxX: -0.5, minZ: -24.4, maxZ: -23.8 }, // Frente Oeste
  { minX: 1.8, maxX: 4.2, minZ: -24.4, maxZ: -23.8 }, // Frente Leste
  // Balcão do Diner em ferradura
  { minX: -2.2, maxX: 2.2, minZ: -28.5, maxZ: -27.5 },

  // 2) Pátio de Contêineres de Carga (X: 22 a 34, Z: -32 a -18)
  // Contêiner Vermelho Ferrugem
  { minX: 22.0, maxX: 28.0, minZ: -24.2, maxZ: -21.8 },
  // Contêiner Azul Industrial
  { minX: 28.5, maxX: 34.5, minZ: -24.2, maxZ: -21.8 },
  // Contêiner Amarelo Atravessado
  { minX: 24.5, maxX: 30.5, minZ: -28.6, maxZ: -26.2 },
  // Contêiner Militar Verde-Oliva
  { minX: 28.5, maxX: 34.5, minZ: -32.5, maxZ: -30.1 },

  // 2.5) Oficina Aberta de Sucatas & Gerador Diesel (vão X: 39 a 45)
  { minX: 40.0, maxX: 42.0, minZ: -27.0, maxZ: -25.0 }, // Gerador pesado
  { minX: 42.8, maxX: 44.8, minZ: -27.0, maxZ: -24.5 }, // Bancada de peças e ferramentas

  // 3) Silo Agrícola e Trator Abandonado (X: 50 a 64, Z: -32 a -18)
  // Silo Cilíndrico de Grãos
  { minX: 51.5, maxX: 55.5, minZ: -26.5, maxZ: -22.5 },
  // Trator Vermelho Pesado com Arado
  { minX: 57.5, maxX: 62.0, minZ: -26.5, maxZ: -23.5 },
  // Tubos Gigantes de Drenagem de Concreto
  { minX: 53.0, maxX: 57.0, minZ: -31.5, maxZ: -29.0 },

  // 3.5) Celeiro / Estábulo Agrícola em Ruínas (vão X: 70 a 76)
  { minX: 70.5, maxX: 74.5, minZ: -28.0, maxZ: -25.0 },

  // 4) Depósito Militar de Suprimentos & Bunker C.E.D.A. (X: 82 a 98, Z: -34 a -18)
  // Casamata / Bunker de Concreto Blindado (prédio transitável com vão de porta blindada em X: [88.5, 90.7])
  { minX: 85.0, maxX: 94.0, minZ: -32.5, maxZ: -31.9 }, // Fundo Sul
  { minX: 85.0, maxX: 85.6, minZ: -32.5, maxZ: -25.5 }, // Parede Oeste
  { minX: 93.4, maxX: 94.0, minZ: -32.5, maxZ: -25.5 }, // Parede Leste
  { minX: 85.0, maxX: 88.5, minZ: -26.1, maxZ: -25.5 }, // Frente Norte (lado esquerdo)
  { minX: 90.7, maxX: 94.0, minZ: -26.1, maxZ: -25.5 }, // Frente Norte (lado direito)
  // Mobília e suprimentos internos do bunker
  { minX: 88.8, maxX: 90.6, minZ: -29.5, maxZ: -28.2 }, // Mesa tática de planejamento
  { minX: 85.6, maxX: 87.0, minZ: -31.5, maxZ: -28.0 }, // Beliches militares
  { minX: 92.4, maxX: 93.4, minZ: -31.5, maxZ: -28.5 }, // Armários de aço e caixas
  // Blindado APC Queimado
  { minX: 77.5, maxX: 82.5, minZ: -26.0, maxZ: -22.8 },
  // Pilhas de caixas de munição militar
  { minX: 94.2, maxX: 97.0, minZ: -27.5, maxZ: -24.5 },
];

/** Todos os colisores estáticos do mapa (casinha inicial + loja + casa abandonada + barricadas + ferro velho + ônibus + checkpoint + setores norte/sul expandidos). */
export const HOUSE_COLLIDERS: ReadonlyArray<BoxCollider> = [
  ...START_CABIN_COLLIDERS,
  ...SHOP_COLLIDERS,
  ...HOUSE_STRUCTURE_COLLIDERS,
  ...SIDE_BARRICADE_COLLIDERS,
  ...JUNKYARD_COLLIDERS,
  ...SCHOOL_BUS_COLLIDERS,
  ...CHECKPOINT_COLLIDERS,
  ...EXPANDED_NORTH_COLLIDERS,
  ...EXPANDED_SOUTH_COLLIDERS,
];

// ─── Relógio do Jogo Acelerado e Hordas Oficiais ──────────────────────────
/** Segundos de tempo real correspondentes a 1 hora no relógio acelerado do jogo. */
export const REAL_SECONDS_PER_IN_GAME_HOUR = 15.0;

/** Momento de disparo da 1ª Horda Oficial (180s reais: 3 minutos de tempo inicial para leitura e preparação). */
export const HORDE_1_TRIGGER_REAL_SECONDS = 180.0;

/**
 * Segundos reais entre o jogador abrir a porta da casinha inicial e o início da 1ª Horda.
 * O relógio das hordas fica congelado até a porta ser aberta pela primeira vez.
 */
export const HORDE_1_DELAY_AFTER_CABIN_DOOR_SECONDS = 60.0;

/** ID da porta da casinha inicial cuja abertura dispara o relógio das hordas. */
export const START_CABIN_DOOR_ID = "door_cabin";

/** Momento de disparo da 2ª Horda Oficial (250s reais: 55s combate H1 + 15s pausa). */
export const HORDE_2_TRIGGER_REAL_SECONDS = 250.0;

/** Momento de disparo da 3ª Horda Oficial (320s reais: 55s combate H2 + 15s pausa). */
export const HORDE_3_TRIGGER_REAL_SECONDS = 320.0;

/** Momento de disparo da 4ª Horda Oficial (390s reais: 55s combate H3 + 15s pausa). */
export const HORDE_4_TRIGGER_REAL_SECONDS = 390.0;

/** Momento de disparo da 5ª Horda Oficial (460s reais: 55s combate H4 + 15s pausa / Monstro do Pântano). */
export const HORDE_5_TRIGGER_REAL_SECONDS = 460.0;

/** Momento de disparo da 6ª Horda Oficial (530s reais: 55s combate H5 + 15s pausa). */
export const HORDE_6_TRIGGER_REAL_SECONDS = 530.0;

/** Momento de disparo da 7ª Horda Oficial (600s reais: 55s combate H6 + 15s pausa). */
export const HORDE_7_TRIGGER_REAL_SECONDS = 600.0;

/** Momento de disparo da 8ª Horda Oficial (670s reais: 55s combate H7 + 15s pausa / Rainha Aracnídea). */
export const HORDE_8_TRIGGER_REAL_SECONDS = 670.0;

/** Momento de disparo da 9ª Horda Oficial (740s reais: 55s combate H8 + 15s pausa). */
export const HORDE_9_TRIGGER_REAL_SECONDS = 740.0;

/** Momento de disparo da 10ª Horda Oficial (810s reais: 55s combate H9 + 15s pausa / Lobisomem Alfa). */
export const HORDE_10_TRIGGER_REAL_SECONDS = 810.0;

/** Momento de disparo da 11ª Horda Oficial (880s reais: 55s combate H10 + 15s pausa). */
export const HORDE_11_TRIGGER_REAL_SECONDS = 880.0;

/** Momento de disparo da 12ª Horda Oficial (950s reais: 55s combate H11 + 15s pausa). */
export const HORDE_12_TRIGGER_REAL_SECONDS = 950.0;

/** Momento de disparo da 13ª Horda Oficial (1020s reais: 55s combate H12 + 15s pausa / O Homem do Saco). */
export const HORDE_13_TRIGGER_REAL_SECONDS = 1020.0;


/**
 * Converte os segundos reais de partida no formato de relógio de jogo acelerado (HH:MM).
 * 1 hora in-game = 15 segundos reais.
 */
export const formatInGameClock = (
  realSeconds: number,
): { hours: number; minutes: number; formatted: string; totalInGameHours: number } => {
  const safeSeconds = Math.max(0, realSeconds);
  const totalInGameHours = safeSeconds / REAL_SECONDS_PER_IN_GAME_HOUR;
  const hours = Math.floor(totalInGameHours) % 24;
  const minutes = Math.floor((totalInGameHours % 1) * 60);
  const hh = hours.toString().padStart(2, "0");
  const mm = minutes.toString().padStart(2, "0");
  return {
    hours,
    minutes,
    formatted: `${hh}:${mm}`,
    totalInGameHours,
  };
};

/**
 * Retorna o status e texto do badge da HUD para a progressão oficial das hordas.
 * Cada horda dura ~55 segundos de combate ativo intenso com ondas contínuas,
 * intercalada por ~15 segundos de pausa rápida para estocar munição e curativo na fogueira.
 */
export const getHordeStatus = (
  realSeconds: number,
  currentHorde: number,
): { targetHorde: number; isActive: boolean; badgeText: string } => {
  if (currentHorde === 0) {
    // Relógio ainda congelado: ninguém abriu a porta da casinha inicial
    if (realSeconds < HORDE_1_TRIGGER_REAL_SECONDS - HORDE_1_DELAY_AFTER_CABIN_DOOR_SECONDS) {
      return {
        targetHorde: 1,
        isActive: false,
        badgeText: "OPEN THE DOOR TO BEGIN",
      };
    }
    const remaining = Math.max(0, Math.ceil(HORDE_1_TRIGGER_REAL_SECONDS - realSeconds));
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    const timeFormatted = `${mins}:${secs.toString().padStart(2, "0")}`;
    return {
      targetHorde: 1,
      isActive: false,
      badgeText: `HORDE 1 IN ${timeFormatted}`,
    };
  }

  // Definição dos ciclos das hordas: [start, endCombat, nextStart, bossNotice]
  const HORDE_SCHEDULE: {
    horde: number;
    start: number;
    endCombat: number;
    nextStart: number;
    climaxText: string;
    bossText?: string;
  }[] = [
    { horde: 1, start: HORDE_1_TRIGGER_REAL_SECONDS, endCombat: 235.0, nextStart: HORDE_2_TRIGGER_REAL_SECONDS, climaxText: "HORDE 1: FINAL WAVE!" },
    { horde: 2, start: HORDE_2_TRIGGER_REAL_SECONDS, endCombat: 305.0, nextStart: HORDE_3_TRIGGER_REAL_SECONDS, climaxText: "HORDE 2: BRUTE DETECTED!" },
    { horde: 3, start: HORDE_3_TRIGGER_REAL_SECONDS, endCombat: 375.0, nextStart: HORDE_4_TRIGGER_REAL_SECONDS, climaxText: "☠ THE SWAMP MONSTER HAS AWAKENED!", bossText: "☠ THE SWAMP MONSTER HAS AWAKENED!" },
    { horde: 4, start: HORDE_4_TRIGGER_REAL_SECONDS, endCombat: 445.0, nextStart: HORDE_5_TRIGGER_REAL_SECONDS, climaxText: "HORDE 4: BLOODY CLIMAX!" },
    { horde: 5, start: HORDE_5_TRIGGER_REAL_SECONDS, endCombat: 515.0, nextStart: HORDE_6_TRIGGER_REAL_SECONDS, climaxText: "HORDE 5: BIOHAZARD CLIMAX!" },
    { horde: 6, start: HORDE_6_TRIGGER_REAL_SECONDS, endCombat: 585.0, nextStart: HORDE_7_TRIGGER_REAL_SECONDS, climaxText: "🕷️ THE SPIDER QUEEN HAS AWAKENED!", bossText: "🕷️ THE SPIDER QUEEN HAS AWAKENED!" },
    { horde: 7, start: HORDE_7_TRIGGER_REAL_SECONDS, endCombat: 655.0, nextStart: HORDE_8_TRIGGER_REAL_SECONDS, climaxText: "HORDE 7: TOXIC TEMPEST!" },
    { horde: 8, start: HORDE_8_TRIGGER_REAL_SECONDS, endCombat: 725.0, nextStart: HORDE_9_TRIGGER_REAL_SECONDS, climaxText: "HORDE 8: ARMORED BREACH!" },
    { horde: 9, start: HORDE_9_TRIGGER_REAL_SECONDS, endCombat: 795.0, nextStart: HORDE_10_TRIGGER_REAL_SECONDS, climaxText: "🌕 THE WEREWOLF HAS AWAKENED!", bossText: "🌕 THE WEREWOLF HAS AWAKENED!" },
    { horde: 10, start: HORDE_10_TRIGGER_REAL_SECONDS, endCombat: 865.0, nextStart: HORDE_11_TRIGGER_REAL_SECONDS, climaxText: "HORDE 10: DEEP FRENZY!" },
    { horde: 11, start: HORDE_11_TRIGGER_REAL_SECONDS, endCombat: 935.0, nextStart: HORDE_12_TRIGGER_REAL_SECONDS, climaxText: "HORDE 11: DARK ABYSS!" },
    { horde: 12, start: HORDE_12_TRIGGER_REAL_SECONDS, endCombat: 1005.0, nextStart: HORDE_13_TRIGGER_REAL_SECONDS, climaxText: "☠ THE SACK MAN HAS ARRIVED!", bossText: "☠ THE SACK MAN HAS ARRIVED!" },
    { horde: 13, start: HORDE_13_TRIGGER_REAL_SECONDS, endCombat: 1085.0, nextStart: 9999.0, climaxText: "HORDE 13: SUPREME HORROR!" },
  ];

  const sched = HORDE_SCHEDULE.find((h) => h.horde === currentHorde);
  if (!sched) {
    return {
      targetHorde: currentHorde,
      isActive: true,
      badgeText: "APOCALYPTIC SURVIVAL!",
    };
  }

  // Horda em combate ativo (dura ~55 segundos)
  if (realSeconds < sched.endCombat) {
    const elapsed = realSeconds - sched.start;
    if (sched.bossText) {
      return {
        targetHorde: currentHorde,
        isActive: true,
        badgeText: sched.bossText,
      };
    }
    if (elapsed >= 42.0) {
      return {
        targetHorde: currentHorde,
        isActive: true,
        badgeText: sched.climaxText,
      };
    }
    if (elapsed >= 24.0) {
      return {
        targetHorde: currentHorde,
        isActive: true,
        badgeText: `HORDE ${currentHorde}: HEAVY REINFORCEMENTS!`,
      };
    }
    return {
      targetHorde: currentHorde,
      isActive: true,
      badgeText: `HORDE ${currentHorde} ACTIVE!`,
    };
  }

  // Intervalo de trégua rápida (apenas ~15 segundos de pausa entre as hordas)
  const remaining = Math.max(0, Math.ceil(sched.nextStart - realSeconds));
  return {
    targetHorde: currentHorde + 1,
    isActive: false,
    badgeText: `HORDE ${currentHorde + 1} IN ${remaining}S`,
  };
};

// ─── Portas Interativas com Física ──────────────────────────────────────────
export interface DoorDefinition {
  id: string;
  name: string;
  shortName: string;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  interactionRadius: number;
  initialOpen?: boolean;
  collider: BoxCollider;
}

export const DOOR_DEFINITIONS: ReadonlyArray<DoorDefinition> = [
  {
    id: "door_cabin",
    name: "Cabin Door",
    shortName: "Starter Cabin",
    x: -21.95,
    y: 0,
    z: 0,
    width: 2.1,
    height: 2.1,
    interactionRadius: 2.8,
    initialOpen: false,
    collider: {
      minX: -22.25,
      maxX: -21.65,
      minZ: -1.06,
      maxZ: 1.06,
      minY: 0,
      maxY: 2.3,
    },
  },
  {
    id: "door_house",
    name: "House Door",
    shortName: "Abandoned House",
    x: 20.0,
    y: HOUSE_FLOOR_Y,
    z: 0,
    width: 2.6,
    height: 2.3,
    interactionRadius: 2.8,
    initialOpen: false,
    collider: {
      minX: 19.65,
      maxX: 20.35,
      minZ: -1.35,
      maxZ: 1.35,
      minY: 1.8,
      maxY: 4.8,
    },
  },
];

// ─── Tiers de Armas e Facas da Loja (Progressão Visual e de Atributos) ────────
export interface GunTier {
  level: number;
  name: string;
  shortName: string;
  description: string;
  damage: number;
  maxAmmo: number;
  fireCooldown: number;
  upgradeCost: number; // custo para subir PARA este nível (nível 1 é 0)
}

export interface KnifeTier {
  level: number;
  name: string;
  shortName: string;
  description: string;
  damage: number;
  range: number;
  cooldown: number;
  upgradeCost: number; // custo para subir PARA este nível (nível 1 é 0)
}

export const MAX_GUN_LEVEL = 7;
export const MAX_KNIFE_LEVEL = 7;

export const AMMO_BUY_COST = 1;

/**
 * Retorna o preço da munição (+1 pente de reserva) na loja.
 * O preço da munição é sempre fixo em 1 moeda.
 */
export function getAmmoCost(_gunLevel?: number): number {
  return AMMO_BUY_COST;
}

export const GUN_TIERS: ReadonlyArray<GunTier> = [
  {
    level: 1,
    name: "Basic Pistol",
    shortName: "Pistol",
    description: "Compact 9mm pistol",
    damage: 1,
    maxAmmo: 12,
    fireCooldown: 0.44,
    upgradeCost: 0,
  },
  {
    level: 2,
    name: "Tactical Pistol",
    shortName: "Tactical Pistol",
    description: "Extended barrel and compensator",
    damage: 1,
    maxAmmo: 15,
    fireCooldown: 0.32,
    upgradeCost: 5,
  },
  {
    level: 3,
    name: "Desert Eagle",
    shortName: "Desert Eagle",
    description: "Heavy high-impact magnum pistol",
    damage: 2,
    maxAmmo: 10,
    fireCooldown: 0.38,
    upgradeCost: 8,
  },
  {
    level: 4,
    name: "Mini Uzi",
    shortName: "Mini Uzi",
    description: "Rapid compact submachine gun",
    damage: 2,
    maxAmmo: 20,
    fireCooldown: 0.15,
    upgradeCost: 12,
  },
  {
    level: 5,
    name: "Tactical SMG",
    shortName: "Tactical SMG",
    description: "Extreme fire rate and curved mag",
    damage: 2,
    maxAmmo: 26,
    fireCooldown: 0.10,
    upgradeCost: 17,
  },
  {
    level: 6,
    name: "Carbine Rifle",
    shortName: "Carbine Rifle",
    description: "High-power assault rifle",
    damage: 3,
    maxAmmo: 30,
    fireCooldown: 0.11,
    upgradeCost: 23,
  },
  {
    level: 7,
    name: "Advanced Tactical Rifle",
    shortName: "Advanced Rifle",
    description: "Rifle with holographic sight & suppressor",
    damage: 4,
    maxAmmo: 36,
    fireCooldown: 0.08,
    upgradeCost: 30,
  },
];

export const KNIFE_TIERS: ReadonlyArray<KnifeTier> = [
  {
    level: 1,
    name: "Tactical Pocket Knife",
    shortName: "Pocket Knife",
    description: "Short survival blade",
    damage: 1,
    range: 1.6,
    cooldown: 0.35,
    upgradeCost: 0,
  },
  {
    level: 2,
    name: "Military Bowie Knife",
    shortName: "Bowie Knife",
    description: "Heavy blade with serrated spine",
    damage: 2,
    range: 1.75,
    cooldown: 0.30,
    upgradeCost: 4,
  },
  {
    level: 3,
    name: "Karambit Dagger",
    shortName: "Karambit",
    description: "Ultra-fast curved claw blade",
    damage: 2,
    range: 1.85,
    cooldown: 0.25,
    upgradeCost: 7,
  },
  {
    level: 4,
    name: "Tactical Machete",
    shortName: "Machete",
    description: "Long solid steel blade",
    damage: 3,
    range: 2.0,
    cooldown: 0.22,
    upgradeCost: 11,
  },
  {
    level: 5,
    name: "Survival Katana",
    shortName: "Katana",
    description: "High-precision oriental blade",
    damage: 4,
    range: 2.2,
    cooldown: 0.20,
    upgradeCost: 16,
  },
  {
    level: 6,
    name: "Plasma Blade",
    shortName: "Plasma Knife",
    description: "Superheated cyan energy blade",
    damage: 5,
    range: 2.35,
    cooldown: 0.17,
    upgradeCost: 22,
  },
  {
    level: 7,
    name: "Apocalyptic Hyper-Blade",
    shortName: "Hyper-Blade",
    description: "Colossal titanium & radiant energy glaive",
    damage: 6,
    range: 2.5,
    cooldown: 0.15,
    upgradeCost: 29,
  },
];

// ─── C4 Explosivo Tático com Distração ─────────────────────────────────────
/** Tempo em segundos da contagem regressiva da C4 até a detonação (5 segundos). */
export const C4_COUNTDOWN_SECONDS = 5.0;

/** Raio em metros em que a C4 atrai a atenção dos zumbis enquanto faz a contagem regressiva (tirando o foco do jogador). */
export const C4_DISTRACTION_RADIUS = 28.0;

/** Raio em metros da explosão destrutiva da C4 ao detonar. */
export const C4_EXPLOSION_RADIUS = 6.2;

/** Dano devastador em área causado pela explosão da C4 (elimina instantaneamente zumbis na área). */
export const C4_EXPLOSION_DAMAGE = 25;

/** Custo de compra da C4 na loja por unidade (em moedas). */
export const C4_BUY_COST = 3;

/** Quantidade máxima de C4s que o jogador pode carregar no inventário. */
export const C4_MAX_CARRY = 3;

/** Cooldown em segundos após plantar uma C4. */
export const C4_PLANT_COOLDOWN = 0.8;

// ─── Desfibrilador (Dispositivo de Reanimação Cooperativa) ────────────────────
/** Custo de compra do Desfibrilador na loja (em moedas). Ocupa o Slot 3. */
export const DEFIBRILLATOR_BUY_COST = 30;

/** Alcance máximo em metros para alcançar e reviver um amigo caído. */
export const DEFIBRILLATOR_REVIVE_RADIUS = 3.2;

// ─── Armadura (Colete Balístico) ─────────────────────────────────────────────
/** Pontos máximos de armadura no nível 1 (inicial). */
export const ARMOR_BASE_MAX = 4;
/** Pontos de armadura ganhos a cada upgrade de nível. */
export const ARMOR_POINTS_PER_LEVEL = 2;
/** Nível máximo da armadura (4 ➔ 6 ➔ 8 ➔ 10 ➔ 12 ➔ 14 Pts). */
export const MAX_ARMOR_LEVEL = 6;

/** Custo para subir PARA cada nível da armadura (índice = nível; níveis 0 e 1 não são comprados). */
export const ARMOR_UPGRADE_COSTS: readonly number[] = [0, 0, 20, 40, 80, 160, 320];

/** Custo para regenerar totalmente os pontos de armadura em cada nível (índice = nível). */
export const ARMOR_REPAIR_COSTS: readonly number[] = [0, 5, 10, 20, 30, 40, 50];

/** Converte os pontos máximos de armadura no nível atual (1..MAX_ARMOR_LEVEL). */
export const getArmorLevel = (maxArmor: number): number =>
  Math.max(
    1,
    Math.min(
      MAX_ARMOR_LEVEL,
      Math.round(((maxArmor || ARMOR_BASE_MAX) - ARMOR_BASE_MAX) / ARMOR_POINTS_PER_LEVEL) + 1,
    ),
  );

/** Pontos máximos de armadura de um determinado nível. */
export const getArmorMaxForLevel = (level: number): number =>
  ARMOR_BASE_MAX + (Math.max(1, Math.min(MAX_ARMOR_LEVEL, level)) - 1) * ARMOR_POINTS_PER_LEVEL;

/** Custo do próximo upgrade de armadura (ou null se já estiver no nível máximo). */
export const getArmorUpgradeCost = (maxArmor: number): number | null => {
  const level = getArmorLevel(maxArmor);
  if (level >= MAX_ARMOR_LEVEL) return null;
  return ARMOR_UPGRADE_COSTS[level + 1] ?? null;
};

/** Custo para regenerar a armadura no nível atual. */
export const getArmorRepairCost = (maxArmor: number): number =>
  ARMOR_REPAIR_COSTS[getArmorLevel(maxArmor)] ?? 5;

