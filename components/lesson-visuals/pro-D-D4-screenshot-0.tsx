import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Плагины в списке окна: подпись, координата строки и включён ли он. */
const PLUGINS = [
  { y: 71, label: "M600 на высоте 10", on: true },
  { y: 93, label: "Pause at height", on: false },
  { y: 115, label: "Color change", on: false },
];

/**
 * Пост-обработка в Orca: слева контур детали без слоёв, на нём одна метка
 * Z = 10 мм со значком паузы, справа окно Post-processing со списком трёх
 * плагинов — включён «M600 на высоте 10», рядом кнопка «+».
 *
 * Ровно по content урока: «Скриншот: вкладка Post-processing. Добавлена команда
 * M600 на высоте 10 мм» и по совету «для смены цвета без AMS используй M600».
 *
 * От «Variable Layer Height» (G-G1-screenshot, разрез по Z со слоями и метками
 * 0,1–0,3 и панель Layer height) и от «Модификаторов» (H-H3-screenshot, деталь в
 * разрезе с цилиндром) отличается предметом: здесь контур детали без слоёв и
 * одна метка высоты, а справа таблица плагинов с переключателями, а не параметры
 * слоя.
 */
export function ProDD4Screenshot0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Пост-обработка в Orca: слева контур детали без слоёв с одной меткой Z десять миллиметров и значком паузы на этом уровне, справа окно Post-processing со списком трёх плагинов — включён M600 на высоте 10, рядом выключенные Pause at height и Color change и кнопка плюс"
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

        <text x="12" y="14" fontSize="10" fill="#94a3b8">
          M600 на высоте 10 мм: пауза для смены
        </text>

        {/* Деталь контуром: ни слоёв, ни столбика высот */}
        <rect x="30" y="40" width="90" height="96" fill="none" stroke="#64748b" strokeWidth="1.6" />

        {/* Метка высоты 10 мм и значок паузы на этом уровне */}
        <line
          x1="30"
          y1="100"
          x2="120"
          y2="100"
          stroke="#fbbf24"
          strokeWidth="1.4"
          strokeDasharray="4 3"
        />
        <rect x="64" y="94" width="3.5" height="12" fill="#fbbf24" />
        <rect x="71" y="94" width="3.5" height="12" fill="#fbbf24" />
        <text x="126" y="100" fontSize="9" fill="#fbbf24">
          10 мм
        </text>

        {/* Окно Post-processing: список плагинов и кнопка добавления */}
        <rect x="152" y="26" width="158" height="100" rx="6" fill="#0f172a" stroke="#475569" />
        <rect x="153" y="27" width="156" height="9" fill="#334155" />
        <text x="160" y="52" fontSize="8" fill="#93c5fd">
          Post-processing
        </text>
        <circle cx="296" cy="48" r="8" fill="#1e293b" stroke="#34d399" />
        <line x1="292" y1="48" x2="300" y2="48" stroke="#34d399" />
        <line x1="296" y1="44" x2="296" y2="52" stroke="#34d399" />

        {PLUGINS.map((plugin) => (
          <g key={plugin.label}>
            <rect x="158" y={plugin.y - 11} width="144" height="16" fill="#1e293b" />
            <text x="166" y={plugin.y} fontSize="7.5" fill={plugin.on ? "#e2e8f0" : "#94a3b8"}>
              {plugin.label}
            </text>
            <rect
              x="284"
              y={plugin.y - 5}
              width="12"
              height="6"
              rx="3"
              fill={plugin.on ? "#34d399" : "#475569"}
            />
          </g>
        ))}

        <text x="152" y="146" fontSize="9" fill="#94a3b8">
          включён M600 — пауза на 10 мм
        </text>
        <text x="12" y="152" fontSize="9" fill="#94a3b8">
          на высоте 10 мм
        </text>
        <text x="12" y="170" fontSize="9" fill="#94a3b8">
          пауза между слоями
        </text>
      </svg>
    </VisualWrapper>
  );
}
