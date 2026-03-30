import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const { campaignId } = await req.json()

  const { data: campaign } = await supabase
    .from('ad_campaigns')
    .select('*')
    .eq('id', campaignId)
    .single()

  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: `วิเคราะห์ Facebook Ad campaign นี้และให้คำแนะนำเป็นภาษาไทย:
      ชื่อ: ${campaign.campaign_name}
      งบต่อวัน: ${campaign.daily_budget} บาท
      สถานะ: ${campaign.status}
      
      ตอบในรูปแบบ JSON:
      {
        "recommendation": "keep_running หรือ increase_budget หรือ change_targeting หรือ pause_ad",
        "summary": "สรุปสั้นๆ",
        "reasoning": "เหตุผล",
        "actionItems": ["ข้อแนะนำ 1", "ข้อแนะนำ 2"]
      }`
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
  const analysis = JSON.parse(text.replace(/```json|```/g, '').trim())

  await supabase.from('ai_analyses').insert({
    campaign_id: campaignId,
    recommendation: analysis.recommendation,
    summary: analysis.summary,
    reasoning: analysis.reasoning,
    action_items: analysis.actionItems,
  })

  return NextResponse.json({ analysis })
}