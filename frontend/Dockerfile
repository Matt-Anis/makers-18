FROM node:24-bookworm-slim

WORKDIR /app
RUN chown node:node /app
USER node

ENV NEXT_TELEMETRY_DISABLED=1
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci
COPY --chown=node:node . .
RUN npm run build

CMD ["./node_modules/.bin/next", "start", "--hostname", "0.0.0.0"]
