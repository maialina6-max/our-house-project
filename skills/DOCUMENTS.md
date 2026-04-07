---
# DOCUMENTS.md — Document Upload & Storage
---

## Purpose
Allows users to upload PDFs and images related to the house project (permits, contracts, receipts, plans) and store them locally in the browser for later retrieval and AI analysis.

---

## Key Decisions

### base64 in localStorage
Files are read with `FileReader.readAsDataURL()`, the `data:...;base64,` prefix is stripped, and the raw base64 string is stored in the `data` field of the document object.

This means:
- No server upload needed
- Files survive page refreshes
- Files are available for injection into Claude API calls

### Strip the data URI prefix
`FileReader.readAsDataURL()` returns `data:application/pdf;base64,ABCD...`. We strip everything up to and including the first comma: `dataUri.split(',')[1]`. This gives the raw base64 that Claude's API expects.

### Drag-and-drop + click-to-upload
The upload area handles both `onDrop` events and a hidden `<input type="file">` triggered by clicking the area label.

---

## Storage Schema

```js
{
  id: string,          // crypto.randomUUID()
  name: string,        // original filename
  type: string,        // MIME type
  category: string,    // user-selected category label
  size: number,        // bytes (original file size)
  uploadedAt: string,  // ISO timestamp
  data: string,        // base64 WITHOUT data URI prefix
}
```

## Categories
`'היתר בנייה' | 'חוזה' | 'קבלה' | 'מסמך רשמי' | 'תכנית' | 'אחר'`

---

## How to Extend

- **Category editing**: Add an `onUpdate(id, patch)` prop to `Documents.jsx` and an inline select next to each document row.
- **Document preview**: Add a "preview" button that constructs a blob URL from the base64 data: `URL.createObjectURL(new Blob([atob(doc.data)], { type: doc.type }))`.
- **File type filter**: Add a filter dropdown above the list that filters by category or MIME type.

---

## Gotchas

- `localStorage` total limit is ~5–10MB depending on browser. Large PDFs will quickly exhaust this. Advise users to keep files small (compress PDFs, resize images before uploading).
- `crypto.randomUUID()` requires HTTPS or localhost. In Vite dev server this is fine.
- The category selection at upload time is currently set to `'אחר'` as default — consider adding a category picker in the upload flow if users need better organization.
- Deleting a document is permanent (no undo). Consider adding a confirmation dialog.
