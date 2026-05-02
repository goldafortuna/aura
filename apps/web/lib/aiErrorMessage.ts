import { ZodError } from 'zod';
import type { AiCallConfig } from './aiClient';

function getErrorMessage(err: unknown) {
  return err instanceof Error ? err.message : 'Unknown error';
}

export function toUserFacingAiError(err: unknown, attemptedConfigs: AiCallConfig[] = []) {
  if (err instanceof ZodError) {
    return 'Format respons AI tidak sesuai (Ringkasan/temuan tidak valid). Coba analisa ulang; dokumen sangat panjang bisa membuat respons terpotong — kurangi ukuran atau gunakan model lain.';
  }

  const message = getErrorMessage(err);

  if (/AI content was not valid JSON/i.test(message)) {
    return 'Respons model AI bukan JSON yang valid. Coba analisa ulang; periksa model dan prompt di Pengaturan.';
  }
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
