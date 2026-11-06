# Референсы: печать на футболку (heat transfer / iron-on)

Данные сняты 6 ноября 2026 через API. Источник — Printables GraphQL (`https://api.printables.com/graphql/`), запрос `searchPrints2` + `print(id:)`; текст полей `name` и `description` из ответа API. Поиск MakerWorld (`search-service/select/design`) возвращает пустой фид (`total=0`, `hits=null`) и не учитывает запрос — модели MakerWorld в таблицу не попали.

«Не указано» — автор модели этого числа не приводит в описании.

| id | Название (как в API) | Материал | Толщина слоя / слоёв | Зеркалирование | На чём печатают | Сопло, °C | Стол, °C | Заполнение | Ограничение по размеру | Перенос |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1256593 | 3D Print Your Own Fashion – Transfer Logos & Texts onto Fabric with TPU | TPU (flexible) | 0.2 мм / число слоёв не указано | не указано | бумага для выпечки (пергамент), не стол | 225 | 45–60 | не указано (скорость ~30 мм/с, поддержки — нет) | не указано | утюг, нагрев «low-to-medium», тепло с обратной стороны, остывание, снять бумагу |
| 1837546 | Orca & Waves – Iron-On 3D Printed Patch (Flexible TPU + PLA) | TPU 95A (реком.) или PLA | 0.40 мм = 0.20 + 0.20 (2 слоя) | не указано | текстурированная PEI-пластина, без ткани на столе | не указано (сопло 0.4 мм) | не указано | 100 % (solid rectilinear/concentric) + ironing верхнего слоя | не указано (сопло 0.4 мм) | утюг Cotton/High без пара, прижим 15–20 с, полное остывание |
| 1343 | 3D printed Iron-On Patch | PLA | 0.4 мм = 2 слоя по 0.2 («standard settings») | нужно, если важна читаемость (ось не указана) | тонкая бумага, туго закреплённая на столе | не указано | не указано | не указано (gcode печатает с каймой) | Prusa MK3/S — ограничение по столу принтера из описания | утюг на максимум, «fused perfectly», бумага натянута туго |
| 1872736 | Fat Pikachu Iron On Shirt Decal or Patch | не указано | 0.2 мм (≈1 слой) и 0.4 мм (≈2 слоя), две версии файла | не указано | стол, снимают после печати; перенос через термостойкую бумагу или силиконовую подложку | не указано | не указано | не указано | деталь 1–2 слоя, легко рвётся; точки, запятые и апострофы отделяются | прогрев утюга, 15–20 с, при шероховатости +5–10 с, изнанка +5–10 с; стирка только холодной водой (не выше 100) |
| 1677081 | Invincible Viltrumite Logo T-shirt Patch | PLA или TPU | не указано | не указано | не указано | не указано | не указано | не указано | не указано | утюг 100–150 °C (средний нагрев), проглаживать до размягчения пластика, полное остывание перед снятием бумаги; стирка ≤ 40 °C |

## Цитаты авторов

### 1256593 — 3D Print Your Own Fashion – Transfer Logos & Texts onto Fabric with TPU

> «Print your design directly onto **parchment paper** (baking paper). Place it on the desired position on your shirt or hoodie. Use a regular **iron** to apply heat backwards on. Let it cool, remove the paper – and your custom graphic is done!»

> «**Best results with:** Flexible TPU filament. Flat, bold designs. Cotton or cotton-blend fabric. Low-to-medium ironing heat»

> «**Print Settings:** Material: TPU. Nozzle Temp: 225 °C. Bed Temp: 45–60 °C. Layer Height: 0.2 mm. Speed: ~30 mm/s. Supports: No. Print on: Baking/parchment paper (not directly on the bed)»

### 1837546 — Orca & Waves – Iron-On 3D Printed Patch (Flexible TPU + PLA)

> «Calibrated at an exact 0.40 mm thickness (2 layers at 0.20 mm layer height). At this thickness, flexible TPU melts and fuses mechanically deep into the fabric weave without making the garment rigid or heavy.»

> «**Bed Setup:** Standard textured PEI plate (print flat like any normal print — NO fabric on the bed!). **Total Thickness:** 0.40 mm (Layer 1: 0.20 mm | Layer 2: 0.20 mm). **Nozzle:** 0.4 mm. **Infill:** 100% (Solid rectilinear or concentric). **Top Surface:** Ironing enabled for a clean, smooth matte finish.»

> «**Press:** Using a household iron on Cotton/High heat (no steam), apply firm downward pressure for 15–20 seconds across the entire patch. **Cool Down:** Let it cool completely before flexing or wearing.»

> «Place a sheet of baking/parchment paper completely over the design.»

> «(Note: PLA will bond under heat, but will eventually crack under repeated sharp folds or machine drying).»

### 1343 — 3D printed Iron-On Patch

> «**You MUST secure a sheet of thin paper to the build plate for this to work.**»

> «Once the print has succeeded, tear around the patch (Careful, the pieces will peel off the paper if you bend it too much), place it print-down on the fabric you want to iron it on to... and then iron it on! I set my iron on high and it fused perfectly.»

> «Take any pattern or text - single or multicolor - and make sure it's 0.4mm's tall - Just two layers at standard settings. From there, it's just a matter of printing it on paper. The trick is to get the paper TIGHT so the printer will not snag an edge. I used PLA, but there might be other things that work.»

> «**NOTE** If readability is important, make sure your final STL is mirrored!»

> «This is, so far, the only way I've found to print for fabric on a MK3/S.»

### 1872736 — Fat Pikachu Iron On Shirt Decal or Patch

> «This decal is available in 0.2 and 0.4 mm or approximately one layer or two. The first time I attempted to put this decal on using 0.2 I applied too much time ironing and it melted too much. I recommend starting with the 0.4 mm.»

> «Be gentle when removing as the model is only 1 or 2 layers thick - it can tear easily and has floating pieces which should be removed separately.»

> «Place the garment on the ironing board, **position the printed model on the desired area**, and **cover it with heat-resistant paper** (e.g. baking/parchment paper) or silicone mat»

> «Using the preheated iron, **press onto the model** through the mat/paper (or move the iron evenly, depending on the size of the model) for **15–20** seconds»

> «Run your fingers over the pattern - if it feels rough at any part, cover again and hit it for an additional 5-10 seconds.»

> «*(Optional)* Turn the T-shirt **inside out** and iron the area where the model is applied for an additional **5–10 seconds**»

> «Washing these items should only be done with cold water as any more than 100 degrees could start to peel the print from the shirt»

### 1677081 — Invincible Viltrumite Logo T-shirt Patch

> «Print with PLA or TPU the color of your choice.»

> «Cover it with parchment paper (baking paper) or a heat-resistant sheet.»

> «Use an iron on a medium **heat setting 100- 150°C**. Gently press and move the iron over the area until the plastic slightly softens and bonds with the fabric.»

> «Let it cool completely before removing the paper.»

> «**Machine Wash:** Maximum **40°C** on a gentle cycle. **Note:** Avoid high heat or mechanical stress (stretching the plastic excessively).»
