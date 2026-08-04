#!/bin/sh
# 用项目要求的 Node 版本启动 Vite dev server。
# 仓库要求 Node 22（见 .node-version），而当前机器的默认 node 是 v16，
# 直接 npm run dev:web 会在 rolldown 处因 node:util 缺少 styleText 而启动失败。
export PATH="$HOME/.nvm/versions/node/v22.22.1/bin:$PATH"
exec npm run dev:web
