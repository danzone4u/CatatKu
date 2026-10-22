import { View, Text, StyleSheet } from 'react-native';
import { LIGHT_PALETTE, DARK_PALETTE } from '../constants/theme';

interface Props {
  icon: string;
  title: string;
  subtitle?: string;
  isDark?: boolean;
}

export default function EmptyState({ icon, title, subtitle, isDark = false }: Props) {
  const palette = isDark ? DARK_PALETTE : LIGHT_PALETTE;

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={[styles.title, { color: palette.ink }]}>{title}</Text>
      {subtitle && <Text style={[styles.subtitle, { color: palette.inkMuted }]}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  icon: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
});
