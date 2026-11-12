"use client";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Sorot bagian teks yang cocok dengan pencarian. */
export function Highlight({ text, term }: { text: string; term: string }) {
  const query = term.trim();
  if (!query) return <>{text}</>;

  const pattern = new RegExp(`(${escapeRegExp(query)})`, "gi");
  const parts = text.split(pattern);

  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark
            key={index}
            style={{
              background: "var(--pink-50)",
              color: "inherit",
              borderRadius: 3,
              padding: "0 1px",
            }}
          >
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </>
  );
}
