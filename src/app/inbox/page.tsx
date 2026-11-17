'use client'

import { useEffect, useState, useRef } from 'react'
import {
  MessageSquare,
  CheckCheck,
  Send,
  RefreshCw,
  Phone,
  ArrowLeft,
  ExternalLink,
  Smile,
  Paperclip,
} from 'lucide-react'

type OutboxMessage = {
  id: string
  created_at: string
  lead_id: string
  phone: string
  message_type: string
  message_text: string
  delivered: boolean
  sender?: 'parent' | 'counselor'
  leads?: {
    parent_name: string
    child_name: string
    campus: string
    phone: string
  }
}

function cleanPhoneNumber(raw?: string): string {
  const digits = (raw || '').replace(/\D/g, '')
  if (digits.length === 10) return `91${digits}`
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`
  return digits || '919999999999'
}

export default function InboxPage() {
  const [messages, setMessages] = useState<OutboxMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [inputMessage, setInputMessage] = useState('')
  const [sending, setSending] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const fetchOutbox = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/inbox')
      const data = await res.json()
      const list = data.messages || []
      setMessages(list)
      if (list.length > 0 && !selectedLeadId) {
        setSelectedLeadId(list[0].lead_id || 'demo')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOutbox()
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, selectedLeadId])

  // Group messages by lead_id
  const threads: Record<string, OutboxMessage[]> = {}
  messages.forEach((m) => {
    const key = m.lead_id || m.phone || 'demo'
    if (!threads[key]) threads[key] = []
    threads[key].push(m)
  })

  // Seed default lead if empty
  if (Object.keys(threads).length === 0 && !loading) {
    const demoKey = 'demo'
    threads[demoKey] = [
      {
        id: 'seed-1',
        created_at: new Date(Date.now() - 3600000).toISOString(),
        lead_id: 'demo',
        phone: '+91 98765 43210',
        message_type: 'report_link',
        message_text:
          'Hi Ramesh Sharma, your NIAT Decision Report for Priya is ready: http://localhost:3000/report/demo',
        delivered: true,
        sender: 'counselor',
        leads: {
          parent_name: 'Ramesh Sharma',
          child_name: 'Priya',
          campus: 'Hyderabad',
          phone: '+91 98765 43210',
        },
      },
      {
        id: 'seed-2',
        created_at: new Date(Date.now() - 1800000).toISOString(),
        lead_id: 'demo',
        phone: '+91 98765 43210',
        message_type: 'counselor_brief',
        message_text:
          'Counselor Ananya has reviewed your fee and hostel inquiry for Hyderabad campus. Let us know a convenient time to discuss scholarship criteria.',
        delivered: true,
        sender: 'counselor',
        leads: {
          parent_name: 'Ramesh Sharma',
          child_name: 'Priya',
          campus: 'Hyderabad',
          phone: '+91 98765 43210',
        },
      },
    ]
  }

  const currentThreadKey =
    selectedLeadId && threads[selectedLeadId]
      ? selectedLeadId
      : Object.keys(threads)[0] || 'demo'

  const currentThread = threads[currentThreadKey] || []
  const activeLead = currentThread[0]?.leads
  const targetPhone = activeLead?.phone || currentThread[0]?.phone || '+91 98765 43210'
  const cleanPhone = cleanPhoneNumber(targetPhone)

  // Direct WhatsApp dispatch to parent's real phone number
  const openDirectWhatsApp = (text: string) => {
    const encoded = encodeURIComponent(text)
    const waUrl = `https://wa.me/${cleanPhone}?text=${encoded}`
    window.open(waUrl, '_blank')
  }

  // Send message from outbox and launch WhatsApp to parent's number
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!inputMessage.trim() || sending) return

    const text = inputMessage.trim()
    setInputMessage('')
    setSending(true)

    const tempMessage: OutboxMessage = {
      id: `local-${Date.now()}`,
      created_at: new Date().toISOString(),
      lead_id: currentThreadKey,
      phone: targetPhone,
      message_type: 'counselor_reply',
      message_text: text,
      delivered: true,
      sender: 'counselor',
      leads: activeLead,
    }

    setMessages((prev) => [tempMessage, ...prev])

    // Automatically launch WhatsApp to the parent's actual phone number
    openDirectWhatsApp(text)

    try {
      await fetch('/api/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: currentThreadKey,
          phone: targetPhone,
          message_type: 'counselor_reply',
          message_text: text,
          sender: 'counselor',
        }),
      })
    } catch (err) {
      console.error(err)
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  return (
    <main className="min-h-screen bg-[#E5E5E5] text-stone-900 font-sans">
      <div className="max-w-5xl mx-auto h-screen flex flex-col p-1 sm:p-5">
        {/* Top Header */}
        <header className="bg-white border-b border-stone-200 px-4 py-3 flex items-center justify-between rounded-t-lg shadow-xs">
          <div className="flex items-center gap-3">
            <a
              href="/"
              className="text-stone-500 hover:text-stone-800 p-1.5 rounded hover:bg-stone-100 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </a>
            <div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
                <h1 className="font-semibold text-sm sm:text-base text-stone-900">
                  NIAT WhatsApp Admissions Outbox
                </h1>
              </div>
              <p className="text-[11px] text-stone-500">
                Dispatches messages directly to parent WhatsApp numbers stored in database.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchOutbox}
              disabled={loading}
              className="p-1.5 text-stone-600 hover:bg-stone-100 rounded border border-stone-200 transition-colors cursor-pointer"
              title="Refresh"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
              />
            </button>
            <a
              href="/dashboard"
              className="text-xs bg-amber-800 hover:bg-amber-900 text-white px-3 py-1.5 rounded transition-colors font-medium"
            >
              Dashboard
            </a>
          </div>
        </header>

        {/* Main WhatsApp App Frame */}
        <div className="flex-1 bg-white border border-stone-200 rounded-b-lg overflow-hidden flex flex-col sm:flex-row shadow-sm">
          {/* Left Sidebar - Parent List from Database */}
          <div className="w-full sm:w-80 border-r border-stone-200 bg-white flex flex-col h-44 sm:h-auto overflow-y-auto">
            <div className="p-3 bg-[#F0F2F5] border-b border-stone-200 text-xs font-semibold text-stone-600 uppercase tracking-wider flex items-center justify-between">
              <span>Parents in Database ({Object.keys(threads).length})</span>
              <MessageSquare className="w-3.5 h-3.5 text-stone-400" />
            </div>

            {Object.keys(threads).length === 0 ? (
              <div className="p-6 text-center text-xs text-stone-400 italic">
                {loading ? 'Loading...' : 'No parents found in outbox.'}
              </div>
            ) : (
              Object.entries(threads).map(([leadId, msgs], idx) => {
                const latest = msgs[0]
                const parentName = latest.leads?.parent_name || 'Parent'
                const childName = latest.leads?.child_name || 'Student'
                const isSelected = currentThreadKey === leadId
                const phone = latest.leads?.phone || latest.phone || ''

                return (
                  <button
                    key={`${leadId}-${idx}`}
                    type="button"
                    onClick={() => {
                      setSelectedLeadId(leadId)
                      setTimeout(() => inputRef.current?.focus(), 50)
                    }}
                    className={`p-3 text-left border-b border-stone-100 transition-colors flex items-start gap-2.5 w-full cursor-pointer ${
                      isSelected ? 'bg-[#EBE5DE]' : 'hover:bg-stone-50'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                      {parentName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-stone-900 truncate">
                          {parentName}
                        </span>
                        <span className="text-[10px] text-stone-400 shrink-0">
                          {new Date(latest.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <div className="text-[11px] text-stone-600 font-medium">
                        {phone}
                      </div>
                      <div className="text-[11px] text-stone-500 truncate mt-0.5">
                        {latest.message_text}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[9px] uppercase font-mono px-1.5 py-0.2 bg-stone-200 rounded text-stone-600">
                          {childName} • {latest.leads?.campus || 'NIAT'}
                        </span>
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>

          {/* Right Main Chat Window */}
          <div className="flex-1 bg-[#EFEAE2] flex flex-col justify-between overflow-hidden relative">
            {/* Chat Top Bar with Direct WhatsApp Action */}
            <div className="bg-[#F0F2F5] px-4 py-2.5 border-b border-stone-200 flex items-center justify-between z-10 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-emerald-800 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                  {activeLead?.parent_name ? activeLead.parent_name[0] : 'P'}
                </div>
                <div>
                  <div className="font-semibold text-xs sm:text-sm text-stone-900">
                    {activeLead
                      ? `${activeLead.parent_name} (Student: ${activeLead.child_name})`
                      : 'Parent Lead'}
                  </div>
                  <div className="text-[11px] text-stone-600 flex items-center gap-2">
                    <span className="font-mono text-emerald-800 font-semibold">
                      {targetPhone}
                    </span>
                    <span>• Campus: {activeLead?.campus || 'NIAT'}</span>
                  </div>
                </div>
              </div>

              {/* Direct Open WhatsApp Button */}
              <button
                type="button"
                onClick={() =>
                  openDirectWhatsApp(
                    `Hi ${activeLead?.parent_name || 'Sir'}, this is Counselor Ananya from NIAT regarding ${activeLead?.child_name || 'your child'}'s admission.`
                  )
                }
                className="flex items-center gap-1.5 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-medium px-3 py-1.5 rounded transition-colors shadow-xs cursor-pointer"
                title={`Open WhatsApp directly to ${targetPhone}`}
              >
                <span>Chat on WhatsApp</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Bubble Feed */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3">
              <div className="text-center my-1.5">
                <span className="bg-white/80 text-stone-600 text-[10px] font-medium px-3 py-1 rounded-full shadow-2xs border border-stone-200/60">
                  Direct WhatsApp notifications dispatched to: {targetPhone}
                </span>
              </div>

              {[...currentThread].reverse().map((msg, idx) => {
                const isCounselor = msg.sender !== 'parent'

                return (
                  <div
                    key={`${msg.id || 'msg'}-${idx}`}
                    className={`flex ${isCounselor ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`p-3 rounded-lg max-w-xs sm:max-w-md shadow-xs text-xs space-y-1 relative ${
                        isCounselor
                          ? 'bg-[#D9FDD3] text-stone-950 rounded-tr-none'
                          : 'bg-white text-stone-900 rounded-tl-none border border-stone-100'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] pb-1 border-b border-black/5 font-medium gap-3">
                        <span className="text-stone-500 uppercase tracking-wider font-mono">
                          {isCounselor ? 'Sent to Parent' : 'Received from Parent'}
                        </span>
                        <span className="text-stone-400 shrink-0">
                          {new Date(msg.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      <p className="leading-relaxed whitespace-pre-wrap font-sans text-xs sm:text-[13px] pt-0.5">
                        {msg.message_text}
                      </p>

                      <div className="flex items-center justify-between pt-1 border-t border-black/5 text-[10px]">
                        <button
                          type="button"
                          onClick={() => openDirectWhatsApp(msg.message_text)}
                          className="text-emerald-800 hover:underline flex items-center gap-1 font-medium cursor-pointer"
                          title="Open this message directly in WhatsApp to parent"
                        >
                          <span>Forward to {cleanPhone}</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                        <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
                      </div>
                    </div>
                  </div>
                )
              })}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Template Dispatches */}
            <div className="bg-[#F0F2F5]/90 px-3 py-1.5 border-t border-stone-200 flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="text-stone-500 font-medium">Quick send:</span>
              <button
                type="button"
                onClick={() => {
                  const txt = `Hi ${activeLead?.parent_name || 'Sir'}, your NIAT Decision Report for ${activeLead?.child_name || 'your child'} is ready to view: http://localhost:3000/report/${currentThreadKey}`
                  setInputMessage(txt)
                  inputRef.current?.focus()
                }}
                className="bg-white hover:bg-stone-100 text-stone-700 px-2 py-0.5 rounded border border-stone-300 transition-colors cursor-pointer"
              >
                Send Report Link
              </button>
              <button
                type="button"
                onClick={() => {
                  const txt = `Namaste ${activeLead?.parent_name || 'Sir'}, would you be available for a quick 10-minute phone call today with our ${activeLead?.campus || 'campus'} admissions counselor?`
                  setInputMessage(txt)
                  inputRef.current?.focus()
                }}
                className="bg-white hover:bg-stone-100 text-stone-700 px-2 py-0.5 rounded border border-stone-300 transition-colors cursor-pointer"
              >
                Schedule Counselor Call
              </button>
              <button
                type="button"
                onClick={() => {
                  const txt = `Hi ${activeLead?.parent_name || 'Sir'}, hostel seats with 24/7 security at ${activeLead?.campus || 'our'} campus are currently filling up for 2026. Let us know if you need the hostel fee schedule.`
                  setInputMessage(txt)
                  inputRef.current?.focus()
                }}
                className="bg-white hover:bg-stone-100 text-stone-700 px-2 py-0.5 rounded border border-stone-300 transition-colors cursor-pointer"
              >
                Hostel Update
              </button>
            </div>

            {/* Interactive Composer Form - Sends directly to Parent's Phone */}
            <form
              onSubmit={handleSendMessage}
              className="bg-[#F0F2F5] px-3 py-2.5 border-t border-stone-200 flex items-center gap-2 z-10"
            >
              <input
                ref={inputRef}
                type="text"
                autoFocus
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder={`Type message to send directly to ${targetPhone} on WhatsApp (Press Enter)...`}
                className="flex-1 bg-white border border-stone-300 rounded-lg px-4 py-2.5 text-xs sm:text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 shadow-2xs cursor-text"
              />

              <button
                type="submit"
                disabled={!inputMessage.trim() || sending}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-lg transition-colors shadow-xs cursor-pointer flex items-center gap-1.5 text-xs font-semibold shrink-0"
                title={`Send message to ${targetPhone} on WhatsApp`}
              >
                <span>Send to {cleanPhone}</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  )
}
