import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { generatePseudonym } from '@/lib/pseudonyms';
import { v4 as uuidv4 } from 'uuid';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params;
  const db = getDb();

  const trip = db.prepare(`SELECT * FROM trips WHERE id = ?`).get(tripId);
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const existing = db.prepare(
    `SELECT pseudonym FROM participants WHERE trip_id = ?`
  ).all(tripId) as { pseudonym: string }[];

  if (existing.length >= 5) {
    return NextResponse.json({ error: 'Trip is full (max 5 people)' }, { status: 400 });
  }

  const existingNames = existing.map(p => p.pseudonym);
  const pseudonym = generatePseudonym(existingNames);
  const participantId = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO participants (id, trip_id, pseudonym, created_at)
    VALUES (?, ?, ?, ?)
  `).run(participantId, tripId, pseudonym, now);

  return NextResponse.json({ participantId, pseudonym });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params;
  const db = getDb();

  const body = await req.json() as { participantId: string; pseudonym: string };
  if (!body.participantId || !body.pseudonym?.trim()) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const name = body.pseudonym.trim().slice(0, 50);

  const existing = db.prepare(
    `SELECT id FROM participants WHERE trip_id = ? AND pseudonym = ? AND id != ?`
  ).get(tripId, name, body.participantId);
  if (existing) {
    return NextResponse.json({ error: 'That name is already taken' }, { status: 400 });
  }

  const result = db.prepare(
    `UPDATE participants SET pseudonym = ? WHERE id = ? AND trip_id = ?`
  ).run(name, body.participantId, tripId);

  if (result.changes === 0) {
    return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
  }

  return NextResponse.json({ pseudonym: name });
}
