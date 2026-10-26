import { View, Text, StyleSheet, Pressable, Modal, AppState, type AppStateStatus } from 'react-native';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import * as LocalAuthentication from 'expo-local-authentication';
import { getSetting } from '../database/queries';
import { PALETTE, FONTS } from '../constants/theme';
import { useLockStore } from '../stores/useLockStore';

export default function PinLockOverlay() {
  const db = useSQLiteContext();
  const { isLocked, setIsLocked, refreshSeq } = useLockStore();
  const [pin, setPin] = useState('');
  const [savedPin, setSavedPin] = useState<string | null>(null);
  const [hasBiometrics, setHasBiometrics] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const appStateRef = useRef<AppStateStatus>((AppState.currentState as AppStateStatus) ?? 'active');

  const promptBiometrics = useCallback(async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Buka Kunci CatatKu',
        fallbackLabel: 'Gunakan PIN',
        cancelLabel: 'Batal',
      });
      if (result.success) {
        setIsLocked(false);
        setPin('');
      }
    } catch {}
  }, [setIsLocked]);

  const verifyLockStatus = useCallback(async (shouldPromptBio = true) => {
    try {
      const enabled = await getSetting(db, 'pin_enabled');
      const secret = await getSetting(db, 'app_pin');
      const bioEnabled = await getSetting(db, 'biometric_enabled');

      const isSecured = (enabled === 'true' || enabled === '1') && !!secret;

      if (isSecured) {
        setSavedPin(secret);
        setIsLocked(true);

        const compatible = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        const isBioReady = compatible && enrolled;
        setHasBiometrics(isBioReady);

        if (bioEnabled !== '0' && isBioReady && shouldPromptBio) {
          promptBiometrics();
        }
      } else {
        setSavedPin(null);
        setIsLocked(false);
      }
    } catch (e) {
      console.warn('Pin check warning:', e);
    }
  }, [db, promptBiometrics, setIsLocked]);

  // Cek saat pertama mount atau saat ada perubahan setting di halaman lain
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const enabled = await getSetting(db, 'pin_enabled');
        const secret = await getSetting(db, 'app_pin');
        const bioEnabled = await getSetting(db, 'biometric_enabled');

        if (!isMounted) return;

        const isSecured = (enabled === 'true' || enabled === '1') && !!secret;
        if (isSecured) {
          setSavedPin(secret);
          setIsLocked(true);

          const compatible = await LocalAuthentication.hasHardwareAsync();
          const enrolled = await LocalAuthentication.isEnrolledAsync();
          const isBioReady = compatible && enrolled;
          if (!isMounted) return;
          setHasBiometrics(isBioReady);

          if (bioEnabled !== '0' && isBioReady) {
            promptBiometrics();
          }
        } else {
          setSavedPin(null);
          setIsLocked(false);
        }
      } catch (e) {
        console.warn('Pin check warning:', e);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [db, promptBiometrics, refreshSeq, setIsLocked]);

  // Kunci otomatis saat aplikasi dari background/keluar kembali ke foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App kembali aktif dari latar belakang
        verifyLockStatus(true);
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [verifyLockStatus]);

  function handleKeyPress(num: string) {
    if (pin.length < 4) {
      const nextPin = pin + num;
      setPin(nextPin);
      setErrorMsg('');

      if (nextPin.length === 4) {
        if (nextPin === savedPin) {
          setIsLocked(false);
          setPin('');
        } else {
          setErrorMsg('PIN Salah. Coba lagi.');
          setTimeout(() => {
            setPin('');
          }, 400);
        }
      }
    }
  }

  function handleDelete() {
    setPin(pin.slice(0, -1));
    setErrorMsg('');
  }

  if (!isLocked) return null;

  return (
    <Modal visible={isLocked} animationType="fade" transparent={false}>
      <View style={styles.container}>
        <View style={styles.iconBox}>
          <Text style={styles.icon}>🔒</Text>
        </View>
        <Text style={styles.title}>Masukkan PIN</Text>
        <Text style={styles.subtitle}>Catatan Rapi, Finansial Pasti</Text>

        {/* PIN Dots */}
        <View style={styles.dotRow}>
          {[0, 1, 2, 3].map((index) => (
            <View
              key={index}
              style={[
                styles.dot,
                pin.length > index && styles.dotFilled,
                errorMsg ? styles.dotError : null,
              ]}
            />
          ))}
        </View>

        {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : <View style={{ height: 22 }} />}

        {/* Numpad */}
        <View style={styles.numpad}>
          {[
            ['1', '2', '3'],
            ['4', '5', '6'],
            ['7', '8', '9'],
            ['BIO', '0', '⌫'],
          ].map((row, rIdx) => (
            <View key={rIdx} style={styles.numpadRow}>
              {row.map((val, cIdx) => {
                if (val === 'BIO') {
                  if (hasBiometrics) {
                    return (
                      <Pressable
                        key={cIdx}
                        style={({ pressed }) => [styles.keyBtn, styles.keyBio, pressed && styles.keyPressed]}
                        onPress={promptBiometrics}
                      >
                        <Text style={styles.keyBioIcon}>👆</Text>
                      </Pressable>
                    );
                  }
                  return <View key={cIdx} style={styles.keyEmpty} />;
                }
                if (val === '⌫') {
                  return (
                    <Pressable
                      key={cIdx}
                      style={({ pressed }) => [styles.keyBtn, pressed && styles.keyPressed]}
                      onPress={handleDelete}
                    >
                      <Text style={styles.keyText}>⌫</Text>
                    </Pressable>
                  );
                }
                return (
                  <Pressable
                    key={cIdx}
                    style={({ pressed }) => [styles.keyBtn, pressed && styles.keyPressed]}
                    onPress={() => handleKeyPress(val)}
                  >
                    <Text style={styles.keyText}>{val}</Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PALETTE.canvas,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  iconBox: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: PALETTE.primarySurface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  icon: { fontSize: 32 },
  title: {
    fontFamily: FONTS.serifTitle,
    fontSize: 24,
    fontWeight: '800',
    color: PALETTE.ink,
  },
  subtitle: {
    fontFamily: FONTS.sansMedium,
    fontSize: 13,
    fontWeight: '600',
    color: PALETTE.primaryAccent,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 32,
  },
  dotRow: { flexDirection: 'row', gap: 18, marginBottom: 16 },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: PALETTE.inkMuted,
    backgroundColor: 'transparent',
  },
  dotFilled: {
    backgroundColor: PALETTE.primary,
    borderColor: PALETTE.primary,
  },
  dotError: {
    borderColor: PALETTE.expense,
    backgroundColor: PALETTE.expenseLight,
  },
  errorText: {
    fontFamily: FONTS.sansBold,
    color: PALETTE.expense,
    fontSize: 13,
    marginBottom: 10,
  },
  numpad: {
    width: '100%',
    maxWidth: 290,
  },
  numpadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  keyBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: PALETTE.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: PALETTE.border,
    ...PALETTE.shadowLight,
  },
  keyBio: {
    backgroundColor: PALETTE.primarySurface,
    borderColor: PALETTE.border,
  },
  keyBioIcon: {
    fontSize: 26,
  },
  keyPressed: {
    backgroundColor: PALETTE.cardMuted,
    transform: [{ scale: 0.94 }],
  },
  keyEmpty: { width: 72, height: 72 },
  keyText: {
    fontFamily: FONTS.serifTitle,
    fontSize: 24,
    fontWeight: '800',
    color: PALETTE.ink,
  },
});
