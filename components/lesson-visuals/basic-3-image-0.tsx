import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Строки списка настроек в левой панели — декоративные полоски, не текст. */
const settingRows = [50, 62, 74, 86, 98];

/** Слои в предпросмотре: пять горизонтальных линий. */
const previewLayers = [140, 146, 152, 158];

/**
 * Интерфейс слайсера — схема окна из четырёх зон.
 *
 * Не скриншот, а разбор интерфейса: сами зоны подписаны цифрами, и по ним видно
 * порядок работы — настройки слева, модель на столе в центре, кнопка «Нарезать»
 * справа, предпросмотр слоёв внизу (ровно так, как сказано в content урока).
 *
 * От похожих «экранных» блоков отличается тем, что это схема зон с цифрами, а не
 * заполненная панель параметров (урок 9) и не плита с моделью брелока (урок 12).
 */
export function Basic3Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Схема интерфейса Orca Slicer: слева панель настроек, в центре модель на столе, справа кнопка «Нарезать», внизу предпросмотр слоёв"
      animated={animated}
    >
      <svg
        viewBox="0 0 320 180"
        className="w-full h-full"
        aria-hidden="true"
        fontFamily={FONT}
      >
        <rect
          x="0.5"
          y="0.5"
          width="319"
          height="179"
          rx="12"
          fill="#1e293b"
          fillOpacity="0.5"
          stroke="#475569"
        />

        {/* Окно слайсера */}
        <rect
          x="14"
          y="14"
          width="292"
          height="152"
          rx="8"
          fill="#0f172a"
          stroke="#475569"
        />
        <line x1="14" y1="34" x2="306" y2="34" stroke="#475569" />
        {[24, 34, 44].map((x) => (
          <circle key={x} cx={x} cy="24" r="3" fill="#64748b" />
        ))}
        <text x="56" y="24" fontSize="10" fill="#94a3b8" dominantBaseline="middle">
          Orca Slicer
        </text>

        {/* Зона 1: настройки слева */}
        <rect x="22" y="42" width="78" height="88" rx="4" fill="#1e293b" stroke="#334155" />
        {settingRows.map((y) => (
          <rect key={y} x="30" y={y} width="62" height="6" rx="3" fill="#334155" />
        ))}
        <text x="30" y="120" fontSize="10" fill="#e2e8f0" dominantBaseline="middle">
          1 Настройки
        </text>

        {/* Зона 2: модель на столе, в центре */}
        <polygon points="140,64 152,54 188,54 176,64" fill="#1e293b" stroke="#475569" />
        <polygon points="176,64 188,54 188,82 176,92" fill="#1e293b" stroke="#475569" />
        <rect x="140" y="64" width="36" height="28" fill="#334155" stroke="#475569" />
        <rect x="108" y="92" width="104" height="10" rx="2" fill="#1e3a5f" stroke="#3b82f6" />
        <text x="108" y="120" fontSize="10" fill="#e2e8f0" dominantBaseline="middle">
          2 Модель на столе
        </text>

        {/* Зона 3: кнопка запуска нарезки (подпись рядом, не на заливке) */}
        <rect x="222" y="48" width="76" height="24" rx="12" fill="#3b82f6" />
        <polygon points="254,54 254,66 264,60" fill="#f8fafc" />
        <text x="222" y="88" fontSize="10" fill="#e2e8f0" dominantBaseline="middle">
          3 Нарезать
        </text>

        {/* Зона 4: предпросмотр слоёв */}
        <rect x="22" y="136" width="276" height="26" rx="4" fill="#1e293b" stroke="#334155" />
        <text x="30" y="149" fontSize="10" fill="#e2e8f0" dominantBaseline="middle">
          4 Предпросмотр
        </text>
        {previewLayers.map((y, index) => (
          <line
            key={y}
            x1="148"
            y1={y}
            x2="290"
            y2={y}
            stroke={index === 0 ? "#3b82f6" : "#334155"}
            strokeWidth="2"
          />
        ))}
      </svg>
    </VisualWrapper>
  );
}
