import { View, Text, StyleSheet, FlatList, Pressable, useWindowDimensions } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { useFocusEffect, router, Stack } from 'expo-router';
import DebtCard from '../../src/components/DebtCard';
import FilterChip from '../../src/components/FilterChip';
import EmptyState from '../../src/components/EmptyState';
import { getDebts, toggleDebtPaid, deleteDebt, type DebtWithPayments } from '../../src/database/queries';
import { useCashbookStore } from '../../src/stores/useCashbookStore';
import { useThemeStore } from '../../src/stores/useThemeStore';
import { FONTS } from '../../src/constants/theme';
import { ModernConfirmModal } from '../../src/components/ModernConfirmModal';
import { BackArrowIcon } from '../../src/components/ActionIcons';

type FilterType = 'all' | 'debt' | 'receivable';

export default function DebtsScreen() {
  const db = useSQLiteContext();
  const { width } = useWindowDimensions();
  const isTablet = width >= 600;
  const palette = useThemeStore((s) => s.palette);
  const isDarkMode = useThemeStore((s) => s.isDarkMode);
  const activeCashbook = useCashbookStore((state) => state.activeCashbook);
  const cashbookId = activeCashbook?.id ?? 1;

  const [debts, setDebts] = useState<DebtWithPayments[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

  const loadDebts = useCallback(async () => {
    const data = await getDebts(db, cashbookId, {
      type: filter === 'all' ? undefined : filter,
    });
    setDebts(data);
  }, [db, cashbookId, filter]);

  useFocusEffect(
    useCallback(() => {
      loadDebts();
    }, [loadDebts])
  );

  async function handleTogglePaid(id: number) {
    await toggleDebtPaid(db, id);
    loadDebts();
  }

  function handleDelete(id: number, name: string) {
    setDeleteTarget({ id, name });
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const { id } = deleteTarget;
    setDeleteTarget(null);
    await deleteDebt(db, id);
    loadDebts();
  }

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
              <Text style={[styles.subTitle, { color: palette.primary }]}>{activeCashbook?.name ?? 'Catatan'}</Text>
              <Text style={[styles.title, { color: palette.ink }]}>Hutang & Piutang 🤝</Text>
            </View>
          </View>

          <Pressable
            style={[styles.addTopBtn, { backgroundColor: palette.primary }]}
            onPress={() => router.push('/add-debt')}
          >
            <Text style={styles.addTopBtnText}>+ Catat</Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.filterRow, { backgroundColor: palette.card, borderBottomColor: palette.border }]}>
        <View style={[styles.filterInner, isTablet && { maxWidth: 840, width: '100%', alignSelf: 'center' }]}>
          <FilterChip label="Semua" selected={filter === 'all'} onPress={() => setFilter('all')} />
          <FilterChip label="Hutang" selected={filter === 'debt'} onPress={() => setFilter('debt')} />
          <FilterChip label="Piutang" selected={filter === 'receivable'} onPress={() => setFilter('receivable')} />
        </View>
      </View>

      <FlatList
        data={debts}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={[styles.cardContainer, isTablet && { maxWidth: 840, width: '100%', alignSelf: 'center' }]}>
            <DebtCard
              {...item}
              onTogglePaid={() => handleTogglePaid(item.id)}
              onPayInstallment={() => router.push({ pathname: '/debt-detail', params: { id: item.id.toString() } })}
              onEdit={() => router.push({ pathname: '/add-debt', params: { id: item.id.toString() } })}
              onLongPress={() => handleDelete(item.id, item.person_name)}
              onDelete={() => handleDelete(item.id, item.person_name)}
            />
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="🤝"
            title="Belum ada hutang/piutang"
            subtitle={`Belum ada catatan hutang piutang di ${activeCashbook?.name ?? 'catatan ini'}`}
            isDark={isDarkMode}
          />
        }
        contentContainerStyle={[
          styles.listContent,
          debts.length === 0 && { flexGrow: 1 },
        ]}
        ListFooterComponent={
          <View style={styles.footerWrap}>
            <Text style={[styles.footerText, { color: palette.inkMuted }]}>© 2026 CatatKu</Text>
          </View>
        }
      />

      <ModernConfirmModal
        visible={!!deleteTarget}
        type="danger"
        icon="🤝"
        title="Hapus Hutang / Piutang"
        message={`Hapus catatan "${deleteTarget?.name}" beserta seluruh riwayat pembayaran cicilannya?`}
        cancelText="Batal"
        confirmText="Ya, Hapus"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
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
  subTitle: {
    fontFamily: FONTS.sansBold,
    fontSize: 11,
    textTransform: 'uppercase',
  },
  title: {
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
  filterRow: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  filterInner: {
    flexDirection: 'row',
    gap: 8,
  },
  cardContainer: {
    width: '100%',
  },
  listContent: {
    paddingBottom: 40,
    paddingTop: 8,
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
