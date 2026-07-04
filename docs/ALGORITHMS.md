# Diffinity — Algorithms Deep-Dive

## 1. Myers Diff

The classic O(ND) algorithm used by Git. Finds the shortest edit script (minimum
insertions + deletions) between two sequences.

```
Input:  A = ["a","b","c","d"]
        B = ["a","c","d","e"]

Edit graph:
  Diagonal = match (no cost)
  Right    = insert from B
  Down     = delete from A

Shortest path: keep a, delete b, keep c, keep d, insert e
→ 1 delete + 1 insert = edit distance 2
```

**When to use:** Always as the base pass. Fast on large files.

**Weakness:** On code with many repeated lines (like `}`) it matches wrong blocks.
Solution: run Patience Diff when unique-line density is low.

---

## 2. Patience Diff

Improves Myers by first anchoring on *unique* lines (lines that appear exactly
once in each file). This prevents the algorithm from anchoring on closing braces
or blank lines.

```
Step 1: Find all lines unique in A AND unique in B → "patience anchor lines"
Step 2: Find the Longest Common Subsequence of anchor lines
Step 3: Between anchors, recursively apply Myers Diff
```

**Example (why Myers fails here):**

```
A:                  B:
def foo():          def bar():
    pass                pass
                    def foo():
                        pass
```

Myers might match `pass` in A to the first `pass` in B and miss the function rename.
Patience matches `def foo():` (unique) first → correct result.

---

## 3. Word-Level Diff (Phase 2)

Run only on lines classified as MODIFIED (changed, not fully replaced).

```python
# Pseudocode
for hunk in diff_result:
    if hunk.type == "modified":
        words_a = tokenize(hunk.line_a)   # split on word boundaries
        words_b = tokenize(hunk.line_b)
        word_ops = difflib.SequenceMatcher(None, words_a, words_b).get_opcodes()
        # opcodes: equal, insert, delete, replace
        # render each word with inline colour
```

Tokenization splits on: whitespace, punctuation, camelCase boundaries.

---

## 4. Moved-Line Detection (Levenshtein Similarity)

After the line-level diff, we have a list of DELETED and ADDED lines.
We try to pair them as MOVED lines.

```
Algorithm:
1. For each deleted line D:
     For each added line A (not yet paired):
         sim = levenshtein_similarity(D, A)
         if sim >= threshold (default 0.80):
             candidate_pairs.append((D, A, sim))

2. Sort candidates by similarity (descending)

3. Greedy matching (highest similarity first):
   - Pick the pair (D, A) with highest sim
   - Mark D as MOVED_FROM, A as MOVED_TO
   - Remove D and A from remaining pools
   - Repeat

4. Unpaired D → stays DELETED (red)
   Unpaired A → stays ADDED (green)
   Paired     → MOVED (blue)
```

**Important caution about duplicates:**
If A has line "111" once and B has it twice, only one of the B lines will pair
with the A line. The second "111" in B stays as ADDED (green). This is correct
because the first file only had one "111".

---

## 5. JSON Structural Diff

```
1. Parse JSON → Python dict/list
2. Flatten to dotted paths:
   {"user": {"name": "Alice", "age": 30}}
   → {"user.name": "Alice", "user.age": 30}

   Arrays get indexed:
   {"items": ["a", "b"]}
   → {"items.0": "a", "items.1": "b"}

3. Build sets: keys_a, keys_b
   - keys_a ∩ keys_b → check values
   - keys_a - keys_b → deleted paths
   - keys_b - keys_a → added paths

4. Array reorder detection:
   - Hash each array element
   - If hash appears in both arrays at different index → reordered
   - If appears only once in each → moved (blue)
   - Extra occurrences → added/deleted
```

---

## 6. Archive Streaming

```
Goal: compare two archives without extracting them to disk.

for file in tarfile.open(stream_a, "r|*"):   # pipe mode = streaming
    content = file.read()
    sha = hashlib.sha256(content).hexdigest()
    manifest_a[file.name] = {"size": file.size, "hash": sha}
    del content   # release memory immediately

# same for stream_b
# then compare manifests
```

The `"r|*"` mode in Python's tarfile reads from a stream without seeking.
No temp files. Memory usage = one file at a time.

---

## 7. Steganography — LSB Analysis

```
LSB (Least Significant Bit) steganography hides data in the last bit of each
color channel (R, G, B) of each pixel. This causes at most ±1 change in each
channel value, which is invisible to the human eye.

Detection:
1. Load image with Pillow
2. For each pixel (r, g, b):
     lsb_r = r & 1
     lsb_g = g & 1
     lsb_b = b & 1
3. Collect all LSBs into a bit stream
4. Group into bytes → compute Shannon entropy:

   H = -Σ p(x) * log2(p(x))   for each byte value x

5. Natural image LSBs have H ≈ 0.5–3 bits/byte (nearly random but with bias)
   Hidden data (especially if zipped/encrypted) has H ≈ 7.5–8 bits/byte
   → alert if H > 7.5

Comparison:
- If image A and B differ only in LSBs → very suspicious
- Count pixels whose LSB changed between A and B
- If > 5% of pixels affected → flag as "potential payload injection"
```

---

## 8. Unicode Homograph Detection

```
Homograph attack: use Unicode lookalikes to spoof URLs
Example: gо̨gle.com (Cyrillic 'о' instead of Latin 'o')

Detection algorithm:
1. For each character c in text:
     if c.unicode_script != "Latin" AND c.unicode_script != "Common":
         if c has a visually similar Latin equivalent:
             → flag as suspicious homograph

2. Check using unicodedata.name() and confusable mappings
   (Unicode Consortium publishes the confusables.txt list)

3. Additionally check: is the domain valid Punycode?
   "xn--" prefix indicates IDN → decode and compare

Output:
- Highlighted character with script name
- Suggested clean ASCII equivalent
- Punycode representation of the string
```

---

## 9. SHA-256 Early Exit

```
Before running any diff:
1. Compute SHA-256 of file A (streaming, 64KB chunks)
2. Compute SHA-256 of file B (streaming, 64KB chunks)
3. If hashes match → files are IDENTICAL, stop immediately.

In the browser: SubtleCrypto.digest("SHA-256", buffer)
On the server: hashlib.sha256()

This avoids sending large identical files to the diff engine.
Shown to user: "Files are identical. SHA-256: abc123... Computed in 38ms."
```

---

## 10. Semantic Synonym Matching

```
Simple synonym map (built-in, no ML needed):
{
  "developer": ["programmer", "engineer", "coder"],
  "salary": ["compensation", "remuneration", "pay"],
  "required": ["mandatory", "essential", "necessary"],
  ...
}

When a MODIFIED word pair is found:
1. Normalize both words (lowercase, strip punctuation)
2. Check if word_b is in synonyms[word_a] or vice versa
3. If yes → SEMANTIC change (orange) instead of red
4. Show tooltip: "Different word, likely same meaning"
```
