"use client";

import { useRouter } from "next/navigation";
import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";

import { createOrder } from "@/app/actions/orders";
import { emptyOrderFormState } from "@/app/actions/orders-state";
import { useDialogDismiss } from "@/components/workshop/use-dialog-dismiss";
import { parseGcode } from "@/lib/gcode-parser";
import { formatGrams, type WorkshopFilament } from "@/lib/workshop/filaments";
import {
  ORDER_LIMITS,
  ORDER_TEXT_LIMITS,
  formatOrderHours,
  planFilamentUsage,
} from "@/lib/workshop/orders";
import {
  formatPrinterHours,
  type WorkshopPrinter,
} from "@/lib/workshop/printers";
import type { WorkshopProduct } from "@/lib/workshop/products";
import { parseWorkshopNumber } from "@/lib/workshop/settings";

/**
 * Окно «Создать заказ».
 *
 * Поля повторяют колонки workshop_orders. Кнопка «Загрузить G-code» читает
 * файл в браузере (`file.text()`, предел 50 МБ) и подставляет вес модели и
 * время печати из комментариев слайсера — сам файл никуда не отправляется.
 *
 * Принтер и катушка необязательны, но если выбраны, Server Action прибавит
 * время печати к наработке принтера и спишет вес с катушки. Предпросмотр
 * остатка считается той же функцией planFilamentUsage, что и на сервере:
 * красная строка появляется ещё до отправки, а окончательное решение всё равно
 * за сервером — он перечитывает остаток из базы.
 */

type CreateOrderDialogProps = {
  printers: WorkshopPrinter[];
  filaments: WorkshopFilament[];
  /** Каталог для необязательной связи заказа с товаром. */
  products: WorkshopProduct[];
  onClose: () => void;
  /** Сообщение для строки состояния на вкладке. */
  onCreated: (message: string) => void;
};

const inputClassName =
  "mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-base text-white outline-none transition-all duration-200 [appearance:textfield] placeholder:text-zinc-500 focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/30 focus:ring-inset [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

/** Тот же предел, что у калькулятора: больше 50 МБ читать незачем. */
const MAX_GCODE_BYTES = 50 * 1024 * 1024;

const gcodeNumberFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 2,
});

type GcodeMessage = {
  tone: "success" | "warning" | "error";
  text: string;
};

const GCODE_TONE_CLASSES = {
  success: "border-emerald-400/40 bg-emerald-500/10 text-emerald-100",
  warning: "border-amber-400/40 bg-amber-500/10 text-amber-100",
  error: "border-red-400/40 bg-red-500/10 text-red-100",
} as const;

export function CreateOrderDialog({
  printers,
  filaments,
  products,
  onClose,
  onCreated,
}: CreateOrderDialogProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    createOrder,
    emptyOrderFormState,
  );
  const [title, setTitle] = useState("");
  const [totalCost, setTotalCost] = useState("0");
  const [weight, setWeight] = useState("0");
  const [hours, setHours] = useState("0");
  const [productId, setProductId] = useState("");
  const [printerId, setPrinterId] = useState("");
  const [filamentId, setFilamentId] = useState("");
  const [gcodeMessage, setGcodeMessage] = useState<GcodeMessage | null>(null);
  const [isReadingGcode, setIsReadingGcode] = useState(false);

  /**
   * true — поле уже заполняли вручную или из G-code.
   * Такие значения автозаполнение из товара не перезаписывает.
   */
  const dirtyFields = useRef({
    title: false,
    totalCost: false,
    weight: false,
  });

  useDialogDismiss(onClose);

  useEffect(() => {
    if (!state.success) {
      return;
    }

    router.refresh();
    onCreated(state.message ?? "Заказ создан.");
    onClose();
  }, [onClose, onCreated, router, state.message, state.success]);

  const selectedPrinter =
    printers.find((printer) => printer.id === printerId) ?? null;
  const selectedFilament =
    filaments.find((filament) => filament.id === filamentId) ?? null;
  const parsedWeight = parseWorkshopNumber(weight);
  const parsedHours = parseWorkshopNumber(hours);
  const preview =
    selectedFilament && parsedWeight !== null && parsedWeight > 0
      ? planFilamentUsage(selectedFilament, parsedWeight)
      : null;

  /**
   * Товар → пустые поля заказа.
   *
   * Заполняем название, стоимость и вес, но не трогаем поля, куда уже
   * вводили вручную. Автозаполненные значения можно заменить при выборе
   * другого товара. Пустой вариант списка ничего не меняет.
   */
  function handleProductChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextProductId = event.currentTarget.value;
    setProductId(nextProductId);

    if (!nextProductId) {
      return;
    }

    const product = products.find((item) => item.id === nextProductId);

    if (!product) {
      return;
    }

    if (!dirtyFields.current.title || !title.trim()) {
      setTitle(product.title);
      dirtyFields.current.title = false;
    }

    if (!dirtyFields.current.totalCost || !totalCost.trim()) {
      setTotalCost(String(product.price));
      dirtyFields.current.totalCost = false;
    }

    if (
      product.weightG !== null &&
      (!dirtyFields.current.weight || !weight.trim())
    ) {
      setWeight(String(product.weightG));
      dirtyFields.current.weight = false;
    }
  }

  /**
   * G-code: вес и время берём из комментариев слайсера.
   *
   * Поле выбора очищается сразу: повторный выбор того же файла иначе не вызвал
   * бы onChange, и человек решил бы, что кнопка не работает.
   */
  async function handleGcodeChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";

    if (!file) {
      return;
    }

    if (file.size > MAX_GCODE_BYTES) {
      setGcodeMessage({
        tone: "error",
        text: "Файл больше 50 МБ. Впишите вес и время вручную.",
      });
      return;
    }

    setIsReadingGcode(true);
    setGcodeMessage(null);

    try {
      const estimate = parseGcode(await file.text());

      if (estimate.weightGrams !== null) {
        dirtyFields.current.weight = true;
        setWeight(String(Math.round(estimate.weightGrams)));
      }

      if (estimate.timeHours !== null) {
        setHours(String(estimate.timeHours));
      }

      if (estimate.weightGrams !== null && estimate.timeHours !== null) {
        setGcodeMessage({
          tone: "success",
          text: `Из файла: вес ${gcodeNumberFormatter.format(estimate.weightGrams)} г, время ${gcodeNumberFormatter.format(estimate.timeHours)} ч. Проверьте перед сохранением.`,
        });
        return;
      }

      if (estimate.weightGrams !== null) {
        setGcodeMessage({
          tone: "warning",
          text: `Из файла взяли вес ${gcodeNumberFormatter.format(estimate.weightGrams)} г — время печати в комментариях не нашлось.`,
        });
        return;
      }

      if (estimate.timeHours !== null) {
        setGcodeMessage({
          tone: "warning",
          text: `Из файла взяли время ${gcodeNumberFormatter.format(estimate.timeHours)} ч — вес пластика не нашёлся.`,
        });
        return;
      }

      setGcodeMessage({
        tone: "warning",
        text: "В файле не нашлось ни времени печати, ни веса. Заполните поля вручную.",
      });
    } catch {
      setGcodeMessage({
        tone: "error",
        text: "Не удалось прочитать файл. Попробуйте другой G-code.",
      });
    } finally {
      setIsReadingGcode(false);
    }
  }

  return (
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/80 p-4 backdrop-blur-sm sm:items-center"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-order-title"
        className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-[#0a0a0a] p-6 shadow-2xl shadow-black/60 sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-blue-400 uppercase">
              Заказы
            </p>
            <h2
              id="create-order-title"
              className="mt-3 text-2xl font-extrabold tracking-tight text-white"
            >
              Создать заказ
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть окно создания заказа"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-lg text-zinc-400 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
          >
            <span aria-hidden>✕</span>
          </button>
        </div>

        <form
          action={formAction}
          autoComplete="off"
          className="mt-6 space-y-4"
        >
          <div>
            <label
              htmlFor="order-product"
              className="block text-sm font-semibold text-slate-200"
            >
              Товар из каталога (необязательно)
            </label>
            <select
              id="order-product"
              name="productId"
              autoComplete="off"
              value={productId}
              onChange={handleProductChange}
              aria-invalid={state.fieldErrors?.productId ? true : undefined}
              aria-describedby={
                state.fieldErrors?.productId
                  ? "order-product-error"
                  : "order-product-hint"
              }
              className={inputClassName}
            >
              <option value="">
                — Выберите товар из каталога (необязательно) —
              </option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.title}
                </option>
              ))}
            </select>
            {state.fieldErrors?.productId ? (
              <p
                id="order-product-error"
                role="alert"
                className="mt-1.5 text-sm text-red-300"
              >
                {state.fieldErrors.productId}
              </p>
            ) : (
              <p
                id="order-product-hint"
                className="mt-1.5 text-xs leading-relaxed text-slate-400"
              >
                {products.length === 0
                  ? "Каталог пока пуст — добавьте товары на вкладке «Товары»."
                  : "Пустые название, стоимость и вес подставятся из товара."}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="order-title"
              className="block text-sm font-semibold text-slate-200"
            >
              Название заказа
            </label>
            <input
              id="order-title"
              name="title"
              type="text"
              autoComplete="new-password"
              placeholder="Подставка для телефона"
              maxLength={ORDER_TEXT_LIMITS.title}
              required
              autoFocus
              value={title}
              onChange={(event) => {
                dirtyFields.current.title = true;
                setTitle(event.target.value);
              }}
              aria-invalid={state.fieldErrors?.title ? true : undefined}
              aria-describedby={
                state.fieldErrors?.title ? "order-title-error" : undefined
              }
              className={inputClassName}
            />
            {state.fieldErrors?.title ? (
              <p
                id="order-title-error"
                role="alert"
                className="mt-1.5 text-sm text-red-300"
              >
                {state.fieldErrors.title}
              </p>
            ) : null}
          </div>

          <div>
            <label
              htmlFor="order-client"
              className="block text-sm font-semibold text-slate-200"
            >
              Клиент (необязательно)
            </label>
            <input
              id="order-client"
              name="clientName"
              type="text"
              autoComplete="new-password"
              placeholder="Иван"
              maxLength={ORDER_TEXT_LIMITS.clientName}
              aria-invalid={state.fieldErrors?.clientName ? true : undefined}
              aria-describedby={
                state.fieldErrors?.clientName ? "order-client-error" : undefined
              }
              className={inputClassName}
            />
            {state.fieldErrors?.clientName ? (
              <p
                id="order-client-error"
                role="alert"
                className="mt-1.5 text-sm text-red-300"
              >
                {state.fieldErrors.clientName}
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="order-cost"
                className="block text-sm font-semibold text-slate-200"
              >
                Стоимость для клиента (₽)
              </label>
              <input
                id="order-cost"
                name="totalCost"
                type="number"
                autoComplete="off"
                inputMode="decimal"
                step="0.01"
                min={0}
                max={ORDER_LIMITS.costMax}
                required
                value={totalCost}
                onChange={(event) => {
                  dirtyFields.current.totalCost = true;
                  setTotalCost(event.target.value);
                }}
                aria-invalid={state.fieldErrors?.totalCost ? true : undefined}
                aria-describedby={
                  state.fieldErrors?.totalCost
                    ? "order-cost-error"
                    : "order-cost-hint"
                }
                className={inputClassName}
              />
              {state.fieldErrors?.totalCost ? (
                <p
                  id="order-cost-error"
                  role="alert"
                  className="mt-1.5 text-sm text-red-300"
                >
                  {state.fieldErrors.totalCost}
                </p>
              ) : (
                <p
                  id="order-cost-hint"
                  className="mt-1.5 text-xs leading-relaxed text-slate-400"
                >
                  Сколько заплатит клиент.
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="order-deadline"
                className="block text-sm font-semibold text-slate-200"
              >
                Срок сдачи (необязательно)
              </label>
              <input
                id="order-deadline"
                name="deadline"
                type="date"
                autoComplete="off"
                aria-invalid={state.fieldErrors?.deadline ? true : undefined}
                aria-describedby={
                  state.fieldErrors?.deadline
                    ? "order-deadline-error"
                    : "order-deadline-hint"
                }
                className={inputClassName}
              />
              {state.fieldErrors?.deadline ? (
                <p
                  id="order-deadline-error"
                  role="alert"
                  className="mt-1.5 text-sm text-red-300"
                >
                  {state.fieldErrors.deadline}
                </p>
              ) : (
                <p
                  id="order-deadline-hint"
                  className="mt-1.5 text-xs leading-relaxed text-slate-400"
                >
                  Когда обещали отдать заказ.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-dashed border-white/10 bg-black/30 p-4">
            <label
              htmlFor="order-gcode"
              className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 text-sm font-semibold text-zinc-200 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-within:ring-2 focus-within:ring-blue-500/60 focus-within:ring-offset-2 focus-within:ring-offset-[#0a0a0a]"
            >
              <span aria-hidden>📄</span>
              {isReadingGcode ? "Читаем файл…" : "Загрузить G-code"}
              <input
                id="order-gcode"
                type="file"
                autoComplete="off"
                accept=".gcode,.gco,.g"
                onChange={handleGcodeChange}
                disabled={isReadingGcode}
                className="sr-only"
              />
            </label>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              Вес и время печати подставятся из комментариев слайсера. Файл
              читается в браузере и никуда не отправляется.
            </p>
            {gcodeMessage ? (
              <p
                role="status"
                className={`mt-2 rounded-xl border px-3 py-2 text-xs leading-relaxed ${GCODE_TONE_CLASSES[gcodeMessage.tone]}`}
              >
                {gcodeMessage.text}
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="order-weight"
                className="block text-sm font-semibold text-slate-200"
              >
                Вес модели (г)
              </label>
              <input
                id="order-weight"
                name="materialWeightG"
                type="number"
                autoComplete="off"
                inputMode="numeric"
                step="1"
                min={0}
                max={ORDER_LIMITS.weightMax}
                required
                value={weight}
                onChange={(event) => {
                  dirtyFields.current.weight = true;
                  setWeight(event.target.value);
                }}
                aria-invalid={
                  state.fieldErrors?.materialWeightG ? true : undefined
                }
                aria-describedby={
                  state.fieldErrors?.materialWeightG
                    ? "order-weight-error"
                    : "order-weight-hint"
                }
                className={inputClassName}
              />
              {state.fieldErrors?.materialWeightG ? (
                <p
                  id="order-weight-error"
                  role="alert"
                  className="mt-1.5 text-sm text-red-300"
                >
                  {state.fieldErrors.materialWeightG}
                </p>
              ) : (
                <p
                  id="order-weight-hint"
                  className="mt-1.5 text-xs leading-relaxed text-slate-400"
                >
                  Сколько пластика уйдёт на заказ.
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="order-hours"
                className="block text-sm font-semibold text-slate-200"
              >
                Время печати (ч)
              </label>
              <input
                id="order-hours"
                name="printTimeHours"
                type="number"
                autoComplete="off"
                inputMode="decimal"
                step="0.01"
                min={0}
                max={ORDER_LIMITS.hoursMax}
                required
                value={hours}
                onChange={(event) => setHours(event.target.value)}
                aria-invalid={
                  state.fieldErrors?.printTimeHours ? true : undefined
                }
                aria-describedby={
                  state.fieldErrors?.printTimeHours
                    ? "order-hours-error"
                    : "order-hours-hint"
                }
                className={inputClassName}
              />
              {state.fieldErrors?.printTimeHours ? (
                <p
                  id="order-hours-error"
                  role="alert"
                  className="mt-1.5 text-sm text-red-300"
                >
                  {state.fieldErrors.printTimeHours}
                </p>
              ) : (
                <p
                  id="order-hours-hint"
                  className="mt-1.5 text-xs leading-relaxed text-slate-400"
                >
                  Прибавится к наработке выбранного принтера.
                </p>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="order-printer"
              className="block text-sm font-semibold text-slate-200"
            >
              Принтер (необязательно)
            </label>
            <select
              id="order-printer"
              name="printerId"
              autoComplete="off"
              value={printerId}
              onChange={(event) => setPrinterId(event.currentTarget.value)}
              aria-invalid={state.fieldErrors?.printerId ? true : undefined}
              aria-describedby={
                state.fieldErrors?.printerId
                  ? "order-printer-error"
                  : "order-printer-hint"
              }
              className={inputClassName}
            >
              <option value="">
                Без принтера — наработка не меняется
              </option>
              {printers.map((printer) => (
                <option key={printer.id} value={printer.id}>
                  {printer.name} — {printer.brand} {printer.model}
                </option>
              ))}
            </select>
            {state.fieldErrors?.printerId ? (
              <p
                id="order-printer-error"
                role="alert"
                className="mt-1.5 text-sm text-red-300"
              >
                {state.fieldErrors.printerId}
              </p>
            ) : (
              <p
                id="order-printer-hint"
                className="mt-1.5 text-xs leading-relaxed text-slate-400"
              >
                {selectedPrinter
                  ? `Наработка сейчас ${formatPrinterHours(selectedPrinter.totalHours)}${
                      parsedHours !== null && parsedHours > 0
                        ? `; после заказа +${formatOrderHours(parsedHours)}`
                        : ""
                    }.`
                  : printers.length === 0
                    ? "Принтеров пока нет — добавьте их на вкладке «Принтеры»."
                    : "Время печати прибавится к наработке принтера."}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="order-filament"
              className="block text-sm font-semibold text-slate-200"
            >
              Катушка (необязательно)
            </label>
            <select
              id="order-filament"
              name="filamentId"
              autoComplete="off"
              value={filamentId}
              onChange={(event) => setFilamentId(event.currentTarget.value)}
              aria-invalid={state.fieldErrors?.filamentId ? true : undefined}
              aria-describedby={
                state.fieldErrors?.filamentId || preview
                  ? "order-filament-note"
                  : "order-filament-hint"
              }
              className={inputClassName}
            >
              <option value="">
                Без катушки — пластик не списывается
              </option>
              {filaments.map((filament) => (
                <option key={filament.id} value={filament.id}>
                  {[filament.brand, filament.type, filament.color]
                    .filter(Boolean)
                    .join(" ")}{" "}
                  — {formatGrams(filament.remainingWeightG)}
                </option>
              ))}
            </select>
            {state.fieldErrors?.filamentId ? (
              <p
                id="order-filament-note"
                role="alert"
                className="mt-1.5 text-sm text-red-300"
              >
                {state.fieldErrors.filamentId}
              </p>
            ) : preview ? (
              <p
                id="order-filament-note"
                aria-live="polite"
                className={`mt-1.5 text-xs leading-relaxed ${
                  preview.ok ? "text-emerald-300" : "text-red-300"
                }`}
              >
                {preview.ok
                  ? `После заказа на катушке останется ${formatGrams(preview.remainingWeightG)}.`
                  : preview.error}
              </p>
            ) : (
              <p
                id="order-filament-hint"
                className="mt-1.5 text-xs leading-relaxed text-slate-400"
              >
                {filaments.length === 0
                  ? "Катушек пока нет — добавьте их на вкладке «Склад»."
                  : "Вес модели спишется с выбранной катушки."}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="order-notes"
              className="block text-sm font-semibold text-slate-200"
            >
              Заметки (необязательно)
            </label>
            <textarea
              id="order-notes"
              name="notes"
              autoComplete="new-password"
              rows={3}
              placeholder="Цвет, пожелания клиента, постобработка…"
              maxLength={ORDER_TEXT_LIMITS.notes}
              aria-invalid={state.fieldErrors?.notes ? true : undefined}
              aria-describedby={
                state.fieldErrors?.notes ? "order-notes-error" : undefined
              }
              className={`${inputClassName} min-h-24 resize-y`}
            />
            {state.fieldErrors?.notes ? (
              <p
                id="order-notes-error"
                role="alert"
                className="mt-1.5 text-sm text-red-300"
              >
                {state.fieldErrors.notes}
              </p>
            ) : null}
          </div>

          {state.error ? (
            <p
              role="alert"
              className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm leading-relaxed text-amber-100"
            >
              <span aria-hidden>⚠️ </span>
              {state.error}
            </p>
          ) : null}

          <div className="flex flex-col gap-3 pt-1 sm:flex-row">
            <button
              type="submit"
              disabled={isPending}
              aria-busy={isPending}
              className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-white px-6 text-sm font-bold text-black shadow-[0_10px_30px_-12px_rgba(255,255,255,0.35)] transition-colors hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Создаём…" : "Создать заказ"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-6 text-sm font-semibold text-zinc-200 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
            >
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
