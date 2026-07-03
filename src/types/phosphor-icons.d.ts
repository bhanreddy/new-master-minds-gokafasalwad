// Type shim for deep `phosphor-react-native/src/icons/<Name>` imports, wired
// up via tsconfig `paths`. Without it, tsc type-checks the package's shipped
// .tsx source (node_modules/phosphor-react-native/src/**), whose bundled
// react-native types conflict with this project's. Runtime is unaffected:
// Metro ignores tsconfig paths and keeps loading the real icon files.
import type { Icon } from 'phosphor-react-native';

export const User: Icon;
export const WarningCircle: Icon;
export const ChatCircleDots: Icon;
export const Bed: Icon;
export const Bus: Icon;
export const Heart: Icon;
export const Flask: Icon;
export const FileText: Icon;

declare const icon: Icon;
export default icon;
