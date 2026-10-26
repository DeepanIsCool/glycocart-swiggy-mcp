import { BottomNav } from "@/components/bottom-nav";

/**
 * Shown while the server asks Swiggy for order history, which takes a few
 * seconds. Without it the Orders tab looked unresponsive after a tap.
 */
export default function OrdersLoading() {
  return (
    <>
      <main className="app-scroll px-5 md:px-10 pt-8">
        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <h1 className="display text-4xl leading-tight">Orders</h1>
            <p className="text-ink-muted text-sm mt-1">Loading your Swiggy orders…</p>
          </div>
          <div role="status" aria-live="polite" className="space-y-3">
            <span className="sr-only">Loading your Swiggy orders</span>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="card-solid h-32 motion-safe:animate-pulse" aria-hidden />
            ))}
          </div>
        </div>
      </main>
      <BottomNav />
    </>
  );
}
