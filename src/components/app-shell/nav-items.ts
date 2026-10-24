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
import type { TranslationKey } from "@/i18n";

export type NavItem = {
  href: string;
  labelKey: TranslationKey;
  icon: LucideIcon;
  /** Shown in the phone bottom bar. Others are reached from the sidebar or Settings. */
  primary: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", labelKey: "nav.home", icon: LayoutDashboard, primary: true },
  { href: "/entries", labelKey: "nav.entries", icon: ReceiptText, primary: true },
  { href: "/wallets", labelKey: "nav.wallets", icon: Wallet, primary: true },
  { href: "/loans", labelKey: "nav.loans", icon: HandCoins, primary: true },
  { href: "/reports", labelKey: "nav.reports", icon: ChartColumn, primary: true },
  { href: "/categories", labelKey: "nav.categories", icon: Tags, primary: false },
  { href: "/settings", labelKey: "nav.settings", icon: Settings, primary: false },
];
