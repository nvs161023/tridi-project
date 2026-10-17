import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Линии треугольной сетки: вертикали, горизонтали и диагонали в каждой ячейке. */
function gridLines(x: number, y: number, width: number, height: number, cols: number, rows: number) {
  const lines: string[] = [];
  const cw = width / cols;
  const rh = height / rows;
  for (let i = 0; i <= cols; i++) {
    lines.push(`M${x + i * cw} ${y} V${y + height}`);
  }
  for (let j = 0; j <= rows; j++) {
    lines.push(`M${x} ${y + j * rh} H${x + width}`);
  }
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const px = x + i * cw;
      const py = y + j * rh;
      lines.push(`M${px} ${py} L${px + cw} ${py + rh}`);
    }
  }
  return lines.join(" ");
}

/**
 * Кадр блока 11 урока IN8 «Из скана в CAD: параметрическая деталь».
 *
 * Сетка до и после упрощения из описания `IN8_decimate.png`: слева миллион
 * треугольников, справа сто тысяч (в десять раз меньше). Коридор и пример втулки —
 * блок 10, порядок «чистка, потом упрощение» — блоки 10 и 12.
 */
export function EngineerIN8Image2({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Сетка до и после упрощения: миллион треугольников слева, сто тысяч справа, в десять раз меньше. Рабочий коридор — от ста до трёхсот тысяч треугольников, втулке хватает тридцати тысяч. Сначала чистка, потом упрощение"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          сетка до и после: 1 млн → 100 тыс
        </text>

        <defs>
          <marker id="in8-2-arrow" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="4" markerHeight="4" orient="auto">
            <path d="M0 0 L6 3 L0 6 z" fill="#64748b" />
          </marker>
        </defs>

        {/* До упрощения */}
        <rect x="12" y="26" width="112" height="84" rx="7" fill="#0f172a" fillOpacity="0.55" stroke="#334155" />
        <text x="20" y="39" fontSize="10" fill="#38bdf8">
          до
        </text>
        <path d={gridLines(18, 46, 100, 58, 8, 5)} fill="none" stroke="#38bdf8" strokeWidth="0.7" strokeOpacity="0.55" />

        {/* После упрощения */}
        <rect x="196" y="26" width="112" height="84" rx="7" fill="#0f172a" fillOpacity="0.55" stroke="#334155" />
        <text x="204" y="39" fontSize="10" fill="#34d399">
          после
        </text>
        <path d={gridLines(202, 46, 100, 58, 3, 2)} fill="none" stroke="#34d399" strokeWidth="1.1" strokeOpacity="0.7" />

        {/* Стрелка упрощения */}
        <path d="M128 66 H188" stroke="#64748b" strokeWidth="1.2" markerEnd="url(#in8-2-arrow)" />
        <text x="160" y="56" fontSize="10" fontWeight="700" fill="#fbbf24" textAnchor="middle">
          ÷10
        </text>
        <text x="160" y="80" fontSize="10" fill="#94a3b8" textAnchor="middle">
          в 10 раз
        </text>

        <text x="68" y="120" fontSize="11" fontWeight="700" fill="#38bdf8" textAnchor="middle">
          1 000 000
        </text>
        <text x="68" y="133" fontSize="10" fill="#94a3b8" textAnchor="middle">
          треугольников
        </text>
        <text x="252" y="120" fontSize="11" fontWeight="700" fill="#34d399" textAnchor="middle">
          100 000
        </text>
        <text x="252" y="133" fontSize="10" fill="#94a3b8" textAnchor="middle">
          треугольников
        </text>

        <text x="12" y="149" fontSize="10" fill="#cbd5e1">
          коридор 100–300 тыс.; втулке хватает 30 тыс.
        </text>
        <text x="12" y="166" fontSize="10" fill="#fbbf24">
          сначала чистка, потом упрощение
        </text>
      </svg>
    </VisualWrapper>
  );
}
