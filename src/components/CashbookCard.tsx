import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { type CashbookStats } from '../database/queries';
import { formatRupiah } from '../utils/currency';
import { PALETTE, LIGHT_PALETTE, DARK_PALETTE, FONTS } from '../constants/theme';

interface Props {
  cashbook: CashbookStats;
  onPress: () => void;
  onLongPress?: () => void;
  isDark?: boolean;
}

export default function CashbookCard({ cashbook, onPress, onLongPress, isDark = false }: Props) {
  const activePalette = isDark ? DARK_PALETTE : LIGHT_PALETTE;
  const isArchived = cashbook.is_archived === 1;
  const hasBudget = cashbook.budget_limit !== null && cashbook.budget_limit > 0;
  const budgetRatio = hasBudget ? Math.min(cashbook.total_expense / cashbook.budget_limit!, 1) : 0;
  const budgetPercent = hasBudget ? Math.round((cashbook.total_expense / cashbook.budget_limit!) * 100) : 0;

  let progressColor = activePalette.income;
  if (budgetPercent >= 90) progressColor = activePalette.expense;
  else if (budgetPercent >= 70) progressColor = activePalette.debt;

  const bookColor = cashbook.color || activePalette.primary;

  const typeConfig = {
    organization: { label: 'Organisasi', bg: isDark ? '#3B1863' : '#EDE9FE', color: isDark ? '#D8B4FE' : '#6D28D9' },
    business: { label: 'Bisnis', bg: isDark ? '#533408' : '#FEF3C7', color: isDark ? '#FDE68A' : '#B45309' },
    personal: { label: 'Pribadi', bg: activePalette.cardMuted, color: activePalette.primary },
  }[cashbook.type || 'personal'] || { label: 'Pribadi', bg: activePalette.cardMuted, color: activePalette.primary };

  // Hitung rasio pemasukan vs pengeluaran untuk mini progress bar
  const totalVolume = cashbook.total_income + cashbook.total_expense;
  const incomePercent = totalVolume > 0 ? Math.round((cashbook.total_income / totalVolume) * 100) : 50;
  const expensePercent = totalVolume > 0 ? 100 - incomePercent : 50;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: activePalette.card,
          borderColor: activePalette.border,
        },
        pressed && [styles.pressed, { backgroundColor: isDark ? '#182735' : '#FAFCFB' }],
        isArchived && styles.archivedCard,
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      <View style={styles.contentWrap}>
        {/* Top Header Row */}
        <View style={styles.headerRow}>
          <View style={styles.titleArea}>
            <View style={[styles.iconBox, { backgroundColor: `${bookColor}18`, borderColor: `${bookColor}30` }]}>
              <Text style={styles.icon}>{cashbook.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.nameBadgeRow}>
                <Text style={[styles.title, { color: activePalette.ink }]} numberOfLines={1} allowFontScaling={false}>{cashbook.name}</Text>
                <View style={[styles.typeBadge, { backgroundColor: typeConfig.bg }]}>
                  <Text style={[styles.typeBadgeText, { color: typeConfig.color }]} allowFontScaling={false}>
                    {typeConfig.label}
                  </Text>
                </View>
                {isArchived && (
                  <View style={[styles.archiveBadge, { backgroundColor: isDark ? '#334155' : '#E2E8F0' }]}>
                    <Text style={[styles.archiveText, { color: isDark ? '#94A3B8' : activePalette.inkSecondary }]} allowFontScaling={false}>Arsip</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.metaText, { color: activePalette.inkMuted }]} allowFontScaling={false}>{cashbook.transaction_count} transaksi dicatat</Text>
            </View>
          </View>
          <View style={[styles.chevronWrap, { backgroundColor: activePalette.cardMuted }]}>
            <Text style={[styles.chevron, { color: activePalette.inkMuted }]} allowFontScaling={false}>›</Text>
          </View>
        </View>

        {/* Balance & Stats Row */}
        <View style={[styles.balanceContainer, { borderTopColor: activePalette.borderSubtle }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.balanceLabel, { color: activePalette.inkMuted }]} allowFontScaling={false}>Saldo Tersedia</Text>
            <Text
              style={[
                styles.balanceAmount,
                { color: cashbook.balance >= 0 ? activePalette.ink : activePalette.expense },
              ]}
              numberOfLines={1}
              allowFontScaling={false}
            >
              {formatRupiah(cashbook.balance)}
            </Text>
          </View>

          <View style={styles.inOutStats}>
            <View style={[styles.statChipIncome, { backgroundColor: isDark ? '#064E3B40' : '#F0FDF4', borderColor: isDark ? '#065F46' : '#DCFCE7' }]}>
              <Text style={styles.statArrow} allowFontScaling={false}>↗</Text>
              <Text style={[styles.statIncomeText, { color: activePalette.income }]} allowFontScaling={false}>+{formatRupiah(cashbook.total_income)}</Text>
            </View>
            <View style={[styles.statChipExpense, { backgroundColor: isDark ? '#4C051940' : '#FFF1F2', borderColor: isDark ? '#881337' : '#FFE4E6' }]}>
              <Text style={styles.statArrow} allowFontScaling={false}>↘</Text>
              <Text style={[styles.statExpenseText, { color: activePalette.expense }]} allowFontScaling={false}>-{formatRupiah(cashbook.total_expense)}</Text>
            </View>
          </View>
        </View>

        {/* Mini Grafik Bar Rasio Arus Catatan */}
        <View style={[styles.chartContainer, { borderTopColor: activePalette.borderSubtle }]}>
          <View style={styles.chartHeader}>
            <Text style={[styles.chartTitle, { color: activePalette.inkMuted }]} allowFontScaling={false}>Rasio Arus Keuangan</Text>
            <Text style={[styles.chartRatioText, { color: activePalette.inkSecondary }]} allowFontScaling={false}>
              Masuk <Text style={{ color: activePalette.income, fontWeight: '700' }} allowFontScaling={false}>{incomePercent}%</Text> • Keluar <Text style={{ color: activePalette.expense, fontWeight: '700' }} allowFontScaling={false}>{expensePercent}%</Text>
            </Text>
          </View>
          <View style={[styles.chartBarTrack, { backgroundColor: isDark ? '#23384B' : '#E2E8F0' }]}>
            <View
              style={[
                styles.chartBarIncome,
                { width: `${incomePercent}%`, backgroundColor: activePalette.income },
              ]}
            />
            <View
              style={[
                styles.chartBarExpense,
                { width: `${expensePercent}%`, backgroundColor: activePalette.expense },
              ]}
            />
          </View>
        </View>

        {/* Budget Progress if Available */}
        {hasBudget && (
          <View style={[styles.budgetSection, { borderTopColor: activePalette.borderSubtle }]}>
            <View style={styles.budgetHeader}>
              <Text style={[styles.budgetLabel, { color: activePalette.inkSecondary }]}>Anggaran Terpakai</Text>
              <Text style={[styles.budgetPercentText, { color: activePalette.ink }]}>{budgetPercent}%</Text>
            </View>
            <View style={[styles.progressBar, { backgroundColor: activePalette.cardMuted }]}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${budgetRatio * 100}%`, backgroundColor: progressColor },
                ]}
              />
            </View>
            <Text style={[styles.budgetValues, { color: activePalette.inkMuted }]}>
              {formatRupiah(cashbook.total_expense)} dari kuota {formatRupiah(cashbook.budget_limit!)}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: PALETTE.card,
    borderRadius: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: PALETTE.border,
    overflow: 'hidden',
    ...PALETTE.shadowLight,
  },
  contentWrap: {
    padding: 14,
  },
  pressed: {
    transform: [{ scale: 0.988 }],
  },
  archivedCard: {
    opacity: 0.65,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  titleArea: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1,
  },
  icon: {
    fontSize: 20,
  },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  title: {
    fontFamily: FONTS.serifTitle,
    fontSize: 15,
    fontWeight: '700',
    color: PALETTE.ink,
  },
  typeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    minHeight: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeBadgeText: {
    fontFamily: FONTS.sansBold,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  archiveBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    minHeight: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  archiveText: {
    fontFamily: FONTS.sansBold,
    fontSize: 10,
    color: PALETTE.inkSecondary,
  },
  metaText: {
    fontFamily: FONTS.sansRegular,
    fontSize: 11,
    color: PALETTE.inkMuted,
    marginTop: 1,
  },
  chevronWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: PALETTE.cardMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  chevron: {
    fontSize: 16,
    color: PALETTE.inkMuted,
    fontWeight: '700',
    marginTop: -2,
  },
  balanceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: PALETTE.borderSubtle,
    gap: 10,
  },
  balanceLabel: {
    fontFamily: FONTS.sansBold,
    fontSize: 9,
    color: PALETTE.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  balanceAmount: {
    fontFamily: FONTS.serifTitle,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  inOutStats: {
    alignItems: 'flex-end',
    gap: 3,
  },
  statChipIncome: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  statChipExpense: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF1F2',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FFE4E6',
  },
  statArrow: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
  },
  statIncomeText: {
    fontFamily: FONTS.sansBold,
    fontSize: 10,
    color: PALETTE.income,
    fontWeight: '700',
  },
  statExpenseText: {
    fontFamily: FONTS.sansBold,
    fontSize: 10,
    color: PALETTE.expense,
    fontWeight: '700',
  },

  // Mini Grafik Bar Arus Keuangan
  chartContainer: {
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: PALETTE.borderSubtle,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chartTitle: {
    fontFamily: FONTS.sansMedium,
    fontSize: 9,
    color: PALETTE.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chartRatioText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 9,
    color: PALETTE.inkSecondary,
  },
  chartBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  chartBarIncome: {
    height: '100%',
    backgroundColor: PALETTE.income,
  },
  chartBarExpense: {
    height: '100%',
    backgroundColor: PALETTE.expense,
  },

  budgetSection: {
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: PALETTE.borderSubtle,
  },
  budgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  budgetLabel: {
    fontFamily: FONTS.sansMedium,
    fontSize: 10,
    color: PALETTE.inkSecondary,
  },
  budgetPercentText: {
    fontFamily: FONTS.sansBold,
    fontSize: 10,
    fontWeight: '800',
    color: PALETTE.ink,
  },
  progressBar: {
    height: 5,
    borderRadius: 2.5,
    backgroundColor: PALETTE.cardMuted,
    overflow: 'hidden',
    marginBottom: 3,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2.5,
  },
  budgetValues: {
    fontFamily: FONTS.sansRegular,
    fontSize: 9,
    color: PALETTE.inkMuted,
  },
});
