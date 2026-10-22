import { View, Text, StyleSheet, Pressable, ScrollView, TextInput } from 'react-native';
import { useState } from 'react';
import { Stack } from 'expo-router';
import { formatRupiah } from '../src/utils/currency';

interface Denomination {
  nominal: number;
  label: string;
  type: 'paper' | 'coin';
}

const DENOMINATIONS: Denomination[] = [
  { nominal: 100000, label: 'Rp 100.000', type: 'paper' },
  { nominal: 50000, label: 'Rp 50.000', type: 'paper' },
  { nominal: 20000, label: 'Rp 20.000', type: 'paper' },
  { nominal: 10000, label: 'Rp 10.000', type: 'paper' },
  { nominal: 5000, label: 'Rp 5.000', type: 'paper' },
  { nominal: 2000, label: 'Rp 2.000', type: 'paper' },
  { nominal: 1000, label: 'Rp 1.000 (Kertas)', type: 'paper' },
  { nominal: 1000, label: 'Rp 1.000 (Koin)', type: 'coin' },
  { nominal: 500, label: 'Rp 500', type: 'coin' },
  { nominal: 200, label: 'Rp 200', type: 'coin' },
  { nominal: 100, label: 'Rp 100', type: 'coin' },
];

export default function CashierCalculatorScreen() {
  const [counts, setCounts] = useState<{ [key: string]: number }>({});

  function updateCount(key: string, delta: number) {
    const current = counts[key] ?? 0;
    const nextVal = Math.max(0, current + delta);
    setCounts({ ...counts, [key]: nextVal });
  }

  function setCountDirect(key: string, val: string) {
    const parsed = parseInt(val, 10);
    setCounts({ ...counts, [key]: isNaN(parsed) ? 0 : Math.max(0, parsed) });
  }

  function handleReset() {
    setCounts({});
  }

  const grandTotal = DENOMINATIONS.reduce((sum, item, idx) => {
    const key = `${item.nominal}-${item.type}-${idx}`;
    const qty = counts[key] ?? 0;
    return sum + item.nominal * qty;
  }, 0);

  const totalPaperPieces = DENOMINATIONS.filter((d) => d.type === 'paper').reduce((sum, item, idx) => {
    const key = `${item.nominal}-${item.type}-${idx}`;
    return sum + (counts[key] ?? 0);
  }, 0);

  const totalCoinPieces = DENOMINATIONS.filter((d) => d.type === 'coin').reduce((sum, item, idx) => {
    const key = `${item.nominal}-${item.type}-${idx}`;
    return sum + (counts[key] ?? 0);
  }, 0);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Kalkulator Kas Fisik',
          headerStyle: { backgroundColor: '#FFFFFF' },
          headerTintColor: '#0F172A',
          headerTitleStyle: { fontWeight: '700' },
        }}
      />
      <View style={styles.container}>
        {/* Total Summary Card */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Uang Tunai Fisik</Text>
          <Text style={styles.summaryTotal}>{formatRupiah(grandTotal)}</Text>
          <View style={styles.pieceRow}>
            <Text style={styles.pieceText}>📄 {totalPaperPieces} lembar kertas</Text>
            <Text style={styles.pieceDivider}>•</Text>
            <Text style={styles.pieceText}>🪙 {totalCoinPieces} keping koin</Text>
          </View>
        </View>

        {/* Action Header */}
        <View style={styles.actionHeader}>
          <Text style={styles.sectionTitle}>Pecahan Uang Tunai</Text>
          <Pressable onPress={handleReset}>
            <Text style={styles.resetText}>Reset Hitungan</Text>
          </Pressable>
        </View>

        {/* Denominations List */}
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {DENOMINATIONS.map((d, index) => {
            const key = `${d.nominal}-${d.type}-${index}`;
            const qty = counts[key] ?? 0;
            const subtotal = d.nominal * qty;

            return (
              <View key={key} style={styles.denomRow}>
                <View style={styles.denomInfo}>
                  <Text style={styles.denomIcon}>{d.type === 'paper' ? '💵' : '🪙'}</Text>
                  <View>
                    <Text style={styles.denomLabel}>{d.label}</Text>
                    <Text style={styles.denomSubtotal}>= {formatRupiah(subtotal)}</Text>
                  </View>
                </View>

                {/* Counter Buttons & Input */}
                <View style={styles.counterBox}>
                  <Pressable
                    style={({ pressed }) => [styles.btnStep, pressed && { opacity: 0.7 }]}
                    onPress={() => updateCount(key, -1)}
                  >
                    <Text style={styles.btnStepText}>−</Text>
                  </Pressable>

                  <TextInput
                    style={styles.qtyInput}
                    keyboardType="numeric"
                    value={qty === 0 ? '' : qty.toString()}
                    placeholder="0"
                    placeholderTextColor="#94A3B8"
                    onChangeText={(val) => setCountDirect(key, val)}
                  />

                  <Pressable
                    style={({ pressed }) => [styles.btnStep, pressed && { opacity: 0.7 }]}
                    onPress={() => updateCount(key, 1)}
                  >
                    <Text style={styles.btnStepText}>+</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  summaryCard: {
    backgroundColor: '#0F172A',
    padding: 20,
    alignItems: 'center',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  summaryLabel: { fontSize: 13, color: '#94A3B8', fontWeight: '500' },
  summaryTotal: { fontSize: 32, fontWeight: '800', color: '#38BDF8', marginVertical: 6 },
  pieceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  pieceText: { fontSize: 13, color: '#CBD5E1', fontWeight: '600' },
  pieceDivider: { color: '#64748B' },
  actionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  resetText: { fontSize: 13, fontWeight: '700', color: '#EF4444' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  denomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  denomInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  denomIcon: { fontSize: 24, marginRight: 10 },
  denomLabel: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  denomSubtotal: { fontSize: 12, color: '#16A34A', fontWeight: '700', marginTop: 2 },
  counterBox: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  btnStep: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnStepText: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  qtyInput: {
    width: 54,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
});
