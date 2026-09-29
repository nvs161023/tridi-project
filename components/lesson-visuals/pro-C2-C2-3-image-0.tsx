import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Четыре гнезда головы: паз у самого края силуэта, деталь снаружи и стрелка
 * входа. Цвет гнезда — по назначению узла, как в кадре про плату (C2-1):
 * нагрев красный, датчик голубой, вентилятор сиреневый.
 */
const SOCKETS = [
  { id: "thermal", color: "#38bdf8", x: 126, y: 58 },
  { id: "nozzle", color: "#f87171", x: 126, y: 94 },
  { id: "cartridge", color: "#f87171", x: 182, y: 94 },
  { id: "fan", color: "#a78bfa", x: 182, y: 58 },
];

/** Рёбра радиатора на корпусе головы. */
const FINS = [62, 68, 74, 80];

/**
 * Замена деталей: силуэт головы по центру, вокруг — четыре гнезда, в которые
 * деталь входит по стрелке, и у каждой детали свой признак износа.
 *
 * От C1-2-image (метки кружками по узлам принтера) и basic-14 (метка на узле)
 * отличается тем, что деталь не отмечена на месте, а показана ВХОДЯЩЕЙ в паз
 * головы: гнездо и вставка, а не подпись у узла. От M-M7-image (деталь и
 * инструменты вокруг неё) — тем, что инструментов в кадре нет вовсе.
 */
export function ProC2C23Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Замена деталей: силуэт печатающей головы по центру, вокруг четыре гнезда-паза — сопло, термистор, картридж и вентилятор. В каждое гнездо деталь входит по стрелке, а рядом показан признак износа: у сопла нагар на кончике, у термистора и картриджа обрыв провода, у вентилятора шум. Сопло меняют на горячую ключом 6–7 мм."
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="14" fontSize="10" fill="#94a3b8">
          Замена деталей: что в какое гнездо
        </text>

        {/* Силуэт головы: трубка филамента, корпус с рёбрами, пазы по краям */}
        <rect x="150" y="40" width="20" height="12" rx="2" fill="#334155" stroke="#94a3b8" strokeWidth="1.2" />
        <rect x="138" y="52" width="44" height="76" rx="6" fill="#334155" stroke="#94a3b8" strokeWidth="1.2" />
        {FINS.map((y) => (
          <line key={`fin-${y}`} x1="143" y1={y} x2="177" y2={y} stroke="#64748b" strokeWidth="1.2" />
        ))}
        <text x="160" y="104" fontSize="7.5" fill="#e2e8f0" textAnchor="middle">
          голова
        </text>
        {SOCKETS.map((socket) => (
          <rect
            key={`socket-${socket.id}`}
            x={socket.x}
            y={socket.y}
            width="12"
            height="22"
            rx="2"
            fill="#0f172a"
            stroke={socket.color}
            strokeWidth="1.2"
            strokeDasharray="4 3"
          />
        ))}
        {/* Гнездо термистора и сам термистор с обрывом провода */}
        <line x1="92" y1="69" x2="126" y2="69" stroke="#38bdf8" strokeWidth="1.4" />
        <polygon points="126,69 118,65 118,73" fill="#38bdf8" />
        <circle cx="76" cy="69" r="5" fill="#334155" stroke="#38bdf8" strokeWidth="1.2" />
        <line x1="66" y1="69" x2="71" y2="69" stroke="#38bdf8" strokeWidth="1.4" />
        <line x1="81" y1="69" x2="90" y2="69" stroke="#38bdf8" strokeWidth="1.4" />
        <line x1="60" y1="64" x2="68" y2="72" stroke="#f87171" strokeWidth="1.4" />
        <line x1="68" y1="64" x2="60" y2="72" stroke="#f87171" strokeWidth="1.4" />
        <text x="20" y="40" fontSize="8" fill="#e2e8f0">
          термистор · обрыв
        </text>

        {/* Гнездо сопла и сопло с нагаром на кончике */}
        <line x1="92" y1="105" x2="126" y2="105" stroke="#f87171" strokeWidth="1.4" />
        <polygon points="126,105 118,101 118,109" fill="#f87171" />
        <polygon
          points="87,104 82.5,96.2 73.5,96.2 69,104 73.5,111.8 82.5,111.8"
          fill="#334155"
          stroke="#f87171"
          strokeWidth="1.2"
        />
        <polygon points="73.5,111.8 82.5,111.8 79.5,119 76.5,119" fill="#334155" stroke="#f87171" strokeWidth="1.2" />
        <circle cx="78" cy="120" r="3" fill="#1c1917" stroke="#57534e" strokeWidth="1" />
        <text x="20" y="144" fontSize="8" fill="#e2e8f0">
          сопло · нагар
        </text>

        {/* Гнездо картриджа и картридж с обрывом провода */}
        <line x1="228" y1="105" x2="198" y2="105" stroke="#f87171" strokeWidth="1.4" />
        <polygon points="196,105 204,101 204,109" fill="#f87171" />
        <rect x="234" y="100" width="22" height="11" rx="2" fill="#334155" stroke="#f87171" strokeWidth="1.2" />
        <line x1="256" y1="102" x2="261" y2="102" stroke="#94a3b8" strokeWidth="1.2" />
        <line x1="269" y1="102" x2="276" y2="102" stroke="#94a3b8" strokeWidth="1.2" />
        <line x1="256" y1="108" x2="261" y2="108" stroke="#94a3b8" strokeWidth="1.2" />
        <line x1="269" y1="108" x2="276" y2="108" stroke="#94a3b8" strokeWidth="1.2" />
        <line x1="259" y1="98" x2="271" y2="112" stroke="#f87171" strokeWidth="1.4" />
        <line x1="271" y1="98" x2="259" y2="112" stroke="#f87171" strokeWidth="1.4" />
        <text x="224" y="144" fontSize="8" fill="#e2e8f0">
          картридж · обрыв
        </text>

        {/* Гнездо вентилятора и сам вентилятор с признаком шума */}
        <line x1="222" y1="69" x2="198" y2="69" stroke="#a78bfa" strokeWidth="1.4" />
        <polygon points="196,69 204,65 204,73" fill="#a78bfa" />
        <circle cx="244" cy="69" r="13" fill="#334155" stroke="#a78bfa" strokeWidth="1.2" />
        <circle cx="244" cy="69" r="3.5" fill="#0f172a" stroke="#a78bfa" strokeWidth="1" />
        <line x1="241.5" y1="66.5" x2="234.8" y2="59.8" stroke="#a78bfa" strokeWidth="1.2" />
        <line x1="246.5" y1="66.5" x2="253.2" y2="59.8" stroke="#a78bfa" strokeWidth="1.2" />
        <line x1="241.5" y1="71.5" x2="234.8" y2="78.2" stroke="#a78bfa" strokeWidth="1.2" />
        <line x1="246.5" y1="71.5" x2="253.2" y2="78.2" stroke="#a78bfa" strokeWidth="1.2" />
        <line x1="260" y1="60" x2="264" y2="56" stroke="#f87171" strokeWidth="1.4" />
        <line x1="262" y1="69" x2="267" y2="69" stroke="#f87171" strokeWidth="1.4" />
        <line x1="260" y1="78" x2="264" y2="82" stroke="#f87171" strokeWidth="1.4" />
        <text x="224" y="40" fontSize="8" fill="#e2e8f0">
          вентилятор · шум
        </text>

        <text x="12" y="170" fontSize="8" fill="#94a3b8">
          менять сопло на горячую, ключ 6–7 мм
        </text>
      </svg>
    </VisualWrapper>
  );
}
