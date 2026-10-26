const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr.replace(' ', 'T'));
  if (isNaN(date.getTime())) return dateStr;

  const day = DAYS[date.getDay()];
  const d = date.getDate();
  const month = MONTHS[date.getMonth()];
  const year = date.getFullYear();

  // Jika dateStr memiliki jam, tampilkan waktu (HH:mm:ss)
  if (dateStr.includes(':') || dateStr.includes('T')) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${day}, ${d} ${month} ${year} • ${hours}:${minutes}:${seconds}`;
  }

  return `${day}, ${d} ${month} ${year}`;
}

export function formatDateShort(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr.replace(' ', 'T'));
  if (isNaN(date.getTime())) return dateStr;

  const d = date.getDate();
  const month = MONTHS[date.getMonth()]?.substring(0, 3);

  if (dateStr.includes(':') || dateStr.includes('T')) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${d} ${month} • ${hours}:${minutes}`;
  }

  return `${d} ${month}`;
}

export function formatDateOnly(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr.replace(' ', 'T'));
  if (isNaN(date.getTime())) return dateStr.split(' ')[0] || dateStr;

  const d = String(date.getDate()).padStart(2, '0');
  const month = MONTHS[date.getMonth()]?.substring(0, 3);
  const year = date.getFullYear();

  return `${d} ${month} ${year}`;
}

export function formatTimeOnly(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr.replace(' ', 'T'));
  if (isNaN(date.getTime())) return '';
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

export function getMonthName(month: number): string {
  return MONTHS[month - 1] ?? '';
}

export function getToday(): string {
  return new Date().toISOString().split('T')[0]!;
}

export function getNowFull(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export function getCurrentMonth(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}
