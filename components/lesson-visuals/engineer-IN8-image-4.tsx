import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Кадр блока 16 урока IN8 «Из скана в CAD: параметрическая деталь».
 *
 * Сравнение двух путей из описания `IN8_mesh_to_brep.png`: автоматический перевод
 * (Convert Mesh, Prismatic и Face) и ручная перемодель по сечениям. Числа граней и
 * отклонения — из блоков 16 и 19, «где какой путь быстрее» — заголовок блока.
 */
export function EngineerIN8Image4({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Автоматический перевод и ручная перемодель: где какой путь быстрее. Автомат Convert Mesh с режимами Prismatic и Face даёт около 340 граней и волну на стенке — больше ста граней уже плохо. Вручную обводят сечения плоскостями и дугами, отклонение ±0,5 мм, параметры уходят в дерево и правятся числом. Больше трёхсот граней — переделывать: хорошее тело это десяток плоскостей и цилиндры"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          автомат и вручную: где какой путь
        </text>

        {/* Автоматический перевод */}
        <rect x="12" y="26" width="142" height="100" rx="7" fill="#0f172a" fillOpacity="0.55" stroke="#334155" />
        <rect x="12" y="26" width="142" height="2.5" rx="1.2" fill="#38bdf8" fillOpacity="0.85" />
        <text x="20" y="42" fontSize="10" fontWeight="700" fill="#38bdf8">
          автомат
        </text>
        <path d="M124 44 L128 34 L132 42 L136 32 L140 40 L144 36" fill="none" stroke="#f87171" strokeWidth="1.1" />
        <text x="20" y="56" fontSize="10" fill="#94a3b8">
          Convert Mesh
        </text>
        <text x="20" y="72" fontSize="10" fill="#cbd5e1">
          Prismatic / Face
        </text>
        <text x="20" y="86" fontSize="10" fill="#cbd5e1">
          340 граней
        </text>
        <text x="20" y="100" fontSize="10" fill="#fbbf24">
          волна на стенке
        </text>
        <text x="20" y="114" fontSize="10" fill="#f87171">
          &gt; 100 — плохо
        </text>

        {/* Ручная перемодель */}
        <rect x="166" y="26" width="142" height="100" rx="7" fill="#0f172a" fillOpacity="0.55" stroke="#334155" />
        <rect x="166" y="26" width="142" height="2.5" rx="1.2" fill="#34d399" fillOpacity="0.85" />
        <text x="174" y="42" fontSize="10" fontWeight="700" fill="#34d399">
          вручную
        </text>
        <rect x="278" y="33" width="14" height="9" fill="none" stroke="#34d399" strokeWidth="1.1" />
        <circle cx="297" cy="38" r="4.5" fill="none" stroke="#34d399" strokeWidth="1.1" />
        <text x="174" y="56" fontSize="10" fill="#94a3b8">
          обвести сечения
        </text>
        <text x="174" y="72" fontSize="10" fill="#cbd5e1">
          плоскости и дуги
        </text>
        <text x="174" y="86" fontSize="10" fill="#cbd5e1">
          точность ±0,5 мм
        </text>
        <text x="174" y="100" fontSize="10" fill="#cbd5e1">
          параметры в дереве
        </text>
        <text x="174" y="114" fontSize="10" fill="#34d399">
          правится числом
        </text>

        <rect x="12" y="132" width="296" height="20" rx="6" fill="#ef4444" fillOpacity="0.1" stroke="#ef4444" strokeOpacity="0.4" />
        <text x="22" y="146" fontSize="10" fill="#fca5a5">
          &gt; 300 граней — переделывать
        </text>
        <text x="12" y="168" fontSize="10" fill="#cbd5e1">
          хорошее тело: десяток плоскостей и цилиндры
        </text>
      </svg>
    </VisualWrapper>
  );
}
