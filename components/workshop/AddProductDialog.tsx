"use client";

import { useRouter } from "next/navigation";
import { type ChangeEvent, type FormEvent, useState } from "react";
import { createPortal } from "react-dom";

import { addProduct, updateProduct } from "@/app/actions/products";
import { useDialogDismiss } from "@/components/workshop/use-dialog-dismiss";
import {
  PRINT_FILE_LABEL,
  SOURCE_MODEL_FILE_LABEL,
  isSourceModelFile,
  printFileExtension,
  type ProductFileKind,
} from "@/lib/3d/print-compatibility";
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
   * текущими значениями, а «Сохранить» вызывает `updateProduct`. Файлы можно
   * заменить, не трогая остальное: исходник и файл печати уходят в
   * `/api/workshop/gcode` отдельными запросами со своим `kind` и подменяют
   * ссылки по отдельности — разметку принтера несёт только файл печати.
   */
  initial?: WorkshopProduct | null;
  /**
   * Принтеры фермы: по их протоколам окно проверяет формат файла печати.
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

/** Вид выбора файла — один для исходника модели и файла печати. */
const fileInputClassName =
  "mt-2 block w-full cursor-pointer rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-zinc-300 file:mr-4 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30";

/** Результат загрузки файла: ссылка с разметкой принтера или готовый текст отказа. */
type UploadOutcome =
  | { ok: true; url: string; printerModel: string }
  | { ok: false; error: string };

/**
 * Отправка файла товара в `/api/workshop/gcode`.
 *
 * File в Server Action не отправляем: он весит мегабайты и упрётся в лимит
 * тела. Файл идёт в роут, а в форму попадает только публичная ссылка. `kind`
 * объясняет роуту, что загружают: `model` — исходник STL в папку models,
 * `print` — нарезанный файл в папку print. Роут проверяет расширения сам, но
 * форму он не охраняет — предварительные проверки остаются в обработчиках
 * выбора файла.
 */
async function uploadProductFile(
  file: File,
  kind: ProductFileKind,
): Promise<UploadOutcome> {
  const uploadForm = new FormData();
  uploadForm.set("file", file);
  uploadForm.set("kind", kind);

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
            : kind === "model"
              ? "Не удалось загрузить исходник. Попробуйте ещё раз."
              : "Не удалось загрузить файл печати. Попробуйте ещё раз.",
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
 * STL здесь не проверяется: это исходник для слайсера, а не задание печати.
 * Блок «Файл для печати» отклоняет его раньше — своя подсказка понятнее, чем
 * «файл не подходит ни одному протоколу фермы».
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
  /** Причина, по которой выбранный файл не напечатает ни один принтер фермы. */
  const [fileError, setFileError] = useState<string | null>(null);
  /** Отказ блоку «Исходник (STL)»: здесь принимается только STL. */
  const [modelFileError, setModelFileError] = useState<string | null>(null);
  /** Модель принтера из метаданных 3MF: её показали после загрузки. */
  const [slicedPrinter, setSlicedPrinter] = useState<string | null>(
    initial?.slicedForPrinter ?? null,
  );

  const isEditing = initial !== null;

  useDialogDismiss(onClose);

  /**
   * Проверка файла печати до загрузки.
   *
   * STL — исходник модели, а не задание печати: он отклоняется сразу, с
   * подсказкой, в какой блок его загрузить. Остальные форматы сверяются с
   * протоколами фермы: файл чужого формата не отправляем в бакет, он всё равно
   * не попадёт в очередь печати, а место занимает. Поле очищается, чтобы
   * «Сохранить» не отправило форму с файлом, который мастер уже видел
   * отклонённым.
   */
  function handlePrintFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0] ?? null;

    setFileError(null);

    if (!file) {
      return;
    }

    const problem = isSourceModelFile(file.name)
      ? "STL — исходник. Загрузите его в «Исходник (STL)»."
      : farmFormatError(printers, file.name);

    if (problem) {
      setFileError(problem);
      event.currentTarget.value = "";
    }
  }

  /**
   * Проверка исходника модели до загрузки.
   *
   * В этом блоке принимается только STL: исходник нужен калькулятору и
   * повторной нарезке. Нарезанный файл, выбранный здесь, отклоняется —
   * подсказка ведёт в блок печати, чтобы мастер не искал причину сам.
   */
  function handleModelFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0] ?? null;

    setModelFileError(null);

    if (!file || isSourceModelFile(file.name)) {
      return;
    }

    setModelFileError(
      "Исходник — файл .stl. Файл для печати загрузите в блок «Файл для печати (3MF/GCode)».",
    );
    event.currentTarget.value = "";
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting || isUploading) {
      return;
    }

    // FormData собираем до await: после него event.currentTarget уже обнулён.
    const formData = new FormData(event.currentTarget);
    const modelFile = formData.get("modelFile");
    const printFile = formData.get("gcodeFile");

    // File в Server Action не отправляем: он весит мегабайты и упрётся в
    // лимит тела. Сначала файлы идут в /api/workshop/gcode со своим kind,
    // потом в форму попадают только их публичные ссылки и модель принтера
    // из 3MF.
    formData.delete("modelFile");
    formData.delete("gcodeFile");

    setError(null);
    setIsSubmitting(true);

    try {
      if (modelFile instanceof File && modelFile.size > 0) {
        setIsUploading(true);

        const uploaded = await uploadProductFile(modelFile, "model");

        if (!uploaded.ok) {
          setError(uploaded.error);

          return;
        }

        // Исходник не размечен принтером: `slicedForPrinter` относится только
        // к файлу печати, поэтому здесь он не трогается.
        formData.set("modelUrl", uploaded.url);
      }

      if (printFile instanceof File && printFile.size > 0) {
        setIsUploading(true);
        setSlicedPrinter(null);

        const uploaded = await uploadProductFile(printFile, "print");

        if (!uploaded.ok) {
          setError(uploaded.error);

          return;
        }

        formData.set("gcodeUrl", uploaded.url);

        // Модель принтера определил сервер по самому архиву. Поле уходит в
        // addProduct, а тот пишет его только для 3MF: у G-code разметки нет.
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
                ? "Поправьте карточку или замените файлы: позиции в старых заказах останутся на месте, а новые возьмут обновлённые цену и файл печати. Поля со звёздочкой обязательны."
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
            // Разметку принтера сохраняем, если файл не меняли: поле формы
            // перезапишется ответом загрузки только при выборе нового файла.
            <input
              type="hidden"
              name="slicedForPrinter"
              defaultValue={initial.slicedForPrinter ?? ""}
            />
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
            <legend className={legendClassName}>
              {SOURCE_MODEL_FILE_LABEL}
            </legend>
            <div className="mt-3 space-y-4">
              <div>
                <FieldLabel
                  htmlFor="product-model-url"
                  label="Ссылка на исходник"
                />
                <input
                  id="product-model-url"
                  name="modelUrl"
                  type="url"
                  inputMode="url"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="https://…/vase.stl"
                  maxLength={2048}
                  defaultValue={initial?.modelUrl ?? ""}
                  className={inputClassName}
                />
                <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                  Исходная модель: нужна калькулятору. В очередь печати не
                  ставится. Можно вставить публичную ссылку или выбрать файл
                  ниже — файл заменит ссылку.
                </p>
              </div>

              <div>
                <FieldLabel
                  htmlFor="product-model-file"
                  label="Загрузить исходник"
                />
                <input
                  id="product-model-file"
                  name="modelFile"
                  type="file"
                  accept=".stl"
                  onChange={handleModelFileChange}
                  className={fileInputClassName}
                />
                <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                  Только .stl, до 50 МБ. Исходная модель: нужна калькулятору. В
                  очередь печати не ставится.
                </p>
                {modelFileError ? (
                  <p
                    role="alert"
                    data-product-model-error
                    className="mt-2 text-xs leading-relaxed text-red-200"
                  >
                    <span aria-hidden>⚠️ </span>
                    {modelFileError}
                  </p>
                ) : null}
              </div>
            </div>
          </fieldset>

          <fieldset>
            <legend className={legendClassName}>{PRINT_FILE_LABEL}</legend>
            <div className="mt-3 space-y-4">
              <div>
                <FieldLabel
                  htmlFor="product-gcode-url"
                  label="Ссылка на файл печати"
                />
                <input
                  id="product-gcode-url"
                  name="gcodeUrl"
                  type="url"
                  inputMode="url"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="https://…/vase.3mf"
                  maxLength={2048}
                  defaultValue={initial?.gcodeUrl ?? ""}
                  className={inputClassName}
                />
                <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                  Можно вставить публичную ссылку или выбрать файл ниже. Файл
                  заменит ссылку.
                </p>
              </div>

              <div>
                <FieldLabel
                  htmlFor="product-gcode-file"
                  label="Загрузить файл для печати"
                />
                <input
                  id="product-gcode-file"
                  name="gcodeFile"
                  type="file"
                  accept=".gcode,.gco,.g,.3mf"
                  onChange={handlePrintFileChange}
                  className={fileInputClassName}
                />
                <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                  .gcode, .gco, .g или .3mf, до 50 МБ. Нарежьте модель в
                  слайсере: этот файл агент фермы отправит на принтер как есть.
                  STL — исходник, его загружают в блок выше.
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
                    Нарезан для: {slicedPrinter}
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
  defaultValue,
  maxLength,
  className,
}: {
  id: string;
  name: string;
  label: string;
  placeholder: string;
  /** Значение для правки: у нового товара поле пустое. */
  defaultValue?: string;
  maxLength: number;
  className?: string;
}) {
  return (
    <div className={className}>
      <FieldLabel htmlFor={id} label={label} />
      <textarea
        id={id}
        name={name}
        autoComplete="off"
        rows={3}
        placeholder={placeholder}
        defaultValue={defaultValue}
        maxLength={maxLength}
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