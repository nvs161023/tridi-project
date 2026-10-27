/**
 * Файлы к урокам: ссылки вида `[Скачать чек-лист](/artifacts/…)` в тексте блоков.
 *
 * Список не дублируется вручную: витрина показывает ровно те файлы, которые
 * лежат в `public/artifacts/` и упомянуты в уроках уровня. Добавили ссылку в
 * урок — она сама появилась на карточке курса и на его странице.
 */
export type CourseArtifact = {
  /** Путь внутри сайта: `/artifacts/batch-passport-template.md`. */
  href: string;
  /** Подпись без глагола: «чек-лист аудита безопасности». */
  label: string;
};

type ArtifactBlock = { content?: string };
type ArtifactLesson = { blocks?: readonly unknown[] };
type ArtifactModule = { lessons?: readonly ArtifactLesson[] };

/** Ссылка на файл в markdown-тексте блока. */
const ARTIFACT_LINK = /\[([^\]]+)\]\((\/artifacts\/[^)\s]+)\)/g;

/** «Скачать макросы Klipper» → «макросы Klipper». */
function artifactLabel(text: string): string {
  return text.replace(/^Скачать\s+/i, "").trim();
}

/** Все файлы уровня в порядке уроков; повтор одного пути схлопывается. */
export function collectArtifacts(
  modules: readonly ArtifactModule[],
): CourseArtifact[] {
  const seen = new Set<string>();
  const artifacts: CourseArtifact[] = [];

  for (const courseModule of modules) {
    for (const lesson of courseModule.lessons ?? []) {
      for (const block of lesson.blocks ?? []) {
        if (!block || typeof block !== "object") continue;

        const { content } = block as ArtifactBlock;

        if (typeof content !== "string") continue;

        /** `lastIndex` глобального regexp сбрасываем на каждом блоке. */
        ARTIFACT_LINK.lastIndex = 0;

        let match = ARTIFACT_LINK.exec(content);

        while (match) {
          const href = match[2];

          if (!seen.has(href)) {
            seen.add(href);
            artifacts.push({ href, label: artifactLabel(match[1]) });
          }

          match = ARTIFACT_LINK.exec(content);
        }
      }
    }
  }

  return artifacts;
}
