# 个人 AI 日报网页设计文档

更新时间：2026-07-23  
目标执行方：Kimi K3 Agent  
目标用户：网页作者本人  
目标产物：一个每天自动更新、打开即可快速浏览的个人 AI 信息页。

## 0. 核心结论

这个网页第一版不需要传统服务器。

推荐方案是：

```text
静态网页 + 每日定时更新脚本 + GitHub Pages/本地文件托管 + 可选 LLM API
```

解释：

- 网页本身只展示已经整理好的 JSON 数据，所以可以是纯静态网页。
- 每日自动更新需要一个“定时执行环境”，但不等于你要维护服务器。
- 最省心的方式是 GitHub Actions 每天自动运行一次脚本，生成新的数据文件并重新发布到 GitHub Pages。
- 如果只读取 RSS 原始摘要，不需要 AI API。
- 如果希望自动筛选、去重、改写成橘鸦 Juya 那种更顺滑的日报语气，需要接入 LLM API。

最终建议：

```text
第一版做成 GitHub Pages 静态站。
GitHub Actions 每天北京时间 08:30 自动更新。
默认无 API 也能运行。
如果配置 KIMI_API_KEY 或 OPENAI_API_KEY，则自动启用 AI 摘要增强。
```

注意：GitHub Actions 的 cron 使用 UTC。北京时间 08:30 对应 UTC 00:30，workflow 应写成 `30 0 * * *`。

这样最适合“不熟悉网站知识、想一次完成、每日方便浏览”的目标。

## 1. 产品定位

网页不是公众号、不是新闻站、不是模型评测站，而是一个个人 AI 雷达面板。

打开页面后，用户应该在 1-3 分钟内完成：

1. 看今天 AI 圈最重要的 3 件事。
2. 扫一眼 6-10 条值得关注的新闻。
3. 看模型雷达图，知道前沿模型在不同能力上的大致位置。
4. 看热点梯度图，知道今天哪些方向更热。
5. 点开原文链接，继续深入阅读。

不要做：

- 不做公众号推送。
- 不做视频号流程。
- 不做用户登录。
- 不做后台管理系统。
- 不做评论、收藏、社交分享。
- 不做复杂数据库。
- 不做“资讯越多越好”的资料库。

## 2. 参考内容的使用边界

### 2.1 橘鸦 Juya

用户提供的橘鸦 Juya 内容用于学习风格，不作为唯一数据源。

可借鉴：

- 信息密度高。
- 标题清楚。
- 每条消息带出处。
- 适合快速扫读。
- 少废话，偏“今天发生了什么 + 为什么值得看”。

不可做：

- 不要批量抓取微信正文。
- 不要复制文章原文。
- 不要把橘鸦当成唯一自动化来源。

可用来源：

- RSS：`https://daily.juya.uk/rss.xml`
- 微信文章：`https://mp.weixin.qq.com/s/cbISPTiMYGFqPDsB_rD9hA`

### 2.2 图灵坐标 / 浪浪妈雷达图

用户提供的 B 站内容用于学习“模型雷达图”的表达方式，不作为每日新闻来源。

可借鉴：

- 结论先行，例如“主要输在科学推理，其余维度互有胜负”。
- 多模型横向对比。
- 多能力维度并列展示。
- 图表旁边配一句人话解释。
- 不只给分数，还解释短板和长板。

不可做：

- 不复制视频画面。
- 不搬运视频中的具体数据。
- 不把无法确认来源的数据写成事实。

参考链接：

- `https://www.bilibili.com/video/BV1gVKb6UEyX?vd_source=02844750eb309c1b581d3013f5686066`

### 2.3 同类项目借鉴

可参考这些项目/网页的思路，但第一版不要做得这么复杂：

- DailyDawn：`https://dailydawn.dev/`
- Horizon：`https://github.com/Thysrael/Horizon`
- agents-radar：`https://github.com/duanyytop/agents-radar`

借鉴点：

- DailyDawn 值得借鉴“Top 3 核心信号 + 行动建议”的内容组织。
- Horizon 值得借鉴“多源抓取、去重、评分、生成日报、发布网页”的流水线。
- agents-radar 值得借鉴“GitHub Actions 定时生成双语日报并发布 Web UI”的自动化方式。

第一版只取它们最有用的 20%：

```text
RSS 抓取 -> 去重 -> 评分 -> 生成 JSON -> 静态网页展示 -> 每天自动更新
```

## 3. 是否需要服务器

### 3.1 不需要传统服务器

不需要自己买服务器，也不需要部署数据库、Nginx、Docker、后端 API 服务。

网页可以部署为静态站：

- GitHub Pages
- Cloudflare Pages
- Netlify
- Vercel 静态托管
- 或者只在本机打开 `index.html`

最推荐 GitHub Pages，因为它和 GitHub Actions 搭配最自然。

### 3.2 但自动更新需要“定时执行”

静态网页不会自己去每天抓取新闻。需要一个定时任务帮它更新数据。

推荐选项：

| 方案 | 是否需要服务器 | 自动更新 | 维护难度 | 推荐度 |
|---|---:|---:|---:|---:|
| 本地 HTML 手动刷新 | 否 | 否 | 低 | 低 |
| 本地脚本 + Windows 任务计划 | 否 | 是 | 中 | 中 |
| GitHub Pages + GitHub Actions | 否 | 是 | 低 | 高 |
| Vercel/Netlify 定时函数 | 否，但有平台函数 | 是 | 中 | 中 |
| 自己买云服务器 | 是 | 是 | 高 | 不推荐 |

最终选择：

```text
GitHub Pages + GitHub Actions
```

原因：

- 你每天只需要打开一个网址。
- 更新失败也不影响打开旧数据。
- 项目文件都在一个仓库里，Kimi agent 可以一次生成。
- 不需要你理解后端服务器。

## 4. 每日更新是否需要 API

### 4.1 不使用 API 的版本

不需要 API key。

能力：

- 读取 Juya RSS。
- 读取其他公开 RSS。
- 提取标题、发布时间、摘要、链接。
- 用规则做分类。
- 用关键词和来源权重做简单评分。
- 生成热点列表、关键词、梯度图。

优点：

- 最省心。
- 无费用。
- 不用保存密钥。
- 不怕 API 额度和模型变更。

缺点：

- 摘要质量依赖 RSS 原文。
- 去重和“为什么重要”会比较机械。
- 雷达图解释较弱，需要预置数据或手动维护。

### 4.2 使用 LLM API 的版本

需要配置一个 API key，例如 Kimi/OpenAI/DeepSeek 等 OpenAI-compatible API。

能力：

- 新闻自动去重。
- 自动总结成短句。
- 自动生成“为什么重要”。
- 自动提取公司、模型、产品、论文、项目。
- 自动生成今日总评。
- 生成更接近橘鸦 Juya 风格的中文短报。

优点：

- 结果明显更好读。
- 更像“人整理过的早报”。
- 适合每天快速看。

缺点：

- 需要 API key。
- 有少量费用。
- 需要设置 GitHub Secrets。
- 偶尔会因为模型/API 报错导致当天更新失败。

### 4.3 推荐实现

第一版做双模式：

```text
无 API：正常更新，使用 RSS 摘要和规则评分。
有 API：自动增强，生成更自然的摘要、重要性解释和今日总评。
```

Kimi agent 必须保证：

- 没有 API key 时项目仍然可运行。
- API 失败时回退到无 API 模式。
- 页面明确显示数据状态：`AI 增强`、`规则整理`、`使用缓存`、`更新失败`。

## 5. 信息来源设计

### 5.1 默认来源

第一版只保留少量可靠来源，减少维护。

必选：

- Juya RSS：`https://daily.juya.uk/rss.xml`

可选：

- OpenAI Blog RSS 或公告页
- Anthropic News
- Google DeepMind Blog
- Hugging Face Blog
- GitHub Trending AI 相关项目
- arXiv AI/ML/CL RSS
- LMArena / Arena 榜单页面

如果 Kimi agent 难以稳定抓取某个来源，可以先放入 `sources.json` 作为可配置项，但不要阻塞第一版。

### 5.2 数据量控制

个人快速浏览版本的信息量：

- 今日三件事：3 条。
- 热点列表：6-10 条。
- 次级链接：最多 8 条，默认折叠。
- 雷达图模型：最多 5 个。
- 梯度图主题：6-8 个。

超过这个数量，阅读体验会变差。

### 5.3 新闻分类

默认分类：

- 模型
- Agent
- 产品
- 开源
- 研究
- 算力
- 商业
- 安全

每条新闻只能有一个主分类，可以有多个标签。

## 6. 页面设计

### 6.1 整体风格

关键词：

- 个人情报台
- 简洁
- 清楚
- 有判断
- 不营销
- 不花哨

视觉原则：

- 首屏直接展示内容，不做空泛大 hero。
- 卡片少而精。
- 图表服务理解，不做装饰。
- 桌面端信息密度略高。
- 手机端单列阅读。
- 颜色用于表达重要度和类别，不堆渐变。

### 6.2 页面结构

```text
顶部状态栏
今日总览
今日三件事
热点列表
模型雷达图
热点梯度图
数据来源与更新时间
```

### 6.3 顶部状态栏

内容：

- 站点名：`AI Daily Radar`
- 日期：`2026-07-23`
- 更新时间：`08:30`
- 数据状态：`AI 增强 / 规则整理 / 使用缓存`
- 手动更新说明：如果部署在 GitHub Pages，提供 “Run workflow” 的文字提示，不做复杂按钮。

### 6.4 今日总览

字段：

- 今日一句话判断。
- 3 个关键词。
- 今日热度指数。
- 数据来源数量。

示例：

```text
今日判断：
模型新闻没有单点爆炸，但 Coding Agent 和多模态工具的应用信号更密集，值得优先看工具链变化。
```

### 6.5 今日三件事

每条包含：

- 标题
- 40-60 字摘要
- 为什么重要
- 来源
- 可信度

风格要求：

- 像橘鸦 Juya 的文字早报：直接、有出处、信息密度高。
- 不写长段落。
- 不做标题党。

### 6.6 热点列表

每条卡片字段：

```json
{
  "title": "新闻标题",
  "category": "模型",
  "summary": "短摘要",
  "why_it_matters": "为什么值得看",
  "source_name": "来源名称",
  "source_url": "https://example.com",
  "published_at": "2026-07-23T08:00:00+08:00",
  "impact_score": 82,
  "confidence": "high",
  "tags": ["OpenAI", "Coding", "Agent"],
  "ai_enhanced": true
}
```

交互：

- 分类筛选。
- 重要度排序。
- 展开/收起详情。
- 点击来源打开原文。

### 6.7 模型雷达图

目标：

用“浪浪妈雷达图”的思路做模型能力对比：先给结论，再给维度。

默认展示：

- 4-5 个模型。
- 模型名单来自 `model-scores.json`，不是写死在代码里。
- 如果没有当天可靠数据，使用最近一次缓存并标注日期。

推荐维度：

1. 编码能力
2. 网页生成
3. 多模态
4. 科学/数学推理
5. Agent 工具使用
6. 长上下文
7. 性价比

雷达图旁边必须有一句诊断：

```text
一句话诊断：
模型 A 在网页生成和 Agent 任务上领先，模型 B 的长上下文和性价比更适合日常使用。
```

评分规则：

- 所有分数归一化到 0-100。
- 有榜单数据就写来源。
- 没有公开数据的维度标记为 `manual`。
- 不确定的数据不要伪装成精确评测。

数据来源建议：

- Arena WebDev / Image-to-WebDev
- 官方模型卡/价格页
- 已知公开 benchmark
- 人工配置文件

### 6.8 热点梯度图

默认含义：

```text
今日热点强度梯度图
```

它不是装饰图，而是帮助用户看方向。

推荐形式：

- 横轴：主题方向。
- 纵轴：信号等级。
- 颜色：综合热度。
- 格子文本：条目数量 + 最高影响分。

主题方向：

- Frontier Models
- Coding Agent
- Multimodal
- Product
- Open Source
- Research
- Infra
- Safety

信号等级：

- 必看
- 跟踪
- 扫过

计算方式：

```text
综合热度 = 条目数量 * 20 + 最高 impact_score * 0.6 + 来源可信度加权
```

实现不需要追求科学严密，关键是直观。

## 7. 自动更新流程

### 7.1 推荐流水线

```text
GitHub Actions 每天北京时间 08:30，即 UTC 00:30
  -> 安装依赖
  -> 读取 sources.json
  -> 抓取 RSS
  -> 去重
  -> 规则分类和评分
  -> 如果有 API key，调用 LLM 增强摘要
  -> 生成 data/daily.json
  -> 生成 data/history/YYYY-MM-DD.json
  -> 构建静态网页
  -> 发布 GitHub Pages
```

### 7.2 更新失败处理

必须实现：

- 如果 RSS 抓取失败，继续使用上次数据。
- 如果 LLM API 失败，回退到规则模式。
- 如果当天没有新条目，显示“暂无新更新，以下为最近缓存”。
- 页面永远不要空白。

### 7.3 手动更新

Kimi agent 应写清楚：

```text
进入 GitHub 仓库 -> Actions -> Daily Update -> Run workflow
```

不需要在网页里做真的刷新按钮，因为静态网页不能直接触发 GitHub Actions，除非引入额外 API，没必要。

## 8. 技术方案

### 8.1 推荐技术栈

```text
Vite + React + TypeScript
Tailwind CSS
ECharts
Node.js 更新脚本
GitHub Actions
GitHub Pages
```

理由：

- React 适合做筛选、图表和状态。
- ECharts 对雷达图、热力图支持成熟。
- Node.js 适合抓 RSS 和生成 JSON。
- GitHub Actions 负责定时更新。
- GitHub Pages 负责托管静态网页。

### 8.2 文件结构

```text
.
  README.md
  package.json
  index.html
  src/
    App.tsx
    components/
      Header.tsx
      DailySummary.tsx
      TopStories.tsx
      NewsList.tsx
      ModelRadar.tsx
      SignalHeatmap.tsx
      DataStatus.tsx
    data/
      daily.json
      model-scores.json
      sources.json
    lib/
      scoreNews.ts
      normalizeModels.ts
      types.ts
  scripts/
    update-daily.ts
    enhance-with-llm.ts
  .github/
    workflows/
      daily-update.yml
      deploy.yml
```

### 8.3 环境变量

可选：

```text
KIMI_API_KEY
OPENAI_API_KEY
LLM_BASE_URL
LLM_MODEL
```

规则：

- 这些变量都不是必须。
- 没有任何 API key 时也必须成功构建。
- 如果使用 GitHub Actions，应通过 GitHub Secrets 保存密钥。

## 9. Kimi K3 Agent 详细执行提示词

下面这段可以直接复制给 Kimi K3 Agent：

```text
请根据 ai-daily-web-design.md 一次性完成一个个人 AI 日报网页。

最重要目标：
这是给我个人每天快速浏览 AI 信息用的网页，不是公众号、不是新闻门户、不是长期复杂产品。请尽量一次完成，减少后续迭代和维护。

核心结论：
不要做传统服务器。请做静态网页 + 自动更新脚本 + GitHub Actions 定时更新 + GitHub Pages 部署方案。

内容参考：
1. 橘鸦 Juya 和用户提供的微信文章只用于学习文字风格：信息密度高、出处清晰、快速扫读、每条都说明为什么重要。不要抓取或复制微信正文。
2. 图灵坐标/浪浪妈雷达图只用于学习模型雷达图表达：结论先行、多维能力对比、指出长板短板、图表旁边有一句话诊断。不要复制视频画面或未确认数据。
3. 每日新闻来源优先使用 RSS 和公开网页。Juya RSS 是默认来源：https://daily.juya.uk/rss.xml

必须实现：
1. Vite + React + TypeScript + Tailwind + ECharts。
2. 一个可运行的静态首页。
3. 首页包含：顶部状态栏、今日总览、今日三件事、热点列表、模型雷达图、热点梯度图、数据来源说明。
4. 热点列表默认 6-10 条，支持分类筛选和重要度排序。
5. 今日三件事必须是最重要的 3 条。
6. 模型雷达图展示 4-5 个模型，模型和分数从 model-scores.json 读取，不要硬编码在组件里。
7. 热点梯度图做成“主题方向 x 信号等级”的热力图。
8. scripts/update-daily.ts 能抓取 RSS，生成 src/data/daily.json。
9. GitHub Actions 工作流每天北京时间 08:30 自动运行更新。注意 cron 使用 UTC，应写为 `30 0 * * *`。
10. 没有 API key 时也能运行；如果有 KIMI_API_KEY/OPENAI_API_KEY，再启用 LLM 摘要增强。
11. API 失败时回退到规则摘要，页面不能空白。
12. README 写清楚非技术用户如何启动、如何部署 GitHub Pages、如何手动 Run workflow。

API 策略：
- 默认无 API 模式：RSS 摘要 + 规则分类 + 规则评分。
- 可选 AI 增强模式：如果检测到 API key，就生成更自然的摘要、为什么重要、今日总评。
- 不要让 API 成为项目运行的必要条件。

视觉要求：
- 像个人 AI 情报台，不像营销落地页。
- 首屏必须有真实信息，不要空洞 hero。
- 卡片圆角不超过 8px。
- 图表区域高度稳定，加载时不跳动。
- 桌面端信息密度适中，移动端单列可读。
- 不要使用一大片蓝紫渐变，不要堆装饰元素。

数据要求：
- 所有真实新闻必须有来源链接。
- 示例数据必须标注为 sample。
- 页面顶部显示数据状态：AI 增强 / 规则整理 / 使用缓存 / 更新失败。
- 每个模型评分要有来源字段；人工评分标记为 manual。

验收：
1. npm install 成功。
2. npm run dev 能打开页面。
3. npm run build 成功。
4. npm run update 能生成 daily.json。
5. 无 API key 时 update 也能成功。
6. 桌面和手机布局不溢出。
7. 控制台无明显错误。
8. README 足够让我这种不熟悉网站的人照着完成部署。
```

## 10. 第一版验收标准

Kimi 交付后应该满足：

- 打开网页就能看。
- 不需要你启动服务器才能每天查看线上版本。
- 每天自动更新。
- API key 可选，不填也能跑。
- 有 API 时文字质量更好。
- 更新失败时仍显示旧数据。
- README 能让非网站开发者照做。
- 页面内容不超过个人快速浏览所需。

## 11. 维护说明

你日常只需要做三件事：

1. 打开网页看日报。
2. 如果哪天没更新，去 GitHub Actions 点一次 `Run workflow`。
3. 如果想提高摘要质量，再配置 API key。

不需要：

- 管服务器。
- 管数据库。
- 写后端。
- 维护公众号排版。
- 维护推送渠道。

## 12. 推荐先看的参考项目

如果想看别人怎么做，可以优先看这三个：

1. DailyDawn：`https://dailydawn.dev/`
   - 适合参考内容风格和“Top 3 信号”的组织方式。

2. Horizon：`https://github.com/Thysrael/Horizon`
   - 适合参考完整的新闻雷达流水线，但它对你当前需求偏复杂。

3. agents-radar：`https://github.com/duanyytop/agents-radar`
   - 适合参考 GitHub Actions 自动生成日报和 Web UI 的方式。

第一版不建议直接照搬任何一个项目。它们的功能都比你当前需要的多。

## 13. 技术依据

本设计采用静态站 + 定时生成的原因：

- GitHub Pages 官方定位就是直接从仓库发布 HTML/CSS/JavaScript 的静态站。
- GitHub Actions 支持 `on.schedule` 定时运行工作流，cron 按 UTC 计算。
- RSS 可以用 Node.js RSS parser 转为结构化对象。
- API key 可以通过 GitHub Actions Secrets 保存，不需要写进代码。

参考：

- GitHub Pages 文档：`https://docs.github.com/en/pages`
- GitHub Actions schedule 文档：`https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows#schedule`
- GitHub Actions Secrets 文档：`https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions`
- rss-parser：`https://www.npmjs.com/package/rss-parser`

## 14. 最终取舍

为了“一次完成、少维护、每天好用”，第一版只做这些：

```text
日报网页
RSS 自动更新
可选 AI 摘要增强
模型雷达图
热点梯度图
GitHub Pages 部署
README 操作说明
```

明确不做这些：

```text
服务器
数据库
登录系统
公众号推送
视频号流程
邮件订阅
复杂后台
多用户系统
```
