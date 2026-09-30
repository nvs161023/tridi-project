import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Отрезок полосы времени: цвет и подпись внутри; без подписи — только цвет. */
type Segment = {
  x: number;
  w: number;
  fill: string;
  opacity: number;
  label?: string;
  className?: string;
};

/**
 * Верхняя полоса — «с оператором»: между печатью разрыв, деталь меняет человек.
 * Позиции в шкале полосы: x = 96 — начало цикла, x = 300 — конец.
 */
const BAR_OPERATOR: Segment[] = [
  { x: 96, w: 96, fill: "#38bdf8", opacity: 0.4, label: "печать" },
  { x: 208, w: 26, fill: "#fbbf24", opacity: 0.35, label: "смена" },
  { x: 234, w: 66, fill: "#38bdf8", opacity: 0.4, label: "печать" },
];

/** Нижняя полоса — «24/7»: печать и смена стыкуются, разрыва нет. */
const BAR_ROUND: Segment[] = [
  { x: 96, w: 98, fill: "#38bdf8", opacity: 0.4, label: "печать" },
  { x: 194, w: 20, fill: "#34d399", opacity: 0.4, className: "v-oo2a-seg" },
  { x: 214, w: 86, fill: "#38bdf8", opacity: 0.4, label: "печать" },
];

/**
 * «Смена пластины» — циклограмма: две полосы времени одна над другой, и разница
 * видна без чисел. Верхняя полоса рвётся: печать, пустой разрыв (деталь ждёт
 * оператора), смена, печать. Нижняя идёт без разрыва: пластина с готовой деталью
 * уезжает, пустая встаёт на её место, печать продолжается.
 *
 * Приём «полоса времени с простоями» в курсе не занят: у N-N1 пять состояний
 * устройства, у N-N2 фронтальная сцена, у остальных кадров диаграммы и графики.
 * Наложенных подписей нет, кадр дублирует content урока словами: «принтер
 * заканчивает модель, пластина снимается, ставится новая, печать продолжается без
 * оператора» — и tip про дом и ферму.
 *
 * Цифр в кадре нет намеренно: в content и items этого блока их нет, кроме цены
 * систем, а цена в циклограмме неуместна. Всё движение — по времени: бегунок идёт
 * по полосам один раз за цикл, разрыв мигает, когда бегунок по нему проходит, а
 * пластины меняются местами в тот же момент. Бегунок, разрыв и подмена пластин —
 * три разные скорости, поэтому три класса с общим сроком 8 s.
 *
 * Классы с префиксом v-oo2a: <style> внутри SVG действует на всю страницу.
 */
export function ProOO2Animation0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Циклограмма смены пластины: две полосы времени одна над другой. Верхняя, с оператором, рвётся — печать, пустой разрыв, пока деталь ждёт человека, смена, снова печать. Нижняя, 24 на 7, идёт без разрыва: пластина с готовой деталью уезжает влево, пустая встаёт на её место, печать продолжается. Бегунок проходит полосы один раз за цикл, разрыв вспыхивает в момент простоя."
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <style>{`
          .v-oo2a-head { animation: v-oo2a-head 8s linear infinite; }
          .v-oo2a-void { animation: v-oo2a-void 8s linear infinite; }
          .v-oo2a-seg { animation: v-oo2a-seg 8s linear infinite; }
          .v-oo2a-out { animation: v-oo2a-out 8s linear infinite; }
          .v-oo2a-in { animation: v-oo2a-in 8s linear infinite; }
          @keyframes v-oo2a-head {
            0%, 6% { transform: translateX(0); }
            90%, 100% { transform: translateX(204px); }
          }
          @keyframes v-oo2a-void {
            0%, 42% { opacity: 0.55; }
            47%, 53% { opacity: 1; }
            60%, 100% { opacity: 0.55; }
          }
          @keyframes v-oo2a-seg {
            0%, 44% { opacity: 0.6; }
            48%, 54% { opacity: 1; }
            60%, 100% { opacity: 0.6; }
          }
          @keyframes v-oo2a-out {
            0%, 4% { transform: translateX(0); opacity: 0; }
            10%, 44% { transform: translateX(0); opacity: 1; }
            52% { transform: translateX(-8px); opacity: 0; }
            57%, 100% { transform: translateX(-18px); opacity: 0; }
          }
          @keyframes v-oo2a-in {
            0%, 52% { transform: translateX(16px); opacity: 0; }
            60%, 92% { transform: translateX(0); opacity: 1; }
            96%, 100% { transform: translateX(16px); opacity: 0; }
          }
          @media (prefers-reduced-motion: reduce) {
            .v-oo2a-head { animation: none; transform: translateX(204px); }
            .v-oo2a-void { animation: none; opacity: 0.85; }
            .v-oo2a-seg { animation: none; opacity: 1; }
            .v-oo2a-out { animation: none; transform: translateX(-18px); opacity: 0; }
            .v-oo2a-in { animation: none; transform: translateX(0); opacity: 1; }
          }
        `}</style>

        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          циклограмма смены пластины
        </text>

        {/* Верхняя полоса: с оператором */}
        <rect x="96" y="40" width="204" height="20" rx="3" fill="#0f172a" stroke="#334155" />
        {BAR_OPERATOR.map((segment) => (
          <rect
            key={`op-${segment.x}`}
            x={segment.x}
            y="42"
            width={segment.w}
            height="16"
            fill={segment.fill}
            fillOpacity={segment.opacity}
          />
        ))}
        {BAR_OPERATOR.filter((segment) => segment.label).map((segment) => (
          <text
            key={`op-label-${segment.x}`}
            x={segment.x + segment.w / 2}
            y="53"
            fontSize="7.5"
            fill="#e2e8f0"
            textAnchor="middle"
          >
            {segment.label}
          </text>
        ))}
        <text x="12" y="54" fontSize="8" fill="#e2e8f0">
          с оператором
        </text>
        <text x="200" y="34" fontSize="8" fill="#f87171" textAnchor="middle">
          простой
        </text>

        {/* Разрыв в верхней полосе: деталь ждёт оператора */}
        <rect
          x="192"
          y="42"
          width="16"
          height="16"
          fill="#f87171"
          fillOpacity="0.12"
          stroke="#f87171"
          strokeOpacity="0.3"
          strokeDasharray="3 2"
          className="v-oo2a-void"
        />

        {/* Нижняя полоса: 24/7 без разрыва — сегменты стыкуются вплотную */}
        <rect x="96" y="84" width="204" height="20" rx="3" fill="#0f172a" stroke="#334155" />
        {BAR_ROUND.map((segment) => (
          <rect
            key={`round-${segment.x}`}
            x={segment.x}
            y="86"
            width={segment.w}
            height="16"
            fill={segment.fill}
            fillOpacity={segment.opacity}
            className={segment.className}
          />
        ))}
        {BAR_ROUND.filter((segment) => segment.label).map((segment) => (
          <text
            key={`round-label-${segment.x}`}
            x={segment.x + segment.w / 2}
            y="97"
            fontSize="7.5"
            fill="#e2e8f0"
            textAnchor="middle"
          >
            {segment.label}
          </text>
        ))}
        <text x="12" y="98" fontSize="8" fill="#e2e8f0">
          24/7 с системой
        </text>
        <text x="204" y="116" fontSize="7.5" fill="#34d399" textAnchor="middle">
          смена автоматически
        </text>

        {/* Пластины в момент смены: старая уезжает с деталью, пустая встаёт на место */}
        <g className="v-oo2a-out">
          <rect x="197" y="90" width="14" height="9" rx="1" fill="#1e293b" stroke="#f87171" />
          <rect x="199.5" y="92" width="9" height="5" fill="#94a3b8" fillOpacity="0.55" />
        </g>
        <g className="v-oo2a-in">
          <rect x="197" y="90" width="14" height="9" rx="1" fill="#1e293b" stroke="#34d399" />
          <line x1="199" y1="94.5" x2="209" y2="94.5" stroke="#34d399" strokeOpacity="0.4" />
        </g>

        {/* Бегунок: тонкая линия по обеим полосам, головка не задевает подписи сверху */}
        <g className="v-oo2a-head">
          <line x1="96" y1="39" x2="96" y2="103" stroke="#e2e8f0" strokeOpacity="0.8" strokeWidth="1.2" />
          <rect x="94.5" y="39" width="3" height="4" fill="#e2e8f0" />
        </g>

        <text x="12" y="134" fontSize="8" fill="#f87171">
          оператор: печать стоит, пока не поменяет
        </text>
        <text x="12" y="148" fontSize="8" fill="#34d399">
          система: простой только на смену
        </text>
        <text x="12" y="166" fontSize="8" fill="#94a3b8">
          деталь готова — принтер печатает следующую
        </text>
      </svg>
    </VisualWrapper>
  );
}
