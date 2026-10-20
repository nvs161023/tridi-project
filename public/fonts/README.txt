Шрифты конструктора (three.js FontLoader, legacy-формат typeface.json).

Файлы:
- cyrillic.typeface.json — Roboto Bold, имена на брелоках и вывеска по умолчанию
  (`signFont: "sans-bold"`), калибровочные подписи и градусы;
- roboto-regular.typeface.json — Roboto Regular, вывеска `signFont: "sans"`;
- pt-serif-bold.typeface.json — PT Serif Bold, вывеска `signFont: "serif"`.

Источники:
- Roboto Bold: https://github.com/googlefonts/roboto-2 (src/hinted/Roboto-Bold.ttf);
- Roboto Regular: https://github.com/googlefonts/roboto-2 (src/hinted/Roboto-Regular.ttf);
- PT Serif Bold: https://github.com/google/fonts (ofl/ptserif/PT_Serif-Web-Bold.ttf,
  внутри пакета файл называется PTSerif_700Bold.ttf).

Лицензии: Roboto — Apache License 2.0 (ROBOTO_LICENSE.txt), PT Serif —
SIL Open Font License 1.1 (PT_SERIF_LICENSE.txt).

Как сконвертированы:
- оставлены ASCII, кириллица U+0400–U+04FF, типографский апостроф и «№»;
- контуры перевёрнуты (reverse font direction), как советует facetype.js;
- отверстия букв уменьшены на 0.5% вокруг собственного центра, а контуры с
  совпавшими горизонтальными линиями разведены по вертикали на 0.05 единицы
  шрифта (0.003 мм при кегле 60). Без этого нижняя грань отверстия в «д» и «Д»
  лежит на одной прямой с внешним контуром, а в «Ф» — с гранью соседнего
  отверстия: Earcut не строит там мост и оставляет восемь незамкнутых рёбер.
  Отверстием считается контур, нарисованный в сторону, противоположную самому
  крупному контуру глифа, — так же его понимает ShapePath.toShapes;
- пробел остаётся глифом с пустым контуром и шириной `ha`: без него
  FontLoader рисует на месте пробела знак «?»;
- в PT Serif нет глифов «Ѐ Ѝ ѐ ѝ», поэтому конвертер для них берёт базовую
  букву через NFD и оставляет её контур.

Важно: отверстия букв держатся на направлении обхода контуров. В старой
hinted-сборке Roboto внешний и внутренний контуры нарисованы в разные стороны,
и после общего разворота они остаются противоположными — Earcut вырезает
«перекладину» у «Р», «Д», «Я». У Roboto_400Regular.ttf из нового пакета оба
контура идут в одну сторону: после разворота отверстие превращается в залитый
остров внутри буквы. Поэтому Roboto Regular берётся из hinted-сборки
roboto-2 (src/hinted), а не из нового репозитория.

Чтобы заменить или добавить шрифт, положите новый typeface.json с тем же именем,
допишите путь в `SIGN_FONT_URLS` (lib/constructor/sign-geometry.ts) и ключ в
`SIGN_FONTS` (lib/constructor/params.ts), затем проверьте буквы «д», «Д»,
«ё», «Р» и «О»: у каждой должен быть свой контур отверстия, а строка с
пробелом — нужной ширины.

