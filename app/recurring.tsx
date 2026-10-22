import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  Alert,
  Modal,
  ScrollView,
  Switch,
  useWindowDimensions,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { useFocusEffect, router, Stack } from 'expo-router';
import {
  getRecurringRules,
  addRecurringRule,
  updateRecurringRule,
  toggleRecurringRule,
  deleteRecurringRule,
  processDueRecurringTransactions,
  getCategories,
  getAccounts,
  type RecurringRule,
  type Category,
  type AccountWithCalculatedBalance,
} from '../src/database/queries';
import { useCashbookStore } from '../src/stores/useCashbookStore';
import { useThemeStore } from '../src/stores/useThemeStore';
import { formatRupiah, formatNumberThousand, parseRupiahInput } from '../src/utils/currency';
import { formatDate, getToday } from '../src/utils/date';
import { FONTS } from '../src/constants/theme';
import EmptyState from '../src/components/EmptyState';
import { ModernConfirmModal } from '../src/components/ModernConfirmModal';
import { EditActionIcon, BackArrowIcon } from '../src/components/ActionIcons';
import DatePickerModal from '../src/components/DatePickerModal';

export default function RecurringScreen() {
  const db = useSQLiteContext();
  const { width } = useWindowDimensions();
  const isTablet = width >= 600;
  const palette = useThemeStore((s) => s.palette);
  const isDarkMode = useThemeStore((s) => s.isDarkMode);
  const activeCashbook = useCashbookStore((state) => state.activeCashbook);
  const cashbookId = activeCashbook?.id ?? 1;

  const [rules, setRules] = useState<RecurringRule[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<AccountWithCalculatedBalance[]>([]);
  const [deleteRuleId, setDeleteRuleId] = useState<number | null>(null);

  // Modal Form (Add / Edit)
  const [showModal, setShowModal] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<number | null>(null);
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [nextDueDate, setNextDueDate] = useState(getToday());
  const [showDatePicker, setShowDatePicker] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [cashbookId])
  );

  async function loadData() {
    await processDueRecurringTransactions(db);

    const [ruleList, cats, accs] = await Promise.all([
      getRecurringRules(db, cashbookId),
      getCategories(db),
      getAccounts(db, cashbookId),
    ]);
    setRules(ruleList);
    setCategories(cats);
    setAccounts(accs);
    if (cats.length > 0 && !categoryId) setCategoryId(cats[0].id);
    if (accs.length > 0 && !accountId) setAccountId(accs[0].id);
  }

  async function handleToggle(id: number) {
    await toggleRecurringRule(db, id);
    loadData();
  }

  function handleDelete(id: number) {
    setDeleteRuleId(id);
  }

  async function confirmDeleteRule() {
    if (!deleteRuleId) return;
    const id = deleteRuleId;
    setDeleteRuleId(null);
    await deleteRecurringRule(db, id);
    loadData();
  }

  const openAddModal = () => {
    setEditingRuleId(null);
    setType('expense');
    setAmount('');
    setNote('');
    setFrequency('monthly');
    setNextDueDate(getToday());
    if (categories.length > 0) setCategoryId(categories[0].id);
    if (accounts.length > 0) setAccountId(accounts[0].id);
    setShowModal(true);
  };

  const openEditModal = (rule: RecurringRule) => {
    setEditingRuleId(rule.id);
    setType(rule.type);
    setAmount(formatNumberThousand(rule.amount));
    setNote(rule.note || '');
    setFrequency(rule.frequency);
    setNextDueDate(rule.next_due_date);
    setCategoryId(rule.category_id);
    setAccountId(rule.account_id ?? (accounts[0]?.id || 1));
    setShowModal(true);
  };

  async function handleSaveRule() {
    const numAmount = parseRupiahInput(amount);
    if (!numAmount || numAmount <= 0) {
      Alert.alert('Perhatian', 'Masukkan nominal yang valid');
      return;
    }
    if (!categoryId) {
      Alert.alert('Perhatian', 'Pilih kategori');
      return;
    }

    const targetAccId = accountId ?? (accounts.length > 0 ? accounts[0].id : 1);

    if (editingRuleId) {
      await updateRecurringRule(db, editingRuleId, {
        category_id: categoryId,
        account_id: targetAccId,
        type,
        amount: numAmount,
        note: note.trim(),
        frequency,
        next_due_date: nextDueDate,
      });
    } else {
      await addRecurringRule(db, {
        cashbook_id: cashbookId,
        account_id: targetAccId,
        category_id: categoryId,
        type,
        amount: numAmount,
        note: note.trim(),
        frequency,
        next_due_date: nextDueDate,
      });
    }

    setShowModal(false);
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
              <Text style={[styles.headerTitle, { color: palette.ink }]}>Transaksi Rutin</Text>
            </View>
          </View>

          <Pressable
            style={[styles.addTopBtn, { backgroundColor: palette.primary }]}
            onPress={openAddModal}
          >
            <Text style={styles.addTopBtnText}>+ Jadwal</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={rules}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={[
          styles.listContent,
          isTablet && { maxWidth: 840, width: '100%', alignSelf: 'center' },
          { flexGrow: 1 },
        ]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={[styles.infoBanner, { backgroundColor: palette.cardMuted, borderColor: palette.border }]}>
            <Text style={styles.infoBannerIcon}>🔄</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.infoBannerTitle, { color: palette.ink }]}>Pencatatan Otomatis Berkala</Text>
              <Text style={[styles.infoBannerText, { color: palette.inkMuted }]}>
                Aplikasi otomatis mencatat transaksi saat tanggal tempo tercapai ketika aplikasi dibuka.
              </Text>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.ruleCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={styles.ruleHeader}>
              <View style={[styles.ruleIconBox, { backgroundColor: palette.cardMuted }]}>
                <Text style={styles.ruleIcon}>{item.category_icon ?? '🔄'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.ruleTitle, { color: palette.ink }]}>
                  {item.note || item.category_name || 'Tagihan Rutin'}
                </Text>
                <Text style={[styles.ruleFrequency, { color: palette.inkMuted }]}>
                  {item.frequency === 'daily' ? 'Setiap Hari' : item.frequency === 'weekly' ? 'Setiap Minggu' : 'Setiap Bulan'} • Tempo: {formatDate(item.next_due_date)}
                </Text>
              </View>
              <Switch
                value={item.is_active === 1}
                onValueChange={() => handleToggle(item.id)}
                trackColor={{ false: palette.border, true: palette.primary }}
              />
            </View>

            <View style={[styles.ruleFooter, { borderTopColor: palette.borderSubtle }]}>
              <Text style={[styles.ruleAmount, { color: item.type === 'income' ? palette.income : palette.expense }]}>
                {item.type === 'income' ? '+' : '-'}{formatRupiah(item.amount)}
              </Text>

              <View style={styles.actionBtnRow}>
                <Pressable
                  style={({ pressed }) => [styles.actionBtn, { backgroundColor: palette.cardMuted }, pressed && { opacity: 0.7 }]}
                  onPress={() => openEditModal(item)}
                >
                  <EditActionIcon color={palette.primary} size={14} />
                  <Text style={[styles.actionBtnText, { color: palette.primary }]}>Edit</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [styles.actionBtn, { backgroundColor: palette.cardMuted }, pressed && { opacity: 0.7 }]}
                  onPress={() => handleDelete(item.id)}
                >
                  <Text style={[styles.actionBtnText, { color: palette.expense }]}>Hapus</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="🔄"
            title="Belum Ada Transaksi Berulang"
            subtitle="Jadwalkan iuran, wifi, gaji, atau sewa berkala agar tercatat otomatis"
            isDark={isDarkMode}
          />
        }
        ListFooterComponent={
          <View style={styles.footerWrap}>
            <Text style={[styles.footerText, { color: palette.inkMuted }]}>© 2026 CatatKu</Text>
          </View>
        }
      />

      {/* Modal Form Tambah / Edit */}
      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: palette.card, borderColor: palette.border }, isTablet && { maxWidth: 540 }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: palette.ink }]}>
                {editingRuleId ? 'Edit Jadwal Rutin' : 'Tambah Jadwal Rutin'}
              </Text>
              <Pressable onPress={() => setShowModal(false)} hitSlop={8}>
                <Text style={[styles.modalClose, { color: palette.inkMuted }]}>✕</Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Type toggle */}
              <View style={styles.typeToggleRow}>
                <Pressable
                  style={[
                    styles.typeBtn,
                    { backgroundColor: palette.cardMuted, borderColor: palette.border },
                    type === 'expense' && { backgroundColor: isDarkMode ? '#451A03' : '#FEE2E2', borderColor: palette.expense },
                  ]}
                  onPress={() => setType('expense')}
                >
                  <Text style={[styles.typeBtnText, { color: type === 'expense' ? palette.expense : palette.inkMuted }]}>
                    📉 Pengeluaran
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.typeBtn,
                    { backgroundColor: palette.cardMuted, borderColor: palette.border },
                    type === 'income' && { backgroundColor: isDarkMode ? '#064E3B' : '#DCFCE7', borderColor: palette.income },
                  ]}
                  onPress={() => setType('income')}
                >
                  <Text style={[styles.typeBtnText, { color: type === 'income' ? palette.income : palette.inkMuted }]}>
                    📈 Pemasukan
                  </Text>
                </Pressable>
              </View>

              {/* Amount */}
              <Text style={[styles.inputLabel, { color: palette.inkSecondary }]}>Nominal (Rp)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: palette.cardMuted, borderColor: palette.border, color: palette.ink }]}
                placeholder="0"
                keyboardType="numeric"
                placeholderTextColor={palette.inkMuted}
                value={amount}
                onChangeText={(text) => setAmount(formatNumberThousand(text))}
              />

              {/* Note */}
              <Text style={[styles.inputLabel, { color: palette.inkSecondary }]}>Nama / Keterangan Tagihan</Text>
              <TextInput
                style={[styles.input, { backgroundColor: palette.cardMuted, borderColor: palette.border, color: palette.ink }]}
                placeholder="Misal: Tagihan WiFi, Arisan, Gaji"
                placeholderTextColor={palette.inkMuted}
                value={note}
                onChangeText={setNote}
              />

              {/* Frekuensi */}
              <Text style={[styles.inputLabel, { color: palette.inkSecondary }]}>Frekuensi Berulang</Text>
              <View style={styles.freqRow}>
                {(['monthly', 'weekly', 'daily'] as const).map((f) => (
                  <Pressable
                    key={f}
                    style={[
                      styles.freqChip,
                      { backgroundColor: palette.cardMuted, borderColor: palette.border },
                      frequency === f && { backgroundColor: palette.primary, borderColor: palette.primary },
                    ]}
                    onPress={() => setFrequency(f)}
                  >
                    <Text style={[styles.freqChipText, { color: frequency === f ? '#FFFFFF' : palette.inkMuted }]}>
                      {f === 'monthly' ? 'Bulanan' : f === 'weekly' ? 'Mingguan' : 'Harian'}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Jatuh Tempo Pertama via DatePicker */}
              <Text style={[styles.inputLabel, { color: palette.inkSecondary }]}>Tanggal Jatuh Tempo Berikutnya</Text>
              <Pressable
                style={[styles.dateTrigger, { backgroundColor: palette.cardMuted, borderColor: palette.border }]}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={{ fontSize: 16 }}>📅</Text>
                <Text style={[styles.dateTriggerText, { color: palette.ink }]}>
                  {formatDate(nextDueDate)}
                </Text>
                <Text style={[styles.dateChangeHint, { color: palette.primary }]}>Ubah</Text>
              </Pressable>

              {/* Kategori */}
              <Text style={[styles.inputLabel, { color: palette.inkSecondary }]}>Pilih Kategori</Text>
              <View style={styles.catGrid}>
                {categories.map((c) => (
                  <Pressable
                    key={c.id}
                    style={[
                      styles.catChip,
                      { backgroundColor: palette.cardMuted, borderColor: palette.border },
                      categoryId === c.id && { backgroundColor: isDarkMode ? '#16313B' : '#EAF6F3', borderColor: palette.primary },
                    ]}
                    onPress={() => setCategoryId(c.id)}
                  >
                    <Text style={styles.catIcon}>{c.icon}</Text>
                    <Text style={[styles.catText, { color: categoryId === c.id ? palette.primary : palette.ink }]}>
                      {c.name}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Pressable style={[styles.saveBtn, { backgroundColor: palette.primary }]} onPress={handleSaveRule}>
                <Text style={styles.saveBtnText}>
                  {editingRuleId ? 'Perbarui Jadwal Rutin' : 'Simpan Jadwal Rutin'}
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* DatePicker Visual */}
      <DatePickerModal
        visible={showDatePicker}
        value={nextDueDate}
        onSelect={(newDateStr) => {
          setNextDueDate(newDateStr.split(' ')[0]);
        }}
        onClose={() => setShowDatePicker(false)}
      />

      <ModernConfirmModal
        visible={!!deleteRuleId}
        type="danger"
        icon="🗑️"
        title="Hapus Transaksi Berulang"
        message="Hapus jadwal transaksi berulang ini? Transaksi yang sudah terbit sebelumnya tidak akan terhapus."
        cancelText="Batal"
        confirmText="Ya, Hapus"
        onCancel={() => setDeleteRuleId(null)}
        onConfirm={confirmDeleteRule}
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
    fontSize: 18,
    fontWeight: '800',
  },
  addTopBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addTopBtnText: {
    fontFamily: FONTS.sansBold,
    fontSize: 12,
    color: '#FAF8F5',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 6,
    gap: 12,
  },
  infoBannerIcon: { fontSize: 24 },
  infoBannerTitle: {
    fontFamily: FONTS.sansBold,
    fontSize: 13,
  },
  infoBannerText: {
    fontFamily: FONTS.sansRegular,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  ruleCard: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
  },
  ruleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  ruleIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ruleIcon: { fontSize: 22 },
  ruleTitle: {
    fontFamily: FONTS.sansBold,
    fontSize: 14,
  },
  ruleFrequency: {
    fontFamily: FONTS.sansRegular,
    fontSize: 12,
    marginTop: 2,
  },
  ruleFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
  },
  ruleAmount: {
    fontFamily: FONTS.sansBold,
    fontSize: 16,
    fontWeight: '800',
  },
  actionBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  actionBtnText: {
    fontFamily: FONTS.sansBold,
    fontSize: 11,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxHeight: '90%',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: FONTS.serifTitle,
    fontSize: 18,
    fontWeight: '800',
  },
  modalClose: {
    fontSize: 18,
    fontFamily: FONTS.sansBold,
    padding: 4,
  },
  typeToggleRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  typeBtn: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeBtnText: {
    fontFamily: FONTS.sansBold,
    fontSize: 12,
  },
  inputLabel: {
    fontFamily: FONTS.sansBold,
    fontSize: 12,
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontFamily: FONTS.sansMedium,
    fontSize: 14,
  },
  freqRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  freqChip: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  freqChipText: {
    fontFamily: FONTS.sansBold,
    fontSize: 12,
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
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
    marginBottom: 16,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  catIcon: { fontSize: 16 },
  catText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 12,
  },
  saveBtn: {
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
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
