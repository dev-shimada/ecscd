FROM node:24.12.0-trixie-slim AS vscode

ENV LESSCHARSET utf-8

WORKDIR /workspace

RUN <<EOF
apt-get update
apt-get install -y git vim curl procps
npm i -g @anthropic-ai/claude-code
echo "source /usr/share/bash-completion/completions/git" >> ~/.bashrc
EOF
