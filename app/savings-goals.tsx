import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Alert, Switch } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { useFocusEffect, Stack } from 'expo-router';
import {
  getSavingsGoals,
  addSavingsGoal,
  updateSavingsGoalDeposit,
  deleteSavingsGoal,
  getAccounts,
  type SavingsGoal,
  type AccountWithCalculatedBalance,
} from '../src/database/queries';
import { useCashbookStore } from '../src/stores/useCashbookStore';
import { formatRupiah } from '../src/utils/currency';
import { formatDate } from '../src/utils/date';
import { PALETTE, FONTS } from '../src/constants/theme';
import { ModernConfirmModal } from '../src/components/ModernConfirmModal';

const GOAL_EMOJIS = ['🎯', '🛵', '🚗', '🏠', '💻', '📱', '✈️', '💍', '🎓', '🏖️'];
const GOAL_COLORS = ['#2563EB', '#16A34A', '#9333EA', '#EA580C', '#DC2626', '#0D9488'];

export default function SavingsGoalsScreen() {
  const db = useSQLiteContext();
  const activeCashbook = useCashbookStore((state) => state.activeCashbook);
  const cashbookId = activeCashbook?.id ?? 1;

  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [accounts, setAccounts] = useState<AccountWithCalculatedBalance[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);

  // New Goal Form
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('🎯');
  const [selectedColor, setSelectedColor] = useState('#2563EB');

  // Modal Setor / Tarik Tabungan
  const [activeGoal, setActiveGoal] = useState<SavingsGoal | null>(null);
  const [actionType, setActionType] = useState<'deposit' | 'withdraw'>('deposit');
  const [amountInput, setAmountInput] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [deductWallet, setDeductWallet] = useState(true);

  // Modal Konfirmasi Hapus Target
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string; current: number } | null>(null);

  const loadData = useCallback(async () => {
    const [list, accList] = await Promise.all([
      getSavingsGoals(db, cashbookId),
      getAccounts(db, cashbookId),
    ]);
    setGoals(list);
    setAccounts(accList);
    if (accList.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accList[0].id);
    }
  }, [db, cashbookId, selectedAccountId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  async function handleCreateGoal() {
    if (!name.trim()) {
      Alert.alert('Perhatian', 'Nama target impian wajib diisi');
      return;
    }

    const targetNum = parseFloat(targetAmount);
    if (!targetNum || targetNum <= 0) {
      Alert.alert('Perhatian', 'Masukkan nominal target tabungan yang valid');
      return;
    }

    const currentNum = currentAmount ? parseFloat(currentAmount) : 0;

    await addSavingsGoal(db, {
      cashbook_id: cashbookId,
      name: name.trim(),
      target_amount: targetNum,
      current_amount: currentNum,
      target_date: targetDate || null,
      icon: selectedEmoji,
      color: selectedColor,
    });

    setName('');
    setTargetAmount('');
    setCurrentAmount('');
    setTargetDate('');
    setShowAddForm(false);
    loadData();
  }

  function openActionModal(goal: SavingsGoal, type: 'deposit' | 'withdraw') {
    setActiveGoal(goal);
    setActionType(type);
    setAmountInput('');
    setDeductWallet(true);
    if (accounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accounts[0].id);
    }
  }

  async function handleConfirmAction() {
    if (!activeGoal) return;

    const num = parseFloat(amountInput);
    if (!num || num <= 0) {
      Alert.alert('Perhatian', 'Masukkan nominal yang valid');
      return;
    }

    if (actionType === 'withdraw' && num > activeGoal.current_amount) {
      Alert.alert('Perhatian', 'Nominal penarikan melebihi saldo tabungan saat ini');
      return;
    }

    await updateSavingsGoalDeposit(db, activeGoal.id, num, {
      accountId: deductWallet ? selectedAccountId : null,
      isWithdrawal: actionType === 'withdraw',
    });

    setActiveGoal(null);
    setAmountInput('');
    loadData();
  }

  function handleDeleteGoal(id: number, goalName: string, current: number) {
    setDeleteTarget({ id, name: goalName, current });
  }

  async function confirmDeleteGoal() {
    if (!deleteTarget) return;
    const { id } = deleteTarget;
    setDeleteTarget(null);
    await deleteSavingsGoal(db, id);
    loadData();
  }

  const totalSavedAll = goals.reduce((sum, g) => sum + g.current_amount, 0);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Target Tabungan (Impian)',
          headerStyle: { backgroundColor: '#FFFFFF' },
          headerTintColor: '#0F172A',
          headerTitleStyle: { fontFamily: FONTS.serifTitle, fontSize: 18, fontWeight: '800' },
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Banner Total Tabungan */}
        <View style={styles.summaryVaultCard}>
          <Text style={styles.vaultLabel}>Total Dana Terkunci di Tabungan</Text>
          <Text style={styles.vaultAmount}>{formatRupiah(totalSavedAll)}</Text>
          <Text style={styles.vaultSub}>Tersimpan di {goals.length} target impian</Text>
        </View>

        <View style={styles.headerRow}>
          <Text style={styles.sectionTitle}>Target Impian Saya ({goals.length})</Text>
          <Pressable
            style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.8 }]}
            onPress={() => setShowAddForm(!showAddForm)}
          >
            <Text style={styles.addBtnText}>{showAddForm ? '✕ Batal' : '+ Target Baru'}</Text>
          </Pressable>
        </View>

        {/* Add Goal Form */}
        {showAddForm && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Buat Target Tabungan Baru</Text>

            <Text style={styles.label}>Nama Impian / Target</Text>
            <TextInput
              style={styles.input}
              placeholder="Misal: Beli Laptop Baru, Liburan Bali, DP Motor"
              placeholderTextColor="#94A3B8"
              value={name}
              onChangeText={setName}
            />

            <Text style={styles.label}>Target Dana (Rp)</Text>
            <TextInput
              style={styles.input}
              placeholder="Misal: 15000000"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
              value={targetAmount}
              onChangeText={setTargetAmount}
            />

            <Text style={styles.label}>Terkumpul Saat Ini (Rp) - Opsional</Text>
            <TextInput
              style={styles.input}
              placeholder="0"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
              value={currentAmount}
              onChangeText={setCurrentAmount}
            />

            <Text style={styles.label}>Target Tercapai (YYYY-MM-DD) - Opsional</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#94A3B8"
              value={targetDate}
              onChangeText={setTargetDate}
            />

            <Text style={styles.label}>Pilih Ikon Emoji</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerRow}>
              {GOAL_EMOJIS.map((emoji) => (
                <Pressable
                  key={emoji}
                  style={[styles.emojiBtn, selectedEmoji === emoji && styles.emojiBtnSelected]}
                  onPress={() => setSelectedEmoji(emoji)}
                >
                  <Text style={styles.emojiText}>{emoji}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.label}>Pilih Warna Tema</Text>
            <View style={styles.colorRow}>
              {GOAL_COLORS.map((col) => (
                <Pressable
                  key={col}
                  style={[styles.colorDot, { backgroundColor: col }, selectedColor === col && styles.colorDotSelected]}
                  onPress={() => setSelectedColor(col)}
                />
              ))}
            </View>

            <Pressable
              style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.85 }]}
              onPress={handleCreateGoal}
            >
              <Text style={styles.saveBtnText}>Simpan Target Impian</Text>
            </Pressable>
          </View>
        )}

        {/* Form Modal Setor / Tarik Tabungan */}
        {activeGoal && (
          <View style={styles.depositBox}>
            <View style={styles.depositHeader}>
              <Text style={styles.depositTitle}>
                {actionType === 'deposit' ? '🎯 Setor ke Tabungan' : '💸 Tarik ke Dompet'}
              </Text>
              <Text style={styles.depositTargetName}>{activeGoal.name}</Text>
            </View>

            <Text style={styles.label}>Nominal (Rp)</Text>
            <TextInput
              style={styles.input}
              placeholder="Masukkan nominal"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
              value={amountInput}
              onChangeText={setAmountInput}
              autoFocus
            />

            {/* Toggle Potong / Hubungkan Saldo Dompet */}
            <View style={styles.walletToggleRow}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.walletToggleTitle}>
                  {actionType === 'deposit' ? 'Potong dari saldo dompet' : 'Kembalikan ke saldo dompet'}
                </Text>
                <Text style={styles.walletToggleDesc}>
                  {actionType === 'deposit'
                    ? 'Saldo rekening berkurang, tercatat di riwayat mutasi.'
                    : 'Saldo rekening bertambah kembali dari tabungan.'}
                </Text>
              </View>
              <Switch value={deductWallet} onValueChange={setDeductWallet} />
            </View>

            {deductWallet && accounts.length > 0 && (
              <View style={styles.accountSelectBlock}>
                <Text style={styles.label}>
                  {actionType === 'deposit' ? 'Pilih Dompet Sumber:' : 'Pilih Dompet Tujuan:'}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 4 }}>
                  {accounts.map((acc) => (
                    <Pressable
                      key={acc.id}
                      style={[
                        styles.accChip,
                        selectedAccountId === acc.id && styles.accChipActive,
                      ]}
                      onPress={() => setSelectedAccountId(acc.id)}
                    >
                      <Text style={styles.accChipText}>
                        {acc.icon} {acc.name} ({formatRupiah(acc.calculated_balance)})
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            <View style={styles.depositBtnRow}>
              <Pressable
                style={[styles.depositBtn, { backgroundColor: '#E2E8F0' }]}
                onPress={() => {
                  setActiveGoal(null);
                  setAmountInput('');
                }}
              >
                <Text style={{ fontFamily: FONTS.sansBold, fontWeight: '700', color: '#475569' }}>Batal</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.depositBtn,
                  { backgroundColor: actionType === 'deposit' ? PALETTE.primary : '#EA580C' },
                ]}
                onPress={handleConfirmAction}
              >
                <Text style={{ fontFamily: FONTS.sansBold, fontWeight: '700', color: '#FFFFFF' }}>
                  {actionType === 'deposit' ? 'Konfirmasi Setor' : 'Konfirmasi Tarik'}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Goals List */}
        {goals.length === 0 ? (
          <Text style={styles.emptyText}>Belum ada target impian yang dibuat. Mulai buat target sekarang!</Text>
        ) : (
          goals.map((g) => {
            const ratio = g.target_amount > 0 ? Math.min(g.current_amount / g.target_amount, 1) : 0;
            const percent = Math.round(ratio * 100);
            const isDone = g.is_achieved === 1 || g.current_amount >= g.target_amount;

            return (
              <View
                key={g.id}
                style={[styles.goalCard, { borderLeftColor: g.color }]}
              >
                <View style={styles.goalTop}>
                  <View style={styles.goalLeft}>
                    <Text style={styles.goalIcon}>{g.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text style={styles.goalName}>{g.name}</Text>
                        {isDone && (
                          <View style={styles.doneBadge}>
                            <Text style={styles.doneText}>TERCAPAI 🎉</Text>
                          </View>
                        )}
                      </View>
                      {g.target_date && (
                        <Text style={styles.goalDate}>Target: {formatDate(g.target_date)}</Text>
                      )}
                    </View>
                  </View>

                  <View style={styles.goalRightActions}>
                    <Text style={[styles.percentText, { color: isDone ? '#16A34A' : g.color }]}>{percent}%</Text>
                    <Pressable
                      hitSlop={8}
                      style={({ pressed }) => [styles.deleteGoalBtn, pressed && { opacity: 0.6 }]}
                      onPress={() => handleDeleteGoal(g.id, g.name, g.current_amount)}
                    >
                      <Text style={styles.deleteGoalText}>🗑️</Text>
                    </Pressable>
                  </View>
                </View>

                {/* Progress Bar */}
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${ratio * 100}%`, backgroundColor: g.color }]} />
                </View>

                <View style={styles.goalBottom}>
                  <View>
                    <Text style={styles.amountLabel}>Terkumpul</Text>
                    <Text style={styles.amountValue}>
                      {formatRupiah(g.current_amount)}{' '}
                      <Text style={styles.targetTotal}>/ {formatRupiah(g.target_amount)}</Text>
                    </Text>
                  </View>

                  <View style={styles.goalBtnGroup}>
                    {g.current_amount > 0 && (
                      <Pressable
                        style={({ pressed }) => [styles.btnWithdraw, pressed && { opacity: 0.8 }]}
                        onPress={() => openActionModal(g, 'withdraw')}
                      >
                        <Text style={styles.btnWithdrawText}>Tarik</Text>
                      </Pressable>
                    )}
                    {!isDone && (
                      <Pressable
                        style={({ pressed }) => [styles.btnDeposit, pressed && { opacity: 0.8 }]}
                        onPress={() => openActionModal(g, 'deposit')}
                      >
                        <Text style={styles.btnDepositText}>+ Setor</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Modern Confirm Modal Hapus Target Tabungan */}
      <ModernConfirmModal
        visible={!!deleteTarget}
        type="danger"
        icon="🗑️"
        title="Hapus Target Impian"
        message={`Hapus target "${deleteTarget?.name}"? ${
          (deleteTarget?.current ?? 0) > 0
            ? `Dana terkumpul ${formatRupiah(deleteTarget?.current ?? 0)} tetap aman tercatat di riwayat mutasi.`
            : ''
        }`}
        cancelText="Batal"
        confirmText="Ya, Hapus"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteGoal}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 20, paddingBottom: 40 },
  summaryVaultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...PALETTE.shadowLight,
  },
  vaultLabel: {
    fontFamily: FONTS.sansBold,
    fontSize: 11,
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  vaultAmount: {
    fontFamily: FONTS.serifTitle,
    fontSize: 26,
    fontWeight: '800',
    color: PALETTE.primary,
    marginVertical: 4,
  },
  vaultSub: {
    fontFamily: FONTS.sansMedium,
    fontSize: 11,
    color: '#94A3B8',
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontFamily: FONTS.serifTitle, fontSize: 16, fontWeight: '800', color: '#0F172A' },
  addBtn: {
    backgroundColor: '#EAF6F3',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  addBtnText: { fontFamily: FONTS.sansBold, fontSize: 12, fontWeight: '700', color: PALETTE.primary },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  formTitle: { fontFamily: FONTS.serifTitle, fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 10 },
  label: { fontFamily: FONTS.sansBold, fontSize: 12, fontWeight: '700', color: '#64748B', marginTop: 8, marginBottom: 6 },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: '#0F172A',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pickerRow: { flexDirection: 'row', marginBottom: 4 },
  emojiBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emojiBtnSelected: { backgroundColor: '#DBEAFE', borderColor: '#2563EB', borderWidth: 2 },
  emojiText: { fontSize: 20 },
  colorRow: { flexDirection: 'row', gap: 10, marginVertical: 4 },
  colorDot: { width: 32, height: 32, borderRadius: 16 },
  colorDotSelected: { borderWidth: 3, borderColor: '#0F172A' },
  saveBtn: {
    backgroundColor: PALETTE.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 14,
  },
  saveBtnText: { fontFamily: FONTS.sansBold, color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  depositBox: {
    backgroundColor: '#F0FDF4',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    ...PALETTE.shadowLight,
  },
  depositHeader: { marginBottom: 4 },
  depositTitle: { fontFamily: FONTS.serifTitle, fontSize: 15, fontWeight: '800', color: '#166534' },
  depositTargetName: { fontFamily: FONTS.sansMedium, fontSize: 12, color: '#15803D' },
  walletToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#DCFCE7',
  },
  walletToggleTitle: { fontFamily: FONTS.sansBold, fontSize: 12, fontWeight: '700', color: '#166534' },
  walletToggleDesc: { fontFamily: FONTS.sansRegular, fontSize: 10, color: '#15803D', marginTop: 1 },
  accountSelectBlock: { marginTop: 8 },
  accChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    marginRight: 8,
  },
  accChipActive: {
    backgroundColor: '#DCFCE7',
    borderColor: PALETTE.primary,
    borderWidth: 2,
  },
  accChipText: { fontFamily: FONTS.sansBold, fontSize: 11, color: '#166534', fontWeight: '700' },
  depositBtnRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  depositBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  emptyText: { textAlign: 'center', color: '#94A3B8', marginTop: 16 },
  goalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 5,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...PALETTE.shadowLight,
  },
  goalTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  goalLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  goalIcon: { fontSize: 24, marginRight: 10 },
  goalName: { fontFamily: FONTS.serifTitle, fontSize: 15, fontWeight: '700', color: '#0F172A' },
  doneBadge: { backgroundColor: '#DCFCE7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  doneText: { fontSize: 10, fontWeight: '800', color: '#16A34A' },
  goalDate: { fontFamily: FONTS.sansRegular, fontSize: 11, color: '#64748B', marginTop: 2 },
  goalRightActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  deleteGoalBtn: {
    padding: 4,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteGoalText: { fontSize: 12 },
  percentText: { fontFamily: FONTS.sansBold, fontSize: 16, fontWeight: '800' },
  progressBar: { height: 7, backgroundColor: '#E2E8F0', borderRadius: 4, overflow: 'hidden', marginBottom: 12 },
  progressFill: { height: '100%', borderRadius: 4 },
  goalBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  amountLabel: { fontFamily: FONTS.sansMedium, fontSize: 11, color: '#64748B' },
  amountValue: { fontFamily: FONTS.serifTitle, fontSize: 15, fontWeight: '800', color: '#0F172A', marginTop: 2 },
  targetTotal: { fontFamily: FONTS.sansRegular, fontSize: 11, color: '#94A3B8', fontWeight: '500' },
  goalBtnGroup: { flexDirection: 'row', gap: 6 },
  btnWithdraw: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  btnWithdrawText: { fontFamily: FONTS.sansBold, color: '#475569', fontSize: 12, fontWeight: '700' },
  btnDeposit: {
    backgroundColor: PALETTE.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  btnDepositText: { fontFamily: FONTS.sansBold, color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
});
