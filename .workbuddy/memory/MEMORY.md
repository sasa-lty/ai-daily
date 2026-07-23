# kkai 项目长期备忘

## 项目：AI Daily Radar（个人 AI 日报）v2
- 技术栈：Vite 5 + React 18 + TypeScript + Tailwind 3 + ECharts 5；无后端，纯静态。
- 架构：hash 路由双视图（`#/news` 今日热点、`#/models` 模型洞察），自写 src/lib/useHashRoute.ts；桌面双栏仪表盘，移动单列。
- 数据流：`npm run update` → src/data/daily.json；`npm run update:arena` → src/data/arena-leaderboard.json；`npm run update:all` 两条。
- 新闻：sources.json 支持 `type: "digest"` 日报型来源（Juya），脚本拆解为单条新闻、域名推断原始发布方（publisherFromUrl），聚合域名 → "综合来源"；日报容器永不入列表（BANNED_TITLE 防御层）。
- LLM：严格 JSON 协议（verdict/topStoryIds/items 含 keyFacts/sourceDisplayName/confidenceReason），校验失败回退规则模式；日报纯文本仅作 editorialReference。
- 模型数据：LMArena 官方数据集（HF Dataset Viewer /rows API，6 config 的 latest split）；agent 榜 schema 不同（score 系列字段、0-1 量纲）；跨榜模型归一需折叠配置词（thinking/high/xhigh/max 等）；综合指数=榜内百分位加权，权重预设公开，<3 维不排，明确标注非官方总分。
- 部署：GitHub Actions（.github/workflows/daily-update.yml），cron `30 0 * * *`（北京时间 08:30），新闻+榜单同 workflow，自动 commit 并部署 Pages；vite base `./`。
- 脚本永远 exit 0；daily.json 状态四态 ai/rule/cache/error；arena 两态 ok/cache。
- 本机运行 npm 前需：`export PATH="/c/Users/Lenovo/.workbuddy/binaries/node/versions/22.22.2:$PATH"`。

## 环境备忘（跨项目有用）
- agent-browser 在 Windows Git Bash 下要用原生 exe：
  `~/.workbuddy/binaries/node/workspace/node_modules/agent-browser/bin/agent-browser-win32-x64.exe`
  （.cmd shim 与 node 调用均失败）；截图路径用 Windows 格式；视口命令 `set viewport <w> <h>`；
  任务被 kill 后需按 CommandLine 含 `.agent-browser` 清理孤儿进程再重试。
- fast-xml-parser 解析部分 RSS 需 `processEntities: false` 避开实体扩展上限。
- 沙箱无法直连 huggingface.co / LLM API；需要 HF 数据时可用 WebFetch 工具通道取数。
