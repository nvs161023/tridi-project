import type { ReactNode } from "react";

import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Зазор — синий, первый слой — изумрудный, середина детали — янтарный. */
const GAP = "#3b82f6";
const LAYER = "#10b981";
const MIDDLE = "#f59e0b";

/** Три панели по 24…152 и сноска 156…172: зазор, первый слой, середина детали. */
const PANEL_TOP = 24;
const PANEL_H = 128;
const P1_X = 12;
const P1_W = 88;
const P2_X = 104;
const P2_W = 92;
const P3_X = 200;
const P3_W = 108;

/** Подпись панели — первой строкой внутри рамки. */
const CAPTION_Y = 38;

/** Стол во всех трёх панелях на одной высоте: верх стола 112. */
const BED_TOP = 112;
const BED_H = 10;

/** Панель с рамкой и подписью: одинаковая рамка у всех трёх. */
function Panel({
  x,
  w,
  caption,
  children,
}: {
  x: number;
  w: number;
  caption: string;
  children: ReactNode;
}) {
  return (
    <g>
      <rect
        x={x}
        y={PANEL_TOP}
        width={w}
        height={PANEL_H}
        rx="10"
        fill="#0f172a"
        fillOpacity="0.35"
        stroke="#475569"
        strokeOpacity="0.55"
      />
      <text x={x + 8} y={CAPTION_Y} fontSize="10" fill="#94a3b8">
        {caption}
      </text>
      {children}
    </g>
  );
}

/** Горизонтальный размер с засечками — ширина полосы и линии. */
function SizeH({ x1, x2, y }: { x1: number; x2: number; y: number }) {
  return (
    <g stroke="#94a3b8">
      <line x1={x1} y1={y} x2={x2} y2={y} />
      <line x1={x1} y1={y - 3} x2={x1} y2={y + 3} />
      <line x1={x2} y1={y - 3} x2={x2} y2={y + 3} />
    </g>
  );
}

/** Вертикальный размер с засечками — высота слоя. */
function SizeV({ x, y1, y2 }: { x: number; y1: number; y2: number }) {
  return (
    <g stroke="#94a3b8">
      <line x1={x} y1={y1} x2={x} y2={y2} />
      <line x1={x - 3} y1={y1} x2={x + 3} y2={y1} />
      <line x1={x - 3} y1={y2} x2={x + 3} y2={y2} />
    </g>
  );
}

/**
 * Кадр блока 5 урока L5 «Сечение первого слоя».
 *
 * Компоновка — три панели слева направо, и это три разных момента печати, а не
 * три варианта одного. В первой панели сопло стоит над чистым столом, между ними
 * тот самый зазор 0,10 мм (тот же щуп 0,10 мм, которым уровень проверяют по блоку
 * 16). Во второй панели печать уже идёт: сопло давит пластик, и линия расплывается
 * в полосу шириной 0,5–0,6 мм при высоте слоя 0,20 мм. В третьей панели показана
 * середина готовой детали: та же порция пластика ложится почти круглой, 0,45 мм
 * при высоте слоя 0,2 мм.
 *
 * Числа — из подписи блока 5 (зазор 0,10 мм, первый слой 0,20 мм, середина детали
 * 0,45 мм) и из блока 4: сопло 0,4 мм идёт на высоте 0,2 мм над столом, та же
 * порция растекается в полосу 0,5–0,6 мм — это и есть squish.
 */
export function Basic5Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Сечение первого слоя в трёх моментах печати: сопло поднято над столом на зазор 0,10 мм; при печати сопло 0,4 мм давит пластик, и линия расплывается в полосу шириной 0,5–0,6 мм при высоте слоя 0,20 мм; в середине детали та же линия ложится почти круглой — 0,45 мм при высоте слоя 0,2 мм, потому что там её никто не сплющивает"
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
          Сечение первого слоя
        </text>

        {/* Зазор: сопло над чистым столом, между ними просвет 0,10 мм */}
        <Panel x={P1_X} w={P1_W} caption="Зазор">
          <rect x="22" y={BED_TOP} width="68" height={BED_H} rx="2" fill="#334155" stroke="#64748b" />
          <rect x="46" y="70" width="20" height="22" fill="#334155" stroke="#64748b" />
          <polygon points="46,92 66,92 62,107 50,107" fill="#334155" stroke="#64748b" />
          <rect x="34" y="107" width="44" height="5" fill={GAP} fillOpacity="0.25" stroke={GAP} strokeOpacity="0.7" />
          <SizeV x={82} y1={107} y2={BED_TOP} />
          <text x="20" y="146" fontSize="12" fontWeight="700" fill={GAP}>
            0,10 мм
          </text>
        </Panel>

        {/* Первый слой: сопло давит пластик, линия расплывается в полосу */}
        <Panel x={P2_X} w={P2_W} caption="Первый слой">
          <rect x="114" y={BED_TOP} width="72" height={BED_H} rx="2" fill="#334155" stroke="#64748b" />
          <path d="M140 112 q3 -9 8 -9 h16 q5 0 8 9 z" fill={LAYER} fillOpacity="0.85" />
          <rect x="146" y="64" width="20" height="24" fill="#334155" stroke="#64748b" />
          <polygon points="146,88 166,88 162,103 150,103" fill="#334155" stroke="#64748b" />
          <text x="106" y="99" fontSize="10" fill="#e2e8f0">
            0,20 мм
          </text>
          <SizeV x={136} y1={103} y2={BED_TOP} />
          <SizeH x1={140} x2={172} y={130} />
          <text x="124" y="146" fontSize="12" fontWeight="700" fill={LAYER}>
            0,5–0,6 мм
          </text>
        </Panel>

        {/* Середина детали: та же линия, но её никто не сплющивал */}
        <Panel x={P3_X} w={P3_W} caption="Середина детали">
          <rect x="212" y="82" width="56" height="10" rx="5" fill={MIDDLE} fillOpacity="0.85" />
          <rect x="212" y="92" width="56" height="10" fill="#334155" stroke="#475569" />
          <rect x="212" y="102" width="56" height="10" fill="#334155" stroke="#475569" />
          <SizeH x1={212} x2={268} y={122} />
          <text x="222" y="134" fontSize="10" fill="#e2e8f0">
            0,45 мм
          </text>
          <text x="208" y="146" fontSize="12" fontWeight="700" fill={MIDDLE}>
            слой 0,20 мм
          </text>
        </Panel>

        {/* Сноска из блока 4 */}
        <rect x="12" y="156" width="296" height="16" rx="6" fill="#0f172a" fillOpacity="0.35" stroke="#475569" strokeOpacity="0.55" />
        <text x="22" y="168" fontSize="10" fill="#94a3b8">
          сопло 0,4 мм идёт на высоте 0,2 мм над столом
        </text>
      </svg>
    </VisualWrapper>
  );
}

