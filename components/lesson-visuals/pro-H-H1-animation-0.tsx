import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Семь ветвей дерева поддержки: ствол и три пары «ветвь — подветвь». Каждая
 * растёт от своего начала, поэтому порядок в списке — это порядок роста.
 */
const branches = [
  { id: 0, d: "M160,130 L160,96", width: 4 },
  { id: 1, d: "M160,96 L104,72", width: 3 },
  { id: 2, d: "M160,96 L160,66", width: 3 },
  { id: 3, d: "M160,96 L216,72", width: 3 },
  { id: 4, d: "M104,72 L84,60", width: 2 },
  { id: 5, d: "M160,66 L160,56", width: 2 },
  { id: 6, d: "M216,72 L236,60", width: 2 },
];

/** Пятки — места, где готовая поддержка касается детали. */
const feet = [
  "M76,60 L92,60",
  "M152,56 L168,56",
  "M228,60 L244,60",
];

/**
 * Ветви растут по очереди — каждая от своего начала. Свой keyframes на ветвь:
 * с общим animation-delay сдвинулся бы весь цикл, и порядок роста перестал бы
 * читаться.
 */
const BRANCH_STYLES = branches
  .map((branch) => {
    const at = branch.id * 4;
    return `          .v-hh1a-b${branch.id} { animation: v-hh1a-grow${branch.id} 8s linear infinite; }
          @keyframes v-hh1a-grow${branch.id} {
            0%, ${at}% { stroke-dashoffset: 100; }
            ${at + 6}%, 92% { stroke-dashoffset: 0; }
            97%, 100% { stroke-dashoffset: 100; }
          }`;
  })
  .join("\n");

/**
 * Tree поддержки: от плиты поднимается ствол, от него расходятся ветви, и всё
 * дерево сходится в одну ножку — та же опора, но пластика вдвое меньше.
 *
 * Ровно по content урока: «Поддержки растут как ветки дерева, соединяясь в одну
 * ножку. Экономия пластика 50%, легче снимать».
 *
 * От «Как принтер строит модель» в базовом уроке 1 и от «Высоты слоя» в модуле G
 * отличается отсутствием печати как процесса: в кадре нет ни сопла, ни стенок
 * детали — только ветви поддержки, которые поднимаются от плиты и сливаются в
 * одну ножку, и плашка про экономию пластика.
 *
 * Анимация 8 с, по кругу: ветви растут по очереди в первые 2,4 с, затем на
 * концах появляются пятки, и дерево стоит целиком почти весь цикл. При
 * prefers-reduced-motion показано готовое дерево.
 *
 * Классы с префиксом v-hh1a: <style> внутри SVG действует на всю страницу.
 */
export function ProHH1Animation0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Анимация древовидной поддержки: от плиты поднимается ствол, от него растут ветви и сливаются в одну ножку, на концах появляются пятки — экономия пластика 50 процентов и легче снимать"
      animated={animated}
    >
      <svg
        viewBox="0 0 320 180"
        className="w-full h-full"
        aria-hidden="true"
        fontFamily={FONT}
      >
        <style>{`
${BRANCH_STYLES}
          .v-hh1a-branch {
            stroke-dasharray: 100;
            stroke-dashoffset: 100;
          }
          .v-hh1a-foot { animation: v-hh1a-foot 8s linear infinite; }
          @keyframes v-hh1a-foot {
            0%, 26% { opacity: 0; }
            34%, 92% { opacity: 1; }
            97%, 100% { opacity: 0; }
          }
          @media (prefers-reduced-motion: reduce) {
            .v-hh1a-branch { animation: none; stroke-dashoffset: 0; }
            .v-hh1a-foot { animation: none; opacity: 1; }
          }
        `}</style>

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
          ветви поддержек сливаются в одну ножку
        </text>

        <rect x="236" y="26" width="72" height="20" rx="4" fill="#0f172a" stroke="#475569" />
        <text x="272" y="39" fontSize="9" fill="#6ee7b7" textAnchor="middle">
          −50% пластика
        </text>

        {/* Плита, от которой растёт дерево */}
        <line x1="30" y1="130" x2="290" y2="130" stroke="#475569" />

        {branches.map((branch) => (
          <path
            key={branch.id}
            className={`v-hh1a-branch v-hh1a-b${branch.id}`}
            d={branch.d}
            fill="none"
            stroke="#64748b"
            strokeWidth={branch.width}
            pathLength={100}
          />
        ))}

        {feet.map((d) => (
          <path
            key={d}
            className="v-hh1a-foot"
            d={d}
            fill="none"
            stroke="#94a3b8"
            strokeWidth="2"
          />
        ))}

        <text x="12" y="148" fontSize="10" fill="#e2e8f0">
          ветви растут от плиты и сливаются в одну ножку
        </text>
        <text x="12" y="166" fontSize="9" fill="#94a3b8">
          снимается руками, пластика вдвое меньше
        </text>
      </svg>
    </VisualWrapper>
  );
}
