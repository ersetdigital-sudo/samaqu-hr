"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { Icon } from "@/components/icons";
import styles from "./data-table.module.css";

export type DataTableColumn<T> = {
  key: string;
  label: ReactNode;
  width: string;
  className?: string;
  render: (row: T) => ReactNode;
};

export function TwoLineCell({
  primary,
  secondary,
}: {
  primary: string;
  secondary?: string;
}) {
  return (
    <span className={styles.twoLine}>
      <span className={styles.primary} title={primary}>
        {primary}
      </span>
      {secondary ? (
        <span className={styles.secondary} title={secondary}>
          {secondary}
        </span>
      ) : null}
    </span>
  );
}

export function EllipsisText({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  return (
    <span className={`${styles.ellipsis} ${className}`.trim()} title={text}>
      {text}
    </span>
  );
}

type RowAction<T> = {
  ariaLabel: (row: T) => string;
  label?: string;
  width?: number;
  onClick?: (row: T) => void;
};

export function DataTable<T>({
  ariaLabel,
  columns,
  rows,
  rowKey,
  rowLabel,
  onRowActivate,
  onRowPrefetch,
  rowAction,
  empty,
  minWidth = 680,
}: {
  ariaLabel: string;
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  rowLabel?: (row: T) => string;
  onRowActivate?: (row: T) => void;
  /** Prefetch ringan saat baris di-hover/disentuh/difokus. */
  onRowPrefetch?: (row: T) => void;
  rowAction?: RowAction<T>;
  empty: ReactNode;
  minWidth?: number;
}) {
  const actionWidth = rowAction?.width ?? 56;
  const percentageWidths = columns.every((column) =>
    column.width.trim().endsWith("%"),
  );
  const widthTotal = columns.reduce(
    (total, column) => total + (Number.parseFloat(column.width) || 0),
    0,
  );
  const columnWidth = (width: string) => {
    if (!rowAction || !widthTotal || !percentageWidths) return width;
    const percent = Number.parseFloat(width);
    if (!Number.isFinite(percent)) return width;
    const normalized = percent / widthTotal;
    return `calc(${(normalized * 100).toFixed(4)}% - ${(
      normalized * actionWidth
    ).toFixed(4)}px)`;
  };
  const activate = (row: T) => onRowActivate?.(row);
  const onKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, row: T) => {
    if (event.target !== event.currentTarget) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    activate(row);
  };

  return (
    <div className={styles.wrap}>
      <table
        className={styles.table}
        style={{ minWidth }}
        aria-label={ariaLabel}
      >
        <colgroup>
          {columns.map((column) => (
            <col
              key={column.key}
              style={{ width: columnWidth(column.width) }}
            />
          ))}
          {rowAction && <col style={{ width: actionWidth }} />}
        </colgroup>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col">
                {column.label}
              </th>
            ))}
            {rowAction && (
              <th className={styles.actionHeader} aria-label="Aksi" />
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className={`${styles.row} ${onRowActivate ? styles.clickable : ""}`}
              tabIndex={onRowActivate ? 0 : undefined}
              aria-label={rowLabel?.(row)}
              onClick={() => activate(row)}
              onKeyDown={(event) => onKeyDown(event, row)}
              onPointerEnter={() => onRowPrefetch?.(row)}
              onTouchStart={() => onRowPrefetch?.(row)}
              onFocus={() => onRowPrefetch?.(row)}
            >
              {columns.map((column) => (
                <td key={column.key} className={column.className}>
                  {column.render(row)}
                </td>
              ))}
              {rowAction && (
                <td className={styles.actionCell}>
                  <button
                    type="button"
                    className={styles.rowAction}
                    aria-label={rowAction.ariaLabel(row)}
                    data-tooltip={rowAction.label ?? "Lihat detail"}
                    onClick={(event) => {
                      event.stopPropagation();
                      (rowAction.onClick ?? onRowActivate)?.(row);
                    }}
                  >
                    <Icon name="chevron" style={{ width: 16, height: 16 }} />
                  </button>
                </td>
              )}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={columns.length + (rowAction ? 1 : 0)}
                className={styles.empty}
              >
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
