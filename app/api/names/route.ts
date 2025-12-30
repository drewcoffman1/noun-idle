import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

const NAMES_KEY = 'noun-idle:custom-names'
const MAX_NAMES = 100 // Keep last 100 custom names

export async function GET() {
  try {
    const names = await redis.lrange(NAMES_KEY, 0, -1)
    return NextResponse.json({ names: names || [] })
  } catch (error) {
    console.error('Failed to fetch names:', error)
    // Return empty array if Redis not configured
    return NextResponse.json({ names: [] })
  }
}

export async function POST(request: Request) {
  try {
    const { name, txHash } = await request.json()

    // Basic validation
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    // Sanitize name (alphanumeric, spaces, max 20 chars)
    const sanitized = name.trim().slice(0, 20).replace(/[^a-zA-Z0-9 ]/g, '')
    if (sanitized.length < 1) {
      return NextResponse.json({ error: 'Invalid name' }, { status: 400 })
    }

    // Add to Redis list
    await redis.lpush(NAMES_KEY, sanitized)

    // Trim to max size
    await redis.ltrim(NAMES_KEY, 0, MAX_NAMES - 1)

    return NextResponse.json({ success: true, name: sanitized })
  } catch (error) {
    console.error('Failed to add name:', error)
    return NextResponse.json({ error: 'Failed to add name' }, { status: 500 })
  }
}
