import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Кадр блока 7 урока IN1 «Инженерные материалы и совместимость».
 *
 * Макет из описания кадра `IN1_strength_table.png`: одна и та же сила приходит
 * к трём полосам, а отвечают они по-разному. PLA жёсткий и хрупкий — ломается
 * сразу. PA и TPU вязкие — гнутся и возвращаются. Третья полоса сначала
 * тянется, и только потом рвётся. Подписи взяты из блоков 6 и 7.
 */
export function EngineerIN1Image1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Сила и жёсткость: три полосы под одной силой. PLA жёсткий и хрупкий — ломается сразу. PA и TPU вязкие — гнутся и возвращаются. Третья полоса перед разрывом сначала тянется. Главная мысль: прочность и жёсткость — не одно и то же"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />

        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          одна сила — три ответа
        </text>

        {/* PLA: жёсткая полоса с трещиной посередине. */}
        <line x1="83" y1="34" x2="83" y2="48" stroke="#e2e8f0" strokeWidth="1.5" />
        <path d="M78 33 L88 33 L83 43 Z" fill="#e2e8f0" />
        <rect x="24" y="50" width="118" height="10" rx="2" fill="#60a5fa" fillOpacity="0.35" stroke="#60a5fa" />
        <path d="M83 50 L78 55 L87 59 L79 64 L83 66" stroke="#f87171" strokeWidth="2" fill="none" />
        <path d="M34 60 L29 68 L39 68 Z" fill="#475569" />
        <path d="M132 60 L127 68 L137 68 Z" fill="#475569" />
        <text x="162" y="44" fontSize="10" fontWeight="700" fill="#e2e8f0">
          PLA
        </text>
        <text x="162" y="56" fontSize="10" fill="#cbd5e1">
          жёсткий и хрупкий
        </text>
        <text x="162" y="68" fontSize="10" fill="#f87171">
          ломается сразу
        </text>

        {/* PA и TPU: полоса гнётся и возвращается. */}
        <path d="M24 88 H142" stroke="#475569" strokeDasharray="3 3" />
        <path d="M24 88 Q83 118 142 88" stroke="#10b981" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M62 84 Q83 74 104 84" stroke="#10b981" strokeWidth="1.5" fill="none" />
        <path d="M104 84 L97 79 L97 87 Z" fill="#10b981" />
        <text x="162" y="86" fontSize="10" fontWeight="700" fill="#e2e8f0">
          PA · TPU
        </text>
        <text x="162" y="98" fontSize="10" fill="#cbd5e1">
          вязкие
        </text>
        <text x="162" y="110" fontSize="10" fill="#10b981">
          гнётся и возвращается
        </text>

        {/* Третья полоса: шейка и растяжение до разрыва. */}
        <path
          d="M30 134 H60 L66 140 H116 L122 134 H136 V146 H122 L116 152 H66 L60 146 H30 Z"
          fill="#f59e0b"
          fillOpacity="0.3"
          stroke="#f59e0b"
        />
        <line x1="20" y1="140" x2="28" y2="140" stroke="#e2e8f0" strokeWidth="1.5" />
        <path d="M18 136 L18 144 L10 140 Z" fill="#e2e8f0" />
        <line x1="148" y1="140" x2="140" y2="140" stroke="#e2e8f0" strokeWidth="1.5" />
        <path d="M150 136 L150 144 L158 140 Z" fill="#e2e8f0" />
        <text x="162" y="130" fontSize="10" fontWeight="700" fill="#e2e8f0">
          перед разрывом
        </text>
        <text x="162" y="142" fontSize="10" fill="#cbd5e1">
          сначала тянется
        </text>
        <text x="162" y="154" fontSize="10" fill="#f59e0b">
          потом рвётся
        </text>
      </svg>
    </VisualWrapper>
  );
}
