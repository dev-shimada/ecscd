FROM node:lts-trixie-slim AS vscode

WORKDIR /workspace

RUN <<EOF
apt-get update
apt-get install -y git vim curl
npm i -g @anthropic-ai/claude-code
EOF
COPY . .
