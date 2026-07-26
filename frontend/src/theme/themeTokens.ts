export type ThemeName = 'light' | 'dark';

export interface ThemeTokens {
  name: ThemeName;
  colorBg: string;
  colorBgRgb: string;
  colorPanelBg: string;
  colorPanelBgRgb: string;
  colorBorder: string;
  colorAccent: string;
  colorAccentHover: string;
  colorTextPrimary: string;
  colorTextSecondary: string;
  colorTextTertiary: string;
  colorTextPlaceholder: string;
  colorBubbleSent: string;
  colorBubbleReceived: string;
  colorSurface: string;
  colorSurfaceSoft: string;
  colorSurfaceSoftRgb: string;
  colorSurfaceElevated: string;
  colorSurfaceRgb: string;
  colorSurfaceOverlay: string;
  colorSurfaceMuted: string;
  colorSurfaceMutedStrong: string;
  colorOnAccent: string;
  colorAccentMuted: string;
  colorAccentSoft: string;
  colorInfo: string;
  colorInfoRgb: string;
  colorGoogleBlue: string;
  colorGoogleGreen: string;
  colorGoogleYellow: string;
  colorGoogleRed: string;
  colorOverlay: string;
  colorOverlayRgb: string;
  accentRgb: string;
}

export const themeTokens: Record<ThemeName, ThemeTokens> = {
  light: {
    name: 'light',
    colorBg: '#FAFAF9',
    colorBgRgb: '250, 250, 249',
    colorPanelBg: '#FFFFFF',
    colorPanelBgRgb: '255, 255, 255',
    colorBorder: '#E2E8F0',
    colorAccent: '#0D9488',
    colorAccentHover: '#0F766E',
    colorTextPrimary: '#1E293B',
    colorTextSecondary: '#64748B',
    colorTextTertiary: '#94A3B8',
    colorTextPlaceholder: '#94A3B8',
    colorBubbleSent: '#4CBB17',
    colorBubbleReceived: '#F4F8F6',
    colorSurface: '#FFFFFF',
    colorSurfaceSoft: '#F8FAFC',
    colorSurfaceSoftRgb: '248, 250, 252',
    colorSurfaceElevated: '#FFFFFF',
    colorSurfaceRgb: '255, 255, 255',
    colorSurfaceOverlay: 'rgba(255, 255, 255, 0.95)',
    colorSurfaceMuted: 'rgba(15, 23, 42, 0.06)',
    colorSurfaceMutedStrong: 'rgba(15, 23, 42, 0.08)',
    colorOnAccent: '#FFFFFF',
    colorAccentMuted: 'rgba(13, 148, 136, 0.12)',
    colorAccentSoft: 'rgba(13, 148, 136, 0.08)',
    colorInfo: '#38BDF8',
    colorInfoRgb: '56, 189, 248',
    colorGoogleBlue: '#4285F4',
    colorGoogleGreen: '#34A853',
    colorGoogleYellow: '#FBBC05',
    colorGoogleRed: '#EA4335',
    colorOverlay: 'rgba(0, 0, 0, 0.45)',
    colorOverlayRgb: '0, 0, 0',
    accentRgb: '13, 148, 136',
  },
  dark: {
    name: 'dark',
    colorBg: '#0F172A',
    colorBgRgb: '15, 23, 42',
    colorPanelBg: '#131C2E',
    colorPanelBgRgb: '19, 28, 46',
    colorBorder: '#1E293B',
    colorAccent: '#14B8A6',
    colorAccentHover: '#0D9488',
    colorTextPrimary: '#F1F5F9',
    colorTextSecondary: '#94A3B8',
    colorTextTertiary: '#64748B',
    colorTextPlaceholder: '#64748B',
    colorBubbleSent: '#4CBB17',
    colorBubbleReceived: '#1F2937',
    colorSurface: '#131C2E',
    colorSurfaceSoft: '#172438',
    colorSurfaceSoftRgb: '23, 36, 56',
    colorSurfaceElevated: '#1E293B',
    colorSurfaceRgb: '19, 28, 46',
    colorSurfaceOverlay: 'rgba(8, 12, 26, 0.9)',
    colorSurfaceMuted: 'rgba(255, 255, 255, 0.06)',
    colorSurfaceMutedStrong: 'rgba(255, 255, 255, 0.1)',
    colorOnAccent: '#FFFFFF',
    colorAccentMuted: 'rgba(20, 184, 166, 0.14)',
    colorAccentSoft: 'rgba(20, 184, 166, 0.08)',
    colorInfo: '#38BDF8',
    colorInfoRgb: '56, 189, 248',
    colorGoogleBlue: '#4285F4',
    colorGoogleGreen: '#34A853',
    colorGoogleYellow: '#FBBC05',
    colorGoogleRed: '#EA4335',
    colorOverlay: 'rgba(0, 0, 0, 0.75)',
    colorOverlayRgb: '0, 0, 0',
    accentRgb: '20, 184, 166',
  },
};
