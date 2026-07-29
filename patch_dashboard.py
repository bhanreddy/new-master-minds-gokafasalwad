import re
import sys

with open('/Users/bhanureddy/Desktop/Single Source of truth/SchoolIMS/SchoolIMS-Frontend/app/admin/dashboard.tsx', 'r') as f:
    content = f.read()

def replace_block(pattern, replacement, text, count=1):
    new_text, n = re.subn(pattern, replacement, text, count=count, flags=re.MULTILINE)
    if n == 0:
        print(f"Warning: pattern not found: {pattern[:50]}...")
    return new_text

# A. PulseIndicator
pulse_indicator_pattern = r'function PulseIndicator\(\{ color = \'#10B981\' \}: \{ color\?: string \}\) \{[\s\S]*?return \([\s\S]*?\}\);?\n\}'
pulse_indicator_replacement = '''function PulseIndicator({ color = '#10B981' }: { color?: string }) {
  // Static dot for maximum performance.
  return (
    <View style={{ width: 14, height: 14, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 7, height: 7, backgroundColor: color, borderRadius: 3.5 }} />
    </View>
  );
}'''
content = replace_block(pulse_indicator_pattern, pulse_indicator_replacement, content)

# B. MetricCard skeleton animation
content = replace_block(
    r'  // Gentle pulse for the skeleton placeholder while loading\.[\s\S]*?const skeletonAnim = useAnimatedStyle\(\(\) => \(\{ opacity: pulse\.value \}\)\);\n',
    r'  // Skeleton placeholder (static for perf)\n',
    content
)
content = replace_block(
    r'<Animated\.View style=\{\[skeletonAnim, \{\n            width: \'62%\', height: isWideScreen \? 22 : 17,\n            borderRadius: 6, backgroundColor: skeletonColor,\n          \}\}\] />',
    r'<View style={{\n            width: \'62%\', height: isWideScreen ? 22 : 17,\n            borderRadius: 6, backgroundColor: skeletonColor,\n          }} />',
    content
)

# C. ClayCardOverlays sheen layers
content = replace_block(
    r'      \{!isAndroid && \(\n        <View style=\{\{\n          position: \'absolute\', bottom: 0, left: 0, right: 0, height: \'40%\',\n          borderBottomLeftRadius: cardRadius, borderBottomRightRadius: cardRadius,\n          backgroundColor: isDark \? \'rgba\(0,0,0,0\.10\)\' : `\$\{accentColor\}0A`,\n        \}\} />\n      \)\}\n',
    r'',
    content
)

# D. GridItem decorative circles
# The 3 circles are from "width: isWideScreen ? 36 : 28" to "width: 6"
content = replace_block(
    r'          <View \n            pointerEvents="none"\n            style=\{\{\n              position: \'absolute\',\n              width: isWideScreen \? 36 : 28,[\s\S]*?zIndex: 1,\n            \}\} \n          />',
    r'',
    content
)

# G. TierLegend
content = replace_block(
    r'<LinearGradient\n              colors=\{t\.g\}\n              start=\{\{ x: 0, y: 0 \}\} end=\{\{ x: 1, y: 1 \}\}\n              style=\{\{ width: 12, height: 12, borderRadius: 6 \}\}\n            />',
    r'<View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: t.g[1] }} />',
    content
)
content = replace_block(
    r'function TierLegend\(\{ isDark \}: \{ isDark: boolean \}\) \{',
    r'const TierLegend = React.memo(function TierLegend({ isDark }: { isDark: boolean }) {',
    content
)
# Close React.memo for TierLegend
content = replace_block(
    r'    </Animated\.View>\n  \);\n\}',
    r'    </Animated.View>\n  );\n});',
    content
)

# H. SectionHeader divider
content = replace_block(
    r'<LinearGradient\n            colors=\{\[color \+ \'60\', isDark \? \'rgba\(255,255,255,0\.04\)\' : \'rgba\(15,23,42,0\.05\)\', \'transparent\'\]\}\n            start=\{\{ x: 0, y: 0 \}\} end=\{\{ x: 1, y: 0 \}\}\n            style=\{\{ flex: 1 \}\}\n          />',
    r'<View style={{ flex: 1, backgroundColor: color, opacity: isDark ? 0.2 : 0.1 }} />',
    content
)
content = replace_block(
    r'function SectionHeader\(\{ label, delay, styles, isDark, accentColor \}: \{',
    r'const SectionHeader = React.memo(function SectionHeader({ label, delay, styles, isDark, accentColor }: {',
    content
)
# Close React.memo for SectionHeader
content = replace_block(
    r'    </Animated\.View>\n  \);\n\}\n\n/\* ───',
    r'    </Animated.View>\n  );\n});\n\n/* ───',
    content
)

# I. statusBlock decorative chart
content = replace_block(
    r'      \{!isAndroid && \(\n        <View style=\{\{ position: \'absolute\', bottom: -10, left: 0, right: 0, opacity: 0\.08 \}\}>\n          <LineChart data=\{\[\{value: 20\}, \{value: 50\}, \{value: 30\}, \{value: 80\}, \{value: 40\}, \{value: 90\}\]\} height=\{60\} width=\{rightColWidth\} color="#3B82F6" thickness=\{3\} startFillColor="#3B82F6" endFillColor="transparent" yAxisThickness=\{0\} xAxisThickness=\{0\} hideRules hideDataPoints />\n        </View>\n      \)\}\n',
    r'',
    content
)

# M. MetricCard sheen layers
content = replace_block(
    r'        <View style=\{\{\n          position: \'absolute\', top: 0, left: 0, right: 0, height: \'52%\',\n          borderTopLeftRadius: cardRadius, borderTopRightRadius: cardRadius,\n          backgroundColor: isDark \? \'rgba\(255,255,255,0\.04\)\' : \'rgba\(255,255,255,0\.55\)\',\n        \}\} />\n        <View style=\{\{\n          position: \'absolute\', bottom: 0, left: 0, right: 0, height: \'38%\',\n          borderBottomLeftRadius: cardRadius, borderBottomRightRadius: cardRadius,\n          backgroundColor: isDark \? \'rgba\(0,0,0,0\.10\)\' : `\$\{iconColor\}0A`,\n        \}\} />\n',
    r'''        {!isAndroid && (
          <View style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '52%',
            borderTopLeftRadius: cardRadius, borderTopRightRadius: cardRadius,
            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.55)',
          }} />
        )}
        {!isAndroid && (
          <View style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: '38%',
            borderBottomLeftRadius: cardRadius, borderBottomRightRadius: cardRadius,
            backgroundColor: isDark ? 'rgba(0,0,0,0.10)' : `${iconColor}0A`,
          }} />
        )}
''',
    content
)

# Write out the modified content back
with open('/Users/bhanureddy/Desktop/Single Source of truth/SchoolIMS/SchoolIMS-Frontend/app/admin/dashboard.tsx', 'w') as f:
    f.write(content)

print("Pattern replacement applied successfully.")
