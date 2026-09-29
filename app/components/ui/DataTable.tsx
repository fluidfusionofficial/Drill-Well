import React from "react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  align?: "left" | "right" | "center";
  width?: string | number;
  sortable?: boolean;
  render?: (row: T, index: number) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T, index: number) => string;
  selectedKey?: string | null;
  onSelectRow?: (row: T) => void;
  sortColumn?: string;
  sortDirection?: "asc" | "desc";
  onSort?: (key: string) => void;
  emptyMessage?: string;
  className?: string;
  maxHeight?: string | number;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  selectedKey,
  onSelectRow,
  sortColumn,
  sortDirection,
  onSort,
  emptyMessage = "No records found.",
  className = "",
  maxHeight,
}: DataTableProps<T>) {
  return (
    <div
      className={`overflow-auto border border-line rounded-[6px] bg-surface ${className}`}
      style={maxHeight ? { maxHeight } : undefined}
    >
      <table className="w-full border-collapse text-left text-xs">
        <thead className="sticky top-0 z-10 bg-surface-muted border-b border-line">
          <tr>
            {columns.map((col) => {
              const isSorted = sortColumn === col.key;
              const alignClass =
                col.align === "right"
                  ? "text-right"
                  : col.align === "center"
                  ? "text-center"
                  : "text-left";

              return (
                <th
                  key={col.key}
                  style={col.width ? { width: col.width } : undefined}
                  className={`h-9 px-3 font-medium text-ink-3 select-none ${alignClass}`}
                >
                  {col.sortable && onSort ? (
                    <button
                      type="button"
                      onClick={() => onSort(col.key)}
                      className="inline-flex items-center gap-1 font-medium text-ink-3 hover:text-ink cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded-[3px] py-0.5"
                    >
                      <span>{col.header}</span>
                      {isSorted ? (
                        sortDirection === "asc" ? (
                          <ArrowUp className="h-3 w-3 text-accent" />
                        ) : (
                          <ArrowDown className="h-3 w-3 text-accent" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 text-ink-3/50" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-line text-ink">
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="h-20 text-center text-ink-3 px-4"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, index) => {
              const key = keyExtractor(row, index);
              const isSelected = selectedKey === key;

              return (
                <tr
                  key={key}
                  tabIndex={onSelectRow ? 0 : undefined}
                  onClick={onSelectRow ? () => onSelectRow(row) : undefined}
                  onKeyDown={
                    onSelectRow
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onSelectRow(row);
                          }
                        }
                      : undefined
                  }
                  className={`h-9 transition-colors ${
                    isSelected
                      ? "bg-primary-soft text-accent font-medium"
                      : "hover:bg-surface-muted"
                  } ${
                    onSelectRow
                      ? "cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent"
                      : ""
                  }`}
                >
                  {columns.map((col) => {
                    const alignClass =
                      col.align === "right"
                        ? "text-right tabular-nums"
                        : col.align === "center"
                        ? "text-center"
                        : "text-left";

                    return (
                      <td key={col.key} className={`px-3 py-1.5 ${alignClass}`}>
                        {col.render
                          ? col.render(row, index)
                          : ((row as Record<string, unknown>)[col.key] as React.ReactNode)}
                      </td>
                    );
                  })}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
