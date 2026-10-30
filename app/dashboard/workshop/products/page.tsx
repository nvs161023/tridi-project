import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Header } from "@/components/Header";
import { WorkshopProductsTab } from "@/components/workshop/WorkshopProductsTab";
import { resolveUserId } from "@/lib/current-user";
import { hasActiveSubscription } from "@/lib/subscription";
import { createClient } from "@/lib/supabase/server";
import { getWorkshopProducts } from "@/lib/workshop/products";
import { getWorkshopPrinters } from "@/lib/workshop/printer-store";

/**
 * Каталог товаров Мастерской.
 *
 * Отдельная страница, а не только вкладка: на неё ведут ссылки из карточки
 * заказа и страницы маркетплейсов, а форма добавления теперь принимает G-code.
 * Доступ тот же, что у всей Мастерской: пакет «Всё включено».
 */
export const metadata: Metadata = {
  title: "Товары Мастерской — TriDi",
  description:
    "Каталог изделий: артикулы, цены, вес, габариты и G-code для печати.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function WorkshopProductsPage() {
  const supabase = await createClient();
  const userId = await resolveUserId(supabase);

  if (!userId) {
    redirect("/auth/login?next=%2Fdashboard%2Fworkshop%2Fproducts");
  }

  if (!(await hasActiveSubscription(supabase, userId))) {
    redirect("/dashboard/workshop");
  }

  const products = await getWorkshopProducts();
  // Парк нужен окну товара: оно сверяет формат файла печати с протоколами
  // принтеров. Ошибка чтения не мешает каталогу — `getWorkshopPrinters` отдаёт
  // пустой список, и проверка формата просто не выполняется.
  const fleet = await getWorkshopPrinters(supabase, userId);

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
            href="/dashboard/workshop/marketplace"
            className="inline-flex min-h-9 items-center font-semibold text-blue-300 transition-colors hover:text-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030303]"
          >
            Маркетплейсы →
          </Link>
        </nav>

        <div className="mt-6">
          <WorkshopProductsTab products={products} printers={fleet.printers} />
        </div>
      </main>
    </div>
  );
}
