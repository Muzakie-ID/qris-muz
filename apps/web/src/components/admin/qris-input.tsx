"use client";

import { useEffect, useRef, useState } from "react";
import { CircleAlert, CircleCheck, ImageUp, LoaderCircle } from "lucide-react";
import { previewQris } from "@/lib/qris-preview";
import { cn } from "@/lib/cn";
import { hintCls, inputCls, labelCls, textareaCls } from "@/lib/styles";

type BarcodeDetectorLike = { detect(src: ImageBitmap): Promise<{ rawValue: string }[]> };
declare global {
  interface Window {
    BarcodeDetector?: new (opts: { formats: string[] }) => BarcodeDetectorLike;
  }
}

/**
 * Membaca QR dari foto. Semua di browser: foto tidak dikirim ke server, hanya teks QRIS-nya.
 * Mencoba BarcodeDetector bawaan browser dulu (lebih tahan foto miring/buram), lalu jsQR di
 * beberapa ukuran gambar.
 */
async function decodeImage(file: File): Promise<string | null> {
  const bitmap = await createImageBitmap(file);
  try {
    if (window.BarcodeDetector) {
      try {
        const found = await new window.BarcodeDetector({ formats: ["qr_code"] }).detect(bitmap);
        if (found[0]?.rawValue) return found[0].rawValue;
      } catch {
        // tidak didukung di perangkat ini: lanjut ke jsQR
      }
    }
    const { default: jsQR } = await import("jsqr");
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const longest = Math.max(bitmap.width, bitmap.height);
    for (const target of [1200, 800, 1800, 500, longest]) {
      const scale = Math.min(1, target / longest);
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "attemptBoth" });
      if (code?.data) return code.data;
    }
    return null;
  } finally {
    bitmap.close();
  }
}

/** Isian label + QRIS untuk form Tambah QRIS: unggah foto atau tempel teks, dengan pratinjau. */
export function QrisInput({ packageField }: { packageField: React.ReactNode }) {
  const [payload, setPayload] = useState("");
  const [label, setLabel] = useState("");
  const [status, setStatus] = useState<{ tone: "busy" | "ok" | "bad"; text: string } | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const preview = payload ? previewQris(payload) : null;

  // Form dikosongkan setelah tersimpan (reset): ikut kosongkan isian yang dikendalikan di sini.
  useEffect(() => {
    const form = rootRef.current?.closest("form");
    const onReset = () => {
      setPayload("");
      setLabel("");
      setStatus(null);
    };
    form?.addEventListener("reset", onReset);
    return () => form?.removeEventListener("reset", onReset);
  }, []);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setStatus({ tone: "bad", text: "Pilih file gambar (JPG atau PNG)." });
      return;
    }
    setStatus({ tone: "busy", text: "Membaca QR dari foto…" });
    try {
      const text = await decodeImage(file);
      if (!text) {
        setStatus({
          tone: "bad",
          text: "QR tidak terbaca. Pakai foto yang lebih jelas dan lurus, atau screenshot QRIS dari aplikasi merchant.",
        });
        return;
      }
      const p = previewQris(text);
      if (!p) {
        setStatus({ tone: "bad", text: "QR terbaca, tetapi isinya bukan QRIS." });
        return;
      }
      setPayload(text.trim());
      if (!label && p.suggestedLabel) setLabel(p.suggestedLabel);
      setStatus({ tone: "ok", text: "QRIS terbaca dari foto. Periksa datanya di bawah sebelum menyimpan." });
    } catch {
      setStatus({
        tone: "bad",
        text: "Foto tidak bisa dibuka. Bila dari iPhone (HEIC), kirim sebagai JPG atau pakai screenshot.",
      });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  // Tempel screenshot langsung (Ctrl+V) saat form terbuka.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (!rootRef.current?.offsetParent) return; // form tertutup
      const file = Array.from(e.clipboardData?.files ?? []).find((f) => f.type.startsWith("image/"));
      if (file) {
        e.preventDefault();
        void handleFile(file);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  });

  return (
    <div ref={rootRef} className="flex flex-col gap-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handleFile(e.dataTransfer.files[0]);
        }}
        className={cn(
          "flex flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-6 text-center transition-colors",
          dragging ? "border-ink bg-subtle" : "border-line",
        )}
      >
        <ImageUp className="size-6 text-muted" strokeWidth={1.5} aria-hidden />
        <p className="font-medium">Unggah foto atau screenshot QRIS</p>
        <p className={hintCls}>Seret gambar ke sini, tempel (Ctrl+V), atau pilih file. Foto dibaca di browser dan tidak diunggah ke server.</p>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="mt-1 inline-flex h-10 items-center gap-2 rounded-full bg-ink px-4 text-[13px] font-medium text-white hover:bg-black"
        >
          Pilih foto
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          aria-label="Foto QRIS"
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
        {status && (
          <p
            role={status.tone === "bad" ? "alert" : "status"}
            className={cn(
              "inline-flex items-center gap-1.5 text-[13px]",
              status.tone === "ok" && "text-ok",
              status.tone === "bad" && "text-bad",
              status.tone === "busy" && "text-muted",
            )}
          >
            {status.tone === "busy" && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
            {status.text}
          </p>
        )}
      </div>

      {preview && <PreviewCard p={preview} />}
      {payload && !preview && (
        <p role="alert" className="text-[13px] text-bad">
          Teks ini bukan QRIS: harus diawali 000201 dengan struktur yang utuh.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className={labelCls}>
          Label
          <input
            name="label"
            required
            maxLength={100}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="DANA Bisnis"
            className={inputCls}
          />
        </label>
        {packageField}
      </div>

      <details className="rounded-xl border border-line-soft" open={!!payload && !preview}>
        <summary className="cursor-pointer px-3.5 py-2.5 text-[13px] font-medium text-muted hover:text-ink">
          Atau tempel teks QRIS secara manual
        </summary>
        <label className={`${labelCls} px-3.5 pb-3.5`}>
          Isi QRIS statis
          <textarea
            name="payload"
            rows={4}
            maxLength={1024}
            value={payload}
            onChange={(e) => {
              setPayload(e.target.value);
              setStatus(null);
            }}
            placeholder="00020101021126…6304ABCD"
            className={textareaCls}
          />
          <span className={hintCls}>Teks hasil pemindai QR biasa, diawali 000201 dan diakhiri 6304 + 4 karakter.</span>
        </label>
      </details>
    </div>
  );
}

function PreviewCard({ p }: { p: NonNullable<ReturnType<typeof previewQris>> }) {
  const problems = [
    !p.crcOk && "Kode pemeriksa (CRC) tidak cocok: QR rusak atau teks terpotong.",
    p.dynamic && "Ini QR dinamis (sudah berisi nominal). Gunakan QRIS statis yang dicetak/ditampilkan aplikasi merchant.",
  ].filter(Boolean) as string[];
  return (
    <div className={cn("rounded-xl border px-4 py-3", problems.length ? "border-bad/40 bg-bad-bg" : "border-ok/30 bg-ok-bg")}>
      <p className={cn("mb-2 inline-flex items-center gap-1.5 font-medium", problems.length ? "text-bad" : "text-ok")}>
        {problems.length ? (
          <CircleAlert className="size-4" strokeWidth={1.75} aria-hidden />
        ) : (
          <CircleCheck className="size-4" strokeWidth={1.75} aria-hidden />
        )}
        {problems.length ? "Periksa QRIS ini" : "QRIS statis valid"}
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]">
        <dt className="text-faint">Merchant</dt>
        <dd className="font-medium">{p.merchantName ?? "–"}</dd>
        <dt className="text-faint">Kota</dt>
        <dd>{p.city ?? "–"}</dd>
        <dt className="text-faint">NMID</dt>
        <dd className="font-mono text-xs">{p.nmid ?? "–"}</dd>
        <dt className="text-faint">Penyelenggara</dt>
        <dd className="break-all font-mono text-xs">{p.issuers.join(", ") || "–"}</dd>
      </dl>
      {problems.map((t) => (
        <p key={t} className="mt-2 text-[13px] text-bad">
          {t}
        </p>
      ))}
    </div>
  );
}
