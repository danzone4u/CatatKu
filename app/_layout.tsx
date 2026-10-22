import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, StyleSheet } from 'react-native';
import { useState, useEffect } from 'react';
import { DATABASE_NAME } from '../src/constants/database';
import { migrateDbIfNeeded } from '../src/database/schema';
import { PALETTE } from '../src/constants/theme';
import PinLockOverlay from '../src/components/PinLockOverlay';
import AnimatedSplashScreen from '../src/components/AnimatedSplashScreen';

export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // Pengaman: splash pasti terlepas maksimal dalam 1.2 detik
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 1200);
    return () => clearTimeout(timer);
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

        {/* Navigator Expo Router selalu termount sejak awal */}
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: PALETTE.canvas },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="cashbook-modal" options={{ presentation: 'modal' }} />
          <Stack.Screen name="add-transaction" options={{ presentation: 'modal' }} />
          <Stack.Screen name="add-debt" options={{ presentation: 'modal' }} />
          <Stack.Screen name="wallets" options={{ presentation: 'card' }} />
          <Stack.Screen name="transfer" options={{ presentation: 'card' }} />
          <Stack.Screen name="debt-detail" options={{ presentation: 'card' }} />
          <Stack.Screen name="cashier-calculator" options={{ presentation: 'card' }} />
          <Stack.Screen name="category-budgets" options={{ presentation: 'card' }} />
          <Stack.Screen name="savings-goals" options={{ presentation: 'card' }} />
          <Stack.Screen name="recurring" options={{ presentation: 'card' }} />
        </Stack>

        {/* Splash screen sebagai overlay transisi mulus */}
        {showSplash && (
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            <AnimatedSplashScreen onFinish={() => setShowSplash(false)} />
          </View>
        )}
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}
