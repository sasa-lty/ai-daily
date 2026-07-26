# AI Daily Radar · 个人 AI 情报台

每天打开一次，3 分钟看完 AI 圈重点。两个一级视图：

- **今日热点**（`#/news`）：今日总览、今日三件事、热点列表、新闻来源
- **模型洞察**（`#/models`）：综合比较（散点 + 综合排名）、模型画像（六维雷达）、分维度排名（六张 Top 10）

核心特性：

- 纯静态网页，**不需要服务器、不需要数据库**
- GitHub Actions 每天**北京时间 08:30** 自动更新新闻与榜单
- **不配置任何 API key 也能正常运行**（规则摘要模式）；配置 `KIMI_API_KEY` 或 `OPENAI_API_KEY` 后自动升级为 AI 增强（中文标题、关键事实、具体影响、LLM 评选三件事）
- 日报型来源（如 Juya）会被拆解成单条新闻并标注原始发布方，日报容器不会出现在列表里
- 模型数据来自 LMArena 官方数据集（每日刷新），不做手工评分；跨榜比较用**榜内 σ 标定**，不平均原始分
- 每天的新闻快照留档在 `src/data/history/YYYY-MM-DD.json`
- 更新失败时自动显示上一次成功的数据，页面永远不会空白

---

## 一、本地运行（先在自己电脑上看效果）

### 1. 安装 Node.js（只做一次）

1. 打开 https://nodejs.org/ ，下载 **LTS** 版本（22 或更高）。
2. 一路下一步安装。
3. 验证：按 `Win + R`，输入 `cmd` 回车，在黑窗口里输入：
   ```
   node -v
   ```
   显示 `v22.x.x` 即成功。

### 2. 启动网页

在本项目文件夹的地址栏输入 `cmd` 回车，然后依次执行：

```
npm install
npm run dev
```

看到 `Local: http://localhost:5173/` 后，用浏览器打开 **http://localhost:5173/** 即可。
按 `Ctrl + C` 可以停止。

### 3. 手动更新数据（可选）

```
npm run update         # 抓取新闻 RSS -> src/data/daily.json
npm run update:arena   # 拉取 Arena 榜单 -> src/data/arena-leaderboard.json
npm run update:all     # 两条都跑
```

没有任何 API key 也能成功；数据源失败时自动保留上一次缓存。

其余命令：`npm run build`（类型检查 + 打包到 `dist/`）、`npm run preview`（本地预览打包结果）。

---

## 二、部署到 GitHub Pages（每天自动更新，手机上也能看）

只需要做一次，大约 10 分钟。

### 第 1 步：把代码放到 GitHub

方式 A（推荐，安装过 Git）：

```
git init
git add .
git commit -m "init: ai daily radar"
```

然后去 https://github.com/new 新建一个仓库（例如叫 `ai-daily`，**不要**勾选 README），按页面提示执行：

```
git remote add origin https://github.com/你的用户名/ai-daily.git
git branch -M main
git push -u origin main
```

方式 B（不想装 Git）：在新建仓库页面点 **uploading an existing file**，把本项目所有文件拖进去上传（注意要包含 `.github` 文件夹）。

### 第 2 步：开启 Pages

1. 打开仓库页面 → 顶部 **Settings** → 左侧 **Pages**。
2. **Source** 选择 **GitHub Actions**（不是 Deploy from a branch）。

### 第 3 步：手动跑一次

1. 仓库顶部 **Actions** → 左侧点 **Daily Update**。
2. 右上角 **Run workflow** → 绿色 **Run workflow** 按钮。
3. 等 2-3 分钟变成绿色勾。

### 第 4 步：打开你的网页

```
https://你的用户名.github.io/ai-daily/
```

以后每天北京时间 08:30 自动更新。两个视图可以直接收藏：`#/news` 和 `#/models`。

---

## 三、可选：开启 AI 摘要增强（推荐）

不配也能用；配了之后变化明显：

- 标题改写为自然中文（不保留截断英文）
- 每条输出 70-120 字摘要 + 2-3 条关键事实 + 具体影响
- 今日三件事由 LLM 综合行业影响、新鲜度、可靠性重新评选（不再是分数前三）
- 页面状态显示「AI 增强」

### 在 GitHub 上配置（推荐）

1. 获取一个 API key：Kimi 到 https://platform.moonshot.cn/ ，或 OpenAI 到 https://platform.openai.com/ 。
2. 仓库 **Settings** → 左侧 **Secrets and variables** → **Actions** → **New repository secret**：
   - Name 填 `KIMI_API_KEY`（或 `OPENAI_API_KEY`），Secret 填你的 key。
3. 再手动 **Run workflow** 一次即生效。

### 在本地配置

把 `.env.example` 复制一份改名为 `.env`，填入 key，再运行 `npm run update`。

> 换模型/换接口：用 `LLM_BASE_URL`、`LLM_MODEL` 两个变量覆盖默认值（支持任何 OpenAI 兼容接口）。
> API 失败时自动回退规则模式，不会导致更新失败。密钥只放 Secrets / 本地 .env，绝不写进代码。

---

## 四、想改内容，只动这一个文件

| 想改什么 | 改哪里 | 说明 |
|---|---|---|
| 新闻来源 | `src/data/sources.json` | `type=rss` 普通来源；`type=digest` 日报型来源（自动拆解，容器不进列表）。单个源失败不影响整体 |

模型榜单**不需要手动维护**：每天自动从 LMArena 官方数据集（https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset ）拉取六个维度（综合文本 / Agent 执行 / WebDev编码 / 视觉理解 / 文档理解 / 搜索研究）的最新排名，含置信区间与票数。

### 「本站综合指数」是怎么算的

不同榜单量纲不同（Elo 千分制 / 0-1 分），所以既不直接平均原始分，也不用名次百分位（名次百分位会把"Top10 只差 4.9σ"和"Top10 差 13.6σ"画成同一个样子）。实际做法分三步，页面上也写着同样的公式：

1. **榜内 σ 标定**：σ 取该榜所有模型 95% 置信区间半宽的中位数，`维度得分 = max(25, 100 − 5 × 落后榜首的 σ 数)`。榜首恒为 100，含义是"落后榜首几个标准差"。
2. **按预设加权**：四个权重预设（综合 / 编程 Agent / 搜索研究 / 多模态），权重值在页面上公开。
3. **向先验收缩**：`index = (Σ w·s + w₀·prior) / (Σ w + w₀)`，`w₀ = 1.5`，prior 取池内所有维度得分的中位数。只测了两三个维度的模型不会靠少数强项冲到榜首，也不会因缺维度被判 0。

覆盖不足 2 个维度的模型不进入综合排名。模型画像的雷达图用实线画实测维度、虚线画按该维度中位数补齐的缺失维度，表达"不知道"而不是"等于 0"。散点图 X 轴固定用六维等权综合指数（与当前预设无关，保证坐标含义稳定），Y 轴为 Agent 执行得分，点大小 = 投票量、颜色 = 机构。

该指数是本站的计算结果，**不是 Arena 官方总分**。参数都在 [src/lib/arena.ts](src/lib/arena.ts) 顶部，可以直接改。

---

## 五、常见问题

**Q：今天页面没更新？**
A：仓库 → **Actions** → **Daily Update** → **Run workflow** 手动跑一次。定时任务用 UTC `30 0 * * *`（北京时间 08:30），偶尔有几分钟延迟。

**Q：Actions 显示红色叉？**
A：点进去看日志。多半是某个 RSS 源或榜单接口临时故障——只要不是全部失败，更新仍会成功；全部失败时页面自动显示上一次的数据（新闻区显示「使用缓存」，榜单区显示缓存日期），不用处理。

**Q：页面顶部的状态标签是什么意思？**
A：`AI 增强` = 摘要经过大模型改写；`规则整理` = 未配置 key 或 AI 失败；`使用缓存` = 本次抓取失败，显示上次数据；`更新失败` = 抓取失败且无缓存，显示标注 sample 的示例数据。

**Q：为什么榜单里的 "Claude Opus 4.7 (Thinking)" 在综合排名里只有一行？**
A：跨榜比较需要同一个模型在六张榜上能对上号，所以名称会归一化：括号内容展开，`thinking / high / xhigh / max / medium / low / codex` 等推理配置词折叠，同一模型家族合并为一条（展示名取最短的写法）。`search / grounding / preview` 这类功能变体保留区分。

**Q：某个模型只在两三张榜上出现，会不会排名虚高？**
A：不会。综合指数会向池内中位数收缩（见上文第三步），维度覆盖少的模型会被拉回中间；覆盖不足 2 维直接不参与排名。卡片上标了「覆盖 n/6 维」，雷达图的虚线部分就是估算值。

**Q：为什么看不到"某某日报 · 某日期"这样的条目？**
A：日报型来源（如 Juya）只作编辑参考，脚本会把每期拆解成单条新闻并链接到原始发布方；无法可靠识别原始出处时标注「综合来源」，不伪造来源。

**Q：要花多少钱？**
A：GitHub Pages 和 Actions（公开仓库）免费。不配 API key 零费用；配了 key 每天一次调用约几分钱。

**Q：手机上能看吗？**
A：能，两个视图都是响应式的，手机端自动切换为单列。

---

## 六、项目结构（想深入了解再看）

```
src/
  App.tsx                 hash 路由入口（#/news、#/models）
  views/
    NewsView.tsx          今日热点：三件事 + 总览 / 列表 + 来源（桌面双栏仪表盘）
    ModelsView.tsx        模型洞察：综合比较 → 模型画像 → 分维度排名
  components/
    CompositePanel.tsx    能力定位散点 + 综合指数排名（含公式说明）
    ModelProfileCard.tsx  单模型六维雷达（实测实线 / 估算虚线）
    BoardRankChart.tsx    单榜 Top 10 横向排名
    Header/Footer/DailySummary/TopStories/NewsList/SourcesPanel/EChart/SectionTitle
  data/
    daily.json            每日新闻（脚本生成，勿手改）
    arena-leaderboard.json Arena 榜单（脚本生成，勿手改）
    history/              每日新闻快照 YYYY-MM-DD.json（脚本生成）
    sources.json          新闻来源配置
  lib/
    arena.ts              名称归一 / σ 标定 / 先验收缩 / 权重预设
    types.ts ui.ts useHashRoute.ts
scripts/
  update-daily.ts         抓取 RSS/日报拆解 -> 去重 -> 分类评分 -> 可选 LLM 增强
  enhance-with-llm.ts     严格 JSON 协议（三件事评选/中文标题/关键事实/具体影响）
  update-arena.ts         拉取 Arena 官方数据集 latest 快照，失败回退缓存
.github/workflows/
  daily-update.yml        每天 08:30（北京时间）更新新闻 + 榜单并部署
```

技术栈：Vite + React + TypeScript + Tailwind CSS + ECharts。

## 七、内容来源与边界

- 新闻来自 `sources.json` 中的公开 RSS，每条真实新闻均附原始链接；日报型来源仅学习其编辑判断与文字风格，**不复制其原文**，日报容器不作为新闻展示。
- 模型数据来自 LMArena 官方 Hugging Face 数据集，页面展示发布日期、置信区间与票数；不使用任何手工评分，不使用未确认来源的数据。
- 雷达图表达方式（模型画像）参考图灵坐标/浪浪妈的"单模型多边形 + 指出长短板"思路，**评分数据未取自其视频**。
