import type { AiCallConfig } from './aiClient';

function getErrorMessage(err: unknown) {
  return err instanceof Error ? err.message : 'Unknown error';
}

export function toUserFacingAiError(err: unknown, attemptedConfigs: AiCallConfig[] = []) {
  const message = getErrorMessage(err);
  const primaryModel = attemptedConfigs[0]?.model;

  if (/not_found_error/i.test(message) && /model:/i.test(message)) {
    const modelText = primaryModel ? ` (${primaryModel})` : '';
    return `Model AI aktif tidak ditemukan${modelText}. Perbarui model di Pengaturan AI atau nonaktifkan provider personal agar sistem memakai provider default.`;
  }

  if (/API key AI belum diset/i.test(message)) {
    return message;
  }

  if (/AI request failed/i.test(message)) {
    return `Permintaan ke provider AI gagal. Periksa model, API key, dan base URL provider yang aktif.`;
  }

  return message;
}
