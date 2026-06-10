# Paper materials

This folder contains the manuscript and figures for the Field Campaign Tracker
journal article. **It is not part of the application** and is not deployed; it is
kept here only for convenience.

| File | Purpose |
|------|---------|
| `MANUSCRIPT_MEE.md` | Master manuscript source (Markdown) |
| `MANUSCRIPT_MEE.docx` | Clean reading copy (Word) |
| `MANUSCRIPT_MEE_submission.docx` | Double-spaced, line-numbered copy for submission |
| `MEE_CODE_CHECKLIST.md` | Methods in Ecology and Evolution code checklist (upload as "File for editors") |
| `figures/` | Figure sources (`make_figures.py`) and exports (PNG + PDF) |
| `build_docx.cjs` | Converts the Markdown manuscript to the two `.docx` files |

## Rebuilding the Word documents

```bash
cd paper
npm install            # installs the docx library (separate from the app)
npm run build:docx             # -> MANUSCRIPT_MEE.docx
npm run build:docx:submission  # -> MANUSCRIPT_MEE_submission.docx
```

## Regenerating the figures

```bash
cd paper/figures
python make_figures.py   # requires matplotlib, numpy, Pillow
```
