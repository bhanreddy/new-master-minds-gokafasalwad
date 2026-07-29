const fs = require('fs');
let content = fs.readFileSync('app/staff/dashboard.tsx', 'utf8');

const targetMenuGrid = `        <View style={styles.menuGrid}>
          {menuItems.map((item, index) => (
            <MenuCard
              key={item.configKey}
              title={item.title}
              subtitle={item.subtitle}
              configKey={item.configKey}
              badge={(item as any).badge}
              onPress={() => handleMenuPress(item.route)}
              index={index}
              isDark={isDark}
            />
          ))}
        </View>`;

const replacementMenuGrid = `        <View style={styles.menuGrid}>
          {useMemo(() => menuItems.map((item, index) => (
            <MenuCard
              key={item.configKey}
              title={item.title}
              subtitle={item.subtitle}
              configKey={item.configKey}
              badge={(item as any).badge}
              onPress={() => handleMenuPress(item.route)}
              index={index}
              isDark={isDark}
            />
          )), [menuItems, handleMenuPress, isDark])}
        </View>`;

content = content.replace(targetMenuGrid, replacementMenuGrid);

fs.writeFileSync('app/staff/dashboard.tsx', content);
