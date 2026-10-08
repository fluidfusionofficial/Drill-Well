"""Depth reference type system with safe conversion rules.

MD (Measured Depth) and TVD (True Vertical Depth) are fundamentally different
physical quantities.  Converting between them requires a well survey function
that maps the wellbore trajectory.  This module refuses any MD↔TVD conversion
when no survey function is supplied — a non-negotiable design rule in NWIS.

Public API
----------
DepthValue(value, reference_type)        -- immutable depth datum
convert_depth(depth, target, survey_fn)  -- safe conversion; raises without survey_fn
DepthConversionError                     -- raised on unsupported conversions
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Optional


class DepthConversionError(ValueError):
    """Raised when a depth conversion is requested without a required survey function.

    MD and TVD are never silently interchanged in NWIS.
    """


_VALID_REFERENCE_TYPES: frozenset[str] = frozenset({"MD", "TVD", "TVDSS", "MSL"})


@dataclass(frozen=True)
class DepthValue:
    """An immutable depth measurement with an explicit reference type.

    Attributes
    ----------
    value:          The numeric depth in metres.
    reference_type: One of MD, TVD, TVDSS, MSL.

    The frozen dataclass is hashable and safe to use as a dict key.
    """

    value: float
    reference_type: str

    def __post_init__(self) -> None:
        if self.reference_type not in _VALID_REFERENCE_TYPES:
            raise ValueError(
                f"Invalid depth_reference_type {self.reference_type!r}. "
                f"Valid types: {sorted(_VALID_REFERENCE_TYPES)}."
            )
        if not isinstance(self.value, (int, float)):
            raise TypeError(f"depth value must be numeric, got {type(self.value).__name__!r}")


def convert_depth(
    depth: DepthValue,
    target_type: str,
    survey_fn: Optional[Callable[[float, str, str], float]] = None,
) -> DepthValue:
    """Convert a DepthValue to a different reference type.

    Parameters
    ----------
    depth:
        The source depth value.
    target_type:
        The desired output reference type (MD, TVD, TVDSS, MSL).
    survey_fn:
        A callable with signature ``f(value: float, from_type: str, to_type: str) -> float``
        that performs the actual coordinate transformation using the well survey.
        **Required** for any conversion between different reference types.

    Conversion rules
    ----------------
    - Same type → returned unchanged (no survey function needed).
    - Different type, survey_fn provided → calls survey_fn and wraps result.
    - Different type, survey_fn is None → raises DepthConversionError.

    This function never silently converts MD to TVD or vice versa.
    """
    if target_type not in _VALID_REFERENCE_TYPES:
        raise ValueError(
            f"Invalid target_type {target_type!r}. "
            f"Valid types: {sorted(_VALID_REFERENCE_TYPES)}."
        )

    if depth.reference_type == target_type:
        return depth  # No-op: same reference type.

    if survey_fn is None:
        raise DepthConversionError(
            f"Cannot convert {depth.reference_type} → {target_type} without a survey function. "
            "Supply a survey_fn built from this well's directional survey, or "
            "use the depth value as-is with its original reference type. "
            "MD and TVD are never silently interchanged in NWIS."
        )

    converted_value = survey_fn(depth.value, depth.reference_type, target_type)
    return DepthValue(value=converted_value, reference_type=target_type)
