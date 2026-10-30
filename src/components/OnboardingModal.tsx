import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { PALETTE, FONTS } from '../constants/theme';

interface OnboardingSlide {
  id: string;
  badge: string;
  iconVisual: string;
  title: string;
  description: string;
  accentColor: string;
}

const SLIDES: OnboardingSlide[] = [
  {
    id: '1',
    badge: 'PENCATATAN MODERN',
    iconVisual: '📈💰',
    title: 'Catat Keuangan Praktis',
    description:
      'Pantau pemasukan, pengeluaran harian, dan mutasi keuangan Anda secara rapi, jelas, dan mudah dipahami.',
    accentColor: '#0F766E',
  },
  {
    id: '2',
    badge: 'PRIVASI MAKSIMAL',
    iconVisual: '🛡️🔐',
    title: '100% Privat & Aman',
    description:
      'Data sepenuhnya tersimpan aman di penyimpanan lokal ponsel Anda tanpa ketergantungan server luar.',
    accentColor: '#2563EB',
  },
  {
    id: '3',
    badge: 'GOAL & IMPIAN',
    iconVisual: '🎯🚀',
    title: 'Wujudkan Target Impian',
    description:
      'Sisihkan dana ke kantong tabungan impian terpisah dan pantau progres pencapaiannya kapan saja.',
    accentColor: '#16A34A',
  },
];

interface Props {
  onFinish: () => void;
  isDark?: boolean;
}

export default function OnboardingModal({ onFinish, isDark }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
    } else {
      onFinish();
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark ? '#0C151D' : '#FAF8F5',
          paddingTop: Math.max(insets.top, 16),
        },
      ]}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Slide Carousel */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / width);
          setCurrentIndex(index);
        }}
        renderItem={({ item }) => (
          <View style={[styles.slideWrap, { width }]}>
            <View style={styles.cardVisual}>
              <View
                style={[
                  styles.iconOuterCircle,
                  {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#FFFFFF',
                    borderColor: isDark ? '#1F2937' : '#E2E8F0',
                  },
                ]}
              >
                <Text style={styles.slideEmoji}>{item.iconVisual}</Text>
              </View>

              <View
                style={[
                  styles.badgeWrap,
                  { backgroundColor: isDark ? 'rgba(15, 118, 110, 0.25)' : '#EAF6F3' },
                ]}
              >
                <Text style={[styles.badgeText, { color: item.accentColor }]}>{item.badge}</Text>
              </View>

              <Text style={[styles.slideTitle, { color: isDark ? '#F1F5F9' : '#0F172A' }]}>
                {item.title}
              </Text>
              <Text style={[styles.slideDesc, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                {item.description}
              </Text>
            </View>
          </View>
        )}
      />

      {/* Bottom Navigation */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
        {/* Indicators */}
        <View style={styles.dotsRow}>
          {SLIDES.map((_, idx) => (
            <View
              key={idx}
              style={[
                styles.dot,
                {
                  backgroundColor:
                    idx === currentIndex
                      ? PALETTE.primary
                      : isDark
                      ? '#334155'
                      : '#CBD5E1',
                  width: idx === currentIndex ? 24 : 8,
                },
              ]}
            />
          ))}
        </View>

        {/* Action Button */}
        <Pressable
          style={({ pressed }) => [
            styles.actionBtn,
            { backgroundColor: PALETTE.primary },
            pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
          ]}
          onPress={handleNext}
        >
          <Text style={styles.actionBtnText}>
            {currentIndex === SLIDES.length - 1 ? 'Mulai Sekarang ✨' : 'Lanjutkan →'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandFirst: {
    fontFamily: FONTS.serifTitle,
    fontSize: 22,
    fontWeight: '800',
  },
  brandSecond: {
    fontFamily: FONTS.serifTitle,
    fontSize: 22,
    fontWeight: '800',
  },
  skipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  skipText: {
    fontFamily: FONTS.sansBold,
    fontSize: 13,
    fontWeight: '700',
  },
  slideWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  cardVisual: {
    alignItems: 'center',
    width: '100%',
  },
  iconOuterCircle: {
    width: 130,
    height: 130,
    borderRadius: 65,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 28,
    ...PALETTE.shadowMedium,
  },
  slideEmoji: {
    fontSize: 50,
  },
  badgeWrap: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 14,
  },
  badgeText: {
    fontFamily: FONTS.sansBold,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  slideTitle: {
    fontFamily: FONTS.serifTitle,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
  },
  slideDesc: {
    fontFamily: FONTS.sansMedium,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  bottomBar: {
    paddingHorizontal: 24,
    paddingBottom: 34,
    paddingTop: 16,
    gap: 20,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  actionBtn: {
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    ...PALETTE.shadowMedium,
  },
  actionBtnText: {
    fontFamily: FONTS.sansBold,
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
