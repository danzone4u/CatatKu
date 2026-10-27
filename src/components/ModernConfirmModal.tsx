import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, TextInput, ScrollView, useWindowDimensions } from 'react-native';
import { PALETTE, FONTS } from '../constants/theme';
import { useThemeStore } from '../stores/useThemeStore';

export type ModalType = 'danger' | 'warning' | 'info' | 'success';

interface ModernConfirmModalProps {
  visible: boolean;
  type?: ModalType;
  icon?: string;
  title: string;
  message: string;
  cancelText?: string;
  confirmText?: string;
  requiredKeyword?: string;
  onCancel?: () => void;
  onConfirm: () => void;
}

export function ModernConfirmModal({
  visible,
  type = 'warning',
  icon,
  title,
  message,
  cancelText = 'Batal',
  confirmText = 'Lanjutkan',
  requiredKeyword,
  onCancel,
  onConfirm,
}: ModernConfirmModalProps) {
  const { palette, isDarkMode } = useThemeStore();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const [typedText, setTypedText] = useState('');
  const [prevVisible, setPrevVisible] = useState(visible);

  if (prevVisible !== visible) {
    setPrevVisible(visible);
    if (visible) {
      setTypedText('');
    }
  }

  const isConfirmDisabled = requiredKeyword
    ? typedText.trim().toLowerCase() !== requiredKeyword.trim().toLowerCase()
    : false;

  const getThemeColors = () => {
    switch (type) {
      case 'danger':
        return {
          icon: icon || '🗑️',
          badgeBg: isDarkMode ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.12)',
          confirmBtnBg: palette.expense,
          confirmBtnText: '#FFFFFF',
        };
      case 'warning':
        return {
          icon: icon || '⚠️',
          badgeBg: isDarkMode ? 'rgba(245, 158, 11, 0.2)' : 'rgba(217, 119, 6, 0.12)',
          confirmBtnBg: '#D97706',
          confirmBtnText: '#FFFFFF',
        };
      case 'success':
        return {
          icon: icon || '🎉',
          badgeBg: isDarkMode ? 'rgba(20, 184, 166, 0.2)' : 'rgba(45, 106, 79, 0.14)',
          confirmBtnBg: palette.primary,
          confirmBtnText: isDarkMode ? '#0B131A' : '#FFFFFF',
        };
      case 'info':
      default:
        return {
          icon: icon || '🛡️',
          badgeBg: isDarkMode ? 'rgba(20, 184, 166, 0.2)' : 'rgba(45, 106, 79, 0.12)',
          confirmBtnBg: palette.primary,
          confirmBtnText: isDarkMode ? '#0B131A' : '#FFFFFF',
        };
    }
  };

  const colors = getThemeColors();
  const maxCardHeight = Math.min(windowHeight * 0.85, 620);
  const maxScrollHeight = Math.min(windowHeight * 0.38, 260);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel || onConfirm}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: palette.card,
              borderColor: palette.border,
              maxHeight: maxCardHeight,
              maxWidth: Math.min(windowWidth - 40, 360),
            },
          ]}
        >
          {/* Fixed Header */}
          <View style={[styles.iconBadge, { backgroundColor: colors.badgeBg }]}>
            <Text style={styles.iconText}>{colors.icon}</Text>
          </View>

          <Text style={[styles.title, { color: palette.ink }]}>{title}</Text>

          {/* Scrollable Body */}
          <ScrollView
            style={[styles.scrollArea, { maxHeight: maxScrollHeight }]}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator
            nestedScrollEnabled
            bounces={false}
          >
            <Text style={[styles.message, { color: palette.inkMuted }]}>{message}</Text>
          </ScrollView>

          {requiredKeyword ? (
            <View style={styles.inputWrapper}>
              <Text style={[styles.inputHint, { color: palette.inkSecondary }]}>
                Ketik <Text style={{ fontFamily: FONTS.sansBold, fontWeight: '700', color: colors.confirmBtnBg }}>{requiredKeyword}</Text> untuk mengonfirmasi:
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
                    color: palette.ink,
                    borderColor: isConfirmDisabled ? palette.borderSubtle : colors.confirmBtnBg,
                  },
                ]}
                placeholder={`Ketik "${requiredKeyword}"`}
                placeholderTextColor={palette.inkMuted}
                value={typedText}
                onChangeText={setTypedText}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          ) : null}

          {/* Fixed Sticky Footer */}
          <View style={styles.buttonRow}>
            {cancelText ? (
              <Pressable
                style={({ pressed }) => [
                  styles.btn,
                  styles.btnCancel,
                  { backgroundColor: palette.cardMuted, borderColor: palette.borderSubtle },
                  pressed && { opacity: 0.8 },
                ]}
                onPress={onCancel}
              >
                <Text style={[styles.btnCancelText, { color: palette.inkSecondary }]}>{cancelText}</Text>
              </Pressable>
            ) : null}

            <Pressable
              disabled={isConfirmDisabled}
              style={({ pressed }) => [
                styles.btn,
                { backgroundColor: colors.confirmBtnBg },
                isConfirmDisabled && { opacity: 0.35 },
                !isConfirmDisabled && pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
              ]}
              onPress={onConfirm}
            >
              <Text style={[styles.btnConfirmText, { color: colors.confirmBtnText }]}>{confirmText}</Text>
            </Pressable>
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
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    ...PALETTE.shadowMedium,
  },
  iconBadge: {
    width: 62,
    height: 62,
    borderRadius: 31,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconText: {
    fontSize: 30,
  },
  title: {
    fontFamily: FONTS.serifTitle,
    fontSize: 19,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
  },
  scrollArea: {
    width: '100%',
    marginBottom: 16,
  },
  scrollContent: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  message: {
    fontFamily: FONTS.sansRegular,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  inputWrapper: {
    width: '100%',
    marginBottom: 18,
  },
  inputHint: {
    fontFamily: FONTS.sansRegular,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 8,
  },
  textInput: {
    width: '100%',
    height: 42,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontFamily: FONTS.sansBold,
    fontSize: 14,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCancel: {
    borderWidth: 1,
  },
  btnCancelText: {
    fontFamily: FONTS.sansBold,
    fontSize: 14,
    fontWeight: '700',
  },
  btnConfirmText: {
    fontFamily: FONTS.sansBold,
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
