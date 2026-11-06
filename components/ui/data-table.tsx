"use client";

import type { KeyboardEvent, ReactNode } from "react";
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

export function DataTable<T>({
  ariaLabel,
  columns,
  rows,
  rowKey,
  rowLabel,
  onRowActivate,
  empty,
  minWidth = 680,
}: {
  ariaLabel: string;
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  rowLabel?: (row: T) => string;
  onRowActivate?: (row: T) => void;
  empty: ReactNode;
  minWidth?: number;
}) {
  const activate = (row: T) => onRowActivate?.(row);
  const onKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, row: T) => {
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
            <col key={column.key} style={{ width: column.width }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col">
                {column.label}
              </th>
            ))}
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
            >
              {columns.map((column) => (
                <td key={column.key} className={column.className}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className={styles.empty}>
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
