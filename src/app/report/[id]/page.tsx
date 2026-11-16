'use client'

import { useEffect, useState, use } from 'react'
import {
  Locale,
  t,
  getConcernLabel,
} from '@/lib/i18n'
import {
  GraduationCap,
  Layers,
  Briefcase,
  Share2,
  PhoneCall,
  CalendarCheck,
  Send,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Copy,
  Check,
  HelpCircle,
  Clock,
  Sparkles,
} from 'lucide-react'

type Lead = {
  id: string
  parent_name: string
  child_name: string
  phone: string
  city: string
  campus: string
  budget_range: string
  language: string
  primary_concern: string
  objection_category: string
  intent_score: number
  report_text: string
  counselor_booked: boolean
  counselor_brief?: string
  session_id: string
}

type TraceItem = {
  tool: string
  args: Record<string, unknown>
  result_summary: string
}

export default function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedParams = use(params)
  const reportId = resolvedParams.id

  const [lead, setLead] = useState<Lead | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [locale, setLocale] = useState<Locale>('en')

  // Chat state
  const [messages, setMessages] = useState<
    Array<{ role: 'user' | 'assistant'; content: string }>
  >([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [agentTrace, setAgentTrace] = useState<TraceItem[]>([])
  const [showTrace, setShowTrace] = useState(false)

  // Actions state
  const [copied, setCopied] = useState(false)
  const [booked, setBooked] = useState(false)
  const [bookingLoading, setBookingLoading] = useState(false)
  const [voiceModalOpen, setVoiceModalOpen] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState<string | null>(null)

  useEffect(() => {
    async function loadReport() {
      try {
        const res = await fetch(`/api/report/${reportId}`)
        if (!res.ok) {
          throw new Error('Report not found or has expired.')
        }
        const data = await res.json()
        setLead(data.lead)
        if (data.lead?.language) {
          setLocale(data.lead.language as Locale)
        }
        if (data.lead?.counselor_booked) {
          setBooked(true)
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Error loading report')
      } finally {
        setLoading(false)
      }
    }
    loadReport()
  }, [reportId])

  const sendChatMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!chatInput.trim() || !lead || chatLoading) return

    const userText = chatInput.trim()
    setChatInput('')
    const updatedMessages = [
      ...messages,
      { role: 'user' as const, content: userText },
    ]
    setMessages(updatedMessages)
    setChatLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: lead.session_id,
          message: userText,
        }),
      })

      const data = await res.json()
      if (data.reply) {
        setMessages([
          ...updatedMessages,
          { role: 'assistant' as const, content: data.reply },
        ])
      }
      if (data.trace && Array.isArray(data.trace)) {
        setAgentTrace(data.trace)
      }
    } catch (err) {
      console.error(err)
      setMessages([
        ...updatedMessages,
        {
          role: 'assistant' as const,
          content:
            'A counselor will address this question directly. Please book a call below.',
        },
      ])
    } finally {
      setChatLoading(false)
    }
  }

  const handleBookCounselor = async () => {
    if (!lead || booked || bookingLoading) return
    setBookingLoading(true)

    try {
      const res = await fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: lead.id,
          session_id: lead.session_id,
          slot: 'Next available',
        }),
      })

      const data = await res.json()
      setBooked(true)
      if (data.whatsappLink) {
        window.open(data.whatsappLink, '_blank')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setBookingLoading(false)
    }
  }

  const handleStartVoice = async () => {
    setVoiceModalOpen(true)
    setVoiceStatus('Connecting to AI Voice Counselor...')

    try {
      const res = await fetch('/api/voice/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: lead?.session_id,
          lead_id: lead?.id,
          parent_name: lead?.parent_name,
          language: lead?.language,
        }),
      })

      const data = await res.json()
      if (data.demo_mode) {
        setVoiceStatus(
          'Voice Counselor is in Demo Mode. Connect your GNANI_API_KEY and GNANI_AGENT_ID to enable live inbound/outbound telephonic calls with parents in their native language.',
        )
      } else {
        setVoiceStatus('Call initiated! Your phone will ring shortly.')
      }
    } catch {
      setVoiceStatus('Unable to reach voice gateway. Please book a counselor call instead.')
    }
  }

  const shareUrl = typeof window !== 'undefined' ? window.location.href : ''
  const spouseShareText = lead
    ? encodeURIComponent(
        `Hi, please review the NIAT Decision Report for our child ${lead.child_name} at ${lead.campus} campus: ${shareUrl}`,
      )
    : ''
  const spouseWaLink = `https://wa.me/?text=${spouseShareText}`

  const copyShareLink = () => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#FAFAF7] flex items-center justify-center p-6 text-stone-700">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-amber-800 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium text-stone-600">
            Retrieving verified assessment...
          </p>
        </div>
      </main>
    )
  }

  if (error || !lead) {
    return (
      <main className="min-h-screen bg-[#FAFAF7] flex items-center justify-center p-6 text-stone-900">
        <div className="max-w-md w-full bg-white border border-stone-200 p-6 rounded shadow-sm text-center">
          <HelpCircle className="w-8 h-8 text-amber-800 mx-auto mb-3" />
          <h1 className="text-lg font-bold">Report Not Found</h1>
          <p className="text-sm text-stone-600 mt-2">
            {error || 'This report link may have expired or is invalid.'}
          </p>
          <a
            href="/"
            className="inline-block mt-4 bg-amber-800 text-white text-sm px-4 py-2 rounded hover:bg-amber-900 transition-colors"
          >
            Start New Assessment
          </a>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#FAFAF7] text-stone-900 px-4 py-8 sm:py-14 selection:bg-amber-100 selection:text-amber-900">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between text-xs text-stone-500 pb-3 border-b border-stone-200">
          <a href="/" className="text-amber-900 font-semibold hover:underline">
            ← Decision Room Home
          </a>
          <span>ID: {lead.id.slice(0, 8)}</span>
        </div>

        {/* Report Header */}
        <header className="bg-white border border-stone-200 p-6 sm:p-8 rounded shadow-sm space-y-3">
          <div className="inline-block px-2.5 py-1 bg-stone-100 text-stone-700 text-xs font-medium rounded border border-stone-200">
            {t(locale, 'report.title')}
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-stone-950">
            {t(locale, 'report.for').replace('{child}', lead.child_name)}
          </h1>
          <div className="flex flex-wrap gap-y-1 gap-x-4 text-xs sm:text-sm text-stone-600">
            <span>
              <strong>Parent:</strong> {lead.parent_name}
            </span>
            <span>•</span>
            <span>
              <strong>Preferred Campus:</strong> {lead.campus}
            </span>
            <span>•</span>
            <span>
              <strong>Budget:</strong> {lead.budget_range}
            </span>
            <span>•</span>
            <span>
              <strong>Primary Concern:</strong>{' '}
              {getConcernLabel(locale, lead.primary_concern || lead.objection_category)}
            </span>
          </div>
        </header>

        {/* ── THE THREE CORE ARCHITECTURAL LAYERS ── */}
        <section className="space-y-4">
          <div className="border-l-2 border-amber-800 pl-3">
            <h2 className="text-base sm:text-lg font-serif font-bold text-stone-900">
              The 3 Structural Layers of NIAT
            </h2>
            <p className="text-xs text-stone-500">
              How the university degree, practical training, and placement support fit together.
            </p>
          </div>

          <div className="space-y-3">
            {/* LAYER 1: DEGREE */}
            <div className="bg-white border border-stone-200 p-5 rounded relative overflow-hidden">
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 bg-stone-100 border border-stone-200 rounded text-stone-800 shrink-0">
                  <GraduationCap className="w-5 h-5 text-amber-900" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-amber-900 font-semibold">
                      Layer 1
                    </span>
                    <h3 className="text-sm sm:text-base font-bold text-stone-950">
                      Recognized University Degree
                    </h3>
                  </div>
                  <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                    The degree (B.Tech or BCA) is officially awarded by NIAT&apos;s
                    collaborating university, <strong>not by NxtWave</strong>. Your
                    child graduates with a legitimate, UGC-recognized university degree
                    meeting all public and higher-education eligibility standards.
                  </p>
                </div>
              </div>
            </div>

            {/* LAYER 2: UPSKILLING */}
            <div className="bg-white border border-stone-200 p-5 rounded relative overflow-hidden">
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 bg-stone-100 border border-stone-200 rounded text-stone-800 shrink-0">
                  <Layers className="w-5 h-5 text-amber-900" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-amber-900 font-semibold">
                      Layer 2
                    </span>
                    <h3 className="text-sm sm:text-base font-bold text-stone-950">
                      NIAT Industry Upskilling Layer
                    </h3>
                  </div>
                  <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                    NIAT provides the industry-oriented curriculum layered on top of the
                    degree. Students build production software, work on live projects, and
                    master modern stacks with guidance from industry practitioners rather
                    than pure theory.
                  </p>
                </div>
              </div>
            </div>

            {/* LAYER 3: PLACEMENT SUPPORT */}
            <div className="bg-white border border-stone-200 p-5 rounded relative overflow-hidden">
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 bg-stone-100 border border-stone-200 rounded text-stone-800 shrink-0">
                  <Briefcase className="w-5 h-5 text-amber-900" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-amber-900 font-semibold">
                      Layer 3
                    </span>
                    <h3 className="text-sm sm:text-base font-bold text-stone-950">
                      Placement Support (Honest Policy)
                    </h3>
                  </div>
                  <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                    NIAT provides dedicated placement training and access to NxtWave&apos;s
                    hiring network of 1,000+ companies. <strong>Placement is not guaranteed.</strong>{' '}
                    Outcomes depend on student performance, academic discipline, and market conditions.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FULL DECISION REPORT TEXT */}
        <section className="bg-white border border-stone-200 p-6 sm:p-8 rounded shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <h2 className="text-base sm:text-lg font-serif font-bold text-stone-900">
              Personalized Assessment & Counselor Notes
            </h2>
            <span className="text-xs font-mono text-stone-400">Model verified</span>
          </div>

          <div className="text-sm text-stone-800 leading-relaxed whitespace-pre-wrap font-sans space-y-3">
            {lead.report_text || 'Report is currently being processed.'}
          </div>

          <div className="pt-4 border-t border-stone-100 text-xs text-stone-500 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>
              All information adheres to NIAT facts repository guidelines. No unverified placement or fee guarantees.
            </span>
          </div>
        </section>

        {/* ACTION ROW: SPOUSE SHARE & VOICE COUNSELOR */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Share with Spouse */}
          <div className="bg-white border border-stone-200 p-5 rounded space-y-3">
            <div className="flex items-center gap-2 text-stone-900 font-semibold text-sm">
              <Share2 className="w-4 h-4 text-amber-800" />
              <span>{t(locale, 'report.share.title')}</span>
            </div>
            <p className="text-xs text-stone-500 leading-relaxed">
              {t(locale, 'report.share.desc')} via WhatsApp so both parents are on the same page.
            </p>
            <div className="flex gap-2 pt-1">
              <a
                href={spouseWaLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium py-2.5 px-3 rounded text-center transition-colors"
              >
                Share on WhatsApp
              </a>
              <button
                type="button"
                onClick={copyShareLink}
                className="border border-stone-300 hover:bg-stone-50 text-stone-700 text-xs font-medium py-2.5 px-3 rounded flex items-center gap-1.5 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? t(locale, 'report.share.copied') : t(locale, 'report.share.copy')}</span>
              </button>
            </div>
          </div>

          {/* Talk to AI Counselor */}
          <div className="bg-white border border-stone-200 p-5 rounded space-y-3">
            <div className="flex items-center gap-2 text-stone-900 font-semibold text-sm">
              <PhoneCall className="w-4 h-4 text-amber-800" />
              <span>{t(locale, 'report.voice.title')}</span>
            </div>
            <p className="text-xs text-stone-500 leading-relaxed">
              Have a 2-minute phone conversation in your native language to clarify doubts instantly.
            </p>
            <div className="pt-1">
              <button
                type="button"
                onClick={handleStartVoice}
                className="w-full bg-stone-800 hover:bg-stone-900 text-white text-xs font-medium py-2.5 px-3 rounded text-center transition-colors flex items-center justify-center gap-1.5"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span>Start AI Voice Consultation</span>
              </button>
            </div>
          </div>
        </div>

        {/* BOOK A HUMAN COUNSELOR */}
        <section className="bg-amber-50/70 border border-amber-300 p-6 sm:p-7 rounded space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-base sm:text-lg font-serif font-bold text-amber-950">
                {t(locale, 'report.book.title')}
              </h3>
              <p className="text-xs sm:text-sm text-amber-900/80 mt-0.5">
                {t(locale, 'report.book.desc')}
              </p>
            </div>
            <CalendarCheck className="w-6 h-6 text-amber-800 shrink-0" />
          </div>

          <div className="pt-2">
            {booked ? (
              <div className="p-3 bg-white border border-emerald-300 text-emerald-900 rounded text-sm flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>Call Scheduled:</strong> Opening WhatsApp to confirm your preferred slot. A senior NIAT counselor will review {lead.child_name}&apos;s file.
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleBookCounselor}
                disabled={bookingLoading}
                className="w-full bg-amber-800 hover:bg-amber-900 text-white font-medium py-3 px-4 rounded text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <CalendarCheck className="w-4 h-4" />
                <span>{bookingLoading ? 'Scheduling...' : t(locale, 'report.book.button')}</span>
              </button>
            )}
          </div>
        </section>

        {/* FOLLOW-UP CHAT */}
        <section className="bg-white border border-stone-200 p-6 rounded shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <div>
              <h3 className="text-base font-serif font-bold text-stone-900">
                {t(locale, 'report.chat.title')}
              </h3>
              <p className="text-xs text-stone-500">
                Ask specific questions about fees, hostels, faculty, or degrees.
              </p>
            </div>
            <Sparkles className="w-4 h-4 text-amber-800" />
          </div>

          {/* Messages display */}
          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {messages.length === 0 && (
              <p className="text-xs text-stone-400 italic py-2">
                No questions asked yet. Try: &quot;What are the hostel arrangements at {lead.campus}?&quot; or &quot;How does the fee payment work?&quot;
              </p>
            )}
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex flex-col ${
                  m.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`text-xs sm:text-sm p-3 rounded max-w-[85%] leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-amber-800 text-white'
                      : 'bg-stone-100 text-stone-800 border border-stone-200'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="text-xs text-stone-500 flex items-center gap-1.5 py-1">
                <Clock className="w-3.5 h-3.5 animate-spin text-amber-800" />
                <span>{t(locale, 'report.chat.thinking')}</span>
              </div>
            )}
          </div>

          {/* Chat input */}
          <form onSubmit={sendChatMessage} className="flex gap-2 pt-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={t(locale, 'report.chat.placeholder')}
              className="flex-1 border border-stone-300 rounded px-3.5 py-2 text-xs sm:text-sm bg-stone-50/30 focus:bg-white focus:border-amber-800 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!chatInput.trim() || chatLoading}
              className="bg-amber-800 hover:bg-amber-900 text-white px-4 py-2 rounded text-xs sm:text-sm font-medium transition-colors flex items-center gap-1 disabled:opacity-50"
            >
              <span>{t(locale, 'report.chat.send')}</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* AGENT TRACE PANEL */}
          {agentTrace.length > 0 && (
            <div className="pt-3 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setShowTrace(!showTrace)}
                className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-800 font-mono"
              >
                <span>Agent trace ({agentTrace.length} tools executed)</span>
                {showTrace ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {showTrace && (
                <div className="mt-2.5 p-3 bg-stone-900 text-stone-100 rounded font-mono text-[11px] space-y-2 overflow-x-auto">
                  {agentTrace.map((tr, i) => (
                    <div key={i} className="border-b border-stone-800 pb-1.5 last:border-0 last:pb-0">
                      <div className="text-amber-400 font-semibold">{tr.tool}()</div>
                      <div className="text-stone-400">args: {JSON.stringify(tr.args)}</div>
                      <div className="text-stone-300">result: {tr.result_summary}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* VOICE MODAL / POPUP */}
        {voiceModalOpen && (
          <div className="fixed inset-0 bg-stone-950/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white border border-stone-200 rounded max-w-sm w-full p-6 space-y-4 shadow-lg">
              <div className="flex items-center gap-2 text-stone-900 font-serif font-bold">
                <PhoneCall className="w-5 h-5 text-amber-800" />
                <span>AI Voice Counselor</span>
              </div>
              <p className="text-xs text-stone-600 leading-relaxed">
                {voiceStatus}
              </p>
              <button
                type="button"
                onClick={() => setVoiceModalOpen(false)}
                className="w-full bg-stone-800 hover:bg-stone-900 text-white text-xs font-medium py-2 rounded transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
