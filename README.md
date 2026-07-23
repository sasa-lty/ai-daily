# AI Daily Radar · 个人 AI 情报台

每天打开一次，3 分钟看完 AI 圈重点：今日三件事、热点列表、模型雷达图、热点梯度图。

- 纯静态网页，**不需要服务器、不需要数据库**
- 由 GitHub Actions 每天**北京时间 08:30** 自动抓取 RSS 并更新
- **不配置任何 API key 也能正常运行**（规则摘要模式）；配置 `KIMI_API_KEY` 或 `OPENAI_API_KEY` 后自动升级为 AI 增强摘要
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

在本项目文件夹的地址栏输入 `cmd` 回车（会在当前目录打开命令行），然后依次执行：

```
npm install
npm run dev
```

看到 `Local: http://localhost:5173/` 后，用浏览器打开 **http://localhost:5173/** 即可看到页面。
按 `Ctrl + C` 可以停止。

### 3. 手动抓取一次最新新闻（可选）

```
npm run update
```

会重新抓取 RSS，生成/更新 `src/data/daily.json`。没有任何 API key 也能成功。

---

## 二、部署到 GitHub Pages（以后每天自动更新，手机上也能看）

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

地址是：

```
https://你的用户名.github.io/ai-daily/
```

（仓库名不同则替换 `ai-daily`。）以后每天北京时间 08:30 会自动更新，你只管用浏览器打开看。

> 如果 Actions 页面提示 "Workflows aren't being run on this repository"，按提示点一次启用即可。

---

## 三、可选：开启 AI 摘要增强（文字更自然）

不配也能用；配了之后，摘要、"为什么重要"、今日总评会由大模型改写，页面状态显示「AI 增强」。

### 在 GitHub 上配置（推荐）

1. 获取一个 API key：Kimi 到 https://platform.moonshot.cn/ ，或 OpenAI 到 https://platform.openai.com/ 。
2. 仓库 **Settings** → 左侧 **Secrets and variables** → **Actions** → **New repository secret**：
   - Name 填 `KIMI_API_KEY`（或 `OPENAI_API_KEY`），Secret 填你的 key。
3. 再手动 **Run workflow** 一次即生效。

### 在本地配置

把 `.env.example` 复制一份改名为 `.env`，填入 key，再运行 `npm run update`。

> 换模型/换接口：可用 `LLM_BASE_URL`、`LLM_MODEL` 两个变量覆盖默认值（支持任何 OpenAI 兼容接口，如 DeepSeek）。
> API 失败时会自动回退到规则摘要，不会导致更新失败。

---

## 四、想改内容，只动这两个文件

| 想改什么 | 改哪里 | 说明 |
|---|---|---|
| 新闻来源 | `src/data/sources.json` | 数组里增删 RSS 即可，单个源失败不影响整体 |
| 模型雷达图 | `src/data/model-scores.json` | 模型名单、7 个维度分数（0-100）、一句话诊断；`source` 字段标注来源，人工评分写 `manual` |

改完 `git add . && git commit -m "update" && git push`，Actions 会自动重新部署。

---

## 五、常见问题

**Q：今天页面没更新？**
A：仓库 → **Actions** → **Daily Update** → **Run workflow** 手动跑一次。定时任务用的是 UTC `30 0 * * *`，对应北京时间 08:30，偶尔会有几分钟延迟。

**Q：Actions 显示红色叉？**
A：点进去看日志。多半是某个 RSS 源临时故障——只要不是全部失败，更新仍会成功；全部失败时页面自动显示上一次的数据（顶部状态会显示「使用缓存」或「更新失败」），不用处理。

**Q：页面顶部的状态标签是什么意思？**
A：`AI 增强` = 摘要经过大模型改写；`规则整理` = 未配置 key 或 AI 失败，使用规则摘要；`使用缓存` = 本次抓取失败，显示上次数据；`更新失败` = 抓取失败且无缓存，显示标注 sample 的示例数据。

**Q：要花多少钱？**
A：GitHub Pages 和 Actions（公开仓库）免费。不配 API key 则零费用；配了 key 每天一次调用的费用约几分钱。

**Q：手机上能看吗？**
A：能，页面是响应式的，手机端自动切换为单列。

---

## 六、项目结构（想深入了解再看）

```
src/
  App.tsx               页面组装
  components/           状态栏 / 总览 / 三件事 / 列表 / 雷达图 / 热力图 / 来源说明
  data/
    daily.json          每日新闻数据（脚本生成，勿手改）
    model-scores.json   模型评分（手动维护）
    sources.json        RSS 来源列表
  lib/                  类型与 UI 常量
scripts/
  update-daily.ts       抓取 RSS → 去重 → 分类评分 → 生成 JSON
  enhance-with-llm.ts   可选 AI 增强（无 key 自动跳过，失败自动回退）
.github/workflows/
  daily-update.yml      每天 08:30（北京时间）自动更新并部署
```

技术栈：Vite + React + TypeScript + Tailwind CSS + ECharts。

## 七、内容来源与边界

- 新闻来自 `sources.json` 中的公开 RSS，每条真实新闻均附原文链接。
- 文字风格学习自橘鸦 Juya（信息密度高、出处清晰），**未抓取或复制其微信正文**；Juya 公开 RSS（https://daily.juya.uk/rss.xml ）是默认来源之一。
- 雷达图表达方式参考图灵坐标/浪浪妈（结论先行、指出长短板），**评分数据未取自其视频**，当前为人工整理评分（`manual`），口径见 `model-scores.json`。
