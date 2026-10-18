"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { PrintProfile, ProfileCategory } from "@/lib/profiles";

type ProfilesClientProps = {
  categories: ProfileCategory[];
  hasPro: boolean;
};

/** Иконки категорий: данные остаются текстовыми, оформление — здесь. */
const CATEGORY_ICONS: Record<string, string> = {
  printers: "🖨️",
  materials: "🧵",
  "print-settings": "⚙️",
};

const PROFILE_FORMS = ["профиль", "профиля", "профилей"] as const;

/** Бренды в порядке показа. Generic — универсальные и community-профили. */
const BRANDS = [
  "Bambu Lab",
  "Prusa",
  "Creality",
  "Anycubic",
  "Generic",
] as const;

type Brand = (typeof BRANDS)[number];

/**
 * Модели по бренду. Список шире данных: пустые модели показывают честное
 * пустое состояние, а не пропадают из выбора.
 */
const BRAND_MODELS: Record<Brand, readonly string[]> = {
  "Bambu Lab": ["X1C", "P1P"],
  Prusa: ["MK3S+"],
  Creality: ["Ender 3"],
  Anycubic: ["Kobra", "Kobra 2"],
  Generic: ["Universal", "Voron 2.4"],
};

const MATERIALS = ["PLA", "PETG", "ABS", "TPU", "Universal"] as const;

/** Русская форма слова по числу: 1 профиль, 2 профиля, 5 профилей. */
function pluralize(count: number, forms: readonly [string, string, string]) {
  const mod100 = count % 100;
  const mod10 = count % 10;

  if (mod100 >= 11 && mod100 <= 14) {
    return forms[2];
  }

  if (mod10 === 1) {
    return forms[0];
  }

  if (mod10 >= 2 && mod10 <= 4) {
    return forms[1];
  }

  return forms[2];
}

/**
 * Правила каскада:
 * - бренд и модель фильтруют принтеры и процессы;
 * - материал открывает профили материалов для выбранного пластика;
 * - Generic/Universal — универсальные пресеты, их видно без выбора пластика;
 * - без фильтров показываем всю библиотеку.
 */
function matchesFilters(
  profile: PrintProfile,
  brand: string,
  model: string,
  material: string,
): boolean {
  if (profile.category === "material") {
    if (material) {
      if (profile.material !== material) {
        return false;
      }

      if (
        brand &&
        profile.manufacturer !== brand &&
        profile.manufacturer !== "Generic"
      ) {
        return false;
      }

      if (
        model &&
        profile.model !== model &&
        profile.model !== "Universal"
      ) {
        return false;
      }

      return true;
    }

    // Без фильтров видна вся библиотека. Если выбран только бренд/модель,
    // материалы появятся после выбора пластика — кроме Universal-пресетов.
    if (!brand && !model) {
      return true;
    }

    return brand === "Generic" && model === "Universal";
  }

  if (brand && profile.manufacturer !== brand) {
    return false;
  }

  if (model && profile.model !== model) {
    return false;
  }

  return true;
}

/** Замок для закрытых карточек и кнопок. */
function LockIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      viewBox="0 0 16 16"
    >
      <rect
        height="7"
        rx="1.6"
        stroke="currentColor"
        strokeWidth="1.3"
        width="10"
        x="3"
        y="7"
      />
      <path
        d="M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.3"
      />
    </svg>
  );
}

/** Стрелка скачивания для доступной кнопки. */
function DownloadIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      focusable="false"
      viewBox="0 0 16 16"
    >
      <path
        d="M8 2.5v7.2m0 0 2.8-2.8M8 9.7 5.2 6.9M3 11.5v1.3c0 .4.3.7.7.7h8.6c.4 0 .7-.3.7-.7v-1.3"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.3"
      />
    </svg>
  );
}

const SELECT_CLASS =
  "mt-2 min-h-12 w-full rounded-2xl border border-white/15 bg-slate-900 px-4 text-sm font-semibold text-white outline-none transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-slate-900/60 disabled:text-slate-500";

export function ProfilesClient({ categories, hasPro }: ProfilesClientProps) {
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [material, setMaterial] = useState("");

  const models = brand ? BRAND_MODELS[brand as Brand] ?? [] : [];
  const hasFilters = Boolean(brand || model || material);

  const filteredCategories = useMemo(
    () =>
      categories
        .map((category) => ({
          ...category,
          profiles: category.profiles.filter((profile) =>
            matchesFilters(profile, brand, model, material),
          ),
        }))
        .filter((category) => category.profiles.length > 0),
    [brand, categories, material, model],
  );

  const visibleCount = filteredCategories.reduce(
    (count, category) => count + category.profiles.length,
    0,
  );

  function resetFilters() {
    setBrand("");
    setModel("");
    setMaterial("");
  }

  return (
    <section
      aria-labelledby="profile-library"
      className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20"
    >
      <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold tracking-widest text-blue-400 uppercase">
              Каскадный подбор
            </p>
            <h2
              id="profile-library"
              className="mt-3 text-2xl font-extrabold tracking-tight text-white sm:text-3xl"
            >
              Бренд → модель → материал
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-400 sm:text-base">
              Выберите принтер, чтобы увидеть его профили машины и процессов.
              Материал добавит пресеты пластика для этого принтера.
            </p>
          </div>

          <button
            type="button"
            onClick={resetFilters}
            disabled={!hasFilters}
            className="inline-flex min-h-10 items-center justify-center rounded-full border border-white/15 px-4 text-xs font-semibold text-slate-300 transition-colors hover:border-blue-400/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Сбросить фильтры
          </button>
        </div>

        <div className="mt-7 grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="text-xs font-semibold tracking-widest text-slate-400 uppercase">
              Бренд
            </span>
            <select
              className={SELECT_CLASS}
              onChange={(event) => {
                setBrand(event.target.value);
                setModel("");
              }}
              value={brand}
            >
              <option value="">Все бренды</option>
              {BRANDS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold tracking-widest text-slate-400 uppercase">
              Модель
            </span>
            <select
              className={SELECT_CLASS}
              disabled={!brand}
              onChange={(event) => setModel(event.target.value)}
              value={model}
            >
              <option value="">
                {brand ? "Все модели" : "Сначала выберите бренд"}
              </option>
              {models.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold tracking-widest text-slate-400 uppercase">
              Материал
            </span>
            <select
              className={SELECT_CLASS}
              onChange={(event) => setMaterial(event.target.value)}
              value={material}
            >
              <option value="">Все материалы</option>
              {MATERIALS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
          <p
            aria-live="polite"
            className="text-sm font-semibold text-slate-300"
          >
            Найдено {visibleCount} {pluralize(visibleCount, PROFILE_FORMS)}
          </p>
          <p className="text-xs leading-relaxed text-slate-500">
            {hasFilters
              ? "Показаны только профили, подходящие под выбранную цепочку."
              : "Пока показываем всю библиотеку — выберите бренд, чтобы сузить список."}
          </p>
        </div>
      </div>

      {filteredCategories.length === 0 ? (
        <div className="mt-10 rounded-3xl border border-dashed border-white/15 bg-white/[0.03] p-10 text-center">
          <p className="text-lg font-bold text-white">
            Под эти фильтры профилей нет
          </p>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-400">
            Для выбранного бренда или материала библиотека пока пуста.
            Попробуйте другую модель либо сбросьте фильтры.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-blue-600 px-6 text-sm font-semibold text-white transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            Показать все профили
          </button>
        </div>
      ) : (
        <div className="mt-14 space-y-16 sm:space-y-20">
          {filteredCategories.map((category) => {
            const categoryIndex = categories.findIndex(
              (item) => item.id === category.id,
            );

            return (
              <section
                key={category.id}
                id={category.id}
                aria-labelledby={`${category.id}-title`}
                className="scroll-mt-20"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-4">
                    <span
                      aria-hidden
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-2xl"
                    >
                      {CATEGORY_ICONS[category.id] ?? "📁"}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold tracking-widest text-blue-400 uppercase">
                        Категория {categoryIndex + 1}
                      </p>
                      <h3
                        id={`${category.id}-title`}
                        className="mt-2 text-2xl font-extrabold tracking-tight text-white sm:text-3xl"
                      >
                        {category.title}
                      </h3>
                      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400 sm:text-base">
                        {category.description}
                      </p>
                    </div>
                  </div>

                  <span className="rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-semibold text-slate-300">
                    {category.profiles.length}{" "}
                    {pluralize(category.profiles.length, PROFILE_FORMS)}
                  </span>
                </div>

                <ul className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {category.profiles.map((profile) => {
                    const locked = !hasPro;

                    return (
                      <li
                        key={profile.id}
                        className="relative flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6"
                      >
                        <div
                          className={
                            locked
                              ? "pointer-events-none flex flex-1 select-none flex-col blur-[3px]"
                              : "flex flex-1 flex-col"
                          }
                        >
                          <div className="flex items-start justify-between gap-3">
                            <span className="rounded-full border border-blue-400/30 bg-blue-500/10 px-2.5 py-1 text-[11px] font-bold tracking-wide text-blue-200">
                              {profile.format}
                            </span>
                            <span className="text-right text-[11px] leading-snug text-slate-500">
                              {profile.device}
                            </span>
                          </div>

                          <h4 className="mt-5 text-lg leading-snug font-bold text-white">
                            {profile.title}
                          </h4>

                          <p className="mt-3 text-sm leading-relaxed text-slate-400">
                            {profile.description}
                          </p>

                          <dl className="mt-5 space-y-2 border-t border-white/10 pt-4 text-xs">
                            <div className="flex items-start justify-between gap-3">
                              <dt className="shrink-0 text-slate-500">
                                Слайсер
                              </dt>
                              <dd className="text-right font-medium text-slate-300">
                                {profile.slicer}
                              </dd>
                            </div>
                            <div className="flex items-start justify-between gap-3">
                              <dt className="shrink-0 text-slate-500">База</dt>
                              <dd className="text-right font-medium text-slate-300">
                                {profile.requires}
                              </dd>
                            </div>
                          </dl>

                          {hasPro ? (
                            <div className="mt-auto pt-6">
                              <a
                                href={`/api/profiles/download?id=${encodeURIComponent(profile.id)}`}
                                download
                                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                              >
                                <DownloadIcon />
                                Скачать профиль
                              </a>
                            </div>
                          ) : null}
                        </div>

                        {locked ? (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950/55 p-6 text-center">
                            <span className="flex h-11 w-11 items-center justify-center rounded-full border border-blue-400/40 bg-blue-500/15 text-blue-200">
                              <LockIcon className="h-5 w-5" />
                            </span>
                            <span className="text-sm font-semibold text-white">
                              Доступно с Pro
                            </span>
                            <span className="max-w-[16rem] text-xs leading-relaxed text-slate-300">
                              Скачивание откроется после оформления подписки
                            </span>
                            <Link
                              href="/subscription#tools"
                              className="mt-1 inline-flex min-h-9 items-center justify-center rounded-full bg-blue-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                            >
                              Оформить Pro
                            </Link>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}
