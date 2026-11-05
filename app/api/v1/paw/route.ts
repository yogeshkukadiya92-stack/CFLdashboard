import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getAppState, isDbEnabled } from '@/lib/db';
import { pawExport } from '@/lib/paw-export';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const hash = (value: string) => createHash('sha256').update(value).digest();
export async function GET(request: Request) {
  const key = process.env.CFL_PAW_API_KEY || '';
  const supplied = (request.headers.get('authorization') || '').replace(/^Bearer /, '');
  if (key.length < 32 || !timingSafeEqual(hash(key), hash(supplied))) return NextResponse.json({ error: 'Invalid PAW integration key.' }, { status: 401 });
  if (!(await isDbEnabled())) return NextResponse.json({ error: 'Database unavailable.' }, { status: 503 });
  try {
    const state = await getAppState();
    if (!state) throw new Error('Missing state');
    const feed = pawExport(state, (process.env.PAW_WORKSHOP_IDS || '').split(',').map(id => id.trim()).filter(Boolean));
    return NextResponse.json(feed, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'Could not read PAW registrations.' }, { status: 503 });
  }
}
