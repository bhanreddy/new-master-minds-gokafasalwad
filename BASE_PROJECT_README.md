# SchoolIMS Base Project

## ⚠️ This is the master base project — do NOT build directly from here.

## How to create a new school build

### Step 1 — Duplicate this folder
Copy this entire folder. Rename it to the school name.
Example: `schoolims-greenvalley`

### Step 2 — Configure the new school
Edit these files in the duplicated folder:

| File | What to change |
|---|---|
| `.env` | All `SCHOOL_` values |
| `app.json` | `name`, `slug`, `android.package`, `ios.bundleIdentifier`, `extra.eas.projectId` |
| `eas.json` | Add new profile block for this school |
| `google-services.json` | Replace with real file from Firebase Console |

### Step 3 — Get Expo Project ID
`cd` into the duplicated folder, then:
```bash
eas login
eas project:create
```
This writes the `projectId` into `app.json` automatically.

### Step 4 — Run setup script
```bash
./scripts/new-school-setup.sh
```

### Step 5 — Build
```bash
npm run android
```

## What NOT to do
- Never run `npm run android` directly from this base folder
- Never commit school-specific `.env` values
- Never commit `android/` or `ios/` directories
