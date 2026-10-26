import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  RefreshControl,
  Modal,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router, useFocusEffect, Stack } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CashbookCard from '../src/components/CashbookCard';
import {
  getCashbooksWithStats,
  processDueRecurringTransactions,
  getSetting,
  setSetting,
  type CashbookStats,
} from '../src/database/queries';
import { useCashbookStore } from '../src/stores/useCashbookStore';
import { useThemeStore } from '../src/stores/useThemeStore';
import { formatRupiah } from '../src/utils/currency';
import { FONTS } from '../src/constants/theme';
import {
  WalletActionIcon,
  TransferActionIcon,
  BudgetActionIcon,
  SavingsActionIcon,
  CashierActionIcon,
  DebtActionIcon,
  RecurringActionIcon,
  ExportActionIcon,
  CustomizeActionIcon,
  EyeOpenIcon,
  EyeClosedIcon,
  BellIcon,
  BillActionIcon,
  GearIcon,
} from '../src/components/ActionIcons';
import {
  checkDueReminders,
  triggerLocalNotificationIfDue,
  type DueReminderItem,
} from '../src/utils/notifications';
import { checkForAppUpdate, openDownloadPage, type UpdateCheckResult } from '../src/utils/appUpdater';
import OnboardingModal from '../src/components/OnboardingModal';
import { ModernConfirmModal, type ModalType } from '../src/components/ModernConfirmModal';

interface ShortcutItem {
  id: string;
  name: string;
  route: string;
  iconType: string;
}

const ALL_AVAILABLE_SHORTCUTS: ShortcutItem[] = [
  { id: 'wallets', name: 'Dompet', route: '/wallets', iconType: 'wallet' },
  { id: 'transfer', name: 'Transfer', route: '/transfer', iconType: 'transfer' },
  { id: 'recurring', name: 'Rutin', route: '/recurring', iconType: 'recurring' },
  { id: 'debts', name: 'Hutang', route: '/debts', iconType: 'debts' },
  { id: 'budget', name: 'Budget', route: '/category-budgets', iconType: 'budget' },
  { id: 'savings', name: 'Nabung', route: '/savings-goals', iconType: 'savings' },
  { id: 'cashier', name: 'Kasir', route: '/cashier-calculator', iconType: 'cashier' },
  { id: 'export', name: 'Laporan', route: '/(tabs)/reports', iconType: 'export' },
];

const DEFAULT_SHORTCUT_IDS = ['wallets', 'transfer', 'recurring', 'debts'];
const SETTINGS_KEY = 'home_screen_shortcuts_v1';

type BookTypeFilter = 'all' | 'personal' | 'organization' | 'business';

export default function CashbookListScreen() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 600;
  const contentWidth = isTablet ? Math.min(width, 840) : width;
  const numColumns = isTablet ? 4 : 4;
  const shortcutGap = isTablet ? 12 : 8;
  const shortcutPaddingHorizontal = 36;
  const shortcutTileWidth =
    (contentWidth - shortcutPaddingHorizontal - shortcutGap * (numColumns - 1)) / numColumns;
  const { activeCashbook, setActiveCashbook } = useCashbookStore();
  const palette = useThemeStore((s) => s.palette);
  const isDarkMode = useThemeStore((s) => s.isDarkMode);
  const initTheme = useThemeStore((s) => s.initTheme);

  const [cashbooks, setCashbooks] = useState<CashbookStats[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [hideBalance, setHideBalance] = useState(false);
  const [selectedBookIndex, setSelectedBookIndex] = useState(0);
  const [typeFilter, setTypeFilter] = useState<BookTypeFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Shortcut customization state
  const [activeShortcutIds, setActiveShortcutIds] = useState<string[]>(DEFAULT_SHORTCUT_IDS);
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);
  const [tempShortcutIds, setTempShortcutIds] = useState<string[]>(DEFAULT_SHORTCUT_IDS);

  // Reminders / Notification state
  const [dueReminders, setDueReminders] = useState<DueReminderItem[]>([]);
  const [showNotificationModal, setShowNotificationModal] = useState(false);

  // Onboarding state
  const [showOnboarding, setShowOnboarding] = useState(false);

  // App Update Notification modal state
  const [availableUpdate, setAvailableUpdate] = useState<UpdateCheckResult | null>(null);

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

  const loadShortcutSettings = useCallback(async () => {
    try {
      const saved = await getSetting(db, SETTINGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Migrasi otomatis: ganti 'bills' lama dengan 'recurring', hapus ID usang
          const validIds = ALL_AVAILABLE_SHORTCUTS.map((s) => s.id);
          const sanitized = Array.from(
            new Set(
              parsed.map((id: string) => (id === 'bills' ? 'recurring' : id))
            )
          ).filter((id) => validIds.includes(id as string));

          if (sanitized.length > 0) {
            setActiveShortcutIds(sanitized as string[]);
            return;
          }
        }
      }
      setActiveShortcutIds(DEFAULT_SHORTCUT_IDS);
    } catch {
      setActiveShortcutIds(DEFAULT_SHORTCUT_IDS);
    }
  }, [db]);

  const loadData = useCallback(async () => {
    try {
      await processDueRecurringTransactions(db);
      const books = await getCashbooksWithStats(db);
      setCashbooks(books);

      // Cek jatuh tempo untuk notifikasi
      const firstBookId = books.length > 0 ? books[0].id : 1;
      const reminders = await checkDueReminders(db, firstBookId);
      setDueReminders(reminders);

      // Trigger push notification hp jika ada jatuh tempo urgent
      await triggerLocalNotificationIfDue(db, firstBookId);
    } catch (e) {
      console.warn('loadData error:', e);
    }
  }, [db]);

  const checkOnboarding = useCallback(async () => {
    try {
      const seen = await getSetting(db, 'has_seen_onboarding_v1');
      if (!seen) {
        setShowOnboarding(true);
      }
    } catch {
      // ignore
    }
  }, [db]);

  const handleFinishOnboarding = async () => {
    setShowOnboarding(false);
    await setSetting(db, 'has_seen_onboarding_v1', '1');
  };

  const checkStartupUpdate = useCallback(async () => {
    try {
      const lastCheckStr = await getSetting(db, 'last_update_check_time');
      const now = Date.now();
      // Jangan ganggu terus-menerus: cek otomatis maksimal 1 kali setiap 24 jam
      if (lastCheckStr) {
        const lastCheck = parseInt(lastCheckStr, 10);
        if (!isNaN(lastCheck) && now - lastCheck < 24 * 60 * 60 * 1000) {
          return;
        }
      }

      const res = await checkForAppUpdate();
      await setSetting(db, 'last_update_check_time', now.toString());

      if (res.hasUpdate) {
        // Cek apakah versi ini sebelumnya sudah ditolak/dilewati oleh pengguna
        const dismissedVersion = await getSetting(db, 'dismissed_update_version');
        if (dismissedVersion !== res.latestVersion) {
          setAvailableUpdate(res);
        }
      }
    } catch {
      // Background check diam tanpa pesan error mengganggu
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      initTheme(db);
      checkOnboarding();
      loadData();
      loadShortcutSettings();
      checkStartupUpdate();
    }, [db, initTheme, checkOnboarding, loadData, loadShortcutSettings, checkStartupUpdate])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleSelectBook = (book: CashbookStats) => {
    setActiveCashbook(book);
    router.push({
      pathname: '/(tabs)',
      params: { cashbookId: book.id.toString() },
    });
  };

  const openCustomizeModal = () => {
    setTempShortcutIds([...activeShortcutIds]);
    setShowCustomizeModal(true);
  };

  const toggleShortcutSelection = (id: string) => {
    if (tempShortcutIds.includes(id)) {
      if (tempShortcutIds.length <= 1) {
        showAlert('Perhatian', 'Minimal harus memilih 1 tombol pintasan fitur.', 'warning');
        return;
      }
      setTempShortcutIds(tempShortcutIds.filter((item) => item !== id));
    } else {
      setTempShortcutIds([...tempShortcutIds, id]);
    }
  };

  const handleSaveShortcuts = async () => {
    try {
      await setSetting(db, SETTINGS_KEY, JSON.stringify(tempShortcutIds));
      setActiveShortcutIds(tempShortcutIds);
      setShowCustomizeModal(false);
    } catch {
      showAlert('Gagal', 'Tidak dapat menyimpan pengaturan pintasan.', 'danger');
    }
  };

  const displayedShortcuts = useMemo(() => {
    return activeShortcutIds
      .map((id) => ALL_AVAILABLE_SHORTCUTS.find((item) => item.id === id))
      .filter(Boolean) as ShortcutItem[];
  }, [activeShortcutIds]);

  const filteredBooks = useMemo(() => {
    return cashbooks.filter((b) => {
      if (typeFilter !== 'all' && (b.type || 'personal') !== typeFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return b.name.toLowerCase().includes(query);
      }
      return true;
    });
  }, [cashbooks, typeFilter, searchQuery]);

  const nonArchivedBooks = filteredBooks.filter((b) => b.is_archived === 0);
  const archivedBooks = filteredBooks.filter((b) => b.is_archived === 1);

  const counts = useMemo(() => {
    const active = cashbooks.filter((b) => b.is_archived === 0);
    return {
      all: active.length,
      personal: active.filter((b) => (b.type || 'personal') === 'personal').length,
      organization: active.filter((b) => b.type === 'organization').length,
      business: active.filter((b) => b.type === 'business').length,
    };
  }, [cashbooks]);

  const currentHeroBook = useMemo(() => {
    if (nonArchivedBooks.length === 0) return null;
    if (activeCashbook) {
      const found = nonArchivedBooks.find((b) => b.id === activeCashbook.id);
      if (found) return found;
    }
    const safeIdx = Math.min(Math.max(selectedBookIndex, 0), nonArchivedBooks.length - 1);
    return nonArchivedBooks[safeIdx] || null;
  }, [nonArchivedBooks, activeCashbook, selectedBookIndex]);

  const handleCycleCashbook = () => {
    if (nonArchivedBooks.length <= 1) return;
    const currentIdx = currentHeroBook
      ? nonArchivedBooks.findIndex((b) => b.id === currentHeroBook.id)
      : 0;
    const nextIdx = (currentIdx + 1) % nonArchivedBooks.length;
    const nextBook = nonArchivedBooks[nextIdx];
    setSelectedBookIndex(nextIdx);
    if (nextBook) {
      setActiveCashbook(nextBook);
    }
  };

  const handlePressShortcut = (item: ShortcutItem) => {
    if (currentHeroBook) {
      setActiveCashbook(currentHeroBook);
      router.push({
        pathname: item.route as any,
        params: { cashbookId: currentHeroBook.id.toString() },
      });
    } else {
      router.push(item.route as any);
    }
  };

  const renderShortcutIcon = (iconType: string, color: string) => {
    switch (iconType) {
      case 'wallet':
        return <WalletActionIcon color={color} size={22} />;
      case 'transfer':
        return <TransferActionIcon color={color} size={22} />;
      case 'bills':
        return <BillActionIcon color={color} size={22} />;
      case 'debts':
        return <DebtActionIcon color={color} size={22} />;
      case 'budget':
        return <BudgetActionIcon color={color} size={22} />;
      case 'savings':
        return <SavingsActionIcon color={color} size={22} />;
      case 'cashier':
        return <CashierActionIcon color={color} size={22} />;
      case 'recurring':
        return <RecurringActionIcon color={color} size={22} />;
      case 'export':
        return <ExportActionIcon color={color} size={22} />;
      default:
        return <WalletActionIcon color={color} size={22} />;
    }
  };

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 11) return 'Selamat Pagi ☀️';
    if (hour < 15) return 'Selamat Siang 🌤️';
    if (hour < 18) return 'Selamat Sore 🌇';
    return 'Selamat Malam 🌙';
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: palette.canvas }]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      <Stack.Screen options={{ headerShown: false, headerBackVisible: false, headerLeft: () => null }} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: Math.max(insets.top, 16) + 6 },
          isTablet && { maxWidth: 840, width: '100%', alignSelf: 'center' },
          { flexGrow: 1 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerMainRow}>
            <View>
              <Text style={[styles.subGreeting, { color: palette.primary }]}>{greeting}</Text>
              <View style={styles.appNameRow}>
                <Text style={[styles.appNameFirst, { color: palette.ink }]}>Catat</Text>
                <Text style={[styles.appNameSecond, { color: palette.primary }]}>Ku</Text>
              </View>
              <Text style={[styles.tagline, { color: palette.primary }]}>Catatan Rapi, Finansial Pasti.</Text>
            </View>

            {/* Sisi Kanan Header: Notifikasi & Pengaturan Aplikasi */}
            <View style={styles.headerRightBadge}>
              {/* Tombol Notifikasi */}
              <Pressable
                style={({ pressed }) => [
                  styles.themeIconBtn,
                  {
                    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : palette.cardMuted,
                    borderColor: palette.border,
                  },
                  pressed && { opacity: 0.7 },
                ]}
                onPress={() => setShowNotificationModal(true)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityLabel="Pemberitahuan Transaksi Rutin & Hutang"
              >
                <BellIcon color={dueReminders.length > 0 ? palette.debt : palette.ink} size={19} />
                {dueReminders.length > 0 && <View style={styles.notifBadgeDot} />}
              </Pressable>

              {/* Tombol Pengaturan Aplikasi */}
              <Pressable
                style={({ pressed }) => [
                  styles.themeIconBtn,
                  {
                    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : palette.cardMuted,
                    borderColor: palette.border,
                  },
                  pressed && { opacity: 0.7 },
                ]}
                onPress={() => router.push('/global-settings' as any)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityLabel="Pengaturan Aplikasi"
              >
                <GearIcon color={palette.ink} size={19} />
              </Pressable>
            </View>
          </View>
        </View>

        {/* Hero Card: Saldo Catatan Terpilih */}
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: isDarkMode ? '#132331' : palette.primary,
              borderColor: isDarkMode ? '#23384B' : 'rgba(255, 255, 255, 0.15)',
            },
          ]}
        >
          <View style={styles.heroTopRow}>
            <Pressable
              style={({ pressed }) => [
                styles.heroSelectorBtn,
                nonArchivedBooks.length <= 1 && { opacity: 0.9 },
                pressed && nonArchivedBooks.length > 1 && { opacity: 0.8 },
              ]}
              onPress={handleCycleCashbook}
              disabled={nonArchivedBooks.length <= 1}
            >
              <Text style={styles.heroSelectorIcon}>{currentHeroBook?.icon ?? '📝'}</Text>
              <Text style={styles.heroSelectorTitle} numberOfLines={1} allowFontScaling={false}>
                {currentHeroBook ? currentHeroBook.name : 'Belum Ada Catatan'}
              </Text>
              {nonArchivedBooks.length > 1 && (
                <View style={styles.heroCycleChip}>
                  <Text style={styles.heroCycleChipText} allowFontScaling={false}>Ganti ↻</Text>
                </View>
              )}
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.eyeBtn, pressed && { opacity: 0.7 }]}
              onPress={() => setHideBalance(!hideBalance)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {hideBalance ? (
                <EyeClosedIcon color="#FFFFFF" size={17} />
              ) : (
                <EyeOpenIcon color="#FFFFFF" size={17} />
              )}
            </Pressable>
          </View>

          <View style={styles.heroBalanceWrap}>
            <Text style={styles.heroBalanceLabel} allowFontScaling={false}>
              {currentHeroBook ? `Saldo • ${currentHeroBook.name}` : 'Saldo'}
            </Text>
            <Text style={styles.heroBalanceAmount} allowFontScaling={false}>
              {hideBalance
                ? '••••••••••'
                : formatRupiah(currentHeroBook ? currentHeroBook.balance : 0)}
            </Text>
          </View>

          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatItem}>
              <View style={styles.heroStatIndicatorIncome} />
              <View>
                <Text style={styles.heroStatLabel} allowFontScaling={false}>Pemasukan</Text>
                <Text style={styles.heroStatAmount} allowFontScaling={false}>
                  {hideBalance
                    ? '••••••'
                    : formatRupiah(currentHeroBook ? currentHeroBook.total_income : 0)}
                </Text>
              </View>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStatItem}>
              <View style={styles.heroStatIndicatorExpense} />
              <View>
                <Text style={styles.heroStatLabel} allowFontScaling={false}>Pengeluaran</Text>
                <Text style={styles.heroStatAmount} allowFontScaling={false}>
                  {hideBalance
                    ? '••••••'
                    : formatRupiah(currentHeroBook ? currentHeroBook.total_expense : 0)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Section Pintasan Aksi Cepat */}
        <View style={styles.shortcutsSectionHeader}>
          <Text style={[styles.shortcutsSectionTitle, { color: palette.ink }]}>Aksi Cepat</Text>
          <Pressable
            style={({ pressed }) => [
              styles.customizeTrigger,
              {
                backgroundColor: isDarkMode ? 'rgba(45, 106, 79, 0.25)' : palette.primarySurface,
                borderColor: isDarkMode ? 'rgba(45, 106, 79, 0.45)' : '#CCFBF1',
              },
              pressed && { opacity: 0.7 },
            ]}
            onPress={openCustomizeModal}
          >
            <CustomizeActionIcon color={palette.primary} size={14} />
            <Text style={[styles.customizeTriggerText, { color: palette.primary }]}>Atur Pintasan</Text>
          </Pressable>
        </View>

        <View style={[styles.shortcutsGrid, { gap: shortcutGap }]}>
          {displayedShortcuts.map((item) => (
            <Pressable
              key={item.id}
              style={({ pressed }) => [
                styles.shortcutCard,
                {
                  width: shortcutTileWidth,
                  backgroundColor: palette.card,
                  borderColor: palette.border,
                },
                pressed && [styles.shortcutCardPressed, { backgroundColor: isDarkMode ? '#182735' : '#FAFCFB' }],
              ]}
              onPress={() => handlePressShortcut(item)}
            >
              <View
                style={[
                  styles.shortcutIconContainer,
                  {
                    backgroundColor: isDarkMode ? '#16313B' : palette.primarySurface,
                    borderColor: isDarkMode ? '#234450' : '#CCFBF1',
                  },
                ]}
              >
                {renderShortcutIcon(item.iconType, palette.primary)}
              </View>
              <View style={styles.shortcutTextWrap}>
                <Text
                  style={[styles.shortcutName, { color: palette.ink }]}
                  numberOfLines={2}
                  ellipsizeMode="tail"
                >
                  {item.name}
                </Text>
              </View>
            </Pressable>
          ))}
          {Array.from({ length: (numColumns - (displayedShortcuts.length % numColumns)) % numColumns }).map((_, idx) => (
            <View key={`shortcut-spacer-${idx}`} style={{ width: shortcutTileWidth, height: 0 }} />
          ))}
        </View>

        {/* Section Header: Daftar Catatan */}
        <View style={styles.sectionHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionTitle, { color: palette.ink }]}>Daftar Catatan</Text>
            <Text style={[styles.sectionSubtitle, { color: palette.inkMuted }]}>
              {nonArchivedBooks.length} catatan aktif
            </Text>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.addNewBookBtn,
              { backgroundColor: palette.primary },
              pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
            ]}
            onPress={() => router.push('/cashbook-modal')}
          >
            <Text style={styles.addNewBookText}>+ Catatan Baru</Text>
          </Pressable>
        </View>

        {/* Filter Tabs (Semua / Pribadi / Organisasi / Bisnis) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterTabsRow}
          contentContainerStyle={[
            styles.filterTabsContent,
            isTablet && styles.filterTabsContentTablet,
          ]}
        >
          {(['all', 'personal', 'organization', 'business'] as BookTypeFilter[]).map((ft) => {
            const active = typeFilter === ft;
            const labels: Record<BookTypeFilter, string> = {
              all: `Semua (${counts.all})`,
              personal: `👤 Pribadi (${counts.personal})`,
              organization: `👥 Organisasi (${counts.organization})`,
              business: `💼 Bisnis (${counts.business})`,
            };
            return (
              <Pressable
                key={ft}
                style={[
                  styles.filterTab,
                  { backgroundColor: palette.card, borderColor: palette.border },
                  active && { backgroundColor: palette.primary, borderColor: palette.primary },
                ]}
                onPress={() => setTypeFilter(ft)}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    { color: palette.inkSecondary },
                    active && styles.filterTabTextActive,
                  ]}
                >
                  {labels[ft]}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Search Bar */}
        {cashbooks.length > 2 && (
          <View style={[styles.searchBar, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={[styles.searchInput, { color: palette.ink }]}
              placeholder="Cari buku catatan..."
              placeholderTextColor={palette.inkMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')}>
                <Text style={[styles.clearSearch, { color: palette.inkMuted }]}>✕</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Cashbook Cards List */}
        <View style={styles.cardsList}>
          {nonArchivedBooks.length === 0 ? (
            <View
              style={[
                styles.emptyBookCard,
                { backgroundColor: palette.card, borderColor: palette.border },
              ]}
            >
              <Text style={styles.emptyBookEmoji}>📖✨</Text>
              <Text style={[styles.emptyBookTitle, { color: palette.ink }]}>
                Belum Ada Buku Catatan
              </Text>
              <Text style={[styles.emptyBookDesc, { color: palette.inkMuted }]}>
                Mulai kelola keuangan Anda dengan membuat buku catatan pertama (misal: Keuangan Pribadi, Bisnis, atau Kas Keluarga).
              </Text>
              <Pressable
                style={({ pressed }) => [
                  styles.createFirstBookBtn,
                  { backgroundColor: palette.primary },
                  pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                ]}
                onPress={() => router.push('/cashbook-modal')}
              >
                <Text style={styles.createFirstBookText}>➕ Buat Catatan Pertama</Text>
              </Pressable>
            </View>
          ) : (
            nonArchivedBooks.map((book) => (
              <CashbookCard
                key={book.id}
                cashbook={book}
                onPress={() => handleSelectBook(book)}
                onLongPress={() => {
                  router.push({
                    pathname: '/cashbook-modal',
                    params: { id: book.id.toString() },
                  });
                }}
                isDark={isDarkMode}
              />
            ))
          )}

          {/* Archived Books Toggle */}
          {archivedBooks.length > 0 && (
            <Pressable
              style={({ pressed }) => [
                styles.archivedToggle,
                { backgroundColor: palette.card, borderColor: palette.border },
                pressed && { opacity: 0.8 },
              ]}
              onPress={() => setShowArchived(!showArchived)}
            >
              <Text style={[styles.archivedToggleText, { color: palette.inkSecondary }]}>
                {showArchived ? '▲ Sembunyikan' : '▼ Tampilkan'} Arsip ({archivedBooks.length} catatan)
              </Text>
            </Pressable>
          )}

          {showArchived &&
            archivedBooks.map((book) => (
              <CashbookCard
                key={book.id}
                cashbook={book}
                onPress={() => handleSelectBook(book)}
                onLongPress={() => {
                  router.push({
                    pathname: '/cashbook-modal',
                    params: { id: book.id.toString() },
                  });
                }}
                isDark={isDarkMode}
              />
            ))}
        </View>

        {/* Footer Copyright */}
        <View style={styles.footerWrap}>
          <Text style={[styles.footerCopyrightText, { color: palette.inkMuted }]} allowFontScaling={false}>
            © 2026 CatatKu by Dani Abdul Wahid
          </Text>
        </View>
      </ScrollView>

      {/* Modal Notifikasi / Pengingat Jatuh Tempo */}
      <Modal
        visible={showNotificationModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNotificationModal(false)}
      >
        <View style={[styles.modalOverlay, isTablet && styles.modalOverlayTablet]}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: palette.card },
              isTablet && styles.modalContentTablet,
            ]}
          >
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: palette.ink }]}>Notifikasi & Jatuh Tempo</Text>
                <Text style={[styles.modalSub, { color: palette.inkMuted }]}>
                  Transaksi rutin dan hutang yang mendekati atau lewat jatuh tempo
                </Text>
              </View>
              <Pressable
                style={[styles.modalCloseBtn, { backgroundColor: palette.cardMuted }]}
                onPress={() => setShowNotificationModal(false)}
              >
                <Text style={[styles.modalCloseText, { color: palette.inkSecondary }]}>✕</Text>
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 380 }}>
              {dueReminders.length === 0 ? (
                <View style={styles.notifEmptyWrap}>
                  <Text style={{ fontSize: 36, marginBottom: 8 }}>🎉</Text>
                  <Text style={[styles.notifEmptyTitle, { color: palette.ink }]}>Semua Beres!</Text>
                  <Text style={[styles.notifEmptySub, { color: palette.inkMuted }]}>
                    Tidak ada tagihan atau hutang yang mendekati jatuh tempo saat ini.
                  </Text>
                </View>
              ) : (
                dueReminders.map((r) => (
                  <Pressable
                    key={r.id}
                    style={[styles.notifItem, { backgroundColor: palette.cardMuted, borderColor: palette.border }]}
                    onPress={() => {
                      setShowNotificationModal(false);
                      if (currentHeroBook) {
                        setActiveCashbook(currentHeroBook);
                      }
                      if (r.type === 'bill') {
                        router.push('/recurring' as any);
                      } else {
                        router.push('/debts' as any);
                      }
                    }}
                  >
                    <View style={styles.notifIconBox}>
                      <Text style={{ fontSize: 18 }}>{r.type === 'bill' ? '📄' : '🤝'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.notifItemTitle, { color: palette.ink }]}>{r.title}</Text>
                      <Text style={[styles.notifItemSub, { color: palette.debt }]}>{r.description}</Text>
                      <Text style={[styles.notifItemAmount, { color: palette.expense }]}>
                        {formatRupiah(r.amount)}
                      </Text>
                    </View>
                    <Text style={[styles.notifItemArrow, { color: palette.inkMuted }]}>›</Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal Kustomisasi Pintasan Fitur */}
      <Modal
        visible={showCustomizeModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCustomizeModal(false)}
      >
        <View style={[styles.modalOverlay, isTablet && styles.modalOverlayTablet]}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: palette.card },
              isTablet && styles.modalContentTablet,
            ]}
          >
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: palette.ink }]}>Kustomisasi Pintasan</Text>
                <Text style={[styles.modalSub, { color: palette.inkMuted }]}>
                  Pilih menu aksi cepat favorit Anda (minimal 1 menu)
                </Text>
              </View>
              <Pressable
                style={[styles.modalCloseBtn, { backgroundColor: palette.cardMuted }]}
                onPress={() => setShowCustomizeModal(false)}
              >
                <Text style={[styles.modalCloseText, { color: palette.inkSecondary }]}>✕</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.modalScroll}>
              <View style={styles.customizeList}>
                {ALL_AVAILABLE_SHORTCUTS.map((item) => {
                  const isSelected = tempShortcutIds.includes(item.id);
                  return (
                    <Pressable
                      key={item.id}
                      style={[
                        styles.customizeItem,
                        { backgroundColor: palette.card, borderColor: palette.border },
                        isSelected && [
                          styles.customizeItemSelected,
                          { borderColor: palette.primary, backgroundColor: isDarkMode ? '#172B38' : '#F8FCFB' },
                        ],
                      ]}
                      onPress={() => toggleShortcutSelection(item.id)}
                    >
                      <View
                        style={[
                          styles.customizeIconBox,
                          { backgroundColor: isDarkMode ? '#1B2C3B' : palette.primarySurface },
                        ]}
                      >
                        {renderShortcutIcon(item.iconType, palette.primary)}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.customizeItemName, { color: palette.ink }]}>{item.name}</Text>
                        <Text style={[styles.customizeItemSub, { color: palette.inkMuted }]}>
                          Buka fitur {item.name.toLowerCase()}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.checkbox,
                          { borderColor: palette.border, backgroundColor: isDarkMode ? palette.cardMuted : '#FFFFFF' },
                          isSelected && [
                            styles.checkboxActive,
                            { backgroundColor: palette.primary, borderColor: palette.primary },
                          ],
                        ]}
                      >
                        {isSelected && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnCancel, { backgroundColor: palette.cardMuted, borderColor: palette.border }]}
                onPress={() => setShowCustomizeModal(false)}
              >
                <Text style={[styles.modalBtnTextCancel, { color: palette.inkSecondary }]}>Batal</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnSave, { backgroundColor: palette.primary }]}
                onPress={handleSaveShortcuts}
              >
                <Text style={styles.modalBtnTextSave}>Simpan ({tempShortcutIds.length})</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Intro Onboarding 3 Slide */}
      <Modal
        visible={showOnboarding}
        animationType="fade"
        transparent={false}
        onRequestClose={handleFinishOnboarding}
      >
        <OnboardingModal
          isDark={isDarkMode}
          onFinish={handleFinishOnboarding}
        />
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

      {/* In-App Update Notification Modal */}
      <ModernConfirmModal
        visible={Boolean(availableUpdate)}
        type="info"
        icon="🚀"
        title={`Pembaruan Tersedia (v${availableUpdate?.latestVersion})`}
        message={`Versi baru CatatKu v${availableUpdate?.latestVersion} sudah tersedia!\n\nCatatan Rilis:\n${availableUpdate?.releaseNotes || 'Peningkatan performa dan pembaruan sistem.'}`}
        confirmText="Unduh Pembaruan"
        cancelText="Nanti Saja"
        onConfirm={() => {
          const url = availableUpdate?.downloadUrl;
          setAvailableUpdate(null);
          openDownloadPage(url);
        }}
        onCancel={async () => {
          if (availableUpdate?.latestVersion) {
            await setSetting(db, 'dismissed_update_version', availableUpdate.latestVersion);
          }
          setAvailableUpdate(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 40,
  },
  header: { marginBottom: 8 },
  headerMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerRightBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  themeIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  notifBadgeDot: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E11D48',
  },
  subGreeting: {
    fontFamily: FONTS.sansBold,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  appNameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 2,
  },
  appNameFirst: {
    fontFamily: FONTS.serifTitle,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -1,
  },
  appNameSecond: {
    fontFamily: FONTS.serifTitle,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -1,
  },
  tagline: {
    fontFamily: FONTS.sansMedium,
    fontSize: 11,
    marginTop: 2,
  },
  heroCard: {
    borderRadius: 20,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  heroSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    maxWidth: '80%',
    gap: 6,
  },
  heroSelectorIcon: { fontSize: 14 },
  heroSelectorTitle: {
    fontFamily: FONTS.sansBold,
    fontSize: 12,
    color: '#FAF8F5',
    flexShrink: 1,
  },
  heroCycleChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  heroCycleChipText: {
    fontFamily: FONTS.sansBold,
    fontSize: 9,
    color: '#FAF8F5',
  },
  eyeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroBalanceWrap: { marginBottom: 8 },
  heroBalanceLabel: {
    fontFamily: FONTS.sansMedium,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.75)',
  },
  heroBalanceAmount: {
    fontFamily: FONTS.sansBold,
    fontSize: 28,
    fontWeight: '900',
    color: '#FAF8F5',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  heroStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    borderRadius: 14,
    padding: 10,
  },
  heroStatItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroStatIndicatorIncome: {
    width: 3,
    height: 24,
    borderRadius: 2,
    backgroundColor: '#34D399',
  },
  heroStatIndicatorExpense: {
    width: 3,
    height: 24,
    borderRadius: 2,
    backgroundColor: '#F87171',
  },
  heroStatLabel: {
    fontFamily: FONTS.sansMedium,
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  heroStatAmount: {
    fontFamily: FONTS.sansBold,
    fontSize: 12,
    color: '#FAF8F5',
    marginTop: 1,
  },
  heroStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginHorizontal: 8,
  },
  shortcutsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  shortcutsSectionTitle: {
    fontFamily: FONTS.serifTitle,
    fontSize: 16,
    fontWeight: '800',
  },
  customizeTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  customizeTriggerText: {
    fontFamily: FONTS.sansBold,
    fontSize: 11,
  },
  shortcutsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    rowGap: 10,
    marginBottom: 14,
  },
  shortcutCard: {
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    minHeight: 88,
  },
  shortcutCardPressed: {
    transform: [{ scale: 0.96 }],
  },
  shortcutIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 6,
  },
  shortcutTextWrap: {
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  shortcutName: {
    fontFamily: FONTS.sansBold,
    fontSize: 10.5,
    textAlign: 'center',
    lineHeight: 13,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  addNewBookBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addNewBookText: {
    fontFamily: FONTS.sansBold,
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sectionTitle: {
    fontFamily: FONTS.serifTitle,
    fontSize: 18,
    fontWeight: '800',
  },
  sectionSubtitle: {
    fontFamily: FONTS.sansMedium,
    fontSize: 12,
    marginTop: 1,
  },
  filterTabsRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  filterTabsContent: {
    alignItems: 'center',
    paddingVertical: 2,
  },
  filterTabsContentTablet: {
    justifyContent: 'center',
    flexGrow: 1,
  },
  filterTab: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    marginRight: 8,
  },
  filterTabText: {
    fontFamily: FONTS.sansBold,
    fontSize: 11,
  },
  filterTabTextActive: {
    color: '#FAF8F5',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  searchIcon: { fontSize: 14, marginRight: 8 },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    fontFamily: FONTS.sansMedium,
    fontSize: 13,
  },
  clearSearch: { fontSize: 13, paddingHorizontal: 4 },
  cardsList: {
    gap: 10,
  },
  archivedToggle: {
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  archivedToggleText: {
    fontFamily: FONTS.sansBold,
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalOverlayTablet: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 32,
  },
  modalContentTablet: {
    borderRadius: 24,
    maxWidth: 540,
    width: '100%',
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontFamily: FONTS.serifTitle,
    fontSize: 18,
    fontWeight: '800',
  },
  modalSub: {
    fontFamily: FONTS.sansRegular,
    fontSize: 12,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 14,
    fontWeight: '700',
  },
  modalScroll: { maxHeight: 360 },
  customizeList: { gap: 8 },
  customizeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  customizeItemSelected: {},
  customizeIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customizeItemName: {
    fontFamily: FONTS.sansBold,
    fontSize: 13,
  },
  customizeItemSub: {
    fontFamily: FONTS.sansRegular,
    fontSize: 11,
    marginTop: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {},
  checkmark: {
    color: '#FAF8F5',
    fontSize: 12,
    fontWeight: '800',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalBtnCancel: { borderWidth: 1 },
  modalBtnSave: {},
  modalBtnTextCancel: {
    fontFamily: FONTS.sansMedium,
    fontSize: 13,
  },
  modalBtnTextSave: {
    fontFamily: FONTS.sansBold,
    fontSize: 13,
    color: '#FAF8F5',
  },
  notifEmptyWrap: {
    alignItems: 'center',
    paddingVertical: 36,
  },
  notifEmptyTitle: {
    fontFamily: FONTS.serifTitle,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  notifEmptySub: {
    fontFamily: FONTS.sansRegular,
    fontSize: 12,
    textAlign: 'center',
  },
  notifItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
    marginBottom: 8,
  },
  notifIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifItemTitle: {
    fontFamily: FONTS.sansBold,
    fontSize: 13,
  },
  notifItemSub: {
    fontFamily: FONTS.sansBold,
    fontSize: 11,
    marginTop: 1,
  },
  notifItemAmount: {
    fontFamily: FONTS.sansBold,
    fontSize: 12,
    marginTop: 2,
  },
  notifItemArrow: {
    fontSize: 20,
    fontWeight: '700',
  },
  emptyBookCard: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    marginTop: 8,
    marginBottom: 12,
  },
  emptyBookEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyBookTitle: {
    fontFamily: FONTS.serifTitle,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyBookDesc: {
    fontFamily: FONTS.sansMedium,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  createFirstBookBtn: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 280,
  },
  createFirstBookText: {
    fontFamily: FONTS.sansBold,
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  footerWrap: {
    marginTop: 'auto',
    paddingTop: 32,
    paddingBottom: 24,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  footerCopyrightText: {
    fontFamily: FONTS.sansRegular,
    fontSize: 9.5,
    letterSpacing: 0.2,
    opacity: 0.65,
  },
});
