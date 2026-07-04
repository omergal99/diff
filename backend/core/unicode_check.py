"""
Unicode homograph and phishing detection.

Detects characters from non-Latin scripts that visually resemble Latin letters.
Used for phishing URL detection and suspicious paste detection.

Uses Python's built-in unicodedata — no external deps.
"""

from __future__ import annotations
import unicodedata
import re
from utils.logger import get_logger

log = get_logger("unicode")

# Subset of Unicode Consortium's confusables list — Latin lookalikes
# Maps suspicious char → its Latin lookalike
CONFUSABLES: dict[str, str] = {
    # Cyrillic → Latin
    "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "х": "x",
    "А": "A", "В": "B", "Е": "E", "К": "K", "М": "M", "Н": "H",
    "О": "O", "Р": "P", "С": "C", "Т": "T", "Х": "X", "У": "Y",
    # Greek → Latin
    "α": "a", "β": "b", "ε": "e", "η": "n", "ι": "i", "κ": "k",
    "ο": "o", "ρ": "p", "τ": "t", "υ": "u", "χ": "x", "ω": "w",
    # Full-width Latin (URL tricks)
    "ａ": "a", "ｂ": "b", "ｃ": "c", "ｄ": "d", "ｅ": "e",
    "ｆ": "f", "ｇ": "g", "ｈ": "h", "ｉ": "i", "ｊ": "j",
    # Mathematical letters
    "𝐚": "a", "𝐛": "b", "𝐜": "c", "𝒂": "a", "𝒃": "b",
    # Zero-width chars (invisible injections)
    "\u200b": "[ZWSP]",     # zero-width space
    "\u200c": "[ZWNJ]",     # zero-width non-joiner
    "\u200d": "[ZWJ]",      # zero-width joiner
    "\ufeff": "[BOM]",      # byte order mark
    "\u00ad": "[SHY]",      # soft hyphen
}

# Regex: non-ASCII characters
_NON_ASCII = re.compile(r"[^\x00-\x7f]")


def _get_script(char: str) -> str:
    """Return the Unicode script name of a character."""
    try:
        name = unicodedata.name(char, "")
        if "CYRILLIC" in name:
            return "Cyrillic"
        if "GREEK" in name:
            return "Greek"
        if "HEBREW" in name:
            return "Hebrew"
        if "ARABIC" in name:
            return "Arabic"
        if "CJK" in name or "CHINESE" in name or "JAPANESE" in name:
            return "CJK"
        if "LATIN" in name:
            return "Latin"
        if "MATHEMATICAL" in name:
            return "Mathematical"
        if "FULLWIDTH" in name:
            return "Fullwidth"
        return "Other"
    except TypeError:
        return "Unknown"


def _context_snippet(text: str, pos: int, width: int = 10) -> str:
    start = max(0, pos - width)
    end = min(len(text), pos + width + 1)
    snippet = text[start:end]
    # Replace invisible chars for display
    snippet = snippet.replace("\u200b", "​").replace("\u200d", "‍")
    return snippet


def check_text(text: str) -> dict:
    """
    Scan text for Unicode homographs and suspicious characters.

    Returns:
      has_suspicious: bool
      findings: list of {char, position, codepoint, script, looks_like, context}
      non_ascii_count: int
      punycode: str | None
    """
    findings = []
    non_ascii = _NON_ASCII.findall(text)

    for pos, char in enumerate(text):
        if char in CONFUSABLES:
            lookalike = CONFUSABLES[char]
            codepoint = f"U+{ord(char):04X}"
            script = _get_script(char)
            findings.append({
                "char": char,
                "position": pos,
                "codepoint": codepoint,
                "script": script,
                "looks_like": f"{lookalike} (U+{ord(lookalike):04X} Latin)" if lookalike.isascii() else lookalike,
                "context": _context_snippet(text, pos),
            })

    # Try Punycode encoding (for URL analysis)
    punycode = None
    try:
        # Extract domain-like token
        domain_match = re.search(r"[\w\u0080-\uffff][\w\u0080-\uffff\.\-]+", text)
        if domain_match:
            domain = domain_match.group(0)
            encoded = domain.encode("idna").decode("ascii")
            if encoded != domain:
                punycode = encoded
    except (UnicodeError, UnicodeDecodeError):
        pass

    log.debug(f"Unicode check: {len(findings)} suspicious chars, {len(non_ascii)} non-ASCII")

    return {
        "has_suspicious": bool(findings),
        "findings": findings,
        "non_ascii_count": len(non_ascii),
        "punycode": punycode,
    }


def strip_non_ascii(text: str, pattern: str = r"[^\x00-\x7f]") -> str:
    """Remove non-ASCII characters using a configurable regex pattern."""
    return re.sub(pattern, "", text)


def strip_zero_width(text: str) -> str:
    """Remove invisible zero-width Unicode characters."""
    zero_width = {"\u200b", "\u200c", "\u200d", "\ufeff", "\u00ad"}
    return "".join(c for c in text if c not in zero_width)
