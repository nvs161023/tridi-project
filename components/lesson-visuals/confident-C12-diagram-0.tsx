import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

type Node = { x: number; y: number; w: number; h: number; name: string; sub: string };

/** Четыре узла связки: плата и принтер слева, роутер и телефон справа. */
const BOX_H = 42;
const PI: Node = { x: 14, y: 28, w: 76, h: BOX_H, name: "Raspberry Pi", sub: "плата" };
const ROUTER: Node = { x: 122, y: 28, w: 76, h: BOX_H, name: "роутер", sub: "192.168.1.50" };
const PHONE: Node = { x: 228, y: 28, w: 76, h: BOX_H, name: "телефон", sub: "браузер" };
const PRINTER: Node = { x: 14, y: 84, w: 76, h: BOX_H, name: "принтер", sub: "Marlin" };

const NODES = [PI, ROUTER, PHONE, PRINTER];

/**
 * Кадр блока 4 урока C12 «Как принтер попадает в сеть».
 *
 * Макет из описания кадра `C12_net_map.png`: принтер связан с платой по USB,
 * плата и телефон — с роутером по Wi-Fi. Блок 2 объясняет, что веб-панель живёт
 * на плате, а роутер выдаёт ей адрес вида 192.168.1.50.
 */
export function ConfidentC12Diagram0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Как принтер попадает в сеть: четыре узла одной связки. Принтер связан с платой Raspberry Pi по USB, плата и телефон подключены к роутеру по Wi-Fi, роутер выдаёт адрес 192.168.1.50. На плате живёт веб-панель, её открывают в браузере телефона. Из другой сети этот адрес не виден"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
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
          четыре узла одной связки
        </text>

        {/* Проводное соединение принтер — плата */}
        <line x1="52" y1={PRINTER.y} x2="52" y2={PI.y + PI.h} stroke="#60a5fa" strokeWidth="2" />
        <text x="58" y="79" fontSize="10" fill="#60a5fa" fontWeight="700">
          USB
        </text>

        {/* Беспроводные соединения: плата — роутер, роутер — телефон */}
        <line
          x1={PI.x + PI.w}
          y1="49"
          x2={ROUTER.x}
          y2="49"
          stroke="#10b981"
          strokeDasharray="3 3"
        />
        <text x="106" y="44" fontSize="10" fill="#10b981" textAnchor="middle">
          Wi-Fi
        </text>
        <line
          x1={ROUTER.x + ROUTER.w}
          y1="49"
          x2={PHONE.x}
          y2="49"
          stroke="#10b981"
          strokeDasharray="3 3"
        />
        <text x="213" y="44" fontSize="10" fill="#10b981" textAnchor="middle">
          Wi-Fi
        </text>

        {NODES.map((node) => (
          <g key={node.name}>
            <rect
              x={node.x}
              y={node.y}
              width={node.w}
              height={node.h}
              rx="6"
              fill="#0f172a"
              fillOpacity="0.45"
              stroke="#475569"
            />
            <text
              x={node.x + 6}
              y={node.y + 16}
              fontSize="10"
              fontWeight="700"
              fill="#e2e8f0"
            >
              {node.name}
            </text>
            <text x={node.x + 6} y={node.y + 30} fontSize="10" fill="#94a3b8">
              {node.sub}
            </text>
          </g>
        ))}

        <text x="12" y="142" fontSize="10" fill="#cbd5e1">
          Принтер — по USB, плата и телефон — по Wi-Fi
        </text>
        <text x="12" y="156" fontSize="10" fill="#94a3b8">
          Панель открывается в браузере по адресу 192.168.1.50
        </text>
        <text x="12" y="170" fontSize="10" fill="#64748b">
          Из другой сети этот адрес не виден
        </text>
      </svg>
    </VisualWrapper>
  );
}
