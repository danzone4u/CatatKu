import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Alert } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { useFocusEffect, Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { getAccounts, addAccount, deleteAccount, type AccountWithCalculatedBalance } from '../src/database/queries';
import { useCashbookStore } from '../src/stores/useCashbookStore';
import { useThemeStore } from '../src/stores/useThemeStore';
import AccountCard from '../src/components/AccountCard';
import EmptyState from '../src/components/EmptyState';
import { formatRupiah } from '../src/utils/currency';
import { FONTS } from '../src/constants/theme';
import { BackArrowIcon } from '../src/components/ActionIcons';
import { ModernConfirmModal } from '../src/components/ModernConfirmModal';

const EMOJIS = ['💵', '🏦', '📱', '💳', '🪙', '💰', '👛', '🏧'];
const COLORS = ['#16A34A', '#2563EB', '#9333EA', '#EA580C', '#0D9488', '#DC2626'];

export default function WalletsScreen() {
  const db = useSQLiteContext();
  const palette = useThemeStore((s) => s.palette);
  const isDarkMode = useThemeStore((s) => s.isDarkMode);
  const activeCashbook = useCashbookStore((state) => state.activeCashbook);
  const cashbookId = activeCashbook?.id ?? 1;

  const [accounts, setAccounts] = useState<AccountWithCalculatedBalance[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [warningModal, setWarningModal] = useState<{ visible: boolean; message: string }>({
    visible: false,
    message: '',
  });

  // Form New Account
  const [name, setName] = useState('');
  const [type, setType] = useState<'cash' | 'bank' | 'ewallet'>('bank');
  const [initialBalance, setInitialBalance] = useState('');
  const [minBalance, setMinBalance] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('🏦');
  const [selectedColor, setSelectedColor] = useState('#2563EB');

  useFocusEffect(
    useCallback(() => {
      loadAccounts();
    }, [cashbookId])
  );

  async function loadAccounts() {
    const list = await getAccounts(db, cashbookId);
    setAccounts(list);
  }

  const totalBalance = accounts.reduce((sum, a) => sum + a.calculated_balance, 0);

  async function handleCreateAccount() {
    if (!name.trim()) {
      setWarningModal({
        visible: true,
        message: 'Nama dompet / rekening wajib diisi.',
      });
      return;
    }

    const bal = initialBalance ? parseFloat(initialBalance) : 0;
    const minBal = minBalance ? parseFloat(minBalance) : 0;

    await addAccount(db, {
      cashbook_id: cashbookId,
      name: name.trim(),
      type,
      balance: bal,
      min_balance: minBal,
      icon: selectedIcon,
      color: selectedColor,
    });

    setName('');
    setInitialBalance('');
    setMinBalance('');
    setShowAddModal(false);
    loadAccounts();
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

  return (
    <View style={[styles.container, { backgroundColor: palette.canvas }]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      <Stack.Screen options={{ headerShown: false }} />

      {/* Top Header */}
      <View style={[styles.header, { backgroundColor: palette.card, borderBottomColor: palette.border }]}>
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
          onPress={() => setShowAddModal(!showAddModal)}
        >
          <Text style={styles.addTopBtnText}>{showAddModal ? 'Tutup' : '+ Akun'}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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

        {/* Add Account Form */}
        {showAddModal && (
          <View style={[styles.formCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={[styles.formTitle, { color: palette.ink }]}>Tambah Dompet / Rekening Baru</Text>

            <Text style={[styles.label, { color: palette.inkSecondary }]}>Nama Akun</Text>
            <TextInput
              style={[styles.input, { backgroundColor: palette.cardMuted, borderColor: palette.border, color: palette.ink }]}
              placeholder="Misal: BCA, Kasir Toko, OVO, GoPay"
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
                    { backgroundColor: palette.cardMuted, borderColor: palette.border },
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
                    {t === 'cash' ? 'Kas' : t === 'bank' ? 'Bank' : 'E-Wallet'}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: palette.inkSecondary }]}>Saldo Awal (Rp)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: palette.cardMuted, borderColor: palette.border, color: palette.ink }]}
                  placeholder="0"
                  placeholderTextColor={palette.inkMuted}
                  keyboardType="numeric"
                  value={initialBalance}
                  onChangeText={setInitialBalance}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: palette.inkSecondary }]}>Batas Saldo Minimum</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: palette.cardMuted, borderColor: palette.border, color: palette.ink }]}
                  placeholder="Contoh: 100000"
                  placeholderTextColor={palette.inkMuted}
                  keyboardType="numeric"
                  value={minBalance}
                  onChangeText={setMinBalance}
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
                    { backgroundColor: palette.cardMuted, borderColor: palette.border },
                    selectedIcon === e && { borderColor: palette.primary, backgroundColor: isDarkMode ? '#16313B' : '#EAF6F3' },
                  ]}
                  onPress={() => setSelectedIcon(e)}
                >
                  <Text style={styles.emojiText}>{e}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={[styles.label, { color: palette.inkSecondary }]}>Pilih Warna Aksen</Text>
            <View style={styles.colorRow}>
              {COLORS.map((c) => (
                <Pressable
                  key={c}
                  style={[styles.colorBtn, { backgroundColor: c }, selectedColor === c && styles.colorBtnSelected]}
                  onPress={() => setSelectedColor(c)}
                />
              ))}
            </View>

            <Pressable
              style={[styles.submitBtn, { backgroundColor: palette.primary }]}
              onPress={handleCreateAccount}
            >
              <Text style={styles.submitBtnText}>Simpan Akun</Text>
            </Pressable>
          </View>
        )}

        {/* Header List */}
        <View style={styles.listHeader}>
          <Text style={[styles.listTitle, { color: palette.ink }]}>Daftar Akun ({accounts.length})</Text>
        </View>

        {accounts.length === 0 ? (
          <EmptyState
            icon="🏦"
            title="Belum Ada Akun Dompet"
            subtitle="Tambahkan dompet kas, rekening bank, atau e-wallet"
            isDark={isDarkMode}
          />
        ) : (
          accounts.map((a) => (
            <AccountCard
              key={a.id}
              account={a}
              onPress={() => {}}
              onLongPress={() => handleDeleteAccount(a.id, a.name)}
              onDelete={() => handleDeleteAccount(a.id, a.name)}
            />
          ))
        )}
      </ScrollView>

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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
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
    paddingBottom: 40,
  },
  totalCard: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
  },
  totalLabel: {
    fontFamily: FONTS.sansMedium,
    fontSize: 12,
    fontWeight: '600',
  },
  totalAmount: {
    fontFamily: FONTS.sansBold,
    fontSize: 26,
    fontWeight: '900',
    marginTop: 4,
    letterSpacing: -0.5,
  },
  totalHint: {
    fontFamily: FONTS.sansRegular,
    fontSize: 12,
    marginTop: 4,
  },
  listHeader: {
    marginBottom: 12,
  },
  listTitle: {
    fontFamily: FONTS.serifTitle,
    fontSize: 16,
    fontWeight: '800',
  },
  formCard: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
  },
  formTitle: {
    fontFamily: FONTS.serifTitle,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 14,
  },
  label: {
    fontFamily: FONTS.sansMedium,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: FONTS.sansMedium,
    fontSize: 13,
    marginBottom: 12,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  typeBtnText: {
    fontFamily: FONTS.sansBold,
    fontSize: 12,
  },
  pickerRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  emojiBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    marginRight: 8,
  },
  emojiText: {
    fontSize: 20,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  colorBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  colorBtnSelected: {
    borderWidth: 3,
    borderColor: '#0F172A',
  },
  submitBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitBtnText: {
    fontFamily: FONTS.sansBold,
    fontSize: 13,
    color: '#FAF8F5',
  },
});
