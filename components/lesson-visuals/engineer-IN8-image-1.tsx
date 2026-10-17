import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Кадр блока 9 урока IN8 «Из скана в CAD: параметрическая деталь».
 *
 * Сравнение «до и после» из описания `IN8_noise_holes.png`: слева шумная
 * поверхность с иглами, оболочками и дырой от метки, справа — та же форма после
 * чистки. Цифры — из блоков 5, 9 и 13.
 */
export function EngineerIN8Image1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="До и после чистки: слева поверхность с иглами шума, оболочками и дырой от метки, справа — ровная целая поверхность. Шум меньше 0,1 мм сглаживают, форму при этом не меняют. Чистка занимает 20–30 минут, упрощение идёт после неё"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          шум и дыры: до и после чистки
        </text>

        {/* Панель «до» */}
        <rect x="12" y="26" width="140" height="96" rx="7" fill="#0f172a" fillOpacity="0.55" stroke="#334155" />
        <text x="22" y="40" fontSize="10" fontWeight="700" fill="#f87171">
          до чистки
        </text>
        <path
          d="M22 92 L28 68 L32 88 L40 60 L44 86 L52 56 L56 84 L64 62 L68 90 L76 58 L80 86 L90 64 L94 90 L102 60 L106 88 L116 66 L120 92 L128 70 L132 94 L142 78 L146 96 L146 104 L22 104 Z"
          fill="#38bdf8"
          fillOpacity="0.12"
          stroke="#38bdf8"
          strokeWidth="1"
        />
        <circle cx="42" cy="50" r="2" fill="#f87171" />
        <circle cx="98" cy="52" r="1.6" fill="#f87171" />
        <circle cx="66" cy="47" r="1.4" fill="#f87171" />
        <circle cx="118" cy="94" r="7" fill="#020617" stroke="#f87171" strokeWidth="1.2" strokeDasharray="3 2" />
        <text x="106" y="114" fontSize="10" fill="#f87171">
          дыра
        </text>

        {/* Панель «после» */}
        <rect x="168" y="26" width="140" height="96" rx="7" fill="#0f172a" fillOpacity="0.55" stroke="#334155" />
        <text x="178" y="40" fontSize="10" fontWeight="700" fill="#34d399">
          после чистки
        </text>
        <path
          d="M178 90 Q190 76 202 84 Q214 92 228 80 Q242 70 256 82 Q270 92 282 80 Q292 72 298 82 L298 104 L178 104 Z"
          fill="#34d399"
          fillOpacity="0.14"
          stroke="#34d399"
          strokeWidth="1.2"
        />

        <text x="12" y="136" fontSize="10" fill="#cbd5e1">
          иглы — блик, пыль, ворс · дыра от метки
        </text>
        <text x="12" y="152" fontSize="10" fill="#cbd5e1">
          шум меньше 0,1 мм: сглаживаем, форму не трогаем
        </text>
        <text x="12" y="168" fontSize="10" fill="#fbbf24">
          чистка 20–30 минут, упрощение — после неё
        </text>
      </svg>
    </VisualWrapper>
  );
}
