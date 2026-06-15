const fs = require('fs');
const glob = require('glob');
const ts = require('typescript');

const files = glob.sync('{src,app,components}/**/*.{tsx,ts}');
const problematicFiles = [];

files.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    if (!content.includes('useAnimatedStyle')) return;
    if (!content.includes('@expo/vector-icons')) return;

    // A simple regex approach to find `<Ionicons ... style={...} ... />`
    // or `<MaterialIcons ... style={...} ... />`
    const iconRegex = /<(Ionicons|MaterialIcons|MaterialCommunityIcons|Feather|FontAwesome5|FontAwesome|Entypo|AntDesign)[^>]+style=\{([^}]+)\}/g;
    let match;
    while ((match = iconRegex.exec(content)) !== null) {
        const styleContent = match[2];
        // If the style references something that looks like an animated style (e.g. contains 'Style' or a variable defined via useAnimatedStyle)
        // For simplicity, let's just print all matches in these files and manually verify.
        console.log(`Found in ${file}: ${match[0]}`);
        if (!problematicFiles.includes(file)) problematicFiles.push(file);
    }
});
