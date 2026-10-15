# Sign in with Apple: setup (owner, one time)

App Store guideline 4.8: an app that offers Google sign-in must also offer Sign in with Apple.
The app's sign-in sheet (`webapp/src/shell/SignInSheet.tsx`) shows Continue with Apple and
Continue with Google. Apple sign-in only works once these steps are done. Do them **before**
merging the Sign in with Apple PR, or the Apple button will show "Couldn't sign in".

You need: the Apple Developer account, and the Firebase console for `leaderboard-agentictrading`.

## 1. Apple Developer → Certificates, Identifiers & Profiles

1. **Identifiers → App IDs → +** (skip if the iPhone app's App ID exists): App, bundle ID
   `info.agentictrading.zelos`, description "Zelos Trade War". Tick **Sign in with Apple**. Save.
2. **Identifiers → Services IDs → +**: description "Zelos web sign-in", identifier
   `info.agentictrading.zelos.web`. Save, open it, tick **Sign in with Apple** → **Configure**:
   - Primary App ID: the one from step 1
   - Domains and subdomains: `leaderboard-agentictrading.firebaseapp.com`, `agentictrading.info`
   - Return URLs: `https://leaderboard-agentictrading.firebaseapp.com/__/auth/handler`
   - Save, Continue, Save.
3. **Keys → +**: name "Zelos Sign in with Apple", tick **Sign in with Apple** → Configure →
   the App ID from step 1. Register and **download the .p8 file** (only once). Note the **Key ID**.
4. Your **Team ID** is at the top right of the developer site (10 characters).

## 2. Firebase console → Authentication → Sign-in method → Add new provider → Apple

- Enable.
- Services ID: `info.agentictrading.zelos.web`
- OAuth code flow: Apple Team ID, Key ID, and paste the contents of the .p8 file.
- Save. (Authentication → Settings → Authorized domains must list `agentictrading.info`; it already
  does for Google sign-in.)

Don't commit the .p8 file or paste it anywhere else: it lives only in the Firebase console.

## 3. Check

Open https://agentictrading.info/app/, tap Sign in → Continue with Apple. Apple may let people
hide their email (an `@privaterelay.appleid.com` address); the app works the same. The welcome
screen asks for a name, since Apple only shares it the first time.

## What the code does

- `lib/auth.tsx`: `openSignIn()` shows the sheet; `signInWith('apple' | 'google')` signs in with a
  popup (redirect if popups are blocked). The iPhone app will use the native Apple sheet through
  the Capacitor Firebase Authentication plugin (PR A4).
- Deleting an account signed in with Apple re-confirms with Apple and revokes Apple's token
  (`revokeAccessToken`), as Apple requires.
- The server counts Apple sign-ins as verified accounts (welcome tokens, battle rewards,
  community members), like Google (`VERIFIED_PROVIDERS` in functions/main.py).
