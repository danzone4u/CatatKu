export function formatRupiah(amount: number): string {
  const formatted = Math.abs(amount)
    .toFixed(0)
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `Rp ${amount < 0 ? '-' : ''}${formatted}`;
}

export function parseRupiahInput(text: string): number {
  const cleaned = text.replace(/[^\d]/g, '');
  return parseInt(cleaned, 10) || 0;
}

export function formatNumberThousand(val: string | number): string {
  const cleaned = String(val).replace(/[^\d]/g, '');
  if (!cleaned) return '';
  const num = parseInt(cleaned, 10);
  if (isNaN(num)) return '';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
