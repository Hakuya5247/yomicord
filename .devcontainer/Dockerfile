FROM node:24-bookworm

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@latest-10

# codex 用ディレクトリを「イメージ内で」作って node 所有にする
RUN mkdir -p /codex \
  && chown -R node:node /codex \
  && chmod 700 /codex \
  && touch /codex/.keep

USER node
WORKDIR /workspaces
