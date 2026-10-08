"""ORM models for source document provenance ledger.

Document       — master record for every ingested file (DDR, WCR, DDDP, etc.).
DocumentPage   — per-page OCR text and image URI for PDF / image documents.
DocumentTable  — structured tabular extractions stored as JSONB.

Every extracted-data row in other tables links to a document_id here,
satisfying the mandatory provenance requirement.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Any, Optional

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.well import WellMaster


class Document(Base):
    """Source document ledger entry.

    Immutable once ingested — file_hash_sha256 detects re-ingestion of the
    same file.  ocr_engine records which engine (Docling, Tesseract, etc.)
    produced the text so extraction accuracy can be tracked per-engine.
    """

    __tablename__ = "document_master"
    __table_args__ = (
        CheckConstraint(
            "document_type IN ('DDR', 'WCR', 'DDDP', 'MUD_LOG', 'LOG_LAS')",
            name="ck_document_master_document_type",
        ),
    )

    document_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    well_id: Mapped[Optional[str]] = mapped_column(
        String(64), ForeignKey("well_master.well_id"), nullable=True
    )
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_hash_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    document_type: Mapped[Optional[str]] = mapped_column(String(32))
    file_uri: Mapped[str] = mapped_column(String(512), nullable=False)
    ocr_engine: Mapped[Optional[str]] = mapped_column(String(64))
    ingestion_timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # ── Relationships ──────────────────────────────────────────────────────────
    well: Mapped[Optional[WellMaster]] = relationship(
        "WellMaster", back_populates="documents"
    )
    pages: Mapped[list[DocumentPage]] = relationship(
        "DocumentPage", back_populates="document", cascade="all, delete-orphan"
    )
    tables: Mapped[list[DocumentTable]] = relationship(
        "DocumentTable", back_populates="document", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return (
            f"<Document document_id={self.document_id!r} "
            f"document_type={self.document_type!r} well_id={self.well_id!r}>"
        )


class DocumentPage(Base):
    """Per-page OCR output for a document.

    image_uri points to the stored page image (used by the provenance drawer
    to render the source snippet).  ocr_quality is a 0–1 confidence score
    reported by the OCR engine.
    """

    __tablename__ = "document_page"

    page_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    document_id: Mapped[str] = mapped_column(
        String(128),
        ForeignKey("document_master.document_id", ondelete="CASCADE"),
        nullable=False,
    )
    page_number: Mapped[int] = mapped_column(Integer, nullable=False)
    image_uri: Mapped[Optional[str]] = mapped_column(String(512))
    ocr_text: Mapped[Optional[str]] = mapped_column(Text)
    ocr_quality: Mapped[Optional[Decimal]] = mapped_column(Numeric(4, 3))

    # ── Relationships ──────────────────────────────────────────────────────────
    document: Mapped[Document] = relationship("Document", back_populates="pages")

    def __repr__(self) -> str:
        return (
            f"<DocumentPage page_id={self.page_id} "
            f"document_id={self.document_id!r} page_number={self.page_number}>"
        )


class DocumentTable(Base):
    """Structured tabular extraction from a document page.

    extracted_json stores the raw parsed table as a JSONB object so that
    downstream parsers can reprocess it without re-OCR.  extraction_quality
    is a 0–1 score for the table parsing step (separate from OCR quality).
    """

    __tablename__ = "document_table"

    table_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    document_id: Mapped[str] = mapped_column(
        String(128),
        ForeignKey("document_master.document_id", ondelete="CASCADE"),
        nullable=False,
    )
    page_number: Mapped[int] = mapped_column(Integer, nullable=False)
    table_type: Mapped[Optional[str]] = mapped_column(String(64))
    extracted_json: Mapped[Optional[Any]] = mapped_column(JSONB)
    extraction_quality: Mapped[Optional[Decimal]] = mapped_column(Numeric(4, 3))

    # ── Relationships ──────────────────────────────────────────────────────────
    document: Mapped[Document] = relationship("Document", back_populates="tables")

    def __repr__(self) -> str:
        return (
            f"<DocumentTable table_id={self.table_id} "
            f"document_id={self.document_id!r} table_type={self.table_type!r}>"
        )
