import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, Alert } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useState, useEffect } from 'react';
import { router, Stack } from 'expo-router';
import {
  addDebt,
  getCashbooks,
  getAccounts,
  type Cashbook,
  type AccountWithCalculatedBalance,
} from '../src/database/queries';
import { useCashbookStore } from '../src/stores/useCashbookStore';
import { getToday } from '../src/utils/date';

export default function AddDebtScreen() {
  const db = useSQLiteContext();
  const activeCashbook = useCashbookStore((state) => state.activeCashbook);

  const [targetCashbookId, setTargetCashbookId] = useState<number>(activeCashbook?.id ?? 1);
  const [cashbooks, setCashbooks] = useState<Cashbook[]>([]);
  const [accounts, setAccounts] = useState<AccountWithCalculatedBalance[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);

  const [type, setType] = useState<'debt' | 'receivable'>('debt');
  const [personName, setPersonName] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [date, setDate] = useState(getToday());

  useEffect(() => {
    loadCashbooksAndAccounts();
  }, [targetCashbookId]);

  async function loadCashbooksAndAccounts() {
    const [bList, accs] = await Promise.all([
      getCashbooks(db, false),
      getAccounts(db, targetCashbookId),
    ]);
    setCashbooks(bList);
    setAccounts(accs);
    if (accs.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accs[0].id);
    }
  }

  async function handleSave() {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      Alert.alert('Error', 'Masukkan jumlah yang valid');
      return;
    }
    if (!personName.trim()) {
      Alert.alert('Error', 'Masukkan nama orang');
      return;
    }

    await addDebt(db, {
      cashbook_id: targetCashbookId,
      account_id: selectedAccountId,
      type,
      person_name: personName.trim(),
      amount: numAmount,
      note,
      due_date: dueDate || null,
      date,
    });

    router.back();
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Tambah Hutang / Piutang',
          headerStyle: { backgroundColor: '#FFFFFF' },
          headerTintColor: '#0F172A',
          headerTitleStyle: { fontWeight: '700' },
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Pilih Catatan */}
        <Text style={styles.label}>Catatan</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cashbookRow}>
          {cashbooks.map((b) => (
            <Pressable
              key={b.id}
              style={[
                styles.cashbookChip,
                targetCashbookId === b.id && styles.cashbookChipSelected,
              ]}
              onPress={() => setTargetCashbookId(b.id)}
            >
              <Text style={styles.cashbookChipIcon}>{b.icon}</Text>
              <Text
                style={[
                  styles.cashbookChipText,
                  targetCashbookId === b.id && styles.cashbookChipTextSelected,
                ]}
              >
                {b.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Pilih Dompet */}
        <Text style={styles.label}>Dompet / Akun Terkait</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cashbookRow}>
          {accounts.map((a) => (
            <Pressable
              key={a.id}
              style={[
                styles.cashbookChip,
                selectedAccountId === a.id && styles.cashbookChipSelected,
              ]}
              onPress={() => setSelectedAccountId(a.id)}
            >
              <Text style={styles.cashbookChipIcon}>{a.icon}</Text>
              <Text
                style={[
                  styles.cashbookChipText,
                  selectedAccountId === a.id && styles.cashbookChipTextSelected,
                ]}
              >
                {a.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Type Toggle */}
        <View style={styles.toggleRow}>
          <Pressable
            style={[styles.toggleBtn, type === 'debt' && styles.toggleBtnDebt]}
            onPress={() => setType('debt')}
          >
            <Text style={[styles.toggleText, type === 'debt' && styles.toggleTextActive]}>💸 Hutang (Saya Pinjam)</Text>
          </Pressable>
          <Pressable
            style={[styles.toggleBtn, type === 'receivable' && styles.toggleBtnReceivable]}
            onPress={() => setType('receivable')}
          >
            <Text style={[styles.toggleText, type === 'receivable' && styles.toggleTextActive]}>💎 Piutang (Dia Pinjam)</Text>
          </Pressable>
        </View>

        {/* Person Name */}
        <Text style={styles.label}>Nama Pihak / Orang</Text>
        <TextInput
          style={styles.input}
          placeholder="Nama orang atau pihak terkait"
          placeholderTextColor="#94A3B8"
          value={personName}
          onChangeText={setPersonName}
        />

        {/* Amount */}
        <Text style={styles.label}>Jumlah (Rp)</Text>
        <TextInput
          style={styles.amountInput}
          placeholder="0"
          placeholderTextColor="#94A3B8"
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
        />

        {/* Date */}
        <Text style={styles.label}>Tanggal Transaksi</Text>
        <TextInput
          style={styles.input}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#94A3B8"
          value={date}
          onChangeText={setDate}
        />

        {/* Due Date */}
        <Text style={styles.label}>Jatuh Tempo (Opsional)</Text>
        <TextInput
          style={styles.input}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#94A3B8"
          value={dueDate}
          onChangeText={setDueDate}
        />

        {/* Note */}
        <Text style={styles.label}>Catatan Tambahan</Text>
        <TextInput
          style={[styles.input, styles.noteInput]}
          placeholder="Tulis alasan, kesepakatan, atau rincian lainnya..."
          placeholderTextColor="#94A3B8"
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          value={note}
          onChangeText={setNote}
        />

        {/* Save */}
        <Pressable
          style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.8 }]}
          onPress={handleSave}
        >
          <Text style={styles.saveBtnText}>Simpan Catatan Hutang/Piutang</Text>
        </Pressable>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 20, paddingBottom: 40 },
  label: { fontSize: 14, fontWeight: '600', color: '#64748B', marginBottom: 8, marginTop: 12 },
  cashbookRow: { flexDirection: 'row', marginBottom: 12 },
  cashbookChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cashbookChipSelected: {
    backgroundColor: '#DBEAFE',
    borderColor: '#2563EB',
    borderWidth: 2,
  },
  cashbookChipIcon: { fontSize: 16, marginRight: 6 },
  cashbookChipText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  cashbookChipTextSelected: { color: '#2563EB' },
  toggleRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  toggleBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  toggleBtnDebt: { backgroundColor: '#FED7AA' },
  toggleBtnReceivable: { backgroundColor: '#EDE9FE' },
  toggleText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  toggleTextActive: { color: '#0F172A', fontWeight: '700' },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0F172A',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  amountInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  noteInput: { minHeight: 80 },
  saveBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
