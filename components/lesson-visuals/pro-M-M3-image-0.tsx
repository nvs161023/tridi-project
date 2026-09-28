import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Деления шкалы на дисплеях и полоски-сегменты: сдвиги по X от начала панели. */
const DIAL_TICKS = [0, 8, 16, 24];

/** Лопатки вентилятора Eibos: угол в градусах, длина — от центра. */
const FAN_BLADES = [20, 140, 260];

/**
 * Каталог сушилок: три корпуса разной формы и размера стоят на общей полке.
 * Sunlu — компактный вертикальный бокс с одной катушкой и дисплеем, Eibos —
 * широкий бокс под две катушки с вентилятором, PrintDry — цилиндрическая камера
 * с датчиком. Под каждым корпусом три строки: имя, ТТХ и «плюс».
 *
 * Ровно по content урока: «Фото: Sunlu, Eibos, PrintDry. Под каждым — плюсы» и
 * по заданию урока: Sunlu — компакт, до 50 °C и одна катушка с гигрометром,
 * Eibos — под две катушки, до 70 °C и вентилятор, PrintDry — до 80 °C, для PA/PC.
 *
 * От процесса сушки (E2-E2-3-image-0: сушилка-бокс, бокс с силикагелем, шкала
 * влажности) отличается предметом кадра: здесь нет ни процесса, ни шкалы
 * влажности — это витрина трёх аппаратов с их ТТХ. От ряда катушек (E1-E1-1)
 * тоже: катушки тут спрятаны в окнах корпусов, а не подписаны сами по себе.
 * Шкалы температур по материалам (PLA 45…PC 80) тоже нет — она в E2-E2-3.
 */
export function ProMM3Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Каталог сушилок: на общей полке три аппарата разной формы — компактный вертикальный Sunlu с одной катушкой и дисплеем, широкий Eibos под две катушки с вентилятором и цилиндрический PrintDry с датчиком; под каждым подписи — температура, число катушек и плюс"
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

        <text x="12" y="14" fontSize="10" fill="#94a3b8">
          Каталог сушилок: Sunlu, Eibos, PrintDry
        </text>

        {/* Общая полка */}
        <line x1="12" y1="128" x2="308" y2="128" stroke="#475569" strokeWidth="3" />

        {/* Sunlu: компакт, одна катушка, дисплей-гигрометр */}
        <rect x="18" y="52" width="76" height="10" rx="3" fill="#334155" stroke="#475569" />
        <rect x="20" y="62" width="72" height="66" rx="4" fill="#334155" stroke="#475569" />
        <rect x="28" y="72" width="56" height="34" rx="3" fill="#0f172a" stroke="#475569" />
        <circle cx="56" cy="89" r="14" fill="#334155" stroke="#64748b" />
        <circle cx="56" cy="89" r="4" fill="#0f172a" />
        <rect x="30" y="112" width="52" height="12" rx="2" fill="#0f172a" />
        {DIAL_TICKS.map((shift) => (
          <rect
            key={`sunlu-${shift}`}
            x={34 + shift}
            y="115"
            width="5"
            height="6"
            rx="1"
            fill="#f59e0b"
            fillOpacity="0.85"
          />
        ))}

        {/* Eibos: две катушки, вентилятор, дисплей */}
        <rect x="110" y="60" width="100" height="10" rx="3" fill="#334155" stroke="#475569" />
        <rect x="112" y="70" width="96" height="58" rx="4" fill="#334155" stroke="#475569" />
        <rect x="120" y="80" width="80" height="30" rx="3" fill="#0f172a" stroke="#475569" />
        <circle cx="142" cy="95" r="12" fill="#334155" stroke="#64748b" />
        <circle cx="178" cy="95" r="12" fill="#334155" stroke="#64748b" />
        <circle cx="142" cy="95" r="3.5" fill="#0f172a" />
        <circle cx="178" cy="95" r="3.5" fill="#0f172a" />
        <circle cx="132" cy="118" r="8" fill="#0f172a" stroke="#38bdf8" />
        {FAN_BLADES.map((angle) => {
          const radians = (angle * Math.PI) / 180;
          return (
            <line
              key={`blade-${angle}`}
              x1="132"
              y1="118"
              x2={132 + 6 * Math.cos(radians)}
              y2={118 + 6 * Math.sin(radians)}
              stroke="#38bdf8"
              strokeWidth="1.1"
            />
          );
        })}
        <rect x="164" y="112" width="36" height="12" rx="2" fill="#0f172a" />
        {DIAL_TICKS.slice(0, 3).map((shift) => (
          <rect
            key={`eibos-${shift}`}
            x={168 + shift}
            y="115"
            width="5"
            height="6"
            rx="1"
            fill="#f59e0b"
            fillOpacity="0.85"
          />
        ))}


        {/* PrintDry: цилиндрическая камера, датчик, высокая температура */}
        <rect x="238" y="68" width="12" height="7" rx="2" fill="#475569" />
        <rect x="222" y="76" width="44" height="52" rx="4" fill="#334155" stroke="#475569" />
        <ellipse cx="244" cy="76" rx="22" ry="7" fill="#475569" />
        <rect x="232" y="86" width="24" height="22" rx="2" fill="#0f172a" stroke="#475569" />
        <circle cx="244" cy="97" r="9" fill="#334155" stroke="#64748b" />
        <circle cx="244" cy="97" r="3" fill="#0f172a" />
        <rect x="272" y="82" width="32" height="26" rx="3" fill="#0f172a" stroke="#475569" />
        <circle cx="298" cy="90" r="3" fill="#f59e0b" fillOpacity="0.85" />
        {DIAL_TICKS.slice(0, 3).map((shift) => (
          <rect
            key={`printdry-${shift}`}
            x={276 + shift}
            y="98"
            width="5"
            height="6"
            rx="1"
            fill="#f59e0b"
            fillOpacity="0.85"
          />
        ))}

        {/* Подписи: имя, ТТХ и «плюс» под каждым корпусом */}
        <text x="12" y="148" fontSize="7.5" fill="#e2e8f0">
          Sunlu
        </text>
        <text x="12" y="162" fontSize="7.5" fill="#94a3b8">
          50 °C, 1 катушка
        </text>
        <text x="12" y="176" fontSize="7.5" fill="#34d399">
          плюс: гигрометр
        </text>

        <text x="112" y="148" fontSize="7.5" fill="#e2e8f0">
          Eibos
        </text>
        <text x="112" y="162" fontSize="7.5" fill="#94a3b8">
          70 °C, 2 катушки
        </text>
        <text x="112" y="176" fontSize="7.5" fill="#34d399">
          плюс: вентилятор
        </text>

        <text x="212" y="148" fontSize="7.5" fill="#e2e8f0">
          PrintDry
        </text>
        <text x="212" y="162" fontSize="7.5" fill="#94a3b8">
          80 °C, 1 катушка
        </text>
        <text x="212" y="176" fontSize="7.5" fill="#34d399">
          плюс: для PA/PC
        </text>
      </svg>
    </VisualWrapper>
  );
}
