#!/bin/zsh

set -euo pipefail

APP_ROOT="${0:A:h}"
BACKEND_DIR="$APP_ROOT/backend-node"
FRONTEND_DIR="$APP_ROOT/frontweb"
CHECK_ONLY=0

if [[ "${1:-}" == "--check" ]]; then
  CHECK_ONLY=1
fi

fail() {
  print -u2 "\n启动失败：$1"
  print -u2 "请安装 Node.js 22 LTS，或设置 AI_DRAMA_NODE 指向 Node 20/22 的可执行文件。"
  exit 1
}

node_major() {
  "$1" -p "Number(process.versions.node.split('.')[0])" 2>/dev/null || true
}

find_node() {
  local candidate major nvm_node

  if [[ -n "${AI_DRAMA_NODE:-}" ]]; then
    candidate="$AI_DRAMA_NODE"
    [[ -x "$candidate" ]] || fail "AI_DRAMA_NODE 不可执行：$candidate"
    major="$(node_major "$candidate")"
    [[ "$major" == "20" || "$major" == "22" ]] || fail "AI_DRAMA_NODE 必须是 Node 20 或 22，当前为 Node $major"
    print -r -- "$candidate"
    return
  fi

  if [[ -s "$HOME/.nvm/nvm.sh" ]]; then
    nvm_node="$(NVM_DIR="$HOME/.nvm" zsh -c 'source "$NVM_DIR/nvm.sh" >/dev/null 2>&1; nvm which 22 2>/dev/null' || true)"
    if [[ -x "$nvm_node" ]]; then
      print -r -- "$nvm_node"
      return
    fi
    nvm_node="$(NVM_DIR="$HOME/.nvm" zsh -c 'source "$NVM_DIR/nvm.sh" >/dev/null 2>&1; nvm which 20 2>/dev/null' || true)"
    if [[ -x "$nvm_node" ]]; then
      print -r -- "$nvm_node"
      return
    fi
  fi

  for candidate in \
    /opt/homebrew/opt/node@22/bin/node \
    /usr/local/opt/node@22/bin/node \
    /opt/homebrew/opt/node@20/bin/node \
    /usr/local/opt/node@20/bin/node \
    "$(command -v node 2>/dev/null || true)"; do
    [[ -n "$candidate" && -x "$candidate" ]] || continue
    major="$(node_major "$candidate")"
    if [[ "$major" == "20" || "$major" == "22" ]]; then
      print -r -- "$candidate"
      return
    fi
  done

  fail "没有找到兼容的 Node.js 20/22 运行时"
}

NODE_BIN="$(find_node)"
NODE_DIR="${NODE_BIN:h}"
NODE_PREFIX="${NODE_DIR:h}"
NPM_CLI="$NODE_PREFIX/lib/node_modules/npm/bin/npm-cli.js"

[[ -f "$NPM_CLI" ]] || fail "在所选 Node 旁未找到 npm：$NPM_CLI"

# npm lifecycle 中的 `node` 也必须解析到同一个运行时，避免原生模块 ABI 混用。
export PATH="$NODE_DIR:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

NODE_VERSION="$($NODE_BIN -p 'process.version')"
NODE_ABI="$($NODE_BIN -p 'process.versions.modules')"
NPM_VERSION="$($NODE_BIN "$NPM_CLI" --version)"

print "AI 短剧工作台"
print "运行时：$NODE_VERSION (ABI $NODE_ABI)"
print "npm：$NPM_VERSION"

check_sqlite() {
  (
    cd "$BACKEND_DIR"
    "$NODE_BIN" -e "require('better-sqlite3'); const db = require('better-sqlite3')(':memory:'); db.prepare('select 1').get(); db.close()"
  ) >/dev/null 2>&1
}

if (( CHECK_ONLY )); then
  check_sqlite || fail "better-sqlite3 与 $NODE_VERSION 不兼容；请运行 ./start_app.command 自动修复"
  print "SQLite 原生模块：兼容"
  print "运行时自检通过。"
  exit 0
fi

if [[ ! -d "$BACKEND_DIR/node_modules" ]]; then
  print "首次启动：正在安装后端依赖…"
  (cd "$BACKEND_DIR" && "$NODE_BIN" "$NPM_CLI" ci)
elif ! check_sqlite; then
  print "检测到 SQLite ABI 不匹配，正在按 $NODE_VERSION 重建…"
  (cd "$BACKEND_DIR" && "$NODE_BIN" "$NPM_CLI" rebuild better-sqlite3)
fi

check_sqlite || fail "better-sqlite3 重建后仍无法加载"
print "SQLite 原生模块：兼容"

if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
  print "首次启动：正在安装前端依赖…"
  (cd "$FRONTEND_DIR" && "$NODE_BIN" "$NPM_CLI" ci)
fi

DIST_INDEX="$FRONTEND_DIR/dist/index.html"
NEEDS_BUILD=0
if [[ ! -f "$DIST_INDEX" ]]; then
  NEEDS_BUILD=1
elif find "$FRONTEND_DIR/src" -type f -newer "$DIST_INDEX" -print -quit | grep -q .; then
  NEEDS_BUILD=1
elif [[ "$FRONTEND_DIR/package.json" -nt "$DIST_INDEX" || "$FRONTEND_DIR/vite.config.js" -nt "$DIST_INDEX" ]]; then
  NEEDS_BUILD=1
fi

if (( NEEDS_BUILD )); then
  print "正在构建前端…"
  (cd "$FRONTEND_DIR" && "$NODE_BIN" "$NPM_CLI" run build)
fi

print "\n应用即将启动：http://localhost:5679/create"
print "按 Ctrl+C 可停止。\n"

if [[ "${AI_DRAMA_NO_OPEN:-0}" != "1" ]]; then
  (sleep 2; open "http://localhost:5679/create" >/dev/null 2>&1 || true) &
fi

cd "$BACKEND_DIR"
exec "$NODE_BIN" src/server.js
