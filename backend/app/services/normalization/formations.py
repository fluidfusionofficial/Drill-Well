"""Formation name normalization with alias mapping.

Covers both Rajasthan Basin (WX-07/WX-11 reference wells) and Upper Assam Basin formations.
"""

from __future__ import annotations

import re
from typing import Optional

FORMATION_ALIASES: dict[str, str] = {
    # Rajasthan Basin (reference dataset)
    "all+shumar": "Alluvium + Shumar",
    "alluvium+shumar": "Alluvium + Shumar",
    "alluvium + shumar": "Alluvium + Shumar",
    "alluvium": "Alluvium + Shumar",
    "shumar": "Alluvium + Shumar",
    "jaisalmer+lathi": "Jaisalmer + Lathi",
    "jaisalmer + lathi": "Jaisalmer + Lathi",
    "jaisalmer": "Jaisalmer + Lathi",
    "lathi": "Jaisalmer + Lathi",
    "bap+badhaura": "Bap + Badhaura",
    "bap + badhaura": "Bap + Badhaura",
    "bap": "Bap + Badhaura",
    "badhaura": "Bap + Badhaura",
    "upper carbonate": "Upper Carbonate",
    "nagaur": "Nagaur",
    "nagaur formation": "Nagaur",
    "heg": "HEG",
    "heg unit": "HEG",
    "bilara": "Bilara",
    "bilara formation": "Bilara",
    "lower bilara": "Lower Bilara",
    "jodhpur": "Jodhpur",
    "jodhpur sandstone": "Jodhpur",
    "jodhpur sandstone formation": "Jodhpur",
    "malani igneous suite": "Malani / Basement",
    "malani": "Malani / Basement",
    "malani / basement": "Malani / Basement",
    "technical basement": "Malani / Basement",
    "basement": "Malani / Basement",
    # Upper Assam Basin
    "girujan": "Girujan",
    "girujan clay": "Girujan",
    "girujan clay formation": "Girujan",
    "tipam": "Tipam",
    "tipam sandstone": "Tipam",
    "tipam sandstone formation": "Tipam",
    "barail": "Barail",
    "barail group": "Barail",
    "barail main sand": "Barail",
    "barail coal": "Barail",
    "kopili": "Kopili",
    "kopili formation": "Kopili",
    "sylhet": "Sylhet",
    "sylhet limestone": "Sylhet",
    "jaintia": "Sylhet",
    "namsang": "Namsang",
    "namsang formation": "Namsang",
    "dhekiajuli": "Dhekiajuli",
}


def normalize_formation(raw: str) -> str:
    """Map a raw formation name to its canonical form.

    Returns the original string (stripped) if no alias is found — raw data is
    never discarded.
    """
    if not raw:
        return raw
    key = re.sub(r"\s+", " ", raw.strip()).lower()
    return FORMATION_ALIASES.get(key, raw.strip())


def match_formation(a: str, b: str) -> bool:
    """Check whether two formation names refer to the same canonical unit."""
    if not a or not b:
        return False
    canon_a = normalize_formation(a)
    canon_b = normalize_formation(b)
    if canon_a.lower() == canon_b.lower():
        return True
    if canon_a.lower() in canon_b.lower() or canon_b.lower() in canon_a.lower():
        return True
    return False
