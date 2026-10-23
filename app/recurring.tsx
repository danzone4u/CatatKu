import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
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
  payScheduledBill,
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
import { formatDate, getToday, getNowFull } from '../src/utils/date';
import { FONTS } from '../src/constants/theme';
import EmptyState from '../src/components/EmptyState';
import { ModernConfirmModal, type ModalType } from '../src/components/ModernConfirmModal';
import { EditActionIcon, BackArrowIcon } from '../src/components/ActionIcons';
import DatePickerModal from '../src/components/DatePickerModal';

type FilterTab = 'all' | 'bills' | 'auto';

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
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

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
  const [isAutoExecute, setIsAutoExecute] = useState(true);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Modal Konfirmasi Bayar Tagihan Manual
  const [payingRule, setPayingRule] = useState<RecurringRule | null>(null);
  const [payAccountId, setPayAccountId] = useState<number | null>(null);

  const today = new Date();
  const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

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
    setIsAutoExecute(activeTab !== 'bills');
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
    setIsAutoExecute(rule.is_auto_execute === 1);
    setCategoryId(rule.category_id);
    setAccountId(rule.account_id ?? (accounts[0]?.id || 1));
    setShowModal(true);
  };

  async function handleSaveRule() {
    const numAmount = parseRupiahInput(amount);
    if (!numAmount || numAmount <= 0) {
      showAlert('Perhatian', 'Masukkan nominal yang valid', 'warning');
      return;
    }
    if (!categoryId) {
      showAlert('Perhatian', 'Pilih kategori', 'warning');
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
        is_auto_execute: isAutoExecute ? 1 : 0,
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
        is_auto_execute: isAutoExecute ? 1 : 0,
      });
    }

    setShowModal(false);
    loadData();
  }

  const handlePayPress = (rule: RecurringRule) => {
    setPayingRule(rule);
    setPayAccountId(rule.account_id ?? (accounts[0]?.id || null));
  };

  const handleConfirmPayBill = async () => {
    if (!payingRule || !payAccountId) return;
    try {
      const billTitle = payingRule.note || payingRule.category_name || 'Tagihan';
      await payScheduledBill(db, payingRule.id, currentMonthStr, payAccountId, getNowFull());
      setPayingRule(null);
      await loadData();
      showAlert('Sukses', `Tagihan "${billTitle}" berhasil dibayar dan dicatat sebagai mutasi.`, 'success', '🎉');
    } catch {
      showAlert('Error', 'Gagal memproses pembayaran tagihan', 'danger');
    }
  };

  // Filter list data berdasarkan tab
  const filteredRules = rules.filter((r) => {
    if (activeTab === 'bills') return r.is_auto_execute === 0;
    if (activeTab === 'auto') return r.is_auto_execute === 1;
    return true;
  });

  // Hitung ringkasan tagihan bulan berjalan
  const manualBills = rules.filter((r) => r.is_auto_execute === 0 && r.is_active === 1);
  const totalBillsAmount = manualBills.reduce((acc, curr) => acc + curr.amount, 0);
  const paidBillsCount = manualBills.filter((r) => r.last_paid_period === currentMonthStr).length;

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
              <Text style={[styles.headerTitle, { color: palette.ink }]}>Jadwal & Tagihan</Text>
            </View>
          </View>

          <Pressable
            style={[styles.addTopBtn, { backgroundColor: palette.primary }]}
            onPress={openAddModal}
          >
            <Text style={styles.addTopBtnText}>+ Buat Jadwal</Text>
          </Pressable>
        </View>
      </View>

      {/* Tab Filter */}
      <View style={[styles.tabBar, { backgroundColor: palette.card, borderBottomColor: palette.border }]}>
        <View style={[styles.tabBarInner, isTablet && { maxWidth: 840, width: '100%', alignSelf: 'center' }]}>
          {(
            [
              { id: 'all', label: `Semua (${rules.length})` },
              { id: 'bills', label: `Tagihan (${manualBills.length})` },
              { id: 'auto', label: 'Otomatis' },
            ] as const
          ).map((tab) => {
            const isSelected = activeTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                style={[
                  styles.tabItem,
                  isSelected && [styles.tabItemActive, { borderBottomColor: palette.primary }],
                ]}
                onPress={() => setActiveTab(tab.id)}
              >
                <Text
                  style={[
                    styles.tabLabel,
                    { color: isSelected ? palette.primary : palette.inkMuted },
                    isSelected && { fontWeight: '700' },
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <FlatList
        data={filteredRules}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={[
          styles.listContent,
          isTablet && { maxWidth: 840, width: '100%', alignSelf: 'center' },
          { flexGrow: 1 },
        ]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          activeTab === 'bills' || activeTab === 'all' ? (
            <View style={[styles.billSummaryCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <View style={styles.summaryTop}>
                <View>
                  <Text style={[styles.summaryLabel, { color: palette.inkMuted }]}>Kewajiban Tagihan Bulan Ini</Text>
                  <Text style={[styles.summaryAmount, { color: palette.ink }]}>{formatRupiah(totalBillsAmount)}</Text>
                </View>
                <View style={[styles.summaryBadge, { backgroundColor: paidBillsCount === manualBills.length && manualBills.length > 0 ? '#DCFCE7' : 'rgba(217, 119, 6, 0.12)' }]}>
                  <Text style={[styles.summaryBadgeText, { color: paidBillsCount === manualBills.length && manualBills.length > 0 ? '#16A34A' : '#D97706' }]}>
                    {paidBillsCount}/{manualBills.length} Terbayar
                  </Text>
                </View>
              </View>
              <Text style={[styles.summaryDesc, { color: palette.inkMuted }]}>
                Pencatatan otomatis jalan di latar belakang. Tagihan manual perlu ditekan konfirmasi lunas.
              </Text>
            </View>
          ) : (
            <View style={[styles.infoBanner, { backgroundColor: palette.cardMuted, borderColor: palette.border }]}>
              <Text style={styles.infoBannerIcon}>⚡</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.infoBannerTitle, { color: palette.ink }]}>Pencatatan Otomatis (Auto-Debit/Kredit)</Text>
                <Text style={[styles.infoBannerText, { color: palette.inkMuted }]}>
                  Saldo otomatis dipotong atau ditambah tanpa konfirmasi saat tanggal tempo tercapai.
                </Text>
              </View>
            </View>
          )
        }
        renderItem={({ item }) => {
          const isManualBill = item.is_auto_execute === 0;
          const isPaidThisMonth = isManualBill && item.last_paid_period === currentMonthStr;

          return (
            <View style={[styles.ruleCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <View style={styles.ruleHeader}>
                <View style={[styles.ruleIconBox, { backgroundColor: palette.cardMuted }]}>
                  <Text style={styles.ruleIcon}>{item.category_icon ?? (isManualBill ? '📄' : '🔄')}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.badgeLine}>
                    <Text style={[styles.ruleTitle, { color: palette.ink }]}>
                      {item.note || item.category_name || 'Jadwal Transaksi'}
                    </Text>
                    <View
                      style={[
                        styles.modeBadge,
                        { backgroundColor: isManualBill ? 'rgba(217, 119, 6, 0.12)' : 'rgba(15, 118, 110, 0.12)' },
                      ]}
                    >
                      <Text style={[styles.modeBadgeText, { color: isManualBill ? '#D97706' : palette.primary }]}>
                        {isManualBill ? 'Tagihan Manual' : 'Otomatis'}
                      </Text>
                    </View>
                  </View>

                  <Text style={[styles.ruleFrequency, { color: palette.inkMuted }]}>
                    {item.frequency === 'daily'
                      ? 'Setiap Hari'
                      : item.frequency === 'weekly'
                      ? 'Setiap Minggu'
                      : 'Setiap Bulan'}{' '}
                    • Tempo: {formatDate(item.next_due_date)}
                  </Text>
                </View>
                <Switch
                  value={item.is_active === 1}
                  onValueChange={() => handleToggle(item.id)}
                  trackColor={{ false: palette.border, true: palette.primary }}
                />
              </View>

              <View style={[styles.ruleFooter, { borderTopColor: palette.borderSubtle }]}>
                <View>
                  <Text
                    style={[styles.ruleAmount, { color: item.type === 'income' ? palette.income : palette.expense }]}
                  >
                    {item.type === 'income' ? '+' : '-'}{formatRupiah(item.amount)}
                  </Text>
                  {isManualBill && (
                    <Text style={[styles.statusText, { color: isPaidThisMonth ? '#16A34A' : '#D97706' }]}>
                      {isPaidThisMonth ? '✓ Lunas Bulan Ini' : '⚠️ Belum Dibayar'}
                    </Text>
                  )}
                </View>

                <View style={styles.actionBtnRow}>
                  {isManualBill && !isPaidThisMonth && item.is_active === 1 && (
                    <Pressable
                      style={({ pressed }) => [
                        styles.payActionBtn,
                        { backgroundColor: palette.primary },
                        pressed && { opacity: 0.8 },
                      ]}
                      onPress={() => handlePayPress(item)}
                    >
                      <Text style={styles.payActionBtnText}>Bayar</Text>
                    </Pressable>
                  )}

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
          );
        }}
        ListEmptyComponent={
          <EmptyState
            icon="📅"
            title="Belum Ada Jadwal Transaksi"
            subtitle="Jadwalkan tagihan bulanan atau transaksi berulang agar tercatat rapi & terkontrol"
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
                {editingRuleId ? 'Edit Jadwal & Tagihan' : 'Buat Jadwal & Tagihan Baru'}
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

              {/* Mode Eksekusi: Otomatis vs Manual (Tagihan) */}
              <Text style={[styles.inputLabel, { color: palette.inkSecondary }]}>Mode Eksekusi Pencatatan</Text>
              <View style={styles.execModeRow}>
                <Pressable
                  style={[
                    styles.execModeBtn,
                    { backgroundColor: palette.cardMuted, borderColor: palette.border },
                    isAutoExecute && { borderColor: palette.primary, backgroundColor: isDarkMode ? '#16313B' : '#EAF6F3' },
                  ]}
                  onPress={() => setIsAutoExecute(true)}
                >
                  <Text style={styles.execModeIcon}>⚡</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.execModeTitle, { color: isAutoExecute ? palette.primary : palette.ink }]}>
                      Otomatis Catat
                    </Text>
                    <Text style={[styles.execModeDesc, { color: palette.inkMuted }]}>
                      Auto-debit/kredit saat hari H
                    </Text>
                  </View>
                </Pressable>

                <Pressable
                  style={[
                    styles.execModeBtn,
                    { backgroundColor: palette.cardMuted, borderColor: palette.border },
                    !isAutoExecute && { borderColor: '#D97706', backgroundColor: isDarkMode ? '#451A03' : '#FEF3C7' },
                  ]}
                  onPress={() => setIsAutoExecute(false)}
                >
                  <Text style={styles.execModeIcon}>📄</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.execModeTitle, { color: !isAutoExecute ? '#D97706' : palette.ink }]}>
                      Tagihan Manual
                    </Text>
                    <Text style={[styles.execModeDesc, { color: palette.inkMuted }]}>
                      Konfirmasi tombol bayar
                    </Text>
                  </View>
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
                placeholder="Misal: Tagihan Listrik, WiFi, Gaji Bulanan"
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

              {/* Dompet / Rekening Default */}
              <Text style={[styles.inputLabel, { color: palette.inkSecondary }]}>Dompet / Rekening Terkait</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {accounts.map((acc) => (
                    <Pressable
                      key={acc.id}
                      style={[
                        styles.accChip,
                        { backgroundColor: palette.cardMuted, borderColor: palette.border },
                        accountId === acc.id && { backgroundColor: isDarkMode ? '#16313B' : '#EAF6F3', borderColor: palette.primary },
                      ]}
                      onPress={() => setAccountId(acc.id)}
                    >
                      <Text style={{ fontSize: 14 }}>{acc.icon || '💳'}</Text>
                      <Text
                        style={[
                          styles.accChipText,
                          { color: accountId === acc.id ? palette.primary : palette.ink },
                        ]}
                      >
                        {acc.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>

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
                  {editingRuleId ? 'Perbarui Jadwal' : 'Simpan Jadwal'}
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal Bayar Tagihan Manual */}
      <Modal visible={payingRule !== null} animationType="fade" transparent onRequestClose={() => setPayingRule(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.payModalCard, { backgroundColor: palette.card, borderColor: palette.border }, isTablet && { maxWidth: 440 }]}>
            <Text style={[styles.payModalTitle, { color: palette.ink }]}>Bayar Tagihan</Text>
            <Text style={[styles.payModalSub, { color: palette.inkMuted }]}>
              {payingRule?.note || payingRule?.category_name} • Periode {currentMonthStr}
            </Text>

            <View style={[styles.payAmountBox, { backgroundColor: palette.cardMuted }]}>
              <Text style={[styles.payAmountLabel, { color: palette.inkMuted }]}>Total Pembayaran</Text>
              <Text style={[styles.payAmountVal, { color: palette.expense }]}>
                {formatRupiah(payingRule?.amount ?? 0)}
              </Text>
            </View>

            <Text style={[styles.inputLabel, { color: palette.inkSecondary }]}>Pilih Sumber Dana (Dompet):</Text>
            <ScrollView style={{ maxHeight: 180, marginBottom: 16 }}>
              {accounts.map((acc) => {
                const isSelected = payAccountId === acc.id;
                return (
                  <Pressable
                    key={acc.id}
                    style={[
                      styles.payAccRow,
                      { backgroundColor: palette.cardMuted, borderColor: palette.border },
                      isSelected && { borderColor: palette.primary, backgroundColor: isDarkMode ? '#16313B' : '#EAF6F3' },
                    ]}
                    onPress={() => setPayAccountId(acc.id)}
                  >
                    <Text style={{ fontSize: 20 }}>{acc.icon || '💳'}</Text>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={[styles.payAccName, { color: palette.ink }]}>{acc.name}</Text>
                      <Text style={[styles.payAccBal, { color: palette.inkMuted }]}>Saldo: {formatRupiah(acc.balance)}</Text>
                    </View>
                    <View style={[styles.payRadio, isSelected && { borderColor: palette.primary }]}>
                      {isSelected && <View style={[styles.payRadioInner, { backgroundColor: palette.primary }]} />}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.payBtnRow}>
              <Pressable
                style={[styles.payCancelBtn, { borderColor: palette.border }]}
                onPress={() => setPayingRule(null)}
              >
                <Text style={{ color: palette.inkMuted, fontWeight: '700' }}>Batal</Text>
              </Pressable>
              <Pressable
                style={[styles.payConfirmBtn, { backgroundColor: palette.primary }]}
                onPress={handleConfirmPayBill}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Konfirmasi Bayar</Text>
              </Pressable>
            </View>
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
        title="Hapus Jadwal Transaksi"
        message="Hapus jadwal transaksi ini? Riwayat transaksi yang sudah dibukukan sebelumnya tidak akan terhapus."
        cancelText="Batal"
        confirmText="Ya, Hapus"
        onCancel={() => setDeleteRuleId(null)}
        onConfirm={confirmDeleteRule}
      />

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
  tabBar: {
    borderBottomWidth: 1,
    paddingHorizontal: 16,
  },
  tabBarInner: {
    flexDirection: 'row',
    gap: 16,
  },
  tabItem: {
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {},
  tabLabel: {
    fontFamily: FONTS.sansMedium,
    fontSize: 13,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  billSummaryCard: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    marginBottom: 4,
  },
  summaryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  summaryLabel: {
    fontFamily: FONTS.sansMedium,
    fontSize: 12,
  },
  summaryAmount: {
    fontFamily: FONTS.serifTitle,
    fontSize: 20,
    fontWeight: '800',
    marginTop: 2,
  },
  summaryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  summaryBadgeText: {
    fontFamily: FONTS.sansBold,
    fontSize: 11,
    fontWeight: '700',
  },
  summaryDesc: {
    fontFamily: FONTS.sansRegular,
    fontSize: 11,
    lineHeight: 16,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 4,
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
  badgeLine: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  ruleTitle: {
    fontFamily: FONTS.sansBold,
    fontSize: 14,
  },
  modeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  modeBadgeText: {
    fontFamily: FONTS.sansBold,
    fontSize: 10,
    fontWeight: '700',
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
    fontSize: 15,
    fontWeight: '800',
  },
  statusText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 11,
    marginTop: 2,
  },
  actionBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  payActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  payActionBtnText: {
    fontFamily: FONTS.sansBold,
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '700',
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
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  typeBtnText: {
    fontFamily: FONTS.sansBold,
    fontSize: 13,
  },
  execModeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  execModeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  execModeIcon: { fontSize: 20 },
  execModeTitle: {
    fontFamily: FONTS.sansBold,
    fontSize: 12,
  },
  execModeDesc: {
    fontFamily: FONTS.sansRegular,
    fontSize: 10,
    marginTop: 1,
  },
  inputLabel: {
    fontFamily: FONTS.sansBold,
    fontSize: 12,
    marginBottom: 6,
    marginTop: 4,
  },
  input: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
    marginBottom: 12,
    fontFamily: FONTS.sansRegular,
  },
  freqRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  freqChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  freqChipText: {
    fontFamily: FONTS.sansBold,
    fontSize: 12,
  },
  dateTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
    gap: 10,
  },
  dateTriggerText: {
    flex: 1,
    fontFamily: FONTS.sansBold,
    fontSize: 14,
  },
  dateChangeHint: {
    fontFamily: FONTS.sansBold,
    fontSize: 12,
  },
  accChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  accChipText: {
    fontFamily: FONTS.sansBold,
    fontSize: 12,
  },
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  catIcon: { fontSize: 16 },
  catText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 12,
  },
  saveBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  saveBtnText: {
    fontFamily: FONTS.sansBold,
    fontSize: 14,
    color: '#FAF8F5',
  },
  payModalCard: {
    width: '100%',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
  },
  payModalTitle: {
    fontFamily: FONTS.serifTitle,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  payModalSub: {
    fontFamily: FONTS.sansRegular,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 14,
  },
  payAmountBox: {
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    marginBottom: 14,
  },
  payAmountLabel: {
    fontFamily: FONTS.sansRegular,
    fontSize: 12,
  },
  payAmountVal: {
    fontFamily: FONTS.sansBold,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 2,
  },
  payAccRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  payAccName: {
    fontFamily: FONTS.sansBold,
    fontSize: 13,
  },
  payAccBal: {
    fontFamily: FONTS.sansRegular,
    fontSize: 11,
    marginTop: 1,
  },
  payRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#94A3B8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  payRadioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  payBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  payCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  payConfirmBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  footerWrap: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  footerText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 12,
    opacity: 0.8,
  },
});
