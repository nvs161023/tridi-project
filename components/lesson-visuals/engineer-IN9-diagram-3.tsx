import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Кадр блока 14 урока IN9 «G-код: чтение и написание».
 *
 * Макет из описания `IN9_arcs.png`: одна и та же дуга двумя способами. Слева
 * центр через I и J (пример `G2 X20 Y0 I10 J0`), справа радиус через R10.
 * Ограничения — блок 15: полная окружность и дуги больше 180° только через I и J.
 */
export function EngineerIN9Diagram3({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Дуга двумя способами: слева центр через I и J — смещение десять миллиметров по X от старта, команда G2 X20 Y0 I10 J0; справа та же дуга по радиусу R10, команда G2 X20 Y0 R10. Полная окружность и дуги больше 180 градусов строятся только через I и J, в строке либо I с J, либо R"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          дуга: центр i/j или радиус r
        </text>

        <defs>
          <marker id="in9-3-arrow" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="4" markerHeight="4" orient="auto">
            <path d="M0 0 L6 3 L0 6 z" fill="#64748b" />
          </marker>
          <marker id="in9-3-arc" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="4" markerHeight="4" orient="auto">
            <path d="M0 0 L6 3 L0 6 z" fill="#38bdf8" />
          </marker>
          <marker id="in9-3-arc2" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="4" markerHeight="4" orient="auto">
            <path d="M0 0 L6 3 L0 6 z" fill="#34d399" />
          </marker>
        </defs>

        {/* I и J */}
        <rect x="12" y="24" width="146" height="96" rx="7" fill="#0f172a" fillOpacity="0.55" stroke="#334155" />
        <text x="20" y="38" fontSize="10" fontWeight="700" fill="#38bdf8">
          центр: I и J
        </text>
        <path d="M34 84 A36 36 0 0 1 106 84" fill="none" stroke="#38bdf8" strokeWidth="1.6" markerEnd="url(#in9-3-arc)" />
        <path d="M34 84 H106" stroke="#38bdf8" strokeWidth="0.8" strokeDasharray="3 3" strokeOpacity="0.45" />
        <path d="M70 84 V48" stroke="#38bdf8" strokeWidth="0.8" strokeDasharray="3 3" strokeOpacity="0.55" />
        <circle cx="34" cy="84" r="2.2" fill="#38bdf8" />
        <circle cx="106" cy="84" r="2.2" fill="#38bdf8" />
        <path d="M66 84 H74 M70 80 V88" stroke="#94a3b8" strokeWidth="0.9" />
        <text x="76" y="64" fontSize="10" fill="#e2e8f0">
          центр I10 J0
        </text>
        <text x="20" y="98" fontSize="10" fill="#94a3b8">
          старт
        </text>
        <text x="94" y="98" fontSize="10" fill="#94a3b8">
          конец
        </text>
        <text x="20" y="114" fontSize="10" fill="#38bdf8">
          G2 X20 Y0 I10 J0
        </text>

        {/* R */}
        <rect x="164" y="24" width="144" height="96" rx="7" fill="#0f172a" fillOpacity="0.55" stroke="#334155" />
        <text x="172" y="38" fontSize="10" fontWeight="700" fill="#34d399">
          радиус: R
        </text>
        <path d="M186 84 A36 36 0 0 1 258 84" fill="none" stroke="#34d399" strokeWidth="1.6" markerEnd="url(#in9-3-arc2)" />
        <path d="M186 84 H258" stroke="#34d399" strokeWidth="0.8" strokeDasharray="3 3" strokeOpacity="0.45" />
        <circle cx="186" cy="84" r="2.2" fill="#34d399" />
        <circle cx="258" cy="84" r="2.2" fill="#34d399" />
        <text x="230" y="64" fontSize="10" fontWeight="700" fill="#34d399">
          R10
        </text>
        <text x="172" y="98" fontSize="10" fill="#94a3b8">
          старт
        </text>
        <text x="246" y="98" fontSize="10" fill="#94a3b8">
          конец
        </text>
        <text x="172" y="114" fontSize="10" fill="#34d399">
          G2 X20 Y0 R10
        </text>

        <rect x="12" y="124" width="296" height="52" rx="6" fill="#34d399" fillOpacity="0.08" stroke="#34d399" strokeOpacity="0.3" />
        <text x="22" y="136" fontSize="10" fill="#e2e8f0">
          полная окружность и дуги &gt;180° — только I и J
        </text>
        <text x="22" y="152" fontSize="10" fill="#34d399">
          в строке либо I с J, либо R — не смешивать
        </text>
        <text x="22" y="168" fontSize="10" fill="#94a3b8">
          I и J считаются от текущей точки, а не от нуля
        </text>
      </svg>
    </VisualWrapper>
  );
}
