/**
 * Tela de Morte / Game Over: exibida quando o jogador perde toda a vida (hp <= 0).
 * Mostra estatísticas da tentativa e um botão de ação imediata "REINICIAR".
 */
export class DeathScreen {
  private readonly root = document.getElementById("death-screen")!;
  private readonly titleVal = document.getElementById("death-title")!;
  private readonly taglineVal = document.getElementById("death-tagline")!;
  private readonly btnRestart = document.getElementById("btn-restart") as HTMLButtonElement;
  private readonly btnRestartText = document.getElementById("btn-restart-text")!;
  private readonly btnLobby = document.getElementById("btn-death-lobby") as HTMLButtonElement;
  private readonly waitingBadge = document.getElementById("death-waiting-revive")!;
  private readonly timeVal = document.getElementById("death-time")!;
  private readonly hordeVal = document.getElementById("death-horde")!;
  private readonly coinsVal = document.getElementById("death-coins")!;
  private readonly tipVal = document.getElementById("death-tip")!;

  onRestart: (() => void) | null = null;
  onLobby: (() => void) | null = null;

  private isHiding = false;
  private canRestart = true;

  constructor() {
    this.btnRestart.addEventListener("click", () => {
      this.triggerRestart();
    });

    this.btnLobby.addEventListener("click", () => {
      if (this.onLobby) {
        this.onLobby();
      } else {
        window.location.reload();
      }
    });

    // Atalhos de teclado quando a tela de morte estiver aberta (só reinicia se todos tiverem morrido)
    window.addEventListener("keydown", (e) => {
      if (!this.isVisible() || this.isHiding) return;
      if (e.code === "Space" || e.code === "Enter") {
        if (!this.canRestart) return;
        e.preventDefault();
        e.stopPropagation();
        this.triggerRestart();
      }
    });
  }

  show(survivalTime: string, hordeText: string, coins: number, hasLivingAllies = false): void {
    this.isHiding = false;
    this.timeVal.textContent = survivalTime;
    this.hordeVal.textContent = hordeText;
    this.coinsVal.textContent = `🪙 ${coins}`;

    this.updateMode(hasLivingAllies);

    this.root.classList.remove("hidden");
    this.root.classList.remove("is-leaving");
    this.root.classList.add("is-visible");
  }

  updateMode(hasLivingAllies: boolean): void {
    this.canRestart = !hasLivingAllies;
    if (hasLivingAllies) {
      this.titleVal.textContent = "YOU ARE DOWN";
      this.taglineVal.textContent = "Your body is down on the ground. A teammate can revive you with a Defibrillator!";
      this.waitingBadge?.classList.remove("hidden");
      this.btnRestart.classList.add("hidden");
      this.btnRestart.disabled = true;
      this.tipVal.innerHTML = "⚡ A teammate can buy a Defibrillator at the shop for 🪙 30 to revive you";
      this.root.classList.add("death-screen--waiting-revive");
    } else {
      this.titleVal.textContent = "YOU DIED";
      this.taglineVal.textContent = "The whole squad was eliminated in the shadows...";
      this.waitingBadge?.classList.add("hidden");
      this.btnRestart.classList.remove("hidden");
      this.btnRestart.disabled = false;
      this.btnRestartText.textContent = "RESTART MATCH";
      this.tipVal.innerHTML = "Press <kbd>SPACE</kbd> or <kbd>ENTER</kbd> to restart match";
      this.root.classList.remove("death-screen--waiting-revive");
    }
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
    if (this.isHiding || !this.canRestart) return;
    this.btnRestart.disabled = true;
    this.onRestart?.();
  }
}
