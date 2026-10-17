import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const RULES = ["не выше слоя", "гайка плоско", "втулка вверх", "обдув off", "зазор ≥1 слой"];

const NUT = "109,93 104.5,101 95.5,101 91,93 95.5,85 104.5,85";

/**
 * Кадр блока 24 урока IN10 «Макросы Klipper и постобработка».
 *
 * Макет из описания `IN10_insert_pause.png`: разрез кармана, гайка, зазор сверху и
 * слой паузы. Правила — блок 22 (не выступать над слоем, гайка плоско, втулка
 * вертикально, обдув выключен, зазор хотя бы на слой), состав закладных — блок 23.
 */
export function EngineerIN10Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Разрез кармана под закладную: в стенке детали открыт карман, на дне лежит гайка М3–М5 плоской стороной вниз, сверху оставлен зазор не меньше одного слоя, затем идёт закрывающий слой. Пунктирная линия паузы проходит по дну кармана. Правила: закладная не выступает над слоем, гайка лежит плоско, втулка стоит вертикально, обдув выключен, зазор сверху не меньше слоя. Высота паузы равна высоте кармана минус один слой"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          карман под гайку: разрез и пауза
        </text>

        <path d="M20 70 H66 V102 H134 V70 H180 V140 H20 Z" fill="#334155" fillOpacity="0.85" stroke="#64748b" strokeWidth="1" />
        <rect x="66" y="64" width="68" height="6" fill="#38bdf8" fillOpacity="0.3" stroke="#38bdf8" strokeOpacity="0.6" />
        <text x="66" y="59" fontSize="10" fill="#7dd3fc">
          закрывающий слой
        </text>

        <polygon points={NUT} fill="#fbbf24" fillOpacity="0.9" stroke="#fbbf24" />

        <path d="M36 102 H168" stroke="#38bdf8" strokeWidth="1.2" strokeDasharray="4 3" />
        <text x="36" y="116" fontSize="10" fill="#38bdf8">
          линия паузы
        </text>

        <path d="M144 71 H152 M144 84 H152 M148 71 V84" stroke="#e2e8f0" strokeWidth="0.9" />
        <text x="156" y="81" fontSize="10" fill="#e2e8f0">
          ≥1 слой
        </text>

        <rect x="196" y="22" width="112" height="118" rx="7" fill="#0f172a" fillOpacity="0.55" stroke="#334155" />
        <text x="206" y="36" fontSize="10" fontWeight="700" fill="#fbbf24">
          правила
        </text>
        {RULES.map((rule, i) => (
          <text key={rule} x="206" y={54 + i * 16} fontSize="10" fill="#e2e8f0">
            {rule}
          </text>
        ))}

        <rect x="12" y="144" width="296" height="30" rx="6" fill="#fbbf24" fillOpacity="0.08" stroke="#fbbf24" strokeOpacity="0.3" />
        <text x="22" y="157" fontSize="10" fill="#e2e8f0">
          высота паузы = карман − 1 слой
        </text>
        <text x="22" y="171" fontSize="10" fill="#94a3b8">
          проверь на тестовом кубике
        </text>
      </svg>
    </VisualWrapper>
  );
}
