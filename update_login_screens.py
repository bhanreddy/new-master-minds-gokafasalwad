import os
import re

files_to_update = [
    'login.tsx',
    'admin-login.tsx',
    'staff-login.tsx',
    'driver-login.tsx',
    'accounts-login.tsx'
]

base_dir = '/Users/bhanureddy/Desktop/Single Source of Truth/Native SupabaseBackend/expo base project/app/'

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # 1. Remove duplicated components and add imports
    import_statement = "import { useLoginTheme } from '@/src/hooks/useLoginTheme';\nimport { DecorRing, FloatingInput, SignInButton } from '@/src/components/auth/LoginShared';\n\n// ─── Main Screen ──────────────────────────────────────────────────────────────"
    
    # Use regex to find the start of useLoginTheme and end at Main Screen
    pattern = re.compile(r'const useLoginTheme = \(\) => \{.*?\n// ─── Main Screen ──────────────────────────────────────────────────────────────', re.DOTALL)
    
    if pattern.search(content):
        content = pattern.sub(import_statement, content)
    else:
        print(f"Pattern not found in {filepath}")

    # 2. Fix StatusBar
    content = content.replace(
        '<StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />',
        '<StatusBar barStyle={C.isDark ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />'
    )
    
    # 3. Fix KeyboardAvoidingView
    content = content.replace(
        "style={{ flex: 1 }}",
        "style={{ flex: 1, backgroundColor: C.bg }}"
    )

    # 4. Fix LinearGradient logo ring
    content = content.replace(
        "colors={['#FFFFFF', C.surfaceAlt]}",
        "colors={[C.isDark ? C.surface : '#FFFFFF', C.surfaceAlt]}"
    )
    
    # 5. Accounts login modal fix
    if 'accounts-login.tsx' in filepath:
        content = content.replace(
            "backgroundColor: '#FFFFFF'",
            "backgroundColor: C.surface"
        )
        content = content.replace(
            "placeholderTextColor=\"#94A3B8\"",
            "placeholderTextColor={C.inkSoft}"
        )
        content = content.replace(
            "style={styles.reasonInput}",
            "style={[styles.reasonInput, { color: C.ink }]}"
        )

    with open(filepath, 'w') as f:
        f.write(content)

for filename in files_to_update:
    filepath = os.path.join(base_dir, filename)
    if os.path.exists(filepath):
        process_file(filepath)
        print(f"Updated {filename}")
    else:
        print(f"File not found: {filename}")
