/**
 * Gerador procedural de áudio tático via Web Audio API.
 * Sem arquivos externos, sem dependências, com latência zero.
 */
export class SoundManager {
  private ctx: AudioContext | null = null;
  private isUnlocked = false;
  private masterGain: GainNode | null = null;
  private currentMasterVolume = 1.0;
  private sharedNoiseBuffer: AudioBuffer | null = null;

  // Floresta noturna inóspita (som ambiente procedural)
  private ambientGain: GainNode | null = null;
  private isAmbientPlaying = false;
  private ambientNodes: AudioNode[] = [];
  private ambientSources: { stop: (when?: number) => void }[] = [];
  private ambientTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Desbloqueia o AudioContext imediatamente na primeira interação do usuário
    if (typeof window !== "undefined") {
      const unlock = (): void => {
        if (this.isUnlocked) return;
        this.ensureContext();
        if (this.ctx && this.ctx.state === "suspended") {
          void this.ctx.resume();
        }
        this.isUnlocked = true;
        this.startAmbientForest();
        window.removeEventListener("pointerdown", unlock);
        window.removeEventListener("mousedown", unlock);
        window.removeEventListener("keydown", unlock);
        window.removeEventListener("touchstart", unlock);
        window.removeEventListener("click", unlock);
      };
      window.addEventListener("pointerdown", unlock, { passive: true });
      window.addEventListener("mousedown", unlock, { passive: true });
      window.addEventListener("keydown", unlock, { passive: true });
      window.addEventListener("touchstart", unlock, { passive: true });
      window.addEventListener("click", unlock, { passive: true });
    }
  }

  private init(): void {
    if (!this.ctx && typeof window !== "undefined") {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        // latencyHint: 'interactive' requisita o menor buffer possível de hardware (latência de ~3ms)
        this.ctx = new AudioCtx({ latencyHint: "interactive" });
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.currentMasterVolume, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      }
    }
  }

  setMasterVolume(volume: number): void {
    const v = Math.max(0, Math.min(1, volume));
    this.currentMasterVolume = v;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(v, this.ctx.currentTime);
    }
  }

  private ensureContext(): AudioContext | null {
    if (!this.ctx) {
      this.init();
    }
    if (this.ctx && this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  /** Obtém ou cria o buffer compartilhado de ruído branco para latência zero em tiros e explosões */
  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (!this.sharedNoiseBuffer || this.sharedNoiseBuffer.sampleRate !== ctx.sampleRate) {
      const size = Math.floor(ctx.sampleRate * 2.0); // 2 segundos de ruído pré-calculado
      this.sharedNoiseBuffer = ctx.createBuffer(1, size, ctx.sampleRate);
      const data = this.sharedNoiseBuffer.getChannelData(0);
      for (let i = 0; i < size; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    }
    return this.sharedNoiseBuffer;
  }

  /** Cria uma fonte de ruído branco em loop sem nenhuma alocação de memória ou cálculo em tempo real */
  private createNoiseSource(ctx: AudioContext): AudioBufferSourceNode {
    const src = ctx.createBufferSource();
    src.buffer = this.getNoiseBuffer(ctx);
    src.loop = true;
    return src;
  }

  /** Som de tiro: estalo percussivo + transiente de pressão + grave (latência zero instantânea) */
  playShoot(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dest = this.masterGain ?? ctx.destination;

    // 1) Ruído branco filtrado (estalo da queima de pólvora)
    const whiteNoise = this.createNoiseSource(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1600, now);
    filter.frequency.exponentialRampToValueAtTime(320, now + 0.12);
    filter.Q.setValueAtTime(2.5, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.42, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    whiteNoise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(dest);
    whiteNoise.start(now);
    whiteNoise.stop(now + 0.13);

    // 2) Oscilador grave de impacto (punch)
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.1);

    oscGain.gain.setValueAtTime(0.5, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(oscGain);
    oscGain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  /** Clique mecânico seco e realista quando o gatilho é acionado sem balas */
  playDryFire(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dest = this.masterGain ?? ctx.destination;

    // 1) Impacto mecânico seco do cão / percussor (ruído filtrado de banda estreita)
    const noise = this.createNoiseSource(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(3400, now);
    filter.frequency.exponentialRampToValueAtTime(1100, now + 0.022);
    filter.Q.setValueAtTime(3.2, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.4, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.022);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(dest);
    noise.start(now);
    noise.stop(now + 0.025);

    // 2) Estalo metálico curto de choque mecânico no percussor
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(1420, now);
    osc.frequency.exponentialRampToValueAtTime(540, now + 0.02);

    oscGain.gain.setValueAtTime(0.35, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

    osc.connect(oscGain);
    oscGain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.022);

    // 3) Pequeno estalo secundário de desengate do gatilho (mola interna)
    const oscSpring = ctx.createOscillator();
    const springGain = ctx.createGain();
    oscSpring.type = "sine";
    oscSpring.frequency.setValueAtTime(840, now + 0.01);
    oscSpring.frequency.exponentialRampToValueAtTime(420, now + 0.024);

    springGain.gain.setValueAtTime(0.001, now);
    springGain.gain.setValueAtTime(0.12, now + 0.01);
    springGain.gain.exponentialRampToValueAtTime(0.001, now + 0.028);

    oscSpring.connect(springGain);
    springGain.connect(dest);
    oscSpring.start(now + 0.01);
    oscSpring.stop(now + 0.03);
  }

  /** Início da recarga: ejetar pente / estalo mecânico */
  playReloadStart(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dest = this.masterGain ?? ctx.destination;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(900, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.1);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  /** Conclusão da recarga: engatilhamento metálico crocante */
  playReloadDone(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dest = this.masterGain ?? ctx.destination;

    // Clique 1
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "triangle";
    osc1.frequency.setValueAtTime(650, now);
    osc1.frequency.exponentialRampToValueAtTime(1400, now + 0.06);
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc1.connect(gain1);
    gain1.connect(dest);
    osc1.start(now);
    osc1.stop(now + 0.07);

    // Clique 2 (slide snap)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1200, now + 0.08);
    osc2.frequency.exponentialRampToValueAtTime(2400, now + 0.14);
    gain2.gain.setValueAtTime(0.35, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc2.connect(gain2);
    gain2.connect(dest);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.16);
  }

  /** Dano recebido pelo jogador */
  playDamage(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dest = this.masterGain ?? ctx.destination;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.18);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.19);
  }

  /** Impacto absorvido pela armadura: "clank" metálico curto + baque abafado */
  playArmorHit(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dest = this.masterGain ?? ctx.destination;

    // Ressonância metálica (parciais inarmônicas como placa de aço sendo atingida)
    const partials = [820, 1370, 2110];
    partials.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.92, now + 0.22);
      gain.gain.setValueAtTime(0.12 / (i + 1), now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22 - i * 0.04);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.23);
    });

    // Transiente de ruído filtrado (o "tchak" do impacto)
    const noise = this.createNoiseSource(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(3000, now);
    filter.Q.setValueAtTime(1.2, now);
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.35, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(dest);
    noise.start(now);
    noise.stop(now + 0.06);

    // Baque grave abafado (o golpe contra o colete)
    const thump = ctx.createOscillator();
    const tGain = ctx.createGain();
    thump.type = "sine";
    thump.frequency.setValueAtTime(180, now);
    thump.frequency.exponentialRampToValueAtTime(70, now + 0.1);
    tGain.gain.setValueAtTime(0.3, now);
    tGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    thump.connect(tGain);
    tGain.connect(dest);
    thump.start(now);
    thump.stop(now + 0.13);
  }

  /** Som dramático de morte do jogador (impacto pesado + acorde sombrio em queda) */
  playDeath(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dest = this.masterGain ?? ctx.destination;

    // Sub-grave impactante
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = "sine";
    sub.frequency.setValueAtTime(120, now);
    sub.frequency.exponentialRampToValueAtTime(30, now + 0.85);
    subGain.gain.setValueAtTime(0.75, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
    sub.connect(subGain);
    subGain.connect(dest);
    sub.start(now);
    sub.stop(now + 0.9);

    // Acorde sombrio dissonante em queda
    const freqs = [190, 150, 115, 82];
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.exponentialRampToValueAtTime(f * 0.65, now + 1.2);

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(650, now);
      filter.frequency.exponentialRampToValueAtTime(110, now + 1.2);

      gain.gain.setValueAtTime(0.2, now + i * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.3);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(dest);
      osc.start(now + i * 0.05);
      osc.stop(now + 1.35);
    });
  }

  /** Som de renascimento / reinício (arpejo ascendente heroico) */
  playRespawn(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dest = this.masterGain ?? ctx.destination;

    const notes = [261.63, 329.63, 392.0, 523.25, 659.25]; // C4, E4, G4, C5, E5
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);

      gain.gain.setValueAtTime(0.3, now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.35);

      osc.connect(gain);
      gain.connect(dest);
      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.38);
    });
  }

  /** Som do Desfibrilador: carga de capacitor + descarga elétrica potente ("BZZZT-CLACK!") + bipes de monitor cardíaco restabelecido */
  playDefibrillatorShock(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dest = this.masterGain ?? ctx.destination;

    // 1) Carga rápida do capacitor (whine agudo ascendente 900 -> 2600 Hz)
    const chargeOsc = ctx.createOscillator();
    const chargeGain = ctx.createGain();
    chargeOsc.type = "sawtooth";
    chargeOsc.frequency.setValueAtTime(900, now);
    chargeOsc.frequency.exponentialRampToValueAtTime(2600, now + 0.12);

    chargeGain.gain.setValueAtTime(0.01, now);
    chargeGain.gain.linearRampToValueAtTime(0.35, now + 0.11);
    chargeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    chargeOsc.connect(chargeGain);
    chargeGain.connect(dest);
    chargeOsc.start(now);
    chargeOsc.stop(now + 0.15);

    // 2) Choque Elétrico Massivo (Impacto + zumbido elétrico de descarga "BZZZZT!")
    const shockTime = now + 0.12;

    // Sub-bass thud do impacto no tórax
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = "sine";
    subOsc.frequency.setValueAtTime(140, shockTime);
    subOsc.frequency.exponentialRampToValueAtTime(45, shockTime + 0.28);
    subGain.gain.setValueAtTime(0.65, shockTime);
    subGain.gain.exponentialRampToValueAtTime(0.001, shockTime + 0.32);

    subOsc.connect(subGain);
    subGain.connect(dest);
    subOsc.start(shockTime);
    subOsc.stop(shockTime + 0.34);

    // Ruído elétrico de centelha / arco voltaico
    const noise = this.createNoiseSource(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1600, shockTime);
    filter.Q.setValueAtTime(3.5, shockTime);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.7, shockTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, shockTime + 0.45);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(dest);
    noise.start(shockTime);
    noise.stop(shockTime + 0.48);

    // 3) Bipes de monitor cardíaco de batimentos restabelecidos ("BEEP... BEEP!")
    [shockTime + 0.52, shockTime + 0.88].forEach((beepTime) => {
      const beepOsc = ctx.createOscillator();
      const beepGain = ctx.createGain();
      beepOsc.type = "sine";
      beepOsc.frequency.setValueAtTime(1046.5, beepTime); // C6

      beepGain.gain.setValueAtTime(0.28, beepTime);
      beepGain.gain.exponentialRampToValueAtTime(0.001, beepTime + 0.12);

      beepOsc.connect(beepGain);
      beepGain.connect(dest);
      beepOsc.start(beepTime);
      beepOsc.stop(beepTime + 0.14);
    });
  }

  /** Coleta de caixa de munição no mapa */
  playAmmoPickup(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dest = this.masterGain ?? ctx.destination;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(587, now); // D5
    osc.frequency.setValueAtTime(880, now + 0.07); // A5
    osc.frequency.setValueAtTime(1174, now + 0.14); // D6

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.26);
  }

  /** Coleta de arma de fogo do chão (engatilhamento mecânico tático "clack-chick" de ferrolho + toque positivo) */
  playWeaponPickup(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dest = this.masterGain ?? ctx.destination;

    // 1) Primeiro clique mecânico (puxar o ferrolho)
    const noise1 = this.createNoiseSource(ctx);
    const filter1 = ctx.createBiquadFilter();
    filter1.type = "bandpass";
    filter1.frequency.setValueAtTime(2400, now);
    filter1.Q.setValueAtTime(3.5, now);

    const gain1 = ctx.createGain();
    gain1.gain.setValueAtTime(0.35, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

    noise1.connect(filter1);
    filter1.connect(gain1);
    gain1.connect(dest);
    noise1.start(now);
    noise1.stop(now + 0.05);

    // 2) Segundo clique metálico firme (fechamento de câmara)
    const noise2 = this.createNoiseSource(ctx);
    const filter2 = ctx.createBiquadFilter();
    filter2.type = "bandpass";
    filter2.frequency.setValueAtTime(1400, now + 0.065);
    filter2.Q.setValueAtTime(2.8, now + 0.065);

    const gain2 = ctx.createGain();
    gain2.gain.setValueAtTime(0.001, now);
    gain2.gain.setValueAtTime(0.48, now + 0.065);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    noise2.connect(filter2);
    filter2.connect(gain2);
    gain2.connect(dest);
    noise2.start(now + 0.065);
    noise2.stop(now + 0.15);

    // 3) Toque sonoro de confirmação e alívio por recuperar o armamento
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(523.25, now + 0.06); // C5
    osc.frequency.setValueAtTime(783.99, now + 0.11); // G5
    osc.frequency.setValueAtTime(1046.5, now + 0.16); // C6

    oscGain.gain.setValueAtTime(0.001, now);
    oscGain.gain.setValueAtTime(0.25, now + 0.06);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc.connect(oscGain);
    oscGain.connect(dest);
    osc.start(now + 0.06);
    osc.stop(now + 0.29);
  }

  /** Coleta de item comum do chão (bandagem, caixa tática, suprimentos) */
  playItemPickup(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dest = this.masterGain ?? ctx.destination;

    // Estalo inicial tático de agarrar
    const click = this.createNoiseSource(ctx);
    const clickFilter = ctx.createBiquadFilter();
    clickFilter.type = "bandpass";
    clickFilter.frequency.setValueAtTime(2800, now);
    clickFilter.Q.setValueAtTime(2.0, now);

    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(0.28, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

    click.connect(clickFilter);
    clickFilter.connect(clickGain);
    clickGain.connect(dest);
    click.start(now);
    click.stop(now + 0.04);

    // Chime suave ascendente indicando item obtido
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(659.25, now); // E5
    osc.frequency.setValueAtTime(987.77, now + 0.06); // B5
    osc.frequency.setValueAtTime(1318.51, now + 0.12); // E6

    gain.gain.setValueAtTime(0.26, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  /** Explosão detonante do zumbi suicida ou C4 */
  playExplosion(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dest = this.masterGain ?? ctx.destination;

    // 1) Ruído denso com filtro decrescente (estrondo de fogo)
    const noise = this.createNoiseSource(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(900, now);
    filter.frequency.exponentialRampToValueAtTime(70, now + 0.45);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.7, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(dest);
    noise.start(now);
    noise.stop(now + 0.46);

    // 2) Sub-bass estrondoso
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(25, now + 0.38);
    oscGain.gain.setValueAtTime(0.9, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    osc.connect(oscGain);
    oscGain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.39);
  }

  /** Som ao plantar a C4 no chão (estalo tático + armar de dispositivo) */
  playC4Plant(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dest = this.masterGain ?? ctx.destination;

    // 1) Impacto no solo
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.08);
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.09);

    // 2) Arme digital agudo (beep inicial)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1760, now + 0.06);
    gain2.gain.setValueAtTime(0.25, now + 0.06);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc2.connect(gain2);
    gain2.connect(dest);
    osc2.start(now + 0.06);
    osc2.stop(now + 0.13);
  }

  /** Bipe característico de contagem regressiva da C4 */
  playC4Beep(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dest = this.masterGain ?? ctx.destination;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(2400, now);
    osc.frequency.setValueAtTime(2400, now + 0.035);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.045);
  }

  /** Golpe de faca cortando o ar (whoosh tático instantâneo) */
  playKnifeSlash(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dest = this.masterGain ?? ctx.destination;

    const noise = this.createNoiseSource(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(2400, now);
    filter.frequency.exponentialRampToValueAtTime(800, now + 0.11);
    filter.Q.setValueAtTime(2.5, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    noise.start(now);
    noise.stop(now + 0.12);
  }

  /** Som de impacto da faca cortando carne */
  playKnifeHit(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dest = this.masterGain ?? ctx.destination;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.08);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  /** Aplicação de bandagem e cura de vida */
  playHeal(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Dois tons harmônicos ascendentes suaves
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = "sine";
    osc2.type = "sine";
    osc1.frequency.setValueAtTime(523.25, now); // C5
    osc1.frequency.setValueAtTime(659.25, now + 0.1); // E5
    osc1.frequency.setValueAtTime(783.99, now + 0.2); // G5

    osc2.frequency.setValueAtTime(1046.5, now); // C6
    osc2.frequency.setValueAtTime(1318.5, now + 0.1); // E6

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.36);
    osc2.stop(now + 0.36);
  }

  /** Troca de item no inventário (clique tático mecânico) */
  playItemSwitch(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(1600, now + 0.03);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.04);
  }

  /** Coleta de moedas/despojos ao abater zumbi: som sutil e abafado de moedas no bolso/algibeira (sem toque arcade) */
  playCoinPickup(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dest = this.masterGain ?? ctx.destination;

    // 1) Atrito suave de tecido/algibeira (ruído filtrado curto)
    const noise = this.createNoiseSource(ctx);
    const nFilter = ctx.createBiquadFilter();
    nFilter.type = "bandpass";
    nFilter.frequency.setValueAtTime(1450, now);
    nFilter.Q.setValueAtTime(2.0, now);

    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.08, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

    noise.connect(nFilter);
    nFilter.connect(nGain);
    nGain.connect(dest);
    noise.start(now);
    noise.stop(now + 0.05);

    // 2) Toque sutil de duas moedas pesadas (curto, amortecido, sem sustain de sino)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "triangle";
    osc1.frequency.setValueAtTime(920, now);
    osc1.frequency.exponentialRampToValueAtTime(740, now + 0.038);

    gain1.gain.setValueAtTime(0.08, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.038);

    osc1.connect(gain1);
    gain1.connect(dest);
    osc1.start(now);
    osc1.stop(now + 0.042);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1240, now + 0.012);
    osc2.frequency.exponentialRampToValueAtTime(1010, now + 0.045);

    gain2.gain.setValueAtTime(0.001, now);
    gain2.gain.setValueAtTime(0.06, now + 0.012);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.048);

    osc2.connect(gain2);
    gain2.connect(dest);
    osc2.start(now + 0.012);
    osc2.stop(now + 0.052);
  }

  /** Som seco de folha de papel / pergaminho sendo passada ou desdobrada */
  playPageTurn(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dest = this.masterGain ?? ctx.destination;

    // 1) Textura de fricção do papel (ruído branco filtrado com sweep orgânico)
    const noise = this.createNoiseSource(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1100, now);
    filter.frequency.exponentialRampToValueAtTime(2400, now + 0.04);
    filter.frequency.exponentialRampToValueAtTime(950, now + 0.15);
    filter.Q.setValueAtTime(1.8, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.001, now);
    noiseGain.gain.linearRampToValueAtTime(0.19, now + 0.03);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(dest);
    noise.start(now);
    noise.stop(now + 0.16);

    // 2) Estalinho seco da borda da página assentando
    const snapOsc = ctx.createOscillator();
    const snapGain = ctx.createGain();
    snapOsc.type = "triangle";
    snapOsc.frequency.setValueAtTime(1550, now + 0.065);
    snapOsc.frequency.exponentialRampToValueAtTime(580, now + 0.11);

    snapGain.gain.setValueAtTime(0.001, now);
    snapGain.gain.setValueAtTime(0.07, now + 0.065);
    snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    snapOsc.connect(snapGain);
    snapGain.connect(dest);
    snapOsc.start(now + 0.065);
    snapOsc.stop(now + 0.13);
  }

  /** Abertura da loja: som seco de folha de inventário de suprimentos sendo desdobrada */
  playShopOpen(): void {
    this.playPageTurn();
  }

  /** Compra bem-sucedida na loja (acorde de confirmação tática de melhoria) */
  playShopBuy(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dest = this.masterGain ?? ctx.destination;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    gain.connect(dest);

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.045);
      osc.connect(gain);
      osc.start(now + idx * 0.045);
      osc.stop(now + 0.4);
    });
  }

  /** Cuspe viscoso de gosma ácida do Zumbi Rastejador */
  playSlimeSpit(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dest = this.masterGain ?? ctx.destination;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(480, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.18);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(900, now);
    filter.frequency.exponentialRampToValueAtTime(250, now + 0.18);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    osc.start(now);
    osc.stop(now + 0.22);
  }

  /** Chiado cáustico de dano ao pisar na poça de gosma */
  playSlimeBurn(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dest = this.masterGain ?? ctx.destination;

    const whiteNoise = this.createNoiseSource(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(2800, now);
    filter.frequency.exponentialRampToValueAtTime(1400, now + 0.18);
    filter.Q.setValueAtTime(3.5, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    whiteNoise.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    whiteNoise.start(now);
    whiteNoise.stop(now + 0.19);
  }

  /** Disparo silvante de seda de teia pela Rainha Aracnídea */
  playWebShoot(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dest = this.masterGain ?? ctx.destination;

    const noise = this.createNoiseSource(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(3200, now);
    filter.frequency.exponentialRampToValueAtTime(800, now + 0.22);
    filter.Q.setValueAtTime(4.0, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.38, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    noise.start(now);
    noise.stop(now + 0.24);
  }

  /** Impacto pegajoso e paralisante da teia no sobrevivente */
  playWebTrap(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dest = this.masterGain ?? ctx.destination;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.28);

    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    const noise = this.createNoiseSource(ctx);
    const nFilter = ctx.createBiquadFilter();
    nFilter.type = "lowpass";
    nFilter.frequency.setValueAtTime(900, now);
    nFilter.frequency.exponentialRampToValueAtTime(200, now + 0.25);

    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.32, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(dest);
    noise.connect(nFilter);
    nFilter.connect(nGain);
    nGain.connect(dest);

    osc.start(now);
    osc.stop(now + 0.3);
    noise.start(now);
    noise.stop(now + 0.26);
  }

  /** Disparo de morteiro biológico (som pneumático de lançamento "thwump") */
  playMortarLaunch(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dest = this.masterGain ?? ctx.destination;

    // Grave de propulsão
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.22);

    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(dest);

    osc.start(now);
    osc.stop(now + 0.26);

    // Ruído de sopro de canhão
    const noise = this.createNoiseSource(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(450, now);
    filter.frequency.exponentialRampToValueAtTime(120, now + 0.15);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.3, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(dest);
    noise.start(now);
    noise.stop(now + 0.16);
  }

  /** Impacto / detonação de gosma ao cair no solo */
  playMortarImpact(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dest = this.masterGain ?? ctx.destination;

    // Impacto de choque
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.24);

    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(dest);

    osc.start(now);
    osc.stop(now + 0.26);

    // Efeito de respingo viscoso
    const noise = this.createNoiseSource(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(950, now);
    filter.frequency.exponentialRampToValueAtTime(280, now + 0.22);
    filter.Q.setValueAtTime(2.2, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.4, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(dest);
    noise.start(now);
    noise.stop(now + 0.23);
  }

  /** Sirene / Alarme dramático de horda: trompa de guerra sinistra e grave */
  playHordeAlarm(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dest = this.masterGain ?? ctx.destination;

    // Trompa de guerra grave (Sawtooth + Sine com filtro)
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc1.type = "sawtooth";
    osc1.frequency.setValueAtTime(82, now);
    osc1.frequency.linearRampToValueAtTime(73, now + 1.2);

    osc2.type = "sine";
    osc2.frequency.setValueAtTime(164, now);
    osc2.frequency.linearRampToValueAtTime(146, now + 1.2);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(500, now);
    filter.frequency.exponentialRampToValueAtTime(200, now + 1.2);

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.5, now + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 1.45);
    osc2.stop(now + 1.45);
  }

  /** Som de abrir porta: clique metálico do trinco + rangido suave de madeira */
  playDoorOpen(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dest = this.masterGain ?? ctx.destination;

    // 1) Trinco metálico / estalo do ferrolho
    const clickOsc = ctx.createOscillator();
    const clickGain = ctx.createGain();
    clickOsc.type = "triangle";
    clickOsc.frequency.setValueAtTime(680, now);
    clickOsc.frequency.exponentialRampToValueAtTime(140, now + 0.06);
    clickGain.gain.setValueAtTime(0.28, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    clickOsc.connect(clickGain);
    clickGain.connect(dest);
    clickOsc.start(now);
    clickOsc.stop(now + 0.08);

    // 2) Rangido de madeira (sawtooth modulado passando por filtro passa-faixa)
    const creakOsc = ctx.createOscillator();
    const creakGain = ctx.createGain();
    const creakFilter = ctx.createBiquadFilter();

    creakOsc.type = "sawtooth";
    creakOsc.frequency.setValueAtTime(160, now + 0.04);
    creakOsc.frequency.linearRampToValueAtTime(260, now + 0.18);
    creakOsc.frequency.linearRampToValueAtTime(190, now + 0.32);

    creakFilter.type = "bandpass";
    creakFilter.frequency.setValueAtTime(450, now);
    creakFilter.Q.setValueAtTime(3.5, now);

    creakGain.gain.setValueAtTime(0.001, now);
    creakGain.gain.linearRampToValueAtTime(0.18, now + 0.08);
    creakGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    creakOsc.connect(creakFilter);
    creakFilter.connect(creakGain);
    creakGain.connect(dest);

    creakOsc.start(now + 0.04);
    creakOsc.stop(now + 0.36);
  }

  /** Som de fechar porta: batida encorpada de madeira sólida + tranca batendo */
  playDoorClose(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dest = this.masterGain ?? ctx.destination;

    // 1) Batida grave de madeira (impacto sólido)
    const thudOsc = ctx.createOscillator();
    const thudGain = ctx.createGain();
    thudOsc.type = "sine";
    thudOsc.frequency.setValueAtTime(120, now);
    thudOsc.frequency.exponentialRampToValueAtTime(38, now + 0.18);

    thudGain.gain.setValueAtTime(0.48, now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    thudOsc.connect(thudGain);
    thudGain.connect(dest);
    thudOsc.start(now);
    thudOsc.stop(now + 0.25);

    // 2) Ruído de impacto abafado (madeira batendo no batente)
    const noise = this.createNoiseSource(ctx);
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "lowpass";
    noiseFilter.frequency.setValueAtTime(420, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(90, now + 0.12);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.35, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(dest);

    noise.start(now);
    noise.stop(now + 0.15);

    // 3) Estalo metálico final do ferrolho encaixando
    const latchOsc = ctx.createOscillator();
    const latchGain = ctx.createGain();
    latchOsc.type = "triangle";
    latchOsc.frequency.setValueAtTime(520, now + 0.05);
    latchOsc.frequency.exponentialRampToValueAtTime(180, now + 0.12);
    latchGain.gain.setValueAtTime(0.2, now + 0.05);
    latchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    latchOsc.connect(latchGain);
    latchGain.connect(dest);
    latchOsc.start(now + 0.05);
    latchOsc.stop(now + 0.15);
  }

  /** Pulo do personagem: som saltitante ágil (whoosh leve + pitch ascendente) */
  playJump(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dest = this.masterGain ?? ctx.destination;

    // Tom ascendente saltitante
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.14);

    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.17);

    // Ar sutil
    const noise = this.createNoiseSource(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1200, now);
    filter.frequency.exponentialRampToValueAtTime(600, now + 0.12);
    filter.Q.setValueAtTime(2.0, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.18, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(dest);
    noise.start(now);
    noise.stop(now + 0.13);
  }

  /** Pouso no solo após o pulo */
  playLand(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dest = this.masterGain ?? ctx.destination;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(130, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.08);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  /** Uivo aterrorizante do Lobisomem Alfa (ressonância visceral e eco selvagem) */
  playWerewolfHowl(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dest = this.masterGain ?? ctx.destination;

    // 1) Corpo vocal tonal do uivo (onda dente de serra suavizada com filtro passa-faixa)
    const osc = ctx.createOscillator();
    const vibrato = ctx.createOscillator();
    const vibratoGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = "sawtooth";
    // Curva clássica de uivo de lobo: inicia grave (150Hz), sobe até o ápice (360Hz) e decai com lamento (220Hz)
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(360, now + 0.45);
    osc.frequency.setValueAtTime(360, now + 0.85);
    osc.frequency.exponentialRampToValueAtTime(220, now + 1.6);

    // Vibrato selvagem na garganta
    vibrato.frequency.setValueAtTime(5.5, now);
    vibratoGain.gain.setValueAtTime(8.0, now);
    vibrato.connect(vibratoGain);
    vibratoGain.connect(osc.frequency);
    vibrato.start(now);
    vibrato.stop(now + 1.65);

    filter.type = "bandpass";
    filter.frequency.setValueAtTime(450, now);
    filter.frequency.exponentialRampToValueAtTime(850, now + 0.45);
    filter.frequency.exponentialRampToValueAtTime(500, now + 1.6);
    filter.Q.setValueAtTime(3.5, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.42, now + 0.35);
    gain.gain.setValueAtTime(0.42, now + 0.9);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.65);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 1.7);

    // 2) Sopro rouco gutural de ar
    const noise = this.createNoiseSource(ctx);
    const nFilter = ctx.createBiquadFilter();
    nFilter.type = "bandpass";
    nFilter.frequency.setValueAtTime(600, now);
    nFilter.Q.setValueAtTime(1.8, now);

    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.001, now);
    nGain.gain.exponentialRampToValueAtTime(0.22, now + 0.25);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);

    noise.connect(nFilter);
    nFilter.connect(nGain);
    nGain.connect(dest);
    noise.start(now);
    noise.stop(now + 1.45);
  }

  /** Golpe cortante e feroz de garras do Lobisomem Alfa */
  playWerewolfSlash(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dest = this.masterGain ?? ctx.destination;

    // Whoosh pesado e corte cortante de garras
    const noise = this.createNoiseSource(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(2200, now);
    filter.frequency.exponentialRampToValueAtTime(400, now + 0.16);
    filter.Q.setValueAtTime(2.2, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    noise.start(now);
    noise.stop(now + 0.19);

    // Impacto muscular encorpado
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.15);
    oscGain.gain.setValueAtTime(0.35, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(oscGain);
    oscGain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.17);
  }

  /** Rosnado e mordida rápida do Lobo Faminto */
  playWolfSnarl(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dest = this.masterGain ?? ctx.destination;

    // Rosnado canino rápido
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.14);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1200, now);
    filter.frequency.exponentialRampToValueAtTime(350, now + 0.14);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.16);

    // Snap seco de dentes batendo
    const snap = ctx.createOscillator();
    const snapGain = ctx.createGain();
    snap.type = "triangle";
    snap.frequency.setValueAtTime(650, now + 0.05);
    snap.frequency.exponentialRampToValueAtTime(180, now + 0.11);
    snapGain.gain.setValueAtTime(0.28, now + 0.05);
    snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    snap.connect(snapGain);
    snapGain.connect(dest);
    snap.start(now + 0.05);
    snap.stop(now + 0.13);
  }

  /**
   * Inicia a atmosfera ambiente procedural de floresta noturna inóspita:
   * 1. Sub-grave contínuo de ar noturno e solidão (drone suave ~48Hz)
   * 2. Vento noturno suave nas copas das árvores (ruído filtrado modulado por LFO)
   * 3. Leito suave de grilos/insetos noturnos ao longe (~4.7kHz com pulso rítmico)
   * 4. Sons esporádicos sutis na escuridão (galho estalando à distância, rajada repentina de vento, folhas secas)
   */
  startAmbientForest(): void {
    if (this.isAmbientPlaying) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    this.isAmbientPlaying = true;
    const now = ctx.currentTime;
    const dest = this.masterGain ?? ctx.destination;

    // Master Gain específico da ambiência com fade-in suave de 2.5s
    const ambientGain = ctx.createGain();
    ambientGain.gain.setValueAtTime(0.0001, now);
    ambientGain.gain.exponentialRampToValueAtTime(0.45, now + 2.5);
    ambientGain.connect(dest);
    this.ambientGain = ambientGain;

    this.ambientNodes = [ambientGain];
    this.ambientSources = [];

    // --- 1. Sub-drone noturno de isolamento / lugar inóspito (~48Hz) ---
    const droneOsc = ctx.createOscillator();
    droneOsc.type = "sine";
    droneOsc.frequency.setValueAtTime(48, now);

    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = "lowpass";
    droneFilter.frequency.setValueAtTime(80, now);

    const droneGain = ctx.createGain();
    droneGain.gain.setValueAtTime(0.055, now);

    droneOsc.connect(droneFilter);
    droneFilter.connect(droneGain);
    droneGain.connect(ambientGain);

    droneOsc.start(now);
    this.ambientSources.push(droneOsc);
    this.ambientNodes.push(droneOsc, droneFilter, droneGain);

    // --- 2. Vento noturno soprando entre os pinheiros (ruído modulado) ---
    const windNoise = this.createNoiseSource(ctx);
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = "bandpass";
    windFilter.frequency.setValueAtTime(380, now);
    windFilter.Q.setValueAtTime(1.8, now);

    // LFO para oscilar suavemente a frequência do vento (sensação de rajadas lentas)
    const windLfo = ctx.createOscillator();
    windLfo.type = "sine";
    windLfo.frequency.setValueAtTime(0.12, now); // Ciclo lento de ~8s

    const windLfoGain = ctx.createGain();
    windLfoGain.gain.setValueAtTime(140, now); // Variação de +-140Hz

    windLfo.connect(windLfoGain);
    windLfoGain.connect(windFilter.frequency);

    const windGain = ctx.createGain();
    windGain.gain.setValueAtTime(0.045, now);

    windNoise.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(ambientGain);

    windNoise.start(now);
    windLfo.start(now);
    this.ambientSources.push(windNoise, windLfo);
    this.ambientNodes.push(windNoise, windFilter, windLfo, windLfoGain, windGain);

    // --- 3. Eventos noturnos esporádicos (galhos estalando, rajada fria, folhas secas) ---
    this.scheduleSporadicNightSound();
  }

  private scheduleSporadicNightSound(): void {
    if (!this.isAmbientPlaying) return;
    if (typeof window === "undefined") return;

    // Intervalo aleatório entre 10 e 22 segundos
    const delayMs = 10000 + Math.random() * 12000;
    this.ambientTimeout = window.setTimeout(() => {
      if (!this.isAmbientPlaying) return;
      this.playDistantNightEvent();
      this.scheduleSporadicNightSound();
    }, delayMs);
  }

  private playDistantNightEvent(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.ambientGain || !this.isAmbientPlaying) return;
    const now = ctx.currentTime;
    const dest = this.ambientGain;

    const eventType = Math.floor(Math.random() * 3);

    if (eventType === 0) {
      // Galho seco estalando ao longe na escuridão
      const snapNoise = this.createNoiseSource(ctx);
      const snapFilter = ctx.createBiquadFilter();
      snapFilter.type = "bandpass";
      snapFilter.frequency.setValueAtTime(1350 + Math.random() * 200, now);
      snapFilter.Q.setValueAtTime(2.8, now);

      const snapGain = ctx.createGain();
      snapGain.gain.setValueAtTime(0.035, now);
      snapGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

      snapNoise.connect(snapFilter);
      snapFilter.connect(snapGain);
      snapGain.connect(dest);

      snapNoise.start(now);
      snapNoise.stop(now + 0.06);

      // Pequeno estalo seco de madeira
      const woodOsc = ctx.createOscillator();
      const woodGain = ctx.createGain();
      woodOsc.type = "triangle";
      woodOsc.frequency.setValueAtTime(320, now);
      woodOsc.frequency.exponentialRampToValueAtTime(140, now + 0.04);
      woodGain.gain.setValueAtTime(0.025, now);
      woodGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

      woodOsc.connect(woodGain);
      woodGain.connect(dest);
      woodOsc.start(now);
      woodOsc.stop(now + 0.05);
    } else if (eventType === 1) {
      // Rajada fria repentina de vento uivando nas copas
      const gustNoise = this.createNoiseSource(ctx);
      const gustFilter = ctx.createBiquadFilter();
      gustFilter.type = "bandpass";
      gustFilter.frequency.setValueAtTime(300, now);
      gustFilter.frequency.exponentialRampToValueAtTime(620, now + 1.2);
      gustFilter.frequency.exponentialRampToValueAtTime(280, now + 2.8);
      gustFilter.Q.setValueAtTime(2.2, now);

      const gustGain = ctx.createGain();
      gustGain.gain.setValueAtTime(0.001, now);
      gustGain.gain.linearRampToValueAtTime(0.045, now + 1.0);
      gustGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.9);

      gustNoise.connect(gustFilter);
      gustFilter.connect(gustGain);
      gustGain.connect(dest);

      gustNoise.start(now);
      gustNoise.stop(now + 3.0);
    } else {
      // Farfalhar sutil de folhas secas ao vento ou criatura distante
      const rustleNoise = this.createNoiseSource(ctx);
      const rustleFilter = ctx.createBiquadFilter();
      rustleFilter.type = "bandpass";
      rustleFilter.frequency.setValueAtTime(850, now);
      rustleFilter.Q.setValueAtTime(1.5, now);

      const rustleGain = ctx.createGain();
      rustleGain.gain.setValueAtTime(0.001, now);
      rustleGain.gain.linearRampToValueAtTime(0.028, now + 0.15);
      rustleGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);

      rustleNoise.connect(rustleFilter);
      rustleFilter.connect(rustleGain);
      rustleGain.connect(dest);

      rustleNoise.start(now);
      rustleNoise.stop(now + 0.6);
    }
  }

  /** Interrompe suavemente o som de fundo da floresta com fade-out */
  stopAmbientForest(): void {
    if (!this.isAmbientPlaying) return;
    this.isAmbientPlaying = false;

    if (this.ambientTimeout !== null && typeof window !== "undefined") {
      window.clearTimeout(this.ambientTimeout);
      this.ambientTimeout = null;
    }

    if (this.ambientGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.ambientGain.gain.setValueAtTime(this.ambientGain.gain.value, now);
      this.ambientGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

      const sourcesToStop = [...this.ambientSources];
      const nodesToDisconnect = [...this.ambientNodes];
      this.ambientSources = [];
      this.ambientNodes = [];
      const gainToClean = this.ambientGain;
      this.ambientGain = null;

      setTimeout(() => {
        sourcesToStop.forEach((src) => {
          try {
            src.stop();
          } catch {
            // Pode já ter parado
          }
        });
        nodesToDisconnect.forEach((node) => {
          try {
            node.disconnect();
          } catch {
            // Pode já estar desconectado
          }
        });
        try {
          gainToClean.disconnect();
        } catch {
          // Desconectado
        }
      }, 1300);
    }
  }

  /**
   * Barulho suave e tátil do personagem caminhando sobre a grama:
   * - Farfalhar delicado de folhas/hastes de grama fletindo sob a sola (ruído bandpass ~780-880Hz)
   * - Impacto sutil no solo terroso (~75Hz amortecido)
   * - Cadência orgânica com variação sutil entre o pé esquerdo e direito
   */
  playGrassStep(isLeftFoot = false): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dest = this.masterGain ?? ctx.destination;

    // Variação orgânica sutil entre passadas
    const baseFreq = isLeftFoot ? 790 : 850;
    const jitter = (Math.random() - 0.5) * 60;
    const filterFreq = Math.max(650, Math.min(1050, baseFreq + jitter));

    // 1) Farfalhar de lâminas de grama (ruído filtrado suave)
    const grassNoise = this.createNoiseSource(ctx);
    const grassFilter = ctx.createBiquadFilter();
    grassFilter.type = "bandpass";
    grassFilter.frequency.setValueAtTime(filterFreq, now);
    grassFilter.Q.setValueAtTime(1.9, now);

    const grassGain = ctx.createGain();
    const peakVolume = 0.075 + (Math.random() - 0.5) * 0.015;
    grassGain.gain.setValueAtTime(0.001, now);
    grassGain.gain.linearRampToValueAtTime(peakVolume, now + 0.008);
    grassGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.085);

    grassNoise.connect(grassFilter);
    grassFilter.connect(grassGain);
    grassGain.connect(dest);

    grassNoise.start(now);
    grassNoise.stop(now + 0.09);

    // 2) Amortecimento suave do calçado no solo
    const thudOsc = ctx.createOscillator();
    const thudGain = ctx.createGain();
    thudOsc.type = "sine";
    const thudFreq = isLeftFoot ? 75 : 82;
    thudOsc.frequency.setValueAtTime(thudFreq, now);
    thudOsc.frequency.exponentialRampToValueAtTime(38, now + 0.04);

    thudGain.gain.setValueAtTime(0.038, now);
    thudGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.042);

    thudOsc.connect(thudGain);
    thudGain.connect(dest);

    thudOsc.start(now);
    thudOsc.stop(now + 0.045);
  }

  // ─── HELICÓPTERO DE RESGATE & VITÓRIA ───────────────────────────────
  private heliRotorTimer: ReturnType<typeof setInterval> | null = null;
  private heliProximity = 0.5;

  /**
   * Sirene removida a pedido do usuário (método silencioso para evitar ruídos estridentes).
   */
  playRescueSiren(): void {
    // Sirene desativada conforme solicitado pelo usuário.
  }

  /**
   * Atualiza a intensidade sonora do helicóptero de resgate com base no tempo de aproximação
   * e na altitude durante o pouso.
   *
   * O som da hélice começa logo que o sinalizador é ativado, com volume bem presente
   * à distância (0.45) e cresce gradualmente até a chegada e pouso (1.0).
   */
  setHelicopterApproach(countdownSeconds: number, altitude: number, isLanded = false): void {
    if (isLanded) {
      this.heliProximity = 1.0;
      return;
    }

    if (countdownSeconds > 0) {
      // Fase de aproximação aérea: surge faltando 10 segundos para pousar (10s até 0s)
      const progress = Math.max(0, Math.min(1.0, 1.0 - countdownSeconds / 10.0));
      this.heliProximity = 0.35 + progress * 0.45;
    } else {
      // Fase de descida e pouso: altitude desce de 38m para 0.1m
      const descentFactor = Math.max(0, Math.min(1.0, 1.0 - (altitude - 0.1) / 38.0));
      this.heliProximity = 0.80 + descentFactor * 0.20;
    }
  }

  setHelicopterAltitude(y: number): void {
    const descentFactor = Math.max(0, Math.min(1.0, 1.0 - (y - 0.1) / 38.0));
    this.heliProximity = 0.70 + descentFactor * 0.30;
  }

  /**
   * Inicia o som contínuo, volumoso e pulsante das pás do rotor do helicóptero de resgate.
   */
  startHelicopterSound(): void {
    if (this.heliRotorTimer) return;
    this.playRotorChop();
    this.heliRotorTimer = setInterval(() => {
      this.playRotorChop();
    }, 110); // ~9 batimentos por segundo (ritmo pesado de pás cortando o vento)
  }

  stopHelicopterSound(): void {
    if (this.heliRotorTimer) {
      clearInterval(this.heliRotorTimer);
      this.heliRotorTimer = null;
    }
  }

  /**
   * Pulso acústico característico das pás cortando o ar ("whoosh-thump" visceral e potente).
   */
  private playRotorChop(): void {
    if (!this.ctx || !this.masterGain) return;
    const ctx = this.ctx;
    const dest = this.masterGain;
    const now = ctx.currentTime;

    const prox = Math.max(0.4, Math.min(1.0, this.heliProximity));
    // Volume geral aumentado substancialmente conforme solicitado
    const volume = 0.58 * prox;

    // 1) Golpe subgrave potente do rotor (impacto profundo de pressão de ar)
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(62, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.085);

    gain.gain.setValueAtTime(volume * 0.95, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.095);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.10);

    // 2) Corte de ar da lâmina ("blade-slap" com ruído filtrado de alta intensidade)
    const noise = this.createNoiseSource(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(450 + 750 * prox, now);
    filter.Q.setValueAtTime(3.2, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(volume * 0.85, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.078);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(dest);

    noise.start(now);
    noise.stop(now + 0.082);

    // 3) Zumbido contínuo e característico da turbina turboélice (hum mecânico militar)
    const turbineOsc = ctx.createOscillator();
    const turbineGain = ctx.createGain();
    turbineOsc.type = "triangle";
    turbineOsc.frequency.setValueAtTime(135 + 40 * prox, now);

    turbineGain.gain.setValueAtTime(volume * 0.28, now);
    turbineGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.105);

    turbineOsc.connect(turbineGain);
    turbineGain.connect(dest);
    turbineOsc.start(now);
    turbineOsc.stop(now + 0.11);
  }

  /**
   * Acorde triunfal e fanfarra militar de celebração da vitória ("O JOGO ACABOU - VOCÊS SOBREVIVERAM!").
   */
  playVictoryFanfare(): void {
    if (!this.ctx || !this.masterGain) return;
    const ctx = this.ctx;
    const dest = this.masterGain;
    const now = ctx.currentTime;

    // Progressão triunfante: C4 -> E4 -> G4 -> C5 sustentado
    const notes = [
      { freq: 261.63, delay: 0.0, dur: 0.35 },  // C4
      { freq: 329.63, delay: 0.25, dur: 0.35 }, // E4
      { freq: 392.0, delay: 0.5, dur: 0.45 },   // G4
      { freq: 523.25, delay: 0.8, dur: 1.8 },   // C5 (épico)
      { freq: 659.25, delay: 1.0, dur: 1.6 },   // E5 harmônico
    ];

    notes.forEach((n) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(n.freq, now + n.delay);

      gain.gain.setValueAtTime(0.001, now + n.delay);
      gain.gain.linearRampToValueAtTime(0.2, now + n.delay + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + n.delay + n.dur);

      osc.connect(gain);
      gain.connect(dest);

      osc.start(now + n.delay);
      osc.stop(now + n.delay + n.dur + 0.05);
    });
  }
}





