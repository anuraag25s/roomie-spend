const ITEM_LINE = /^(.{2,80}?)\s+\$?\s*(\d{1,4})[.,](\d{2})\s*[A-Za-z]?\s*$/;

const SKIP = /^(sub\s*total|subtotal|grand\s*total|total|balance|change due|change|cash|visa|mastercard|amex|american express|debit|credit|payment|tender|auth|approval|invoice|receipt|thank|welcome|tel|phone|www|http|card|account|ref|cashier|date|time|item|qty|taxable)\b/i;

const TAX = /\b(sales\s*tax|tax|hst|gst|pst|vat)\b/i;

const CATEGORY_RULES = [
  ["Produce", /\b(onion|tomato|spinach|cilantro|banana|apple|lettuce|potato|garlic|ginger|pepper|herb|kale|carrot|fruit|veg|produce|lime|lemon|cilantro|coriander|chili|chilli)\b/],
  ["Meat", /\b(chicken|beef|meat|pork|fish|shrimp|lamb|turkey|mutton)\b/],
  ["Dairy", /\b(milk|yogurt|yoghurt|cheese|dairy|egg|eggs|butter|cream|paneer)\b/],
  ["Snacks", /\b(chip|chips|snack|cookie|candy|soda|cola|juice|coke|namkeen)\b/],
  ["Staples", /\b(rice|flour|oil|bean|beans|lentil|dal|atta|spice|salt|sugar|pasta|bread|wheat|ghee)\b/],
];

export function categorize(name) {
  const value = name.toLowerCase();
  for (const [category, pattern] of CATEGORY_RULES) {
    if (pattern.test(value)) return category;
  }
  return "Other";
}

function titleCase(value) {
  return value.toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

export function cleanItemName(raw) {
  const stripped = raw
    .replace(/[^A-Za-z0-9 &.'/-]/g, " ")
    .replace(/\b\d+(\.\d+)?\s*(lb|lbs|ib|oz|gal|pk|ct|kg|g)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return titleCase(stripped);
}

export function parseReceiptText(text) {
  const lines = String(text)
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  let store = "";
  let taxCents = 0;
  const items = [];
  for (const line of lines) {
    const match = line.match(ITEM_LINE);
    if (!match) {
      if (!store && /^[A-Za-z][A-Za-z0-9 '&.,-]{2,40}$/.test(line)) store = titleCase(line);
      continue;
    }
    const name = cleanItemName(match[1]);
    const cents = Number(match[2]) * 100 + Number(match[3]);
    if (!name || cents <= 0) continue;
    if (TAX.test(name)) {
      taxCents += cents;
      continue;
    }
    if (SKIP.test(name)) continue;
    items.push({ name, category: categorize(name), priceCents: cents });
  }
  return { store, taxCents, items };
}

export function mergeReceipts(parts) {
  return {
    store: parts.find((part) => part.store)?.store || "",
    taxCents: parts.reduce((sum, part) => sum + part.taxCents, 0),
    items: parts.flatMap((part) => part.items),
  };
}
