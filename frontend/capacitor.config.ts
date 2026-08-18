import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dev.silenx',
  appName: 'SlienX',
  webDir: 'dist',
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '108819293185-ij6ei19vjhg8d9s5cvojktktr95t6oqu.apps.googleusercontent.com',
      forceCodeForRefreshToken: false,
    },
  },
};

export default config;
