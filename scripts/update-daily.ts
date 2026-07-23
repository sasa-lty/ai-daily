/**
 * 每日更新脚本 v2：RSS 抓取 -> 日报拆解 -> 去重 -> 规则分类/评分 -> 可选 LLM 增强 -> 生成 JSON
 *
 * 运行方式：npm run update
 * 输出：src/data/daily.json + src/data/history/YYYY-MM-DD.json
 *
 * v2 变化：
 * - 支持日报型来源（type=digest，如 Juya）：把每一期拆解成单条新闻候选信号，
 *   从链接推断原始发布方；日报容器本身不会进入新闻列表/今日三件事。
 * - 日报纯文本作为 LLM 的 editorialReference（仅参考，禁止复制）。
 * - LLM 按严格 JSON 协议返回 title/summary/keyFacts/whyItMatters/sourceDisplayName/
 *   confidenceReason 与 topStoryIds；失败回退规则模式。
 *
 * 设计原则：
 * - 没有任何 API key 也能成功运行（规则模式）。
 * - 单个来源失败不影响整体；全部失败时回退到上次缓存，没有缓存则输出标注为 sample 的示例数据。
 * - 脚本永远以退出码 0 结束，保证 GitHub Actions 不会因为抓取失败而中断部署。
 */
import fs from 'node:fs'
import path from 'node:path'
import { XMLParser } from 'fast-xml-parser'
import type {
  Category,
  Confidence,
  DailyData,
  NewsItem,
  SourceStat,
} from '../src/lib/types.js'
import { enhanceWithLLM } from './enhance-with-llm.js'

const ROOT = process.cwd()
const DAILY_PATH = path.join(ROOT, 'src', 'data', 'daily.json')
const HISTORY_DIR = path.join(ROOT, 'src', 'data', 'history')
const SOURCES_PATH = path.join(ROOT, 'src', 'data', 'sources.json')

const FETCH_TIMEOUT_MS = 15_000
const MAX_ITEMS_PER_SOURCE = 12
const MAX_DIGEST_ENTRIES = 24
const MAX_SELECTED = 12 // 今日三件事 + 热点列表
const DATE_LOCALE_OPTS = { timeZone: 'Asia/Shanghai' } as const

interface SourceDef {
  name: string
  type?: 'rss' | 'digest'
  url: string
  homepage?: string
  weight?: number
}

/* ---------------- 文本工具 ---------------- */

function asText(v: unknown): string {
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  if (typeof v === 'object' && v !== null) {
    const o = v as Record<string, unknown>
    if (typeof o['#text'] === 'string') return o['#text']
  }
  return ''
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
}

function cleanText(html: string): string {
  return decodeEntities(html)
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function truncateSummary(text: string, max = 120): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const punct = Math.max(cut.lastIndexOf('。'), cut.lastIndexOf('. '), cut.lastIndexOf('！'))
  return (punct > max * 0.5 ? cut.slice(0, punct + 1) : cut).trim() + (punct > max * 0.5 ? '' : '…')
}

/* ---------------- RSS / Atom 解析 ---------------- */

interface RawEntry {
  title: string
  link: string
  publishedAt: string
  summary: string
  /** 原始 HTML（仅日报型来源用于二次解析） */
  html?: string
  /** 日报编辑给定的分类（优先于关键词分类） */
  categoryHint?: Category
  /** 从链接推断的原始发布方 */
  publisher?: string
  /** 在日报中的编辑排序（1 起，越小越靠前） */
  editorRank?: number
}

/** XML 解析结果是松散结构，统一归一化为对象数组 */
function arrayify(v: unknown): Array<Record<string, any>> {
  if (v === undefined || v === null) return []
  return (Array.isArray(v) ? v : [v]) as Array<Record<string, any>>
}

function parseFeed(xml: string): RawEntry[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    trimValues: true,
    // 关闭内置实体解码：部分 RSS（如 Juya）正文实体数量会触发解析器安全上限。
    // 实体解码由 cleanText() 中的 decodeEntities 统一处理。
    processEntities: false,
  })
  const doc = parser.parse(xml) as Record<string, any>
  const entries: RawEntry[] = []

  // RSS 2.0
  const channel = doc.rss?.channel as Record<string, any> | undefined
  if (channel) {
    for (const item of arrayify(channel.item)) {
      const rawHtml = asText(item['content:encoded']) || asText(item.description)
      entries.push({
        title: cleanText(asText(item.title)),
        link: asText(item.link) || asText(item.guid),
        publishedAt: asText(item.pubDate) || asText(item['dc:date']),
        summary: cleanText(asText(item.description) || rawHtml),
        html: rawHtml,
      })
    }
    return entries
  }

  // Atom
  const feed = doc.feed as Record<string, any> | undefined
  if (feed) {
    for (const entry of arrayify(feed.entry)) {
      const links = arrayify(entry.link)
      const alt: Record<string, any> =
        links.find((l) => l['@_rel'] === 'alternate') ?? links[0] ?? {}
      const rawHtml = asText(entry.content) || asText(entry.summary)
      entries.push({
        title: cleanText(asText(entry.title)),
        link: typeof alt['@_href'] === 'string' ? alt['@_href'] : '',
        publishedAt: asText(entry.published) || asText(entry.updated),
        summary: cleanText(asText(entry.summary) || rawHtml),
        html: rawHtml,
      })
    }
  }
  return entries
}

/* ---------------- 日报型来源拆解 ---------------- */

/** Juya 等日报的 h3 栏目 -> 本站分类 */
const DIGEST_SECTION_CATEGORY: Array<{ pattern: RegExp; category: Category }> = [
  { pattern: /模型发布|新模型/, category: '模型' },
  { pattern: /开源/, category: '开源' },
  { pattern: /开发生态|开发者|工具链|Agent/i, category: 'Agent' },
  { pattern: /产品应用|产品|应用/, category: '产品' },
  { pattern: /技术|洞察|研究|论文/, category: '研究' },
  { pattern: /行业动态|行业|融资|商业/, category: '商业' },
  { pattern: /算力|芯片|基础设施/, category: '算力' },
  { pattern: /安全|政策|监管|合规/, category: '安全' },
]

const AGGREGATOR_DOMAINS = new Set([
  'x.com', 'twitter.com', 't.co', 'linux.do', 'reddit.com', 'weibo.com',
  'zhihu.com', 'mp.weixin.qq.com', 't.me', 'discord.com', 'news.ycombinator.com',
  'bilibili.com', 'youtube.com', 'youtu.be',
])

/** 已知域名 -> 原始发布方（含逐级后缀匹配） */
const DOMAIN_PUBLISHER: Record<string, string> = {
  'openai.com': 'OpenAI',
  'anthropic.com': 'Anthropic',
  'claude.com': 'Anthropic',
  'google.com': 'Google',
  'blog.google': 'Google',
  'deepmind.google': 'Google DeepMind',
  'microsoft.com': 'Microsoft',
  'meta.com': 'Meta',
  'mistral.ai': 'Mistral AI',
  'x.ai': 'xAI',
  'moonshot.cn': 'Moonshot AI',
  'moonshot.ai': 'Moonshot AI',
  'kimi.com': 'Kimi',
  'deepseek.com': 'DeepSeek',
  'alibaba.com': '阿里巴巴',
  'aliyun.com': '阿里云',
  'qwen.ai': 'Qwen',
  'bytedance.com': '字节跳动',
  'tencent.com': '腾讯',
  'qq.com': '腾讯',
  'baidu.com': '百度',
  'apple.com': 'Apple',
  'amazon.com': 'Amazon',
  'nvidia.com': 'NVIDIA',
  'amd.com': 'AMD',
  'intel.com': 'Intel',
  'huggingface.co': 'Hugging Face',
  'github.com': 'GitHub',
  'arxiv.org': 'arXiv',
  'cursor.com': 'Cursor',
  'cognition.ai': 'Cognition',
  'perplexity.ai': 'Perplexity',
  'manus.im': 'Manus',
  'cohere.com': 'Cohere',
  'stability.ai': 'Stability AI',
  'midjourney.com': 'Midjourney',
  'runwayml.com': 'Runway',
  'luma.ai': 'Luma',
  'suno.com': 'Suno',
  'elevenlabs.io': 'ElevenLabs',
  'scale.com': 'Scale AI',
  'upstage.ai': 'Upstage',
  'replit.com': 'Replit',
  'vercel.com': 'Vercel',
  'cloudflare.com': 'Cloudflare',
  'notion.so': 'Notion',
  'figma.com': 'Figma',
  'adobe.com': 'Adobe',
  'salesforce.com': 'Salesforce',
  'oracle.com': 'Oracle',
  'databricks.com': 'Databricks',
  'techcrunch.com': 'TechCrunch',
  'theverge.com': 'The Verge',
  'wired.com': 'Wired',
  'arstechnica.com': 'Ars Technica',
  'reuters.com': 'Reuters',
  'bloomberg.com': 'Bloomberg',
  'ft.com': 'Financial Times',
  'wsj.com': 'WSJ',
  'nature.com': 'Nature',
  'science.org': 'Science',
  'mit.edu': 'MIT',
  'stanford.edu': 'Stanford',
  '36kr.com': '36氪',
  'jiqizhixin.com': '机器之心',
  'qbitai.com': '量子位',
  'infoq.cn': 'InfoQ',
  'miora.design': 'Miora',
  'qwenlm.github.io': 'Qwen',
  'github.io': 'GitHub Pages',
}

/** 从链接推断原始发布方；无法可靠识别时返回“综合来源”，不伪造 */
export function publisherFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase()
    const parts = host.split('.')
    for (let i = 0; i < parts.length - 1; i++) {
      const suffix = parts.slice(i).join('.')
      if (DOMAIN_PUBLISHER[suffix]) return DOMAIN_PUBLISHER[suffix]
    }
    const root2 = parts.slice(-2).join('.')
    if (AGGREGATOR_DOMAINS.has(host) || AGGREGATOR_DOMAINS.has(root2)) return '综合来源'
    // 未知名站：用根域名首字母大写作展示名（域名即出处，不算伪造）
    const root = parts[parts.length - 2] ?? parts[0]
    return root.charAt(0).toUpperCase() + root.slice(1)
  } catch {
    return '综合来源'
  }
}

/** 把一期日报 HTML 拆解成单条新闻候选信号 */
function parseDigestEntries(issue: RawEntry): RawEntry[] {
  if (!issue.html) return []
  const html = decodeEntities(issue.html)

  // 只取“概览”栏目（若无则整篇），避免视频链接等干扰
  const overviewMatch = html.match(/<h2[^>]*>\s*概览\s*<\/h2>([\s\S]*?)(?:<h2|$)/i)
  const scope = overviewMatch ? overviewMatch[1] : html

  const out: RawEntry[] = []
  const sectionRe = /<h3[^>]*>([\s\S]*?)<\/h3>\s*<ul[^>]*>([\s\S]*?)<\/ul>/gi
  let section: RegExpExecArray | null
  let rank = 0

  while ((section = sectionRe.exec(scope)) !== null) {
    const sectionName = cleanText(section[1])
    const ul = section[2]
    const hint = DIGEST_SECTION_CATEGORY.find((s) => s.pattern.test(sectionName))?.category

    const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi
    let li: RegExpExecArray | null
    while ((li = liRe.exec(ul)) !== null) {
      const liHtml = li[1].replace(/<code[\s\S]*?<\/code>/g, '')
      const hrefMatch = liHtml.match(/href="([^"]+)"/i)
      const link = hrefMatch?.[1] ?? ''
      // 去掉锚点标签后剩余的纯文本即编辑拟好的标题
      const title = cleanText(liHtml.replace(/<a[\s\S]*?<\/a>/gi, ''))
      if (!title || title.length < 6 || !link.startsWith('http')) continue
      if (link.includes('juya.uk')) continue

      rank += 1
      out.push({
        title,
        link,
        publishedAt: issue.publishedAt,
        summary: title,
        categoryHint: hint,
        publisher: publisherFromUrl(link),
        editorRank: rank,
      })
      if (out.length >= MAX_DIGEST_ENTRIES) return out
    }
  }
  return out
}

/* ---------------- 抓取 ---------------- */

async function fetchSource(source: SourceDef): Promise<{ entries: RawEntry[]; stat: SourceStat }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(source.url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'ai-daily-radar/2.0 (+https://github.com/) RSS reader',
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
      },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const xml = await res.text()
    const rawItems = parseFeed(xml)

    if (source.type === 'digest') {
      // 日报型：只取最近 2 期，拆解成单条新闻；容器本身被丢弃
      const entries = rawItems.slice(0, 2).flatMap(parseDigestEntries)
      return {
        entries,
        stat: {
          name: source.name,
          url: source.homepage ?? source.url,
          ok: true,
          itemCount: entries.length,
          note: `日报型来源，已拆解 ${rawItems.length > 0 ? Math.min(rawItems.length, 2) : 0} 期`,
        },
      }
    }

    const entries = rawItems.filter((e) => e.title && e.link)
    return {
      entries: entries.slice(0, MAX_ITEMS_PER_SOURCE),
      stat: { name: source.name, url: source.homepage ?? source.url, ok: true, itemCount: entries.length },
    }
  } catch (err) {
    return {
      entries: [],
      stat: {
        name: source.name,
        url: source.homepage ?? source.url,
        ok: false,
        itemCount: 0,
        note: err instanceof Error ? err.message : String(err),
      },
    }
  } finally {
    clearTimeout(timer)
  }
}

/* ---------------- 规则分类 / 标签 / 评分 ---------------- */

const CATEGORY_RULES: Array<{ category: Category; pattern: RegExp }> = [
  { category: '安全', pattern: /安全|隐私|监管|政策|法规|合规|滥用|泄露|safety|regulat|policy|lawsuit|ban/i },
  { category: '算力', pattern: /芯片|算力|数据中心|显卡|GPU|TPU|H100|B200|NVIDIA|英伟达|infrastructure|supercomputer/i },
  { category: '商业', pattern: /融资|估值|收购|IPO|营收|财报|商业化|定价|订阅|funding|raise[sd]?|acqui|valuation|revenue/i },
  { category: '研究', pattern: /论文|研究|评测|基准|对齐|scaling|paper|arxiv|benchmark|study|alignment|reasoning/i },
  { category: 'Agent', pattern: /智能体|代理|工具调用|computer use|agent|copilot|tool[- ]?use|workflow|自动化/i },
  { category: '开源', pattern: /开源|权重|open[- ]?source|open weights|github|apache|mit licens/i },
  { category: '模型', pattern: /模型|大模型|GPT|Claude|Gemini|Llama|Qwen|DeepSeek|Kimi|Grok|Mistral|LLM|multimodal|多模态/i },
]

function categorize(text: string): Category {
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(text)) return rule.category
  }
  return '产品'
}

const TAG_ENTITIES = [
  'OpenAI', 'GPT', 'Claude', 'Anthropic', 'Google', 'Gemini', 'DeepMind',
  'Meta', 'Llama', 'Qwen', 'DeepSeek', 'Kimi', 'Moonshot', 'Mistral',
  'xAI', 'Grok', 'NVIDIA', '英伟达', '微软', 'Apple', 'Agent', 'Coding',
  '多模态', '开源', '融资', '机器人', '视频生成', '语音', 'Sora', 'Manus',
]

function extractTags(text: string, max = 4): string[] {
  const lower = text.toLowerCase()
  const found: string[] = []
  for (const tag of TAG_ENTITIES) {
    if (lower.includes(tag.toLowerCase()) && !found.includes(tag)) found.push(tag)
    if (found.length >= max) break
  }
  return found
}

const HOT_PATTERN =
  /重磅|首发|突破|超越|最强|刷新|SOTA|开源|发布|推出|上线|宣布|融资|收购|release[sd]?|launch(?:es|ed)?|announce[sd]?|unveil|open[- ]?source|breakthrough/i

function scoreEntry(entry: RawEntry, sourceWeight: number, now: number): number {
  let score = 42 + sourceWeight

  const hotHits = (entry.title.match(new RegExp(HOT_PATTERN.source, 'gi')) ?? []).length
  score += Math.min(hotHits * 7, 21)

  // 日报编辑排序加权：编辑越靠前的条目越重要
  if (entry.editorRank) score += Math.max(0, 11 - entry.editorRank)

  const ts = Date.parse(entry.publishedAt)
  if (!Number.isNaN(ts)) {
    const hours = (now - ts) / 3_600_000
    if (hours <= 24) score += 12
    else if (hours <= 48) score += 8
    else if (hours <= 96) score += 4
    else score -= 6
  }
  return Math.max(20, Math.min(100, Math.round(score)))
}

function confidenceOf(entry: RawEntry, sourceWeight: number): Confidence {
  if (sourceWeight >= 8 && entry.summary.length > 20) return 'high'
  if (entry.summary.length > 10) return 'medium'
  return 'low'
}

/** 规则版“为什么重要”：引用具体主体与决策点，不使用空泛模板话 */
function whyFor(category: Category, tags: string[], publisher?: string): string {
  const subject = tags[0] ?? publisher ?? '相关方'
  switch (category) {
    case '模型':
      return `涉及${subject}的模型能力或供给变化，直接影响模型选型、接入成本与能力上限评估。`
    case 'Agent':
      return `${subject}相关的工具链进展，关系到自动化工作流能否稳定落地及接入方式选择。`
    case '产品':
      return `${subject}的功能变化直接影响现有使用流程与替代方案评估。`
    case '开源':
      return `权重或代码开放意味着可自部署与二次开发，直接影响私有化成本与技术选型。`
    case '研究':
      return `该结果指向${subject}方向的技术走向，通常领先产品化数月，用于判断投入方向。`
    case '算力':
      return `算力供给与合作变化会传导至${subject}相关模型的训练成本与推理价格。`
    case '商业':
      return `该交易明确了${subject}方向的资金规模与估值锚点，影响对赛道空间的判断。`
    case '安全':
      return `该动态划定了${subject}相关产品的合规边界与潜在限制，影响可用性预期。`
  }
}

/* ---------------- 包装名清洗（防御层） ---------------- */

const BANNED_TITLE = /橘鸦|juya|AI ?日报|AI ?早报|\d{4}-\d{2}-\d{2}\s*期/i
const BANNED_SOURCE = /橘鸦|juya|日报|早报/i

function sanitizeSourceName(name: string | undefined, fallback: string): string {
  if (!name || BANNED_SOURCE.test(name)) return '综合来源'
  return name
}

/* ---------------- 示例数据（全部来源失败且无缓存时使用） ---------------- */

function buildSampleItems(dateStr: string): NewsItem[] {
  const mk = (
    id: string,
    title: string,
    category: Category,
    impactScore: number,
    sourceDisplayName: string,
    sourceUrl: string,
    tags: string[]
  ): NewsItem => ({
    id,
    title,
    category,
    summary: '示例摘要：这里是该条新闻的一句话概括，真实数据会在下次成功抓取后自动替换。',
    whyItMatters: whyFor(category, tags, sourceDisplayName),
    sourceName: sourceDisplayName,
    sourceDisplayName,
    sourceUrl,
    publishedAt: `${dateStr}T08:00:00+08:00`,
    impactScore,
    confidence: 'low',
    tags,
    aiEnhanced: false,
    isSample: true,
    keyFacts: ['示例关键事实 1', '示例关键事实 2'],
    confidenceReason: '单一来源（示例）',
  })
  return [
    mk('sample-1', '示例：某前沿实验室发布新一代旗舰模型', '模型', 88, 'OpenAI', 'https://openai.com', ['OpenAI', 'GPT']),
    mk('sample-2', '示例：Coding Agent 工具链更新，支持更长任务', 'Agent', 82, 'Anthropic', 'https://www.anthropic.com', ['Claude', 'Agent', 'Coding']),
    mk('sample-3', '示例：某开源模型放出权重，社区复现成本低', '开源', 76, 'Hugging Face', 'https://huggingface.co', ['开源', 'Llama']),
    mk('sample-4', '示例：多模态理解基准刷新，视频理解进步明显', '研究', 71, 'Google DeepMind', 'https://deepmind.google', ['DeepMind', '多模态']),
    mk('sample-5', '示例：AI 应用产品更新，集成更多办公场景', '产品', 64, 'TechCrunch AI', 'https://techcrunch.com/category/artificial-intelligence/', ['产品']),
    mk('sample-6', '示例：芯片厂商公布新一代 AI 加速卡规格', '算力', 61, 'NVIDIA', 'https://www.nvidia.com', ['NVIDIA', '算力']),
    mk('sample-7', '示例：某 AI 公司完成新一轮融资，估值上调', '商业', 58, 'TechCrunch AI', 'https://techcrunch.com/category/artificial-intelligence/', ['融资']),
    mk('sample-8', '示例：监管机构就生成式 AI 合规发布新指引', '安全', 52, '综合来源', 'https://techcrunch.com/category/artificial-intelligence/', ['安全']),
  ]
}

/* ---------------- 主流程 ---------------- */

function dedupe(items: NewsItem[]): NewsItem[] {
  const seenTitles = new Set<string>()
  const seenUrls = new Set<string>()
  return items.filter((it) => {
    const key = it.title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '').slice(0, 40)
    if (!key || seenTitles.has(key) || seenUrls.has(it.sourceUrl)) return false
    seenTitles.add(key)
    seenUrls.add(it.sourceUrl)
    return true
  })
}

function buildOverview(items: NewsItem[], sourceCount: number, dateStr: string) {
  const catCount = new Map<Category, number>()
  const tagCount = new Map<string, number>()
  for (const it of items) {
    catCount.set(it.category, (catCount.get(it.category) ?? 0) + 1)
    for (const t of it.tags) tagCount.set(t, (tagCount.get(t) ?? 0) + 1)
  }
  const topCats = [...catCount.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c)
  const keywords = [...tagCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([t]) => t)
  while (keywords.length < 3) keywords.push(topCats[keywords.length] ?? 'AI')

  const top5 = items.slice(0, 5)
  const avgImpact = top5.length ? top5.reduce((s, i) => s + i.impactScore, 0) / top5.length : 0
  const heatIndex = Math.max(5, Math.min(100, Math.round(avgImpact * 0.85 + sourceCount * 2)))

  const verdict =
    items.length === 0
      ? '今日暂无有效信号。'
      : `${dateStr}：今日信号集中在「${topCats.slice(0, 2).join('」「')}」方向，共筛选 ${items.length} 条；热度最高的是「${items[0].title}」。`

  return { verdict, keywords, heatIndex, sourceCount }
}

function writeOutputs(data: DailyData) {
  fs.mkdirSync(path.dirname(DAILY_PATH), { recursive: true })
  fs.writeFileSync(DAILY_PATH, JSON.stringify(data, null, 2) + '\n', 'utf-8')
  fs.mkdirSync(HISTORY_DIR, { recursive: true })
  fs.writeFileSync(
    path.join(HISTORY_DIR, `${data.date}.json`),
    JSON.stringify(data, null, 2) + '\n',
    'utf-8'
  )
}

async function main() {
  const dateStr = new Date().toLocaleDateString('sv-SE', DATE_LOCALE_OPTS)
  const generatedAt = new Date().toISOString()
  const now = Date.now()

  const sourcesFile = JSON.parse(fs.readFileSync(SOURCES_PATH, 'utf-8')) as {
    sources: SourceDef[]
  }
  const sources = sourcesFile.sources
  console.log(`[update] 开始抓取 ${sources.length} 个来源（${dateStr}）`)

  const results = await Promise.all(sources.map(fetchSource))
  const sourceStats = results.map((r) => r.stat)
  for (const s of sourceStats) {
    console.log(`  - ${s.ok ? 'OK ' : 'FAIL'} ${s.name}：${s.itemCount} 条${s.note ? `（${s.note}）` : ''}`)
  }

  // 汇总 + 结构化（日报容器已在 fetch 阶段被拆解，不会进入候选）
  const all: NewsItem[] = []
  let seq = 0
  for (let i = 0; i < results.length; i++) {
    const weight = sources[i].weight ?? 5
    for (const entry of results[i].entries) {
      const text = `${entry.title} ${entry.summary}`
      const category = entry.categoryHint ?? categorize(text)
      const ts = Date.parse(entry.publishedAt)
      const tags = extractTags(text)
      const publisher = entry.publisher ?? publisherFromUrl(entry.link)
      all.push({
        id: `n${++seq}`,
        title: entry.title,
        category,
        summary: truncateSummary(entry.summary || entry.title),
        whyItMatters: whyFor(category, tags, publisher),
        sourceName: sanitizeSourceName(publisher, sources[i].name),
        sourceDisplayName: sanitizeSourceName(publisher, sources[i].name),
        sourceUrl: entry.link,
        publishedAt: Number.isNaN(ts) ? generatedAt : new Date(ts).toISOString(),
        impactScore: scoreEntry(entry, weight, now),
        confidence: confidenceOf(entry, weight),
        tags,
        aiEnhanced: false,
      })
    }
  }

  // 防御层：任何形似“日报容器”的条目都不得进入最终列表
  const candidates = dedupe(all).filter((it) => !BANNED_TITLE.test(it.title))

  const selected = candidates
    .sort((a, b) => b.impactScore - a.impactScore || b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, MAX_SELECTED)

  // 全部来源失败：回退缓存或示例数据
  if (selected.length === 0) {
    if (fs.existsSync(DAILY_PATH)) {
      const prev = JSON.parse(fs.readFileSync(DAILY_PATH, 'utf-8')) as DailyData
      const cached: DailyData = {
        ...prev,
        generatedAt,
        status: 'cache',
        statusNote: '本次抓取失败，页面显示的是上一次成功更新的数据。',
        sources: sourceStats,
      }
      writeOutputs(cached)
      console.log('[update] 所有来源抓取失败，已回退到缓存数据（status=cache）')
      return
    }
    const sampleItems = buildSampleItems(dateStr)
    const fallback: DailyData = {
      date: dateStr,
      generatedAt,
      status: 'error',
      statusNote: '所有来源抓取失败，以下为示例数据（sample），成功抓取后会自动替换。',
      overview: buildOverview(sampleItems, 0, dateStr),
      topStoryIds: sampleItems.slice(0, 3).map((i) => i.id),
      items: sampleItems,
      sources: sourceStats,
    }
    writeOutputs(fallback)
    console.log('[update] 所有来源抓取失败且无缓存，已生成示例数据（status=error）')
    return
  }

  // 编辑参考文本：取第一个日报型来源最新一期的纯文本概览（仅供 LLM 参考，不展示）
  let editorialReference: string | undefined
  const digestIdx = sources.findIndex((s) => s.type === 'digest')
  if (digestIdx >= 0 && results[digestIdx].entries.length > 0) {
    editorialReference = results[digestIdx].entries
      .slice(0, 15)
      .map((e) => `- ${e.title}`)
      .join('\n')
      .slice(0, 2000)
  }

  // 可选 LLM 增强：无 key 或失败都自动回退规则模式
  let status: DailyData['status'] = 'rule'
  let topStoryIds = selected.slice(0, 3).map((i) => i.id)
  const enhanced = await enhanceWithLLM(selected, dateStr, editorialReference)
  if (enhanced) {
    const byId = new Map(enhanced.items.map((it) => [it.id, it]))
    for (const item of selected) {
      const e = byId.get(item.id)
      if (!e) continue
      item.title = e.title
      item.summary = e.summary
      item.keyFacts = e.keyFacts
      item.whyItMatters = e.whyItMatters
      item.sourceDisplayName = sanitizeSourceName(e.sourceDisplayName, item.sourceName)
      item.confidenceReason = e.confidenceReason
      item.aiEnhanced = true
    }
    if (enhanced.topStoryIds.length > 0) topStoryIds = enhanced.topStoryIds
    status = 'ai'
  }

  const overview = buildOverview(selected, sourceStats.filter((s) => s.ok).length, dateStr)
  if (enhanced?.verdict) overview.verdict = enhanced.verdict

  const data: DailyData = {
    date: dateStr,
    generatedAt,
    status,
    statusNote:
      status === 'ai' ? '摘要与总评已由 AI 改写。' : '未配置 API key 或 AI 增强失败，使用规则摘要。',
    overview,
    topStoryIds,
    items: selected,
    sources: sourceStats,
  }

  writeOutputs(data)
  console.log(
    `[update] 完成：${selected.length} 条新闻，三件事 ${topStoryIds.length} 条，状态=${status}`
  )
}

main().catch((err) => {
  // 兜底：即使出现未预期错误也不让 Actions 失败，页面继续用旧数据
  console.error('[update] 未预期错误：', err)
  process.exit(0)
})
