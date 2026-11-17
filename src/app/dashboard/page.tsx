'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Users,
  FileCheck,
  PhoneCall,
  CalendarCheck,
  TrendingUp,
  Filter,
  ShieldAlert,
  Search,
} from 'lucide-react'

type Lead = {
  id: string
  created_at: string
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
  report_completed: boolean
  voice_call_done: boolean
  counselor_booked: boolean
  is_synthetic: boolean
}

type FunnelData = {
  total: number
  report_completed: number
  voice_call_done: number
  counselor_booked: number
  conversion_pct: number
}

const CAMPUSES = [
  'All',
  'Hyderabad',
  'Vijayawada',
  'Visakhapatnam',
  'Chennai',
  'Bengaluru',
  'Pune',
]

const LANGUAGES = [
  { code: 'All', label: 'All Languages' },
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'te', label: 'Telugu' },
  { code: 'ta', label: 'Tamil' },
  { code: 'kn', label: 'Kannada' },
  { code: 'ml', label: 'Malayalam' },
]

export default function DashboardPage() {
  const [dashboardKey, setDashboardKey] = useState('')
  const [keyInput, setKeyInput] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [authError, setAuthError] = useState(false)

  const [loading, setLoading] = useState(false)
  const [funnel, setFunnel] = useState<FunnelData>({
    total: 0,
    report_completed: 0,
    voice_call_done: 0,
    counselor_booked: 0,
    conversion_pct: 0,
  })
  const [objections, setObjections] = useState<Record<string, number>>({})
  const [leads, setLeads] = useState<Lead[]>([])

  // Filters
  const [selectedCampus, setSelectedCampus] = useState('All')
  const [selectedLanguage, setSelectedLanguage] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')

  const fetchDashboardData = useCallback(async (key: string) => {
    setLoading(true)
    setAuthError(false)
    try {
      const params = new URLSearchParams()
      params.set('key', key)
      if (selectedCampus !== 'All') params.set('campus', selectedCampus)
      if (selectedLanguage !== 'All') params.set('language', selectedLanguage)

      const res = await fetch(`/api/dashboard?${params.toString()}`)
      if (res.status === 401) {
        setAuthenticated(false)
        setAuthError(true)
        return
      }
      if (!res.ok) throw new Error('Failed to load dashboard')

      const data = await res.json()
      setFunnel(data.funnel)
      setObjections(data.objection_counts || {})
      setLeads(data.leads || [])
      setAuthenticated(true)
    } catch (err) {
      console.error(err)
      setAuthError(true)
    } finally {
      setLoading(false)
    }
  }, [selectedCampus, selectedLanguage])

  // Check URL query param or localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const k = urlParams.get('key') || localStorage.getItem('niat_dashboard_key') || ''
      if (k) {
        setDashboardKey(k)
        fetchDashboardData(k)
      }
    }
  }, [fetchDashboardData])

  // Refetch when filters change
  useEffect(() => {
    if (authenticated && dashboardKey) {
      fetchDashboardData(dashboardKey)
    }
  }, [selectedCampus, selectedLanguage, authenticated, dashboardKey, fetchDashboardData])

  const handleKeySubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!keyInput.trim()) return
    const k = keyInput.trim()
    setDashboardKey(k)
    if (typeof window !== 'undefined') {
      localStorage.setItem('niat_dashboard_key', k)
    }
    fetchDashboardData(k)
  }

  // Filter leads by search query locally
  const filteredLeads = leads.filter((l) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      l.parent_name?.toLowerCase().includes(q) ||
      l.child_name?.toLowerCase().includes(q) ||
      l.city?.toLowerCase().includes(q) ||
      l.campus?.toLowerCase().includes(q) ||
      l.primary_concern?.toLowerCase().includes(q)
    )
  })

  // Recommend next action based on lead profile
  const getNextAction = (lead: Lead): string => {
    if (lead.counselor_booked) {
      return 'Prep brief for scheduled call'
    }
    if (lead.voice_call_done && !lead.counselor_booked) {
      return 'Follow up via WhatsApp voice note'
    }
    if (lead.report_completed && lead.intent_score >= 70) {
      return 'High intent: Call parent directly'
    }
    if (lead.report_completed) {
      return 'Send campus comparison guide'
    }
    return 'Send reminder to complete intake'
  }

  // Max count for objection bars
  const maxObjectionCount = Math.max(...Object.values(objections), 1)

  if (!authenticated) {
    return (
      <main className="min-h-screen bg-[#FAFAF7] text-stone-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-stone-200 p-8 rounded shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-stone-900 font-serif font-bold text-xl">
            <ShieldAlert className="w-5 h-5 text-amber-800" />
            <span>Counselor Dashboard</span>
          </div>
          <p className="text-xs text-stone-500 leading-relaxed">
            Please enter your access key or append <code className="bg-stone-100 px-1 py-0.5 rounded">?key=your_key</code> to the URL.
          </p>

          {authError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded">
              Invalid or missing access key. Check DASHBOARD_KEY in your environment configuration.
            </div>
          )}

          <form onSubmit={handleKeySubmit} className="space-y-3 pt-2">
            <div>
              <label className="block text-xs font-medium text-stone-700 uppercase tracking-wider mb-1">
                Access Key
              </label>
              <input
                type="password"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="Enter DASHBOARD_KEY"
                className="w-full border border-stone-300 rounded px-3 py-2 text-sm focus:border-amber-800 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-800 hover:bg-amber-900 text-white font-medium py-2.5 rounded text-sm transition-colors"
            >
              {loading ? 'Authenticating...' : 'Access Dashboard'}
            </button>
          </form>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#FAFAF7] text-stone-900 px-4 py-8 sm:py-12 selection:bg-amber-100 selection:text-amber-900">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200">
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-stone-950">
              NIAT Counselor Dashboard
            </h1>
            <p className="text-xs sm:text-sm text-stone-500 mt-1">
              Live parent intent funnel, regional objection analysis &amp; actionable leads.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/inbox"
              className="text-xs border border-stone-300 hover:bg-stone-100 px-3 py-1.5 rounded text-stone-700 transition-colors"
            >
              Simulated WhatsApp Outbox →
            </a>
            <a
              href="/"
              className="text-xs bg-amber-800 hover:bg-amber-900 text-white px-3 py-1.5 rounded transition-colors"
            >
              + New Intake
            </a>
          </div>
        </div>

        {/* ── METRIC FUNNEL ── */}
        <section className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
          <div className="bg-white border border-stone-200 p-4 rounded shadow-sm">
            <div className="flex items-center justify-between text-stone-500 text-xs">
              <span>Total Leads</span>
              <Users className="w-4 h-4 text-stone-400" />
            </div>
            <div className="text-2xl font-bold font-serif text-stone-950 mt-1.5">
              {funnel.total}
            </div>
            <div className="text-[11px] text-stone-500 mt-1">Initiated profile</div>
          </div>

          <div className="bg-white border border-stone-200 p-4 rounded shadow-sm">
            <div className="flex items-center justify-between text-stone-500 text-xs">
              <span>Report Generated</span>
              <FileCheck className="w-4 h-4 text-amber-800" />
            </div>
            <div className="text-2xl font-bold font-serif text-stone-950 mt-1.5">
              {funnel.report_completed}
            </div>
            <div className="text-[11px] text-stone-500 mt-1">
              {funnel.total > 0 ? Math.round((funnel.report_completed / funnel.total) * 100) : 0}% completion
            </div>
          </div>

          <div className="bg-white border border-stone-200 p-4 rounded shadow-sm">
            <div className="flex items-center justify-between text-stone-500 text-xs">
              <span>Voice Consultations</span>
              <PhoneCall className="w-4 h-4 text-purple-700" />
            </div>
            <div className="text-2xl font-bold font-serif text-stone-950 mt-1.5">
              {funnel.voice_call_done}
            </div>
            <div className="text-[11px] text-stone-500 mt-1">AI voice consult done</div>
          </div>

          <div className="bg-white border border-stone-200 p-4 rounded shadow-sm">
            <div className="flex items-center justify-between text-stone-500 text-xs">
              <span>Counselor Booked</span>
              <CalendarCheck className="w-4 h-4 text-emerald-700" />
            </div>
            <div className="text-2xl font-bold font-serif text-stone-950 mt-1.5">
              {funnel.counselor_booked}
            </div>
            <div className="text-[11px] text-stone-500 mt-1">Ready for 1:1 call</div>
          </div>

          <div className="bg-amber-50/80 border border-amber-300 p-4 rounded shadow-sm col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between text-amber-900 text-xs font-semibold">
              <span>Conversion Rate</span>
              <TrendingUp className="w-4 h-4 text-amber-800" />
            </div>
            <div className="text-2xl font-bold font-serif text-amber-950 mt-1.5">
              {funnel.conversion_pct}%
            </div>
            <div className="text-[11px] text-amber-800 mt-1">Lead to booking</div>
          </div>
        </section>

        {/* ── OBJECTION LEDGER BAR CHART ── */}
        <section className="bg-white border border-stone-200 p-6 rounded shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <div>
              <h2 className="text-base font-serif font-bold text-stone-950">
                Objection Ledger
              </h2>
              <p className="text-xs text-stone-500">
                Frequency of parent concerns across regional applicant pools.
              </p>
            </div>
            <span className="text-xs font-mono text-stone-400">
              {Object.keys(objections).length} categories logged
            </span>
          </div>

          <div className="space-y-2.5 pt-2">
            {Object.keys(objections).length === 0 ? (
              <p className="text-xs text-stone-400 italic">No objection ledger entries yet.</p>
            ) : (
              Object.entries(objections)
                .sort(([, a], [, b]) => b - a)
                .map(([cat, count]) => {
                  const pct = Math.round((count / maxObjectionCount) * 100)
                  return (
                    <div key={cat} className="space-y-1">
                      <div className="flex justify-between text-xs text-stone-700">
                        <span className="capitalize font-medium">
                          {cat.replace(/_/g, ' ')}
                        </span>
                        <span className="font-mono text-stone-500">
                          {count} ({Math.round((count / (funnel.total || 1)) * 100)}%)
                        </span>
                      </div>
                      <div className="w-full bg-stone-100 h-2 rounded overflow-hidden">
                        <div
                          className="bg-amber-800 h-full rounded transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })
            )}
          </div>
        </section>

        {/* ── LEADS TABLE WITH FILTERS & SEARCH ── */}
        <section className="bg-white border border-stone-200 rounded shadow-sm overflow-hidden">
          {/* Controls Bar */}
          <div className="p-4 sm:p-5 border-b border-stone-100 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-base font-serif font-bold text-stone-950">
                Recent Family Inquiries ({filteredLeads.length})
              </h2>

              {/* Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search student, city, concern..."
                  className="pl-8 pr-3 py-1.5 text-xs border border-stone-300 rounded focus:border-amber-800 focus:outline-none w-full sm:w-64 bg-stone-50/50"
                />
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
              <div className="flex items-center gap-1.5 text-stone-500 font-medium">
                <Filter className="w-3.5 h-3.5 text-stone-400" />
                <span>Campus:</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {CAMPUSES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setSelectedCampus(c)}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                      selectedCampus === c
                        ? 'bg-amber-800 text-white'
                        : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5 text-stone-500 font-medium ml-2">
                <span>Lang:</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {LANGUAGES.map((l) => (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => setSelectedLanguage(l.code)}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                      selectedLanguage === l.code
                        ? 'bg-amber-800 text-white'
                        : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-800">
              <thead className="bg-stone-50 border-b border-stone-200 text-[11px] uppercase tracking-wider text-stone-500 font-medium">
                <tr>
                  <th className="py-3 px-4">Student &amp; Parent</th>
                  <th className="py-3 px-3">Campus</th>
                  <th className="py-3 px-3">City / Lang</th>
                  <th className="py-3 px-3">Primary Concern</th>
                  <th className="py-3 px-3">Intent Score</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-4">Recommended Next Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-stone-400 italic">
                      No leads matching the selected criteria.
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map((l, idx) => (
                    <tr key={`${l.id}-${idx}`} className="hover:bg-stone-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-stone-900">{l.child_name}</div>
                        <div className="text-stone-500 text-[11px]">
                          {l.parent_name} • {l.phone || 'No phone'}
                        </div>
                      </td>
                      <td className="py-3 px-3 font-medium">{l.campus || '—'}</td>
                      <td className="py-3 px-3 text-stone-600">
                        <div>{l.city || '—'}</div>
                        <div className="text-[10px] uppercase font-mono text-stone-400">
                          {l.language || 'en'}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="capitalize text-stone-700">
                          {(l.objection_category || l.primary_concern || '—').replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                            l.intent_score >= 80
                              ? 'bg-emerald-100 text-emerald-800'
                              : l.intent_score >= 50
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-stone-100 text-stone-700'
                          }`}
                        >
                          {l.intent_score}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        {l.counselor_booked ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                            <CalendarCheck className="w-3.5 h-3.5" />
                            Booked
                          </span>
                        ) : l.voice_call_done ? (
                          <span className="inline-flex items-center gap-1 text-purple-700 font-medium">
                            <PhoneCall className="w-3.5 h-3.5" />
                            Voice done
                          </span>
                        ) : l.report_completed ? (
                          <span className="inline-flex items-center gap-1 text-amber-800 font-medium">
                            <FileCheck className="w-3.5 h-3.5" />
                            Report ready
                          </span>
                        ) : (
                          <span className="text-stone-400">Intake only</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-stone-900">{getNextAction(l)}</div>
                        <a
                          href={`/report/${l.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-amber-800 hover:underline inline-block mt-0.5"
                        >
                          View Report →
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  )
}
