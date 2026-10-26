"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare, ShoppingBag, UtensilsCrossed, Receipt, User, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Tab {
  href: string;
  label: string;
  Icon: LucideIcon;
  /** Other routes that live under this tab, so the bar still shows where you are. */
  also?: string[];
}

// Five tabs is the most that fits legibly at 375px. Settings lost its tab to
// Dine out and is reached from the Profile header instead, so Profile stays
// selected while you are in Settings. A restaurant page is opened from a chat
// result, so it sits under Chat.
const TABS: Tab[] = [
  { href: "/chat", label: "Chat", Icon: MessageSquare, also: ["/restaurant"] },
  { href: "/cart", label: "Cart", Icon: ShoppingBag },
  { href: "/dineout", label: "Dine out", Icon: UtensilsCrossed },
  { href: "/orders", label: "Orders", Icon: Receipt },
  { href: "/profile", label: "Profile", Icon: User, also: ["/settings"] }
];

const within = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`);

/**
 * Fixed bottom tab bar. Navigation only, never actions.
 *
 * z-30 clears the .grain overlay (fixed, z-1) that covers the viewport.
 * The row is a fixed 4.25rem so it matches `--nav-h` in globals.css exactly;
 * the safe-area inset is added below it to keep the tabs above the iOS home
 * indicator.
 */
export function BottomNav() {
  const pathname = usePathname() ?? "";

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-30 border-t border-ink/10 bg-cream/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Main"
    >
      <ul className="flex max-w-3xl mx-auto h-[4.25rem]">
        {TABS.map(({ href, label, Icon, also }) => {
          const active = within(pathname, href) || (also ?? []).some((p) => within(pathname, p));
          return (
            <li key={href} className="flex-1 min-w-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "h-full flex flex-col items-center justify-center gap-1 transition-colors rounded-xl",
                  "outline-none focus-visible:ring-2 focus-visible:ring-leaf focus-visible:ring-inset",
                  active ? "text-leaf-text" : "text-ink-muted hover:text-ink"
                )}
              >
                {/* The pill gives the selected tab a shape cue as well as a
                    colour one, so it does not rely on colour alone. */}
                <span
                  className={cn(
                    "inline-flex items-center justify-center h-7 w-14 rounded-full transition-colors",
                    active && "bg-leaf-pale"
                  )}
                  aria-hidden
                >
                  <Icon size={20} strokeWidth={active ? 2.4 : 1.8} />
                </span>
                <span className={cn("text-xs truncate max-w-full px-1", active ? "font-semibold" : "font-medium")}>
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Height the nav occupies, so fixed-height pages can reserve space for it. */
export const NAV_HEIGHT_CLASS = "pb-[calc(4.25rem+env(safe-area-inset-bottom))]";
