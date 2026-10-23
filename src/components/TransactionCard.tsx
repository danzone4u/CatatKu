import { View, Text, StyleSheet, Pressable } from 'react-native';
import { type TransactionWithCategory } from '../database/queries';
import { formatRupiah } from '../utils/currency';
import { formatDate } from '../utils/date';
import { FONTS } from '../constants/theme';
import { useThemeStore } from '../stores/useThemeStore';

interface Props extends TransactionWithCategory {
  onPress?: () => void;
  onLongPress?: () => void;
  onDelete?: () => void;
}

export default function TransactionCard(props: Props) {
  const isIncome = props.type === 'income';
  const palette = useThemeStore((s) => s.palette);
  const isDarkMode = useThemeStore((s) => s.isDarkMode);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: palette.card,
          borderColor: palette.border,
        },
        pressed && [styles.pressed, { backgroundColor: isDarkMode ? '#172735' : '#FAFCFB' }],
      ]}
      onPress={props.onPress}
      onLongPress={props.onLongPress}
    >
      <View
        style={[
          styles.iconContainer,
          {
            backgroundColor: isIncome
              ? isDarkMode ? '#064E3B' : '#F0FDF4'
              : isDarkMode ? '#4C0519' : '#FEF2F2',
          },
        ]}
      >
        <Text style={styles.icon}>{props.category_icon || (isIncome ? '💰' : '💸')}</Text>
      </View>

      <View style={styles.details}>
        <View style={styles.titleRow}>
          <Text style={[styles.categoryName, { color: palette.ink }]} numberOfLines={1}>
            {props.category_name}
          </Text>
          <View style={styles.rightActionRow}>
            <Text style={[styles.amount, { color: isIncome ? palette.income : palette.expense }]}>
              {isIncome ? '+' : '-'}{formatRupiah(props.amount)}
            </Text>
            {props.onDelete && (
              <Pressable
                hitSlop={8}
                style={({ pressed }) => [
                  styles.deleteBtn,
                  { backgroundColor: isDarkMode ? '#4C0519' : '#FEE2E2' },
                  pressed && { opacity: 0.6 },
                ]}
                onPress={props.onDelete}
              >
                <Text style={styles.deleteIconText}>🗑️</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Waktu Transaksi Detik */}
        <View style={styles.timeRow}>
          <Text style={[styles.dateText, { color: palette.inkSecondary }]}>
            🕒 {formatDate(props.date)}
          </Text>
        </View>

        <View style={styles.subRow}>
          <View style={styles.metaLeft}>
            {props.account_name && (
              <View style={[styles.accountBadge, { backgroundColor: palette.cardMuted }]}>
                <Text style={[styles.accountText, { color: palette.inkSecondary }]}>
                  {props.account_icon ?? '💳'} {props.account_name}
                </Text>
              </View>
            )}
            {props.receipt_image_uri && (
              <View style={[styles.receiptBadge, { backgroundColor: isDarkMode ? '#451A03' : '#FEF3C7' }]}>
                <Text style={[styles.receiptBadgeText, { color: palette.debt }]}>🧾 Struk</Text>
              </View>
            )}
          </View>
          {props.note ? (
            <Text style={[styles.note, { color: palette.inkMuted }]} numberOfLines={1}>
              {props.note}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  pressed: {
    transform: [{ scale: 0.99 }],
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  icon: {
    fontSize: 20,
  },
  details: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rightActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deleteBtn: {
    padding: 3,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteIconText: {
    fontSize: 12,
  },
  categoryName: {
    fontFamily: FONTS.serifTitle,
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  amount: {
    fontFamily: FONTS.serifTitle,
    fontSize: 15,
    fontWeight: '800',
  },
  timeRow: {
    marginTop: 2,
    marginBottom: 4,
  },
  dateText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 11,
    fontWeight: '600',
  },
  subRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  metaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  receiptBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  receiptBadgeText: {
    fontFamily: FONTS.sansBold,
    fontSize: 10,
    fontWeight: '800',
  },
  accountBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    maxWidth: 120,
  },
  accountText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 11,
  },
  note: {
    fontFamily: FONTS.sansRegular,
    fontSize: 11,
    flex: 1,
    textAlign: 'right',
  },
});
