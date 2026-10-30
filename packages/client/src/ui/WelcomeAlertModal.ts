/**
 * Modal de Alerta Inicial de Sobrevivência:
 * Exibido assim que qualquer jogador entra no mundo pela primeira vez.
 * "A crazy apocalypse is approaching. Read the book left on the table to understand how to survive." [Ok]
 */
export class WelcomeAlertModal {
  private readonly modal = document.getElementById("welcome-modal")!;
  private readonly backdrop = document.getElementById("welcome-modal-backdrop")!;
  private readonly btnOk = document.getElementById("btn-welcome-ok") as HTMLButtonElement;

  private isVisible = false;
  private hasShown = false;

  onClose?: () => void;

  constructor() {
    this.btnOk?.addEventListener("click", () => {
      this.close();
    });

    this.backdrop?.addEventListener("click", () => {
      this.close();
    });

    window.addEventListener("keydown", (e: KeyboardEvent) => {
      if (!this.isVisible) return;
      if (e.code === "Enter" || e.code === "Space" || e.code === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        this.close();
      }
    });
  }

  isOpen(): boolean {
    return this.isVisible;
  }

  show(): void {
    if (this.hasShown) return;
    this.hasShown = true;
    this.isVisible = true;

    this.modal.classList.remove("hidden");
    this.modal.classList.remove("is-leaving");
    this.modal.classList.add("is-visible");

    // Foca o botão Ok para confirmação com teclado imediata
    setTimeout(() => {
      this.btnOk?.focus();
    }, 50);
  }

  close(): void {
    if (!this.isVisible) return;
    this.isVisible = false;
    this.modal.classList.add("is-leaving");

    setTimeout(() => {
      this.modal.classList.remove("is-visible");
      this.modal.classList.remove("is-leaving");
      this.modal.classList.add("hidden");
      this.onClose?.();
    }, 220);
  }

  reset(): void {
    this.hasShown = false;
    this.close();
  }
}
