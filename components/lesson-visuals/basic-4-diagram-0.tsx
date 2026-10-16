import type { ReactElement } from "react";

import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Акцент кадра: конвейер — синий базового курса. */
const ACCENT = "#3b82f6";

/**
 * Пять шагов конвейера ровно как в подписи блока 4: STL и 3MF, слои, контуры,
 * заполнение 20 %, G-код. Число есть только у четвёртого шага — «20 %» из той же
 * подписи, поэтому оно стоит внутри его рамки, а не в подписи под ней.
 */
const STEPS: { name: string; value?: string }[] = [
  { name: "STL и 3MF" },
  { name: "слои" },
  { name: "контуры" },
  { name: "заполнение", value: "20 %" },
  { name: "G-код" },
];

/**
 * Пять рамок по 44 px и четыре зазора по 14 px: 5 × 44 + 4 × 14 = 276 px внутри
 * полей 20…296. Стрелка-переход живёт в зазоре, поэтому лишнего места не нужно.
 * Рамка 52 px высотой: 13 px занимает номер, 20 px — эскиз, остальное — запас до
 * нижней границы, чтобы значение «20 %» стояло внутри, а не на самой рамке.
 */
const BOX_W = 44;
const BOX_H = 52;
const BOX_TOP = 28;
const BOX_LEFT = 20;
const BOX_STEP = BOX_W + 14;

/** Стрелка-переход: линия по центру рамок и треугольный наконечник. */
const ARROW_Y = BOX_TOP + BOX_H / 2;

/** Эскиз внутри рамки: на 2 px выше её верха, чтобы не сойтись со значением. */
const ICON_DY = -2;

/** Значение внутри рамки: базовая линия с запасом 4 px до нижней границы. */
const VALUE_DY = 48;

/** «20 %» шириной 22 px по центру рамки 44 px — отсюда отступ 11 px. */
const VALUE_DX = 11;

/** Подписи под рамками: левые края подобраны так, чтобы подпись шла по центру. */
const LABEL_Y = 92;
const LABEL_X = [18, 89, 139, 189, 260];

/** Нижняя панель: три строки из блока 3 про сам конвейер. */
const PANEL_TOP = 106;
const PANEL_HEIGHT = 66;

/** Шаг 1: файл модели — STL или 3MF, с загнутым углом, как в проводнике. */
const FILE_ICON = (
  <g>
    <path d="M13 17 h10 l5 5 v13 h-15 z" fill="#334155" stroke="#64748b" />
    <path d="M23 17 v5 h5" fill="none" stroke="#64748b" />
    <line x1="16" y1="27" x2="25" y2="27" stroke="#64748b" />
    <line x1="16" y1="31" x2="22" y2="31" stroke="#64748b" />
  </g>
);

/** Шаг 2: деталь разрезана на слои — три пластины друг над другом. */
const LAYERS_ICON = (
  <g>
    <rect x="12" y="19" width="22" height="4" rx="1" fill={ACCENT} fillOpacity="0.9" />
    <rect x="12" y="25" width="22" height="4" rx="1" fill="#475569" />
    <rect x="12" y="31" width="22" height="4" rx="1" fill="#334155" />
  </g>
);

/** Шаг 3: контуры — вложенные периметры стенки в разрезе детали. */
const CONTOUR_ICON = (
  <g>
    <rect x="12" y="18" width="22" height="20" fill="none" stroke={ACCENT} strokeWidth="1.5" />
    <rect x="17" y="23" width="12" height="10" fill="none" stroke="#64748b" />
  </g>
);

/** Шаг 4: заполнение внутри контура — решётка, её доля 20 % из подписи блока 4. */
const INFILL_ICON = (
  <g>
    <rect x="12" y="18" width="22" height="20" fill="none" stroke="#64748b" />
    <path d="M12 24 h22 M12 32 h22 M20 18 v20 M27 18 v20" stroke="#f59e0b" strokeOpacity="0.75" />
  </g>
);

/** Шаг 5: G-код — текстовый файл строк-команд для принтера. */
const GCODE_ICON = (
  <g>
    <line x1="13" y1="21" x2="33" y2="21" stroke={ACCENT} />
    <line x1="13" y1="27" x2="30" y2="27" stroke="#64748b" />
    <line x1="13" y1="33" x2="26" y2="33" stroke="#64748b" />
  </g>
);

const ICONS: ReactElement[] = [FILE_ICON, LAYERS_ICON, CONTOUR_ICON, INFILL_ICON, GCODE_ICON];

/**
 * Кадр блока 4 урока L4 «Конвейер: модель, слои, G-код».
 *
 * Компоновка — горизонтальная цепочка: пять рамок слева направо, между ними
 * стрелки перехода. Под каждой рамкой её шаг, внутри рамки — эскиз этого шага и
 * номер. Порядок шагов и все слова — из подписи блока 4: STL и 3MF, слои,
 * контуры, заполнение 20 %, G-код.
 *
 * Число 20 % — единственное в кадре, оно из той же подписи. Нижняя панель
 * дословно пересказывает блок 3: «первый шаг — проверка геометрии, слайсер
 * смотрит, замкнута ли поверхность модели» и «каждый следующий опирается на
 * предыдущий». Форматы и команды G-кода из блока 5 в кадр не брали: это отдельный
 * список блока, а не конвейер.
 */
export function Basic4Diagram0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Конвейер слайсера из пяти шагов: на входе модель в формате STL или 3MF, затем слои, контуры, заполнение 20 % и на выходе G-код. Первый шаг — проверка геометрии: слайсер смотрит, замкнута ли поверхность модели, а каждый следующий шаг опирается на предыдущий"
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

        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          Конвейер: модель, слои, G-код
        </text>

        {/* Пять шагов: рамка, номер, эскиз, значение и подпись под рамкой */}
        {STEPS.map((step, index) => {
          const left = BOX_LEFT + index * BOX_STEP;

          return (
            <g key={step.name}>
              <rect
                x={left}
                y={BOX_TOP}
                width={BOX_W}
                height={BOX_H}
                rx="6"
                fill="#0f172a"
                fillOpacity="0.35"
                stroke="#475569"
                strokeOpacity="0.55"
              />
              <text x={left + 5} y={BOX_TOP + 13} fontSize="10" fill="#64748b">
                {index + 1}
              </text>
              <g transform={`translate(${left}, ${BOX_TOP + ICON_DY})`}>{ICONS[index]}</g>
              {step.value ? (
                <text x={left + VALUE_DX} y={BOX_TOP + VALUE_DY} fontSize="10" fill="#e2e8f0">
                  {step.value}
                </text>
              ) : null}
              <text x={LABEL_X[index]} y={LABEL_Y} fontSize="10" fill="#e2e8f0">
                {step.name}
              </text>
            </g>
          );
        })}

        {/* Стрелки-переходы: четыре зазора между рамками */}
        {STEPS.slice(0, -1).map((step, index) => {
          const end = BOX_LEFT + (index + 1) * BOX_STEP - 14;

          return (
            <g key={`arrow-${step.name}`}>
              <line x1={end + 2} y1={ARROW_Y} x2={end + 9} y2={ARROW_Y} stroke="#64748b" />
              <polygon
                points={`${end + 9},${ARROW_Y - 3} ${end + 13},${ARROW_Y} ${end + 9},${ARROW_Y + 3}`}
                fill="#64748b"
              />
            </g>
          );
        })}

        {/* Нижняя панель: что происходит на первом шаге и как связаны шаги */}
        <rect
          x="12"
          y={PANEL_TOP}
          width="296"
          height={PANEL_HEIGHT}
          rx="10"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#475569"
          strokeOpacity="0.55"
        />
        <text x="22" y="124" fontSize="10" fill="#94a3b8">
          конвейер из пяти шагов
        </text>
        <text x="22" y="144" fontSize="10" fill="#cbd5e1">
          шаг 1 — проверка геометрии: замкнута ли модель
        </text>
        <text x="22" y="162" fontSize="10" fill="#cbd5e1">
          каждый следующий опирается на предыдущий
        </text>
      </svg>
    </VisualWrapper>
  );
}
