import type { LucideIcon } from "lucide-react-native";
import { GROUP_ICON_COMPONENTS } from "./groupIcons";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import Ban from "lucide-react-native/icons/ban";
import Check from "lucide-react-native/icons/check";
import ChevronLeft from "lucide-react-native/icons/chevron-left";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import ChevronsUpDown from "lucide-react-native/icons/chevrons-up-down";
import CircleCheck from "lucide-react-native/icons/circle-check";
import CloudOff from "lucide-react-native/icons/cloud-off";
import CloudUpload from "lucide-react-native/icons/cloud-upload";
import Eye from "lucide-react-native/icons/eye";
import EyeOff from "lucide-react-native/icons/eye-off";
import GripVertical from "lucide-react-native/icons/grip-vertical";
import LockKeyhole from "lucide-react-native/icons/lock-keyhole";
import LogOut from "lucide-react-native/icons/log-out";
import Minus from "lucide-react-native/icons/minus";
import Pencil from "lucide-react-native/icons/pencil";
import Plus from "lucide-react-native/icons/plus";
import Search from "lucide-react-native/icons/search";
import Server from "lucide-react-native/icons/server";
import Settings2 from "lucide-react-native/icons/settings-2";
import ShoppingBasket from "lucide-react-native/icons/shopping-basket";
import Tags from "lucide-react-native/icons/tags";
import Trash2 from "lucide-react-native/icons/trash";
import UserRoundPlus from "lucide-react-native/icons/user-round-plus";
import UsersRound from "lucide-react-native/icons/users-round";
import X from "lucide-react-native/icons/x";

export const ICONS = {
  ...GROUP_ICON_COMPONENTS,
  "arrow-left": ArrowLeft,
  ban: Ban,
  check: Check,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  "chevrons-up-down": ChevronsUpDown,
  "circle-check": CircleCheck,
  "cloud-off": CloudOff,
  "cloud-upload": CloudUpload,
  eye: Eye,
  "eye-off": EyeOff,
  "grip-vertical": GripVertical,
  "lock-keyhole": LockKeyhole,
  "log-out": LogOut,
  minus: Minus,
  pencil: Pencil,
  plus: Plus,
  search: Search,
  server: Server,
  "settings-2": Settings2,
  "shopping-basket": ShoppingBasket,
  tags: Tags,
  "trash-2": Trash2,
  "user-round-plus": UserRoundPlus,
  "users-round": UsersRound,
  x: X,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export const Icon = ({
  name,
  size = 20,
  color,
  strokeWidth = 2,
}: {
  name: IconName;
  size?: number;
  color: string;
  strokeWidth?: number;
}) => {
  const Component = ICONS[name];
  return <Component size={size} color={color} strokeWidth={strokeWidth} />;
};
