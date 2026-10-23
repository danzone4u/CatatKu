import { Tabs } from 'expo-router';
import { View, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FONTS } from '../../src/constants/theme';
import { useThemeStore } from '../../src/stores/useThemeStore';
import { DashboardIcon, TransactionsIcon, ReportsIcon, SettingsIcon } from '../../src/components/TabIcons';

function TabIconContainer({ children, focused, isDark }: { children: React.ReactNode; focused: boolean; isDark: boolean }) {
  return (
    <View style={[styles.iconWrap, focused && (isDark ? styles.iconWrapFocusedDark : styles.iconWrapFocused)]}>
      {children}
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const palette = useThemeStore((s) => s.palette);
  const isDarkMode = useThemeStore((s) => s.isDarkMode);

  // Safe bottom inset to prevent overlapping system navigation / taskbar
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 12 : 0);
  const barHeight = 58 + bottomInset;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: palette.card,
          borderTopColor: palette.border,
          borderTopWidth: 1,
          height: barHeight,
          paddingBottom: bottomInset + 4,
          paddingTop: 8,
          ...palette.shadowLight,
        },
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.inkMuted,
        tabBarLabelStyle: {
          fontFamily: FONTS.sansBold,
          fontSize: 11,
          marginTop: 2,
          letterSpacing: 0.2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Beranda',
          tabBarIcon: ({ color, focused }) => (
            <TabIconContainer focused={focused} isDark={isDarkMode}>
              <DashboardIcon color={String(color || palette.primary)} size={22} focused={focused} />
            </TabIconContainer>
          ),
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: 'Transaksi',
          tabBarIcon: ({ color, focused }) => (
            <TabIconContainer focused={focused} isDark={isDarkMode}>
              <TransactionsIcon color={String(color || palette.primary)} size={22} focused={focused} />
            </TabIconContainer>
          ),
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Laporan',
          tabBarIcon: ({ color, focused }) => (
            <TabIconContainer focused={focused} isDark={isDarkMode}>
              <ReportsIcon color={String(color || palette.primary)} size={22} focused={focused} />
            </TabIconContainer>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Pengaturan',
          tabBarIcon: ({ color, focused }) => (
            <TabIconContainer focused={focused} isDark={isDarkMode}>
              <SettingsIcon color={String(color || palette.primary)} size={22} focused={focused} />
            </TabIconContainer>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 40,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrapFocused: {
    backgroundColor: '#EAF6F3',
  },
  iconWrapFocusedDark: {
    backgroundColor: '#16313B',
  },
});

