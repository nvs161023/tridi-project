import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Стяжка: планка 30…170 на 40…46, губки по краям, винт по центру. */
const BAR = { x: 30, y: 40, w: 140, h: 6 };
const JAW_H = 80;
/** Части между губками: 42…96 и 104…158, шов по центру на 100. */
const LEFT_PART = { x: 42, w: 54 };
const RIGHT_PART = { x: 104, w: 54 };
const PART_Y = 64;
const PART_H = 44;
/** Колонка цифр: подписи 194…308, три строки через 36. */
const STAT_X = 194;
const STAT_TOP = 56;
const STAT_STEP = 36;

type Stat = { value: string; note: string; color: string };

/** Сборка по блоку 26 и описанию кадра `C7_glue_clamp.png`. */
const STATS: Stat[] = [
  { value: "10 мин", note: "на сборку детали", color: "#60a5fa" },
  { value: "0,1 мм", note: "сдвиг без стяжки", color: "#f59e0b" },
  { value: "штифты", note: "ровность стыка", color: "#10b981" },
];

const NOTES = [
  "Сначала примерка насухо, потом клей",
  "Струбцина — через прокладку из картона",
];

/**
 * Кадр блока 27 урока C7 «Склейка двух частей и стяжка».
 *
 * Сборка из описания кадра `C7_glue_clamp.png` и блока 26: две части стоят в
 * струбцине, клей нанесён тонким слоем по стыку, штифты держат части ровно, а
 * губки стянуты через прокладку из картона, чтобы металл не царапал пластик.
 * Цифры — из того же блока: на сборку одной детали уходит десять минут, без
 * стяжки части разъезжаются на десятые доли миллиметра, а порядок такой —
 * сначала примерка насухо, потом клей.
 */
export function ConfidentC7Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Склейка двух частей и стяжка. Две части стоят в струбцине, по стыку нанесён тонкий слой клея, штифты держат части ровно. Губки стянуты через прокладку из картона. На сборку одной детали уходит десять минут. Без стяжки части разъезжаются на десятые доли миллиметра. Сначала примерка насухо, потом клей"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
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

        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          клей, штифты и стяжка
        </text>

        {/* Планка струбцины, губки и винт с ручкой */}
        <rect x={BAR.x} y={BAR.y} width={BAR.w} height={BAR.h} rx="2" fill="#475569" stroke="#64748b" />
        <rect x={BAR.x} y={BAR.y} width="6" height={JAW_H} fill="#475569" stroke="#64748b" />
        <rect x="164" y={BAR.y} width="6" height={JAW_H} fill="#475569" stroke="#64748b" />
        <rect x="98" y="46" width="4" height="18" fill="#94a3b8" />
        <circle cx="100" cy="36" r="7" fill="#475569" stroke="#94a3b8" />
        <text x="112" y="36" fontSize="10" fill="#94a3b8">
          струбцина
        </text>

        {/* Прокладки из картона под губками */}
        <rect x="36" y={PART_Y} width="6" height={PART_H} fill="#f59e0b" fillOpacity="0.2" stroke="#f59e0b" />
        <rect x="158" y={PART_Y} width="6" height={PART_H} fill="#f59e0b" fillOpacity="0.2" stroke="#f59e0b" />

        {/* Две части и штифты в стыке */}
        <rect
          x={LEFT_PART.x}
          y={PART_Y}
          width={LEFT_PART.w}
          height={PART_H}
          fill="#334155"
          fillOpacity="0.7"
          stroke="#64748b"
        />
        <rect
          x={RIGHT_PART.x}
          y={PART_Y}
          width={RIGHT_PART.w}
          height={PART_H}
          fill="#334155"
          fillOpacity="0.7"
          stroke="#64748b"
        />
        <rect x="92" y="74" width="16" height="6" fill="#10b981" fillOpacity="0.35" stroke="#10b981" />
        <rect x="92" y="94" width="16" height="6" fill="#10b981" fillOpacity="0.35" stroke="#10b981" />

        {/* Шов с клеем */}
        <line x1="100" y1="58" x2="100" y2="114" stroke="#f59e0b" strokeWidth="2" />
        <text x="100" y="126" fontSize="10" fontWeight="700" fill="#fcd34d" textAnchor="middle">
          клей по стыку
        </text>

        {/* Что даёт сборка */}
        {STATS.map((stat, index) => {
          const y = STAT_TOP + index * STAT_STEP;
          return (
            <g key={stat.value}>
              <text x={STAT_X} y={y} fontSize="10" fontWeight="700" fill={stat.color}>
                {stat.value}
              </text>
              <text x={STAT_X} y={y + 12} fontSize="10" fill="#94a3b8">
                {stat.note}
              </text>
            </g>
          );
        })}

        {/* Порядок сборки */}
        {NOTES.map((note, index) => (
          <text
            key={note}
            x="12"
            y={152 + index * 14}
            fontSize="10"
            fontWeight={index === 0 ? "700" : "400"}
            fill={index === 0 ? "#e2e8f0" : "#94a3b8"}
          >
            {note}
          </text>
        ))}
      </svg>
    </VisualWrapper>
  );
}
