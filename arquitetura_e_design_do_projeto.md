# 🧟‍♂️ Dark Beans: Zombie Horde — Documento de Arquitetura e Design Técnico

Bem-vindo à documentação oficial de arquitetura do projeto **Dark Beans: Zombie Horde** (título provisório). Este documento registra todas as decisões técnicas, estruturais e de design tomadas na fase de concepção do jogo. Ele servirá como nosso "norte" durante todo o desenvolvimento.

---

## 1. Visão Geral do Projeto

*   **Gênero:** Co-op Horde Survival / Top-Down (Angled) Shooter.
*   **Plataforma:** Navegador Web (Desktop prioritariamente, acesso instantâneo via link).
*   **Estética ("Dark Fall Guys"):** Personagens não realistas, em formato de cápsula/"feijão", com proporções cartunescas e animações desengonçadas, inseridos em um ambiente sombrio, com neblina densa, iluminação dramática (lanternas, tiros, olhos brilhantes) e temática de apocalipse zumbi.
*   **Core Loop Inicial:**
    1.  Um jogador acessa o site, cria uma sala automaticamente e compartilha o link (`?room=CODIGO`) com amigos.
    2.  Os jogadores nascem em uma arena escura.
    3.  Zumbis surgem das bordas (escondidos pela neblina) em rodadas (*waves*).
    4.  A cada rodada vencida, a quantidade e a dificuldade dos zumbis aumentam.

---

## 2. Decisões de Gameplay e Mecânicas Base

### 2.1. Câmera e Mira (Estilo *Brawl Stars* / *Helldivers*)
Optamos pela **Câmera em Terceira Pessoa Angulada (Top-Down/Isométrica em Perspectiva)** em vez da câmera tradicional sobre o ombro (*Over-the-Shoulder*).

*   **Por que essa escolha?**
    *   **Consciência Espacial:** Em um jogo de horda com física caótica, ver os arredores (360 graus ao redor do personagem) evita mortes frustrantes por zumbis que atacam pelas costas sem aviso.
    *   **Zero Fricção no Navegador:** Não exige o uso de `PointerLock API` (que trava o mouse e esconde o cursor, algo que muitos jogadores casuais no navegador estranham ao clicar em um link).
*   **Como funciona tecnicamente?**
    1.  A câmera fica posicionada acima e levemente atrás do jogador (ex: `offset Y = +14, Z = +10`), olhando sempre para a posição do personagem.
    2.  No cliente, capturamos a posição `(X, Y)` do mouse na tela e disparamos um raio invisível (**Raycasting**) contra um plano matemático horizontal (`Plane(Y = 0)`) que representa o chão.
    3.  O ponto de interseção no chão define para onde o personagem deve olhar. Calculamos o ângulo com `Math.atan2(dx, dz)` e enviamos apenas esse ângulo (`aimAngle`) para o servidor.

### 2.2. Física e Movimentação Incremental
Em vez de iniciar com um motor de física 3D pesado e complexo (como *Rapier3D* ou *Ammo.js*) desde o primeiro dia, decidimos adotar uma **Abordagem Incremental**:

*   **Fase 1 (MVP Atual): Movimentação Matemática e Colisão Circular (2D no plano XZ):**
    *   Embora os gráficos sejam 3D, a lógica de movimentação inicial acontece nos eixos `X` e `Z`.
    *   Cada jogador, zumbi e obstáculo é tratado matematicamente como um círculo com posição `(x, z)` e um `raio`.
    *   **Vantagem:** Extremamente leve para o servidor processar dezenas de zumbis simultâneos, fácil de depurar e garante sincronização perfeita na rede.
    *   A sensação de "Fall Guys" no início será dada visualmente no cliente (animação procedural de inclinação/bamboleio da cápsula ao andar e efeito de *knockback*/empurrão matemático ao levar dano ou atirar).
*   **Fase 2 (Evolução Futura):**
    *   Introdução de impulsos vetoriais (explosões que jogam os bonecos para o alto, tropeços e *ragdoll* visual no cliente quando um zumbi morre).

---

## 3. Stack Tecnológica (Web-Native)

Escolhemos uma stack **100% TypeScript Web-Native** em vez de Engines pesadas exportadas para WebAssembly (como Unity/Godot). Isso garante que o jogo carregue em menos de 2 segundos ao clicar no link e nos dá controle total sobre o código.

### 3.1. Frontend (`packages/client`)
*   **Bundler:** **Vite** — Inicialização instantânea e *Hot Module Replacement (HMR)* rápido.
*   **Renderização 3D:** **Three.js** — Responsável pelo grafo de cena, malhas 3D, luzes dinâmicas, sombras e neblina exponencial (`THREE.FogExp2`).
*   **Interface (UI/HUD):** **HTML5 + CSS3 Overlay** — Barras de vida, contador de rodadas, munição e botão de copiar link da sala são feitos em HTML sobreposto ao `<canvas>` 3D. É mais rápido de estilizar, responsivo e não consome processamento da placa de vídeo (WebGL).

### 3.2. Backend (`packages/server`)
*   **Runtime:** **Node.js** com TypeScript (`tsx` para execução rápida em desenvolvimento).
*   **Framework Multiplayer:** **Colyseus** — Framework especializado em jogos multiplayer em tempo real para Node.js.
    *   **Gerenciamento de Salas:** Cria e destrói salas sob demanda facilmente.
    *   **Sincronização de Estado (`@colyseus/schema`):** Serializa apenas o que mudou (*Delta Compression*) em formato binário compacto via WebSockets. Se apenas a posição `X` de um zumbi mudou, ele envia apenas esses poucos bytes, economizando banda.

### 3.3. Pacote Compartilhado (`packages/shared`)
*   Código TypeScript puro importado tanto pelo `client` quanto pelo `server`.
*   Guarda constantes vitais (velocidade do jogador, tamanho da arena, *tick rate*), interfaces de mensagens de rede e funções matemáticas utilitárias. Isso evita que o cliente e o servidor discordem sobre as regras do jogo.

---

## 4. Arquitetura de Rede (Modelo Servidor Autoritativo)

Em um jogo cooperativo de hordas, **o servidor é a única fonte da verdade (Autoritativo)**. Se deixássemos os clientes calcularem onde os zumbis estão, qualquer diferença de FPS ou latência faria um zumbi estar vivo na tela do Jogador A e morto na tela do Jogador B.

```text
+-------------------+         1. Inputs (WASD, Mira, Tiro)        +-----------------------+
|                   | ------------------------------------------> |                       |
|   CLIENTE (Web)   |                                             | SERVIDOR (Colyseus)   |
|  Three.js (60fps) | <------------------------------------------ | Simulation Loop (20Hz)|
|                   |    2. Estado Binário (Posições, HP, Wave)   |                       |
+-------------------+                                             +-----------------------+
```

### 4.1. O Ciclo de Vida da Sincronização
1.  **Captura de Input (Cliente):** A cada *frame* (ou mudança de tecla), o cliente lê o teclado (`WASD`), calcula o ângulo do mouse no chão e envia um pacote leve ao servidor: `{ dx, dz, aimAngle, shooting }`.
2.  **Simulação Falsa / Game Loop (Servidor):** O servidor roda um loop fixo (ex: 20 ou 30 vezes por segundo — *Tick Rate*). A cada *tick*, ele:
    *   Move os jogadores com base nos inputs recebidos.
    *   Move os zumbis em direção ao jogador vivo mais próximo.
    *   Move os projéteis e checa colisões (Bala -> Zumbi, Zumbi -> Jogador, Entidade -> Entidade).
    *   Verifica se todos os zumbis da rodada morreram para iniciar a próxima *Wave*.
3.  **Interpolação Visual (Cliente):** Como o servidor atualiza as posições 20 vezes por segundo, mas o monitor do jogador roda a 60Hz ou 144Hz, o cliente usa **Interpolação Linear (`lerp`)**. Ele desliza suavemente o modelo 3D da posição antiga até a nova posição recebida do servidor, garantindo movimento fluido sem engasgos.

---

## 5. Arquitetura Modular de Pastas (Monorepo)

Adotamos uma estrutura de **Monorepo com NPM Workspaces**. Cada responsabilidade do jogo é isolada em módulos específicos (Padrão *Systems & Views*), evitando arquivos gigantescos e facilitando futuras expansões.

```text
dark-beans-zombies/
├── package.json                  # Configuração dos Workspaces e scripts unificados
├── tsconfig.base.json            # Regras rigorosas de TypeScript compartilhadas
│
└── packages/
    ├── shared/                   # 📦 MÓDULO COMPARTILHADO
    │   ├── package.json
    │   └── src/
    │       ├── constants.ts      # Ex: PLAYER_SPEED, ARENA_SIZE, TICK_RATE
    │       ├── types.ts          # Interfaces de Input e Eventos de Rede
    │       └── index.ts          # Exportador público do pacote
    │
    ├── server/                   # 🖥️ MÓDULO DO SERVIDOR (Autoritativo)
    │   ├── package.json
    │   └── src/
    │       ├── index.ts          # Inicializa o servidor Express + Colyseus (Porta 2567)
    │       ├── rooms/
    │       │   └── ArenaRoom.ts  # Gerencia conexões, desconexões e chama os Systems no Game Loop
    │       ├── schemas/          # Estruturas de dados sincronizadas automaticamente na rede
    │       │   ├── PlayerSchema.ts
    │       │   ├── ZombieSchema.ts
    │       │   ├── BulletSchema.ts
    │       │   └── ArenaState.ts
    │       └── systems/          # Lógica de negócio pura (desacoplada da rede)
    │           ├── MovementSystem.ts  # Aplica velocidade e limites de arena
    │           ├── CombatSystem.ts    # Disparo de projéteis, colisão e dano
    │           └── WaveSystem.ts      # Spawner de zumbis, IA de perseguição e progressão de rounds
    │
    └── client/                   # 🎮 MÓDULO DO CLIENTE (Visual e Input)
        ├── package.json
        ├── index.html            # Canvas 3D + HUD (HTML/CSS)
        └── src/
            ├── main.ts           # Ponto de entrada que une Rede, Cena e Loop de Render
            ├── core/
            │   ├── SceneManager.ts     # Luzes sombrias, Neblina, Chão e Renderizador Three.js
            │   ├── CameraController.ts # Câmera angulada estilo Brawl Stars seguindo o jogador
            │   └── InputManager.ts     # Teclado (WASD) + Raycasting do Mouse no chão
            ├── network/
            │   └── NetworkManager.ts   # Conecta ao Colyseus, lê URL (?room=) e escuta mudanças de estado
            └── entities/               # Representações visuais 3D das entidades do servidor
                ├── PlayerView.ts       # Malha da "cápsula", olhinhos, lanterna, arma e interpolação
                ├── ZombieView.ts       # Malha do zumbi feijão, animação de andar e feedback de dano
                └── BulletView.ts       # Rastro luminoso do tiro no escuro
```

### Por que essa divisão é importante?
*   **Desacoplamento Visual vs. Lógico:** O servidor não sabe o que é uma cor, uma luz ou uma malha 3D. Ele só conhece números (`x`, `z`, `rotation`, `hp`). Da mesma forma, o `PlayerView.ts` no cliente não decide se o jogador pode atravessar uma parede; ele apenas desenha o boneco onde o servidor mandou e anima os passos.
*   **Fácil Evolução:** Quando quisermos adicionar diferentes tipos de armas (Escopeta, Metralhadora, Lança-chamas) ou diferentes tipos de zumbis (Zumbi Corredor, Zumbi Tanque Gigante), basta adicionar os atributos no `shared` e criar um comportamento novo no `CombatSystem` ou `WaveSystem`, sem precisar reescrever o sistema de câmeras ou de conexão.

---

## 6. Diretrizes de Direção de Arte ("Sombrio, mas Cartunesco")

Para alcançar o visual desejado usando formas geométricas otimizadas no início:

1.  **Iluminação como Gameplay:**
    *   A luz ambiente (`AmbientLight`) será baixa e fria (azul noturno/roxo escuro).
    *   Cada jogador terá uma lanterna cônica (`SpotLight`) acoplada à direção da mira. Olhar para um canto escuro com o mouse ilumina literalmente aquela área para você e para seus amigos!
2.  **Neblina Densa (`FogExp2`):**
    *   Esconde o fim do mapa e faz com que os zumbis surjam gradualmente da escuridão (primeiro você vê a silhueta e os olhos brilhantes deles entrando no facho da lanterna).
3.  **Animação Procedural Simples (Sem Esqueleto Pesado):**
    *   O personagem é uma `CapsuleGeometry` com olhos (`SphereGeometry`) e mãos flutuantes segurando a arma.
    *   Ao se mover, aplicamos uma função seno (`Math.sin(tempo)`) na altura (`Y`) e na inclinação lateral (`rotation.z`) do corpo, criando aquele andar saltitante e desengonçado característico do *Fall Guys*.

---

## 7. Roteiro de Implementação (Roadmap em 4 Marcos)

*   [ ] **Marco 1: Fundação e Cena Sombria**
    *   Configurar o Monorepo (`shared`, `server`, `client`).
    *   Criar a arena escura no Three.js com câmera angulada e testar a conexão básica cliente-servidor no Colyseus.
*   [ ] **Marco 2: O "Feijão" Multiplayer, Mira e Salas por Link**
    *   Criar o visual do personagem com lanterna.
    *   Implementar a mira com *Raycasting* no chão e movimentação `WASD` com interpolação.
    *   Sincronizar salas via parâmetro de URL (`?room=xxxx`).
*   [ ] **Marco 3: Combate e Projéteis**
    *   Disparos sincronizados, rastro de luz das balas no escuro e recuo visual.
*   [ ] **Marco 4: Hordas de Zumbis e Loop de Rodadas**
    *   IA de perseguição no servidor, sistema de *Waves* progressivas, dano, barra de vida e tela de fim de jogo/reinício.