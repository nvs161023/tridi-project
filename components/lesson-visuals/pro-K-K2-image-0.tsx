import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Четыре слоя покрытия вокруг контура детали: снаружи лак, под ним акценты, база
 * и грунт у самой детали. Слева — название слоя с цветной меткой, справа — чем
 * наносят и сколько сохнет.
 *
 * Ровно по content урока: «Фото: грунт (серый), база (основной цвет), детали
 * (акценты), лак (защита)» и по steps: «Грунт — тонкий слой, 30 см, суши 1 час →
 * База — 2 слоя, суши 30 мин → Детали — акценты, тени, блики → Лак — матовый для
 * тела, глянцевый для глаз».
 *
 * От «четырёх этапов в ряд» (H-H1-image четыре вида поддержек, I-I2 шесть форм
 * заполнения) и от разрезов внутри материала (G-G1-screenshot Variable Layer
 * Height, H-H3-screenshot модификаторы) отличается тем, что покрытия лежат
 * оболочками СВЕРХУ контура детали, а не плитками в ряд и не слоями внутри
 * разреза. Крупного аэрографа как оборудования в кадре нет — это территория
 * модуля M6 «Аэрограф и компрессор».
 */
export function ProKK2Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Этапы покраски: вокруг контура детали четыре слоя покрытия оболочками — снаружи лак, под ним акценты, база и грунт у самой детали; слева названия слоёв с цветными метками, справа чем наносят и сколько сохнет — грунт тонко с 30 см и сушка 1 час, база в 2 слоя по 30 минут, акценты кистями 0 и 1, лак матовый для тела и глянцевый для глаз"
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
          Этапы покраски: грунт → база → акценты → лак
        </text>

        {/* Оболочки покрытий вокруг контура детали */}
        <rect
          x="118"
          y="40"
          width="72"
          height="100"
          fill="none"
          stroke="#34d399"
          strokeWidth="1.6"
          strokeDasharray="6 4"
        />
        <rect
          x="121"
          y="43"
          width="66"
          height="94"
          fill="none"
          stroke="#fbbf24"
          strokeWidth="1.6"
          strokeDasharray="2 3"
        />
        <rect x="124" y="46" width="60" height="88" fill="none" stroke="#38bdf8" strokeWidth="1.6" />
        <rect
          x="127"
          y="49"
          width="54"
          height="82"
          fill="none"
          stroke="#94a3b8"
          strokeWidth="1.6"
          strokeDasharray="4 3"
        />
        <rect x="130" y="52" width="48" height="76" fill="#334155" stroke="#64748b" />
        <line x1="136" y1="72" x2="172" y2="72" stroke="#64748b" strokeOpacity="0.7" />
        <line x1="136" y1="92" x2="172" y2="92" stroke="#64748b" strokeOpacity="0.7" />
        <line x1="136" y1="112" x2="172" y2="112" stroke="#64748b" strokeOpacity="0.7" />

        {/* Названия слоёв слева с цветными метками */}
        <rect x="12" y="59" width="8" height="8" fill="#34d399" />
        <text x="30" y="63" fontSize="7.5" fill="#e2e8f0">
          лак
        </text>
        <rect x="12" y="83" width="8" height="8" fill="#fbbf24" />
        <text x="30" y="87" fontSize="7.5" fill="#e2e8f0">
          акценты
        </text>
        <rect x="12" y="107" width="8" height="8" fill="#38bdf8" />
        <text x="30" y="111" fontSize="7.5" fill="#e2e8f0">
          база
        </text>
        <rect x="12" y="131" width="8" height="8" fill="#94a3b8" />
        <text x="30" y="135" fontSize="7.5" fill="#e2e8f0">
          грунт
        </text>

        {/* Инструмент и время сушки справа */}
        <text x="200" y="63" fontSize="7.5" fill="#94a3b8">
          мат / глянец
        </text>
        <text x="200" y="87" fontSize="7.5" fill="#94a3b8">
          кисти 0–1
        </text>
        <text x="200" y="111" fontSize="7.5" fill="#94a3b8">
          2 слоя, 30 мин
        </text>
        <text x="200" y="135" fontSize="7.5" fill="#94a3b8">
          30 см, 1 ч
        </text>

        <text x="12" y="170" fontSize="9" fill="#94a3b8">
          в центре деталь, вокруг — четыре покрытия
        </text>
      </svg>
    </VisualWrapper>
  );
}
