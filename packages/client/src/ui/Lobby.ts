import { PLAYER_NAME_MAX } from "@dark-beans/shared";

const NAME_KEY = "dark-beans:name";

/**
 * Tela de entrada: apelido (lembrado no localStorage) e botão de entrar na sala do link.
 */
export class Lobby {
  private readonly root = document.getElementById("lobby")!;
  private readonly form = document.getElementById("lobby-form") as HTMLFormElement;
  private readonly input = document.getElementById("input-name") as HTMLInputElement;
  private readonly button = document.getElementById("btn-play") as HTMLButtonElement;
  private readonly buttonText = this.button.querySelector(".btn__text")!;
  private readonly error = document.getElementById("lobby-error")!;

  constructor(code: string, onSubmit: (name: string) => Promise<void>) {
    document.getElementById("lobby-room-code")!.textContent = code;
    this.input.maxLength = PLAYER_NAME_MAX;
    this.input.value = localStorage.getItem(NAME_KEY) ?? "";
    this.input.focus();

    this.form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = this.input.value.trim().slice(0, PLAYER_NAME_MAX);
      localStorage.setItem(NAME_KEY, name);
      this.setBusy(true);
      this.error.textContent = "";
      try {
        await onSubmit(name);
        this.hide();
      } catch (err) {
        console.error(err);
        this.error.textContent = "Não foi possível conectar ao servidor. Ele está rodando?";
        this.setBusy(false);
      }
    });
  }

  private setBusy(busy: boolean): void {
    this.button.disabled = busy;
    this.buttonText.textContent = busy ? "Entrando na escuridão…" : "Entrar na arena";
  }

  private hide(): void {
    this.root.classList.add("is-leaving");
    window.setTimeout(() => this.root.classList.add("hidden"), 650);
  }
}
