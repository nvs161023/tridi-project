import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Две панели сравнения: 140 px шириной, поле 24…132. */
const PANEL = { y: 24, w: 140, h: 108 };
const LEFT_X = 12;
const RIGHT_X = 168;

/**
 * Кадр блока 16 урока C12 «Туннель вместо открытого порта».
 *
 * Макет из описания кадра `C12_tunnel_map.png`: слева открытый порт — панель
 * видна всему интернету; справа туннель — телефон входит в домашнюю сеть через
 * зашифрованный канал, а порт наружу остаётся закрытым. Блок 14 объясняет, чем
 * опасна переадресация порта.
 */
export function ConfidentC12Diagram1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Туннель вместо открытого порта: две панели сравнения. Слева открытый порт восемьдесят — панель видна всему интернету, сканеры перебирают адреса и находят её за часы. Справа туннель — телефон входит в домашнюю сеть через зашифрованный канал с замком, роутер держит порт закрытым, доступ идёт по аккаунту. Наружу не открыт ни один порт"
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
          два способа зайти снаружи
        </text>

        {/* Панель «открытый порт» */}
        <rect
          x={LEFT_X}
          y={PANEL.y}
          width={PANEL.w}
          height={PANEL.h}
          rx="6"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#f87171"
          strokeOpacity="0.35"
        />
        <text x="20" y="38" fontSize="10" fontWeight="700" fill="#f87171">
          открытый порт
        </text>

        <circle cx="32" cy="60" r="11" fill="none" stroke="#f87171" strokeOpacity="0.8" />
        <ellipse cx="32" cy="60" rx="4" ry="11" fill="none" stroke="#f87171" strokeOpacity="0.6" />
        <line x1="21" y1="60" x2="43" y2="60" stroke="#f87171" strokeOpacity="0.6" />
        <line x1="45" y1="60" x2="60" y2="60" stroke="#f87171" />
        <polygon points="62,60 57,57 57,63" fill="#f87171" />

        <rect
          x="64"
          y="44"
          width="80"
          height="30"
          rx="4"
          fill="#0f172a"
          fillOpacity="0.5"
          stroke="#f87171"
          strokeOpacity="0.7"
        />
        <text x="70" y="57" fontSize="10" fill="#e2e8f0">
          панель
        </text>
        <text x="70" y="68" fontSize="10" fontWeight="700" fill="#f87171">
          порт 80
        </text>

        <text x="20" y="90" fontSize="10" fill="#f87171">
          видна всему интернету
        </text>
        <text x="20" y="104" fontSize="10" fill="#94a3b8">
          сканеры идут по адресам
        </text>
        <text x="20" y="118" fontSize="10" fill="#94a3b8">
          переадресация = дверь
        </text>

        {/* Панель «туннель» */}
        <rect
          x={RIGHT_X}
          y={PANEL.y}
          width={PANEL.w}
          height={PANEL.h}
          rx="6"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#10b981"
          strokeOpacity="0.35"
        />
        <text x="176" y="38" fontSize="10" fontWeight="700" fill="#10b981">
          туннель
        </text>

        <rect
          x="176"
          y="44"
          width="22"
          height="38"
          rx="3"
          fill="#0f172a"
          fillOpacity="0.6"
          stroke="#10b981"
          strokeOpacity="0.8"
        />
        <rect x="179" y="48" width="16" height="26" rx="1" fill="#10b981" fillOpacity="0.15" />
        <circle cx="187" cy="78" r="1.5" fill="#10b981" />

        <line
          x1="200"
          y1="62"
          x2="234"
          y2="62"
          stroke="#10b981"
          strokeDasharray="4 3"
        />
        <rect
          x="210"
          y="55"
          width="9"
          height="7"
          rx="1"
          fill="none"
          stroke="#10b981"
        />
        <path d="M211 55 v-3 a3.5 3.5 0 0 1 7 0 v3" fill="none" stroke="#10b981" />

        <rect
          x="234"
          y="46"
          width="70"
          height="30"
          rx="4"
          fill="#0f172a"
          fillOpacity="0.5"
          stroke="#10b981"
          strokeOpacity="0.7"
        />
        <text x="240" y="59" fontSize="10" fill="#e2e8f0">
          роутер
        </text>
        <text x="240" y="70" fontSize="10" fontWeight="700" fill="#10b981">
          порт закрыт
        </text>

        <text x="176" y="90" fontSize="10" fill="#10b981">
          телефон как дома
        </text>
        <text x="176" y="104" fontSize="10" fill="#94a3b8">
          трафик зашифрован
        </text>
        <text x="176" y="118" fontSize="10" fill="#94a3b8">
          доступ по аккаунту
        </text>

        <text x="12" y="144" fontSize="10" fill="#cbd5e1">
          Туннель: панель доступна только своим
        </text>
        <text x="12" y="158" fontSize="10" fill="#94a3b8">
          VPN или Tailscale вместо переадресации
        </text>
        <text x="12" y="172" fontSize="10" fill="#64748b">
          Наружу не открыт ни один порт
        </text>
      </svg>
    </VisualWrapper>
  );
}
