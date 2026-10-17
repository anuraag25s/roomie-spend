import {
  CATEGORIES,
  balances,
  categoryTotals,
  expenseShares,
  expenseTotalCents,
  inMonth,
  settlementPlan,
} from "./calc.mjs";
import { mergeReceipts, parseReceiptText } from "./receipt.mjs";

const STORAGE_KEY = "roomiespend-v1";
const root = document.querySelector("#app");

function iso(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function todayISO() {
  return iso(new Date());
}

function yesterdayISO() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return iso(date);
}

function sampleState() {
  return {
    activeId: "home",
    households: [
      {
        id: "home",
        name: "Home",
        members: [
          { id: "jo", name: "Jo", color: "#1f8a4c" },
          { id: "rs", name: "RS", color: "#2563eb" },
          { id: "pooj", name: "Pooj", color: "#7c3aed" },
          { id: "sai", name: "Sai", color: "#d97706" },
          { id: "jen", name: "Jen", color: "#db2777" },
        ],
        budgets: {
          Produce: 4000,
          Meat: 3500,
          Dairy: 2000,
          Snacks: 1500,
          Staples: 2500,
          Other: 2000,
        },
        expenses: [
          {
            id: "exp-groceries",
            description: "Indian Groceries",
            payerId: "jo",
            date: todayISO(),
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
          },
          {
            id: "exp-market",
            description: "Corner market",
            payerId: "rs",
            date: todayISO(),
            taxCents: 0,
            items: [
              { id: "i8", name: "Bananas", category: "Produce", priceCents: 179, assigneeIds: null },
              { id: "i9", name: "Eggs", category: "Dairy", priceCents: 179, assigneeIds: null },
            ],
          },
          {
            id: "exp-snacks",
            description: "Snacks",
            payerId: "jen",
            date: yesterdayISO(),
            taxCents: 0,
            items: [
              { id: "i10", name: "Chips", category: "Snacks", priceCents: 500, assigneeIds: ["jen"] },
            ],
          },
        ],
        settlements: [],
      },
    ],
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved?.households?.length) return saved;
  } catch {
    /* use the sample household */
  }
  return sampleState();
}

let state = loadState();

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function household() {
  return state.households.find((entry) => entry.id === state.activeId) || state.households[0];
}

function member(id) {
  return household().members.find((entry) => entry.id === id);
}

function money(cents) {
  const sign = cents < 0 ? "-" : "";
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}

function monthLabel(date = new Date()) {
  return date.toLocaleString("en-US", { month: "long", year: "numeric" });
}

function when(dateString) {
  if (dateString === todayISO()) return "Today";
  if (dateString === yesterdayISO()) return "Yesterday";
  const date = new Date(`${dateString}T00:00:00`);
  return date.toLocaleString("en-US", { month: "short", day: "numeric" });
}

function monthExpenses(home = household()) {
  const now = new Date();
  return home.expenses.filter((expense) => inMonth(expense.date, now.getFullYear(), now.getMonth()));
}

function route() {
  const hash = location.hash.replace(/^#/, "") || "/";
  const expense = hash.match(/^\/expense\/([^/]+)$/);
  if (expense) return { name: "expense", id: decodeURIComponent(expense[1]) };
  if (hash === "/log") return { name: "log" };
  if (hash === "/budgets") return { name: "budgets" };
  if (hash === "/settle") return { name: "settle" };
  return { name: "dashboard" };
}

function flatten(children) {
  const out = [];
  for (const child of [].concat(children)) {
    if (Array.isArray(child)) out.push(...flatten(child));
    else out.push(child);
  }
  return out;
}

function h(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2).toLowerCase(), value);
    else node.setAttribute(key, String(value));
  }
  for (const child of flatten(children)) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

function avatar(person, small = false) {
  const initials = person.name.slice(0, 2).toUpperCase();
  return h("span", { class: small ? "avatar sm" : "avatar", style: `background:${person.color}` }, [initials]);
}

function shell(view) {
  const current = route().name === "expense" ? "dashboard" : route().name;
  const links = [
    ["/", "Dashboard"],
    ["/log", "Log Expense"],
    ["/budgets", "Budgets"],
    ["/settle", "Settle Up"],
  ];
  const select = h(
    "select",
    {
      "aria-label": "Household",
      onchange: (event) => {
        state.activeId = event.target.value;
        save();
        render();
      },
    },
    state.households.map((entry) =>
      h("option", { value: entry.id, selected: entry.id === household().id }, [entry.name]),
    ),
  );
  return h("div", { class: "app" }, [
    h("header", { class: "top" }, [
      h("a", { class: "brand", href: "#/" }, [
        h("span", { class: "mark", html: false }, [
          h(
            "span",
            {},
            [],
          ),
        ]),
        "RoomieSpend",
      ]),
      h(
        "nav",
        { class: "nav" },
        links.map(([href, label]) =>
          h("a", { href: `#${href}`, class: current === href.slice(1) || (href === "/" && current === "dashboard") ? "active" : "" }, [label]),
        ),
      ),
      h("div", { class: "account" }, [
        select,
        avatar(member("rs") || household().members[0]),
      ]),
    ]),
    h("main", { class: "page" }, [view]),
  ]);
}

function brandMark() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "18");
  svg.setAttribute("height", "18");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "white");
  svg.setAttribute("stroke-width", "2");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-8.5Z");
  svg.append(path);
  return svg;
}

function dashboard() {
  const home = household();
  const expenses = monthExpenses(home).slice().sort((a, b) => b.date.localeCompare(a.date));
  const spent = expenses.reduce((sum, expense) => sum + expenseTotalCents(expense), 0);
  const nets = balances(home);
  const categories = categoryTotals(expenses, home.members);
  const ranked = Object.entries(categories).filter(([, cents]) => cents > 0).sort((a, b) => b[1] - a[1]);
  const max = ranked[0]?.[1] || 1;
  return h("section", {}, [
    h("div", { class: "page-head" }, [
      h("div", {}, [h("h1", {}, ["Dashboard"]), h("div", { class: "sub" }, [monthLabel()])]),
      h("div", { class: "actions" }, [
        h("a", { class: "primary", href: "#/log" }, ["Scan receipt"]),
        h("button", { class: "ghost", onclick: restoreSample }, ["Restore sample"]),
      ]),
    ]),
    h("div", { class: "grid" }, [
      h("div", { class: "stack" }, [
        h("section", { class: "card" }, [
          h("h2", {}, ["Total grocery spend"]),
          h("div", { class: "total" }, [money(spent), h("span", {}, ["this month"])]),
        ]),
        h("section", { class: "card" }, [
          h("h2", {}, ["Recent activity"]),
          expenses.length
            ? expenses.map((expense) =>
                h("button", { class: "activity", onclick: () => { location.hash = `#/expense/${expense.id}`; } }, [
                  avatar(member(expense.payerId), true),
                  h("div", { class: "grow" }, [
                    h("div", { class: "name" }, [expense.description]),
                    h("div", { class: "meta" }, [`${when(expense.date)} · ${member(expense.payerId).name} paid`]),
                  ]),
                  h("strong", {}, [money(expenseTotalCents(expense))]),
                ]),
              )
            : h("div", { class: "empty" }, ["No expenses this month. Log a grocery run to see it here."]),
        ]),
      ]),
      h("div", { class: "stack" }, [
        h("section", { class: "card" }, [
          h("h2", {}, ["Balance summary"]),
          home.members.map((person) => {
            const cents = nets[person.id] || 0;
            const label = cents > 0 ? "is owed" : cents < 0 ? "owes" : "settled";
            return h("div", { class: "person" }, [
              avatar(person, true),
              h("div", { class: "grow" }, [h("div", { class: "name" }, [person.name]), h("div", { class: "meta" }, [label])]),
              h("div", { class: cents > 0 ? "owed" : cents < 0 ? "owes" : "meta" }, [money(Math.abs(cents))]),
            ]);
          }),
        ]),
        h("section", { class: "card" }, [
          h("h2", {}, ["Spending by category"]),
          ranked.length
            ? ranked.map(([category, cents]) =>
                h("div", {}, [
                  h("div", { class: "cat" }, [category, money(cents)]),
                  h("div", { class: "bar" }, [h("span", { style: `width:${Math.max(8, (cents / max) * 100)}%` })]),
                ]),
              )
            : h("div", { class: "empty" }, ["Categories appear after the first expense."]),
        ]),
      ]),
    ]),
  ]);
}

function expenseDetail(id) {
  const home = household();
  const expense = home.expenses.find((entry) => entry.id === id);
  if (!expense) return h("section", {}, [h("h1", {}, ["Expense not found"]), h("a", { href: "#/" }, ["Back to dashboard"])]);
  const shares = expenseShares(expense, home.members);
  const taxes = expense.taxCents || 0;
  return h("section", {}, [
    h("div", { class: "page-head" }, [
      h("div", {}, [
        h("h1", {}, [expense.description]),
        h("div", { class: "sub" }, [`${when(expense.date)} · Paid by ${member(expense.payerId).name}`]),
      ]),
      h("div", { class: "actions" }, [
        h("a", { class: "ghost", href: "#/" }, ["Back"]),
        h("button", { class: "danger", onclick: () => removeExpense(expense.id) }, ["Delete"]),
      ]),
    ]),
    h("div", { class: "grid" }, [
      h("section", { class: "card" }, [
        h("h2", {}, ["Items"]),
        itemTable(expense, home, true),
        h("p", { class: "note" }, [
          taxes
            ? `Tax of ${money(taxes)} is split equally across ${expense.items.length} items, then each item is split by who uses it.`
            : "No tax on this expense.",
        ]),
      ]),
      h("section", { class: "card" }, [
        h("h2", {}, ["Each person's share"]),
        h("div", { class: "total" }, [money(expenseTotalCents(expense))]),
        home.members.map((person) =>
          h("div", { class: "split-line" }, [h("span", {}, [person.name]), h("strong", {}, [money(shares[person.id] || 0)])]),
        ),
      ]),
    ]),
  ]);
}

function itemTable(expense, home, readonly) {
  const head = h("tr", {}, ["Item", "Category", "Price", "Used by"].map((label) => h("th", {}, [label])));
  const rows = expense.items.map((item) => {
    const who = item.assigneeIds?.length === 1 ? member(item.assigneeIds[0])?.name || "Personal" : "Shared";
    return h("tr", {}, [
      h("td", {}, [item.name]),
      h("td", {}, [item.category]),
      h("td", {}, [money(item.priceCents)]),
      h("td", {}, [who]),
    ]);
  });
  return h("table", {}, [h("thead", {}, [head]), h("tbody", {}, rows), readonly ? null : null]);
}

function blankItem() {
  return { id: crypto.randomUUID(), name: "", category: "Produce", price: "", assignee: "shared" };
}

let draft = null;
let formError = "";

function freshDraft() {
  const home = household();
  draft = {
    description: "",
    payerId: home.members[0].id,
    date: todayISO(),
    tax: "",
    items: [blankItem()],
  };
  formError = "";
}

function draftExpense() {
  return {
    id: "draft",
    description: draft.description.trim() || "Expense",
    payerId: draft.payerId,
    date: draft.date,
    taxCents: Math.round((Number(draft.tax) || 0) * 100),
    items: draft.items
      .filter((item) => item.name.trim() && Number(item.price) > 0)
      .map((item) => ({
        id: item.id,
        name: item.name.trim(),
        category: item.category,
        priceCents: Math.round(Number(item.price) * 100),
        assigneeIds: item.assignee === "shared" ? null : [item.assignee],
      })),
  };
}

function previewCard() {
  const home = household();
  const preview = draftExpense();
  const shares = preview.items.length ? expenseShares(preview, home.members) : null;
  return h("section", { class: "card preview" }, [
    h("h2", {}, ["Split preview"]),
    h("div", { class: "split-line" }, [h("span", {}, ["Subtotal"]), h("strong", {}, [money(preview.items.reduce((sum, item) => sum + item.priceCents, 0))])]),
    h("div", { class: "split-line" }, [h("span", {}, ["Tax, split equally"]), h("strong", {}, [money(preview.taxCents)])]),
    h("div", { class: "split-line" }, [h("span", {}, ["Total"]), h("strong", {}, [money(expenseTotalCents(preview))])]),
    shares
      ? home.members.map((person) => h("div", { class: "split-line" }, [h("span", {}, [person.name]), h("span", {}, [money(shares[person.id] || 0)])]))
      : h("p", { class: "note" }, ["Add an item with a name and price to see each roommate's share."]),
  ]);
}

function updatePreview() {
  document.querySelector(".preview")?.replaceWith(previewCard());
}

let scanStatus = "";
let scanError = "";
let scanning = false;
let workerPromise = null;

function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const tesseract = await import("https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.esm.min.js");
      const createWorker = tesseract.default.createWorker;
      const cores = [
        "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core-simd-lstm.wasm.js",
        "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core-lstm.wasm.js",
      ];
      let lastError;
      for (const corePath of cores) {
        try {
          return await createWorker("eng", 1, {
            workerPath: "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js",
            corePath,
            langPath: "https://tessdata.projectnaptha.com/4.0.0",
          });
        } catch (error) {
          lastError = error;
        }
      }
      workerPromise = null;
      throw lastError;
    })();
  }
  return workerPromise;
}

function applyReceipt(parsed) {
  if (!draft) freshDraft();
  if (!draft.description.trim()) draft.description = parsed.store || "Receipt";
  draft.tax = (parsed.taxCents / 100).toFixed(2);
  draft.items = parsed.items.map((item) => ({
    id: crypto.randomUUID(),
    name: item.name,
    category: item.category,
    price: (item.priceCents / 100).toFixed(2),
    assignee: "shared",
  }));
  formError = "";
}

async function onReceiptFiles(event) {
  const files = [...(event.target.files || [])];
  event.target.value = "";
  if (!files.length || scanning) return;
  scanning = true;
  scanError = "";
  const parts = [];
  try {
    const worker = await getWorker();
    for (let index = 0; index < files.length; index += 1) {
      scanStatus = `Reading photo ${index + 1} of ${files.length}…`;
      render();
      const result = await worker.recognize(files[index]);
      parts.push(parseReceiptText(result.data?.text || ""));
    }
  } catch (error) {
    console.error(error);
    scanError = "Couldn't read that photo. Try a brighter, straighter picture.";
    scanStatus = "";
    scanning = false;
    render();
    return;
  }
  const parsed = mergeReceipts(parts);
  scanning = false;
  if (!parsed.items.length) {
    scanError = "No line items found. Try a closer photo of the item list.";
    scanStatus = "";
    render();
    return;
  }
  applyReceipt(parsed);
  scanStatus = `Found ${parsed.items.length} item${parsed.items.length === 1 ? "" : "s"}. Check them, then save.`;
  scanError = "";
  render();
}

function scanCard() {
  const photos = h("input", {
    type: "file",
    accept: "image/*",
    multiple: true,
    hidden: true,
    onchange: onReceiptFiles,
  });
  const camera = h("input", {
    type: "file",
    accept: "image/*",
    capture: "environment",
    hidden: true,
    onchange: onReceiptFiles,
  });
  return h("section", { class: "card scan" }, [
    h("h2", {}, ["Scan a receipt"]),
    h("p", { class: "note" }, ["Click a photo or add screenshots of a long receipt. Line items and tax are filled in for you to review."]),
    scanStatus ? h("p", { class: "status", role: "status" }, [scanStatus]) : null,
    scanError ? h("div", { class: "alert", role: "alert" }, [scanError]) : null,
    h("div", { class: "actions" }, [
      h("button", { type: "button", class: "primary", disabled: scanning, onclick: () => photos.click() }, ["Scan receipt photo"]),
      h("button", { type: "button", class: "ghost", disabled: scanning, onclick: () => camera.click() }, ["Take photo"]),
    ]),
    photos,
    camera,
  ]);
}

function logForm() {
  if (!draft) freshDraft();
  const home = household();
  const assignmentOptions = (selected) => [
    h("option", { value: "shared", selected: selected === "shared" }, ["Shared"]),
    ...home.members.map((person) => h("option", { value: person.id, selected: selected === person.id }, [person.name])),
  ];
  return h("section", {}, [
    h("div", { class: "page-head" }, [
      h("div", {}, [h("h1", {}, ["Log expense"]), h("div", { class: "sub" }, ["Scan a receipt photo, or add items yourself."])]),
    ]),
    scanCard(),
    h("div", { class: "grid" }, [
      h("form", { class: "card form", onsubmit: saveDraft }, [
        formError ? h("div", { class: "alert", role: "alert" }, [formError]) : null,
        h("div", { class: "fields" }, [
          h("label", { class: "field" }, ["Description", h("input", { required: true, value: draft.description, oninput: (event) => { draft.description = event.target.value; } })]),
          h("label", { class: "field" }, ["Paid by", h("select", { onchange: (event) => { draft.payerId = event.target.value; render(); } }, home.members.map((person) => h("option", { value: person.id, selected: person.id === draft.payerId }, [person.name])))]),
          h("label", { class: "field" }, ["Date", h("input", { type: "date", value: draft.date, oninput: (event) => { draft.date = event.target.value; } })]),
          h("label", { class: "field" }, ["Tax", h("input", { inputmode: "decimal", placeholder: "0.00", value: draft.tax, oninput: (event) => { draft.tax = event.target.value; updatePreview(); } })]),
        ]),
        h("table", {}, [
          h("thead", {}, [h("tr", {}, ["Item", "Category", "Price", "Used by"].map((label) => h("th", {}, [label])))]),
          h("tbody", {}, draft.items.map((item, index) => h("tr", {}, [
            h("td", {}, [h("input", { "aria-label": "Item name", value: item.name, oninput: (event) => { item.name = event.target.value; updatePreview(); } })]),
            h("td", {}, [h("select", { "aria-label": "Category", onchange: (event) => { item.category = event.target.value; render(); } }, CATEGORIES.map((category) => h("option", { value: category, selected: category === item.category }, [category])))]),
            h("td", {}, [h("input", { "aria-label": "Price", inputmode: "decimal", placeholder: "0.00", value: item.price, oninput: (event) => { item.price = event.target.value; updatePreview(); } })]),
            h("td", {}, [h("select", { "aria-label": "Used by", onchange: (event) => { item.assignee = event.target.value; render(); } }, assignmentOptions(item.assignee))]),
          ]))),
        ]),
        h("div", { class: "actions" }, [
          h("button", { type: "button", class: "ghost", onclick: () => { draft.items.push(blankItem()); render(); } }, ["Add item"]),
          h("button", { type: "submit", class: "primary" }, ["Save expense"]),
        ]),
      ]),
      previewCard(),
    ]),
  ]);
}

function saveDraft(event) {
  event.preventDefault();
  const expense = draftExpense();
  if (!draft.description.trim()) {
    formError = "Add a description.";
    render();
    return;
  }
  if (!expense.items.length) {
    formError = "Add at least one item with a name and price.";
    render();
    return;
  }
  expense.id = crypto.randomUUID();
  expense.description = draft.description.trim();
  household().expenses.push(expense);
  save();
  draft = null;
  location.hash = `#/expense/${expense.id}`;
}

function budgets() {
  const home = household();
  const spent = categoryTotals(monthExpenses(home), home.members);
  return h("section", {}, [
    h("div", { class: "page-head" }, [
      h("div", {}, [h("h1", {}, ["Budgets"]), h("div", { class: "sub" }, [`${monthLabel()} grocery budgets for ${home.name}`])]),
    ]),
    h("section", { class: "card" }, CATEGORIES.map((category) => {
      const used = spent[category] || 0;
      const budget = home.budgets[category] || 0;
      const ratio = budget > 0 ? Math.min(100, (used / budget) * 100) : used > 0 ? 100 : 0;
      return h("div", { class: "budget-row" }, [
        h("div", { class: "grow" }, [
          h("div", { class: "cat" }, [category, `${money(used)} of ${money(budget)}`]),
          h("div", { class: `bar${used > budget && budget > 0 ? " over" : ""}` }, [h("span", { style: `width:${ratio}%` })]),
        ]),
        h("input", {
          "aria-label": `${category} budget`,
          inputmode: "decimal",
          value: (budget / 100).toFixed(2),
          onchange: (event) => {
            const next = Math.round((Number(event.target.value) || 0) * 100);
            home.budgets[category] = Math.max(0, next);
            save();
            render();
          },
        }),
      ]);
    })),
  ]);
}

function settle() {
  const home = household();
  const nets = balances(home);
  const plan = settlementPlan(nets);
  return h("section", {}, [
    h("div", { class: "page-head" }, [
      h("div", {}, [h("h1", {}, ["Settle up"]), h("div", { class: "sub" }, ["Record a payment and the balances update for everyone."])]),
    ]),
    h("section", { class: "card" }, [
      h("h2", {}, ["Suggested payments"]),
      plan.length
        ? plan.map((payment) => h("div", { class: "plan" }, [
            avatar(member(payment.fromId), true),
            h("div", { class: "grow" }, [
              h("div", { class: "name" }, [`${member(payment.fromId).name} pays ${member(payment.toId).name}`]),
              h("div", { class: "meta" }, [money(payment.amountCents)]),
            ]),
            h("button", { class: "primary", onclick: () => recordSettlement(payment) }, ["Record payment"]),
          ]))
        : h("div", { class: "empty" }, ["Everyone is settled."]),
    ]),
    h("section", { class: "card" }, [
      h("h2", {}, ["Recorded payments"]),
      home.settlements.length
        ? home.settlements.slice().reverse().map((payment) => h("div", { class: "person" }, [
            h("div", { class: "grow" }, [
              h("div", { class: "name" }, [`${member(payment.fromId).name} paid ${member(payment.toId).name}`]),
              h("div", { class: "meta" }, [when(payment.date)]),
            ]),
            h("strong", {}, [money(payment.amountCents)]),
          ]))
        : h("div", { class: "empty" }, ["No payments recorded yet."]),
    ]),
  ]);
}

function recordSettlement(payment) {
  household().settlements.push({
    id: crypto.randomUUID(),
    fromId: payment.fromId,
    toId: payment.toId,
    amountCents: payment.amountCents,
    date: todayISO(),
  });
  save();
  render();
}

function removeExpense(id) {
  const home = household();
  home.expenses = home.expenses.filter((expense) => expense.id !== id);
  save();
  location.hash = "#/";
  render();
}

function restoreSample() {
  state = sampleState();
  save();
  draft = null;
  location.hash = "#/";
  render();
}

function render() {
  const current = route();
  let view;
  if (current.name === "log") view = logForm();
  else if (current.name === "budgets") view = budgets();
  else if (current.name === "settle") view = settle();
  else if (current.name === "expense") view = expenseDetail(current.id);
  else view = dashboard();
  const page = shell(view);
  const mark = page.querySelector(".mark");
  mark.replaceChildren(brandMark());
  root.replaceChildren(page);
}

window.addEventListener("hashchange", render);
render();
