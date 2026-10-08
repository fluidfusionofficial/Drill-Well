# ml/features — feature extraction layer for NWIS ML pipeline.
# All extraction functions read from the database; they never fabricate values.
# Missing data is returned as NaN, not imputed silently.
