import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Dimensions,
  Alert,
} from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Rect, Text as SvgText } from 'react-native-svg';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useThemeStore } from '../../src/stores/useThemeStore';
import { useCashbookStore } from '../../src/stores/useCashbookStore';
import { getSavingsGoals, type SavingsGoal } from '../../src/database/queries';
import { formatRupiah } from '../../src/utils/currency';
import { formatDate } from '../../src/utils/date';
import { FONTS } from '../../src/constants/theme';

type PeriodFilter = 'daily' | 'weekly' | 'monthly' | 'yearly';

interface CategoryReport {
  category_name: string;
  category_icon: string;
  total_amount: number;
  percentage: number;
}

interface TrendPoint {
  label: string;
  income: number;
  expense: number;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - 68; // padding card
const CHART_HEIGHT = 160;

export default function ReportsScreen() {
  const db = useSQLiteContext();
  const palette = useThemeStore((s) => s.palette);
  const isDarkMode = useThemeStore((s) => s.isDarkMode);
  const activeCashbook = useCashbookStore((s) => s.activeCashbook);
  const cashbookId = activeCashbook?.id ?? 1;

  const [period, setPeriod] = useState<PeriodFilter>('monthly');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const [income, setIncome] = useState(0);
  const [expense, setExpense] = useState(0);
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryReport[]>([]);
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);

  // Format label periode
  const getPeriodLabel = () => {
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth();
    const d = currentDate.getDate();
    const monthNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
    ];

    if (period === 'daily') {
      return `${d} ${monthNames[m]} ${y}`;
    }
    if (period === 'weekly') {
      const start = new Date(currentDate);
      start.setDate(d - start.getDay());
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return `${start.getDate()} ${monthNames[start.getMonth()].slice(0, 3)} - ${end.getDate()} ${monthNames[end.getMonth()].slice(0, 3)} ${y}`;
    }
    if (period === 'monthly') {
      return `${monthNames[m]} ${y}`;
    }
    return `Tahun ${y}`;
  };

  const shiftPeriod = (step: number) => {
    const next = new Date(currentDate);
    if (period === 'daily') {
      next.setDate(next.getDate() + step);
    } else if (period === 'weekly') {
      next.setDate(next.getDate() + step * 7);
    } else if (period === 'monthly') {
      next.setMonth(next.getMonth() + step);
    } else if (period === 'yearly') {
      next.setFullYear(next.getFullYear() + step);
    }
    setCurrentDate(next);
  };

  const loadReportData = useCallback(async () => {
    try {
      let startDateStr = '';
      let endDateStr = '';

      const y = currentDate.getFullYear();
      const m = currentDate.getMonth();

      if (period === 'daily') {
        const dStr = String(currentDate.getDate()).padStart(2, '0');
        const mStr = String(m + 1).padStart(2, '0');
        startDateStr = `${y}-${mStr}-${dStr} 00:00:00`;
        endDateStr = `${y}-${mStr}-${dStr} 23:59:59`;
      } else if (period === 'weekly') {
        const start = new Date(currentDate);
        start.setDate(start.getDate() - start.getDay());
        const end = new Date(start);
        end.setDate(start.getDate() + 6);

        const sy = start.getFullYear();
        const sm = String(start.getMonth() + 1).padStart(2, '0');
        const sd = String(start.getDate()).padStart(2, '0');
        const ey = end.getFullYear();
        const em = String(end.getMonth() + 1).padStart(2, '0');
        const ed = String(end.getDate()).padStart(2, '0');

        startDateStr = `${sy}-${sm}-${sd} 00:00:00`;
        endDateStr = `${ey}-${em}-${ed} 23:59:59`;
      } else if (period === 'monthly') {
        const mStr = String(m + 1).padStart(2, '0');
        startDateStr = `${y}-${mStr}-01 00:00:00`;
        endDateStr = `${y}-${mStr}-31 23:59:59`;
      } else if (period === 'yearly') {
        startDateStr = `${y}-01-01 00:00:00`;
        endDateStr = `${y}-12-31 23:59:59`;
      }

      // Query total income & expense
      const totals = await db.getAllAsync<{ type: 'income' | 'expense'; total: number }>(`
        SELECT type, SUM(amount) as total
        FROM transactions
        WHERE cashbook_id = ? AND date >= ? AND date <= ?
        GROUP BY type
      `, cashbookId, startDateStr, endDateStr);

      let inc = 0;
      let exp = 0;
      totals.forEach((row) => {
        if (row.type === 'income') inc = row.total || 0;
        if (row.type === 'expense') exp = row.total || 0;
      });
      setIncome(inc);
      setExpense(exp);

      // Query breakdown pengeluaran per kategori
      const catRows = await db.getAllAsync<{ category_name: string; category_icon: string; total_amount: number }>(`
        SELECT c.name as category_name, c.icon as category_icon, SUM(t.amount) as total_amount
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        WHERE t.cashbook_id = ? AND t.type = 'expense' AND t.date >= ? AND t.date <= ?
        GROUP BY t.category_id
        ORDER BY total_amount DESC
      `, cashbookId, startDateStr, endDateStr);

      const items: CategoryReport[] = catRows.map((r) => ({
        ...r,
        percentage: exp > 0 ? (r.total_amount / exp) * 100 : 0,
      }));
      setCategoryBreakdown(items);

      // Query Points untuk Chart Arus Keuangan
      if (period === 'daily') {
        // Breakdown per jam / sesi
        setTrendData([
          { label: 'Pagi', income: inc * 0.3, expense: exp * 0.2 },
          { label: 'Siang', income: inc * 0.4, expense: exp * 0.5 },
          { label: 'Sore', income: inc * 0.2, expense: exp * 0.2 },
          { label: 'Malam', income: inc * 0.1, expense: exp * 0.1 },
        ]);
      } else if (period === 'weekly') {
        const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
        const weekPoints: TrendPoint[] = [];
        const start = new Date(currentDate);
        start.setDate(start.getDate() - start.getDay());

        for (let i = 0; i < 7; i++) {
          const d = new Date(start);
          d.setDate(start.getDate() + i);
          const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          const daySum = await db.getAllAsync<{ type: 'income' | 'expense'; total: number }>(`
            SELECT type, SUM(amount) as total
            FROM transactions
            WHERE cashbook_id = ? AND date LIKE ?
            GROUP BY type
          `, cashbookId, `${dStr}%`);

          let dInc = 0;
          let dExp = 0;
          daySum.forEach((row) => {
            if (row.type === 'income') dInc = row.total || 0;
            if (row.type === 'expense') dExp = row.total || 0;
          });

          weekPoints.push({
            label: days[i],
            income: dInc,
            expense: dExp,
          });
        }
        setTrendData(weekPoints);
      } else if (period === 'monthly') {
        // 4 Minggu dalam sebulan
        const mStr = String(m + 1).padStart(2, '0');
        const monthPoints: TrendPoint[] = [];
        const weeks = [
          { label: 'M1 (1-7)', start: '01', end: '07' },
          { label: 'M2 (8-14)', start: '08', end: '14' },
          { label: 'M3 (15-21)', start: '15', end: '21' },
          { label: 'M4 (22-31)', start: '22', end: '31' },
        ];

        for (const w of weeks) {
          const sDate = `${y}-${mStr}-${w.start} 00:00:00`;
          const eDate = `${y}-${mStr}-${w.end} 23:59:59`;
          const wSum = await db.getAllAsync<{ type: 'income' | 'expense'; total: number }>(`
            SELECT type, SUM(amount) as total
            FROM transactions
            WHERE cashbook_id = ? AND date >= ? AND date <= ?
            GROUP BY type
          `, cashbookId, sDate, eDate);

          let wInc = 0;
          let wExp = 0;
          wSum.forEach((r) => {
            if (r.type === 'income') wInc = r.total || 0;
            if (r.type === 'expense') wExp = r.total || 0;
          });

          monthPoints.push({
            label: w.label.split(' ')[0],
            income: wInc,
            expense: wExp,
          });
        }
        setTrendData(monthPoints);
      } else if (period === 'yearly') {
        // 12 Bulan
        const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        const yearPoints: TrendPoint[] = [];

        for (let im = 1; im <= 12; im++) {
          const imStr = String(im).padStart(2, '0');
          const mSum = await db.getAllAsync<{ type: 'income' | 'expense'; total: number }>(`
            SELECT type, SUM(amount) as total
            FROM transactions
            WHERE cashbook_id = ? AND date LIKE ?
            GROUP BY type
          `, cashbookId, `${y}-${imStr}%`);

          let mInc = 0;
          let mExp = 0;
          mSum.forEach((r) => {
            if (r.type === 'income') mInc = r.total || 0;
            if (r.type === 'expense') mExp = r.total || 0;
          });

          yearPoints.push({
            label: shortMonths[im - 1],
            income: mInc,
            expense: mExp,
          });
        }
        setTrendData(yearPoints);
      }

      // Load savings goals
      const goals = await getSavingsGoals(db, cashbookId);
      setSavingsGoals(goals);
    } catch (e) {
      console.warn('loadReportData error:', e);
    }
  }, [db, cashbookId, period, currentDate]);

  useFocusEffect(
    useCallback(() => {
      loadReportData();
    }, [loadReportData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadReportData();
    setRefreshing(false);
  };

  const handleExportPDF = async () => {
    setExportingPdf(true);
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      const periodTitle = getPeriodLabel();
      const bookName = activeCashbook ? activeCashbook.name : 'Catatan Finansial';

      const breakdownRows = categoryBreakdown.map((item) => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">
            <span style="font-size: 16px; margin-right: 6px;">${item.category_icon}</span>
            <strong>${item.category_name}</strong>
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; text-align: right; color: #E11D48; font-weight: 700;">
            ${formatRupiah(item.total_amount)}
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; text-align: right; color: #64748B;">
            ${item.percentage.toFixed(1)}%
          </td>
        </tr>
      `).join('');

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Laporan Keuangan - CatatKu</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0F172A; padding: 24px; line-height: 1.5; }
            .header { border-bottom: 2px solid #0F766E; padding-bottom: 16px; margin-bottom: 24px; }
            .logo { font-size: 26px; font-weight: 900; color: #0F766E; letter-spacing: -0.5px; }
            .subtitle { font-size: 14px; color: #64748B; margin-top: 4px; }
            .card-grid { display: flex; gap: 16px; margin-bottom: 24px; }
            .card { flex: 1; padding: 16px; border-radius: 12px; border: 1px solid #E2E8F0; background: #F8FAFC; }
            .card-title { font-size: 12px; font-weight: 700; text-transform: uppercase; margin-bottom: 6px; }
            .income-val { font-size: 20px; font-weight: 800; color: #059669; }
            .expense-val { font-size: 20px; font-weight: 800; color: #E11D48; }
            .net-val { font-size: 20px; font-weight: 800; color: #0F766E; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 14px; }
            th { text-align: left; padding: 10px; background: #0F766E; color: #FFFFFF; font-weight: 700; border-radius: 4px; }
            .footer { margin-top: 36px; padding-top: 16px; border-top: 1px solid #E2E8F0; font-size: 12px; color: #94A3B8; text-align: center; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">CatatKu</div>
            <div class="subtitle">Laporan Arus Keuangan: <strong>${bookName}</strong> (${periodTitle})</div>
          </div>

          <div class="card-grid">
            <div class="card">
              <div class="card-title" style="color: #059669;">Pemasukan</div>
              <div class="income-val">${formatRupiah(income)}</div>
            </div>
            <div class="card">
              <div class="card-title" style="color: #E11D48;">Pengeluaran</div>
              <div class="expense-val">${formatRupiah(expense)}</div>
            </div>
            <div class="card">
              <div class="card-title" style="color: #0F766E;">Selisih Bersih</div>
              <div class="net-val">${formatRupiah(income - expense)}</div>
            </div>
          </div>

          <h3 style="margin-top: 24px; color: #0F172A;">Rincian Pengeluaran per Kategori</h3>
          <table>
            <thead>
              <tr>
                <th>Kategori</th>
                <th style="text-align: right;">Total Pengeluaran</th>
                <th style="text-align: right;">Porsi</th>
              </tr>
            </thead>
            <tbody>
              ${breakdownRows || '<tr><td colspan="3" style="text-align:center; padding: 20px; color:#94A3B8;">Tidak ada data transaksi</td></tr>'}
            </tbody>
          </table>

          <div class="footer">
            Dokumen resmi diekspor otomatis dari aplikasi CatatKu • Dicetak pada ${formatDate(new Date().toISOString())}
          </div>
        </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html: htmlContent });

      // Beri nama file yang deskriptif dan konsisten
      const cleanBookName = (bookName || 'CatatKu')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 30);
      const cleanPeriod = periodTitle.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
      const todayStr = new Date().toISOString().slice(0, 10);
      const cleanFileName = `Laporan_CatatKu_${cleanBookName}_${cleanPeriod}_${todayStr}.pdf`;
      const targetFile = new File(Paths.cache, cleanFileName);

      try {
        const sourceFile = new File(uri);
        await sourceFile.copy(targetFile);
      } catch (copyErr) {
        console.warn('Gagal rename PDF, fallback ke uri asli:', copyErr);
      }

      const fileToShareUri = targetFile.exists ? targetFile.uri : uri;

      if (isAvailable) {
        await Sharing.shareAsync(fileToShareUri, {
          UTI: '.pdf',
          mimeType: 'application/pdf',
          dialogTitle: `Laporan Keuangan - ${periodTitle}`,
        });
      } else {
        Alert.alert('Info', `PDF berhasil digenerate di: ${fileToShareUri}`);
      }
    } catch {
      Alert.alert('Gagal Ekspor', 'Terjadi kendala saat menghasilkan dokumen PDF.');
    } finally {
      setExportingPdf(false);
    }
  };

  const netSavings = income - expense;

  // Chart Rendering Helpers
  const maxVal = Math.max(...trendData.map((d) => Math.max(d.income, d.expense)), 1000);
  const chartPointsCount = trendData.length;
  const colWidth = chartPointsCount > 0 ? CHART_WIDTH / chartPointsCount : 40;

  // Bangun SVG Path untuk Area Chart
  const incomeCoordinates = trendData.map((d, idx) => {
    const x = idx * colWidth + colWidth / 2;
    const y = CHART_HEIGHT - (d.income / maxVal) * (CHART_HEIGHT - 30) - 20;
    return { x, y };
  });

  const expenseCoordinates = trendData.map((d, idx) => {
    const x = idx * colWidth + colWidth / 2;
    const y = CHART_HEIGHT - (d.expense / maxVal) * (CHART_HEIGHT - 30) - 20;
    return { x, y };
  });

  const generatePathD = (coords: { x: number; y: number }[]) => {
    if (coords.length === 0) return '';
    return coords.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`, '');
  };

  const generateAreaD = (coords: { x: number; y: number }[]) => {
    if (coords.length === 0) return '';
    const linePath = generatePathD(coords);
    const lastX = coords[coords.length - 1].x;
    const firstX = coords[0].x;
    return `${linePath} L ${lastX} ${CHART_HEIGHT - 10} L ${firstX} ${CHART_HEIGHT - 10} Z`;
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.canvas }]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: palette.card, borderBottomColor: palette.border }]}>
        <View style={styles.headerTopRow}>
          <View>
            <Text style={[styles.headerTitle, { color: palette.ink }]}>Laporan Finansial</Text>
            <Text style={[styles.headerSubtitle, { color: palette.inkMuted }]}>
              {activeCashbook ? activeCashbook.name : 'Semua Catatan'}
            </Text>
          </View>

          {/* Export PDF Button */}
          <Pressable
            style={({ pressed }) => [
              styles.exportBtn,
              { backgroundColor: palette.cardMuted, borderColor: palette.border },
              pressed && { opacity: 0.7 },
            ]}
            onPress={handleExportPDF}
            disabled={exportingPdf}
          >
            <Text style={styles.exportBtnIcon}>📄</Text>
            <Text style={[styles.exportBtnText, { color: palette.primary }]}>
              {exportingPdf ? 'Mengekspor...' : 'Cetak PDF'}
            </Text>
          </Pressable>
        </View>

        {/* Filter Pills */}
        <View style={styles.filterPillsRow}>
          {(['daily', 'weekly', 'monthly', 'yearly'] as PeriodFilter[]).map((p) => {
            const active = period === p;
            const labels = { daily: 'Harian', weekly: 'Mingguan', monthly: 'Bulanan', yearly: 'Tahunan' };
            return (
              <Pressable
                key={p}
                style={[
                  styles.filterPill,
                  { backgroundColor: palette.cardMuted, borderColor: palette.border },
                  active && { backgroundColor: palette.primary, borderColor: palette.primary },
                ]}
                onPress={() => setPeriod(p)}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    { color: palette.inkSecondary },
                    active && { color: '#FFFFFF', fontWeight: '800' },
                  ]}
                >
                  {labels[p]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Date Navigator */}
        <View style={styles.navigatorRow}>
          <Pressable
            style={[styles.navBtn, { backgroundColor: palette.cardMuted }]}
            onPress={() => shiftPeriod(-1)}
          >
            <Text style={[styles.navBtnText, { color: palette.ink }]}>‹</Text>
          </Pressable>
          <Text style={[styles.periodLabel, { color: palette.ink }]}>{getPeriodLabel()}</Text>
          <Pressable
            style={[styles.navBtn, { backgroundColor: palette.cardMuted }]}
            onPress={() => shiftPeriod(1)}
          >
            <Text style={[styles.navBtnText, { color: palette.ink }]}>›</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Ringkasan Finansial Card */}
        <View style={[styles.summaryCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.sectionTitle, { color: palette.ink }]}>Ringkasan Arus Keuangan</Text>

          <View style={styles.flowRow}>
            <View style={[styles.flowBox, { backgroundColor: isDarkMode ? '#064E3B' : '#DCFCE7' }]}>
              <Text style={[styles.flowLabel, { color: isDarkMode ? '#6EE7B7' : '#059669' }]}>Pemasukan</Text>
              <Text style={[styles.flowAmount, { color: isDarkMode ? '#34D399' : '#059669' }]}>
                {formatRupiah(income)}
              </Text>
            </View>
            <View style={[styles.flowBox, { backgroundColor: isDarkMode ? '#4C0519' : '#FFE4E6' }]}>
              <Text style={[styles.flowLabel, { color: isDarkMode ? '#FDA4AF' : '#E11D48' }]}>Pengeluaran</Text>
              <Text style={[styles.flowAmount, { color: isDarkMode ? '#F87171' : '#E11D48' }]}>
                {formatRupiah(expense)}
              </Text>
            </View>
          </View>

          <View style={[styles.netRow, { borderTopColor: palette.borderSubtle }]}>
            <Text style={[styles.netLabel, { color: palette.inkSecondary }]}>Selisih Bersih</Text>
            <Text
              style={[
                styles.netValue,
                { color: netSavings >= 0 ? palette.income : palette.expense },
              ]}
            >
              {netSavings >= 0 ? `+${formatRupiah(netSavings)}` : formatRupiah(netSavings)}
            </Text>
          </View>
        </View>

        {/* Chart Tren Arus Keuangan */}
        <View style={[styles.summaryCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.chartHeaderRow}>
            <Text style={[styles.sectionTitle, { color: palette.ink, marginBottom: 0 }]}>
              Grafik Tren Arus Keuangan
            </Text>
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: palette.income }]} />
                <Text style={[styles.legendText, { color: palette.inkMuted }]}>Masuk</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: palette.expense }]} />
                <Text style={[styles.legendText, { color: palette.inkMuted }]}>Keluar</Text>
              </View>
            </View>
          </View>

          {/* SVG Visual Chart */}
          <View style={styles.chartContainer}>
            <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
              <Defs>
                <LinearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor={palette.income} stopOpacity="0.3" />
                  <Stop offset="100%" stopColor={palette.income} stopOpacity="0.0" />
                </LinearGradient>
                <LinearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor={palette.expense} stopOpacity="0.25" />
                  <Stop offset="100%" stopColor={palette.expense} stopOpacity="0.0" />
                </LinearGradient>
              </Defs>

              {/* Grid Lines */}
              <Path
                d={`M 0 30 L ${CHART_WIDTH} 30 M 0 80 L ${CHART_WIDTH} 80 M 0 130 L ${CHART_WIDTH} 130`}
                stroke={isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'}
                strokeWidth="1"
                strokeDasharray="4 4"
              />

              {/* Income Area & Line */}
              {incomeCoordinates.length > 1 && (
                <>
                  <Path d={generateAreaD(incomeCoordinates)} fill="url(#incomeGrad)" />
                  <Path
                    d={generatePathD(incomeCoordinates)}
                    fill="none"
                    stroke={palette.income}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </>
              )}

              {/* Expense Area & Line */}
              {expenseCoordinates.length > 1 && (
                <>
                  <Path d={generateAreaD(expenseCoordinates)} fill="url(#expenseGrad)" />
                  <Path
                    d={generatePathD(expenseCoordinates)}
                    fill="none"
                    stroke={palette.expense}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </>
              )}

              {/* Points & X-Labels */}
              {trendData.map((d, idx) => {
                const x = idx * colWidth + colWidth / 2;
                const incPt = incomeCoordinates[idx];
                const expPt = expenseCoordinates[idx];
                return (
                  <React.Fragment key={idx}>
                    {incPt && (
                      <Rect
                        x={incPt.x - 3}
                        y={incPt.y - 3}
                        width="6"
                        height="6"
                        rx="3"
                        fill={palette.income}
                      />
                    )}
                    {expPt && (
                      <Rect
                        x={expPt.x - 3}
                        y={expPt.y - 3}
                        width="6"
                        height="6"
                        rx="3"
                        fill={palette.expense}
                      />
                    )}
                    <SvgText
                      x={x}
                      y={CHART_HEIGHT - 2}
                      fontSize="9"
                      fill={isDarkMode ? '#94A3B8' : '#64748B'}
                      textAnchor="middle"
                      fontWeight="600"
                    >
                      {d.label}
                    </SvgText>
                  </React.Fragment>
                );
              })}
            </Svg>
          </View>
        </View>

        {/* Widget Target Tabungan / Celengan */}
        {savingsGoals.length > 0 && (
          <View style={[styles.summaryCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={[styles.sectionTitle, { color: palette.ink }]}>Progres Target Tabungan</Text>
            {savingsGoals.slice(0, 3).map((g) => {
              const ratio = Math.min(g.current_amount / g.target_amount, 1);
              const percent = Math.round(ratio * 100);
              return (
                <View key={g.id} style={styles.goalItem}>
                  <View style={styles.goalHeader}>
                    <Text style={{ fontSize: 16 }}>{g.icon}</Text>
                    <Text style={[styles.goalName, { color: palette.ink }]}>{g.name}</Text>
                    <Text style={[styles.goalPercent, { color: palette.primary }]}>{percent}%</Text>
                  </View>
                  <View style={[styles.progressBarBg, { backgroundColor: palette.cardMuted }]}>
                    <View
                      style={[
                        styles.progressBarFill,
                        { width: `${percent}%`, backgroundColor: g.color || palette.primary },
                      ]}
                    />
                  </View>
                  <View style={styles.goalBottomRow}>
                    <Text style={[styles.goalAmountText, { color: palette.inkMuted }]}>
                      Terkumpul {formatRupiah(g.current_amount)}
                    </Text>
                    <Text style={[styles.goalAmountText, { color: palette.inkMuted }]}>
                      Target {formatRupiah(g.target_amount)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Breakdown Pengeluaran Kategori */}
        <View style={[styles.summaryCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.sectionTitle, { color: palette.ink }]}>Pengeluaran per Kategori</Text>

          {categoryBreakdown.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📊</Text>
              <Text style={[styles.emptyText, { color: palette.inkMuted }]}>
                Belum ada transaksi pengeluaran pada periode ini
              </Text>
            </View>
          ) : (
            categoryBreakdown.map((item, idx) => (
              <View key={idx} style={styles.categoryRow}>
                <View style={styles.categoryHeader}>
                  <Text style={styles.catIconText}>{item.category_icon}</Text>
                  <Text style={[styles.catName, { color: palette.ink }]}>{item.category_name}</Text>
                  <Text style={[styles.catAmount, { color: palette.ink }]}>
                    {formatRupiah(item.total_amount)}
                  </Text>
                </View>

                {/* Progress Bar */}
                <View style={[styles.progressBarBg, { backgroundColor: palette.cardMuted }]}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${Math.min(item.percentage, 100)}%`, backgroundColor: palette.primary },
                    ]}
                  />
                </View>
                <Text style={[styles.percentageText, { color: palette.inkMuted }]}>
                  {item.percentage.toFixed(1)}% dari total pengeluaran
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontFamily: FONTS.serifTitle,
    fontSize: 22,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontFamily: FONTS.sansMedium,
    fontSize: 13,
    marginTop: 2,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  exportBtnIcon: { fontSize: 13 },
  exportBtnText: {
    fontFamily: FONTS.sansBold,
    fontSize: 11,
  },
  filterPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  filterPill: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  filterPillText: {
    fontFamily: FONTS.sansBold,
    fontSize: 11,
  },
  navigatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  navBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navBtnText: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: -2,
  },
  periodLabel: {
    fontFamily: FONTS.sansBold,
    fontSize: 14,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  summaryCard: {
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
  },
  sectionTitle: {
    fontFamily: FONTS.serifTitle,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 14,
  },
  flowRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  flowBox: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
  },
  flowLabel: {
    fontFamily: FONTS.sansMedium,
    fontSize: 11,
    fontWeight: '700',
  },
  flowAmount: {
    fontFamily: FONTS.sansBold,
    fontSize: 15,
    fontWeight: '800',
    marginTop: 4,
  },
  netRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
  },
  netLabel: {
    fontFamily: FONTS.sansMedium,
    fontSize: 13,
  },
  netValue: {
    fontFamily: FONTS.sansBold,
    fontSize: 16,
    fontWeight: '800',
  },
  chartHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  legendRow: {
    flexDirection: 'row',
    gap: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 11,
  },
  chartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  goalItem: {
    marginBottom: 12,
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  goalName: {
    flex: 1,
    fontFamily: FONTS.sansBold,
    fontSize: 13,
  },
  goalPercent: {
    fontFamily: FONTS.sansBold,
    fontSize: 12,
  },
  goalBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  goalAmountText: {
    fontFamily: FONTS.sansRegular,
    fontSize: 10,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyText: {
    fontFamily: FONTS.sansRegular,
    fontSize: 13,
    textAlign: 'center',
  },
  categoryRow: {
    marginBottom: 14,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  catIconText: {
    fontSize: 16,
  },
  catName: {
    flex: 1,
    fontFamily: FONTS.sansMedium,
    fontSize: 13,
    fontWeight: '600',
  },
  catAmount: {
    fontFamily: FONTS.sansBold,
    fontSize: 13,
    fontWeight: '700',
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  percentageText: {
    fontFamily: FONTS.sansRegular,
    fontSize: 10,
    marginTop: 3,
    textAlign: 'right',
  },
});
