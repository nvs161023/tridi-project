import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

type Pair = { pair: string; hint: string };
type Zone = { title: string; subtitle: string; color: string; x: number; pairs: Pair[] };

/** Три зоны матрицы совместимости: пары из блоков 15–19. */
const ZONES: Zone[] = [
  {
    title: "зелёная",
    subtitle: "одно семейство",
    color: "#10b981",
    x: 12,
    pairs: [
      { pair: "PLA + PLA", hint: "суперклей" },
      { pair: "PETG + PETG", hint: "эпоксидка" },
      { pair: "ABS + ABS", hint: "ацетон" },
      { pair: "TPU + TPU", hint: "клей для резины" },
    ],
  },
  {
    title: "жёлтая",
    subtitle: "с подготовкой",
    color: "#f59e0b",
    x: 113,
    pairs: [
      { pair: "PA + PA", hint: "после сушки" },
      { pair: "гладкая", hint: "шкурка · надрез" },
      { pair: "скос 45°", hint: "больше площади" },
    ],
  },
  {
    title: "красная",
    subtitle: "не соединяется",
    color: "#f87171",
    x: 214,
    pairs: [
      { pair: "PLA + PETG", hint: "разная усадка" },
      { pair: "PLA + ABS", hint: "темп. · химия" },
      { pair: "PC + PLA", hint: "300 и 250 °C" },
      { pair: "смешанные пары", hint: "почти не держат" },
    ],
  },
];

/**
 * Кадр блока 16 урока IN1 «Инженерные материалы и совместимость».
 *
 * Макет из описания кадра `IN1_chem_table.png`: матрица «материал × материал»
 * в трёх цветах. Вместо пустых клеток — три зоны с теми парами, о которых
 * говорит урок: одно семейство держится, жёлтое требует подготовки, красное
 * не соединяется вовсе.
 */
export function EngineerIN1Image4({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Матрица совместимости: три зоны. Зелёная — пары одного семейства: PLA с PLA на суперклее, PETG с PETG на эпоксидке, ABS с ABS на ацетоне, TPU с TPU на клее для резины. Жёлтая — с подготовкой: PA с PA после сушки, гладкую поверхность готовят шкуркой или надрезом, скос 45 градусов даёт большую площадь. Красная — не соединяется: PLA с PETG, PLA с ABS, PC с PLA, смешанные пары почти не держат"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />

        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          что с чем соединяется
        </text>

        {ZONES.map((zone) => (
          <g key={zone.title}>
            <rect
              x={zone.x}
              y="24"
              width="94"
              height="146"
              rx="8"
              fill="#0f172a"
              fillOpacity="0.35"
              stroke={zone.color}
              strokeOpacity="0.35"
            />
            <rect x={zone.x} y="24" width="94" height="26" rx="8" fill={zone.color} fillOpacity="0.14" />
            <text
              x={zone.x + 47}
              y="35"
              fontSize="10"
              fontWeight="700"
              fill={zone.color}
              textAnchor="middle"
            >
              {zone.title}
            </text>
            <text x={zone.x + 47} y="48" fontSize="10" fill="#94a3b8" textAnchor="middle">
              {zone.subtitle}
            </text>

            {zone.pairs.map((entry, index) => {
              const y = 63 + index * 29;
              return (
                <g key={entry.pair}>
                  <text
                    x={zone.x + 47}
                    y={y}
                    fontSize="10"
                    fontWeight="700"
                    fill="#e2e8f0"
                    textAnchor="middle"
                  >
                    {entry.pair}
                  </text>
                  <text x={zone.x + 47} y={y + 13} fontSize="10" fill="#94a3b8" textAnchor="middle">
                    {entry.hint}
                  </text>
                </g>
              );
            })}
          </g>
        ))}
      </svg>
    </VisualWrapper>
  );
}
