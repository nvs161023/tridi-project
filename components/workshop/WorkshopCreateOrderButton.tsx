"use client";

import { useCallback, useRef, useState } from "react";

import { CreateOrderDialog } from "@/components/workshop/CreateOrderDialog";
import { PlusIcon } from "@/components/workshop/WorkshopIcons";
import type { WorkshopFilament } from "@/lib/workshop/filaments";
import type { WorkshopPrinter } from "@/lib/workshop/printers";
import type { WorkshopProduct } from "@/lib/workshop/products";

/**
 * Акцентная кнопка «Создать заказ» в hero Мастерской.
 *
 * Открывает то же окно, что и вкладка «Заказы»: форма, G-code, списание
 * пластика и наработки принтера уже реализованы в `CreateOrderDialog`.
 * Состояние живёт здесь, потому что hero находится выше вкладок. После
 * успешного создания окно само вызывает `router.refresh()`, поэтому серверная
 * статистика и списки обновляются без перезагрузки страницы.
 */

type WorkshopCreateOrderButtonProps = {
  printers: WorkshopPrinter[];
  filaments: WorkshopFilament[];
  products: WorkshopProduct[];
};

export function WorkshopCreateOrderButton({
  printers,
  filaments,
  products,
}: WorkshopCreateOrderButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);

  const openDialog = useCallback(() => {
    setAnnouncement("");
    setIsOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setIsOpen(false);
    triggerRef.current?.focus();
  }, []);

  const handleCreated = useCallback((message: string) => {
    setAnnouncement(message);
  }, []);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openDialog}
        className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-bold text-black shadow-[0_16px_40px_-16px_rgba(255,255,255,0.45)] transition-all duration-300 hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] sm:min-h-14 sm:px-7 sm:text-base"
      >
        <PlusIcon className="h-5 w-5 transition-transform duration-300 group-hover:rotate-90" />
        Создать заказ
      </button>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {isOpen ? (
        <CreateOrderDialog
          printers={printers}
          filaments={filaments}
          products={products}
          onClose={closeDialog}
          onCreated={handleCreated}
        />
      ) : null}
    </>
  );
}
