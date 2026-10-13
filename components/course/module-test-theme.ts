/**
 * Оформление тестов модуля: базовый курс — синий, «Уверенный» — изумрудный,
 * «Инженер» — фиалковый, «Заработок» — розовый, продвинутый — янтарный.
 *
 * Живёт отдельным модулем без "use client", потому что цвета нужны и клиентским
 * компонентам (ModuleTest, TestOverlay), и серверным (ModuleTestGate на странице
 * урока). Данные из модуля с "use client" в серверный компонент не доедут: он
 * получит ссылку на клиентский модуль, а не сам объект.
 *
 * Классы собраны в одном месте, чтобы кнопки, полоса прогресса и акцентные
 * подписи не разъезжались между курсами.
 */
export const moduleTestThemes = {
  basic: {
    primary:
      "inline-flex min-h-14 flex-1 items-center justify-center gap-2 rounded-full bg-blue-600 px-9 text-lg font-semibold text-white shadow-lg shadow-blue-600/30 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
    secondary:
      "inline-flex min-h-14 flex-1 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-9 text-lg font-semibold text-slate-100 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
    accentText: "text-blue-300",
    eyebrow: "text-blue-400",
    bar: "bg-blue-600",
    ring: "focus-visible:ring-blue-400",
    optionHover: "hover:border-blue-400/60",
  },
  confident: {
    primary:
      "inline-flex min-h-14 flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 px-9 text-lg font-semibold text-slate-950 shadow-lg shadow-emerald-500/25 transition-colors hover:from-emerald-300 hover:to-teal-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
    secondary:
      "inline-flex min-h-14 flex-1 items-center justify-center gap-2 rounded-full border border-emerald-400/40 bg-white/5 px-9 text-lg font-semibold text-emerald-100 transition-colors hover:bg-emerald-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
    accentText: "text-emerald-300",
    eyebrow: "text-emerald-300",
    bar: "bg-gradient-to-r from-emerald-400 to-teal-500",
    ring: "focus-visible:ring-emerald-300",
    optionHover: "hover:border-emerald-300/60",
  },
  pro: {
    primary:
      "inline-flex min-h-14 flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 px-9 text-lg font-semibold text-slate-950 shadow-lg shadow-amber-500/25 transition-colors hover:from-amber-300 hover:to-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
    secondary:
      "inline-flex min-h-14 flex-1 items-center justify-center gap-2 rounded-full border border-amber-400/40 bg-white/5 px-9 text-lg font-semibold text-amber-100 transition-colors hover:bg-amber-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
    accentText: "text-amber-300",
    eyebrow: "text-amber-300",
    bar: "bg-gradient-to-r from-amber-400 to-amber-500",
    ring: "focus-visible:ring-amber-300",
    optionHover: "hover:border-amber-300/60",
  },
  engineer: {
    primary:
      "inline-flex min-h-14 flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-violet-400 to-indigo-500 px-9 text-lg font-semibold text-slate-950 shadow-lg shadow-violet-500/25 transition-colors hover:from-violet-300 hover:to-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
    secondary:
      "inline-flex min-h-14 flex-1 items-center justify-center gap-2 rounded-full border border-violet-400/40 bg-white/5 px-9 text-lg font-semibold text-violet-100 transition-colors hover:bg-violet-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
    accentText: "text-violet-300",
    eyebrow: "text-violet-300",
    bar: "bg-gradient-to-r from-violet-400 to-indigo-500",
    ring: "focus-visible:ring-violet-300",
    optionHover: "hover:border-violet-300/60",
  },
  profit: {
    primary:
      "inline-flex min-h-14 flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-rose-400 to-pink-500 px-9 text-lg font-semibold text-slate-950 shadow-lg shadow-rose-500/25 transition-colors hover:from-rose-300 hover:to-pink-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
    secondary:
      "inline-flex min-h-14 flex-1 items-center justify-center gap-2 rounded-full border border-rose-400/40 bg-white/5 px-9 text-lg font-semibold text-rose-100 transition-colors hover:bg-rose-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
    accentText: "text-rose-300",
    eyebrow: "text-rose-300",
    bar: "bg-gradient-to-r from-rose-400 to-pink-500",
    ring: "focus-visible:ring-rose-300",
    optionHover: "hover:border-rose-300/60",
  },
} as const;
