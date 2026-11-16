'use client'

import { useEffect, useState } from 'react'
import {
  MessageSquare,
  CheckCheck,
  Send,
  RefreshCw,
  Phone,
  ArrowLeft,
  Calendar,
} from 'lucide-react'

type OutboxMessage = {
  id: string
  created_at: string
  lead_id: string
  phone: string
  message_type: 'report_link' | 'call_confirmation' | 'counselor_brief'
  message_text: string
  delivered: boolean
  leads?: {
    parent_name: string
    child_name: string
    campus: string
    phone: string
  }
}

export default function InboxPage() {
  const [messages, setMessages] = useState<OutboxMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)

  const fetchOutbox = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/inbox')
      const data = await res.json()
      const list = data.messages || []
      setMessages(list)
      if (list.length > 0 && !selectedLeadId) {
        setSelectedLeadId(list[0].lead_id)
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

  // Group messages by lead_id
  const threads: Record<string, OutboxMessage[]> = {}
  messages.forEach((m) => {
    const key = m.lead_id || m.phone || 'general'
    if (!threads[key]) threads[key] = []
    threads[key].push(m)
  })

  const currentThread = selectedLeadId ? threads[selectedLeadId] || [] : []
  const activeLead = currentThread[0]?.leads

  return (
    <main className="min-h-screen bg-[#F0F2F5] text-stone-900 font-sans">
      <div className="max-w-5xl mx-auto h-screen flex flex-col p-2 sm:p-6">
        {/* Top bar */}
        <header className="bg-white border-b border-stone-200 px-4 py-3 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center gap-3">
            <a
              href="/"
              className="text-stone-500 hover:text-stone-800 p-1 rounded hover:bg-stone-100"
            >
              <ArrowLeft className="w-4 h-4" />
            </a>
            <div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
                <h1 className="font-semibold text-sm sm:text-base text-stone-900">
                  Simulated WhatsApp Dispatch (Outbox)
                </h1>
              </div>
              <p className="text-[11px] text-stone-500">
                Audits automated SMS &amp; WhatsApp dispatches sent to parents from the decision room.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchOutbox}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs bg-stone-100 hover:bg-stone-200 px-3 py-1.5 rounded text-stone-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <a
              href="/dashboard"
              className="text-xs bg-amber-800 hover:bg-amber-900 text-white px-3 py-1.5 rounded transition-colors"
            >
              Dashboard
            </a>
          </div>
        </header>

        {/* Main WhatsApp Window */}
        <div className="flex-1 bg-white border border-stone-200 rounded-b-lg overflow-hidden flex flex-col sm:flex-row">
          {/* Thread List */}
          <div className="w-full sm:w-80 border-r border-stone-200 bg-white flex flex-col h-48 sm:h-auto overflow-y-auto">
            <div className="p-3 bg-stone-50 border-b border-stone-200 text-xs font-semibold text-stone-600 uppercase tracking-wider flex items-center justify-between">
              <span>Parent Threads ({Object.keys(threads).length})</span>
              <MessageSquare className="w-3.5 h-3.5 text-stone-400" />
            </div>

            {Object.keys(threads).length === 0 ? (
              <div className="p-6 text-center text-xs text-stone-400 italic">
                {loading ? 'Checking outbox...' : 'No outgoing WhatsApp messages logged yet.'}
              </div>
            ) : (
              Object.entries(threads).map(([leadId, msgs]) => {
                const latest = msgs[0]
                const parentName = latest.leads?.parent_name || 'Parent'
                const childName = latest.leads?.child_name || 'Student'
                const isSelected = selectedLeadId === leadId

                return (
                  <button
                    key={leadId}
                    type="button"
                    onClick={() => setSelectedLeadId(leadId)}
                    className={`p-3 text-left border-b border-stone-100 transition-colors flex items-start gap-2.5 ${
                      isSelected ? 'bg-stone-100' : 'hover:bg-stone-50/70'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0">
                      {parentName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-stone-900 truncate">
                          {parentName} ({childName})
                        </span>
                        <span className="text-[10px] text-stone-400">
                          {new Date(latest.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-500 truncate mt-0.5">
                        {latest.message_text}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[9px] uppercase font-mono px-1.5 py-0.2 bg-stone-200/70 rounded text-stone-600">
                          {latest.message_type.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[10px] text-stone-400">
                          {latest.leads?.campus || ''}
                        </span>
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>

          {/* Chat Window */}
          <div className="flex-1 bg-[#EFEAE2] flex flex-col justify-between overflow-hidden">
            {/* Chat header */}
            <div className="bg-[#F0F2F5] px-4 py-2.5 border-b border-stone-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-xs">
                  {activeLead?.parent_name ? activeLead.parent_name[0] : 'NIAT'}
                </div>
                <div>
                  <div className="font-semibold text-xs text-stone-900">
                    {activeLead
                      ? `${activeLead.parent_name} (Child: ${activeLead.child_name})`
                      : 'NIAT System Automated Dispatch'}
                  </div>
                  <div className="text-[10px] text-stone-500 flex items-center gap-2">
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3 text-stone-400" />
                      {activeLead?.phone || currentThread[0]?.phone || 'WhatsApp Verified'}
                    </span>
                    {activeLead?.campus && (
                      <span>• Campus: {activeLead.campus}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-[11px] text-stone-400 font-mono">
                {currentThread.length} message{currentThread.length !== 1 ? 's' : ''}
              </div>
            </div>

            {/* Bubble area */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3">
              <div className="text-center my-2">
                <span className="bg-stone-200/80 text-stone-600 text-[10px] font-medium px-2 py-0.5 rounded">
                  End-to-End Simulation • All messages generated by parent decision workflow
                </span>
              </div>

              {currentThread.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-stone-400">
                  Select a thread on the left to inspect sent WhatsApp messages.
                </div>
              ) : (
                [...currentThread].reverse().map((msg) => (
                  <div key={msg.id} className="flex justify-end">
                    <div className="bg-[#D9FDD3] text-stone-900 p-3 rounded-lg rounded-tr-none max-w-sm sm:max-w-md shadow-xs text-xs space-y-1 relative">
                      <div className="flex items-center justify-between text-[10px] text-emerald-900/70 border-b border-emerald-200/60 pb-1 mb-1">
                        <span className="font-mono font-semibold uppercase tracking-wider">
                          {msg.message_type.replace(/_/g, ' ')}
                        </span>
                        <span>{new Date(msg.created_at).toLocaleDateString()}</span>
                      </div>

                      <p className="leading-relaxed whitespace-pre-wrap font-sans">
                        {msg.message_text}
                      </p>

                      <div className="flex items-center justify-end gap-1 text-[10px] text-stone-400 pt-0.5">
                        <span>
                          {new Date(msg.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Simulated read-only composer */}
            <div className="bg-[#F0F2F5] px-4 py-2.5 border-t border-stone-200 flex items-center gap-2 text-xs text-stone-500">
              <span className="flex-1 bg-white border border-stone-200 rounded-full px-4 py-2 text-stone-400 italic">
                Outbox is managed automatically by webhook triggers &amp; counselor booking events...
              </span>
              <div className="p-2 bg-emerald-600 text-white rounded-full">
                <Send className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
