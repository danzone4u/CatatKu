import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  Image,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useState, useCallback } from 'react';
import { router, Stack, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import {
  getCategories,
  addTransaction,
  updateTransaction,
  voidTransaction,
  getAccounts,
  type Category,
  type AccountWithCalculatedBalance,
} from '../src/database/queries';
import { useCashbookStore } from '../src/stores/useCashbookStore';
import { useThemeStore } from '../src/stores/useThemeStore';
import { getNowFull, formatDate } from '../src/utils/date';
import { FONTS } from '../src/constants/theme';
import { formatNumberThousand, parseRupiahInput } from '../src/utils/currency';
import DatePickerModal from '../src/components/DatePickerModal';
import { ModernConfirmModal, type ModalType } from '../src/components/ModernConfirmModal';

interface QuickTemplate {
  label: string;
  amount: number;
  note: string;
  categoryName: string;
  type: 'expense' | 'income';
}

const QUICK_TEMPLATES: QuickTemplate[] = [
  { label: '☕ Kopi', amount: 15000, note: 'Kopi / Minuman', categoryName: 'Makanan & Minuman', type: 'expense' },
  { label: '🍛 Makan Siang', amount: 25000, note: 'Makan Siang', categoryName: 'Makanan & Minuman', type: 'expense' },
  { label: '⛽ Bensin Motor', amount: 30000, note: 'Isi Bensin', categoryName: 'Transportasi', type: 'expense' },
  { label: '🛒 Belanja Harian', amount: 50000, note: 'Kebutuhan Harian', categoryName: 'Belanja', type: 'expense' },
  { label: '💰 Gaji / Bonus', amount: 1000000, note: 'Bonus / Penghasilan', categoryName: 'Gaji', type: 'income' },
];

export default function AddTransactionScreen() {
  const db = useSQLiteContext();
  const palette = useThemeStore((s) => s.palette);
  const isDarkMode = useThemeStore((s) => s.isDarkMode);
  const activeCashbook = useCashbookStore((state) => state.activeCashbook);
  const params = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!params.id;

  const cashbookId = activeCashbook?.id ?? 1;

  const [accounts, setAccounts] = useState<AccountWithCalculatedBalance[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);

  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(getNowFull());
  const [categories, setCategories] = useState<Category[]>([]);
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [isVoided, setIsVoided] = useState(false);
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);

  // Modal states
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [viewReceiptFullscreen, setViewReceiptFullscreen] = useState(false);

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
  const [showDatePicker, setShowDatePicker] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      async function init() {
        const [cats, accs] = await Promise.all([
          getCategories(db),
          getAccounts(db, cashbookId),
        ]);
        if (!isMounted) return;
        setCategories(cats);
        setAccounts(accs);
        if (!isEdit && cats.length > 0 && !categoryId) {
          setCategoryId(cats[0]!.id);
        }
        if (accs.length > 0 && !selectedAccountId) {
          setSelectedAccountId(accs[0].id);
        }
        if (isEdit) {
          const row = await db.getFirstAsync<{
            id: number;
            cashbook_id: number;
            account_id: number | null;
            type: string;
            amount: number;
            category_id: number;
            note: string;
            date: string;
            receipt_image_uri?: string | null;
            is_void?: number;
          }>('SELECT * FROM transactions WHERE id = ?', parseInt(params.id!, 10));
          if (row && isMounted) {
            setSelectedAccountId(row.account_id);
            setType(row.type as 'income' | 'expense');
            setAmount(formatNumberThousand(row.amount));
            setCategoryId(row.category_id);
            setNote(row.note ?? '');
            setDate(row.date);
            setReceiptImage(row.receipt_image_uri ?? null);
            setIsVoided(Number(row.is_void) === 1);
          }
        }
      }
      init();
      return () => {
        isMounted = false;
      };
    }, [db, cashbookId, isEdit, params.id, categoryId, selectedAccountId])
  );

  const applyTemplate = (t: QuickTemplate) => {
    setType(t.type);
    setAmount(formatNumberThousand(t.amount));
    setNote(t.note);
    const targetCat = categories.find((c) =>
      c.name.toLowerCase().includes(t.categoryName.toLowerCase())
    );
    if (targetCat) {
      setCategoryId(targetCat.id);
    }
  };

  async function takePhotoWithCamera() {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        showAlert(
          'Izin Kamera Dibutuhkan',
          'Mohon izinkan akses kamera di pengaturan perangkat untuk memotret nota/struk.',
          'warning',
          '📷'
        );
        return;
      }
      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: true,
      });
      if (!res.canceled && res.assets && res.assets[0]) {
        setReceiptImage(res.assets[0].uri);
      }
    } catch {
      showAlert('Gagal Membuka Kamera', 'Terjadi kendala saat membuka kamera.', 'danger');
    }
  }

  async function pickFromGallery() {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: true,
      });
      if (!res.canceled && res.assets && res.assets[0]) {
        setReceiptImage(res.assets[0].uri);
      }
    } catch {
      showAlert('Gagal Membuka Galeri', 'Terjadi kendala saat membuka galeri foto.', 'danger');
    }
  }

  async function handleSave() {
    const numAmount = parseRupiahInput(amount);
    if (!numAmount || numAmount <= 0) {
      showAlert('Error', 'Masukkan jumlah yang valid', 'warning');
      return;
    }
    if (!categoryId) {
      showAlert('Error', 'Pilih kategori terlebih dahulu', 'warning');
      return;
    }

    try {
      if (isEdit) {
        await updateTransaction(db, parseInt(params.id!, 10), {
          cashbook_id: cashbookId,
          account_id: selectedAccountId,
          type,
          amount: numAmount,
          category_id: categoryId,
          note: note.trim(),
          date,
          receipt_image_uri: receiptImage,
        });
      } else {
        await addTransaction(db, {
          cashbook_id: cashbookId,
          account_id: selectedAccountId,
          type,
          amount: numAmount,
          category_id: categoryId,
          note: note.trim(),
          date,
          receipt_image_uri: receiptImage,
        });
      }
      router.back();
    } catch {
      showAlert('Error', 'Gagal menyimpan transaksi', 'danger');
    }
  }

  async function handleVoidTransaction() {
    if (!params.id) return;
    try {
      await voidTransaction(db, parseInt(params.id, 10));
      setShowVoidConfirm(false);
      router.back();
    } catch {
      showAlert('Gagal', 'Terjadi kendala saat membatalkan transaksi.', 'danger');
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: palette.canvas }]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      <Stack.Screen
        options={{
          headerShown: true,
          title: isEdit ? 'Edit Transaksi' : 'Tambah Transaksi',
          headerStyle: { backgroundColor: palette.card },
          headerTintColor: palette.ink,
          headerTitleStyle: { fontFamily: FONTS.serifTitle, fontWeight: '700' },
        }}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: 120 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
        >
        {/* Banner Catatan Aktif */}
        <View
          style={[
            styles.activeBookBanner,
            { backgroundColor: isDarkMode ? '#132331' : palette.primarySurface, borderColor: palette.border },
          ]}
        >
          <Text style={styles.activeBookIcon}>{activeCashbook?.icon ?? '📖'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.activeBookLabel, { color: palette.primary }]}>Catatan Aktif</Text>
            <Text style={[styles.activeBookName, { color: palette.ink }]}>
              {activeCashbook?.name ?? 'Catatan'}
            </Text>
          </View>
        </View>

        {/* Quick Add Template Chips */}
        {!isEdit && (
          <View style={styles.quickAddWrap}>
            <Text style={[styles.quickAddTitle, { color: palette.inkMuted }]}>⚡ TEMPLATE CEPAT</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickAddScroll}>
              {QUICK_TEMPLATES.map((tmpl, idx) => (
                <Pressable
                  key={idx}
                  style={({ pressed }) => [
                    styles.quickChip,
                    { backgroundColor: palette.card, borderColor: palette.border },
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={() => applyTemplate(tmpl)}
                >
                  <Text style={[styles.quickChipText, { color: palette.ink }]}>{tmpl.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Type Toggle */}
        <View style={styles.toggleRow}>
          <Pressable
            style={[
              styles.toggleBtn,
              { backgroundColor: palette.card, borderColor: palette.border },
              type === 'expense' && { backgroundColor: isDarkMode ? '#4C0519' : '#FFE4E6', borderColor: palette.expense },
            ]}
            onPress={() => {
              setType('expense');
            }}
          >
            <Text
              style={[
                styles.toggleText,
                { color: palette.inkSecondary },
                type === 'expense' && { color: palette.expense, fontWeight: '800' },
              ]}
            >
              📉 Pengeluaran
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.toggleBtn,
              { backgroundColor: palette.card, borderColor: palette.border },
              type === 'income' && { backgroundColor: isDarkMode ? '#064E3B' : '#DCFCE7', borderColor: palette.income },
            ]}
            onPress={() => {
              setType('income');
            }}
          >
            <Text
              style={[
                styles.toggleText,
                { color: palette.inkSecondary },
                type === 'income' && { color: palette.income, fontWeight: '800' },
              ]}
            >
              📈 Pemasukan
            </Text>
          </Pressable>
        </View>

        {/* Amount */}
        <Text style={[styles.label, { color: palette.inkSecondary }]}>Jumlah (Rp)</Text>
        <TextInput
          style={[styles.amountInput, { backgroundColor: palette.card, borderColor: palette.border, color: palette.ink }]}
          placeholder="0"
          placeholderTextColor={palette.inkMuted}
          keyboardType="numeric"
          value={amount}
          onChangeText={(text) => setAmount(formatNumberThousand(text))}
        />

        {/* Category */}
        <Text style={[styles.label, { color: palette.inkSecondary }]}>Kategori</Text>
        <View style={styles.categoryGrid}>
          {categories.map((cat) => {
            const isSelected = categoryId === cat.id;
            return (
              <Pressable
                key={cat.id}
                style={[
                  styles.categoryChip,
                  { backgroundColor: palette.card, borderColor: palette.border },
                  isSelected && { backgroundColor: palette.primary, borderColor: palette.primary },
                ]}
                onPress={() => setCategoryId(cat.id)}
              >
                <Text style={styles.categoryChipIcon}>{cat.icon}</Text>
                <Text
                  style={[
                    styles.categoryChipText,
                    { color: palette.ink },
                    isSelected && { color: '#FFFFFF', fontWeight: '800' },
                  ]}
                  numberOfLines={1}
                >
                  {cat.name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Dompet / Rekening */}
        {accounts.length > 0 && (
          <>
            <Text style={[styles.label, { color: palette.inkSecondary }]}>Dompet / Rekening</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.accountRow}>
              {accounts.map((a) => {
                const isSelected = selectedAccountId === a.id;
                return (
                  <Pressable
                    key={a.id}
                    style={[
                      styles.accountChip,
                      { backgroundColor: palette.card, borderColor: palette.border },
                      isSelected && { backgroundColor: palette.primaryAccent, borderColor: palette.primaryAccent },
                    ]}
                    onPress={() => setSelectedAccountId(a.id)}
                  >
                    <Text style={styles.accountChipIcon}>{a.icon}</Text>
                    <Text
                      style={[
                        styles.accountChipText,
                        { color: palette.ink },
                        isSelected && { color: '#FFFFFF', fontWeight: '800' },
                      ]}
                    >
                      {a.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        )}

        {/* Date & Time (Kalender Interaktif) */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.labelNoMargin, { color: palette.inkSecondary }]}>Tanggal & Waktu Transaksi</Text>
          <Pressable onPress={() => setDate(getNowFull())}>
            <Text style={[styles.nowBtnText, { color: palette.primary }]}>⏱️ Sekarang</Text>
          </Pressable>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.datePickerBtn,
            { backgroundColor: palette.card, borderColor: palette.border },
            pressed && { opacity: 0.8 },
          ]}
          onPress={() => setShowDatePicker(true)}
        >
          <View style={styles.datePickerInner}>
            <Text style={styles.datePickerIcon}>📅</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.datePickerText, { color: palette.ink }]}>{formatDate(date)}</Text>
              <Text style={[styles.datePickerHint, { color: palette.inkMuted }]}>
                Ketuk untuk buka kalender pemilih tanggal
              </Text>
            </View>
            <Text style={[styles.datePickerArrow, { color: palette.inkMuted }]}>›</Text>
          </View>
        </Pressable>

        <DatePickerModal
          visible={showDatePicker}
          value={date}
          onSelect={(newDate) => setDate(newDate)}
          onClose={() => setShowDatePicker(false)}
        />

        {/* Note */}
        <Text style={[styles.label, { color: palette.inkSecondary }]}>Catatan</Text>
        <TextInput
          style={[
            styles.input,
            styles.noteInput,
            { backgroundColor: palette.card, borderColor: palette.border, color: palette.ink },
          ]}
          placeholder="Tulis catatan transaksi di sini..."
          placeholderTextColor={palette.inkMuted}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          value={note}
          onChangeText={setNote}
        />

        {/* Lampiran Foto Struk / Nota (Modern Card) */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.labelNoMargin, { color: palette.inkSecondary }]}>Foto Struk / Nota</Text>
          <Text style={[styles.optionalBadge, { backgroundColor: palette.cardMuted, color: palette.inkMuted }]}>
            Opsional
          </Text>
        </View>

        {receiptImage ? (
          <View style={[styles.attachedCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Pressable style={styles.attachedImageWrap} onPress={() => setViewReceiptFullscreen(true)}>
              <Image source={{ uri: receiptImage }} style={styles.attachedThumbnail} resizeMode="cover" />
              <View style={styles.zoomPill}>
                <Text style={styles.zoomPillText}>🔍 Perbesar</Text>
              </View>
            </Pressable>

            <View style={styles.attachedInfo}>
              <View style={styles.attachedBadge}>
                <Text style={styles.attachedBadgeText}>✓ FOTO TERLAMPIR</Text>
              </View>
              <Text style={[styles.attachedTitle, { color: palette.ink }]} numberOfLines={1}>
                Struk / Nota Transaksi
              </Text>
              <Text style={[styles.attachedSub, { color: palette.inkMuted }]}>Tersimpan offline di memori</Text>

              <View style={styles.attachedBtnRow}>
                <Pressable
                  style={({ pressed }) => [styles.attachedActionBtn, { backgroundColor: palette.cardMuted }, pressed && { opacity: 0.7 }]}
                  onPress={() => setShowReceiptModal(true)}
                >
                  <Text style={[styles.attachedActionBtnText, { color: palette.ink }]}>🔄 Ganti</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.attachedDeleteBtn, pressed && { opacity: 0.7 }]}
                  onPress={() => setReceiptImage(null)}
                >
                  <Text style={styles.attachedDeleteBtnText}>🗑️ Hapus</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : (
          <Pressable
            style={({ pressed }) => [
              styles.uploadReceiptBtn,
              { backgroundColor: palette.card, borderColor: palette.border },
              pressed && { opacity: 0.8 },
            ]}
            onPress={() => setShowReceiptModal(true)}
          >
            <View style={[styles.uploadIconCircle, { backgroundColor: palette.cardMuted }]}>
              <Text style={{ fontSize: 22 }}>🧾</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.uploadReceiptTitle, { color: palette.ink }]}>Lampirkan Foto Struk / Nota</Text>
              <Text style={[styles.uploadReceiptSub, { color: palette.inkMuted }]}>
                Kamera langsung atau ambil dari galeri foto
              </Text>
            </View>
            <View style={[styles.uploadAddBadge, { backgroundColor: palette.primarySurface }]}>
              <Text style={[styles.uploadAddBadgeText, { color: palette.primary }]}>+ Foto</Text>
            </View>
          </Pressable>
        )}

        {/* Save */}
        <Pressable
          style={({ pressed }) => [
            styles.saveBtn,
            { backgroundColor: palette.primary },
            pressed && { opacity: 0.9, transform: [{ scale: 0.985 }] },
          ]}
          onPress={handleSave}
        >
          <Text style={styles.saveBtnText}>{isEdit ? 'Simpan Perubahan' : 'Simpan Transaksi'}</Text>
        </Pressable>

        {/* Batalkan Transaksi (Void) jika sedang edit dan belum void */}
        {isEdit && !isVoided && (
          <Pressable
            style={({ pressed }) => [
              styles.voidBtn,
              { backgroundColor: isDarkMode ? '#2D1217' : '#FEF2F2', borderColor: '#FECACA' },
              pressed && { opacity: 0.8 },
            ]}
            onPress={() => setShowVoidConfirm(true)}
          >
            <Text style={styles.voidBtnText}>🚫 Batalkan</Text>
          </Pressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>

      {/* Modern Bottom Sheet Modal: Lampirkan Struk / Nota */}
      <Modal
        visible={showReceiptModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowReceiptModal(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setShowReceiptModal(false)}>
          <Pressable style={[styles.sheetContent, { backgroundColor: palette.card }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetIndicator} />
            <Text style={[styles.sheetTitle, { color: palette.ink }]}>Pilih Foto Struk / Nota</Text>
            <Text style={[styles.sheetSub, { color: palette.inkMuted }]}>
              Simpan bukti transaksi untuk pencatatan lebih akurat
            </Text>

            <View style={styles.sheetActionList}>
              <Pressable
                style={({ pressed }) => [styles.actionCard, { backgroundColor: palette.cardMuted }, pressed && { opacity: 0.7 }]}
                onPress={() => {
                  setShowReceiptModal(false);
                  takePhotoWithCamera();
                }}
              >
                <View style={[styles.actionIconBox, { backgroundColor: isDarkMode ? '#132F2A' : '#DCFCE7' }]}>
                  <Text style={{ fontSize: 22 }}>📷</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.badgeRow}>
                    <Text style={[styles.actionCardTitle, { color: palette.ink }]}>Ambil Foto via Kamera</Text>
                    <View style={styles.instantBadge}>
                      <Text style={styles.instantBadgeText}>INSTAN</Text>
                    </View>
                  </View>
                  <Text style={[styles.actionCardDesc, { color: palette.inkMuted }]}>Buka kamera & foto struk belanja sekarang</Text>
                </View>
                <Text style={[styles.actionChevron, { color: palette.inkMuted }]}>›</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.actionCard, { backgroundColor: palette.cardMuted }, pressed && { opacity: 0.7 }]}
                onPress={() => {
                  setShowReceiptModal(false);
                  pickFromGallery();
                }}
              >
                <View style={[styles.actionIconBox, { backgroundColor: isDarkMode ? '#172B38' : '#E0F2FE' }]}>
                  <Text style={{ fontSize: 22 }}>🖼️</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.badgeRow}>
                    <Text style={[styles.actionCardTitle, { color: palette.ink }]}>Pilih dari Galeri</Text>
                    <View style={styles.galleryBadge}>
                      <Text style={styles.galleryBadgeText}>ALBUM</Text>
                    </View>
                  </View>
                  <Text style={[styles.actionCardDesc, { color: palette.inkMuted }]}>Unggah screenshot e-receipt atau foto tersimpan</Text>
                </View>
                <Text style={[styles.actionChevron, { color: palette.inkMuted }]}>›</Text>
              </Pressable>
            </View>

            <Pressable style={[styles.sheetCancelBtn, { borderColor: palette.border }]} onPress={() => setShowReceiptModal(false)}>
              <Text style={[styles.sheetCancelText, { color: palette.inkSecondary }]}>Tutup</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Fullscreen Photo Viewer Modal */}
      <Modal
        visible={viewReceiptFullscreen}
        animationType="fade"
        transparent
        onRequestClose={() => setViewReceiptFullscreen(false)}
      >
        <View style={styles.fullscreenBackdrop}>
          <View style={styles.fullscreenHeader}>
            <View>
              <Text style={styles.fullscreenTitle}>Bukti Struk / Nota</Text>
              <Text style={styles.fullscreenDate}>Tanggal: {date}</Text>
            </View>
            <Pressable style={styles.fullscreenCloseBtn} onPress={() => setViewReceiptFullscreen(false)}>
              <Text style={styles.fullscreenCloseText}>✕ Tutup</Text>
            </Pressable>
          </View>

          <View style={styles.fullscreenImageContainer}>
            {receiptImage && (
              <Image source={{ uri: receiptImage }} style={styles.fullscreenImage} resizeMode="contain" />
            )}
          </View>
        </View>
      </Modal>

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

      {/* Modern Confirm Modal: Batalkan Transaksi */}
      <ModernConfirmModal
        visible={showVoidConfirm}
        type="danger"
        icon="🚫"
        title="Batalkan Transaksi?"
        message="Sesuai prinsip pembukuan akuntansi, riwayat transaksi tidak dihapus melainkan ditandai BATAL (Void). Saldo akun akan dikembalikan dan transaksi tidak lagi dihitung dalam total laporan."
        confirmText="Batalkan"
        cancelText="Kembali"
        onConfirm={handleVoidTransaction}
        onCancel={() => setShowVoidConfirm(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  activeBookBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
  },
  activeBookIcon: { fontSize: 24 },
  activeBookLabel: {
    fontFamily: FONTS.sansMedium,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  activeBookName: {
    fontFamily: FONTS.serifTitle,
    fontSize: 16,
    fontWeight: '700',
  },
  quickAddWrap: {
    marginBottom: 16,
  },
  quickAddTitle: {
    fontFamily: FONTS.sansBold,
    fontSize: 11,
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  quickAddScroll: {
    flexDirection: 'row',
  },
  quickChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 8,
  },
  quickChipText: {
    fontFamily: FONTS.sansBold,
    fontSize: 12,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  toggleText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 14,
    fontWeight: '700',
  },
  label: {
    fontFamily: FONTS.sansMedium,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 14,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  labelNoMargin: {
    fontFamily: FONTS.sansMedium,
    fontSize: 13,
    fontWeight: '700',
  },
  optionalBadge: {
    fontFamily: FONTS.sansMedium,
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  nowBtnText: {
    fontFamily: FONTS.sansBold,
    fontSize: 12,
    fontWeight: '700',
  },
  amountInput: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: FONTS.serifTitle,
    fontSize: 22,
    fontWeight: '700',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  categoryChipIcon: { fontSize: 16 },
  categoryChipText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 13,
    fontWeight: '600',
  },
  accountRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  accountChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginRight: 8,
  },
  accountChipIcon: { fontSize: 15 },
  accountChipText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: FONTS.sansRegular,
    fontSize: 14,
  },
  noteInput: {
    minHeight: 70,
  },
  datePickerBtn: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  datePickerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  datePickerIcon: { fontSize: 20 },
  datePickerText: {
    fontFamily: FONTS.sansBold,
    fontSize: 14,
  },
  datePickerHint: {
    fontFamily: FONTS.sansRegular,
    fontSize: 11,
    marginTop: 2,
  },
  datePickerArrow: {
    fontSize: 20,
    fontWeight: '700',
  },
  uploadReceiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    padding: 14,
    marginTop: 4,
  },
  uploadIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadReceiptTitle: {
    fontFamily: FONTS.sansBold,
    fontSize: 13,
  },
  uploadReceiptSub: {
    fontFamily: FONTS.sansRegular,
    fontSize: 11,
    marginTop: 2,
  },
  uploadAddBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  uploadAddBadgeText: {
    fontFamily: FONTS.sansBold,
    fontSize: 12,
  },
  attachedCard: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 12,
    marginTop: 4,
  },
  attachedImageWrap: {
    width: 80,
    height: 80,
    borderRadius: 12,
    overflow: 'hidden',
  },
  attachedThumbnail: {
    width: '100%',
    height: '100%',
  },
  zoomPill: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 2,
    borderRadius: 4,
    alignItems: 'center',
  },
  zoomPillText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  attachedInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  attachedBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  attachedBadgeText: {
    color: '#059669',
    fontSize: 9,
    fontWeight: '800',
  },
  attachedTitle: {
    fontFamily: FONTS.sansBold,
    fontSize: 13,
  },
  attachedSub: {
    fontFamily: FONTS.sansRegular,
    fontSize: 11,
    marginTop: 1,
  },
  attachedBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  attachedActionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  attachedActionBtnText: {
    fontFamily: FONTS.sansBold,
    fontSize: 11,
  },
  attachedDeleteBtn: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  attachedDeleteBtnText: {
    color: '#DC2626',
    fontFamily: FONTS.sansBold,
    fontSize: 11,
  },
  saveBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  saveBtnText: {
    fontFamily: FONTS.sansBold,
    fontSize: 15,
    color: '#FAF8F5',
  },
  voidBtn: {
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
  },
  voidBtnText: {
    fontFamily: FONTS.sansBold,
    fontSize: 14,
    color: '#DC2626',
    fontWeight: '700',
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheetContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
  },
  sheetIndicator: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontFamily: FONTS.serifTitle,
    fontSize: 18,
    fontWeight: '800',
  },
  sheetSub: {
    fontFamily: FONTS.sansRegular,
    fontSize: 12,
    marginTop: 2,
    marginBottom: 16,
  },
  sheetActionList: {
    gap: 10,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    gap: 12,
  },
  actionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionCardTitle: {
    fontFamily: FONTS.sansBold,
    fontSize: 13,
  },
  actionCardDesc: {
    fontFamily: FONTS.sansRegular,
    fontSize: 11,
    marginTop: 1,
  },
  instantBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  instantBadgeText: {
    color: '#059669',
    fontSize: 9,
    fontWeight: '800',
  },
  galleryBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  galleryBadgeText: {
    color: '#0284C7',
    fontSize: 9,
    fontWeight: '800',
  },
  actionChevron: {
    fontSize: 20,
    fontWeight: '700',
  },
  sheetCancelBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 14,
  },
  sheetCancelText: {
    fontFamily: FONTS.sansBold,
    fontSize: 13,
  },
  fullscreenBackdrop: {
    flex: 1,
    backgroundColor: '#0F172A',
    paddingTop: 50,
  },
  fullscreenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  fullscreenTitle: {
    fontFamily: FONTS.serifTitle,
    fontSize: 18,
    fontWeight: '700',
    color: '#FAF8F5',
  },
  fullscreenDate: {
    fontFamily: FONTS.sansRegular,
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  fullscreenCloseBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  fullscreenCloseText: {
    fontFamily: FONTS.sansBold,
    fontSize: 12,
    color: '#FFFFFF',
  },
  fullscreenImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 14,
  },
  fullscreenImage: {
    width: '100%',
    height: '100%',
  },
});
