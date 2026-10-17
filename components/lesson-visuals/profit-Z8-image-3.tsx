import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Кадр блока 21 урока Z8 «Финальный проект: свой продукт».
 *
 * `Z8_channel_doors.png`: две двери к покупателю. Онлайн — площадка объявлений:
 * быстрые просмотры и много вопросов, час в неделю на объявления. Живой выход —
 * ярмарка, маркет мастеров или знакомые: пять-семь готовых штук и один образец,
 * один выходной в месяц. Третий канал — свой круг: соцсети, чаты и знакомые,
 * он медленный, но бесплатный и даёт первые отзывы. Если за две недели ноль
 * просмотров при живом товаре — сначала проверь фото и цену, потом меняй канал.
 */
export function ProfitZ8Image3({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Две двери к покупателю. Онлайн: площадка объявлений, быстрые просмотры, много вопросов, цена без торга, час в неделю на объявления. Живой выход: ярмарка, маркет мастеров или знакомые, пять-семь готовых штук и один образец в работе, один выходной в месяц. Третий канал — свой круг: соцсети, чаты и знакомые, работает медленно, но бесплатно и даёт первые отзывы. За две недели ноль просмотров при живом товаре — сначала проверь фото и цену, потом меняй канал"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="11" fontWeight="700" fill="#e2e8f0">
          две двери к покупателю
        </text>
        <text x="12" y="29" fontSize="10" fill="#94a3b8">
          каналов много · для старта хватит двух
        </text>
        <rect x="268" y="5" width="42" height="14" rx="7" fill="#22d3ee" fillOpacity="0.15" stroke="#22d3ee" strokeOpacity="0.5" />
        <text x="289" y="15" fontSize="10" fontWeight="700" fill="#22d3ee" textAnchor="middle">
          1 + 1
        </text>

        <rect x="10" y="38" width="145" height="66" rx="6" fill="#0f172a" stroke="#06b6d4" strokeOpacity="0.55" />
        <rect x="10" y="38" width="145" height="3" rx="1.5" fill="#06b6d4" />
        <text x="18" y="54" fontSize="10" fontWeight="700" fill="#22d3ee">
          площадка объявлений
        </text>
        <text x="18" y="70" fontSize="10" fill="#cbd5e1">
          быстрые просмотры
        </text>
        <text x="18" y="83" fontSize="10" fill="#cbd5e1">
          много вопросов
        </text>
        <text x="18" y="96" fontSize="10" fill="#cbd5e1">
          цена без «договоримся»
        </text>

        <rect x="165" y="38" width="145" height="66" rx="6" fill="#0f172a" stroke="#f59e0b" strokeOpacity="0.55" />
        <rect x="165" y="38" width="145" height="3" rx="1.5" fill="#f59e0b" />
        <text x="173" y="54" fontSize="10" fontWeight="700" fill="#fbbf24">
          живой выход
        </text>
        <text x="173" y="70" fontSize="10" fill="#cbd5e1">
          ярмарка, маркет, знакомые
        </text>
        <text x="173" y="83" fontSize="10" fill="#cbd5e1">
          руки, лицо, вопросы
        </text>
        <text x="173" y="96" fontSize="10" fill="#cbd5e1">
          5–7 штук + 1 образец
        </text>

        <rect x="10" y="108" width="145" height="14" rx="4" fill="#0f172a" stroke="#334155" />
        <text x="18" y="118" fontSize="10" fill="#94a3b8">
          1 час в неделю
        </text>
        <rect x="165" y="108" width="145" height="14" rx="4" fill="#0f172a" stroke="#334155" />
        <text x="173" y="118" fontSize="10" fill="#94a3b8">
          1 выходной в месяц
        </text>

        <rect x="10" y="126" width="300" height="48" rx="5" fill="#0f172a" stroke="#334155" />
        <text x="18" y="139" fontSize="10" fontWeight="700" fill="#e2e8f0">
          третий канал — свой круг: соцсети, чаты
        </text>
        <text x="18" y="153" fontSize="10" fill="#cbd5e1">
          медленно, но бесплатно → первые отзывы
        </text>
        <text x="18" y="168" fontSize="10" fill="#f87171">
          2 недели без просмотров → проверь фото и цену
        </text>
      </svg>
    </VisualWrapper>
  );
}
