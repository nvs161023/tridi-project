import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

/** Четыре полосы файла: 33 px высотой, шаг 37, поле 26…170. */
const BAND_Y = [26, 63, 100, 137];
const BAND_H = 33;

type Part = { name: string; hint: string; sample: string; color: string };

/** Блок 3: шапка, старт, слои и финал — четыре части одного файла. */
const PARTS: Part[] = [
  { name: "шапка", hint: "настройки", sample: "; PLA · 0,2 мм", color: "#94a3b8" },
  { name: "старт", hint: "подготовка", sample: "G28 · M104 S210", color: "#60a5fa" },
  { name: "слои", hint: "печать", sample: ";LAYER:120", color: "#10b981" },
  { name: "финал", hint: "завершение", sample: "M104 S0 · M140 S0", color: "#f59e0b" },
];

/**
 * Кадр блока 4 урока C11 «Что внутри файла .gcode».
 *
 * Макет из описания кадра `C11_gcode_anatomy.png`: четыре части файла идут
 * сверху вниз в том же порядке, в каком принтер их читает. Блок 2 объясняет,
 * что шапку пишет сам слайсер, старт готовит принтер, слои — это сотни пар
 * строк, а финал снимает нагрев и паркует оси.
 */
export function ConfidentC11Diagram0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Что внутри файла .gcode: четыре части сверху вниз. Шапка с настройками слайсера и строкой материала, стартовый блок с парковкой G28 и нагревом M104, слои с закладкой LAYER:120 и финальный блок, который снимает нагрев командой M104 S0. Каждая строка — одна команда, файл читается построчно, поэтому части идут в порядке выполнения"
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
          четыре части одного файла
        </text>

        {PARTS.map((part, index) => {
          const y = BAND_Y[index];
          return (
            <g key={part.name}>
              <rect
                x="12"
                y={y}
                width="196"
                height={BAND_H}
                rx="4"
                fill="#0f172a"
                fillOpacity="0.35"
                stroke={part.color}
                strokeOpacity="0.35"
              />
              <rect x="12" y={y} width="3" height={BAND_H} fill={part.color} fillOpacity="0.8" />

              <text x="22" y={y + 13} fontSize="10" fontWeight="700" fill={part.color}>
                {part.name}
              </text>
              <text x="22" y={y + 26} fontSize="10" fill="#cbd5e1" fontFamily={MONO}>
                {part.sample}
              </text>

              <text x="304" y={y + 21} fontSize="10" fill="#94a3b8" textAnchor="end">
                {part.hint}
              </text>
            </g>
          );
        })}
      </svg>
    </VisualWrapper>
  );
}
