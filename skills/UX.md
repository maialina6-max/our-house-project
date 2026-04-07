# UX.md — User Experience Guidelines for Bayit BaMoshav

## Who We Are Designing For

A couple in their daily life — not sitting at a desk managing software,
but checking the app between meetings, from the phone in the car, or late
at night when a question comes up: "wait, did we already pay that?"

- Not technical users — no jargon, no settings they need to configure
- Hebrew is their primary language — every word in the UI must feel natural,
  not translated
- Emotionally invested — this is their home, not a work project. The app
  should feel calm and organized, not clinical or overwhelming
- Frequently context-switching — they may open the app for 2 minutes,
  add one expense, and close it

---

## Design Principles

### 1. Calm over busy
No dashboards packed with widgets. No color-coded everything.
The app should feel like a well-organized folder, not a control room.
When in doubt — remove an element, don't add one.

### 2. Hebrew feels native, not translated
- Use natural Hebrew phrasing: "הוסף הוצאה" not "submit expense"
- Error messages in human Hebrew: "שכחת להזין סכום" not "amount is required"
- Placeholder text that guides: "למשל: תשלום לעורך דין" not "enter description"
- Address the users in second person plural (אתם) when relevant

### 3. Input in under 30 seconds
Adding an expense or uploading a document must require minimal taps/clicks.
No multi-step wizards. No confirmation dialogs for routine actions.
The form is always visible — not hidden behind a button.

### 4. The AI should feel like a knowledgeable friend
Not a chatbot. Not a search engine.
When answering, Claude should sound like someone who knows the project
personally and gives a direct, helpful answer in plain Hebrew.
Avoid: "Based on the documents you uploaded, I can see that..."
Prefer: "לפי ההיתר שהעליתם, מותר לכם לבנות עד 160 מ״ר בקומה ראשונה."

### 5. Trust is earned through accuracy
Never show estimated, guessed, or placeholder data.
If there are no expenses yet — show an empty state, not zeros.
If a document wasn't uploaded — say so, don't hallucinate content.

### 6. Mobile is a real use case
The couple will often add an expense right after a payment — from their phone,
standing outside a lawyer's office. The expense form must work perfectly
on a small screen. Tap targets minimum 44px. No horizontal scrolling.

---

## Layout & Visual Language

**Direction:** RTL throughout — `direction: rtl`, `text-align: right` as default

**Colors:**
- Primary accent: `#1D9E75` (teal-green) — used for CTAs, active states, links
- Success/confirmation: same teal family
- Warning/attention: amber — `#BA7517`
- Destructive: red — only for delete actions
- Background: near-white surfaces, no pure white (#ffffff feels harsh)
- Text: near-black for primary, muted gray for secondary/metadata

**Typography:**
- System sans-serif — feels native on every device
- Two weights only: 400 (regular) and 500 (medium/bold)
- Never bold an entire sentence — bold is for labels and headings only
- Font sizes: 15px headings, 13px body, 11px metadata/labels

**Spacing:**
- Generous padding inside cards (not cramped)
- Clear visual separation between sections
- No decorative dividers — use whitespace instead where possible

**Borders & Cards:**
- Flat design — no drop shadows
- Thin borders: 0.5px, low opacity
- Rounded corners: 8px for elements, 12px for cards

---

## Component Guidelines

### Sidebar / Navigation
- 3 sections maximum at this stage: שאל את הבית, מסמכים, הוצאות
- Active state: soft green background, darker green text
- No icons that need a legend — label everything

### Expense Form
- Always visible at the bottom of the expenses panel — not in a modal
- Tab order follows RTL reading direction
- Date field defaults to today
- After submitting: clear the form immediately, show the new item at top of list
- Amount field: numbers only, ₪ prefix visible

### Document List
- Show: file name, date uploaded, type badge (PDF / תמונה)
- File name truncated with ellipsis if too long — never wraps to two lines
- Drag and drop zone always visible when list is short
- No preview on click (v1) — just confirmation it was uploaded

### Chat Interface
- Quick-question chips visible before first message — disappear after first send
- User messages: right-aligned, teal background, white text
- AI messages: left-aligned, light gray background, dark text
- Typing indicator: simple "חושב..." text — no animated dots needed
- Input field: wide, RTL, sends on Enter key
- Scroll to latest message automatically after each response

### Metrics Bar
- Always visible at top of chat panel
- Three numbers: total expenses (₪), documents count, expense items count
- Updates in real time — no refresh needed
- Labels in 11px muted text above each number

---

## Empty States

Every list must have a meaningful empty state — never just blank space.

| Panel | Empty state message |
|---|---|
| מסמכים | "עוד לא העליתם מסמכים. גררו קבצים לכאן או לחצו להעלאה." |
| הוצאות | "עוד לא נרשמו הוצאות. השתמשו בטופס למטה." |
| צ'אט | AI greeting message explaining what it can help with |

---

## Error States

- Upload failed: "לא הצלחנו להעלות את הקובץ. נסו שוב."
- AI error: "אירעה שגיאה בחיבור. נסו שוב."
- Missing form field: highlight the field with red border + inline message below it
- Never use alert() dialogs — always inline feedback

---

## Accessibility

- All interactive elements reachable by keyboard
- Minimum touch target: 44x44px on mobile
- Color is never the only indicator of state — always paired with text or shape
- Form labels always visible — never placeholder-only

---

## What Claude Should Do With This Skill

When making any UI change or building a new component:
1. Check this file before writing any CSS or JSX
2. Prefer removing complexity over adding it
3. Write all user-facing strings in natural Hebrew
4. Test mentally: "can someone add an expense in under 30 seconds?"
5. Test mentally: "does this work on a phone screen?"
6. After completing a component, verify it matches the empty state and
   error state guidelines above
