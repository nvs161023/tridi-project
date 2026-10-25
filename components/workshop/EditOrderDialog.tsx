"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";

import { updateOrder } from "@/app/actions/orders";
import { useDialogDismiss } from "@/components/workshop/use-dialog-dismiss";
import type { WorkshopClient } from "@/lib/workshop/clients";
import {
  ORDER_LIMITS,
  ORDER_TEXT_LIMITS,
  type OrderFormErrors,
  type WorkshopOrder,
} from "@/lib/workshop/orders";

/**
 * Окно «Редактировать заказ».
 *
 * Поля повторяют `CreateOrderDialog`, но техники здесь нет: статус двигает
 * Kanban, принтер и катушку выбирают при создании. Правка обновляет только
 * название, клиента, стоимость, вес, время печати, срок и заметки — наработка
 * принтера и остаток пластика не пересчитываются, иначе заказ списал бы ресурс
 * второй раз.
 *
 * Клиента можно выбрать из базы или ввести вручную. Выбранный клиент уходит как
 * `clientId`, а имя — как `clientName`: Server Action проверяет ссылку по
 * `user_id` и сохраняет имя снимком. Ручной ввод снимает ссылку.
 *
 * Окно открывается поверх карточки заказа, поэтому `isTopmost`: Escape
 * закрывает только правку, а не обе модалки сразу.
 */

type EditOrderDialogProps = {
  order: WorkshopOrder;
  /** База клиентов: готовый контакт или имя вручную. */
  clients: WorkshopClient[];
  onClose: () => void;
  /** Сообщение для строки состояния на вкладке. */
  onSaved: (message: string) => void;
};

const inputClassName =
  "mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-base text-white outline-none transition-all duration-200 [appearance:textfield] placeholder:text-zinc-500 focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/30 focus:ring-inset [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

export function EditOrderDialog({
  order,
  clients,
  onClose,
  onSaved,
}: EditOrderDialogProps) {
  const router = useRouter();
  const [clientId, setClientId] = useState(() =>
    order.clientId && clients.some((client) => client.id === order.clientId)
      ? order.clientId
      : "",
  );
  const [clientName, setClientName] = useState(order.clientName ?? "");
  const [fieldErrors, setFieldErrors] = useState<OrderFormErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  /**
   * Пока идёт сохранение, окно не закрывается: иначе непонятно, применились ли
   * изменения, а фокус вернулся бы на карточку с прежними данными.
   */
  const closeDialog = useCallback(() => {
    if (!isSaving) {
      onClose();
    }
  }, [isSaving, onClose]);

  useDialogDismiss(closeDialog, { isTopmost: true });

  const selectedClient =
    clients.find((client) => client.id === clientId) ?? null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSaving) {
      return;
    }

    // FormData снимаем до await: currentTarget живёт только внутри обработчика.
    const formData = new FormData(event.currentTarget);

    setFieldErrors({});
    setError(null);
    setIsSaving(true);

    try {
      const result = await updateOrder(order.id, formData);

      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        setError(result.error ?? null);
        return;
      }

      // Сначала сообщение на вкладке, затем закрытие: доска покажет его после
      // того, как карточка заказа снова станет видимой.
      onSaved(result.message ?? "Заказ обновлён.");
      onClose();
      router.refresh();
    } catch {
      setError("Нет связи с сервером. Попробуйте ещё раз.");
    } finally {
      setIsSaving(false);
    }
  }

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      role="presentation"
      data-order-edit-overlay
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          closeDialog();
        }
      }}
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/85 p-4 backdrop-blur-sm sm:items-center"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-order-heading"
        tabIndex={-1}
        data-order-edit
        className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-2xl border border-white/10 bg-[#0a0a0a] p-6 shadow-2xl shadow-black/60 outline-none sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-[0.2em] text-blue-400 uppercase">
              Заказ
            </p>
            <h2
              id="edit-order-heading"
              className="mt-3 text-2xl font-extrabold tracking-tight break-words text-white"
            >
              Редактировать заказ
            </h2>
          </div>
          <button
            type="button"
            onClick={closeDialog}
            disabled={isSaving}
            aria-label="Закрыть окно редактирования заказа"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-lg text-zinc-400 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] disabled:cursor-wait disabled:opacity-60"
          >
            <span aria-hidden>✕</span>
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          autoComplete="off"
          className="mt-6 space-y-4"
        >
          <div>
            <label
              htmlFor="edit-order-title"
              className="block text-sm font-semibold text-slate-200"
            >
              Название заказа
            </label>
            <input
              id="edit-order-title"
              name="title"
              type="text"
              autoComplete="new-password"
              placeholder="Подставка для телефона"
              maxLength={ORDER_TEXT_LIMITS.title}
              required
              autoFocus
              defaultValue={order.title}
              aria-invalid={fieldErrors.title ? true : undefined}
              aria-describedby={
                fieldErrors.title ? "edit-order-title-error" : undefined
              }
              className={inputClassName}
            />
            {fieldErrors.title ? (
              <p
                id="edit-order-title-error"
                role="alert"
                className="mt-1.5 text-sm text-red-300"
              >
                {fieldErrors.title}
              </p>
            ) : null}
          </div>


          <div>
            <label
              htmlFor="edit-order-client-select"
              className="block text-sm font-semibold text-slate-200"
            >
              Клиент (необязательно)
            </label>
            {/*
              При выборе из базы в форму уходят и clientId, и clientName:
              ссылка нужна накладной, имя остаётся снимком в заказе.
            */}
            <select
              id="edit-order-client-select"
              name="clientId"
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
              aria-invalid={fieldErrors.clientId ? true : undefined}
              aria-describedby={
                fieldErrors.clientId ? "edit-order-client-id-error" : undefined
              }
              className={inputClassName}
            >
              <option value="">— Новый клиент (ввести вручную) —</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
            {fieldErrors.clientId ? (
              <p
                id="edit-order-client-id-error"
                role="alert"
                className="mt-1.5 text-sm text-red-300"
              >
                {fieldErrors.clientId}
              </p>
            ) : null}

            <label htmlFor="edit-order-client" className="sr-only">
              Имя клиента
            </label>
            <input
              id="edit-order-client"
              name="clientName"
              type="text"
              autoComplete="new-password"
              placeholder="Иван"
              maxLength={ORDER_TEXT_LIMITS.clientName}
              readOnly={selectedClient !== null}
              value={selectedClient ? selectedClient.name : clientName}
              onChange={(event) => {
                if (selectedClient) {
                  return;
                }

                setClientName(event.target.value);
              }}
              aria-invalid={fieldErrors.clientName ? true : undefined}
              aria-describedby={
                fieldErrors.clientName
                  ? "edit-order-client-error"
                  : "edit-order-client-hint"
              }
              className={`${inputClassName} read-only:cursor-default read-only:bg-white/[0.03] read-only:text-zinc-300`}
            />
            {fieldErrors.clientName ? (
              <p
                id="edit-order-client-error"
                role="alert"
                className="mt-1.5 text-sm text-red-300"
              >
                {fieldErrors.clientName}
              </p>
            ) : (
              <p
                id="edit-order-client-hint"
                className="mt-1.5 text-xs leading-relaxed text-slate-400"
              >
                {selectedClient
                  ? "Клиент из базы: в заказ сохранится ссылка, имя обновится из базы."
                  : clients.length === 0
                    ? "База клиентов пока пуста — имя сохранится текстом."
                    : "Имя вручную: ссылка на клиента из базы будет снята."}
              </p>
            )}
          </div>


          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="edit-order-cost"
                className="block text-sm font-semibold text-slate-200"
              >
                Стоимость для клиента (₽)
              </label>
              <input
                id="edit-order-cost"
                name="totalCost"
                type="number"
                autoComplete="off"
                inputMode="decimal"
                step="0.01"
                min={0}
                max={ORDER_LIMITS.costMax}
                required
                defaultValue={order.totalCost}
                aria-invalid={fieldErrors.totalCost ? true : undefined}
                aria-describedby={
                  fieldErrors.totalCost ? "edit-order-cost-error" : undefined
                }
                className={inputClassName}
              />
              {fieldErrors.totalCost ? (
                <p
                  id="edit-order-cost-error"
                  role="alert"
                  className="mt-1.5 text-sm text-red-300"
                >
                  {fieldErrors.totalCost}
                </p>
              ) : null}
            </div>

            <div>
              <label
                htmlFor="edit-order-deadline"
                className="block text-sm font-semibold text-slate-200"
              >
                Срок сдачи (необязательно)
              </label>
              <input
                id="edit-order-deadline"
                name="deadline"
                type="date"
                autoComplete="off"
                defaultValue={order.deadline ?? ""}
                aria-invalid={fieldErrors.deadline ? true : undefined}
                aria-describedby={
                  fieldErrors.deadline ? "edit-order-deadline-error" : undefined
                }
                className={inputClassName}
              />
              {fieldErrors.deadline ? (
                <p
                  id="edit-order-deadline-error"
                  role="alert"
                  className="mt-1.5 text-sm text-red-300"
                >
                  {fieldErrors.deadline}
                </p>
              ) : null}
            </div>
          </div>


          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="edit-order-weight"
                className="block text-sm font-semibold text-slate-200"
              >
                Вес модели (г)
              </label>
              <input
                id="edit-order-weight"
                name="materialWeightG"
                type="number"
                autoComplete="off"
                inputMode="numeric"
                step="1"
                min={0}
                max={ORDER_LIMITS.weightMax}
                required
                defaultValue={order.materialWeightG}
                aria-invalid={fieldErrors.materialWeightG ? true : undefined}
                aria-describedby={
                  fieldErrors.materialWeightG
                    ? "edit-order-weight-error"
                    : "edit-order-weight-hint"
                }
                className={inputClassName}
              />
              {fieldErrors.materialWeightG ? (
                <p
                  id="edit-order-weight-error"
                  role="alert"
                  className="mt-1.5 text-sm text-red-300"
                >
                  {fieldErrors.materialWeightG}
                </p>
              ) : (
                <p
                  id="edit-order-weight-hint"
                  className="mt-1.5 text-xs leading-relaxed text-slate-400"
                >
                  Пластик не списывается: заказ списал его при создании.
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="edit-order-hours"
                className="block text-sm font-semibold text-slate-200"
              >
                Время печати (ч)
              </label>
              <input
                id="edit-order-hours"
                name="printTimeHours"
                type="number"
                autoComplete="off"
                inputMode="decimal"
                step="0.01"
                min={0}
                max={ORDER_LIMITS.hoursMax}
                required
                defaultValue={order.printTimeHours}
                aria-invalid={fieldErrors.printTimeHours ? true : undefined}
                aria-describedby={
                  fieldErrors.printTimeHours
                    ? "edit-order-hours-error"
                    : "edit-order-hours-hint"
                }
                className={inputClassName}
              />
              {fieldErrors.printTimeHours ? (
                <p
                  id="edit-order-hours-error"
                  role="alert"
                  className="mt-1.5 text-sm text-red-300"
                >
                  {fieldErrors.printTimeHours}
                </p>
              ) : (
                <p
                  id="edit-order-hours-hint"
                  className="mt-1.5 text-xs leading-relaxed text-slate-400"
                >
                  Наработка принтера не меняется — обновляется только заказ.
                </p>
              )}
            </div>
          </div>


          <div>
            <label
              htmlFor="edit-order-notes"
              className="block text-sm font-semibold text-slate-200"
            >
              Заметки (необязательно)
            </label>
            <textarea
              id="edit-order-notes"
              name="notes"
              autoComplete="new-password"
              rows={3}
              placeholder="Цвет, пожелания клиента, постобработка…"
              maxLength={ORDER_TEXT_LIMITS.notes}
              defaultValue={order.notes ?? ""}
              aria-invalid={fieldErrors.notes ? true : undefined}
              aria-describedby={
                fieldErrors.notes ? "edit-order-notes-error" : undefined
              }
              className={`${inputClassName} min-h-24 resize-y`}
            />
            {fieldErrors.notes ? (
              <p
                id="edit-order-notes-error"
                role="alert"
                className="mt-1.5 text-sm text-red-300"
              >
                {fieldErrors.notes}
              </p>
            ) : null}
          </div>

          <p className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-xs leading-relaxed text-zinc-400">
            Статус, принтер и катушка здесь не меняются: статус двигает Kanban, а
            технику выбирают при создании. Наработка принтера и остаток пластика
            при правке не пересчитываются.
          </p>

          {error ? (
            <p
              role="alert"
              className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm leading-relaxed text-amber-100"
            >
              <span aria-hidden>⚠️ </span>
              {error}
            </p>
          ) : null}

          <div className="flex flex-col gap-3 pt-1 sm:flex-row">
            <button
              type="submit"
              disabled={isSaving}
              aria-busy={isSaving}
              className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-white px-6 text-sm font-bold text-black shadow-[0_10px_30px_-12px_rgba(255,255,255,0.35)] transition-colors hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Сохраняем…" : "Сохранить изменения"}
            </button>
            <button
              type="button"
              onClick={closeDialog}
              disabled={isSaving}
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-6 text-sm font-semibold text-zinc-200 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] disabled:cursor-wait disabled:opacity-60"
            >
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

