import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { PALETTE, FONTS } from '../constants/theme';

interface Props {
  visible: boolean;
  value: string; // ISO string 'YYYY-MM-DD' or 'YYYY-MM-DD HH:mm:ss'
  onSelect: (newDateStr: string) => void;
  onClose: () => void;
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const DAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

export default function DatePickerModal({ visible, value, onSelect, onClose }: Props) {
  // Parse current value
  const initialDate = value ? new Date(value.replace(' ', 'T')) : new Date();
  const validInitialDate = isNaN(initialDate.getTime()) ? new Date() : initialDate;

  const [viewYear, setViewYear] = useState(validInitialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(validInitialDate.getMonth()); // 0-11
  const [selectedDay, setSelectedDay] = useState(validInitialDate.getDate());

  // Keep time parts
  const hours = String(validInitialDate.getHours()).padStart(2, '0');
  const minutes = String(validInitialDate.getMinutes()).padStart(2, '0');
  const seconds = String(validInitialDate.getSeconds()).padStart(2, '0');

  // Days in month
  const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay(); // 0 is Sunday

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((prev) => prev - 1);
    } else {
      setViewMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((prev) => prev + 1);
    } else {
      setViewMonth((prev) => prev + 1);
    }
  };

  const handleConfirmDate = () => {
    const mStr = String(viewMonth + 1).padStart(2, '0');
    const dStr = String(selectedDay).padStart(2, '0');
    const resultStr = `${viewYear}-${mStr}-${dStr} ${hours}:${minutes}:${seconds}`;
    onSelect(resultStr);
    onClose();
  };

  const handleSetToday = () => {
    const today = new Date();
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setSelectedDay(today.getDate());
    const mStr = String(today.getMonth() + 1).padStart(2, '0');
    const dStr = String(today.getDate()).padStart(2, '0');
    const hStr = String(today.getHours()).padStart(2, '0');
    const minStr = String(today.getMinutes()).padStart(2, '0');
    const sStr = String(today.getSeconds()).padStart(2, '0');
    onSelect(`${today.getFullYear()}-${mStr}-${dStr} ${hStr}:${minStr}:${sStr}`);
    onClose();
  };

  // Generate calendar grid slots
  const slots: (number | null)[] = [];
  for (let i = 0; i < firstDayIndex; i++) {
    slots.push(null);
  }
  for (let d = 1; d <= daysInCurrentMonth; d++) {
    slots.push(d);
  }

  const today = new Date();
  const isCurrentMonthThisMonth = today.getFullYear() === viewYear && today.getMonth() === viewMonth;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header Kalender */}
          <View style={styles.header}>
            <Pressable style={styles.navBtn} onPress={handlePrevMonth}>
              <Text style={styles.navBtnText}>‹</Text>
            </Pressable>
            <View style={styles.titleWrap}>
              <Text style={styles.headerMonth}>{MONTH_NAMES[viewMonth]}</Text>
              <Text style={styles.headerYear}>{viewYear}</Text>
            </View>
            <Pressable style={styles.navBtn} onPress={handleNextMonth}>
              <Text style={styles.navBtnText}>›</Text>
            </Pressable>
          </View>

          {/* Baris Nama Hari */}
          <View style={styles.dayLabelsRow}>
            {DAY_LABELS.map((day, idx) => (
              <Text key={idx} style={[styles.dayLabel, idx === 0 && { color: PALETTE.expense }]}>
                {day}
              </Text>
            ))}
          </View>

          {/* Grid Tanggal */}
          <View style={styles.grid}>
            {slots.map((slot, index) => {
              if (slot === null) {
                return <View key={`empty-${index}`} style={styles.dayCell} />;
              }
              const isSelected = slot === selectedDay;
              const isToday = isCurrentMonthThisMonth && slot === today.getDate();

              return (
                <Pressable
                  key={`day-${slot}`}
                  style={[
                    styles.dayCell,
                    isSelected && styles.dayCellSelected,
                    isToday && !isSelected && styles.dayCellToday,
                  ]}
                  onPress={() => setSelectedDay(slot)}
                >
                  <Text
                    style={[
                      styles.dayText,
                      isSelected && styles.dayTextSelected,
                      isToday && !isSelected && styles.dayTextToday,
                    ]}
                  >
                    {slot}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Footer Aksi */}
          <View style={styles.footer}>
            <Pressable style={styles.todayBtn} onPress={handleSetToday}>
              <Text style={styles.todayBtnText}>Hari Ini</Text>
            </Pressable>
            <View style={styles.rightActions}>
              <Pressable style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelBtnText}>Batal</Text>
              </Pressable>
              <Pressable style={styles.confirmBtn} onPress={handleConfirmDate}>
                <Text style={styles.confirmBtnText}>Pilih</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    ...PALETTE.shadowMedium,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: PALETTE.cardMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navBtnText: {
    fontSize: 22,
    fontWeight: '700',
    color: PALETTE.ink,
    marginTop: -2,
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerMonth: {
    fontFamily: FONTS.serifTitle,
    fontSize: 17,
    fontWeight: '800',
    color: PALETTE.ink,
  },
  headerYear: {
    fontFamily: FONTS.sansBold,
    fontSize: 16,
    color: PALETTE.primary,
  },
  dayLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.borderSubtle,
    paddingBottom: 6,
  },
  dayLabel: {
    width: 38,
    textAlign: 'center',
    fontFamily: FONTS.sansBold,
    fontSize: 11,
    color: PALETTE.inkMuted,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  dayCell: {
    width: '14.28%',
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 19,
    marginVertical: 2,
  },
  dayCellSelected: {
    backgroundColor: PALETTE.primary,
  },
  dayCellToday: {
    borderWidth: 1.5,
    borderColor: PALETTE.primary,
  },
  dayText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 13,
    color: PALETTE.ink,
  },
  dayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  dayTextToday: {
    color: PALETTE.primary,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: PALETTE.borderSubtle,
  },
  todayBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: PALETTE.cardMuted,
  },
  todayBtnText: {
    fontFamily: FONTS.sansBold,
    fontSize: 12,
    color: PALETTE.primary,
  },
  rightActions: {
    flexDirection: 'row',
    gap: 8,
  },
  cancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  cancelBtnText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 13,
    color: PALETTE.inkMuted,
  },
  confirmBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: PALETTE.primary,
  },
  confirmBtnText: {
    fontFamily: FONTS.sansBold,
    fontSize: 13,
    color: '#FFFFFF',
  },
});
