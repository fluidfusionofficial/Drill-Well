"""ORM model for Level 1 deterministic historical-context alerts.

Alert — a depth-proximity hazard notice generated from reference-well events.

Advisory-language rule (non-negotiable):
- advisory_text MUST use 'recorded precedent' / 'historical context' language.
- It MUST NOT contain: 'will happen', 'will', 'predicted', 'must', 'should drill'.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.well import WellMaster


class Alert(Base):
    """A historical-context alert triggered by proximity to a reference event."""

    __tablename__ = "alert"
    __table_args__ = (
        CheckConstraint(
            "level IN ('INFO', 'WARNING', 'CRITICAL')",
            name="ck_alert_level",
        ),
        CheckConstraint(
            "category IN ('MUD_LOSS', 'STUCK_PIPE', 'CASING_FAILURE', "
            "'FORMATION_CHANGE', 'OTHER')",
            name="ck_alert_category",
        ),
        CheckConstraint(
            "risk_score BETWEEN 0.0 AND 1.0",
            name="ck_alert_risk_score",
        ),
    )

    alert_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    well_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("well_master.well_id", ondelete="CASCADE"), nullable=False
    )
    level: Mapped[str] = mapped_column(String(16), nullable=False, default="INFO")
    category: Mapped[str] = mapped_column(String(32), nullable=False)
    trigger_depth_md: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 2))

    # Advisory text — 'recorded precedent' / 'historical context' language only.
    advisory_text: Mapped[str] = mapped_column(Text, nullable=False)
    risk_score: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 4))

    source_event_id: Mapped[Optional[str]] = mapped_column(
        String(64), ForeignKey("event.event_id"), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # ── Relationships ──────────────────────────────────────────────────────────
    well: Mapped[WellMaster] = relationship("WellMaster", back_populates="alerts")

    def __repr__(self) -> str:
        return (
            f"<Alert alert_id={self.alert_id} level={self.level!r} "
            f"well_id={self.well_id!r} depth_md={self.trigger_depth_md}>"
        )
