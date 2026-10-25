"use client";

import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { addOrderComment, loadOrderComments } from "@/app/actions/orders";
import { useDialogDismiss } from "@/components/workshop/use-dialog-dismiss";
import { formatGrams } from "@/lib/workshop/filaments";
import {
  ORDER_COMMENT_TEXT_LIMIT,
  ORDER_STATUS_META,
  formatOrderCost,
  formatOrderDate,
  formatOrderHours,
  type OrderComment,
  type WorkshopOrder,
} from "@/lib/workshop/orders";

/**
 * Карточка заказа: детали и переписка.
 *
 * Открывается по клику на карточку Kanban. Комментарии читаются при открытии
 * через Server Action `loadOrderComments`: страница не знает, какой заказ
 * откроют, поэтому грузить переписку всех заказов заранее незачем. После
 * успешной отправки сервер возвращает сохранённую строку с датой из базы, и она
 * добавляется в конец ленты — порядок `created_at asc` сохраняется.
 *
 * Окно не мешает перетаскиванию: пока оно открыто, overlay перекрывает доску, а
 * клик по карточке открывает окно только после того, как доска убедилась, что
 * это не конец drag-and-drop (см. WorkshopOrdersTab).
 */

type OrderDetailsDialogProps = {
  order: WorkshopOrder;
  onClose: () => void;
};

const COMMENT_DATE_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Дата комментария: «25.10.2026, 14:05» в часовом поясе браузера. */
function formatCommentDate(value: string | null): string {
  if (!value) {
    return "Дата не указана";
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Дата не указана"
    : COMMENT_DATE_FORMATTER.format(date);
}

export function OrderDetailsDialog({
  order,
  onClose,
}: OrderDetailsDialogProps) {
  const [comments, setComments] = useState<OrderComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useDialogDismiss(onClose);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  useEffect(() => {
    let isActive = true;

    async function load() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const list = await loadOrderComments(order.id);

        if (isActive) {
          setComments(list);
        }
      } catch {
        if (isActive) {
          setLoadError(
            "Не удалось загрузить комментарии. Закройте карточку и откройте снова.",
          );
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      isActive = false;
    };
  }, [order.id]);

  useEffect(() => {
    if (isLoading || loadError || comments.length === 0) {
      return;
    }

    // Лента читается снизу вверх: свежий комментарий должен быть виден.
    bottomRef.current?.scrollIntoView({ block: "nearest" });
  }, [comments.length, isLoading, loadError]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const value = text.trim();

    if (!value) {
      setSubmitError("Введите комментарий.");
      textareaRef.current?.focus();
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const result = await addOrderComment(order.id, value);

      if (!result.ok) {
        setSubmitError(result.error);
        return;
      }

      setComments((current) => [...current, result.comment]);
      setText("");
      textareaRef.current?.focus();
    } catch {
      setSubmitError(
        "Не удалось отправить комментарий. Проверьте соединение и попробуйте ещё раз.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (typeof document === "undefined") {
    return null;
  }

  const status = ORDER_STATUS_META[order.status];
  const createdAt = formatCommentDate(order.createdAt);
  const hasCreatedAt = Boolean(order.createdAt);

  return createPortal(
    <div
      role="presentation"
      data-order-details-overlay
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/80 p-4 backdrop-blur-sm sm:items-center"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-details-title"
        tabIndex={-1}
        data-order-details
        className="flex max-h-[calc(100vh-2rem)] w-full max-w-2xl min-w-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a] shadow-2xl shadow-black/60 outline-none"
      >
        <header className="flex items-start justify-between gap-4 border-b border-white/10 p-5 sm:p-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-[0.2em] text-blue-400 uppercase">
              Заказ
            </p>
            <h2
              id="order-details-title"
              data-order-details-title
              className="mt-2 text-2xl font-extrabold tracking-tight break-words text-white"
            >
              {order.title}
            </h2>
            <p className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${status.badgeClassName}`}
              >
                {status.label}
              </span>
              {hasCreatedAt ? (
                <span className="text-[11px] text-zinc-500">
                  Создан {createdAt}
                </span>
              ) : null}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть карточку заказа"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-lg text-zinc-400 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
          >
            <span aria-hidden>✕</span>
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            <DetailItem
              label="Клиент"
              value={order.clientName ?? "Не указан"}
              className="col-span-2"
            />
            <DetailItem
              label="Стоимость"
              value={formatOrderCost(order.totalCost)}
            />
            <DetailItem
              label="Вес модели"
              value={formatGrams(order.materialWeightG)}
            />
            <DetailItem
              label="Время печати"
              value={formatOrderHours(order.printTimeHours)}
            />
            <DetailItem
              label="Срок сдачи"
              value={formatOrderDate(order.deadline)}
            />
          </dl>

          {order.notes ? (
            <div className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3">
              <p className="text-[10px] font-semibold tracking-wide text-zinc-500 uppercase">
                Заметки
              </p>
              <p className="mt-1.5 text-sm leading-relaxed break-words whitespace-pre-line text-zinc-300">
                {order.notes}
              </p>
            </div>
          ) : null}

          <section aria-labelledby="order-comments-title" className="mt-6">
            <div className="flex items-baseline justify-between gap-3">
              <h3
                id="order-comments-title"
                className="text-sm font-semibold text-white"
              >
                Комментарии
              </h3>
              {!isLoading && comments.length > 0 ? (
                <span className="text-[11px] text-zinc-500 tabular-nums">
                  Всего: {comments.length}
                </span>
              ) : null}
            </div>

            <div aria-live="polite">
              {isLoading ? (
                <p className="mt-3 rounded-xl border border-dashed border-white/10 px-4 py-5 text-center text-sm text-zinc-500">
                  Загружаем комментарии…
                </p>
              ) : loadError ? (
                <p
                  role="alert"
                  className="mt-3 rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm leading-relaxed text-red-100"
                >
                  {loadError}
                </p>
              ) : (
                <>
                  <OrderCommentsList comments={comments} />
                  <div ref={bottomRef} aria-hidden className="h-px" />
                </>
              )}
            </div>

            <form
              onSubmit={handleSubmit}
              data-order-comment-form
              className="mt-4"
            >
              <label htmlFor="order-comment-text" className="sr-only">
                Написать комментарий
              </label>
              <textarea
                id="order-comment-text"
                ref={textareaRef}
                name="comment"
                rows={3}
                value={text}
                onChange={(event) => setText(event.target.value)}
                maxLength={ORDER_COMMENT_TEXT_LIMIT}
                placeholder="Написать комментарий..."
                autoComplete="off"
                className="min-h-24 w-full resize-y rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-base leading-relaxed text-white outline-none transition-all duration-200 placeholder:text-zinc-500 focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/30 focus:ring-inset"
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                <p className="text-[11px] text-zinc-500 tabular-nums">
                  {text.length} / {ORDER_COMMENT_TEXT_LIMIT}
                </p>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  aria-busy={isSubmitting}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-5 text-sm font-bold text-black shadow-[0_10px_30px_-12px_rgba(255,255,255,0.35)] transition-colors hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? "Отправка..." : "Отправить"}
                </button>
              </div>
            </form>

            {submitError ? (
              <p
                role="alert"
                className="mt-3 rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm leading-relaxed text-red-100"
              >
                {submitError}
              </p>
            ) : null}
          </section>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Лента комментариев: текст и дата.
 *
 * Вынесена отдельно, чтобы её можно было проверить без открытия окна: у ленты
 * нет состояния, кроме массива строк из базы.
 */
export function OrderCommentsList({
  comments,
}: {
  comments: OrderComment[];
}) {
  if (comments.length === 0) {
    return (
      <p className="mt-3 rounded-xl border border-dashed border-white/10 px-4 py-5 text-center text-sm leading-relaxed text-zinc-500">
        Комментариев пока нет. Напишите первый — он сохранится в заказе.
      </p>
    );
  }

  return (
    <ul data-order-comments className="mt-3 space-y-3">
      {comments.map((comment) => (
        <li
          key={comment.id}
          className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3.5 py-3"
        >
          <p className="text-sm leading-relaxed break-words whitespace-pre-line text-zinc-200">
            {comment.text}
          </p>
          <p className="mt-2 text-[11px] text-zinc-500">
            <time dateTime={comment.createdAt ?? undefined}>
              {formatCommentDate(comment.createdAt)}
            </time>
          </p>
        </li>
      ))}
    </ul>
  );
}

/** Строка деталей: подпись сверху, значение снизу. */
function DetailItem({
  label,
  value,
  className,
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 ${className ?? ""}`}>
      <dt className="text-[10px] font-semibold tracking-wide text-zinc-500 uppercase">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold break-words text-white tabular-nums">
        {value}
      </dd>
    </div>
  );
}
