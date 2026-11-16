'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Locale,
  LANGUAGE_OPTIONS,
  t,
  getConcernLabel,
  formatReportDesc,
} from '@/lib/i18n'
import { ArrowRight, Check, Compass, ShieldCheck, HelpCircle } from 'lucide-react'

const CAMPUSES = [
  { name: 'Hyderabad', state: 'Telangana' },
  { name: 'Vijayawada', state: 'Andhra Pradesh' },
  { name: 'Visakhapatnam', state: 'Andhra Pradesh' },
  { name: 'Chennai', state: 'Tamil Nadu' },
  { name: 'Bengaluru', state: 'Karnataka' },
  { name: 'Pune', state: 'Maharashtra' },
]

const BUDGET_OPTIONS = [
  '<1L/yr',
  '1-2L/yr',
  '2-3L/yr',
  '3-4L/yr',
  '4L+/yr',
  'Not sure',
]

const CONCERNS = [
  'fees',
  'placement_anxiety',
  'is_niat_a_real_college',
  'campus_location',
  'hostel_safety',
  'academic_pressure',
  'comparison_btech',
  'timing_payment',
  'trust_credibility',
]

export default function HomePage() {
  const router = useRouter()
  const [locale, setLocale] = useState<Locale>('en')
  const [step, setStep] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [form, setForm] = useState({
    parent_name: '',
    child_name: '',
    phone: '',
    city: '',
    campus: '',
    budget_range: '',
    primary_concern: 'placement_anxiety',
  })

  const updateField = (field: string, val: string) => {
    setForm((prev) => ({ ...prev, [field]: val }))
    setErrorMsg(null)
  }

  const validateStep = (currentStep: number): boolean => {
    if (currentStep === 1) {
      if (!form.parent_name.trim()) {
        setErrorMsg('Please enter your name.')
        return false
      }
      if (!form.child_name.trim()) {
        setErrorMsg("Please enter your child's name.")
        return false
      }
      if (!form.phone.trim() || form.phone.trim().length < 8) {
        setErrorMsg('Please enter a valid WhatsApp contact number.')
        return false
      }
      if (!form.city.trim()) {
        setErrorMsg('Please enter your city.')
        return false
      }
    } else if (currentStep === 2) {
      if (!form.campus) {
        setErrorMsg('Please select a preferred campus.')
        return false
      }
      if (!form.budget_range) {
        setErrorMsg('Please choose an annual budget range.')
        return false
      }
    } else if (currentStep === 3) {
      if (!form.primary_concern) {
        setErrorMsg('Please select your primary area of concern.')
        return false
      }
    }
    setErrorMsg(null)
    return true
  }

  const nextStep = () => {
    if (validateStep(step)) {
      setStep((s) => s + 1)
    }
  }

  const prevStep = () => {
    setErrorMsg(null)
    setStep((s) => Math.max(0, s - 1))
  }

  const handleSubmit = async () => {
    if (!validateStep(3)) return
    setLoading(true)
    setErrorMsg(null)

    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          language: locale,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to generate report. Please try again.')
      }

      const data = await res.json()
      if (typeof window !== 'undefined') {
        localStorage.setItem('niat_session_id', data.session_id)
        localStorage.setItem('niat_lead_id', data.lead_id)
        localStorage.setItem('niat_locale', locale)
      }

      router.push(`/report/${data.lead_id}`)
    } catch (err: unknown) {
      console.error(err)
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Unable to connect to the counselor engine. Please retry.',
      )
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#FAFAF7] text-stone-900 px-4 py-8 sm:py-16 selection:bg-amber-100 selection:text-amber-900">
      <div className="max-w-xl mx-auto">
        {/* Top Trust Header */}
        <header className="mb-8 pb-6 border-b border-stone-200">
          <div className="flex items-center justify-between text-xs tracking-wider text-stone-500 uppercase font-medium mb-3">
            <span className="flex items-center gap-1.5 text-amber-900 font-semibold">
              <Compass className="w-4 h-4 text-amber-800" />
              NIAT Parent Decision Room
            </span>
            <span className="text-stone-500 font-mono">Verified 2026 Intake</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-stone-950 tracking-tight leading-snug">
            {t(locale, 'intake.title')}
          </h1>
          <p className="mt-2 text-stone-600 text-sm sm:text-base leading-relaxed">
            {t(locale, 'intake.subtitle')}
          </p>
        </header>

        {/* Progress bar */}
        {step > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between text-xs text-stone-500 font-medium mb-2">
              <span>Step {step} of 4</span>
              <span>
                {step === 1 && 'Family details'}
                {step === 2 && 'Campus & budget'}
                {step === 3 && 'Primary concern'}
                {step === 4 && 'Confirm & generate'}
              </span>
            </div>
            <div className="w-full bg-stone-200 h-1.5 rounded-none overflow-hidden">
              <div
                className="bg-amber-800 h-full transition-all duration-300 ease-out"
                style={{ width: `${(step / 4) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Error message */}
        {errorMsg && (
          <div className="mb-6 p-3.5 bg-amber-50 border border-amber-300 text-amber-900 text-sm rounded flex items-center gap-2">
            <HelpCircle className="w-4 h-4 shrink-0 text-amber-700" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form container */}
        <div className="bg-white border border-stone-200 p-5 sm:p-8 shadow-sm">
          {/* STEP 0: LANGUAGE SELECTION */}
          {step === 0 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-stone-900">
                  {t(locale, 'intake.choose_language')}
                </h2>
                <p className="text-sm text-stone-500 mt-1">
                  Select the language you and your family are most comfortable reading in.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {LANGUAGE_OPTIONS.map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => setLocale(lang.code)}
                    className={`p-3.5 text-left border rounded transition-all flex flex-col justify-between ${
                      locale === lang.code
                        ? 'border-amber-800 bg-amber-50/50 text-amber-950 ring-1 ring-amber-800'
                        : 'border-stone-200 hover:border-stone-400 bg-white text-stone-800'
                    }`}
                  >
                    <span className="text-sm font-semibold">{lang.nativeLabel}</span>
                    <span className="text-xs text-stone-500 mt-0.5">{lang.label}</span>
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-full mt-4 bg-amber-800 hover:bg-amber-900 text-white font-medium py-3 px-4 rounded transition-colors flex items-center justify-center gap-2 text-sm"
              >
                <span>{t(locale, 'intake.continue')}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* STEP 1: PARENT & CHILD PROFILE */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="border-b border-stone-100 pb-3 mb-4">
                <h2 className="text-lg font-semibold text-stone-900">
                  Parent & Student Profile
                </h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  Helps our counselor verify the appropriate university degree alignment.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 uppercase tracking-wider mb-1.5">
                  {t(locale, 'intake.your_name')} *
                </label>
                <input
                  type="text"
                  value={form.parent_name}
                  onChange={(e) => updateField('parent_name', e.target.value)}
                  placeholder="e.g. Ramesh Sharma"
                  className="w-full border border-stone-300 rounded px-3.5 py-2.5 text-sm bg-stone-50/30 focus:bg-white focus:border-amber-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 uppercase tracking-wider mb-1.5">
                  {t(locale, 'intake.child_name')} *
                </label>
                <input
                  type="text"
                  value={form.child_name}
                  onChange={(e) => updateField('child_name', e.target.value)}
                  placeholder="e.g. Priya"
                  className="w-full border border-stone-300 rounded px-3.5 py-2.5 text-sm bg-stone-50/30 focus:bg-white focus:border-amber-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 uppercase tracking-wider mb-1.5">
                  {t(locale, 'intake.whatsapp')} *
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  placeholder="e.g. +91 98765 43210"
                  className="w-full border border-stone-300 rounded px-3.5 py-2.5 text-sm bg-stone-50/30 focus:bg-white focus:border-amber-800 focus:outline-none"
                />
                <span className="text-[11px] text-stone-500 mt-1 block">
                  A copy of your personalized report link will be sent here.
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 uppercase tracking-wider mb-1.5">
                  {t(locale, 'intake.city')} *
                </label>
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => updateField('city', e.target.value)}
                  placeholder="e.g. Hyderabad, Vijayawada, Guntur"
                  className="w-full border border-stone-300 rounded px-3.5 py-2.5 text-sm bg-stone-50/30 focus:bg-white focus:border-amber-800 focus:outline-none"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={prevStep}
                  className="w-1/3 border border-stone-300 hover:bg-stone-50 text-stone-700 font-medium py-2.5 px-4 rounded text-sm transition-colors"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={nextStep}
                  className="w-2/3 bg-amber-800 hover:bg-amber-900 text-white font-medium py-2.5 px-4 rounded text-sm transition-colors flex items-center justify-center gap-1.5"
                >
                  <span>{t(locale, 'intake.continue')}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: CAMPUS & BUDGET */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="border-b border-stone-100 pb-3 mb-2">
                <h2 className="text-lg font-semibold text-stone-900">
                  Campus & Budget Preference
                </h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  Helps assess hostel options and distance considerations.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 uppercase tracking-wider mb-2">
                  {t(locale, 'intake.campus')} *
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {CAMPUSES.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => updateField('campus', c.name)}
                      className={`p-3 text-left border rounded transition-all ${
                        form.campus === c.name
                          ? 'border-amber-800 bg-amber-50/60 text-amber-950 ring-1 ring-amber-800'
                          : 'border-stone-200 hover:border-stone-300 bg-white text-stone-800'
                      }`}
                    >
                      <div className="text-sm font-semibold">{c.name}</div>
                      <div className="text-xs text-stone-500">{c.state}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 uppercase tracking-wider mb-2">
                  {t(locale, 'intake.budget')} *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {BUDGET_OPTIONS.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => updateField('budget_range', b)}
                      className={`py-2 px-2.5 text-center text-xs border rounded transition-all font-medium ${
                        form.budget_range === b
                          ? 'border-amber-800 bg-amber-50/60 text-amber-950 ring-1 ring-amber-800'
                          : 'border-stone-200 hover:border-stone-300 bg-white text-stone-700'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={prevStep}
                  className="w-1/3 border border-stone-300 hover:bg-stone-50 text-stone-700 font-medium py-2.5 px-4 rounded text-sm transition-colors"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={nextStep}
                  className="w-2/3 bg-amber-800 hover:bg-amber-900 text-white font-medium py-2.5 px-4 rounded text-sm transition-colors flex items-center justify-center gap-1.5"
                >
                  <span>{t(locale, 'intake.continue')}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: PRIMARY CONCERN */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="border-b border-stone-100 pb-3 mb-2">
                <h2 className="text-lg font-semibold text-stone-900">
                  {t(locale, 'intake.concern')}
                </h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  Select the issue that matters most to your family. We will address it directly without marketing fluff.
                </p>
              </div>

              <div className="space-y-2">
                {CONCERNS.map((c) => {
                  const isSelected = form.primary_concern === c
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => updateField('primary_concern', c)}
                      className={`w-full text-left p-3.5 border rounded transition-all flex items-center justify-between text-sm ${
                        isSelected
                          ? 'border-amber-800 bg-amber-50/60 text-amber-950 ring-1 ring-amber-800 font-medium'
                          : 'border-stone-200 hover:border-stone-300 bg-white text-stone-800'
                      }`}
                    >
                      <span>{getConcernLabel(locale, c)}</span>
                      {isSelected && <Check className="w-4 h-4 text-amber-800 shrink-0" />}
                    </button>
                  )
                })}
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={prevStep}
                  className="w-1/3 border border-stone-300 hover:bg-stone-50 text-stone-700 font-medium py-2.5 px-4 rounded text-sm transition-colors"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={nextStep}
                  className="w-2/3 bg-amber-800 hover:bg-amber-900 text-white font-medium py-2.5 px-4 rounded text-sm transition-colors flex items-center justify-center gap-1.5"
                >
                  <span>Review & Generate</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: REVIEW & SUBMIT */}
          {step === 4 && (
            <div className="space-y-6">
              <div className="border-b border-stone-100 pb-3">
                <h2 className="text-lg font-semibold text-stone-900">
                  {t(locale, 'intake.ready_title')}
                </h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  {formatReportDesc(locale, form.child_name || 'your child', form.campus || 'NIAT')}
                </p>
              </div>

              {/* Summary Ledger */}
              <div className="bg-stone-50 border border-stone-200 p-4 rounded space-y-2.5 text-xs sm:text-sm">
                <div className="flex justify-between border-b border-stone-200/60 pb-1.5">
                  <span className="text-stone-500 font-medium">Student:</span>
                  <span className="font-semibold text-stone-900">{form.child_name}</span>
                </div>
                <div className="flex justify-between border-b border-stone-200/60 pb-1.5">
                  <span className="text-stone-500 font-medium">Parent:</span>
                  <span className="font-semibold text-stone-900">{form.parent_name}</span>
                </div>
                <div className="flex justify-between border-b border-stone-200/60 pb-1.5">
                  <span className="text-stone-500 font-medium">Preferred Campus:</span>
                  <span className="font-semibold text-stone-900">{form.campus}</span>
                </div>
                <div className="flex justify-between border-b border-stone-200/60 pb-1.5">
                  <span className="text-stone-500 font-medium">Annual Budget:</span>
                  <span className="font-semibold text-stone-900">{form.budget_range}</span>
                </div>
                <div className="flex justify-between border-b border-stone-200/60 pb-1.5">
                  <span className="text-stone-500 font-medium">Primary Focus:</span>
                  <span className="font-semibold text-amber-900">
                    {getConcernLabel(locale, form.primary_concern)}
                  </span>
                </div>
                <div className="flex justify-between pt-1">
                  <span className="text-stone-500 font-medium">Report Language:</span>
                  <span className="font-semibold text-stone-900">
                    {LANGUAGE_OPTIONS.find((l) => l.code === locale)?.label}
                  </span>
                </div>
              </div>

              {/* Transparency Notice */}
              <div className="p-3 bg-stone-100/70 border border-stone-200 rounded text-xs text-stone-600 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-stone-700 shrink-0 mt-0.5" />
                <p>
                  <strong>No sales pressure:</strong> This report provides factual analysis of the collaborating university degree, practical industry upskilling, and verified placement support policies.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={prevStep}
                  disabled={loading}
                  className="w-1/3 border border-stone-300 hover:bg-stone-50 text-stone-700 font-medium py-3 px-4 rounded text-sm transition-colors disabled:opacity-50"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading}
                  className="w-2/3 bg-amber-800 hover:bg-amber-900 text-white font-medium py-3 px-4 rounded text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {loading ? (
                    <span>{t(locale, 'intake.generating')}</span>
                  ) : (
                    <>
                      <span>{t(locale, 'intake.generate')}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <footer className="mt-8 text-center text-xs text-stone-400 space-x-4">
          <a href="/dashboard" className="text-stone-500 hover:text-stone-800 underline">
            Counselor Dashboard
          </a>
          <span>·</span>
          <a href="/inbox" className="text-stone-500 hover:text-stone-800 underline">
            WhatsApp Outbox
          </a>
        </footer>
      </div>
    </main>
  )
}
