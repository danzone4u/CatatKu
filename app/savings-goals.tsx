import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Switch,
  useWindowDimensions,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { useFocusEffect, Stack, router } from 'expo-router';
import {
  getSavingsGoals,
  addSavingsGoal,
  updateSavingsGoal,
  updateSavingsGoalDeposit,
  deleteSavingsGoal,
  getAccounts,
  type SavingsGoal,
  type AccountWithCalculatedBalance,
} from '../src/database/queries';
import { useCashbookStore } from '../src/stores/useCashbookStore';
import { useThemeStore } from '../src/stores/useThemeStore';
import { formatRupiah, formatNumberThousand, parseRupiahInput } from '../src/utils/currency';
import { formatDate } from '../src/utils/date';
import { FONTS } from '../src/constants/theme';
import { ModernConfirmModal, type ModalType } from '../src/components/ModernConfirmModal';
import { EditActionIcon, BackArrowIcon } from '../src/components/ActionIcons';
import DatePickerModal from '../src/components/DatePickerModal';

const GOAL_EMOJIS = [
  '🎯', '🛡️', '🛵', '🚗', '🏠', '💻', '📱', '✈️', '💍', '🎓', '🏖️', '👶', '🏥', '💎',
];

const GOAL_COLORS = [
  '#0F766E', '#16A34A', '#2563EB', '#9333EA', '#EA580C', '#DC2626',
  '#0284C7', '#E11D48', '#D97706', '#059669', '#4F46E5', '#334155',
];

export default function SavingsGoalsScreen() {
  const db = useSQLiteContext();
  const { width } = useWindowDimensions();
  const isTablet = width >= 600;
  const palette = useThemeStore((s) => s.palette);
  const isDarkMode = useThemeStore((s) => s.isDarkMode);
  const activeCashbook = useCashbookStore((state) => state.activeCashbook);
  const cashbookId = activeCashbook?.id ?? 1;

  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [accounts, setAccounts] = useState<AccountWithCalculatedBalance[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<number | null>(null);

  // New / Edit Goal Form
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('🎯');
  const [selectedColor, setSelectedColor] = useState('#0F766E');
  const [showDatePicker, setShowDatePicker] = useState(false);

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

  const openAddForm = () => {
    setEditingGoalId(null);
    setName('');
    setTargetAmount('');
    setCurrentAmount('');
    setTargetDate('');
    setSelectedEmoji('🎯');
    setSelectedColor('#0F766E');
    setShowForm(true);
  };

  const openEditForm = (g: SavingsGoal) => {
    setEditingGoalId(g.id);
    setName(g.name);
    setTargetAmount(formatNumberThousand(g.target_amount));
    setCurrentAmount(formatNumberThousand(g.current_amount));
    setTargetDate(g.target_date || '');
    setSelectedEmoji(g.icon || '🎯');
    setSelectedColor(g.color || '#0F766E');
    setShowForm(true);
  };

  const applyEmergencyPreset = () => {
    setName('Dana Darurat');
    setSelectedEmoji('🛡️');
    setSelectedColor('#E11D48');
  };

  async function handleSaveGoal() {
    if (!name.trim()) {
      showAlert('Perhatian', 'Nama target impian wajib diisi', 'warning');
      return;
    }

    const targetNum = parseRupiahInput(targetAmount);
    if (!targetNum || targetNum <= 0) {
      showAlert('Perhatian', 'Masukkan nominal target tabungan yang valid', 'warning');
      return;
    }

    const currentNum = parseRupiahInput(currentAmount);

    if (editingGoalId) {
      await updateSavingsGoal(db, editingGoalId, {
        name: name.trim(),
        target_amount: targetNum,
        target_date: targetDate || null,
        icon: selectedEmoji,
        color: selectedColor,
      });
    } else {
      await addSavingsGoal(db, {
        cashbook_id: cashbookId,
        name: name.trim(),
        target_amount: targetNum,
        current_amount: currentNum,
        target_date: targetDate || null,
        icon: selectedEmoji,
        color: selectedColor,
      });
    }

    setShowForm(false);
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

    const num = parseRupiahInput(amountInput);
    if (!num || num <= 0) {
      showAlert('Perhatian', 'Masukkan nominal yang valid', 'warning');
      return;
    }

    if (actionType === 'withdraw' && num > activeGoal.current_amount) {
      showAlert('Perhatian', 'Nominal penarikan melebihi saldo tabungan saat ini', 'warning');
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
              <Text style={[styles.headerTitle, { color: palette.ink }]}>Target Menabung</Text>
            </View>
          </View>

          <Pressable
            style={[styles.addTopBtn, { backgroundColor: palette.primary }]}
            onPress={openAddForm}
          >
            <Text style={styles.addTopBtnText}>+ Target</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          isTablet && { maxWidth: 840, width: '100%', alignSelf: 'center' },
          { flexGrow: 1 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Banner Total Tabungan */}
        <View style={[styles.summaryVaultCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.vaultLabel, { color: palette.inkMuted }]}>Total Dana Terkunci di Tabungan</Text>
          <Text style={[styles.vaultAmount, { color: palette.primary }]}>{formatRupiah(totalSavedAll)}</Text>
          <Text style={[styles.vaultSub, { color: palette.inkSecondary }]}>
            Tersimpan di {goals.length} target impian
          </Text>
        </View>

        {/* Add / Edit Goal Form */}
        {showForm && (
          <View style={[styles.formCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={styles.formHeaderRow}>
              <Text style={[styles.formTitle, { color: palette.ink }]}>
                {editingGoalId ? 'Edit Target Impian' : 'Buat Target Tabungan Baru'}
              </Text>
              <Pressable onPress={() => setShowForm(false)} hitSlop={8}>
                <Text style={[styles.closeFormText, { color: palette.inkMuted }]}>✕</Text>
              </Pressable>
            </View>

            {/* Tombol Preset Dana Darurat */}
            {!editingGoalId && (
              <Pressable
                style={({ pressed }) => [
                  styles.emergencyPresetBtn,
                  { backgroundColor: isDarkMode ? '#3B1219' : '#FFE4E6', borderColor: '#E11D48' },
                  pressed && { opacity: 0.8 },
                ]}
                onPress={applyEmergencyPreset}
              >
                <Text style={{ fontSize: 16 }}>🛡️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.emergencyPresetTitle, { color: '#E11D48' }]}>Pasang Preset "Dana Darurat"</Text>
                  <Text style={[styles.emergencyPresetDesc, { color: palette.inkMuted }]}>
                    Otomatis set nama, ikon perisai, dan warna proteksi
                  </Text>
                </View>
              </Pressable>
            )}

            <Text style={[styles.label, { color: palette.inkSecondary }]}>Nama Impian / Target</Text>
            <TextInput
              style={[styles.input, { backgroundColor: palette.cardMuted, borderColor: palette.border, color: palette.ink }]}
              placeholder="Misal: Dana Darurat, Beli Laptop, Liburan"
              placeholderTextColor={palette.inkMuted}
              value={name}
              onChangeText={setName}
            />

            <Text style={[styles.label, { color: palette.inkSecondary }]}>Target Dana (Rp)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: palette.cardMuted, borderColor: palette.border, color: palette.ink }]}
              placeholder="0"
              placeholderTextColor={palette.inkMuted}
              keyboardType="numeric"
              value={targetAmount}
              onChangeText={(text) => setTargetAmount(formatNumberThousand(text))}
            />

            {!editingGoalId && (
              <>
                <Text style={[styles.label, { color: palette.inkSecondary }]}>Terkumpul Saat Ini (Rp) - Opsional</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: palette.cardMuted, borderColor: palette.border, color: palette.ink }]}
                  placeholder="0"
                  placeholderTextColor={palette.inkMuted}
                  keyboardType="numeric"
                  value={currentAmount}
                  onChangeText={(text) => setCurrentAmount(formatNumberThousand(text))}
                />
              </>
            )}

            <Text style={[styles.label, { color: palette.inkSecondary }]}>Tenggat Waktu Target - Opsional</Text>
            <Pressable
              style={[styles.dateTrigger, { backgroundColor: palette.cardMuted, borderColor: palette.border }]}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={{ fontSize: 16 }}>📅</Text>
              <Text style={[styles.dateTriggerText, { color: palette.ink }]}>
                {targetDate ? formatDate(targetDate) : 'Pilih Tenggat Tanggal (Bebas)'}
              </Text>
              <Text style={[styles.dateChangeHint, { color: palette.primary }]}>
                {targetDate ? 'Ubah' : 'Pilih'}
              </Text>
            </Pressable>

            <Text style={[styles.label, { color: palette.inkSecondary }]}>Pilih Ikon Emoji</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerRow}>
              {GOAL_EMOJIS.map((emoji) => (
                <Pressable
                  key={emoji}
                  style={[
                    styles.emojiBtn,
                    { backgroundColor: palette.cardMuted, borderColor: palette.border },
                    selectedEmoji === emoji && { borderColor: palette.primary, backgroundColor: isDarkMode ? '#16313B' : '#EAF6F3' },
                  ]}
                  onPress={() => setSelectedEmoji(emoji)}
                >
                  <Text style={styles.emojiText}>{emoji}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={[styles.label, { color: palette.inkSecondary }]}>Pilih Warna Tema</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.colorRow}>
              {GOAL_COLORS.map((col) => (
                <Pressable
                  key={col}
                  style={[styles.colorDot, { backgroundColor: col }, selectedColor === col && styles.colorDotSelected]}
                  onPress={() => setSelectedColor(col)}
                />
              ))}
            </ScrollView>

            <View style={styles.formActionRow}>
              <Pressable
                style={[styles.cancelFormBtn, { borderColor: palette.border }]}
                onPress={() => setShowForm(false)}
              >
                <Text style={[styles.cancelFormBtnText, { color: palette.inkMuted }]}>Batal</Text>
              </Pressable>

              <Pressable
                style={[styles.saveBtn, { backgroundColor: palette.primary }]}
                onPress={handleSaveGoal}
              >
                <Text style={styles.saveBtnText}>
                  {editingGoalId ? 'Perbarui Target' : 'Simpan Target'}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Setor / Tarik Tabungan Block */}
        {activeGoal && (
          <View style={[styles.depositBox, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={styles.depositHeader}>
              <Text style={[styles.depositTitle, { color: palette.ink }]}>
                {actionType === 'deposit' ? '🎯 Setor ke Tabungan' : '💸 Tarik ke Dompet'}
              </Text>
              <Text style={[styles.depositTargetName, { color: palette.primary }]}>{activeGoal.name}</Text>
            </View>

            <Text style={[styles.label, { color: palette.inkSecondary }]}>Nominal (Rp)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: palette.cardMuted, borderColor: palette.border, color: palette.ink }]}
              placeholder="0"
              placeholderTextColor={palette.inkMuted}
              keyboardType="numeric"
              value={amountInput}
              onChangeText={(text) => setAmountInput(formatNumberThousand(text))}
              autoFocus
            />

            {/* Toggle Potong / Hubungkan Saldo Dompet */}
            <View style={[styles.walletToggleRow, { borderTopColor: palette.borderSubtle }]}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={[styles.walletToggleTitle, { color: palette.ink }]}>
                  {actionType === 'deposit' ? 'Potong dari saldo dompet' : 'Kembalikan ke saldo dompet'}
                </Text>
                <Text style={[styles.walletToggleDesc, { color: palette.inkMuted }]}>
                  {actionType === 'deposit'
                    ? 'Saldo rekening berkurang, tercatat di mutasi.'
                    : 'Saldo rekening bertambah kembali dari tabungan.'}
                </Text>
              </View>
              <Switch
                value={deductWallet}
                onValueChange={setDeductWallet}
                trackColor={{ false: palette.border, true: palette.primary }}
              />
            </View>

            {deductWallet && accounts.length > 0 && (
              <View style={styles.accountSelectBlock}>
                <Text style={[styles.label, { color: palette.inkSecondary }]}>
                  {actionType === 'deposit' ? 'Pilih Dompet Sumber:' : 'Pilih Dompet Tujuan:'}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 4 }}>
                  {accounts.map((acc) => (
                    <Pressable
                      key={acc.id}
                      style={[
                        styles.accChip,
                        { backgroundColor: palette.cardMuted, borderColor: palette.border },
                        selectedAccountId === acc.id && { borderColor: palette.primary, backgroundColor: isDarkMode ? '#16313B' : '#EAF6F3' },
                      ]}
                      onPress={() => setSelectedAccountId(acc.id)}
                    >
                      <Text style={[styles.accChipText, { color: palette.ink }]}>
                        {acc.icon} {acc.name} ({formatRupiah(acc.calculated_balance)})
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            <View style={styles.depositBtnRow}>
              <Pressable
                style={[styles.depositBtn, { backgroundColor: palette.cardMuted, borderColor: palette.border }]}
                onPress={() => {
                  setActiveGoal(null);
                  setAmountInput('');
                }}
              >
                <Text style={{ fontFamily: FONTS.sansBold, color: palette.inkMuted }}>Batal</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.depositBtn,
                  { backgroundColor: actionType === 'deposit' ? palette.primary : '#EA580C' },
                ]}
                onPress={handleConfirmAction}
              >
                <Text style={{ fontFamily: FONTS.sansBold, color: '#FFFFFF' }}>
                  {actionType === 'deposit' ? 'Konfirmasi Setor' : 'Konfirmasi Tarik'}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Goals List Header */}
        <View style={styles.headerRow}>
          <Text style={[styles.sectionTitle, { color: palette.ink }]}>Target Impian Saya ({goals.length})</Text>
        </View>

        {goals.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>🎯</Text>
            <Text style={[styles.emptyTitle, { color: palette.ink }]}>Belum Ada Target</Text>
            <Text style={[styles.emptySub, { color: palette.inkMuted }]}>
              Mulai buat target impian atau alokasi pos dana darurat sekarang!
            </Text>
          </View>
        ) : (
          goals.map((g) => {
            const ratio = g.target_amount > 0 ? Math.min(g.current_amount / g.target_amount, 1) : 0;
            const percent = Math.round(ratio * 100);
            const isDone = g.is_achieved === 1 || g.current_amount >= g.target_amount;

            return (
              <View
                key={g.id}
                style={[
                  styles.goalCard,
                  { backgroundColor: palette.card, borderColor: palette.border, borderLeftColor: g.color },
                ]}
              >
                <View style={styles.goalTop}>
                  <View style={styles.goalLeft}>
                    <Text style={styles.goalIcon}>{g.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text style={[styles.goalName, { color: palette.ink }]}>{g.name}</Text>
                        {isDone && (
                          <View style={styles.doneBadge}>
                            <Text style={styles.doneText}>TERCAPAI 🎉</Text>
                          </View>
                        )}
                      </View>
                      {g.target_date && (
                        <Text style={[styles.goalDate, { color: palette.inkMuted }]}>
                          Target: {formatDate(g.target_date)}
                        </Text>
                      )}
                    </View>
                  </View>

                  <View style={styles.goalRightActions}>
                    <Text style={[styles.percentText, { color: isDone ? palette.primary : g.color }]}>
                      {percent}%
                    </Text>
                    <Pressable
                      hitSlop={8}
                      style={({ pressed }) => [styles.actionSmallBtn, { backgroundColor: palette.cardMuted }, pressed && { opacity: 0.6 }]}
                      onPress={() => openEditForm(g)}
                    >
                      <EditActionIcon color={palette.primary} size={15} />
                    </Pressable>
                    <Pressable
                      hitSlop={8}
                      style={({ pressed }) => [styles.actionSmallBtn, { backgroundColor: palette.cardMuted }, pressed && { opacity: 0.6 }]}
                      onPress={() => handleDeleteGoal(g.id, g.name, g.current_amount)}
                    >
                      <Text style={{ fontSize: 13 }}>🗑️</Text>
                    </Pressable>
                  </View>
                </View>

                {/* Progress Bar */}
                <View style={[styles.progressBar, { backgroundColor: palette.cardMuted }]}>
                  <View style={[styles.progressFill, { width: `${ratio * 100}%`, backgroundColor: g.color }]} />
                </View>

                <View style={styles.goalBottom}>
                  <View>
                    <Text style={[styles.amountLabel, { color: palette.inkMuted }]}>Terkumpul</Text>
                    <Text style={[styles.amountValue, { color: palette.ink }]}>
                      {formatRupiah(g.current_amount)}{' '}
                      <Text style={[styles.targetTotal, { color: palette.inkMuted }]}>
                        / {formatRupiah(g.target_amount)}
                      </Text>
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
                        style={({ pressed }) => [styles.btnDeposit, { backgroundColor: palette.primary }, pressed && { opacity: 0.8 }]}
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

        {/* Footer Copyright */}
        <View style={styles.footerWrap}>
          <Text style={[styles.footerText, { color: palette.inkMuted }]}>© 2026 CatatKu</Text>
        </View>
      </ScrollView>

      {/* DatePicker Visual Modal */}
      <DatePickerModal
        visible={showDatePicker}
        value={targetDate || new Date().toISOString().slice(0, 10)}
        onSelect={(newDateStr) => {
          setTargetDate(newDateStr.split(' ')[0]);
        }}
        onClose={() => setShowDatePicker(false)}
      />

      {/* Modern Confirm Modal Hapus */}
      <ModernConfirmModal
        visible={!!deleteTarget}
        type="danger"
        icon="🗑️"
        title="Hapus Target Impian"
        message={`Hapus target "${deleteTarget?.name}"? ${
          (deleteTarget?.current ?? 0) > 0
            ? `Dana terkumpul ${formatRupiah(deleteTarget?.current ?? 0)} tetap aman tercatat di mutasi.`
            : ''
        }`}
        cancelText="Batal"
        confirmText="Ya, Hapus"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteGoal}
      />

      {/* Modern Alert Modal */}
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
  content: {
    padding: 16,
    gap: 12,
  },
  summaryVaultCard: {
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 4,
  },
  vaultLabel: {
    fontFamily: FONTS.sansMedium,
    fontSize: 12,
    marginBottom: 4,
  },
  vaultAmount: {
    fontFamily: FONTS.sansBold,
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 4,
  },
  vaultSub: {
    fontFamily: FONTS.sansRegular,
    fontSize: 12,
  },
  headerRow: {
    marginTop: 8,
    marginBottom: 2,
  },
  sectionTitle: {
    fontFamily: FONTS.serifTitle,
    fontSize: 16,
    fontWeight: '800',
  },
  formCard: {
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 10,
  },
  formHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  formTitle: {
    fontFamily: FONTS.serifTitle,
    fontSize: 16,
    fontWeight: '800',
  },
  closeFormText: {
    fontSize: 16,
    fontFamily: FONTS.sansBold,
    padding: 4,
  },
  emergencyPresetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  emergencyPresetTitle: {
    fontFamily: FONTS.sansBold,
    fontSize: 12,
  },
  emergencyPresetDesc: {
    fontFamily: FONTS.sansRegular,
    fontSize: 11,
    marginTop: 1,
  },
  label: {
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
  pickerRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  emojiBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  emojiText: { fontSize: 20 },
  colorRow: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  colorDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  colorDotSelected: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.15 }],
  },
  formActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  cancelFormBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelFormBtnText: {
    fontFamily: FONTS.sansBold,
    fontSize: 13,
  },
  saveBtn: {
    flex: 2,
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtnText: {
    fontFamily: FONTS.sansBold,
    fontSize: 14,
    color: '#FAF8F5',
  },
  depositBox: {
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 10,
  },
  depositHeader: {
    marginBottom: 8,
  },
  depositTitle: {
    fontFamily: FONTS.serifTitle,
    fontSize: 16,
    fontWeight: '800',
  },
  depositTargetName: {
    fontFamily: FONTS.sansBold,
    fontSize: 13,
    marginTop: 2,
  },
  walletToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    marginTop: 10,
  },
  walletToggleTitle: {
    fontFamily: FONTS.sansBold,
    fontSize: 12,
  },
  walletToggleDesc: {
    fontFamily: FONTS.sansRegular,
    fontSize: 11,
    marginTop: 2,
  },
  accountSelectBlock: {
    marginBottom: 10,
  },
  accChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginRight: 8,
  },
  accChipText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 12,
  },
  depositBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  depositBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  goalCard: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderLeftWidth: 5,
  },
  goalTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  goalLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  goalIcon: { fontSize: 28 },
  goalName: {
    fontFamily: FONTS.sansBold,
    fontSize: 15,
  },
  doneBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  doneText: {
    fontFamily: FONTS.sansBold,
    fontSize: 9,
    color: '#16A34A',
  },
  goalDate: {
    fontFamily: FONTS.sansRegular,
    fontSize: 11,
    marginTop: 2,
  },
  goalRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  percentText: {
    fontFamily: FONTS.sansBold,
    fontSize: 14,
    marginRight: 4,
  },
  actionSmallBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  goalBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amountLabel: {
    fontFamily: FONTS.sansMedium,
    fontSize: 11,
  },
  amountValue: {
    fontFamily: FONTS.sansBold,
    fontSize: 14,
  },
  targetTotal: {
    fontFamily: FONTS.sansRegular,
    fontSize: 11,
  },
  goalBtnGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  btnWithdraw: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  btnWithdrawText: {
    fontFamily: FONTS.sansBold,
    fontSize: 11,
    color: '#475569',
  },
  btnDeposit: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  btnDepositText: {
    fontFamily: FONTS.sansBold,
    fontSize: 11,
    color: '#FAF8F5',
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyIcon: { fontSize: 44, marginBottom: 8 },
  emptyTitle: {
    fontFamily: FONTS.serifTitle,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  emptySub: {
    fontFamily: FONTS.sansRegular,
    fontSize: 13,
    textAlign: 'center',
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
