import type { SQLiteDatabase } from 'expo-sqlite';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getCashbookOpeningBalance } from '../database/queries';
import { formatDate, formatDateOnly } from './date';

interface ExportCsvOptions {
  cashbookId?: number;
  cashbookName?: string;
  yearMonth?: string; // YYYY-MM
}

/**
 * Ekspor transaksi bulanan ke format CSV kompatibel Excel (UTF-8 BOM)
 * Dapat langsung dibagikan via WhatsApp, Email, atau aplikasi lainnya.
 */
export async function exportMonthlyTransactionsCsv(
  db: SQLiteDatabase,
  options?: ExportCsvOptions
): Promise<{ success: boolean; message: string }> {
  const isAvailable = await Sharing.isAvailableAsync();

  const now = new Date();
  const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const ym = options?.yearMonth || currentYearMonth;

  const [yearStr, monthStr] = ym.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const lastDay = new Date(year, month, 0).getDate();

  const startDateStr = `${ym}-01`;
  const endDateStr = `${ym}-${String(lastDay).padStart(2, '0')}`;

  const cashbookId = options?.cashbookId ?? 0;
  const cashbookName = options?.cashbookName || 'Semua Kas';

  let query = `
    SELECT t.id, t.type, t.amount, t.date, t.note, t.is_void, c.name as category_name, a.name as account_name
    FROM transactions t
    JOIN categories c ON t.category_id = c.id
    LEFT JOIN accounts a ON t.account_id = a.id
    WHERE t.date >= ? AND t.date <= ?
  `;
  const params: (string | number)[] = [startDateStr, endDateStr];

  if (cashbookId > 0) {
    query += ' AND t.cashbook_id = ?';
    params.push(cashbookId);
  }

  query += ' ORDER BY t.date ASC, t.id ASC';

  const rows = await db.getAllAsync<{
    id: number;
    type: 'income' | 'expense';
    amount: number;
    date: string;
    note: string;
    is_void: number;
    category_name: string;
    account_name: string | null;
  }>(query, ...params);

  const openingBalance = cashbookId > 0
    ? await getCashbookOpeningBalance(db, cashbookId, startDateStr)
    : 0;

  const escapeCsv = (val: string | number | null | undefined) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const lines: string[] = [];
  lines.push('\uFEFF'); // UTF-8 BOM untuk Microsoft Excel
  lines.push(`"LAPORAN KEUANGAN BULANAN - CATATKU"`);
  lines.push(`"Buku Kas:",${escapeCsv(cashbookName)}`);
  lines.push(`"Periode:",${escapeCsv(ym)}`);
  lines.push(`"Rentang Tanggal:",${escapeCsv(`${formatDateOnly(startDateStr)} s/d ${formatDateOnly(endDateStr)}`)}`);
  lines.push(`"Tanggal Ekspor:",${escapeCsv(formatDate(new Date().toISOString()))}`);
  lines.push('');

  let runningBalance = openingBalance;
  let totalDebit = 0;
  let totalCredit = 0;

  lines.push(`"No","Tanggal","Status","Pos / Kategori","Akun / Dompet","Catatan","Masuk (Debit)","Keluar (Kredit)","Saldo Berjalan"`);
  lines.push(`"","${formatDateOnly(startDateStr)}","AKTIF","SALDO AWAL PERIODE","","","","","${openingBalance}"`);

  rows.forEach((t, idx) => {
    const isVoid = Number(t.is_void) === 1;
    const isIncome = t.type === 'income';
    const debit = isVoid ? 0 : (isIncome ? t.amount : 0);
    const credit = isVoid ? 0 : (isIncome ? 0 : t.amount);
    totalDebit += debit;
    totalCredit += credit;
    runningBalance += isVoid ? 0 : (isIncome ? t.amount : -t.amount);

    lines.push([
      escapeCsv(idx + 1),
      escapeCsv(formatDateOnly(t.date)),
      escapeCsv(isVoid ? 'BATAL' : 'AKTIF'),
      escapeCsv(t.category_name),
      escapeCsv(t.account_name ?? 'Dompet Utama'),
      escapeCsv(t.note || '-'),
      debit > 0 ? String(debit) : '0',
      credit > 0 ? String(credit) : '0',
      String(runningBalance),
    ].join(','));
  });

  const endingBalance = runningBalance;
  lines.push(`"","","","TOTAL PERIODE & SALDO AKHIR","","","${totalDebit}","${totalCredit}","${endingBalance}"`);
  lines.push('');
  lines.push(`"RINGKASAN"`);
  lines.push(`"Saldo Awal",${openingBalance}`);
  lines.push(`"Total Pemasukan",${totalDebit}`);
  lines.push(`"Total Pengeluaran",${totalCredit}`);
  lines.push(`"Surplus / Defisit",${totalDebit - totalCredit}`);
  lines.push(`"Saldo Akhir",${endingBalance}`);

  const csvContent = lines.join('\r\n');
  const cleanName = (cashbookName || 'CatatKu').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 20);
  const fileName = `CatatKu_Rekap_${cleanName}_${ym}.csv`;
  const targetFile = new File(Paths.cache, fileName);

  targetFile.write(csvContent);

  if (isAvailable) {
    await Sharing.shareAsync(targetFile.uri, {
      UTI: 'public.comma-separated-values-text',
      mimeType: 'text/csv',
      dialogTitle: `Ekspor CSV - Rekap ${ym}`,
    });
    return { success: true, message: 'Berkas CSV siap dibagikan.' };
  } else {
    return { success: true, message: `Berkas CSV disimpan: ${targetFile.uri}` };
  }
}
