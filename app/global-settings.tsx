import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  TextInput,
  Modal,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import Constants from 'expo-constants';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { useFocusEffect, router, Stack } from 'expo-router';
import { useThemeStore } from '../src/stores/useThemeStore';
import {
  getSetting,
  setSetting,
} from '../src/database/queries';
import {
  exportBackup,
  exportBackupToLocalStorage,
  restoreBackup,
} from '../src/utils/backup';
import { checkForAppUpdate, openDownloadPage } from '../src/utils/appUpdater';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as LocalAuthentication from 'expo-local-authentication';
import { FONTS } from '../src/constants/theme';
import { BackArrowIcon } from '../src/components/ActionIcons';
import { ModernConfirmModal, type ModalType } from '../src/components/ModernConfirmModal';

export default function GlobalSettingsScreen() {
  const db = useSQLiteContext();
  const { width } = useWindowDimensions();
  const isTablet = width >= 600;
  const { isDarkMode, palette, toggleTheme } = useThemeStore();

  // PIN & Biometric
  const [pinEnabled, setPinEnabled] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(true);
  const [hasBiometricSensor, setHasBiometricSensor] = useState(false);
  const [showPinInput, setShowPinInput] = useState(false);
  const [newPin, setNewPin] = useState('');

  // Info Modals
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showFaqModal, setShowFaqModal] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  // Modern Confirm Modal
  const [confirmModal, setConfirmModal] = useState<{
    visible: boolean;
    type: ModalType;
    icon?: string;
    title: string;
    message: string;
    cancelText?: string;
    confirmText?: string;
    onCancel?: () => void;
    onConfirm: () => Promise<void> | void;
  }>({
    visible: false,
    type: 'warning',
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const showModalAlert = (
    title: string,
    message: string,
    type: ModalType = 'info',
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

  const closeConfirmModal = () => {
    setConfirmModal((prev) => ({ ...prev, visible: false }));
  };

  const loadSettings = useCallback(async () => {
    try {
      const pin = await getSetting(db, 'app_pin');
      setPinEnabled(!!pin);

      const bio = await getSetting(db, 'biometric_enabled');
      setBiometricEnabled(bio !== '0');

      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      setHasBiometricSensor(hasHardware && isEnrolled);
    } catch (e) {
      console.warn('loadSettings error:', e);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, [loadSettings])
  );

  async function handleTogglePin(val: boolean) {
    if (val) {
      setShowPinInput(true);
      setNewPin('');
    } else {
      setConfirmModal({
        visible: true,
        type: 'warning',
        icon: '🔓',
        title: 'Nonaktifkan PIN Keamanan',
        message: 'Aplikasi tidak lagi meminta PIN atau sidik jari saat dibuka. Lanjutkan?',
        cancelText: 'Batal',
        confirmText: 'Ya, Matikan',
        onConfirm: async () => {
          closeConfirmModal();
          await setSetting(db, 'app_pin', '');
          setPinEnabled(false);
        },
      });
    }
  }

  async function handleSavePin() {
    if (newPin.length !== 4 && newPin.length !== 6) {
      showModalAlert('Perhatian', 'PIN harus berupa 4 atau 6 digit angka', 'warning');
      return;
    }
    await setSetting(db, 'app_pin', newPin);
    setPinEnabled(true);
    setShowPinInput(false);
    setNewPin('');
    showModalAlert('Sukses', 'PIN keamanan berhasil diaktifkan.', 'success', '🔒');
  }

  async function handleToggleBiometric(val: boolean) {
    setBiometricEnabled(val);
    await setSetting(db, 'biometric_enabled', val ? '1' : '0');
  }

  return (
    <View style={[styles.container, { backgroundColor: palette.canvas }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: palette.card, borderBottomColor: palette.border }]}>
        <View style={[styles.headerInner, isTablet && { maxWidth: 740, width: '100%', alignSelf: 'center' }]}>
          <Pressable
            style={({ pressed }) => [styles.backBtn, { backgroundColor: palette.cardMuted }, pressed && { opacity: 0.7 }]}
            onPress={() => router.back()}
          >
            <BackArrowIcon color={palette.ink} size={18} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: palette.ink }]}>Pengaturan Aplikasi ⚙️</Text>
          <View style={{ width: 36 }} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          isTablet && { maxWidth: 740, width: '100%', alignSelf: 'center' },
          { flexGrow: 1 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Seksi 1: Tampilan & Tema */}
        <Text style={[styles.sectionTitle, { color: palette.inkSecondary }]}>TAMPILAN & TEMA</Text>
        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingLabel, { color: palette.ink }]}>Mode Gelap (Dark Mode)</Text>
              <Text style={[styles.settingDesc, { color: palette.inkMuted }]}>
                {isDarkMode ? 'Menghemat baterai dan nyaman di mata malam hari' : 'Tampilan terang bersih dan elegan'}
              </Text>
            </View>
            <Switch
              value={isDarkMode}
              onValueChange={() => toggleTheme(db)}
              trackColor={{ false: palette.border, true: palette.primary }}
            />
          </View>
        </View>

        {/* Seksi 2: Keamanan & Privasi */}
        <Text style={[styles.sectionTitle, { color: palette.inkSecondary }]}>KEAMANAN & PRIVASI</Text>
        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingLabel, { color: palette.ink }]}>Kunci Aplikasi dengan PIN</Text>
              <Text style={[styles.settingDesc, { color: palette.inkMuted }]}>
                Wajibkan input PIN angka saat aplikasi dibuka
              </Text>
            </View>
            <Switch
              value={pinEnabled}
              onValueChange={handleTogglePin}
              trackColor={{ false: palette.border, true: palette.primary }}
            />
          </View>

          {pinEnabled && hasBiometricSensor && (
            <View style={[styles.settingRow, { borderTopWidth: 1, borderTopColor: palette.borderSubtle }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingLabel, { color: palette.ink }]}>Buka dengan Sidik Jari / Biometrik</Text>
                <Text style={[styles.settingDesc, { color: palette.inkMuted }]}>
                  Autentikasi instan menggunakan sensor perangkat
                </Text>
              </View>
              <Switch
                value={biometricEnabled}
                onValueChange={handleToggleBiometric}
                trackColor={{ false: palette.border, true: palette.primary }}
              />
            </View>
          )}

          {pinEnabled && (
            <Pressable
              style={({ pressed }) => [
                styles.linkRow,
                { borderTopWidth: 1, borderTopColor: palette.borderSubtle },
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => {
                setShowPinInput(true);
                setNewPin('');
              }}
            >
              <Text style={[styles.linkLabel, { color: palette.primary }]}>🔑 Ganti Kode PIN</Text>
              <Text style={[styles.linkArrow, { color: palette.inkMuted }]}>›</Text>
            </Pressable>
          )}
        </View>

        {/* Seksi 3: Cadangan & Pemulihan Data */}
        <Text style={[styles.sectionTitle, { color: palette.inkSecondary }]}>CADANGAN & DATA (BACKUP)</Text>
        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Pressable
            style={({ pressed }) => [styles.actionRow, pressed && { opacity: 0.7 }]}
            onPress={async () => {
              try {
                await exportBackup(db);
              } catch {
                showModalAlert('Gagal', 'Terjadi kesalahan saat membagikan backup.', 'danger');
              }
            }}
          >
            <View style={styles.actionLeft}>
              <Text style={styles.actionIcon}>📤</Text>
              <View>
                <Text style={[styles.actionTitle, { color: palette.ink }]}>Bagikan Cadangan Lengkap</Text>
                <Text style={[styles.actionDesc, { color: palette.inkMuted }]}>
                  Ekspor file backup seluruh catatan ke WA, Drive, atau Email
                </Text>
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
                const res = await exportBackupToLocalStorage(db);
                showModalAlert('Cadangan Tersimpan', `Berkas cadangan berhasil disimpan:\n${res.filename} (Folder: ${res.directoryName || 'Dokumen'})`, 'success', '💾');
              } catch {
                showModalAlert('Gagal', 'Tidak dapat menyimpan cadangan di penyimpanan lokal.', 'danger');
              }
            }}
          >
            <View style={styles.actionLeft}>
              <Text style={styles.actionIcon}>💾</Text>
              <View>
                <Text style={[styles.actionTitle, { color: palette.ink }]}>Simpan Cadangan ke Memori HP</Text>
                <Text style={[styles.actionDesc, { color: palette.inkMuted }]}>
                  Folder Dokumen lokal perangkat tanpa internet
                </Text>
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
            onPress={() => {
              setConfirmModal({
                visible: true,
                type: 'danger',
                icon: '⚠️',
                title: 'Pulihkan Data Database',
                message: 'Memulihkan data cadangan akan menimpa seluruh data catatan saat ini. Pastikan file cadangan valid. Lanjutkan?',
                cancelText: 'Batal',
                confirmText: 'Pilih File Backup',
                onConfirm: async () => {
                  closeConfirmModal();
                  try {
                    const docRes = await DocumentPicker.getDocumentAsync({
                      type: 'application/json',
                      copyToCacheDirectory: true,
                    });
                    if (!docRes.canceled && docRes.assets && docRes.assets.length > 0) {
                      const picked = docRes.assets[0];
                      const file = new File(picked.uri);
                      const text = await file.text();
                      const res = await restoreBackup(db, text);
                      if (res.success) {
                        showModalAlert('Sukses', `Data berhasil dipulihkan! Total ${res.count} catatan.`, 'success', '🎉');
                      }
                    }
                  } catch (err: any) {
                    showModalAlert('Gagal', err?.message || 'Gagal memulihkan cadangan.', 'danger');
                  }
                },
              });
            }}
          >
            <View style={styles.actionLeft}>
              <Text style={styles.actionIcon}>📥</Text>
              <View>
                <Text style={[styles.actionTitle, { color: palette.expense }]}>Pulihkan Data (Restore)</Text>
                <Text style={[styles.actionDesc, { color: palette.inkMuted }]}>
                  Kembalikan data dari berkas .json cadangan
                </Text>
              </View>
            </View>
            <Text style={[styles.linkArrow, { color: palette.inkMuted }]}>›</Text>
          </Pressable>
        </View>

        {/* Seksi 4: Informasi & Bantuan */}
        <Text style={[styles.sectionTitle, { color: palette.inkSecondary }]}>INFORMASI & BANTUAN</Text>
        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Pressable
            style={({ pressed }) => [styles.actionRow, pressed && { opacity: 0.7 }]}
            onPress={() => setShowFaqModal(true)}
          >
            <View style={styles.actionLeft}>
              <Text style={styles.actionIcon}>💡</Text>
              <View>
                <Text style={[styles.actionTitle, { color: palette.ink }]}>Panduan Penggunaan & FAQ</Text>
                <Text style={[styles.actionDesc, { color: palette.inkMuted }]}>Cara kerja multi-buku kas & tips aman offline</Text>
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
            onPress={() => setShowAboutModal(true)}
          >
            <View style={styles.actionLeft}>
              <Text style={styles.actionIcon}>📱</Text>
              <View>
                <Text style={[styles.actionTitle, { color: palette.ink }]}>Tentang CatatKu (About)</Text>
                <Text style={[styles.actionDesc, { color: palette.inkMuted }]}>Versi rilis, lisensi, dan privasi finansial</Text>
              </View>
            </View>
            <Text style={[styles.linkArrow, { color: palette.inkMuted }]}>›</Text>
          </Pressable>
        </View>

        {/* Footer Copyright Terkunci di Paling Bawah */}
        <View style={styles.footerWrap}>
          <Text style={[styles.footerText, { color: palette.inkMuted }]}>© 2026 CatatKu</Text>
        </View>
      </ScrollView>

      {/* Modal Input PIN */}
      <Modal visible={showPinInput} transparent animationType="fade" onRequestClose={() => setShowPinInput(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: palette.card, borderColor: palette.border }, isTablet && { maxWidth: 440 }]}>
            <Text style={[styles.modalTitle, { color: palette.ink }]}>Atur Kode PIN Baru</Text>
            <Text style={[styles.modalSubtitle, { color: palette.inkMuted }]}>
              Masukkan 4 atau 6 digit angka rahasia untuk melindungi aplikasi Anda.
            </Text>

            <TextInput
              style={[styles.pinInput, { backgroundColor: palette.cardMuted, borderColor: palette.border, color: palette.ink }]}
              placeholder="••••"
              placeholderTextColor={palette.inkMuted}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
              value={newPin}
              onChangeText={setNewPin}
              autoFocus
            />

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.cancelModalBtn, { borderColor: palette.border }]}
                onPress={() => setShowPinInput(false)}
              >
                <Text style={[styles.cancelModalBtnText, { color: palette.inkMuted }]}>Batal</Text>
              </Pressable>
              <Pressable
                style={[styles.saveModalBtn, { backgroundColor: palette.primary }]}
                onPress={handleSavePin}
              >
                <Text style={styles.saveModalBtnText}>Aktifkan PIN</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal FAQ */}
      <Modal visible={showFaqModal} transparent animationType="slide" onRequestClose={() => setShowFaqModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: palette.card, borderColor: palette.border }, isTablet && { maxWidth: 540 }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: palette.ink }]}>Panduan Singkat & FAQ</Text>
              <Pressable onPress={() => setShowFaqModal(false)} hitSlop={8}>
                <Text style={[styles.closeText, { color: palette.inkMuted }]}>✕</Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
              <Text style={[styles.faqQ, { color: palette.ink }]}>Apakah data saya aman dan bisa diakses orang lain?</Text>
              <Text style={[styles.faqA, { color: palette.inkMuted }]}>
                Sangat aman. CatatKu beroperasi 100% offline-first. Seluruh catatan tersimpan di basis data lokal SQLite perangkat Anda tanpa pengiriman data ke server mana pun.
              </Text>

              <Text style={[styles.faqQ, { color: palette.ink }]}>Bagaimana cara memindahkan data ke HP baru?</Text>
              <Text style={[styles.faqA, { color: palette.inkMuted }]}>
                Gunakan menu &quot;Bagikan Cadangan Lengkap&quot; di pengaturan ini, kirim file backup (.json) ke HP baru Anda, lalu buka menu &quot;Pulihkan Data&quot; di HP baru.
              </Text>

              <Text style={[styles.faqQ, { color: palette.ink }]}>Apa beda Pengaturan Aplikasi dan Pengaturan Catatan?</Text>
              <Text style={[styles.faqA, { color: palette.inkMuted }]}>
                Pengaturan Aplikasi (halaman ini) mengatur keamanan PIN, tema, backup keseluruhan, dan info aplikasi. Sedangkan pengaturan di tab catatan khusus mengatur nama, anggaran budget, dan kategori catatan aktif yang sedang dibuka.
              </Text>
            </ScrollView>

            <Pressable
              style={[styles.fullModalBtn, { backgroundColor: palette.primary, marginTop: 14 }]}
              onPress={() => setShowFaqModal(false)}
            >
              <Text style={styles.saveModalBtnText}>Saya Mengerti</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Modal About Profesional (Tanpa Status Arsitektur) */}
      <Modal visible={showAboutModal} transparent animationType="slide" onRequestClose={() => setShowAboutModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: palette.card, borderColor: palette.border }, isTablet && { maxWidth: 540 }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: palette.ink }]}>Tentang Aplikasi</Text>
              <Pressable onPress={() => setShowAboutModal(false)} hitSlop={8}>
                <Text style={[styles.closeText, { color: palette.inkMuted }]}>✕</Text>
              </Pressable>
            </View>

            <View style={styles.aboutBadgeRow}>
              <Text style={{ fontSize: 44 }}>📱💰</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.aboutAppTitle, { color: palette.ink }]}>CatatKu</Text>
                <Text style={[styles.aboutAppVersion, { color: palette.primary }]}>
                  Versi {Constants.expoConfig?.version || '1.0.0'}
                </Text>
                <Text style={[styles.aboutTagline, { color: palette.inkMuted }]}>Catatan Rapi, Finansial Pasti</Text>
              </View>
            </View>

            {/* Tombol Cek Pembaruan di Dalam Modal About */}
            <Pressable
              style={({ pressed }) => [
                styles.checkUpdateBtn,
                { backgroundColor: palette.cardMuted, borderColor: palette.border },
                pressed && { opacity: 0.8 },
              ]}
              disabled={checkingUpdate}
              onPress={async () => {
                setCheckingUpdate(true);
                try {
                  const res = await checkForAppUpdate();
                  if (res.error) {
                    showModalAlert('Pemeriksaan Gagal', res.error, 'danger', '⚠️');
                    return;
                  }

                  if (res.hasUpdate) {
                    setShowAboutModal(false);
                    setConfirmModal({
                      visible: true,
                      type: 'info',
                      icon: '🚀',
                      title: `Pembaruan Tersedia (v${res.latestVersion})`,
                      message: `Versi terbaru v${res.latestVersion} telah dirilis!\n\nCatatan Rilis:\n${res.releaseNotes || 'Peningkatan stabilitas aplikasi.'}`,
                      cancelText: 'Nanti Saja',
                      confirmText: 'Unduh Sekarang',
                      onConfirm: () => {
                        setConfirmModal((prev) => ({ ...prev, visible: false }));
                        openDownloadPage(res.downloadUrl);
                      },
                    });
                  } else {
                    showModalAlert(
                      'Aplikasi Sudah Terbaru',
                      `Anda telah menggunakan versi terbaru (v${res.currentVersion}). Tidak ada pembaruan saat ini.`,
                      'success',
                      '✨'
                    );
                  }
                } catch {
                  showModalAlert('Gagal', 'Terjadi kesalahan saat memeriksa pembaruan.', 'danger', '⚠️');
                } finally {
                  setCheckingUpdate(false);
                }
              }}
            >
              <View style={styles.checkUpdateLeft}>
                <Text style={{ fontSize: 18 }}>🔄</Text>
                <View>
                  <Text style={[styles.checkUpdateTitle, { color: palette.ink }]}>Cek Pembaruan</Text>
                  <Text style={[styles.checkUpdateDesc, { color: palette.inkMuted }]}>
                    Periksa ketersediaan versi rilis terbaru di GitHub
                  </Text>
                </View>
              </View>
              {checkingUpdate ? (
                <ActivityIndicator size="small" color={palette.primary} />
              ) : (
                <Text style={[styles.linkArrow, { color: palette.inkMuted }]}>›</Text>
              )}
            </Pressable>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 240, marginVertical: 10 }}>
              <Text style={[styles.aboutPara, { color: palette.inkSecondary }]}>
                CatatKu dirancang sebagai software manajemen keuangan multi-catatan mandiri untuk mengelola arus kas pribadi, organisasi, dan bisnis secara privat, responsif, dan bebas ketergantungan jaringan.
              </Text>

              <Text style={[styles.aboutHeaderSec, { color: palette.ink }]}>Kebijakan Privasi</Text>
              <Text style={[styles.aboutPara, { color: palette.inkMuted }]}>
                Privasi adalah prioritas utama. Aplikasi ini tidak mengumpulkan data analitik pengguna, tidak memerlukan registrasi akun online, dan tidak melacak transaksi Anda.
              </Text>

              <Text style={[styles.aboutHeaderSec, { color: palette.ink }]}>Lisensi & Komponen Open Source</Text>
              <Text style={[styles.aboutPara, { color: palette.inkMuted }]}>
                Dibangun dengan framework React Native, Expo SDK 58, Expo Router, expo-sqlite, dan Zustand di bawah lisensi MIT.
              </Text>
            </ScrollView>

            <Pressable
              style={[styles.fullModalBtn, { backgroundColor: palette.primary }]}
              onPress={() => setShowAboutModal(false)}
            >
              <Text style={styles.saveModalBtnText}>Tutup</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

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
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: FONTS.serifTitle,
    fontSize: 18,
    fontWeight: '800',
  },
  content: {
    padding: 16,
    gap: 8,
  },
  sectionTitle: {
    fontFamily: FONTS.sansBold,
    fontSize: 11,
    letterSpacing: 0.5,
    marginTop: 14,
    marginBottom: 4,
    marginLeft: 4,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    gap: 12,
  },
  settingLabel: {
    fontFamily: FONTS.sansBold,
    fontSize: 14,
  },
  settingDesc: {
    fontFamily: FONTS.sansRegular,
    fontSize: 12,
    marginTop: 2,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  linkLabel: {
    fontFamily: FONTS.sansBold,
    fontSize: 13,
  },
  linkArrow: {
    fontSize: 18,
    fontFamily: FONTS.sansBold,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontFamily: FONTS.serifTitle,
    fontSize: 17,
    fontWeight: '800',
  },
  modalSubtitle: {
    fontFamily: FONTS.sansRegular,
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 18,
  },
  closeText: {
    fontSize: 18,
    fontFamily: FONTS.sansBold,
    padding: 4,
  },
  pinInput: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    textAlign: 'center',
    fontFamily: FONTS.sansBold,
    fontSize: 24,
    letterSpacing: 10,
    marginBottom: 18,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelModalBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelModalBtnText: {
    fontFamily: FONTS.sansBold,
    fontSize: 13,
  },
  saveModalBtn: {
    flex: 2,
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveModalBtnText: {
    fontFamily: FONTS.sansBold,
    fontSize: 13,
    color: '#FAF8F5',
  },
  fullModalBtn: {
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  faqQ: {
    fontFamily: FONTS.sansBold,
    fontSize: 13,
    marginTop: 10,
    marginBottom: 4,
  },
  faqA: {
    fontFamily: FONTS.sansRegular,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8,
  },
  aboutBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 10,
    marginBottom: 6,
  },
  aboutAppTitle: {
    fontFamily: FONTS.serifTitle,
    fontSize: 20,
    fontWeight: '800',
  },
  aboutAppVersion: {
    fontFamily: FONTS.sansBold,
    fontSize: 12,
    marginTop: 2,
  },
  aboutTagline: {
    fontFamily: FONTS.sansRegular,
    fontSize: 11,
    marginTop: 1,
  },
  checkUpdateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginVertical: 8,
  },
  checkUpdateLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  checkUpdateTitle: {
    fontFamily: FONTS.sansBold,
    fontSize: 13,
  },
  checkUpdateDesc: {
    fontFamily: FONTS.sansRegular,
    fontSize: 11,
    marginTop: 1,
  },
  aboutHeaderSec: {
    fontFamily: FONTS.sansBold,
    fontSize: 13,
    marginTop: 10,
    marginBottom: 4,
  },
  aboutPara: {
    fontFamily: FONTS.sansRegular,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8,
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
