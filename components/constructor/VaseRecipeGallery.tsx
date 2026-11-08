"use client";

import Image from "next/image";

import type { ConstructorParams } from "@/lib/constructor/params";
import {
  VASE_RECIPES,
  activeVaseRecipe,
  vaseRecipeImagePath,
  type VaseRecipe,
} from "@/data/vase-recipes";

/**
 * Размер PNG плитки: он же габарит файла в `public/constructor/recipes`.
 *
 * 320 × 400 — вдвое больше, чем плитка на экране (до 200 px в ряду из четырёх),
 * поэтому на Retina картинка остаётся резкой, а вес файла — десятки килобайт.
 * `next/image` ждёт эти числа как ширину и высоту, чтобы зарезервировать место
 * до загрузки и не двигать сетку.
 */
const TILE_WIDTH = 320;
const TILE_HEIGHT = 400;

type VaseRecipeGalleryProps = {
  /** Полные параметры модели: по ним подсвечивается текущий рецепт. */
  params: ConstructorParams;
  /** Клик по плитке: параметры рецепта применяются к конструктору. */
  onApplyRecipe: (recipe: VaseRecipe) => void;
};

/**
 * Галерея рецептов: двенадцать готовых ваз, выбранных глазами.
 *
 * Почему PNG, а не живой рендер, как у «Галереи вариантов»: рецепты — это
 * фиксированный набор, и он не зависит от текущих настроек. Двенадцать сеток,
 * собранных в браузере при каждом открытии конструктора, стоили бы секунду
 * процессора на то, что давно посчитано. Поэтому картинки лежат в `public` и
 * пересобираются командой `npm run shots:recipes`, а совпадение картинки с
 * моделью держит проверка `npm run check:vase`: она ищет PNG каждого рецепта.
 *
 * Компонент ничего не помнит: подсветку даёт сравнение параметров с рецептом,
 * поэтому после правки любого слайдера плитка гаснет сама.
 */
export function VaseRecipeGallery({
  params,
  onApplyRecipe,
}: VaseRecipeGalleryProps) {
  // Рецепты — про вазу: у брелока и литофана свои пресеты, и чужая галерея
  // сбивала бы с толку.
  if (params.model !== "vase") {
    return null;
  }

  const activeRecipe = activeVaseRecipe(params);

  return (
    <section
      aria-labelledby="vase-recipes-heading"
      className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3
          className="text-sm font-semibold text-white"
          id="vase-recipes-heading"
        >
          Галерея рецептов
        </h3>
        <p className="text-xs text-slate-300">
          Двенадцать готовых ваз: выберите глазами, дальше правьте слайдерами.
        </p>
      </div>

      <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {VASE_RECIPES.map((recipe) => {
          const selected = activeRecipe?.id === recipe.id;

          return (
            <li className="min-w-0" key={recipe.id}>
              <button
                aria-pressed={selected}
                className={`flex h-full w-full flex-col overflow-hidden rounded-xl border text-left transition ${
                  selected
                    ? "border-sky-400/70 bg-sky-400/10"
                    : "border-white/10 bg-slate-950/40 hover:border-sky-400/40 hover:bg-slate-900/60"
                }`}
                onClick={() => onApplyRecipe(recipe)}
                title={`${recipe.name}: ${recipe.description}`}
                type="button"
              >
                <Image
                  alt=""
                  className="aspect-[4/5] w-full bg-slate-950/60 object-cover"
                  height={TILE_HEIGHT}
                  src={vaseRecipeImagePath(recipe.id)}
                  unoptimized
                  width={TILE_WIDTH}
                />
                <span className="flex flex-1 flex-col gap-1 px-2 pt-2 pb-2">
                  <span className="flex items-baseline justify-between gap-1">
                    <span className="text-xs font-semibold text-white">
                      {recipe.name}
                    </span>
                    {selected ? (
                      <span className="rounded-full bg-sky-400/20 px-1.5 py-0.5 text-[0.6rem] font-semibold text-sky-100">
                        здесь
                      </span>
                    ) : null}
                  </span>
                  <span className="text-[0.68rem] leading-snug text-slate-300">
                    {recipe.description}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <p aria-live="polite" className="mt-3 text-xs leading-relaxed text-slate-300">
        {activeRecipe
          ? `Открыт рецепт «${activeRecipe.name}»: его размеры, силуэт и слои узора применены целиком.`
          : "Подсветки нет: настройки собраны вручную или ушли от рецепта слайдерами."}
      </p>
    </section>
  );
}
