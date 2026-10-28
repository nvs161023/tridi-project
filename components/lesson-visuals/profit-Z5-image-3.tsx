import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const CHANNELS = [
  {
    name: "VK",
    line: "посты и фото",
    detail: "",
    color: "#3b82f6",
    x: 98,
    y: 42,
  },
  {
    name: "Telegram",
    line: "короткие посты",
    detail: "ссылка на товар",
    color: "#06b6d4",
    x: 204,
    y: 42,
  },
  {
    name: "Дзен",
    line: "статьи",
    detail: "разбор задачи",
    color: "#8b5cf6",
    x: 98,
    y: 96,
  },
  {
    name: "YouTube",
    line: "короткие видео",
    detail: "10 секунд",
    color: "#f87171",
    x: 204,
    y: 96,
  },
];

/**
 * Кадр блока 20 урока Z5 «Фото, маркетинг, продвижение».
 *
 * Макет из описания `Z5_channel_map.png`: карта каналов вокруг одного профиля.
 * В уроке четыре площадки — VK, Telegram, Дзен и YouTube; Instagram и TikTok
 * не включены. Числа из блока 20: начать с одного живого канала, потом
 * подключить второй, публиковать 2–3 раза в неделю и держать 5–6 фото в
 * профиле. Подвал напоминает, что пустые каналы хуже одного живого.
 */
export function ProfitZ5Image3({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Карта каналов: ВКонтакте — посты и фото, Telegram — короткие посты со ссылкой на товар, Дзен — статьи, YouTube — короткие видео. Начни с одного живого канала, добавь второй, публикуй 2–3 раза в неделю и держи 5–6 фото в профиле. Пустые каналы хуже одного живого"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="11" fontWeight="700" fill="#e2e8f0">
          карта каналов
        </text>
        <text x="12" y="29" fontSize="10" fill="#94a3b8">
          один живой канал → второй
        </text>

        <rect x="10" y="42" width="76" height="96" rx="7" fill="#0f172a" stroke="#334155" />
        <rect x="10" y="42" width="76" height="3" rx="1.5" fill="#60a5fa" />
        <circle cx="48" cy="55" r="8" fill="#3b82f6" fillOpacity="0.16" stroke="#60a5fa" />
        <circle cx="48" cy="52" r="3" fill="#60a5fa" />
        <path d="M41 61 Q48 56 55 61" fill="none" stroke="#60a5fa" strokeWidth="1.2" />
        <text x="48" y="78" fontSize="20" fontWeight="700" fill="#60a5fa" textAnchor="middle">
          1 → 2
        </text>
        <text x="48" y="97" fontSize="10" fill="#94a3b8" textAnchor="middle">
          канала
        </text>
        <path d="M18 102 H78" stroke="#334155" strokeWidth="0.8" />
        <text x="48" y="116" fontSize="10" fontWeight="700" fill="#34d399" textAnchor="middle">
          5–6 фото
        </text>
        <rect x="29" y="122" width="10" height="7" rx="1.5" fill="#10b981" fillOpacity="0.2" stroke="#34d399" />
        <rect x="43" y="122" width="10" height="7" rx="1.5" fill="#10b981" fillOpacity="0.2" stroke="#34d399" />
        <rect x="57" y="122" width="10" height="7" rx="1.5" fill="#10b981" fillOpacity="0.2" stroke="#34d399" />

        <path d="M86 90 H92" stroke="#64748b" strokeWidth="1" />
        <path d="M92 66 V120" stroke="#64748b" strokeWidth="1" />
        <path d="M92 66 H98" stroke="#64748b" strokeWidth="1" />
        <path d="M92 120 H98" stroke="#64748b" strokeWidth="1" />
        <path d="M98 66 L94 64 V68 Z" fill="#64748b" />
        <path d="M98 120 L94 118 V122 Z" fill="#64748b" />

        {CHANNELS.map((channel) => (
          <g key={channel.name}>
            <rect x={channel.x} y={channel.y} width="102" height="48" rx="6" fill="#0f172a" stroke="#334155" />
            <rect x={channel.x} y={channel.y} width="3" height="48" rx="1.5" fill={channel.color} />
            <text x={channel.x + 11} y={channel.y + 13} fontSize="11" fontWeight="700" fill={channel.color}>
              {channel.name}
            </text>
            <text x={channel.x + 11} y={channel.y + 27} fontSize="10" fill="#e2e8f0">
              {channel.line}
            </text>
            {channel.detail ? (
              <text x={channel.x + 11} y={channel.y + 42} fontSize="10" fill="#94a3b8">
                {channel.detail}
              </text>
            ) : (
              <g>
                <rect x={channel.x + 11} y={channel.y + 34} width="9" height="7" rx="1.5" fill="#3b82f6" fillOpacity="0.2" stroke="#60a5fa" />
                <rect x={channel.x + 23} y={channel.y + 34} width="9" height="7" rx="1.5" fill="#3b82f6" fillOpacity="0.2" stroke="#60a5fa" />
                <rect x={channel.x + 35} y={channel.y + 34} width="9" height="7" rx="1.5" fill="#3b82f6" fillOpacity="0.2" stroke="#60a5fa" />
              </g>
            )}
          </g>
        ))}

        <rect x="12" y="146" width="296" height="18" rx="4" fill="#0f172a" stroke="#334155" />
        <text x="160" y="158.5" fontSize="10" fontWeight="700" fill="#e2e8f0" textAnchor="middle">
          2–3 публикации в неделю
        </text>

        <text x="160" y="171" fontSize="10" fill="#f87171" textAnchor="middle">
          пустые каналы хуже одного живого
        </text>
      </svg>
    </VisualWrapper>
  );
}
