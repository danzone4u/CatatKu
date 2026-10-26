import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, useWindowDimensions, KeyboardAvoidingView, Platform } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useState, useCallback } from 'react';
import { router, Stack, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { createCashbook, updateCashbook, getCashbookById, getCashbooks } from '../src/database/queries';
import { EMOJI_LIST } from '../src/constants/categories';
import { FONTS } from '../src/constants/theme';
import { useThemeStore } from '../src/stores/useThemeStore';
import { useCashbookStore } from '../src/stores/useCashbookStore';
import { formatNumberThousand, parseRupiahInput } from '../src/utils/currency';
import { ModernConfirmModal, type ModalType } from '../src/components/ModernConfirmModal';

const COLOR_OPTIONS = [
  '#0F766E', '#0B3B4A', '#0D9488', '#059669', '#0284C7',
  '#B45309', '#E11D48', '#6D28D9', '#36616F', '#CA8A04'
];

export default function CashbookModalScreen() {
  const db = useSQLiteContext();
  const { width } = useWindowDimensions();
  const isTablet = width >= 600;
  const palette = useThemeStore((s) => s.palette);
  const isDarkMode = useThemeStore((s) => s.isDarkMode);

  const params = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!params.id;

  const [name, setName] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('📖');
  const [selectedColor, setSelectedColor] = useState('#0F766E');
  const [budgetLimit, setBudgetLimit] = useState('');
  const [bookType, setBookType] = useState<'personal' | 'organization' | 'business'>('personal');

  const [modalAlert, setModalAlert] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: ModalType;
    icon?: string;
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'warning',
  });

  const showAlert = (title: string, message: string, type: ModalType = 'warning', icon?: string) => {
    setModalAlert({
      visible: true,
      title,
      message,
      type,
      icon,
    });
  };

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      if (isEdit) {
        getCashbookById(db, parseInt(params.id!, 10)).then((data) => {
          if (data && isMounted) {
            setName(data.name);
            setSelectedEmoji(data.icon);
            setSelectedColor(data.color);
            if (data.type) {
              setBookType(data.type);
            }
            if (data.budget_limit) {
              setBudgetLimit(formatNumberThousand(data.budget_limit));
            }
          }
        });
      }
      return () => {
        isMounted = false;
      };
    }, [db, isEdit, params.id])
  );

  const { setActiveCashbook } = useCashbookStore();

  async function handleSave() {
    if (!name.trim()) {
      showAlert('Perhatian', 'Nama Catatan wajib diisi', 'warning');
      return;
    }

    const budget = parseRupiahInput(budgetLimit);

    if (isEdit) {
      const bookId = parseInt(params.id!, 10);
      await updateCashbook(db, bookId, {
        name: name.trim(),
        icon: selectedEmoji,
        color: selectedColor,
        budget_limit: budget > 0 ? budget : null,
        type: bookType,
      });
      const updated = await getCashbookById(db, bookId);
      if (updated) setActiveCashbook(updated);
      router.back();
    } else {
      const existingBooks = await getCashbooks(db, true);
      const isFirstBook = existingBooks.length === 0;

      const newId = await createCashbook(db, {
        name: name.trim(),
        icon: selectedEmoji,
        color: selectedColor,
        budget_limit: budget > 0 ? budget : null,
        type: bookType,
      });

      const newBook = await getCashbookById(db, newId);
      if (newBook) setActiveCashbook(newBook);

      if (isFirstBook) {
        // Alur onboarding pertama kali: langsung masuk ke dashboard catatan baru
        router.replace({
          pathname: '/(tabs)',
          params: { cashbookId: newId.toString() },
        });
      } else {
        router.back();
      }
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: palette.canvas }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: isEdit ? 'Ubah Catatan' : 'Buat Catatan Baru',
          headerStyle: { backgroundColor: palette.card },
          headerTintColor: palette.ink,
          headerTitleStyle: { fontWeight: '700', fontFamily: FONTS.serifTitle },
        }}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: 120 },
            isTablet && { maxWidth: 640, width: '100%', alignSelf: 'center' },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
        >
        {/* Preview Header */}
        <View style={styles.previewContainer}>
          <View style={[styles.previewIconBox, { backgroundColor: selectedColor }]}>
            <Text style={styles.previewIcon}>{selectedEmoji}</Text>
          </View>
          <Text style={[styles.previewName, { color: palette.ink }]}>{name.trim() || 'Nama Catatan'}</Text>
        </View>

        {/* Input Nama */}
        <Text style={[styles.label, { color: palette.inkSecondary }]}>Nama Catatan</Text>
        <TextInput
          style={[styles.input, { backgroundColor: palette.card, borderColor: palette.border, color: palette.ink }]}
          placeholder="Misal: Catatan Harian, Kas Toko, Proyek Web"
          placeholderTextColor={palette.inkMuted}
          value={name}
          onChangeText={setName}
        />

        {/* Tipe Catatan */}
        <Text style={[styles.label, { color: palette.inkSecondary }]}>Kategori Catatan</Text>
        <View style={styles.typeRow}>
          <Pressable
            style={[
              styles.typeBtn,
              { backgroundColor: palette.card, borderColor: palette.border },
              bookType === 'personal' && { borderColor: palette.primary, backgroundColor: isDarkMode ? '#16313B' : '#EAF6F3' },
            ]}
            onPress={() => setBookType('personal')}
          >
            <Text style={styles.typeBtnIcon}>👤</Text>
            <Text
              style={[
                styles.typeBtnText,
                { color: palette.inkMuted },
                bookType === 'personal' && { color: palette.primary, fontWeight: '700' },
              ]}
              numberOfLines={1}
              allowFontScaling={false}
            >
              Pribadi
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.typeBtn,
              { backgroundColor: palette.card, borderColor: palette.border },
              bookType === 'organization' && { borderColor: palette.primary, backgroundColor: isDarkMode ? '#16313B' : '#EAF6F3' },
            ]}
            onPress={() => setBookType('organization')}
          >
            <Text style={styles.typeBtnIcon}>👥</Text>
            <Text
              style={[
                styles.typeBtnText,
                { color: palette.inkMuted },
                bookType === 'organization' && { color: palette.primary, fontWeight: '700' },
              ]}
              numberOfLines={1}
              allowFontScaling={false}
            >
              Organisasi
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.typeBtn,
              { backgroundColor: palette.card, borderColor: palette.border },
              bookType === 'business' && { borderColor: palette.primary, backgroundColor: isDarkMode ? '#16313B' : '#EAF6F3' },
            ]}
            onPress={() => setBookType('business')}
          >
            <Text style={styles.typeBtnIcon}>💼</Text>
            <Text
              style={[
                styles.typeBtnText,
                { color: palette.inkMuted },
                bookType === 'business' && { color: palette.primary, fontWeight: '700' },
              ]}
              numberOfLines={1}
              allowFontScaling={false}
            >
              Bisnis / Usaha
            </Text>
          </Pressable>
        </View>

        {/* Pilihan Emoji */}
        <Text style={[styles.label, { color: palette.inkSecondary }]}>Pilih Ikon</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerRow}>
          {EMOJI_LIST.map((emoji) => (
            <Pressable
              key={emoji}
              style={[
                styles.emojiBtn,
                { backgroundColor: palette.card, borderColor: palette.border },
                selectedEmoji === emoji && { borderColor: palette.primary, borderWidth: 2, backgroundColor: isDarkMode ? '#16313B' : '#EAF6F3' },
              ]}
              onPress={() => setSelectedEmoji(emoji)}
            >
              <Text style={styles.emojiText}>{emoji}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Pilihan Warna */}
        <Text style={[styles.label, { color: palette.inkSecondary }]}>Warna Tema</Text>
        <View style={styles.colorGrid}>
          {COLOR_OPTIONS.map((c) => (
            <Pressable
              key={c}
              style={[
                styles.colorDot,
                { backgroundColor: c },
                selectedColor === c && [styles.colorDotSelected, { borderColor: palette.ink }],
              ]}
              onPress={() => setSelectedColor(c)}
            />
          ))}
        </View>

        {/* Batas Anggaran */}
        <Text style={[styles.label, { color: palette.inkSecondary }]}>Target Batas Anggaran (Opsional)</Text>
        <TextInput
          style={[styles.input, { backgroundColor: palette.card, borderColor: palette.border, color: palette.ink }]}
          placeholder="0 (Tanpa batas)"
          placeholderTextColor={palette.inkMuted}
          keyboardType="numeric"
          value={budgetLimit}
          onChangeText={(txt) => setBudgetLimit(formatNumberThousand(txt))}
        />
        <Text style={[styles.hint, { color: palette.inkMuted }]}>
          Akan memunculkan indikator progress bar pengeluaran di catatan ini.
        </Text>

        {/* Save Button */}
        <Pressable
          style={({ pressed }) => [
            styles.saveBtn,
            { backgroundColor: palette.primary },
            pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
          ]}
          onPress={handleSave}
        >
          <Text style={[styles.saveBtnText, { color: isDarkMode ? '#0B131A' : '#FFFFFF' }]}>
            {isEdit ? 'Simpan Perubahan' : 'Buat Catatan'}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>

      <ModernConfirmModal
        visible={modalAlert.visible}
        type={modalAlert.type}
        icon={modalAlert.icon}
        title={modalAlert.title}
        message={modalAlert.message}
        confirmText="Mengerti"
        cancelText=""
        onConfirm={() => setModalAlert((prev) => ({ ...prev, visible: false }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  previewContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  previewIconBox: {
    width: 72,
    height: 72,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  previewIcon: { fontSize: 36 },
  previewName: { fontSize: 18, fontWeight: '700', fontFamily: FONTS.serifTitle },
  label: { fontSize: 13, fontWeight: '700', fontFamily: FONTS.sansBold, marginBottom: 8, marginTop: 16 },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 42,
    gap: 4,
  },
  typeBtnIcon: { fontSize: 14 },
  typeBtnText: { fontSize: 12, fontWeight: '600', fontFamily: FONTS.sansMedium },
  input: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    fontFamily: FONTS.sansRegular,
  },
  hint: { fontSize: 12, fontFamily: FONTS.sansRegular, marginTop: 4 },
  pickerRow: { flexDirection: 'row', marginBottom: 8 },
  emojiBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    borderWidth: 1,
  },
  emojiText: { fontSize: 22 },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 8,
  },
  colorDot: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  colorDotSelected: {
    borderWidth: 3,
    transform: [{ scale: 1.15 }],
  },
  saveBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  saveBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', fontFamily: FONTS.sansBold },
});
