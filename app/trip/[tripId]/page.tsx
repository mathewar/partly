'use client';

import { use, useCallback, useEffect, useRef, useState } from 'react';

interface Participant { id: string; pseudonym: string; created_at: string; }
interface Expense {
  id: string; description: string; amount: number;
  paid_by: string; paid_by_name: string; expense_date: string | null; created_at: string;
}
interface Settlement { from: string; fromName: string; to: string; toName: string; amount: number; }
interface Trip {
  id: string; name: string | null; start_date: string | null;
  end_date: string | null; created_at: string; expires_at: string;
}
interface TripData { trip: Trip; participants: Participant[]; expenses: Expense[]; settlement: Settlement[]; }
interface UndoAction { label: string; fn: () => Promise<void>; }

// Index 0 = "you", 1–4 = others in join order
const PALETTE = [
  { pill: 'bg-stone-800 text-white border-stone-800',           tag: 'text-stone-700 font-medium' },
  { pill: 'bg-blue-100 text-blue-800 border-blue-200',          tag: 'text-blue-600 font-medium' },
  { pill: 'bg-emerald-100 text-emerald-800 border-emerald-200', tag: 'text-emerald-600 font-medium' },
  { pill: 'bg-violet-100 text-violet-800 border-violet-200',    tag: 'text-violet-600 font-medium' },
  { pill: 'bg-amber-100 text-amber-800 border-amber-200',       tag: 'text-amber-600 font-medium' },
];

const INPUT    = 'w-full border border-stone-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-400 placeholder:text-stone-400';
const INPUT_SM = 'w-full border border-stone-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-400';

function today() { return new Date().toISOString().slice(0, 10); }

function fmtDate(d: string | null) {
  if (!d) return '';
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function TripPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = use(params);

  const [data,     setData]     = useState<TripData | null>(null);
  const [myId,     setMyId]     = useState<string | null>(null);
  const [myName,   setMyName]   = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [joining,  setJoining]  = useState(false);

  // Add expense
  const [desc,          setDesc]          = useState('');
  const [amount,        setAmount]        = useState('');
  const [paidBy,        setPaidBy]        = useState('');
  const [expenseDate,   setExpenseDate]   = useState(today);
  const [addingExpense, setAddingExpense] = useState(false);

  // Edit expense
  const [editingId,  setEditingId]  = useState<string | null>(null);
  const [editDesc,   setEditDesc]   = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editPaidBy, setEditPaidBy] = useState('');
  const [editDate,   setEditDate]   = useState('');

  // Trip meta
  const [editingMeta, setEditingMeta] = useState(false);
  const [tripName,    setTripName]    = useState('');
  const [startDate,   setStartDate]   = useState('');
  const [endDate,     setEndDate]     = useState('');

  // Rename
  const [renamingName, setRenamingName] = useState('');
  const [renaming,     setRenaming]     = useState(false);
  const [renameError,  setRenameError]  = useState('');

  // Undo
  const [undoAction,  setUndoAction]  = useState<UndoAction | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Copy
  const [copied, setCopied] = useState(false);

  // Add person (on behalf of someone else)
  const [addingPerson, setAddingPerson] = useState(false);

  const loadData = useCallback(async () => {
    const res = await fetch(`/api/trips/${tripId}`);
    if (res.status === 404) { setNotFound(true); return; }
    const json = await res.json() as TripData;
    setData(json);
    if (!editingMeta) {
      setTripName(json.trip.name ?? '');
      setStartDate(json.trip.start_date ?? '');
      setEndDate(json.trip.end_date ?? '');
    }
  }, [tripId, editingMeta]);

  useEffect(() => {
    const stored = localStorage.getItem(`partly_${tripId}`);
    if (stored) {
      const p = JSON.parse(stored) as { participantId: string; pseudonym: string };
      setMyId(p.participantId); setMyName(p.pseudonym); setPaidBy(p.participantId);
    }
    loadData();
  }, [tripId, loadData]);

  useEffect(() => () => { if (undoTimerRef.current) clearTimeout(undoTimerRef.current); }, []);

  function pushUndo(label: string, fn: () => Promise<void>) {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoAction({ label, fn });
    undoTimerRef.current = setTimeout(() => { setUndoAction(null); undoTimerRef.current = null; }, 5000);
  }

  async function handleUndo() {
    if (!undoAction) return;
    if (undoTimerRef.current) { clearTimeout(undoTimerRef.current); undoTimerRef.current = null; }
    const fn = undoAction.fn; setUndoAction(null);
    await fn(); await loadData();
  }

  async function joinTrip() {
    setJoining(true);
    const res = await fetch(`/api/participants/${tripId}`, { method: 'POST' });
    if (!res.ok) { alert((await res.json() as { error: string }).error); setJoining(false); return; }
    const j = await res.json() as { participantId: string; pseudonym: string };
    localStorage.setItem(`partly_${tripId}`, JSON.stringify({ participantId: j.participantId, pseudonym: j.pseudonym }));
    setMyId(j.participantId); setMyName(j.pseudonym); setPaidBy(j.participantId);
    await loadData(); setJoining(false);
  }

  async function addPerson() {
    setAddingPerson(true);
    const res = await fetch(`/api/participants/${tripId}`, { method: 'POST' });
    if (!res.ok) { alert((await res.json() as { error: string }).error); setAddingPerson(false); return; }
    await loadData(); setAddingPerson(false);
  }

  async function addExpense(e: React.FormEvent) {
    e.preventDefault();
    if (!desc.trim() || !amount || !paidBy) return;
    setAddingExpense(true);
    await fetch(`/api/expenses/${tripId}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: desc.trim(), amount: parseFloat(amount), paid_by: paidBy, expense_date: expenseDate }),
    });
    setDesc(''); setAmount(''); setExpenseDate(today());
    await loadData(); setAddingExpense(false);
  }

  function startEdit(expense: Expense) {
    setEditingId(expense.id); setEditDesc(expense.description);
    setEditAmount(String(expense.amount)); setEditPaidBy(expense.paid_by);
    setEditDate(expense.expense_date ?? today());
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    const expId = editingId; if (!expId) return;
    const old = data?.expenses.find(x => x.id === expId); if (!old) return;
    const { description: od, amount: oa, paid_by: op, expense_date: odt } = old;
    await fetch(`/api/expenses/${tripId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: expId, description: editDesc, amount: parseFloat(editAmount), paid_by: editPaidBy, expense_date: editDate }),
    });
    setEditingId(null); await loadData();
    pushUndo('Expense updated', async () => {
      await fetch(`/api/expenses/${tripId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: expId, description: od, amount: oa, paid_by: op, expense_date: odt }),
      });
    });
  }

  async function deleteExpense(id: string) {
    const exp = data?.expenses.find(e => e.id === id); if (!exp) return;
    const { description, amount, paid_by, expense_date } = exp;
    await fetch(`/api/expenses/${tripId}?id=${id}`, { method: 'DELETE' });
    await loadData();
    pushUndo('Expense removed', async () => {
      await fetch(`/api/expenses/${tripId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, amount, paid_by, expense_date }),
      });
    });
  }

  async function renameSelf(e: React.FormEvent) {
    e.preventDefault(); if (!myId || !renamingName.trim()) return;
    setRenaming(true); setRenameError('');
    const res = await fetch(`/api/participants/${tripId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantId: myId, pseudonym: renamingName.trim() }),
    });
    if (!res.ok) { setRenameError((await res.json() as { error: string }).error); setRenaming(false); return; }
    const j = await res.json() as { pseudonym: string };
    setMyName(j.pseudonym);
    localStorage.setItem(`partly_${tripId}`, JSON.stringify({ participantId: myId, pseudonym: j.pseudonym }));
    setRenamingName(''); await loadData(); setRenaming(false);
  }

  async function saveMeta() {
    await fetch(`/api/trips/${tripId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: tripName || null, start_date: startDate || null, end_date: endDate || null }),
    });
    setEditingMeta(false); await loadData();
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  // ── Early returns ──────────────────────────────────────────────────────────

  if (notFound) return (
    <main className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
      <div className="text-center space-y-3">
        <h1 className="text-2xl font-bold text-stone-800">Trip not found</h1>
        <p className="text-stone-500">This trip may have expired or never existed.</p>
        <a href="/" className="inline-block text-sm text-stone-600 underline">Start a new trip</a>
      </div>
    </main>
  );

  if (!data) return (
    <main className="min-h-screen bg-stone-50 flex items-center justify-center">
      <p className="text-stone-400 text-sm">Loading…</p>
    </main>
  );

  const { trip, participants, expenses, settlement } = data;
  const total     = expenses.reduce((s, e) => s + e.amount, 0);
  const perPerson = participants.length > 0 ? total / participants.length : 0;
  const isParticipant = myId && participants.some(p => p.id === myId);
  const canJoin       = !isParticipant && participants.length < 5;

  // Stable color map: "you" = index 0, others in join order
  const colorIdx: Record<string, number> = {};
  let ci = 1;
  for (const p of participants) colorIdx[p.id] = p.id === myId ? 0 : ci++;
  const color = (id: string) => PALETTE[Math.min(colorIdx[id] ?? 0, PALETTE.length - 1)];

  // ── Sub-components (inline) ─────────────────────────────────────────────────

  const Header = (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div className="min-w-0 flex-1">
        <a href="/" className="text-xs text-stone-400 hover:text-stone-600 transition-colors">← partly</a>
        {editingMeta ? (
          <div className="mt-2 space-y-2">
            <input className={INPUT} placeholder="Trip name (optional)" value={tripName}
              onChange={e => setTripName(e.target.value)} autoFocus />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-stone-400 mb-1">Start</p>
                <input type="date" className={INPUT_SM} value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div>
                <p className="text-xs text-stone-400 mb-1">End</p>
                <input type="date" className={INPUT_SM} value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2 pt-0.5">
              <button onClick={saveMeta} className="bg-stone-800 text-white text-sm px-4 py-2 rounded-lg hover:bg-stone-700 transition-colors">Save</button>
              <button onClick={() => setEditingMeta(false)} className="text-stone-500 text-sm px-3 py-2 rounded-lg hover:bg-stone-100 transition-colors">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="mt-1">
            <h1 className="text-2xl font-bold text-stone-900 leading-tight">
              {trip.name || <span className="font-normal text-stone-400">Unnamed trip</span>}
            </h1>
            {(trip.start_date || trip.end_date) ? (
              <p className="text-sm text-stone-500 mt-0.5">
                {trip.start_date && fmtDate(trip.start_date)}
                {trip.start_date && trip.end_date && ' – '}
                {trip.end_date && fmtDate(trip.end_date)}
              </p>
            ) : (
              <button onClick={() => setEditingMeta(true)} className="text-xs text-stone-400 hover:text-stone-600 mt-0.5 transition-colors">
                + add dates
              </button>
            )}
          </div>
        )}
      </div>
      {!editingMeta && (
        <div className="flex gap-1.5 shrink-0 mt-6">
          <button onClick={() => setEditingMeta(true)}
            className="text-xs text-stone-500 border border-stone-200 rounded-lg px-2.5 py-1.5 hover:bg-stone-100 transition-colors">
            Edit
          </button>
          <button onClick={copyLink}
            className={`text-xs rounded-lg px-2.5 py-1.5 font-medium transition-colors ${copied ? 'bg-green-600 text-white' : 'bg-stone-800 text-white hover:bg-stone-700'}`}>
            {copied ? '✓ Copied' : 'Copy link'}
          </button>
        </div>
      )}
    </div>
  );

  const IdentityCard = (
    <div className="bg-white border border-stone-200 rounded-xl px-4 py-3">
      {isParticipant ? (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold shrink-0 ${color(myId!).pill}`}>{myName}</span>
              <span className="text-sm text-stone-400">that&apos;s you</span>
            </div>
            <button onClick={() => { setRenamingName(myName ?? ''); setRenameError(''); }}
              className="text-xs text-stone-400 hover:text-stone-600 underline transition-colors shrink-0">
              rename
            </button>
          </div>
          {renamingName !== '' && (
            <form onSubmit={renameSelf} className="space-y-1.5">
              <div className="flex gap-2">
                <input className={`${INPUT_SM} flex-1`} value={renamingName}
                  onChange={e => { setRenamingName(e.target.value); setRenameError(''); }}
                  maxLength={50} autoFocus />
                <button type="submit" disabled={renaming || !renamingName.trim()}
                  className="bg-stone-800 text-white text-sm px-3 py-2 rounded-lg hover:bg-stone-700 disabled:opacity-50 transition-colors shrink-0">
                  {renaming ? '…' : 'Save'}
                </button>
                <button type="button" onClick={() => { setRenamingName(''); setRenameError(''); }}
                  className="text-stone-400 text-sm px-2 hover:text-stone-600 transition-colors shrink-0">Cancel</button>
              </div>
              {renameError && <p className="text-xs text-red-500">{renameError}</p>}
            </form>
          )}
        </div>
      ) : canJoin ? (
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-stone-800">Join this trip</p>
            <p className="text-xs text-stone-400 mt-0.5">You&apos;ll get a name you can rename</p>
          </div>
          <button onClick={joinTrip} disabled={joining}
            className="bg-stone-800 text-white text-sm px-4 py-2 rounded-lg hover:bg-stone-700 disabled:opacity-50 transition-colors shrink-0">
            {joining ? 'Joining…' : 'Join trip'}
          </button>
        </div>
      ) : (
        <p className="text-sm text-stone-500">This trip is full (5 people max).</p>
      )}
    </div>
  );

  const PeopleCard = (
    <div className="bg-white border border-stone-200 rounded-xl px-4 py-3">
      <div className="flex items-center justify-between mb-2.5">
        <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
          People <span className="normal-case font-normal">({participants.length}/5)</span>
        </p>
        {participants.length < 5 && (
          <button onClick={addPerson} disabled={addingPerson}
            className="text-xs text-stone-500 hover:text-stone-800 disabled:opacity-50 transition-colors">
            {addingPerson ? 'Adding…' : '+ Add person'}
          </button>
        )}
      </div>
      {participants.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {participants.map(p => (
            <span key={p.id} className={`text-xs px-2.5 py-1 rounded-full border font-medium ${color(p.id).pill}`}>
              {p.pseudonym}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-stone-400">No one has joined yet.</p>
      )}
    </div>
  );

  const SettlementCard = settlement.length > 0 && (
    <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-stone-100 bg-stone-50">
        <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Who pays whom</p>
      </div>
      <div className="divide-y divide-stone-100">
        {settlement.map((s, i) => {
          const myDebt   = s.from === myId;
          const myCredit = s.to   === myId;
          return (
            <div key={i} className={`flex items-center justify-between px-4 py-3 gap-3 ${myDebt ? 'bg-amber-50' : myCredit ? 'bg-green-50' : ''}`}>
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold shrink-0 ${color(s.from).pill}`}>{s.fromName}</span>
                <span className="text-xs text-stone-500 shrink-0">owes</span>
                <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold shrink-0 ${color(s.to).pill}`}>{s.toName}</span>
              </div>
              <span className={`text-lg font-bold tabular-nums shrink-0 ${myDebt ? 'text-amber-700' : myCredit ? 'text-green-700' : 'text-stone-800'}`}>
                ${s.amount.toFixed(2)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );

  const AddExpenseForm = isParticipant && (
    <form onSubmit={addExpense} className="bg-white border border-stone-200 rounded-xl p-4 space-y-2.5">
      <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Add expense</p>
      <input className={INPUT} placeholder="What was it? (e.g. Dinner, taxi, hotel…)"
        value={desc} onChange={e => setDesc(e.target.value)} required />
      <div className="grid grid-cols-2 gap-2">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm pointer-events-none">$</span>
          <input className={`${INPUT_SM} pl-6`} placeholder="0.00" type="number" step="0.01"
            value={amount} onChange={e => setAmount(e.target.value)} required />
        </div>
        <input type="date" className={INPUT_SM} value={expenseDate} onChange={e => setExpenseDate(e.target.value)} />
      </div>
      <select className={INPUT_SM} value={paidBy} onChange={e => setPaidBy(e.target.value)} required>
        <option value="">Who paid?</option>
        {participants.map(p => <option key={p.id} value={p.id}>{p.pseudonym}</option>)}
      </select>
      <button type="submit" disabled={addingExpense}
        className="w-full bg-stone-800 hover:bg-stone-700 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50 text-sm">
        {addingExpense ? 'Adding…' : 'Add expense'}
      </button>
    </form>
  );

  const ExpensesList = expenses.length > 0 && (
    <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 bg-stone-50">
        <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Expenses</p>
        <div className="text-xs text-stone-500">
          <span className="font-semibold text-stone-700">${total.toFixed(2)}</span>
          {participants.length > 1 && (
            <span className="text-stone-400"> · ${perPerson.toFixed(2)}/person</span>
          )}
        </div>
      </div>
      {expenses.map((expense, i) => (
        <div key={expense.id} className={i < expenses.length - 1 ? 'border-b border-stone-100' : ''}>
          {editingId === expense.id ? (
            <form onSubmit={saveEdit} className="p-3 space-y-2 bg-stone-50 border-l-2 border-stone-300">
              <input className={INPUT} value={editDesc} onChange={e => setEditDesc(e.target.value)} required autoFocus />
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm pointer-events-none">$</span>
                  <input className={`${INPUT_SM} pl-6`} type="number" step="0.01"
                    value={editAmount} onChange={e => setEditAmount(e.target.value)} required />
                </div>
                <input type="date" className={INPUT_SM} value={editDate} onChange={e => setEditDate(e.target.value)} />
              </div>
              <select className={INPUT_SM} value={editPaidBy} onChange={e => setEditPaidBy(e.target.value)} required>
                {participants.map(p => <option key={p.id} value={p.id}>{p.pseudonym}</option>)}
              </select>
              <div className="flex gap-2 pt-0.5">
                <button type="submit" className="bg-stone-800 text-white text-xs px-4 py-1.5 rounded-lg hover:bg-stone-700 transition-colors font-medium">Save</button>
                <button type="button" onClick={() => setEditingId(null)} className="text-stone-500 text-xs px-3 py-1.5 rounded-lg hover:bg-stone-200 transition-colors">Cancel</button>
              </div>
            </form>
          ) : (
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-stone-800 font-medium leading-snug truncate">{expense.description}</p>
                <p className="text-xs mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                  <span className={color(expense.paid_by).tag}>{expense.paid_by_name}</span>
                  {expense.expense_date && <span className="text-stone-400">{fmtDate(expense.expense_date)}</span>}
                  {isParticipant && (
                    <>
                      <span className="text-stone-300">·</span>
                      <button onClick={() => startEdit(expense)}
                        className="text-stone-400 hover:text-stone-700 transition-colors">edit</button>
                      <button onClick={() => deleteExpense(expense.id)}
                        className="text-stone-400 hover:text-red-500 transition-colors">remove</button>
                    </>
                  )}
                </p>
              </div>
              <span className={`text-sm font-semibold tabular-nums shrink-0 ${expense.amount < 0 ? 'text-red-500' : 'text-stone-800'}`}>
                {expense.amount < 0 ? '−' : ''}${Math.abs(expense.amount).toFixed(2)}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-stone-50">
      <div className="max-w-5xl mx-auto px-4 pt-6 pb-28">

        {Header}

        {/*
          Layout:
          mobile  — single column, natural order
          lg+     — 2 columns: [left: add+expenses] [right sticky: identity+people+settlement]
          The right-panel items use order-first on mobile so identity appears above the form.
        */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_260px] xl:grid-cols-[1fr_320px] gap-3 items-start">

          {/* Right panel — appears first on mobile, right column on md+ */}
          <div className="space-y-3 md:col-start-2 md:row-start-1 md:sticky md:top-6">
            {IdentityCard}
            {PeopleCard}
            {SettlementCard}
          </div>

          {/* Left panel — add form + expenses */}
          <div className="space-y-3 md:col-start-1 md:row-start-1">
            {AddExpenseForm}
            {ExpensesList}
            {expenses.length === 0 && participants.length > 0 && isParticipant && (
              <div className="text-center py-10 text-stone-400 text-sm">
                No expenses yet — add the first one above.
              </div>
            )}
          </div>

        </div>

        <p className="text-center text-xs text-stone-300 mt-6">
          Anyone with this link can view and edit · expires {new Date(trip.expires_at).toLocaleDateString()}
        </p>
      </div>

      {/* Undo toast */}
      {undoAction && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-stone-900 text-white text-sm px-5 py-3 rounded-2xl shadow-xl whitespace-nowrap">
          <span className="text-stone-300">{undoAction.label}</span>
          <button onClick={handleUndo} className="font-semibold text-white hover:text-stone-300 transition-colors">Undo</button>
        </div>
      )}
    </main>
  );
}
