import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { type TransactionWithCategory, type Summary, type DebtWithPayments } from '../database/queries';
import { formatRupiah } from './currency';
import { formatDate } from './date';

export async function generateAndSharePdfReport(params: {
  cashbookName: string;
  periodText: string;
  summary: Summary;
  transactions: TransactionWithCategory[];
  debts: DebtWithPayments[];
}) {
  const { cashbookName, periodText, summary, transactions, debts } = params;

  const transactionRows = transactions
    .map(
      (t, index) => `
    <tr>
      <td style="text-align: center;">${index + 1}</td>
      <td>${formatDate(t.date)}</td>
      <td><span class="badge ${t.type === 'income' ? 'badge-income' : 'badge-expense'}">${t.type === 'income' ? 'Masuk' : 'Keluar'}</span></td>
      <td>${t.category_icon} ${t.category_name}</td>
      <td>${t.account_name ?? 'Dompet'}</td>
      <td>${t.note || '-'}</td>
      <td style="text-align: right; font-weight: bold; color: ${t.type === 'income' ? '#16a34a' : '#dc2626'}">
        ${t.type === 'income' ? '+' : '-'}${formatRupiah(t.amount)}
      </td>
    </tr>
  `
    )
    .join('');

  const debtRows = debts
    .map(
      (d, index) => `
    <tr>
      <td style="text-align: center;">${index + 1}</td>
      <td>${formatDate(d.date)}</td>
      <td><span class="badge ${d.type === 'debt' ? 'badge-debt' : 'badge-receivable'}">${d.type === 'debt' ? 'Hutang' : 'Piutang'}</span></td>
      <td><b>${d.person_name}</b></td>
      <td style="text-align: right;">${formatRupiah(d.amount)}</td>
      <td style="text-align: right; color: #16a34a;">${formatRupiah(d.total_paid)}</td>
      <td style="text-align: right; font-weight: bold; color: ${d.remaining_amount <= 0 ? '#16a34a' : '#ea580c'}">
        ${d.remaining_amount <= 0 ? 'LUNAS' : formatRupiah(d.remaining_amount)}
      </td>
    </tr>
  `
    )
    .join('');

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Laporan Keuangan - ${cashbookName}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; padding: 24px; font-size: 12px; }
          .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 20px; }
          .title { font-size: 22px; font-weight: 800; color: #0f172a; margin: 0; }
          .subtitle { font-size: 13px; color: #64748b; margin-top: 4px; }
          .summary-grid { display: flex; gap: 12px; margin-bottom: 24px; }
          .summary-card { flex: 1; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; background: #f8fafc; }
          .summary-label { font-size: 11px; color: #64748b; margin-bottom: 4px; }
          .summary-value { font-size: 16px; font-weight: 800; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
          th { background-color: #f1f5f9; padding: 8px 10px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #cbd5e1; text-align: left; }
          td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px; }
          .badge { padding: 3px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; }
          .badge-income { background: #dcfce7; color: #16a34a; }
          .badge-expense { background: #fee2e2; color: #dc2626; }
          .badge-debt { background: #fed7aa; color: #ea580c; }
          .badge-receivable { background: #ede9fe; color: #7c3aed; }
          .section-title { font-size: 14px; font-weight: 700; margin-bottom: 8px; }
          .footer { font-size: 10px; color: #94a3b8; text-align: center; margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="title">Laporan Keuangan: ${cashbookName}</h1>
          <div class="subtitle">Periode Cetak: ${periodText}</div>
        </div>

        <div class="summary-grid">
          <div class="summary-card">
            <div class="summary-label">Total Pemasukan</div>
            <div class="summary-value" style="color: #16a34a;">+${formatRupiah(summary.total_income)}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Total Pengeluaran</div>
            <div class="summary-value" style="color: #dc2626;">-${formatRupiah(summary.total_expense)}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Sisa Saldo Kas</div>
            <div class="summary-value" style="color: #0f172a;">${formatRupiah(summary.balance)}</div>
          </div>
        </div>

        <div class="section-title">Riwayat Transaksi (${transactions.length})</div>
        <table>
          <thead>
            <tr>
              <th style="width: 24px; text-align: center;">#</th>
              <th>Tanggal</th>
              <th>Tipe</th>
              <th>Kategori</th>
              <th>Dompet</th>
              <th>Catatan</th>
              <th style="text-align: right;">Jumlah</th>
            </tr>
          </thead>
          <tbody>
            ${transactionRows || '<tr><td colspan="7" style="text-align: center; color: #94a3b8;">Tidak ada transaksi</td></tr>'}
          </tbody>
        </table>

        ${
          debts.length > 0
            ? `
          <div class="section-title">Rekap Hutang & Piutang (${debts.length})</div>
          <table>
            <thead>
              <tr>
                <th style="width: 24px; text-align: center;">#</th>
                <th>Tanggal</th>
                <th>Tipe</th>
                <th>Pihak Terkait</th>
                <th style="text-align: right;">Total</th>
                <th style="text-align: right;">Dicicil</th>
                <th style="text-align: right;">Sisa</th>
              </tr>
            </thead>
            <tbody>
              ${debtRows}
            </tbody>
          </table>
        `
            : ''
        }

        <div class="footer">
          Dicetak otomatis oleh CatatKu App (Offline-First) • Dokumen ini sah sebagai rekapitulasi internal
        </div>
      </body>
    </html>
  `;

  const { uri } = await Print.printToFileAsync({ html });
  const isAvailable = await Sharing.isAvailableAsync();
  if (isAvailable) {
    await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
  }
}
