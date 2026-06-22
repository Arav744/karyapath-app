# Karyapath — Mobile (React Native / Expo)

A scaffold of the Karyapath app for phones, talking to the **same Express
server** as the web client — no backend changes needed. This was built with
Expo specifically so you can run it with nothing more than your own phone
and the free Expo Go app, no Xcode or Android Studio required to get
started.

## What's here

- Login, Dashboard (workspace list), Board (Kanban — adapted for touch:
  swipe between stage tabs instead of drag-and-drop, with explicit
  "move to..." buttons on each card), Task detail/edit/create, and a
  Notifications screen for the alert system.
- Dark theme + monospace font matching the web client.
- The same access rules, since it's the same API: admin sees everything,
  members see only their workspaces, private sub-workspaces stay private.

## What this is NOT (yet)

This is a **scaffold you run and continue building**, not a finished,
installable app. There's no app published to the App Store / Play Store,
no production build pipeline, and a few things are deliberately minimal
(see "Known gaps" below). I can't run, test, or screenshot this myself —
React Native needs a real device or simulator, which doesn't exist in the
environment I built this in. Everything here was verified by parsing it
with the actual Expo Babel preset (catches JSX/syntax errors) but **not**
by actually rendering it.

## Running it

1. Install [Expo Go](https://expo.dev/go) on your phone (App Store or
   Play Store) — or set up an iOS Simulator / Android Emulator if you'd
   rather not use a physical device.

2. **Point the app at your server.** Open `src/api/client.js` and check
   `DEFAULT_DEV_URL`:
   - Android emulator → `http://10.0.2.2:4000` (already set)
   - iOS simulator → `http://localhost:4000` (already set)
   - **Physical phone via Expo Go** → you MUST change this to your
     computer's LAN IP address, e.g. `http://192.168.1.42:4000` — find
     it with `ipconfig` (Windows) or `ifconfig` / `ipconfig getifaddr en0`
     (Mac). "localhost" on your phone means the phone itself, not your
     computer, so the default won't work for a real device.
   - Your computer and phone need to be on the **same Wi-Fi network**.

3. Make sure the Karyapath server is running (see the main project
   README — `cd ../server && npm start`).

4. Install and start:
   ```bash
   cd mobile
   npm install
   npm start
   ```
   This opens the Expo dev tools. Scan the QR code with Expo Go (Android:
   the Expo Go app's scanner; iOS: your regular Camera app, which will
   offer to open it in Expo Go).

5. Log in with the same IDs as the web app (e.g. `rajat` / `rajat`).

## Known gaps to finish before this is a "real" app

- **Push notifications aren't wired up.** The alert system on the server
  creates notifications you can see on the Notifications screen, but
  there's no push delivery (no badge/banner when the app isn't open).
  `expo-notifications` is already a dependency for this reason — the
  next step is registering a push token per device and having the
  server's scheduler (`server/lib/scheduler.js`) send to it via Expo's
  push API when it creates a notification.
- **No date/time pickers.** Due date/time are plain text inputs
  (`YYYY-MM-DD` / `HH:MM`) rather than native pickers — swap in
  `@react-native-community/datetimepicker` for a real picker UI.
- **No pull-to-create-workspace or member management UI** — those exist
  on the web client but weren't ported here yet.
- **Drag-and-drop on the board** isn't attempted on mobile (impractical
  on a single-column phone layout); moving a task between stages uses
  explicit "→ stage name" buttons instead. A tablet-width layout with
  real drag gestures would be a reasonable next step on iPad/Android
  tablets specifically.
- **No app icon / splash image** beyond the solid background color in
  `app.json` — drop real images into `assets/` and reference them there.
- This was scaffolded directly as Expo's "bare-ish" managed workflow.
  When you're ready to publish to app stores, you'll run through Expo's
  `eas build` process, which needs an Expo account and (for iOS) an
  Apple Developer account.
