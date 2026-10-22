import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Image, ActivityIndicator, Pressable } from 'react-native';
import { PALETTE, FONTS } from '../constants/theme';

interface Props {
  onFinish?: () => void;
}

export default function AnimatedSplashScreen({ onFinish }: Props) {
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const containerOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // 1. Fade in & scale up tagline image
    Animated.parallel([
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // 2. Halus breathing pulse
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.03,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.98,
            duration: 700,
            useNativeDriver: true,
          }),
        ])
      ).start();
    });

    // 3. Auto dismiss setelah 1200ms
    const timer = setTimeout(() => {
      dismiss();
    }, 1200);

    return () => clearTimeout(timer);
  }, []);

  function dismiss() {
    Animated.timing(containerOpacity, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      onFinish?.();
    });
  }

  return (
    <Pressable style={styles.pressableWrap} onPress={dismiss}>
      <Animated.View style={[styles.container, { opacity: containerOpacity }]}>
        <View style={styles.centerContent}>
          <Animated.View
            style={[
              styles.taglineContainer,
              {
                opacity: opacityAnim,
                transform: [{ scale: scaleAnim }, { scale: pulseAnim }],
              },
            ]}
          >
            <Image
              source={require('../../assets/tagline.png')}
              style={styles.taglineImage}
              resizeMode="contain"
            />
          </Animated.View>

          <Animated.View style={[styles.loadingContainer, { opacity: opacityAnim }]}>
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="small" color={PALETTE.primary} />
              <Text style={styles.loadingText}>Memuat catatan...</Text>
            </View>
          </Animated.View>
        </View>

        {/* Copyright Footer */}
        <Animated.View style={[styles.copyrightWrap, { opacity: opacityAnim }]}>
          <Text style={styles.copyrightText}>© Dani Abdul Wahid</Text>
          <Text style={styles.copyrightSub}>CatatKu • Versi 1.1.0 Offline-First</Text>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressableWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 28,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  taglineContainer: {
    width: '85%',
    maxWidth: 320,
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  taglineImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  loadingContainer: {
    alignItems: 'center',
  },
  loadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: PALETTE.cardMuted,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  loadingText: {
    fontFamily: FONTS.sansRegular,
    fontSize: 12,
    color: PALETTE.inkSecondary,
    fontWeight: '600',
  },
  copyrightWrap: {
    alignItems: 'center',
    gap: 2,
  },
  copyrightText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 12,
    fontWeight: '700',
    color: PALETTE.inkSecondary,
    letterSpacing: 0.3,
  },
  copyrightSub: {
    fontFamily: FONTS.sansRegular,
    fontSize: 10,
    color: PALETTE.inkMuted,
  },
});
