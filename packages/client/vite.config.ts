import { defineConfig } from "vite";

export default defineConfig({
  server: {
    // Expõe na rede local para amigos na mesma Wi-Fi entrarem pelo link
    host: true,
    port: 5173,
  },
});
