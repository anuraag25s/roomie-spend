# Postmortem: What Broke & What I Learned

This document reflects on the challenges faced while shipping this MVP.

---

## What Went Wrong

### 1. Deployment complexity
- Docker lifecycle issues
- Postinstall scripts failing
- Build order dependencies breaking silently

### 2. Overconfidence in “happy paths”
- Assumed receipt formats would be consistent
- Learned that online receipts vary wildly

### 3. UI edge cases
- Text contrast issues
- Emoji selectors behaving unexpectedly
- Dark mode assumptions without explicit support

---

## What I Learned

- Shipping is harder than prototyping
- Real-world data is messy
- Deployment is a product problem, not just engineering
- Clear scoping prevents death by features
- Debugging under pressure builds product intuition fast

---

## What I’d Do Differently

- Validate deployment earlier
- Lock scope even tighter
- Add explicit rollback plans
- Treat infra as part of product delivery

---

## Why This Matters

This experience mirrors real PM work:
- Ambiguity
- Constraints
- Tradeoffs
- User expectations vs reality

Shipping imperfectly taught more than endless planning.
