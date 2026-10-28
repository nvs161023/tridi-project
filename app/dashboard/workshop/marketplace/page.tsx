import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Header } from "@/components/Header";
import { WorkshopMarketplaceTab } from "@/components/workshop/WorkshopMarketplaceTab";
import { resolveUserId } from "@/lib/current-user";
import { hasActiveSubscription } from "@/lib/subscription";
import { createClient } from "@/lib/supabase/server";
import { getMarketplaceSnapshot } from "@/lib/workshop/marketplace-store";
import type { MarketplaceLinkView } from "@/lib/workshop/marketplace";
import { getWorkshopProducts } from "@/lib/workshop/products";

/**
 * Маркетплейсы Мастерской: связи SKU → товар и заказы без маппинга.
 *
 * Связи и заказы читаются одним снимком, каталог — параллельно: странице
 * нужны названия товаров и наличие G-code. Заказ без маппинга остаётся
 * видимым, пока пользователь не свяжет все его позиции.
 */
export const metadata: Metadata = {
  title: "Маркетплейсы Мастерской — TriDi",
  description:
    "Связи SKU Ozon, Wildberries и Яндекс Маркета с товарами и G-code каталога.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function WorkshopMarketplacePage() {
  const supabase = await createClient();
  const userId = await resolveUserId(supabase);

  if (!userId) {
    redirect("/auth/login?next=%2Fdashboard%2Fworkshop%2Fmarketplace");
  }

  if (!(await hasActiveSubscription(supabase, userId))) {
    redirect("/dashboard/workshop");
  }

  const [snapshot, products] = await Promise.all([
    getMarketplaceSnapshot(supabase, userId),
    getWorkshopProducts(),
  ]);
  const productById = new Map(
    products.map((product) => [product.id, product]),
  );
  const links: MarketplaceLinkView[] = snapshot.links.flatMap((link) => {
    const product = productById.get(link.productId);

    return product
      ? [
          {
            ...link,
            productTitle: product.title,
            productSku: product.sku,
            gcodeUrl: product.gcodeUrl,
          },
        ]
      : [];
  });

  return (
    <div className="min-h-screen text-zinc-100">
      <Header />

      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
        <nav className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
          <Link
            href="/dashboard/workshop"
            className="inline-flex min-h-9 items-center gap-2 font-semibold text-zinc-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030303]"
          >
            <span aria-hidden>←</span>
            Мастерская
          </Link>
          <span aria-hidden className="text-white/20">
            /
          </span>
          <Link
            href="/dashboard/workshop/products"
            className="inline-flex min-h-9 items-center font-semibold text-blue-300 transition-colors hover:text-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030303]"
          >
            ← Товары
          </Link>
        </nav>

        <div className="mt-6">
          <WorkshopMarketplaceTab
            links={links}
            products={products}
            unmappedOrders={snapshot.unmappedOrders}
            isMissingTable={snapshot.isMissingTable}
          />
        </div>
      </main>
    </div>
  );
}
