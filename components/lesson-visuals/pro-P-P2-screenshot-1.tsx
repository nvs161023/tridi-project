import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

/**
 * Четыре секции каркаса: только имя и роль. Ни одного тела макроса — тела
 * живут в D-D3-screenshot-0, здесь кадр про то, что вообще лежит в файле.
 */
const SECTIONS = [
  { head: "[stepper_x]", role: "движение по X", top: 38 },
  { head: "[extruder]", role: "нагрев сопла", top: 58 },
  { head: "[heater_bed]", role: "нагрев стола", top: 78 },
  { head: "[gcode_macro]", role: "макросы", top: 98 },
];

/**
 * «Каркас printer.cfg» — файл-лист из четырёх коротких секций с ролью каждой,
 * под ним полоса-предупреждение «одна ошибка — не работает», а справа панель
 * «пробелы видны»: отступ нарисован точками-кружками — главный приём урока.
 *
 * От D-D3-screenshot-0 (тоже printer.cfg) кадр отделён намеренно, по трём
 * признакам. Во-первых, там три секции gcode_macro с телами кода и цепочкой
 * вызова, здесь — четыре разных секции и только их роль. Во-вторых, там
 * подписи-роли стоят справа от строк кода, здесь роли в той же строке, а
 * справа — отдельная панель с точками. В-третьих, здесь есть полосы
 * предупреждения и подписи, которых в D3 нет. Общий остаётся только предмет
 * урока, иначе и быть не может: урок про printer.cfg.
 *
 * Слов «пробелы» и «ошибка» в кадре сколько угодно, потому что это предупреждение
 * из самого урока («синтаксис чувствителен к пробелам», «одна ошибка — не
 * работает»); из врезки tip — подпись внизу. Чисел в кадре нет вовсе: ни одна
 * строка конфига здесь не показывает значение.
 *
 * Кадр статичный: пункт про осторожность правки показывается один раз.
 */
export function ProPP2Screenshot1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Каркас файла printer.cfg: четыре короткие секции — stepper_x с ролью «движение по X», extruder с ролью «нагрев сопла», heater_bed с ролью «нагрев стола» и gcode_macro с ролью «макросы»; ниже красная полоса-предупреждение «одна ошибка — не работает»; справа панель «пробелы видны», где отступ нарисован точками-кружками под строками секции и вложенной строки, с подписью «точки — это пробелы»; внизу совет начать с готового конфига и не писать его с нуля."
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          printer.cfg: каркас конфига
        </text>

        {/* Файл-лист: имя секции слева, её роль справа, между секциями линейки */}
        <rect x="10" y="26" width="180" height="92" rx="6" fill="#0f172a" stroke="#475569" />
        {SECTIONS.map((section, index) => (
          <g key={section.head}>
            <text x="18" y={section.top} fontSize="8" fontFamily={MONO} fill="#7dd3fc">
              {section.head}
            </text>
            <text x="100" y={section.top} fontSize="7.5" fill="#94a3b8">
              {section.role}
            </text>
            {index < SECTIONS.length - 1 ? (
              <line x1="16" y1={section.top + 9} x2="184" y2={section.top + 9} stroke="#334155" />
            ) : null}
          </g>
        ))}

        {/* Полоса-предупреждение: цена ошибки в одной строке */}
        <rect x="10" y="124" width="180" height="16" rx="4" fill="#2e0f13" stroke="#f87171" strokeOpacity="0.7" />
        <text x="18" y="135" fontSize="7.5" fill="#fca5a5">
          одна ошибка — не работает
        </text>

        {/* Панель «пробелы видны»: отступ нарисован точками — приём урока */}
        <rect x="198" y="26" width="112" height="90" rx="6" fill="#0f172a" stroke="#34d399" strokeOpacity="0.5" />
        <text x="206" y="40" fontSize="8.5" fontWeight="bold" fill="#6ee7b7">
          пробелы видны
        </text>
        <text x="206" y="58" fontSize="8" fontFamily={MONO} fill="#7dd3fc">
          [gcode_macro]
        </text>
        <text x="272" y="58" fontSize="7.5" fill="#94a3b8">
          секция
        </text>

        <line x1="201" y1="66" x2="201" y2="90" stroke="#6ee7b7" strokeOpacity="0.6" strokeDasharray="2 2" />
        <circle cx="206" cy="70" r="1.6" fill="#6ee7b7" />
        <circle cx="213" cy="70" r="1.6" fill="#6ee7b7" />
        <circle cx="220" cy="70" r="1.6" fill="#6ee7b7" />
        <text x="230" y="72.5" fontSize="7.5" fill="#94a3b8">
          параметры
        </text>
        <circle cx="206" cy="86" r="1.6" fill="#6ee7b7" />
        <circle cx="213" cy="86" r="1.6" fill="#6ee7b7" />
        <circle cx="220" cy="86" r="1.6" fill="#6ee7b7" />
        <circle cx="227" cy="86" r="1.6" fill="#6ee7b7" />
        <circle cx="234" cy="86" r="1.6" fill="#6ee7b7" />
        <circle cx="241" cy="86" r="1.6" fill="#6ee7b7" />
        <text x="249" y="88.5" fontSize="7.5" fill="#94a3b8">
          вложенность
        </text>
        <text x="206" y="106" fontSize="7.5" fill="#6ee7b7">
          точки — это пробелы
        </text>

        <text x="12" y="170" fontSize="7.5" fill="#94a3b8">
          начни с готового конфига — не пиши с нуля
        </text>
      </svg>
    </VisualWrapper>
  );
}
