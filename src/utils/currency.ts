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
