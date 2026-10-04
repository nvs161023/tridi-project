import type { ComponentType } from "react";

import type { CourseKind } from "@/lib/types";

import { ProAA1Animation0 } from "./pro-A-A1-animation-0";
import { ProAA1Image0 } from "./pro-A-A1-image-0";
import { ProAA2Animation0 } from "./pro-A-A2-animation-0";
import { ProAA2Image0 } from "./pro-A-A2-image-0";
import { ProAA2Image1 } from "./pro-A-A2-image-1";
import { ProABezABez1Animation0 } from "./pro-A-без-A-без1-animation-0";
import { ProABezABez1Image0 } from "./pro-A-без-A-без1-image-0";
import { ProABezABez2Image0 } from "./pro-A-без-A-без2-image-0";
import { ProB1Animation0 } from "./pro-B-B1-animation-0";
import { ProB1Image0 } from "./pro-B-B1-image-0";
import { ProB2Animation0 } from "./pro-B-B2-animation-0";
import { ProB2Image0 } from "./pro-B-B2-image-0";
import { ProB4Animation0 } from "./pro-B-B4-animation-0";
import { ProB4Image0 } from "./pro-B-B4-image-0";
import { ProE1E11Animation0 } from "./pro-E1-E1-1-animation-0";
import { ProE1E11Image0 } from "./pro-E1-E1-1-image-0";
import { ProE1E12Animation0 } from "./pro-E1-E1-2-animation-0";
import { ProE1E12Image0 } from "./pro-E1-E1-2-image-0";
import { ProFF1Image0 } from "./pro-F-F1-image-0";
import { ProFF1Screenshot0 } from "./pro-F-F1-screenshot-0";
import { ProFF2Animation0 } from "./pro-F-F2-animation-0";
import { ProFF2Diagram0 } from "./pro-F-F2-diagram-0";
import { ProFF2Image0 } from "./pro-F-F2-image-0";
import { ProFF3Diagram0 } from "./pro-F-F3-diagram-0";
import { ProFF3Image0 } from "./pro-F-F3-image-0";
import { ProFF3Screenshot0 } from "./pro-F-F3-screenshot-0";
import { ProFF4Image0 } from "./pro-F-F4-image-0";
import { ProFF4Screenshot0 } from "./pro-F-F4-screenshot-0";
import { ProFF5Animation0 } from "./pro-F-F5-animation-0";
import { ProFF5Screenshot0 } from "./pro-F-F5-screenshot-0";
import { ProGG1Animation0 } from "./pro-G-G1-animation-0";
import { ProGG1Image0 } from "./pro-G-G1-image-0";
import { ProGG1Screenshot0 } from "./pro-G-G1-screenshot-0";
import { ProGG2Image0 } from "./pro-G-G2-image-0";
import { ProGG2Screenshot0 } from "./pro-G-G2-screenshot-0";
import { ProGG3Animation0 } from "./pro-G-G3-animation-0";
import { ProGG3Image0 } from "./pro-G-G3-image-0";
import { ProGG3Screenshot0 } from "./pro-G-G3-screenshot-0";
import { ProGG4Animation0 } from "./pro-G-G4-animation-0";
import { ProGG4Image0 } from "./pro-G-G4-image-0";
import { ProGG4Screenshot0 } from "./pro-G-G4-screenshot-0";
import { ProHH1Animation0 } from "./pro-H-H1-animation-0";
import { ProHH1Diagram0 } from "./pro-H-H1-diagram-0";
import { ProHH1Screenshot0 } from "./pro-H-H1-screenshot-0";
import { ProHH2Animation0 } from "./pro-H-H2-animation-0";
import { ProHH2Image0 } from "./pro-H-H2-image-0";
import { ProHH3Image0 } from "./pro-H-H3-image-0";
import { ProHH3Screenshot0 } from "./pro-H-H3-screenshot-0";
import { ProHH4Animation0 } from "./pro-H-H4-animation-0";
import { ProHH4Screenshot0 } from "./pro-H-H4-screenshot-0";
import { ProII1Image0 } from "./pro-I-I1-image-0";
import { ProII1Image1 } from "./pro-I-I1-image-1";
import { ProII2Animation0 } from "./pro-I-I2-animation-0";
import { ProII2Diagram0 } from "./pro-I-I2-diagram-0";
import { ProII2Image0 } from "./pro-I-I2-image-0";
import { ProII3Image0 } from "./pro-I-I3-image-0";
import { ProII3Image1 } from "./pro-I-I3-image-1";
import { ProII4Animation0 } from "./pro-I-I4-animation-0";
import { ProII4Image0 } from "./pro-I-I4-image-0";
import { ProII5Animation0 } from "./pro-I-I5-animation-0";
import { ProII5Diagram0 } from "./pro-I-I5-diagram-0";
import { ProC1C11Image0 } from "./pro-C1-C1-1-image-0";
import { ProC1C12Image0 } from "./pro-C1-C1-2-image-0";
import { ProE2E21Image0 } from "./pro-E2-E2-1-image-0";
import { ProE2E21Animation0 } from "./pro-E2-E2-1-animation-0";
import { ProE2E22Image0 } from "./pro-E2-E2-2-image-0";
import { ProE2E22Animation0 } from "./pro-E2-E2-2-animation-0";
import { ProE2E23Animation0 } from "./pro-E2-E2-3-animation-0";
import { ProE2E23Image0 } from "./pro-E2-E2-3-image-0";
import { ProE2E24Image0 } from "./pro-E2-E2-4-image-0";
import { ProEHimEHim1Image0 } from "./pro-E-хим-E-хим1-image-0";
import { ProEHimEHim2Image0 } from "./pro-E-хим-E-хим2-image-0";
import { ProDD1Screenshot0 } from "./pro-D-D1-screenshot-0";
import { ProDD1Animation0 } from "./pro-D-D1-animation-0";
import { ProDD2Screenshot0 } from "./pro-D-D2-screenshot-0";
import { ProDD2Animation0 } from "./pro-D-D2-animation-0";
import { ProDD3Screenshot0 } from "./pro-D-D3-screenshot-0";
import { ProDD3Animation0 } from "./pro-D-D3-animation-0";
import { ProDD4Screenshot0 } from "./pro-D-D4-screenshot-0";
import { ProDD4Animation0 } from "./pro-D-D4-animation-0";
import { ProKK1Image0 } from "./pro-K-K1-image-0";
import { ProKK1Image1 } from "./pro-K-K1-image-1";
import { ProKK2Image0 } from "./pro-K-K2-image-0";
import { ProKK2Image1 } from "./pro-K-K2-image-1";
import { ProMM1Image0 } from "./pro-M-M1-image-0";
import { ProMM1Animation0 } from "./pro-M-M1-animation-0";
import { ProMM2Image0 } from "./pro-M-M2-image-0";
import { ProMM2Animation0 } from "./pro-M-M2-animation-0";
import { ProMM3Image0 } from "./pro-M-M3-image-0";
import { ProMM3Animation0 } from "./pro-M-M3-animation-0";
import { ProMM4Image0 } from "./pro-M-M4-image-0";
import { ProMM4Animation0 } from "./pro-M-M4-animation-0";
import { ProMM5Image0 } from "./pro-M-M5-image-0";
import { ProMM5Animation0 } from "./pro-M-M5-animation-0";
import { ProMM6Image0 } from "./pro-M-M6-image-0";
import { ProMM6Animation0 } from "./pro-M-M6-animation-0";
import { ProMM7Image0 } from "./pro-M-M7-image-0";
import { ProMM7Animation0 } from "./pro-M-M7-animation-0";
import { ProLL1Image0 } from "./pro-L-L1-image-0";
import { ProLL2Image0 } from "./pro-L-L2-image-0";
import { ProLL3Animation0 } from "./pro-L-L3-animation-0";
import { ProLL4Screenshot0 } from "./pro-L-L4-screenshot-0";
import { ProNN1Image0 } from "./pro-N-N1-image-0";
import { ProNN2Image0 } from "./pro-N-N2-image-0";
import { ProNN2Animation0 } from "./pro-N-N2-animation-0";
import { ProNN3Image0 } from "./pro-N-N3-image-0";
import { ProNN3Animation0 } from "./pro-N-N3-animation-0";
import { ProNN4Screenshot0 } from "./pro-N-N4-screenshot-0";
import { ProNN5Image0 } from "./pro-N-N5-image-0";
import { ProNN6Image0 } from "./pro-N-N6-image-0";
// Модуль U «Лицензии, программы и ресурсы»: бирки лицензий на рельсе, четыре
// упаковки программ и полосы посещений платформ.
import { ProUU1Image0 } from "./pro-U-U1-image-0";
import { ProUU2Image0 } from "./pro-U-U2-image-0";
import { ProUU3Image0 } from "./pro-U-U3-image-0";
import { ProJJ1Image0 } from "./pro-J-J1-image-0";
import { ProJJ1Animation0 } from "./pro-J-J1-animation-0";
import { ProJJ2Image0 } from "./pro-J-J2-image-0";
import { ProJJ2Animation0 } from "./pro-J-J2-animation-0";
import { ProJJ2Image1 } from "./pro-J-J2-image-1";
import { ProJJ3Image0 } from "./pro-J-J3-image-0";
import { ProJJ3Animation0 } from "./pro-J-J3-animation-0";
import { ProJJ4Screenshot0 } from "./pro-J-J4-screenshot-0";
import { ProJJ4Image0 } from "./pro-J-J4-image-0";
import { ProJJ5Image0 } from "./pro-J-J5-image-0";
import { ProJJ5Image1 } from "./pro-J-J5-image-1";
import { ProJJ5Image2 } from "./pro-J-J5-image-2";
// Модуль T-тизер «Что можно продавать»: витрина с шестью товарами и ценниками.
import { ProTTizerTTizer1Image0 } from "./pro-T-тизер-T-тизер1-image-0";
// Модуль C2 «Серьёзный ремонт»: устройство платы и диагностика мультиметром,
// замена деталей головы, разъёмы, пайка и замена ремня (уроки C2-1 — C2-5).
import { ProC2C21Image0 } from "./pro-C2-C2-1-image-0";
import { ProC2C21Animation0 } from "./pro-C2-C2-1-animation-0";
import { ProC2C22Image0 } from "./pro-C2-C2-2-image-0";
import { ProC2C22Animation0 } from "./pro-C2-C2-2-animation-0";
import { ProC2C23Image0 } from "./pro-C2-C2-3-image-0";
import { ProC2C23Animation0 } from "./pro-C2-C2-3-animation-0";
import { ProC2C24Image0 } from "./pro-C2-C2-4-image-0";
import { ProC2C24Animation0 } from "./pro-C2-C2-4-animation-0";
import { ProC2C25Animation0 } from "./pro-C2-C2-5-animation-0";
// Модуль C-пож «Пожарная безопасность»: план комнаты с оборудованием, цепочка
// срабатывания датчика, фигура в СИЗ и матрица «СИЗ × работа» (уроки C-пож1, C-пож2).
import { ProCPozhCPozh1Image0 } from "./pro-C-пож-C-пож1-image-0";
import { ProCPozhCPozh1Animation0 } from "./pro-C-пож-C-пож1-animation-0";
import { ProCPozhCPozh2Image0 } from "./pro-C-пож-C-пож2-image-0";
import { ProCPozhCPozh2Animation0 } from "./pro-C-пож-C-пож2-animation-0";
// Модуль O «Апгрейды и производство»: схема апгрейдов по узлам принтера, бег
// головы со шлейфом, четыре системы смены пластин и циклограмма смены
// (партия 1 из 2: O1–O2).
import { ProOO1Image0 } from "./pro-O-O1-image-0";
import { ProOO1Animation0 } from "./pro-O-O1-animation-0";
import { ProOO2Image0 } from "./pro-O-O2-image-0";
import { ProOO2Animation0 } from "./pro-O-O2-animation-0";
import { ProOO3Image0 } from "./pro-O-O3-image-0";
import { ProOO3Animation0 } from "./pro-O-O3-animation-0";
import { ProOO4Image0 } from "./pro-O-O4-image-0";
import { ProOO4Animation0 } from "./pro-O-O4-animation-0";
import { ProOO5Image0 } from "./pro-O-O5-image-0";
import { ProOO5Animation0 } from "./pro-O-O5-animation-0";
// Модуль P «Сетевые технологии и мониторинг»: окно OctoPrint в браузере, запуск
// печати с телефона, панель Mainsail с пультом макросов, каркас printer.cfg с
// видимыми пробелами, окно просчёта вперёд у Klipper, схема доступа через VPN,
// окно AI-мониторинга Obico со «спагетти», уведомление в Telegram и ползунок
// в конце печати (уроки P1–P5 — все 11 визуальных блоков модуля).
import { ProPP1Image0 } from "./pro-P-P1-image-0";
import { ProPP1Animation0 } from "./pro-P-P1-animation-0";
import { ProPP2Screenshot0 } from "./pro-P-P2-screenshot-0";
import { ProPP2Screenshot1 } from "./pro-P-P2-screenshot-1";
import { ProPP2Animation0 } from "./pro-P-P2-animation-0";
import { ProPP3Image0 } from "./pro-P-P3-image-0";
import { ProPP3Animation0 } from "./pro-P-P3-animation-0";
import { ProPP4Image0 } from "./pro-P-P4-image-0";
import { ProPP4Animation0 } from "./pro-P-P4-animation-0";
import { ProPP5Screenshot0 } from "./pro-P-P5-screenshot-0";
import { ProPP5Animation0 } from "./pro-P-P5-animation-0";
import type { VisualProps } from "./_Wrapper";

/**
 * Визуализации блоков image/animation/screenshot/diagram: один блок — один
 * компонент — один файл.
 *
 * Повторов между уроками быть не должно: каждый блок получает собственную
 * картинку, даже если процессы похожи. Поэтому здесь нет подбора «по ключевым
 * словам» — визуализация привязана к конкретному блоку урока (курс + номер
 * урока + номер блока в уроке) и лежит в отдельном файле.
 *
 * Базовый курс переписан, и его картинки ещё не нарисованы: реестр базового курса
 * пуст (BASE_VISUALS), поэтому все блоки с visual_file показывают заглушку с
 * иконкой своего типа. Прежние 27 кадров (basic-1-…–basic-15-…) рисовались под
 * контент старой программы, а три из них совпадали по ключу с новыми уроками и
 * подменяли заглушку чужой схемой — поэтому кадры удалены вместе с файлами.
 * В продвинутом курсе нарисованы
 * восемнадцать модулей — A, A-без, B, E1, F, G, H, I, C1, E2, E-хим, D, K, M,
 * L, N, U и J (в L нарисованы все четыре урока, в N — все восемь блоков, в U —
 * все три, в J — все пять уроков и все 12 блоков), плюс модуль T-тизер
 * (единственный его урок и единственный визуальный блок), модули C2 «Серьёзный
 * ремонт» (все пять уроков, 9 блоков) и C-пож «Пожарная безопасность» (оба урока,
 * 4 блока), модуль O «Апгрейды и производство» (все пять уроков, 10 блоков) и
 * модуль P «Сетевые технологии и мониторинг» (уроки P1–P5 — все 11 блоков
 * модуля) — всего 160 визуализаций.
 * Остальные блоки обоих курсов пока без картинки: для них возвращается
 * null, и в карточке показывается заглушка с иконкой типа блока — лучше
 * заглушка, чем чужая картинка.
 * Новая визуализация = новый файл + одна строка в BASE_VISUALS, CONFIDENT_VISUALS
 * или PRO_VISUALS.
 */
export type { VisualProps } from "./_Wrapper";

export type VisualComponent = ComponentType<VisualProps>;

/**
 * Адрес блока: курс, урок, тип блока и порядковый номер среди блоков этого типа.
 *
 * Базовый курс адресуется номером урока (basic-1-image-0), «Уверенный» — кодом
 * урока (confident-C5-image-0), продвинутый — кодами модуля и урока
 * (pro-A-A1-image-0): в продвинутом курсе номера уроков строковые — A1, C1-1, T14.
 */
export type VisualBlockRef = {
  course?: CourseKind;
  /** Код модуля — нужен только продвинутому курсу. */
  moduleId?: string;
  /** Номер урока базового курса или код урока (C1, A1, C1-1). */
  lessonId?: number | string;
  type: string;
  typeOrdinal: number;
};

/**
 * Визуализации базового курса — Этап 2, рисуются заново.
 *
 * Ключ: `basic-{номер урока}-{тип блока}-{номер}`, например `basic-1-image-0` или
 * `basic-5-animation-0`. Номер — порядковый номер блока этого типа внутри урока.
 *
 * Реестр пуст: 27 кадров (модули «Знакомство» — «Финал», уроки 1–15) рисовались
 * под контент старой программы, и три из них (`basic-1-image-0`,
 * `basic-3-image-0`, `basic-4-image-0`) совпадали по ключу с новыми уроками 1, 3 и
 * 4 — в блоке показывалась чужая схема вместо заглушки. Кадры удалены вместе с
 * файлами (достать обратно можно из истории git; коммит до удаления — `b22da38`).
 *
 * Первая визуализация нового курса = новый файл
 * (components/lesson-visuals/basic-1-image-0.tsx) плюс одна строка здесь.
 */
const BASE_VISUALS: Record<string, VisualComponent> = {};

/**
 * Визуализации уровня «Уверенный» — Этап 2, ждут своих кадров.
 *
 * Ключ: `confident-{код урока}-{тип блока}-{номер}`, например
 * `confident-C5-image-0` или `confident-C8-diagram-1`. Кода модуля в ключе нет:
 * коды уроков (C1…C12) уникальны внутри уровня, в отличие от pro, где номера
 * уроков повторяются между модулями (A1, B1, C1-1).
 *
 * Реестр пуст: нарисованных кадров у уровня пока нет, поэтому все 72 визуальных
 * блока рисуются заглушкой по типу. Написан первый урок — C1 (32 блока и 7 кадров:
 * `C1_emissions_ladder.png`, `C1_materials_chart.png`, `C1_spread.png`,
 * `C1_measure.png`, `C1_hierarchy.png`, `C1_siz_kit.png`, `C1_respirators.png`),
 * остальные уроки ждут текста. Первая визуализация =
 * новый файл (components/lesson-visuals/confident-C1-image-0.tsx) плюс одна строка
 * здесь.
 */
const CONFIDENT_VISUALS: Record<string, VisualComponent> = {};

/**
 * Визуализации продвинутого курса — Этап 2.
 *
 * Ключ: `pro-{модуль}-{урок}-{тип}-{номер}`, например `pro-A-A1-image-0` или
 * `pro-A-без-A-без1-image-0`. Номер — порядковый номер блока этого типа внутри
 * урока, как и в базовом курсе. Коды модулей берутся из данных как есть, поэтому
 * в них бывает кириллица («A-без», «C-пож»), а в именах файлов — тоже.
 *
 * Заполнены модули A (уроки A1, A2), A-без (A-без1, A-без2), B (B1, B2, B4),
 * E1 (E1-1, E1-2), F (F1–F5), G (G1–G4), H (H1–H4), I (I1–I5), C1 (C1-1, C1-2),
 * E2 (E2-1–E2-4), E-хим (E-хим1, E-хим2), D (D1–D4), K (K1, K2), M (M1–M7),
 * L (L1–L4), N (N1–N6), U (U1–U3), J (J1–J5), T-тизер (единственный его урок),
 * C2 «Серьёзный ремонт» (C2-1 — C2-5), C-пож «Пожарная безопасность» (C-пож1,
 * C-пож2), O «Апгрейды и производство» (O1–O5) и P «Сетевые технологии и
 * мониторинг» (P1–P5) — 160 визуализаций. Остальные блоки продвинутого курса
 * рисуются заглушкой с иконкой своего типа. Новая визуализация = новый файл
 * (components/lesson-visuals/pro-C-пож-C-пож1-image-0.tsx) плюс одна строка здесь.
 */
const PRO_VISUALS: Record<string, VisualComponent> = {
  // Модуль A «Основы и история»: история FDM и кинематика.
  "pro-A-A1-image-0": ProAA1Image0,
  "pro-A-A1-animation-0": ProAA1Animation0,
  "pro-A-A2-image-0": ProAA2Image0,
  "pro-A-A2-animation-0": ProAA2Animation0,
  "pro-A-A2-image-1": ProAA2Image1,
  // Модуль A-без «Безопасность база»: выбросы и вентиляция.
  "pro-A-без-A-без1-image-0": ProABezABez1Image0,
  "pro-A-без-A-без1-animation-0": ProABezABez1Animation0,
  "pro-A-без-A-без2-image-0": ProABezABez2Image0,
  // Модуль B «Устройство и механика»: хотэнды, стол и адгезия, прошивки.
  "pro-B-B1-image-0": ProB1Image0,
  "pro-B-B1-animation-0": ProB1Animation0,
  "pro-B-B2-image-0": ProB2Image0,
  "pro-B-B2-animation-0": ProB2Animation0,
  "pro-B-B4-image-0": ProB4Image0,
  "pro-B-B4-animation-0": ProB4Animation0,
  // Модуль E1 «Материалы база»: сравнение пластиков, строение и усадка.
  "pro-E1-E1-1-image-0": ProE1E11Image0,
  "pro-E1-E1-1-animation-0": ProE1E11Animation0,
  "pro-E1-E1-2-image-0": ProE1E12Image0,
  "pro-E1-E1-2-animation-0": ProE1E12Animation0,
  // Модуль F «Слайсеры — базовые операции»: обзор программ и калибровки.
  "pro-F-F1-image-0": ProFF1Image0,
  "pro-F-F1-screenshot-0": ProFF1Screenshot0,
  "pro-F-F2-diagram-0": ProFF2Diagram0,
  "pro-F-F2-animation-0": ProFF2Animation0,
  "pro-F-F2-image-0": ProFF2Image0,
  "pro-F-F3-diagram-0": ProFF3Diagram0,
  "pro-F-F3-screenshot-0": ProFF3Screenshot0,
  "pro-F-F3-image-0": ProFF3Image0,
  "pro-F-F4-image-0": ProFF4Image0,
  "pro-F-F4-screenshot-0": ProFF4Screenshot0,
  "pro-F-F5-screenshot-0": ProFF5Screenshot0,
  "pro-F-F5-animation-0": ProFF5Animation0,
  // Модуль G «Слайсеры — рельеф, швы, поверхности»: высота слоя и швы.
  "pro-G-G1-image-0": ProGG1Image0,
  "pro-G-G1-animation-0": ProGG1Animation0,
  "pro-G-G1-screenshot-0": ProGG1Screenshot0,
  "pro-G-G2-image-0": ProGG2Image0,
  "pro-G-G2-screenshot-0": ProGG2Screenshot0,
  "pro-G-G3-image-0": ProGG3Image0,
  "pro-G-G3-animation-0": ProGG3Animation0,
  "pro-G-G3-screenshot-0": ProGG3Screenshot0,
  "pro-G-G4-image-0": ProGG4Image0,
  "pro-G-G4-animation-0": ProGG4Animation0,
  "pro-G-G4-screenshot-0": ProGG4Screenshot0,
  "pro-H-H1-diagram-0": ProHH1Diagram0,
  "pro-H-H1-animation-0": ProHH1Animation0,
  "pro-H-H1-screenshot-0": ProHH1Screenshot0,
  "pro-H-H2-image-0": ProHH2Image0,
  "pro-H-H2-animation-0": ProHH2Animation0,
  "pro-H-H3-screenshot-0": ProHH3Screenshot0,
  "pro-H-H3-image-0": ProHH3Image0,
  "pro-H-H4-screenshot-0": ProHH4Screenshot0,
  "pro-H-H4-animation-0": ProHH4Animation0,
  // Модуль I «Качество печати»: калибровки, заполнение, деление, дефекты.
  "pro-I-I1-image-0": ProII1Image0,
  "pro-I-I1-image-1": ProII1Image1,
  "pro-I-I2-diagram-0": ProII2Diagram0,
  "pro-I-I2-animation-0": ProII2Animation0,
  "pro-I-I2-image-0": ProII2Image0,
  "pro-I-I3-image-0": ProII3Image0,
  "pro-I-I3-image-1": ProII3Image1,
  "pro-I-I4-image-0": ProII4Image0,
  "pro-I-I4-animation-0": ProII4Animation0,
  "pro-I-I5-diagram-0": ProII5Diagram0,
  "pro-I-I5-animation-0": ProII5Animation0,
  // Модуль C1 «Базовое ТО»: смазки и карта обслуживания.
  "pro-C1-C1-1-image-0": ProC1C11Image0,
  "pro-C1-C1-2-image-0": ProC1C12Image0,
  // Модуль E2 «Материалы продвинутые»: специальные материалы и термостойкость.
  "pro-E2-E2-1-image-0": ProE2E21Image0,
  "pro-E2-E2-1-animation-0": ProE2E21Animation0,
  "pro-E2-E2-2-image-0": ProE2E22Image0,
  "pro-E2-E2-2-animation-0": ProE2E22Animation0,
  "pro-E2-E2-3-animation-0": ProE2E23Animation0,
  "pro-E2-E2-3-image-0": ProE2E23Image0,
  "pro-E2-E2-4-image-0": ProE2E24Image0,
  // Модуль E-хим «Химия и VOC»: СИЗ и утилизация отходов.
  "pro-E-хим-E-хим1-image-0": ProEHimEHim1Image0,
  "pro-E-хим-E-хим2-image-0": ProEHimEHim2Image0,
  // Модуль D «G-код и скрипты»: структура G-кода, стартовый код, макросы, постобработка.
  "pro-D-D1-screenshot-0": ProDD1Screenshot0,
  "pro-D-D1-animation-0": ProDD1Animation0,
  "pro-D-D2-screenshot-0": ProDD2Screenshot0,
  "pro-D-D2-animation-0": ProDD2Animation0,
  "pro-D-D3-screenshot-0": ProDD3Screenshot0,
  "pro-D-D3-animation-0": ProDD3Animation0,
  "pro-D-D4-screenshot-0": ProDD4Screenshot0,
  "pro-D-D4-animation-0": ProDD4Animation0,
  // Модуль K «Постобработка»: способы финиша и покраска.
  "pro-K-K1-image-0": ProKK1Image0,
  "pro-K-K1-image-1": ProKK1Image1,
  "pro-K-K2-image-0": ProKK2Image0,
  "pro-K-K2-image-1": ProKK2Image1,
  // Модуль M «Дополнительное оборудование»: сканеры и фотограмметрия (партия 1 из 3).
  "pro-M-M1-image-0": ProMM1Image0,
  "pro-M-M1-animation-0": ProMM1Animation0,
  "pro-M-M2-image-0": ProMM2Image0,
  "pro-M-M2-animation-0": ProMM2Animation0,
  "pro-M-M3-image-0": ProMM3Image0,
  "pro-M-M3-animation-0": ProMM3Animation0,
  "pro-M-M4-image-0": ProMM4Image0,
  "pro-M-M4-animation-0": ProMM4Animation0,
  "pro-M-M5-image-0": ProMM5Image0,
  "pro-M-M5-animation-0": ProMM5Animation0,
  "pro-M-M6-image-0": ProMM6Image0,
  "pro-M-M6-animation-0": ProMM6Animation0,
  "pro-M-M7-image-0": ProMM7Image0,
  "pro-M-M7-animation-0": ProMM7Animation0,
  // Модуль L «3D-моделирование — обзор»: дорожки программ, примеры моделей,
  // морфинг прогресса и жест перетаскивания в Tinkercad.
  "pro-L-L1-image-0": ProLL1Image0,
  "pro-L-L2-image-0": ProLL2Image0,
  "pro-L-L3-animation-0": ProLL3Animation0,
  "pro-L-L4-screenshot-0": ProLL4Screenshot0,
  // Модуль N «Реверс-инжиниринг»: процесс съёма модели, подготовка и сканирование
  // (партия 1 из 2: N1–N3).
  "pro-N-N1-image-0": ProNN1Image0,
  "pro-N-N2-image-0": ProNN2Image0,
  "pro-N-N2-animation-0": ProNN2Animation0,
  "pro-N-N3-image-0": ProNN3Image0,
  "pro-N-N3-animation-0": ProNN3Animation0,
  "pro-N-N4-screenshot-0": ProNN4Screenshot0,
  "pro-N-N5-image-0": ProNN5Image0,
  "pro-N-N6-image-0": ProNN6Image0,
  // Модуль U «Лицензии, программы и ресурсы»: таблица лицензий, интерфейсы
  // программ и топ-5 платформ для моделей.
  "pro-U-U1-image-0": ProUU1Image0,
  "pro-U-U2-image-0": ProUU2Image0,
  "pro-U-U3-image-0": ProUU3Image0,
  // Модуль J «Инженерные расчёты и прочность»: типы нагрузки, рёбра жёсткости,
  // анизотропия, симуляция в Fusion 360 и разбор примеров (уроки J1–J5, все 12 блоков).
  "pro-J-J1-image-0": ProJJ1Image0,
  "pro-J-J1-animation-0": ProJJ1Animation0,
  "pro-J-J2-image-0": ProJJ2Image0,
  "pro-J-J2-animation-0": ProJJ2Animation0,
  "pro-J-J2-image-1": ProJJ2Image1,
  "pro-J-J3-image-0": ProJJ3Image0,
  "pro-J-J3-animation-0": ProJJ3Animation0,
  "pro-J-J4-screenshot-0": ProJJ4Screenshot0,
  "pro-J-J4-image-0": ProJJ4Image0,
  "pro-J-J5-image-0": ProJJ5Image0,
  "pro-J-J5-image-1": ProJJ5Image1,
  "pro-J-J5-image-2": ProJJ5Image2,
  // Модуль T-тизер «Что можно продавать»: витрина товаров с ценниками — шесть
  // ниш из списка урока (блоков в модуле всего один).
  "pro-T-тизер-T-тизер1-image-0": ProTTizerTTizer1Image0,
  // Модуль C2 «Серьёзный ремонт»: устройство платы, диагностика мультиметром,
  // замена деталей головы, разъёмы, пайка в разрезе и натяжение ремня (уроки
  // C2-1 — C2-5).
  "pro-C2-C2-1-image-0": ProC2C21Image0,
  "pro-C2-C2-1-animation-0": ProC2C21Animation0,
  "pro-C2-C2-2-image-0": ProC2C22Image0,
  "pro-C2-C2-2-animation-0": ProC2C22Animation0,
  "pro-C2-C2-3-image-0": ProC2C23Image0,
  "pro-C2-C2-3-animation-0": ProC2C23Animation0,
  "pro-C2-C2-4-image-0": ProC2C24Image0,
  "pro-C2-C2-4-animation-0": ProC2C24Animation0,
  "pro-C2-C2-5-animation-0": ProC2C25Animation0,
  // Модуль C-пож «Пожарная безопасность»: расстановка оборудования по комнате,
  // цепочка «дым → датчик → отключение», СИЗ на человеке и матрица «СИЗ × работа»
  // (уроки C-пож1 и C-пож2 — все 4 визуальных блока модуля).
  "pro-C-пож-C-пож1-image-0": ProCPozhCPozh1Image0,
  "pro-C-пож-C-пож1-animation-0": ProCPozhCPozh1Animation0,
  "pro-C-пож-C-пож2-image-0": ProCPozhCPozh2Image0,
  "pro-C-пож-C-пож2-animation-0": ProCPozhCPozh2Animation0,
  // Модуль O «Апгрейды и производство»: точки апгрейдов, сгруппированные по узлам
  // машины, шлейф за головой на двух скоростях, четыре съёмника пластины вокруг
  // пластины-героя и циклограмма «с оператором против 24/7»
  // (уроки O1 и O2 — партия 1 из 2, 4 блока из 10).
  "pro-O-O1-image-0": ProOO1Image0,
  "pro-O-O1-animation-0": ProOO1Animation0,
  "pro-O-O2-image-0": ProOO2Image0,
  "pro-O-O2-animation-0": ProOO2Animation0,
  "pro-O-O3-image-0": ProOO3Image0,
  "pro-O-O3-animation-0": ProOO3Animation0,
  "pro-O-O4-image-0": ProOO4Image0,
  "pro-O-O4-animation-0": ProOO4Animation0,
  "pro-O-O5-image-0": ProOO5Image0,
  "pro-O-O5-animation-0": ProOO5Animation0,
  // Модуль P «Сетевые технологии и мониторинг»: окно браузера с адресной строкой
  // octopi.local, запуск печати с телефона, панель Mainsail с пультом макросов
  // START_PRINT/PAUSE/RESUME/END_PRINT, каркас printer.cfg с пробелами-точками,
  // окно просчёта вперёд, схема «телефон → VPN → домашняя сеть → принтер»,
  // подключение по туннелю, окно Obico со «спагетти», четыре ступени
  // «дефект → камера → AI → стоп», окно переписки с ботом и ползунок в конце
  // печати (уроки P1–P5 — все 11 визуальных блоков модуля).
  "pro-P-P1-image-0": ProPP1Image0,
  "pro-P-P1-animation-0": ProPP1Animation0,
  "pro-P-P2-screenshot-0": ProPP2Screenshot0,
  "pro-P-P2-screenshot-1": ProPP2Screenshot1,
  "pro-P-P2-animation-0": ProPP2Animation0,
  "pro-P-P3-image-0": ProPP3Image0,
  "pro-P-P3-animation-0": ProPP3Animation0,
  "pro-P-P4-image-0": ProPP4Image0,
  "pro-P-P4-animation-0": ProPP4Animation0,
  "pro-P-P5-screenshot-0": ProPP5Screenshot0,
  "pro-P-P5-animation-0": ProPP5Animation0,
};

/** Ключ визуализации — адрес блока одной строкой. */
function visualKey(ref: VisualBlockRef): string {
  if (ref.course === "pro") {
    return `pro-${ref.moduleId ?? ""}-${ref.lessonId ?? ""}-${ref.type}-${ref.typeOrdinal}`;
  }

  if (ref.course === "confident") {
    return `confident-${ref.lessonId ?? ""}-${ref.type}-${ref.typeOrdinal}`;
  }

  return `basic-${ref.lessonId ?? ""}-${ref.type}-${ref.typeOrdinal}`;
}

/** Визуализация конкретного блока или null, если она ещё не нарисована. */
export function getVisualComponent(ref: VisualBlockRef): VisualComponent | null {
  // Каждый курс смотрит только в свой раздел: так ключи трёх курсов не могут
  // случайно совпасть и в блоке не появится чужая схема.
  const registry =
    ref.course === "pro"
      ? PRO_VISUALS
      : ref.course === "confident"
        ? CONFIDENT_VISUALS
        : BASE_VISUALS;

  return registry[visualKey(ref)] ?? null;
}
