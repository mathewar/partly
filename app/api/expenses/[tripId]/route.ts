import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params;
  const db = getDb();

  const trip = db.prepare(`SELECT * FROM trips WHERE id = ?`).get(tripId);
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json() as { description: string; amount: number; paid_by: string; expense_date?: string };

  if (!body.description || body.amount === undefined || body.amount === 0 || !body.paid_by) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const participant = db.prepare(
    `SELECT id FROM participants WHERE id = ? AND trip_id = ?`
  ).get(body.paid_by, tripId);

  if (!participant) {
    return NextResponse.json({ error: 'Invalid participant' }, { status: 400 });
  }

  const id = uuidv4();
  const now = new Date().toISOString();
  const expense_date = body.expense_date || now.slice(0, 10);

  db.prepare(`
    INSERT INTO expenses (id, trip_id, description, amount, paid_by, expense_date, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, tripId, body.description, body.amount, body.paid_by, expense_date, now);

  return NextResponse.json({ id });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params;
  const db = getDb();

  const body = await req.json() as { id: string; description: string; amount: number; paid_by: string; expense_date?: string };
  if (!body.id || !body.description || !body.amount || !body.paid_by) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const participant = db.prepare(
    `SELECT id FROM participants WHERE id = ? AND trip_id = ?`
  ).get(body.paid_by, tripId);
  if (!participant) return NextResponse.json({ error: 'Invalid participant' }, { status: 400 });

  const result = db.prepare(`
    UPDATE expenses SET description = ?, amount = ?, paid_by = ?, expense_date = ?
    WHERE id = ? AND trip_id = ?
  `).run(body.description, body.amount, body.paid_by, body.expense_date ?? null, body.id, tripId);

  if (result.changes === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params;
  const { searchParams } = new URL(req.url);
  const expenseId = searchParams.get('id');

  if (!expenseId) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const db = getDb();
  db.prepare(`DELETE FROM expenses WHERE id = ? AND trip_id = ?`).run(expenseId, tripId);

  return NextResponse.json({ ok: true });
}
