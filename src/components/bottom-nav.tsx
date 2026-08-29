"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare, ShoppingBag, User, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/chat", label: "Chat", Icon: MessageSquare },
  { href: "/cart", label: "Cart", Icon: ShoppingBag },
  { href: "/profile", label: "Profile", Icon: User },
  { href: "/settings", label: "Settings", Icon: Settings }
];

/**
 * Fixed bottom tab bar.
 *
 * z-30 clears the .grain overlay (fixed, z-1) that covers the viewport.
 * The safe-area inset keeps the tabs above the iOS home indicator — the app
 * had no safe-area handling at all before this.
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-30 border-t border-ink/10 bg-cream/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Main"
    >
      <ul className="flex max-w-3xl mx-auto">
        {TABS.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 transition-colors",
                  active ? "text-leaf-text" : "text-ink-muted hover:text-ink"
                )}
              >
                <Icon size={20} strokeWidth={active ? 2.4 : 1.8} />
                <span className="text-xs font-medium">{label}</span>
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
