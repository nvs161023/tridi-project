import Link from "next/link";
import { redirect } from "next/navigation";

import lessonsData from "@/data/lessons.json";
import { createClient } from "@/lib/supabase/server";

type Profile = {
  id: string;
  email: string | null;
  name: string | null;
};

const totalLessons = lessonsData.length;

/**
 * Пока прогресс не читаем из базы — на шаге 5 подключим таблицу
 * lesson_progress и посчитаем реальное количество пройденных уроков.
 */
const completedLessons = 0;

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const profile = (data as Profile | null) ?? null;

  const displayName =
    profile?.name?.trim() ||
    (typeof user.user_metadata?.name === "string"
      ? user.user_metadata.name.trim()
      : "") ||
    user.email ||
    "друг";

  const progressPercent = Math.round((completedLessons / totalLessons) * 100);

  async function logout() {
    "use server";

    const serverSupabase = await createClient();
    await serverSupabase.auth.signOut();
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-white/10 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <Link
            href="/"
            className="flex items-center gap-2 text-base font-bold transition-colors hover:text-blue-400"
          >
            <span aria-hidden>🖨️</span>
            <span>3D-печать с нуля</span>
          </Link>

          <form action={logout}>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              <span aria-hidden>↪</span>
              Выйти
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
        <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
          Личный кабинет
        </h1>
        <p className="mt-4 text-xl font-semibold text-blue-300 sm:text-2xl">
          Привет, {displayName}!
        </p>
        <p className="mt-4 text-base leading-relaxed text-slate-400 sm:text-lg">
          Здесь видно, как продвигается курс. Прогресс сохраняется за аккаунтом,
          поэтому можно продолжать с любого устройства.
        </p>

        {profileError ? (
          <p className="mt-6 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            <span aria-hidden>⚠️</span> Профиль не загрузился, показываем данные
            из аккаунта.
          </p>
        ) : null}

        <section className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-7 sm:p-9">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-white sm:text-2xl">
              Твой прогресс
            </h2>
            <span className="text-sm font-semibold text-blue-300">
              {progressPercent}%
            </span>
          </div>

          <p className="mt-4 text-base text-slate-300 sm:text-lg">
            Ты прошёл {completedLessons} из {totalLessons} уроков
          </p>

          <div
            role="progressbar"
            aria-label="Прогресс курса"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/10"
          >
            <div
              className="h-full rounded-full bg-blue-600 transition-[width] duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <p className="mt-4 text-sm text-slate-500">
            Пройди первый урок — и полоска начнёт заполняться.
          </p>
        </section>

        <div className="mt-10 sm:mt-12">
          <Link
            href="/course/lesson-1"
            className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-9 text-lg font-semibold text-white shadow-lg shadow-blue-600/30 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:w-auto"
          >
            Продолжить курс
            <span aria-hidden>→</span>
          </Link>
        </div>
      </main>
    </div>
  );
}
