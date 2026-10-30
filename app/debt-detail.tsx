import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, useWindowDimensions } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { useFocusEffect, Stack, useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getDebtById,
  getDebtPayments,
  addDebtPayment,
  getAccounts,
  type DebtWithPayments,
  type DebtPayment,
  type AccountWithCalculatedBalance,
} from '../src/database/queries';
import { formatRupiah, formatNumberThousand, parseRupiahInput } from '../src/utils/currency';
import { formatDate, getToday } from '../src/utils/date';
import { useThemeStore } from '../src/stores/useThemeStore';
import { FONTS } from '../src/constants/theme';
import { ModernConfirmModal, type ModalType } from '../src/components/ModernConfirmModal';
import { BackArrowIcon } from '../src/components/ActionIcons';

export default function DebtDetailScreen() {
  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();
  const { width } = useWindowDimensions();
  const isTablet = width >= 600;
  const palette = useThemeStore((s) => s.palette);
  const isDarkMode = useThemeStore((s) => s.isDarkMode);

  const params = useLocalSearchParams<{ id: string }>();
  const debtId = parseInt(params.id, 10);

  const [debt, setDebt] = useState<DebtWithPayments | null>(null);
  const [payments, setPayments] = useState<DebtPayment[]>([]);
  const [accounts, setAccounts] = useState<AccountWithCalculatedBalance[]>([]);
  const [showPayForm, setShowPayForm] = useState(false);

  // Form Payment
  const [amount, setAmount] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(getToday());

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

  const loadData = useCallback(async () => {
    const [d, pList, accList] = await Promise.all([
      getDebtById(db, debtId),
      getDebtPayments(db, debtId),
      getAccounts(db, 1),
    ]);
    setDebt(d);
    setPayments(pList);
    setAccounts(accList);
    if (accList.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accList[0].id);
    }
  }, [db, debtId, selectedAccountId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  async function handleAddPayment() {
    const numAmount = parseRupiahInput(amount);
    if (!numAmount || numAmount <= 0) {
      showAlert('Perhatian', 'Masukkan nominal pembayaran cicilan yang valid', 'warning');
      return;
    }

    if (!selectedAccountId) {
      showAlert('Perhatian', 'Pilih akun/dompet transaksi', 'warning');
      return;
    }

    await addDebtPayment(db, {
      debt_id: debtId,
      account_id: selectedAccountId,
      amount: numAmount,
      date,
      note: note.trim(),
    });

    setAmount('');
    setNote('');
    setShowPayForm(false);
    showAlert('Sukses', 'Pembayaran cicilan berhasil dicatat!', 'success', '🤝');
    loadData();
  }

  if (!debt) {
    return (
      <View style={[styles.container, { backgroundColor: palette.canvas, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: palette.inkMuted }}>Memuat data hutang...</Text>
      </View>
    );
  }

  const isDebt = debt.type === 'debt';
  const remaining = Math.max(0, debt.remaining_amount ?? (debt.amount - (debt.total_paid ?? 0)));
  const isPaid = debt.is_paid === 1 || remaining === 0;
  const progressRatio = debt.amount > 0 ? Math.min((debt.total_paid ?? 0) / debt.amount, 1) : 0;
  const progressPercent = Math.round(progressRatio * 100);

  return (
    <View style={[styles.container, { backgroundColor: palette.canvas }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: palette.card, borderBottomColor: palette.border }]}>
        <View style={[styles.headerInner, isTablet && { maxWidth: 840, width: '100%', alignSelf: 'center' }]}>
          <View style={styles.headerLeft}>
            <Pressable
              style={({ pressed }) => [styles.backBtn, { backgroundColor: palette.cardMuted }, pressed && { opacity: 0.7 }]}
              onPress={() => router.back()}
            >
              <BackArrowIcon color={palette.ink} size={18} />
            </Pressable>
            <View>
              <Text style={[styles.headerSub, { color: palette.primary }]}>{isDebt ? 'Hutang Saya' : 'Piutang Saya'}</Text>
              <Text style={[styles.headerTitle, { color: palette.ink }]}>{debt.person_name}</Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          isTablet && { maxWidth: 840, width: '100%', alignSelf: 'center' },
          { paddingBottom: Math.max(insets.bottom, 16) + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Ringkasan Status */}
        <View style={[styles.overviewCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.badgeRow}>
            <View
              style={[
                styles.badge,
                { backgroundColor: isDebt ? (isDarkMode ? '#451A03' : '#FED7AA') : (isDarkMode ? '#3B0764' : '#EDE9FE') },
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  { color: isDebt ? palette.debt : palette.receivable },
                ]}
              >
                {isDebt ? 'Hutang (Kewajiban)' : 'Piutang (Hak Tagih)'}
              </Text>
            </View>
            {isPaid ? (
              <View style={[styles.paidBadge, { backgroundColor: isDarkMode ? '#064E3B' : '#DCFCE7' }]}>
                <Text style={[styles.paidText, { color: palette.income }]}>LUNAS ✓</Text>
              </View>
            ) : null}
          </View>

          <Text style={[styles.personName, { color: palette.ink }]}>{debt.person_name}</Text>
          <Text style={[styles.dateText, { color: palette.inkMuted }]}>Dicatat pada: {formatDate(debt.created_at)}</Text>
          {debt.due_date && (
            <Text style={[styles.dueText, { color: palette.debt }]}>Jatuh tempo: {formatDate(debt.due_date)}</Text>
          )}

          {/* Grid Statistik */}
          <View style={[styles.statGrid, { borderTopColor: palette.borderSubtle }]}>
            <View style={styles.statBox}>
              <Text style={[styles.statLabel, { color: palette.inkMuted }]}>Total Pokok</Text>
              <Text style={[styles.statValue, { color: palette.ink }]}>{formatRupiah(debt.amount)}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statLabel, { color: palette.inkMuted }]}>Sudah Terbayar</Text>
              <Text style={[styles.statValue, { color: palette.income }]}>{formatRupiah(debt.total_paid ?? 0)}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statLabel, { color: palette.inkMuted }]}>Sisa Tagihan</Text>
              <Text style={[styles.statValue, { color: palette.expense }]}>{formatRupiah(remaining)}</Text>
            </View>
          </View>

          {/* Progress Bar */}
          <View style={[styles.progressBar, { backgroundColor: palette.borderSubtle }]}>
            <View style={[styles.progressFill, { width: `${progressRatio * 100}%`, backgroundColor: palette.primary }]} />
          </View>
          <Text style={[styles.progressText, { color: palette.inkSecondary }]}>{progressPercent}% Terbayar</Text>
        </View>

        {/* Action Button: Bayar Cicilan */}
        {!isPaid && (
          <Pressable
            style={({ pressed }) => [
              styles.payBtn,
              { backgroundColor: showPayForm ? palette.cardMuted : palette.primary },
              pressed && { opacity: 0.8 },
            ]}
            onPress={() => setShowPayForm(!showPayForm)}
          >
            <Text style={[styles.payBtnText, { color: showPayForm ? palette.ink : '#FFFFFF' }]}>
              {showPayForm ? 'Tutup Form' : '+ Catat Pembayaran / Cicilan'}
            </Text>
          </Pressable>
        )}

        {/* Form Bayar Cicilan */}
        {showPayForm && (
          <View style={[styles.formCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={[styles.formTitle, { color: palette.ink }]}>Form Pembayaran Cicilan</Text>

            <Text style={[styles.label, { color: palette.inkSecondary }]}>Nominal Pembayaran (Rp)</Text>
            <TextInput
              style={[styles.amountInput, { backgroundColor: palette.cardMuted, borderColor: palette.border, color: palette.ink }]}
              placeholder="0"
              placeholderTextColor={palette.inkMuted}
              keyboardType="numeric"
              value={amount}
              onChangeText={(txt) => setAmount(formatNumberThousand(txt))}
            />

            <Text style={[styles.label, { color: palette.inkSecondary }]}>Pilih Dompet / Akun</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.accountRow}>
              {accounts.map((a) => {
                const isSelected = selectedAccountId === a.id;
                return (
                  <Pressable
                    key={a.id}
                    style={[
                      styles.accountChip,
                      { backgroundColor: palette.cardMuted, borderColor: palette.border },
                      isSelected && { borderColor: palette.primary, backgroundColor: isDarkMode ? '#16313B' : '#EAF6F3' },
                    ]}
                    onPress={() => setSelectedAccountId(a.id)}
                  >
                    <Text style={styles.accountIcon}>{a.icon}</Text>
                    <Text
                      style={[
                        styles.accountName,
                        { color: palette.ink },
                        isSelected && { color: palette.primary, fontWeight: '700' },
                      ]}
                    >
                      {a.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Text style={[styles.label, { color: palette.inkSecondary }]}>Tanggal Pembayaran</Text>
            <TextInput
              style={[styles.input, { backgroundColor: palette.cardMuted, borderColor: palette.border, color: palette.ink }]}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={palette.inkMuted}
              value={date}
              onChangeText={setDate}
            />

            <Text style={[styles.label, { color: palette.inkSecondary }]}>Catatan (Opsional)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: palette.cardMuted, borderColor: palette.border, color: palette.ink }]}
              placeholder="Misal: Cicilan ke-1 via transfer"
              placeholderTextColor={palette.inkMuted}
              value={note}
              onChangeText={setNote}
            />

            <Pressable
              style={({ pressed }) => [styles.saveBtn, { backgroundColor: palette.primary }, pressed && { opacity: 0.8 }]}
              onPress={handleAddPayment}
            >
              <Text style={styles.saveBtnText}>Simpan Pembayaran Cicilan</Text>
            </Pressable>
          </View>
        )}

        {/* Riwayat Cicilan */}
        <Text style={[styles.historyTitle, { color: palette.ink }]}>Riwayat Cicilan ({payments.length})</Text>

        {payments.length === 0 ? (
          <View style={[styles.emptyWrap, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={styles.emptyIcon}>📝</Text>
            <Text style={[styles.emptyTitle, { color: palette.ink }]}>Belum Ada Cicilan</Text>
            <Text style={[styles.emptySub, { color: palette.inkMuted }]}>
              Setiap pembayaran sebagian atau cicilan hutang akan tercatat runut di sini
            </Text>
          </View>
        ) : (
          payments.map((p) => (
            <View
              key={p.id}
              style={[styles.paymentCard, { backgroundColor: palette.card, borderColor: palette.border }]}
            >
              <View style={styles.paymentTop}>
                <Text style={[styles.paymentAccount, { color: palette.ink }]}>
                  💳 {p.account_name ?? 'Dompet'}
                </Text>
                <Text style={[styles.paymentAmount, { color: palette.primary }]}>{formatRupiah(p.amount)}</Text>
              </View>
              <View style={styles.paymentBottom}>
                <Text style={[styles.paymentDate, { color: palette.inkMuted }]}>{formatDate(p.date)}</Text>
                {p.note ? <Text style={[styles.paymentNote, { color: palette.inkSecondary }]}>{p.note}</Text> : null}
              </View>
            </View>
          ))
        )}
      </ScrollView>

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
  container: { flex: 1 },
  header: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerSub: {
    fontFamily: FONTS.sansBold,
    fontSize: 11,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontFamily: FONTS.serifTitle,
    fontSize: 17,
    fontWeight: '800',
  },
  content: { padding: 16, paddingBottom: 40 },
  overviewCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
  },
  badgeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 12, fontWeight: '700', fontFamily: FONTS.sansBold },
  paidBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  paidText: { fontSize: 11, fontWeight: '800', fontFamily: FONTS.sansBold },
  personName: { fontSize: 24, fontWeight: '800', fontFamily: FONTS.serifTitle, marginBottom: 4 },
  dateText: { fontSize: 12, fontFamily: FONTS.sansRegular },
  dueText: { fontSize: 12, fontWeight: '600', marginTop: 2, fontFamily: FONTS.sansMedium },
  statGrid: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 16, borderTopWidth: 1, paddingTop: 12 },
  statBox: { flex: 1 },
  statLabel: { fontSize: 11, fontFamily: FONTS.sansMedium },
  statValue: { fontSize: 14, fontWeight: '800', marginTop: 4, fontFamily: FONTS.sansBold },
  progressBar: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  progressText: { fontSize: 12, textAlign: 'right', marginTop: 4, fontWeight: '600', fontFamily: FONTS.sansMedium },
  payBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  payBtnText: { fontSize: 15, fontWeight: '700', fontFamily: FONTS.sansBold },
  formCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  formTitle: { fontSize: 16, fontWeight: '700', fontFamily: FONTS.sansBold, marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', fontFamily: FONTS.sansMedium, marginTop: 8, marginBottom: 6 },
  amountInput: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 20,
    fontWeight: '700',
    fontFamily: FONTS.sansBold,
    borderWidth: 1,
  },
  accountRow: { flexDirection: 'row', marginBottom: 6 },
  accountChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginRight: 8,
    borderWidth: 1,
  },
  accountIcon: { fontSize: 16, marginRight: 6 },
  accountName: { fontSize: 13, fontFamily: FONTS.sansMedium },
  input: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
    fontFamily: FONTS.sansRegular,
  },
  saveBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 14,
  },
  saveBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', fontFamily: FONTS.sansBold },
  historyTitle: { fontSize: 16, fontWeight: '700', fontFamily: FONTS.sansBold, marginBottom: 10 },
  emptyWrap: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    marginTop: 8,
  },
  emptyIcon: { fontSize: 32, marginBottom: 8 },
  emptyTitle: { fontSize: 15, fontFamily: FONTS.sansBold, marginBottom: 4 },
  emptySub: { fontSize: 13, fontFamily: FONTS.sansRegular, textAlign: 'center', lineHeight: 18 },
  emptyText: { textAlign: 'center', marginTop: 12, fontFamily: FONTS.sansRegular },
  paymentCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
  },
  paymentTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  paymentAccount: { fontSize: 14, fontWeight: '700', fontFamily: FONTS.sansBold },
  paymentAmount: { fontSize: 15, fontWeight: '800', fontFamily: FONTS.sansBold },
  paymentBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  paymentDate: { fontSize: 12, fontFamily: FONTS.sansRegular },
  paymentNote: { fontSize: 12, fontStyle: 'italic', fontFamily: FONTS.sansRegular },
});
