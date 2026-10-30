"use client";

import { useRouter } from "next/navigation";
import {
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { createPortal } from "react-dom";

import {
  addOrderComment,
  addOrderItem,
  cancelOrderPrint,
  deleteOrder,
  loadOrderComments,
  loadOrderItems,
  loadOrderPrintStatus,
  queueOrderForPrint,
  updateOrderPrinter,
} from "@/app/actions/orders";
import type { OrderPrintStatus } from "@/app/actions/orders-state";
import { EditOrderDialog } from "@/components/workshop/EditOrderDialog";
import { useDialogDismiss } from "@/components/workshop/use-dialog-dismiss";
import {
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/workshop/WorkshopIcons";
import {
  isPrintableFile,
  printerMismatchMessage,
} from "@/lib/3d/print-compatibility";
import type { WorkshopClient } from "@/lib/workshop/clients";
import {
  formatGrams,
  type WorkshopFilament,
} from "@/lib/workshop/filaments";
import {
  ORDER_COMMENT_TEXT_LIMIT,
  ORDER_ITEM_QUANTITY_LIMIT,
  ORDER_STATUS_META,
  formatOrderCost,
  formatOrderDate,
  formatOrderHours,
  type OrderComment,
  type OrderItemSummary,
  type WorkshopOrder,
} from "@/lib/workshop/orders";
import type { WorkshopProduct } from "@/lib/workshop/products";
import type { WorkshopPrinter } from "@/lib/workshop/printers";

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
 *
 * Позиции заказа — отдельный блок с кнопкой «Добавить позицию»: доска держит
 * только деньги и принтер, поэтому список читается при открытии карточки тем же
 * способом, что и комментарии. Добавление идёт через Server Action
 * `addOrderItem`, а сохранённая строка сразу попадает в список — ждать
 * перезагрузки страницы незачем.
 *
 * Блок «3D-печать» — центр управления заказом на ферме: здесь выбирают принтер
 * (сохраняется сразу через `updateOrderPrinter`), а кнопка «В очередь на печать»
 * уступает место статусу задания («В очереди» / «Печатается на …»), когда
 * очередь уже создана. Так мастер не ищет принтер в другой вкладке и не ставит
 * дубль поверх работающего задания.
 */

type OrderDetailsDialogProps = {
  order: WorkshopOrder;
  /** Парк принтеров: из него выбирают машину для печати заказа. */
  printers: WorkshopPrinter[];
  /** База клиентов: окно правки выбирает готовый контакт из списка. */
  clients: WorkshopClient[];
  /** Катушки склада: окно правки предупреждает о нехватке пластика. */
  filaments: WorkshopFilament[];
  /** Каталог товаров: из него выбирают позицию заказа. */
  products: WorkshopProduct[];
  onClose: () => void;
  /** Сообщение для строки состояния на доске после правки. */
  onUpdated: (message: string) => void;
};

const COMMENT_DATE_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Сколько висит всплывающее уведомление: дольше — и оно мешает читать карточку. */
const PRINT_TOAST_TIMEOUT_MS = 4000;

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

/**
 * Оценка печати из G-кода: «≈45 мин» или «≈2 ч 5 мин».
 *
 * Агент присылает секунды, но мастеру нужно прикинуть время, а не считать.
 * Знак «≈» обязателен: слагер в G-коде считает по среднему потоку пластика, и
 * точная минута там не гарантирована. Меньше минуты показываем минуту — «0 мин»
 * выглядело бы как ошибка расчёта.
 */
function formatPrintDuration(seconds: number): string {
  const totalMinutes = Math.max(1, Math.round(seconds / 60));

  if (totalMinutes < 60) {
    return `≈${totalMinutes} мин`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return minutes === 0 ? `≈${hours} ч` : `≈${hours} ч ${minutes} мин`;
}

/**
 * Подсказка рядом с кнопкой «В очередь на печать».
 *
 * Кнопка блокируется по трём причинам: принтер не выбран, проверка позиций ещё
 * идёт или печатать нечего. Если проверка не удалась, текст не запрещает клик:
 * Server Action повторит чтение и объяснит причину. Активное задание перекрывает
 * всё остальное: пока оно живо, кнопки нет, и подсказка объясняет, чего ждать.
 * Запрошенная отмена важнее статуса задания: мастер уже нажал кнопку и должен
 * видеть, что просьба ушла агенту, а не что печать «просто идёт».
 *
 * Одна кнопка ставит в очередь весь заказ, поэтому при нескольких позициях с
 * файлом печати подсказка говорит о заданиях во множественном числе: мастер не
 * должен думать, что напечатается только первое изделие.
 */
function printQueueHint({
  hasPrinter,
  isLoading,
  status,
  queueItemCount,
}: {
  hasPrinter: boolean;
  isLoading: boolean;
  status: OrderPrintStatus | null;
  /** Сколько позиций уйдёт в очередь с выбранным принтером. */
  queueItemCount: number;
}): string {
  if (status?.activeJob) {
    if (status.activeJob.cancelRequested) {
      return "Отмена запрошена: агент остановит печать на следующем опросе — принтер ещё может быть занят.";
    }

    if (status.activeJob.status === "printing") {
      return status.activeJob.estimatedSeconds
        ? `Печать уже идёт: по оценке из G-кода ${formatPrintDuration(status.activeJob.estimatedSeconds)}.`
        : "Печать уже идёт: прогресс придёт от агента 3D-фермы.";
    }

    return "Задание в очереди фермы: агент заберёт его, как только освободится принтер.";
  }

  if (!hasPrinter) {
    return "Выберите принтер для печати";
  }

  if (isLoading) {
    return "Проверяем позиции заказа…";
  }

  if (!status) {
    return "Не удалось проверить позиции: сервер проверит их при постановке в очередь.";
  }

  if (status.itemCount === 0) {
    return "В заказе нет позиций — печатать нечего";
  }

  if (status.gcodeItemCount === 0) {
    return "В заказе нет файлов для печати: приложите .gcode или .3mf (STL нужно нарезать)";
  }

  if (queueItemCount > 1) {
    return "Принтер назначен: в очередь встанут все позиции с файлом печати";
  }

  return "Принтер назначен: задание встанет в очередь 3D-фермы";
}

/** Итог сверки позиций заказа с выбранным принтером. */
type PrintQueueCheck = {
  /** Позиций с файлом печати. */
  printable: number;
  /** Из них подходит принтеру — столько заданий уйдёт в очередь. */
  compatible: number;
  /** Первая причина отказа; null — все позиции с файлом подходят. */
  mismatch: string | null;
};

export function OrderDetailsDialog({
  order,
  printers,
  clients,
  filaments,
  products,
  onClose,
  onUpdated,
}: OrderDetailsDialogProps) {
  const [comments, setComments] = useState<OrderComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  /** Открыто окно правки поверх карточки. */
  const [isEditOpen, setIsEditOpen] = useState(false);
  /** Подтверждение сохранения остаётся в карточке до её закрытия. */
  const [updateNotice, setUpdateNotice] = useState<string | null>(null);
  /** Позиции заказа: читаются при открытии, добавляются вручную. */
  const [items, setItems] = useState<OrderItemSummary[]>([]);
  const [isItemsLoading, setIsItemsLoading] = useState(true);
  const [itemsError, setItemsError] = useState<string | null>(null);
  /** Форма добавления позиции раскрыта под списком. */
  const [isItemFormOpen, setIsItemFormOpen] = useState(false);
  const [newProductId, setNewProductId] = useState("");
  const [newQuantity, setNewQuantity] = useState("1");
  const [itemFormError, setItemFormError] = useState<string | null>(null);
  const [itemNotice, setItemNotice] = useState<string | null>(null);
  const [isAddingItem, setIsAddingItem] = useState(false);
  /**
   * Счётчик добавленных позиций.
   *
   * Готовность к печати зависит от позиций, но `order` приходит пропсом и после
   * `router.refresh()` меняется не сразу. Счётчик перечитывает статус печати
   * сразу после успешного добавления, не дожидаясь нового пропса.
   */
  const [itemsVersion, setItemsVersion] = useState(0);
  /**
   * Счётчик постановок в очередь.
   *
   * Активное задание приходит из `loadOrderPrintStatus`, а не из пропсов: после
   * успешной постановки статус нужно перечитать, иначе кнопка осталась бы на
   * месте до закрытия карточки.
   */
  const [queueVersion, setQueueVersion] = useState(0);
  /** Позиции с G-code: от ответа зависит доступность кнопки очереди печати. */
  const [printStatus, setPrintStatus] = useState<OrderPrintStatus | null>(null);
  const [isPrintStatusLoading, setIsPrintStatusLoading] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);
  /**
   * Принтер, выбранный в карточке.
   *
   * Начинается со значения заказа, но живёт отдельно: выбор сохраняется сразу,
   * а `order` приходит пропсом и после `router.refresh()` обновляется с
   * задержкой. Показывать старое значение значило бы «терять» только что
   * выбранную машину.
   */
  const [selectedPrinterId, setSelectedPrinterId] = useState(
    order.printerId ?? "",
  );
  const [isPrinterSaving, setIsPrinterSaving] = useState(false);
  const [printerError, setPrinterError] = useState<string | null>(null);
  /** Всплывающее уведомление после успешной постановки в очередь. */
  const [printNotice, setPrintNotice] = useState<string | null>(null);
  const [isQueueing, startQueueing] = useTransition();
  /** Отмена печати: кнопка гаснет до ответа сервера, как и постановка в очередь. */
  const [isCancellingPrint, startCancellingPrint] = useTransition();
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);
  const editTriggerRef = useRef<HTMLButtonElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  /**
   * Пока заказ удаляется, окно не закрывается: иначе непонятно, выполнено ли
   * действие, а фокус вернулся бы на карточку, которой уже нет.
   */
  const closeDialog = useCallback(() => {
    if (!isDeleting) {
      onClose();
    }
  }, [isDeleting, onClose]);

  useDialogDismiss(closeDialog);

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

  /**
   * Позиции заказа читаются при открытии карточки.
   *
   * Доска их не держит: `WorkshopOrder` знает только деньги и принтер. Ошибка
   * чтения остаётся текстом в блоке позиций — карточка открывается, а форма
   * добавления сама объяснит причину, если база не готова.
   */
  useEffect(() => {
    let isActive = true;
    setIsItemsLoading(true);
    setItemsError(null);
    setItemNotice(null);
    setItemFormError(null);
    setIsItemFormOpen(false);
    setNewProductId("");
    setNewQuantity("1");

    loadOrderItems(order.id)
      .then((list) => {
        if (isActive) {
          setItems(list);
        }
      })
      .catch(() => {
        if (isActive) {
          setItemsError(
            "Не удалось загрузить позиции. Закройте карточку и откройте снова.",
          );
        }
      })
      .finally(() => {
        if (isActive) {
          setIsItemsLoading(false);
        }
      });

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

  /**
   * Готовность к печати и активное задание читаются при открытии карточки, после
   * добавления позиции и после постановки в очередь.
   *
   * Позиций заказа нет в `WorkshopOrder`: их знает только сервер. Запрос идёт и
   * без принтера — очередь могла появиться раньше, а принтер заказа снять
   * успели; карточка должна показать «В очереди», а не пустую кнопку.
   */
  useEffect(() => {
    let isActive = true;
    setIsPrintStatusLoading(true);

    loadOrderPrintStatus(order.id)
      .then((status) => {
        if (isActive) {
          setPrintStatus(status);
        }
      })
      .catch(() => {
        if (isActive) {
          setPrintStatus(null);
        }
      })
      .finally(() => {
        if (isActive) {
          setIsPrintStatusLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [order.id, itemsVersion, queueVersion]);

  /** Уведомление об успехе гаснет само — закрывать его руками не нужно. */
  useEffect(() => {
    if (!printNotice) {
      return;
    }

    const timer = window.setTimeout(
      () => setPrintNotice(null),
      PRINT_TOAST_TIMEOUT_MS,
    );

    return () => window.clearTimeout(timer);
  }, [printNotice]);

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

  /**
   * Добавление позиции из каталога.
   *
   * Товар и количество проверяются до запроса: сервер повторит проверку
   * (`readOrderItemQuantity`), потому что Server Action — публичный endpoint.
   * Сохранённую строку окно показывает сразу, а `router.refresh()` обновляет
   * доску и печатные формы, которые читают позиции с сервера.
   */
  async function handleAddItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isAddingItem) {
      return;
    }

    if (!newProductId) {
      setItemFormError("Выберите товар из каталога.");
      return;
    }

    const quantity = Number(newQuantity.replace(",", "."));

    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > ORDER_ITEM_QUANTITY_LIMIT
    ) {
      setItemFormError(
        `Количество — целое число от 1 до ${ORDER_ITEM_QUANTITY_LIMIT.toLocaleString("ru-RU")}.`,
      );
      return;
    }

    setItemFormError(null);
    setIsAddingItem(true);

    try {
      const result = await addOrderItem(order.id, newProductId, quantity);

      if (!result.ok) {
        setItemFormError(result.error);
        return;
      }

      setItems((current) => [...current, result.item]);
      setItemNotice(result.message);
      setIsItemFormOpen(false);
      setNewProductId("");
      setNewQuantity("1");
      setItemsVersion((version) => version + 1);
      onUpdated(result.message);
      router.refresh();
    } catch {
      setItemFormError("Нет связи с сервером. Попробуйте ещё раз.");
    } finally {
      setIsAddingItem(false);
    }
  }

  /**
   * Удаление заказа из карточки.
   *
   * Спрашиваем подтверждение через `window.confirm` — как у возврата в админке:
   * удаление необратимо, а отдельная модалка внутри модалки мешала бы Escape и
   * фокусу. После успеха карточка закрывается и доска перечитывается с сервера.
   */
  async function handleDelete() {
    if (isDeleting) {
      return;
    }

    const confirmed = window.confirm(
      `Удалить заказ «${order.title}»? Это действие нельзя отменить.`,
    );

    if (!confirmed) {
      return;
    }

    setDeleteError(null);
    setIsDeleting(true);

    try {
      const result = await deleteOrder(order.id);

      if (!result.ok) {
        setDeleteError(
          result.error ?? "Не удалось удалить заказ. Попробуйте ещё раз.",
        );
        return;
      }

      onClose();
      router.refresh();
    } catch {
      setDeleteError("Нет связи с сервером. Попробуйте ещё раз.");
    } finally {
      setIsDeleting(false);
    }
  }

  /**
   * Постановка заказа в очередь печати.
   *
   * Кнопка подсказывает, чего не хватает, но сервер проверяет принтер и G-code
   * повторно: доска могла устареть, пока карточка была открыта. Выбранный в
   * карточке принтер уходит вместе с запросом — заказ сохраняется отдельно, и
   * сразу после выбора он может ещё не доехать до строки в базе. `useTransition`
   * держит кнопку в состоянии загрузки до ответа, а `router.refresh()`
   * перечитывает заказы — задание могло появиться в другой вкладке.
   */
  function handleQueuePrint() {
    if (isQueueing) {
      return;
    }

    setPrintError(null);

    startQueueing(async () => {
      try {
        const result = await queueOrderForPrint(
          order.id,
          selectedPrinterId || null,
        );

        if (!result.ok) {
          setPrintError(
            result.error ?? "Не удалось поставить задание в очередь.",
          );
          return;
        }

        const message = result.message ?? "Задание добавлено в очередь.";
        setPrintNotice(message);
        onUpdated(message);
        // Кнопка должна смениться статусом задания: перечитываем очередь, не
        // дожидаясь нового пропса `order`.
        setQueueVersion((version) => version + 1);
        router.refresh();
      } catch {
        setPrintError("Нет связи с сервером. Попробуйте ещё раз.");
      }
    });
  }

  /**
   * Отмена печати заказа.
   *
   * Задание ищет сервер: карточка могла открыться до постановки в очередь, а
   * клиентский id — лишний повод поверить вводу. `queueVersion` перечитывает
   * статус задания, чтобы кнопка сразу сменилась на «Отмена запрошена…»: агент
   * гасит печать не мгновенно, и повторный клик должен быть заблокирован.
   */
  function handleCancelPrint() {
    if (isCancellingPrint) {
      return;
    }

    setPrintError(null);

    startCancellingPrint(async () => {
      try {
        const result = await cancelOrderPrint(order.id);

        if (!result.ok) {
          setPrintError(result.error ?? "Не удалось отменить печать.");
          return;
        }

        const message = result.message ?? "Печать отменена.";
        setPrintNotice(message);
        onUpdated(message);
        setQueueVersion((version) => version + 1);
        router.refresh();
      } catch {
        setPrintError("Нет связи с сервером. Попробуйте ещё раз.");
      }
    });
  }

  /**
   * Смена принтера в карточке.
   *
   * Пишем сразу, без кнопки «Сохранить»: принтер — одна строка, и мастер
   * ожидает, что выбор запомнится. При ошибке возвращаем прежнее значение:
   * оставлять в списке принтер, которого нет в заказе, значит показывать
   * недостоверную картину фермы.
   */
  function handlePrinterChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextId = event.target.value;
    const previousId = selectedPrinterId;

    if (nextId === previousId) {
      return;
    }

    setSelectedPrinterId(nextId);
    setPrinterError(null);
    setIsPrinterSaving(true);

    void (async () => {
      try {
        const result = await updateOrderPrinter(order.id, nextId || null);

        if (!result.ok) {
          setSelectedPrinterId(previousId);
          setPrinterError(result.error ?? "Не удалось сохранить принтер.");
          return;
        }

        onUpdated(result.message ?? "Принтер заказа сохранён.");
        router.refresh();
      } catch {
        setSelectedPrinterId(previousId);
        setPrinterError("Нет связи с сервером. Принтер не сохранён.");
      } finally {
        setIsPrinterSaving(false);
      }
    })();
  }

  /**
   * Правка сохранена: окно правки закрылось, карточка получает новые данные
   * после `router.refresh()`. Сообщение остаётся и в карточке, и на доске —
   * после закрытия человек увидит, что изменения записались.
   */
  const handleEdited = useCallback(
    (message: string) => {
      setUpdateNotice(message);
      onUpdated(message);
    },
    [onUpdated],
  );

  /**
   * Закрытие окна правки возвращает фокус на карандаш — по тому же правилу, что
   * карточка возвращает его на заголовок карточки Kanban.
   */
  const closeEdit = useCallback(() => {
    setIsEditOpen(false);

    requestAnimationFrame(() => {
      editTriggerRef.current?.focus();
    });
  }, []);

  /**
   * Цены товаров по id: сумму позиций карточка считает сама.
   *
   * В `workshop_order_items` цены нет — она живёт в каталоге. Сумма нужна для
   * справки: `total_cost` заказа остаётся ручным полем мастера, потому что
   * включает работу, а не только товары.
   */
  const productById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );
  const itemsTotal = items.reduce((sum, item) => {
    const product = item.productId
      ? productById.get(item.productId)
      : undefined;

    return product ? sum + product.price * item.quantity : sum;
  }, 0);

  /**
   * Сверка позиций заказа с выбранным принтером.
   *
   * 3MF помнит модель принтера, под которую его нарезали, и чужой профиль ломает
   * печать. Текст берём из общего модуля: карточка и Server Action говорят одно и
   * то же, а `queueOrderForPrint` повторяет проверку — страница могла устареть,
   * пока карточка была открыта.
   *
   * Считаются только позиции с файлом печати: `compatible` — сколько из них
   * уйдёт в очередь, `mismatch` — первая причина отказа. Одна неверно нарезанная
   * позиция не блокирует заказ: сервер пропустит её и поставит остальные, поэтому
   * кнопка гаснет только когда под принтер не подходит ни одна позиция.
   */
  const printQueueCheck = useMemo<PrintQueueCheck>(() => {
    const empty: PrintQueueCheck = { printable: 0, compatible: 0, mismatch: null };

    if (!selectedPrinterId) {
      return empty;
    }

    const printer = printers.find((entry) => entry.id === selectedPrinterId);

    if (!printer) {
      return empty;
    }

    let printable = 0;
    let compatible = 0;
    let mismatch: string | null = null;

    for (const item of items) {
      const product = item.productId
        ? productById.get(item.productId)
        : undefined;

      if (!isPrintableFile(product?.gcodeUrl ?? null)) {
        continue;
      }

      printable += 1;

      const message = product?.slicedForPrinter
        ? printerMismatchMessage(product.slicedForPrinter, {
            brand: printer.brand,
            model: printer.model,
          })
        : null;

      if (message) {
        mismatch = mismatch ?? message;
        continue;
      }

      compatible += 1;
    }

    return { printable, compatible, mismatch };
  }, [items, printers, productById, selectedPrinterId]);

  if (typeof document === "undefined") {
    return null;
  }

  const status = ORDER_STATUS_META[order.status];
  const createdAt = formatCommentDate(order.createdAt);
  const hasCreatedAt = Boolean(order.createdAt);
  const hasPrinter = Boolean(selectedPrinterId);
  const hasGcode = (printStatus?.gcodeItemCount ?? 0) > 0;
  /** Задание, которое уже стоит в очереди или печатается. */
  const activeJob = printStatus?.activeJob ?? null;
  /** Просьба об отмене уже в базе: агент остановит принтер на следующем опросе. */
  const cancelRequested = activeJob?.cancelRequested ?? false;
  /**
   * Последний отказ или отмена. Показываем только без активного задания: иначе
   * старый текст ошибки читался бы как причина текущей печати.
   */
  const lastFailure = activeJob ? null : (printStatus?.lastFailure ?? null);
  /**
   * Подпись статуса задания. Принтер берём из задания, а не из заказа: печатать
   * будет та машина, которой задание отдали, даже если заказ уже переназначили.
   */
  const activeJobLabel = activeJob
    ? activeJob.status === "printing"
      ? activeJob.printerName
        ? `Печатается на «${activeJob.printerName}»`
        : "Печатается"
      : activeJob.printerName
        ? `В очереди на «${activeJob.printerName}»`
        : "В очереди"
    : "";
  /**
   * Первая причина, по которой позиция не уйдёт на этот принтер. Текст её же
   * показывает карточка; пусто — все позиции с файлом подходят.
   */
  const slicedPrinterMismatch = printQueueCheck.mismatch;
  /**
   * Под принтер не подходит ни одна позиция с файлом печати — ставить в очередь
   * нечего. Пока таких позиций нет вовсе (список ещё не прочитан), запрещать
   * клик нельзя: сервер проверит всё заново и объяснит причину.
   */
  const allPrintableItemsMismatch =
    printQueueCheck.printable > 0 && printQueueCheck.compatible === 0;
  /**
   * Кнопка активна, когда принтер назначен, проверка нашла товар с G-code,
   * активного задания ещё нет и хотя бы одна позиция нарезана под этот принтер.
   * `printStatus === null` значит «проверка не удалась» — клик разрешён,
   * сервер всё равно проверит позиции и разметку 3MF заново.
   */
  const canQueuePrint =
    hasPrinter &&
    !activeJob &&
    !isPrintStatusLoading &&
    !allPrintableItemsMismatch &&
    (printStatus === null || hasGcode);
  const printHint = printQueueHint({
    hasPrinter,
    isLoading: isPrintStatusLoading,
    status: printStatus,
    queueItemCount: printQueueCheck.compatible,
  });
  /**
   * Текст предупреждения под кнопкой. Пока под принтер подходит хоть одна
   * позиция, кнопка жива, и это только предупреждение о пропуске; иначе —
   * причина, по которой печатать нечего.
   */
  const mismatchNotice = slicedPrinterMismatch
    ? allPrintableItemsMismatch
      ? slicedPrinterMismatch
      : `Часть позиций не попадёт в очередь. ${slicedPrinterMismatch}`
    : null;

  /**
   * Выбранного принтера может не быть в парке: его удалили после назначения.
   * Оставляем строку в списке, чтобы значение не «прыгало» на «Не выбран», и
   * подсказываем выбрать живую машину.
   */
  const isSelectedPrinterMissing =
    hasPrinter && !printers.some((printer) => printer.id === selectedPrinterId);

  return createPortal(
    <div
      role="presentation"
      data-order-details-overlay
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          closeDialog();
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
          <div className="flex shrink-0 items-center gap-2">
            <button
              ref={editTriggerRef}
              type="button"
              onClick={() => setIsEditOpen(true)}
              disabled={isDeleting}
              aria-label="Редактировать заказ"
              title="Редактировать заказ"
              data-order-edit-open
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-zinc-300 transition-colors hover:border-blue-400/50 hover:bg-blue-500/15 hover:text-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] disabled:cursor-wait disabled:opacity-60"
            >
              <PencilIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={isDeleting}
              aria-busy={isDeleting}
              aria-label="Удалить заказ"
              title="Удалить заказ"
              data-order-delete
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-400/30 bg-red-500/10 text-red-300 transition-colors hover:border-red-400/60 hover:bg-red-500/20 hover:text-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] disabled:cursor-wait disabled:opacity-60"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={closeDialog}
              disabled={isDeleting}
              aria-label="Закрыть карточку заказа"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-lg text-zinc-400 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] disabled:cursor-wait disabled:opacity-60"
            >
              <span aria-hidden>✕</span>
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6">
          {updateNotice ? (
            <p
              role="status"
              data-order-updated
              className="mb-4 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm leading-relaxed text-emerald-100"
            >
              {updateNotice}
            </p>
          ) : null}

          {deleteError ? (
            <p
              role="alert"
              data-order-delete-error
              className="mb-4 rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm leading-relaxed text-red-100"
            >
              {deleteError}
            </p>
          ) : null}

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

          <section
            aria-labelledby="order-items-title"
            data-order-items
            className="mt-5 rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 py-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h3
                  id="order-items-title"
                  className="text-[10px] font-semibold tracking-wide text-zinc-500 uppercase"
                >
                  Позиции заказа
                </h3>
                <p
                  aria-live="polite"
                  data-order-items-summary
                  className="mt-1 text-sm leading-relaxed text-zinc-400"
                >
                  {isItemsLoading
                    ? "Загружаем позиции…"
                    : items.length === 0
                      ? "Позиций пока нет — печатать нечего."
                      : `Всего: ${items.length}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setItemFormError(null);
                  setIsItemFormOpen((open) => !open);
                }}
                aria-expanded={isItemFormOpen}
                aria-controls="order-item-form"
                data-order-item-add
                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 text-sm font-semibold text-slate-200 transition-colors hover:border-blue-400/50 hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
              >
                <PlusIcon className="h-4 w-4" />
                {isItemFormOpen ? "Свернуть" : "Добавить позицию"}
              </button>
            </div>

            {itemsError ? (
              <p
                role="alert"
                className="mt-3 rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm leading-relaxed text-red-100"
              >
                {itemsError}
              </p>
            ) : null}

            {items.length > 0 ? (
              <ul data-order-items-list className="mt-3 space-y-2">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2"
                  >
                    <span className="min-w-0 text-sm leading-relaxed break-words text-zinc-200">
                      {item.productTitle ?? item.sku ?? "Позиция без товара"}
                      {item.productTitle && item.sku ? (
                        <span className="ml-2 text-[11px] text-zinc-500">
                          {item.sku}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-white tabular-nums">
                      × {item.quantity}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}

            {itemsTotal > 0 ? (
              <p
                data-order-items-total
                className="mt-2 text-[11px] leading-relaxed text-zinc-500"
              >
                Сумма по товарам: {formatOrderCost(itemsTotal)}. Стоимость
                заказа выше задаётся вручную и не меняется.
              </p>
            ) : null}

            {isItemFormOpen ? (
              <form
                id="order-item-form"
                onSubmit={handleAddItem}
                data-order-item-form
                className="mt-3 space-y-3 rounded-xl border border-white/[0.07] bg-black/30 px-3 py-3"
              >
                <div>
                  <label
                    htmlFor="order-item-product"
                    className="block text-xs font-semibold text-zinc-300"
                  >
                    Товар
                  </label>
                  <select
                    id="order-item-product"
                    value={newProductId}
                    onChange={(event) => {
                      setNewProductId(event.target.value);
                      setItemFormError(null);
                    }}
                    disabled={isAddingItem || products.length === 0}
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none transition-all duration-200 focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/30 focus:ring-inset disabled:opacity-60"
                  >
                    <option value="">— Выберите товар —</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.title}
                        {product.gcodeUrl ? " · G-code" : ""}
                      </option>
                    ))}
                  </select>
                  {products.length === 0 ? (
                    <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">
                      Каталог пуст — добавьте товары на вкладке «Товары».
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-end gap-3">
                  <div className="w-28">
                    <label
                      htmlFor="order-item-quantity"
                      className="block text-xs font-semibold text-zinc-300"
                    >
                      Количество
                    </label>
                    <input
                      id="order-item-quantity"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={ORDER_ITEM_QUANTITY_LIMIT}
                      step={1}
                      value={newQuantity}
                      onChange={(event) => setNewQuantity(event.target.value)}
                      disabled={isAddingItem}
                      className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white tabular-nums outline-none transition-all duration-200 [appearance:textfield] focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/30 focus:ring-inset disabled:opacity-60 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isAddingItem || products.length === 0}
                    aria-busy={isAddingItem}
                    data-order-item-submit
                    className="inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-5 text-sm font-bold text-black shadow-[0_10px_30px_-12px_rgba(255,255,255,0.35)] transition-colors hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isAddingItem ? "Добавляем…" : "Добавить"}
                  </button>
                </div>

                {itemFormError ? (
                  <p
                    role="alert"
                    data-order-item-error
                    className="rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm leading-relaxed text-red-100"
                  >
                    {itemFormError}
                  </p>
                ) : null}
              </form>
            ) : null}

            {itemNotice ? (
              <p
                role="status"
                data-order-item-notice
                className="mt-3 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-sm leading-relaxed text-emerald-100"
              >
                {itemNotice}
              </p>
            ) : null}
          </section>

          <div
            data-order-print-queue
            className="mt-5 rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 py-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold tracking-wide text-zinc-500 uppercase">
                  3D-печать
                </p>
                <p
                  data-order-print-hint
                  aria-live="polite"
                  className="mt-1 text-sm leading-relaxed text-zinc-400"
                >
                  {printHint}
                </p>
              </div>
              {activeJob ? (
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  <span
                    data-order-print-job-status={activeJob.status}
                    className={
                      activeJob.status === "printing"
                        ? "inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-blue-400/40 bg-blue-500/10 px-4 text-sm font-semibold text-blue-100"
                        : "inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 text-sm font-semibold text-amber-100"
                    }
                  >
                    <span aria-hidden>
                      {activeJob.status === "printing" ? "▶" : "⏳"}
                    </span>
                    {activeJobLabel}
                  </span>
                  <button
                    type="button"
                    onClick={handleCancelPrint}
                    disabled={isCancellingPrint || cancelRequested}
                    aria-busy={isCancellingPrint}
                    data-order-print-cancel-button
                    className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-red-400/40 bg-red-500/10 px-4 text-sm font-semibold text-red-100 transition-colors hover:border-red-400/60 hover:bg-red-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {cancelRequested
                      ? "Отмена запрошена…"
                      : isCancellingPrint
                        ? "Отменяем…"
                        : "Отменить печать"}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleQueuePrint}
                  disabled={!canQueuePrint || isQueueing}
                  aria-busy={isQueueing}
                  data-order-print-queue-button
                  className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-500 px-4 text-sm font-bold text-white shadow-[0_10px_30px_-12px_rgba(59,130,246,0.8)] transition-colors hover:bg-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isQueueing ? "Ставим в очередь…" : "В очередь на печать"}
                </button>
              )}
            </div>

            {activeJob ? (
              <dl
                data-order-print-job-details
                className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs leading-relaxed text-zinc-400"
              >
                {typeof activeJob.estimatedSeconds === "number" ? (
                  <div className="flex items-center gap-1.5">
                    <dt className="text-zinc-500">Оценка</dt>
                    <dd className="tabular-nums">
                      {formatPrintDuration(activeJob.estimatedSeconds)}
                    </dd>
                  </div>
                ) : null}
                {typeof activeJob.filamentGrams === "number" ? (
                  <div className="flex items-center gap-1.5">
                    <dt className="text-zinc-500">Пластик</dt>
                    <dd className="tabular-nums">
                      {formatGrams(activeJob.filamentGrams)}
                    </dd>
                  </div>
                ) : null}
                {activeJob.queuedAt ? (
                  <div className="flex items-center gap-1.5">
                    <dt className="text-zinc-500">В очереди с</dt>
                    <dd>{formatCommentDate(activeJob.queuedAt)}</dd>
                  </div>
                ) : null}
                {activeJob.startedAt ? (
                  <div className="flex items-center gap-1.5">
                    <dt className="text-zinc-500">Печать начата</dt>
                    <dd>{formatCommentDate(activeJob.startedAt)}</dd>
                  </div>
                ) : null}
              </dl>
            ) : null}

            {lastFailure ? (
              <p
                role="status"
                data-order-print-last-failure={lastFailure.status}
                className={
                  lastFailure.status === "failed"
                    ? "mt-2 rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2 text-xs leading-relaxed text-red-100"
                    : "mt-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs leading-relaxed text-zinc-400"
                }
              >
                {lastFailure.status === "failed"
                  ? "Прошлая печать прервана"
                  : "Прошлая печать отменена"}
                {lastFailure.at
                  ? ` · ${formatCommentDate(lastFailure.at)}`
                  : ""}
                {lastFailure.message ? `: ${lastFailure.message}` : "."}
              </p>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label
                htmlFor="order-print-printer"
                className="text-xs font-semibold text-zinc-300"
              >
                Принтер
              </label>
              <select
                id="order-print-printer"
                value={selectedPrinterId}
                onChange={handlePrinterChange}
                disabled={isPrinterSaving}
                data-order-print-printer
                className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none transition-all duration-200 focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/30 focus:ring-inset disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">Не выбран</option>
                {isSelectedPrinterMissing ? (
                  <option value={selectedPrinterId}>
                    Принтер удалён из парка
                  </option>
                ) : null}
                {printers.map((printer) => (
                  <option key={printer.id} value={printer.id}>
                    {printer.name}
                  </option>
                ))}
              </select>
              {isPrinterSaving ? (
                <span className="text-xs text-zinc-500">Сохраняем…</span>
              ) : null}
            </div>

            {printers.length === 0 ? (
              <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                Принтеров пока нет — добавьте их на вкладке «Принтеры», иначе
                задание некуда поставить.
              </p>
            ) : null}

            {printerError ? (
              <p
                role="alert"
                data-order-print-printer-error
                className="mt-3 rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm leading-relaxed text-red-100"
              >
                {printerError}
              </p>
            ) : null}
            {printError ? (
              <p
                role="alert"
                data-order-print-error
                className="mt-3 rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm leading-relaxed text-red-100"
              >
                {printError}
              </p>
            ) : null}
            {mismatchNotice ? (
              <p
                role="alert"
                data-order-print-mismatch
                className="mt-3 rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-sm leading-relaxed text-amber-100"
              >
                {mismatchNotice}
              </p>
            ) : null}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <a
              href={`/workshop/orders/${order.id}/specification`}
              target="_blank"
              rel="noopener noreferrer"
              data-order-specification
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 text-sm font-semibold text-slate-200 transition-colors hover:border-blue-400/50 hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
            >
              <span aria-hidden>📄</span>
              Спецификация
              <span aria-hidden className="text-xs text-zinc-500">
                ↗
              </span>
            </a>
            <a
              href={`/workshop/orders/${order.id}/waybill`}
              target="_blank"
              rel="noopener noreferrer"
              data-order-waybill
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 text-sm font-semibold text-slate-200 transition-colors hover:border-blue-400/50 hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
            >
              <span aria-hidden>📦</span>
              Накладная
              <span aria-hidden className="text-xs text-zinc-500">
                ↗
              </span>
            </a>
            <span className="text-xs text-zinc-500">
              Печатные формы заказа
            </span>
          </div>

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
      {/*
        Тост живёт в том же портале, что и карточка: он всплывает над содержимым
        и гаснет сам, не сдвигая ни детали, ни ленту комментариев.
      */}
      {printNotice ? (
        <p
          role="status"
          data-order-print-toast
          className="pointer-events-none fixed inset-x-4 bottom-6 z-[90] mx-auto max-w-sm rounded-xl border border-emerald-400/50 bg-emerald-500/20 px-4 py-3 text-center text-sm font-semibold text-emerald-50 shadow-2xl shadow-black/60 backdrop-blur"
        >
          {printNotice}
        </p>
      ) : null}
      {isEditOpen ? (
        <EditOrderDialog
          order={order}
          clients={clients}
          filaments={filaments}
          onClose={closeEdit}
          onSaved={handleEdited}
        />
      ) : null}
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
