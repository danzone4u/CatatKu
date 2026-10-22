import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, Alert } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useState, useEffect } from 'react';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { createCashbook, updateCashbook, getCashbookById } from '../src/database/queries';
import { EMOJI_LIST } from '../src/constants/categories';
import { PALETTE, FONTS } from '../src/constants/theme';

const COLOR_OPTIONS = [
  '#0F766E', '#0B3B4A', '#0D9488', '#059669', '#0284C7',
  '#B45309', '#E11D48', '#6D28D9', '#36616F', '#CA8A04'
];

export default function CashbookModalScreen() {
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!params.id;

  const [name, setName] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('📖');
  const [selectedColor, setSelectedColor] = useState('#0F766E');
  const [budgetLimit, setBudgetLimit] = useState('');
  const [bookType, setBookType] = useState<'personal' | 'organization' | 'business'>('personal');

  useEffect(() => {
    if (isEdit) {
      loadCashbook();
    }
  }, []);

  async function loadCashbook() {
    const data = await getCashbookById(db, parseInt(params.id!, 10));
    if (data) {
      setName(data.name);
      setSelectedEmoji(data.icon);
      setSelectedColor(data.color);
      if (data.type) {
        setBookType(data.type);
      }
      if (data.budget_limit) {
        setBudgetLimit(data.budget_limit.toString());
      }
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('Perhatian', 'Nama Catatan wajib diisi');
      return;
    }

    const budget = budgetLimit ? parseFloat(budgetLimit) : null;

    if (isEdit) {
      await updateCashbook(db, parseInt(params.id!, 10), {
        name: name.trim(),
        icon: selectedEmoji,
        color: selectedColor,
        budget_limit: budget,
        type: bookType,
      });
    } else {
      await createCashbook(db, {
        name: name.trim(),
        icon: selectedEmoji,
        color: selectedColor,
        budget_limit: budget,
        type: bookType,
      });
    }

    router.back();
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: isEdit ? 'Ubah Catatan' : 'Buat Catatan Baru',
          headerStyle: { backgroundColor: '#FFFFFF' },
          headerTintColor: '#0F172A',
          headerTitleStyle: { fontWeight: '700' },
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Preview Header */}
        <View style={styles.previewContainer}>
          <View style={[styles.previewIconBox, { backgroundColor: selectedColor }]}>
            <Text style={styles.previewIcon}>{selectedEmoji}</Text>
          </View>
          <Text style={styles.previewName}>{name.trim() || 'Nama Catatan'}</Text>
        </View>

        {/* Input Nama */}
        <Text style={styles.label}>Nama Catatan</Text>
        <TextInput
          style={styles.input}
          placeholder="Misal: Catatan Harian, Kas Toko, Proyek Web"
          placeholderTextColor="#94A3B8"
          value={name}
          onChangeText={setName}
        />

        {/* Tipe Catatan */}
        <Text style={styles.label}>Kategori Catatan</Text>
        <View style={styles.typeRow}>
          <Pressable
            style={[styles.typeBtn, bookType === 'personal' && styles.typeBtnActive]}
            onPress={() => setBookType('personal')}
          >
            <Text style={styles.typeBtnIcon}>👤</Text>
            <Text style={[styles.typeBtnText, bookType === 'personal' && styles.typeBtnTextActive]}>
              Pribadi
            </Text>
          </Pressable>

          <Pressable
            style={[styles.typeBtn, bookType === 'organization' && styles.typeBtnActive]}
            onPress={() => setBookType('organization')}
          >
            <Text style={styles.typeBtnIcon}>👥</Text>
            <Text style={[styles.typeBtnText, bookType === 'organization' && styles.typeBtnTextActive]}>
              Organisasi
            </Text>
          </Pressable>

          <Pressable
            style={[styles.typeBtn, bookType === 'business' && styles.typeBtnActive]}
            onPress={() => setBookType('business')}
          >
            <Text style={styles.typeBtnIcon}>💼</Text>
            <Text style={[styles.typeBtnText, bookType === 'business' && styles.typeBtnTextActive]}>
              Bisnis / Usaha
            </Text>
          </Pressable>
        </View>

        {/* Pilihan Emoji */}
        <Text style={styles.label}>Pilih Ikon</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerRow}>
          {EMOJI_LIST.map((emoji) => (
            <Pressable
              key={emoji}
              style={[styles.emojiBtn, selectedEmoji === emoji && styles.emojiBtnSelected]}
              onPress={() => setSelectedEmoji(emoji)}
            >
              <Text style={styles.emojiText}>{emoji}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Pilihan Warna */}
        <Text style={styles.label}>Warna Tema</Text>
        <View style={styles.colorGrid}>
          {COLOR_OPTIONS.map((c) => (
            <Pressable
              key={c}
              style={[
                styles.colorDot,
                { backgroundColor: c },
                selectedColor === c && styles.colorDotSelected,
              ]}
              onPress={() => setSelectedColor(c)}
            />
          ))}
        </View>

        {/* Batas Anggaran */}
        <Text style={styles.label}>Target Batas Anggaran (Opsional)</Text>
        <TextInput
          style={styles.input}
          placeholder="0 (Tanpa batas)"
          placeholderTextColor="#94A3B8"
          keyboardType="numeric"
          value={budgetLimit}
          onChangeText={setBudgetLimit}
        />
        <Text style={styles.hint}>
          Akan memunculkan indikator progress bar pengeluaran di catatan ini.
        </Text>

        {/* Save Button */}
        <Pressable
          style={({ pressed }) => [styles.saveBtn, { backgroundColor: selectedColor }, pressed && { opacity: 0.8 }]}
          onPress={handleSave}
        >
          <Text style={styles.saveBtnText}>{isEdit ? 'Simpan Perubahan' : 'Buat Catatan'}</Text>
        </Pressable>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PALETTE.canvas },
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
    ...PALETTE.shadowLight,
  },
  previewIcon: { fontSize: 36 },
  previewName: { fontSize: 18, fontWeight: '700', color: PALETTE.ink },
  label: { fontSize: 14, fontWeight: '600', color: PALETTE.inkSecondary, marginBottom: 8, marginTop: 16 },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: PALETTE.card,
    borderWidth: 1,
    borderColor: PALETTE.border,
    gap: 4,
  },
  typeBtnActive: {
    backgroundColor: PALETTE.primarySurface,
    borderColor: PALETTE.primary,
    borderWidth: 1.5,
  },
  typeBtnIcon: { fontSize: 14 },
  typeBtnText: { fontSize: 12, fontWeight: '600', color: PALETTE.inkMuted },
  typeBtnTextActive: { color: PALETTE.primary, fontWeight: '700' },
  input: {
    backgroundColor: PALETTE.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: PALETTE.ink,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  hint: { fontSize: 12, color: PALETTE.inkMuted, marginTop: 4 },
  pickerRow: { flexDirection: 'row', marginBottom: 8 },
  emojiBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: PALETTE.card,
    marginRight: 8,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  emojiBtnSelected: {
    backgroundColor: PALETTE.primarySurface,
    borderWidth: 2,
    borderColor: PALETTE.primary,
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
    borderColor: '#FFFFFF',
    ...PALETTE.shadowMedium,
    transform: [{ scale: 1.15 }],
  },
  saveBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
    ...PALETTE.shadowMedium,
  },
  saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
