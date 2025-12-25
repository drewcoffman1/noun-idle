import { NextRequest, NextResponse } from 'next/server';

// In production, this would be managed by an admin panel or scheduled tasks
// For now, we'll return any active events

const EVENTS = [
  {
    id: 'happy_hour',
    name: 'Happy Hour',
    description: '2x production for 2 hours!',
    multiplier: 2,
    duration: 2 * 60 * 60 * 1000, // 2 hours
  },
  {
    id: 'coffee_rush',
    name: 'Coffee Rush',
    description: '3x production for 1 hour!',
    multiplier: 3,
    duration: 1 * 60 * 60 * 1000, // 1 hour
  },
  {
    id: 'weekend_bonus',
    name: 'Weekend Bonus',
    description: '1.5x production all weekend!',
    multiplier: 1.5,
    duration: 48 * 60 * 60 * 1000, // 48 hours
  },
];

export async function GET(request: NextRequest) {
  try {
    // Check if there's an active event
    // In production, you'd check a database or Redis for active events
    // For now, we'll randomly activate events on weekends

    const now = new Date();
    const isWeekend = now.getDay() === 0 || now.getDay() === 6;

    if (isWeekend) {
      const event = EVENTS[2]; // Weekend bonus
      return NextResponse.json({
        event: {
          ...event,
          startTime: now.setHours(0, 0, 0, 0), // Start of day
          endTime: now.setHours(0, 0, 0, 0) + event.duration,
        },
      });
    }

    // Check for hourly events (10% chance each hour)
    const hourOfDay = now.getHours();
    if (hourOfDay % 4 === 0 && Math.random() < 0.1) {
      const event = EVENTS[0]; // Happy hour
      return NextResponse.json({
        event: {
          ...event,
          startTime: Date.now(),
          endTime: Date.now() + event.duration,
        },
      });
    }

    return NextResponse.json({ event: null });
  } catch (error) {
    console.error('Error fetching events:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
