import { NextRequest, NextResponse } from 'next/server';
import { getDb, cleanupExpiredTrips } from '@/lib/db';
import { calculateSettlement } from '@/lib/settlement';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  cleanupExpiredTrips();
  const { tripId } = await params;
  const db = getDb();

  const trip = db.prepare(`SELECT * FROM trips WHERE id = ?`).get(tripId) as {
    id: string; name: string | null; start_date: string | null;
    end_date: string | null; created_at: string; expires_at: string;
  } | undefined;

  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const participants = db.prepare(
    `SELECT * FROM participants WHERE trip_id = ? ORDER BY created_at`
  ).all(tripId) as { id: string; pseudonym: string; created_at: string }[];

  const expenses = db.prepare(
    `SELECT e.*, p.pseudonym as paid_by_name
     FROM expenses e
     JOIN participants p ON e.paid_by = p.id
     WHERE e.trip_id = ?
     ORDER BY COALESCE(e.expense_date, date(e.created_at)), e.created_at`
  ).all(tripId) as {
    id: string; description: string; amount: number;
    paid_by: string; paid_by_name: string; expense_date: string | null; created_at: string;
  }[];

  const settlement = calculateSettlement(participants, expenses);

  return NextResponse.json({ trip, participants, expenses, settlement });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params;
  const db = getDb();
  const trip = db.prepare(`SELECT * FROM trips WHERE id = ?`).get(tripId);
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json() as { name?: string; start_date?: string; end_date?: string };

  db.prepare(`
    UPDATE trips SET
      name = COALESCE(?, name),
      start_date = ?,
      end_date = ?
    WHERE id = ?
  `).run(
    body.name ?? null,
    body.start_date ?? null,
    body.end_date ?? null,
    tripId
  );

  return NextResponse.json({ ok: true });
}
