import {
  ChartColumn,
  HandCoins,
  LayoutDashboard,
  ReceiptText,
  Settings,
  Tags,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shown in the phone bottom bar. Others are reached from the sidebar or Settings. */
  primary: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home", icon: LayoutDashboard, primary: true },
  { href: "/entries", label: "Entries", icon: ReceiptText, primary: true },
  { href: "/wallets", label: "Wallets", icon: Wallet, primary: true },
  { href: "/loans", label: "Loans", icon: HandCoins, primary: true },
  { href: "/reports", label: "Reports", icon: ChartColumn, primary: true },
  { href: "/categories", label: "Categories", icon: Tags, primary: false },
  { href: "/settings", label: "Settings", icon: Settings, primary: false },
];
