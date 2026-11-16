import OpenAI from 'openai'
import { TOOL_DEFINITIONS, executeTool } from './tools'
import {
  checkGuardrails,
  handleTodoVerify,
  SYSTEM_PROMPT,
  CORRECTIVE_MESSAGE,
} from './guardrails'

export type TraceEntry = {
  tool: string
  args: Record<string, unknown>
  result_summary: string
}

export type AgentResult = {
  reply: string
  trace: TraceEntry[]
  toolResults: Record<string, unknown>
}

const SAFE_FALLBACK =
  "I'd recommend speaking with a counselor who can address your questions in detail. Would you like to book a call?"

const MAX_ITERATIONS = 6

function getClient() {
  return new OpenAI({
    apiKey: process.env.TOKEN_FACTORY_API_KEY,
    baseURL: process.env.TOKEN_FACTORY_BASE_URL,
  })
}

function getModel(): string {
  const model = process.env.TOKEN_FACTORY_MODEL
  if (!model) {
    throw new Error('TOKEN_FACTORY_MODEL environment variable is required')
  }
  return model
}

function summarizeResult(result: Record<string, unknown>): string {
  const str = JSON.stringify(result)
  return str.length > 200 ? str.slice(0, 200) + '…' : str
}

export async function runAgent(
  userMessages: Array<{ role: 'user' | 'assistant'; content: string }>,
  options?: { maxIterations?: number },
): Promise<AgentResult> {
  const client = getClient()
  const model = getModel()
  const maxIter = options?.maxIterations ?? MAX_ITERATIONS
  const trace: TraceEntry[] = []
  const toolResults: Record<string, unknown> = {}

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...userMessages,
  ]

  for (let i = 0; i < maxIter; i++) {
    const response = await client.chat.completions.create({
      model,
      messages,
      tools: TOOL_DEFINITIONS as OpenAI.Chat.ChatCompletionTool[],
      tool_choice: 'auto',
      max_tokens: 1500,
    })

    const choice = response.choices[0]
    if (!choice) break

    if (
      choice.finish_reason === 'tool_calls' ||
      (choice.message.tool_calls && choice.message.tool_calls.length > 0)
    ) {
      messages.push(
        choice.message as OpenAI.Chat.ChatCompletionMessageParam,
      )

      for (const tc of choice.message.tool_calls || []) {
        let args: Record<string, unknown> = {}
        try {
          args = JSON.parse(tc.function.arguments)
        } catch {
          args = {}
        }
        const result = executeTool(tc.function.name, args)
        trace.push({
          tool: tc.function.name,
          args,
          result_summary: summarizeResult(result),
        })
        toolResults[tc.function.name] = result
        messages.push({
          role: 'tool' as const,
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        })
      }
      continue
    }

    let reply = choice.message.content || ''

    const guardrailResult = checkGuardrails(reply)
    if (!guardrailResult.safe) {
      console.warn(
        '[guardrail] Blocked phrases detected:',
        guardrailResult.violations,
      )
      messages.push({
        role: 'assistant',
        content: reply,
      } as OpenAI.Chat.ChatCompletionMessageParam)
      messages.push({
        role: 'user',
        content: CORRECTIVE_MESSAGE,
      } as OpenAI.Chat.ChatCompletionMessageParam)

      const retry = await client.chat.completions.create({
        model,
        messages,
        tools: TOOL_DEFINITIONS as OpenAI.Chat.ChatCompletionTool[],
        tool_choice: 'none',
        max_tokens: 1500,
      })
      const retryReply = retry.choices[0]?.message.content || ''
      const retryCheck = checkGuardrails(retryReply)
      if (!retryCheck.safe) {
        console.warn('[guardrail] Retry also failed. Using safe fallback.')
        reply = SAFE_FALLBACK
      } else {
        reply = retryReply
      }
    }

    reply = handleTodoVerify(reply)
    return { reply, trace, toolResults }
  }

  return { reply: SAFE_FALLBACK, trace, toolResults }
}
