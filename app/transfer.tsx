import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, useWindowDimensions, KeyboardAvoidingView, Platform } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { useFocusEffect, Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAccounts, addTransfer, getTransfers, type AccountWithCalculatedBalance, type Transfer } from '../src/database/queries';
import { useCashbookStore } from '../src/stores/useCashbookStore';
import { useThemeStore } from '../src/stores/useThemeStore';
import { getToday, formatDate } from '../src/utils/date';
import { formatRupiah, formatNumberThousand, parseRupiahInput } from '../src/utils/currency';
import { FONTS } from '../src/constants/theme';
import { ModernConfirmModal, type ModalType } from '../src/components/ModernConfirmModal';
import { BackArrowIcon } from '../src/components/ActionIcons';

export default function TransferScreen() {
  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();
  const { width } = useWindowDimensions();
  const isTablet = width >= 600;
  const palette = useThemeStore((s) => s.palette);
  const isDarkMode = useThemeStore((s) => s.isDarkMode);

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

  const showAlert = (title: string, message: string, type: ModalType = 'warning', icon?: string) => {
    setModalState({
      visible: true,
      title,
      message,
      type,
      icon,
    });
  };

  const loadData = useCallback(async () => {
    const [accList, tList] = await Promise.all([
      getAccounts(db, cashbookId),
      getTransfers(db, cashbookId),
    ]);
    setAccounts(accList);
    setTransfers(tList);

    if (accList.length >= 2) {
      if (!fromAccountId) setFromAccountId(accList[0].id);
      if (!toAccountId) setToAccountId(accList[1].id);
    } else if (accList.length === 1) {
      if (!fromAccountId) setFromAccountId(accList[0].id);
    }
  }, [db, cashbookId, fromAccountId, toAccountId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  async function handleTransfer() {
    if (!fromAccountId || !toAccountId) {
      showAlert('Peringatan', 'Pilih akun asal dan akun tujuan.', 'warning');
      return;
    }
    if (fromAccountId === toAccountId) {
      showAlert('Peringatan', 'Akun asal dan akun tujuan tidak boleh sama.', 'warning');
      return;
    }

    const numAmount = parseRupiahInput(amount);
    if (!numAmount || numAmount <= 0) {
      showAlert('Peringatan', 'Masukkan nominal transfer yang valid.', 'warning');
      return;
    }

    const numFee = parseRupiahInput(fee);

    // Cek saldo akun pengirim
    const sender = accounts.find((a) => a.id === fromAccountId);
    if (sender && sender.calculated_balance < numAmount + numFee) {
      showAlert(
        'Saldo Tidak Cukup',
        `Saldo ${sender.name} (${formatRupiah(sender.calculated_balance)}) tidak mencukupi untuk transfer sebesar ${formatRupiah(numAmount + numFee)}.`,
        'danger'
      );
      return;
    }

    await addTransfer(db, {
      cashbook_id: cashbookId,
      from_account_id: fromAccountId,
      to_account_id: toAccountId,
      amount: numAmount,
      fee: numFee,
      note: note.trim(),
      date,
    });

    setAmount('');
    setFee('');
    setNote('');
    showAlert('Berhasil', 'Transfer saldo berhasil dicatat!', 'success', '💸');
    loadData();
  }

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
              <Text style={[styles.headerSub, { color: palette.primary }]}>{activeCashbook?.name ?? 'Catatan'}</Text>
              <Text style={[styles.headerTitle, { color: palette.ink }]}>Pindah Saldo / Transfer</Text>
            </View>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            isTablet && { maxWidth: 840, width: '100%', alignSelf: 'center' },
            { paddingBottom: Math.max(insets.bottom, 16) + 40 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Form Transfer */}
        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.sectionTitle, { color: palette.ink }]}>Transfer Antar Akun</Text>

          {/* Dari Akun */}
          <Text style={[styles.label, { color: palette.inkSecondary }]}>Dari Akun (Sumber Dana)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerRow}>
            {accounts.map((a) => {
              const isSelected = fromAccountId === a.id;
              return (
                <Pressable
                  key={a.id}
                  style={[
                    styles.accountChip,
                    { backgroundColor: palette.cardMuted, borderColor: palette.border },
                    isSelected && { borderColor: palette.primary, backgroundColor: isDarkMode ? '#16313B' : '#EAF6F3' },
                  ]}
                  onPress={() => setFromAccountId(a.id)}
                >
                  <Text style={styles.accountIcon}>{a.icon}</Text>
                  <View>
                    <Text
                      style={[
                        styles.accountName,
                        { color: palette.ink },
                        isSelected && { color: palette.primary, fontWeight: '700' },
                      ]}
                    >
                      {a.name}
                    </Text>
                    <Text style={[styles.accountBalance, { color: palette.inkMuted }]}>
                      {formatRupiah(a.calculated_balance)}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Ke Akun */}
          <Text style={[styles.label, { color: palette.inkSecondary }]}>Ke Akun (Tujuan Dana)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerRow}>
            {accounts.map((a) => {
              const isSelected = toAccountId === a.id;
              return (
                <Pressable
                  key={a.id}
                  style={[
                    styles.accountChip,
                    { backgroundColor: palette.cardMuted, borderColor: palette.border },
                    isSelected && { borderColor: palette.primary, backgroundColor: isDarkMode ? '#16313B' : '#EAF6F3' },
                  ]}
                  onPress={() => setToAccountId(a.id)}
                >
                  <Text style={styles.accountIcon}>{a.icon}</Text>
                  <View>
                    <Text
                      style={[
                        styles.accountName,
                        { color: palette.ink },
                        isSelected && { color: palette.primary, fontWeight: '700' },
                      ]}
                    >
                      {a.name}
                    </Text>
                    <Text style={[styles.accountBalance, { color: palette.inkMuted }]}>
                      {formatRupiah(a.calculated_balance)}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Nominal */}
          <Text style={[styles.label, { color: palette.inkSecondary }]}>Nominal Transfer (Rp)</Text>
          <TextInput
            style={[
              styles.amountInput,
              { backgroundColor: palette.cardMuted, borderColor: palette.border, color: palette.ink },
            ]}
            placeholder="0"
            placeholderTextColor={palette.inkMuted}
            keyboardType="numeric"
            value={amount}
            onChangeText={(txt) => setAmount(formatNumberThousand(txt))}
          />

          {/* Biaya Admin */}
          <Text style={[styles.label, { color: palette.inkSecondary }]}>Biaya Admin / Fee (Opsional)</Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: palette.cardMuted, borderColor: palette.border, color: palette.ink },
            ]}
            placeholder="0 (Misal: 2.500 atau 6.500)"
            placeholderTextColor={palette.inkMuted}
            keyboardType="numeric"
            value={fee}
            onChangeText={(txt) => setFee(formatNumberThousand(txt))}
          />

          {/* Tanggal */}
          <Text style={[styles.label, { color: palette.inkSecondary }]}>Tanggal</Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: palette.cardMuted, borderColor: palette.border, color: palette.ink },
            ]}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={palette.inkMuted}
            value={date}
            onChangeText={setDate}
          />

          {/* Catatan */}
          <Text style={[styles.label, { color: palette.inkSecondary }]}>Catatan (Opsional)</Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: palette.cardMuted, borderColor: palette.border, color: palette.ink },
            ]}
            placeholder="Misal: Tarik tunai ATM, Top up e-wallet"
            placeholderTextColor={palette.inkMuted}
            value={note}
            onChangeText={setNote}
          />

          {/* Submit */}
          <Pressable
            style={({ pressed }) => [
              styles.submitBtn,
              { backgroundColor: palette.primary },
              pressed && { opacity: 0.8 },
            ]}
            onPress={handleTransfer}
          >
            <Text style={styles.submitBtnText}>Kirim / Simpan Transfer</Text>
          </Pressable>
        </View>

        {/* Riwayat Transfer */}
        <Text style={[styles.sectionTitle, { marginHorizontal: 4, marginTop: 16, color: palette.ink }]}>
          Riwayat Transfer ({transfers.length})
        </Text>

        {transfers.length === 0 ? (
          <View style={[styles.emptyWrap, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={styles.emptyIcon}>🔄</Text>
            <Text style={[styles.emptyTitle, { color: palette.ink }]}>Belum Ada Transfer</Text>
            <Text style={[styles.emptySub, { color: palette.inkMuted }]}>
              Riwayat mutasi perpindahan antar dompet akan otomatis tercatat rapi di sini
            </Text>
          </View>
        ) : (
          transfers.map((t) => (
            <View
              key={t.id}
              style={[styles.historyCard, { backgroundColor: palette.card, borderColor: palette.border }]}
            >
              <View style={styles.historyTop}>
                <Text style={[styles.historyRoute, { color: palette.ink }]}>
                  {t.from_account_name} ➔ {t.to_account_name}
                </Text>
                <Text style={[styles.historyAmount, { color: palette.primary }]}>{formatRupiah(t.amount)}</Text>
              </View>
              <View style={styles.historyBottom}>
                <Text style={[styles.historyMeta, { color: palette.inkMuted }]}>
                  {formatDate(t.date)} {t.fee > 0 ? `• Fee: ${formatRupiah(t.fee)}` : ''}
                </Text>
                {t.note ? <Text style={[styles.historyNote, { color: palette.inkMuted }]}>{t.note}</Text> : null}
              </View>
            </View>
          ))
        )}
      </ScrollView>
      </KeyboardAvoidingView>

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
  card: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', fontFamily: FONTS.sansBold, marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', fontFamily: FONTS.sansMedium, marginTop: 10, marginBottom: 6 },
  pickerRow: { flexDirection: 'row', marginBottom: 4 },
  accountChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginRight: 8,
    borderWidth: 1,
    minWidth: 120,
  },
  accountIcon: { fontSize: 20, marginRight: 8 },
  accountName: { fontSize: 13, fontWeight: '700', fontFamily: FONTS.sansBold },
  accountBalance: { fontSize: 11, fontFamily: FONTS.sansRegular, marginTop: 2 },
  amountInput: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 20,
    fontWeight: '700',
    fontFamily: FONTS.sansBold,
    borderWidth: 1,
  },
  input: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: FONTS.sansRegular,
    borderWidth: 1,
  },
  submitBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  submitBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', fontFamily: FONTS.sansBold },
  emptyWrap: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    marginTop: 12,
  },
  emptyIcon: { fontSize: 32, marginBottom: 8 },
  emptyTitle: { fontSize: 15, fontFamily: FONTS.sansBold, marginBottom: 4 },
  emptySub: { fontSize: 13, fontFamily: FONTS.sansRegular, textAlign: 'center', lineHeight: 18 },
  emptyText: { textAlign: 'center', marginTop: 16, fontFamily: FONTS.sansRegular },
  historyCard: {
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
    borderWidth: 1,
  },
  historyTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyRoute: { fontSize: 14, fontWeight: '700', fontFamily: FONTS.sansBold },
  historyAmount: { fontSize: 15, fontWeight: '800', fontFamily: FONTS.sansBold },
  historyBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  historyMeta: { fontSize: 11, fontFamily: FONTS.sansRegular },
  historyNote: { fontSize: 11, fontStyle: 'italic', fontFamily: FONTS.sansRegular },
});
