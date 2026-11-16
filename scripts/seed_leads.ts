import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
})

const CAMPUSES = ['Hyderabad', 'Vijayawada', 'Visakhapatnam', 'Chennai', 'Bengaluru', 'Pune']
const LANGUAGES = ['en', 'hi', 'te', 'ta', 'kn', 'ml']
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
const BUDGETS = ['<1L/yr', '1-2L/yr', '2-3L/yr', '3-4L/yr', '4L+/yr', 'Not sure']

const FIRST_NAMES = [
  'Ramesh', 'Suresh', 'Anita', 'Krishnamurthy', 'Meenakshi', 'Venkat', 'Lakshmi', 'Rajesh',
  'Pooja', 'Sunil', 'Kavita', 'Manoj', 'Deepa', 'Sanjay', 'Geeta', 'Anand', 'Shanti',
  'Pradeep', 'Radha', 'Arun', 'Savita', 'Girish', 'Bhavani', 'Naveen', 'Usha', 'Kishore',
  'Madhavi', 'Vikram', 'Hemalatha', 'Raghavan',
]

const CHILDREN = [
  'Priya', 'Arjun', 'Ravi', 'Sindhu', 'Kartik', 'Ananya', 'Sai', 'Rahul', 'Sneha',
  'Varun', 'Divya', 'Aditya', 'Meera', 'Rohan', 'Swathi', 'Kiran', 'Nandini', 'Tejas',
  'Harini', 'Gautam', 'Kavya', 'Siddharth', 'Tanvi', 'Abhishek', 'Ritu', 'Pranav',
  'Sahana', 'Nikhil', 'Keerthi', 'Harsh',
]

const CITIES = [
  'Hyderabad', 'Warangal', 'Vijayawada', 'Guntur', 'Visakhapatnam', 'Tirupati',
  'Chennai', 'Coimbatore', 'Bengaluru', 'Mysuru', 'Pune', 'Nagpur', 'Mumbai', 'Delhi',
]

// 30 synthetic leads with realistic funnel drop-off:
// Total: 30
// Report completed: 25 (~83%)
// Voice call done: 12 (~40%)
// Counselor booked: 7 (~23%)
async function seed() {
  console.log('Seeding 30 synthetic leads with realistic funnel metrics...')

  // Clean existing synthetic leads if any
  const { error: delErr } = await supabase
    .from('leads')
    .delete()
    .eq('is_synthetic', true)

  if (delErr) {
    console.warn('Note on clean-up:', delErr.message)
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  for (let i = 0; i < 30; i++) {
    const parent = FIRST_NAMES[i % FIRST_NAMES.length] + ' ' + String.fromCharCode(65 + (i % 26))
    const child = CHILDREN[i % CHILDREN.length]
    const campus = CAMPUSES[i % CAMPUSES.length]
    const language = LANGUAGES[i % LANGUAGES.length]
    const concern = CONCERNS[i % CONCERNS.length]
    const budget = BUDGETS[i % BUDGETS.length]
    const city = CITIES[i % CITIES.length]
    const phone = `+91 ${9800000000 + i * 11111}`
    const sessionId = `seed-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`

    // Funnel distribution
    const report_completed = i < 25 // 25 of 30
    const voice_call_done = i < 12 // 12 of 30
    const counselor_booked = i < 7 // 7 of 30

    let intent_score = 25
    if (report_completed) intent_score += 30
    if (voice_call_done) intent_score += 25
    if (counselor_booked) intent_score = 95

    const report_text = report_completed
      ? `NIAT PERSONALIZED REPORT FOR ${child.toUpperCase()}\n\n1. Degree: Awarded by collaborating accredited university. NIAT provides industry upskilling.\n2. Campus Fit: ${campus} campus provides state-of-the-art labs and residential hostel facilities.\n3. Fee Context: Transparent options with EMI and merit scholarships. Counselor will confirm exact structure.\n4. Addressed Concern (${concern}): Honest guidance without placement guarantees.\n5. Career Path: Structured training for modern technology roles.\n6. Next Step: Book a 15-minute consultation with a campus advisor.`
      : null

    const counselor_brief = counselor_booked
      ? `COUNSELOR BRIEF\nParent: ${parent}\nStudent: ${child}\nCampus: ${campus}\nPrimary Concern: ${concern}\nPreferred slot: Flexible\nAction: Focus on ${concern.replace(/_/g, ' ')} and verify hostel/fee criteria.`
      : null

    const call_summary = voice_call_done
      ? `AI Voice consultation completed (duration: 114s). Parent expressed concern regarding ${concern.replace(/_/g, ' ')}. Advised to review Layer 1 university degree accreditation.`
      : null

    const { data: lead, error: insertErr } = await supabase
      .from('leads')
      .insert({
        parent_name: parent,
        child_name: child,
        phone,
        city,
        campus,
        budget_range: budget,
        language,
        primary_concern: concern,
        objection_category: concern,
        intent_score,
        report_completed,
        voice_call_done,
        counselor_booked,
        report_text,
        counselor_brief,
        call_summary,
        session_id: sessionId,
        is_synthetic: true,
      })
      .select('id')
      .single()

    if (insertErr || !lead) {
      console.error(`Failed to insert lead ${i}:`, insertErr)
      continue
    }

    // Insert objection ledger
    await supabase.from('objection_ledger').insert({
      lead_id: lead.id,
      objection_category: concern,
      campus,
      language,
    })

    // Insert outbox message
    if (report_completed) {
      await supabase.from('outbox').insert({
        lead_id: lead.id,
        phone,
        message_type: 'report_link',
        message_text: `Hi ${parent}, your NIAT Decision Report for ${child} is ready: ${appUrl}/report/${lead.id}`,
        delivered: true,
      })
    }

    if (counselor_booked) {
      await supabase.from('outbox').insert({
        lead_id: lead.id,
        phone,
        message_type: 'call_confirmation',
        message_text: `Hi ${parent}, your counselor consultation for ${child} at ${campus} campus has been confirmed. A counselor will connect with you via WhatsApp.`,
        delivered: true,
      })
    }
  }

  console.log('Successfully seeded 30 leads into leads, objection_ledger, and outbox tables!')
}

seed().catch(console.error)
