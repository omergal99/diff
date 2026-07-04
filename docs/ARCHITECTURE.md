# Diffinity — Architecture

## System Overview

```mermaid
graph TD
    User["👤 User (Browser)"]

    subgraph Frontend ["Frontend — Vanilla JS ES Modules"]
        App["app.js (router + tab manager)"]
        subgraph UI["UI Layer"]
            Editor["editor.js (CodeMirror 6)"]
            Panel["panel.js (sync scroll)"]
            Minimap["minimap.js (change overview)"]
            Toolbar["toolbar.js (controls)"]
            MetaBar["meta-bar.js (stats)"]
            FolderTree["folder-tree.js"]
            Search["search.js (+ history)"]
            Merge["merge.js (one-click merge)"]
        end
        subgraph Core["Core — Diff Logic (client-side fast path)"]
            DiffEngine["diff-engine.js (Myers + Patience)"]
            MovedLines["moved-lines.js (Levenshtein)"]
            JsonDiff["json-diff.js"]
            Hash["hash.js (SubtleCrypto SHA-256)"]
            Unicode["unicode.js (homograph check)"]
        end
        subgraph Workers["Web Workers (off main thread)"]
            DiffWorker["diff.worker.js"]
            HashWorker["hash.worker.js"]
        end
        subgraph Utils["Utils"]
            Format["format.js"]
            DOM["dom.js"]
            FileUtils["file.js"]
            Theme["theme.js"]
            Export["export.js"]
        end
    end

    subgraph Backend ["Backend — Python / FastAPI"]
        Main["main.py (FastAPI app)"]
        subgraph API["API Routes"]
            RouteDiff["routes_diff.py"]
            RouteFolder["routes_folder.py (SSE)"]
            RouteArchive["routes_archive.py"]
            RouteImage["routes_image.py"]
            RouteOffice["routes_office.py"]
            RouteUnicode["routes_unicode.py"]
        end
        subgraph CorePy["Core — Python Engines"]
            DiffPy["diff.py (two-phase)"]
            MovedPy["moved.py"]
            JsonDiffPy["json_diff.py"]
            ArchivePy["archive.py (streaming)"]
            StegoPy["stego.py (LSB analysis)"]
            OfficePy["office.py (docx/xlsx/pdf)"]
            UnicodeCheckPy["unicode_check.py"]
            HashPy["hash.py (streaming SHA-256)"]
        end
        subgraph UtilsPy["Utils"]
            Stream["stream.py"]
            Models["models.py (Pydantic)"]
            Logger["logger.py"]
        end
    end

    User --> App
    App --> UI
    App --> Core
    App --> Workers
    Core --> DiffEngine
    DiffEngine -->|"large files"| DiffWorker
    Hash -->|"large files"| HashWorker
    App -->|"REST / SSE"| Main
    Main --> API
    API --> CorePy
    CorePy --> UtilsPy
```

---

## Data Flow — Text Comparison

```mermaid
sequenceDiagram
    participant U as User
    participant A as app.js
    participant H as hash.js
    participant W as diff.worker.js
    participant B as backend /api/diff/text
    participant D as diff.py

    U->>A: Paste or open two files
    A->>H: SHA-256(fileA) + SHA-256(fileB)
    H-->>A: hashA, hashB

    alt Hashes identical
        A-->>U: ✅ Files identical (show hash + timing)
    else Hashes differ
        alt Small file (< 2 MB)
            A->>W: { textA, textB, options }
            W->>W: Myers diff + word-level + moved
            W-->>A: DiffResult
            A-->>U: Render coloured diff
        else Large file (> 2 MB)
            A->>B: POST { chunkA, chunkB, options }
            B->>D: two_phase_diff(textA, textB)
            D-->>B: DiffResult JSON
            B-->>A: DiffResult (gzipped)
            A-->>U: Render coloured diff
        end
    end
```

---

## Data Flow — Archive Comparison

```mermaid
sequenceDiagram
    participant U as User
    participant A as app.js
    participant B as backend /api/diff/archive
    participant P as archive.py

    U->>A: Upload archive A + archive B
    A->>B: POST multipart (streamA, streamB)
    B->>P: stream_compare(streamA, streamB)
    P->>P: Read members in-memory (no disk extract)
    P->>P: SHA-256 each member on-the-fly
    P->>P: Build manifest A → manifest B
    P-->>B: SSE stream of file-level results
    B-->>A: Server-Sent Events (chunked)
    A-->>U: Live folder tree updates as results arrive
```

---

## Diff Colour State Machine

```mermaid
stateDiagram-v2
    [*] --> EQUAL : lines match
    [*] --> ADDED : only in B
    [*] --> DELETED : only in A
    [*] --> MODIFIED : line changed

    MODIFIED --> WORD_LEVEL : run word diff on pair
    WORD_LEVEL --> SEMANTIC : word is a synonym
    WORD_LEVEL --> CHANGED_WORD : word is different

    DELETED --> MOVED_CHECK : find similar in ADDED
    MOVED_CHECK --> MOVED : similarity >= 80%
    MOVED_CHECK --> DELETED : similarity < 80%

    EQUAL --> grey
    ADDED --> green
    DELETED --> red
    MODIFIED --> yellow
    MOVED --> blue
    SEMANTIC --> orange
    CHANGED_WORD --> red_inline

    note right of MOVED : "Same content,\ndifferent position"
    note right of SEMANTIC : "Different word,\nsame meaning"
```

---

## Module Dependency Graph (Frontend)

```mermaid
graph LR
    app.js --> panel.js
    app.js --> toolbar.js
    app.js --> meta-bar.js
    app.js --> search.js

    panel.js --> editor.js
    panel.js --> minimap.js
    panel.js --> merge.js

    editor.js --> diff-engine.js
    editor.js --> dom.js

    diff-engine.js --> moved-lines.js
    diff-engine.js --> diff.worker.js

    toolbar.js --> theme.js
    toolbar.js --> file.js
    toolbar.js --> dom.js

    search.js --> dom.js
    search.js --> format.js

    meta-bar.js --> format.js
    meta-bar.js --> hash.js

    hash.js --> hash.worker.js

    export.js --> format.js
    export.js --> dom.js
```

---

## Backend Module Dependency Graph

```mermaid
graph LR
    main.py --> routes_diff.py
    main.py --> routes_folder.py
    main.py --> routes_archive.py
    main.py --> routes_image.py
    main.py --> routes_office.py
    main.py --> routes_unicode.py

    routes_diff.py --> diff.py
    routes_diff.py --> moved.py
    routes_diff.py --> models.py

    routes_folder.py --> hash.py
    routes_folder.py --> stream.py
    routes_folder.py --> models.py

    routes_archive.py --> archive.py
    routes_archive.py --> hash.py
    routes_archive.py --> stream.py

    routes_image.py --> stego.py
    routes_image.py --> models.py

    routes_office.py --> office.py
    routes_office.py --> diff.py

    routes_unicode.py --> unicode_check.py

    diff.py --> moved.py
    diff.py --> stream.py

    archive.py --> hash.py
    archive.py --> stream.py

    stego.py --> logger.py
    unicode_check.py --> logger.py

    all --> logger.py
```
