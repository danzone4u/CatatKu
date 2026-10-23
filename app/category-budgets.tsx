import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, useWindowDimensions } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { useFocusEffect, Stack, router } from 'expo-router';
import {
  getCategoryBudgets,
  setCategoryBudget,
  deleteCategoryBudget,
  getCategories,
  type CategoryBudget,
  type Category,
} from '../src/database/queries';
import { useCashbookStore } from '../src/stores/useCashbookStore';
import { useThemeStore } from '../src/stores/useThemeStore';
import { getCurrentMonth, getMonthName } from '../src/utils/date';
import { formatRupiah, formatNumberThousand, parseRupiahInput } from '../src/utils/currency';
import { FONTS } from '../src/constants/theme';
import { ModernConfirmModal, type ModalType } from '../src/components/ModernConfirmModal';
import { BackArrowIcon } from '../src/components/ActionIcons';

export default function CategoryBudgetsScreen() {
  const db = useSQLiteContext();
  const { width } = useWindowDimensions();
  const isTablet = width >= 600;
  const palette = useThemeStore((s) => s.palette);
  const isDarkMode = useThemeStore((s) => s.isDarkMode);

  const activeCashbook = useCashbookStore((state) => state.activeCashbook);
  const cashbookId = activeCashbook?.id ?? 1;
  const { year, month } = getCurrentMonth();

  const [budgets, setBudgets] = useState<CategoryBudget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<number | null>(null);
  const [limitAmount, setLimitAmount] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  const [confirmModal, setConfirmModal] = useState<{
    visible: boolean;
    type: ModalType;
    icon?: string;
    title: string;
    message: string;
    cancelText?: string;
    confirmText?: string;
    onConfirm: () => void;
  }>({
    visible: false,
    type: 'warning',
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const showAlert = (title: string, message: string, type: ModalType = 'warning', icon?: string) => {
    setConfirmModal({
      visible: true,
      type,
      icon,
      title,
      message,
      confirmText: 'Mengerti',
      cancelText: '',
      onConfirm: () => setConfirmModal((prev) => ({ ...prev, visible: false })),
    });
  };

  const loadData = useCallback(async () => {
    const [bList, cats] = await Promise.all([
      getCategoryBudgets(db, cashbookId, year, month),
      getCategories(db),
    ]);
    setBudgets(bList);
    setCategories(cats);
    if (cats.length > 0 && !selectedCatId) {
      setSelectedCatId(cats[0].id);
    }
  }, [db, cashbookId, year, month, selectedCatId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  async function handleSaveBudget() {
    if (!selectedCatId) {
      showAlert('Perhatian', 'Pilih kategori anggaran', 'warning');
      return;
    }

    const numLimit = parseRupiahInput(limitAmount);
    if (!numLimit || numLimit <= 0) {
      showAlert('Perhatian', 'Masukkan nominal batas anggaran yang valid', 'warning');
      return;
    }

    await setCategoryBudget(db, {
      cashbook_id: cashbookId,
      category_id: selectedCatId,
      monthly_limit: numLimit,
      month,
      year,
    });

    setLimitAmount('');
    setShowAddForm(false);
    loadData();
  }

  async function handleDeleteBudget(id: number, catName: string) {
    setConfirmModal({
      visible: true,
      type: 'danger',
      icon: '🗑️',
      title: 'Hapus Anggaran',
      message: `Hapus batas anggaran kategori "${catName}"?`,
      cancelText: 'Batal',
      confirmText: 'Hapus',
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, visible: false }));
        await deleteCategoryBudget(db, id);
        loadData();
      },
    });
  }

  const totalBudgeted = budgets.reduce((sum, b) => sum + b.monthly_limit, 0);
  const totalSpent = budgets.reduce((sum, b) => sum + (b.spent_amount ?? 0), 0);

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
              <Text style={[styles.headerTitle, { color: palette.ink }]}>
                Anggaran Kategori ({getMonthName(month)})
              </Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          isTablet && { maxWidth: 840, width: '100%', alignSelf: 'center' },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Ringkasan Anggaran */}
        <View style={[styles.summaryCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.summaryTitle, { color: palette.inkMuted }]}>Total Pengeluaran dari Anggaran</Text>
          <Text style={[styles.summaryTotal, { color: palette.ink }]}>
            {formatRupiah(totalSpent)}{' '}
            <Text style={[styles.summaryLimit, { color: palette.inkMuted }]}>/ {formatRupiah(totalBudgeted)}</Text>
          </Text>
          <Text style={[styles.summarySub, { color: palette.inkSecondary }]}>
            Periode: {getMonthName(month)} {year}
          </Text>
        </View>

        {/* Section Header */}
        <View style={styles.actionHeader}>
          <Text style={[styles.sectionTitle, { color: palette.ink }]}>Batas Anggaran Kategori</Text>
          <Pressable
            style={({ pressed }) => [
              styles.addToggleBtn,
              { backgroundColor: showAddForm ? palette.cardMuted : palette.primary },
              pressed && { opacity: 0.8 },
            ]}
            onPress={() => setShowAddForm(!showAddForm)}
          >
            <Text style={[styles.addToggleBtnText, { color: showAddForm ? palette.ink : '#FFFFFF' }]}>
              {showAddForm ? 'Batal' : '+ Pasang Anggaran'}
            </Text>
          </Pressable>
        </View>

        {/* Add Budget Form */}
        {showAddForm && (
          <View style={[styles.formCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={[styles.formTitle, { color: palette.ink }]}>Atur Anggaran Kategori</Text>

            <Text style={[styles.label, { color: palette.inkSecondary }]}>Pilih Kategori</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerRow}>
              {categories.map((c) => {
                const isSelected = selectedCatId === c.id;
                return (
                  <Pressable
                    key={c.id}
                    style={[
                      styles.catChip,
                      { backgroundColor: palette.cardMuted, borderColor: palette.border },
                      isSelected && {
                        borderColor: palette.primary,
                        backgroundColor: isDarkMode ? '#16313B' : '#EAF6F3',
                      },
                    ]}
                    onPress={() => setSelectedCatId(c.id)}
                  >
                    <Text style={styles.catChipIcon}>{c.icon}</Text>
                    <Text
                      style={[
                        styles.catChipText,
                        { color: palette.inkMuted },
                        isSelected && { color: palette.primary, fontWeight: '700' },
                      ]}
                    >
                      {c.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Text style={[styles.label, { color: palette.inkSecondary }]}>Batas Maksimal Bulanan (Rp)</Text>
            <TextInput
              style={[
                styles.amountInput,
                { backgroundColor: palette.cardMuted, borderColor: palette.border, color: palette.ink },
              ]}
              placeholder="0"
              placeholderTextColor={palette.inkMuted}
              keyboardType="numeric"
              value={limitAmount}
              onChangeText={(txt) => setLimitAmount(formatNumberThousand(txt))}
            />

            <Pressable
              style={({ pressed }) => [
                styles.saveBtn,
                { backgroundColor: palette.primary },
                pressed && { opacity: 0.8 },
              ]}
              onPress={handleSaveBudget}
            >
              <Text style={styles.saveBtnText}>Simpan Anggaran</Text>
            </Pressable>
          </View>
        )}

        {/* List Budget Items */}
        {budgets.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={[styles.emptyIcon]}>📊</Text>
            <Text style={[styles.emptyText, { color: palette.inkMuted }]}>
              Belum ada anggaran per kategori yang diatur bulan ini
            </Text>
          </View>
        ) : (
          budgets.map((b) => {
            const spent = b.spent_amount ?? 0;
            const ratio = b.monthly_limit > 0 ? Math.min(spent / b.monthly_limit, 1) : 0;
            const percent = Math.round(ratio * 100);

            let progressColor = '#10B981';
            if (percent >= 90) progressColor = palette.expense;
            else if (percent >= 70) progressColor = '#F59E0B';

            return (
              <Pressable
                key={b.id}
                style={[styles.budgetItem, { backgroundColor: palette.card, borderColor: palette.border }]}
                onLongPress={() => handleDeleteBudget(b.id, b.category_name ?? 'Kategori')}
              >
                <View style={styles.itemHeader}>
                  <View style={styles.itemLeft}>
                    <Text style={styles.catIcon}>{b.category_icon}</Text>
                    <Text style={[styles.catName, { color: palette.ink }]}>{b.category_name}</Text>
                  </View>
                  <Text style={[styles.percentBadge, { color: progressColor }]}>{percent}%</Text>
                </View>

                <View style={[styles.progressBar, { backgroundColor: palette.borderSubtle }]}>
                  <View style={[styles.progressFill, { width: `${ratio * 100}%`, backgroundColor: progressColor }]} />
                </View>

                <View style={styles.itemFooter}>
                  <Text style={[styles.spentText, { color: palette.ink }]}>{formatRupiah(spent)} terpakai</Text>
                  <Text style={[styles.limitText, { color: palette.inkMuted }]}>Maks: {formatRupiah(b.monthly_limit)}</Text>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      <ModernConfirmModal
        visible={confirmModal.visible}
        type={confirmModal.type}
        icon={confirmModal.icon}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        cancelText={confirmModal.cancelText}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, visible: false }))}
        onConfirm={confirmModal.onConfirm}
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
  summaryCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
  },
  summaryTitle: { fontSize: 13, fontFamily: FONTS.sansMedium },
  summaryTotal: { fontSize: 24, fontWeight: '800', fontFamily: FONTS.serifTitle, marginVertical: 6 },
  summaryLimit: { fontSize: 16, fontWeight: '600' },
  summarySub: { fontSize: 12, fontFamily: FONTS.sansRegular },
  actionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', fontFamily: FONTS.sansBold },
  addToggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  addToggleBtnText: { fontSize: 12, fontWeight: '700', fontFamily: FONTS.sansBold },
  formCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  formTitle: { fontSize: 15, fontWeight: '700', fontFamily: FONTS.sansBold, marginBottom: 10 },
  label: { fontSize: 13, fontWeight: '600', fontFamily: FONTS.sansMedium, marginTop: 8, marginBottom: 6 },
  pickerRow: { flexDirection: 'row', marginBottom: 8 },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginRight: 8,
    borderWidth: 1,
  },
  catChipIcon: { fontSize: 16, marginRight: 6 },
  catChipText: { fontSize: 13, fontFamily: FONTS.sansRegular },
  amountInput: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: FONTS.sansBold,
    borderWidth: 1,
  },
  saveBtn: {
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 14,
  },
  saveBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', fontFamily: FONTS.sansBold },
  emptyBox: {
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: 12,
  },
  emptyIcon: { fontSize: 32, marginBottom: 8 },
  emptyText: { textAlign: 'center', fontSize: 13, fontFamily: FONTS.sansRegular },
  budgetItem: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  itemLeft: { flexDirection: 'row', alignItems: 'center' },
  catIcon: { fontSize: 20, marginRight: 8 },
  catName: { fontSize: 15, fontWeight: '700', fontFamily: FONTS.sansBold },
  percentBadge: { fontSize: 14, fontWeight: '800', fontFamily: FONTS.sansBold },
  progressBar: { height: 8, borderRadius: 4, overflow: 'hidden', marginVertical: 6 },
  progressFill: { height: '100%', borderRadius: 4 },
  itemFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  spentText: { fontSize: 12, fontWeight: '600', fontFamily: FONTS.sansMedium },
  limitText: { fontSize: 12, fontFamily: FONTS.sansRegular },
});
