"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  DoorOpen,
  FileText,
  LayoutDashboard,
  ReceiptText,
  Settings,
  UsersRound,
} from "lucide-react";

const ICONS = {
  dashboard: LayoutDashboard,
  reception: DoorOpen,
  subscriptions: UsersRound,
  schedule: CalendarDays,
  invoices: FileText,
  accounting: ReceiptText,
  hr: BarChart3,
  settings: Settings,
} as const;

export type NavItem = { key: keyof typeof ICONS; href: string; label: string; badge?: number };

export function SideNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 px-3">
      {items.map((item) => {
        const Icon = ICONS[item.key];
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`group flex items-center gap-3 rounded-xl px-3 h-11 text-sm transition ${
              active
                ? "bg-emerald-50 text-emerald-700 font-bold ring-1 ring-emerald-100"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <Icon className={`w-[18px] h-[18px] ${active ? "text-emerald-600" : "text-slate-400 group-hover:text-slate-600"}`} />
            <span className="flex-1">{item.label}</span>
            {item.badge ? (
              <span className="text-[11px] bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 font-bold tabular-nums">
                {new Intl.NumberFormat("ar-SA").format(item.badge)}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
