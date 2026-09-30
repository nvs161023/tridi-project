import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Имена в списке файлов: своих имён урок не называет, поэтому взяты детали
 * шаблонов конструктора проекта (ваза, брелок, светильник) — это слова курса,
 * а не выдумка кадра.
 */
const FILES = ["ваза.gcode", "брелок.gcode", "светильник.gcode"];

/** Строки списка файлов: три плитки с шагом 12 px внутри панели «файлы». */
const FILE_TOPS = [98, 110, 122];

/**
 * «OctoPrint интерфейс» — окно браузера с адресной строкой `octopi.local`:
 * плитка камеры с идущей печатью, шкала прогресса, два температурных чипа
 * (сопло и стол) и справа панель файлов с зелёной кнопкой «Печать».
 *
 * Ровно по content урока: «Скриншот: веб-интерфейс с камерой, температурой,
 * прогрессом печати» — все четыре слова стоят подписями в кадре. Адрес
 * `octopi.local` — из шага «Открой IP в браузере»: это тот самый адрес, который
 * открывают в браузере. Цена 5000 ₽ — из врезки tip («Raspberry Pi 4 + камера +
 * OctoPrint = удалённый контроль за 5000 ₽»), температуры 210/60 — сквозные
 * числа курса (как в D-D2 и basic-9).
 *
 * От O4-image-0 отличается тем, что там стойка фермы и панель со списком имён
 * софта — интерфейса в том кадре нет вовсе; здесь всё наоборот: один принтер и
 * его окно на экране. От окон слайсеров (basic-8, F1, G1–G4) — тем, что над
 * вкладкой стоит адресная строка: в курсе это первое окно браузера, а у слайсеров
 * адресной строки нет. От D-D3-screenshot-0 (файл-лист конфига) — предметом:
 * там строки файла, здесь окно управления печатью.
 *
 * Кадр статичный: это image-блок, движения в нём нет.
 */
export function ProPP1Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Веб-интерфейс OctoPrint в окне браузера: в адресной строке octopi.local, вкладка OctoPrint; в кадре плитка камеры с идущей печатью вазы, под ней шкала прогресса с подписью «печать идёт»; справа два температурных чипа — сопло 210 °C и стол 60 °C, панель файлов из трёх строк (ваза.gcode, брелок.gcode, светильник.gcode) и зелёная кнопка «Печать»; внизу подпись, что Raspberry Pi с камерой и OctoPrint дают удалённый контроль за 5000 рублей."
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          OctoPrint: интерфейс в браузере
        </text>

        {/* Окно браузера: одна рамка на весь кадр, снизу подпись про цену */}
        <rect x="10" y="22" width="300" height="138" rx="6" fill="#0f172a" stroke="#475569" />

        {/* Шапка браузера: кружки окна, вкладка и адресная строка */}
        <rect x="10" y="22" width="300" height="16" rx="6" fill="#1e293b" />
        <circle cx="20" cy="30" r="2.2" fill="#475569" />
        <circle cx="27" cy="30" r="2.2" fill="#475569" />
        <circle cx="34" cy="30" r="2.2" fill="#475569" />
        <rect x="44" y="24" width="46" height="12" rx="2" fill="#334155" stroke="#475569" />
        <text x="48" y="33" fontSize="7.5" fill="#cbd5e1">
          OctoPrint
        </text>
        <rect x="96" y="24" width="206" height="12" rx="6" fill="#0b1220" stroke="#475569" />
        <circle cx="104" cy="30" r="3" fill="none" stroke="#64748b" />
        <ellipse cx="104" cy="30" rx="1.3" ry="3" fill="none" stroke="#64748b" />
        <line x1="101" y1="30" x2="107" y2="30" stroke="#64748b" />
        <text x="112" y="33" fontSize="7.5" fill="#e2e8f0">
          octopi.local
        </text>

        {/* Плитка камеры: стол, деталь и сопло — печать идёт прямо сейчас */}
        <rect x="16" y="44" width="158" height="82" rx="4" fill="#0b1220" stroke="#334155" />
        <rect x="24" y="56" width="142" height="3" fill="#475569" />
        <rect x="80" y="56" width="18" height="9" rx="1" fill="#334155" stroke="#94a3b8" />
        <polygon points="86,65 94,65 90,73" fill="#fbbf24" />
        <line x1="90" y1="73" x2="90" y2="88" stroke="#6ee7b7" strokeDasharray="2 1.5" />
        <rect x="24" y="116" width="142" height="4" rx="1" fill="#334155" />
        <path d="M 80,116 C 76,104 78,94 82,88 L 98,88 C 102,94 104,104 100,116 Z" fill="#6ee7b7" fillOpacity="0.9" />
        <text x="16" y="136" fontSize="8.5" fill="#94a3b8">
          камера
        </text>

        {/* Шкала прогресса: полоса без числа — в уроке числа прогресса нет */}
        <rect x="16" y="140" width="158" height="8" rx="4" fill="#1e293b" stroke="#334155" />
        <rect x="17" y="141" width="98" height="6" rx="3" fill="#38bdf8" />
        <text x="16" y="157" fontSize="7.5" fill="#94a3b8">
          печать идёт
        </text>

        {/* Температурные чипы: сопло и стол — сквозные числа курса */}
        <rect x="182" y="44" width="58" height="32" rx="4" fill="#0f172a" stroke="#334155" />
        <text x="188" y="51" fontSize="7.5" fill="#94a3b8">
          сопло
        </text>
        <text x="188" y="68" fontSize="10" fontWeight="bold" fill="#fbbf24">
          210 °C
        </text>
        <rect x="246" y="44" width="58" height="32" rx="4" fill="#0f172a" stroke="#334155" />
        <text x="252" y="51" fontSize="7.5" fill="#94a3b8">
          стол
        </text>
        <text x="252" y="68" fontSize="10" fontWeight="bold" fill="#38bdf8">
          60 °C
        </text>

        {/* Панель файлов: три строки и кнопка запуска печати */}
        <rect x="182" y="80" width="122" height="54" rx="4" fill="#0f172a" stroke="#334155" />
        <text x="189" y="92" fontSize="8.5" fontWeight="bold" fill="#38bdf8">
          файлы
        </text>
        {FILES.map((file, index) => (
          <g key={file}>
            <rect x="189" y={FILE_TOPS[index]} width="108" height="10" rx="2" fill="#1e293b" />
            <text x="193" y={FILE_TOPS[index] + 7.5} fontSize="7.5" fill="#cbd5e1">
              {file}
            </text>
          </g>
        ))}
        <rect x="182" y="140" width="122" height="18" rx="4" fill="#14532d" stroke="#34d399" />
        <text x="243" y="152.5" fontSize="10" fontWeight="bold" fill="#e2e8f0" textAnchor="middle">
          Печать
        </text>

        <text x="12" y="172" fontSize="7.5" fill="#94a3b8">
          Raspberry Pi + камера + OctoPrint = удалённый контроль за 5000 ₽
        </text>
      </svg>
    </VisualWrapper>
  );
}
