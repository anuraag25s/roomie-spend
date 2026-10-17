export const CATEGORIES = ["Produce", "Meat", "Dairy", "Snacks", "Staples", "Other"];

export function expenseItemSum(expense) {
  return expense.items.reduce((sum, item) => sum + item.priceCents, 0);
}

export function expenseTotalCents(expense) {
  return expenseItemSum(expense) + (expense.taxCents || 0);
}

export function itemTaxShares(expense) {
  const count = expense.items.length;
  if (count === 0) return [];
  const tax = expense.taxCents || 0;
  const base = Math.floor(tax / count);
  let remainder = tax - base * count;
  return expense.items.map(() => {
    const share = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
    return share;
  });
}

export function assigneeIds(item, members) {
  if (item.assigneeIds && item.assigneeIds.length > 0) return item.assigneeIds;
  return members.map((member) => member.id);
}

function splitCents(total, ids) {
  const shares = {};
  if (ids.length === 0) return shares;
  const base = Math.floor(total / ids.length);
  let remainder = total - base * ids.length;
  for (const id of ids) {
    shares[id] = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
  }
  return shares;
}

export function expenseShares(expense, members) {
  const taxes = itemTaxShares(expense);
  const totals = Object.fromEntries(members.map((member) => [member.id, 0]));
  expense.items.forEach((item, index) => {
    const ids = assigneeIds(item, members);
    const shares = splitCents(item.priceCents + taxes[index], ids);
    for (const [id, cents] of Object.entries(shares)) {
      totals[id] = (totals[id] || 0) + cents;
    }
  });
  return totals;
}

export function categoryTotals(expenses, members) {
  const totals = Object.fromEntries(CATEGORIES.map((category) => [category, 0]));
  for (const expense of expenses) {
    const taxes = itemTaxShares(expense);
    expense.items.forEach((item, index) => {
      const category = totals[item.category] === undefined ? "Other" : item.category;
      totals[category] += item.priceCents + taxes[index];
    });
  }
  return totals;
}

export function balances(household, expenses = household.expenses) {
  const totals = Object.fromEntries(household.members.map((member) => [member.id, 0]));
  for (const expense of expenses) {
    const shares = expenseShares(expense, household.members);
    totals[expense.payerId] = (totals[expense.payerId] || 0) + expenseTotalCents(expense);
    for (const [id, cents] of Object.entries(shares)) {
      totals[id] = (totals[id] || 0) - cents;
    }
  }
  for (const settlement of household.settlements || []) {
    totals[settlement.fromId] = (totals[settlement.fromId] || 0) + settlement.amountCents;
    totals[settlement.toId] = (totals[settlement.toId] || 0) - settlement.amountCents;
  }
  return totals;
}

export function settlementPlan(balanceMap) {
  const debtors = [];
  const creditors = [];
  for (const [id, cents] of Object.entries(balanceMap)) {
    if (cents < 0) debtors.push({ id, cents: -cents });
    else if (cents > 0) creditors.push({ id, cents });
  }
  debtors.sort((a, b) => b.cents - a.cents);
  creditors.sort((a, b) => b.cents - a.cents);
  const plan = [];
  let debtorIndex = 0;
  let creditorIndex = 0;
  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const amount = Math.min(debtors[debtorIndex].cents, creditors[creditorIndex].cents);
    if (amount > 0) {
      plan.push({
        fromId: debtors[debtorIndex].id,
        toId: creditors[creditorIndex].id,
        amountCents: amount,
      });
    }
    debtors[debtorIndex].cents -= amount;
    creditors[creditorIndex].cents -= amount;
    if (debtors[debtorIndex].cents === 0) debtorIndex += 1;
    if (creditors[creditorIndex].cents === 0) creditorIndex += 1;
  }
  return plan;
}

export function inMonth(dateString, year, monthIndex) {
  const date = new Date(`${dateString}T00:00:00`);
  return date.getFullYear() === year && date.getMonth() === monthIndex;
}
