export interface Participant {
  id: string;
  pseudonym: string;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  paid_by: string;
  created_at: string;
}

export interface Settlement {
  from: string;
  fromName: string;
  to: string;
  toName: string;
  amount: number;
}

export function calculateSettlement(
  participants: Participant[],
  expenses: Expense[]
): Settlement[] {
  if (participants.length === 0 || expenses.length === 0) return [];

  const n = participants.length;
  const balance: Record<string, number> = {};
  for (const p of participants) balance[p.id] = 0;

  for (const expense of expenses) {
    const share = expense.amount / n;
    // Payer gets credit for the full amount
    balance[expense.paid_by] = (balance[expense.paid_by] ?? 0) + expense.amount;
    // Everyone owes their share
    for (const p of participants) {
      balance[p.id] = (balance[p.id] ?? 0) - share;
    }
  }

  // Simplify debts: positive balance = owed money, negative = owes money
  const creditors = participants
    .filter(p => balance[p.id] > 0.005)
    .map(p => ({ id: p.id, name: p.pseudonym, amount: balance[p.id] }))
    .sort((a, b) => b.amount - a.amount);

  const debtors = participants
    .filter(p => balance[p.id] < -0.005)
    .map(p => ({ id: p.id, name: p.pseudonym, amount: -balance[p.id] }))
    .sort((a, b) => b.amount - a.amount);

  const settlements: Settlement[] = [];
  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const credit = creditors[ci];
    const debt = debtors[di];
    const amount = Math.min(credit.amount, debt.amount);

    settlements.push({
      from: debt.id,
      fromName: debt.name,
      to: credit.id,
      toName: credit.name,
      amount: Math.round(amount * 100) / 100,
    });

    credit.amount -= amount;
    debt.amount -= amount;
    if (credit.amount < 0.005) ci++;
    if (debt.amount < 0.005) di++;
  }

  return settlements;
}
