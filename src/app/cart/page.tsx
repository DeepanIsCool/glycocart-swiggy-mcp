import { redirect } from "next/navigation";
import { getSessionUid } from "@/lib/session";
import { getProfile } from "@/lib/db";
import { BottomNav } from "@/components/bottom-nav";
import { CartView } from "@/components/cart-view";

export const dynamic = "force-dynamic";

export default async function CartPage() {
  const uid = await getSessionUid();
  if (!uid) redirect("/");
  if (!(await getProfile(uid))) redirect("/onboarding");

  return (
    <>
      <main className="app-scroll px-5 md:px-10 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <p className="mono text-ink-muted text-xs mb-1">your swiggy cart</p>
            <h1 className="display text-4xl leading-tight">Cart</h1>
          </div>
          <CartView />
        </div>
      </main>
      <BottomNav />
    </>
  );
}
