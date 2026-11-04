import { DownloadIcon } from "@/components/workshop/WorkshopIcons";

/**
 * Кнопка «Скачать TriDiAgent.exe» — общая для шапки Мастерской, онбординга и
 * страницы помощи.
 *
 * Адрес фиксированный: `/downloads/TriDiAgent.exe`. Сам бинарник в репозитории
 * не лежит (exe на десятки мегабайт собирает `agent/build_exe.py`), поэтому
 * файл кладут в `public/downloads/` при деплое — что делать и как проверить,
 * написано в `public/downloads/README.md`. Пока файла нет, ссылка ведёт на 404:
 * это честный слот под сборку, а не битая кнопка с другим адресом.
 *
 * Подсказка «Windows, ~11 МБ, без установки Python» — часть ссылки, а не
 * отдельный абзац: так она попадает и в озвучку скринридером, и в подсказку при
 * наведении, и не разъезжается с кнопкой в узких колонках.
 */
export const AGENT_DOWNLOAD_URL = "/downloads/TriDiAgent.exe";

type AgentDownloadButtonProps = {
  /** `primary` — белая кнопка на тёмной карточке, `secondary` — рамка. */
  tone?: "primary" | "secondary";
  /** Показать строку про Windows, размер и отсутствие Python. */
  showHint?: boolean;
  className?: string;
};

const TONE_CLASSES = {
  primary:
    "border border-transparent bg-white text-black shadow-[0_10px_30px_-12px_rgba(255,255,255,0.35)] hover:bg-zinc-200",
  secondary:
    "border border-white/15 bg-white/[0.04] text-zinc-200 hover:border-white/30 hover:bg-white/10 hover:text-white",
} as const;

/** Ссылка на exe: атрибут `download` сохраняет файл, а не открывает вкладку. */
export function AgentDownloadButton({
  tone = "secondary",
  showHint = false,
  className = "",
}: AgentDownloadButtonProps) {
  return (
    <a
      href={AGENT_DOWNLOAD_URL}
      download
      data-agent-download
      className={`inline-flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl px-4 py-2 text-center text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030303] ${TONE_CLASSES[tone]} ${className}`}
    >
      <span className="inline-flex items-center gap-2 whitespace-nowrap">
        <DownloadIcon className="h-4 w-4 shrink-0" />
        Скачать TriDiAgent.exe
      </span>
      {showHint ? (
        <span
          className={`whitespace-nowrap text-xs font-normal ${
            tone === "primary" ? "text-black/60" : "text-zinc-400"
          }`}
        >
          Windows, ~11 МБ, без установки Python
        </span>
      ) : null}
    </a>
  );
}
