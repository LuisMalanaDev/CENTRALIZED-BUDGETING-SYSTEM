export const Colors = {
  background: '#000000',
  surface: '#0A0A0A',
  surfaceSubtle: '#121212',
  surfaceCard: '#141414',
  border: '#262626',
  borderSubtle: '#1C1C1E',
  borderFocus: '#52525B',
  
  textPrimary: '#FFFFFF',
  textSecondary: '#A1A1AA',
  textMuted: '#71717A',
  
  white: '#FFFFFF',
  black: '#000000',
  
  // Status / Accent shades in Apple monochrome
  badgeBg: '#18181B',
  badgeBorder: '#27272A',
  activeTab: '#FFFFFF',
  inactiveTab: '#71717A',
  
  incomeBadge: '#27272A',
  incomeText: '#E4E4E7',
  expenseBadge: '#18181B',
  expenseText: '#FFFFFF',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

export const Typography = {
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  body: {
    fontSize: 14,
    color: Colors.textPrimary,
  },
  caption: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  small: {
    fontSize: 10,
    color: Colors.textMuted,
  },
};
