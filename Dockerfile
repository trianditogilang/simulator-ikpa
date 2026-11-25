# Simulator IKPA — Nitro node-server image (ADR-008, MIG-02).
# Node 22 matches the CI quality gate; glibc base matches the lockfile CI uses.

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY . .
RUN npm ci
RUN npm run build

# `docker compose run --rm migrate` uses the build stage (drizzle-kit lives there).

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
# .output is standalone: Nitro traces runtime dependencies into it.
COPY --from=build /app/apps/web/.output ./.output
USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
