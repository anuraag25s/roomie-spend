import assert from "node:assert/strict";
import test from "node:test";
import { categorize, mergeReceipts, parseReceiptText } from "./receipt.mjs";

const sample = `
INDIAN GROCERIES
123 Market St
Onion 2 lb                 1.98
Tomato 1.5 lb              2.47
Cilantro                   0.88
Spinach                    3.49
Chicken Breast             8.99
Milk 1 gal                 3.29
Yogurt                     1.99
Subtotal                  23.09
Tax                        1.87
Total                     24.96
`;

test("pulls line items and tax out of receipt text", () => {
  const parsed = parseReceiptText(sample);
  assert.equal(parsed.store, "Indian Groceries");
  assert.equal(parsed.taxCents, 187);
  assert.deepEqual(
    parsed.items.map((item) => [item.name, item.category, item.priceCents]),
    [
      ["Onion", "Produce", 198],
      ["Tomato", "Produce", 247],
      ["Cilantro", "Produce", 88],
      ["Spinach", "Produce", 349],
      ["Chicken Breast", "Meat", 899],
      ["Milk", "Dairy", 329],
      ["Yogurt", "Dairy", 199],
    ],
  );
});

test("cleans pound weights when OCR reads lb as Ib", () => {
  const parsed = parseReceiptText("Onion 2 Ib 1.98\nTomato 1.5 Ib 2.47\n");
  assert.deepEqual(parsed.items.map((item) => item.name), ["Onion", "Tomato"]);
});

test("ignores payment noise and comma decimals", () => {
  const parsed = parseReceiptText("VISA 4111\nChips 5,00\nSALES TAX 0.40\nCASH 5.40\n");
  assert.equal(parsed.items.length, 1);
  assert.equal(parsed.items[0].name, "Chips");
  assert.equal(parsed.items[0].category, "Snacks");
  assert.equal(parsed.items[0].priceCents, 500);
  assert.equal(parsed.taxCents, 40);
});

test("merges several receipt screenshots", () => {
  const merged = mergeReceipts([
    parseReceiptText("Store A\nRice 4.00\nTax 0.10"),
    parseReceiptText("Beans 2.50\nTax 0.05"),
  ]);
  assert.equal(merged.store, "Store A");
  assert.equal(merged.items.length, 2);
  assert.equal(merged.taxCents, 15);
  assert.equal(categorize("Basmati Rice"), "Staples");
});
