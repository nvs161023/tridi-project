import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const SCANNERS = [
  {
    name: "Лазер",
    accent: "#fbbf24",
    price: "20–150 тыс. ₽",
    accuracy: "0,05–0,2 мм",
    note: "металл и мелочь",
    weak: ["блеск", "медленно"],
  },
  {
    name: "Свет",
    accent: "#38bdf8",
    price: "30–200 тыс. ₽",
    accuracy: "0,05–0,3 мм",
    note: "до 30–50 см",
    weak: ["блеск, тёмное", "прозрачное"],
  },
  {
    name: "Ручной",
    accent: "#a78bfa",
    price: "25–80 тыс. ₽",
    accuracy: "0,1–0,5 мм",
    note: "грубее станка",
    weak: ["нужны метки", "сводят вручную"],
  },
];

/**
 * Кадр блока 10 урока IN7 «Сканирование и фотограмметрия».
 *
 * Макет из описания `IN7_scanner_types.png`: три вида сканеров в одном ряду —
 * лазер, структурированный свет и ручной. В каждой карточке цена, точность и
 * слабое место из блоков 6, 8 и 9. Внизу — предупреждение из блока 11:
 * обещанные 0,05 мм на деле дают 0,2 мм.
 */
export function EngineerIN7Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Три вида сканеров. Лазер: точность 0,05–0,2 миллиметра, цена 20–150 тысяч рублей, снимает металл и мелочь, слабые места — блеск и медленность. Структурированный свет: 0,05–0,3 миллиметра на деталях до 30–50 сантиметров, 30–200 тысяч рублей, боится блеска, тёмного и прозрачного. Ручной: 0,1–0,5 миллиметра, 25–80 тысяч рублей, нужны метки, кадры сводят вручную. Обещанные 0,05 миллиметра на деле дают 0,2"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          три вида: цена, точность, слабое место
        </text>

        {SCANNERS.map((scanner, i) => {
          const x = 12 + i * 100;
          return (
            <g key={scanner.name}>
              <rect x={x} y="24" width="96" height="118" rx="7" fill="#0f172a" fillOpacity="0.45" stroke="#334155" />
              <rect x={x} y="24" width="96" height="2.5" rx="1.2" fill={scanner.accent} fillOpacity="0.85" />
              <text x={x + 8} y="40" fontSize="10" fontWeight="700" fill={scanner.accent}>
                {scanner.name}
              </text>
              <text x={x + 8} y="58" fontSize="11" fontWeight="700" fill="#e2e8f0">
                {scanner.price}
              </text>
              <text x={x + 8} y="76" fontSize="10" fill="#94a3b8">
                точность
              </text>
              <text x={x + 8} y="91" fontSize="11" fontWeight="700" fill="#e2e8f0">
                {scanner.accuracy}
              </text>
              <text x={x + 8} y="107" fontSize="10" fill="#94a3b8">
                {scanner.note}
              </text>
              <text x={x + 8} y="123" fontSize="10" fill="#fca5a5">
                {scanner.weak[0]}
              </text>
              <text x={x + 8} y="137" fontSize="10" fill="#fca5a5">
                {scanner.weak[1]}
              </text>
            </g>
          );
        })}

        <text x="12" y="156" fontSize="10" fill="#fbbf24">
          обещанные 0,05 мм на деле дают 0,2 мм
        </text>
        <text x="12" y="172" fontSize="10" fill="#cbd5e1">
          лазер точнее · свет быстрее · ручной мобильнее
        </text>
      </svg>
    </VisualWrapper>
  );
}
