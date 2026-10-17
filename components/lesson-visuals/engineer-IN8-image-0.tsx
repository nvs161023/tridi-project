import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const TOOLS = [
  {
    name: "MeshLab",
    role: "чистка",
    accent: "#34d399",
    bullets: ["дубли вершин", "оболочки", "дыры и шум"],
  },
  {
    name: "Meshmixer",
    role: "правка",
    accent: "#38bdf8",
    bullets: ["правка формы", "ремонт", "не строит тело"],
  },
  {
    name: "Netfabb",
    role: "ремонт",
    accent: "#a78bfa",
    bullets: ["закрыть дыры", "non-manifold", "под печать"],
  },
];

/**
 * Кадр блока 6 урока IN8 «Из скана в CAD: параметрическая деталь».
 *
 * Три карточки программ из описания `IN8_three_programs.png`: MeshLab — чистка,
 * Meshmixer — правка, Netfabb — ремонт. Роли и предупреждение про конверсию — из
 * блоков 5–7 и 17, цифры шума и времени — из блоков 5 и 9.
 */
export function EngineerIN8Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Три программы для подготовки скана: MeshLab — чистка, убирает дубли вершин, оболочки, дыры и шум; Meshmixer — правка формы и ремонт, но для конверсии в тело слабее; Netfabb — ремонт под печать, закрывает дыры и non-manifold. Шум меньше 0,1 мм, чистка занимает 20–30 минут. Тело строят в CAD, а не в программе чистки"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          три программы: чистка, правка, ремонт
        </text>

        {TOOLS.map((tool, i) => {
          const x = 12 + i * 102;
          return (
            <g key={tool.name}>
              <rect x={x} y="26" width="92" height="100" rx="7" fill="#0f172a" fillOpacity="0.5" stroke="#334155" />
              <rect x={x} y="26" width="92" height="2.5" rx="1.2" fill={tool.accent} fillOpacity="0.85" />
              <text x={x + 8} y="41" fontSize="10" fontWeight="700" fill="#e2e8f0">
                {tool.name}
              </text>
              <text x={x + 8} y="55" fontSize="10" fill={tool.accent}>
                {tool.role}
              </text>
              {tool.bullets.map((bullet, j) => (
                <text
                  key={bullet}
                  x={x + 8}
                  y={71 + j * 13}
                  fontSize="10"
                  fill={j === 2 && i === 1 ? "#f87171" : "#cbd5e1"}
                >
                  {bullet}
                </text>
              ))}
            </g>
          );
        })}

        <text x="12" y="140" fontSize="10" fill="#cbd5e1">
          шум — меньше 0,1 мм · чистка 20–30 минут
        </text>
        <text x="12" y="156" fontSize="10" fill="#cbd5e1">
          MeshLab бесплатный — первых деталей хватает
        </text>
        <text x="12" y="172" fontSize="10" fill="#fbbf24">
          тело строят в CAD, а не в чистилке
        </text>
      </svg>
    </VisualWrapper>
  );
}
