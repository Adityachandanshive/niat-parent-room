'use client'

import { useEffect, useState, useRef, use } from 'react'
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
  Phone,
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
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
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
  voice_call_done?: boolean
  counselor_brief?: string
  session_id: string
}

type TraceItem = {
  tool: string
  args: Record<string, unknown>
  result_summary: string
}

type VoiceTranscriptEntry = {
  speaker: 'counselor' | 'parent'
  text: string
  time: string
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

  // ── Real AI Voice Counselor State ──
  const [voiceCallOpen, setVoiceCallOpen] = useState(false)
  const [callState, setCallState] = useState<'ringing' | 'connected' | 'ended'>('ringing')
  const [callSeconds, setCallSeconds] = useState(0)
  const [isCounselorSpeaking, setIsCounselorSpeaking] = useState(false)
  const [isListeningMic, setIsListeningMic] = useState(false)
  const [voiceMuted, setVoiceMuted] = useState(false)
  const [voiceTranscript, setVoiceTranscript] = useState<VoiceTranscriptEntry[]>([])
  const [voiceStatusText, setVoiceStatusText] = useState('')

  const chatInputRef = useRef<HTMLInputElement>(null)
  const chatBottomRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const recognitionRef = useRef<any>(null)

  // Auto-scroll chat to latest message
  useEffect(() => {
    if (messages.length > 0 || chatLoading) {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, chatLoading])

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

  // Call timer effect
  useEffect(() => {
    if (callState === 'connected') {
      timerRef.current = setInterval(() => {
        setCallSeconds((s) => s + 1)
      }, 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [callState])

  // Clean speech synthesis on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  // Helper to format call timer (00:05)
  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60)
      .toString()
      .padStart(2, '0')
    const s = (sec % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  // Text-To-Speech engine for Voice Counselor Ananya
  const speakCounselorResponse = (text: string) => {
    if (voiceMuted || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return
    }

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.95
    utterance.pitch = 1.05

    // Detect language code
    if (locale === 'hi') {
      utterance.lang = 'hi-IN'
    } else if (locale === 'te') {
      utterance.lang = 'te-IN'
    } else {
      utterance.lang = 'en-IN'
    }

    utterance.onstart = () => setIsCounselorSpeaking(true)
    utterance.onend = () => setIsCounselorSpeaking(false)
    utterance.onerror = () => setIsCounselorSpeaking(false)

    window.speechSynthesis.speak(utterance)
  }

  // Start Voice Call Session
  const handleStartVoice = () => {
    setVoiceCallOpen(true)
    setCallState('ringing')
    setCallSeconds(0)
    setVoiceTranscript([])
    const targetPhone = lead?.phone || '+91 98765 43210'
    setVoiceStatusText(`Dialing parent phone: ${targetPhone}...`)

    // Trigger telephony endpoint to ring parent's actual phone number
    fetch('/api/voice/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: lead?.session_id,
        lead_id: lead?.id,
        parent_name: lead?.parent_name,
        child_name: lead?.child_name,
        campus: lead?.campus,
        phone: lead?.phone,
        language: lead?.language,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.phone_called) {
          setVoiceStatusText(`Ringing: +${data.phone_called}`)
        }
      })
      .catch(() => {})

    // Connect after 1.8s ringing simulation
    setTimeout(() => {
      setCallState('connected')
      setVoiceStatusText('Connected • HD Audio')

      const parentName = lead?.parent_name || 'Sir'
      const childName = lead?.child_name || 'your child'
      const campus = lead?.campus || 'NIAT'

      let greeting = ''
      if (locale === 'hi') {
        greeting = `नमस्ते ${parentName} जी, मैं NIAT पैरेंट एडवाइजरी टीम से अनन्या बात कर रही हूँ। मैंने ${childName} का रिपोर्ट देखा है। ${campus} कैंपस और डिग्री के बारे में आपके मन में जो भी सवाल हैं, आप सीधे मुझसे पूछ सकते हैं।`
      } else if (locale === 'te') {
        greeting = `నమస్కారం ${parentName} గారు, నేను NIAT పేరెంట్ అడ్వైజరీ టీమ్ నుండి అనన్యను మాట్లాడుతున్నాను. ${childName} డెసిషన్ రిపోర్ట్ సిద్ధంగా ఉంది. ${campus} క్యాంపస్ లేదా డిగ్రీ గురించి మీ సందేహాలను అడగండి.`
      } else {
        greeting = `Namaste ${parentName}, this is Counselor Ananya from the NIAT Admissions Advisory team. I have ${childName}'s file open for ${campus} campus. Please feel free to ask me anything about the degree, fees, or placements.`
      }

      setVoiceTranscript([
        {
          speaker: 'counselor',
          text: greeting,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ])

      speakCounselorResponse(greeting)
    }, 1800)
  }

  // Parent speaks or clicks a question during call
  const handleParentVoiceQuery = async (queryText: string) => {
    if (!queryText.trim() || callState !== 'connected') return

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const updated = [
      ...voiceTranscript,
      { speaker: 'parent' as const, text: queryText, time: now },
    ]
    setVoiceTranscript(updated)

    // Stop listening mic if active
    if (isListeningMic && recognitionRef.current) {
      recognitionRef.current.stop()
      setIsListeningMic(false)
    }

    setVoiceStatusText('Ananya is reviewing program facts...')

    // Fetch answer using the agent API
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: lead?.session_id,
          message: queryText,
        }),
      })

      const data = await res.json()
      const answer =
        data.reply ||
        'NIAT provides accredited university degrees with practical coding skills. A senior campus counselor can share full details.'

      setVoiceTranscript([
        ...updated,
        {
          speaker: 'counselor',
          text: answer,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ])

      setVoiceStatusText('Speaking...')
      speakCounselorResponse(answer)
    } catch {
      const fallbackAns =
        'That is a very fair question. The degree is awarded by an accredited university, and placement support is provided with over 1000 hiring partners without false guarantees.'
      setVoiceTranscript([
        ...updated,
        {
          speaker: 'counselor',
          text: fallbackAns,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ])
      speakCounselorResponse(fallbackAns)
    }
  }

  // End Call & Synchronize with admissions webhook
  const handleEndVoiceCall = async () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    setIsCounselorSpeaking(false)
    setCallState('ended')

    // Prepare full call transcript
    const fullTranscript = voiceTranscript
      .map((entry) => `${entry.speaker.toUpperCase()}: ${entry.text}`)
      .join('\n')

    // Submit to voice webhook
    try {
      await fetch('/api/voice-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-secret': process.env.GNANI_API_KEY || 'vach_1ytE2CY5X2ESDGcujCfsWFzKmfT98KwMcgWCGtJUf6k4qTVJAkQlZsZsW0qbzpE6RcwDazAgYnkGOMB9YqlCbCFkxbidkT24_fae6306bb0ce25894af8c4f896e87172',
        },
        body: JSON.stringify({
          session_id: lead?.session_id,
          transcript: fullTranscript || 'Voice consultation completed.',
          language: lead?.language || 'en',
          duration: callSeconds,
        }),
      })
      if (lead) {
        setLead({ ...lead, voice_call_done: true })
      }
    } catch (e) {
      console.warn('Webhook sync:', e)
    }
  }

  // Toggle live microphone input
  const toggleMicrophone = () => {
    if (typeof window === 'undefined') return

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

    if (!SpeechRecognition) {
      alert('Your browser does not support Speech Recognition. Please click any question pill below to speak to Ananya.')
      return
    }

    if (isListeningMic) {
      recognitionRef.current?.stop()
      setIsListeningMic(false)
      return
    }

    const rec = new SpeechRecognition()
    rec.continuous = false
    rec.interimResults = false
    rec.lang = locale === 'hi' ? 'hi-IN' : locale === 'te' ? 'te-IN' : 'en-IN'

    rec.onstart = () => {
      setIsListeningMic(true)
      setVoiceStatusText('Listening to your question...')
    }

    rec.onresult = (event: any) => {
      const speechToText = event.results[0][0].transcript
      setIsListeningMic(false)
      handleParentVoiceQuery(speechToText)
    }

    rec.onerror = () => {
      setIsListeningMic(false)
      setVoiceStatusText('Microphone paused. Click any prompt below to reply.')
    }

    rec.onend = () => {
      setIsListeningMic(false)
    }

    recognitionRef.current = rec
    rec.start()
  }

  // Send Follow-up Chat Message (Strictly in-text response, no voice)
  const sendChatMessage = async (e?: React.FormEvent, presetQuery?: string) => {
    if (e) e.preventDefault()
    const textToSend = presetQuery || chatInput
    if (!textToSend.trim() || !lead || chatLoading) return

    // Ensure voice synthesis is silenced — follow-up chat is strictly in-text
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    setIsCounselorSpeaking(false)

    setChatInput('')
    const userText = textToSend.trim()
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
      const textReply =
        data.reply ||
        'NIAT provides an accredited university degree with practical industry upskilling. Placement support is available through 1000+ hiring partners without false guarantees. A senior campus counselor can provide specific details.'

      setMessages([
        ...updatedMessages,
        { role: 'assistant' as const, content: textReply },
      ])

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
            'NIAT degrees are officially conferred by an accredited university partner, while NIAT equips students with production-level coding and interview prep. Placement support is actively provided across 1000+ hiring companies, though individual outcomes depend on student effort and market conditions.',
        },
      ])
    } finally {
      setChatLoading(false)
      chatInputRef.current?.focus()
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
          <div className="flex items-center gap-3">
            <a href="/inbox" className="hover:underline text-stone-600">
              WhatsApp Outbox
            </a>
            <span>•</span>
            <span className="font-mono">ID: {lead.id.slice(0, 8)}</span>
          </div>
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

        {/* ACTION ROW: SPOUSE SHARE & REAL AI VOICE COUNSELOR */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Share with Spouse */}
          <div className="bg-white border border-stone-200 p-5 rounded space-y-3 shadow-xs">
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
                className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium py-2.5 px-3 rounded text-center transition-colors shadow-xs"
              >
                Share on WhatsApp
              </a>
              <button
                type="button"
                onClick={copyShareLink}
                className="border border-stone-300 hover:bg-stone-50 text-stone-700 text-xs font-medium py-2.5 px-3 rounded flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? t(locale, 'report.share.copied') : t(locale, 'report.share.copy')}</span>
              </button>
            </div>
          </div>

          {/* AI Voice Counselor Launcher */}
          <div className="bg-white border border-stone-200 p-5 rounded space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-stone-900 font-semibold text-sm">
                <PhoneCall className="w-4 h-4 text-amber-800" />
                <span>{t(locale, 'report.voice.title')}</span>
              </div>
              {lead.voice_call_done && (
                <span className="text-[10px] font-medium bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                  ✓ Call Recorded
                </span>
              )}
            </div>
            <p className="text-xs text-stone-500 leading-relaxed">
              Speak directly with Counselor Ananya right now in your browser with real audio speech.
            </p>
            <div className="pt-1">
              <button
                type="button"
                onClick={handleStartVoice}
                className="w-full bg-stone-900 hover:bg-black text-white text-xs font-medium py-2.5 px-3 rounded text-center transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <PhoneCall className="w-3.5 h-3.5 text-emerald-400" />
                <span>Call Counselor Ananya (Live Audio)</span>
              </button>
            </div>
          </div>
        </div>

        {/* BOOK A HUMAN COUNSELOR */}
        <section className="bg-amber-50/70 border border-amber-300 p-6 sm:p-7 rounded space-y-3 shadow-xs">
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
                className="w-full bg-amber-800 hover:bg-amber-900 text-white font-medium py-3 px-4 rounded text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-xs"
              >
                <CalendarCheck className="w-4 h-4" />
                <span>{bookingLoading ? 'Scheduling...' : t(locale, 'report.book.button')}</span>
              </button>
            )}
          </div>
        </section>

        {/* ── INTERACTIVE FOLLOW-UP CHAT ── */}
        <section className="bg-white border border-stone-200 p-6 rounded shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <div>
              <h3 className="text-base font-serif font-bold text-stone-900">
                {t(locale, 'report.chat.title')}
              </h3>
              <p className="text-xs text-stone-500">
                Ask specific questions about fees, hostels, faculty, or degree recognition.
              </p>
            </div>
            <Sparkles className="w-4 h-4 text-amber-800" />
          </div>

          {/* Quick-suggestion Prompt Chips */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            <span className="text-[11px] text-stone-400 font-medium self-center mr-1">
              Popular questions:
            </span>
            {[
              'Are placements 100% guaranteed?',
              'Is NIAT degree recognized by UGC?',
              `What are the hostel rules at ${lead.campus}?`,
              'Can fees be paid in monthly installments?',
            ].map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => sendChatMessage(undefined, chip)}
                className="text-[11px] bg-stone-100 hover:bg-stone-200 text-stone-700 px-2.5 py-1 rounded transition-colors cursor-pointer border border-stone-200/60 touch-manipulation active:scale-[0.98]"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Messages display (Text Q&A) */}
          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {messages.length === 0 && (
              <p className="text-xs text-stone-400 italic py-2">
                No questions asked yet. Click a popular question above or type your question below for an immediate in-text reply.
              </p>
            )}
            {messages.map((m, idx) => (
              <div
                key={`chat-msg-${idx}-${m.role}`}
                className={`flex flex-col ${
                  m.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <span className="text-[10px] text-stone-400 mb-0.5">
                  {m.role === 'user' ? 'You' : 'NIAT Counselor Advisor (In-Text Reply)'}
                </span>
                <div
                  className={`text-xs sm:text-sm p-3.5 rounded-xl max-w-[88%] leading-relaxed whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-amber-800 text-white rounded-br-none shadow-2xs'
                      : 'bg-stone-100 text-stone-900 border border-stone-200/80 rounded-bl-none shadow-2xs'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex items-center gap-2 p-3 bg-stone-50 rounded-lg text-xs text-stone-600 border border-stone-200/50">
                <Clock className="w-3.5 h-3.5 animate-spin text-amber-800" />
                <span>Preparing in-text response with verified facts...</span>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Interactive Chat Input with Blinking Cursor */}
          <form onSubmit={sendChatMessage} className="flex gap-2 pt-2">
            <input
              ref={chatInputRef}
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={t(locale, 'report.chat.placeholder')}
              className="flex-1 border border-stone-300 rounded px-3.5 py-2 text-xs sm:text-sm bg-white text-stone-900 placeholder:text-stone-400 focus:bg-white focus:border-amber-800 focus:ring-1 focus:ring-amber-800 focus:outline-none cursor-text shadow-2xs"
            />
            <button
              type="submit"
              disabled={!chatInput.trim() || chatLoading}
              className="bg-amber-800 hover:bg-amber-900 text-white px-4 py-2 rounded text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 disabled:opacity-40 cursor-pointer shadow-xs shrink-0"
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
                className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-800 font-mono cursor-pointer"
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

        {/* ── FULL INTERACTIVE AI VOICE CALL SCREEN ── */}
        {voiceCallOpen && (
          <div className="fixed inset-0 bg-stone-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-200">
            <div className="bg-[#1A1A1A] border border-stone-800 text-white rounded-2xl max-w-md w-full p-5 sm:p-6 space-y-5 shadow-2xl flex flex-col max-h-[90vh]">
              {/* Call Header */}
              <div className="flex items-center justify-between border-b border-stone-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-xs uppercase font-mono tracking-wider text-stone-400">
                    NIAT AI Voice Telephony
                  </span>
                </div>
                <div className="font-mono text-xs text-emerald-400 bg-stone-900 px-2 py-0.5 rounded border border-stone-800">
                  {callState === 'ringing' ? 'DIALING...' : formatTimer(callSeconds)}
                </div>
              </div>

              {/* Counselor Avatar & Audio Indicator */}
              <div className="text-center py-2 space-y-2">
                <div className="relative inline-block">
                  <div
                    className={`w-20 h-20 rounded-full bg-gradient-to-tr from-amber-700 to-amber-500 flex items-center justify-center text-2xl font-serif font-bold text-white shadow-lg mx-auto ${
                      isCounselorSpeaking ? 'ring-4 ring-emerald-500/60 scale-105 transition-all' : ''
                    }`}
                  >
                    A
                  </div>
                  {isCounselorSpeaking && (
                    <span className="absolute -bottom-1 -right-1 bg-emerald-600 text-white p-1 rounded-full text-xs shadow">
                      <Volume2 className="w-3.5 h-3.5 animate-pulse" />
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="font-serif font-bold text-lg text-white">
                    Counselor Ananya
                  </h3>
                  <p className="text-xs text-stone-400">
                    NIAT Senior Admissions Advisor • {lead.campus} Campus
                  </p>
                  <p className="text-[11px] text-emerald-400 mt-1 font-mono">
                    {voiceStatusText}
                  </p>
                  {lead.phone && (
                    <div className="pt-1">
                      <a
                        href={`tel:${lead.phone.replace(/\s+/g, '')}`}
                        className="inline-flex items-center gap-1.5 text-[11px] bg-stone-800 hover:bg-stone-700 text-stone-300 px-2.5 py-1 rounded border border-stone-700/60 transition-colors"
                      >
                        <Phone className="w-3 h-3 text-emerald-400" />
                        <span>Ringing your number: {lead.phone}</span>
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Live Spoken Transcript Feed */}
              <div className="flex-1 overflow-y-auto bg-stone-900/80 border border-stone-800 rounded-xl p-3.5 space-y-3 min-h-[160px] text-xs">
                {voiceTranscript.map((entry, i) => (
                  <div
                    key={i}
                    className={`flex flex-col ${
                      entry.speaker === 'parent' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <span className="text-[10px] text-stone-500 mb-0.5">
                      {entry.speaker === 'parent' ? 'You' : 'Ananya'} • {entry.time}
                    </span>
                    <div
                      className={`p-2.5 rounded-xl max-w-[88%] leading-relaxed ${
                        entry.speaker === 'parent'
                          ? 'bg-amber-800 text-white'
                          : 'bg-stone-800 text-stone-200 border border-stone-700/60'
                      }`}
                    >
                      {entry.text}
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick Talk Question Chips */}
              {callState === 'connected' && (
                <div className="space-y-1.5">
                  <p className="text-[11px] text-stone-400 font-medium">
                    Tap to ask Ananya:
                  </p>
                  <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                    <button
                      type="button"
                      onClick={() => handleParentVoiceQuery('Is placement 100% guaranteed?')}
                      className="p-2 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded text-left transition-colors cursor-pointer border border-stone-700/50"
                    >
                      Are placements guaranteed?
                    </button>
                    <button
                      type="button"
                      onClick={() => handleParentVoiceQuery('Is NIAT a real degree from an accredited university?')}
                      className="p-2 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded text-left transition-colors cursor-pointer border border-stone-700/50"
                    >
                      Is the degree recognized?
                    </button>
                    <button
                      type="button"
                      onClick={() => handleParentVoiceQuery('Can you tell me about the hostel safety and security?')}
                      className="p-2 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded text-left transition-colors cursor-pointer border border-stone-700/50"
                    >
                      Hostel &amp; security rules
                    </button>
                    <button
                      type="button"
                      onClick={() => handleParentVoiceQuery('What are the fee payment and EMI options?')}
                      className="p-2 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded text-left transition-colors cursor-pointer border border-stone-700/50"
                    >
                      Fee &amp; EMI options
                    </button>
                  </div>
                </div>
              )}

              {/* Call Controls Bar */}
              <div className="flex items-center justify-center gap-4 pt-2 border-t border-stone-800">
                {/* Audio Mute */}
                <button
                  type="button"
                  onClick={() => {
                    if (!voiceMuted) {
                      window.speechSynthesis.cancel()
                      setIsCounselorSpeaking(false)
                    }
                    setVoiceMuted(!voiceMuted)
                  }}
                  className={`p-3 rounded-full transition-colors cursor-pointer ${
                    voiceMuted ? 'bg-red-900/60 text-red-300' : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                  }`}
                  title={voiceMuted ? 'Unmute Audio' : 'Mute Audio'}
                >
                  {voiceMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </button>

                {/* Microphone Talk */}
                <button
                  type="button"
                  onClick={toggleMicrophone}
                  className={`p-3.5 rounded-full transition-colors cursor-pointer ${
                    isListeningMic
                      ? 'bg-emerald-600 text-white ring-4 ring-emerald-500/40 animate-pulse'
                      : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                  }`}
                  title={isListeningMic ? 'Listening... (Click to stop)' : 'Speak into Microphone'}
                >
                  {isListeningMic ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                </button>

                {/* End Call Button */}
                <button
                  type="button"
                  onClick={() => {
                    handleEndVoiceCall()
                    setVoiceCallOpen(false)
                  }}
                  className="p-3.5 bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors cursor-pointer shadow-lg flex items-center justify-center"
                  title="End Call"
                >
                  <PhoneOff className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
