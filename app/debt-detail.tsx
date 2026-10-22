import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Alert, FlatList } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { useFocusEffect, Stack, useLocalSearchParams, router } from 'expo-router';
import {
  getDebtById,
  getDebtPayments,
  addDebtPayment,
  getAccounts,
  type DebtWithPayments,
  type DebtPayment,
  type AccountWithCalculatedBalance,
} from '../src/database/queries';
import { formatRupiah } from '../src/utils/currency';
import { formatDate, getToday } from '../src/utils/date';

export default function DebtDetailScreen() {
  const db = useSQLiteContext();
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

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [debtId])
  );

  async function loadData() {
    const d = await getDebtById(db, debtId);
    if (!d) return;
    setDebt(d);

    const [pays, accs] = await Promise.all([
      getDebtPayments(db, debtId),
      getAccounts(db, d.cashbook_id),
    ]);
    setPayments(pays);
    setAccounts(accs);
    if (accs.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accs[0].id);
    }
  }

  async function handleAddPayment() {
    if (!selectedAccountId) {
      Alert.alert('Perhatian', 'Pilih dompet / akun sumber pembayaran');
      return;
    }

    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      Alert.alert('Perhatian', 'Masukkan nominal cicilan yang valid');
      return;
    }

    if (debt && numAmount > debt.remaining_amount) {
      Alert.alert('Perhatian', `Nominal cicilan melebihi sisa tagihan (${formatRupiah(debt.remaining_amount)})`);
      return;
    }

    await addDebtPayment(db, {
      debt_id: debtId,
      account_id: selectedAccountId,
      amount: numAmount,
      date,
      note,
    });

    setAmount('');
    setNote('');
    setShowPayForm(false);
    loadData();
  }

  if (!debt) return null;

  const isDebt = debt.type === 'debt';
  const isPaid = debt.is_paid === 1 || debt.remaining_amount <= 0;
  const progressRatio = debt.amount > 0 ? Math.min(debt.total_paid / debt.amount, 1) : 0;
  const progressPercent = Math.round(progressRatio * 100);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Rincian & Cicilan',
          headerStyle: { backgroundColor: '#FFFFFF' },
          headerTintColor: '#0F172A',
          headerTitleStyle: { fontWeight: '700' },
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Header Overview Card */}
        <View style={styles.overviewCard}>
          <View style={styles.badgeRow}>
            <View style={[styles.badge, isDebt ? styles.badgeDebt : styles.badgeReceivable]}>
              <Text style={[styles.badgeText, isDebt ? styles.textDebt : styles.textReceivable]}>
                {isDebt ? '💸 Saya Berhutang' : '💎 Piutang Saya'}
              </Text>
            </View>
            {isPaid && (
              <View style={styles.paidBadge}>
                <Text style={styles.paidText}>LUNAS</Text>
              </View>
            )}
          </View>

          <Text style={styles.personName}>{debt.person_name}</Text>
          <Text style={styles.dateText}>Tanggal Pinjam: {formatDate(debt.date)}</Text>
          {debt.due_date && <Text style={styles.dueText}>Jatuh Tempo: {formatDate(debt.due_date)}</Text>}

          <View style={styles.statGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Total Pinjaman</Text>
              <Text style={styles.statValue}>{formatRupiah(debt.amount)}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Sudah Dibayar</Text>
              <Text style={[styles.statValue, { color: '#16A34A' }]}>{formatRupiah(debt.total_paid)}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Sisa Tagihan</Text>
              <Text style={[styles.statValue, { color: isPaid ? '#16A34A' : '#DC2626' }]}>
                {formatRupiah(debt.remaining_amount)}
              </Text>
            </View>
          </View>

          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progressPercent}%`, backgroundColor: isDebt ? '#EA580C' : '#7C3AED' }]} />
          </View>
          <Text style={styles.progressText}>{progressPercent}% terbayar</Text>
        </View>

        {/* Action Button: Bayar Cicilan */}
        {!isPaid && (
          <Pressable
            style={({ pressed }) => [styles.payBtn, pressed && { opacity: 0.8 }]}
            onPress={() => setShowPayForm(!showPayForm)}
          >
            <Text style={styles.payBtnText}>{showPayForm ? 'Tutup Form' : '+ Catat Pembayaran / Cicilan'}</Text>
          </Pressable>
        )}

        {/* Form Bayar Cicilan */}
        {showPayForm && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Form Pembayaran Cicilan</Text>

            <Text style={styles.label}>Nominal Pembayaran (Rp)</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="0"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />

            <Text style={styles.label}>Pilih Dompet / Akun</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.accountRow}>
              {accounts.map((a) => (
                <Pressable
                  key={a.id}
                  style={[styles.accountChip, selectedAccountId === a.id && styles.accountChipSelected]}
                  onPress={() => setSelectedAccountId(a.id)}
                >
                  <Text style={styles.accountIcon}>{a.icon}</Text>
                  <Text style={[styles.accountName, selectedAccountId === a.id && styles.accountNameSelected]}>
                    {a.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.label}>Tanggal Pembayaran</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#94A3B8"
              value={date}
              onChangeText={setDate}
            />

            <Text style={styles.label}>Catatan (Opsional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Misal: Cicilan ke-1 via transfer"
              placeholderTextColor="#94A3B8"
              value={note}
              onChangeText={setNote}
            />

            <Pressable
              style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.8 }]}
              onPress={handleAddPayment}
            >
              <Text style={styles.saveBtnText}>Simpan Cicilan</Text>
            </Pressable>
          </View>
        )}

        {/* Riwayat Cicilan */}
        <Text style={styles.historyTitle}>Riwayat Cicilan ({payments.length})</Text>

        {payments.length === 0 ? (
          <Text style={styles.emptyText}>Belum ada riwayat cicilan yang dicatat</Text>
        ) : (
          payments.map((p) => (
            <View key={p.id} style={styles.paymentCard}>
              <View style={styles.paymentTop}>
                <Text style={styles.paymentAccount}>
                  💳 {p.account_name ?? 'Dompet'}
                </Text>
                <Text style={styles.paymentAmount}>{formatRupiah(p.amount)}</Text>
              </View>
              <View style={styles.paymentBottom}>
                <Text style={styles.paymentDate}>{formatDate(p.date)}</Text>
                {p.note ? <Text style={styles.paymentNote}>{p.note}</Text> : null}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 20, paddingBottom: 40 },
  overviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  badgeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeDebt: { backgroundColor: '#FED7AA' },
  badgeReceivable: { backgroundColor: '#EDE9FE' },
  badgeText: { fontSize: 12, fontWeight: '700' },
  textDebt: { color: '#EA580C' },
  textReceivable: { color: '#7C3AED' },
  paidBadge: { backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  paidText: { fontSize: 11, fontWeight: '800', color: '#16A34A' },
  personName: { fontSize: 24, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  dateText: { fontSize: 12, color: '#94A3B8' },
  dueText: { fontSize: 12, color: '#EA580C', fontWeight: '600', marginTop: 2 },
  statGrid: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 12 },
  statBox: { flex: 1 },
  statLabel: { fontSize: 11, color: '#64748B' },
  statValue: { fontSize: 14, fontWeight: '800', color: '#0F172A', marginTop: 4 },
  progressBar: { height: 8, backgroundColor: '#E2E8F0', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  progressText: { fontSize: 12, color: '#64748B', textAlign: 'right', marginTop: 4, fontWeight: '600' },
  payBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  payBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  formTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', color: '#64748B', marginTop: 8, marginBottom: 6 },
  amountInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  accountRow: { flexDirection: 'row', marginBottom: 6 },
  accountChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
  },
  accountChipSelected: { backgroundColor: '#DBEAFE', borderWidth: 1.5, borderColor: '#2563EB' },
  accountIcon: { fontSize: 16, marginRight: 6 },
  accountName: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  accountNameSelected: { color: '#2563EB', fontWeight: '700' },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#0F172A',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  saveBtn: {
    backgroundColor: '#16A34A',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  saveBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  historyTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginVertical: 8 },
  emptyText: { textAlign: 'center', color: '#94A3B8', marginTop: 12 },
  paymentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  paymentTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  paymentAccount: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  paymentAmount: { fontSize: 14, fontWeight: '800', color: '#16A34A' },
  paymentBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  paymentDate: { fontSize: 11, color: '#94A3B8' },
  paymentNote: { fontSize: 12, color: '#64748B', fontStyle: 'italic' },
});
