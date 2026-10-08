# NWIS ML Pipeline

**"BUILD THE MEMORY BEFORE BUILDING THE PREDICTION."**

This pipeline produces decision-support models for the NWIS platform. It reads
from the PostgreSQL database that the FastAPI backend populates, trains models
offline, and exposes them through the inference pipeline consumed by the API.

## Core principle

NWIS is a historical-intelligence and decision-support system. Every model in
this pipeline produces _evidence_ and _context_, never autonomous operational
commands. Outputs are framed as "recorded precedent" and "historical context",
never as predictions stated as certainties.

## Pipeline stages

1. **Feature extraction** (`features/`) — reads normalized, provenance-tagged
   rows from the database. Splits are always by `well_id`, never random, to
   prevent data leakage across wells.

2. **Model training** (`training/`) — trains EventClassifier, SimilarityLearner,
   and ParameterAnomalyDetector. Optimizes PR-AUC (not accuracy) because
   drilling-event classes are imbalanced.

3. **Evaluation** (`training/evaluate.py`) — produces confusion matrices, PR
   curves, and a leakage-detection report. All artefacts are committed with the
   model version.

4. **Inference pipeline** (`pipelines/inference.py`) — loads saved models and
   exposes a single `NWISInferencePipeline` used by the FastAPI service layer.

## Models deploy only after domain review

Trained model artefacts (`.joblib` files) are saved to `ml/artefacts/` and
must be reviewed by a petroleum-engineering domain expert before the inference
pipeline is updated to load them in any environment connected to live operations.
This is a hard requirement, not a courtesy — NWIS does not issue autonomous
drilling instructions.

## Running the pipeline

```bash
# Install dependencies (inside a virtual environment)
pip install -r ml/requirements.txt
python -m spacy download en_core_web_sm

# Train event classifier (reads from DATABASE_URL env var)
python -m ml.training.train_event_classifier

# Evaluate a saved model
python -m ml.training.evaluate --model ml/artefacts/event_classifier.joblib
```
