import React from 'react';
import Svg, { Path, Rect, Circle } from 'react-native-svg';

interface IconProps {
  color: string;
  size?: number;
  focused?: boolean;
}

// 1. Dashboard Icon (Modern Sharp Home / House with Door)
export function DashboardIcon({ color, size = 22, focused = false }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 10.25L12 3L21 10.25V20C21 20.5523 20.5523 21 20 21H15V14.5C15 14.2239 14.7761 14 14.5 14H9.5C9.22386 14 9 14.2239 9 14.5V21H4C3.44772 21 3 20.5523 3 20V10.25Z"
        fill={focused ? color : 'none'}
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// 2. Transactions Icon (Modern Receipt / Financial Record)
export function TransactionsIcon({ color, size = 22, focused = false }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 3H18C19.1046 3 20 3.89543 20 5V20.5L17 19L14 20.5L12 19.5L10 20.5L7 19L4 20.5V5C4 3.89543 4.89543 3 6 3Z"
        fill={focused ? `${color}20` : 'none'}
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M8 8H16"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <Path
        d="M8 12H14"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <Path
        d="M8 15H11"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </Svg>
  );
}

// 3. Debts Icon (Two-Way Handshake / Mutual Exchange Credit)
export function DebtsIcon({ color, size = 22, focused = false }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M16 3L20 7L16 11"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M4 7H20"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <Path
        d="M8 21L4 17L8 13"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M20 17H4"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      {focused && (
        <Circle cx="12" cy="12" r="2.5" fill={color} />
      )}
    </Svg>
  );
}

// 4. Settings Icon (Modern Slider Controls / Equalizer)
export function SettingsIcon({ color, size = 22, focused = false }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Slider 1 */}
      <Path d="M4 6H12" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Path d="M16 6H20" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Circle
        cx="14"
        cy="6"
        r="2.5"
        fill={focused ? color : '#FFFFFF'}
        stroke={color}
        strokeWidth="2"
      />

      {/* Slider 2 */}
      <Path d="M4 12H7" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Path d="M11 12H20" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Circle
        cx="9"
        cy="12"
        r="2.5"
        fill={focused ? color : '#FFFFFF'}
        stroke={color}
        strokeWidth="2"
      />

      {/* Slider 3 */}
      <Path d="M4 18H14" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Path d="M18 18H20" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Circle
        cx="16"
        cy="18"
        r="2.5"
        fill={focused ? color : '#FFFFFF'}
        stroke={color}
        strokeWidth="2"
      />
    </Svg>
  );
}

// 5. Reports / Chart Icon
export function ReportsIcon({ color, size = 22, focused = false }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 20V10M12 20V4M6 20v-6"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {focused && (
        <Circle cx="12" cy="4" r="2" fill={color} />
      )}
    </Svg>
  );
}

