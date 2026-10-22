import { View, Text, StyleSheet, Pressable } from 'react-native';
import { type AccountWithCalculatedBalance } from '../database/queries';
import { formatRupiah } from '../utils/currency';
import { FONTS } from '../constants/theme';
import { useThemeStore } from '../stores/useThemeStore';

interface Props {
  account: AccountWithCalculatedBalance;
  onPress: () => void;
  onLongPress?: () => void;
  onDelete?: () => void;
}

export default function AccountCard({ account, onPress, onLongPress, onDelete }: Props) {
  const palette = useThemeStore((s) => s.palette);
  const isDarkMode = useThemeStore((s) => s.isDarkMode);

  const typeLabels = {
    cash: 'Kas Tunai',
    bank: 'Bank Transfer',
    ewallet: 'E-Wallet',
  };

  const minBal = account.min_balance ?? 0;
  const isBelowMin = minBal > 0 && account.calculated_balance < minBal;
  const isNegative = account.calculated_balance < 0;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: palette.card,
          borderColor: isBelowMin || isNegative ? palette.expense : palette.border,
          borderLeftColor: account.color,
        },
        pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      <View style={styles.topRow}>
        <View style={[styles.iconBox, { backgroundColor: palette.cardMuted }]}>
          <Text style={styles.icon}>{account.icon}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: 1 }}>
              <Text style={[styles.name, { color: palette.ink }]} numberOfLines={1}>
                {account.name}
              </Text>
              {account.is_default === 1 && (
                <View style={[styles.defaultBadge, { backgroundColor: isDarkMode ? '#16313B' : '#EAF6F3' }]}>
                  <Text style={[styles.defaultText, { color: palette.primary }]}>Utama</Text>
                </View>
              )}
              {isBelowMin && (
                <View style={[styles.warningBadge, { backgroundColor: isDarkMode ? '#4C0519' : '#FFE4E6' }]}>
                  <Text style={[styles.warningText, { color: palette.expense }]}>⚠️ Saldo Minimum</Text>
                </View>
              )}
            </View>
            {onDelete && account.is_default !== 1 && (
              <Pressable
                hitSlop={8}
                style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.6 }]}
                onPress={onDelete}
              >
                <Text style={styles.deleteIconText}>🗑️</Text>
              </Pressable>
            )}
          </View>
          <Text style={[styles.typeText, { color: palette.inkMuted }]}>{typeLabels[account.type]}</Text>
        </View>
      </View>

      <View style={[styles.bottomRow, { borderTopColor: palette.borderSubtle }]}>
        <View>
          <Text style={[styles.balanceLabel, { color: palette.inkMuted }]}>Saldo Saat Ini</Text>
          {minBal > 0 && (
            <Text style={[styles.minBalHint, { color: palette.inkMuted }]}>
              Batas aman: {formatRupiah(minBal)}
            </Text>
          )}
        </View>
        <Text
          style={[
            styles.balanceAmount,
            { color: isNegative ? palette.expense : isBelowMin ? palette.debt : palette.ink },
          ]}
        >
          {formatRupiah(account.calculated_balance)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 5,
    borderWidth: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    fontSize: 22,
  },
  name: {
    fontFamily: FONTS.sansBold,
    fontSize: 15,
    fontWeight: '700',
  },
  defaultBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  defaultText: {
    fontFamily: FONTS.sansBold,
    fontSize: 10,
    fontWeight: '700',
  },
  warningBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  warningText: {
    fontFamily: FONTS.sansBold,
    fontSize: 10,
    fontWeight: '800',
  },
  typeText: {
    fontFamily: FONTS.sansRegular,
    fontSize: 12,
    marginTop: 2,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  balanceLabel: {
    fontFamily: FONTS.sansMedium,
    fontSize: 11,
  },
  minBalHint: {
    fontFamily: FONTS.sansRegular,
    fontSize: 10,
    marginTop: 2,
  },
  balanceAmount: {
    fontFamily: FONTS.sansBold,
    fontSize: 17,
    fontWeight: '800',
  },
  deleteBtn: {
    padding: 4,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteIconText: {
    fontSize: 12,
  },
});
