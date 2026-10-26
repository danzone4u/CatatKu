import { View, Text, StyleSheet, FlatList, Pressable, TextInput, Modal, Image } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { useFocusEffect, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import TransactionCard from '../../src/components/TransactionCard';
import FilterChip from '../../src/components/FilterChip';
import EmptyState from '../../src/components/EmptyState';
import { getTransactions, type TransactionWithCategory } from '../../src/database/queries';
import { useCashbookStore } from '../../src/stores/useCashbookStore';
import { useThemeStore } from '../../src/stores/useThemeStore';
import { formatNumberThousand, parseRupiahInput } from '../../src/utils/currency';
import { FONTS } from '../../src/constants/theme';

type FilterType = 'all' | 'income' | 'expense';
type TimePeriod = 'all' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export default function TransactionsScreen() {
  const db = useSQLiteContext();
  const palette = useThemeStore((s) => s.palette);
  const isDarkMode = useThemeStore((s) => s.isDarkMode);
  const activeCashbook = useCashbookStore((state) => state.activeCashbook);
  const cashbookId = activeCashbook?.id ?? 1;

  const [transactions, setTransactions] = useState<TransactionWithCategory[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [period, setPeriod] = useState<TimePeriod>('all');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [search, setSearch] = useState('');

  // Advanced Filters
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');

  // Zoom Receipt Modal
  const [viewingReceiptUri, setViewingReceiptUri] = useState<string | null>(null);

  const calculateDateRange = useCallback(() => {
    if (period === 'all') return { start: undefined, end: undefined };

    const y = currentDate.getFullYear();
    const m = currentDate.getMonth();

    if (period === 'daily') {
      const dStr = String(currentDate.getDate()).padStart(2, '0');
      const mStr = String(m + 1).padStart(2, '0');
      return {
        start: `${y}-${mStr}-${dStr} 00:00:00`,
        end: `${y}-${mStr}-${dStr} 23:59:59`,
      };
    }
    if (period === 'weekly') {
      const start = new Date(currentDate);
      start.setDate(start.getDate() - start.getDay());
      const end = new Date(start);
      end.setDate(start.getDate() + 6);

      const sy = start.getFullYear();
      const sm = String(start.getMonth() + 1).padStart(2, '0');
      const sd = String(start.getDate()).padStart(2, '0');
      const ey = end.getFullYear();
      const em = String(end.getMonth() + 1).padStart(2, '0');
      const ed = String(end.getDate()).padStart(2, '0');

      return {
        start: `${sy}-${sm}-${sd} 00:00:00`,
        end: `${ey}-${em}-${ed} 23:59:59`,
      };
    }
    if (period === 'monthly') {
      const mStr = String(m + 1).padStart(2, '0');
      return {
        start: `${y}-${mStr}-01 00:00:00`,
        end: `${y}-${mStr}-31 23:59:59`,
      };
    }
    // yearly
    return {
      start: `${y}-01-01 00:00:00`,
      end: `${y}-12-31 23:59:59`,
    };
  }, [currentDate, period]);

  const shiftPeriod = (step: number) => {
    const next = new Date(currentDate);
    if (period === 'daily') {
      next.setDate(next.getDate() + step);
    } else if (period === 'weekly') {
      next.setDate(next.getDate() + step * 7);
    } else if (period === 'monthly') {
      next.setMonth(next.getMonth() + step);
    } else if (period === 'yearly') {
      next.setFullYear(next.getFullYear() + step);
    }
    setCurrentDate(next);
  };

  const getPeriodLabel = () => {
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth();
    const d = currentDate.getDate();
    const monthNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
    ];

    if (period === 'daily') return `${d} ${monthNames[m]} ${y}`;
    if (period === 'weekly') {
      const start = new Date(currentDate);
      start.setDate(d - start.getDay());
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return `${start.getDate()} ${monthNames[start.getMonth()].slice(0, 3)} - ${end.getDate()} ${monthNames[end.getMonth()].slice(0, 3)} ${y}`;
    }
    if (period === 'monthly') return `${monthNames[m]} ${y}`;
    if (period === 'yearly') return `Tahun ${y}`;
    return 'Semua Waktu';
  };

  const loadTransactions = useCallback(async () => {
    const { start, end } = calculateDateRange();
    const minVal = parseRupiahInput(minAmount);
    const maxVal = parseRupiahInput(maxAmount);
    const data = await getTransactions(db, cashbookId, {
      type: filter === 'all' ? undefined : filter,
      search: search || undefined,
      startDate: start,
      endDate: end,
      minAmount: minVal > 0 ? minVal : undefined,
      maxAmount: maxVal > 0 ? maxVal : undefined,
    });
    setTransactions(data);
  }, [calculateDateRange, db, cashbookId, filter, search, minAmount, maxAmount]);

  useFocusEffect(
    useCallback(() => {
      loadTransactions();
    }, [loadTransactions])
  );

  function handleResetFilters() {
    setMinAmount('');
    setMaxAmount('');
    setShowFilterModal(false);
  }

  const hasAdvancedFilters = Boolean(minAmount || maxAmount);

  return (
    <View style={[styles.container, { backgroundColor: palette.canvas }]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: palette.card, borderBottomColor: palette.border }]}>
        <Text style={[styles.subTitle, { color: palette.primary }]}>{activeCashbook?.name ?? 'Catatan'}</Text>
        <Text style={[styles.title, { color: palette.ink }]}>Riwayat Transaksi</Text>

        {/* Search Bar + Filter Button */}
        <View style={styles.searchRow}>
          <View style={[styles.searchBox, { backgroundColor: palette.cardMuted, borderColor: palette.border }]}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={[styles.searchInput, { color: palette.ink }]}
              placeholder="Cari transaksi..."
              placeholderTextColor={palette.inkMuted}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch('')}>
                <Text style={[styles.clearSearch, { color: palette.inkMuted }]}>✕</Text>
              </Pressable>
            )}
          </View>
          <Pressable
            style={[
              styles.filterBtn,
              { backgroundColor: palette.cardMuted, borderColor: palette.border },
              hasAdvancedFilters && { backgroundColor: isDarkMode ? '#451A03' : '#FEF3C7', borderColor: palette.debt },
            ]}
            onPress={() => setShowFilterModal(true)}
          >
            <Text style={styles.filterBtnIcon}>⚙️</Text>
            <Text
              style={[
                styles.filterBtnText,
                { color: palette.inkSecondary },
                hasAdvancedFilters && { color: palette.debt, fontWeight: '800' },
              ]}
            >
              {hasAdvancedFilters ? 'Nominal Aktif' : 'Nominal'}
            </Text>
          </Pressable>
        </View>

        {/* Time Period Filter Pills */}
        <View style={styles.periodPillRow}>
          {(['all', 'daily', 'weekly', 'monthly', 'yearly'] as TimePeriod[]).map((p) => {
            const active = period === p;
            const labels = { all: 'Semua', daily: 'Harian', weekly: 'Mingguan', monthly: 'Bulanan', yearly: 'Tahunan' };
            return (
              <Pressable
                key={p}
                style={[
                  styles.periodPill,
                  { backgroundColor: palette.cardMuted, borderColor: palette.border },
                  active && { backgroundColor: palette.primary, borderColor: palette.primary },
                ]}
                onPress={() => setPeriod(p)}
              >
                <Text
                  style={[
                    styles.periodPillText,
                    { color: palette.inkSecondary },
                    active && { color: '#FFFFFF', fontWeight: '800' },
                  ]}
                >
                  {labels[p]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Date Navigator (jika bukan 'all') */}
        {period !== 'all' && (
          <View style={styles.navigatorRow}>
            <Pressable
              style={[styles.navBtn, { backgroundColor: palette.cardMuted }]}
              onPress={() => shiftPeriod(-1)}
            >
              <Text style={[styles.navBtnText, { color: palette.ink }]}>‹</Text>
            </Pressable>
            <Text style={[styles.periodLabel, { color: palette.ink }]}>{getPeriodLabel()}</Text>
            <Pressable
              style={[styles.navBtn, { backgroundColor: palette.cardMuted }]}
              onPress={() => shiftPeriod(1)}
            >
              <Text style={[styles.navBtnText, { color: palette.ink }]}>›</Text>
            </Pressable>
          </View>
        )}

        {/* Filter Chips Type (Semua / Masuk / Keluar) */}
        <View style={styles.filterRow}>
          <FilterChip label="Semua" selected={filter === 'all'} onPress={() => setFilter('all')} />
          <FilterChip label="Pemasukan" selected={filter === 'income'} onPress={() => setFilter('income')} />
          <FilterChip label="Pengeluaran" selected={filter === 'expense'} onPress={() => setFilter('expense')} />
        </View>
      </View>

      {/* Transaction List */}
      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id.toString()}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <TransactionCard
            {...item}
            onPress={() => {
              if (item.receipt_image_uri) {
                setViewingReceiptUri(item.receipt_image_uri);
              } else {
                router.push({ pathname: '/add-transaction', params: { id: item.id.toString() } });
              }
            }}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="📝"
            title="Tidak Ada Transaksi"
            subtitle="Belum ada transaksi pada filter yang dipilih"
            isDark={isDarkMode}
          />
        }
        contentContainerStyle={[styles.listContent, transactions.length === 0 && styles.emptyList]}
      />

      {/* FAB: Tambah Transaksi */}
      <Pressable
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: palette.primary },
          pressed && { opacity: 0.9, transform: [{ scale: 0.96 }] },
        ]}
        onPress={() => router.push('/add-transaction')}
      >
        <Text style={styles.fabText}>+</Text>
      </Pressable>

      {/* Modal Filter Nominal */}
      <Modal visible={showFilterModal} transparent animationType="slide" onRequestClose={() => setShowFilterModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: palette.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: palette.ink }]}>Filter Rentang Nominal</Text>
              <Pressable onPress={() => setShowFilterModal(false)}>
                <Text style={[styles.modalClose, { color: palette.inkMuted }]}>✕</Text>
              </Pressable>
            </View>

            <View style={styles.formRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: palette.inkSecondary }]}>Nominal Min (Rp)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: palette.cardMuted, borderColor: palette.border, color: palette.ink }]}
                  placeholder="0"
                  placeholderTextColor={palette.inkMuted}
                  keyboardType="numeric"
                  value={minAmount}
                  onChangeText={(txt) => setMinAmount(formatNumberThousand(txt))}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: palette.inkSecondary }]}>Nominal Max (Rp)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: palette.cardMuted, borderColor: palette.border, color: palette.ink }]}
                  placeholder="1.000.000"
                  placeholderTextColor={palette.inkMuted}
                  keyboardType="numeric"
                  value={maxAmount}
                  onChangeText={(txt) => setMaxAmount(formatNumberThousand(txt))}
                />
              </View>
            </View>

            <View style={styles.modalBtnRow}>
              <Pressable
                style={[styles.resetBtn, { borderColor: palette.border }]}
                onPress={handleResetFilters}
              >
                <Text style={[styles.resetBtnText, { color: palette.expense }]}>Reset</Text>
              </Pressable>
              <Pressable
                style={[styles.applyBtn, { backgroundColor: palette.primary }]}
                onPress={() => setShowFilterModal(false)}
              >
                <Text style={styles.applyBtnText}>Terapkan</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Zoom Struk */}
      <Modal visible={!!viewingReceiptUri} transparent animationType="fade" onRequestClose={() => setViewingReceiptUri(null)}>
        <View style={styles.receiptModalOverlay}>
          <View style={styles.receiptModalHeader}>
            <Text style={styles.receiptModalTitle}>Bukti Struk Transaksi</Text>
            <Pressable style={styles.receiptCloseBtn} onPress={() => setViewingReceiptUri(null)}>
              <Text style={styles.receiptCloseText}>Tutup</Text>
            </Pressable>
          </View>
          {viewingReceiptUri && (
            <View style={styles.receiptImageWrap}>
              <Image source={{ uri: viewingReceiptUri }} style={styles.receiptFullscreenImg} resizeMode="contain" />
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  subTitle: {
    fontFamily: FONTS.sansBold,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    fontFamily: FONTS.serifTitle,
    fontSize: 24,
    fontWeight: '800',
    marginTop: 2,
    marginBottom: 12,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  searchIcon: { fontSize: 14, marginRight: 8 },
  searchInput: {
    flex: 1,
    paddingVertical: 9,
    fontFamily: FONTS.sansMedium,
    fontSize: 13,
  },
  clearSearch: {
    fontSize: 14,
    paddingHorizontal: 6,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
  },
  filterBtnIcon: { fontSize: 13 },
  filterBtnText: {
    fontFamily: FONTS.sansBold,
    fontSize: 11,
  },
  periodPillRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  periodPill: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  periodPillText: {
    fontFamily: FONTS.sansBold,
    fontSize: 10,
  },
  navigatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 10,
  },
  navBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navBtnText: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: -2,
  },
  periodLabel: {
    fontFamily: FONTS.sansBold,
    fontSize: 13,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  listContent: {
    paddingTop: 10,
    paddingBottom: 90,
  },
  emptyList: {
    flexGrow: 1,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
  },
  fabText: {
    color: '#FAF8F5',
    fontSize: 28,
    fontWeight: '300',
    marginTop: -2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: FONTS.serifTitle,
    fontSize: 18,
    fontWeight: '800',
  },
  modalClose: {
    fontSize: 20,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
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
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  resetBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  resetBtnText: {
    fontFamily: FONTS.sansBold,
    fontSize: 14,
  },
  applyBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  applyBtnText: {
    fontFamily: FONTS.sansBold,
    fontSize: 14,
    color: '#FAF8F5',
  },
  receiptModalOverlay: {
    flex: 1,
    backgroundColor: '#0F172A',
    paddingTop: 50,
  },
  receiptModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  receiptModalTitle: {
    fontFamily: FONTS.serifTitle,
    fontSize: 18,
    fontWeight: '700',
    color: '#FAF8F5',
  },
  receiptCloseBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  receiptCloseText: {
    fontFamily: FONTS.sansBold,
    fontSize: 12,
    color: '#FFFFFF',
  },
  receiptImageWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 14,
  },
  receiptFullscreenImg: {
    width: '100%',
    height: '100%',
  },
});
