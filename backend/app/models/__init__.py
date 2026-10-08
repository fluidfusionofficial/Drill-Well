"""NWIS ORM model registry.

Import all model classes here so that:
1. Alembic's autogenerate can discover every table via Base.metadata.
2. Application code can do ``from app.models import WellMaster`` without
   knowing which sub-module each class lives in.
"""

from app.models.alert import Alert
from app.models.construction import CasingRun, CementJob, LithologyObservation, LoggingRun
from app.models.document import Document, DocumentPage, DocumentTable
from app.models.drilling import BitRun, DrillingParameterInterval
from app.models.event import Event, MudLossEvent, WellControlEvent
from app.models.formation import FormationInterval, FormationMaster
from app.models.knowledge import EngineerObservation, LessonLearned, SimilarityRecord
from app.models.mud import MudRecord
from app.models.operation import DailyOperation, OperationTime
from app.models.well import WellLocation, WellMaster

__all__ = [
    "Alert",
    "BitRun",
    "CasingRun",
    "CementJob",
    "DailyOperation",
    "Document",
    "DocumentPage",
    "DocumentTable",
    "DrillingParameterInterval",
    "EngineerObservation",
    "Event",
    "FormationInterval",
    "FormationMaster",
    "LessonLearned",
    "LithologyObservation",
    "LoggingRun",
    "MudLossEvent",
    "MudRecord",
    "OperationTime",
    "SimilarityRecord",
    "WellControlEvent",
    "WellLocation",
    "WellMaster",
]
