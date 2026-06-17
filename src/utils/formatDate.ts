export function formatDate(value: string | Date | null | undefined, fallback = '不明'): string {
  if (value == null) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  return isNaN(date.getTime()) ? fallback : date.toLocaleDateString('ja-JP');
}

export function formatDateTime(value: string | Date | null | undefined, fallback = '不明'): string {
  if (value == null) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return fallback;
  return date.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
