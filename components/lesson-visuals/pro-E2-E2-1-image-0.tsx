import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Специальные материалы из content урока: «PVA — растворяется в воде. HIPS — в
 * лимонене. TPU 85A/95A — гибкие. PA-CF, PETG-CF — с углеродным волокном.
 * Каждый для своих задач» и список применений из урока.
 *
 * Шесть материалов сгруппированы по задаче, а не выстроены в ряд: катушек и ванн
 * в кадре нет вовсе (ряд катушек с карточками — E1-1, катушки и ванны
 * растворения — H2‑1), поэтому каждая группа показывает свою задачу:
 * слева деталь с уже опустевшим каналом поддержки и две среды (вода и лимонен),
 * в середине образец-кольцо гибкого пластика с цифрами Shore, справа микро-врезка
 * нити с волокнами и сопло, которое эти волокна истирают.
 */
const FIBERS = [
  { x1: 232, y1: 78, x2: 248, y2: 62 },
  { x1: 240, y1: 84, x2: 256, y2: 68 },
  { x1: 252, y1: 80, x2: 260, y2: 72 },
  { x1: 234, y1: 64, x2: 240, y2: 58 },
];

/** «Три задачи — три материала»: растворимые, гибкие, композитные. */
export function ProE2E21Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Специальные материалы по задачам: растворимые — деталь с опустевшим каналом поддержки, PVA уходит в воде, HIPS в лимонене; гибкие — образец-кольцо TPU 85A и 95A с твёрдостью по Шору; композитные — в нити PA-CF и PETG-CF видны волокна, которые истирают сопло"
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
          Специальные материалы: три задачи
        </text>

        {/* Разделители групп — три задачи вместо ряда материалов */}
        <line x1="110" y1="26" x2="110" y2="144" stroke="#475569" />
        <line x1="210" y1="26" x2="210" y2="144" stroke="#475569" />

        {/* Группа 1: растворимые — канал поддержки уже пуст */}
        <text x="60" y="34" fontSize="8.5" fill="#e2e8f0" textAnchor="middle">
          растворимые
        </text>
        <rect x="24" y="46" width="72" height="42" rx="3" fill="#334155" stroke="#475569" />
        <rect
          x="40"
          y="58"
          width="40"
          height="12"
          rx="2"
          fill="#0f172a"
          stroke="#64748b"
          strokeDasharray="3 2"
        />
        <circle cx="32" cy="104" r="4" fill="#38bdf8" />
        <polygon points="27,102 37,102 32,94" fill="#38bdf8" />
        <text x="42" y="107" fontSize="7.5" fill="#e2e8f0">
          PVA · вода
        </text>
        <circle cx="32" cy="126" r="4" fill="#a3e635" />
        <polygon points="27,124 37,124 32,116" fill="#a3e635" />
        <text x="42" y="129" fontSize="7.5" fill="#e2e8f0">
          HIPS · лимонен
        </text>

        {/* Группа 2: гибкие — кольцо сжато, твёрдость по Шору */}
        <text x="160" y="34" fontSize="8.5" fill="#e2e8f0" textAnchor="middle">
          гибкие
        </text>
        <circle
          cx="160"
          cy="70"
          r="26"
          fill="none"
          stroke="#64748b"
          strokeDasharray="4 3"
        />
        <circle cx="160" cy="70" r="20" fill="none" stroke="#a78bfa" strokeWidth="7" />
        <text x="160" y="112" fontSize="8" fill="#e2e8f0" textAnchor="middle">
          TPU 95A · Shore 95
        </text>
        <text x="160" y="126" fontSize="8" fill="#94a3b8" textAnchor="middle">
          TPU 85A · Shore 85
        </text>

        {/* Группа 3: композитные — волокна в нити и износ сопла */}
        <text x="260" y="34" fontSize="8.5" fill="#e2e8f0" textAnchor="middle">
          композитные
        </text>
        <circle cx="244" cy="68" r="20" fill="#0f172a" stroke="#64748b" />
        {FIBERS.map((fiber) => (
          <line
            key={`fiber-${fiber.x1}-${fiber.y1}`}
            x1={fiber.x1}
            y1={fiber.y1}
            x2={fiber.x2}
            y2={fiber.y2}
            stroke="#fbbf24"
            strokeWidth="1.4"
          />
        ))}
        <polygon points="286,50 302,50 294,70" fill="#475569" stroke="#64748b" />
        <path d="M288,56 l-4,3 l4,3" fill="none" stroke="#f87171" strokeWidth="1.6" />
        <text x="260" y="112" fontSize="8" fill="#e2e8f0" textAnchor="middle">
          PA-CF · PETG-CF
        </text>
        <text x="260" y="126" fontSize="7.5" fill="#f87171" textAnchor="middle">
          CF истирает сопло
        </text>
      </svg>
    </VisualWrapper>
  );
}
