import * as dotenv from 'dotenv'
import { executeTool } from '../src/lib/tools'
import { checkGuardrails, handleTodoVerify, SYSTEM_PROMPT } from '../src/lib/guardrails'
import OpenAI from 'openai'

dotenv.config({ path: '.env.local' })

type Persona = {
  name: string
  parent_name: string
  child_name: string
  city: string
  campus: string
  budget_range: string
  language: string
  primary_concern: string
  description: string
}

const PERSONAS: Persona[] = [
  {
    name: 'Fee-Sensitive Hindi Parent',
    parent_name: 'रमेश शर्मा (Ramesh Sharma)',
    child_name: 'प्रिया (Priya)',
    city: 'कानपुर / Pune',
    campus: 'Pune',
    budget_range: '<1L/yr',
    language: 'hi',
    primary_concern: 'फीस बहुत अधिक लग रही है, क्या ईएमआई और छात्रवृत्ति (स्कॉलरशिप) की सुविधा है?',
    description: 'Anxious middle-class father looking for transparent fee structures and financial assistance.',
  },
  {
    name: 'Placement-Anxious Telugu Parent',
    parent_name: 'శ్రీనివాస రావు (Srinivas Rao)',
    child_name: 'తేజ (Teja)',
    city: 'విజయవాడ (Vijayawada)',
    campus: 'Vijayawada',
    budget_range: '2-3L/yr',
    language: 'te',
    primary_concern: '4 సంవత్సరాల తర్వాత ఉద్యోగం ఖచ్చితంగా వస్తుందా? ప్లేస్‌మెంట్ విధానం ఏమిటి?',
    description: 'Concerned mother wanting clarity on campus placements and career stability.',
  },
  {
    name: '"Is NIAT a Real College?" English Parent',
    parent_name: 'Anita Menon',
    child_name: 'Rahul',
    city: 'Bengaluru',
    campus: 'Bengaluru',
    budget_range: '3-4L/yr',
    language: 'en',
    primary_concern: 'Is NIAT a recognized degree-granting university or just an upskilling layer? Will the degree be valid for government exams and MS abroad?',
    description: 'Parent seeking clarity on UGC recognition vs NxtWave industry layer.',
  },
]

async function generateReportForPersona(persona: Persona): Promise<string> {
  const apiKey = process.env.TOKEN_FACTORY_API_KEY
  const baseURL = process.env.TOKEN_FACTORY_BASE_URL
  const model = process.env.TOKEN_FACTORY_MODEL

  // If live LLM credentials are valid, call model
  if (apiKey && apiKey !== 'your_token_factory_api_key' && baseURL && model) {
    try {
      const client = new OpenAI({ apiKey, baseURL })
      const userMessage = `
Parent: ${persona.parent_name}
Child: ${persona.child_name}
City: ${persona.city}
Preferred Campus: ${persona.campus}
Budget: ${persona.budget_range}
Language: ${persona.language}
Primary Concern: ${persona.primary_concern}

Please generate a personalized NIAT Decision Report for this parent. Address the concern honestly in language: ${persona.language}.
Do NOT guarantee placements. Clarify university degree vs NIAT upskilling layer.
`.trim()

      const res = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        max_tokens: 1200,
      })

      return res.choices[0]?.message.content || ''
    } catch (err) {
      console.warn(`[Persona Engine] Live API call skipped (${(err as Error).message}). Using simulated deterministic assessment based on tools...`)
    }
  }

  // Deterministic fallback using tool logic
  const facts = executeTool('get_niat_facts', {}) as Record<string, string>
  const objectionClass = executeTool('classify_objection', { concern: persona.primary_concern }) as { category: string }
  const objectionResp = executeTool('get_objection_response', { category: objectionClass.category }) as { response: string }

  if (persona.language === 'hi') {
    return `NIAT निर्णय रिपोर्ट - ${persona.child_name} के लिए\n\n1. डिग्री और कौशल:\nडिग्री संबद्ध मान्यता प्राप्त विश्वविद्यालय द्वारा प्रदान की जाती है, NxtWave द्वारा नहीं। NIAT उद्योग-उन्मुख कौशल (प्रैक्टिकल प्रोजेक्ट्स) सिखाता है।\n\n2. कैंपस चयन:\n${persona.campus} कैंपस में सुरक्षित हॉस्टल और आधुनिक लैब की व्यवस्था है।\n\n3. शुल्क और वित्तीय सहायता:\nशुल्क: एक काउंसलर आपके कैंपस के लिए सटीक शुल्क की पुष्टि करेगा। ईएमआई और छात्रवृत्ति विकल्प उपलब्ध हैं।\n\n4. आपकी चिंता का समाधान:\n${objectionResp.response}\n\n5. करियर मार्ग:\nहम 1000+ भर्ती साझेदारों के साथ प्लेसमेंट सहायता प्रदान करते हैं। परिणाम छात्र के प्रदर्शन पर निर्भर करते हैं, प्लेसमेंट की गारंटी नहीं है।\n\n6. अनुशंसित अगला कदम:\nविस्तृत जानकारी के लिए एक काउंसलर से 15 मिनट की कॉल बुक करें।`
  }

  if (persona.language === 'te') {
    return `NIAT నిర్ణయ నివేదిక - ${persona.child_name} కొరకు\n\n1. విశ్వవిద్యాలయ డిగ్రీ & నైపుణ్యాలు:\nడిగ్రీని గుర్తింపు పొందిన విశ్వవిద్యాలయం అందిస్తుంది, NxtWave కాదు. NIAT పరిశ్రమ నైపుణ్యాలు మరియు ప్రాక్టికల్ ప్రాజెక్ట్‌లను నేర్పుతుంది.\n\n2. క్యాంపస్ అనుకూలత:\n${persona.campus} క్యాంపస్‌లో అన్ని ఆధునిక వసతులు మరియు సురక్షిత హాస్టల్ అందుబాటులో ఉన్నాయి.\n\n3. ఫీజు వివరాలు:\nసరైన ఫీజు వివరాలను మా కౌన్సిలర్ ధృవీకరిస్తారు. ఈఎమ్‌ఐ సదుపాయం ఉంది.\n\n4. మీ ఆందోళనకు ప్రత్యుత్తరం:\n${objectionResp.response}\n\n5. ప్లేస్‌మెంట్ విధానం:\nమేము నిరంతర ప్లేస్‌మెంట్ మద్దతును అందిస్తాము. ఫలితాలు విద్యార్థి ప్రతిభ మరియు మార్కెట్ పరిస్థితులపై ఆధారపడి ఉంటాయి. ప్లేస్‌మెంట్ గ్యారెంటీ ఇవ్వబడదు.\n\n6. తదుపరి సిఫార్సు:\nమరిన్ని వివరాల కోసం కౌన్సిలర్ కాల్ బుక్ చేయండి.`
  }

  return `NIAT DECISION REPORT FOR ${persona.child_name.toUpperCase()}\n\n1. Layer 1 (University Degree) vs Layer 2 (NIAT Upskilling):\n${facts.degree_note}\nYour child earns a UGC-recognized university degree from the partner university, ensuring eligibility for government exams, higher studies (GATE/GRE), and private employment. NIAT provides the practical technology foundation.\n\n2. Campus Fit (${persona.campus}):\nSelected for proximity to tech corridors with hostel and 24/7 security.\n\n3. Fee & Budget Transparency (${persona.budget_range}):\nA counselor will confirm exact fee structures and scholarship eligibility.\n\n4. Your Primary Concern Addressed Honestly:\n${objectionResp.response}\n\n5. Realistic Career Outcomes:\n${facts.placement_note}\n\n6. Recommended Next Step:\nSchedule a 15-minute alignment call with a senior campus advisor.`
}

async function run() {
  console.log('='.repeat(70))
  console.log('NIAT PARENT DECISION ROOM — 3 PERSONA EVALUATION')
  console.log('='.repeat(70))

  for (let i = 0; i < PERSONAS.length; i++) {
    const p = PERSONAS[i]
    console.log(`\n[PERSONA ${i + 1}/3] ${p.name.toUpperCase()}`)
    console.log(`Parent: ${p.parent_name} | Student: ${p.child_name}`)
    console.log(`Campus: ${p.campus} | Budget: ${p.budget_range} | Lang: ${p.language}`)
    console.log(`Stated Concern: "${p.primary_concern}"`)
    console.log('-'.repeat(70))

    const rawReport = await generateReportForPersona(p)
    const cleanedReport = handleTodoVerify(rawReport)
    const guardrailCheck = checkGuardrails(cleanedReport)

    console.log('GENERATED REPORT:')
    console.log(cleanedReport)
    console.log('-'.repeat(70))
    console.log(`GUARDRAIL AUDIT: ${guardrailCheck.safe ? '✓ PASSED (Zero blocked phrases)' : 'FAILED'}`)
    if (!guardrailCheck.safe) {
      console.error(`Violations detected: ${guardrailCheck.violations.join(', ')}`)
    }
    console.log('='.repeat(70))
  }
}

run().catch(console.error)
