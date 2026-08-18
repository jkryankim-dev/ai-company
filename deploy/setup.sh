#!/usr/bin/env bash
# 두레 VPS 이사 스크립트 (Ubuntu/Debian 기준)
# 사용법: ai-company 를 클론한 폴더 안에서  bash deploy/setup.sh
set -e
cd "$(dirname "$0")/.."
ROOT="$(pwd)"

echo "== 1/4 Node.js 확인 =="
if ! command -v node >/dev/null 2>&1 || [ "$(node -e 'console.log(+process.versions.node.split(".")[0])')" -lt 20 ]; then
  echo "Node 20+ 설치 중..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
node -v

echo "== 2/4 Claude Code CLI 확인 =="
command -v claude >/dev/null 2>&1 || sudo npm i -g @anthropic-ai/claude-code
claude --version

echo "== 3/4 .env 확인 =="
if [ ! -f .env ]; then
  cp .env.example .env
  echo ""
  echo "  [필요] .env 를 채우세요:  nano $ROOT/.env"
  echo "  (PC 의 doore/.env 내용을 그대로. 단 APP_REPO 는 비우거나 VPS 경로로)"
  echo ""
fi
chmod 600 .env 2>/dev/null || true

echo "== 4/4 systemd 서비스 등록 =="
sudo tee /etc/systemd/system/doore.service >/dev/null <<UNIT
[Unit]
Description=doore AI company
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$ROOT
ExecStart=$(command -v node) $ROOT/runtime/supervisor.mjs
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl daemon-reload
sudo systemctl enable doore

echo ""
echo "완료. .env 를 채운 뒤:"
echo "  sudo systemctl start doore                          # 출근"
echo "  systemctl status doore                              # 상태"
echo "  tail -f $ROOT/runtime/logs/supervisor.log           # 로그"
