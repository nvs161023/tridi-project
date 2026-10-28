import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const FIELDS = [
  { label: "номер и дата партии", value: "П-2026-001 · 26.10" },
  { label: "деталь и версия файла", value: "подставка, v3" },
  { label: "материал и катушка", value: "PETG-BLK-2410" },
  { label: "настройки печати", value: "0,4 · 80 °C · 60 мм/с" },
  { label: "ответственный", value: "А. К. / М. С." },
  { label: "условия хранения", value: "тепло, сухо" },
  { label: "контроль и итог", value: "10 из 20 · годно" },
  { label: "дата следующей проверки", value: "26.11.2026" },
];

/**
 * Кадр блока 32 урока Z4 «Серия: повторяемость, QC, допуски».
 *
 * Макет из описания `Z4_batch_passport.png`: одна строка таблицы, в которой
 * восемь полей из блока 31. Строка показана заполненной — теми же значениями,
 * что в файле `public/artifacts/batch-passport-template.md` (партия П-2026-001):
 * кадр про документ должен показывать документ, а не пустую анкету, иначе
 * читателю не с чем сверить свою первую запись. Пустой бланк остаётся в файле.
 * Заполняется за пять минут — блок 30.
 */
export function ProfitZ4Image6({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Паспорт партии — одна строка таблицы из восьми полей: номер и дата партии, деталь и версия файла, материал и катушка, настройки печати, ответственный, условия хранения, контроль и итог, дата следующей проверки. Заполняется за пять минут, через год по ней можно повторить партию"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#e2e8f0">
          паспорт партии
        </text>
        <text x="12" y="29" fontSize="10" fill="#94a3b8">
          одна строка · пять минут
        </text>

        <rect x="12" y="38" width="296" height="120" rx="7" fill="#0f172a" stroke="#334155" />
        <rect x="12" y="38" width="3" height="120" rx="1.5" fill="#3b82f6" />
        <path d="M176 46 V150" stroke="#334155" strokeWidth="0.8" strokeDasharray="2 3" />

        {FIELDS.map((field, index) => {
          const y = 52 + index * 14;
          return (
            <g key={field.label}>
              <text x="20" y={y} fontSize="10" fill="#cbd5e1">
                {field.label}
              </text>
              {/* Значение — зелёным: видно, что это запись, а не подпись поля */}
              <text x="186" y={y} fontSize="10" fill="#6ee7b7">
                {field.value}
              </text>
              <path d={`M186 ${y + 4} H300`} stroke="#334155" strokeWidth="0.8" />
            </g>
          );
        })}

        <text x="160" y="173" fontSize="10" fill="#94a3b8" textAnchor="middle">
          одна вкладка — деталь · строка — партия
        </text>
      </svg>
    </VisualWrapper>
  );
}
