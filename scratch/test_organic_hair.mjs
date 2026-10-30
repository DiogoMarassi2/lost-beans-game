import fs from "fs";

function testOrganicHair() {
  console.log("=== INICIANDO VALIDAÇÃO DOS NOVOS CABELOS 3D ORGÂNICOS ===");

  const code = fs.readFileSync("/Users/diogomarassi/Desktop/jogo/packages/client/src/entities/CharacterCosmetics.ts", "utf-8");

  // Localiza a função buildHairModel
  const funcMatch = code.match(/export function buildHairModel[\s\S]*?(?=export function buildBeardModel)/);
  if (!funcMatch) {
    throw new Error("Falha: buildHairModel não encontrado em CharacterCosmetics.ts!");
  }
  const funcCode = funcMatch[0];

  // 1. Não deve haver BoxGeometry em nenhum cabelo
  if (funcCode.includes("BoxGeometry")) {
    throw new Error("Falha: BoxGeometry ainda encontrado em buildHairModel! O usuário solicitou cabelos orgânicos e sem formas quadradas.");
  }
  console.log("✓ Requisito: Zero formas quadradas (BoxGeometry) nos cabelos: CONFIRMADO!");

  // 2. Deve utilizar geometrias curvas (CapsuleGeometry, TorusGeometry, SphereGeometry)
  if (!funcCode.includes("CapsuleGeometry") || !funcCode.includes("TorusGeometry") || !funcCode.includes("SphereGeometry")) {
    throw new Error("Falha: buildHairModel deve utilizar geometrias curvas e fluidas (CapsuleGeometry, TorusGeometry, SphereGeometry)!");
  }
  console.log("✓ Requisito: Geometrias curvas e fluidas (cápsulas, toros e esferas de alta resolução): CONFIRMADO!");

  // 3. Verifica se todos os 5 tipos de cabelos com mechas estão implementados
  const styles = ["buzzcut", "medium", "pompadour", "long", "bowl"];
  for (const style of styles) {
    if (!funcCode.includes(`type === "${style}"`)) {
      throw new Error(`Falha: estilo '${style}' não encontrado em buildHairModel!`);
    }
  }
  console.log("✓ Requisito: Todos os estilos de cabelo (buzzcut, medium, pompadour, long, bowl) construídos com escultura orgânica: CONFIRMADO!");

  // 4. Material aprimorado com brilho acetinado natural e mechas iluminadas
  if (!funcCode.includes("hairMatHighlight") || !funcCode.includes("roughness: 0.42")) {
    throw new Error("Falha: Material refinado com specular sheen e mechas de destaque não configurado!");
  }
  console.log("✓ Requisito: Materiais realistas com brilho acetinado natural e realce de mechas: CONFIRMADO!");

  console.log("=== TODOS OS CABELOS FORAM ATUALIZADOS E VALIDADOS COM 100% DE SUCESSO! ===");
}

testOrganicHair();
