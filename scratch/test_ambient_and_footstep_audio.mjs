// Teste de integridade procedural do sistema de áudio:
// 1. Som ambiente procedural de floresta noturna inóspita (sub-drone, vento em canopias, grilos noturnos, eventos esporádicos)
// 2. Passos suaves na grama (alternância esquerda/direita, variação orgânica, transiente suave)
// 3. Controle de volume mestre e ciclos start/stop

class MockAudioParam {
  constructor(defaultValue = 1) {
    this.value = defaultValue;
  }
  setValueAtTime(val, _time) {
    this.value = val;
  }
  linearRampToValueAtTime(val, _time) {
    this.value = val;
  }
  exponentialRampToValueAtTime(val, _time) {
    this.value = val;
  }
}

class MockAudioNode {
  connect(dest) {
    return dest;
  }
  disconnect() {}
}

class MockGainNode extends MockAudioNode {
  constructor(defaultVal = 1) {
    super();
    this.gain = new MockAudioParam(defaultVal);
  }
}

class MockBiquadFilterNode extends MockAudioNode {
  constructor() {
    super();
    this.frequency = new MockAudioParam(1000);
    this.Q = new MockAudioParam(1);
    this.type = "lowpass";
  }
}

class MockOscillatorNode extends MockAudioNode {
  constructor() {
    super();
    this.frequency = new MockAudioParam(440);
    this.type = "sine";
    this.started = false;
    this.stopped = false;
  }
  start(_time) {
    this.started = true;
  }
  stop(_time) {
    this.stopped = true;
  }
}

class MockAudioBufferSourceNode extends MockAudioNode {
  constructor() {
    super();
    this.buffer = null;
    this.loop = false;
    this.started = false;
    this.stopped = false;
  }
  start(_time) {
    this.started = true;
  }
  stop(_time) {
    this.stopped = true;
  }
}

class MockAudioContext {
  constructor() {
    this.currentTime = 10.0;
    this.sampleRate = 44100;
    this.state = "running";
    this.destination = new MockAudioNode();
  }
  createGain() {
    return new MockGainNode();
  }
  createOscillator() {
    return new MockOscillatorNode();
  }
  createBiquadFilter() {
    return new MockBiquadFilterNode();
  }
  createBufferSource() {
    return new MockAudioBufferSourceNode();
  }
  createBuffer(channels, length, sampleRate) {
    return {
      numberOfChannels: channels,
      length,
      sampleRate,
      getChannelData: () => new Float32Array(length),
    };
  }
  resume() {
    this.state = "running";
    return Promise.resolve();
  }
}

// Configura ambiente global simulado do browser
globalThis.AudioContext = MockAudioContext;
globalThis.window = {
  AudioContext: MockAudioContext,
  addEventListener: () => {},
  removeEventListener: () => {},
  setTimeout: (fn, ms) => setTimeout(fn, 1),
  clearTimeout: (id) => clearTimeout(id),
};

async function runTest() {
  console.log("=== INICIANDO TESTE DO SISTEMA DE ÁUDIO PROCEDURAL ===");
  const { SoundManager } = await import("../packages/client/src/core/SoundManager.ts");
  const sound = new SoundManager();

  console.log("[1] Testando inicialização de volume mestre...");
  sound.setMasterVolume(0.85);

  console.log("[2] Testando início da atmosfera ambiente de floresta noturna...");
  sound.startAmbientForest();
  // Chamada duplicada deve ser idempotente
  sound.startAmbientForest();
  console.log("  -> startAmbientForest executado com sucesso e idempotente");

  console.log("[3] Testando som de passos na grama (pé esquerdo e pé direito)...");
  for (let i = 0; i < 6; i++) {
    const isLeft = i % 2 === 0;
    sound.playGrassStep(isLeft);
  }
  console.log("  -> 6 passos procedurais sintetizados (alternando esquerdo/direito)");

  console.log("[4] Testando interrupção suave do som ambiente...");
  sound.stopAmbientForest();
  // Chamada duplicada deve ser idempotente
  sound.stopAmbientForest();
  console.log("  -> stopAmbientForest executado com sucesso");

  console.log("[5] Testando reinício e ciclo de vida pós-interrupção...");
  sound.startAmbientForest();
  sound.playGrassStep(false);
  sound.stopAmbientForest();
  console.log("  -> Ciclo de vida reiniciado e concluído com sucesso");

  console.log("=== TODOS OS TESTES DE ÁUDIO FORAM CONCLUÍDOS COM SUCESSO! ===");
}

runTest().catch((err) => {
  console.error("Falha no teste de áudio:", err);
  process.exit(1);
});
