import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const PAUSE_STEPS = [
  "1 Z +2 мм",
  "2 отвод к краю",
  "3 ретракт 2 мм",
  "4 SAVE_GCODE_STATE",
  "5 M117",
  "6 моторы",
];

/**
 * Кадр блока 16 урока IN10 «Макросы Klipper и постобработка».
 *
 * Макет из описания `IN10_control_macros.png`: печать, пауза, человек и два выхода.
 * Шесть шагов паузы — блок 14 (Z +2 мм, отвод, ретракт 2 мм, SAVE_GCODE_STATE,
 * M117, моторы), обязанности RESUME и CANCEL_PRINT — блок 15, предупреждение о
 * паузе без отвода — блок 17.
 */
export function EngineerIN10Diagram2({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Цепочка состояний печати: печать переходит в паузу, пауза отдаёт управление человеку, дальше два выхода — RESUME возвращает позицию и прогревает сопло, CANCEL_PRINT выключает нагрев и паркует оси. Порядок паузы: поднять сопло на два миллиметра, отвести к краю, сделать ретракт на два миллиметра, сохранить состояние, вывести сообщение M117, снять ток с моторов. Без отвода сопло оставит вмятину и нашлёпку"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          состояния печати: пауза, возврат, отмена
        </text>

        <rect x="12" y="26" width="84" height="26" rx="6" fill="#334155" stroke="#475569" />
        <text x="54" y="43" fontSize="10" fill="#e2e8f0" textAnchor="middle">
          печать
        </text>
        <rect x="116" y="26" width="96" height="26" rx="6" fill="#38bdf8" fillOpacity="0.14" stroke="#38bdf8" strokeOpacity="0.5" />
        <text x="164" y="43" fontSize="10" fill="#38bdf8" textAnchor="middle">
          пауза
        </text>
        <rect x="232" y="26" width="76" height="26" rx="6" fill="#a78bfa" fillOpacity="0.14" stroke="#a78bfa" strokeOpacity="0.5" />
        <text x="270" y="43" fontSize="10" fill="#c4b5fd" textAnchor="middle">
          человек
        </text>

        <path d="M98 39 H108" stroke="#64748b" strokeWidth="1" />
        <polygon points="108,35.5 114,39 108,42.5" fill="#64748b" />
        <path d="M214 39 H224" stroke="#64748b" strokeWidth="1" />
        <polygon points="224,35.5 230,39 224,42.5" fill="#64748b" />

        <rect x="12" y="62" width="184" height="72" rx="7" fill="#0f172a" fillOpacity="0.55" stroke="#334155" />
        <text x="18" y="76" fontSize="10" fontWeight="700" fill="#38bdf8">
          порядок паузы
        </text>
        {PAUSE_STEPS.map((step, i) => (
          <text
            key={step}
            x={i % 2 === 0 ? 18 : 96}
            y={92 + Math.floor(i / 2) * 15}
            fontSize="10"
            fill="#e2e8f0"
            textLength={step === "4 SAVE_GCODE_STATE" ? 90 : undefined}
            lengthAdjust="spacingAndGlyphs"
          >
            {step}
          </text>
        ))}

        <rect x="200" y="62" width="108" height="46" rx="6" fill="#34d399" fillOpacity="0.1" stroke="#34d399" strokeOpacity="0.35" />
        <text x="210" y="76" fontSize="10" fontWeight="700" fill="#34d399">
          RESUME
        </text>
        <text x="210" y="90" fontSize="10" fill="#e2e8f0">
          вернуть позицию
        </text>
        <text x="210" y="104" fontSize="10" fill="#94a3b8">
          прогреть и промыть
        </text>

        <rect x="200" y="110" width="108" height="32" rx="6" fill="#fbbf24" fillOpacity="0.1" stroke="#fbbf24" strokeOpacity="0.35" />
        <text x="210" y="123" fontSize="10" fontWeight="700" fill="#fbbf24">
          CANCEL_PRINT
        </text>
        <text x="210" y="138" fontSize="10" fill="#e2e8f0">
          нагрев off · парковка
        </text>

        <rect x="12" y="146" width="296" height="28" rx="6" fill="#f43f5e" fillOpacity="0.1" stroke="#f43f5e" strokeOpacity="0.3" />
        <text x="22" y="163" fontSize="10" fill="#e2e8f0">
          без отвода — вмятина и нашлёпка
        </text>
      </svg>
    </VisualWrapper>
  );
}
