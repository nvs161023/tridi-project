import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Кадр блока 31 урока IN2 «Нагрузки и прочность детали».
 *
 * Макет из описания кадра `IN2_test_coupon.png`: три образца 80 × 20 × 5 мм и
 * консоль под грузом на сутки. Числа — из блока 30: прогиб больше 2 мм на
 * 100 мм длины значит, что пора добавлять ребро.
 */
export function EngineerIN2Image6({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Проверка ориентации на образцах. Три бруска 80 на 20 на 5 мм: вдоль слоёв, поперёк слоёв и после сушки. Рядом консоль под грузом на 24 часа: если прогиб больше 2 мм на 100 мм длины, добавляй ребро. Трещина между слоями значит, что ориентацию пора менять"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />

        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          три образца и прогиб на сутки
        </text>

        <rect
          x="12"
          y="24"
          width="140"
          height="104"
          rx="8"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#334155"
        />
        <text x="20" y="38" fontSize="10" fill="#94a3b8">
          80 × 20 × 5 мм
        </text>

        <rect x="18" y="46" width="60" height="13" rx="2" fill="#334155" stroke="#64748b" />
        <line x1="20" y1="50" x2="76" y2="50" stroke="#94a3b8" strokeOpacity="0.5" />
        <line x1="20" y1="54" x2="76" y2="54" stroke="#94a3b8" strokeOpacity="0.5" />
        <text x="86" y="55" fontSize="10" fontWeight="700" fill="#10b981">
          вдоль
        </text>

        <rect x="18" y="68" width="60" height="13" rx="2" fill="#334155" stroke="#64748b" />
        <line x1="28" y1="70" x2="28" y2="79" stroke="#94a3b8" strokeOpacity="0.5" />
        <line x1="38" y1="70" x2="38" y2="79" stroke="#94a3b8" strokeOpacity="0.5" />
        <line x1="58" y1="70" x2="58" y2="79" stroke="#94a3b8" strokeOpacity="0.5" />
        <line x1="68" y1="70" x2="68" y2="79" stroke="#94a3b8" strokeOpacity="0.5" />
        <polyline
          points="49,68 46,72 52,76 49,81"
          fill="none"
          stroke="#f87171"
          strokeWidth="1.5"
        />
        <text x="86" y="77" fontSize="10" fontWeight="700" fill="#f87171">
          поперёк
        </text>

        <rect x="18" y="90" width="60" height="13" rx="2" fill="#334155" stroke="#64748b" />
        <line x1="20" y1="94" x2="76" y2="94" stroke="#94a3b8" strokeOpacity="0.5" />
        <line x1="20" y1="98" x2="76" y2="98" stroke="#94a3b8" strokeOpacity="0.5" />
        <text x="86" y="99" fontSize="10" fontWeight="700" fill="#f59e0b">
          после сушки
        </text>
        <text x="20" y="118" fontSize="10" fill="#94a3b8">
          сухой рвётся иначе
        </text>

        <rect
          x="158"
          y="24"
          width="150"
          height="104"
          rx="8"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#334155"
        />
        <text x="166" y="38" fontSize="10" fill="#94a3b8">
          консоль на сутки
        </text>
        <rect x="164" y="52" width="8" height="48" fill="#475569" />
        <rect x="172" y="64" width="96" height="12" rx="2" fill="#334155" stroke="#64748b" />
        <path
          d="M 172 70 Q 226 70 268 84"
          fill="none"
          stroke="#f59e0b"
          strokeDasharray="3 2"
        />
        <line x1="262" y1="76" x2="262" y2="92" stroke="#cbd5e1" />
        <rect x="254" y="92" width="16" height="12" rx="2" fill="#475569" stroke="#64748b" />
        <text x="276" y="101" fontSize="10" fill="#fcd34d">
          24 ч
        </text>

        <line x1="269" y1="70" x2="275" y2="70" stroke="#94a3b8" />
        <line x1="269" y1="84" x2="275" y2="84" stroke="#94a3b8" />
        <line x1="272" y1="70" x2="272" y2="84" stroke="#94a3b8" />
        <text x="277" y="79" fontSize="10" fill="#cbd5e1">
          2 мм
        </text>
        <text x="166" y="118" fontSize="10" fill="#94a3b8">
          прогиб на 100 мм
        </text>

        <line x1="12" y1="136" x2="308" y2="136" stroke="#334155" />
        <text x="12" y="150" fontSize="10" fill="#e2e8f0">
          трещина между слоями → меняй ориентацию
        </text>
        <text x="12" y="166" fontSize="10" fill="#fcd34d">
          прогиб больше 2 мм на 100 мм → добавляй ребро
        </text>
      </svg>
    </VisualWrapper>
  );
}
