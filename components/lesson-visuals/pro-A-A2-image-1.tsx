import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Двадцать зубьев шкива: угол, на котором стоит риска. */
const teeth = Array.from({ length: 20 }, (_, index) => (index * 360) / 20);

/**
 * Ремень и шкив — технический крупный план из content урока: ремень GT2 (шаг 2 мм,
 * ширина 6 мм, стекловолокно с неопреном), шкив на 20 зубьев и шаговый мотор
 * NEMA 17. Всё с размерами — как на чертеже, потому что урок про то, откуда
 * берётся точность 0,05–0,1 мм.
 *
 * В базовом курсе ремни встречались только как иконка в легенде («Точки
 * обслуживания») и как деталь изометрии принтера; здесь это главный предмет
 * кадра с размерными линиями и выносками — приём в курсе новый.
 */
export function ProAA2Image1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Чертёж деталей привода: ремень GT2 с шагом 2 мм и шириной 6 мм из стекловолокна с неопреном, шкив на 20 зубьев и шаговый мотор NEMA 17"
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

        {/* Ремень: полоса с зубчатым профилем снизу */}
        <rect x="16" y="48" width="124" height="24" rx="2" fill="#334155" stroke="#94a3b8" />
        <polyline
          points="16,72 24,76 32,72 40,76 48,72 56,76 64,72 72,76 80,72 88,76 96,72 104,76 112,72 120,76 128,72 136,76 140,74"
          fill="none"
          stroke="#94a3b8"
        />

        {/* Шаг: две выносные риски и размерная линия */}
        <line x1="24" y1="76" x2="24" y2="84" stroke="#f59e0b" />
        <line x1="44" y1="76" x2="44" y2="84" stroke="#f59e0b" />
        <line x1="24" y1="84" x2="44" y2="84" stroke="#f59e0b" />
        <text x="34" y="100" fontSize="10" fill="#fbbf24" textAnchor="middle">
          шаг 2 мм
        </text>

        {/* Ширина ремня: размер справа наверху */}
        <line x1="146" y1="48" x2="146" y2="72" stroke="#f59e0b" />
        <line x1="140" y1="48" x2="150" y2="48" stroke="#f59e0b" />
        <line x1="140" y1="72" x2="150" y2="72" stroke="#f59e0b" />
        <line x1="146" y1="34" x2="146" y2="44" stroke="#f59e0b" />
        <text x="146" y="26" fontSize="10" fill="#fbbf24">
          ширина 6 мм
        </text>

        <text x="16" y="122" fontSize="10" fill="#e2e8f0">
          ремень GT2
        </text>
        <text x="16" y="136" fontSize="10" fill="#94a3b8">
          стекловолокно + неопрен
        </text>

        {/* Шкив: 20 зубьев по ободу и ступица */}
        <text x="216" y="40" fontSize="10" fill="#e2e8f0" textAnchor="middle">
          шкив
        </text>
        <text x="216" y="54" fontSize="10" fill="#fbbf24" textAnchor="middle">
          20 зубьев
        </text>
        <circle cx="216" cy="96" r="28" fill="#1e293b" stroke="#f59e0b" strokeWidth="1.4" />
        <circle cx="216" cy="96" r="8" fill="#0f172a" stroke="#f59e0b" />
        {teeth.map((angle) => {
          const rad = (angle * Math.PI) / 180;

          return (
            <line
              key={angle}
              x1={216 + 28 * Math.cos(rad)}
              y1={96 + 28 * Math.sin(rad)}
              x2={216 + 32 * Math.cos(rad)}
              y2={96 + 32 * Math.sin(rad)}
              stroke="#f59e0b"
            />
          );
        })}

        {/* Мотор NEMA 17: квадрат 42 мм, четыре крепления, вал */}
        <rect x="254" y="66" width="50" height="50" rx="3" fill="#334155" stroke="#94a3b8" />
        <circle cx="262" cy="74" r="3" fill="#1e293b" stroke="#94a3b8" />
        <circle cx="296" cy="74" r="3" fill="#1e293b" stroke="#94a3b8" />
        <circle cx="262" cy="108" r="3" fill="#1e293b" stroke="#94a3b8" />
        <circle cx="296" cy="108" r="3" fill="#1e293b" stroke="#94a3b8" />
        <circle cx="279" cy="91" r="9" fill="#0f172a" stroke="#f59e0b" />
        <text x="279" y="134" fontSize="10" fill="#e2e8f0" textAnchor="middle">
          NEMA 17
        </text>
        <text x="279" y="150" fontSize="10" fill="#94a3b8" textAnchor="middle">
          шаговый
        </text>
      </svg>
    </VisualWrapper>
  );
}
