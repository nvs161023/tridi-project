import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

/** Окно консоли: 12…308 по X, 20…120 по Y, заголовок 16. */
const WIN_Y = 20;
const WIN_H = 100;
const BAR_H = 16;
const ROW_TOP = 50;
const ROW_STEP = 14;
const TEXT_X = 22;

type Line = { text: string; color: string; bold?: boolean };

/** Команда, ход теста и отчёт — блоки 6–8. */
const LINES: Line[] = [
  { text: "> PID_CALIBRATE HEATER=extruder TARGET=210", color: "#e2e8f0" },
  { text: "  цикл 8 из 8 · датчик опрошен", color: "#94a3b8" },
  { text: "  Kp = 22.20   Ki = 1.28   Kd = 96.10", color: "#fcd34d", bold: true },
  { text: "> M500", color: "#e2e8f0" },
  { text: "  коэффициенты сохранены", color: "#94a3b8" },
];

/**
 * Кадр блока 7 урока C9 «Консоль автоподбора PID».
 *
 * Макет из описания кадра `C9_pid_tune_ui.png`: окно консоли прошивки с командой
 * PID_CALIBRATE, восемью циклами и отчётом Kp, Ki, Kd, дальше сохранение в
 * EEPROM. Числа условные: блок 5 говорит, что они зависят от нагревателя, массы
 * сопла и датчика, поэтому свои у каждого принтера.
 */
export function ConfidentC9Screenshot0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Консоль автоподбора PID: команда PID_CALIBRATE для сопла с целью 210 °C, восемь циклов, отчёт Kp 22.20, Ki 1.28 и Kd 96.10, затем команда M500 и сохранение коэффициентов. Kp — сила отклика, Ki — остаток ошибки, Kd — гашение перегрева. Числа свои у каждого принтера, Marlin сохраняет их командой M500, Klipper — SAVE_CONFIG"
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
          консоль прошивки: автоподбор PID
        </text>

        {/* Окно консоли */}
        <rect
          x="12"
          y={WIN_Y}
          width="296"
          height={WIN_H}
          rx="8"
          fill="#0f172a"
          fillOpacity="0.5"
          stroke="#475569"
          strokeOpacity="0.7"
        />
        <rect
          x="12"
          y={WIN_Y}
          width="296"
          height={BAR_H}
          rx="8"
          fill="#1e293b"
          fillOpacity="0.8"
        />
        {[22, 29, 36].map((cx) => (
          <circle key={cx} cx={cx} cy={WIN_Y + 8} r="2" fill="#475569" />
        ))}
        <text x="48" y={WIN_Y + 12} fontSize="10" fontWeight="700" fill="#e2e8f0">
          Консоль — PID
        </text>
        <text x="304" y={WIN_Y + 12} fontSize="10" fill="#94a3b8" textAnchor="end">
          8 циклов
        </text>
        <line x1="12" y1={WIN_Y + BAR_H} x2="308" y2={WIN_Y + BAR_H} stroke="#475569" />

        {/* Строки консоли */}
        {LINES.map((line, index) => (
          <text
            key={line.text}
            x={TEXT_X}
            y={ROW_TOP + index * ROW_STEP}
            fontSize="10"
            fontWeight={line.bold ? "700" : "400"}
            fill={line.color}
            fontFamily={MONO}
          >
            {line.text}
          </text>
        ))}

        <text x="12" y="142" fontSize="10" fontWeight="700" fill="#e2e8f0">
          Числа свои у каждого принтера
        </text>
        <text x="12" y="158" fontSize="10" fill="#94a3b8">
          Kp — сила отклика, Ki — остаток, Kd — перегрев
        </text>
        <text x="12" y="172" fontSize="10" fill="#94a3b8">
          Marlin: M500, Klipper: SAVE_CONFIG
        </text>
      </svg>
    </VisualWrapper>
  );
}
