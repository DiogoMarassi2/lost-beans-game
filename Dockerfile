# Servidor do Lost Beans (Colyseus) — usado pelo Render (render.yaml).
# O servidor roda direto do TypeScript com tsx, usando o pacote compartilhado do workspace.
FROM node:22-alpine
WORKDIR /app

# Instala dependências do workspace (camada em cache enquanto os package.json não mudarem)
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/
RUN npm ci

# Código do servidor e do pacote compartilhado
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY packages/server packages/server

ENV NODE_ENV=production
ENV PORT=2567
EXPOSE 2567
# Roda de dentro do pacote para o tsx usar o tsconfig do servidor (decorators do Colyseus)
WORKDIR /app/packages/server
CMD ["node", "--import", "tsx", "src/index.ts"]
