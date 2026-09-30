import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * «Уведомление» — принтер слева заканчивает печать (ползунок доходит до конца
 * шкалы, голова уходит в парковку), от принтера к телефону по пунктирной дуге
 * летит бумажный самолётик, в окне Telegram всплывает сообщение с фото печати и
 * словами «Печать завершена», а в углу сообщения загорается зелёная галочка.
 *
 * Ровно по content урока: «Печать завершена → уведомление в Telegram с фото. Ты
 * знаешь, что всё ок» — это фазы кадра и нижняя подпись. Бумажный самолётик —
 * значок мессенджера, а не выдуманный предмет: слова «Telegram» и «фото» есть в
 * уроке. Чисел в кадре нет: ни процентов прогресса, ни времени сообщения урок
 * не называет, поэтому шкала показана ползунком без цифр.
 *
 * От P1-animation (телефон жмёт кнопку «Печать») отличается направлением и
 * предметом: там команда идёт из телефона в принтер и шкала только начинает
 * заполняться, здесь печать уже закончена и сообщение летит на телефон. От
 * P4-animation (четыре ступени с подсветкой) — тем, что там цепочка ступеней в
 * рамках, а здесь путь самолётика по дуге и всплывающее сообщение. От
 * P5-screenshot-0 (окно чата со списком событий) — тем, что там статичный
 * скриншот и перечень событий, а здесь движение и одно сообщение.
 *
 * Классы с префиксом v-pp5a: <style> внутри SVG действует на всю страницу.
 */
export function ProPP5Animation0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Анимация уведомления о конце печати: ползунок шкалы на принтере доходит до конца, голова уходит в парковку, от принтера по пунктирной дуге к телефону летит бумажный самолётик, в окне Telegram всплывает сообщение с фотографией напечатанной детали и словами «Печать завершена», а в углу сообщения загорается зелёная галочка. Внизу подписи: печать завершена — телефон уже знает, ты знаешь, что всё ок."
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <style>{`
          .v-pp5a-knob { animation: v-pp5a-knob 8s linear infinite; }
          .v-pp5a-head { animation: v-pp5a-head 8s ease-in-out infinite; }
          .v-pp5a-flow { animation: v-pp5a-flow 8s linear infinite; }
          .v-pp5a-plane { opacity: 0; animation: v-pp5a-plane 8s ease-in-out infinite; }
          .v-pp5a-bubble { opacity: 0.3; animation: v-pp5a-bubble 8s ease-out infinite; }
          .v-pp5a-check { opacity: 0.3; animation: v-pp5a-check 8s ease-out infinite; }
          @keyframes v-pp5a-knob {
            0%, 4% { transform: translateX(0); }
            50%, 92% { transform: translateX(78px); }
            100% { transform: translateX(0); }
          }
          @keyframes v-pp5a-head {
            0%, 50% { transform: translateX(0); }
            62%, 90% { transform: translateX(88px); }
            100% { transform: translateX(0); }
          }
          @keyframes v-pp5a-flow {
            0%, 52% { stroke-dashoffset: 0; opacity: 0.3; }
            62%, 88% { stroke-dashoffset: -10; opacity: 1; }
            100% { stroke-dashoffset: 0; opacity: 0.3; }
          }
          @keyframes v-pp5a-plane {
            0%, 50% { opacity: 0; transform: translate(0, 0); }
            58% { opacity: 1; transform: translate(20px, -6px); }
            70% { opacity: 1; transform: translate(58px, 0); }
            78%, 100% { opacity: 0; transform: translate(58px, 0); }
          }
          @keyframes v-pp5a-bubble {
            0%, 70% { opacity: 0.3; }
            80%, 94% { opacity: 1; }
            100% { opacity: 0.3; }
          }
          @keyframes v-pp5a-check {
            0%, 76% { opacity: 0.3; }
            86%, 94% { opacity: 1; }
            100% { opacity: 0.3; }
          }
          @media (prefers-reduced-motion: reduce) {
            .v-pp5a-knob { animation: none; transform: translateX(78px); }
            .v-pp5a-head { animation: none; transform: translateX(88px); }
            .v-pp5a-flow { animation: none; stroke-dashoffset: 0; opacity: 1; }
            .v-pp5a-plane { animation: none; opacity: 0; }
            .v-pp5a-bubble { animation: none; opacity: 1; }
            .v-pp5a-check { animation: none; opacity: 1; }
          }
        `}</style>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          Уведомление: печать завершена
        </text>

        {/* Принтер: деталь на столе, шкала с ползунком и голова, уходящая в парковку */}
        <rect x="12" y="34" width="122" height="98" rx="6" fill="#1e293b" fillOpacity="0.35" stroke="#475569" />
        <text x="20" y="48" fontSize="7.5" fill="#e2e8f0">
          принтер
        </text>
        <line x1="20" y1="62" x2="126" y2="62" stroke="#475569" />
        <rect x="20" y="112" width="100" height="4" rx="1" fill="#334155" />
        <path d="M 58,112 C 55,102 57,94 60,88 L 80,88 C 83,94 85,102 82,112 Z" fill="#6ee7b7" fillOpacity="0.85" />
        <g className="v-pp5a-head">
          <rect x="24" y="60" width="14" height="8" rx="1" fill="#334155" stroke="#94a3b8" />
          <polygon points="28,68 34,68 31,74" fill="#fbbf24" />
        </g>
        <rect x="20" y="120" width="100" height="6" rx="3" fill="#1e293b" stroke="#334155" />
        <rect x="20" y="118" width="22" height="10" rx="3" fill="#38bdf8" className="v-pp5a-knob" />

        {/* Путь сообщения: пунктирная дуга от принтера к телефону */}
        <path d="M 134,84 C 150,72 172,72 194,84" fill="none" stroke="#475569" strokeDasharray="3 2" className="v-pp5a-flow" />
        <g transform="translate(134,84)">
          <g className="v-pp5a-plane">
            <polygon points="0,0 14,4 5,8" fill="#38bdf8" />
            <polygon points="5,8 14,4 7,10" fill="#0ea5e9" />
          </g>
        </g>

        {/* Телефон: окно Telegram и всплывающее сообщение с фото печати */}
        <rect x="194" y="34" width="114" height="98" rx="6" fill="#1e293b" fillOpacity="0.35" stroke="#475569" />
        <rect x="200" y="40" width="102" height="86" rx="4" fill="#0b1220" stroke="#475569" />
        <text x="206" y="54" fontSize="8" fontWeight="bold" fill="#e2e8f0">
          Telegram
        </text>
        <rect x="206" y="62" width="88" height="46" rx="4" fill="#1e293b" stroke="#34d399" strokeOpacity="0.5" className="v-pp5a-bubble" />
        <rect x="210" y="66" width="32" height="24" rx="2" fill="#0b1220" stroke="#334155" className="v-pp5a-bubble" />
        <rect x="214" y="86" width="24" height="3" fill="#334155" />
        <path d="M 220,86 C 218,81 219,77 221,74 L 233,74 C 235,77 236,81 234,86 Z" fill="#6ee7b7" fillOpacity="0.9" />
        <text x="248" y="76" fontSize="8" fontWeight="bold" fill="#6ee7b7" className="v-pp5a-bubble">
          Печать
        </text>
        <text x="248" y="88" fontSize="7.5" fill="#6ee7b7" className="v-pp5a-bubble">
          завершена
        </text>
        <circle cx="284" cy="100" r="6" fill="#14532d" stroke="#34d399" className="v-pp5a-check" />
        <path d="M 281,100 l 2.5,2.5 l 4.5,-5" fill="none" stroke="#6ee7b7" strokeWidth="1.2" className="v-pp5a-check" />
        <text x="250" y="122" fontSize="7.5" fill="#e2e8f0" textAnchor="middle">
          телефон
        </text>

        <text x="12" y="142" fontSize="8" fill="#94a3b8">
          печать завершена — телефон уже знает
        </text>
        <text x="12" y="160" fontSize="7.5" fill="#94a3b8">
          ты знаешь, что всё ок
        </text>
      </svg>
    </VisualWrapper>
  );
}
