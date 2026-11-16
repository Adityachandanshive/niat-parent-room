import facts from '@/data/niat_facts.json'

export type ToolResult = Record<string, unknown>

export const TOOL_DEFINITIONS = [
  {
    type: 'function' as const,
    function: {
      name: 'get_niat_facts',
      description:
        'Returns verified facts about the NIAT program, degree structure, and placement policy.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_campus_options',
      description: 'Returns NIAT campuses. Optionally filter by state.',
      parameters: {
        type: 'object',
        properties: {
          state: {
            type: 'string',
            description: 'State name to filter by, e.g. Telangana',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'classify_objection',
      description:
        "Classifies the parent's primary concern into a known objection category.",
      parameters: {
        type: 'object',
        properties: {
          concern: {
            type: 'string',
            description: "The parent's stated concern in their own words",
          },
        },
        required: ['concern'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_objection_response',
      description:
        'Returns a verified, guardrail-compliant response for a given objection category.',
      parameters: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            description:
              'One of: fees, placement_anxiety, is_niat_a_real_college, campus_location, hostel_safety, academic_pressure, comparison_btech, timing_payment, trust_credibility',
          },
        },
        required: ['category'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'score_intent',
      description:
        'Scores the parent intent from 0-100 based on their profile completeness.',
      parameters: {
        type: 'object',
        properties: {
          report_completed: { type: 'boolean' },
          voice_call_done: { type: 'boolean' },
          has_budget: { type: 'boolean' },
          has_campus: { type: 'boolean' },
        },
        required: [
          'report_completed',
          'voice_call_done',
          'has_budget',
          'has_campus',
        ],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'generate_counselor_brief',
      description:
        'Generates a structured brief for the human counselor based on the session.',
      parameters: {
        type: 'object',
        properties: {
          parent_name: { type: 'string' },
          child_name: { type: 'string' },
          campus: { type: 'string' },
          objection_category: { type: 'string' },
          session_summary: { type: 'string' },
        },
        required: [
          'parent_name',
          'child_name',
          'campus',
          'objection_category',
          'session_summary',
        ],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'log_lead',
      description:
        'Marks lead data for persistence. Actual DB write happens in the route handler.',
      parameters: {
        type: 'object',
        properties: {
          parent_name: { type: 'string' },
          child_name: { type: 'string' },
          campus: { type: 'string' },
          primary_concern: { type: 'string' },
        },
        required: ['parent_name', 'child_name'],
      },
    },
  },
]

export function executeTool(
  name: string,
  args: Record<string, unknown>,
): ToolResult {
  switch (name) {
    case 'get_niat_facts':
      return facts.program as unknown as ToolResult

    case 'get_campus_options': {
      const campuses = facts.campuses
      const state = args.state as string | undefined
      if (state) {
        return {
          campuses: campuses.filter((c) =>
            c.state.toLowerCase().includes(state.toLowerCase()),
          ),
        }
      }
      return { campuses }
    }

    case 'classify_objection': {
      const concern = ((args.concern as string) || '').toLowerCase()
      if (
        concern.includes('fee') ||
        concern.includes('cost') ||
        concern.includes('money') ||
        concern.includes('afford') ||
        concern.includes('expensive')
      )
        return { category: 'fees' }
      if (
        concern.includes('placement') ||
        concern.includes('job') ||
        concern.includes('career') ||
        concern.includes('salary') ||
        concern.includes('employ')
      )
        return { category: 'placement_anxiety' }
      if (
        concern.includes('college') ||
        concern.includes('degree') ||
        concern.includes('real') ||
        concern.includes('university') ||
        concern.includes('recognized') ||
        concern.includes('valid')
      )
        return { category: 'is_niat_a_real_college' }
      if (
        concern.includes('hostel') ||
        concern.includes('safety') ||
        concern.includes('accommodation') ||
        concern.includes('security')
      )
        return { category: 'hostel_safety' }
      if (
        concern.includes('distance') ||
        concern.includes('campus') ||
        concern.includes('location') ||
        concern.includes('far') ||
        concern.includes('near')
      )
        return { category: 'campus_location' }
      if (
        concern.includes('pressure') ||
        concern.includes('difficult') ||
        concern.includes('academics') ||
        concern.includes('stress') ||
        concern.includes('workload')
      )
        return { category: 'academic_pressure' }
      if (
        concern.includes('btech') ||
        concern.includes('b.tech') ||
        concern.includes('engineering') ||
        concern.includes('iit') ||
        concern.includes('nit') ||
        concern.includes('regular')
      )
        return { category: 'comparison_btech' }
      if (
        concern.includes('trust') ||
        concern.includes('credib') ||
        concern.includes('fake') ||
        concern.includes('scam') ||
        concern.includes('legit')
      )
        return { category: 'trust_credibility' }
      return { category: 'timing_payment' }
    }

    case 'get_objection_response': {
      const responses = facts.objection_responses as Record<string, string>
      const category = args.category as string
      return {
        response:
          responses[category] ||
          'A counselor will address this concern in detail.',
      }
    }

    case 'score_intent': {
      let score = 0
      if (args.report_completed) score += 30
      if (args.voice_call_done) score += 25
      if (args.has_budget) score += 20
      if (args.has_campus) score += 25
      return { intent_score: score }
    }

    case 'generate_counselor_brief': {
      const brief = [
        'COUNSELOR BRIEF',
        '──────────────────────',
        `Parent: ${args.parent_name}`,
        `Child: ${args.child_name}`,
        `Preferred campus: ${args.campus}`,
        `Primary concern: ${args.objection_category}`,
        '',
        'Session summary:',
        `${args.session_summary}`,
        '',
        `Recommended action: Address "${args.objection_category}" first.`,
        'Use verified objection response from the NIAT facts file.',
        'Do NOT make placement guarantees.',
      ].join('\n')
      return { brief }
    }

    case 'log_lead':
      return { logged: true, data: args }

    default:
      return { error: `Unknown tool: ${name}` }
  }
}
