# Product Decisions & Tradeoffs

This document captures **intentional decisions** made during development.

---

## Decision: Grocery-only focus

**Why**
- Groceries are high-frequency and emotionally sensitive
- Splitwise-style apps become noisy when overloaded

**Tradeoff**
- Smaller scope
- Clearer value

---

## Decision: Receipt-first logging

**Why**
- Manual entry does not scale
- Receipts are the source of truth

**Tradeoff**
- OCR complexity
- Edge cases with bad images

---

## Decision: Equal tax distribution

**Why**
- Simple mental model
- Avoids item-level tax disputes

**Tradeoff**
- Not perfectly accurate, but fair enough

---

## Decision: No chores or schedules (for now)

**Why**
- Different problem domain
- Would dilute product focus

**Tradeoff**
- Some users may ask for it
- Explicitly saying “no” keeps the product sharp

---

## Decision: AI / No-Code Approach

**Why**
- Speed to learning > perfect architecture
- Product judgment matters more than implementation detail

**Tradeoff**
- Less control over internals
- Acceptable for MVP
