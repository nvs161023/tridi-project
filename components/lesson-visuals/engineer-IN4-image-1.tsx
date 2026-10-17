import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Кадр блока 7 урока IN4 «Симуляция в CAD (Stress Analysis)».
 *
 * Макет из описания `IN4_material.png`: слева модуль упругости E ≈ 2–2,5 ГПа
 * и растяжение образца, справа паспортный предел текучести и занижение
 * для печати в 2–3 раза. Внизу — плотность для собственного веса.
 */
export function EngineerIN4Image1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Материал в расчёте. Слева модуль упругости E около 2–2,5 ГПа и растяжение образца. Справа паспортный предел текучести и занижение для напечатанной детали в 2–3 раза. Внизу плотность нужна для собственного веса"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <defs>
          <marker
            id="in4-1-arrow"
            viewBox="0 0 6 6"
            refX="5"
            refY="3"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L6 3 L0 6 z" fill="#f59e0b" />
          </marker>
        </defs>

        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          материал: два числа и запас
        </text>

        {/* Модуль упругости */}
        <rect x="12" y="23" width="145" height="108" rx="8" fill="#0f172a" fillOpacity="0.35" stroke="#334155" />
        <text x="20" y="38" fontSize="10" fontWeight="700" fill="#cbd5e1">
          модуль упругости
        </text>
        <text x="20" y="56" fontSize="12" fontWeight="700" fill="#38bdf8">
          E ≈ 2–2,5 ГПа
        </text>
        <rect x="20" y="67" width="96" height="9" rx="2" fill="#334155" stroke="#64748b" />
        <line x1="42" y1="71.5" x2="22" y2="71.5" stroke="#f59e0b" markerEnd="url(#in4-1-arrow)" />
        <line x1="94" y1="71.5" x2="114" y2="71.5" stroke="#f59e0b" markerEnd="url(#in4-1-arrow)" />
        <text x="20" y="92" fontSize="10" fill="#f59e0b">
          растяжение
        </text>
        <text x="20" y="109" fontSize="10" fill="#cbd5e1">
          PLA · PETG · ABS — близко
        </text>

        {/* Предел текучести */}
        <rect x="165" y="23" width="143" height="108" rx="8" fill="#0f172a" fillOpacity="0.35" stroke="#334155" />
        <text x="173" y="38" fontSize="10" fontWeight="700" fill="#cbd5e1">
          предел текучести
        </text>
        <text x="173" y="54" fontSize="10" fill="#cbd5e1">
          паспорт
        </text>
        <rect x="173" y="59" width="82" height="7" rx="2" fill="#3b82f6" fillOpacity="0.8" stroke="#93c5fd" />
        <text x="260" y="66" fontSize="10" fill="#93c5fd">
          100%
        </text>
        <line x1="181" y1="72" x2="181" y2="84" stroke="#f59e0b" markerEnd="url(#in4-1-arrow)" />
        <text x="190" y="80" fontSize="10" fontWeight="700" fill="#f59e0b">
          −2–3 раза
        </text>
        <text x="173" y="99" fontSize="10" fill="#cbd5e1">
          для печати
        </text>
        <rect x="173" y="104" width="33" height="7" rx="2" fill="#10b981" fillOpacity="0.8" stroke="#6ee7b7" />
        <text x="212" y="114" fontSize="10" fill="#6ee7b7">
          запас
        </text>
        <text x="173" y="128" fontSize="10" fill="#94a3b8">
          PLA выше, но хрупкий
        </text>

        <rect x="12" y="137" width="296" height="1" fill="#334155" />
        <rect x="12" y="147" width="7" height="7" rx="1.5" fill="#0f172a" stroke="#64748b" />
        <path d="M13 150.5 L15 153 L18 148.5" fill="none" stroke="#10b981" strokeWidth="1.2" />
        <text x="24" y="154" fontSize="10" fill="#cbd5e1">
          плотность → собственный вес
        </text>
        <text x="12" y="170" fontSize="10" fill="#94a3b8">
          E — про прогиб · предел — про поломку
        </text>
      </svg>
    </VisualWrapper>
  );
}
