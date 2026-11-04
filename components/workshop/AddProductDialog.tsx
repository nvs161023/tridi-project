"use client";

import { useRouter } from "next/navigation";
import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useState,
} from "react";
import { createPortal } from "react-dom";

import {
  addMarketplaceLink,
  deleteMarketplaceLink,
  getMarketplaceLinks,
} from "@/app/actions/marketplace";
import { addProduct, updateProduct } from "@/app/actions/products";
import { useDialogDismiss } from "@/components/workshop/use-dialog-dismiss";
import { TrashIcon } from "@/components/workshop/WorkshopIcons";
import {
  PRODUCT_FILE_LABEL,
  printFileExtension,
  slicedForPrinterLabel,
} from "@/lib/3d/print-compatibility";
import {
  MARKETPLACES,
  MARKETPLACE_LINK_LIMITS,
  MARKETPLACE_META,
  type Marketplace,
  type MarketplaceLink,
  type MarketplaceLinkDraft,
} from "@/lib/workshop/marketplace";
import type { WorkshopProduct } from "@/lib/workshop/products";
import {
  PRINTER_UPLOAD_FORMATS,
  formatPrinterProtocol,
  validatePrintFileForProtocol,
  type WorkshopPrinter,
} from "@/lib/workshop/printers";

type AddProductDialogProps = {
  /**
   * Товар для правки.
   *
   * Без пропа окно создаёт карточку, с ним — редактирует: поля заполняются
   * текущими значениями, а «Сохранить» вызывает `updateProduct`. Файл у товара
   * один: его можно заменить, не трогая остальное, — новый файл уходит в
   * `/api/workshop/gcode` отдельным запросом и подменяет ссылку в `gcode_url`.
   */
  initial?: WorkshopProduct | null;
  /**
   * Принтеры фермы: по их протоколам окно проверяет формат файла модели.
   *
   * Проверять нечего, когда парк пуст: товар заводят и до подключения первого
   * принтера. Ферма читается на странице Мастерской один раз для всех вкладок,
   * поэтому окно получает готовый массив, а не делает свой запрос.
   */
  printers?: WorkshopPrinter[];
  onClose: () => void;
};

const inputClassName =
  "mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-base text-white outline-none transition-all duration-200 [appearance:textfield] placeholder:text-zinc-500 focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/30 focus:ring-inset [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

const legendClassName =
  "text-xs font-semibold tracking-[0.16em] text-blue-300 uppercase";

/** Вид выбора файла — один блок «Файл модели для печати». */
const fileInputClassName =
  "mt-2 block w-full cursor-pointer rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-zinc-300 file:mr-4 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30";

/** Результат загрузки файла: ссылка с разметкой принтера или готовый текст отказа. */
type UploadOutcome =
  | { ok: true; url: string; printerModel: string }
  | { ok: false; error: string };

/**
 * Строка блока маркетплейсов.
 *
 * У правки это сохранённая связь (удаляется сразу), у нового товара — черновик
 * из формы: строки отличаются только источником и способом удаления, поэтому
 * разметка у списка одна.
 */
type MarketplaceLinkRow = {
  key: string;
  marketplace: Marketplace;
  sku: string;
  busy: boolean;
  remove: () => void;
};

/**
 * Отправка файла товара в `/api/workshop/gcode`.
 *
 * File в Server Action не отправляем: он весит мегабайты и упрётся в лимит
 * тела. Файл идёт в роут, а в форму попадает только публичная ссылка — она
 * ложится в `gcode_url`. Роут проверяет расширения сам, но форму он не
 * охраняет — предварительные проверки остаются в обработчике выбора файла.
 */
async function uploadProductFile(file: File): Promise<UploadOutcome> {
  const uploadForm = new FormData();
  uploadForm.set("file", file);

  try {
    const response = await fetch("/api/workshop/gcode", {
      method: "POST",
      body: uploadForm,
    });
    const payload = (await response.json().catch(() => null)) as
      | { url?: unknown; printerModel?: unknown; error?: unknown }
      | null;

    if (
      !response.ok ||
      !payload ||
      typeof payload.url !== "string" ||
      !payload.url
    ) {
      return {
        ok: false,
        error:
          typeof payload?.error === "string"
            ? payload.error
            : "Не удалось загрузить файл. Попробуйте ещё раз.",
      };
    }

    return {
      ok: true,
      url: payload.url,
      printerModel:
        typeof payload.printerModel === "string" ? payload.printerModel : "",
    };
  } catch {
    return {
      ok: false,
      error:
        "Не удалось отправить файл. Проверьте соединение и попробуйте ещё раз.",
    };
  }
}

/**
 * Причина, по которой файл не напечатает ни один принтер фермы.
 *
 * null — файл подходит (или проверять нечего). Товар печатается на любом
 * свободном принтере, поэтому достаточно, чтобы формат принимал хотя бы один
 * протокол парка: `.gcode` подходит всем, `.3mf` — только Bambu, FlashForge и
 * ещё не подключённым протоколам с контейнером.
 *
 * STL здесь не проверяется: это модель для нарезки, а не задание печати, и
 * загрузить её в общем блоке разрешено — печатать её всё равно никто не будет
 * (`isPrintableFile` отклонит такой файл в очереди).
 *
 * Сообщение состоит из двух частей: отказ общего модуля (он знает текст про
 * переслайс) и список форматов фермы, чтобы мастеру было видно, к чему
 * стремиться.
 */
function farmFormatError(
  printers: WorkshopPrinter[],
  fileName: string,
): string | null {
  if (printers.length === 0 || printFileExtension(fileName) === "stl") {
    return null;
  }

  const protocols = [
    ...new Set(printers.map((printer) => printer.protocolType)),
  ];
  const checks = protocols.map((protocol) =>
    validatePrintFileForProtocol(protocol, fileName),
  );

  if (checks.some((check) => check.ok)) {
    return null;
  }

  const formats = protocols
    .map(
      (protocol) =>
        `${formatPrinterProtocol(protocol)} — ${PRINTER_UPLOAD_FORMATS[protocol].join(", ")}`,
    )
    .join("; ");
  const reason = checks.find((check) => !check.ok);

  return `${reason ? reason.reason : "Файл не годится для печати."} Форматы фермы: ${formats}.`;
}

/**
 * Окно «Добавить товар» и «Редактировать товар».
 *
 * Форма отправляется в Server Action `addProduct` (или `updateProduct`, если
 * передан `initial`): пока идёт запрос, кнопка «Сохранить» заблокирована, а
 * ошибка сервера показывается плашкой внутри окна. После успеха каталог
 * обновляется через `router.refresh()`, и окно закрывается. Окно монтируется
 * только открытым: состояние полей и подписка на Escape живут ровно столько,
 * сколько оно на экране. У всех полей `autoComplete="off"`, чтобы браузер не
 * рисовал белые панели автозаполнения поверх тёмной формы.
 *
 * Блок «SKU на маркетплейсах» есть в обоих режимах: у правки он пишет связи в
 * `workshop_marketplace_links` сразу, а у нового товара копит их в черновике
 * `pendingLinks` и отдаёт в `addProduct` — id карточки появляется только после
 * вставки.
 */
export function AddProductDialog({
  initial = null,
  printers = [],
  onClose,
}: AddProductDialogProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Причина, по которой выбранный файл не подходит ферме. */
  const [fileError, setFileError] = useState<string | null>(null);
  /** Модель принтера из метаданных 3MF: её показали после загрузки. */
  const [slicedPrinter, setSlicedPrinter] = useState<string | null>(
    initial?.slicedForPrinter ?? null,
  );

  const isEditing = initial !== null;
  // Файл у товара один: у новых карточек ссылка лежит в `gcodeUrl`, у старых
  // STL остался в `modelUrl`. Показываем одну ссылку, чтобы не плодить блоки.
  const storedFile = initial?.gcodeUrl ?? initial?.modelUrl ?? null;
  const currentFile =
    storedFile && /^https?:\/\//iu.test(storedFile) ? storedFile : null;

  useDialogDismiss(onClose);

  /**
   * Связи «SKU площадки → товар» для блока маркетплейсов.
   *
   * null — список ещё читается. У нового товара связей нет: они появляются
   * только после сохранения карточки, когда у неё есть id, поэтому до
   * сохранения блок показывает черновик `pendingLinks`.
   */
  const [links, setLinks] = useState<MarketplaceLink[] | null>(null);
  /**
   * Связи, добавленные до сохранения нового товара.
   *
   * В базе их ещё нет: id карточки не существует. Массив уходит в `addProduct`
   * полем `marketplaceLinks` (JSON), а после успеха очищается.
   */
  const [pendingLinks, setPendingLinks] = useState<MarketplaceLinkDraft[]>([]);
  const [linkFormOpen, setLinkFormOpen] = useState(false);
  const [linkMarketplace, setLinkMarketplace] = useState<Marketplace>("ozon");
  const [linkSku, setLinkSku] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkNotice, setLinkNotice] = useState<string | null>(null);
  const [isLinkBusy, setIsLinkBusy] = useState(false);
  const [deletingLinkId, setDeletingLinkId] = useState<string | null>(null);
  /** id товара: по нему читаются связи и не перезапускается эффект. */
  const productId = initial?.id ?? null;

  useEffect(() => {
    if (!productId) {
      setLinks([]);
      return;
    }

    let isActive = true;

    getMarketplaceLinks(productId)
      .then((list) => {
        if (isActive) {
          setLinks(list);
        }
      })
      .catch(() => {
        if (isActive) {
          setLinks([]);
        }
      });

    return () => {
      isActive = false;
    };
  }, [productId]);

  /**
   * Проверка файла модели до загрузки.
   *
   * Блок один и принимает .3mf, .gcode, .bgcode и .stl. Готовые форматы
   * сверяются с протоколами фермы: файл чужого формата не отправляем в бакет,
   * он всё равно не попадёт в очередь печати, а место занимает. STL проверять
   * нечем — его нарезают позже, поэтому такой файл проходит. Поле очищается,
   * чтобы «Сохранить» не отправило форму с файлом, который мастер уже видел
   * отклонённым.
   */
  function handleProductFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0] ?? null;

    setFileError(null);

    if (!file) {
      return;
    }

    const problem = farmFormatError(printers, file.name);

    if (problem) {
      setFileError(problem);
      event.currentTarget.value = "";
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting || isUploading) {
      return;
    }

    // FormData собираем до await: после него event.currentTarget уже обнулён.
    const formData = new FormData(event.currentTarget);
    const productFile = formData.get("productFile");

    // File в Server Action не отправляем: он весит мегабайты и упрётся в
    // лимит тела. Сначала файл идёт в /api/workshop/gcode, потом в форму
    // попадают только его публичная ссылка и модель принтера из 3MF.
    formData.delete("productFile");

    // Связи SKU нового товара: у него ещё нет id, поэтому пишет их сервер —
    // сразу после вставки карточки. Пустой список отправляем тоже, чтобы
    // действие не гадало, была ли в форме блока маркетплейсов.
    if (!isEditing) {
      formData.set("marketplaceLinks", JSON.stringify(pendingLinks));
    }

    setError(null);
    setIsSubmitting(true);

    try {
      if (productFile instanceof File && productFile.size > 0) {
        setIsUploading(true);
        setSlicedPrinter(null);

        const uploaded = await uploadProductFile(productFile);

        if (!uploaded.ok) {
          setError(uploaded.error);

          return;
        }

        formData.set("gcodeUrl", uploaded.url);

        // Модель принтера определил сервер по самому архиву. Поле уходит в
        // addProduct, а тот пишет его только для 3MF: у G-code и STL разметки
        // нет.
        formData.set("slicedForPrinter", uploaded.printerModel);
        setSlicedPrinter(uploaded.printerModel || null);
      }

      const result = isEditing
        ? await updateProduct(initial.id, formData)
        : await addProduct(formData);

      if (result.error) {
        setError(result.error);
        return;
      }

      // Сервер может вернуть только полевые ошибки без общего текста.
      const fieldError = result.fieldErrors
        ? Object.values(result.fieldErrors)[0]
        : undefined;

      if (fieldError) {
        setError(fieldError);
        return;
      }

      // Товар создан, связи записаны вместе с ним (`result.productId`):
      // черновик маркетплейсов форме больше не нужен.
      setPendingLinks([]);
      router.refresh();
      onClose();
    } catch {
      setError(
        "Не удалось отправить форму. Проверьте соединение и попробуйте ещё раз.",
      );
    } finally {
      setIsUploading(false);
      setIsSubmitting(false);
    }
  }

  /**
   * Связь SKU с этим товаром.
   *
   * Мини-форма блока маркетплейсов, а не главная форма карточки. У
   * существующего товара она пишет в `workshop_marketplace_links` сразу, не
   * дожидаясь «Сохранить», и перечитывает список с сервера — id связей нужны
   * кнопкам удаления. У нового товара id ещё нет: SKU копится в `pendingLinks`
   * и уходит в `addProduct` вместе с остальной формой.
   */
  async function saveLink() {
    if (isLinkBusy) {
      return;
    }

    const sku = linkSku.trim();

    if (!sku) {
      setLinkError("Введите SKU площадки.");
      return;
    }

    if (!productId) {
      const isDuplicate = pendingLinks.some(
        (link) =>
          link.marketplace === linkMarketplace &&
          link.sku.toLowerCase() === sku.toLowerCase(),
      );

      if (isDuplicate) {
        setLinkError(`SKU «${sku}» уже добавлен для этой площадки.`);
        return;
      }

      setPendingLinks((current) => [
        ...current,
        { marketplace: linkMarketplace, sku },
      ]);
      setLinkSku("");
      setLinkFormOpen(false);
      setLinkError(null);
      setLinkNotice("SKU добавлен. Связь сохранится вместе с товаром.");
      return;
    }

    const formData = new FormData();
    formData.set("marketplace", linkMarketplace);
    formData.set("sku", sku);
    formData.set("productId", productId);

    setLinkError(null);
    setLinkNotice(null);
    setIsLinkBusy(true);

    try {
      const result = await addMarketplaceLink(formData);

      if (!result.ok) {
        setLinkError(result.error ?? "Не удалось сохранить связь.");
        return;
      }

      setLinks(await getMarketplaceLinks(productId));
      setLinkSku("");
      setLinkFormOpen(false);
      setLinkNotice(result.message ?? "Связь сохранена.");
      router.refresh();
    } catch {
      setLinkError("Не удалось отправить форму. Попробуйте ещё раз.");
    } finally {
      setIsLinkBusy(false);
    }
  }

  /** Удаление связи: подтверждение обязательно, оно влияет на будущие заказы. */
  async function removeLink(link: MarketplaceLink) {
    if (
      deletingLinkId ||
      !window.confirm(
        `Удалить связь SKU «${link.sku}» с этим товаром? Будущие заказы с таким артикулом снова потребуют маппинга.`,
      )
    ) {
      return;
    }

    setLinkError(null);
    setLinkNotice(null);
    setDeletingLinkId(link.id);

    try {
      const result = await deleteMarketplaceLink(link.id);

      if (!result.ok) {
        setLinkError(result.error ?? "Не удалось удалить связь.");
        return;
      }

      setLinks((current) =>
        (current ?? []).filter((item) => item.id !== link.id),
      );
      setLinkNotice(result.message ?? "Связь удалена.");
      router.refresh();
    } catch {
      setLinkError("Не удалось удалить связь. Попробуйте ещё раз.");
    } finally {
      setDeletingLinkId(null);
    }
  }

  /** Снятие чернового SKU: в базе такой связи ещё нет, запрос не нужен. */
  function removePendingLink(link: MarketplaceLinkDraft) {
    setPendingLinks((current) =>
      current.filter(
        (item) => item.marketplace !== link.marketplace || item.sku !== link.sku,
      ),
    );
    setLinkError(null);
    setLinkNotice(null);
  }

  /**
   * Строки блока маркетплейсов.
   *
   * У правки это связи из базы (`links`), у нового товара — черновик формы: в
   * базе его ещё нет, поэтому и удаление локальное. Разметка у списка одна,
   * различается только источник строк.
   */
  const linkRows: MarketplaceLinkRow[] = isEditing
    ? (links ?? []).map((link) => ({
        key: link.id,
        marketplace: link.marketplace,
        sku: link.sku,
        busy: deletingLinkId === link.id,
        remove: () => void removeLink(link),
      }))
    : pendingLinks.map((link) => ({
        key: `${link.marketplace}:${link.sku}`,
        marketplace: link.marketplace,
        sku: link.sku,
        busy: false,
        remove: () => removePendingLink(link),
      }));

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      role="presentation"
      data-product-dialog-overlay
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
        aria-labelledby="product-dialog-title"
        data-product-dialog
        data-product-dialog-mode={isEditing ? "edit" : "add"}
        className="max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/10 bg-[#0a0a0a] p-6 shadow-2xl shadow-black/60 sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-blue-400 uppercase">
              Товары
            </p>
            <h2
              id="product-dialog-title"
              className="mt-3 text-2xl font-extrabold tracking-tight text-white"
            >
              {isEditing ? "Редактировать товар" : "Добавить товар"}
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-400">
              {isEditing
                ? "Поправьте карточку или замените файл: позиции в старых заказах останутся на месте, а новые возьмут обновлённые цену и файл. Поля со звёздочкой обязательны."
                : "Заполните карточку изделия. Поля со звёздочкой обязательны."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={
              isEditing
                ? "Закрыть окно редактирования товара"
                : "Закрыть окно добавления товара"
            }
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-lg text-zinc-400 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
          >
            <span aria-hidden>✕</span>
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          autoComplete="off"
          data-product-form
          className="mt-6 space-y-6"
        >
          {isEditing ? (
            // Ссылки на приложенные файлы и разметку принтера сохраняем, если
            // файл не меняли: скрытые поля формы перезапишет только ответ
            // загрузки нового файла. Без них `updateProduct` стёр бы ссылки.
            <>
              <input
                type="hidden"
                name="slicedForPrinter"
                defaultValue={initial.slicedForPrinter ?? ""}
              />
              <input
                type="hidden"
                name="modelUrl"
                defaultValue={initial.modelUrl ?? ""}
              />
              <input
                type="hidden"
                name="gcodeUrl"
                defaultValue={initial.gcodeUrl ?? ""}
              />
            </>
          ) : null}
          <fieldset>
            <legend className={legendClassName}>Основное</legend>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <TextField
                id="product-sku"
                name="sku"
                label="Артикул (SKU)"
                placeholder="VASE-001"
                required
                autoFocus
                defaultValue={initial?.sku ?? ""}
                maxLength={64}
              />
              <TextField
                id="product-name"
                name="name"
                label="Название"
                placeholder="Ваза «Спираль»"
                required
                defaultValue={initial?.title ?? ""}
                maxLength={160}
              />
              <TextareaField
                id="product-description"
                name="description"
                label="Описание"
                placeholder="Материал, особенности, что входит в комплект"
                required
                className="sm:col-span-2"
                defaultValue={initial?.description ?? ""}
                maxLength={2000}
              />
            </div>
          </fieldset>

          <fieldset>
            <legend className={legendClassName}>Цены</legend>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <NumberField
                id="product-price"
                name="price"
                label="Цена (₽)"
                placeholder="1 490"
                required
                step="0.01"
                defaultValue={initial?.price}
              />
              <NumberField
                id="product-old-price"
                name="oldPrice"
                label="Старая цена (₽)"
                placeholder="1 990"
                step="0.01"
                defaultValue={initial?.oldPrice ?? undefined}
              />
            </div>
          </fieldset>

          <fieldset>
            <legend className={legendClassName}>Габариты</legend>
            <div className="mt-3 grid grid-cols-2 gap-4 lg:grid-cols-4">
              <NumberField
                id="product-weight"
                name="weightG"
                label="Вес (г)"
                placeholder="250"
                step="1"
                defaultValue={initial?.weightG ?? undefined}
              />
              <NumberField
                id="product-length"
                name="lengthMm"
                label="Длина (мм)"
                placeholder="120"
                step="1"
                defaultValue={initial?.lengthMm ?? undefined}
              />
              <NumberField
                id="product-width"
                name="widthMm"
                label="Ширина (мм)"
                placeholder="120"
                step="1"
                defaultValue={initial?.widthMm ?? undefined}
              />
              <NumberField
                id="product-height"
                name="heightMm"
                label="Высота (мм)"
                placeholder="180"
                step="1"
                defaultValue={initial?.heightMm ?? undefined}
              />
            </div>
          </fieldset>

          <fieldset>
            <legend className={legendClassName}>{PRODUCT_FILE_LABEL}</legend>
            <div className="mt-3 space-y-4">
              <div>
                <FieldLabel htmlFor="product-file" label="Загрузить файл" />
                <input
                  id="product-file"
                  name="productFile"
                  type="file"
                  accept=".3mf,.gcode,.bgcode,.stl"
                  onChange={handleProductFileChange}
                  className={fileInputClassName}
                />
                <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                  .3mf, .gcode, .bgcode или .stl, до 50 МБ. 3MF и G-code агент
                  фермы отправит на принтер как есть, STL пригодится для нарезки.
                </p>
                {fileError ? (
                  <p
                    role="alert"
                    data-product-file-error
                    className="mt-2 text-xs leading-relaxed text-red-200"
                  >
                    <span aria-hidden>⚠️ </span>
                    {fileError}
                  </p>
                ) : null}
                {slicedPrinter ? (
                  <p
                    data-product-sliced-printer
                    className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-blue-400/40 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-100"
                  >
                    <span aria-hidden>🖨️</span>
                    Нарезан для: {slicedForPrinterLabel(slicedPrinter)}
                  </p>
                ) : null}
                {currentFile ? (
                  <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                    Текущий файл:{" "}
                    <a
                      href={currentFile}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="font-semibold text-blue-300 underline-offset-2 hover:underline"
                    >
                      {printFileExtension(currentFile)?.toUpperCase() ??
                        "открыть"}
                    </a>
                    . Новый файл заменит его.
                  </p>
                ) : null}
              </div>
            </div>
          </fieldset>

          <fieldset>
            <legend className={legendClassName}>Дополнительно</legend>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <TextField
                id="product-brand"
                name="brand"
                label="Бренд"
                placeholder="Ваша мастерская"
                defaultValue={initial?.brand ?? ""}
                maxLength={80}
              />
              <TextField
                id="product-color"
                name="color"
                label="Цвет"
                placeholder="Графит"
                defaultValue={initial?.color ?? ""}
                maxLength={80}
              />
              <TextField
                id="product-size"
                name="size"
                label="Размер"
                placeholder="M"
                defaultValue={initial?.size ?? ""}
                maxLength={80}
              />
              <TextField
                id="product-barcode"
                name="barcode"
                label="Штрихкод"
                placeholder="2000000000000"
                defaultValue={initial?.barcode ?? ""}
                maxLength={64}
              />
              <TextField
                id="product-category"
                name="category"
                label="Категория"
                placeholder="Декор"
                className="sm:col-span-2"
                defaultValue={initial?.category ?? ""}
                maxLength={80}
              />
            </div>
          </fieldset>

          <fieldset data-product-marketplace-links>
            <legend className={legendClassName}>SKU на маркетплейсах</legend>
            <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-4">
              <p className="text-xs leading-relaxed text-zinc-500">
                Заказы с этих площадок находят карточку по артикулу продавца:
                товар, файл печати и цену берём отсюда.
              </p>

              {isEditing ? null : (
                <p
                  data-product-links-pending-hint
                  className="mt-2 text-xs leading-relaxed text-blue-200"
                >
                  Связи запишутся вместе с товаром: заполните их до сохранения
                  карточки.
                </p>
              )}

              {isEditing && links === null ? (
                <p
                  data-product-links-loading
                  className="mt-3 text-xs text-zinc-500"
                >
                  Читаем связи…
                </p>
              ) : linkRows.length === 0 ? (
                <p className="mt-3 text-xs leading-relaxed text-zinc-400">
                  Связей пока нет. Добавьте SKU, если изделие продаётся на
                  Ozon, Wildberries или Яндекс Маркете.
                </p>
              ) : (
                <ul data-product-links className="mt-3 space-y-2">
                  {linkRows.map((row) => {
                    const meta = MARKETPLACE_META[row.marketplace];

                    return (
                      <li
                        key={row.key}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${meta.badgeClassName}`}
                          >
                            {meta.label}
                          </span>
                          <span className="truncate font-mono text-xs font-semibold text-blue-200">
                            {row.sku}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={row.remove}
                          disabled={row.busy}
                          aria-label={`Удалить связь SKU «${row.sku}»`}
                          aria-busy={row.busy}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-zinc-400 transition-colors hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {linkFormOpen ? (
                <div className="mt-3 space-y-3 rounded-xl border border-white/10 bg-black/40 p-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-sm font-semibold text-slate-200">
                      <span>Площадка</span>
                      <select
                        value={linkMarketplace}
                        onChange={(event) =>
                          setLinkMarketplace(
                            event.currentTarget.value as Marketplace,
                          )
                        }
                        aria-label="Площадка"
                        className={inputClassName}
                      >
                        {MARKETPLACES.map((marketplace) => (
                          <option key={marketplace} value={marketplace}>
                            {MARKETPLACE_META[marketplace].label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block text-sm font-semibold text-slate-200">
                      <span>SKU площадки</span>
                      <input
                        type="text"
                        value={linkSku}
                        onChange={(event) =>
                          setLinkSku(event.currentTarget.value)
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void saveLink();
                          }
                        }}
                        maxLength={MARKETPLACE_LINK_LIMITS.sku}
                        placeholder="OZON-123456789"
                        spellCheck={false}
                        autoComplete="off"
                        aria-label="SKU площадки"
                        className={`${inputClassName} font-mono`}
                      />
                    </label>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void saveLink()}
                      disabled={isLinkBusy || !linkSku.trim()}
                      aria-busy={isLinkBusy}
                      className="inline-flex min-h-10 items-center justify-center rounded-xl bg-white px-4 text-sm font-bold text-black transition-colors hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isLinkBusy ? "Добавляем…" : "Добавить"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setLinkFormOpen(false);
                        setLinkSku("");
                        setLinkError(null);
                      }}
                      className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm font-semibold text-zinc-200 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setLinkFormOpen(true);
                    setLinkNotice(null);
                    setLinkError(null);
                  }}
                  className="mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 text-sm font-semibold text-white transition-colors hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
                >
                  <span aria-hidden>+</span>
                  Добавить SKU
                </button>
              )}

              {linkNotice ? (
                <p
                  role="status"
                  data-product-link-notice
                  className="mt-3 text-xs leading-relaxed text-emerald-300"
                >
                  {linkNotice}
                </p>
              ) : null}

              {linkError ? (
                <p
                  role="alert"
                  data-product-link-error
                  className="mt-3 text-xs leading-relaxed text-red-200"
                >
                  <span aria-hidden>⚠️ </span>
                  {linkError}
                </p>
              ) : null}
            </div>
          </fieldset>

          {error ? (
            <p
              role="alert"
              data-product-error
              className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm leading-relaxed text-red-100"
            >
              <span aria-hidden>⚠️ </span>
              {error}
            </p>
          ) : null}

          <div className="flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row">
            <button
              type="submit"
              disabled={isSubmitting || isUploading}
              aria-busy={isSubmitting || isUploading}
              className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-white px-6 text-sm font-bold text-black shadow-[0_10px_30px_-12px_rgba(255,255,255,0.35)] transition-colors hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isUploading
                ? "Загрузка файла..."
                : isSubmitting
                  ? "Сохранение..."
                  : "Сохранить"}
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
    </div>,
    document.body,
  );
}

/** Подпись поля: звёздочка обязательного поля не попадает в озвучку. */
function FieldLabel({
  htmlFor,
  label,
  required,
}: {
  htmlFor: string;
  label: string;
  required?: boolean;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-sm font-semibold text-slate-200"
    >
      {label}
      {required ? (
        <span aria-hidden className="ml-0.5 text-blue-300">
          {" "}
          *
        </span>
      ) : null}
    </label>
  );
}

/** Обычное текстовое поле с тёмной поверхностью и autoComplete off. */
function TextField({
  id,
  name,
  label,
  placeholder,
  required,
  autoFocus,
  defaultValue,
  maxLength,
  className,
}: {
  id: string;
  name: string;
  label: string;
  placeholder: string;
  required?: boolean;
  autoFocus?: boolean;
  /** Значение для правки: у нового товара поля пустые. */
  defaultValue?: string;
  maxLength: number;
  className?: string;
}) {
  return (
    <div className={className}>
      <FieldLabel htmlFor={id} label={label} required={required} />
      <input
        id={id}
        name={name}
        type="text"
        autoComplete="off"
        autoFocus={autoFocus}
        spellCheck={false}
        placeholder={placeholder}
        defaultValue={defaultValue}
        maxLength={maxLength}
        required={required}
        className={inputClassName}
      />
    </div>
  );
}

/** Многострочное описание: та же поверхность, но с ручным resize. */
function TextareaField({
  id,
  name,
  label,
  placeholder,
  required,
  defaultValue,
  maxLength,
  className,
}: {
  id: string;
  name: string;
  label: string;
  placeholder: string;
  required?: boolean;
  /** Значение для правки: у нового товара поле пустое. */
  defaultValue?: string;
  maxLength: number;
  className?: string;
}) {
  return (
    <div className={className}>
      <FieldLabel htmlFor={id} label={label} required={required} />
      <textarea
        id={id}
        name={name}
        autoComplete="off"
        rows={3}
        placeholder={placeholder}
        defaultValue={defaultValue}
        maxLength={maxLength}
        required={required}
        className={`${inputClassName} min-h-24 resize-y`}
      />
    </div>
  );
}

/** Числовое поле: без спиннеров, с десятичной клавиатурой на мобильном. */
function NumberField({
  id,
  name,
  label,
  placeholder,
  required,
  step,
  defaultValue,
}: {
  id: string;
  name: string;
  label: string;
  placeholder: string;
  required?: boolean;
  step: string;
  /** Значение для правки: у нового товара поле пустое. */
  defaultValue?: number;
}) {
  return (
    <div>
      <FieldLabel htmlFor={id} label={label} required={required} />
      <input
        id={id}
        name={name}
        type="number"
        inputMode="decimal"
        autoComplete="off"
        min="0"
        step={step}
        placeholder={placeholder}
        defaultValue={defaultValue}
        required={required}
        className={inputClassName}
      />
    </div>
  );
}