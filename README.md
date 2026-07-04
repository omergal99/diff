# Diffinity 🔍

**Professional file comparison tool — free, open-source, self-hosted.**

A fast, clean alternative to Araxis Merge and Mergely, built with Vanilla JS and Python. No framework bloat, no subscription required.

---

## ✨ Features

| Feature | Status |
|---------|--------|
| Text / code side-by-side diff | ✅ MVP |
| Word-level highlighting in changed lines | ✅ MVP |
| Moved-line detection (blue colour) | ✅ MVP |
| JSON structural diff | ✅ MVP |
| SHA-256 early exit (instant for identical files) | ✅ MVP |
| Ignore whitespace / case / comments | ✅ MVP |
| Fold unchanged regions | ✅ MVP |
| Light / Dark / High-Contrast themes | ✅ MVP |
| RTL / LTR direction toggle | ✅ MVP |
| File open + drag-and-drop | ✅ MVP |
| Export diff as HTML or JSON | ✅ MVP |
| Unicode homograph detection | ✅ MVP |
| Archive (ZIP / TAR / TGZ) comparison | ✅ v1 |
| Image pixel diff + steganography detection | ✅ v1 |
| DOCX / XLSX / PDF text extraction + diff | ✅ v1 |
| Folder tree explorer view | ✅ v1 |
| Search with regex + history | ✅ v1 |
| Meta dashboard (timing, sizes, counts) | ✅ v1 |
| 3-way merge | 🔜 v2 |
| Git integration | 🔜 v2 |

---

## 🚀 Quick Start

```bash
# First time only
make setup

# Start everything
make dev
```

Then open **http://localhost:3000** in your browser.

> The backend API is at **http://localhost:8000** (docs at `/api/docs`).

---

## 📋 Requirements

- **Python 3.11+**
- **Node.js 18+** (optional — falls back to Python static server)

---

## 🛠 All Commands

```bash
make setup       # Install all dependencies (first run)
make dev         # Start backend + frontend
make test        # Run all tests
make test-watch  # Tests in watch mode
make lint        # Lint Python code (ruff)
make clean       # Remove venv and caches
```

---

## 📁 Project Structure

```
diffinity/
├── Makefile               ← All dev commands
├── .gitignore
├── docs/
│   ├── PLAN.md            ← Full feature + architecture plan
│   ├── ARCHITECTURE.md    ← Mermaid diagrams
│   ├── ALGORITHMS.md      ← Algorithm deep-dives
│   └── API.md             ← REST API reference
├── frontend/
│   ├── index.html         ← App shell
│   ├── public/css/        ← Theming system (CSS variables)
│   └── src/
│       ├── app.js         ← Entry point
│       ├── core/          ← Diff engines (JS)
│       ├── ui/            ← UI components
│       ├── workers/       ← Web Workers (off main thread)
│       └── utils/         ← Pure helpers
└── backend/
    ├── main.py            ← FastAPI app
    ├── requirements.txt
    ├── core/              ← Diff / stego / office / archive engines
    ├── api/               ← REST routes (thin, delegate to core)
    ├── utils/             ← Models, streaming, logging
    └── tests/             ← pytest test suite
```

---

## 🎨 Colour Convention

| Colour | Meaning |
|--------|---------|
| 🟢 Green | Added content |
| 🔴 Red | Deleted content |
| 🟡 Yellow | Modified line (with word-level highlights inside) |
| 🔵 Blue | Moved line (same content, different position) |
| 🟠 Orange | Semantic change (synonym / same meaning) |
| 🟣 Purple | Security alert (homograph, steganography) |

---

## 🏗 Architecture

The system separates concerns strictly:

- **Small files (< 2 MB)**: diff runs entirely in the browser (JS engine + Web Workers)
- **Large files**: sent to the Python backend (difflib at C speed)
- **Archives**: Python backend reads in-memory streams, never extracts to disk
- **Images**: Pillow reads pixel data; LSB entropy analysis for steganography
- **Office docs**: python-docx / openpyxl / PyMuPDF extract text; then text diff

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for full Mermaid diagrams.

---

## 🔒 Privacy

When running locally, **no data leaves your machine**. All text diff and JSON diff for files under 2 MB run entirely in the browser. Larger files are sent to your local Python server only.

---

## 📄 License

MIT
