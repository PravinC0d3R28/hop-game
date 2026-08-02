export interface Theme {
  bg: number;
  cssBg: string;
  icon: string;
  shadowColor: number;
  decorations: number[];
}

export const THEMES: Record<'light' | 'dark', Theme> = {
  light: {
    bg: 0xe8ddd0,
    cssBg: '#e8ddd0',
    icon: '\u263e', // ☾
    shadowColor: 0xb8a898,
    decorations: [0xb8c8d8, 0xc0d0e0, 0xb0c0d0, 0xc8d8e8]
  },
  dark: {
    bg: 0x2a2a2a,
    cssBg: '#2a2a2a',
    icon: '\u2600', // ☀
    shadowColor: 0x1a1a1a,
    decorations: [0x444455, 0x3a3a4a, 0x4a4a5a, 0x505060]
  }
};

export type ThemeName = keyof typeof THEMES;
