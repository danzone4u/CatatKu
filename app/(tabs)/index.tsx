import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  useWindowDimensions,
} from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect, router } from 'expo-router';
import {
  getMonthlySummary,
  getCategoryBreakdown,
  getDebtSummary,
  getCashbookById,
  getAccounts,
  getSavingsGoals,
  getSetting,
  setSetting,
  type AccountWithCalculatedBalance,
  type SavingsGoal,
} from '../../src/database/queries';
import { useCashbookStore } from '../../src/stores/useCashbookStore';
import { getMonthName, getCurrentMonth } from '../../src/utils/date';
import { formatRupiah } from '../../src/utils/currency';
import { PALETTE, FONTS } from '../../src/constants/theme';
import { useThemeStore } from '../../src/stores/useThemeStore';
import {
  WalletActionIcon,
  TransferActionIcon,
  BillActionIcon,
  BudgetActionIcon,
  SavingsActionIcon,
  CashierActionIcon,
  DebtActionIcon,
  RecurringActionIcon,
  ExportActionIcon,
  CustomizeActionIcon,
  BackArrowIcon,
} from '../../src/components/ActionIcons';
import { ModernConfirmModal, type ModalType } from '../../src/components/ModernConfirmModal';

interface ShortcutItem {
  id: string;
  name: string;
  route: string;
  iconType: string;
}

const ALL_AVAILABLE_SHORTCUTS: ShortcutItem[] = [
  { id: 'wallets', name: 'Dompet', route: '/wallets', iconType: 'wallet' },
  { id: 'transfer', name: 'Transfer', route: '/transfer', iconType: 'transfer' },
  { id: 'bills', name: 'Tagihan', route: '/bills', iconType: 'bills' },
  { id: 'debts', name: 'Hutang', route: '/(tabs)/debts', iconType: 'debts' },
  { id: 'budget', name: 'Budget', route: '/category-budgets', iconType: 'budget' },
  { id: 'savings', name: 'Nabung', route: '/savings-goals', iconType: 'savings' },
  { id: 'cashier', name: 'Kasir', route: '/cashier-calculator', iconType: 'cashier' },
  { id: 'recurring', name: 'Rutin', route: '/recurring', iconType: 'recurring' },
  { id: 'export', name: 'Laporan', route: '/(tabs)/settings', iconType: 'export' },
];

const DEFAULT_SHORTCUT_IDS = ['wallets', 'transfer', 'bills', 'debts'];
const SETTINGS_KEY = 'cashbook_screen_shortcuts_v1';

export default function DashboardScreen() {
  const db = useSQLiteContext();
  const { width } = useWindowDimensions();
  const isTablet = width >= 600;
  const { activeCashbook, setActiveCashbook } = useCashbookStore();
  const palette = useThemeStore((s) => s.palette);
  const isDarkMode = useThemeStore((s) => s.isDarkMode);

  const [summary, setSummary] = useState({ total_income: 0, total_expense: 0, balance: 0 });
  const [debtSummary, setDebtSummary] = useState({ total_debt: 0, total_receivable: 0 });
  const [breakdown, setBreakdown] = useState<
    Array<{ category_id: number; category_name: string; category_icon: string; total: number }>
  >([]);
  const [accounts, setAccounts] = useState<AccountWithCalculatedBalance[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [recentTrend, setRecentTrend] = useState<number[]>([]);

  // Shortcut customization state
  const [activeShortcutIds, setActiveShortcutIds] = useState<string[]>(DEFAULT_SHORTCUT_IDS);
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);
  const [tempShortcutIds, setTempShortcutIds] = useState<string[]>(DEFAULT_SHORTCUT_IDS);

  const [modalAlert, setModalAlert] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: ModalType;
    icon?: string;
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'warning',
  });

  const showAlert = (title: string, message: string, type: ModalType = 'warning', icon?: string) => {
    setModalAlert({
      visible: true,
      title,
      message,
      type,
      icon,
    });
  };

  const { year, month } = getCurrentMonth();
  const cashbookId = activeCashbook?.id ?? 1;

  const loadShortcutSettings = useCallback(async () => {
    try {
      const saved = await getSetting(db, SETTINGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setActiveShortcutIds(parsed);
          return;
        }
      }
      setActiveShortcutIds(DEFAULT_SHORTCUT_IDS);
    } catch {
      setActiveShortcutIds(DEFAULT_SHORTCUT_IDS);
    }
  }, [db]);

  const loadDashboardData = useCallback(async () => {
    const book = await getCashbookById(db, cashbookId);
    if (book) setActiveCashbook(book);

    const [s, d, b, accs, goals, dailyTrend] = await Promise.all([
      getMonthlySummary(db, cashbookId, year, month),
      getDebtSummary(db, cashbookId),
      getCategoryBreakdown(db, cashbookId, year, month, 'expense'),
      getAccounts(db, cashbookId),
      getSavingsGoals(db, cashbookId),
      db.getAllAsync<{ daily_net: number }>(
        `SELECT (
           COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) -
           COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)
         ) as daily_net
         FROM transactions
         WHERE cashbook_id = ?
         GROUP BY date
         ORDER BY date DESC
         LIMIT 7`,
        cashbookId
      ),
    ]);

    setSummary(s);
    setDebtSummary(d);
    setBreakdown(b);
    setAccounts(accs);
    setSavingsGoals(goals);
    setRecentTrend((dailyTrend || []).map((r) => r.daily_net).reverse());
  }, [db, cashbookId, year, month, setActiveCashbook]);

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
      loadShortcutSettings();
    }, [loadDashboardData, loadShortcutSettings])
  );

  function handleGoBackToBooks() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }

  function openCustomizeModal() {
    setTempShortcutIds([...activeShortcutIds]);
    setShowCustomizeModal(true);
  }

  function toggleShortcutSelection(id: string) {
    if (tempShortcutIds.includes(id)) {
      if (tempShortcutIds.length <= 1) {
        showAlert('Perhatian', 'Pintasan minimal harus menyisakan 1 menu.', 'warning');
        return;
      }
      setTempShortcutIds(tempShortcutIds.filter((item) => item !== id));
    } else {
      setTempShortcutIds([...tempShortcutIds, id]);
    }
  }

  async function handleSaveShortcuts() {
    try {
      await setSetting(db, SETTINGS_KEY, JSON.stringify(tempShortcutIds));
      setActiveShortcutIds(tempShortcutIds);
      setShowCustomizeModal(false);
    } catch {
      showAlert('Error', 'Gagal menyimpan pintasan menu', 'danger');
    }
  }

  function renderShortcutIcon(iconType: string, color: string) {
    switch (iconType) {
      case 'wallet':
        return <WalletActionIcon color={color} size={22} />;
      case 'transfer':
        return <TransferActionIcon color={color} size={22} />;
      case 'bills':
        return <BillActionIcon color={color} size={22} />;
      case 'debts':
        return <DebtActionIcon color={color} size={22} />;
      case 'budget':
        return <BudgetActionIcon color={color} size={22} />;
      case 'savings':
        return <SavingsActionIcon color={color} size={22} />;
      case 'cashier':
        return <CashierActionIcon color={color} size={22} />;
      case 'recurring':
        return <RecurringActionIcon color={color} size={22} />;
      case 'export':
        return <ExportActionIcon color={color} size={22} />;
      default:
        return <WalletActionIcon color={color} size={22} />;
    }
  }

  const activeShortcuts = activeShortcutIds
    .map((id) => ALL_AVAILABLE_SHORTCUTS.find((s) => s.id === id))
    .filter((s): s is ShortcutItem => !!s);

  const budgetLimit = activeCashbook?.budget_limit ?? null;
  const hasBudget = budgetLimit !== null && budgetLimit > 0;
  const budgetRatio = hasBudget ? Math.min(summary.total_expense / budgetLimit!, 1) : 0;
  const budgetPercent = hasBudget ? Math.round((summary.total_expense / budgetLimit!) * 100) : 0;

  let progressColor = PALETTE.income;
  if (budgetPercent >= 90) progressColor = PALETTE.expense;
  else if (budgetPercent >= 70) progressColor = PALETTE.debt;

  const totalExpense = summary.total_expense;

  return (
    <View style={[styles.screenWrapper, { backgroundColor: palette.canvas }]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          isTablet && { maxWidth: 840, width: '100%', alignSelf: 'center' },
          { flexGrow: 1 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Header Card */}
        <View style={styles.header}>
          <Pressable
            style={({ pressed }) => [
              styles.backBtn,
              { backgroundColor: palette.cardMuted, borderColor: palette.border },
              pressed && { opacity: 0.7 },
            ]}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 16 }}
            onPress={handleGoBackToBooks}
          >
            <BackArrowIcon color={palette.primary} size={22} />
            <Text style={[styles.backBtnText, { color: palette.primary }]}>Semua Catatan</Text>
          </Pressable>

          <View style={styles.bookHeaderRow}>
            <View style={[styles.bookIconBadge, { backgroundColor: palette.cardMuted, borderColor: palette.border }]}>
              <Text style={styles.bookIcon}>{activeCashbook?.icon ?? '📖'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.bookTitle, { color: palette.ink }]} numberOfLines={1}>
                {activeCashbook?.name ?? 'Catatan'}
              </Text>
              <Text style={[styles.periodText, { color: palette.inkMuted }]}>{getMonthName(month)} {year}</Text>
            </View>
          </View>
        </View>

        {/* Hero Balance Card */}
        <View style={[styles.heroCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.heroLabel, { color: palette.inkMuted }]}>Saldo Tersedia</Text>
          <Text
            style={[
              styles.heroAmount,
              { color: summary.balance >= 0 ? palette.ink : palette.expense },
            ]}
          >
            {formatRupiah(summary.balance)}
          </Text>

          {/* Row Pemasukan & Pengeluaran */}
          <View style={[styles.flowRow, { borderTopColor: palette.borderSubtle }]}>
            <View style={styles.flowItem}>
              <View style={[styles.flowDot, { backgroundColor: palette.income }]} />
              <View>
                <Text style={[styles.flowLabel, { color: palette.inkMuted }]}>Pemasukan</Text>
                <Text style={[styles.flowIncome, { color: palette.income }]}>+{formatRupiah(summary.total_income)}</Text>
              </View>
            </View>

            <View style={[styles.flowDivider, { backgroundColor: palette.borderSubtle }]} />

            <View style={styles.flowItem}>
              <View style={[styles.flowDot, { backgroundColor: palette.expense }]} />
              <View>
                <Text style={[styles.flowLabel, { color: palette.inkMuted }]}>Pengeluaran</Text>
                <Text style={[styles.flowExpense, { color: palette.expense }]}>-{formatRupiah(summary.total_expense)}</Text>
              </View>
            </View>
          </View>

          {/* Line Chart Visual Grafik Arus Finansial Catatan */}
          {(() => {
            const trendPoints = recentTrend.length > 0 ? recentTrend : [0, 0];
            const svgWidth = 300;
            const svgHeight = 52;
            const padX = 10;
            const padY = 8;
            const minVal = Math.min(...trendPoints, 0);
            const maxVal = Math.max(...trendPoints, 0);
            const range = maxVal - minVal === 0 ? 1 : maxVal - minVal;
            const stepX = trendPoints.length > 1 ? (svgWidth - padX * 2) / (trendPoints.length - 1) : 0;
            const coordinates = trendPoints.map((val, idx) => {
              const x = padX + idx * stepX;
              const y = svgHeight - padY - ((val - minVal) / range) * (svgHeight - padY * 2);
              return { x, y, val };
            });
            const pathD = coordinates.reduce((acc, curr, idx) => {
              return idx === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`;
            }, '');
            const areaD = coordinates.length > 1
              ? `${pathD} L ${coordinates[coordinates.length - 1].x} ${svgHeight} L ${coordinates[0].x} ${svgHeight} Z`
              : '';
            const isPos = summary.balance >= 0;
            const strokeColor = isPos ? PALETTE.primary : PALETTE.expense;
            const gradientId = `detail_trend_${cashbookId}`;

            return (
              <View style={styles.trendBox}>
                <View style={styles.trendHeader}>
                  <Text style={styles.trendTitle}>Grafik Tren Aktivitas</Text>
                  <Text style={styles.trendSubtitle}>
                    {recentTrend.length > 0 ? '7 Hari Terakhir' : 'Belum Ada Transaksi'}
                  </Text>
                </View>
                <View style={styles.trendSvgWrap}>
                  <Svg width="100%" height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
                    <Defs>
                      <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor={strokeColor} stopOpacity="0.25" />
                        <Stop offset="1" stopColor={strokeColor} stopOpacity="0.0" />
                      </LinearGradient>
                    </Defs>
                    {areaD ? <Path d={areaD} fill={`url(#${gradientId})`} /> : null}
                    <Path
                      d={pathD}
                      stroke={strokeColor}
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                    {coordinates.map((pt, i) => (
                      <Circle
                        key={i}
                        cx={pt.x}
                        cy={pt.y}
                        r="3.5"
                        fill="#FFFFFF"
                        stroke={strokeColor}
                        strokeWidth="2.2"
                      />
                    ))}
                  </Svg>
                </View>
              </View>
            );
          })()}

          {/* Progress Bar Anggaran Total */}
          {hasBudget && (
            <View style={styles.budgetBox}>
              <View style={styles.budgetRow}>
                <Text style={styles.budgetLabel}>Batas Anggaran ({budgetPercent}% terpakai)</Text>
                <Text style={styles.budgetValues}>
                  {formatRupiah(summary.total_expense)} / {formatRupiah(budgetLimit)}
                </Text>
              </View>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${budgetRatio * 100}%`, backgroundColor: progressColor }]} />
              </View>
            </View>
          )}
        </View>

        {/* Header Pintasan Fitur & Tombol Kustomisasi */}
        <View style={styles.shortcutHeaderRow}>
          <Text style={[styles.shortcutHeaderTitle, { color: palette.inkMuted }]}>PINTASAN MENU</Text>
          <Pressable
            style={({ pressed }) => [
              styles.customizeBtn,
              { backgroundColor: isDarkMode ? 'rgba(45, 106, 79, 0.25)' : palette.primarySurface },
              pressed && { opacity: 0.7 },
            ]}
            onPress={openCustomizeModal}
          >
            <CustomizeActionIcon color={palette.primary} size={14} />
            <Text style={[styles.customizeBtnText, { color: palette.primary }]}>Kustomisasi</Text>
          </Pressable>
        </View>

        {/* Grid Menu Aksi Cepat (Bisa Di-Kustomisasi) */}
        <View style={styles.toolsGrid}>
          {activeShortcuts.map((item) => (
            <Pressable
              key={item.id}
              style={({ pressed }) => [
                styles.toolTile,
                { backgroundColor: palette.card, borderColor: palette.border },
                pressed && [styles.toolPressed, { backgroundColor: isDarkMode ? '#182735' : '#FAFCFB' }],
              ]}
              onPress={() => router.push(item.route as any)}
            >
              <View
                style={[
                  styles.toolIconCircle,
                  {
                    backgroundColor: isDarkMode ? '#16313B' : palette.primarySurface,
                    borderColor: isDarkMode ? '#234450' : '#CCFBF1',
                  },
                ]}
              >
                {renderShortcutIcon(item.iconType, palette.primary)}
              </View>
              <Text style={[styles.toolText, { color: palette.ink }]} numberOfLines={1}>{item.name}</Text>
            </Pressable>
          ))}
        </View>

        {/* Ringkasan Hutang / Piutang Compact Card */}
        <View style={[styles.debtOverview, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.debtCol}>
            <Text style={[styles.debtSub, { color: palette.inkMuted }]}>Sisa Hutang</Text>
            <Text style={[styles.debtVal, { color: palette.expense }]}>{formatRupiah(debtSummary.total_debt)}</Text>
          </View>
          <View style={[styles.debtDivider, { backgroundColor: palette.borderSubtle }]} />
          <View style={styles.debtCol}>
            <Text style={[styles.debtSub, { color: palette.inkMuted }]}>Piutang Belum Cair</Text>
            <Text style={[styles.recVal, { color: palette.income }]}>{formatRupiah(debtSummary.total_receivable)}</Text>
          </View>
        </View>

        {/* Saldo per Rekening / Dompet */}
        {accounts.length > 0 && (
          <View style={styles.sectionWrap}>
            <View style={styles.sectionHeaderInside}>
              <Text style={[styles.sectionTitle, { color: palette.ink }]}>Dompet & Rekening</Text>
              <Pressable onPress={() => router.push('/wallets')}>
                <Text style={styles.sectionLink}>Kelola ›</Text>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.accountScroll}>
              {accounts.map((acc) => (
                <View
                  key={acc.id}
                  style={[styles.miniAccountCard, { backgroundColor: palette.card, borderColor: palette.border }]}
                >
                  <View style={styles.miniAccountTop}>
                    <Text style={styles.miniIcon}>{acc.icon}</Text>
                    <Text style={[styles.miniName, { color: palette.ink }]} numberOfLines={1}>{acc.name}</Text>
                  </View>
                  <Text style={[styles.miniBalance, { color: palette.income }]}>{formatRupiah(acc.calculated_balance)}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Target Menabung Highlight */}
        {savingsGoals.length > 0 && (
          <View style={styles.sectionWrap}>
            <View style={styles.sectionHeaderInside}>
              <Text style={[styles.sectionTitle, { color: palette.ink }]}>Target Menabung</Text>
              <Pressable onPress={() => router.push('/savings-goals')}>
                <Text style={styles.sectionLink}>Semua ›</Text>
              </Pressable>
            </View>
            {savingsGoals.slice(0, 2).map((goal) => {
              const ratio = Math.min(goal.current_amount / goal.target_amount, 1);
              const pct = Math.round(ratio * 100);
              return (
                <View
                  key={goal.id}
                  style={[styles.miniGoalCard, { backgroundColor: palette.card, borderColor: palette.border }]}
                >
                  <View style={styles.miniGoalHeader}>
                    <Text style={[styles.miniGoalName, { color: palette.ink }]}>
                      {goal.icon} {goal.name}
                    </Text>
                    <Text style={styles.miniGoalPct}>{pct}%</Text>
                  </View>
                  <View style={[styles.progressBarSm, { backgroundColor: palette.border }]}>
                    <View style={[styles.progressFillSm, { width: `${pct}%`, backgroundColor: goal.color || PALETTE.primary }]} />
                  </View>
                  <Text style={[styles.miniGoalValues, { color: palette.inkMuted }]}>
                    {formatRupiah(goal.current_amount)} dari {formatRupiah(goal.target_amount)}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Pengeluaran per Kategori */}
        <View style={[styles.breakdownCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.breakdownTitle, { color: palette.ink }]}>Pengeluaran per Kategori</Text>
          {breakdown.length === 0 ? (
            <Text style={[styles.emptyText, { color: palette.inkMuted }]}>Belum ada pengeluaran bulan ini</Text>
          ) : (
            breakdown.map((item) => {
              const percentage = totalExpense > 0 ? (item.total / totalExpense) * 100 : 0;
              return (
                <View key={item.category_id} style={styles.breakdownItem}>
                  <View style={styles.breakdownLeft}>
                    <View style={[styles.catIconBox, { backgroundColor: palette.cardMuted }]}>
                      <Text style={styles.catIcon}>{item.category_icon}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.breakdownName, { color: palette.ink }]}>{item.category_name}</Text>
                      <View style={[styles.progressBarSm, { backgroundColor: palette.border }]}>
                        <View style={[styles.progressFillSm, { width: `${percentage}%`, backgroundColor: palette.expense }]} />
                      </View>
                    </View>
                  </View>
                  <View style={styles.breakdownRight}>
                    <Text style={[styles.breakdownAmount, { color: palette.ink }]}>{formatRupiah(item.total)}</Text>
                    <Text style={[styles.breakdownPercent, { color: palette.inkMuted }]}>{Math.round(percentage)}%</Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Primary Action Button */}
        <Pressable
          style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
          onPress={() => router.push('/add-transaction')}
        >
          <Text style={styles.addButtonText}>+ Catat Transaksi Baru</Text>
        </Pressable>

        {/* Footer Copyright Terkunci di Bawah */}
        <View style={styles.footerWrap}>
          <Text style={[styles.footerText, { color: palette.inkMuted }]}>© 2026 CatatKu</Text>
        </View>
      </ScrollView>

      {/* Modal Kustomisasi Pintasan Fitur */}
      <Modal
        visible={showCustomizeModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCustomizeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: palette.card }, isTablet && { maxWidth: 540, alignSelf: 'center', width: '100%', borderRadius: 24 }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: palette.ink }]}>Kustomisasi Pintasan</Text>
                <Text style={[styles.modalSub, { color: palette.inkMuted }]}>
                  Pilih menu aksi cepat favorit Anda (minimal 1 menu)
                </Text>
              </View>
              <Pressable
                style={[styles.modalCloseBtn, { backgroundColor: palette.cardMuted }]}
                onPress={() => setShowCustomizeModal(false)}
              >
                <Text style={[styles.modalCloseText, { color: palette.ink }]}>✕</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.modalScroll}>
              <View style={styles.customizeList}>
                {ALL_AVAILABLE_SHORTCUTS.map((item) => {
                  const isSelected = tempShortcutIds.includes(item.id);
                  return (
                    <Pressable
                      key={item.id}
                      style={[
                        styles.customizeItem,
                        { borderColor: palette.borderSubtle, backgroundColor: palette.card },
                        isSelected && [
                          styles.customizeItemSelected,
                          {
                            borderColor: palette.primary,
                            backgroundColor: isDarkMode ? '#172B38' : '#F8FCFB',
                          },
                        ],
                      ]}
                      onPress={() => toggleShortcutSelection(item.id)}
                    >
                      <View
                        style={[
                          styles.customizeIconBox,
                          {
                            backgroundColor: isDarkMode ? '#1B2C3B' : palette.primarySurface,
                            borderColor: isDarkMode ? '#234450' : '#CCFBF1',
                            borderWidth: 1,
                          },
                        ]}
                      >
                        {renderShortcutIcon(item.iconType, palette.primary)}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.customizeItemName, { color: palette.ink }]}>{item.name}</Text>
                        <Text style={[styles.customizeItemSub, { color: palette.inkMuted }]}>Buka fitur {item.name.toLowerCase()}</Text>
                      </View>
                      <View
                        style={[
                          styles.checkbox,
                          { borderColor: palette.border, backgroundColor: palette.cardMuted },
                          isSelected && styles.checkboxActive,
                        ]}
                      >
                        {isSelected && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnCancel, { backgroundColor: palette.cardMuted }]}
                onPress={() => setShowCustomizeModal(false)}
              >
                <Text style={[styles.modalBtnTextCancel, { color: palette.inkSecondary }]}>Batal</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnSave]}
                onPress={handleSaveShortcuts}
              >
                <Text style={styles.modalBtnTextSave}>Simpan ({tempShortcutIds.length})</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modern Alert Modal */}
      <ModernConfirmModal
        visible={modalAlert.visible}
        type={modalAlert.type}
        icon={modalAlert.icon}
        title={modalAlert.title}
        message={modalAlert.message}
        confirmText="Mengerti"
        cancelText=""
        onConfirm={() => setModalAlert((prev) => ({ ...prev, visible: false }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screenWrapper: { flex: 1, backgroundColor: PALETTE.canvas },
  container: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 24 },
  header: { marginBottom: 14, paddingTop: 40 },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
    marginBottom: 8,
    borderRadius: 10,
    backgroundColor: PALETTE.primarySurface,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  backBtnText: {
    fontFamily: FONTS.sansBold,
    fontSize: 13,
    color: PALETTE.primary,
    fontWeight: '700',
  },
  bookHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bookIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  bookIcon: { fontSize: 22 },
  bookTitle: { fontFamily: FONTS.serifTitle, fontSize: 24, fontWeight: '800', color: PALETTE.ink },
  periodText: { fontFamily: FONTS.sansMedium, fontSize: 12, color: PALETTE.inkMuted, marginTop: 1 },
  addBookQuickBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBookQuickText: {
    fontFamily: FONTS.sansBold,
    fontSize: 12,
    fontWeight: '700',
  },
  heroCard: {
    backgroundColor: PALETTE.card,
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: PALETTE.border,
    ...PALETTE.shadowLight,
  },
  heroLabel: {
    fontFamily: FONTS.sansBold,
    fontSize: 10,
    color: PALETTE.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroAmount: {
    fontFamily: FONTS.serifTitle,
    fontSize: 30,
    fontWeight: '800',
    marginVertical: 4,
    letterSpacing: -0.5,
  },
  flowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 14,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: PALETTE.borderSubtle,
  },
  flowItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  flowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  flowLabel: { fontFamily: FONTS.sansMedium, fontSize: 11, color: PALETTE.inkMuted },
  flowIncome: { fontFamily: FONTS.sansBold, fontSize: 13, color: PALETTE.income, marginTop: 1 },
  flowExpense: { fontFamily: FONTS.sansBold, fontSize: 13, color: PALETTE.expense, marginTop: 1 },
  flowDivider: { width: 1, height: 24, backgroundColor: PALETTE.borderSubtle, marginHorizontal: 8 },
  trendBox: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: PALETTE.borderSubtle,
  },
  trendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  trendTitle: {
    fontFamily: FONTS.sansBold,
    fontSize: 10,
    color: PALETTE.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  trendSubtitle: {
    fontFamily: FONTS.sansMedium,
    fontSize: 10,
    color: PALETTE.inkSecondary,
  },
  trendSvgWrap: {
    height: 52,
    width: '100%',
    backgroundColor: '#F8FCFA',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: PALETTE.borderSubtle,
    justifyContent: 'center',
  },
  budgetBox: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: PALETTE.borderSubtle,
  },
  budgetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  budgetLabel: { fontFamily: FONTS.sansMedium, fontSize: 11, color: PALETTE.inkSecondary },
  budgetValues: { fontFamily: FONTS.sansRegular, fontSize: 10, color: PALETTE.inkMuted },
  progressBar: {
    height: 6,
    backgroundColor: PALETTE.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3 },
  shortcutHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 4,
  },
  shortcutHeaderTitle: {
    fontFamily: FONTS.sansBold,
    fontSize: 11,
    color: PALETTE.inkMuted,
    letterSpacing: 0.8,
  },
  customizeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EAF6F3',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  customizeBtnText: {
    fontFamily: FONTS.sansBold,
    fontSize: 11,
    color: PALETTE.primary,
  },
  toolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    columnGap: 8,
    rowGap: 10,
    marginBottom: 16,
  },
  toolTile: {
    width: '23%',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 2,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  toolPressed: {
    transform: [{ scale: 0.96 }],
  },
  toolIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 4,
  },
  toolText: {
    fontFamily: FONTS.sansBold,
    fontSize: 11,
    textAlign: 'center',
  },
  debtOverview: {
    flexDirection: 'row',
    backgroundColor: PALETTE.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: PALETTE.border,
    ...PALETTE.shadowLight,
  },
  debtCol: { flex: 1, alignItems: 'center' },
  debtSub: { fontFamily: FONTS.sansMedium, fontSize: 11, color: PALETTE.inkMuted },
  debtVal: { fontFamily: FONTS.serifTitle, fontSize: 15, fontWeight: '700', color: PALETTE.expense, marginTop: 2 },
  recVal: { fontFamily: FONTS.serifTitle, fontSize: 15, fontWeight: '700', color: PALETTE.income, marginTop: 2 },
  debtDivider: { width: 1, height: 26, backgroundColor: PALETTE.borderSubtle, alignSelf: 'center' },
  sectionWrap: { marginBottom: 16 },
  sectionHeaderInside: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: { fontFamily: FONTS.serifTitle, fontSize: 16, fontWeight: '700', color: PALETTE.ink },
  sectionLink: { fontFamily: FONTS.sansBold, fontSize: 12, color: PALETTE.primary },
  accountScroll: { flexDirection: 'row' },
  miniAccountCard: {
    backgroundColor: PALETTE.card,
    borderRadius: 14,
    padding: 12,
    marginRight: 8,
    minWidth: 120,
    borderWidth: 1,
    borderColor: PALETTE.border,
    ...PALETTE.shadowLight,
  },
  miniAccountTop: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  miniIcon: { fontSize: 15 },
  miniName: { fontFamily: FONTS.sansBold, fontSize: 12, color: PALETTE.ink, flex: 1 },
  miniBalance: { fontFamily: FONTS.serifTitle, fontSize: 14, fontWeight: '800', color: PALETTE.income },
  miniGoalCard: {
    backgroundColor: PALETTE.card,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  miniGoalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  miniGoalName: { fontFamily: FONTS.sansBold, fontSize: 12, color: PALETTE.ink },
  miniGoalPct: { fontFamily: FONTS.sansBold, fontSize: 12, color: PALETTE.primary },
  miniGoalValues: { fontFamily: FONTS.sansRegular, fontSize: 10, color: PALETTE.inkMuted, marginTop: 4 },
  breakdownCard: {
    backgroundColor: PALETTE.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: PALETTE.border,
    ...PALETTE.shadowLight,
  },
  breakdownTitle: { fontFamily: FONTS.serifTitle, fontSize: 15, fontWeight: '700', color: PALETTE.ink, marginBottom: 12 },
  emptyText: { fontFamily: FONTS.sansRegular, fontSize: 12, color: PALETTE.inkMuted, textAlign: 'center', paddingVertical: 12 },
  breakdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  breakdownLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12 },
  catIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: PALETTE.cardMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  catIcon: { fontSize: 14 },
  breakdownName: { fontFamily: FONTS.sansMedium, fontSize: 12, color: PALETTE.ink },
  progressBarSm: {
    height: 4,
    backgroundColor: PALETTE.border,
    borderRadius: 2,
    marginTop: 4,
    overflow: 'hidden',
  },
  progressFillSm: { height: '100%', borderRadius: 2, backgroundColor: PALETTE.expense },
  breakdownRight: { alignItems: 'flex-end' },
  breakdownAmount: { fontFamily: FONTS.sansBold, fontSize: 12, color: PALETTE.ink },
  breakdownPercent: { fontFamily: FONTS.sansRegular, fontSize: 10, color: PALETTE.inkMuted, marginTop: 1 },
  addButton: {
    backgroundColor: PALETTE.primary,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    ...PALETTE.shadowMedium,
  },
  addButtonPressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.9,
  },
  addButtonText: {
    fontFamily: FONTS.sansBold,
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },

  // Modal Styling
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: PALETTE.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 18,
    paddingHorizontal: 20,
    paddingBottom: 28,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  modalTitle: {
    fontFamily: FONTS.serifTitle,
    fontSize: 18,
    fontWeight: '800',
    color: PALETTE.ink,
  },
  modalSub: {
    fontFamily: FONTS.sansRegular,
    fontSize: 12,
    color: PALETTE.inkMuted,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: PALETTE.cardMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 14,
    fontWeight: '700',
    color: PALETTE.inkSecondary,
  },
  modalScroll: {
    maxHeight: 340,
    marginVertical: 8,
  },
  customizeList: {
    gap: 8,
  },
  customizeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PALETTE.card,
    borderWidth: 1,
    borderColor: PALETTE.border,
    borderRadius: 14,
    padding: 10,
    gap: 12,
  },
  customizeItemSelected: {
    borderColor: PALETTE.primary,
    backgroundColor: '#F8FCFB',
  },
  customizeIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customizeItemName: {
    fontFamily: FONTS.sansBold,
    fontSize: 13,
    color: PALETTE.ink,
  },
  customizeItemSub: {
    fontFamily: FONTS.sansRegular,
    fontSize: 11,
    color: PALETTE.inkMuted,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: PALETTE.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxActive: {
    backgroundColor: PALETTE.primary,
    borderColor: PALETTE.primary,
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  modalBtnCancel: {
    backgroundColor: PALETTE.cardMuted,
  },
  modalBtnSave: {
    backgroundColor: PALETTE.primary,
  },
  modalBtnTextCancel: {
    fontFamily: FONTS.sansBold,
    fontSize: 13,
    color: PALETTE.inkSecondary,
  },
  modalBtnTextSave: {
    fontFamily: FONTS.sansBold,
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  footerWrap: {
    alignItems: 'center',
    paddingVertical: 24,
    marginTop: 'auto',
  },
  footerText: {
    fontFamily: FONTS.sansRegular,
    fontSize: 12,
  },
});
