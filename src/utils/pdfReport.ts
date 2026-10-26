import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { type TransactionWithCategory, type Summary, type DebtWithPayments } from '../database/queries';
import { formatRupiah } from './currency';
import { formatDateOnly } from './date';

export async function generateAndSharePdfReport(params: {
  cashbookName: string;
  periodText: string;
  summary: Summary;
  transactions: TransactionWithCategory[];
  debts: DebtWithPayments[];
  openingBalance?: number;
}) {
  const { cashbookName, periodText, summary, transactions, debts, openingBalance = 0 } = params;

  // Urutkan transaksi dan hutang secara kronologis dari yang lebih dulu ke yang terbaru
  const sortedTransactions = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime() || a.id - b.id
  );

  const sortedDebts = [...debts].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime() || a.id - b.id
  );

  let runningBalance = openingBalance;
  let totalDebit = 0;
  let totalCredit = 0;

  const transactionRows = sortedTransactions
    .map((t, index) => {
      const isIncome = t.type === 'income';
      const debit = isIncome ? t.amount : 0;
      const credit = isIncome ? 0 : t.amount;
      totalDebit += debit;
      totalCredit += credit;
      runningBalance += isIncome ? t.amount : -t.amount;

      return `
    <tr>
      <td style="text-align: center; color: #64748B;">${index + 1}</td>
      <td style="white-space: nowrap;">${formatDateOnly(t.date)}</td>
      <td>
        <div style="font-weight: 700; color: #0F172A;">${t.category_icon} ${t.category_name}</div>
        ${t.note ? `<div style="font-size: 10px; color: #64748B; margin-top: 1px;">${t.note}</div>` : ''}
      </td>
      <td style="color: #475569; white-space: nowrap;">${t.account_name ?? 'Dompet Utama'}</td>
      <td style="text-align: right; font-weight: 700; color: #059669; white-space: nowrap;">
        ${debit > 0 ? formatRupiah(debit) : '-'}
      </td>
      <td style="text-align: right; font-weight: 700; color: #DC2626; white-space: nowrap;">
        ${credit > 0 ? formatRupiah(credit) : '-'}
      </td>
      <td style="text-align: right; font-weight: 800; color: #0F172A; white-space: nowrap;">
        ${formatRupiah(runningBalance)}
      </td>
    </tr>
  `;
    })
    .join('');

  const debtRows = sortedDebts
    .map(
      (d, index) => `
    <tr>
      <td style="text-align: center; color: #64748B;">${index + 1}</td>
      <td style="white-space: nowrap;">${formatDateOnly(d.date)}</td>
      <td><span class="badge ${d.type === 'debt' ? 'badge-debt' : 'badge-receivable'}">${d.type === 'debt' ? 'Hutang' : 'Piutang'}</span></td>
      <td><b>${d.person_name}</b></td>
      <td style="text-align: right; font-weight: 700;">${formatRupiah(d.amount)}</td>
      <td style="text-align: right; color: #059669; font-weight: 700;">${formatRupiah(d.total_paid)}</td>
      <td style="text-align: right; font-weight: 800; color: ${d.remaining_amount <= 0 ? '#059669' : '#EA580C'}">
        ${d.remaining_amount <= 0 ? 'LUNAS' : formatRupiah(d.remaining_amount)}
      </td>
    </tr>
  `
    )
    .join('');

  const endingBalance = runningBalance;
  const netPeriod = totalDebit - totalCredit;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Buku Kas & Laporan Arus Keuangan - ${cashbookName}</title>
        <style>
          @page { size: A4 portrait; margin: 16mm 14mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0F172A; padding: 0; margin: 0; font-size: 11px; line-height: 1.45; }
          .header { border-bottom: 2px solid #0F766E; padding-bottom: 12px; margin-bottom: 18px; }
          .title { font-size: 20px; font-weight: 900; color: #0F766E; margin: 0; letter-spacing: -0.5px; }
          .subtitle { font-size: 12px; color: #64748B; margin-top: 2px; }
          .summary-grid { display: flex; gap: 10px; margin-bottom: 20px; }
          .summary-card { flex: 1; padding: 10px 12px; border-radius: 8px; border: 1px solid #E2E8F0; background: #F8FAFC; }
          .summary-label { font-size: 10px; color: #64748B; margin-bottom: 3px; font-weight: 700; text-transform: uppercase; }
          .summary-value { font-size: 15px; font-weight: 800; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px; }
          th { background-color: #0F766E; color: #FFFFFF; padding: 7px 8px; font-size: 10px; letter-spacing: 0.3px; border-bottom: 2px solid #0D655E; text-align: left; }
          td { padding: 7px 8px; border-bottom: 1px solid #E2E8F0; font-size: 11px; }
          .badge { padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 800; text-transform: uppercase; }
          .badge-income { background: #DCFCE7; color: #059669; }
          .badge-expense { background: #FEE2E2; color: #DC2626; }
          .badge-debt { background: #FED7AA; color: #EA580C; }
          .badge-receivable { background: #EDE9FE; color: #7C3AED; }
          .section-title { font-size: 13px; font-weight: 800; margin-top: 18px; margin-bottom: 4px; color: #0F172A; }
          .footer { font-size: 10px; color: #94A3B8; text-align: center; margin-top: 28px; border-top: 1px solid #E2E8F0; padding-top: 12px; }
          tr { page-break-inside: avoid; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="title">Buku Kas & Laporan Arus Keuangan: ${cashbookName}</h1>
          <div class="subtitle">Periode Cetak: <strong>${periodText}</strong></div>
        </div>

        <div class="summary-grid">
          <div class="summary-card">
            <div class="summary-label">Saldo Awal</div>
            <div class="summary-value" style="color: #0F172A;">${formatRupiah(openingBalance)}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label" style="color: #059669;">Penerimaan (Debit)</div>
            <div class="summary-value" style="color: #059669;">+${formatRupiah(totalDebit || summary.total_income)}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label" style="color: #DC2626;">Pengeluaran (Kredit)</div>
            <div class="summary-value" style="color: #DC2626;">-${formatRupiah(totalCredit || summary.total_expense)}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label" style="color: #0F766E;">Saldo Akhir</div>
            <div class="summary-value" style="color: #0F766E;">${formatRupiah(endingBalance)}</div>
            <div style="font-size: 9px; font-weight: 700; color: ${netPeriod >= 0 ? '#059669' : '#DC2626'}; margin-top: 2px;">
              ${netPeriod >= 0 ? 'Surplus +' : 'Defisit '}${formatRupiah(netPeriod)}
            </div>
          </div>
        </div>

        <div class="section-title">Buku Kas & Mutasi Transaksi (${sortedTransactions.length} Transaksi)</div>
        <table>
          <thead>
            <tr>
              <th style="width: 24px; text-align: center;">#</th>
              <th style="width: 76px;">Tanggal</th>
              <th>Keterangan / Kategori</th>
              <th style="width: 90px;">Akun / Dompet</th>
              <th style="width: 95px; text-align: right;">Masuk (Debit)</th>
              <th style="width: 95px; text-align: right;">Keluar (Kredit)</th>
              <th style="width: 105px; text-align: right;">Saldo Berjalan</th>
            </tr>
          </thead>
          <tbody>
            <tr style="background: #F8FAFC; font-weight: 700;">
              <td style="text-align: center; color: #94A3B8;">-</td>
              <td style="color: #64748B; font-size: 11px;">-</td>
              <td colspan="2" style="color: #334155;"><em>SALDO AWAL PERIODE</em></td>
              <td style="text-align: right; color: #94A3B8;">-</td>
              <td style="text-align: right; color: #94A3B8;">-</td>
              <td style="text-align: right; font-weight: 800; color: #0F172A;">${formatRupiah(openingBalance)}</td>
            </tr>
            ${transactionRows || '<tr><td colspan="7" style="text-align: center; padding: 14px; color: #94A3B8;">Tidak ada transaksi dicatat pada periode ini</td></tr>'}
          </tbody>
          <tfoot>
            <tr style="background: #F1F5F9; font-weight: 800; border-top: 2px solid #0F766E;">
              <td colspan="4" style="text-align: right; padding: 8px 10px; color: #0F172A;">TOTAL PERIODE & SALDO AKHIR</td>
              <td style="text-align: right; color: #059669; padding: 8px; font-size: 11px;">${formatRupiah(totalDebit)}</td>
              <td style="text-align: right; color: #DC2626; padding: 8px; font-size: 11px;">${formatRupiah(totalCredit)}</td>
              <td style="text-align: right; color: #0F766E; font-size: 12px; padding: 8px;">${formatRupiah(endingBalance)}</td>
            </tr>
          </tfoot>
        </table>

        ${
          sortedDebts.length > 0
            ? `
          <div class="section-title">Lampiran: Rekap Pos Hutang & Piutang (${sortedDebts.length})</div>
          <table>
            <thead>
              <tr>
                <th style="width: 24px; text-align: center;">#</th>
                <th style="width: 80px;">Tanggal</th>
                <th style="width: 70px;">Tipe</th>
                <th>Pihak Terkait</th>
                <th style="text-align: right; width: 95px;">Total Pokok</th>
                <th style="text-align: right; width: 95px;">Dicicil</th>
                <th style="text-align: right; width: 95px;">Sisa Pokok</th>
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
          Dicetak otomatis oleh Aplikasi CatatKu • Dokumen ini sah sebagai rekapitulasi internal pembukuan keuangan
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
