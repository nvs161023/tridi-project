import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * СИЗ из content урока: «Фото: нитриловые перчатки, очки, респиратор. Под
 * каждым — для чего», тексты про ацетон («горючий, токсичный… пары тяжелее
 * воздуха»), IPA и эпоксидку («аллерген. Перчатки обязательны») и вопрос теста
 * модуля «Нитриловые перчатки растворитель не пропускают, тканевые впитывают».
 *
 * Кадр про ТЕЛО, а не про среду: в модуле A-без нарисованы выбросы UFP и VOC и
 * схема вентиляции, здесь три пары «опасность → защита» — кожа, глаза, дыхание.
 * Это не каталог покупок: слева стоит угроза с пояснением «от чего», справа —
 * предмет защиты, а у перчаток рядом показана тканевая с красным крестом.
 *
 * Подписи держат зазор ≥8 px от иконок, строки — шаг ≥14 px: проверено
 * check_visuals и check_text_bounds.
 */
const ROWS = [
  {
    threat: "ацетон, эпоксидка",
    effect: "обезжиривают кожу",
    dangerY: 46,
    effectY: 60,
  },
  {
    threat: "брызги растворителя",
    effect: "попадают в глаза",
    dangerY: 86,
    effectY: 100,
  },
  {
    threat: "пары ацетона",
    effect: "в лёгкие, токсичны",
    dangerY: 126,
    effectY: 140,
  },
];

/** «СИЗ» — какая защита закрывает какую опасность. */
export function ProEHimEHim1Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="СИЗ по опасностям: ацетон и эпоксидка обезжиривают кожу — нужны нитриловые перчатки, тканевые перечёркнуты; брызги растворителя попадают в глаза — нужны защитные очки; пары ацетона токсичны — нужен респиратор"
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

        <text x="12" y="14" fontSize="10" fill="#94a3b8">
          СИЗ: что закрывает какую опасность
        </text>

        <text x="76" y="30" fontSize="8" fill="#f87171" textAnchor="middle">
          чем рискуешь
        </text>
        <text x="236" y="30" fontSize="8" fill="#34d399" textAnchor="middle">
          чем закрываем
        </text>

        {ROWS.map((row) => (
          <g key={row.threat}>
            <text x="30" y={row.dangerY} fontSize="8" fill="#e2e8f0">
              {row.threat}
            </text>
            <text x="30" y={row.effectY} fontSize="7.5" fill="#f87171">
              {row.effect}
            </text>
          </g>
        ))}

        {/* Иконки угроз: капля, брызги, пары */}
        <circle cx="20" cy="50" r="4" fill="#38bdf8" />
        <polygon points="15,48 25,48 20,40" fill="#38bdf8" />
        <circle cx="20" cy="94" r="3.5" fill="#38bdf8" />
        <line x1="12" y1="86" x2="16" y2="90" stroke="#38bdf8" />
        <line x1="28" y1="86" x2="24" y2="90" stroke="#38bdf8" />
        <line x1="20" y1="82" x2="20" y2="88" stroke="#38bdf8" />
        <path d="M12,142 q4,-6 8,0" fill="none" stroke="#a78bfa" strokeWidth="1.2" />
        <path d="M22,146 q4,-6 8,0" fill="none" stroke="#a78bfa" strokeWidth="1.2" />
        <path d="M12,152 q4,-6 8,0" fill="none" stroke="#a78bfa" strokeWidth="1.2" />

        {/* Стрелки «опасность → защита» */}
        <line x1="152" y1="56" x2="166" y2="56" stroke="#64748b" strokeWidth="2" />
        <polygon points="162,52 172,56 162,60" fill="#64748b" />
        <line x1="152" y1="96" x2="166" y2="96" stroke="#64748b" strokeWidth="2" />
        <polygon points="162,92 172,96 162,100" fill="#64748b" />
        <line x1="152" y1="136" x2="166" y2="136" stroke="#64748b" strokeWidth="2" />
        <polygon points="162,132 172,136 162,140" fill="#64748b" />
        {/* Нитриловая перчатка — годится; тканевая перечёркнута */}
        <rect
          x="180"
          y="42"
          width="16"
          height="20"
          rx="3"
          fill="#34d399"
          fillOpacity="0.4"
          stroke="#34d399"
        />
        <line x1="185" y1="42" x2="185" y2="56" stroke="#34d399" />
        <line x1="190" y1="42" x2="190" y2="58" stroke="#34d399" />
        <rect
          x="200"
          y="42"
          width="16"
          height="20"
          rx="3"
          fill="#64748b"
          fillOpacity="0.4"
          stroke="#64748b"
        />
        <line x1="198" y1="40" x2="218" y2="64" stroke="#f87171" strokeWidth="1.6" />
        <line x1="218" y1="40" x2="198" y2="64" stroke="#f87171" strokeWidth="1.6" />
        <text x="224" y="50" fontSize="7.5" fill="#34d399">
          нитриловые
        </text>
        <text x="224" y="64" fontSize="7.5" fill="#f87171">
          тканевые — нет
        </text>

        {/* Очки: две линзы и перемычка */}
        <rect
          x="182"
          y="88"
          width="16"
          height="12"
          rx="3"
          fill="#38bdf8"
          fillOpacity="0.35"
          stroke="#38bdf8"
        />
        <rect
          x="204"
          y="88"
          width="16"
          height="12"
          rx="3"
          fill="#38bdf8"
          fillOpacity="0.35"
          stroke="#38bdf8"
        />
        <line x1="198" y1="94" x2="204" y2="94" stroke="#38bdf8" />
        <text x="228" y="97" fontSize="7.5" fill="#34d399">
          защитные очки
        </text>

        {/* Респиратор: маска и два фильтра */}
        <rect
          x="184"
          y="128"
          width="24"
          height="16"
          rx="6"
          fill="#a78bfa"
          fillOpacity="0.4"
          stroke="#a78bfa"
        />
        <circle cx="190" cy="136" r="4" fill="#334155" stroke="#a78bfa" />
        <circle cx="202" cy="136" r="4" fill="#334155" stroke="#a78bfa" />
        <text x="216" y="137" fontSize="7.5" fill="#34d399">
          респиратор
        </text>
      </svg>
    </VisualWrapper>
  );
}
