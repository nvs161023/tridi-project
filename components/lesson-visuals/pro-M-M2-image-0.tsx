import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Центр стола: вокруг него строится всё построение кадра. */
const CX = 160;
const CY = 96;

/**
 * Восемь камер по орбите обхода: угол в градусах, радиусы эллипса орбиты —
 * 100 по X и 52 по Y (вид сверху сплющивает круг).
 */
const CAMERA_ANGLES = [90, 45, 0, -45, -90, -135, 180, 135];

/** Дуга вращения стола вокруг детали: точки по окружности радиуса 30. */
const SPIN_ARC = [
  [134, 81],
  [145, 70],
  [160, 66],
  [175, 70],
  [186, 81],
];

/**
 * Фотограмметрия: вид сверху на вращающийся стол с деталью, по орбите стоят
 * восемь камер с шагом 45 градусов, вокруг детали — стрелка вращения стола, внизу
 * счётчик кадров.
 *
 * Ровно по content урока: «Схема: 20–50 фото по кругу. Объект на вращающемся
 * столе», по text: «Камера + свет. 20–50 фото вокруг объекта» и по warning:
 * «Фотограмметрия не работает для блестящих и прозрачных объектов. Нужно
 * матировать».
 *
 * От «кольца подписей» (K1-image-0) отличается предметом и построением: там
 * плашки со словами вокруг детали, здесь вид сверху — сплющенный эллипс стола,
 * орбита камер и вращение. Вида сверху со столом и орбитой камер в курсе нет.
 *
 * Анимация 6 с, по кругу: камеры по очереди срабатывают вспышкой, стол
 * поворачивается. При prefers-reduced-motion кадры стоят, стол показан в работе.
 *
 * Классы с префиксом v-mm2i: <style> внутри SVG действует на всю страницу.
 */
export function ProMM2Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Фотограмметрия: вид сверху на вращающийся стол с деталью, по орбите вокруг стоят восемь камер с шагом 45 градусов, вокруг детали — круговая стрелка вращения, внизу подписи — 20–50 фото на обход и что блестящее нужно матировать"
      animated={animated}
    >
      <svg
        viewBox="0 0 320 180"
        className="w-full h-full"
        aria-hidden="true"
        fontFamily={FONT}
      >
        <style>{`
          .v-mm2i-cam { animation: v-mm2i-flash 6s linear infinite; animation-fill-mode: backwards; }
          .v-mm2i-spin {
            animation: v-mm2i-spin 6s linear infinite;
            transform-box: view-box;
            transform-origin: 160px 96px;
          }
          @keyframes v-mm2i-flash {
            0% { opacity: 0.35; }
            6% { opacity: 1; }
            12% { opacity: 0.35; }
            100% { opacity: 0.35; }
          }
          @keyframes v-mm2i-spin {
            0% { transform: rotate(0deg); opacity: 0.4; }
            15% { opacity: 1; }
            80% { transform: rotate(360deg); opacity: 1; }
            100% { transform: rotate(360deg); opacity: 0.4; }
          }
          @media (prefers-reduced-motion: reduce) {
            .v-mm2i-cam { animation: none; opacity: 1; }
            .v-mm2i-spin { animation: none; opacity: 1; }
          }
        `}</style>

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
          Фотограмметрия: обход по кругу
        </text>
        <text x="12" y="30" fontSize="7.5" fill="#e2e8f0">
          камера+свет
        </text>
        <text x="250" y="30" fontSize="7.5" fill="#94a3b8">
          шаг 45°
        </text>


        {/* Стол вид сверху: сплющенный круг и внутреннее кольцо */}
        <ellipse cx={CX} cy={CY} rx="66" ry="50" fill="#334155" stroke="#64748b" />
        <ellipse cx={CX} cy={CY} rx="54" ry="40" fill="none" stroke="#475569" />

        {/* Деталь на столе */}
        <rect x="152" y="86" width="16" height="20" rx="2" fill="#64748b" />

        {/* Стрелка вращения стола вокруг детали */}
        <g className="v-mm2i-spin">
          <polyline
            points={SPIN_ARC.map(([x, y]) => `${x},${y}`).join(" ")}
            fill="none"
            stroke="#fbbf24"
            strokeWidth="1.4"
          />
          <polygon points="190,78 182,78 187,85" fill="#fbbf24" />
        </g>

        {/* Орбита обхода: восемь камер с шагом 45 градусов */}
        <ellipse
          cx={CX}
          cy={CY}
          rx="100"
          ry="52"
          fill="none"
          stroke="#475569"
          strokeDasharray="4 4"
        />
        {CAMERA_ANGLES.map((angle, index) => {
          const radians = (angle * Math.PI) / 180;
          const x = CX + 100 * Math.cos(radians);
          const y = CY - 52 * Math.sin(radians);

          return (
            <g key={`cam-${angle}`} className="v-mm2i-cam" style={{ animationDelay: `${index * 0.6}s` }}>
              <rect
                x={x - 7}
                y={y - 5}
                width="14"
                height="10"
                rx="2"
                fill="#0f172a"
                stroke="#34d399"
                strokeWidth="1.2"
              />
              <circle cx={x} cy={y} r="2.6" fill="#34d399" />
            </g>
          );
        })}

        <text x="12" y="170" fontSize="7.5" fill="#e2e8f0">
          20–50 фото на обход
        </text>
        <text x="192" y="170" fontSize="7.5" fill="#e2e8f0">
          блестящее — матировать
        </text>
      </svg>
    </VisualWrapper>
  );
}
