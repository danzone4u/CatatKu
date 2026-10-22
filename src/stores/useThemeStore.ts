import { create } from 'zustand';
import { LIGHT_PALETTE, DARK_PALETTE } from '../constants/theme';
import type { SQLiteDatabase } from 'expo-sqlite';

export type ThemeMode = 'light' | 'dark';

interface ThemeStore {
  isDarkMode: boolean;
  palette: typeof LIGHT_PALETTE;
  initTheme: (db: SQLiteDatabase) => Promise<void>;
  toggleTheme: (db: SQLiteDatabase) => Promise<void>;
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  isDarkMode: false,
  palette: LIGHT_PALETTE,

  initTheme: async (db: SQLiteDatabase) => {
    try {
      const row = await db.getFirstAsync<{ value: string }>(
        'SELECT value FROM app_settings WHERE key = ?',
        ['app_theme_mode']
      );
      const isDark = row?.value === 'dark';
      set({
        isDarkMode: isDark,
        palette: isDark ? DARK_PALETTE : LIGHT_PALETTE,
      });
    } catch {
      set({ isDarkMode: false, palette: LIGHT_PALETTE });
    }
  },

  toggleTheme: async (db: SQLiteDatabase) => {
    const nextMode = !get().isDarkMode;
    const modeStr = nextMode ? 'dark' : 'light';
    set({
      isDarkMode: nextMode,
      palette: nextMode ? DARK_PALETTE : LIGHT_PALETTE,
    });
    try {
      await db.runAsync(
        'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)',
        ['app_theme_mode', modeStr]
      );
    } catch {}
  },
}));
