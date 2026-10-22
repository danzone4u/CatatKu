import { Platform } from 'react-native';

export const LIGHT_PALETTE = {
  // Backgrounds: Clean Fresh Mint Linen
  canvas: '#F4FAF8',
  card: '#FFFFFF',
  cardMuted: '#EAF6F3',
  border: '#D1EAE5',
  borderSubtle: '#E4F4F1',

  // Typography: Deep Slate Petroleum Charcoal
  ink: '#0B3B4A',
  inkSecondary: '#36616F',
  inkMuted: '#7D9FA9',

  // Primary Theme: Deep Ocean Teal
  primary: '#0F766E',
  primaryDark: '#0B3B4A',
  primaryAccent: '#0D9488',
  primarySurface: '#EAF6F3',

  // Cash Flow Accents
  income: '#059669',
  incomeLight: '#DCFCE7',
  expense: '#E11D48',
  expenseLight: '#FFE4E6',
  debt: '#B45309',
  debtLight: '#FEF3C7',
  receivable: '#0284C7',
  receivableLight: '#E0F2FE',

  // Shadows
  shadowLight: {
    shadowColor: '#0B3B4A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  shadowMedium: {
    shadowColor: '#0B3B4A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
};

export const DARK_PALETTE = {
  // Backgrounds: Deep Obsidian & Dark Petrol Slate
  canvas: '#0B131A',
  card: '#131F2A',
  cardMuted: '#192837',
  border: '#23384B',
  borderSubtle: '#1C2C3B',

  // Typography: Crisp Off-White & Cool Slate
  ink: '#F1F7F6',
  inkSecondary: '#A9C3CD',
  inkMuted: '#688693',

  // Primary Theme: Vibrant Sea Teal & Glow Accents
  primary: '#14B8A6',
  primaryDark: '#0D9488',
  primaryAccent: '#2DD4BF',
  primarySurface: '#16313B',

  // Cash Flow Accents (Brighter for dark mode contrast)
  income: '#10B981',
  incomeLight: '#064E3B',
  expense: '#F43F5E',
  expenseLight: '#4C0519',
  debt: '#F59E0B',
  debtLight: '#451A03',
  receivable: '#38BDF8',
  receivableLight: '#082F49',

  // Soft shadows
  shadowLight: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 3,
  },
  shadowMedium: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 6,
  },
};

export const PALETTE = LIGHT_PALETTE;

export const FONTS = {
  serifTitle: Platform.select({
    ios: 'Arial-BoldMT',
    android: 'sans-serif-medium',
    default: 'Arial, sans-serif',
  }),
  serifSub: Platform.select({
    ios: 'Arial-BoldMT',
    android: 'sans-serif-medium',
    default: 'Arial, sans-serif',
  }),
  sansBold: Platform.select({
    ios: 'Arial-BoldMT',
    android: 'sans-serif-medium',
    default: 'Arial, sans-serif',
  }),
  sansSemi: Platform.select({
    ios: 'Arial-BoldMT',
    android: 'sans-serif-medium',
    default: 'Arial, sans-serif',
  }),
  sansMedium: Platform.select({
    ios: 'Arial-BoldMT',
    android: 'sans-serif-medium',
    default: 'Arial, sans-serif',
  }),
  sansRegular: Platform.select({
    ios: 'ArialMT',
    android: 'sans-serif',
    default: 'Arial, sans-serif',
  }),
};
