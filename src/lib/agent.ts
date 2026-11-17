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
  const rawBase = process.env.TOKEN_FACTORY_BASE_URL || 'https://api.tokenfactory.ai/v1'
  const baseURL = rawBase.replace(/\/+$/, '')
  return new OpenAI({
    apiKey: process.env.TOKEN_FACTORY_API_KEY || 'dummy_key',
    baseURL,
  })
}

function getModel(): string {
  return process.env.TOKEN_FACTORY_MODEL || 'gpt-4o'
}

function summarizeResult(result: Record<string, unknown>): string {
  const str = JSON.stringify(result)
  return str.length > 200 ? str.slice(0, 200) + '…' : str
}

// Fallback deterministic report generator using verified tools
function generateDeterministicFallback(
  userPrompt: string,
): { reply: string; trace: TraceEntry[]; toolResults: Record<string, unknown> } {
  const trace: TraceEntry[] = []
  const toolResults: Record<string, unknown> = {}

  // 1. get_niat_facts
  const facts = executeTool('get_niat_facts', {})
  trace.push({
    tool: 'get_niat_facts',
    args: {},
    result_summary: summarizeResult(facts),
  })
  toolResults['get_niat_facts'] = facts

  // 2. classify_objection
  const classify = executeTool('classify_objection', { concern: userPrompt })
  trace.push({
    tool: 'classify_objection',
    args: { concern: userPrompt.slice(0, 50) },
    result_summary: summarizeResult(classify),
  })
  toolResults['classify_objection'] = classify

  // 3. get_objection_response
  const category = (classify as { category: string }).category || 'placement_anxiety'
  const objResponse = executeTool('get_objection_response', { category })
  trace.push({
    tool: 'get_objection_response',
    args: { category },
    result_summary: summarizeResult(objResponse),
  })
  toolResults['get_objection_response'] = objResponse

  // 4. score_intent
  const score = executeTool('score_intent', {
    report_completed: true,
    voice_call_done: false,
    has_budget: true,
    has_campus: true,
  })
  trace.push({
    tool: 'score_intent',
    args: { report_completed: true, voice_call_done: false, has_budget: true, has_campus: true },
    result_summary: summarizeResult(score),
  })
  toolResults['score_intent'] = score

  const responseObj = objResponse as Record<string, string>

  // Check if this is a follow-up chat question (shorter) vs initial report (longer prompt)
  const isFollowUp = userPrompt.length < 300 && !userPrompt.includes('Generate a personalized NIAT Decision Report')

  if (isFollowUp) {
    // For follow-up chat, give a concise answer based on the objection response
    const reply = handleTodoVerify(
      `${responseObj.response || 'That is a valid concern.'}\n\nIf you'd like more specific details, I'd recommend speaking with a senior campus counselor who can review your child's profile. Would you like to book a call?`
    )
    return { reply, trace, toolResults }
  }

  // Detect language if specified
  const isHindi = userPrompt.includes('Language: hi') || userPrompt.includes('हिंदी')
  const isTelugu = userPrompt.includes('Language: te') || userPrompt.includes('తెలుగు')

  let reply = ''
  if (isHindi) {
    reply = `NIAT व्यक्तिगत निर्णय रिपोर्ट

1. आपके बच्चे को क्या मिलता है (विश्वविद्यालय डिग्री + NIAT कौशल विकास):
डिग्री संबद्ध मान्यता प्राप्त विश्वविद्यालय द्वारा प्रदान की जाती है, NxtWave द्वारा नहीं। NIAT विश्वविद्यालय के पाठ्यक्रम के ऊपर 4 साल का उद्योग-उन्मुख कौशल विकास और व्यावहारिक प्रोजेक्ट्स प्रदान करता है।

2. कैंपस अनुकूलता:
आधुनिक कोडिंग लैब, 24/7 सुरक्षा और हॉस्टल सुविधाओं के साथ यह कैंपस उद्योग से जुड़ा हुआ है।

3. शुल्क और वित्तीय सहायता:
पारदर्शी ईएमआई और मेरिट छात्रवृत्ति उपलब्ध हैं। एक काउंसलर आपके चुने गए कैंपस के लिए सटीक शुल्क की पुष्टि करेगा।

4. आपकी चिंता का ईमानदार समाधान:
${responseObj.response || 'काउंसलर आपकी चिंता का विस्तार से समाधान करेंगे।'}

5. व्यावहारिक करियर मार्ग:
NIAT 1000+ कंपनियों के NxtWave हायरिंग नेटवर्क के माध्यम से संरचित प्लेसमेंट सहायता प्रदान करता है। प्लेसमेंट परिणाम छात्र के व्यक्तिगत प्रदर्शन और बाजार की स्थितियों पर निर्भर करते हैं। प्लेसमेंट की गारंटी नहीं है।

6. अनुशंसित अगला कदम:
बिना किसी दबाव के अपने सभी सवालों के विस्तृत समाधान के लिए हमारे सीनियर कैंपस काउंसलर के साथ 15 मिनट का परामर्श शेड्यूल करें।`
  } else if (isTelugu) {
    reply = `NIAT వ్యక్తిగతీకరించిన నిర్ణయ నివేదిక

1. మీ విద్యార్థికి ఏమి లభిస్తుంది (విశ్వవిద్యాలయ డిగ్రీ + NIAT నైపుణ్యాలు):
డిగ్రీని అనుబంధ గుర్తింపు పొందిన విశ్వవిద్యాలయం ప్రదానం చేస్తుంది, NxtWave కాదు. NIAT ఆ డిగ్రీతో పాటు 4 సంవత్సరాల ప్రాక్టికల్ పరిశ్రమ నైపుణ్యాలను మరియు లైవ్ ప్రాజెక్ట్‌లను అందిస్తుంది.

2. క్యాంపస్ అనుకూలత:
ఆధునిక కోడింగ్ ల్యాబ్‌లు మరియు 24/7 సురక్షిత హాస్టల్ వసతితో పరిశ్రమకు సమీపంలో ఉంటుంది.

3. ఫీజు మరియు ఉపకార వేతనాలు:
సులభ వాయిదాల పద్ధతి (EMI) మరియు స్కాలర్‌షిప్ సదుపాయాలు ఉన్నాయి. సరైన ఫీజు వివరాలను మా క్యాంపస్ కౌన్సిలర్ ధృవీకరిస్తారు.

4. మీ ప్రధాన ఆందోళనకు ప్రత్యుత్తరం:
${responseObj.response || 'మీ ఆందోళనపై కౌన్సిలర్ మరింత స్పష్టతను అందిస్తారు.'}

5. వాస్తవిక కెరీర్ మార్గం:
NIAT 1000+ కంపెనీల NxtWave రిక్రూట్‌మెంట్ నెట్‌వర్క్ ద్వారా ప్లేస్‌మెంట్ మద్దతును అందిస్తుంది. ఫలితాలు విద్యార్థి కష్టపడే తత్వం మరియు మార్కెట్ పరిస్థితులపై ఆధారపడి ఉంటాయి. ప్లేస్‌మెంట్ గ్యారెంటీ ఉండదు.

6. తదుపరి సిఫార్సు:
మరిన్ని వివరాల కోసం సీనియర్ క్యాంపస్ కౌన్సిలర్‌తో 15 నిమిషాల కౌన్సిలింగ్ కాల్ బుక్ చేసుకోండి.`
  } else {
    reply = `PERSONALIZED NIAT DECISION REPORT

1. What your child gets (University Degree + NIAT Upskilling):
The university degree (B.Tech / BCA) is officially awarded by NIAT's collaborating accredited university, not by NxtWave. NIAT provides the practical, industry-oriented upskilling layer on top of the degree curriculum through production-level coding and live projects.

2. Best Campus Fit:
The campus offers dedicated hostel facilities with 24/7 security, high-speed coding labs, and direct proximity to regional technology corridors.

3. Fee and Financial Context:
NIAT provides transparent installment (EMI) options and merit-based scholarship assistance. A counselor will confirm the exact fee structure for your preferred campus.

4. Your Concern, Addressed Honestly:
${responseObj.response || 'A counselor will discuss this in detail during your 1-on-1 consultation.'}

5. Realistic Career Path:
NIAT provides structured interview preparation and direct access to NxtWave's hiring ecosystem of over 1,000 partner companies. Outcomes depend on student discipline, academic performance, and hiring market conditions. Placement is not guaranteed.

6. Recommended Next Step:
Schedule a 15-minute alignment call with a senior campus advisor to review your child's profile with zero admission pressure.`
  }

  reply = handleTodoVerify(reply)
  return { reply, trace, toolResults }
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

  try {
    for (let i = 0; i < maxIter; i++) {
      let response: OpenAI.Chat.ChatCompletion
      try {
        response = await client.chat.completions.create({
          model,
          messages,
          tools: TOOL_DEFINITIONS as OpenAI.Chat.ChatCompletionTool[],
          tool_choice: 'auto',
          max_tokens: 1500,
        })
      } catch (toolCallErr) {
        console.warn(
          `[Agent] Tool call failed or model does not support tools (${(toolCallErr as Error).message}). Retrying without tools...`,
        )
        // Retry without tools parameter if model rejects tools
        response = await client.chat.completions.create({
          model,
          messages,
          max_tokens: 1500,
        })
      }

      const choice = response.choices[0]
      if (!choice) break

      // Handle tool calls if returned
      if (
        choice.finish_reason === 'tool_calls' ||
        (choice.message.tool_calls && choice.message.tool_calls.length > 0)
      ) {
        messages.push(choice.message as OpenAI.Chat.ChatCompletionMessageParam)

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

      // Guardrail check
      const guardrailResult = checkGuardrails(reply)
      if (!guardrailResult.safe) {
        console.warn('[guardrail] Blocked phrases detected:', guardrailResult.violations)
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
          max_tokens: 1500,
        })
        const retryReply = retry.choices[0]?.message.content || ''
        const retryCheck = checkGuardrails(retryReply)
        reply = retryCheck.safe ? retryReply : SAFE_FALLBACK
      }

      reply = handleTodoVerify(reply)
      return { reply, trace, toolResults }
    }

    return { reply: SAFE_FALLBACK, trace, toolResults }
  } catch (apiError) {
    console.error('[Agent] LLM API call failed:', (apiError as Error).message)
    // Seamless fallback to deterministic verified knowledge engine
    const lastUserPrompt = userMessages[userMessages.length - 1]?.content || ''
    return generateDeterministicFallback(lastUserPrompt)
  }
}
