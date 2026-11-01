# Expense Tracker (Android)

React Native (Expo) app for the Expense Tracker web app. It signs in to the same accounts and
reads and writes the same database, through the web app's `/api/v1` routes. The app never talks to
the database directly.

## Before you build

1. Deploy the web app to Vercel (push `main`). Note its address, for example `https://xyz.vercel.app`.
2. Copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL` to that address. It is baked into the
   app at build time, so rebuild after changing it.

## Build an APK you can install

Do this on a Linux drive, not NTFS (Gradle and node_modules fail on NTFS). Example:

```
rsync -a --exclude node_modules --exclude android --exclude .expo ./ ~/builds/expense-mobile/
cd ~/builds/expense-mobile && npm install
export JAVA_HOME=<android-studio>/jbr ANDROID_HOME=~/Android/Sdk
npx expo prebuild --platform android --no-install
echo "sdk.dir=$ANDROID_HOME" > android/local.properties
cd android && ./gradlew assembleRelease
# APK: android/app/build/outputs/apk/release/app-release.apk
```

A release build bundles the JavaScript, so it runs without a dev server. Out of the box it is signed
with the debug key, which is fine for installing on your own phone. Use a real keystore before
publishing to the Play Store.

Install with `adb install -r app-release.apk`, or copy the file to the phone.

## Run on the emulator while developing

Use a debug build plus Metro (`npx expo start --dev-client`), run `adb reverse tcp:8081 tcp:8081`
and `adb reverse tcp:3000 tcp:3000`, and set `EXPO_PUBLIC_API_URL=http://localhost:3000`.
`10.0.2.2` did not reach the host on this machine.

## Rules

- Colours only come from `src/theme/colors.ts` (same values as the web theme).
- Every call-to-action uses `src/components/button.tsx`. It shows a spinner while its action runs and
  ignores taps until it finishes.
- Money is whole poisha. Use `src/lib/money.ts`.
- `src/i18n/en.ts` and `bn.ts` are copied from the web app. Keep them in step with the web app.
