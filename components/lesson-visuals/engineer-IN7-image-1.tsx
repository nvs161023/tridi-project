import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const CHECKS = [
  "3 круга:",
  "уровень · верх · низ",
  "15–20 кадров на круг",
  "всего 20–50",
  "перекрытие — треть",
  "один радиус",
  "зум, ISO, ББ — фикс.",
];

/**
 * Кадр блока 14 урока IN7 «Сканирование и фотограмметрия».
 *
 * Макет из описания `IN7_shoot_orbit.png`: деталь на столе и три орбиты вокруг
 * неё — уровень, сверху и снизу. Справа чек-лист съёмки из блоков 13 и 15:
 * 15–20 кадров на круг, всего 20–50, перекрытие в треть кадра, один радиус и
 * фиксированные зум, ISO и баланс белого.
 */
export function EngineerIN7Image1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Съёмка по орбитам: деталь стоит на столе, камера обходит её тремя кругами — на уровне детали, сверху и снизу, по 15–20 кадров на круг, всего 20–50. Кадры должны перекрываться на треть, радиус один, зум, ISO и баланс белого зафиксированы. Пятьдесят хороших кадров лучше сотни смазанных"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          съёмка по орбитам: три круга
        </text>

        {/* Орбита и лучи камер */}
        <ellipse cx="88" cy="92" rx="70" ry="51" fill="none" stroke="#475569" strokeWidth="1" strokeDasharray="4 4" />
        <line x1="34" y1="92" x2="73" y2="92" stroke="#38bdf8" strokeWidth="0.8" strokeDasharray="2 2" />
        <line x1="119" y1="53" x2="100" y2="79" stroke="#38bdf8" strokeWidth="0.8" strokeDasharray="2 2" />
        <line x1="119" y1="131" x2="100" y2="105" stroke="#38bdf8" strokeWidth="0.8" strokeDasharray="2 2" />

        {/* Деталь на столе */}
        <rect x="73" y="80" width="30" height="24" rx="4" fill="#0f172a" stroke="#94a3b8" />
        <circle cx="88" cy="92" r="6" fill="none" stroke="#94a3b8" strokeWidth="1.1" />
        <line x1="58" y1="106" x2="118" y2="106" stroke="#64748b" strokeWidth="1.2" />
        <text x="88" y="118" fontSize="10" fill="#64748b" textAnchor="middle">
          стол
        </text>

        {/* Камеры на трёх уровнях */}
        {[
          { x: 18, y: 86, n: "1" },
          { x: 111, y: 41, n: "2" },
          { x: 111, y: 131, n: "3" },
        ].map((cam) => (
          <g key={cam.n}>
            <rect x={cam.x} y={cam.y} width="16" height="12" rx="3" fill="#0f172a" stroke="#38bdf8" />
            <text x={cam.x + 8} y={cam.y + 9} fontSize="10" fontWeight="700" fill="#38bdf8" textAnchor="middle">
              {cam.n}
            </text>
          </g>
        ))}
        <text x="12" y="114" fontSize="10" fill="#7dd3fc">
          уровень
        </text>
        <text x="130" y="40" fontSize="10" fill="#7dd3fc">
          сверху
        </text>
        <text x="130" y="156" fontSize="10" fill="#7dd3fc">
          снизу
        </text>

        {/* Чек-лист */}
        <line x1="176" y1="28" x2="176" y2="146" stroke="#334155" />
        <text x="184" y="38" fontSize="10" fill="#94a3b8">
          чек-лист
        </text>
        {CHECKS.map((line, i) => (
          <text key={line} x="184" y={56 + i * 15} fontSize="10" fill={i === 0 ? "#e2e8f0" : "#cbd5e1"} fontWeight={i === 0 ? 700 : 400}>
            {line}
          </text>
        ))}

        <text x="12" y="172" fontSize="10" fill="#fbbf24">
          50 хороших кадров лучше сотни смазанных
        </text>
      </svg>
    </VisualWrapper>
  );
}
