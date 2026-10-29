/**
 * Состояние форм принтеров для useActionState и ответов кнопок обслуживания.
 *
 * Как и у склада, ошибок может быть много по полям (форма добавления) или
 * ровно одна (сброс счётчика), поэтому два типа, а не один с необязательными
 * полями.
 */
import type {
  DiscoveredPrinter,
  PrinterFormErrors,
} from "@/lib/workshop/printers";

export type PrinterFormState = {
  /** Общая ошибка формы: сессия, подписка, база. */
  error?: string;
  /** Ошибки конкретных полей — показываются под полем. */
  fieldErrors?: PrinterFormErrors;
  /** Принтер добавлен: можно закрыть окно и обновить список. */
  success?: boolean;
  /** Что показать после успеха: «Bambu Lab P1S добавлен.» */
  message?: string;
};

/** Ответ кнопки «Заменить сопло» / «Смазать оси». */
export type PrinterActionState = {
  ok: boolean;
  message?: string;
  error?: string;
};

/**
 * Ответ подтверждения найденных принтеров: мастер выбрал, что перенести в парк.
 *
 * `added` и `skipped` нужны, чтобы интерфейс сказал «добавлено 12, пропущено 1»
 * вместо безликого «готово»: пропуск — это принтер без имени, дубль адреса или
 * принтер, который уже стоит в парке. `ok: true` при `added: 0` — нормальный
 * результат: все найденные уже были добавлены раньше.
 */
export type DiscoveredPrintersState = {
  ok: boolean;
  added?: number;
  skipped?: number;
  message?: string;
  error?: string;
};

/**
 * Ответ кнопки «Найти принтеры в сети»: просьба просканировать сеть поставлена.
 *
 * Подтверждения «сканирование началось» здесь нет и быть не может: агент узнает
 * о просьбе на ближайшем опросе (раз в пять секунд), а обход сети занимает
 * секунды. Поэтому `ok: true` — это «флаг поднят, ждём находок», а не «принтеры
 * уже найдены».
 */
export type NetworkScanRequestState = {
  ok: boolean;
  error?: string;
};

/**
 * Ответ опроса находок агента, пока мастер подключения ждёт сканирование.
 *
 * `printers` — те же строки, что читает страница (`getDiscoveredPrinters()`, тот
 * же порядок и та же фильтрация статуса): окно спрашивает их раз в три секунды,
 * пока список пуст. `ok: false` — сессия, подписка или база; опрос после такой
 * ошибки прекращается, иначе окно молча крутило бы лоадер над нерабочей базой.
 */
export type DiscoveredPrinterListState = {
  ok: boolean;
  printers?: DiscoveredPrinter[];
  /** В базе нет таблицы workshop_discovered_printers — миграция не применена. */
  isMissingTable?: boolean;
  error?: string;
};

export const emptyPrinterFormState: PrinterFormState = {};
