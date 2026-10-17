import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const LICENSES = [
  { name: "CC0", what: "делай что хочешь", sale: "да", color: "#34d399" },
  { name: "CC BY", what: "указывай автора", sale: "да", color: "#34d399" },
  { name: "CC BY-SA", what: "производные — та же", sale: "да", color: "#34d399" },
  { name: "CC BY-ND", what: "менять нельзя", sale: "оговорки", color: "#fbbf24" },
  { name: "CC BY-NC", what: "только для себя", sale: "нет", color: "#f87171" },
  { name: "All Rights Reserved", what: "только разрешение", sale: "нет", color: "#f87171" },
];

/**
 * Кадр блока 29 урока Z7 «Юр. оформление, налоги, лицензии».
 *
 * `Z7_license_table.png`: шпаргалка по лицензиям. CC0 — делай что хочешь;
 * CC BY — указывай автора; CC BY-SA — производные под той же лицензией;
 * CC BY-ND — менять нельзя, продажа с оговорками; CC BY-NC — только для себя;
 * All Rights Reserved — только письменное разрешение. Чужая модель с правками
 * остаётся чужой, лицензию проверяют до печати.
 */
export function ProfitZ7Image6({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Шпаргалка по лицензиям моделей. CC0 — делай что хочешь, продавать можно. CC BY — указывай автора, продавать можно. CC BY-SA — производные остаются под той же лицензией, продавать можно. CC BY-ND — менять нельзя, продажа с оговорками. CC BY-NC — только для себя, продавать нельзя. All Rights Reserved — только письменное разрешение, продавать нельзя. Чужая модель с правками остаётся чужой; лицензию проверяй до печати, сохрани скриншот и ссылку"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="11" fontWeight="700" fill="#e2e8f0">
          шпаргалка по лицензиям
        </text>
        <text x="12" y="29" fontSize="10" fill="#94a3b8">
          что можно и что нельзя
        </text>

        <rect x="10" y="36" width="300" height="106" rx="5" fill="#0f172a" stroke="#334155" />
        <rect x="10" y="36" width="300" height="16" rx="5" fill="#1e293b" />
        <text x="18" y="47" fontSize="10" fontWeight="700" fill="#94a3b8">
          лицензия
        </text>
        <text x="120" y="47" fontSize="10" fontWeight="700" fill="#94a3b8">
          что можно
        </text>
        <text x="304" y="47" fontSize="10" fontWeight="700" fill="#94a3b8" textAnchor="end">
          продажа
        </text>

        {LICENSES.map((license, index) => {
          const y = 52 + index * 15;
          return (
            <g key={license.name}>
              <rect x="10" y={y} width="300" height="15" fill={index % 2 === 0 ? "#111c30" : "#0f172a"} />
              <text x="18" y={y + 11} fontSize="10" fontWeight="700" fill="#e2e8f0">
                {license.name}
              </text>
              <text x="120" y={y + 11} fontSize="10" fill="#cbd5e1">
                {license.what}
              </text>
              <text x="304" y={y + 11} fontSize="10" fontWeight="700" fill={license.color} textAnchor="end">
                {license.sale}
              </text>
            </g>
          );
        })}

        <rect x="10" y="144" width="300" height="32" rx="5" fill="#0f172a" stroke="#334155" />
        <text x="18" y="158" fontSize="10" fontWeight="700" fill="#e2e8f0">
          чужая модель с правками остаётся чужой
        </text>
        <text x="18" y="172" fontSize="10" fill="#94a3b8">
          проверяй до печати · сохрани скриншот и ссылку
        </text>
      </svg>
    </VisualWrapper>
  );
}
