"use client";

import { startTransition, useActionState } from "react";
import { CircleCheck, CircleX } from "lucide-react";
import { testParserAction, type ActionResult } from "@/app/admin-actions";
import { SubmitButton } from "@/components/admin/action-form";
import { formatRupiah } from "@/lib/format";
import { btnPrimary, hintCls, inputCls, labelCls, textareaCls } from "@/lib/styles";

/** Mencoba teks notifikasi terhadap pola baru, atau terhadap semua parser aktif. */
export function ParserTester() {
  const [state, run] = useActionState<ActionResult, FormData>(testParserAction, { error: null });
  const r = state.error ? undefined : state.parserTest;
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => run(data));
      }}
    >
      <label className={labelCls}>
        Teks notifikasi
        <textarea
          name="text"
          required
          rows={3}
          maxLength={2000}
          placeholder="Pembayaran Masuk&#10;Rp50.087 diterima DANA Bisnis."
          className={textareaCls}
        />
        <span className={hintCls}>Salin judul dan isi notifikasi apa adanya, satu baris masing-masing.</span>
      </label>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className={labelCls}>
          Package
          <input name="package_name" list="parser-packages" placeholder="Kosong: hanya parser umum" className={`${inputCls} font-mono text-xs`} />
        </label>
        <label className={labelCls}>
          Pola yang dicoba
          <input name="pattern" placeholder="Kosong: pakai semua parser aktif" className={`${inputCls} font-mono text-xs`} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton className={btnPrimary} pendingLabel="Menguji…">
          Uji
        </SubmitButton>
        {state.error && (
          <p role="alert" className="text-[13px] text-bad">
            {state.error}
          </p>
        )}
        {r &&
          (r.matched ? (
            <p role="status" className="inline-flex items-center gap-1.5 text-[13px] text-ok">
              <CircleCheck className="size-4" strokeWidth={1.75} aria-hidden />
              Terbaca <strong className="font-semibold">{formatRupiah(r.amount!)}</strong>
              {r.parser_id !== "uji" && <span className="font-mono text-xs text-faint">oleh {r.parser_id}</span>}
              {r.auto_match === false && <span className="text-warn">· tidak dicocokkan otomatis</span>}
            </p>
          ) : (
            <p role="status" className="inline-flex items-center gap-1.5 text-[13px] text-bad">
              <CircleX className="size-4" strokeWidth={1.75} aria-hidden />
              Tidak ada pola yang bisa membaca nominal dari teks ini.
            </p>
          ))}
      </div>
    </form>
  );
}
