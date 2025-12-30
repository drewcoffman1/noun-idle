import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

const SAVE_PREFIX = 'noun-idle:save:'

// GET - Load save by wallet address
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const address = searchParams.get('address')?.toLowerCase()

    if (!address) {
      return NextResponse.json({ error: 'Address required' }, { status: 400 })
    }

    const save = await redis.get(`${SAVE_PREFIX}${address}`)

    if (!save) {
      return NextResponse.json({ save: null })
    }

    return NextResponse.json({ save })
  } catch (error) {
    console.error('Failed to load save:', error)
    return NextResponse.json({ save: null })
  }
}

// POST - Save game state by wallet address
export async function POST(request: Request) {
  try {
    const { address, gameState } = await request.json()

    if (!address || !gameState) {
      return NextResponse.json({ error: 'Address and gameState required' }, { status: 400 })
    }

    const normalizedAddress = address.toLowerCase()

    // Save with 30 day expiry (refreshed on each save)
    await redis.set(
      `${SAVE_PREFIX}${normalizedAddress}`,
      gameState,
      { ex: 60 * 60 * 24 * 30 } // 30 days
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to save:', error)
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }
}
