import { NextResponse } from 'next/server';
import { getDb, cleanupExpiredTrips } from '@/lib/db';
import { generatePseudonym } from '@/lib/pseudonyms';
import { v4 as uuidv4 } from 'uuid';

export async function POST() {
  cleanupExpiredTrips();

  const db = getDb();
  const tripId = uuidv4();
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + 60);

  db.prepare(`
    INSERT INTO trips (id, name, start_date, end_date, created_at, expires_at)
    VALUES (?, NULL, NULL, NULL, ?, ?)
  `).run(tripId, now.toISOString(), expiresAt.toISOString());

  // Create first participant
  const participantId = uuidv4();
  const pseudonym = generatePseudonym([]);
  db.prepare(`
    INSERT INTO participants (id, trip_id, pseudonym, created_at)
    VALUES (?, ?, ?, ?)
  `).run(participantId, tripId, pseudonym, now.toISOString());

  return NextResponse.json({ tripId, participantId, pseudonym });
}
