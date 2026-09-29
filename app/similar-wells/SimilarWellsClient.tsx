"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { SlidersHorizontal, ArrowRight, RotateCcw, Info } from "lucide-react";
import { useNwisWorkspace } from "@/components/nwis-workspace-context";
import {
  findSimilarWells,
  defaultWeights,
  SimilarityWeights,
  SimilarityResult,
} from "@/lib/engineering/similarity";
import { Button } from "@/components/ui/Button";
import { ProvenanceChip } from "@/components/ui/ProvenanceChip";

export function SimilarWellsClient() {
  const { selectedWell } = useNwisWorkspace();
  const [weights, setWeights] = useState<SimilarityWeights>({ ...defaultWeights });

  const handleWeightChange = (key: keyof SimilarityWeights, val: number) => {
    setWeights((prev) => ({ ...prev, [key]: val }));
  };

  const resetWeights = () => {
    setWeights({ ...defaultWeights });
  };

  // Normalized weight total
  const weightSum = useMemo(() => {
    return Object.values(weights).reduce((a, b) => a + b, 0);
  }, [weights]);

  // Compute live ranked candidates
  const results: SimilarityResult[] = useMemo(() => {
    try {
      return findSimilarWells(selectedWell, { weights, limit: 10 });
    } catch {
      return [];
    }
  }, [selectedWell, weights]);

  return (
    <div className="space-y-4">
      {/* Weights Configurator Panel */}
      <div className="rounded-[6px] border border-line bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-accent" />
            <span className="text-xs font-semibold text-ink">Explainable criteria weights</span>
            <span className="text-xs text-ink-3">· Normalized live scoring</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-ink-3 tabular-nums">
              Total weight:{" "}
              <strong
                className={`font-semibold ${
                  Math.abs(weightSum - 1.0) < 0.05 ? "text-status-ok" : "text-status-moderate"
                }`}
              >
                {weightSum.toFixed(2)}
              </strong>
            </span>
            <Button variant="secondary" size="sm" onClick={resetWeights}>
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset weights
            </Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5 text-xs">
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-ink font-medium">Spatial proximity</span>
              <span className="tabular-nums font-semibold text-accent">
                {(weights.spatial * 100).toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={weights.spatial}
              onChange={(e) => handleWeightChange("spatial", parseFloat(e.target.value))}
              className="w-full accent-accent cursor-pointer"
            />
            <span className="text-ink-3 text-xs">Decays with km distance</span>
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <span className="text-ink font-medium">Formation overlap</span>
              <span className="tabular-nums font-semibold text-accent">
                {(weights.formationOverlap * 100).toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={weights.formationOverlap}
              onChange={(e) =>
                handleWeightChange("formationOverlap", parseFloat(e.target.value))
              }
              className="w-full accent-accent cursor-pointer"
            />
            <span className="text-ink-3 text-xs">Stratigraphic interval match</span>
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <span className="text-ink font-medium">Depth similarity</span>
              <span className="tabular-nums font-semibold text-accent">
                {(weights.depthSimilarity * 100).toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={weights.depthSimilarity}
              onChange={(e) =>
                handleWeightChange("depthSimilarity", parseFloat(e.target.value))
              }
              className="w-full accent-accent cursor-pointer"
            />
            <span className="text-ink-3 text-xs">Target TD proximity</span>
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <span className="text-ink font-medium">Incident profile</span>
              <span className="tabular-nums font-semibold text-accent">
                {(weights.eventSimilarity * 100).toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={weights.eventSimilarity}
              onChange={(e) =>
                handleWeightChange("eventSimilarity", parseFloat(e.target.value))
              }
              className="w-full accent-accent cursor-pointer"
            />
            <span className="text-ink-3 text-xs">Shared hazard taxonomy</span>
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <span className="text-ink font-medium">Well profile</span>
              <span className="tabular-nums font-semibold text-accent">
                {(weights.wellType * 100).toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={weights.wellType}
              onChange={(e) => handleWeightChange("wellType", parseFloat(e.target.value))}
              className="w-full accent-accent cursor-pointer"
            />
            <span className="text-ink-3 text-xs">Vertical vs directional</span>
          </div>
        </div>
      </div>

      {/* Ranked Offset Wells List */}
      <div className="space-y-3">
        {results.map((res, rank) => {
          const pct = Math.round(res.score * 100);

          return (
            <div
              key={res.wellId}
              className="rounded-[6px] border border-line bg-surface p-4 text-ink hover:border-line-strong transition"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-[3px] bg-surface-muted text-xs font-semibold tabular-nums text-ink-2">
                    #{rank + 1}
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-ink">{res.wellId}</h3>
                    <div className="text-xs text-ink-3">
                      Candidate offset for active well {selectedWell.id}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-xs text-ink-3">Similarity score</div>
                    <div className="text-xl font-semibold tabular-nums text-ink">{pct}%</div>
                  </div>

                  <Link
                    href={`/compare?primary=${selectedWell.id}&offset=${res.wellId}`}
                    className="inline-flex items-center gap-1 rounded-[4px] border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-surface-muted transition"
                  >
                    <span>Compare</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>

              {/* Component breakdown bar */}
              <div className="mt-3">
                <div className="h-1.5 w-full rounded-[2px] bg-line overflow-hidden flex">
                  {res.components.map((comp) => {
                    const widthPct = Math.max(0, comp.weightedScore * 100);
                    return (
                      <div
                        key={comp.key}
                        style={{ width: `${widthPct}%` }}
                        className={
                          comp.key === "formationOverlap"
                            ? "bg-primary"
                            : comp.key === "spatial"
                            ? "bg-status-ok"
                            : comp.key === "eventSimilarity"
                            ? "bg-status-high"
                            : comp.key === "depthSimilarity"
                            ? "bg-ink-2"
                            : "bg-line-strong"
                        }
                        title={`${comp.label}: ${(comp.score * 100).toFixed(0)}% (weight: ${(
                          comp.weight * 100
                        ).toFixed(0)}%)`}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Evidence chips */}
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {res.components.map((comp) => (
                  <span
                    key={comp.key}
                    className="inline-flex items-center gap-1.5 rounded-[4px] border border-line bg-surface-muted px-2 py-0.5 text-ink-2"
                  >
                    <span className="font-medium text-ink">{comp.label}:</span>
                    <span className="tabular-nums">{(comp.score * 100).toFixed(0)}%</span>
                    <span className="text-ink-3 truncate max-w-[180px]">({comp.evidence})</span>
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <ProvenanceChip
          source="Engineering similarity engine (deterministic)"
          recordCount={results.length}
          simulatedCount={0}
        />
        <div className="flex items-center gap-1 text-xs text-ink-3">
          <Info className="h-3.5 w-3.5" />
          <span>Scores update deterministically when weights are adjusted</span>
        </div>
      </div>
    </div>
  );
}
