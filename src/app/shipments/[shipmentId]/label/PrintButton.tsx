"use client";

export function PrintButton() {
  return (
    <button
      className="rounded border px-3 py-2 text-sm"
      type="button"
      onClick={() => window.print()}
    >
      Imprimir
    </button>
  );
}
