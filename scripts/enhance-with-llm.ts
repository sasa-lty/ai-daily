/**
 * 可选 LLM 增强模块。
 *
 * 触发条件（按优先级）：
 *   1. 检测到 KIMI_API_KEY   -> 使用 Moonshot/Kimi（OpenAI 兼容接口）
 *   2. 检测到 OPENAI_API_KEY -> 使用 OpenAI 或 LLM_BASE_URL 指定的兼容接口
 * 可用 LLM_BASE_URL / LLM_MODEL 覆盖默认端点与模型。
 *
 * 任何一步失败都返回 null，调用方回退到规则摘要，绝不让 API 成为必要条件。
 */
import type { NewsItem } from '../src/lib/types.js'

export interface LlmEnhancement {
  /** id -> 更自然的摘要与“为什么重要” */
  items: Array<{ id: string; summary: string; whyItMatters: string }>
  /** 今日总评（一句话判断） */
  verdict: string
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

function buildPrompt(items: NewsItem[], dateStr: string): string {
  const list = items
    .map(
      (it, i) =>
        `${i + 1}. [id=${it.id}] [分类=${it.category}] ${it.title}\n   原始摘要：${it.summary}`
    )
    .join('\n')

  return `你是一名中文 AI 行业日报编辑，文字风格：直接、信息密度高、不标题党、每条说明为什么值得看。

今天是 ${dateStr}。以下是今日筛选出的 ${items.length} 条 AI 新闻，请完成两件事：
1. 为每条新闻改写 summary（40-60 字，说清发生了什么）和 whyItMatters（20-40 字，说清为什么值得关注，不要空话）。
2. 写一句今日总评 verdict（60 字以内，指出今天信号最密集的方向，像编辑判断而不是流水账）。

严格输出 JSON，不要输出任何其他内容，格式：
{"items":[{"id":"原样保留的id","summary":"...","whyItMatters":"..."}],"verdict":"..."}

新闻列表：
${list}`
}

function extractJson(text: string): unknown {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('LLM 返回内容中未找到 JSON')
  return JSON.parse(text.slice(start, end + 1))
}

function isValid(data: unknown): data is LlmEnhancement {
  if (typeof data !== 'object' || data === null) return false
  const d = data as Record<string, unknown>
  if (typeof d.verdict !== 'string' || d.verdict.length < 5) return false
  if (!Array.isArray(d.items)) return false
  return (d.items as unknown[]).every((it) => {
    const o = it as Record<string, unknown>
    return (
      typeof o.id === 'string' &&
      typeof o.summary === 'string' &&
      o.summary.length >= 10 &&
      typeof o.whyItMatters === 'string' &&
      o.whyItMatters.length >= 5
    )
  })
}

export async function enhanceWithLLM(
  items: NewsItem[],
  dateStr: string
): Promise<LlmEnhancement | null> {
  const config = resolveConfig()
  if (!config) return null // 无 API key：静默走规则模式

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 45_000)

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
          { role: 'system', content: '你是严谨的中文 AI 行业日报编辑，只输出 JSON。' },
          { role: 'user', content: buildPrompt(items, dateStr) },
        ],
      }),
    })

    if (!res.ok) throw new Error(`LLM API HTTP ${res.status}`)

    const payload = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const content = payload.choices?.[0]?.message?.content
    if (!content) throw new Error('LLM 返回为空')

    const parsed = extractJson(content)
    if (!isValid(parsed)) throw new Error('LLM 返回 JSON 结构不符合预期')

    console.log(`[llm] AI 增强成功（${config.model}）`)
    return parsed
  } catch (err) {
    console.warn(
      `[llm] AI 增强失败，回退到规则摘要：${err instanceof Error ? err.message : String(err)}`
    )
    return null
  } finally {
    clearTimeout(timer)
  }
}
