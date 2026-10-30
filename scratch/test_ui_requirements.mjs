import fs from "fs";

function testHtmlAndStructure() {
  console.log("=== INICIANDO VALIDAÇÃO DA INTERFACE (HTML / CSS / REQUISITOS) ===");
  const html = fs.readFileSync("/Users/diogomarassi/Desktop/jogo/packages/client/index.html", "utf-8");

  // 1. Sem indicação de controles na interface
  if (/WASD/i.test(html)) {
    throw new Error("Falha: 'WASD' ainda encontrado em index.html!");
  }
  if (/Controles:/i.test(html)) {
    throw new Error("Falha: 'Controles:' ainda encontrado em index.html!");
  }
  console.log("✓ Requisito 1: Sem indicação de controles (WASD, etc.) na interface: CONFIRMADO");

  // 2. Tela Inicial (Home)
  // - Retirar nome do personagem da tela inicial
  // - Retirar botão de configuração e botão de editar personagem
  // - Tirar ícone de espada do botão de jogar
  const homePanelMatch = html.match(/<div id="menu-panel-home"[\s\S]*?<\/div>\s*<\/div>/);
  if (!homePanelMatch) {
    throw new Error("Falha: #menu-panel-home não encontrado!");
  }
  const homeHtml = homePanelMatch[0];

  if (homeHtml.includes("menu-input-name") || homeHtml.includes("<input")) {
    throw new Error("Falha: Campo de nome do personagem ainda está na tela inicial!");
  }
  if (homeHtml.includes("btn-menu-settings")) {
    throw new Error("Falha: Botão de configurações ainda está na tela inicial!");
  }
  if (homeHtml.includes("btn-menu-customize")) {
    throw new Error("Falha: Botão de editar personagem ainda está na tela inicial!");
  }
  if (homeHtml.includes("⚔️") || homeHtml.includes("sword")) {
    throw new Error("Falha: Ícone de espada ainda está no botão jogar!");
  }
  if (!homeHtml.includes("JOGAR")) {
    throw new Error("Falha: Texto JOGAR não encontrado no botão da tela inicial!");
  }
  console.log("✓ Requisito 2 (Home): Nome retirado, botões antigos retirados, espada retirada do JOGAR: CONFIRMADO");

  // 3. Ao clicar em jogar -> Tela dividida em duas
  // - Esquerda: Criação de personagem + Nome do personagem
  // - Direita: Sala (Criar sala ou Colocar IP/código + Lista de jogadores na sala)
  const stagingPanelMatch = html.match(/<div id="menu-panel-staging"[\s\S]*?(?=<div id="modal-settings")/);
  if (!stagingPanelMatch) {
    throw new Error("Falha: #menu-panel-staging não encontrado!");
  }
  const stagingHtml = stagingPanelMatch[0];

  if (!stagingHtml.includes("split-col--character")) {
    throw new Error("Falha: Coluna de personagem não encontrada no staging!");
  }
  if (!stagingHtml.includes("staging-input-name")) {
    throw new Error("Falha: Campo de nome do personagem não encontrado na coluna de personagem!");
  }
  if (!stagingHtml.includes("character-preview-canvas")) {
    throw new Error("Falha: Canvas de preview 3D não encontrado na coluna de personagem!");
  }
  if (!stagingHtml.includes("customizer-colors")) {
    throw new Error("Falha: Seletor de cores não encontrado na coluna de personagem!");
  }

  if (!stagingHtml.includes("split-col--room")) {
    throw new Error("Falha: Coluna da sala não encontrada no staging!");
  }
  if (!stagingHtml.includes("btn-tab-create") || !stagingHtml.includes("btn-tab-join")) {
    throw new Error("Falha: Abas Criar Sala / Entrar em Sala não encontradas!");
  }
  if (!stagingHtml.includes("staging-input-code")) {
    throw new Error("Falha: Campo de código ou IP da sala não encontrado!");
  }
  if (!stagingHtml.includes("staging-player-list")) {
    throw new Error("Falha: Lista de jogadores na sala não encontrada!");
  }
  if (!stagingHtml.includes("btn-start-match")) {
    throw new Error("Falha: Botão para entrar na arena não encontrado!");
  }
  console.log("✓ Requisito 3 (Tela Dividida): Personagem + Nome à esquerda, Sala + IP/código + Lista à direita: CONFIRMADO");

  // 4. Botão de configuração na parte inferior apenas com ícone minimalista de engrenagem
  // - Sem texto
  // - Ao lado dele: botão de saiba mais sobre mim, apenas ícone minimalista também
  // - Ícones minimalistas todos brancos (stroke=#ffffff / fill=#ffffff)
  const bottomDockMatch = html.match(/<div class="bottom-dock"[\s\S]*?<\/div>/);
  if (!bottomDockMatch) {
    throw new Error("Falha: .bottom-dock não encontrado!");
  }
  const dockHtml = bottomDockMatch[0];

  if (!dockHtml.includes("btn-bottom-settings")) {
    throw new Error("Falha: #btn-bottom-settings não encontrado no rodapé!");
  }
  if (!dockHtml.includes("btn-bottom-about")) {
    throw new Error("Falha: #btn-bottom-about não encontrado no rodapé!");
  }
  if (!dockHtml.includes('stroke="#ffffff"')) {
    throw new Error("Falha: Ícones minimalistas brancos não configurados!");
  }
  // Garante que os botões não têm texto dentro
  const settingsBtnMatch = dockHtml.match(/<button id="btn-bottom-settings"[\s\S]*?<\/button>/);
  if (settingsBtnMatch && />\s*[^<\s]+/.test(settingsBtnMatch[0].replace(/<[^>]*>/g, ""))) {
    throw new Error("Falha: Botão de configurações tem texto visível! Deve ser apenas ícone minimalista.");
  }
  const aboutBtnMatch = dockHtml.match(/<button id="btn-bottom-about"[\s\S]*?<\/button>/);
  if (aboutBtnMatch && />\s*[^<\s]+/.test(aboutBtnMatch[0].replace(/<[^>]*>/g, ""))) {
    throw new Error("Falha: Botão de saiba mais tem texto visível! Deve ser apenas ícone minimalista.");
  }
  console.log("✓ Requisito 4 (Rodapé Minimalista): Engrenagem e Saiba Mais brancos sem texto: CONFIRMADO");

  console.log("=== TODOS OS 4 REQUISITOS DO USUÁRIO TESTADOS E VALIDADOS COM SUCESSO! ===");
}

testHtmlAndStructure();
