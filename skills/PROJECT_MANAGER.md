# PROJECT_MANAGER.md — Bayit BaMoshav Project Manager Skill

## Project Identity
**Project name:** Bayit BaMoshav  
**Type:** Personal web application — not a product, not a startup  
**Users:** A couple (two people) managing a real, ongoing land purchase and home
building process in an Israeli moshav  
**Language:** Hebrew (RTL) throughout — UI, AI responses, all user-facing text  
**Status:** Early stage — land not yet purchased, process is ongoing  

---

## The Users

- A couple going through a complex, first-time experience
- Not developers — the app must be intuitive with zero learning curve
- Will use the app on desktop (primary) and mobile (secondary)
- Have both digital documents (PDF) and physical documents they scan
- Want to feel in control of a process that has many moving parts and professionals
  involved (lawyer, architect, appraiser, etc.)
- Key frustration: information is scattered across emails, WhatsApp messages,
  physical folders, and memory

---

## Core Problem Being Solved

The home building process in a moshav involves:
- Dozens of documents from different sources
- Many payments to many parties over a long period
- Complex bureaucratic stages with dependencies
- Information that lives with professionals (lawyer, architect) — not with the couple
- Questions that arise at random times: "wait, did we already pay X?" / "what's the
  max we can build?"

The app centralizes everything and makes it queryable in plain Hebrew.

---

## Product Principles

1. **Simple over powerful** — if a feature adds complexity for most use cases,
   don't build it yet
2. **Hebrew first** — every label, placeholder, error message, and AI response
   in Hebrew
3. **Trust the data** — never show placeholder or fake data; only show what the
   user has actually entered
4. **Progressive disclosure** — start minimal, add features as the user needs them
5. **No friction for input** — adding an expense or uploading a document must take
   under 30 seconds

---

## Current Feature Status

| Feature | Status |
|---|---|
| Document upload (PDF + images) | ✅ Built |
| Manual expense entry | ✅ Built |
| AI chat over documents + expenses | ✅ Built |
| Data persistence (localStorage) | ✅ Built |
| Expense breakdown by category | ✅ Built |
| Metrics bar (totals) | ✅ Built |
| Expense editing and deletion | ✅ Built |
| Export expenses to CSV | ✅ Built |
| Document categories + filtering | ✅ Built |

---

## Prioritized Backlog

### P1 — Next to build
- ~~**Export expenses to CSV**~~ ✅ Done
- ~~**Document categories + filtering**~~ ✅ Done
- ~~**Expense editing and deletion**~~ ✅ Done

### P2 — Important but not urgent
- **Timeline / milestone tracker** — visual view of the 12 stages of the process,
  mark what's done
- **Web search integration** — let the AI search ממ"י, מינהל התכנון, and Israeli
  building regulation sites in real time when answering questions
- **Reminders / open tasks** — "haven't paid purchase tax yet", "permit application
  pending"
- **Document tagging** — tag each document as: היתר, חוזה, קבלה, מסמך רשמי, אחר

### P3 — Future / nice to have
- **Partner sync** — both members of the couple can add data from different devices
- **Backend + real database** — replace localStorage when data grows or sync needed
- **Mobile PWA** — installable on phone for quick expense entry on the go
- **Contractor management** — track quotes, contacts, payment schedules once
  construction begins
- **Photo log** — document construction progress with dated photos

---

## Feature Decision Framework

When the user asks "can we add X?", evaluate against:
1. Does it solve a real pain point in the moshav building process?
2. Can it be built without breaking existing functionality?
3. Is it simple enough to use without explanation?
4. Does it fit within the current tech stack (React + localStorage + Claude API)?

If yes to all four → build it.  
If no to #4 → note it as P3 and explain what would be needed.

---

## What Claude Should Do in This Role

When acting as project manager for this codebase:
- Always check current feature status before suggesting new work
- Suggest P1 items before P2 or P3
- When adding a feature, update this file's feature status table
- Keep the UI simple — resist the urge to add tabs, modals, or settings
  unless clearly needed
- When in doubt, ask: "would this make it easier for a non-technical Hebrew
  speaker to manage their home building project?"
- After completing any significant feature, update the relevant skill file

---

## Definition of Done (for any feature)

- Works in Hebrew with RTL layout
- Data persists in localStorage (or explicitly noted why not)
- No English visible to the user
- Mobile display is not broken
- The relevant skill file is updated
