import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import Constants from 'expo-constants';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { useFocusEffect, router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { useThemeStore } from '../../src/stores/useThemeStore';
import {
  getCategories,
  addCategory,
  deleteCategory,
  toggleArchiveCashbook,
  deleteCashbook,
  type Category,
} from '../../src/database/queries';
import {
  exportSingleCashbook,
  importSingleCashbook,
} from '../../src/utils/backup';
import { checkForAppUpdate, openDownloadPage } from '../../src/utils/appUpdater';
import { useCashbookStore } from '../../src/stores/useCashbookStore';
import { EMOJI_LIST } from '../../src/constants/categories';
import { FONTS } from '../../src/constants/theme';
import { ModernConfirmModal, type ModalType } from '../../src/components/ModernConfirmModal';

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const { width } = useWindowDimensions();
  const isTablet = width >= 600;
  const { palette } = useThemeStore();
  const { activeCashbook, setActiveCashbook } = useCashbookStore();
  const cashbookId = activeCashbook?.id ?? 1;

  const [categories, setCategories] = useState<Category[]>([]);
  const [newCatName, setNewCatName] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('📦');
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  // Universal Modern Confirm Modal State
  const [confirmModal, setConfirmModal] = useState<{
    visible: boolean;
    type: ModalType;
    icon?: string;
    title: string;
    message: string;
    cancelText?: string;
    confirmText?: string;
    onConfirm: () => Promise<void> | void;
  }>({
    visible: false,
    type: 'warning',
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const closeConfirmModal = () => {
    setConfirmModal((prev) => ({ ...prev, visible: false }));
  };

  const showAlert = (
    title: string,
    message: string,
    type: ModalType = 'warning',
    icon?: string,
    onConfirm?: () => void
  ) => {
    setConfirmModal({
      visible: true,
      type,
      icon,
      title,
      message,
      confirmText: 'Mengerti',
      cancelText: '',
      onConfirm: () => {
        closeConfirmModal();
        if (onConfirm) onConfirm();
      },
    });
  };

  const loadData = useCallback(async () => {
    try {
      const cats = await getCategories(db);
      setCategories(cats);
    } catch (e) {
      console.warn('loadSettings error:', e);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  async function handleAddCategory() {
    if (!newCatName.trim()) {
      showAlert('Perhatian', 'Nama kategori wajib diisi', 'warning');
      return;
    }
    await addCategory(db, newCatName.trim(), selectedEmoji);
    setNewCatName('');
    setShowAddCategory(false);
    loadData();
  }

  async function handleDeleteCategory(id: number, name: string) {
    setConfirmModal({
      visible: true,
      type: 'danger',
      icon: '🗑️',
      title: 'Hapus Kategori',
      message: `Hapus kategori "${name}"? Transaksi yang sudah menggunakan kategori ini tidak akan terhapus.`,
      cancelText: 'Batal',
      confirmText: 'Ya, Hapus',
      onConfirm: async () => {
        closeConfirmModal();
        await deleteCategory(db, id);
        loadData();
      },
    });
  }

  async function handleToggleArchive() {
    if (!activeCashbook) return;
    const isArchiving = activeCashbook.is_archived === 0;

    setConfirmModal({
      visible: true,
      type: isArchiving ? 'warning' : 'info',
      icon: isArchiving ? '📦' : '📂',
      title: isArchiving ? 'Arsipkan Buku Catatan' : 'Buka Arsip Catatan',
      message: isArchiving
        ? `Buku catatan "${activeCashbook.name}" akan disembunyikan dari daftar aktif.`
        : `Buku catatan "${activeCashbook.name}" akan kembali diaktifkan.`,
      cancelText: 'Batal',
      confirmText: isArchiving ? 'Arsipkan' : 'Aktifkan',
      onConfirm: async () => {
        closeConfirmModal();
        await toggleArchiveCashbook(db, activeCashbook.id);
        setActiveCashbook({ ...activeCashbook, is_archived: isArchiving ? 1 : 0 });
        router.replace('/');
      },
    });
  }

  async function handleDeleteBook() {
    if (!activeCashbook) return;
    if (activeCashbook.is_default === 1) {
      showAlert('Perhatian', 'Buku catatan bawaan utama tidak dapat dihapus.', 'warning');
      return;
    }

    setConfirmModal({
      visible: true,
      type: 'danger',
      icon: '🗑️',
      title: 'Hapus Buku Catatan',
      message: `PERINGATAN: Menghapus catatan "${activeCashbook.name}" akan menghapus seluruh data dompet, transaksi, hutang, dan anggaran di dalamnya secara permanen!`,
      cancelText: 'Batal',
      confirmText: 'Hapus Permanen',
      onConfirm: async () => {
        closeConfirmModal();
        await deleteCashbook(db, activeCashbook.id);
        setActiveCashbook(null);
        router.replace('/');
      },
    });
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: palette.canvas }]}
      contentContainerStyle={[
        styles.content,
        isTablet && { maxWidth: 740, width: '100%', alignSelf: 'center' },
        { flexGrow: 1 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header Info Catatan Aktif */}
      <View style={[styles.bookCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <View style={[styles.bookIconBadge, { backgroundColor: palette.cardMuted }]}>
          <Text style={{ fontSize: 28 }}>{activeCashbook?.icon ?? '📖'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.bookCardSubtitle, { color: palette.primary }]}>PENGATURAN CATATAN INI</Text>
          <Text style={[styles.bookCardTitle, { color: palette.ink }]}>{activeCashbook?.name ?? 'Catatan'}</Text>
          <Text style={[styles.bookCardMeta, { color: palette.inkMuted }]}>
            Tipe: {activeCashbook?.type === 'business' ? 'Usaha / Bisnis' : activeCashbook?.type === 'organization' ? 'Organisasi' : 'Keuangan Pribadi'}
          </Text>
        </View>
      </View>

      {/* Edit Profil Catatan */}
      <Text style={[styles.sectionTitle, { color: palette.inkSecondary }]}>PROFIL & BUDGET CATATAN</Text>
      <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <Pressable
          style={({ pressed }) => [styles.actionRow, pressed && { opacity: 0.7 }]}
          onPress={() => router.push({ pathname: '/cashbook-modal', params: { id: activeCashbook?.id.toString() } })}
        >
          <View style={styles.actionLeft}>
            <Text style={styles.actionIcon}>✏️</Text>
            <View>
              <Text style={[styles.actionTitle, { color: palette.ink }]}>Edit Nama & Ikon Catatan</Text>
              <Text style={[styles.actionDesc, { color: palette.inkMuted }]}>Ubah judul buku kas dan warna tema</Text>
            </View>
          </View>
          <Text style={[styles.linkArrow, { color: palette.inkMuted }]}>›</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.actionRow,
            { borderTopWidth: 1, borderTopColor: palette.borderSubtle },
            pressed && { opacity: 0.7 },
          ]}
          onPress={() => router.push('/category-budgets' as any)}
        >
          <View style={styles.actionLeft}>
            <Text style={styles.actionIcon}>🎯</Text>
            <View>
              <Text style={[styles.actionTitle, { color: palette.ink }]}>Batas Anggaran Bulanan (Budget)</Text>
              <Text style={[styles.actionDesc, { color: palette.inkMuted }]}>Kendalikan limit belanja kategori</Text>
            </View>
          </View>
          <Text style={[styles.linkArrow, { color: palette.inkMuted }]}>›</Text>
        </Pressable>
      </View>

      {/* Ekspor & Impor Khusus Catatan Ini */}
      <Text style={[styles.sectionTitle, { color: palette.inkSecondary }]}>PORTABILITAS CATATAN</Text>
      <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <Pressable
          style={({ pressed }) => [styles.actionRow, pressed && { opacity: 0.7 }]}
          onPress={async () => {
            if (!activeCashbook) return;
            try {
              await exportSingleCashbook(db, activeCashbook.id);
            } catch {
              showAlert('Gagal', 'Terjadi kesalahan saat membagikan catatan.', 'danger');
            }
          }}
        >
          <View style={styles.actionLeft}>
            <Text style={styles.actionIcon}>📤</Text>
            <View>
              <Text style={[styles.actionTitle, { color: palette.ink }]}>Ekspor Catatan Ini (.json)</Text>
              <Text style={[styles.actionDesc, { color: palette.inkMuted }]}>Bagikan hanya buku catatan &quot;{activeCashbook?.name}&quot;</Text>
            </View>
          </View>
          <Text style={[styles.linkArrow, { color: palette.inkMuted }]}>›</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.actionRow,
            { borderTopWidth: 1, borderTopColor: palette.borderSubtle },
            pressed && { opacity: 0.7 },
          ]}
          onPress={async () => {
            try {
              const docRes = await DocumentPicker.getDocumentAsync({
                type: 'application/json',
                copyToCacheDirectory: true,
              });
              if (!docRes.canceled && docRes.assets && docRes.assets.length > 0) {
                const picked = docRes.assets[0];
                const file = new File(picked.uri);
                const text = await file.text();
                const res = await importSingleCashbook(db, text);
                if (res) {
                  showAlert('Sukses', `Buku catatan baru "${res.cashbookName}" berhasil diimpor!`, 'success', '🎉', () => {
                    router.replace('/');
                  });
                }
              }
            } catch (err: any) {
              showAlert('Gagal', err?.message || 'Berkas backup catatan tidak valid.', 'danger');
            }
          }}
        >
          <View style={styles.actionLeft}>
            <Text style={styles.actionIcon}>📥</Text>
            <View>
              <Text style={[styles.actionTitle, { color: palette.ink }]}>Impor Berkas Catatan</Text>
              <Text style={[styles.actionDesc, { color: palette.inkMuted }]}>Masukkan file catatan eksternal ke aplikasi</Text>
            </View>
          </View>
          <Text style={[styles.linkArrow, { color: palette.inkMuted }]}>›</Text>
        </Pressable>
      </View>

      {/* Kategori Pengeluaran */}
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitleNoMargin, { color: palette.inkSecondary }]}>KATEGORI TRANSAKSI</Text>
        <Pressable onPress={() => setShowAddCategory(!showAddCategory)}>
          <Text style={[styles.addCatLink, { color: palette.primary }]}>
            {showAddCategory ? '✕ Batal' : '+ Kategori'}
          </Text>
        </Pressable>
      </View>

      {showAddCategory && (
        <View style={[styles.addCategoryBox, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.inputLabel, { color: palette.inkSecondary }]}>Nama Kategori</Text>
          <TextInput
            style={[styles.input, { backgroundColor: palette.cardMuted, borderColor: palette.border, color: palette.ink }]}
            placeholder="Contoh: Belanja Bulanan, Transport"
            placeholderTextColor={palette.inkMuted}
            value={newCatName}
            onChangeText={setNewCatName}
          />

          <Text style={[styles.inputLabel, { color: palette.inkSecondary }]}>Pilih Emoji</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.emojiScroll}>
            {EMOJI_LIST.map((emoji) => (
              <Pressable
                key={emoji}
                style={[
                  styles.emojiBtn,
                  { backgroundColor: palette.cardMuted, borderColor: palette.border },
                  selectedEmoji === emoji && { borderColor: palette.primary, backgroundColor: palette.primarySurface },
                ]}
                onPress={() => setSelectedEmoji(emoji)}
              >
                <Text style={styles.emojiText}>{emoji}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Pressable
            style={[styles.saveCatBtn, { backgroundColor: palette.primary }]}
            onPress={handleAddCategory}
          >
            <Text style={styles.saveCatBtnText}>Simpan Kategori</Text>
          </Pressable>
        </View>
      )}

      <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
        {categories.map((cat, index) => (
          <View
            key={cat.id}
            style={[
              styles.categoryRow,
              index > 0 && { borderTopWidth: 1, borderTopColor: palette.borderSubtle },
            ]}
          >
            <View style={styles.catLeft}>
              <Text style={{ fontSize: 20 }}>{cat.icon}</Text>
              <Text style={[styles.catName, { color: palette.ink }]}>{cat.name}</Text>
            </View>
            <Pressable
              hitSlop={8}
              style={({ pressed }) => [styles.catDeleteBtn, pressed && { opacity: 0.6 }]}
              onPress={() => handleDeleteCategory(cat.id, cat.name)}
            >
              <Text style={{ fontSize: 13 }}>🗑️</Text>
            </Pressable>
          </View>
        ))}
      </View>

      {/* Zona Tindakan Berisiko Catatan */}
      <Text style={[styles.sectionTitle, { color: palette.expense }]}>TINDAKAN CATATAN</Text>
      <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <Pressable
          style={({ pressed }) => [styles.actionRow, pressed && { opacity: 0.7 }]}
          onPress={handleToggleArchive}
        >
          <View style={styles.actionLeft}>
            <Text style={styles.actionIcon}>{activeCashbook?.is_archived === 1 ? '📂' : '📦'}</Text>
            <View>
              <Text style={[styles.actionTitle, { color: palette.ink }]}>
                {activeCashbook?.is_archived === 1 ? 'Buka Arsip Catatan' : 'Arsipkan Catatan Ini'}
              </Text>
              <Text style={[styles.actionDesc, { color: palette.inkMuted }]}>
                {activeCashbook?.is_archived === 1 ? 'Aktifkan kembali catatan' : 'Sembunyikan dari daftar aktif'}
              </Text>
            </View>
          </View>
          <Text style={[styles.linkArrow, { color: palette.inkMuted }]}>›</Text>
        </Pressable>

        {activeCashbook?.is_default !== 1 && (
          <Pressable
            style={({ pressed }) => [
              styles.actionRow,
              { borderTopWidth: 1, borderTopColor: palette.borderSubtle },
              pressed && { opacity: 0.7 },
            ]}
            onPress={handleDeleteBook}
          >
            <View style={styles.actionLeft}>
              <Text style={styles.actionIcon}>🗑️</Text>
              <View>
                <Text style={[styles.actionTitle, { color: palette.expense }]}>Hapus Catatan Ini Permanen</Text>
                <Text style={[styles.actionDesc, { color: palette.inkMuted }]}>
                  Hapus catatan dan seluruh transaksi di dalamnya
                </Text>
              </View>
            </View>
            <Text style={[styles.linkArrow, { color: palette.expense }]}>›</Text>
          </Pressable>
        )}
      </View>

      {/* Tentang & Informasi Aplikasi */}
      <Text style={[styles.sectionTitle, { color: palette.inkSecondary }]}>TENTANG</Text>
      <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <View style={styles.actionRow}>
          <View style={styles.actionLeft}>
            <Text style={styles.actionIcon}>📱</Text>
            <View>
              <Text style={[styles.actionTitle, { color: palette.ink }]}>Versi Aplikasi</Text>
              <Text style={[styles.actionDesc, { color: palette.inkMuted }]}>
                CatatKu v{Constants.expoConfig?.version || '1.0.0'}
              </Text>
            </View>
          </View>
          <View style={[styles.versionBadge, { backgroundColor: palette.cardMuted, borderColor: palette.border }]}>
            <Text style={[styles.versionBadgeText, { color: palette.primary }]}>
              v{Constants.expoConfig?.version || '1.0.0'}
            </Text>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.actionRow,
            { borderTopWidth: 1, borderTopColor: palette.borderSubtle },
            pressed && { opacity: 0.7 },
          ]}
          disabled={checkingUpdate}
          onPress={async () => {
            setCheckingUpdate(true);
            try {
              const res = await checkForAppUpdate();
              if (res.error) {
                showAlert('Pemeriksaan Gagal', res.error, 'danger', '⚠️');
                return;
              }

              if (res.hasUpdate) {
                setConfirmModal({
                  visible: true,
                  type: 'info',
                  icon: '🚀',
                  title: `Pembaruan Tersedia (v${res.latestVersion})`,
                  message: `Versi terbaru v${res.latestVersion} telah dirilis!\n\nCatatan Rilis:\n${res.releaseNotes || 'Peningkatan stabilitas aplikasi.'}`,
                  cancelText: 'Nanti Saja',
                  confirmText: 'Unduh Sekarang',
                  onConfirm: () => {
                    closeConfirmModal();
                    openDownloadPage(res.downloadUrl);
                  },
                });
              } else {
                showAlert(
                  'Aplikasi Sudah Terbaru',
                  `Anda telah menggunakan versi terbaru (v${res.currentVersion}). Tidak ada pembaruan saat ini.`,
                  'success',
                  '✨'
                );
              }
            } catch {
              showAlert('Gagal', 'Terjadi kesalahan saat memeriksa pembaruan.', 'danger', '⚠️');
            } finally {
              setCheckingUpdate(false);
            }
          }}
        >
          <View style={styles.actionLeft}>
            <Text style={styles.actionIcon}>🔄</Text>
            <View>
              <Text style={[styles.actionTitle, { color: palette.ink }]}>Cek Pembaruan</Text>
              <Text style={[styles.actionDesc, { color: palette.inkMuted }]}>
                Periksa ketersediaan versi rilis terbaru
              </Text>
            </View>
          </View>
          {checkingUpdate ? (
            <ActivityIndicator size="small" color={palette.primary} />
          ) : (
            <Text style={[styles.linkArrow, { color: palette.inkMuted }]}>›</Text>
          )}
        </Pressable>
      </View>

      {/* Footer Copyright Terkunci di Paling Bawah */}
      <View style={styles.footerWrap}>
        <Text style={[styles.footerText, { color: palette.inkMuted }]}>© 2026 CatatKu</Text>
      </View>

      {/* Universal Confirm Modal */}
      <ModernConfirmModal
        visible={confirmModal.visible}
        type={confirmModal.type}
        icon={confirmModal.icon}
        title={confirmModal.title}
        message={confirmModal.message}
        cancelText={confirmModal.cancelText}
        confirmText={confirmModal.confirmText}
        onCancel={closeConfirmModal}
        onConfirm={confirmModal.onConfirm}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: 16,
    paddingTop: 54,
    gap: 8,
  },
  bookCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 4,
  },
  bookIconBadge: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookCardSubtitle: {
    fontFamily: FONTS.sansBold,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  bookCardTitle: {
    fontFamily: FONTS.serifTitle,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  bookCardMeta: {
    fontFamily: FONTS.sansRegular,
    fontSize: 12,
    marginTop: 2,
  },
  sectionTitle: {
    fontFamily: FONTS.sansBold,
    fontSize: 11,
    letterSpacing: 0.5,
    marginTop: 14,
    marginBottom: 4,
    marginLeft: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 4,
    marginLeft: 4,
    paddingRight: 4,
  },
  sectionTitleNoMargin: {
    fontFamily: FONTS.sansBold,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  addCatLink: {
    fontFamily: FONTS.sansBold,
    fontSize: 12,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  actionIcon: { fontSize: 22 },
  actionTitle: {
    fontFamily: FONTS.sansBold,
    fontSize: 13,
  },
  actionDesc: {
    fontFamily: FONTS.sansRegular,
    fontSize: 11,
    marginTop: 2,
  },
  linkArrow: {
    fontSize: 18,
    fontFamily: FONTS.sansBold,
  },
  versionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  versionBadgeText: {
    fontFamily: FONTS.sansBold,
    fontSize: 12,
  },
  addCategoryBox: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 6,
  },
  inputLabel: {
    fontFamily: FONTS.sansBold,
    fontSize: 11,
    marginBottom: 6,
  },
  input: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontFamily: FONTS.sansMedium,
    fontSize: 13,
    marginBottom: 10,
  },
  emojiScroll: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  emojiBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  emojiText: { fontSize: 18 },
  saveCatBtn: {
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveCatBtnText: {
    fontFamily: FONTS.sansBold,
    fontSize: 13,
    color: '#FAF8F5',
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  catLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  catName: {
    fontFamily: FONTS.sansMedium,
    fontSize: 13,
  },
  catDeleteBtn: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
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
