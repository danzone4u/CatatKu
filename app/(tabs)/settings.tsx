import { View, Text, StyleSheet, ScrollView, Pressable, Switch, Alert, TextInput, Modal } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { useFocusEffect, router } from 'expo-router';
import { useThemeStore } from '../../src/stores/useThemeStore';
import {
  getCategories,
  addCategory,
  deleteCategory,
  getTransactions,
  getDebts,
  getMonthlySummary,
  toggleArchiveCashbook,
  deleteCashbook,
  getSetting,
  setSetting,
  type Category,
} from '../../src/database/queries';
import { useCashbookStore } from '../../src/stores/useCashbookStore';
import { EMOJI_LIST } from '../../src/constants/categories';
import { generateAndSharePdfReport } from '../../src/utils/pdfReport';
import { getCurrentMonth, getMonthName } from '../../src/utils/date';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as LocalAuthentication from 'expo-local-authentication';
import { exportBackup, exportBackupToLocalStorage, restoreBackup, exportSingleCashbook, importSingleCashbook } from '../../src/utils/backup';
import { PALETTE, FONTS } from '../../src/constants/theme';
import { ModernConfirmModal, type ModalType } from '../../src/components/ModernConfirmModal';

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const { activeCashbook, setActiveCashbook } = useCashbookStore();
  const cashbookId = activeCashbook?.id ?? 1;
  const { year, month } = getCurrentMonth();

  const [categories, setCategories] = useState<Category[]>([]);
  const [newCatName, setNewCatName] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('📦');
  const [showAddCategory, setShowAddCategory] = useState(false);

  // PIN & Biometric settings
  const [pinEnabled, setPinEnabled] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(true);
  const [hasBiometricSensor, setHasBiometricSensor] = useState(false);
  const [showPinInput, setShowPinInput] = useState(false);
  const [newPin, setNewPin] = useState('');
  const { isDarkMode, palette } = useThemeStore();
  const [pinSuccessModalVisible, setPinSuccessModalVisible] = useState(false);

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

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [cashbookId])
  );

  async function loadData() {
    const [cats, pinVal, bioVal] = await Promise.all([
      getCategories(db),
      getSetting(db, 'pin_enabled'),
      getSetting(db, 'biometric_enabled'),
    ]);
    setCategories(cats);
    setPinEnabled(pinVal === 'true');
    setBiometricEnabled(bioVal !== 'false');

    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    setHasBiometricSensor(compatible && enrolled);
  }

  async function handleToggleBiometric(val: boolean) {
    await setSetting(db, 'biometric_enabled', val ? 'true' : 'false');
    setBiometricEnabled(val);
  }

  async function handleTogglePin(val: boolean) {
    if (val) {
      setShowPinInput(true);
    } else {
      await setSetting(db, 'pin_enabled', 'false');
      setPinEnabled(false);
      setConfirmModal({
        visible: true,
        type: 'info',
        icon: '🔓',
        title: 'Kunci PIN Dinonaktifkan',
        message: 'Aplikasi sekarang dapat dibuka langsung tanpa memasukkan PIN.',
        cancelText: '',
        confirmText: 'Mengerti',
        onConfirm: closeConfirmModal,
      });
    }
  }

  async function handleSaveNewPin() {
    if (newPin.length !== 4) {
      Alert.alert('Perhatian', 'PIN harus 4 digit angka');
      return;
    }
    await setSetting(db, 'app_pin', newPin);
    await setSetting(db, 'pin_enabled', 'true');
    setPinEnabled(true);
    setShowPinInput(false);
    setNewPin('');
    setPinSuccessModalVisible(true);
  }

  async function handleAddCategory() {
    if (!newCatName.trim()) return;
    try {
      await addCategory(db, newCatName.trim(), selectedEmoji);
      setNewCatName('');
      setShowAddCategory(false);
      loadData();
    } catch {
      Alert.alert('Error', 'Kategori sudah ada');
    }
  }

  async function handleDeleteCategory(id: number, name: string) {
    setConfirmModal({
      visible: true,
      type: 'danger',
      icon: '🗑️',
      title: 'Hapus Kategori',
      message: `Hapus kategori "${name}"? Kategori yang dihapus tidak dapat dipulihkan.`,
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
    const isArchived = activeCashbook.is_archived === 1;
    setConfirmModal({
      visible: true,
      type: 'warning',
      icon: isArchived ? '📤' : '📦',
      title: isArchived ? 'Buka Arsip Catatan' : 'Arsipkan Catatan',
      message: isArchived
        ? `Kembalikan catatan "${activeCashbook.name}" ke daftar aktif beranda?`
        : `Arsipkan catatan "${activeCashbook.name}"? Data tetap tersimpan aman dan bisa dibuka kembali kapan saja.`,
      cancelText: 'Batal',
      confirmText: isArchived ? 'Buka Arsip' : 'Arsipkan',
      onConfirm: async () => {
        closeConfirmModal();
        await toggleArchiveCashbook(db, cashbookId);
        if (router.canGoBack()) router.back();
        else router.replace('/');
      },
    });
  }

  async function handleDeleteCashbook() {
    if (!activeCashbook) return;

    setConfirmModal({
      visible: true,
      type: 'danger',
      icon: '🗑️',
      title: 'Hapus Catatan Permanen',
      message: `Yakin ingin menghapus "${activeCashbook.name}" beserta seluruh transaksi, dompet, dan hutang di dalamnya? Tindakan ini permanen dan tidak bisa dibatalkan!`,
      cancelText: 'Batal',
      confirmText: 'Hapus Permanen',
      onConfirm: async () => {
        closeConfirmModal();
        await deleteCashbook(db, cashbookId);
        setActiveCashbook(null);
        if (router.canGoBack()) router.back();
        else router.replace('/');
      },
    });
  }

  async function handleExportPDF() {
    try {
      const [txs, debts, summary] = await Promise.all([
        getTransactions(db, cashbookId),
        getDebts(db, cashbookId),
        getMonthlySummary(db, cashbookId, year, month),
      ]);

      if (txs.length === 0 && debts.length === 0) {
        Alert.alert('Info', 'Belum ada data untuk dibuat laporan PDF');
        return;
      }

      await generateAndSharePdfReport({
        cashbookName: activeCashbook?.name ?? 'Catatan Keuangan',
        periodText: `${getMonthName(month)} ${year}`,
        summary,
        transactions: txs,
        debts,
      });
    } catch {
      Alert.alert('Error', 'Gagal memproses ekspor PDF');
    }
  }

  async function handleExportCSV() {
    try {
      const transactions = await getTransactions(db, cashbookId);
      if (transactions.length === 0) {
        Alert.alert('Info', 'Tidak ada transaksi untuk diekspor');
        return;
      }

      let csv = 'Tanggal,Tipe,Kategori,Dompet,Jumlah,Catatan\n';
      for (const t of transactions) {
        csv += `${t.date},${t.type === 'income' ? 'Pemasukan' : 'Pengeluaran'},${t.category_name},${t.account_name ?? 'Dompet'},${t.amount},\"${t.note}\"\n`;
      }

      const filename = `catatan-${activeCashbook?.name.replace(/\s+/g, '-').toLowerCase() ?? 'export'}.csv`;
      const file = new File(Paths.document, filename);
      await file.write(csv);

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: `Export ${activeCashbook?.name}` });
      } else {
        Alert.alert('Info', 'Sharing tidak tersedia di device ini');
      }
    } catch {
      Alert.alert('Error', 'Gagal mengekspor data');
    }
  }

  async function handleBackupDatabase() {
    try {
      await exportBackup(db);
    } catch (err: any) {
      Alert.alert('Gagal Backup', err.message || 'Terjadi kesalahan saat mencadangkan data');
    }
  }

  async function handleBackupToLocal() {
    try {
      const res = await exportBackupToLocalStorage(db);
      if (res.success) {
        setConfirmModal({
          visible: true,
          type: 'info',
          icon: '📁',
          title: 'Cadangan Tersimpan',
          message: `File cadangan "${res.filename}" berhasil disimpan ke folder ${res.directoryName || 'Lokal HP'}.`,
          cancelText: '',
          confirmText: 'Selesai',
          onConfirm: closeConfirmModal,
        });
      }
    } catch (err: any) {
      setConfirmModal({
        visible: true,
        type: 'danger',
        icon: '❌',
        title: 'Gagal Menyimpan',
        message: err.message || 'Terjadi kesalahan saat menyimpan ke memori lokal.',
        cancelText: '',
        confirmText: 'Tutup',
        onConfirm: closeConfirmModal,
      });
    }
  }

  async function handleExportSingleCashbook() {
    if (!activeCashbook) return;
    try {
      await exportSingleCashbook(db, cashbookId);
    } catch (err: any) {
      Alert.alert('Gagal Ekspor', err.message || 'Terjadi kesalahan saat membagikan catatan');
    }
  }

  async function handleImportSingleCashbook() {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/*'],
        copyToCacheDirectory: true,
      });

      if (res.canceled || !res.assets || res.assets.length === 0) return;

      const asset = res.assets[0];
      const file = new File(asset.uri);
      const jsonStr = await file.text();

      const outcome = await importSingleCashbook(db, jsonStr);
      Alert.alert('Sukses', `Catatan "${outcome.cashbookName}" berhasil diimpor dengan ${outcome.txCount} transaksi!`, [
        {
          text: 'Buka Daftar Catatan',
          onPress: () => {
            if (router.canGoBack()) router.back();
            else router.replace('/');
          },
        },
      ]);
    } catch (err: any) {
      Alert.alert('Gagal Impor', err.message || 'File tidak valid');
    }
  }

  async function handleRestoreDatabase() {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/*'],
        copyToCacheDirectory: true,
      });

      if (res.canceled || !res.assets || res.assets.length === 0) {
        return;
      }

      const asset = res.assets[0];
      const file = new File(asset.uri);
      const jsonStr = await file.text();

      setConfirmModal({
        visible: true,
        type: 'danger',
        icon: '⚠️',
        title: 'Konfirmasi Pulihkan Data',
        message: 'Seluruh catatan, dompet, transaksi, dan target menabung saat ini akan DITIMPA dengan data dari file cadangan ini. Lanjutkan?',
        cancelText: 'Batal',
        confirmText: 'Ya, Pulihkan Sekarang',
        onConfirm: async () => {
          closeConfirmModal();
          try {
            const outcome = await restoreBackup(db, jsonStr);
            setConfirmModal({
              visible: true,
              type: 'info',
              icon: '🎉',
              title: 'Pemulihan Sukses',
              message: outcome.message,
              cancelText: '',
              confirmText: 'Buka Catatan',
              onConfirm: () => {
                closeConfirmModal();
                if (router.canGoBack()) router.back();
                else router.replace('/');
              },
            });
          } catch (e: any) {
            setConfirmModal({
              visible: true,
              type: 'danger',
              icon: '❌',
              title: 'Gagal Memulihkan',
              message: e.message || 'File tidak kompatibel',
              cancelText: '',
              confirmText: 'Tutup',
              onConfirm: closeConfirmModal,
            });
          }
        },
      });
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Gagal membuka file backup');
    }
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: palette.canvas }]}
      contentContainerStyle={styles.content}
    >
      <View
        style={[
          styles.header,
          { backgroundColor: palette.card, borderBottomColor: palette.border },
        ]}
      >
        <Text style={[styles.subTitle, { color: palette.primary }]}>
          {activeCashbook?.name ?? 'Catatan'}
        </Text>
        <Text style={[styles.title, { color: palette.ink }]}>Pengaturan ⚙️</Text>
      </View>

      {/* Ekspor Laporan */}
      <View style={[styles.section, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <Text style={[styles.sectionTitle, { color: palette.ink }]}>Laporan & Ekspor</Text>
        <Pressable
          style={({ pressed }) => [styles.btnPrimary, pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }]}
          onPress={handleExportPDF}
        >
          <Text style={styles.btnPrimaryText}>📑 Ekspor Laporan PDF</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.btnSecondary,
            { backgroundColor: palette.cardMuted, borderColor: palette.borderSubtle, marginTop: 10 },
            pressed && { opacity: 0.8 },
          ]}
          onPress={handleExportCSV}
        >
          <Text style={[styles.btnSecondaryText, { color: palette.ink }]}>📊 Ekspor ke CSV / Excel</Text>
        </Pressable>
      </View>

      {/* Cadangkan & Pulihkan */}
      <View style={[styles.section, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <Text style={[styles.sectionTitle, { color: palette.ink }]}>Cadangkan & Pulihkan</Text>
        <Text style={[styles.hintSection, { color: palette.inkSecondary }]}>
          Simpan seluruh buku catatan, transaksi, dan target tabungan ke file JSON. 100% aman dan hemat baterai tanpa proses latar belakang.
        </Text>

        <Pressable
          style={({ pressed }) => [styles.btnPrimary, pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }]}
          onPress={handleBackupToLocal}
        >
          <Text style={styles.btnPrimaryText}>📁 Cadangkan ke Lokal</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.btnSecondary,
            { backgroundColor: palette.cardMuted, borderColor: palette.borderSubtle, marginTop: 10 },
            pressed && { opacity: 0.8 },
          ]}
          onPress={handleBackupDatabase}
        >
          <Text style={[styles.btnSecondaryText, { color: palette.ink }]}>☁️ Cadangkan ke Google Drive</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.btnSecondary,
            { backgroundColor: palette.cardMuted, borderColor: palette.borderSubtle, marginTop: 10 },
            pressed && { opacity: 0.8 },
          ]}
          onPress={handleRestoreDatabase}
        >
          <Text style={[styles.btnSecondaryText, { color: palette.ink }]}>📥 Pulihkan Data (Restore)</Text>
        </Pressable>
      </View>

      {/* Berbagi Catatan (P2P Catatan Organisasi) */}
      <View style={[styles.section, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <Text style={[styles.sectionTitle, { color: palette.ink }]}>Berbagi Catatan Organisasi</Text>
        <Text style={[styles.hintSection, { color: palette.inkSecondary }]}>
          Kirim hanya catatan "{activeCashbook?.name}" ke bendahara atau anggota tim lain tanpa menyertakan catatan pribadi.
        </Text>

        <Pressable
          style={({ pressed }) => [
            styles.btnSecondary,
            { backgroundColor: palette.cardMuted, borderColor: palette.borderSubtle },
            pressed && { opacity: 0.8 },
          ]}
          onPress={handleExportSingleCashbook}
        >
          <Text style={[styles.btnSecondaryText, { color: palette.ink }]}>📤 Bagikan Catatan Ini</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.btnSecondary,
            { backgroundColor: palette.cardMuted, borderColor: palette.borderSubtle, marginTop: 10 },
            pressed && { opacity: 0.8 },
          ]}
          onPress={handleImportSingleCashbook}
        >
          <Text style={[styles.btnSecondaryText, { color: palette.ink }]}>📥 Impor Catatan Baru</Text>
        </Pressable>
      </View>

      {/* Otomasi Transaksi Berulang */}
      <View style={[styles.section, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <Text style={[styles.sectionTitle, { color: palette.ink }]}>Transaksi Berulang & Tagihan</Text>
        <Text style={[styles.hintSection, { color: palette.inkSecondary }]}>
          Atur pengeluaran rutin otomatis seperti iuran, WiFi, sewa tempat, atau gaji bulanan.
        </Text>
        <Pressable
          style={({ pressed }) => [
            styles.btnSecondary,
            { backgroundColor: palette.cardMuted, borderColor: palette.borderSubtle },
            pressed && { opacity: 0.8 },
          ]}
          onPress={() => router.push('/recurring')}
        >
          <Text style={[styles.btnSecondaryText, { color: palette.ink }]}>🔄 Transaksi Berulang</Text>
        </Pressable>
      </View>

      {/* Keamanan PIN */}
      <View style={[styles.section, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <View style={styles.switchRow}>
          <View>
            <Text style={[styles.sectionTitle, { color: palette.ink }]}>Kunci Keamanan PIN</Text>
            <Text style={[styles.hint, { color: palette.inkMuted }]}>Minta 4 digit PIN saat aplikasi dibuka</Text>
          </View>
          <Switch value={pinEnabled} onValueChange={handleTogglePin} />
        </View>

        {pinEnabled && hasBiometricSensor && (
          <View style={[styles.switchRow, { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: palette.borderSubtle }]}>
            <View>
              <Text style={[styles.sectionTitle, { color: palette.ink }]}>Kunci Sidik Jari / Biometrik</Text>
              <Text style={[styles.hint, { color: palette.inkMuted }]}>Gunakan sidik jari atau Face Unlock</Text>
            </View>
            <Switch value={biometricEnabled} onValueChange={handleToggleBiometric} />
          </View>
        )}

        {showPinInput && (
          <View style={[styles.pinForm, { backgroundColor: palette.cardMuted }]}>
            <Text style={[styles.label, { color: palette.inkSecondary }]}>Setel 4 Digit PIN Baru:</Text>
            <TextInput
              style={[styles.pinInput, { backgroundColor: palette.card, borderColor: palette.border, color: palette.ink }]}
              placeholder="••••"
              placeholderTextColor={palette.inkMuted}
              keyboardType="numeric"
              maxLength={4}
              secureTextEntry
              value={newPin}
              onChangeText={setNewPin}
            />
            <Pressable
              style={({ pressed }) => [styles.btnPrimary, { marginTop: 10 }, pressed && { opacity: 0.85 }]}
              onPress={handleSaveNewPin}
            >
              <Text style={styles.btnPrimaryText}>Simpan PIN</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Kelola Catatan Ini */}
      <View style={[styles.section, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <Text style={[styles.sectionTitle, { color: palette.ink }]}>Kelola Catatan ({activeCashbook?.name})</Text>
        <View style={styles.actionRow}>
          <Pressable
            style={({ pressed }) => [styles.btnPrimary, pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }]}
            onPress={() => router.push('/cashbook-modal')}
          >
            <Text style={styles.btnPrimaryText}>➕ Buat Catatan Baru</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.btnSecondary,
              { backgroundColor: palette.cardMuted, borderColor: palette.borderSubtle, marginTop: 10 },
              pressed && { opacity: 0.8 },
            ]}
            onPress={() => router.push({ pathname: '/cashbook-modal', params: { id: cashbookId.toString() } })}
          >
            <Text style={[styles.btnSecondaryText, { color: palette.ink }]}>✏️ Edit Info Catatan</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.btnSecondary,
              { backgroundColor: palette.cardMuted, borderColor: palette.borderSubtle, marginTop: 10 },
              pressed && { opacity: 0.8 },
            ]}
            onPress={handleToggleArchive}
          >
            <Text style={[styles.btnSecondaryText, { color: palette.ink }]}>
              {activeCashbook?.is_archived === 1 ? '📤 Buka Arsip Catatan' : '📦 Arsipkan Catatan'}
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.btnDanger, pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }, { marginTop: 10 }]}
            onPress={handleDeleteCashbook}
          >
            <Text style={styles.btnDangerText}>🗑️ Hapus Catatan Ini</Text>
          </Pressable>
        </View>
      </View>

      {/* Categories */}
      <View style={[styles.section, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: palette.ink }]}>Kategori Transaksi</Text>
          <Pressable onPress={() => setShowAddCategory(!showAddCategory)}>
            <Text style={[styles.addLink, { color: palette.primary }]}>{showAddCategory ? 'Batal' : '+ Tambah'}</Text>
          </Pressable>
        </View>

        {showAddCategory && (
          <View style={[styles.addCategoryForm, { backgroundColor: palette.cardMuted, borderColor: palette.border }]}>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: palette.card,
                  borderColor: palette.borderSubtle,
                  color: palette.ink,
                },
              ]}
              placeholder="Nama kategori"
              placeholderTextColor={palette.inkMuted}
              value={newCatName}
              onChangeText={setNewCatName}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.emojiRow}>
              {EMOJI_LIST.map((emoji) => (
                <Pressable
                  key={emoji}
                  style={[
                    styles.emojiBtn,
                    { backgroundColor: palette.card, borderColor: palette.borderSubtle },
                    selectedEmoji === emoji && { backgroundColor: palette.primarySurface, borderColor: palette.primary, borderWidth: 2 },
                  ]}
                  onPress={() => setSelectedEmoji(emoji)}
                >
                  <Text style={styles.emojiBtnText}>{emoji}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable
              style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.8 }]}
              onPress={handleAddCategory}
            >
              <Text style={styles.saveBtnText}>Simpan Kategori</Text>
            </Pressable>
          </View>
        )}

        {categories.map((cat) => (
          <View key={cat.id} style={[styles.categoryItem, { borderBottomColor: palette.borderSubtle }]}>
            <Text style={styles.categoryIcon}>{cat.icon}</Text>
            <Text style={[styles.categoryName, { color: palette.ink }]}>{cat.name}</Text>
            {cat.is_default === 0 && (
              <Pressable
                hitSlop={8}
                style={({ pressed }) => [styles.categoryDeleteBtn, pressed && { opacity: 0.6 }]}
                onPress={() => handleDeleteCategory(cat.id, cat.name)}
              >
                <Text style={styles.categoryDeleteText}>🗑️</Text>
              </Pressable>
            )}
          </View>
        ))}
      </View>

      {/* Switch Book Link */}
      <View style={[styles.section, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <Pressable
          style={({ pressed }) => [
            styles.switchBtn,
            { backgroundColor: palette.cardMuted, borderColor: palette.borderSubtle },
            pressed && { opacity: 0.8 },
          ]}
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/');
          }}
        >
          <Text style={[styles.switchBtnText, { color: palette.primary }]}>📝 Kembali ke Daftar Catatan</Text>
        </Pressable>
      </View>

      <View style={{ height: 80 }} />

      {/* Modern Pop-up PIN Activated Modal */}
      <Modal
        visible={pinSuccessModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPinSuccessModalVisible(false)}
      >
        <View style={styles.successModalOverlay}>
          <View style={[styles.successModalCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={styles.successIconBadge}>
              <Text style={styles.successIconText}>🛡️</Text>
            </View>
            <Text style={[styles.successModalTitle, { color: palette.ink }]}>PIN Keamanan Aktif</Text>
            <Text style={[styles.successModalDesc, { color: palette.inkMuted }]}>
              Aplikasi kini terlindungi secara aman dengan 4 digit PIN saat dibuka.
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.successModalBtn,
                pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
              ]}
              onPress={() => setPinSuccessModalVisible(false)}
            >
              <Text style={styles.successModalBtnText}>Mengerti</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Universal Modern Confirm Modal */}
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
  container: { flex: 1, backgroundColor: PALETTE.canvas },
  content: { paddingBottom: 20 },
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 12, backgroundColor: PALETTE.card, borderBottomWidth: 1, borderBottomColor: PALETTE.border },
  subTitle: { fontSize: 13, fontWeight: '700', color: PALETTE.primary },
  title: { fontSize: 24, fontWeight: '800', color: PALETTE.ink, marginTop: 2 },
  section: {
    backgroundColor: PALETTE.card,
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: PALETTE.ink, marginBottom: 6 },
  hint: { fontSize: 12, color: PALETTE.inkMuted, fontWeight: '500' },
  hintSection: { fontSize: 12, color: PALETTE.inkSecondary, lineHeight: 18, marginBottom: 14, fontWeight: '500' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pinForm: { marginTop: 12, padding: 12, backgroundColor: PALETTE.cardMuted, borderRadius: 12 },
  label: { fontSize: 13, fontWeight: '600', color: PALETTE.inkSecondary, marginBottom: 6 },
  pinInput: {
    backgroundColor: PALETTE.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: PALETTE.border,
    padding: 10,
    fontSize: 20,
    letterSpacing: 8,
    textAlign: 'center',
    color: PALETTE.ink,
  },
  addLink: { fontSize: 14, fontWeight: '700', color: PALETTE.primary },
  actionRow: { marginTop: 4 },
  btnPrimary: {
    backgroundColor: PALETTE.primary,
    borderRadius: 14,
    minHeight: 48,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...PALETTE.shadowLight,
  },
  btnPrimaryText: {
    fontFamily: FONTS.sansBold,
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  btnSecondary: {
    backgroundColor: PALETTE.cardMuted,
    borderRadius: 14,
    minHeight: 48,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  btnSecondaryText: {
    fontFamily: FONTS.sansBold,
    fontSize: 14,
    fontWeight: '700',
    color: PALETTE.ink,
  },
  btnDanger: {
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    minHeight: 48,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  btnDangerText: {
    fontFamily: FONTS.sansBold,
    fontSize: 14,
    fontWeight: '700',
    color: '#DC2626',
  },
  switchBtn: {
    backgroundColor: PALETTE.primarySurface,
    borderRadius: 14,
    minHeight: 48,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  switchBtnText: {
    fontFamily: FONTS.sansBold,
    fontSize: 14,
    fontWeight: '700',
    color: PALETTE.primary,
  },
  addCategoryForm: {
    backgroundColor: PALETTE.cardMuted,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#0F172A',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  emojiRow: { marginBottom: 8 },
  emojiBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginRight: 6,
  },
  emojiBtnSelected: {
    backgroundColor: '#DBEAFE',
    borderWidth: 2,
    borderColor: '#2563EB',
  },
  emojiBtnText: { fontSize: 20 },
  saveBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  categoryIcon: { fontSize: 20, marginRight: 12 },
  categoryName: { flex: 1, fontSize: 15, color: '#0F172A' },
  categoryDeleteBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryDeleteText: {
    fontSize: 13,
  },
  successModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successModalCard: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    ...PALETTE.shadowMedium,
  },
  successIconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(45, 106, 79, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successIconText: {
    fontSize: 32,
  },
  successModalTitle: {
    fontFamily: FONTS.serifTitle,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  successModalDesc: {
    fontFamily: FONTS.sansRegular,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
  },
  successModalBtn: {
    backgroundColor: PALETTE.primary,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
  },
  successModalBtnText: {
    fontFamily: FONTS.sansBold,
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
