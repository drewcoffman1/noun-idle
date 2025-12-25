import { NextRequest, NextResponse } from 'next/server';

// Social features removed in game overhaul - focusing on core idle mechanics
export async function POST(request: NextRequest) {
  return NextResponse.json({ error: 'Social features not available' }, { status: 501 });
}
