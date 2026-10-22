import { View, Text, StyleSheet, Pressable, ScrollView, TextInput } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { useFocusEffect, Stack } from 'expo-router';
import {
  getCategoryBudgets,
  setCategoryBudget,
  deleteCategoryBudget,
  getCategories,
  type CategoryBudget,
  type Category,
} from '../src/database/queries';
import { useCashbookStore } from '../src/stores/useCashbookStore';
import { getCurrentMonth, getMonthName } from '../src/utils/date';
import { formatRupiah } from '../src/utils/currency';
import { ModernConfirmModal, type ModalType } from '../src/components/ModernConfirmModal';

export default function CategoryBudgetsScreen() {
  const db = useSQLiteContext();
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

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [cashbookId])
  );

  async function loadData() {
    const [bList, cats] = await Promise.all([
      getCategoryBudgets(db, cashbookId, year, month),
      getCategories(db),
    ]);
    setBudgets(bList);
    setCategories(cats);
    if (cats.length > 0 && !selectedCatId) {
      setSelectedCatId(cats[0].id);
    }
  }

  async function handleSaveBudget() {
    if (!selectedCatId) {
      showAlert('Perhatian', 'Pilih kategori anggaran', 'warning');
      return;
    }

    const numLimit = parseFloat(limitAmount);
    if (!numLimit || numLimit <= 0) {
      showAlert('Perhatian', 'Masukkan nominal batas anggaran', 'warning');
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
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: `Anggaran Kategori (${getMonthName(month)})`,
          headerStyle: { backgroundColor: '#FFFFFF' },
          headerTintColor: '#0F172A',
          headerTitleStyle: { fontWeight: '700' },
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Ringkasan Anggaran */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Total Pengeluaran dari Anggaran</Text>
          <Text style={styles.summaryTotal}>
            {formatRupiah(totalSpent)} <Text style={styles.summaryLimit}>/ {formatRupiah(totalBudgeted)}</Text>
          </Text>
          <Text style={styles.summarySub}>Periode: {getMonthName(month)} {year}</Text>
        </View>

        {/* Section Header */}
        <View style={styles.actionHeader}>
          <Text style={styles.sectionTitle}>Batas Anggaran Kategori</Text>
          <Pressable onPress={() => setShowAddForm(!showAddForm)}>
            <Text style={styles.addBtnText}>{showAddForm ? 'Batal' : '+ Pasang Anggaran'}</Text>
          </Pressable>
        </View>

        {/* Add Budget Form */}
        {showAddForm && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Atur Anggaran Kategori</Text>

            <Text style={styles.label}>Pilih Kategori</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerRow}>
              {categories.map((c) => (
                <Pressable
                  key={c.id}
                  style={[styles.catChip, selectedCatId === c.id && styles.catChipSelected]}
                  onPress={() => setSelectedCatId(c.id)}
                >
                  <Text style={styles.catChipIcon}>{c.icon}</Text>
                  <Text style={[styles.catChipText, selectedCatId === c.id && styles.catChipTextSelected]}>
                    {c.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.label}>Batas Maksimal Bulanan (Rp)</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="Misal: 1500000"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
              value={limitAmount}
              onChangeText={setLimitAmount}
            />

            <Pressable
              style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.8 }]}
              onPress={handleSaveBudget}
            >
              <Text style={styles.saveBtnText}>Simpan Anggaran</Text>
            </Pressable>
          </View>
        )}

        {/* List Budget Items */}
        {budgets.length === 0 ? (
          <Text style={styles.emptyText}>Belum ada anggaran per kategori yang diatur bulan ini</Text>
        ) : (
          budgets.map((b) => {
            const spent = b.spent_amount ?? 0;
            const ratio = b.monthly_limit > 0 ? Math.min(spent / b.monthly_limit, 1) : 0;
            const percent = Math.round(ratio * 100);

            let progressColor = '#16A34A';
            if (percent >= 90) progressColor = '#DC2626';
            else if (percent >= 70) progressColor = '#F59E0B';

            return (
              <Pressable
                key={b.id}
                style={styles.budgetItem}
                onLongPress={() => handleDeleteBudget(b.id, b.category_name ?? 'Kategori')}
              >
                <View style={styles.itemHeader}>
                  <View style={styles.itemLeft}>
                    <Text style={styles.catIcon}>{b.category_icon}</Text>
                    <Text style={styles.catName}>{b.category_name}</Text>
                  </View>
                  <Text style={[styles.percentBadge, { color: progressColor }]}>{percent}%</Text>
                </View>

                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${ratio * 100}%`, backgroundColor: progressColor }]} />
                </View>

                <View style={styles.itemFooter}>
                  <Text style={styles.spentText}>{formatRupiah(spent)} terpakai</Text>
                  <Text style={styles.limitText}>Maks: {formatRupiah(b.monthly_limit)}</Text>
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
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 20, paddingBottom: 40 },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  summaryTitle: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  summaryTotal: { fontSize: 24, fontWeight: '800', color: '#0F172A', marginVertical: 6 },
  summaryLimit: { fontSize: 18, color: '#94A3B8', fontWeight: '600' },
  summarySub: { fontSize: 12, color: '#94A3B8' },
  actionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  addBtnText: { fontSize: 14, fontWeight: '700', color: '#2563EB' },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  formTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A', marginBottom: 10 },
  label: { fontSize: 13, fontWeight: '600', color: '#64748B', marginTop: 8, marginBottom: 6 },
  pickerRow: { flexDirection: 'row', marginBottom: 4 },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  catChipSelected: { backgroundColor: '#DBEAFE', borderColor: '#2563EB', borderWidth: 1.5 },
  catChipIcon: { fontSize: 16, marginRight: 6 },
  catChipText: { fontSize: 13, color: '#64748B' },
  catChipTextSelected: { color: '#2563EB', fontWeight: '700' },
  amountInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  saveBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 14,
  },
  saveBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  emptyText: { textAlign: 'center', color: '#94A3B8', marginTop: 16 },
  budgetItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  itemLeft: { flexDirection: 'row', alignItems: 'center' },
  catIcon: { fontSize: 20, marginRight: 8 },
  catName: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  percentBadge: { fontSize: 14, fontWeight: '800' },
  progressBar: { height: 8, backgroundColor: '#E2E8F0', borderRadius: 4, overflow: 'hidden', marginVertical: 6 },
  progressFill: { height: '100%', borderRadius: 4 },
  itemFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  spentText: { fontSize: 12, fontWeight: '600', color: '#0F172A' },
  limitText: { fontSize: 12, color: '#64748B' },
});
