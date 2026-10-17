import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Кадр блока 7 урока IN7 «Сканирование и фотограмметрия».
 *
 * Макет из описания `IN7_laser_triangle.png`: лазер, камера и точка на детали
 * образуют треугольник, расстояние считается по углу возврата. Справа числа из
 * блока 6 — точность 0,05–0,2 мм и цены ручных и настольных моделей. Внизу
 * предупреждение о слепых зонах, которые домеривают инструментом.
 */
export function EngineerIN7Diagram1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Лазерная триангуляция: лазер и камера стоят на базе, луч лазера и камера смотрят в одну точку на детали. По углу возврата прибор считает расстояние. Точность 0,05–0,2 миллиметра, ручные модели стоят от 20 до 150 тысяч рублей, настольные — сотни тысяч. Слепые зоны: внутренние углы и глубокие пазы, их домеривают штангенциркулем"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          лазерная триангуляция: расстояние по углу
        </text>

        {/* База между лазером и камерой */}
        <line x1="60" y1="40" x2="126" y2="40" stroke="#64748b" strokeWidth="1" strokeDasharray="3 3" />
        <text x="93" y="35" fontSize="10" fill="#94a3b8" textAnchor="middle">
          база
        </text>

        {/* Лазер */}
        <rect x="16" y="32" width="44" height="18" rx="4" fill="#0f172a" stroke="#f59e0b" />
        <text x="38" y="44" fontSize="10" fill="#fbbf24" textAnchor="middle">
          лазер
        </text>
        <line x1="60" y1="44" x2="93" y2="113" stroke="#f59e0b" strokeWidth="1.4" />

        {/* Камера */}
        <rect x="126" y="32" width="50" height="18" rx="4" fill="#0f172a" stroke="#38bdf8" />
        <text x="151" y="44" fontSize="10" fill="#7dd3fc" textAnchor="middle">
          камера
        </text>
        <line x1="126" y1="44" x2="99" y2="113" stroke="#38bdf8" strokeWidth="1.4" />

        {/* Угол возврата */}
        <path d="M88 104 A14 14 0 0 1 106 104" fill="none" stroke="#e2e8f0" strokeWidth="0.9" strokeDasharray="2 2" />

        {/* Деталь и точка */}
        <rect x="20" y="122" width="152" height="12" rx="2" fill="#334155" stroke="#64748b" />
        <circle cx="96" cy="116" r="3.2" fill="#f87171" stroke="#fecaca" strokeWidth="0.8" />
        <text x="103" y="120" fontSize="10" fill="#fca5a5">
          точка
        </text>

        {/* Числа из блока 6 */}
        <rect x="196" y="22" width="112" height="116" rx="7" fill="#0f172a" fillOpacity="0.45" stroke="#334155" />
        <text x="206" y="40" fontSize="10" fill="#94a3b8">
          точность
        </text>
        <text x="206" y="56" fontSize="11" fontWeight="700" fill="#e2e8f0">
          0,05–0,2 мм
        </text>
        <text x="206" y="76" fontSize="10" fill="#94a3b8">
          ручной
        </text>
        <text x="206" y="92" fontSize="11" fontWeight="700" fill="#e2e8f0">
          20–150 тыс. ₽
        </text>
        <text x="206" y="106" fontSize="10" fill="#94a3b8">
          настольный
        </text>
        <text x="206" y="122" fontSize="11" fontWeight="700" fill="#e2e8f0">
          сотни тысяч ₽
        </text>

        <text x="12" y="152" fontSize="10" fill="#cbd5e1">
          слепые зоны: внутренние углы и пазы
        </text>
        <text x="12" y="168" fontSize="10" fill="#fbbf24">
          их домеривают штангенциркулем
        </text>
      </svg>
    </VisualWrapper>
  );
}
