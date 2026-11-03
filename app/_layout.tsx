import { Stack } from 'expo-router';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { DATABASE_NAME } from '../src/constants/database';
import { migrateDbIfNeeded } from '../src/database/schema';
import { PALETTE } from '../src/constants/theme';
import PinLockOverlay from '../src/components/PinLockOverlay';
import { initGoogleDrive, autoSyncToDriveIfNeeded, autoPullAndMergeIfNeeded } from '../src/utils/googleDrive';
import { syncWithSupabase, setupSupabaseRealtime } from '../src/services/supabaseSync';

function AppLifecycleManager() {
  const db = useSQLiteContext();
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    // 1. Sinkronisasi awal dengan Supabase Cloud (Background)
    syncWithSupabase(db).catch((err) =>
      console.warn('Initial syncWithSupabase error:', err)
    );

    // 2. Pasang realtime channel listener Supabase
    const cleanupRealtime = setupSupabaseRealtime(db);

    // 3. Auto-pull Google Drive (cadangan sekunder)
    autoPullAndMergeIfNeeded(db).catch((err) =>
      console.warn('Initial autoPullAndMerge error:', err)
    );

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      // Saat aplikasi dibuka / kembali aktif
      if (
        appState.current?.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        syncWithSupabase(db).catch((err) =>
          console.warn('Resume syncWithSupabase error:', err)
        );
        autoPullAndMergeIfNeeded(db).catch((err) =>
          console.warn('Resume autoPullAndMerge error:', err)
        );
      }

      // Saat aplikasi berpindah ke background, push ke Supabase & Google Drive
      if (
        appState.current === 'active' &&
        (nextAppState === 'inactive' || nextAppState === 'background')
      ) {
        syncWithSupabase(db).catch((err) =>
          console.warn('Background syncWithSupabase error:', err)
        );
        autoSyncToDriveIfNeeded(db).catch((err) =>
          console.warn('Background autoSync error:', err)
        );
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
      if (cleanupRealtime) cleanupRealtime();
    };
  }, [db]);

  return null;
}

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
        <AppLifecycleManager />
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
