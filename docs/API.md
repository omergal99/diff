# Diffinity — Backend API Reference

Base URL: `http://localhost:8000/api`

All endpoints return JSON unless noted. Errors follow `{"error": "...", "detail": "..."}`.

---

## POST `/api/diff/text`

Compare two text/code strings.

**Request body (JSON):**
```json
{
  "text_a": "string",
  "text_b": "string",
  "options": {
    "algorithm": "patience | myers",
    "ignore_whitespace": false,
    "ignore_case": false,
    "ignore_comments": false,
    "word_level": true,
    "detect_moved": true,
    "moved_threshold": 0.80
  }
}
```

**Response:**
```json
{
  "stats": {
    "lines_a": 120,
    "lines_b": 125,
    "added": 8,
    "deleted": 3,
    "modified": 4,
    "moved": 2,
    "equal": 108,
    "elapsed_ms": 12.4
  },
  "hunks": [
    {
      "type": "equal | added | deleted | modified | moved",
      "line_a": 10,
      "line_b": 10,
      "lines": ["..."],
      "word_diff": [
        {"op": "equal | insert | delete", "text": "..."}
      ]
    }
  ]
}
```

---

## POST `/api/diff/json`

Structural JSON comparison.

**Request body (JSON):**
```json
{
  "json_a": "string (raw JSON text)",
  "json_b": "string (raw JSON text)",
  "options": {
    "schema_only": false,
    "ignore_array_order": false
  }
}
```

**Response:**
```json
{
  "stats": { "..." },
  "changes": [
    {
      "path": "user.address.city",
      "type": "changed | added | deleted | reordered",
      "value_a": "Tel Aviv",
      "value_b": "Haifa"
    }
  ]
}
```

---

## POST `/api/diff/archive`

Compare two archive files (ZIP / TAR / TGZ). Returns **Server-Sent Events**.

**Request:** `multipart/form-data` with fields `file_a` and `file_b`.

**SSE stream events:**

```
data: {"type": "start", "total_a": 42, "total_b": 45}

data: {"type": "file", "path": "src/main.py", "status": "modified",
       "hash_a": "abc...", "hash_b": "def...",
       "size_a": 1024, "size_b": 1100}

data: {"type": "file", "path": "README.md", "status": "equal"}

data: {"type": "file", "path": "old_file.txt", "status": "deleted"}

data: {"type": "done", "summary": {"equal": 30, "modified": 8, "added": 3, "deleted": 4},
       "elapsed_ms": 340.2}
```

---

## POST `/api/diff/image`

Pixel-level image comparison with optional steganography detection.

**Request:** `multipart/form-data` with fields `file_a`, `file_b`, and optional `stego=true`.

**Response:**
```json
{
  "dimensions_a": [1920, 1080],
  "dimensions_b": [1920, 1080],
  "identical": false,
  "pixel_diff_count": 4821,
  "diff_percentage": 0.23,
  "changed_regions": [
    {"x": 120, "y": 340, "w": 80, "h": 60}
  ],
  "stego": {
    "analyzed": true,
    "entropy_a": 7.82,
    "entropy_b": 7.95,
    "suspicious_a": true,
    "suspicious_b": false,
    "lsb_preview": "PK\u0003\u0004..."
  },
  "elapsed_ms": 220.0
}
```

---

## POST `/api/diff/office`

Extract text from DOCX / XLSX / PDF and return text diff.

**Request:** `multipart/form-data` with fields `file_a`, `file_b`, `type` (docx|xlsx|pdf).

**Response:** Same as `/api/diff/text` response, plus:
```json
{
  "extracted_a": "plain text from document A",
  "extracted_b": "plain text from document B",
  "..." : "...same diff hunks..."
}
```

---

## POST `/api/unicode/check`

Detect homograph attacks and dangerous Unicode in text.

**Request body (JSON):**
```json
{
  "text": "string to analyze"
}
```

**Response:**
```json
{
  "has_suspicious": true,
  "findings": [
    {
      "char": "а",
      "position": 12,
      "codepoint": "U+0430",
      "script": "Cyrillic",
      "looks_like": "a (U+0061 Latin)",
      "context": "go...gle.com"
    }
  ],
  "non_ascii_chars": ["…", "–"],
  "punycode": "xn--ggle-0nd.com"
}
```

---

## POST `/api/stego/analyze`

Analyze a single image for hidden data.

**Request:** `multipart/form-data` with field `file`.

**Response:**
```json
{
  "filename": "photo.png",
  "dimensions": [800, 600],
  "total_pixels": 480000,
  "lsb_entropy": 7.91,
  "is_suspicious": true,
  "extracted_bits": 480000,
  "decoded_preview": "Zm9v...",
  "elapsed_ms": 115.3
}
```

---

## GET `/api/health`

Health check.

**Response:**
```json
{"status": "ok", "version": "0.1.0"}
```
