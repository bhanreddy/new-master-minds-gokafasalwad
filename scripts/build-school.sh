#!/bin/bash

# Configuration
SCHOOL_CODE=$1
SCHOOL_NAME=$2
SCHOOL_ID=$3

# Paths
APP_JSON="app.json"
ENV_FILE=".env"

# Ensure all arguments are provided
if [ -z "$SCHOOL_CODE" ] || [ -z "$SCHOOL_NAME" ] || [ -z "$SCHOOL_ID" ]; then
    echo "Usage: ./scripts/build-school.sh <SCHOOL_CODE> \"<SCHOOL_NAME>\" <SCHOOL_ID>"
    echo "Example: ./scripts/build-school.sh DEV \"Development School\" 1"
    exit 1
fi

echo "Building configuration for $SCHOOL_NAME ($SCHOOL_CODE)..."

# Create .env from template if missing, else just update
if [ ! -f "$ENV_FILE" ]; then
    echo "Notice: .env file missing. Copying from .env.example..."
    cp .env.example .env
fi

# Determine the absolute path for Node execution
NODE_SCRIPT=$(cat << 'EOF'
const fs = require('fs');

const [,, schoolCode, schoolName, schoolId] = process.argv;

// Update app.json
const appJsonRaw = fs.readFileSync('app.json', 'utf8');
const appJson = JSON.parse(appJsonRaw);

appJson.expo.name = schoolName;
appJson.expo.slug = schoolCode.toLowerCase() + "-ims";
appJson.expo.ios.bundleIdentifier = `com.nexsyrus.${schoolCode.toLowerCase()}`;
appJson.expo.android.package = `com.nexsyrus.${schoolCode.toLowerCase()}`;

fs.writeFileSync('app.json', JSON.stringify(appJson, null, 2));
console.log('✅ Updated app.json successfully.');

// Update .env
let envContent = fs.readFileSync('.env', 'utf8');

// Helper to update env vars using regex
const setEnvVar = (name, value) => {
    const regex = new RegExp(`^${name}=.*$`, 'm');
    if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `${name}=${value}`);
    } else {
        envContent += `\n${name}=${value}`;
    }
}

setEnvVar('EXPO_PUBLIC_SCHOOL_ID', schoolId);
setEnvVar('EXPO_PUBLIC_SCHOOL_CODE', schoolCode);
setEnvVar('EXPO_PUBLIC_SCHOOL_NAME', schoolName);

fs.writeFileSync('.env', envContent);
console.log('✅ Updated .env successfully.');
EOF
)

# Run the node script
node -e "$NODE_SCRIPT" "$SCHOOL_CODE" "$SCHOOL_NAME" "$SCHOOL_ID"

if [ $? -eq 0 ]; then
    echo "Build setup for $SCHOOL_NAME completed successfully."
else
    echo "Error: Build setup failed."
    exit 1
fi
