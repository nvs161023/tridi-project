import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Пять этапов из content урока: включил, выбрал, настроил, откалибровал,
 * напечатал. Чётные этапы подписаны под дорогой, нечётные — над ней: так длинные
 * подписи не наезжают друг на друга.
 */
const stages = [
  { id: 1, name: "включил", x: 45, accent: "#3b82f6", labelY: 88 },
  { id: 2, name: "выбрал", x: 102, accent: "#38bdf8", labelY: 150 },
  { id: 3, name: "настроил", x: 160, accent: "#34d399", labelY: 88 },
  { id: 4, name: "откалибровал", x: 218, accent: "#fbbf24", labelY: 150 },
  { id: 5, name: "напечатал", x: 275, accent: "#f59e0b", labelY: 88 },
];

/** Дорога: полоса 288×30, точки этапов стоят на её середине. */
const road = { x: 16, y: 100, width: 288, height: 30 };
const roadCentre = road.y + road.height / 2;

/**
 * Твой путь — дорога из пяти этапов и флаг «Ты здесь» в конце.
 *
 * Ровно по content урока: «Дорога из 5 этапов: включил, выбрал, настроил,
 * откалибровал, напечатал. В конце — флаг „Ты здесь“».
 *
 * От похожего по теме блока «До и после» (урок 11) отличается содержанием и
 * композицией: там три стадии одной детали с панелями и стрелками, здесь путь
 * человека — дорога с точками этапов и флагом на финише.
 */
export function Basic15Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Твой путь: дорога из пяти этапов — включил, выбрал, настроил, откалибровал, напечатал; в конце флаг «Ты здесь»"
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

        {/* Дорога с разметкой */}
        <rect
          x={road.x}
          y={road.y}
          width={road.width}
          height={road.height}
          rx="6"
          fill="#1e293b"
          stroke="#334155"
        />
        <line
          x1="22"
          y1={roadCentre}
          x2="298"
          y2={roadCentre}
          stroke="#475569"
          strokeDasharray="8 8"
        />

        {/* Флаг «Ты здесь» на последнем этапе */}
        <line x1="275" y1={roadCentre} x2="275" y2="58" stroke="#f59e0b" strokeWidth="2" />
        <polygon points="275,58 305,66 275,74" fill="#f59e0b" />
        <text x="270" y="70" fontSize="10" fontWeight="bold" fill="#e2e8f0" textAnchor="end">
          Ты здесь
        </text>

        {/* Точки этапов */}
        {stages.map((stage) => (
          <circle key={stage.id} cx={stage.x} cy={roadCentre} r="8" fill={stage.accent} />
        ))}

        {/* Подписи этапов: длинные слова идут через этап в шахматном порядке */}
        {stages.map((stage) => (
          <text
            key={`label-${stage.id}`}
            x={stage.x}
            y={stage.labelY}
            fontSize="10"
            fill="#e2e8f0"
            textAnchor="middle"
          >
            {stage.id} {stage.name}
          </text>
        ))}

        <text x="14" y="170" fontSize="10" fill="#94a3b8">
          15 уроков: от первой печати до своей модели
        </text>
      </svg>
    </VisualWrapper>
  );
}
