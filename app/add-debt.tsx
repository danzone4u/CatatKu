import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useState, useEffect } from 'react';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import {
  addDebt,
  updateDebt,
  getDebts,
  getCashbooks,
  getAccounts,
  type Cashbook,
  type AccountWithCalculatedBalance,
} from '../src/database/queries';
import { useCashbookStore } from '../src/stores/useCashbookStore';
import { useThemeStore } from '../src/stores/useThemeStore';
import { formatNumberThousand, parseRupiahInput } from '../src/utils/currency';
import { getToday, formatDate } from '../src/utils/date';
import { FONTS } from '../src/constants/theme';
import { BackArrowIcon } from '../src/components/ActionIcons';
import DatePickerModal from '../src/components/DatePickerModal';

export default function AddDebtScreen() {
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ id?: string }>();
  const editingDebtId = params.id ? parseInt(params.id, 10) : null;

  const { width } = useWindowDimensions();
  const isTablet = width >= 600;
  const palette = useThemeStore((s) => s.palette);
  const isDarkMode = useThemeStore((s) => s.isDarkMode);
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

  const [pickerTarget, setPickerTarget] = useState<'date' | 'dueDate' | null>(null);

  useEffect(() => {
    loadCashbooksAndAccounts();
  }, [targetCashbookId]);

  useEffect(() => {
    if (editingDebtId) {
      loadEditingDebt(editingDebtId);
    }
  }, [editingDebtId]);

  async function loadEditingDebt(id: number) {
    try {
      const allDebts = await getDebts(db, targetCashbookId);
      const found = allDebts.find((d) => d.id === id);
      if (found) {
        setType(found.type);
        setPersonName(found.person_name);
        setAmount(formatNumberThousand(found.amount));
        setNote(found.note || '');
        setDate(found.date);
        setDueDate(found.due_date || '');
        setSelectedAccountId(found.account_id ?? null);
      }
    } catch (e) {
      console.warn('loadEditingDebt error:', e);
    }
  }

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
    const numAmount = parseRupiahInput(amount);
    if (!numAmount || numAmount <= 0) {
      Alert.alert('Perhatian', 'Masukkan jumlah nominal yang valid');
      return;
    }
    if (!personName.trim()) {
      Alert.alert('Perhatian', 'Masukkan nama pihak atau orang');
      return;
    }

    if (editingDebtId) {
      await updateDebt(db, editingDebtId, {
        person_name: personName.trim(),
        amount: numAmount,
        note,
        due_date: dueDate || null,
        date,
        account_id: selectedAccountId,
      });
    } else {
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
    }

    router.back();
  }

  return (
    <View style={[styles.container, { backgroundColor: palette.canvas }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: palette.card, borderBottomColor: palette.border }]}>
        <View style={[styles.headerInner, isTablet && { maxWidth: 720, width: '100%', alignSelf: 'center' }]}>
          <Pressable
            style={({ pressed }) => [styles.backBtn, { backgroundColor: palette.cardMuted }, pressed && { opacity: 0.7 }]}
            onPress={() => router.back()}
          >
            <BackArrowIcon color={palette.ink} size={18} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: palette.ink }]}>
            {editingDebtId ? 'Edit Catatan Hutang / Piutang' : 'Tambah Hutang / Piutang'}
          </Text>
          <View style={{ width: 36 }} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          isTablet && { maxWidth: 720, width: '100%', alignSelf: 'center' },
          { flexGrow: 1 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Pilih Catatan */}
        {!editingDebtId && (
          <>
            <Text style={[styles.label, { color: palette.inkSecondary }]}>Buku Catatan</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cashbookRow}>
              {cashbooks.map((b) => (
                <Pressable
                  key={b.id}
                  style={[
                    styles.cashbookChip,
                    { backgroundColor: palette.cardMuted, borderColor: palette.border },
                    targetCashbookId === b.id && { backgroundColor: isDarkMode ? '#16313B' : '#EAF6F3', borderColor: palette.primary },
                  ]}
                  onPress={() => setTargetCashbookId(b.id)}
                >
                  <Text style={styles.cashbookChipIcon}>{b.icon}</Text>
                  <Text
                    style={[
                      styles.cashbookChipText,
                      { color: targetCashbookId === b.id ? palette.primary : palette.ink },
                    ]}
                  >
                    {b.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}

        {/* Pilih Dompet */}
        <Text style={[styles.label, { color: palette.inkSecondary }]}>Dompet / Akun Terkait</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cashbookRow}>
          {accounts.map((a) => (
            <Pressable
              key={a.id}
              style={[
                styles.cashbookChip,
                { backgroundColor: palette.cardMuted, borderColor: palette.border },
                selectedAccountId === a.id && { backgroundColor: isDarkMode ? '#16313B' : '#EAF6F3', borderColor: palette.primary },
              ]}
              onPress={() => setSelectedAccountId(a.id)}
            >
              <Text style={styles.cashbookChipIcon}>{a.icon}</Text>
              <Text
                style={[
                  styles.cashbookChipText,
                  { color: selectedAccountId === a.id ? palette.primary : palette.ink },
                ]}
              >
                {a.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Type Toggle */}
        {!editingDebtId && (
          <View style={styles.toggleRow}>
            <Pressable
              style={[
                styles.toggleBtn,
                { backgroundColor: palette.cardMuted, borderColor: palette.border },
                type === 'debt' && { backgroundColor: isDarkMode ? '#451A03' : '#FEE2E2', borderColor: palette.expense },
              ]}
              onPress={() => setType('debt')}
            >
              <Text style={[styles.toggleText, { color: type === 'debt' ? palette.expense : palette.inkMuted }]}>
                💸 Hutang (Saya Pinjam)
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.toggleBtn,
                { backgroundColor: palette.cardMuted, borderColor: palette.border },
                type === 'receivable' && { backgroundColor: isDarkMode ? '#2E1065' : '#EDE9FE', borderColor: '#8B5CF6' },
              ]}
              onPress={() => setType('receivable')}
            >
              <Text style={[styles.toggleText, { color: type === 'receivable' ? '#8B5CF6' : palette.inkMuted }]}>
                💎 Piutang (Dia Pinjam)
              </Text>
            </Pressable>
          </View>
        )}

        {/* Person Name */}
        <Text style={[styles.label, { color: palette.inkSecondary }]}>Nama Pihak / Orang</Text>
        <TextInput
          style={[styles.input, { backgroundColor: palette.cardMuted, borderColor: palette.border, color: palette.ink }]}
          placeholder="Nama orang atau pihak terkait"
          placeholderTextColor={palette.inkMuted}
          value={personName}
          onChangeText={setPersonName}
        />

        {/* Amount */}
        <Text style={[styles.label, { color: palette.inkSecondary }]}>Jumlah (Rp)</Text>
        <TextInput
          style={[styles.amountInput, { backgroundColor: palette.cardMuted, borderColor: palette.border, color: palette.ink }]}
          placeholder="0"
          placeholderTextColor={palette.inkMuted}
          keyboardType="numeric"
          value={amount}
          onChangeText={(text) => setAmount(formatNumberThousand(text))}
        />

        {/* Date */}
        <Text style={[styles.label, { color: palette.inkSecondary }]}>Tanggal Transaksi</Text>
        <Pressable
          style={[styles.dateTrigger, { backgroundColor: palette.cardMuted, borderColor: palette.border }]}
          onPress={() => setPickerTarget('date')}
        >
          <Text style={{ fontSize: 16 }}>📅</Text>
          <Text style={[styles.dateTriggerText, { color: palette.ink }]}>{formatDate(date)}</Text>
          <Text style={[styles.dateChangeHint, { color: palette.primary }]}>Ubah</Text>
        </Pressable>

        {/* Due Date */}
        <Text style={[styles.label, { color: palette.inkSecondary }]}>Jatuh Tempo (Opsional)</Text>
        <Pressable
          style={[styles.dateTrigger, { backgroundColor: palette.cardMuted, borderColor: palette.border }]}
          onPress={() => setPickerTarget('dueDate')}
        >
          <Text style={{ fontSize: 16 }}>⏰</Text>
          <Text style={[styles.dateTriggerText, { color: palette.ink }]}>
            {dueDate ? formatDate(dueDate) : 'Tidak ada tenggat'}
          </Text>
          <Text style={[styles.dateChangeHint, { color: palette.primary }]}>
            {dueDate ? 'Ubah' : 'Pilih'}
          </Text>
        </Pressable>

        {/* Note */}
        <Text style={[styles.label, { color: palette.inkSecondary }]}>Catatan Tambahan</Text>
        <TextInput
          style={[styles.input, styles.noteInput, { backgroundColor: palette.cardMuted, borderColor: palette.border, color: palette.ink }]}
          placeholder="Tulis alasan, kesepakatan, atau rincian lainnya..."
          placeholderTextColor={palette.inkMuted}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          value={note}
          onChangeText={setNote}
        />

        {/* Save Button */}
        <Pressable
          style={({ pressed }) => [
            styles.saveBtn,
            { backgroundColor: palette.primary },
            pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
          ]}
          onPress={handleSave}
        >
          <Text style={styles.saveBtnText}>
            {editingDebtId ? 'Perbarui Catatan Hutang/Piutang' : 'Simpan Catatan Hutang/Piutang'}
          </Text>
        </Pressable>

        {/* Footer Copyright */}
        <View style={styles.footerWrap}>
          <Text style={[styles.footerText, { color: palette.inkMuted }]}>© 2026 CatatKu</Text>
        </View>
      </ScrollView>

      {/* DatePicker Visual Modal */}
      <DatePickerModal
        visible={pickerTarget !== null}
        value={pickerTarget === 'date' ? date : dueDate || getToday()}
        onSelect={(newDateStr) => {
          const onlyDate = newDateStr.split(' ')[0];
          if (pickerTarget === 'date') setDate(onlyDate);
          if (pickerTarget === 'dueDate') setDueDate(onlyDate);
        }}
        onClose={() => setPickerTarget(null)}
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
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: FONTS.serifTitle,
    fontSize: 17,
    fontWeight: '800',
  },
  content: {
    padding: 20,
    gap: 4,
  },
  label: {
    fontFamily: FONTS.sansBold,
    fontSize: 12,
    marginBottom: 6,
    marginTop: 10,
  },
  cashbookRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  cashbookChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginRight: 8,
  },
  cashbookChipIcon: { fontSize: 16 },
  cashbookChipText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 12,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    marginBottom: 6,
  },
  toggleBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleText: {
    fontFamily: FONTS.sansBold,
    fontSize: 12,
  },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontFamily: FONTS.sansMedium,
    fontSize: 14,
  },
  amountInput: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontFamily: FONTS.sansBold,
    fontSize: 20,
  },
  dateTrigger: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateTriggerText: {
    fontFamily: FONTS.sansBold,
    fontSize: 13,
    flex: 1,
    marginLeft: 8,
  },
  dateChangeHint: {
    fontFamily: FONTS.sansBold,
    fontSize: 12,
  },
  noteInput: {
    height: 80,
    paddingTop: 10,
  },
  saveBtn: {
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 10,
  },
  saveBtnText: {
    fontFamily: FONTS.sansBold,
    fontSize: 14,
    color: '#FAF8F5',
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
