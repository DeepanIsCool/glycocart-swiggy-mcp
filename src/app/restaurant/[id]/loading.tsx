import { BottomNav } from "@/components/bottom-nav";
import { BackButton } from "./back-button";

/**
 * Shown while the server fetches and scores the first page of a menu, which
 * is a Swiggy round-trip plus an estimate per dish. Without it a tap on a
 * restaurant looked like nothing happened. The blocks follow the real layout
 * (header, filters, section chips, dish cards) so nothing jumps when it lands.
 */
export default function RestaurantLoading() {
  const block = "bg-cream-deep animate-pulse motion-reduce:animate-none";
  return (
    <>
      <main className="app-scroll" aria-busy="true">
        <header className="app-bar">
          <BackButton />
          <span className="flex-1 text-center text-sm font-medium text-ink-muted">Menu</span>
          <span className="size-11 shrink-0" aria-hidden />
        </header>

        <div className="px-5 md:px-10 pt-6">
          <div className="max-w-2xl mx-auto">
            <p role="status" className="sr-only">
              Loading the menu
            </p>
            <div aria-hidden>
              <div className="flex items-start gap-4">
                <span className={`size-20 rounded-2xl shrink-0 ${block}`} />
                <span className="flex-1 space-y-2.5 pt-1">
                  <span className={`block h-7 w-3/4 rounded ${block}`} />
                  <span className={`block h-3.5 w-1/2 rounded ${block}`} />
                  <span className={`block h-3 w-2/3 rounded ${block}`} />
                </span>
              </div>

              <span className={`block h-3 w-full rounded mt-5 ${block}`} />
              <span className={`block h-3 w-4/5 rounded mt-2 mb-5 ${block}`} />

              <div className="flex gap-2 mb-4">
                {["w-28", "w-28", "w-20"].map((w, i) => (
                  <span key={i} className={`h-11 rounded-full ${w} ${block}`} />
                ))}
              </div>

              <div className="space-y-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="card-solid p-3 flex items-start gap-3">
                    <span className={`size-14 rounded-xl shrink-0 ${block}`} />
                    <span className="flex-1 space-y-2 pt-1">
                      <span className={`block h-3.5 w-2/3 rounded ${block}`} />
                      <span className={`block h-3 w-1/3 rounded ${block}`} />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
      <BottomNav />
    </>
  );
}
