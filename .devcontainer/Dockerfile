FROM node:24-bookworm

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@latest-10

USER node
WORKDIR /workspaces