import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * «Оборудование» — план комнаты сверху, а не ряд предметов с подписями.
 * Смысл кадра в расстановке: стол у стены, зона обнаружения датчика накрывает
 * принтер, огнетушитель стоит у двери, умная розетка — сразу за столом, второй
 * извещатель висит в дальней части комнаты.
 *
 * От E1-1, B2 и M-M3 (ряд предметов с подписями под каждым) отличается тем, что
 * предметы размечены по помещению, а не выстроены в линию с карточками. От
 * A-без1 (комната в разрезе: стены, поток частиц, вытяжка) — взглядом: здесь
 * план сверху и никакого потока. От C1-2 (вид сверху на принтер, восемь меток
 * периодичности и легенда к ним) — объектом кадра: тут комната целиком, а не
 * узлы принтера, и меток-точек нет вовсе.
 */
export function ProCPozhCPozh1Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="План комнаты сверху: у стены стол с принтером, над ним датчик дыма с пунктирной зоной обнаружения, у двери — огнетушитель CO2 на кронштейне, за столом — умная розетка с авто-отключением, в дальней части комнаты — второй извещатель. У каждого предмета короткая подпись, зачем он нужен."
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="14" fontSize="10" fill="#94a3b8">
          План комнаты: что поставить и зачем
        </text>

        {/* Пол и стены: нижняя стена разорвана дверным проёмом */}
        <rect x="18" y="30" width="284" height="126" fill="#0f172a" fillOpacity="0.35" />
        <line x1="18" y1="30" x2="302" y2="30" stroke="#94a3b8" strokeWidth="2.2" />
        <line x1="18" y1="30" x2="18" y2="156" stroke="#94a3b8" strokeWidth="2.2" />
        <line x1="302" y1="30" x2="302" y2="156" stroke="#94a3b8" strokeWidth="2.2" />
        <line x1="18" y1="156" x2="208" y2="156" stroke="#94a3b8" strokeWidth="2.2" />
        <line x1="242" y1="156" x2="302" y2="156" stroke="#94a3b8" strokeWidth="2.2" />
        {/* Полотно двери открыто внутрь, пунктирная дуга — зона открывания */}
        <line x1="208" y1="156" x2="208" y2="122" stroke="#94a3b8" strokeWidth="1.6" />
        <path d="M242,156 A34,34 0 0 0 208,122" fill="none" stroke="#64748b" strokeWidth="0.9" strokeDasharray="3 3" />
        <text x="188" y="118" fontSize="7.5" fill="#64748b" textAnchor="middle">
          дверь
        </text>

        {/* Стол у стены и принтер на нём — источник тепла 200–300 °C */}
        <rect x="38" y="34" width="112" height="36" rx="2" fill="#334155" fillOpacity="0.85" stroke="#64748b" strokeWidth="0.9" />
        <rect x="54" y="40" width="78" height="24" rx="2" fill="#1e293b" stroke="#60a5fa" strokeWidth="1.2" />
        <rect x="62" y="46" width="62" height="12" rx="1" fill="#0f172a" stroke="#475569" strokeWidth="0.8" />
        <circle cx="140" cy="48" r="6" fill="#1e293b" stroke="#f59e0b" strokeWidth="1.1" />
        <circle cx="140" cy="48" r="2.4" fill="#f59e0b" fillOpacity="0.5" />
        <text x="24" y="80" fontSize="7.5" fill="#e2e8f0">
          принтер
        </text>
        <text x="24" y="91" fontSize="7.5" fill="#94a3b8">
          200–300 °C
        </text>

        {/* Умная розетка за столом: питание принтера и авто-отключение */}
        <line x1="154" y1="58" x2="132" y2="58" stroke="#94a3b8" strokeWidth="1.4" />
        <rect x="154" y="42" width="14" height="18" rx="2" fill="#1e293b" stroke="#fbbf24" strokeWidth="1.2" />
        <circle cx="161" cy="47" r="1.6" fill="#475569" />
        <circle cx="161" cy="55" r="1.6" fill="#475569" />
        <text x="172" y="46" fontSize="7.5" fill="#e2e8f0">
          умная розетка
        </text>
        <text x="172" y="57" fontSize="7.5" fill="#94a3b8">
          авто-отключение
        </text>

        {/* Датчик дыма над принтером: пунктиром показана зона обнаружения */}
        <circle
          cx="110"
          cy="84"
          r="27"
          fill="#fbbf24"
          fillOpacity="0.07"
          stroke="#fbbf24"
          strokeOpacity="0.4"
          strokeWidth="0.9"
          strokeDasharray="3 4"
        />
        <circle cx="110" cy="84" r="8.5" fill="#1e293b" stroke="#fbbf24" strokeWidth="1.3" />
        <circle cx="110" cy="84" r="3" fill="#fbbf24" fillOpacity="0.6" />
        <text x="94" y="124" fontSize="7.5" fill="#e2e8f0" textAnchor="middle">
          датчик дыма
        </text>
        <text x="94" y="135" fontSize="7.5" fill="#94a3b8" textAnchor="middle">
          над принтером
        </text>

        {/* Второй извещатель — в дальней части комнаты */}
        <circle
          cx="262"
          cy="74"
          r="19"
          fill="#fbbf24"
          fillOpacity="0.06"
          stroke="#fbbf24"
          strokeOpacity="0.35"
          strokeWidth="0.8"
          strokeDasharray="3 4"
        />
        <circle cx="262" cy="74" r="7" fill="#1e293b" stroke="#fbbf24" strokeWidth="1.1" />
        <circle cx="262" cy="74" r="2.4" fill="#fbbf24" fillOpacity="0.6" />
        <text x="262" y="104" fontSize="7.5" fill="#e2e8f0" textAnchor="middle">
          извещатель
        </text>
        <text x="262" y="115" fontSize="7.5" fill="#94a3b8" textAnchor="middle">
          в комнате
        </text>

        {/* Огнетушитель CO2 у двери: на кронштейне к нижней стене */}
        <rect x="186" y="130" width="14" height="22" rx="3" fill="#ef4444" fillOpacity="0.85" stroke="#fca5a5" strokeWidth="1.1" />
        <line x1="180" y1="130" x2="188" y2="134" stroke="#94a3b8" strokeWidth="1.2" />
        <line x1="193" y1="152" x2="193" y2="156" stroke="#64748b" strokeWidth="1" />
        <text x="178" y="132" fontSize="7.5" fill="#e2e8f0" textAnchor="end">
          огнетушитель
        </text>
        <text x="178" y="143" fontSize="7.5" fill="#94a3b8" textAnchor="end">
          CO2, не вода
        </text>

        <text x="12" y="170" fontSize="8" fill="#94a3b8">
          принтер — источник тепла 200–300 °C, датчик дыма — 1500–3000 ₽
        </text>
      </svg>
    </VisualWrapper>
  );
}
