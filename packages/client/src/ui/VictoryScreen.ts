/**
 * Tela de Vitória / Resgate Concluído: exibida quando os jogadores alcançam o helicóptero
 * e a simulação autoritativa define `state.gameWon = true`.
 * "O usuário deve correr para esse helicoptero junto com seu amigo. Se os 2 chegarem, aparece uma mensagem que o jogo acabou."
 */
export class VictoryScreen {
  private readonly root = document.getElementById("victory-screen")!;
  private readonly titleVal = document.getElementById("victory-title")!;
  private readonly descVal = document.getElementById("victory-desc")!;
  private readonly timeVal = document.getElementById("victory-time")!;
  private readonly hordeVal = document.getElementById("victory-horde")!;
  private readonly coinsVal = document.getElementById("victory-coins")!;
  private readonly btnRestart = document.getElementById("btn-victory-restart") as HTMLButtonElement;
  private readonly btnLobby = document.getElementById("btn-victory-lobby") as HTMLButtonElement;

  onRestart: (() => void) | null = null;
  onLobby: (() => void) | null = null;

  private isHiding = false;

  constructor() {
    this.btnRestart?.addEventListener("click", () => {
      this.triggerRestart();
    });

    this.btnLobby?.addEventListener("click", () => {
      if (this.onLobby) {
        this.onLobby();
      } else {
        window.location.reload();
      }
    });

    // Atalhos de teclado quando a tela de vitória estiver visível
    window.addEventListener("keydown", (e) => {
      if (!this.isVisible() || this.isHiding) return;
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        this.triggerRestart();
      }
    });
  }

  show(survivalTime: string, hordeText: string, coins: number, customMessage?: string, customTitle?: string): void {
    this.isHiding = false;
    if (this.titleVal) this.titleVal.textContent = customTitle ?? "O JOGO ACABOU!";
    if (this.timeVal) this.timeVal.textContent = survivalTime;
    if (this.hordeVal) this.hordeVal.textContent = hordeText;
    if (this.coinsVal) this.coinsVal.textContent = `🪙 ${coins}`;

    if (customMessage && this.descVal) {
      this.descVal.textContent = customMessage;
    }

    this.root.classList.remove("hidden");
    this.root.classList.remove("is-leaving");
    this.root.classList.add("is-visible");
  }

  hide(): void {
    if (this.isHiding) return;
    this.isHiding = true;
    this.root.classList.remove("is-visible");
    this.root.classList.add("is-leaving");

    window.setTimeout(() => {
      this.root.classList.add("hidden");
      this.root.classList.remove("is-leaving");
      this.isHiding = false;
    }, 450);
  }

  isVisible(): boolean {
    return !this.root.classList.contains("hidden");
  }

  private triggerRestart(): void {
    if (this.isHiding) return;
    this.hide();
    if (this.onRestart) {
      this.onRestart();
    }
  }
}
