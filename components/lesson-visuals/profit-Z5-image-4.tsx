import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Кадр блока 23 урока Z5 «Фото, маркетинг, продвижение».
 *
 * Макет из описания `Z5_marketplaces.png`: маркетплейс против продажи файлов.
 * Числа из блока 23: на площадке ты печатаешь сам, платишь комиссию и делаешь
 * партию из 12 заказов; в файлах печатает покупатель, автору достаётся до 80 %,
 * один файл может дать сто продаж, а на старт хватает 1–2 моделей. Внизу —
 * три условия: свои модели, лицензия и три связанные модели.
 */
export function ProfitZ5Image4({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Две дороги продаж. Маркетплейс: Ozon и WB, ты печатаешь сам, платишь комиссию площадки, печать и упаковка на тебе, 12 заказов складываются в партию. Файлы: Cults3D и Printables, печатает покупатель, автору до 80 процентов, один файл может дать 100 продаж, на старт хватает 1–2 моделей. Свои модели, лицензия и три связанные модели"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="11" fontWeight="700" fill="#e2e8f0">
          две дороги продаж
        </text>
        <text x="12" y="29" fontSize="10" fill="#94a3b8">
          маркетплейс или файлы
        </text>

        <rect x="10" y="38" width="146" height="108" rx="7" fill="#0f172a" stroke="#334155" />
        <rect x="10" y="38" width="146" height="3" rx="1.5" fill="#3b82f6" />
        <rect x="138" y="47" width="10" height="10" rx="1.5" fill="#3b82f6" fillOpacity="0.18" stroke="#60a5fa" />
        <path d="M138 50 H148" stroke="#60a5fa" strokeWidth="0.8" />
        <text x="18" y="54" fontSize="11" fontWeight="700" fill="#60a5fa">
          маркетплейс
        </text>
        <text x="18" y="68" fontSize="10" fill="#94a3b8">
          Ozon · WB
        </text>
        <path d="M18 74 H148" stroke="#334155" strokeWidth="0.8" />
        <text x="18" y="84" fontSize="10" fill="#e2e8f0">
          ты печатаешь
        </text>
        <text x="18" y="98" fontSize="10" fill="#cbd5e1">
          комиссия площадки
        </text>
        <text x="18" y="112" fontSize="10" fill="#cbd5e1">
          печать · упаковка
        </text>
        <text x="18" y="128" fontSize="10" fontWeight="700" fill="#fbbf24">
          12 заказов = партия
        </text>

        <rect x="164" y="38" width="146" height="108" rx="7" fill="#0f172a" stroke="#334155" />
        <rect x="164" y="38" width="146" height="3" rx="1.5" fill="#10b981" />
        <path d="M292 47 H300 L304 51 V59 H292 Z" fill="#10b981" fillOpacity="0.16" stroke="#34d399" />
        <path d="M300 47 V51 H304" fill="none" stroke="#34d399" strokeWidth="0.8" />
        <text x="172" y="54" fontSize="11" fontWeight="700" fill="#34d399">
          файлы
        </text>
        <text x="172" y="68" fontSize="10" fill="#94a3b8">
          Cults3D · Printables
        </text>
        <path d="M172 74 H302" stroke="#334155" strokeWidth="0.8" />
        <text x="172" y="84" fontSize="10" fill="#e2e8f0">
          печатает покупатель
        </text>
        <text x="172" y="104" fontSize="16" fontWeight="700" fill="#34d399">
          до 80 % автору
        </text>
        <text x="172" y="122" fontSize="10" fill="#cbd5e1">
          1 файл → 100 продаж
        </text>
        <text x="172" y="138" fontSize="10" fill="#cbd5e1">
          1–2 модели на старт
        </text>

        <circle cx="160" cy="92" r="9" fill="#1e293b" stroke="#475569" />
        <text x="160" y="95" fontSize="10" fill="#94a3b8" textAnchor="middle">
          или
        </text>

        <rect x="12" y="148" width="296" height="18" rx="4" fill="#0f172a" stroke="#334155" />
        <text x="160" y="160.5" fontSize="10" fontWeight="700" fill="#e2e8f0" textAnchor="middle">
          свои модели · лицензия · 3 связанные модели
        </text>

        <text x="160" y="175" fontSize="10" fill="#94a3b8" textAnchor="middle">
          выбери одну дорогу
        </text>
      </svg>
    </VisualWrapper>
  );
}
