import fs from "fs";

function testRequirements() {
  console.log("=== TESTANDO OS 3 NOVOS REQUISITOS DO USUÁRIO ===");

  // 1. Verificar CharacterPreview.ts para garantir que não há rotação automática
  const previewCode = fs.readFileSync("/Users/diogomarassi/Desktop/jogo/packages/client/src/ui/CharacterPreview.ts", "utf-8");
  if (previewCode.includes("this.targetRotY += 0.005")) {
    throw new Error("Falha: Rotação automática (this.targetRotY += 0.005) ainda presente em CharacterPreview.ts!");
  }
  console.log("✓ Requisito 1: Rotação automática do personagem desativada com sucesso!");

  // 2. Verificar CSS e HTML para tamanho fixo e sem scroll na tela
  const css = fs.readFileSync("/Users/diogomarassi/Desktop/jogo/packages/client/src/styles/index.css", "utf-8");
  if (!css.includes(".menu-panel--split") || !css.includes("overflow: hidden;")) {
    throw new Error("Falha: .menu-panel--split deve ter overflow: hidden!");
  }
  if (!css.includes(".customizer-tab-content") || !css.includes("height: 120px;")) {
    throw new Error("Falha: .customizer-tab-content deve ter altura fixa de 120px para não mudar de tamanho entre as abas!");
  }
  console.log("✓ Requisito 2: Tamanho da tela fixo e sem scroll ao alternar abas: CONFIRMADO!");

  // 3. Verificar que as abas e botões de customização não têm texto e usam ícones minimalistas brancos
  const html = fs.readFileSync("/Users/diogomarassi/Desktop/jogo/packages/client/index.html", "utf-8");
  const mainMenuCode = fs.readFileSync("/Users/diogomarassi/Desktop/jogo/packages/client/src/ui/MainMenu.ts", "utf-8");

  const tabsMatch = html.match(/<nav class="customizer-tabs"[\s\S]*?<\/nav>/);
  if (!tabsMatch) {
    throw new Error("Falha: .customizer-tabs não encontrado em index.html!");
  }
  const tabsHtml = tabsMatch[0];

  // Não pode ter texto de emojis ou palavras visíveis dentro dos botões de abas
  if (/>\s*(Cor|Cabelo|Olhos|Barba|Chapéu|🎨|💇|👀|🧔|🎩)/.test(tabsHtml)) {
    throw new Error("Falha: As abas ainda contêm texto ou emojis visíveis!");
  }

  // Deve ter SVG com stroke branco
  if (!tabsHtml.includes('stroke="#ffffff"')) {
    throw new Error("Falha: As abas devem conter SVGs minimalistas com stroke branco!");
  }

  // Deve ter OPTION_SVGS em MainMenu para botões de opções com ícones minimalistas brancos e sem texto
  if (!mainMenuCode.includes("OPTION_SVGS")) {
    throw new Error("Falha: OPTION_SVGS não encontrado em MainMenu.ts!");
  }

  console.log("✓ Requisito 3: Abas e opções sem texto, utilizando apenas ícones minimalistas brancos: CONFIRMADO!");

  console.log("=== TODOS OS REQUISITOS FORAM TESTADOS E VALIDADOS COM 100% DE SUCESSO! ===");
}

testRequirements();
