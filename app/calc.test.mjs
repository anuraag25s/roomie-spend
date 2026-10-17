import assert from "node:assert/strict";
import test from "node:test";
import {
  balances,
  categoryTotals,
  expenseShares,
  expenseTotalCents,
  settlementPlan,
} from "./calc.mjs";

const members = [
  { id: "jo", name: "Jo" },
  { id: "rs", name: "RS" },
  { id: "pooj", name: "Pooj" },
  { id: "sai", name: "Sai" },
  { id: "jen", name: "Jen" },
];

const receipt = {
  id: "exp-groceries",
  description: "Indian Groceries",
  payerId: "jo",
  date: "2026-10-17",
  taxCents: 187,
  items: [
    { id: "i1", name: "Onion", category: "Produce", priceCents: 198, assigneeIds: null },
    { id: "i2", name: "Tomato", category: "Produce", priceCents: 247, assigneeIds: null },
    { id: "i3", name: "Cilantro", category: "Produce", priceCents: 88, assigneeIds: null },
    { id: "i4", name: "Spinach", category: "Produce", priceCents: 349, assigneeIds: ["rs"] },
    { id: "i5", name: "Chicken Breast", category: "Meat", priceCents: 899, assigneeIds: null },
    { id: "i6", name: "Milk", category: "Dairy", priceCents: 329, assigneeIds: null },
    { id: "i7", name: "Yogurt", category: "Dairy", priceCents: 199, assigneeIds: ["pooj"] },
  ],
};

test("receipt total includes equal tax", () => {
  assert.equal(expenseTotalCents(receipt), 2496);
});

test("item shares sum to the receipt total", () => {
  const shares = expenseShares(receipt, members);
  const sum = Object.values(shares).reduce((total, cents) => total + cents, 0);
  assert.equal(sum, 2496);
  assert.ok(shares.rs > shares.sai, "RS pays for personal spinach");
  assert.ok(shares.pooj > shares.sai, "Pooj pays for personal yogurt");
  assert.ok(Math.abs(shares.sai - shares.jen) <= 1);
});

test("balances net to zero and credit the payer", () => {
  const household = { members, expenses: [receipt], settlements: [] };
  const nets = balances(household);
  const sum = Object.values(nets).reduce((total, cents) => total + cents, 0);
  assert.equal(sum, 0);
  assert.ok(nets.jo > 0);
  assert.ok(nets.rs < 0);
});

test("a recorded settlement reduces what the payer is owed", () => {
  const household = {
    members,
    expenses: [receipt],
    settlements: [{ id: "s1", fromId: "sai", toId: "jo", amountCents: 100, date: "2026-10-17" }],
  };
  const before = balances({ members, expenses: [receipt], settlements: [] });
  const after = balances(household);
  assert.equal(after.jo, before.jo - 100);
  assert.equal(after.sai, before.sai + 100);
});

test("settlement plan clears the balances", () => {
  const household = { members, expenses: [receipt], settlements: [] };
  const nets = balances(household);
  const plan = settlementPlan(nets);
  const settled = {
    ...household,
    settlements: plan.map((payment, index) => ({ ...payment, id: `p${index}`, date: "2026-10-17" })),
  };
  const after = balances(settled);
  for (const cents of Object.values(after)) assert.equal(cents, 0);
});

test("category totals include each item's tax share", () => {
  const totals = categoryTotals([receipt], members);
  const sum = Object.values(totals).reduce((total, cents) => total + cents, 0);
  assert.equal(sum, 2496);
  assert.ok(totals.Meat > totals.Dairy);
});
