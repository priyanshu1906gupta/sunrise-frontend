import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sunrisecoaching.khargone',
  appName: 'Sunrise Coaching Khargone',
  webDir: 'dist/coreui-free-angular-admin-template/browser',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    }
  }
};

export default config;
