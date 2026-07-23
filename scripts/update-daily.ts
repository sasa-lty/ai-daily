/**
 * 每日更新脚本：RSS 抓取 -> 去重 -> 规则分类/评分 -> 可选 LLM 增强 -> 生成 JSON
 *
 * 运行方式：npm run update
 * 输出：src/data/daily.json + src/data/history/YYYY-MM-DD.json
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
const MAX_SELECTED = 12 // 今日三件事 3 条 + 热点列表 9 条
const DATE_LOCALE_OPTS = { timeZone: 'Asia/Shanghai' } as const

interface SourceDef {
  name: string
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
      entries.push({
        title: cleanText(asText(item.title)),
        link: asText(item.link) || asText(item.guid),
        publishedAt: asText(item.pubDate) || asText(item['dc:date']),
        summary: cleanText(asText(item.description) || asText(item['content:encoded'])),
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
      entries.push({
        title: cleanText(asText(entry.title)),
        link: typeof alt['@_href'] === 'string' ? alt['@_href'] : '',
        publishedAt: asText(entry.published) || asText(entry.updated),
        summary: cleanText(asText(entry.summary) || asText(entry.content)),
      })
    }
  }
  return entries
}

async function fetchSource(source: SourceDef): Promise<{ entries: RawEntry[]; stat: SourceStat }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(source.url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'ai-daily-radar/1.0 (+https://github.com/) RSS reader',
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
      },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const xml = await res.text()
    const entries = parseFeed(xml).filter((e) => e.title && e.link)
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

function scoreEntry(
  entry: RawEntry,
  sourceWeight: number,
  now: number
): { score: number; confidence: Confidence } {
  let score = 42 + sourceWeight

  const hotHits = (entry.title.match(new RegExp(HOT_PATTERN.source, 'gi')) ?? []).length
  score += Math.min(hotHits * 7, 21)

  const ts = Date.parse(entry.publishedAt)
  if (!Number.isNaN(ts)) {
    const hours = (now - ts) / 3_600_000
    if (hours <= 24) score += 12
    else if (hours <= 48) score += 8
    else if (hours <= 96) score += 4
    else score -= 6
  }

  const confidence: Confidence =
    sourceWeight >= 8 && entry.summary.length > 30
      ? 'high'
      : entry.summary.length > 10
        ? 'medium'
        : 'low'

  return { score: Math.max(20, Math.min(100, Math.round(score))), confidence }
}

const WHY_TEMPLATES: Record<Category, string> = {
  模型: '模型能力边界的变化，直接影响选型、成本与应用可行性评估。',
  Agent: 'Agent 工具链的新进展，关系到自动化工作流能否真正落地。',
  产品: '面向用户的产品变化，可能改变日常使用 AI 的方式。',
  开源: '开源释放权重或代码，意味着可以自部署、低成本复现与二次开发。',
  研究: '研究信号通常领先产品落地数月，值得提前跟踪方向。',
  算力: '算力供给变化决定模型的训练成本、推理价格与可用性。',
  商业: '商业化信号反映 AI 行业的真实需求与竞争格局。',
  安全: '安全与监管动态，影响 AI 产品的可用边界与合规成本。',
}

/* ---------------- 示例数据（全部来源失败且无缓存时使用） ---------------- */

function buildSampleItems(dateStr: string): NewsItem[] {
  const mk = (
    id: string,
    title: string,
    category: Category,
    impactScore: number,
    sourceName: string,
    sourceUrl: string,
    tags: string[]
  ): NewsItem => ({
    id,
    title,
    category,
    summary: '示例摘要：这里是该条新闻的一句话概括，真实数据会在下次成功抓取后自动替换。',
    whyItMatters: WHY_TEMPLATES[category],
    sourceName,
    sourceUrl,
    publishedAt: `${dateStr}T08:00:00+08:00`,
    impactScore,
    confidence: 'low',
    tags,
    aiEnhanced: false,
    isSample: true,
  })
  return [
    mk('sample-1', '示例：某前沿实验室发布新一代旗舰模型', '模型', 88, 'OpenAI', 'https://openai.com', ['OpenAI', 'GPT']),
    mk('sample-2', '示例：Coding Agent 工具链更新，支持更长任务', 'Agent', 82, 'Anthropic', 'https://www.anthropic.com', ['Claude', 'Agent', 'Coding']),
    mk('sample-3', '示例：某开源模型放出权重，社区复现成本低', '开源', 76, 'Hugging Face', 'https://huggingface.co', ['开源', 'Llama']),
    mk('sample-4', '示例：多模态理解基准刷新，视频理解进步明显', '研究', 71, 'Google DeepMind', 'https://deepmind.google', ['DeepMind', '多模态']),
    mk('sample-5', '示例：AI 应用产品更新，集成更多办公场景', '产品', 64, 'TechCrunch AI', 'https://techcrunch.com/category/artificial-intelligence/', ['产品']),
    mk('sample-6', '示例：芯片厂商公布新一代 AI 加速卡规格', '算力', 61, 'NVIDIA', 'https://www.nvidia.com', ['NVIDIA', '算力']),
    mk('sample-7', '示例：某 AI 公司完成新一轮融资，估值上调', '商业', 58, 'TechCrunch AI', 'https://techcrunch.com/category/artificial-intelligence/', ['融资']),
    mk('sample-8', '示例：监管机构就生成式 AI 合规发布新指引', '安全', 52, 'TechCrunch AI', 'https://techcrunch.com/category/artificial-intelligence/', ['安全']),
  ]
}

/* ---------------- 主流程 ---------------- */

/** 日报类 RSS（如 Juya）的标题只是日期，补充来源名便于扫读 */
function normalizeTitle(title: string, sourceName: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(title)) return `${sourceName} · ${title} 期`
  return title
}

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

  // 汇总 + 结构化
  const all: NewsItem[] = []
  let seq = 0
  for (let i = 0; i < results.length; i++) {
    const weight = sources[i].weight ?? 5
    for (const entry of results[i].entries) {
      const text = `${entry.title} ${entry.summary}`
      const category = categorize(text)
      const { score, confidence } = scoreEntry(entry, weight, now)
      const ts = Date.parse(entry.publishedAt)
      all.push({
        id: `n${++seq}`,
        title: normalizeTitle(entry.title, sources[i].name),
        category,
        summary: truncateSummary(entry.summary || entry.title),
        whyItMatters: WHY_TEMPLATES[category],
        sourceName: sources[i].name,
        sourceUrl: entry.link,
        publishedAt: Number.isNaN(ts) ? generatedAt : new Date(ts).toISOString(),
        impactScore: score,
        confidence,
        tags: extractTags(text),
        aiEnhanced: false,
      })
    }
  }

  const selected = dedupe(all)
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

  // 可选 LLM 增强：无 key 或失败都自动回退规则模式
  let status: DailyData['status'] = 'rule'
  const enhanced = await enhanceWithLLM(selected, dateStr)
  if (enhanced) {
    const byId = new Map(enhanced.items.map((it) => [it.id, it]))
    for (const item of selected) {
      const e = byId.get(item.id)
      if (e) {
        item.summary = e.summary
        item.whyItMatters = e.whyItMatters
        item.aiEnhanced = true
      }
    }
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
    topStoryIds: selected.slice(0, 3).map((i) => i.id),
    items: selected,
    sources: sourceStats,
  }

  writeOutputs(data)
  console.log(
    `[update] 完成：${selected.length} 条新闻，状态=${status}，已写入 src/data/daily.json 与 history/${dateStr}.json`
  )
}

main().catch((err) => {
  // 兜底：即使出现未预期错误也不让 Actions 失败，页面继续用旧数据
  console.error('[update] 未预期错误：', err)
  process.exit(0)
})
