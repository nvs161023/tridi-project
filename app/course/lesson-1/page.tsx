import Link from "next/link";

import courseData from "@/data/course.json";

type BoxItem = {
  icon: string;
  text: string;
};

type AssemblyStep = {
  title: string;
  description: string;
};

const boxItems: BoxItem[] = [
  {
    icon: "🖨️",
    text: "Сам принтер — рама, экструдер, стол и блок питания в отдельной коробке.",
  },
  {
    icon: "🧵",
    text: "Катушка пластика — обычно PLA, её хватает на первые тестовые печати.",
  },
  {
    icon: "🧰",
    text: "Набор инструментов: шестигранники, ключи, шпатель и пинцет.",
  },
  {
    icon: "💾",
    text: "Карта памяти или USB-накопитель с тестовой моделью.",
  },
  {
    icon: "📄",
    text: "Инструкция по сборке и памятка по безопасной работе с принтером.",
  },
];

const assemblySteps: AssemblyStep[] = [
  {
    title: "Распакуйте и проверьте комплектацию",
    description:
      "Разложите детали по группам и сверьтесь со списком из инструкции. Если чего-то не хватает, напишите продавцу до начала сборки.",
  },
  {
    title: "Установите раму и закрепите винты",
    description:
      "Соберите раму на ровной поверхности и сначала наживите винты без усилия. Затягивайте их полностью только тогда, когда каркас встал ровно, без перекосов.",
  },
  {
    title: "Подключите кабели и включите принтер",
    description:
      "Подсоедините блок питания, кабель экструдера и датчики по подписям на плате. Включите принтер и убедитесь, что он проходит самопроверку без ошибок.",
  },
];

const lessonNumber = 1;
const allLessons = courseData.modules.flatMap(
  (courseModule) => courseModule.lessons,
);
const lesson = allLessons[lessonNumber - 1];
const currentModule = courseData.modules.find((courseModule) =>
  courseModule.lessons.some((item) => item.id === lessonNumber),
);
const totalLessons = courseData.totalLessons;
const progressPercent = Math.round((lessonNumber / totalLessons) * 100);

export default function LessonOnePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto max-w-3xl px-5 py-4 sm:px-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 transition-colors hover:text-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            <span aria-hidden>←</span>
            Назад к курсу
          </Link>

          <div className="mt-4">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400 sm:text-sm">
              <span>
                Урок {lessonNumber} из {totalLessons}
              </span>
              <span className="text-blue-400">{progressPercent}%</span>
            </div>
            <div
              role="progressbar"
              aria-label="Прогресс курса"
              aria-valuenow={progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10"
            >
              <div
                className="h-full rounded-full bg-blue-600 transition-[width] duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
        <p className="text-sm font-semibold uppercase tracking-widest text-blue-400">
          Модуль {currentModule?.id}: {currentModule?.title}
        </p>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
          {lesson.title}
        </h1>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-blue-500/40 bg-blue-500/10 px-4 py-1.5 text-xs font-semibold text-blue-300 sm:text-sm">
            <span aria-hidden>⏱️</span>
            {lesson.duration}
          </span>
          <span className="text-sm text-slate-400">
            Короткая теория и задания для практики
          </span>
        </div>

        <div className="mt-12 space-y-8 sm:mt-16 sm:space-y-10">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-7 sm:p-9">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              Что такое 3D-печать
            </h2>
            <p className="mt-5 text-base leading-relaxed text-slate-300 sm:text-lg">
              3D-печать — это технология послойного создания объектов: принтер
              выдавливает расплавленный пластик тонкой нитью, слой за слоем, и
              постепенно из этих слоёв вырастает готовая деталь. Заготовка здесь
              не нужна — форма появляется прямо во время печати.
            </p>
            <p className="mt-4 text-base leading-relaxed text-slate-300 sm:text-lg">
              Так печатают и простые вещи вроде креплений и брелоков, и большие
              проекты — вазы или светильники. В этом уроке мы разберём, из чего
              состоит принтер и как подготовить его к первой печати.
            </p>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-7 sm:p-9">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              Что в коробке с принтером
            </h2>
            <ul className="mt-6 space-y-4">
              {boxItems.map((item) => (
                <li key={item.text} className="flex items-start gap-4">
                  <span
                    aria-hidden
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600/15 text-xl"
                  >
                    {item.icon}
                  </span>
                  <span className="pt-1.5 text-base leading-relaxed text-slate-300">
                    {item.text}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-7 sm:p-9">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              Как собрать принтер
            </h2>
            <ol className="mt-6 space-y-6">
              {assemblySteps.map((step, index) => (
                <li key={step.title} className="flex items-start gap-4">
                  <span
                    aria-hidden
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-base font-extrabold text-white"
                  >
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="text-lg font-bold text-white sm:text-xl">
                      Шаг {index + 1}: {step.title}
                    </h3>
                    <p className="mt-2 text-base leading-relaxed text-slate-400">
                      {step.description}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="mt-12 sm:mt-16">
          <Link
            href="/course/lesson-2"
            className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-9 text-lg font-semibold text-white shadow-lg shadow-blue-600/30 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            Пройти урок
            <span aria-hidden>→</span>
          </Link>
        </div>
      </main>
    </div>
  );
}
