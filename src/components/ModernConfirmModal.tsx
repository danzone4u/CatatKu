import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { PALETTE, FONTS } from '../constants/theme';
import { useThemeStore } from '../stores/useThemeStore';

export type ModalType = 'danger' | 'warning' | 'info';

interface ModernConfirmModalProps {
  visible: boolean;
  type?: ModalType;
  icon?: string;
  title: string;
  message: string;
  cancelText?: string;
  confirmText?: string;
  onCancel: () => void;
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
  onCancel,
  onConfirm,
}: ModernConfirmModalProps) {
  const { palette } = useThemeStore();

  const getThemeColors = () => {
    switch (type) {
      case 'danger':
        return {
          icon: icon || '🗑️',
          badgeBg: 'rgba(239, 68, 68, 0.12)',
          confirmBtnBg: '#DC2626',
        };
      case 'warning':
        return {
          icon: icon || '📦',
          badgeBg: 'rgba(217, 119, 6, 0.12)',
          confirmBtnBg: '#D97706',
        };
      case 'info':
      default:
        return {
          icon: icon || '🛡️',
          badgeBg: 'rgba(45, 106, 79, 0.12)',
          confirmBtnBg: PALETTE.primary,
        };
    }
  };

  const colors = getThemeColors();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={[styles.iconBadge, { backgroundColor: colors.badgeBg }]}>
            <Text style={styles.iconText}>{colors.icon}</Text>
          </View>

          <Text style={[styles.title, { color: palette.ink }]}>{title}</Text>
          <Text style={[styles.message, { color: palette.inkMuted }]}>{message}</Text>

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
              style={({ pressed }) => [
                styles.btn,
                { backgroundColor: colors.confirmBtnBg },
                pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
              ]}
              onPress={onConfirm}
            >
              <Text style={styles.btnConfirmText}>{confirmText}</Text>
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
    marginBottom: 8,
  },
  message: {
    fontFamily: FONTS.sansRegular,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 22,
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
