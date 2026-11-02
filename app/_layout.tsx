import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import { DATABASE_NAME } from '../src/constants/database';
import { migrateDbIfNeeded } from '../src/database/schema';
import { PALETTE } from '../src/constants/theme';
import PinLockOverlay from '../src/components/PinLockOverlay';
import { initGoogleDrive } from '../src/utils/googleDrive';

export default function RootLayout() {
  useEffect(() => {
    // Inisialisasi Google Drive Client SDK
    initGoogleDrive();
  }, []);

  return (
    <SafeAreaProvider>
      <SQLiteProvider
        databaseName={DATABASE_NAME}
        onInit={migrateDbIfNeeded}
        onError={(err) => console.warn('SQLiteProvider init warning:', err)}
      >
        <StatusBar style="dark" />
        <PinLockOverlay />

        {/* Navigator Expo Router langsung aktif seketika tanpa jeda splash */}
        <Stack
          screenOptions={{
            headerShown: false,
            headerBackVisible: false,
            headerLeft: () => null,
            contentStyle: { backgroundColor: PALETTE.canvas },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false, headerBackVisible: false, headerLeft: () => null }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false, headerBackVisible: false, headerLeft: () => null }} />
          <Stack.Screen name="cashbook-modal" options={{ presentation: 'modal', headerShown: false }} />
          <Stack.Screen name="add-transaction" options={{ presentation: 'modal' }} />
          <Stack.Screen name="add-debt" options={{ presentation: 'modal', headerShown: false }} />
          <Stack.Screen name="wallets" options={{ presentation: 'card', headerShown: false, headerBackVisible: false, headerLeft: () => null }} />
          <Stack.Screen name="transfer" options={{ presentation: 'card', headerShown: false, headerBackVisible: false, headerLeft: () => null }} />
          <Stack.Screen name="debt-detail" options={{ presentation: 'card', headerShown: false, headerBackVisible: false, headerLeft: () => null }} />
          <Stack.Screen name="cashier-calculator" options={{ presentation: 'card', headerShown: false }} />
          <Stack.Screen name="category-budgets" options={{ presentation: 'card', headerShown: false, headerBackVisible: false, headerLeft: () => null }} />
          <Stack.Screen name="savings-goals" options={{ presentation: 'card', headerShown: false, headerBackVisible: false, headerLeft: () => null }} />
          <Stack.Screen name="recurring" options={{ presentation: 'card', headerShown: false, headerBackVisible: false, headerLeft: () => null }} />
          <Stack.Screen name="debts" options={{ presentation: 'card', headerShown: false, headerBackVisible: false, headerLeft: () => null }} />
        </Stack>
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}
