# Sunrise Coaching Khargone — Frontend

Angular 22 + CoreUI ERP for PAT coaching. Same build feeds web, Capacitor (Android/iOS), and Electron.

## Run

```bash
npm install
npm start
```

API default: `http://localhost:3000/api` (`src/environments/environment.ts`).

## Native / desktop

```bash
npm install
npx cap add android
npx cap add ios
npm run build:native
```

- Android: `FLAG_SECURE` is patched by `scripts/patch-native-security.js` (blocks screenshots/recordings).
- iOS: screenshot overlay (iOS cannot fully block capture).
- Electron: `npm run electron:start` — `setContentProtection(true)`.
- Push: add a Firebase project and drop `google-services.json` / `GoogleService-Info.plist` into the native apps, then set `FCM_SERVER_KEY` on the API.

Web cannot fully block PrintScreen.

## Seeded logins (API)

- Admin: `admin@sunrise.com` / `Admin@123`
- Teacher: `teacher@sunrise.com` / `Sunriseteacher@123`
- Student: `amit@example.com` / `student@123`
