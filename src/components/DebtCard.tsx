import { View, Text, StyleSheet, Pressable } from 'react-native';
import { type DebtWithPayments } from '../database/queries';
import { formatRupiah } from '../utils/currency';
import { formatDate } from '../utils/date';
import { EditActionIcon } from './ActionIcons';

interface Props extends DebtWithPayments {
  onTogglePaid: () => void;
  onPayInstallment: () => void;
  onEdit?: () => void;
  onLongPress: () => void;
  onDelete?: () => void;
}

export default function DebtCard(props: Props) {
  const isDebt = props.type === 'debt';
  const isPaid = props.is_paid === 1 || props.remaining_amount <= 0;
  const progressRatio = props.amount > 0 ? Math.min(props.total_paid / props.amount, 1) : 0;
  const progressPercent = Math.round(progressRatio * 100);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        isPaid && styles.cardPaid,
        pressed && styles.pressed,
      ]}
      onLongPress={props.onLongPress}
    >
      <View style={styles.topRow}>
        <View style={styles.badgeContainer}>
          <View style={[styles.typeBadge, isDebt ? styles.badgeDebt : styles.badgeReceivable]}>
            <Text style={[styles.typeText, isDebt ? styles.textDebt : styles.textReceivable]}>
              {isDebt ? '💸 Saya Berhutang' : '💎 Piutang Saya'}
            </Text>
          </View>
          {isPaid && (
            <View style={styles.paidBadge}>
              <Text style={styles.paidText}>LUNAS</Text>
            </View>
          )}
        </View>
        <Text style={styles.date}>{formatDate(props.date)}</Text>
      </View>

      <Text style={[styles.personName, isPaid && styles.strikethrough]}>
        {props.person_name}
      </Text>

      {/* Rincian Nominal Total & Sisa */}
      <View style={styles.amountBlock}>
        <View style={styles.amountRow}>
          <Text style={styles.amountLabel}>Total Tagihan:</Text>
          <Text style={styles.amountValue}>{formatRupiah(props.amount)}</Text>
        </View>

        {props.total_paid > 0 && !isPaid && (
          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>Sudah Dicicil:</Text>
            <Text style={styles.paidValue}>-{formatRupiah(props.total_paid)} ({progressPercent}%)</Text>
          </View>
        )}

        <View style={[styles.amountRow, { marginTop: 4 }]}>
          <Text style={styles.remainingLabel}>Sisa Tagihan:</Text>
          <Text style={[styles.remainingValue, isPaid ? styles.greenValue : isDebt ? styles.orangeValue : styles.purpleValue]}>
            {isPaid ? 'Rp 0' : formatRupiah(props.remaining_amount)}
          </Text>
        </View>
      </View>

      {/* Progress Bar Pembayaran */}
      {!isPaid && props.total_paid > 0 && (
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progressPercent}%`, backgroundColor: isDebt ? '#EA580C' : '#7C3AED' }]} />
        </View>
      )}

      {props.due_date && !isPaid && (
        <Text style={styles.dueDate}>
          ⏰ Jatuh tempo: {formatDate(props.due_date)}
        </Text>
      )}

      {props.note ? <Text style={styles.note}>{props.note}</Text> : null}

      {/* Action Buttons */}
      <View style={styles.actionRow}>
        {!isPaid && (
          <Pressable
            style={({ pressed }) => [styles.installmentBtn, pressed && { opacity: 0.8 }]}
            onPress={props.onPayInstallment}
          >
            <Text style={styles.installmentBtnText}>+ Bayar Cicilan</Text>
          </Pressable>
        )}
        <Pressable
          style={({ pressed }) => [
            styles.toggleBtn,
            isPaid ? styles.btnReopen : styles.btnComplete,
            pressed && { opacity: 0.8 },
          ]}
          onPress={props.onTogglePaid}
        >
          <Text style={[styles.toggleBtnText, isPaid ? styles.textReopen : styles.textComplete]}>
            {isPaid ? 'Batal Lunas' : 'Tandai Lunas'}
          </Text>
        </Pressable>
        {props.onEdit && (
          <Pressable
            style={({ pressed }) => [styles.deleteBtn, { backgroundColor: '#F1F5F9' }, pressed && { opacity: 0.7 }]}
            onPress={props.onEdit}
            hitSlop={6}
          >
            <EditActionIcon color="#0F766E" size={15} />
          </Pressable>
        )}
        {props.onDelete && (
          <Pressable
            style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.7 }]}
            onPress={props.onDelete}
          >
            <Text style={styles.deleteBtnText}>🗑️</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardPaid: {
    opacity: 0.6,
    backgroundColor: '#F8FAFC',
  },
  pressed: {
    opacity: 0.95,
    transform: [{ scale: 0.99 }],
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeDebt: { backgroundColor: '#FED7AA' },
  badgeReceivable: { backgroundColor: '#EDE9FE' },
  typeText: { fontSize: 11, fontWeight: '700' },
  textDebt: { color: '#EA580C' },
  textReceivable: { color: '#7C3AED' },
  paidBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  paidText: { fontSize: 10, fontWeight: '800', color: '#16A34A' },
  date: { fontSize: 12, color: '#94A3B8' },
  personName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  strikethrough: {
    textDecorationLine: 'line-through',
    color: '#94A3B8',
  },
  amountBlock: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amountLabel: { fontSize: 12, color: '#64748B' },
  amountValue: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
  paidValue: { fontSize: 12, fontWeight: '600', color: '#16A34A' },
  remainingLabel: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  remainingValue: { fontSize: 16, fontWeight: '800' },
  greenValue: { color: '#16A34A' },
  orangeValue: { color: '#EA580C' },
  purpleValue: { color: '#7C3AED' },
  progressBar: {
    height: 5,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: { height: '100%', borderRadius: 3 },
  dueDate: { fontSize: 12, color: '#EA580C', fontWeight: '600', marginBottom: 6 },
  note: { fontSize: 13, color: '#64748B', fontStyle: 'italic', marginBottom: 12 },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  installmentBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  installmentBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  toggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  btnComplete: { backgroundColor: '#DCFCE7' },
  btnReopen: { backgroundColor: '#F1F5F9' },
  toggleBtnText: { fontSize: 12, fontWeight: '700' },
  textComplete: { color: '#16A34A' },
  textReopen: { color: '#64748B' },
  deleteBtn: {
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBtnText: {
    fontSize: 13,
  },
});
