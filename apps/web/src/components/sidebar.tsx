"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ChevronsLeft,
  ChevronsRight,
  ChevronsUpDown,
  Folder,
  LogOut,
  Menu,
  QrCode,
  Search,
  Settings,
  X,
} from "lucide-react";
import { logout } from "@/app/actions";
import { MAIN_NAV, SYSTEM_NAV, type NavItem } from "@/lib/nav";
import { cn } from "@/lib/cn";

interface SidebarProps {
  unreadEvents: number;
  listenerOnline: boolean;
  ownerEmail: string | null;
  totpEnabled: boolean;
}

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function Sidebar({ unreadEvents, listenerOnline, ownerEmail, totpEnabled }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => setMobileOpen(false), [pathname]);

  const extra = (item: NavItem) => {
    if (item.href === "/mutasi" && unreadEvents > 0) {
      return (
        <span className="rounded-full bg-warn-bg px-2 py-0.5 text-[11px] font-medium text-warn">
          {unreadEvents}
          <span className="sr-only"> belum terbaca</span>
        </span>
      );
    }
    if (item.href === "/perangkat") {
      return (
        <span
          className={cn("size-2 rounded-full", listenerOnline ? "bg-ok-dot" : "bg-bad")}
          aria-label={listenerOnline ? "Listener online" : "Listener offline"}
          role="img"
        />
      );
    }
    return null;
  };

  const renderItem = (item: NavItem) => {
    const active = isActive(pathname, item.href);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        title={collapsed ? item.label : undefined}
        className={cn(
          "flex h-10 items-center gap-2.5 rounded-[10px] border px-2.5 text-ink-2 transition-colors",
          active
            ? "border-line bg-surface font-medium text-ink shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
            : "border-transparent hover:bg-surface/60",
          collapsed && "lg:justify-center lg:px-0",
        )}
      >
        <Icon className="size-[18px] shrink-0" strokeWidth={1.75} aria-hidden />
        <span className={cn("flex-1 truncate", collapsed && "lg:sr-only")}>{item.label}</span>
        <span className={cn(collapsed && "lg:hidden")}>{extra(item)}</span>
      </Link>
    );
  };

  const panel = (
    <div className="flex h-full flex-col gap-4 px-2 py-3">
      <div className={cn("flex items-center justify-between px-2 py-1", collapsed && "lg:flex-col lg:gap-3 lg:px-0")}>
        <Link href="/" className="flex items-center gap-2" aria-label="qrismuz, ke beranda">
          <QrCode className="size-[22px]" strokeWidth={2} aria-hidden />
          <span className={cn("text-lg font-semibold tracking-[-0.03em]", collapsed && "lg:hidden")}>qrismuz</span>
        </Link>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Lebarkan menu" : "Ciutkan menu"}
          className="hidden size-8 items-center justify-center rounded-lg border border-line bg-surface text-muted hover:text-ink lg:flex"
        >
          {collapsed ? (
            <ChevronsRight className="size-4" strokeWidth={1.75} aria-hidden />
          ) : (
            <ChevronsLeft className="size-4" strokeWidth={1.75} aria-hidden />
          )}
        </button>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label="Tutup menu"
          className="flex size-10 items-center justify-center rounded-lg text-muted lg:hidden"
        >
          <X className="size-5" strokeWidth={1.75} aria-hidden />
        </button>
      </div>

      <button
        type="button"
        className={cn(
          "flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3",
          collapsed && "lg:justify-center lg:px-0",
        )}
        title={collapsed ? "Semua proyek" : undefined}
      >
        <span className="flex items-center gap-2">
          <Folder className="size-[18px]" strokeWidth={1.75} aria-hidden />
          <span className={cn("font-medium", collapsed && "lg:sr-only")}>Semua proyek</span>
        </span>
        <ChevronsUpDown className={cn("size-4 text-faint", collapsed && "lg:hidden")} strokeWidth={1.75} aria-hidden />
      </button>

      <form action="/transaksi" role="search" className={cn(collapsed && "lg:hidden")}>
      <label className="flex h-10 items-center gap-2 rounded-xl bg-[#e9e9e7] pl-3 pr-1.5 text-faint">
        <Search className="size-4" strokeWidth={1.75} aria-hidden />
        <input
          type="search"
          name="q"
          placeholder="Cari transaksi"
          aria-label="Cari transaksi"
          className="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-faint"
        />
        <kbd className="rounded-md border border-[#dcdcd9] bg-surface px-1.5 py-0.5 font-mono text-[11px] text-muted">Enter</kbd>
      </label>
      </form>

      <nav aria-label="Menu utama" className="flex flex-col gap-0.5">
        <span className={cn("px-2 pb-1.5 text-xs text-faint", collapsed && "lg:sr-only")}>Menu</span>
        {MAIN_NAV.map(renderItem)}
        <span className={cn("px-2 pb-1.5 pt-3.5 text-xs text-faint", collapsed && "lg:sr-only")}>Sistem</span>
        {SYSTEM_NAV.map(renderItem)}
      </nav>

      <div className="mt-auto flex flex-col gap-0.5 rounded-[14px] border border-line bg-surface p-2">
        <div className={cn("flex items-center gap-2.5 p-1.5", collapsed && "lg:justify-center lg:p-0")}>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-ink font-semibold text-white">
            {(ownerEmail ?? "O").charAt(0).toUpperCase()}
          </span>
          <span className={cn("flex min-w-0 flex-col leading-tight", collapsed && "lg:hidden")}>
            <span className="truncate font-medium" title={ownerEmail ?? undefined}>
              {ownerEmail ?? "Owner"}
            </span>
            <span className={cn("text-xs", totpEnabled ? "text-faint" : "text-warn")}>
              {totpEnabled ? "Owner · 2FA aktif" : "Owner · 2FA mati"}
            </span>
          </span>
        </div>
        <Link
          href="/pengaturan"
          title={collapsed ? "Pengaturan" : undefined}
          aria-current={isActive(pathname, "/pengaturan") ? "page" : undefined}
          className={cn(
            "flex h-10 items-center gap-2.5 rounded-lg px-2 text-ink-2 hover:bg-subtle",
            isActive(pathname, "/pengaturan") && "bg-subtle font-medium text-ink",
            collapsed && "lg:justify-center lg:px-0",
          )}
        >
          <Settings className="size-[18px]" strokeWidth={1.75} aria-hidden />
          <span className={cn(collapsed && "lg:sr-only")}>Pengaturan</span>
        </Link>
        <form action={logout} className="contents">
        <button
          type="submit"
          title={collapsed ? "Keluar" : undefined}
          className={cn("flex h-10 items-center gap-2.5 rounded-lg px-2 text-ink-2 hover:bg-subtle", collapsed && "lg:justify-center lg:px-0")}
        >
          <LogOut className="size-[18px]" strokeWidth={1.75} aria-hidden />
          <span className={cn(collapsed && "lg:sr-only")}>Keluar</span>
        </button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      {/* Bar atas untuk layar kecil */}
      <div className="flex items-center justify-between px-2 pb-1 lg:hidden">
        <Link href="/" className="flex items-center gap-2" aria-label="qrismuz, ke beranda">
          <QrCode className="size-[22px]" strokeWidth={2} aria-hidden />
          <span className="text-lg font-semibold tracking-[-0.03em]">qrismuz</span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Buka menu"
          aria-expanded={mobileOpen}
          className="flex size-11 items-center justify-center rounded-xl border border-line bg-surface"
        >
          <Menu className="size-5" strokeWidth={1.75} aria-hidden />
        </button>
      </div>

      {/* Laci menu di layar kecil */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button
            type="button"
            aria-label="Tutup menu"
            className="absolute inset-0 bg-black/30"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] overflow-y-auto bg-canvas">{panel}</aside>
        </div>
      )}

      {/* Sidebar desktop */}
      <aside
        className={cn(
          "sticky top-3 hidden h-[calc(100vh-24px)] shrink-0 overflow-y-auto transition-[width] lg:block",
          collapsed ? "w-[76px]" : "w-64",
        )}
      >
        {panel}
      </aside>
    </>
  );
}
