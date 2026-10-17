import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Кадр блока 23 урока IN9 «G-код: чтение и написание».
 *
 * Макет из описания `IN9_dry_run.png`: экран во время сухого прогона — Z поднят
 * на 50 мм, нагревы сняты в ноль, видна траектория. Подготовка и шесть шагов —
 * блоки 21 и 22, ограничения прогона — блок 24.
 */
export function EngineerIN9Image1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Экран во время сухого прогона: Z поднят на 50 миллиметров, сопло и стол на нуле градусов, поток нулевой, на экране видна траектория обхода. Прогон ловит ошибки нуля, зеркальные координаты и вылет за стол, но не ловит крепёж, поток пластика и температуру. Пять минут прогона дешевле двух часов печати в мусор"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          сухой прогон на экране
        </text>

        <defs>
          <marker id="in9-5-arrow" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="4" markerHeight="4" orient="auto">
            <path d="M0 0 L6 3 L0 6 z" fill="#38bdf8" />
          </marker>
        </defs>

        {/* Экран */}
        <rect x="12" y="24" width="296" height="90" rx="8" fill="#0f172a" fillOpacity="0.75" stroke="#334155" />
        <text x="22" y="38" fontSize="10" fontWeight="700" fill="#e2e8f0">
          СУХОЙ ПРОГОН
        </text>
        <circle cx="266" cy="34" r="3" fill="#34d399" />
        <text x="274" y="38" fontSize="10" fill="#34d399">
          идёт
        </text>

        <text x="22" y="60" fontSize="14" fontWeight="700" fill="#38bdf8">
          Z 50.0
        </text>
        <text x="22" y="78" fontSize="10" fill="#cbd5e1">
          сопло 0/0 °C
        </text>
        <text x="22" y="92" fontSize="10" fill="#cbd5e1">
          стол 0/0 °C
        </text>
        <text x="22" y="106" fontSize="10" fill="#cbd5e1">
          поток 0 %
        </text>

        {/* Траектория */}
        <path d="M196 96 V46 H268 V96 H196" fill="none" stroke="#38bdf8" strokeWidth="1.3" strokeDasharray="4 3" markerEnd="url(#in9-5-arrow)" strokeOpacity="0.9" />
        <circle cx="196" cy="96" r="2.2" fill="#38bdf8" />
        <text x="232" y="108" fontSize="10" fill="#94a3b8" textAnchor="middle">
          траектория
        </text>

        <rect x="12" y="118" width="296" height="32" rx="6" fill="#34d399" fillOpacity="0.08" stroke="#34d399" strokeOpacity="0.3" />
        <text x="22" y="130" fontSize="10" fill="#34d399">
          ловит: нуль, зеркала, вылет за стол
        </text>
        <text x="22" y="146" fontSize="10" fill="#fbbf24">
          не ловит: крепёж, поток, температуру
        </text>

        <text x="12" y="169" fontSize="10" fill="#e2e8f0">
          5 минут прогона вместо 2 часов печати в мусор
        </text>
      </svg>
    </VisualWrapper>
  );
}
