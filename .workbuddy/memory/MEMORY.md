# kkai 项目长期备忘

## 项目：AI Daily Radar（个人 AI 日报）
- 技术栈：Vite 5 + React 18 + TypeScript + Tailwind 3 + ECharts 5；无后端，纯静态。
- 数据流：`npm run update`（scripts/update-daily.ts）抓 RSS → `src/data/daily.json`；页面 import 该 JSON。
- 模型评分手动维护在 `src/data/model-scores.json`（source=manual）；新闻来源在 `src/data/sources.json`（Juya 为默认首选）。
- LLM 增强可选：KIMI_API_KEY / OPENAI_API_KEY / LLM_BASE_URL / LLM_MODEL；无 key 走规则模式；API 失败自动回退。
- 部署：GitHub Actions（.github/workflows/daily-update.yml），cron `30 0 * * *`（北京时间 08:30），
  自动 commit daily.json 并部署 Pages；vite base 必须为 `./`。
- 脚本永远 exit 0（保证 Actions 不中断）；daily.json 状态四态：ai/rule/cache/error。
- 本机运行 npm 前需：`export PATH="/c/Users/Lenovo/.workbuddy/binaries/node/versions/22.22.2:$PATH"`。

## 环境备忘（跨项目有用）
- agent-browser 在 Windows Git Bash 下要用原生 exe：
  `~/.workbuddy/binaries/node/workspace/node_modules/agent-browser/bin/agent-browser-win32-x64.exe`
  （.cmd shim 与 node 调用均失败）；截图路径用 Windows 格式；视口命令 `set viewport <w> <h>`。
- fast-xml-parser 解析部分 RSS 需 `processEntities: false` 避开实体扩展上限。
