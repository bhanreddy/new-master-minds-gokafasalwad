#!/bin/bash
set -e

echo "================================================"
echo " SchoolIMS — New School Build Setup"
echo "================================================"

# Verify .env has been edited (not still placeholder)
SCHOOL_ID=$(grep EXPO_PUBLIC_SCHOOL_ID .env | cut -d '=' -f2)
if [[ "$SCHOOL_ID" == *"HERE"* ]] || [[ -z "$SCHOOL_ID" ]]; then
  echo "❌ .env not configured. Edit EXPO_PUBLIC_SCHOOL_ID first."
  exit 1
fi

# Verify app.json has been edited
PACKAGE=$(node -e "console.log(require('./app.json').expo.android.package)")
if [[ "$PACKAGE" == *"HERE"* ]]; then
  echo "❌ app.json not configured. Edit android.package first."
  exit 1
fi

# Verify google-services.json has been replaced
if grep -q "REPLACE THIS FILE" google-services.json 2>/dev/null; then
  echo "❌ google-services.json is still the template."
  echo "   Download the real file from Firebase Console."
  exit 1
fi

# Verify google-services.json package matches app.json package
GS_PACKAGE=$(node -e "
  const gs = require('./google-services.json');
  const client = gs.client && gs.client[0];
  console.log(client?.client_info?.android_client_info?.package_name || '');
")
if [ "$GS_PACKAGE" != "$PACKAGE" ]; then
  echo "❌ Package mismatch:"
  echo "   google-services.json : $GS_PACKAGE"
  echo "   app.json             : $PACKAGE"
  echo "   Download the correct google-services.json from Firebase."
  exit 1
fi

echo ""
echo "✅ Config verified:"
echo "   School ID : $SCHOOL_ID"
echo "   Package   : $PACKAGE"
echo ""
echo "🧹 Cleaning stale artifacts..."
rm -rf android ios .expo node_modules
find . -name '._*' -not -path './.git/*' -delete 2>/dev/null || true

echo "📦 Installing dependencies..."
npm install

echo "🧹 Cleaning AppleDouble files generated during install..."
find . -name '._*' -not -path './.git/*' -delete 2>/dev/null || true

echo "🔧 Running Expo prebuild..."
npx expo prebuild --clean

echo ""
echo "================================================"
echo " ✅ Ready! Run: npm run android"
echo "================================================"
