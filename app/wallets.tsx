import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, useWindowDimensions, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { useFocusEffect, Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  getAccounts,
  addAccount,
  updateAccount,
  deleteAccount,
  setDefaultAccount,
  updateAccountOrder,
  addTransaction,
  type AccountWithCalculatedBalance,
} from '../src/database/queries';
import { useCashbookStore } from '../src/stores/useCashbookStore';
import { useThemeStore } from '../src/stores/useThemeStore';
import AccountCard from '../src/components/AccountCard';
import EmptyState from '../src/components/EmptyState';
import { formatRupiah, formatNumberThousand, parseRupiahInput } from '../src/utils/currency';
import { getNowFull } from '../src/utils/date';
import { FONTS } from '../src/constants/theme';
import { BackArrowIcon } from '../src/components/ActionIcons';
import { ModernConfirmModal } from '../src/components/ModernConfirmModal';
import { FINANCIAL_PRESETS, BankBadge } from '../src/components/BankBadges';

const EMOJIS = [
  '💵', '🏦', '📱', '💳', '🪙', '💰', '👛', '🏧',
  '📈', '📉', '💼', '💎', '🛡️', '📦', '🏠', '🏢',
  '🚗', '🛵', '⛽', '✈️', '🛍️', '🛒', '🍔', '☕',
  '💻', '📶', '👶', '🐾', '🎓', '📚', '🏥', '💊',
  '🎁', '💍', '🏝️', '🔑', '🏷️', '🧾', '🔧', '⭐',
];

const COLORS = [
  '#0F766E', '#16A34A', '#2563EB', '#9333EA', '#EA580C', '#DC2626',
  '#0284C7', '#4F46E5', '#7C3AED', '#DB2777', '#E11D48', '#D97706',
  '#65A30D', '#059669', '#0891B2', '#475569', '#1E293B', '#334155',
];

export default function WalletsScreen() {
  const db = useSQLiteContext();
  const { width } = useWindowDimensions();
  const isTablet = width >= 600;
  const palette = useThemeStore((s) => s.palette);
  const isDarkMode = useThemeStore((s) => s.isDarkMode);
  const activeCashbook = useCashbookStore((state) => state.activeCashbook);
  const cashbookId = activeCashbook?.id ?? 1;

  const [accounts, setAccounts] = useState<AccountWithCalculatedBalance[]>([]);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<number | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [warningModal, setWarningModal] = useState<{ visible: boolean; message: string }>({
    visible: false,
    message: '',
  });
  const [successModal, setSuccessModal] = useState<{ visible: boolean; message: string }>({
    visible: false,
    message: '',
  });

  // Form Account State
  const [name, setName] = useState('');
  const [type, setType] = useState<'cash' | 'bank' | 'ewallet'>('cash');
  const [initialBalance, setInitialBalance] = useState('');
  const [minBalance, setMinBalance] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('💵');
  const [selectedColor, setSelectedColor] = useState(palette.primary);

  const loadAccounts = useCallback(async () => {
    const list = await getAccounts(db, cashbookId);
    setAccounts(list);
  }, [db, cashbookId]);

  useFocusEffect(
    useCallback(() => {
      loadAccounts();
    }, [loadAccounts])
  );

  const totalBalance = accounts.reduce((sum, a) => sum + a.calculated_balance, 0);

  const openAddModal = () => {
    setEditingAccountId(null);
    setName('');
    setType('cash');
    setInitialBalance('');
    setMinBalance('');
    setSelectedIcon('💵');
    setSelectedColor(palette.primary);
    setShowFormModal(true);
  };

  const openEditModal = (acc: AccountWithCalculatedBalance) => {
    setEditingAccountId(acc.id);
    setName(acc.name);
    setType(acc.type);
    setInitialBalance(formatNumberThousand(acc.calculated_balance));
    setMinBalance(acc.min_balance ? formatNumberThousand(acc.min_balance) : '');
    setSelectedIcon(acc.icon || '💵');
    setSelectedColor(acc.color || palette.primary);
    setShowFormModal(true);
  };

  const applyPreset = (preset: typeof FINANCIAL_PRESETS[0]) => {
    setName(preset.name);
    setType(preset.type);
    setSelectedIcon(preset.icon);
    setSelectedColor(preset.color);
  };

  async function handleSaveAccount() {
    if (!name.trim()) {
      setWarningModal({
        visible: true,
        message: 'Nama dompet / rekening wajib diisi.',
      });
      return;
    }

    const bal = parseRupiahInput(initialBalance);
    const minBal = parseRupiahInput(minBalance);
    const savedName = name.trim();
    const isEdit = !!editingAccountId;

    try {
      if (editingAccountId) {
        const existingAcc = accounts.find((a) => a.id === editingAccountId);
        
        // Audit Trail Akuntansi: Jika saldo diubah manual, catat mutasi penyesuaian kas
        if (existingAcc) {
          const diff = bal - existingAcc.calculated_balance;
          if (diff !== 0) {
            // Dapatkan kategori untuk rekonsiliasi
            let reconCat = await db.getFirstAsync<{ id: number }>(
              "SELECT id FROM categories WHERE name = 'Penyesuaian Saldo' OR name = 'Lainnya' LIMIT 1"
            );
            if (!reconCat) {
              const newCat = await db.runAsync(
                "INSERT INTO categories (name, icon, is_default) VALUES ('Penyesuaian Saldo', '⚖️', 0)"
              );
              reconCat = { id: newCat.lastInsertRowId };
            }

            const isSurplus = diff > 0;
            await addTransaction(db, {
              cashbook_id: cashbookId,
              account_id: editingAccountId,
              type: isSurplus ? 'income' : 'expense',
              amount: Math.abs(diff),
              category_id: reconCat.id,
              note: `Penyesuaian Saldo Kas ${savedName} (${isSurplus ? 'Koreksi Lebih' : 'Koreksi Kurang'})`,
              date: getNowFull(),
            });
          }
        }

        await updateAccount(db, editingAccountId, {
          name: savedName,
          type,
          balance: existingAcc ? existingAcc.balance : bal,
          min_balance: minBal,
          icon: selectedIcon,
          color: selectedColor,
        });
      } else {
        await addAccount(db, {
          cashbook_id: cashbookId,
          name: savedName,
          type,
          balance: bal,
          min_balance: minBal,
          icon: selectedIcon,
          color: selectedColor,
        });
      }

      setShowFormModal(false);
      await loadAccounts();

      setSuccessModal({
        visible: true,
        message: isEdit
          ? `Data dompet "${savedName}" berhasil diperbarui!`
          : `Dompet "${savedName}" berhasil disimpan!`,
      });
    } catch (err) {
      setWarningModal({
        visible: true,
        message: 'Gagal menyimpan dompet: ' + String(err),
      });
    }
  }

  function handleDeleteAccount(id: number, accName: string) {
    if (accounts.length <= 1) {
      setWarningModal({
        visible: true,
        message: 'Tidak dapat menghapus dompet. Minimal harus tersisa 1 dompet / rekening aktif pada buku ini.',
      });
      return;
    }
    setDeleteTarget({ id, name: accName });
  }

  async function confirmDeleteAccount() {
    if (!deleteTarget) return;
    const { id } = deleteTarget;
    setDeleteTarget(null);
    await deleteAccount(db, id);
    loadAccounts();
  }

  async function handleSetDefault(accId: number) {
    await setDefaultAccount(db, cashbookId, accId);
    loadAccounts();
  }

  async function handleMoveUp(index: number) {
    if (index <= 0) return;
    const nextList = [...accounts];
    const temp = nextList[index];
    nextList[index] = nextList[index - 1];
    nextList[index - 1] = temp;
    setAccounts(nextList);
    await updateAccountOrder(db, nextList.map((a) => a.id));
    loadAccounts();
  }

  async function handleMoveDown(index: number) {
    if (index >= accounts.length - 1) return;
    const nextList = [...accounts];
    const temp = nextList[index];
    nextList[index] = nextList[index + 1];
    nextList[index + 1] = temp;
    setAccounts(nextList);
    await updateAccountOrder(db, nextList.map((a) => a.id));
    loadAccounts();
  }

  return (
    <View style={[styles.container, { backgroundColor: palette.canvas }]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      <Stack.Screen options={{ headerShown: false }} />

      {/* Top Header */}
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
              <Text style={[styles.headerTitle, { color: palette.ink }]}>Dompet & Rekening</Text>
            </View>
          </View>

          <Pressable
            style={[styles.addTopBtn, { backgroundColor: palette.primary }]}
            onPress={openAddModal}
          >
            <Text style={styles.addTopBtnText}>+ Akun</Text>
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
        {/* Total Saldo Card */}
        <View style={[styles.totalCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.totalLabel, { color: palette.inkMuted }]}>Total Saldo Seluruh Dompet</Text>
          <Text
            style={[
              styles.totalAmount,
              { color: totalBalance >= 0 ? palette.ink : palette.expense },
            ]}
          >
            {formatRupiah(totalBalance)}
          </Text>
          <Text style={[styles.totalHint, { color: palette.inkSecondary }]}>
            Tercatat di {activeCashbook?.name}
          </Text>
        </View>

        {/* Header List */}
        <View style={styles.listHeader}>
          <Text style={[styles.listTitle, { color: palette.ink }]}>Daftar Akun ({accounts.length})</Text>
        </View>

        {accounts.length === 0 ? (
          <EmptyState
            icon="🏦"
            title="Belum Ada Akun Dompet"
            subtitle="Tambahkan dompet tunai, rekening bank, atau e-wallet"
            isDark={isDarkMode}
          />
        ) : (
          accounts.map((a, idx) => (
            <AccountCard
              key={a.id}
              account={a}
              onPress={() => openEditModal(a)}
              onEdit={() => openEditModal(a)}
              onLongPress={() => handleDeleteAccount(a.id, a.name)}
              onDelete={() => handleDeleteAccount(a.id, a.name)}
              onSetDefault={() => handleSetDefault(a.id)}
              onMoveUp={() => handleMoveUp(idx)}
              onMoveDown={() => handleMoveDown(idx)}
              canMoveUp={idx > 0}
              canMoveDown={idx < accounts.length - 1}
            />
          ))
        )}
      </ScrollView>

      {/* Modal Tambah / Edit Dompet */}
      <Modal
        visible={showFormModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFormModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View
            style={[
              styles.formModalCard,
              {
                backgroundColor: palette.card,
                borderColor: palette.border,
              },
            ]}
          >
            <View style={styles.formHeaderRow}>
              <Text style={[styles.formTitle, { color: palette.ink }]}>
                {editingAccountId ? 'Edit Dompet / Rekening' : 'Tambah Dompet / Rekening Baru'}
              </Text>
              <Pressable onPress={() => setShowFormModal(false)} hitSlop={8}>
                <Text style={[styles.closeFormText, { color: palette.inkMuted }]}>✕</Text>
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 8 }}
            >
              {/* Rekomendasi / Preset Cepat Bank & E-Wallet */}
              {!editingAccountId && (
                <View style={styles.presetSection}>
                  <Text style={[styles.presetSectionTitle, { color: palette.inkMuted }]}>
                    Pilih Cepat Bank / E-Wallet / Dana Darurat
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetScroll}>
                    {FINANCIAL_PRESETS.map((p) => (
                      <Pressable
                        key={p.key}
                        style={({ pressed }) => [
                          styles.presetChip,
                          {
                            backgroundColor: palette.cardMuted,
                            borderColor: p.isEmergency ? '#E11D48' : palette.border,
                          },
                          pressed && { opacity: 0.75 },
                        ]}
                        onPress={() => applyPreset(p)}
                      >
                        <Text style={{ fontSize: 13 }}>{p.icon}</Text>
                        <BankBadge badgeText={p.badgeText} color={p.color} size="small" />
                        <Text style={[styles.presetChipText, { color: palette.ink }]}>{p.name}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}

              <Text style={[styles.label, { color: palette.inkSecondary }]}>Nama Akun</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: palette.cardMuted,
                    borderColor: palette.border,
                    color: palette.ink,
                  },
                ]}
                placeholder="Misal: BCA, Kasir Toko, OVO, Dana Darurat"
                placeholderTextColor={palette.inkMuted}
                value={name}
                onChangeText={setName}
              />

              <Text style={[styles.label, { color: palette.inkSecondary }]}>Tipe Akun</Text>
              <View style={styles.typeRow}>
                {(['cash', 'bank', 'ewallet'] as const).map((t) => (
                  <Pressable
                    key={t}
                    style={[
                      styles.typeBtn,
                      {
                        backgroundColor: palette.cardMuted,
                        borderColor: palette.border,
                      },
                      type === t && { backgroundColor: palette.primary, borderColor: palette.primary },
                    ]}
                    onPress={() => {
                      setType(t);
                      if (t === 'cash') setSelectedIcon('💵');
                      if (t === 'bank') setSelectedIcon('🏦');
                      if (t === 'ewallet') setSelectedIcon('📱');
                    }}
                  >
                    <Text
                      style={[
                        styles.typeBtnText,
                        { color: palette.inkSecondary },
                        type === t && { color: '#FFFFFF', fontWeight: '800' },
                      ]}
                    >
                      {t === 'cash' ? 'Tunai' : t === 'bank' ? 'Bank' : 'E-Wallet'}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: palette.inkSecondary }]}>
                    {editingAccountId ? 'Saldo Saat Ini (Rp)' : 'Saldo Awal (Rp)'}
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: palette.cardMuted,
                        borderColor: palette.border,
                        color: palette.ink,
                      },
                    ]}
                    placeholder="0"
                    placeholderTextColor={palette.inkMuted}
                    keyboardType="numeric"
                    value={initialBalance}
                    onChangeText={(text) => setInitialBalance(formatNumberThousand(text))}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: palette.inkSecondary }]}>Batas Saldo Minimum</Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: palette.cardMuted,
                        borderColor: palette.border,
                        color: palette.ink,
                      },
                    ]}
                    placeholder="Contoh: 100.000"
                    placeholderTextColor={palette.inkMuted}
                    keyboardType="numeric"
                    value={minBalance}
                    onChangeText={(text) => setMinBalance(formatNumberThousand(text))}
                  />
                </View>
              </View>

              <Text style={[styles.label, { color: palette.inkSecondary }]}>Pilih Ikon</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerRow}>
                {EMOJIS.map((e) => (
                  <Pressable
                    key={e}
                    style={[
                      styles.emojiBtn,
                      {
                        backgroundColor: palette.cardMuted,
                        borderColor: palette.border,
                      },
                      selectedIcon === e && {
                        borderColor: palette.primary,
                        backgroundColor: isDarkMode ? '#16313B' : '#EAF6F3',
                      },
                    ]}
                    onPress={() => setSelectedIcon(e)}
                  >
                    <Text style={styles.emojiText}>{e}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              <Text style={[styles.label, { color: palette.inkSecondary }]}>Pilih Warna Aksen</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.colorScroll}>
                {COLORS.map((c) => (
                  <Pressable
                    key={c}
                    style={[styles.colorBtn, { backgroundColor: c }, selectedColor === c && styles.colorBtnSelected]}
                    onPress={() => setSelectedColor(c)}
                  />
                ))}
              </ScrollView>

              <View style={styles.formActionRow}>
                <Pressable
                  style={[
                    styles.cancelFormBtn,
                    {
                      backgroundColor: palette.cardMuted,
                      borderColor: palette.border,
                    },
                  ]}
                  onPress={() => setShowFormModal(false)}
                >
                  <Text style={[styles.cancelFormBtnText, { color: palette.inkMuted }]}>Batal</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.submitBtn,
                    { backgroundColor: palette.primary },
                    pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                  ]}
                  onPress={handleSaveAccount}
                >
                  <Text style={styles.submitBtnText}>
                    {editingAccountId ? 'Perbarui Dompet' : 'Simpan Akun'}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal Konfirmasi Sukses */}
      <ModernConfirmModal
        visible={successModal.visible}
        type="success"
        icon="✅"
        title="Berhasil Disimpan"
        message={successModal.message}
        cancelText=""
        confirmText="Oke"
        onCancel={() => setSuccessModal({ visible: false, message: '' })}
        onConfirm={() => setSuccessModal({ visible: false, message: '' })}
      />

      <ModernConfirmModal
        visible={!!deleteTarget}
        type="danger"
        icon="🗑️"
        title="Hapus Dompet"
        message={`Hapus dompet / rekening "${deleteTarget?.name}"? Transaksi yang berkaitan tetap aman.`}
        cancelText="Batal"
        confirmText="Ya, Hapus"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteAccount}
      />

      <ModernConfirmModal
        visible={warningModal.visible}
        type="warning"
        icon="⚠️"
        title="Perhatian"
        message={warningModal.message}
        cancelText=""
        confirmText="Mengerti"
        onCancel={() => setWarningModal({ visible: false, message: '' })}
        onConfirm={() => setWarningModal({ visible: false, message: '' })}
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
  totalCard: {
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 4,
  },
  totalLabel: {
    fontFamily: FONTS.sansMedium,
    fontSize: 12,
    marginBottom: 4,
  },
  totalAmount: {
    fontFamily: FONTS.sansBold,
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 4,
  },
  totalHint: {
    fontFamily: FONTS.sansRegular,
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  formModalCard: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '88%',
    padding: 20,
    borderRadius: 22,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  formHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  formTitle: {
    fontFamily: FONTS.serifTitle,
    fontSize: 17,
    fontWeight: '800',
  },
  closeFormText: {
    fontSize: 16,
    fontFamily: FONTS.sansBold,
    padding: 4,
  },
  presetSection: {
    marginBottom: 14,
  },
  presetSectionTitle: {
    fontFamily: FONTS.sansBold,
    fontSize: 11,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  presetScroll: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    marginRight: 8,
  },
  presetChipText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 11,
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
  typeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  typeBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeBtnText: {
    fontFamily: FONTS.sansBold,
    fontSize: 12,
  },
  pickerRow: {
    flexDirection: 'row',
    marginBottom: 4,
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
  emojiText: {
    fontSize: 20,
  },
  colorScroll: {
    flexDirection: 'row',
    marginBottom: 16,
    marginTop: 4,
  },
  colorBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    marginRight: 8,
  },
  colorBtnSelected: {
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
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelFormBtnText: {
    fontFamily: FONTS.sansBold,
    fontSize: 13,
  },
  submitBtn: {
    flex: 2,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0F766E',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  submitBtnText: {
    fontFamily: FONTS.sansBold,
    fontSize: 14,
    color: '#FAF8F5',
  },
  listHeader: {
    marginTop: 10,
    marginBottom: 4,
  },
  listTitle: {
    fontFamily: FONTS.serifTitle,
    fontSize: 16,
    fontWeight: '800',
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
