# Diffinity — Master Plan & Architecture

> A professional-grade, open-source file comparison and analysis tool.
> Built with Vanilla JS + Python. No framework bloat. No dependency hell.

---

## 1. Project Goals

- Replace commercial tools (Araxis Merge, Mergely) with a free, self-hosted alternative
- Support text, code, JSON, images, Office documents, archives, and binary files
- Fast even on large files (>100 MB) using streaming and workers
- Clean, modular codebase easy to maintain for years
- Progressive enhancement: works as local tool, optionally hosted on the web

---

## 2. Tech Stack

### Frontend
| Layer         | Technology                             | Reason                                        |
|---------------|----------------------------------------|-----------------------------------------------|
| UI Framework  | Vanilla JS (ES Modules)                | No rot, no upgrades, runs forever             |
| Editor        | CodeMirror 6 (CDN)                     | Handles huge files; line numbers; syntax hl   |
| Workers       | Web Workers (built-in)                 | Heavy diff never blocks the UI thread         |
| Crypto        | SubtleCrypto API (built-in)            | SHA-256 hash without any library              |
| Styling       | Pure CSS (variables + grid/flexbox)    | Theming, RTL, dark mode — zero dependencies   |
| File I/O      | FileReader + File API (built-in)       | Local files, no upload needed                 |

### Backend
| Layer         | Technology                             | Reason                                        |
|---------------|----------------------------------------|-----------------------------------------------|
| Runtime       | Python 3.11+                           | Standard library is incredibly powerful       |
| HTTP Server   | FastAPI + Uvicorn                      | Tiny, async, fast — only real external dep    |
| Diff Engine   | difflib (stdlib)                       | C-speed SequenceMatcher built in              |
| Archives      | tarfile + zipfile (stdlib)             | Open TAR/TGZ/ZIP with zero dependencies       |
| Images        | Pillow                                 | RGB/LSB steganography analysis                |
| Office Docs   | python-docx, openpyxl, PyMuPDF         | DOCX, XLSX, PDF text extraction               |
| Hashing       | hashlib (stdlib)                       | SHA-256 file fingerprinting                   |

---

## 3. Feature Matrix

### Core Comparison Modes

| Mode              | Description                                              | Priority |
|-------------------|----------------------------------------------------------|----------|
| Text / Code Diff  | Side-by-side and inline; word-level; line numbers        | MVP      |
| JSON Diff         | Structure-aware; schema-only mode; moved-key detection   | MVP      |
| Folder Compare    | Recursive tree view; filter by extension                 | MVP      |
| Archive Compare   | TAR / TGZ / ZIP diff without extracting to disk          | v1       |
| Image Compare     | Pixel diff with toggle overlay + steganography detection | v1       |
| DOCX / PDF / XLSX | Extract text then diff; Excel grid view                  | v1       |
| Binary / Hex      | Hex view comparison                                      | v2       |
| 3-Way Merge       | Base + mine + theirs                                     | v2       |

### Smart Detection Features

| Feature                     | Description                                              |
|-----------------------------|----------------------------------------------------------|
| Moved Lines (Blue)          | Levenshtein similarity ≥ 80% → moved, not deleted       |
| Word-Level Highlight        | Inside changed lines, highlight exact word changes       |
| Semantic Synonyms           | Yellow highlight for different words with same meaning   |
| Unicode / Homograph Alert   | Detect Cyrillic lookalikes in URLs and text              |
| SHA-256 Early Exit          | Identical files detected instantly before full diff      |
| Steganography (LSB)         | Pixel-level entropy analysis for hidden data in images   |
| Duplicate Detection         | Find duplicate lines / blocks within a file              |
| Config / Secret Diff        | Alert on .env, YAML IP/key changes                       |
| Punycode / IDN Check        | Phishing URL homograph detection                         |

### UI / UX Features

| Feature                    | Description                                               |
|----------------------------|-----------------------------------------------------------|
| Side-by-Side View          | Two panels, synchronized scroll with padding offsets      |
| Inline (Unified) View      | Classic unified diff view                                 |
| Scrollbar Minimap          | Color-coded change map on right edge                      |
| One-Click Merge            | Arrow buttons to copy hunks left→right or right→left      |
| Search with History        | Regex-capable search; history saved per session           |
| RTL / LTR Toggle           | One-click direction swap (Hebrew, Arabic, etc.)           |
| Theme System               | Light / Dark / High-Contrast + custom CSS vars            |
| Meta Dashboard             | Timing, file sizes, line counts, change summary           |
| Download Merged File       | Export the merged result                                  |
| Export Diff Report         | HTML or JSON report of all differences                    |
| Unicode Cleaner            | Strip non-ASCII chars with configurable regex             |
| Noise Filters              | Toggle ignore: whitespace, case, comments, timestamps     |
| Bookmarks + Notes          | Annotate specific lines                                   |
| 3-Panel Folder Explorer    | Left tree / diff view / right tree                        |

---

## 4. Algorithm Design

### 4.1 Two-Phase Diff Engine

```
Input: Text A, Text B
Phase 1 (Line-level):
  → Myers Diff (fast path for code)
  → Patience Diff (when unique-line anchoring needed)
  → Classify each line: EQUAL | ADDED | DELETED | MODIFIED

Phase 2 (Word-level, only for MODIFIED lines):
  → Run difflib.ndiff on the words of each changed line pair
  → Highlight sub-word changes with character-level precision

Phase 3 (Moved-line detection):
  → For each DELETED line, find best-matching ADDED line
  → Levenshtein similarity >= 0.80 → mark as MOVED (blue)
  → Use 1-to-1 matching to avoid false duplicates
```

### 4.2 JSON Structural Diff

```
1. Parse both JSON files into Python dicts
2. Flatten to dot-notation paths: "user.address.city"
3. Compare path sets:
   - Same path, same value     → equal
   - Same path, different value → changed (show old vs new)
   - Path only in A            → deleted
   - Path only in B            → added
4. Schema-only mode: strip values, compare structure only
5. Detect reordered array items by value hash
```

### 4.3 Archive Streaming Diff

```
1. Open TAR/ZIP as stream (never extract to disk)
2. For each member: compute SHA-256 on-the-fly
3. Build manifest: {path → {size, hash, mtime}}
4. Compare manifests:
   - Hash match   → identical
   - Hash differ  → modified (trigger text diff if text file)
   - Only in A    → deleted
   - Only in B    → added
5. Stream results to browser via SSE (Server-Sent Events)
```

### 4.4 Steganography Detection

```
1. Load image with Pillow
2. Extract LSB of R, G, B channels per pixel
3. Reconstruct bit stream
4. Run entropy analysis (Shannon entropy on byte distribution)
5. If entropy > threshold (7.5 bits/byte) → alert: suspicious
6. Optionally decode as ASCII/UTF-8 and show preview
7. On comparison: flag pixels whose LSB changed (could be payload)
```

---

## 5. File / Module Structure

```
diffinity/
├── Makefile                    ← make dev / make setup / make test / make build
├── .gitignore
├── README.md
├── docs/
│   ├── PLAN.md                 ← this file
│   ├── ARCHITECTURE.md         ← detailed module graph (Mermaid)
│   ├── ALGORITHMS.md           ← algorithm deep-dive
│   ├── API.md                  ← backend REST API reference
│   └── FEATURES.md             ← complete feature list
├── frontend/
│   ├── index.html              ← app shell; loads ES modules
│   ├── public/
│   │   ├── css/
│   │   │   ├── base.css        ← reset + CSS variables (all themes)
│   │   │   ├── layout.css      ← grid, panels, toolbar
│   │   │   ├── diff.css        ← diff colours, gutter, minimap
│   │   │   └── themes/
│   │   │       ├── light.css
│   │   │       ├── dark.css
│   │   │       └── high-contrast.css
│   │   └── icons/              ← SVG icons (no icon font dep)
│   ├── src/
│   │   ├── app.js              ← entry point; router; tab manager
│   │   ├── core/
│   │   │   ├── diff-engine.js  ← Myers + Patience diff in JS (client-side)
│   │   │   ├── moved-lines.js  ← Levenshtein similarity + moved detection
│   │   │   ├── json-diff.js    ← JSON structural comparison
│   │   │   ├── hash.js         ← SHA-256 via SubtleCrypto
│   │   │   └── unicode.js      ← homograph detection, unicode cleaner
│   │   ├── ui/
│   │   │   ├── editor.js       ← CodeMirror 6 wrapper (setup, themes)
│   │   │   ├── panel.js        ← left/right panel; scroll sync
│   │   │   ├── minimap.js      ← scrollbar change overview
│   │   │   ├── toolbar.js      ← top bar: open, filters, toggles
│   │   │   ├── merge.js        ← arrow merge controls
│   │   │   ├── search.js       ← search bar + history
│   │   │   ├── folder-tree.js  ← folder compare UI tree
│   │   │   ├── meta-bar.js     ← timing + file stats dashboard
│   │   │   └── modal.js        ← generic modal (alerts, confirm)
│   │   ├── workers/
│   │   │   ├── diff.worker.js  ← runs diff off main thread
│   │   │   └── hash.worker.js  ← SHA-256 for large files off main thread
│   │   └── utils/
│   │       ├── format.js       ← size/time/count formatters
│   │       ├── dom.js          ← DOM helpers (no jQuery)
│   │       ├── file.js         ← FileReader wrappers, encoding detection
│   │       ├── theme.js        ← theme switcher + RTL
│   │       └── export.js       ← export diff to HTML/JSON
│   └── tests/
│       ├── diff-engine.test.js
│       ├── moved-lines.test.js
│       └── json-diff.test.js
└── backend/
    ├── main.py                 ← FastAPI app; route registration
    ├── requirements.txt
    ├── core/
    │   ├── diff.py             ← two-phase diff: Myers → word-level
    │   ├── moved.py            ← moved-line detection
    │   ├── json_diff.py        ← JSON structural + schema diff
    │   ├── archive.py          ← streaming TAR/ZIP comparison
    │   ├── stego.py            ← LSB steganography analysis
    │   ├── office.py           ← DOCX/XLSX/PDF text extraction
    │   ├── unicode_check.py    ← homograph + IDN + punycode checks
    │   └── hash.py             ← SHA-256 streaming hash
    ├── api/
    │   ├── routes_diff.py      ← POST /api/diff/text, /api/diff/json
    │   ├── routes_folder.py    ← POST /api/diff/folder (SSE)
    │   ├── routes_archive.py   ← POST /api/diff/archive
    │   ├── routes_image.py     ← POST /api/diff/image, /api/stego/analyze
    │   ├── routes_office.py    ← POST /api/diff/office
    │   └── routes_unicode.py   ← POST /api/unicode/check
    ├── utils/
    │   ├── stream.py           ← streaming utilities, chunked file reading
    │   ├── models.py           ← Pydantic response models
    │   └── logger.py           ← structured logging
    └── tests/
        ├── test_diff.py
        ├── test_json_diff.py
        ├── test_archive.py
        └── test_stego.py
```

---

## 6. Development Phases

### Phase 1 — Core MVP (Text + JSON)
- [x] Project scaffold, Makefile, .gitignore
- [ ] CSS design system + light/dark theme
- [ ] Two-panel CodeMirror editor with sync scroll
- [ ] Client-side Myers diff engine (JS)
- [ ] Word-level highlight on modified lines
- [ ] Moved-line detection (blue colour)
- [ ] SHA-256 early exit
- [ ] Meta dashboard (timing, sizes, stats)
- [ ] Python backend: text diff endpoint
- [ ] Python backend: JSON diff endpoint

### Phase 2 — Files & Folders
- [ ] File open button (both panels)
- [ ] Folder compare tree view
- [ ] Archive (TAR/ZIP) streaming compare
- [ ] Noise filters (whitespace, case, comments)
- [ ] Search with regex + history

### Phase 3 — Rich File Types
- [ ] Image compare + pixel diff overlay
- [ ] Steganography LSB analysis
- [ ] DOCX / PDF / XLSX text extraction
- [ ] Excel grid view for XLSX compare
- [ ] Binary / hex diff view

### Phase 4 — Power Features
- [ ] 3-way merge
- [ ] Unicode homograph / Punycode detection
- [ ] Config/secret diff alerting
- [ ] Export diff report (HTML/JSON)
- [ ] Bookmarks + inline notes
- [ ] Batch compare mode

---

## 7. Colour Coding Convention

| Colour  | Meaning                                         |
|---------|-------------------------------------------------|
| Green   | Added line / content                            |
| Red     | Deleted line / content                          |
| Yellow  | Modified line (word-level changes inside)       |
| Blue    | Moved line (same content, different position)   |
| Orange  | Semantic change (synonym / equivalent meaning)  |
| Purple  | Suspicious / security alert (stego, homograph)  |
| Grey    | Ignored (whitespace-only, filtered out)         |
