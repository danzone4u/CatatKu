import { View, Text, StyleSheet, FlatList, Pressable, TextInput, Alert, Modal, ScrollView, Switch } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { useFocusEffect, router, Stack } from 'expo-router';
import {
  getRecurringRules,
  addRecurringRule,
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
import { formatRupiah } from '../src/utils/currency';
import { formatDate, getToday } from '../src/utils/date';
import { PALETTE, FONTS } from '../src/constants/theme';
import EmptyState from '../src/components/EmptyState';
import { ModernConfirmModal } from '../src/components/ModernConfirmModal';

export default function RecurringScreen() {
  const db = useSQLiteContext();
  const activeCashbook = useCashbookStore((state) => state.activeCashbook);
  const cashbookId = activeCashbook?.id ?? 1;

  const [rules, setRules] = useState<RecurringRule[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<AccountWithCalculatedBalance[]>([]);
  const [deleteRuleId, setDeleteRuleId] = useState<number | null>(null);

  // Modal Form
  const [showModal, setShowModal] = useState(false);
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [nextDueDate, setNextDueDate] = useState(getToday());

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [cashbookId])
  );

  async function loadData() {
    // Jalankan pemrosesan otomatis jika ada yang jatuh tempo
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

  async function handleSaveRule() {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      Alert.alert('Perhatian', 'Masukkan nominal yang valid');
      return;
    }
    if (!categoryId) {
      Alert.alert('Perhatian', 'Pilih kategori');
      return;
    }

    await addRecurringRule(db, {
      cashbook_id: cashbookId,
      account_id: accountId,
      category_id: categoryId,
      type,
      amount: numAmount,
      note: note.trim(),
      frequency,
      next_due_date: nextDueDate,
    });

    setShowModal(false);
    setAmount('');
    setNote('');
    loadData();
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Transaksi Berulang',
          headerStyle: { backgroundColor: PALETTE.card },
          headerTintColor: PALETTE.ink,
          headerTitleStyle: { fontFamily: FONTS.serifTitle, fontSize: 18, fontWeight: '800' },
        }}
      />
      <View style={styles.container}>
        <View style={styles.infoBanner}>
          <Text style={styles.infoBannerIcon}>🔄</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.infoBannerTitle}>Pencatatan Otomatis Berkala</Text>
            <Text style={styles.infoBannerText}>
              Aplikasi akan otomatis mencatat kas keluar/masuk ketika tanggal jatuh tempo tercapai saat aplikasi dibuka.
            </Text>
          </View>
        </View>

        <FlatList
          data={rules}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={rules.length === 0 ? styles.emptyContainer : styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.ruleCard}>
              <View style={styles.ruleHeader}>
                <View style={styles.ruleIconBox}>
                  <Text style={styles.ruleIcon}>{item.category_icon ?? '🔄'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ruleTitle}>{item.note || item.category_name || 'Tagihan Rutin'}</Text>
                  <Text style={styles.ruleFrequency}>
                    {item.frequency === 'daily' ? 'Setiap Hari' : item.frequency === 'weekly' ? 'Setiap Minggu' : 'Setiap Bulan'} • Jatuh tempo: {formatDate(item.next_due_date)}
                  </Text>
                </View>
                <Switch value={item.is_active === 1} onValueChange={() => handleToggle(item.id)} />
              </View>

              <View style={styles.ruleFooter}>
                <Text style={[styles.ruleAmount, { color: item.type === 'income' ? PALETTE.income : PALETTE.expense }]}>
                  {item.type === 'income' ? '+' : '-'}{formatRupiah(item.amount)}
                </Text>
                <Pressable
                  style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.7 }]}
                  onPress={() => handleDelete(item.id)}
                >
                  <Text style={styles.deleteBtnText}>🗑️ Hapus</Text>
                </Pressable>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="🔄"
              title="Belum Ada Transaksi Berulang"
              subtitle="Tekan tombol di bawah untuk menjadwalkan iuran, wifi, atau sewa berkala"
            />
          }
        />

        <View style={styles.bottomBar}>
          <Pressable style={styles.addBtn} onPress={() => setShowModal(true)}>
            <Text style={styles.addBtnText}>+ Buat Transaksi Berulang Baru</Text>
          </Pressable>
        </View>

        {/* Modal Form Tambah Rule */}
        <Modal visible={showModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Tambah Jadwal Rutin</Text>
                <Pressable onPress={() => setShowModal(false)}>
                  <Text style={styles.modalClose}>✕</Text>
                </Pressable>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Type toggle */}
                <View style={styles.typeToggleRow}>
                  <Pressable
                    style={[styles.typeBtn, type === 'expense' && styles.typeBtnExpense]}
                    onPress={() => setType('expense')}
                  >
                    <Text style={[styles.typeBtnText, type === 'expense' && styles.typeBtnTextExpense]}>
                      📉 Pengeluaran Rutin
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.typeBtn, type === 'income' && styles.typeBtnIncome]}
                    onPress={() => setType('income')}
                  >
                    <Text style={[styles.typeBtnText, type === 'income' && styles.typeBtnTextIncome]}>
                      📈 Pemasukan Rutin
                    </Text>
                  </Pressable>
                </View>

                {/* Amount */}
                <Text style={styles.inputLabel}>Nominal (Rp)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  keyboardType="numeric"
                  placeholderTextColor={PALETTE.inkMuted}
                  value={amount}
                  onChangeText={setAmount}
                />

                {/* Note */}
                <Text style={styles.inputLabel}>Nama / Keterangan Tagihan</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Misal: Tagihan WiFi Indihome, Kas RT, Sewa"
                  placeholderTextColor={PALETTE.inkMuted}
                  value={note}
                  onChangeText={setNote}
                />

                {/* Frekuensi */}
                <Text style={styles.inputLabel}>Frekuensi Berulang</Text>
                <View style={styles.freqRow}>
                  <Pressable
                    style={[styles.freqChip, frequency === 'monthly' && styles.freqChipActive]}
                    onPress={() => setFrequency('monthly')}
                  >
                    <Text style={[styles.freqChipText, frequency === 'monthly' && styles.freqChipTextActive]}>
                      Bulanan
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.freqChip, frequency === 'weekly' && styles.freqChipActive]}
                    onPress={() => setFrequency('weekly')}
                  >
                    <Text style={[styles.freqChipText, frequency === 'weekly' && styles.freqChipTextActive]}>
                      Mingguan
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.freqChip, frequency === 'daily' && styles.freqChipActive]}
                    onPress={() => setFrequency('daily')}
                  >
                    <Text style={[styles.freqChipText, frequency === 'daily' && styles.freqChipTextActive]}>
                      Harian
                    </Text>
                  </Pressable>
                </View>

                {/* Jatuh Tempo Pertama */}
                <Text style={styles.inputLabel}>Tanggal Mulai / Jatuh Tempo Pertama</Text>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={PALETTE.inkMuted}
                  value={nextDueDate}
                  onChangeText={setNextDueDate}
                />

                {/* Kategori */}
                <Text style={styles.inputLabel}>Pilih Kategori</Text>
                <View style={styles.catGrid}>
                  {categories.map((c) => (
                    <Pressable
                      key={c.id}
                      style={[styles.catChip, categoryId === c.id && styles.catChipActive]}
                      onPress={() => setCategoryId(c.id)}
                    >
                      <Text style={styles.catIcon}>{c.icon}</Text>
                      <Text style={[styles.catText, categoryId === c.id && styles.catTextActive]}>
                        {c.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Pressable style={styles.saveBtn} onPress={handleSaveRule}>
                  <Text style={styles.saveBtnText}>Simpan Jadwal Rutin</Text>
                </Pressable>
              </ScrollView>
            </View>
          </View>
        </Modal>
        <ModernConfirmModal
          visible={!!deleteRuleId}
          type="danger"
          icon="🗑️"
          title="Hapus Transaksi Berulang"
          message="Yakin ingin menghapus jadwal transaksi rutin ini? Pencatatan otomatis ke depan akan dihentikan."
          cancelText="Batal"
          confirmText="Ya, Hapus"
          onCancel={() => setDeleteRuleId(null)}
          onConfirm={confirmDeleteRule}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PALETTE.canvas },
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: PALETTE.primarySurface,
    padding: 14,
    margin: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PALETTE.border,
    gap: 10,
    alignItems: 'center',
  },
  infoBannerIcon: { fontSize: 22 },
  infoBannerTitle: {
    fontFamily: FONTS.sansBold,
    fontSize: 13,
    fontWeight: '800',
    color: PALETTE.primaryAccent,
  },
  infoBannerText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 11,
    fontWeight: '600',
    color: PALETTE.inkSecondary,
    lineHeight: 16,
    marginTop: 2,
  },
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },
  emptyContainer: { flexGrow: 1 },
  ruleCard: {
    backgroundColor: PALETTE.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: PALETTE.border,
    ...PALETTE.shadowLight,
  },
  ruleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ruleIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: PALETTE.primarySurface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ruleIcon: { fontSize: 20 },
  ruleTitle: {
    fontFamily: FONTS.sansBold,
    fontSize: 15,
    fontWeight: '800',
    color: PALETTE.ink,
  },
  ruleFrequency: {
    fontFamily: FONTS.sansMedium,
    fontSize: 11,
    fontWeight: '600',
    color: PALETTE.inkMuted,
    marginTop: 2,
  },
  ruleFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: PALETTE.borderSubtle,
  },
  ruleAmount: {
    fontFamily: FONTS.serifTitle,
    fontSize: 16,
    fontWeight: '800',
  },
  deleteBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBtnText: {
    fontFamily: FONTS.sansBold,
    fontSize: 12,
    fontWeight: '700',
    color: PALETTE.expense,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
  },
  addBtn: {
    backgroundColor: PALETTE.primary,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    ...PALETTE.shadowMedium,
  },
  addBtnText: {
    fontFamily: FONTS.sansBold,
    fontSize: 14,
    fontWeight: '800',
    color: '#FAF8F5',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: PALETTE.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '88%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: FONTS.serifTitle,
    fontSize: 20,
    fontWeight: '800',
    color: PALETTE.ink,
  },
  modalClose: {
    fontSize: 18,
    fontWeight: '700',
    color: PALETTE.inkMuted,
    padding: 4,
  },
  typeToggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: PALETTE.cardMuted,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  typeBtnExpense: {
    backgroundColor: PALETTE.expenseLight,
    borderColor: PALETTE.expense,
  },
  typeBtnIncome: {
    backgroundColor: PALETTE.incomeLight,
    borderColor: PALETTE.income,
  },
  typeBtnText: {
    fontFamily: FONTS.sansBold,
    fontSize: 12,
    fontWeight: '700',
    color: PALETTE.inkMuted,
  },
  typeBtnTextExpense: { color: PALETTE.expense },
  typeBtnTextIncome: { color: PALETTE.income },
  inputLabel: {
    fontFamily: FONTS.sansBold,
    fontSize: 12,
    fontWeight: '800',
    color: PALETTE.inkSecondary,
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: PALETTE.cardMuted,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontFamily: FONTS.sansMedium,
    fontSize: 14,
    fontWeight: '600',
    color: PALETTE.ink,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  freqRow: {
    flexDirection: 'row',
    gap: 8,
  },
  freqChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: PALETTE.cardMuted,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  freqChipActive: {
    backgroundColor: PALETTE.primaryAccent,
    borderColor: PALETTE.primaryAccent,
  },
  freqChipText: {
    fontFamily: FONTS.sansBold,
    fontSize: 12,
    fontWeight: '700',
    color: PALETTE.inkSecondary,
  },
  freqChipTextActive: {
    color: '#FAF8F5',
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
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: PALETTE.cardMuted,
    borderWidth: 1,
    borderColor: PALETTE.border,
    gap: 4,
  },
  catChipActive: {
    backgroundColor: PALETTE.primarySurface,
    borderColor: PALETTE.primaryAccent,
  },
  catIcon: { fontSize: 14 },
  catText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 12,
    fontWeight: '600',
    color: PALETTE.inkSecondary,
  },
  catTextActive: {
    fontFamily: FONTS.sansBold,
    color: PALETTE.primaryAccent,
  },
  saveBtn: {
    backgroundColor: PALETTE.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  saveBtnText: {
    fontFamily: FONTS.sansBold,
    fontSize: 14,
    fontWeight: '800',
    color: '#FAF8F5',
  },
});
