"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";

function isoToDisplay(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
}

function displayToIso(value: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function formatInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function DateFilterInput({
  value,
  onChange,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}) {
  const [text, setText] = useState(() => isoToDisplay(value));
  const picker = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setText(isoToDisplay(value));
  }, [value]);

  function commit() {
    if (!text.trim()) {
      onChange("");
      setText("");
      return;
    }
    const iso = displayToIso(text);
    if (iso) {
      onChange(iso);
      setText(isoToDisplay(iso));
    } else {
      setText(isoToDisplay(value));
    }
  }

  return (
    <div className="relative">
      <input
        type="text"
        className="inp inp-date"
        value={text}
        placeholder="dd/mm/yyyy"
        autoComplete="off"
        inputMode="numeric"
        maxLength={10}
        aria-label={ariaLabel}
        onChange={(event) => setText(formatInput(event.target.value))}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
            event.currentTarget.blur();
          }
        }}
      />
      <button
        type="button"
        className="date-picker-btn"
        aria-label={`Pilih ${ariaLabel.toLowerCase()}`}
        onClick={() => {
          const input = picker.current;
          if (!input) return;
          try {
            if (typeof input.showPicker === "function") input.showPicker();
            else input.click();
          } catch {
            input.click();
          }
        }}
      >
        <Icon name="cal" style={{ width: 14, height: 14 }} />
      </button>
      <input
        ref={picker}
        type="date"
        className="date-native"
        tabIndex={-1}
        aria-hidden="true"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setText(isoToDisplay(event.target.value));
        }}
      />
    </div>
  );
}
