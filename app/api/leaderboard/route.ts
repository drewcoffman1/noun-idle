import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

const redis = Redis.fromEnv()

const LEADERBOARD_KEY = 'noun-idle:leaderboard'
const NAMES_KEY = 'noun-idle:player-names'

interface LeaderboardEntry {
  address: string
  displayName: string
  score: number
  rank: number
}

// GET - Fetch leaderboard (top 20 + player's rank if address provided)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const address = searchParams.get('address')?.toLowerCase()

    // Get top 20 players
    const topPlayers = await redis.zrange(LEADERBOARD_KEY, 0, 19, { rev: true, withScores: true })

    // Format results
    const leaderboard: LeaderboardEntry[] = []
    for (let i = 0; i < topPlayers.length; i += 2) {
      const addr = topPlayers[i] as string
      const score = topPlayers[i + 1] as number
      const displayName = await redis.hget(NAMES_KEY, addr) as string | null
      leaderboard.push({
        address: addr,
        displayName: displayName || `${addr.slice(0, 6)}...${addr.slice(-4)}`,
        score,
        rank: Math.floor(i / 2) + 1,
      })
    }

    // Get player's rank if address provided
    let playerRank: LeaderboardEntry | null = null
    if (address) {
      const rank = await redis.zrevrank(LEADERBOARD_KEY, address)
      if (rank !== null) {
        const score = await redis.zscore(LEADERBOARD_KEY, address)
        const displayName = await redis.hget(NAMES_KEY, address) as string | null
        playerRank = {
          address,
          displayName: displayName || `${address.slice(0, 6)}...${address.slice(-4)}`,
          score: score || 0,
          rank: rank + 1,
        }
      }
    }

    return NextResponse.json({ leaderboard, playerRank })
  } catch (error) {
    console.error('Failed to fetch leaderboard:', error)
    return NextResponse.json({ leaderboard: [], playerRank: null })
  }
}

// POST - Update player's score
export async function POST(request: Request) {
  try {
    const { address, score, displayName } = await request.json()

    if (!address || typeof score !== 'number') {
      return NextResponse.json({ error: 'Address and score required' }, { status: 400 })
    }

    const normalizedAddress = address.toLowerCase()

    // Only update if new score is higher
    const currentScore = await redis.zscore(LEADERBOARD_KEY, normalizedAddress)
    if (currentScore === null || score > currentScore) {
      await redis.zadd(LEADERBOARD_KEY, { score, member: normalizedAddress })
    }

    // Update display name if provided
    if (displayName) {
      await redis.hset(NAMES_KEY, { [normalizedAddress]: displayName })
    }

    // Get updated rank
    const rank = await redis.zrevrank(LEADERBOARD_KEY, normalizedAddress)

    return NextResponse.json({ success: true, rank: rank !== null ? rank + 1 : null })
  } catch (error) {
    console.error('Failed to update leaderboard:', error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}
