import { View, Text, StyleSheet, Pressable, ScrollView, TextInput } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { useFocusEffect, Stack, router } from 'expo-router';
import { getAccounts, addTransfer, getTransfers, type AccountWithCalculatedBalance, type Transfer } from '../src/database/queries';
import { useCashbookStore } from '../src/stores/useCashbookStore';
import { getToday, formatDate } from '../src/utils/date';
import { formatRupiah } from '../src/utils/currency';
import { ModernConfirmModal, type ModalType } from '../src/components/ModernConfirmModal';

export default function TransferScreen() {
  const db = useSQLiteContext();
  const activeCashbook = useCashbookStore((state) => state.activeCashbook);
  const cashbookId = activeCashbook?.id ?? 1;

  const [accounts, setAccounts] = useState<AccountWithCalculatedBalance[]>([]);
  const [fromAccountId, setFromAccountId] = useState<number | null>(null);
  const [toAccountId, setToAccountId] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [fee, setFee] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(getToday());
  const [transfers, setTransfers] = useState<Transfer[]>([]);

  const [modalState, setModalState] = useState<{
    visible: boolean;
    type: ModalType;
    icon?: string;
    title: string;
    message: string;
  }>({
    visible: false,
    type: 'info',
    title: '',
    message: '',
  });

  const showModal = (title: string, message: string, type: ModalType = 'info', icon?: string) => {
    setModalState({
      visible: true,
      type,
      icon,
      title,
      message,
    });
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [cashbookId])
  );

  async function loadData() {
    const [accs, hist] = await Promise.all([
      getAccounts(db, cashbookId),
      getTransfers(db, cashbookId),
    ]);
    setAccounts(accs);
    setTransfers(hist);
    if (accs.length >= 2) {
      setFromAccountId(accs[0].id);
      setToAccountId(accs[1].id);
    }
  }

  async function handleTransfer() {
    if (!fromAccountId || !toAccountId) {
      showModal('Perhatian', 'Pilih akun asal dan akun tujuan', 'warning');
      return;
    }
    if (fromAccountId === toAccountId) {
      showModal('Perhatian', 'Akun asal dan tujuan tidak boleh sama', 'warning');
      return;
    }

    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      showModal('Perhatian', 'Masukkan nominal transfer yang valid', 'warning');
      return;
    }

    const numFee = fee ? parseFloat(fee) : 0;

    await addTransfer(db, {
      cashbook_id: cashbookId,
      from_account_id: fromAccountId,
      to_account_id: toAccountId,
      amount: numAmount,
      fee: numFee,
      date,
      note,
    });

    setAmount('');
    setFee('');
    setNote('');
    showModal('Berhasil', 'Transfer saldo berhasil dicatat', 'success', '💸');
    loadData();
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Pindah Saldo / Transfer',
          headerStyle: { backgroundColor: '#FFFFFF' },
          headerTintColor: '#0F172A',
          headerTitleStyle: { fontWeight: '700' },
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Form Transfer */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Transfer Antar Akun</Text>

          {/* Dari Akun */}
          <Text style={styles.label}>Dari Akun (Sumber Dana)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerRow}>
            {accounts.map((a) => (
              <Pressable
                key={a.id}
                style={[styles.accountChip, fromAccountId === a.id && styles.accountChipSelected]}
                onPress={() => setFromAccountId(a.id)}
              >
                <Text style={styles.accountIcon}>{a.icon}</Text>
                <View>
                  <Text style={[styles.accountName, fromAccountId === a.id && styles.accountNameSelected]}>
                    {a.name}
                  </Text>
                  <Text style={styles.accountBalance}>{formatRupiah(a.calculated_balance)}</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>

          {/* Ke Akun */}
          <Text style={styles.label}>Ke Akun (Tujuan Dana)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerRow}>
            {accounts.map((a) => (
              <Pressable
                key={a.id}
                style={[styles.accountChip, toAccountId === a.id && styles.accountChipSelected]}
                onPress={() => setToAccountId(a.id)}
              >
                <Text style={styles.accountIcon}>{a.icon}</Text>
                <View>
                  <Text style={[styles.accountName, toAccountId === a.id && styles.accountNameSelected]}>
                    {a.name}
                  </Text>
                  <Text style={styles.accountBalance}>{formatRupiah(a.calculated_balance)}</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>

          {/* Nominal */}
          <Text style={styles.label}>Nominal Transfer (Rp)</Text>
          <TextInput
            style={styles.amountInput}
            placeholder="0"
            placeholderTextColor="#94A3B8"
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
          />

          {/* Biaya Admin */}
          <Text style={styles.label}>Biaya Admin / Fee (Opsional)</Text>
          <TextInput
            style={styles.input}
            placeholder="0 (Misal: 2500 atau 6500)"
            placeholderTextColor="#94A3B8"
            keyboardType="numeric"
            value={fee}
            onChangeText={setFee}
          />

          {/* Tanggal */}
          <Text style={styles.label}>Tanggal</Text>
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#94A3B8"
            value={date}
            onChangeText={setDate}
          />

          {/* Catatan */}
          <Text style={styles.label}>Catatan (Opsional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Misal: Tarik tunai ATM, Top up e-wallet"
            placeholderTextColor="#94A3B8"
            value={note}
            onChangeText={setNote}
          />

          {/* Submit */}
          <Pressable
            style={({ pressed }) => [styles.submitBtn, pressed && { opacity: 0.8 }]}
            onPress={handleTransfer}
          >
            <Text style={styles.submitBtnText}>Kirim / Simpan Transfer</Text>
          </Pressable>
        </View>

        {/* Riwayat Transfer */}
        <Text style={[styles.sectionTitle, { marginHorizontal: 4, marginTop: 16 }]}>
          Riwayat Transfer ({transfers.length})
        </Text>

        {transfers.length === 0 ? (
          <Text style={styles.emptyText}>Belum ada riwayat transfer saldo</Text>
        ) : (
          transfers.map((t) => (
            <View key={t.id} style={styles.historyCard}>
              <View style={styles.historyTop}>
                <Text style={styles.historyRoute}>
                  {t.from_account_icon} {t.from_account_name} ➔ {t.to_account_icon} {t.to_account_name}
                </Text>
                <Text style={styles.historyAmount}>{formatRupiah(t.amount)}</Text>
              </View>
              <View style={styles.historyBottom}>
                <Text style={styles.historyDate}>{formatDate(t.date)}</Text>
                {t.fee > 0 && <Text style={styles.historyFee}>Fee: {formatRupiah(t.fee)}</Text>}
                {t.note ? <Text style={styles.historyNote}>{t.note}</Text> : null}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <ModernConfirmModal
        visible={modalState.visible}
        type={modalState.type}
        icon={modalState.icon}
        title={modalState.title}
        message={modalState.message}
        confirmText="Mengerti"
        cancelText=""
        onConfirm={() => setModalState((prev) => ({ ...prev, visible: false }))}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 20, paddingBottom: 40 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 10 },
  label: { fontSize: 13, fontWeight: '600', color: '#64748B', marginTop: 10, marginBottom: 6 },
  pickerRow: { flexDirection: 'row', marginBottom: 4 },
  accountChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minWidth: 120,
  },
  accountChipSelected: {
    backgroundColor: '#DBEAFE',
    borderColor: '#2563EB',
    borderWidth: 2,
  },
  accountIcon: { fontSize: 20, marginRight: 8 },
  accountName: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  accountNameSelected: { color: '#2563EB' },
  accountBalance: { fontSize: 11, color: '#64748B', marginTop: 2 },
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
  submitBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  submitBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  emptyText: { textAlign: 'center', color: '#94A3B8', marginTop: 16 },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  historyTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyRoute: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  historyAmount: { fontSize: 15, fontWeight: '800', color: '#2563EB' },
  historyBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  historyDate: { fontSize: 12, color: '#94A3B8' },
  historyFee: { fontSize: 12, color: '#DC2626' },
  historyNote: { fontSize: 12, color: '#64748B', fontStyle: 'italic' },
});
