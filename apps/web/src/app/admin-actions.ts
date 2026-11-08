"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import {
  ApiError,
  createApiKey,
  createPairingToken,
  createParser,
  createProject,
  createQrisSource,
  changePassword,
  NOTIFY_CATEGORIES,
  reprocessEvents,
  revokeOwnerSession,
  testTelegram,
  totpDisable,
  totpEnable,
  totpSetup,
  updateTelegram,
  retryWebhookDelivery,
  revokeApiKey,
  revokeDevice,
  sendDeviceCommand,
  testParser,
  updateParser,
  updateProject,
  updateQrisSource,
  type DeviceCommand,
  type PairingToken,
  type ParserTestResult,
} from "@/lib/api";
import { requireSession } from "./actions";

/** Hasil server action halaman pengelolaan. `at` berubah tiap kali action selesai. */
export interface ActionResult {
  error: string | null;
  message?: string;
  secret?: { label: string; value: string };
  pairing?: PairingToken;
  parserTest?: ParserTestResult;
  totp?: { secret: string; otpauth_uri: string };
  at?: number;
}

type Outcome = Omit<ActionResult, "error" | "at"> | void;

async function run(path: string | string[], fn: () => Promise<Outcome>): Promise<ActionResult> {
  await requireSession();
  try {
    const out = (await fn()) ?? {};
    for (const p of Array.isArray(path) ? path : [path]) revalidatePath(p);
    return { error: null, ...out, at: Date.now() };
  } catch (e) {
    unstable_rethrow(e); // mis. pengalihan ke /login saat sesi berakhir
    return {
      error: e instanceof ApiError || e instanceof FormError ? e.message : "Terjadi kesalahan. Coba lagi.",
      at: Date.now(),
    };
  }
}

class FormError extends Error {}

function text(form: FormData, name: string): string {
  return String(form.get(name) ?? "").trim();
}

function required(form: FormData, name: string, label: string): string {
  const v = text(form, name);
  if (!v) throw new FormError(`${label} wajib diisi.`);
  return v;
}

/** Kosong berarti dihapus (null). */
function nullable(form: FormData, name: string): string | null {
  return text(form, name) || null;
}

function int(form: FormData, name: string, label: string): number | undefined {
  const v = text(form, name);
  if (!v) return undefined;
  const n = Number(v);
  if (!Number.isInteger(n)) throw new FormError(`${label} harus bilangan bulat.`);
  return n;
}

const checked = (form: FormData, name: string) => form.get(name) === "on";

function fail(message: string): never {
  throw new FormError(message);
}

// --- Proyek & API key ---

export async function createProjectAction(_: ActionResult, form: FormData) {
  return run("/proyek", async () => {
    const p = await createProject({
      name: required(form, "name", "Nama proyek"),
      webhook_url: nullable(form, "webhook_url") ?? undefined,
      default_return_url: nullable(form, "default_return_url") ?? undefined,
      default_qris_source_id: nullable(form, "default_qris_source_id") ?? undefined,
      default_expiry_min: int(form, "default_expiry_min", "Masa berlaku"),
    });
    return {
      message: `Proyek ${p.name} dibuat. Buat API key di kartunya untuk mulai memakai API.`,
      secret: { label: "Webhook secret", value: p.webhook_secret },
    };
  });
}

export async function updateProjectAction(_: ActionResult, form: FormData) {
  return run("/proyek", async () => {
    await updateProject(required(form, "project_id", "Proyek"), {
      name: required(form, "name", "Nama proyek"),
      webhook_url: nullable(form, "webhook_url"),
      default_return_url: nullable(form, "default_return_url"),
      default_qris_source_id: nullable(form, "default_qris_source_id"),
      default_expiry_min: int(form, "default_expiry_min", "Masa berlaku"),
    });
    return { message: "Perubahan disimpan." };
  });
}

export async function createApiKeyAction(_: ActionResult, form: FormData) {
  return run("/proyek", async () => {
    const k = await createApiKey(required(form, "project_id", "Proyek"));
    return { secret: { label: "API key", value: k.api_key } };
  });
}

export async function revokeApiKeyAction(_: ActionResult, form: FormData) {
  return run("/proyek", async () => {
    await revokeApiKey(required(form, "key_id", "API key"));
  });
}

// --- Perangkat ---

export async function createPairingAction(_: ActionResult, form: FormData) {
  return run("/perangkat", async () => ({
    pairing: await createPairingToken(required(form, "device_name", "Nama perangkat")),
  }));
}

const COMMAND_LABEL: Record<DeviceCommand, string> = {
  rescan: "Pindai ulang notifikasi",
  refresh_config: "Muat ulang konfigurasi",
  flush_queue: "Kirim antrian sekarang",
};

export async function deviceCommandAction(_: ActionResult, form: FormData) {
  return run("/perangkat", async () => {
    const command = text(form, "command") as DeviceCommand;
    if (!(command in COMMAND_LABEL)) throw new FormError("Perintah tidak dikenal.");
    await sendDeviceCommand(required(form, "device_id", "Perangkat"), command);
    return { message: `"${COMMAND_LABEL[command]}" dikirim lewat heartbeat berikutnya.` };
  });
}

export async function revokeDeviceAction(_: ActionResult, form: FormData) {
  return run(["/perangkat", "/"], async () => {
    await revokeDevice(required(form, "device_id", "Perangkat"));
  });
}

// --- QRIS ---

export async function createQrisAction(_: ActionResult, form: FormData) {
  return run("/qris", async () => {
    const q = await createQrisSource({
      label: required(form, "label", "Label"),
      // Hanya buang baris baru dari hasil tempel; spasi bagian dari nama merchant.
      payload:
        text(form, "payload").replace(/[\r\n]+/g, "") ||
        fail("Unggah foto QRIS atau tempel teks QRIS-nya dulu."),
      source_package: nullable(form, "source_package") ?? undefined,
    });
    return { message: `QRIS ${q.merchant_name} ditambahkan.` };
  });
}

export async function updateQrisAction(_: ActionResult, form: FormData) {
  return run("/qris", async () => {
    await updateQrisSource(required(form, "qris_id", "QRIS"), {
      label: required(form, "label", "Label"),
      source_package: nullable(form, "source_package"),
    });
    return { message: "Perubahan disimpan." };
  });
}

export async function toggleQrisAction(_: ActionResult, form: FormData) {
  return run("/qris", async () => {
    await updateQrisSource(required(form, "qris_id", "QRIS"), { is_active: text(form, "is_active") === "true" });
  });
}

// --- Parser ---

function parserFields(form: FormData) {
  return {
    package_name: nullable(form, "package_name"),
    pattern: required(form, "pattern", "Pola"),
    priority: int(form, "priority", "Prioritas"),
    auto_match: checked(form, "auto_match"),
    is_active: checked(form, "is_active"),
  };
}

export async function createParserAction(_: ActionResult, form: FormData) {
  return run("/parser", async () => {
    await createParser(parserFields(form));
    return { message: "Parser ditambahkan. Proses ulang mutasi agar notifikasi lama ikut terbaca." };
  });
}

export async function updateParserAction(_: ActionResult, form: FormData) {
  return run("/parser", async () => {
    await updateParser(required(form, "parser_id", "Parser"), parserFields(form));
    return { message: "Perubahan disimpan." };
  });
}

export async function testParserAction(_: ActionResult, form: FormData) {
  return run([], async () => ({
    parserTest: await testParser({
      package_name: text(form, "package_name") || undefined,
      text: required(form, "text", "Teks notifikasi"),
      pattern: text(form, "pattern") || undefined,
    }),
  }));
}

// --- Webhook & mutasi ---

export async function retryWebhookAction(_: ActionResult, form: FormData) {
  return run("/webhook", async () => {
    await retryWebhookDelivery(required(form, "delivery_id", "Pengiriman"));
    return { message: "Dijadwalkan, dikirim dalam beberapa detik." };
  });
}

export async function reprocessEventsAction() {
  return run(["/mutasi", "/parser", "/"], async () => {
    const r = await reprocessEvents();
    return {
      message:
        r.processed === 0
          ? "Tidak ada mutasi yang perlu diproses ulang."
          : `${r.processed} mutasi diproses ulang, ${r.matched} cocok dengan transaksi.`,
    };
  });
}

// --- Pengaturan: akun, 2FA, sesi ---

export async function changePasswordAction(_: ActionResult, form: FormData) {
  return run("/pengaturan", async () => {
    const next = String(form.get("new_password") ?? "");
    if (next !== String(form.get("confirm_password") ?? "")) throw new FormError("Ulangi password baru dengan sama persis.");
    await changePassword(String(form.get("current_password") ?? ""), next);
    return { message: "Password diganti. Sesi di perangkat lain sudah dikeluarkan." };
  });
}

export async function totpSetupAction() {
  return run([], async () => ({ totp: await totpSetup() }));
}

export async function totpEnableAction(_: ActionResult, form: FormData) {
  return run(["/pengaturan", "/"], async () => {
    await totpEnable(required(form, "code", "Kode").replace(/\s/g, ""));
    return { message: "2FA aktif. Login berikutnya meminta kode dari aplikasi authenticator." };
  });
}

export async function totpDisableAction(_: ActionResult, form: FormData) {
  return run(["/pengaturan", "/"], async () => {
    await totpDisable(String(form.get("password") ?? ""), required(form, "code", "Kode").replace(/\s/g, ""));
    return { message: "2FA dimatikan." };
  });
}

export async function revokeSessionAction(_: ActionResult, form: FormData) {
  return run("/pengaturan", async () => {
    await revokeOwnerSession(required(form, "session_id", "Sesi"));
  });
}

// --- Pengaturan: Telegram ---

export async function updateTelegramAction(_: ActionResult, form: FormData) {
  return run("/pengaturan", async () => {
    const token = text(form, "bot_token");
    await updateTelegram({
      // Kosong = token lama tetap dipakai.
      ...(token && { bot_token: token }),
      chat_id: nullable(form, "chat_id"),
      enabled: checked(form, "enabled"),
      categories: Object.fromEntries(NOTIFY_CATEGORIES.map((c) => [c, checked(form, `cat_${c}`)])),
    });
    return { message: "Pengaturan Telegram disimpan." };
  });
}

export async function testTelegramAction() {
  return run([], async () => {
    await testTelegram();
    return { message: "Pesan uji terkirim. Cek chat Telegram Anda." };
  });
}
