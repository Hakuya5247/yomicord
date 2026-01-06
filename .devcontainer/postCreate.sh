#!/usr/bin/env bash
set -e

echo "[postCreate] セットアップを開始します"

# -----------------------------
# npm global prefix（権限対策）
# -----------------------------
echo "[postCreate] npm のグローバルインストール先を設定します"
mkdir -p "$HOME/.npm-global"
npm config set prefix "$HOME/.npm-global"

if ! grep -q '.npm-global/bin' "$HOME/.bashrc"; then
  echo 'export PATH="$HOME/.npm-global/bin:$PATH"' >> "$HOME/.bashrc"
fi

export PATH="$HOME/.npm-global/bin:$PATH"

# -----------------------------
# Codex CLI
# -----------------------------
echo "[postCreate] Codex CLI をインストールします"
npm install -g @openai/codex@latest
codex --version || echo "[postCreate] Codex はインストール済み（未ログインの可能性あり）"

# -----------------------------
# pnpm install（条件付き）
# -----------------------------
echo "[postCreate] pnpm install を実行します（package.json がある場合のみ）"
if [ -f package.json ]; then
  pnpm install
else
  echo "[postCreate] package.json が存在しないため pnpm install をスキップします"
fi

echo "[postCreate] セットアップが完了しました"
