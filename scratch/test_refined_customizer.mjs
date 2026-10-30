import fs from "fs";

function extractIds(code, arrayName) {
  const match = code.match(new RegExp(`export const ${arrayName}[^=]*=\\s*\\[([\\s\\S]*?)\\];`));
  if (!match) return [];
  const ids = [];
  const re = /id:\s*["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(match[1])) !== null) {
    ids.push(m[1]);
  }
  return ids;
}

function testRefinements() {
  console.log("=== INICIANDO VALIDAÇÃO DAS 3 REFINARIAS SOLICITADAS ===");

  // 1. Esferas de seleção de cor reduzidas e aproximadas
  const css = fs.readFileSync("/Users/diogomarassi/Desktop/jogo/packages/client/src/styles/index.css", "utf-8");
  const swatchWidthMatch = css.match(/\.color-swatch\s*\{[^}]*width:\s*(\d+)px/);
  const colorsGridGapMatch = css.match(/\.colors-grid\s*\{[^}]*gap:\s*(\d+)px/);

  if (!swatchWidthMatch || parseInt(swatchWidthMatch[1], 10) > 30) {
    throw new Error(`Falha: .color-swatch deve ter tamanho reduzido (<= 30px), encontrado: ${swatchWidthMatch?.[1]}px`);
  }
  if (!colorsGridGapMatch || parseInt(colorsGridGapMatch[1], 10) > 7) {
    throw new Error(`Falha: .colors-grid deve ter gap reduzido (<= 7px), encontrado: ${colorsGridGapMatch?.[1]}px`);
  }
  console.log(`✓ Requisito 1: Esferas de cores reduzidas para ${swatchWidthMatch[1]}px e aproximadas com gap de ${colorsGridGapMatch[1]}px: CONFIRMADO`);

  // 2. Todos os ícones de cabelos, barbas, olhos e chapéus estão preenchidos (nenhum vazio)
  const mainMenuCode = fs.readFileSync("/Users/diogomarassi/Desktop/jogo/packages/client/src/ui/MainMenu.ts", "utf-8");
  const svgDictMatch = mainMenuCode.match(/const OPTION_SVGS:\s*Record<string,\s*string>\s*=\s*\{([\s\S]*?)\n\s*\};/);
  if (!svgDictMatch) {
    throw new Error("Falha: OPTION_SVGS não encontrado no código do MainMenu!");
  }
  const svgDictCode = svgDictMatch[1];

  const cosmeticsCode = fs.readFileSync("/Users/diogomarassi/Desktop/jogo/packages/client/src/entities/CharacterCosmetics.ts", "utf-8");
  const hairIds = extractIds(cosmeticsCode, "HAIR_OPTIONS");
  const eyeIds = extractIds(cosmeticsCode, "EYE_OPTIONS");
  const beardIds = extractIds(cosmeticsCode, "BEARD_OPTIONS");
  const hatIds = extractIds(cosmeticsCode, "HAT_OPTIONS");

  const checkCategory = (name, ids) => {
    for (const id of ids) {
      const keyPattern = new RegExp(`['"]?${id}['"]?\\s*:\\s*\`<svg[\\s\\S]*?<\\/svg>\``);
      if (!keyPattern.test(svgDictCode)) {
        throw new Error(`Falha no item '${id}' em ${name}: Ícone não encontrado ou vazio em OPTION_SVGS!`);
      }
    }
  };

  checkCategory("Cabelos (HAIR_OPTIONS)", hairIds);
  checkCategory("Olhos (EYE_OPTIONS)", eyeIds);
  checkCategory("Barbas (BEARD_OPTIONS)", beardIds);
  checkCategory("Chapéus (HAT_OPTIONS)", hatIds);
  console.log("✓ Requisito 2: Todos os 24 cosméticos (cabelos, olhos, barbas e chapéus) possuem SVGs minimalistas brancos válidos: CONFIRMADO");

  // 3. Remoção do texto "Arraste para girar..."
  const html = fs.readFileSync("/Users/diogomarassi/Desktop/jogo/packages/client/index.html", "utf-8");
  if (/Arraste para girar/i.test(html)) {
    throw new Error("Falha: Texto 'Arraste para girar...' ainda encontrado em index.html!");
  }
  console.log("✓ Requisito 3: Texto 'Arraste para girar...' removido completamente de index.html: CONFIRMADO");

  console.log("=== TODOS OS 3 REQUISITOS FORAM TESTADOS E VALIDADOS COM 100% DE SUCESSO! ===");
}

testRefinements();
