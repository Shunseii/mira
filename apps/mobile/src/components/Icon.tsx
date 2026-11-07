import type { LucideIcon } from "lucide-react-native";
import { GROUP_ICON_COMPONENTS } from "./groupIcons";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import ArrowDownUp from "lucide-react-native/icons/arrow-down-up";
import ArrowUpDown from "lucide-react-native/icons/arrow-up-down";
import Ban from "lucide-react-native/icons/ban";
import Check from "lucide-react-native/icons/check";
import CheckCheck from "lucide-react-native/icons/check-check";
import ChevronLeft from "lucide-react-native/icons/chevron-left";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import ChevronsUpDown from "lucide-react-native/icons/chevrons-up-down";
import CircleCheck from "lucide-react-native/icons/circle-check";
import Clock3 from "lucide-react-native/icons/clock-3";
import CloudOff from "lucide-react-native/icons/cloud-off";
import CloudUpload from "lucide-react-native/icons/cloud-upload";
import Eye from "lucide-react-native/icons/eye";
import EyeOff from "lucide-react-native/icons/eye-off";
import GripVertical from "lucide-react-native/icons/grip-vertical";
import Layers from "lucide-react-native/icons/layers";
import ListOrdered from "lucide-react-native/icons/list-ordered";
import ListPlus from "lucide-react-native/icons/list-plus";
import LockKeyhole from "lucide-react-native/icons/lock-keyhole";
import LockKeyholeOpen from "lucide-react-native/icons/lock-keyhole-open";
import LogOut from "lucide-react-native/icons/log-out";
import Minus from "lucide-react-native/icons/minus";
import Pencil from "lucide-react-native/icons/pencil";
import Plus from "lucide-react-native/icons/plus";
import RefreshCw from "lucide-react-native/icons/refresh-cw";
import Search from "lucide-react-native/icons/search";
import Server from "lucide-react-native/icons/server";
import Settings2 from "lucide-react-native/icons/settings-2";
import ShoppingBasket from "lucide-react-native/icons/shopping-basket";
import Smartphone from "lucide-react-native/icons/smartphone";
import Tags from "lucide-react-native/icons/tags";
import Trash2 from "lucide-react-native/icons/trash";
import UserRoundPlus from "lucide-react-native/icons/user-round-plus";
import UsersRound from "lucide-react-native/icons/users-round";
import Undo2 from "lucide-react-native/icons/undo-2";
import X from "lucide-react-native/icons/x";

export const ICONS = {
  ...GROUP_ICON_COMPONENTS,
  "arrow-left": ArrowLeft,
  "arrow-down-up": ArrowDownUp,
  "arrow-up-down": ArrowUpDown,
  ban: Ban,
  check: Check,
  "check-check": CheckCheck,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  "chevrons-up-down": ChevronsUpDown,
  "circle-check": CircleCheck,
  "clock-3": Clock3,
  "cloud-off": CloudOff,
  "cloud-upload": CloudUpload,
  eye: Eye,
  "eye-off": EyeOff,
  "grip-vertical": GripVertical,
  layers: Layers,
  "list-ordered": ListOrdered,
  "list-plus": ListPlus,
  "lock-keyhole": LockKeyhole,
  "lock-keyhole-open": LockKeyholeOpen,
  "log-out": LogOut,
  minus: Minus,
  pencil: Pencil,
  plus: Plus,
  "refresh-cw": RefreshCw,
  search: Search,
  server: Server,
  "settings-2": Settings2,
  "shopping-basket": ShoppingBasket,
  smartphone: Smartphone,
  tags: Tags,
  "trash-2": Trash2,
  "user-round-plus": UserRoundPlus,
  "users-round": UsersRound,
  "undo-2": Undo2,
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
