/* utils/mask.ts — 敏感字段脱敏 */
const PHONE_PATTERN = /(\d{3})\d{4}(\d{2,4})/;
const EMAIL_PATTERN = /([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*(@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/;
const ID_CARD_PATTERN = /(\d{4})\d{8,12}(\d{4})/;

export function maskPhone(value?: string | null): string {
  if (!value) return '';
  return PHONE_PATTERN.test(value) ? value.replace(PHONE_PATTERN, '$1****$2') : value;
}

export function maskEmail(value?: string | null): string {
  if (!value) return '';
  return EMAIL_PATTERN.test(value) ? value.replace(EMAIL_PATTERN, '$1*****$2') : value;
}

export function maskIdCard(value?: string | null): string {
  if (!value) return '';
  return ID_CARD_PATTERN.test(value) ? value.replace(ID_CARD_PATTERN, '$1***********$2') : value;
}

export function maskText(text: string): string {
  if (!text) return text;
  let masked = text;
  if (EMAIL_PATTERN.test(masked)) masked = masked.replace(EMAIL_PATTERN, '$1*****$2');
  if (ID_CARD_PATTERN.test(masked)) masked = masked.replace(ID_CARD_PATTERN, '$1***********$2');
  const phoneOnly = masked.replace(/\D/g, '');
  if (PHONE_PATTERN.test(phoneOnly)) masked = masked.replace(PHONE_PATTERN, '$1****$2');
  return masked;
}
