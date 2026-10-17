# The iPhone app: building it with Codemagic

The iPhone app is the same React app (`webapp/`) inside a Capacitor shell (`webapp/ios/`).
Codemagic builds it on a cloud Mac (`codemagic.yaml` at the repo root) and sends it to
TestFlight. No Mac is needed.

- Bundle ID: `info.agentictrading.zelos` (same as `docs/SIGN_IN_WITH_APPLE.md`)
- Name on the Home Screen: **Zelos**; in the App Store: **Zelos Trade War**
- iPhone only (no iPad version for now, so no iPad screenshots are needed)
- Sign-in inside the app uses Apple's and Google's own sheets (`webapp/src/lib/nativeAuth.ts`),
  then the same Firebase account as the website.

## One-time setup (owner)

### 1. Apple Developer (developer.apple.com → Certificates, IDs & Profiles → Identifiers)
- Open the App ID `info.agentictrading.zelos` (create it if it isn't there: App IDs → App →
  Explicit, that bundle ID).
- Tick **Sign in with Apple** (Enable as a primary App ID). Save.

### 2. App Store Connect (appstoreconnect.apple.com)
- **Apps → + → New App**: iOS, name *Zelos Trade War*, bundle ID `info.agentictrading.zelos`,
  SKU `zelos-ios`.
- **Users and Access → Integrations → App Store Connect API → +**: name *Codemagic*, access
  **App Manager**. Download the `.p8` key (only once). Note the **Issuer ID** and **Key ID**.

### 3. Firebase (console.firebase.google.com → leaderboard-agentictrading)
- **Project settings → General → Your apps → Add app → iOS**: bundle ID
  `info.agentictrading.zelos`, nickname *Zelos iPhone*. Skip the SDK steps.
- Download **GoogleService-Info.plist**. Not a password, but keep it out of the repo
  (`webapp/ios/.gitignore`): Codemagic adds it to each build.

### 4. Codemagic (codemagic.io)
- **Team settings → Integrations → Developer Portal → Connect**: name it exactly
  `Zelos App Store Connect`, paste the Issuer ID and Key ID, upload the `.p8`.
- **Team settings → codemagic.yaml settings → Code signing identities**: under
  *iOS certificates* choose **Generate certificate** (Apple Distribution) with that
  integration; under *iOS provisioning profiles* **Fetch profiles** and pick the App Store
  profile for `info.agentictrading.zelos`.
- **The Zelos app → Environment variables**: add `GOOGLE_SERVICE_INFO_PLIST`, tick
  **Secure**, use **Select file** to upload `GoogleService-Info.plist`, group `firebase_ios`.
- On the app's page pick the branch that has `codemagic.yaml` (until the iPhone PR is merged,
  that's `claude/ios-shell`; after merging, `main`) and press **Check for configuration file**.
  The workflow **iPhone app → TestFlight** appears. (The "Unity quick start" text on that page
  is Codemagic's generic help; ignore it.)

## Building

Codemagic → Zelos → **Start new build** → workflow `ios-testflight` → branch → Start.
About 15–25 minutes. When it's green the build appears in App Store Connect → TestFlight
(Apple takes a few more minutes to process it). Add yourself as an internal tester to
install it with the TestFlight app.

## What the build does (`codemagic.yaml`)
1. `npm ci` in `webapp/`.
2. Writes `GoogleService-Info.plist` and adds Google sign-in's return address
   (`REVERSED_CLIENT_ID`) to `Info.plist`.
3. `npm run build:native`: the normal web build, then `scripts/build-native.mjs` puts it in
   `dist-native/` (the app's files under `app/`, so they keep the `/app/` address they have
   on the website), then `npx cap sync ios` copies it into the Xcode project.
4. Signing (`xcode-project use-profiles`), build number = Codemagic's build number.
5. Builds the `.ipa` and uploads it to TestFlight.

## Not in the iPhone app yet (later A4 steps)
- **Buying tokens**: Apple in-app purchase. Until then the tokens sheet shows how to earn
  tokens (no Square inside the app, guideline 3.1.1).
- **Push notifications**: Apple push (APNs). The web push card is hidden in the app.
- **Training Ground drills and the globe** load from agentictrading.info for now; they'll be
  bundled into the app.
