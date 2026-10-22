import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { useFocusEffect, router } from 'expo-router';
import DebtCard from '../../src/components/DebtCard';
import FilterChip from '../../src/components/FilterChip';
import EmptyState from '../../src/components/EmptyState';
import { getDebts, toggleDebtPaid, deleteDebt, type DebtWithPayments } from '../../src/database/queries';
import { useCashbookStore } from '../../src/stores/useCashbookStore';
import { PALETTE } from '../../src/constants/theme';
import { ModernConfirmModal } from '../../src/components/ModernConfirmModal';

type FilterType = 'all' | 'debt' | 'receivable';

export default function DebtsScreen() {
  const db = useSQLiteContext();
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
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.subTitle}>{activeCashbook?.name ?? 'Catatan'}</Text>
        <Text style={styles.title}>Hutang & Piutang 🤝</Text>
      </View>

      <View style={styles.filterRow}>
        <FilterChip label="Semua" selected={filter === 'all'} onPress={() => setFilter('all')} />
        <FilterChip label="Hutang" selected={filter === 'debt'} onPress={() => setFilter('debt')} />
        <FilterChip label="Piutang" selected={filter === 'receivable'} onPress={() => setFilter('receivable')} />
      </View>

      <FlatList
        data={debts}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <DebtCard
            {...item}
            onTogglePaid={() => handleTogglePaid(item.id)}
            onPayInstallment={() => router.push({ pathname: '/debt-detail', params: { id: item.id.toString() } })}
            onLongPress={() => handleDelete(item.id, item.person_name)}
            onDelete={() => handleDelete(item.id, item.person_name)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="🤝"
            title="Belum ada hutang/piutang"
            subtitle={`Belum ada catatan hutang piutang di ${activeCashbook?.name ?? 'catatan ini'}`}
          />
        }
        contentContainerStyle={debts.length === 0 ? styles.emptyList : styles.listContent}
      />

      <Pressable
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: activeCashbook?.color ?? PALETTE.primary },
          pressed && { transform: [{ scale: 0.95 }] },
        ]}
        onPress={() => router.push('/add-debt')}
      >
        <Text style={styles.fabText}>+</Text>
      </Pressable>

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
  container: { flex: 1, backgroundColor: PALETTE.canvas },
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 12, backgroundColor: PALETTE.card },
  subTitle: { fontSize: 13, fontWeight: '700', color: PALETTE.primary },
  title: { fontSize: 24, fontWeight: '800', color: PALETTE.ink, marginTop: 2 },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: PALETTE.card,
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.border,
  },
  emptyList: { flexGrow: 1 },
  listContent: { paddingBottom: 90 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  fabText: { color: '#FFFFFF', fontSize: 28, fontWeight: '600', marginTop: -2 },
});
