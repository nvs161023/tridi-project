import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * «Работа VPN» — телефон слева, узел VPN в середине и домашняя сеть справа:
 * переключатель в телефоне уезжает вправо и загорается, по пунктирному туннелю
 * бегут штрихи до домашней сети, над роутером вспыхивают дуги сигнала, голова
 * принтера проходит по порталу, а внизу домашней сети открывается окно
 * OctoPrint — то самое, что видно локально.
 *
 * Ровно по content урока: «Телефон подключается к VPN. Ты видишь домашнюю сеть.
 * Открываешь OctoPrint как локально» — это и есть фазы кадра в том же порядке.
 * Числа в кадре отсутствуют: в уроке P3 нет ни процентов, ни секунд, а пунктир
 * туннеля и дуги связи — это движение, а не счётчик.
 *
 * От P1-animation (телефон с кнопкой «Печать» и растущими слоями) отличается
 * тем, что там телефон управляет печатью, а здесь телефон только подключается
 * к сети: нет ни кнопки, ни шкалы прогресса, ни счётчика. От P2-animation
 * (окно просчёта вперёд и бегущие огоньки по контуру) — предметом: там Klipper
 * считает путь, здесь туннель до домашней сети. От «Сканирования»
 * N2-animation (журнал обхода) — тем, что журнала-панели в кадре нет вовсе.
 *
 * Классы с префиксом v-pp3a: <style> внутри SVG действует на всю страницу.
 */
export function ProPP3Animation0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Анимация работы VPN: в телефоне переключатель уезжает вправо и загорается надпись VPN, от телефона к узлу VPN и дальше к домашней сети по пунктирным линиям бегут штрихи, над роутером вспыхивают дуги сигнала, голова принтера проходит по порталу, а под роутером и принтером открывается окно OctoPrint с подписью «как локально» — принтер виден так же, как если бы стоял рядом. Внизу: домашнюю сеть видно, OctoPrint открывается как локально, открытых портов нет — доступ идёт по туннелю."
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <style>{`
          .v-pp3a-switch { animation: v-pp3a-switch 7s ease-in-out infinite; }
          .v-pp3a-on { animation: v-pp3a-on 7s ease-in-out infinite; }
          .v-pp3a-f1 { animation: v-pp3a-flow 7s linear infinite; }
          .v-pp3a-f2 { animation: v-pp3a-flow 7s linear -0.3s infinite; }
          .v-pp3a-a1 { animation: v-pp3a-arc 7s ease-in-out infinite; }
          .v-pp3a-a2 { animation: v-pp3a-arc 7s ease-in-out -0.4s infinite; }
          .v-pp3a-head { animation: v-pp3a-head 7s ease-in-out infinite; }
          .v-pp3a-win { opacity: 0.3; animation: v-pp3a-win 7s ease-out infinite; }
          @keyframes v-pp3a-switch {
            0%, 6% { transform: translateX(0); fill: #64748b; }
            20%, 90% { transform: translateX(14px); fill: #6ee7b7; }
            100% { transform: translateX(0); fill: #64748b; }
          }
          @keyframes v-pp3a-on {
            0%, 14% { opacity: 0.25; fill: #64748b; }
            24%, 88% { opacity: 1; fill: #6ee7b7; }
            100% { opacity: 0.25; fill: #64748b; }
          }
          @keyframes v-pp3a-flow {
            0%, 22% { stroke-dashoffset: 12; opacity: 0.25; }
            42%, 86% { stroke-dashoffset: 0; opacity: 1; }
            100% { stroke-dashoffset: 12; opacity: 0.25; }
          }
          @keyframes v-pp3a-arc {
            0%, 46% { opacity: 0.12; }
            58%, 90% { opacity: 1; }
            100% { opacity: 0.12; }
          }
          @keyframes v-pp3a-head {
            0%, 50% { transform: translateX(0); }
            72%, 92% { transform: translateX(14px); }
            100% { transform: translateX(0); }
          }
          @keyframes v-pp3a-win {
            0%, 60% { opacity: 0.3; }
            76%, 94% { opacity: 1; }
            100% { opacity: 0.3; }
          }
          @media (prefers-reduced-motion: reduce) {
            .v-pp3a-switch { animation: none; transform: translateX(14px); fill: #6ee7b7; }
            .v-pp3a-on { animation: none; opacity: 1; fill: #6ee7b7; }
            .v-pp3a-f1, .v-pp3a-f2 { animation: none; stroke-dashoffset: 0; opacity: 1; }
            .v-pp3a-a1, .v-pp3a-a2 { animation: none; opacity: 1; }
            .v-pp3a-head { animation: none; transform: translateX(14px); }
            .v-pp3a-win { animation: none; opacity: 1; }
          }
        `}</style>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          Работа VPN: видно домашнюю сеть
        </text>

        {/* Телефон: переключатель VPN на экране и подписи под корпусом */}
        <rect x="14" y="32" width="44" height="70" rx="5" fill="#334155" stroke="#94a3b8" />
        <rect x="18" y="36" width="36" height="62" rx="3" fill="#0b1220" stroke="#475569" />
        <rect x="24" y="48" width="24" height="10" rx="5" fill="#334155" stroke="#475569" />
        <circle cx="29" cy="53" r="4" fill="#64748b" className="v-pp3a-switch" />
        <text x="36" y="70" fontSize="8" fontWeight="bold" fill="#64748b" textAnchor="middle" className="v-pp3a-on">
          VPN
        </text>
        <text x="36" y="112" fontSize="7.5" fill="#e2e8f0" textAnchor="middle">
          телефон
        </text>
        <text x="36" y="124" fontSize="7.5" fill="#94a3b8" textAnchor="middle">
          подключается
        </text>

        {/* Узел VPN: пунктир туннеля входит и выходит */}
        <rect x="70" y="40" width="96" height="54" rx="5" fill="#0f172a" stroke="#34d399" strokeOpacity="0.5" />
        <text x="118" y="62" fontSize="10" fontWeight="bold" fill="#6ee7b7" textAnchor="middle">
          VPN
        </text>
        <text x="118" y="78" fontSize="7.5" fill="#94a3b8" textAnchor="middle">
          туннель
        </text>
        <line x1="58" y1="72" x2="70" y2="72" stroke="#6ee7b7" strokeDasharray="3 2" className="v-pp3a-f1" />
        <line x1="166" y1="72" x2="180" y2="72" stroke="#6ee7b7" strokeDasharray="3 2" className="v-pp3a-f2" />

        {/* Домашняя сеть: роутер с дугами сигнала, принтер и окно OctoPrint */}
        <rect x="180" y="28" width="128" height="96" rx="5" fill="#0f172a" stroke="#475569" />
        <rect x="190" y="40" width="34" height="16" rx="2" fill="#334155" stroke="#94a3b8" />
        <line x1="195" y1="40" x2="193" y2="32" stroke="#94a3b8" />
        <line x1="219" y1="40" x2="221" y2="32" stroke="#94a3b8" />
        <path d="M 200,32 q 7,-8 14,0" fill="none" stroke="#38bdf8" className="v-pp3a-a1" />
        <path d="M 196,30 q 11,-11 22,0" fill="none" stroke="#38bdf8" className="v-pp3a-a2" />
        <text x="192" y="72" fontSize="8" fill="#e2e8f0">
          домашняя сеть
        </text>

        <rect x="250" y="38" width="34" height="36" rx="2" fill="#1e293b" stroke="#94a3b8" />
        <line x1="250" y1="52" x2="284" y2="52" stroke="#475569" />
        <rect x="252" y="68" width="30" height="4" rx="1" fill="#334155" />
        <rect x="262" y="58" width="10" height="10" fill="#6ee7b7" fillOpacity="0.9" />
        <g className="v-pp3a-head">
          <rect x="256" y="50" width="14" height="7" rx="1" fill="#334155" stroke="#94a3b8" />
          <polygon points="260,57 266,57 263,63" fill="#fbbf24" />
        </g>
        <text x="252" y="90" fontSize="7.5" fill="#e2e8f0">
          принтер
        </text>

        <rect x="188" y="98" width="112" height="20" rx="3" fill="#0b1220" stroke="#6ee7b7" strokeOpacity="0.5" className="v-pp3a-win" />
        <text x="194" y="112" fontSize="8" fontWeight="bold" fill="#6ee7b7" className="v-pp3a-win">
          OctoPrint
        </text>
        <text x="240" y="112" fontSize="7.5" fill="#6ee7b7" className="v-pp3a-win">
          как локально
        </text>

        <text x="12" y="142" fontSize="8" fill="#94a3b8">
          ты видишь домашнюю сеть и открываешь OctoPrint
        </text>
        <text x="12" y="160" fontSize="7.5" fill="#94a3b8">
          без открытых портов — доступ идёт по туннелю
        </text>
      </svg>
    </VisualWrapper>
  );
}
