const fs = require('fs');
let content = fs.readFileSync('app/staff/dashboard.tsx', 'utf8');

// Fix the incorrect parameter closings
content = content.replace(/\}\);\s*:\s*\{/g, '}: {');

// Now, properly add `});` at the end of the components.
// We can find them by looking for their expected end lines or just manually doing it since there are only 8.
const replacements = [
  { func: 'ClayGraphic', search: '  return null;\n}', replace: '  return null;\n});' },
  { func: 'AttendanceArc', search: '      </View>\n    </View>\n  );\n}', replace: '      </View>\n    </View>\n  );\n});' },
  { func: 'StatCard', search: '      <Text style={{ fontSize: 24, fontWeight: \'800\', color: valueColor, letterSpacing: -0.5 }}>{value}</Text>\n    </View>\n  );\n}', replace: '      <Text style={{ fontSize: 24, fontWeight: \'800\', color: valueColor, letterSpacing: -0.5 }}>{value}</Text>\n    </View>\n  );\n});' },
  { func: 'AttendanceHero', search: '      </View>\n    </Animated.View>\n  );\n}', replace: '      </View>\n    </Animated.View>\n  );\n});' },
  { func: 'HeroBanner', search: '      />\n    </View>\n  );\n}', replace: '      />\n    </View>\n  );\n});' },
  { func: 'SectionLabel', search: '      <Text style={[styles.sectionLabelText, { color: t.text3 }]}>{label}</Text>\n    </View>\n  );\n}', replace: '      <Text style={[styles.sectionLabelText, { color: t.text3 }]}>{label}</Text>\n    </View>\n  );\n});' },
  { func: 'CardPattern', search: '      </View>\n    );\n  }\n  return null;\n}', replace: '      </View>\n    );\n  }\n  return null;\n});' },
  { func: 'MenuCard', search: '        </View>\n      </Pressable>\n    </Animated.View>\n  );\n}', replace: '        </View>\n      </Pressable>\n    </Animated.View>\n  );\n});' }
];

replacements.forEach(r => {
  if (content.includes(r.search)) {
    content = content.replace(r.search, r.replace);
  } else {
    console.log("Could not find replacement for", r.func);
  }
});

fs.writeFileSync('app/staff/dashboard.tsx', content);
