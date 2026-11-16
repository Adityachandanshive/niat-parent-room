import { describe, it, expect } from 'vitest'
import { checkGuardrails, handleTodoVerify } from '../src/lib/guardrails'
import { executeTool } from '../src/lib/tools'

describe('Guardrails Engine', () => {
  describe('Blocked phrase detection', () => {
    it('flags guaranteed placement claims', () => {
      const res = checkGuardrails('We offer guaranteed placement for all our engineering graduates.')
      expect(res.safe).toBe(false)
      expect(res.violations).toContain('guaranteed placement')
    })

    it('flags 100% placement claims', () => {
      const res = checkGuardrails('Our program delivers 100% placement assistance and results.')
      expect(res.safe).toBe(false)
      expect(res.violations).toContain('100% placement')
    })

    it('flags assured job claims', () => {
      const res = checkGuardrails('Students receive an assured job upon finishing 4th year.')
      expect(res.safe).toBe(false)
      expect(res.violations).toContain('assured job')
    })

    it('flags job guarantee claims', () => {
      const res = checkGuardrails('Every student has a job guarantee.')
      expect(res.safe).toBe(false)
      expect(res.violations).toContain('job guarantee')
    })

    it('flags definite placement claims', () => {
      const res = checkGuardrails('We promise a definite placement with top product companies.')
      expect(res.safe).toBe(false)
      expect(res.violations).toContain('definite placement')
    })

    it('approves honest, compliant placement support terminology', () => {
      const safeText =
        'NIAT provides structured placement support and career access to 1000+ hiring partners. Placement outcomes depend entirely on individual student performance and market conditions.'
      const res = checkGuardrails(safeText)
      expect(res.safe).toBe(true)
      expect(res.violations).toHaveLength(0)
    })
  })

  describe('TODO_VERIFY handling', () => {
    it('replaces unconfirmed TODO_VERIFY placeholders with safe counselor fallback', () => {
      const rawText = 'The annual hostel fee is TODO_VERIFY per year.'
      const cleaned = handleTodoVerify(rawText)
      expect(cleaned).toBe('The annual hostel fee is A counselor will confirm this detail. per year.')
      expect(cleaned).not.toContain('TODO_VERIFY')
    })

    it('leaves text without TODO_VERIFY unchanged', () => {
      const normalText = 'Campuses are located in Hyderabad, Vijayawada, and Bengaluru.'
      expect(handleTodoVerify(normalText)).toBe(normalText)
    })
  })

  describe('Agent Tool Execution', () => {
    it('classifies fee objections correctly', () => {
      const res = executeTool('classify_objection', { concern: 'Is the tuition fee too expensive for middle class?' })
      expect(res).toEqual({ category: 'fees' })
    })

    it('classifies college legitimacy objections correctly', () => {
      const res = executeTool('classify_objection', { concern: 'Is NIAT a real recognized college or just an institute?' })
      expect(res).toEqual({ category: 'is_niat_a_real_college' })
    })

    it('classifies placement anxiety correctly', () => {
      const res = executeTool('classify_objection', { concern: 'What if my child does not get a job after 4 years?' })
      expect(res).toEqual({ category: 'placement_anxiety' })
    })

    it('computes intent score accurately', () => {
      const fullProfile = executeTool('score_intent', {
        report_completed: true,
        voice_call_done: true,
        has_budget: true,
        has_campus: true,
      })
      expect(fullProfile).toEqual({ intent_score: 100 })

      const partialProfile = executeTool('score_intent', {
        report_completed: true,
        voice_call_done: false,
        has_budget: false,
        has_campus: true,
      })
      expect(partialProfile).toEqual({ intent_score: 55 })
    })

    it('returns verified program facts with placement guardrail notes', () => {
      const facts = executeTool('get_niat_facts', {}) as Record<string, string>
      expect(facts.degree_note).toContain('collaborating university')
      expect(facts.placement_note).toContain('Placement is not guaranteed')
      expect(facts.nat_note).toContain('not a university entrance exam')
    })
  })
})
