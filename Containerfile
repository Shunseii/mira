# Mira sync server + PWA. Works with both `docker build` and `podman build`.
#   podman build -t mira-server -f Containerfile .
#   docker build -t mira-server -f Containerfile .

FROM docker.io/library/node:22-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/mobile/package.json apps/mobile/
RUN pnpm install --frozen-lockfile
COPY packages packages
COPY apps apps
RUN pnpm --filter @mira/server build
RUN pnpm --filter @mira/mobile build:web

FROM docker.io/library/node:22-alpine
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8787 \
    MIRA_DATA_DIR=/data \
    MIRA_WEB_DIR=/app/web \
    NODE_NO_WARNINGS=1
WORKDIR /app
COPY --from=build /repo/apps/server/dist/ ./
COPY --from=build /repo/apps/mobile/dist/ ./web/
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "server.mjs"]
