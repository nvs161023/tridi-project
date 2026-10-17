import type { ComponentType } from "react";

import type { CourseKind } from "@/lib/types";

import { Basic1Image0 } from "./basic-1-image-0";
import { Basic2Diagram0 } from "./basic-2-diagram-0";
import { Basic2Diagram1 } from "./basic-2-diagram-1";
import { Basic2Diagram2 } from "./basic-2-diagram-2";
import { Basic2Diagram3 } from "./basic-2-diagram-3";
import { Basic2Diagram4 } from "./basic-2-diagram-4";
import { Basic2Diagram5 } from "./basic-2-diagram-5";
import { Basic3Diagram0 } from "./basic-3-diagram-0";
import { Basic3Diagram1 } from "./basic-3-diagram-1";
import { Basic3Image0 } from "./basic-3-image-0";
import { Basic3Image1 } from "./basic-3-image-1";
import { Basic3Image2 } from "./basic-3-image-2";
import { Basic3Diagram2 } from "./basic-3-diagram-2";
import { Basic4Diagram0 } from "./basic-4-diagram-0";
import { Basic4Diagram1 } from "./basic-4-diagram-1";
import { Basic4Diagram2 } from "./basic-4-diagram-2";
import { Basic4Diagram3 } from "./basic-4-diagram-3";
import { Basic4Image0 } from "./basic-4-image-0";
import { Basic4Image1 } from "./basic-4-image-1";
import { Basic4Image2 } from "./basic-4-image-2";
import { Basic5Diagram0 } from "./basic-5-diagram-0";
import { Basic5Image0 } from "./basic-5-image-0";
import { Basic5Diagram1 } from "./basic-5-diagram-1";
import { Basic5Image1 } from "./basic-5-image-1";
import { Basic5Image2 } from "./basic-5-image-2";
import { Basic5Diagram2 } from "./basic-5-diagram-2";
import { Basic5Diagram3 } from "./basic-5-diagram-3";
import { Basic5Image3 } from "./basic-5-image-3";
import { Basic6Diagram0 } from "./basic-6-diagram-0";
import { Basic6Diagram1 } from "./basic-6-diagram-1";
import { Basic6Diagram2 } from "./basic-6-diagram-2";
import { Basic6Diagram3 } from "./basic-6-diagram-3";
import { Basic6Diagram4 } from "./basic-6-diagram-4";
import { Basic6Image0 } from "./basic-6-image-0";
import { Basic6Image1 } from "./basic-6-image-1";
import { Basic6Image2 } from "./basic-6-image-2";
import { Basic6Image3 } from "./basic-6-image-3";
import { Basic6Image4 } from "./basic-6-image-4";
import { Basic7Diagram0 } from "./basic-7-diagram-0";
import { Basic7Diagram1 } from "./basic-7-diagram-1";
import { Basic7Diagram2 } from "./basic-7-diagram-2";
import { Basic7Diagram3 } from "./basic-7-diagram-3";
import { Basic7Diagram4 } from "./basic-7-diagram-4";
import { Basic7Diagram5 } from "./basic-7-diagram-5";
import { Basic7Diagram6 } from "./basic-7-diagram-6";
import { Basic7Diagram7 } from "./basic-7-diagram-7";
import { Basic7Diagram8 } from "./basic-7-diagram-8";
import { Basic7Diagram9 } from "./basic-7-diagram-9";
import { Basic8Diagram0 } from "./basic-8-diagram-0";
import { Basic8Diagram1 } from "./basic-8-diagram-1";
import { Basic8Diagram2 } from "./basic-8-diagram-2";
import { Basic8Image0 } from "./basic-8-image-0";
import { Basic8Diagram3 } from "./basic-8-diagram-3";
import { Basic8Image1 } from "./basic-8-image-1";
import { Basic8Diagram4 } from "./basic-8-diagram-4";
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
// Уровень «Уверенный», урок C1 «Что летит в воздух: UFP, VOC и защита дыхания»:
// пирамида выбросов от PLA к PC (блок 5), что выделяет каждый материал (блок 6),
// как частицы расходятся по комнате (блок 9), график замера «фон и печать»
// с вытяжкой и без (блок 16), схема защиты мастерской (блок 28), набор СИЗ
// (блок 29) и картридж A2P3 (блок 30) — все 7 кадров урока.
import { ConfidentC1Diagram0 } from "./confident-C1-diagram-0";
import { ConfidentC1List0 } from "./confident-C1-list-0";
import { ConfidentC1Diagram1 } from "./confident-C1-diagram-1";
import { ConfidentC1Image0 } from "./confident-C1-image-0";
import { ConfidentC1Image1 } from "./confident-C1-image-1";
import { ConfidentC1List7 } from "./confident-C1-list-7";
import { ConfidentC1Image2 } from "./confident-C1-image-2";
// Уровень «Уверенный», урок C2 «Вентиляция и рабочее место»: три схемы вентиляции
// с ценами (блок 3), планировка комнаты под три варианта (блок 7), разрез фильтров
// по потоку с ресурсами (блок 10), шесть шагов сборки бокса (блок 12), разрез
// бокса с принтером и путь воздуха (блок 13) и зоны мастерской (блок 19) —
// все 6 кадров урока.
import { ConfidentC2Diagram0 } from "./confident-C2-diagram-0";
import { ConfidentC2Image0 } from "./confident-C2-image-0";
import { ConfidentC2Image1 } from "./confident-C2-image-1";
import { ConfidentC2Steps0 } from "./confident-C2-steps-0";
import { ConfidentC2Image2 } from "./confident-C2-image-2";
import { ConfidentC2Image3 } from "./confident-C2-image-3";
// Уровень «Уверенный», урок C3 «Пожарная безопасность и аварийные сценарии»: три
// места нагрева и температуры (блок 3), датчик дыма над принтером (блок 7), три
// средства тушения с ценой (блок 11), таймлайн первой минуты (блок 14), осмотр
// вилки, шнура и розетки (блок 20) и печать без присмотра (блок 24) — все 6 кадров.
import { ConfidentC3Diagram0 } from "./confident-C3-diagram-0";
import { ConfidentC3Image0 } from "./confident-C3-image-0";
import { ConfidentC3Image1 } from "./confident-C3-image-1";
import { ConfidentC3Diagram1 } from "./confident-C3-diagram-1";
import { ConfidentC3Image2 } from "./confident-C3-image-2";
import { ConfidentC3List5 } from "./confident-C3-list-5";
// Уровень «Уверенный», урок C4 «Химия, СИЗ и утилизация отходов»: три пути химии
// в тело (блок 4), перчатки и их проницаемость (блок 13), карта СИЗ по операциям
// (блок 16), промывка двумя банками (блок 19), три корзины на столе (блок 26) и
// хранение в закрытом шкафу (блок 30) — все 6 кадров.
import { ConfidentC4Diagram0 } from "./confident-C4-diagram-0";
import { ConfidentC4Image0 } from "./confident-C4-image-0";
import { ConfidentC4Diagram1 } from "./confident-C4-diagram-1";
import { ConfidentC4Diagram2 } from "./confident-C4-diagram-2";
import { ConfidentC4Image1 } from "./confident-C4-image-1";
import { ConfidentC4Steps1 } from "./confident-C4-steps-1";
// Уровень «Уверенный», урок C5 «Поддержки, которые отделяются сами»: разрез
// щели по Z (блок 4), три зоны опоры (блок 12), дерево против решётки (блок 18),
// одна деталь до и после разворота (блок 22), порядок снятия поддержек (блок 30)
// и окно поддержек в слайсере (блок 31) — все 6 кадров.
import { ConfidentC5Diagram0 } from "./confident-C5-diagram-0";
import { ConfidentC5Diagram1 } from "./confident-C5-diagram-1";
import { ConfidentC5Image0 } from "./confident-C5-image-0";
import { ConfidentC5Diagram2 } from "./confident-C5-diagram-2";
import { ConfidentC5Steps1 } from "./confident-C5-steps-1";
import { ConfidentC5Screenshot0 } from "./confident-C5-screenshot-0";
// Уровень «Уверенный», урок C6 «Модификаторы и переменная высота слоя»: три зоны
// кронштейна (блок 4), модификатор в слайсере (блок 8), кронштейн с зоной
// нагрузки (блок 12), разрез с толстыми и тонкими слоями (блок 20), окно
// переменной высоты (блок 25) и сравнение двух подходов (блок 30) — все 6 кадров.
import { ConfidentC6Diagram0 } from "./confident-C6-diagram-0";
import { ConfidentC6Screenshot0 } from "./confident-C6-screenshot-0";
import { ConfidentC6Image0 } from "./confident-C6-image-0";
import { ConfidentC6Diagram1 } from "./confident-C6-diagram-1";
import { ConfidentC6Screenshot1 } from "./confident-C6-screenshot-1";
import { ConfidentC6Diagram2 } from "./confident-C6-diagram-2";
// Уровень «Уверенный», урок C7 «Модель больше стола: разрез, соединения,
// допуски»: панель и две линии реза (блок 4), окно Cut (блок 11), пять
// соединений и их работа (блок 14), таблица зазоров (блок 21), склейка двух
// частей со стяжкой (блок 27) и сравнение времени (блок 33) — все 6 кадров.
import { ConfidentC7Diagram0 } from "./confident-C7-diagram-0";
import { ConfidentC7Screenshot0 } from "./confident-C7-screenshot-0";
import { ConfidentC7Diagram1 } from "./confident-C7-diagram-1";
import { ConfidentC7Diagram2 } from "./confident-C7-diagram-2";
import { ConfidentC7Image0 } from "./confident-C7-image-0";
import { ConfidentC7Diagram3 } from "./confident-C7-diagram-3";
// Уровень «Уверенный», урок C8 «Поверхность: шов, ironing, округлость и текстура»:
// три зоны поверхности (блок 4), окно шва (блок 7), где работает ironing (блок 16),
// настройки ironing (блок 18), окружность из сегментов (блок 22) и сравнение гладкой
// и шершавой стенки (блок 27) — все 6 кадров.
import { ConfidentC8Diagram0 } from "./confident-C8-diagram-0";
import { ConfidentC8Screenshot0 } from "./confident-C8-screenshot-0";
import { ConfidentC8Diagram1 } from "./confident-C8-diagram-1";
import { ConfidentC8Screenshot1 } from "./confident-C8-screenshot-1";
import { ConfidentC8Diagram2 } from "./confident-C8-diagram-2";
import { ConfidentC8Image0 } from "./confident-C8-image-0";
// Уровень «Уверенный», урок C9 «Продвинутая калибровка принтера»: график PID
// (блок 4), консоль автоподбора (блок 7), замер E-steps (блок 12), угол с
// наплывом и ровный угол (блок 18), звон у угла (блок 23) и таблица резонансов
// (блок 25) — все 6 кадров.
import { ConfidentC9Diagram0 } from "./confident-C9-diagram-0";
import { ConfidentC9Screenshot0 } from "./confident-C9-screenshot-0";
import { ConfidentC9Image0 } from "./confident-C9-image-0";
import { ConfidentC9Diagram1 } from "./confident-C9-diagram-1";
import { ConfidentC9Image1 } from "./confident-C9-image-1";
import { ConfidentC9Screenshot1 } from "./confident-C9-screenshot-1";
// Уровень «Уверенный», урок C10 «Заполнение и сложные геометрии»: пять форм
// заполнения (блок 5), разрез детали (блок 7), окно заполнения (блок 15), четыре
// угла нависания (блок 20), мост до и после (блок 25) и Print Thin Walls
// (блок 29) — все 6 кадров.
import { ConfidentC10Diagram0 } from "./confident-C10-diagram-0";
import { ConfidentC10Image0 } from "./confident-C10-image-0";
import { ConfidentC10Screenshot0 } from "./confident-C10-screenshot-0";
import { ConfidentC10Diagram1 } from "./confident-C10-diagram-1";
import { ConfidentC10Image1 } from "./confident-C10-image-1";
import { ConfidentC10Screenshot1 } from "./confident-C10-screenshot-1";
// Уровень «Уверенный», урок C11 «G-код: читать, писать, менять на лету»: четыре
// части файла .gcode (блок 4), закладка слоя в тексте (блок 7), старт в слайсере
// (блок 10), вызов макроса и его тело (блок 18), окно постобработки (блок 22) и
// шаги M600 (блок 25) — все 6 кадров.
import { ConfidentC11Diagram0 } from "./confident-C11-diagram-0";
import { ConfidentC11Image0 } from "./confident-C11-image-0";
import { ConfidentC11Screenshot0 } from "./confident-C11-screenshot-0";
import { ConfidentC11Image1 } from "./confident-C11-image-1";
import { ConfidentC11Screenshot1 } from "./confident-C11-screenshot-1";
import { ConfidentC11Diagram1 } from "./confident-C11-diagram-1";
// Уровень «Уверенный», урок C12 «Сеть, мониторинг и печать без присмотра»: схема
// связки принтер-плата-роутер-телефон (блок 4), веб-панель в браузере (блок 7),
// туннель вместо открытого порта (блок 16), камера над столом (блок 21) и рамка
// обнаружения на кадре (блок 23) — все 5 кадров.
import { ConfidentC12Diagram0 } from "./confident-C12-diagram-0";
import { ConfidentC12Screenshot0 } from "./confident-C12-screenshot-0";
import { ConfidentC12Diagram1 } from "./confident-C12-diagram-1";
import { ConfidentC12Image0 } from "./confident-C12-image-0";
import { ConfidentC12Screenshot1 } from "./confident-C12-screenshot-1";
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
 * Базовый курс переписан, и его картинки рисуются заново: в BASE_VISUALS сейчас
 * тридцать восемь кадров — уроки L1–L6 нарисованы целиком. Остальные блоки с
 * visual_file показывают заглушку с иконкой своего типа. Прежние 27 кадров
 * (basic-1-…–basic-15-…) рисовались под контент старой программы, а три из них
 * совпадали по ключу с новыми уроками и подменяли заглушку чужой схемой —
 * поэтому кадры удалены вместе с файлами.
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
 * Новая визуализация = новый файл + одна строка в BASE_VISUALS, CONFIDENT_VISUALS,
 * ENGINEER_VISUALS, PROFIT_VISUALS или PRO_VISUALS.
 */
export type { VisualProps } from "./_Wrapper";

export type VisualComponent = ComponentType<VisualProps>;

/**
 * Адрес блока: курс, урок, тип блока и порядковый номер среди блоков этого типа.
 *
 * Базовый курс адресуется номером урока (basic-1-image-0), «Уверенный» — кодом
 * урока (confident-C5-image-0), «Инженер» — тоже кодом урока
 * (engineer-1-image-0, коды IN1…IN10 уникальны внутри уровня), продвинутый —
 * кодами модуля и урока (pro-A-A1-image-0): в продвинутом курсе номера уроков
 * строковые — A1, C1-1, T14.
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
 * Нарисованы тридцать восемь кадров: уроки L1–L6 целиком (пилот L1, все кадры L2,
 * L3, L4, L5 и L6). 27 кадров старого курса (модули «Знакомство» — «Финал», уроки
 * 1–15) рисовались под контент старой программы, и три из них (`basic-1-image-0`,
 * `basic-3-image-0`, `basic-4-image-0`) совпадали по ключу с новыми уроками 1, 3 и
 * 4 — в блоке показывалась чужая схема вместо заглушки. Кадры удалены вместе с
 * файлами (достать обратно можно из истории git; коммит до удаления — `b22da38`).
 *
 * Новая визуализация курса = новый файл
 * (components/lesson-visuals/basic-1-image-0.tsx) плюс одна строка здесь.
 */
const BASE_VISUALS: Record<string, VisualComponent> = {
  // Урок L1 «Знакомство с 3D-печатью»: три технологии и три источника тепла на
  // одной схеме — FDM со соплом и слоями, SLA с ванной и лучом, SLS с порошком и
  // валиком (блок 5, единственный визуальный блок урока).
  "basic-1-image-0": Basic1Image0,
  // Урок L2 «Как устроен принтер»: три кинематики на одной схеме (блок 4) и
  // разрез шагового мотора с сеткой микрошага (блок 9). Дальше в этом уроке
  // идут ремень GT2, Direct против Bowden, разрез хотэнда и покрытия стола.
  "basic-2-diagram-0": Basic2Diagram0,
  "basic-2-diagram-1": Basic2Diagram1,
  // Ремень GT2 со шкивом на 20 зубьев и расчётом 0,0125 мм на шаг (блок 13) и
  // сравнение Direct с Bowden по пути нити и ретракту (блок 16).
  "basic-2-diagram-2": Basic2Diagram2,
  "basic-2-diagram-3": Basic2Diagram3,
  // Разрез хотэнда с выносками к пяти узлам (блок 20) и пять покрытий стола по
  // подписи блока 25.
  "basic-2-diagram-4": Basic2Diagram4,
  "basic-2-diagram-5": Basic2Diagram5,
  // Урок L3 «Материалы: полный гид»: шесть кадров — путь филамента (блок 3),
  // карточки PLA и PETG (блоки 5 и 8), шкалы Tg/HDT (блок 10) и усадки (блок 22)
  // и сравнение сухой и влажной катушки (блок 30).
  "basic-3-diagram-0": Basic3Diagram0,
  "basic-3-image-0": Basic3Image0,
  "basic-3-image-1": Basic3Image1,
  "basic-3-diagram-1": Basic3Diagram1,
  "basic-3-image-2": Basic3Image2,
  "basic-3-diagram-2": Basic3Diagram2,
  // Урок L4 «Слайсер: от модели до G-кода»: семь кадров, все нарисованы.
  // Конвейер из пяти шагов (блок 4), предпросмотр с цветами по типу линии
  // (блок 6), кубики 0,1 / 0,2 / 0,3 мм (блок 9), разрез стенки с периметрами,
  // решёткой и потолками (блок 13), ретракт с паутиной (блок 22), три
  // ориентации кронштейна (блок 30) и юбка с каймой и плотом (блок 35).
  "basic-4-diagram-0": Basic4Diagram0,
  "basic-4-image-0": Basic4Image0,
  "basic-4-image-1": Basic4Image1,
  "basic-4-diagram-1": Basic4Diagram1,
  "basic-4-diagram-2": Basic4Diagram2,
  "basic-4-diagram-3": Basic4Diagram3,
  "basic-4-image-2": Basic4Image2,
  // Урок L5 «Первый слой: физика адгезии»: восемь кадров, все нарисованы.
  // Четыре причины адгезии (блок 3), сечение первого слоя (блок 6), три стола
  // под задачу (блок 10), бумага против щупа (блок 17), Z-offset в триптихе
  // (блок 19), три скорости одного контура (блок 23), юбка с каймой и плотом
  // (блок 27) и тест-квадрат 20 на 20 (блок 31).
  "basic-5-diagram-0": Basic5Diagram0,
  "basic-5-image-0": Basic5Image0,
  "basic-5-diagram-1": Basic5Diagram1,
  "basic-5-image-1": Basic5Image1,
  "basic-5-image-2": Basic5Image2,
  "basic-5-diagram-2": Basic5Diagram2,
  "basic-5-diagram-3": Basic5Diagram3,
  "basic-5-image-3": Basic5Image3,
  // Урок L6 «Скорость, температура и поток»: десять кадров, все нарисованы.
  // Пять причин ускорения (блок 2), разрез хотэнда с зоной плавления (блок 5),
  // три режима одной стенки (блок 7), температурная башня (блок 9),
  // одностенный куб и пересчёт множителя (блок 15), три вентиля (блок 20),
  // карты скорости и потока (блок 22), лестница скорости (блок 24),
  // профиль обдува по высоте (блок 26) и лестница калибровки (блок 31).
  "basic-6-diagram-0": Basic6Diagram0,
  "basic-6-image-0": Basic6Image0,
  "basic-6-diagram-1": Basic6Diagram1,
  "basic-6-image-1": Basic6Image1,
  "basic-6-image-2": Basic6Image2,
  "basic-6-diagram-2": Basic6Diagram2,
  "basic-6-image-3": Basic6Image3,
  "basic-6-image-4": Basic6Image4,
  "basic-6-diagram-3": Basic6Diagram3,
  "basic-6-diagram-4": Basic6Diagram4,
  // Урок L7 «Диагностика: 15 проблем»: десять кадров, все нарисованы.
  // Коробление с каймой (блок 6), сдвиг слоёв ступенькой (блок 8), щели и
  // пористые стенки (блок 10), перелив и волны (блок 12), паутина на башне
  // струн (блок 14), наплывы и точки (блок 16), звон от углов (блок 18),
  // оплывший верх (блок 20), мост с провисом (блок 22) и пропуски слоя
  // (блок 24).
  "basic-7-diagram-0": Basic7Diagram0,
  "basic-7-diagram-1": Basic7Diagram1,
  "basic-7-diagram-2": Basic7Diagram2,
  "basic-7-diagram-3": Basic7Diagram3,
  "basic-7-diagram-4": Basic7Diagram4,
  "basic-7-diagram-5": Basic7Diagram5,
  "basic-7-diagram-6": Basic7Diagram6,
  "basic-7-diagram-7": Basic7Diagram7,
  "basic-7-diagram-8": Basic7Diagram8,
  "basic-7-diagram-9": Basic7Diagram9,
  // Урок L8 «Первый проект»: семь кадров, все нарисованы. Четыре детали
  // первого проекта (блок 5), ориентация и поддержки (блок 11), пять проверок
  // в предпросмотре (блок 15), четыре состояния первого слоя (блок 18), четыре
  // сценария сбоя (блок 21), поддержки, следы и шкурка (блок 26) и четыре
  // замера штангенциркулем (блок 29).
  "basic-8-diagram-0": Basic8Diagram0,
  "basic-8-diagram-1": Basic8Diagram1,
  "basic-8-diagram-2": Basic8Diagram2,
  "basic-8-image-0": Basic8Image0,
  "basic-8-diagram-3": Basic8Diagram3,
  "basic-8-image-1": Basic8Image1,
  "basic-8-diagram-4": Basic8Diagram4,
};

/**
 * Визуализации уровня «Уверенный» — Этап 2: нарисованы пять уроков уровня.
 *
 * Ключ: `confident-{код урока}-{тип блока}-{номер}`, например
 * `confident-C5-image-0` или `confident-C8-diagram-1`. Кода модуля в ключе нет:
 * коды уроков (C1…C12) уникальны внутри уровня, в отличие от pro, где номера
 * уроков повторяются между модулями (A1, B1, C1-1).
 *
 * Нарисованы семь кадров урока C1 (32 блока: `C1_emissions_ladder.png` из блока
 * 5, `C1_materials_chart.png` из блока 6, `C1_spread.png` из блока 9,
 * `C1_measure.png` из блока 16, `C1_hierarchy.png` из блока 28,
 * `C1_siz_kit.png` из блока 29 и `C1_respirators.png` из блока 30) и все шесть
 * кадров урока C2 (31 блок: `C2_vent_schemes.png` из блока 4,
 * `C2_place_room.png` из блока 8, `C2_filters.png` из блока 11,
 * `C2_airflow.png` из блока 13, `C2_box_diy.png` из блока 14 и
 * `C2_workplace_layout.png` из блока 20) и все шесть кадров урока C3 «Пожарная
 * безопасность и аварийные сценарии» (30 блоков: `C3_fire_sources.png` из блока 3,
 * `C3_detectors.png` из блока 7, `C3_extinguishers.png` из блока 11,
 * `C3_first_minute.png` из блока 14, `C3_electric_check.png` из блока 20 и
 * `C3_unattended.png` из блока 24) и все шесть кадров урока C4 «Химия, СИЗ и
 * утилизация отходов» (32 блока: `C4_exposure_routes.png` из блока 4,
 * `C4_gloves.png` из блока 13, `C4_ppe_map.png` из блока 16, `C4_wash.png` из
 * блока 19, `C4_waste_bins.png` из блока 26 и `C4_storage.png` из блока 30) и все
 * шесть кадров урока C5 «Поддержки, которые отделяются сами» (35 блоков:
 * `C5_z_gap.png` из блока 4, `C5_interface.png` из блока 12, `C5_tree.png` из
 * блока 18, `C5_orientation.png` из блока 22, `C5_detach.png` из блока 30 и
 * `C5_settings.png` из блока 31) и все шесть кадров урока C6 «Модификаторы и
 * переменная высота слоя» (35 блоков: `C6_modifier_zones.png` из блока 4,
 * `C6_interface.png` из блока 8, `C6_bracket.png` из блока 12, `C6_layer_compare.png`
 * из блока 20, `C6_variable_ui.png` из блока 25 и `C6_compare.png` из блока 30),
 * а также все шесть кадров урока C7 «Модель больше стола: разрез, соединения,
 * допуски» (35 блоков: `C7_split_zones.png` из блока 4, `C7_cut_ui.png` из
 * блока 11, `C7_joints.png` из блока 14, `C7_tolerance_table.png` из блока 21,
 * `C7_glue_clamp.png` из блока 27 и `C7_time_compare.png` из блока 33), а также
 * все шесть кадров урока C8 «Поверхность: шов, ironing, округлость и текстура»
 * (35 блоков: `C8_surface_zones.png` из блока 4, `C8_seam_ui.png` из блока 7,
 * `C8_ironing_zones.png` из блока 16, `C8_ironing_ui.png` из блока 18,
 * `C8_circle_segments.png` из блока 22 и `C8_fuzzy_skin.png` из блока 27), а
 * также все шесть кадров урока C9 «Продвинутая калибровка принтера» (35 блоков:
 * `C9_pid_loop.png` из блока 4, `C9_pid_tune_ui.png` из блока 7,
 * `C9_esteps_measure.png` из блока 12, `C9_linear_advance.png` из блока 18,
 * `C9_ringing.png` из блока 23 и `C9_resonance_ui.png` из блока 25), а также все
 * шесть кадров урока C10 «Заполнение и сложные геометрии» (35 блоков:
 * `C10_infill_shapes.png` из блока 5, `C10_infill_cut.png` из блока 7,
 * `C10_infill_ui.png` из блока 15, `C10_overhang_angles.png` из блока 20,
 * `C10_bridge_compare.png` из блока 25 и `C10_thin_walls_ui.png` из блока 29), а
 * также все шесть кадров урока C11 «G-код: читать, писать, менять на лету»
 * (35 блоков: `C11_gcode_anatomy.png` из блока 4, `C11_layer_marker.png` из
 * блока 7, `C11_start_code_ui.png` из блока 10, `C11_macro_map.png` из блока 18,
 * `C11_post_ui.png` из блока 22 и `C11_m600_flow.png` из блока 25), а также все
 * пять кадров урока C12 «Сеть, мониторинг и печать без присмотра» (35 блоков:
 * `C12_net_map.png` из блока 4, `C12_web_ui.png` из блока 7,
 * `C12_tunnel_map.png` из блока 16, `C12_camera_place.png` из блока 21 и
 * `C12_ai_detect.png` из блока 23). Уровень «Уверенный» визуализирован целиком.
 * Первая визуализация = новый файл
 * (components/lesson-visuals/confident-C1-image-0.tsx) плюс одна строка здесь.
 */
const CONFIDENT_VISUALS: Record<string, VisualComponent> = {
  // Урок C1 «Что летит в воздух: UFP, VOC и защита дыхания»: пирамида выбросов
  // от PLA к PC, что выделяет каждый материал, как частицы расходятся по комнате,
  // график замера с вытяжкой и без, схема защиты мастерской, набор СИЗ и картридж
  // A2P3 с правилами ресурса (все 7 кадров урока).
  "confident-C1-diagram-0": ConfidentC1Diagram0,
  "confident-C1-list-0": ConfidentC1List0,
  "confident-C1-diagram-1": ConfidentC1Diagram1,
  "confident-C1-image-0": ConfidentC1Image0,
  "confident-C1-image-1": ConfidentC1Image1,
  "confident-C1-list-7": ConfidentC1List7,
  "confident-C1-image-2": ConfidentC1Image2,
  // Урок C2 «Вентиляция и рабочее место»: три схемы вентиляции, планировка
  // комнаты под три варианта, разрез фильтров по потоку, шесть шагов сборки
  // фильтр-бокса, разрез бокса с принтером и план мастерской по зонам
  // (все 6 кадров урока).
  "confident-C2-diagram-0": ConfidentC2Diagram0,
  "confident-C2-image-0": ConfidentC2Image0,
  "confident-C2-image-1": ConfidentC2Image1,
  "confident-C2-steps-0": ConfidentC2Steps0,
  "confident-C2-image-2": ConfidentC2Image2,
  "confident-C2-image-3": ConfidentC2Image3,
  // Урок C3 «Пожарная безопасность и аварийные сценарии»: три места нагрева и
  // температуры, датчик дыма над принтером, три средства тушения с ценой,
  // таймлайн первой минуты, осмотр вилки, шнура и розетки и печать без
  // присмотра (все 6 кадров урока).
  "confident-C3-diagram-0": ConfidentC3Diagram0,
  "confident-C3-image-0": ConfidentC3Image0,
  "confident-C3-image-1": ConfidentC3Image1,
  "confident-C3-diagram-1": ConfidentC3Diagram1,
  "confident-C3-image-2": ConfidentC3Image2,
  "confident-C3-list-5": ConfidentC3List5,
  // Урок C4 «Химия, СИЗ и утилизация отходов»: три пути химии в тело, перчатки
  // и их проницаемость, карта СИЗ по операциям, промывка двумя банками, три
  // корзины на столе и восемь шагов хранения химии (все 6 кадров урока).
  "confident-C4-diagram-0": ConfidentC4Diagram0,
  "confident-C4-image-0": ConfidentC4Image0,
  "confident-C4-diagram-1": ConfidentC4Diagram1,
  "confident-C4-diagram-2": ConfidentC4Diagram2,
  "confident-C4-image-1": ConfidentC4Image1,
  "confident-C4-steps-1": ConfidentC4Steps1,
  // Урок C5 «Поддержки, которые отделяются сами»: щель по Z и её значения,
  // три зоны опоры, дерево против решётки, одна деталь до и после разворота,
  // шесть шагов снятия поддержек и окно поддержек в слайсере (все 6 кадров).
  "confident-C5-diagram-0": ConfidentC5Diagram0,
  "confident-C5-diagram-1": ConfidentC5Diagram1,
  "confident-C5-image-0": ConfidentC5Image0,
  "confident-C5-diagram-2": ConfidentC5Diagram2,
  "confident-C5-steps-1": ConfidentC5Steps1,
  "confident-C5-screenshot-0": ConfidentC5Screenshot0,
  // Урок C6 «Модификаторы и переменная высота слоя»: три зоны кронштейна, окно
  // модификатора, пример с зоной нагрузки, разрез по высоте, окно переменной
  // высоты и сравнение постоянной и переменной высоты (все 6 кадров).
  "confident-C6-diagram-0": ConfidentC6Diagram0,
  "confident-C6-screenshot-0": ConfidentC6Screenshot0,
  "confident-C6-image-0": ConfidentC6Image0,
  "confident-C6-diagram-1": ConfidentC6Diagram1,
  "confident-C6-screenshot-1": ConfidentC6Screenshot1,
  "confident-C6-diagram-2": ConfidentC6Diagram2,
  // Урок C7 «Модель больше стола: разрез, соединения, допуски»: панель и две
  // линии реза, окно Cut, пять соединений, таблица зазоров, склейка со
  // стяжкой и сравнение времени (все 6 кадров).
  "confident-C7-diagram-0": ConfidentC7Diagram0,
  "confident-C7-screenshot-0": ConfidentC7Screenshot0,
  "confident-C7-diagram-1": ConfidentC7Diagram1,
  "confident-C7-diagram-2": ConfidentC7Diagram2,
  "confident-C7-image-0": ConfidentC7Image0,
  "confident-C7-diagram-3": ConfidentC7Diagram3,
  // Урок C8 «Поверхность: шов, ironing, округлость и текстура»: три зоны
  // поверхности, окно шва, плоские площадки под ironing, настройки ironing,
  // три допуска круга и сравнение гладкой и шершавой стенки (все 6 кадров).
  "confident-C8-diagram-0": ConfidentC8Diagram0,
  "confident-C8-screenshot-0": ConfidentC8Screenshot0,
  "confident-C8-diagram-1": ConfidentC8Diagram1,
  "confident-C8-screenshot-1": ConfidentC8Screenshot1,
  "confident-C8-diagram-2": ConfidentC8Diagram2,
  "confident-C8-image-0": ConfidentC8Image0,
  // Урок C9 «Продвинутая калибровка принтера»: температура сопла до и после
  // автоподбора, консоль PID, замер E-steps, наплыв и ровный угол Linear
  // Advance, звон у угла и таблица резонансов (все 6 кадров).
  "confident-C9-diagram-0": ConfidentC9Diagram0,
  "confident-C9-screenshot-0": ConfidentC9Screenshot0,
  "confident-C9-image-0": ConfidentC9Image0,
  "confident-C9-diagram-1": ConfidentC9Diagram1,
  "confident-C9-image-1": ConfidentC9Image1,
  "confident-C9-screenshot-1": ConfidentC9Screenshot1,
  // Урок C10 «Заполнение и сложные геометрии»: пять форм решётки, разрез
  // детали, окно заполнения, четыре угла нависания, мост и Print Thin Walls
  // (все 6 кадров).
  "confident-C10-diagram-0": ConfidentC10Diagram0,
  "confident-C10-image-0": ConfidentC10Image0,
  "confident-C10-screenshot-0": ConfidentC10Screenshot0,
  "confident-C10-diagram-1": ConfidentC10Diagram1,
  "confident-C10-image-1": ConfidentC10Image1,
  "confident-C10-screenshot-1": ConfidentC10Screenshot1,
  // Урок C11 «G-код: читать, писать, менять на лету»: четыре части файла,
  // закладка слоя, стартовый код в слайсере, тело макроса, окно постобработки и
  // пять шагов M600 (все 6 кадров).
  "confident-C11-diagram-0": ConfidentC11Diagram0,
  "confident-C11-image-0": ConfidentC11Image0,
  "confident-C11-screenshot-0": ConfidentC11Screenshot0,
  "confident-C11-image-1": ConfidentC11Image1,
  "confident-C11-screenshot-1": ConfidentC11Screenshot1,
  "confident-C11-diagram-1": ConfidentC11Diagram1,
  // Урок C12 «Сеть, мониторинг и печать без присмотра»: схема связки, веб-панель,
  // туннель вместо открытого порта, камера над столом и рамка обнаружения (все 5
  // кадров).
  "confident-C12-diagram-0": ConfidentC12Diagram0,
  "confident-C12-screenshot-0": ConfidentC12Screenshot0,
  "confident-C12-diagram-1": ConfidentC12Diagram1,
  "confident-C12-image-0": ConfidentC12Image0,
  "confident-C12-screenshot-1": ConfidentC12Screenshot1,
};

/**
 * Визуализации уровня «Инженер» — Этап 2, ждут своих кадров.
 *
 * Ключ: `engineer-{номер}-{тип блока}-{номер по типу}`, например
 * `engineer-1-image-0` или `engineer-10-diagram-1`. Кода модуля в ключе нет:
 * коды уроков (IN1…IN10) уникальны внутри уровня, как у «Уверенного».
 *
 * Реестр пуст: нарисованных кадров у уровня пока нет, поэтому все визуальные
 * блоки рисуются заглушкой по типу. Написаны первые уроки — IN1 (32 блока и 7
 * кадров: `IN1_heat_ladder.png`, `IN1_strength_table.png`, `IN1_abrasive.png`,
 * `IN1_ht_printer.png`, `IN1_chem_table.png`, `IN1_inserts.png`,
 * `IN1_choose_material.png`) и IN2 (7 кадров: `IN2_load_types.png`,
 * `IN2_stress_table.png`, `IN2_anisotropy.png`, `IN2_orientation.png`,
 * `IN2_bending.png`, `IN2_walls_fill.png`, `IN2_test_coupon.png`), остальные
 * уроки ждут текста. Первая визуализация =
 * новый файл (components/lesson-visuals/engineer-1-image-0.tsx) плюс одна строка
 * здесь.
 */
const ENGINEER_VISUALS: Record<string, VisualComponent> = {};

/**
 * Визуализации уровня «Заработок» — Этап 2, ждут своих кадров.
 *
 * Ключ: `profit-{номер}-{тип блока}-{номер по типу}`, например
 * `profit-1-image-0` или `profit-8-diagram-1`. Кода модуля в ключе нет: коды
 * уроков (Z1…Z8) уникальны внутри уровня, как у «Уверенного» и «Инженера».
 *
 * Реестр пуст: нарисованных кадров у уровня пока нет, поэтому все визуальные блоки рисуются
 * заглушкой по типу. Уровень задуман на 48 кадров (5–7 на урок), написан первый урок — Z1
 * (32 блока и 6 кадров: `Z1_niche_map.png`, `Z1_products_grid.png`, `Z1_margin_table.png`,
 * `Z1_price_floor.png`, `Z1_competition.png`, `Z1_pick_niche.png`), остальные уроки ждут текста.
 * Первая визуализация = новый файл (components/lesson-visuals/profit-1-image-0.tsx) плюс одна
 * строка здесь.
 */
const PROFIT_VISUALS: Record<string, VisualComponent> = {};

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

  if (ref.course === "engineer") {
    return `engineer-${ref.lessonId ?? ""}-${ref.type}-${ref.typeOrdinal}`;
  }

  if (ref.course === "profit") {
    return `profit-${ref.lessonId ?? ""}-${ref.type}-${ref.typeOrdinal}`;
  }

  if (ref.course === "confident") {
    return `confident-${ref.lessonId ?? ""}-${ref.type}-${ref.typeOrdinal}`;
  }

  return `basic-${ref.lessonId ?? ""}-${ref.type}-${ref.typeOrdinal}`;
}

/** Визуализация конкретного блока или null, если она ещё не нарисована. */
export function getVisualComponent(ref: VisualBlockRef): VisualComponent | null {
  // Каждый курс смотрит только в свой раздел: так ключи пяти курсов не могут
  // случайно совпасть и в блоке не появится чужая схема.
  const registry =
    ref.course === "pro"
      ? PRO_VISUALS
      : ref.course === "engineer"
        ? ENGINEER_VISUALS
        : ref.course === "profit"
          ? PROFIT_VISUALS
          : ref.course === "confident"
            ? CONFIDENT_VISUALS
            : BASE_VISUALS;

  return registry[visualKey(ref)] ?? null;
}
