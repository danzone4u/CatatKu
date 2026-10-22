import { View, Text, StyleSheet } from 'react-native';

interface Props {
  title: string;
  amount: number;
  color: string;
  bgColor: string;
  icon: string;
}

function formatRupiah(amount: number): string {
  return `Rp ${Math.abs(amount).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

export default function SummaryCard({ title, amount, color, bgColor, icon }: Props) {
  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={[styles.amount, { color }]}>{formatRupiah(amount)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    minWidth: 140,
  },
  icon: {
    fontSize: 24,
    marginBottom: 8,
  },
  title: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    marginBottom: 4,
  },
  amount: {
    fontSize: 18,
    fontWeight: '800',
  },
});
