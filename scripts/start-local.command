#!/bin/bash
set -euo pipefail
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
NODE_BIN="${DRAMA_NODE_BIN:-/opt/homebrew/opt/node@22/bin/node}"
if [[ ! -x "$NODE_BIN" ]]; then
  echo "未找到 Node 22：$NODE_BIN。请安装 Node 22，或通过 DRAMA_NODE_BIN 指定路径。"
  exit 1
fi
if lsof -nP -iTCP:5679 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "5679 已被占用；不重复启动或终止未知进程。"
  if ! curl --max-time 5 -fsS http://localhost:5679/health; then
    echo "端口被占用但健康检查失败，请检查原服务终端日志。"
    exit 2
  fi
  echo
  exit 0
fi
cd "$PROJECT_DIR/backend-node"
"$NODE_BIN" -e "require('better-sqlite3')(':memory:').close()"
if [[ ! -f "$PROJECT_DIR/frontweb/dist/index.html" ]]; then
  echo "请先构建前端：cd frontweb && npm run build"
  exit 1
fi
echo "工作台：http://localhost:5679。请保持此终端开启；Ctrl+C 停止，再运行此脚本即可重启。"
exec "$NODE_BIN" src/server.js
