import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const { campaignId } = await req.json()
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

    const { data: campaign } = await supabase
      .from('ad_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()

    if (!campaign) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `วิเคราะห์ Facebook Ad นี้ภาษาไทย: ชื่อ ${campaign.campaign_name} งบ ${campaign.daily_budget} บาท/วัน สถานะ ${campaign.status} ตอบ JSON: {"recommendation":"keep_running","summary":"สรุป","reasoning":"เหตุผล","actionItems":["แนะนำ1"]}`
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
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}