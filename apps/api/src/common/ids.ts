import { ulid } from 'ulid';

/** ID acak berurutan waktu (ULID), dengan awalan jenis agar mudah dikenali di log. */
export const newId = {
  project: () => `prj_${ulid()}`,
  apiKey: () => `key_${ulid()}`,
  qris: () => `qrs_${ulid()}`,
  device: () => `dev_${ulid()}`,
  pairing: () => `pair_${ulid()}`,
  transaction: () => ulid(),
  event: () => `evt_${ulid()}`,
  parser: () => `psr_${ulid()}`,
  delivery: () => `whd_${ulid()}`,
  webhookEvent: () => `whe_${ulid()}`,
  audit: () => `aud_${ulid()}`,
};
