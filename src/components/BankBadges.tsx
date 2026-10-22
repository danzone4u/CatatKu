import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export type InstitutionKey =
  | 'bca'
  | 'mandiri'
  | 'bri'
  | 'bni'
  | 'bsi'
  | 'cimb'
  | 'jago'
  | 'seabank'
  | 'gopay'
  | 'ovo'
  | 'dana'
  | 'shopeepay'
  | 'linkaja'
  | 'emergency'
  | 'cash';

interface PresetItem {
  key: InstitutionKey;
  name: string;
  type: 'bank' | 'ewallet' | 'cash';
  color: string;
  badgeText: string;
  icon: string;
  isEmergency?: boolean;
}

export const FINANCIAL_PRESETS: PresetItem[] = [
  { key: 'emergency', name: 'Dana Darurat', type: 'bank', color: '#E11D48', badgeText: 'SOS', icon: '🛡️', isEmergency: true },
  { key: 'bca', name: 'Bank BCA', type: 'bank', color: '#005EB8', badgeText: 'BCA', icon: '🏦' },
  { key: 'mandiri', name: 'Bank Mandiri', type: 'bank', color: '#0B3B60', badgeText: 'MDR', icon: '🏦' },
  { key: 'bri', name: 'Bank BRI', type: 'bank', color: '#00529C', badgeText: 'BRI', icon: '🏦' },
  { key: 'bni', name: 'Bank BNI', type: 'bank', color: '#F15A24', badgeText: 'BNI', icon: '🏦' },
  { key: 'bsi', name: 'Bank BSI', type: 'bank', color: '#00A39D', badgeText: 'BSI', icon: '🏦' },
  { key: 'cimb', name: 'CIMB Niaga', type: 'bank', color: '#ED1C24', badgeText: 'CIMB', icon: '🏦' },
  { key: 'jago', name: 'Bank Jago', type: 'bank', color: '#8833FF', badgeText: 'JAGO', icon: '🏦' },
  { key: 'seabank', name: 'SeaBank', type: 'bank', color: '#FF5722', badgeText: 'SEA', icon: '🏦' },
  { key: 'gopay', name: 'GoPay', type: 'ewallet', color: '#00AED6', badgeText: 'GOPAY', icon: '📱' },
  { key: 'ovo', name: 'OVO', type: 'ewallet', color: '#4C3494', badgeText: 'OVO', icon: '📱' },
  { key: 'dana', name: 'DANA', type: 'ewallet', color: '#118EEA', badgeText: 'DANA', icon: '📱' },
  { key: 'shopeepay', name: 'ShopeePay', type: 'ewallet', color: '#EE4D2D', badgeText: 'SPAY', icon: '📱' },
  { key: 'cash', name: 'Uang Tunai / Cash', type: 'cash', color: '#16A34A', badgeText: 'CASH', icon: '💵' },
];

export function BankBadge({
  badgeText,
  color,
  size = 'small',
}: {
  badgeText: string;
  color: string;
  size?: 'small' | 'medium';
}) {
  const isMed = size === 'medium';
  return (
    <View
      style={[
        styles.badgeBase,
        {
          backgroundColor: color,
          paddingHorizontal: isMed ? 7 : 5,
          paddingVertical: isMed ? 3 : 2,
        },
      ]}
    >
      <Text style={[styles.badgeText, { fontSize: isMed ? 11 : 9 }]}>{badgeText}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badgeBase: {
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
