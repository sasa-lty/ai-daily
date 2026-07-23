/**
 * 可选 LLM 增强模块（v2 严格结构化协议）。
 *
 * 触发条件（按优先级）：
 *   1. 检测到 KIMI_API_KEY   -> 使用 Moonshot/Kimi（OpenAI 兼容接口）
 *   2. 检测到 OPENAI_API_KEY -> 使用 OpenAI 或 LLM_BASE_URL 指定的兼容接口
 * 可用 LLM_BASE_URL / LLM_MODEL 覆盖默认端点与模型。
 *
 * 任何一步失败都返回 null，调用方回退到规则模式，绝不让 API 成为必要条件。
 */
import type { NewsItem } from '../src/lib/types.js'

export interface LlmItemEnhancement {
  id: string
  /** 中文事实标题 */
  title: string
  /** 发生了什么：70-120 字 */
  summary: string
  /** 关键事实 2-3 条 */
  keyFacts: string[]
  /** 为什么重要：40-80 字，具体影响 */
  whyItMatters: string
  /** 原始发布方或“综合来源” */
  sourceDisplayName: string
  /** 置信依据 */
  confidenceReason: string
}

export interface LlmEnhancement {
  verdict: string
  /** LLM 综合评选的今日三件事（允许少于 3 条） */
  topStoryIds: string[]
  items: LlmItemEnhancement[]
}

interface LlmConfig {
  apiKey: string
  baseUrl: string
  model: string
}

function resolveConfig(): LlmConfig | null {
  const baseUrlOverride = process.env.LLM_BASE_URL?.replace(/\/+$/, '')
  const modelOverride = process.env.LLM_MODEL

  if (process.env.KIMI_API_KEY) {
    return {
      apiKey: process.env.KIMI_API_KEY,
      baseUrl: baseUrlOverride ?? 'https://api.moonshot.cn/v1',
      model: modelOverride ?? 'moonshot-v1-8k',
    }
  }
  if (process.env.OPENAI_API_KEY) {
    return {
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: baseUrlOverride ?? 'https://api.openai.com/v1',
      model: modelOverride ?? 'gpt-4o-mini',
    }
  }
  return null
}

function buildPrompt(items: NewsItem[], dateStr: string, editorialReference?: string): string {
  const list = items
    .map(
      (it, i) =>
        `${i + 1}. [id=${it.id}] [分类=${it.category}] [来源=${it.sourceDisplayName ?? it.sourceName}] [时间=${it.publishedAt}]\n   标题：${it.title}\n   摘要：${it.summary}\n   原文：${it.sourceUrl}`
    )
    .join('\n')

  const referenceBlock = editorialReference
    ? `\n以下是一份编辑参考日报的概览文字，仅用于帮助你判断哪些事件更重要、如何归纳角度；严禁逐字复制其中句子，严禁把该日报或其品牌名当作来源：\n"""\n${editorialReference}\n"""\n`
    : ''

  return `你是一名中文 AI 行业日报主编。风格：直接、事实密集、不标题党、每条说明具体影响。今天是 ${dateStr}。

候选新闻（共 ${items.length} 条）：
${list}
${referenceBlock}
请完成：
1. 从候选中选出“今日三件事”（topStoryIds）：综合考量行业影响、信息新鲜度、是否为模型发布/重要产品更新/行业转折、来源可靠性与交叉验证、彼此是否重复。尽量覆盖不同主题，避免三条都来自同一公司或同一类事件。可靠的重要新闻不足三条时可以少于三条，禁止硬凑。
2. 为每条候选新闻输出结构化字段。

硬性规则：
- id 必须原样保留，不得新增或修改 id。
- 不得编造输入中不存在的数字、版本号、发布日期和公司来源。
- title：中文事实标题；英文标题必须改写为自然中文，不保留截断英文。
- summary：70-120 字，写清主体、产品/模型、版本、关键数字和结果。
- keyFacts：2-3 条短句，每条不超过 40 字，必须来自输入事实。
- whyItMatters：40-80 字，说明具体影响（对谁、影响什么决策）。禁止使用“可能改变行业”“值得关注”“反映竞争格局”“意义重大”等无事实支撑的空话。
- sourceDisplayName：事件的原始发布方（公司/机构/产品名）；无法可靠识别时填“综合来源”。禁止出现“橘鸦”“Juya”“AI 日报”“早报”等转载包装名。
- confidenceReason：从“官方发布 / 多来源验证 / 单一来源 / 传闻待证”中选一个，可附不超过 10 字的说明。

严格输出 JSON，不要输出任何其他内容：
{"verdict":"60 字以内的今日核心判断，指出信号最密集的方向","topStoryIds":["id1","id2","id3"],"items":[{"id":"...","title":"...","summary":"...","keyFacts":["...","..."],"whyItMatters":"...","sourceDisplayName":"...","confidenceReason":"..."}]}`
}

function extractJson(text: string): unknown {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('LLM 返回内容中未找到 JSON')
  return JSON.parse(text.slice(start, end + 1))
}

function isValidItem(it: unknown, validIds: Set<string>): it is LlmItemEnhancement {
  const o = it as Record<string, unknown>
  if (typeof o !== 'object' || o === null) return false
  if (typeof o.id !== 'string' || !validIds.has(o.id)) return false
  if (typeof o.title !== 'string' || o.title.length < 4 || o.title.length > 80) return false
  if (typeof o.summary !== 'string' || o.summary.length < 30 || o.summary.length > 200) return false
  if (!Array.isArray(o.keyFacts) || o.keyFacts.length < 1 || o.keyFacts.length > 4) return false
  if (!(o.keyFacts as unknown[]).every((f) => typeof f === 'string' && (f as string).length >= 2)) return false
  if (typeof o.whyItMatters !== 'string' || o.whyItMatters.length < 10 || o.whyItMatters.length > 120) return false
  if (typeof o.sourceDisplayName !== 'string' || o.sourceDisplayName.length < 2 || o.sourceDisplayName.length > 40) return false
  if (typeof o.confidenceReason !== 'string' || o.confidenceReason.length < 2 || o.confidenceReason.length > 40) return false
  return true
}

function validate(data: unknown, validIds: Set<string>): LlmEnhancement {
  if (typeof data !== 'object' || data === null) throw new Error('返回不是对象')
  const d = data as Record<string, unknown>
  if (typeof d.verdict !== 'string' || d.verdict.length < 10) throw new Error('verdict 缺失或过短')
  if (!Array.isArray(d.items)) throw new Error('items 缺失')

  const items = (d.items as unknown[]).filter((it): it is LlmItemEnhancement =>
    isValidItem(it, validIds)
  )
  if (items.length === 0) throw new Error('没有通过校验的条目')

  const rawTop = Array.isArray(d.topStoryIds) ? (d.topStoryIds as unknown[]) : []
  const topStoryIds = [...new Set(rawTop)]
    .filter((id): id is string => typeof id === 'string' && validIds.has(id))
    .slice(0, 3)

  return { verdict: d.verdict, topStoryIds, items }
}

export async function enhanceWithLLM(
  items: NewsItem[],
  dateStr: string,
  editorialReference?: string
): Promise<LlmEnhancement | null> {
  const config = resolveConfig()
  if (!config) return null // 无 API key：静默走规则模式

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 60_000)

  try {
    const res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.3,
        messages: [
          { role: 'system', content: '你是严谨的中文 AI 行业日报主编，只输出符合要求的 JSON。' },
          { role: 'user', content: buildPrompt(items, dateStr, editorialReference) },
        ],
      }),
    })

    if (!res.ok) throw new Error(`LLM API HTTP ${res.status}`)

    const payload = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const content = payload.choices?.[0]?.message?.content
    if (!content) throw new Error('LLM 返回为空')

    const validIds = new Set(items.map((it) => it.id))
    const parsed = validate(extractJson(content), validIds)

    console.log(
      `[llm] AI 增强成功（${config.model}）：${parsed.items.length} 条改写，三件事 ${parsed.topStoryIds.length} 条`
    )
    return parsed
  } catch (err) {
    console.warn(
      `[llm] AI 增强失败，回退到规则模式：${err instanceof Error ? err.message : String(err)}`
    )
    return null
  } finally {
    clearTimeout(timer)
  }
}
