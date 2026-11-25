"""Zambia Data Protection Act No. 3 of 2021 Guard & VibeSec CSV Formula Sanitizer."""
import re

ZAMBIA_PII_PATTERNS = [
    ("Zambian NRC Number", re.compile(r"\b\d{6}/\d{2}/\d\b")),
    ("Zambian Mobile Phone", re.compile(r"(?:\+260|(?<!\d)0)(?:9[567]|7[567])\d{7}\b")),
    ("Email Address", re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.I)),
    ("Patient Identifier Marker", re.compile(r"\b(?:patient\s*name|patient\s*id|art\s*no\.?|dob\s*:|nrc\s*:)", re.I)),
]


def scan_for_zambian_pii(*texts: str) -> list[str]:
    joined = " \n ".join(t for t in texts if t)
    return [label for label, pattern in ZAMBIA_PII_PATTERNS if pattern.search(joined)]


def check_dpa_public_eligibility(numerator: int, denominator: int, status: str, *texts: str) -> tuple[bool, str]:
    pii_hits = scan_for_zambian_pii(*texts)
    if pii_hits:
        return False, f"DPA No. 3 of 2021 block: personal data markers detected ({', '.join(pii_hits)})."
    if status not in {"LOCKED", "PUBLISHED", "REVISION_PENDING_REPUBLISH"}:
        return False, "Period must be MERL-locked prior to public CMS release."
    if numerator < 10 or denominator < 10:
        return False, f"DPA No. 3 of 2021 small-cell hold: n={min(numerator, denominator)} < 10."
    return True, "Cleared for aggregate public disclosure."


def sanitize_csv_formula_cell(value: object) -> str:
    text = str(value)
    if text and text[0] in ("=", "+", "-", "@", "\t", "\r"):
        return f"'{text}"
    return text
