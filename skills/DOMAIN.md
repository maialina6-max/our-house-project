
# DOMAIN.md — Israeli Moshav Land Purchase & Home Building

## What This Project Is About
A couple is purchasing a plot (מגרש) in an Israeli moshav and building a house on it.
This is a long, multi-stage process involving legal, financial, and bureaucratic steps
specific to Israel. This file gives Claude the domain knowledge needed to answer
questions intelligently without the user having to explain context every time.

## Key Entities

**מושב** — A cooperative agricultural community. Land in a moshav is often
owned by רשות מקרקעי ישראל (RMI / ממ"י) and leased, not sold outright.
This affects the legal structure of the purchase significantly.

**רשות מקרקעי ישראל (ממ"י / RMI)** — Israel Land Authority. Owns most land
in Israel. The buyer often leases the land from ממ"י rather than purchasing
it in full ownership (בעלות מלאה). Lease agreements (חוזה חכירה) must be
registered.

**ועדת קבלה** — Admissions committee of the moshav. Must approve new residents
before purchase can proceed. A legal but sometimes controversial step.

**תב"ע (תכנית בניין עיר)** — Local zoning/building plan. Defines what can be
built on the plot: max floor area (שטח עיקרי), height, setbacks (קווי בניין),
permitted uses. Always check the relevant תב"ע before asking about build limits.

**היתר בנייה** — Building permit issued by the local planning committee
(ועדה מקומית לתכנון ובנייה). Required before any construction begins.
Based on the תב"ע. May take months to obtain.

**אחוזי בנייה** — Building coverage ratio. Defines what % of the plot area
can be built on. Common values: 20–30% for moshav residential plots.

**שטח עיקרי** — Main floor area (counts toward the permit).
**שטח שירות** — Service area (storage, stairwells — partial count or exempt).
**מרפסת** — Balcony/porch — may or may not count depending on תב"ע.

---

## Typical Process Stages

1. **איתור מגרש** — Finding the plot, initial checks (תב"ע, zoning, ממ"י status)
2. **ועדת קבלה** — Admissions committee approval (can take weeks to months)
3. **בדיקת נאותות** — Due diligence: lawyer review, land registry (טאבו), soil check
4. **חתימת חוזה** — Signing purchase/lease agreement
5. **תשלום מס רכישה** — Purchase tax paid to the Israeli Tax Authority (רשות המיסים)
   within 60 days of signing. Rate depends on property value and buyer status.
6. **רישום בטאבו** — Registration in the Land Registry (לשכת רישום מקרקעין)
7. **תכנון אדריכלי** — Architectural planning, schematic and detailed drawings
8. **הגשת בקשה להיתר** — Submitting building permit application to local committee
9. **קבלת היתר בנייה** — Receiving the building permit (can take 6–18 months)
10. **בנייה** — Construction
11. **טופס 4** — Occupancy permit. Issued when construction meets permit conditions.
    Required before connecting utilities (electricity, water).
12. **טופס 5 / אכלוס** — Final sign-off, legal occupancy begins.

---

## Key Financial Concepts

**מס רכישה (Purchase Tax)**
Paid by the buyer to רשות המיסים. Calculated as % of purchase price.
For a single residential property (first home), reduced rates apply on a sliding scale.
Must be paid within 60 days of the transaction date.

**היטל השבחה (Betterment Levy)**
Paid by the seller (sometimes negotiated). Charged when a planning change
(תב"ע amendment) increases land value. Check if applicable before purchase.

**דמי היוון / דמי רכישה (Capitalization Fees)**
Paid to ממ"י when converting a lease to full ownership, or when changing
land use. Can be significant — tens of thousands of shekels.

**שכר טרחת עורך דין** — Lawyer fees. Typically 0.5–1.5% of transaction value
for real estate transactions, plus VAT.

**שמאות (Appraisal)** — Required by banks for mortgage, and sometimes by ממ"י.
Conducted by a licensed שמאי מקרקעין.

---

## Common Questions Users Will Ask

- "How much can I build?" → Check תב"ע documents for אחוזי בנייה and שטח עיקרי
- "How much have I spent so far?" → Summarize expenses by category from logged data
- "Have I paid purchase tax?" → Check expenses for מס רכישה entry
- "What stage are we at?" → Infer from documents and expenses what has been completed
- "What do I still need to do?" → Compare completed stages against the 12-step process above
- "What does X document mean?" → Use domain knowledge above to explain in plain Hebrew

---

## Important Notes for Claude

- Always answer in Hebrew unless asked otherwise
- When answering about build limits, always caveat: "לפי המסמכים שהועלו"
- Never give legal or tax advice — always recommend consulting the project's lawyer
- Amounts are always in Israeli Shekels (₪)
- Dates follow Israeli format: DD/MM/YYYY
- The users are a couple (זוג) — address them in plural when relevant
