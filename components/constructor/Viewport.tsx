"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ACESFilmicToneMapping,
  BufferAttribute,
  BufferGeometry,
  Color,
  DataTexture,
  DoubleSide,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PCFShadowMap,
  PlaneGeometry,
  PMREMGenerator,
  Scene as ThreeScene,
  SRGBColorSpace,
  Vector3,
} from "three";
import type { Group, PerspectiveCamera } from "three";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import type { Font } from "three/examples/jsm/loaders/FontLoader.js";

import {
  BOX_MAGNET_SIZE_LABELS,
  COASTER_PATTERN_LABELS,
  JEWELRY_LEAF_TYPE_LABELS,
  LITHOPHANE_PREVIEW_RESOLUTION,
  LITHOPHANE_SHAPE_LABELS,
  PEN_SHAPE_LABELS,
  PLANTER_SHAPE_LABELS,
  downsampleLithophaneBrightness,
  keychainDecorationFonts,
  keychainFontUrl,
  keychainShapeLabel,
  keychainTextDecoration,
  lithophaneHasStand,
  lithophanePanelCount,
  lithophaneShapeHasFrame,
  vasePatternLabel,
  type ConstructorParams,
  type KeychainFontId,
  type LithophaneBrightnessGrid,
} from "@/lib/constructor/params";
import { calculateGeometryWeightGrams } from "@/lib/constructor/geometry-volume";
import {
  createKeychainGeometry,
  type KeychainBuildReport,
} from "@/lib/constructor/keychain-geometry";
import { createBoxGeometry } from "@/lib/constructor/box-geometry";
import { createCoasterGeometry } from "@/lib/constructor/coaster-geometry";
import {
  createHeatTransferGeometry,
  heatTransferThickness,
} from "@/lib/constructor/heat-transfer-geometry";
import { jewelryDeerHeightMm } from "@/lib/constructor/jewelry-deer-geometry";
import { jewelryTreeHeightMm } from "@/lib/constructor/jewelry-tree-geometry";
import { createJewelryStandGeometry } from "@/lib/constructor/jewelry-stand-geometry";
import {
  lithophaneHeatColor,
  lithophaneHeatMesh,
  lithophaneLightPlan,
  type LithoLightFace,
  type LithoLightPlan,
} from "@/lib/constructor/litho-light-calc";
import {
  createLithophaneGeometry,
  lithophanePlateSize,
} from "@/lib/constructor/lithophane-geometry";
import { lithophaneGlowPixels } from "@/lib/constructor/lithophane-image";
import { createPenHolderGeometry } from "@/lib/constructor/pen-holder-geometry";
import { createPlanterGeometry } from "@/lib/constructor/planter-geometry";
import { createStandGeometry } from "@/lib/constructor/phone-stand-geometry";
import {
  SIGN_FONT_URLS,
  createSignGeometry,
} from "@/lib/constructor/sign-geometry";
import { createVaseGeometry } from "@/lib/constructor/vase-geometry";
import { createVaseProfile } from "@/lib/constructor/vase-profile";
import {
  VASE_SECTION_MIN_SIDES,
  resolveSectionSides,
} from "@/lib/constructor/vase-section";
import {
  STUDIO_BACKGROUND_CSS,
  STUDIO_BACKLIGHT,
  STUDIO_CAMERA,
  STUDIO_CERAMIC,
  STUDIO_ENVIRONMENT,
  STUDIO_EXPOSURE,
  STUDIO_FLOOR,
  STUDIO_LIGHTS,
  STUDIO_MODEL_TINTS,
  STUDIO_PLASTIC,
  STUDIO_VIGNETTE,
  studioSpan,
} from "@/lib/constructor/studio";

/** Параметры выбранной модели: сцена пересобирается при любом изменении. */
type ViewportProps = {
  /** Все параметры выбранной модели: сцена читает их вместе с геометрией. */
  params: ConstructorParams;
  /**
   * Сцена во весь экран: так её показывает мобильное окно «Показать 3D».
   *
   * На телефоне сцена в потоке страницы — обычный блок вверху, а не липкая
   * панель, поэтому покрутить модель удобнее в отдельном окне поверх страницы:
   * там она занимает всю высоту экрана, а не 40vh. Отличается только обёртка —
   * канвас, камера и подсказки те же.
   */
  fullscreen?: boolean;
  /**
   * `?debug=light`: показать отладочную кнопку «Карта света».
   *
   * Карта считает ровность освещения панели и красит по ней рельеф — это
   * инструмент разработчика, а не режим просмотра. Без флага кнопки в сцене нет,
   * и случайно включить слой нельзя.
   */
  debugLight?: boolean;
  /**
   * Итоги сборки брелока: куда встала картинка и насколько ужалась.
   *
   * Отчёт считается той же сборкой, что показывает сцена: второй расчёт в
   * панели разошёлся бы с предпросмотром на первом же изменении букв.
   */
  onKeychainImageReport?: (report: KeychainBuildReport | null) => void;
};


/**
 * Габариты модели для камеры и подписи под сценой.
 *
 * Считаются по фактической сетке: у вывески ширина зависит от надписи и
 * кегля, а не только от слайдеров, поэтому один источник правды — bounding box
 * готовой геометрии.
 */
type Framing = {
  /** Высота модели над столом, мм. */
  height: number;
  /** Наибольший горизонтальный размер, мм. */
  footprint: number;
  /** Модель лежит на столе: камера смотрит круче. */
  flat: boolean;
};

/** Для камеры важны только габариты: форма и материал не меняют кадр. */
type CameraRigProps = {
  height: number;
  /** Наибольший горизонтальный размер модели. */
  footprint: number;
  /** Брелок лежит на столе, поэтому камера смотрит на него круче. */
  flat: boolean;
};

/**
 * Направление, с которого камера смотрит на модель при первом открытии:
 * чуть справа и сверху. Дальше пользователь вращает сцену сам, а мы сохраняем
 * это направление при изменении размеров — камера не прыгает в исходную точку.
 */
const INITIAL_DIRECTION = new Vector3(
  STUDIO_CAMERA.direction[0],
  STUDIO_CAMERA.direction[1],
  STUDIO_CAMERA.direction[2],
).normalize();


/**
 * Для лежащего брелока взгляд должен быть круче: при 15° над столом тонкая
 * пластина видна почти с ребра, и имя не читается. При смене модели камера
 * возвращается к подходящему ракурсу, а слайдеры направление не сбивают.
 */
const FLAT_DIRECTION = new Vector3(0.55, 0.85, 0.75).normalize();

/** Запас вокруг модели, чтобы она не касалась краёв кадра. */
const FRAME_MARGIN = 1.35;

/**
 * Переключатель сторон брелока.
 *
 * Рельефы оборота стоят под пластиной и с лица не видны, поэтому у сцены две
 * кнопки: они переворачивают деталь так же, как это сделал бы владелец в руках.
 * Подписи живут рядом с флагами, чтобы кнопка и сцена не разошлись.
 */
const KEYCHAIN_VIEW_SIDES = [
  { back: false, label: "Лицо" },
  { back: true, label: "Оборот" },
] as const;

/**
 * Минимальный набор методов OrbitControls, который нужен CameraRig.
 *
 * Импортировать тип из three-stdlib не хочется: это транзитивная зависимость
 * drei, а не наш прямой пакет. Описываем только используемые поля.
 */
type OrbitControlsLike = {
  target: Vector3;
  minDistance: number;
  maxDistance: number;
  update: () => void;
};

/**
 * Подгоняет камеру под габариты модели.
 *
 * Считаем расстояние, при котором в кадр влезают и высота, и диаметр, с
 * учётом текущего соотношения сторон. При изменении размера сохраняем
 * направление взгляда: берём вектор от центра модели к камере и откладываем
 * новую дистанцию вдоль него. Поэтому слайдер высоты не сбрасывает поворот,
 * а вращение мышью не вызывает пересчёт — эффект зависит только от размеров
 * и размеров окна.
 */
function CameraRig({ height, footprint, flat }: CameraRigProps) {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const controls = useThree(
    (state) => state.controls,
  ) as OrbitControlsLike | null;
  const previous = useRef<{ height: number; flat: boolean } | null>(null);

  useEffect(() => {
    const perspective = camera as PerspectiveCamera;
    const verticalFov = (perspective.fov * Math.PI) / 180;
    const aspect = Math.max(size.width / Math.max(size.height, 1), 0.4);

    // Дистанция, при которой модель целиком помещается по высоте и по ширине.
    const fitHeight = height / 2 / Math.tan(verticalFov / 2);
    const fitWidth = footprint / 2 / (Math.tan(verticalFov / 2) * aspect);
    const distance = Math.max(fitHeight, fitWidth) * FRAME_MARGIN;

    // Центр вращения — середина модели по высоте.
    const target = new Vector3(0, height / 2, 0);

    // Сохраняем направление, с которого смотрел пользователь.
    const direction = new Vector3();
    if (previous.current) {
      const previousTarget = new Vector3(0, previous.current.height / 2, 0);
      direction.copy(camera.position).sub(previousTarget);
    }

    // Смена модели — новый ракурс: ваза стоит, брелок лежит. Внутри одной
    // модели слайдеры направление не сбивают.
    if (
      !previous.current ||
      previous.current.flat !== flat ||
      direction.lengthSq() < 1e-6
    ) {
      direction.copy(flat ? FLAT_DIRECTION : INITIAL_DIRECTION);
    } else {
      direction.normalize();
    }

    camera.position.copy(target).addScaledVector(direction, distance);
    camera.lookAt(target);

    if (controls) {
      controls.target.copy(target);
      // Ограничения держат модель в кадре: нельзя отъехать так далеко, что
      // она превратится в точку, или подойти вплотную к стенке.
      controls.minDistance = distance * 0.35;
      controls.maxDistance = distance * 3.2;
      controls.update();
    }

    previous.current = { height, flat };
  }, [camera, controls, flat, footprint, height, size.height, size.width]);

  return null;
}

type VaseModelProps = {
  geometry: BufferGeometry;
  /** Гранёный силуэт: у него рёбра затеняются плоско, без сглаживания. */
  faceted: boolean;
};

/**
 * Ваза из LatheGeometry с толщиной стенки и дном.
 *
 * Геометрию создаёт и освобождает Viewport: меш только подключает готовый
 * BufferGeometry. Так старая сетка освобождается в одном месте, а не при
 * каждом обновлении материала или света.
 *
 * У гранёной вазы материал включает `flatShading`: нормали в сетке остаются
 * гладкими (иначе вырос бы буфер вершин, а сварка и проверки объёма считали бы
 * другую геометрию), а плоское затенение даёт тот же вид — каждая грань
 * освещается целиком, ребро между гранями остаётся резким. STL и так состоит
 * из плоских треугольников, поэтому на файл это не влияет.
 */
function VaseModel({ geometry, faceted }: VaseModelProps) {
  return (
    <mesh castShadow geometry={geometry} receiveShadow>
      {/*
        Керамика: матовая основа и тонкий слой глазури сверху. Clearcoat ловит
        свет софтбоксов отдельным бликом — по нему видно, где поверхность
        поворачивается, и ваза перестаёт выглядеть однотонным силуэтом.
        Тон чуть темнее бумажного: на белом при таком свете не остаётся
        полутеней, и форма читается только по контуру.
      */}
      <meshPhysicalMaterial
        clearcoat={STUDIO_CERAMIC.clearcoat}
        clearcoatRoughness={STUDIO_CERAMIC.clearcoatRoughness}
        color={STUDIO_CERAMIC.color}
        flatShading={faceted}
        metalness={STUDIO_CERAMIC.metalness}
        roughness={STUDIO_CERAMIC.roughness}
      />
    </mesh>
  );
}

type KeychainModelProps = {
  geometry: BufferGeometry;
  /** Показан оборот: пластина перевёрнута лицом вниз. */
  back: boolean;
  /**
   * Подъём на середине переворота, мм.
   *
   * В полпути пластина стоит на ребре, и её половина уходила бы под стол. Подъём
   * по дуге оставляет переворот над столом: деталь поднимается, переворачивается
   * через ребро и опускается обратно — так видно, что произошло.
   */
  lift: number;
  /** Толщина детали, мм: ось переворота идёт по её середине. */
  thickness: number;
};

/** Доля оставшегося пути за секунду: переворот занимает примерно треть секунды. */
const KEYCHAIN_FLIP_SPEED = 9;

/**
 * Брелок лежит на столе лицевой стороной вверх.
 *
 * Геометрия построена в плоскости XY с толщиной по Z — так её удобно печатать.
 * Поворот на -90° вокруг X ставит толщину по Y: нижняя грань касается стола,
 * а имя смотрит на камеру.
 *
 * Оборот показывается тем же поворотом вокруг горизонтальной оси X: при 180°
 * пластина встаёт обратной стороной вверх, а смещение на толщину возвращает
 * нижнюю грань на стол. Рельефы оборота после этого видны сверху — ровно так,
 * как их увидит владелец брелока, перевернув его в руках.
 */
function KeychainModel({
  back,
  geometry,
  lift,
  thickness,
}: KeychainModelProps) {
  const group = useRef<Group>(null);
  /** Прогресс переворота: 0 — лицо, 1 — оборот. */
  const progress = useRef(back ? 1 : 0);

  useFrame((_, delta) => {
    const target = back ? 1 : 0;
    const step = Math.min(1, delta * KEYCHAIN_FLIP_SPEED);
    const next =
      Math.abs(target - progress.current) <= 1e-3
        ? target
        : progress.current + (target - progress.current) * step;

    progress.current = next;

    if (!group.current) {
      return;
    }

    // Один поворот вместо вложенных групп: -90° — пластина лежит лицом вверх,
    // +90° — обратной стороной вверх. Дуга подъёма держит деталь над столом.
    group.current.rotation.x = -Math.PI / 2 + Math.PI * next;
    group.current.position.y =
      thickness * next + Math.sin(Math.PI * next) * lift;
  });

  return (
    <group ref={group} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh castShadow geometry={geometry} receiveShadow>
        <meshStandardMaterial
          color={STUDIO_MODEL_TINTS.keychain}
          metalness={STUDIO_PLASTIC.metalness}
          roughness={STUDIO_PLASTIC.roughness}
        />
      </mesh>
    </group>
  );
}

type StandModelProps = {
  geometry: BufferGeometry;
};

/**
 * Подставка стоит на столе так же, как её печатает слайсер: геометрия
 * построена Z-вверх, поворот на -90° вокруг X поднимает спинку и губу.
 *
 * Цвет холоднее вазы — по нему видно, что деталь относится к подставке.
 */
function StandModel({ geometry }: StandModelProps) {
  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      <mesh castShadow geometry={geometry} receiveShadow>
        <meshStandardMaterial
          color={STUDIO_MODEL_TINTS.stand}
          metalness={STUDIO_PLASTIC.metalness}
          roughness={STUDIO_PLASTIC.roughness}
        />
      </mesh>
    </group>
  );
}

type BoxModelProps = {
  geometry: BufferGeometry;
};

/**
 * Коробка стоит на столе так же, как её печатает слайсер: геометрия построена
 * в плоскости XY с высотой по Z, поворот на -90° вокруг X поднимает стенки.
 * Корпус и крышка уже разложены рядом в одной сетке, поэтому меш один.
 */
function BoxModel({ geometry }: BoxModelProps) {
  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      <mesh castShadow geometry={geometry} receiveShadow>
        <meshStandardMaterial
          color={STUDIO_MODEL_TINTS.box}
          metalness={STUDIO_PLASTIC.metalness}
          roughness={STUDIO_PLASTIC.roughness}
        />
      </mesh>
    </group>
  );
}

type ZUpModelProps = {
  geometry: BufferGeometry;
  /** Цвет пластика: у каждой модели свой, чтобы сцены не путались. */
  color: string;
};

/**
 * Кашпо, подставка под кружку и подставка для украшений.
 *
 * Геометрия этих моделей построена Z-вверх, как у коробки, поэтому поворот на
 * -90° вокруг X ставит детали на виртуальный стол.
 */
function ZUpModel({ geometry, color }: ZUpModelProps) {
  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      <mesh castShadow geometry={geometry} receiveShadow>
        <meshStandardMaterial
          color={color}
          metalness={STUDIO_PLASTIC.metalness}
          roughness={STUDIO_PLASTIC.roughness}
        />
      </mesh>
    </group>
  );
}

type LithophaneModelProps = {
  geometry: BufferGeometry;
  /** Включена подсветка на просвет: пластик пропускает свет и светится картой. */
  backlight: boolean;
  /**
   * Рельеф красится плоскостями (`flatShading`).
   *
   * Так видно высоту пикселя на плоской панели: у неё все грани лежат в одной
   * плоскости, и без плоского затенения рельеф читался бы только по карте
   * свечения. У изогнутой панели фасетки стоят под углом друг к другу, и плоское
   * затенение превращает их в муар — там нормали сглажены по сетке лица.
   */
  faceted: boolean;
  /** Уменьшенная сетка яркости: из неё собирается карта свечения. */
  glow: LithophaneBrightnessGrid | null;
  /**
   * Кадры граней калейдоскопа: у каждой грани своя карта свечения.
   *
   * `null` — у панели один кадр (плоская, изогнутая, полуцилиндр). Четыре сетки
   * приходят только у призмы: без них на всех гранях светился бы первый кадр.
   */
  faces: LithophaneBrightnessGrid[] | null;
  /** Габариты плиты без рамки: под них карта свечения получает светлые поля. */
  plate: { width: number; height: number } | null;
};

/**
 * Карта свечения из сетки яркости.
 *
 * Светится сам пластик, а не фон: карта повторяет фото, поэтому на просвет
 * горят светлые участки и остаются тёмными тени — так же, как у напечатанного
 * литофана у окна. Кадр вписан в плиту по contain, и поля по краям тоже
 * светятся (их толщина минимальна), поэтому текстура строится под пропорции
 * плиты: кадр по центру, поля белые. Размер выходит на пиксели полей больше
 * уменьшенной сетки, и uv рельефа (они идут по плите) ложатся на неё один в
 * один. В цикле кадра new DataTexture не появляется: текстура собирается один
 * раз на переключение режима, замену картинки или смену габарита.
 */
function createGlowTexture(
  glow: LithophaneBrightnessGrid,
  plate: { width: number; height: number },
): DataTexture {
  const { pixels, width, height } = lithophaneGlowPixels(
    glow,
    plate.width,
    plate.height,
  );
  const texture = new DataTexture(pixels, width, height);

  // Сетка яркости приходит sRGB-байтами. Без перевода в линейное пространство
  // полутона свечения выходили бы мыльными, а светлые участки упирались бы в
  // потолок.
  texture.colorSpace = SRGBColorSpace;
  // Рельеф на экране мельче сетки: линейный фильтр не даёт свечению рассыпаться
  // на клетки.
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;

  return texture;
}

/**
 * Литофан стоит на столе лицевой стороной к камере.
 *
 * Геометрия уже построена в плоскости XY нижней кромкой на Y = 0, поэтому
 * поворот не нужен: рамка и рельеф смотрят в +Z. Материал почти белый и
 * матовый — так на выступах читается светотень, а тонкие участки выглядят
 * светлее.
 *
 * Материалов два, потому что сетка размечена группами
 * (`LITHOPHANE_RELIEF_GROUP` / `LITHOPHANE_DETAIL_GROUP`). Рельеф плоской панели
 * выводится с `flatShading`: нормаль каждой грани совпадает с высотой пикселя, и
 * на свету видно, где фото толще — без этого шума не было бы видно рельефа
 * вообще. У изогнутой панели, полуцилиндра и калейдоскопа плоское затенение
 * выключено: их грани стоят под углом друг к другу, и фасетки 0.3 мм складывались
 * в муар. Рамка и подставка идут гладким материалом всегда: их нормали посчитаны
 * после сварки вершин, поэтому скругление стойки и накладка выглядят литыми.
 *
 * У калейдоскопа материалов больше: `createLithophaneGeometry` режет его сетку
 * по группам на четыре грани, и каждая получает свою текстуру. Иначе на всех
 * четырёх гранях светился первый загруженный кадр, хотя рельеф у них разный.
 *
 * В режиме подсветки рельеф становится полупрозрачным (`transmission`): сквозь
 * него проходит свет лампы, стоящей за моделью, а карта свечения повторяет
 * фото — тёмные пиксели остаются тёмными. Крепление при этом остаётся
 * обычным пластиком: рамку и подставку печатают плотными, на просвет они не
 * работают, и подсвечивать их незачем.
 *
 * Материалы и текстуры создаются один раз на режим и живут дольше сетки,
 * поэтому освобождаются на размонтировании и при смене режима.
 */
function LithophaneModel({
  backlight,
  faceted,
  faces,
  geometry,
  glow,
  plate,
}: LithophaneModelProps) {
  /*
    Кадр каждой грани: у плоской панели, дуги и полуцилиндра он один, у призмы —
    до четырёх. Пустой слот грани уже заменён предыдущим кадром в `Scene`, поэтому
    здесь только сборка текстур под пропорции плиты.
  */
  const faceCount = faces && faces.length > 0 ? faces.length : 1;

  const glowTextures = useMemo(() => {
    if (!backlight || !plate) {
      return null;
    }

    const grids =
      faces && faces.length > 0
        ? faces
        : glow
          ? Array.from({ length: faceCount }, () => glow)
          : [];

    return grids.length > 0
      ? grids.map((grid) => createGlowTexture(grid, plate))
      : null;
  }, [backlight, faceCount, faces, glow, plate]);

  const materials = useMemo(() => {
    const relief = Array.from({ length: faceCount }, (_, index) => {
      const texture = glowTextures?.[index] ?? null;

      return texture
        ? new MeshPhysicalMaterial({
            ...STUDIO_BACKLIGHT.material,
            color: STUDIO_MODEL_TINTS.lithophane,
            emissive: STUDIO_BACKLIGHT.color,
            emissiveIntensity: STUDIO_BACKLIGHT.glow,
            emissiveMap: texture,
            flatShading: faceted,
            metalness: 0,
          })
        : new MeshStandardMaterial({
            color: STUDIO_MODEL_TINTS.lithophane,
            flatShading: faceted,
            metalness: STUDIO_PLASTIC.metalness,
            roughness: STUDIO_PLASTIC.roughness,
          });
    });

    // Последний материал — крепление: его номер замыкает группы сетки.
    return [
      ...relief,
      new MeshStandardMaterial({
        color: STUDIO_MODEL_TINTS.lithophane,
        metalness: STUDIO_PLASTIC.metalness,
        roughness: STUDIO_PLASTIC.roughness,
      }),
    ];
  }, [faceCount, faceted, glowTextures]);

  useEffect(
    () => () => {
      for (const material of materials) {
        material.dispose();
      }
    },
    [materials],
  );

  useEffect(
    () => () => {
      for (const texture of glowTextures ?? []) {
        texture.dispose();
      }
    },
    [glowTextures],
  );

  /*
    В режиме просвета тень снимается: пластик прозрачный, и сплошная тень на
    столе выдавала бы свет, которого перед панелью нет. Остальной студийный
    свет приглушён, поэтому потеря тени не читается как поломка сцены.

    Тень не принимается и самой панелью: в сборке плита, рамка и подставка —
    одна сетка, и без этого открытая арка с её ножками бросала бы на картинку
    полосы тени от приглушённого студийного света. На просвет низ кадра должен
    светиться так же, как верх, — иначе подставка снова даёт тёмное пятно, от
    которого её и переделали.
  */
  return (
    <mesh
      castShadow={!backlight}
      geometry={geometry}
      material={materials}
      receiveShadow={!backlight}
    />
  );
}

/** Зазор карты света над рельефом, мм: карта не режет выступы фото. */
const HEAT_MAP_LIFT_MM = 0.6;

/** Слой карты света: сетка грани и её цвета. */
type HeatLayer = {
  geometry: BufferGeometry;
  texture: DataTexture;
};

/**
 * Карта света на грани панели.
 *
 * Сетку, развёртку и цвета считает `lithophaneHeatMesh` — та же параметризация
 * `u`–`v`, что и у люксов, поэтому плоская панель, изогнутая и грань призмы
 * получают карту без отдельной развёртки. Здесь буферы заворачиваются в объекты
 * three и помечаются как готовая sRGB-текстура.
 */
function createHeatLayer(
  face: LithoLightFace,
  map: readonly number[],
  columns: number,
  rows: number,
  average: number,
  lift: number,
): HeatLayer {
  const mesh = lithophaneHeatMesh(face, map, columns, rows, average, lift);
  const geometry = new BufferGeometry();

  geometry.setAttribute("position", new BufferAttribute(mesh.positions, 3));
  geometry.setAttribute("uv", new BufferAttribute(mesh.uvs, 2));
  geometry.setIndex(new BufferAttribute(mesh.indices, 1));

  const texture = new DataTexture(mesh.pixels, columns, rows);

  // Цвета карты — готовые sRGB-байты, как у карты свечения: без пометки палитра
  // вышла бы блёклой. Сетка карты грубее панели на экране, поэтому фильтр
  // линейный: иначе карта рассыпается на клетки.
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;

  return { geometry, texture };
}

type LithophaneBacklightProps = {
  /** Расчёт по текущим параметрам: где лампы и как ложится свет. */
  plan: LithoLightPlan;
  /** Показана карта света: панель красится по ровности, у ламп видны колбы. */
  heatMap: boolean;
  /** Толщина плиты по максимуму, мм: на неё карта выносится вперёд рельефа. */
  thickness: number;
};

/**
 * Свет по расчёту: у ленты это линия точек по каналу, у лампы и свечи — одна.
 *
 * Лампы берутся из `plan.lights`: у LED-панели короба расчёт идёт по густой сетке
 * точек, а в кадре стоят двенадцать ламп той же суммарной силы — сто семнадцать
 * источников слепили бы сцену и стоили бы кадра.
 *
 * Расчёт отвечает в люксах, а студия живёт в условных единицах, поэтому канделы
 * умножаются на множитель, при котором средняя освещённость панели совпадает с
 * `STUDIO_BACKLIGHT.illuminance`: включённая подсветка не пересвечивает кадр, но
 * сохраняет перепад низа и верха. Множитель 1e6 переводит метры в миллиметры:
 * затухание в three физическое (`decay = 2`), а сцена построена в миллиметрах.
 *
 * Карта света — отладочный слой поверх панели. Заодно она показывает колбы: сами
 * источники в кадре не видны, и без шариков непонятно, откуда взялось пятно.
 */
function LithophaneBacklight({
  heatMap,
  plan,
  thickness,
}: LithophaneBacklightProps) {
  const scale =
    plan.average > 0 ? (STUDIO_BACKLIGHT.illuminance / plan.average) * 1e6 : 0;

  const layers = useMemo(
    () =>
      heatMap
        ? plan.faces.map((face, index) =>
            createHeatLayer(
              face,
              plan.maps[index] ?? [],
              plan.columns,
              plan.rows,
              plan.average,
              thickness + HEAT_MAP_LIFT_MM,
            ),
          )
        : [],
    [heatMap, plan, thickness],
  );

  useEffect(
    () => () => {
      for (const layer of layers) {
        layer.geometry.dispose();
        layer.texture.dispose();
      }
    },
    [layers],
  );

  return (
    <>
      {plan.lights.map((emitter, index) => (
        <pointLight
          color={STUDIO_BACKLIGHT.color}
          decay={2}
          intensity={emitter.intensity * scale}
          key={`lamp-${index}`}
          position={[
            emitter.position[0],
            emitter.position[1],
            emitter.position[2],
          ]}
        />
      ))}

      {heatMap
        ? plan.lights.map((emitter, index) => (
            <mesh
              key={`bulb-${index}`}
              position={[
                emitter.position[0],
                emitter.position[1],
                emitter.position[2],
              ]}
            >
              <sphereGeometry args={[1.2, 12, 12]} />
              <meshBasicMaterial
                color={STUDIO_BACKLIGHT.color}
                toneMapped={false}
              />
            </mesh>
          ))
        : null}

      {layers.map((layer, index) => (
        <mesh geometry={layer.geometry} key={`heat-${index}`} renderOrder={2}>
          <meshBasicMaterial
            depthWrite={false}
            map={layer.texture}
            opacity={0.85}
            side={DoubleSide}
            toneMapped={false}
            transparent
          />
        </mesh>
      ))}
    </>
  );
}

type SignModelProps = {
  geometry: BufferGeometry;
};

/**
 * Вывеска собирается из блоков: в каждом полые буквы на общей плите, а плиты
 * соседей стыкуются шипом и пазом. Геометрия построена в плоскости XY, поэтому
 * поворот не нужен — так же детали ложатся в STL.
 */
function SignModel({ geometry }: SignModelProps) {
  return (
    <mesh castShadow geometry={geometry} receiveShadow>
      <meshStandardMaterial
        color={STUDIO_MODEL_TINTS.sign}
        metalness={STUDIO_PLASTIC.metalness}
        roughness={STUDIO_PLASTIC.roughness}
      />
    </mesh>
  );
}

/**
 * Окружение студии: программный PMREM вместо HDR-карты с CDN.
 *
 * Керамика без окружения выглядит пластилином: один матовый блик от
 * направленного света ничего не рассказывает о форме. Софтбоксы в виртуальной
 * сцене дают отражения, по которым читается изгиб вазы, и не требуют ни файла
 * HDR, ни сети.
 *
 * Сцена собирается один раз: `PMREMGenerator` сворачивает панели в карту
 * освещённости, дальше three берёт её через `scene.environment`. Интенсивность
 * маленькая (0.22), потому что окружение здесь добавка к ключевому свету, а не
 * замена: сильнее оно поднимает тени и модель становится плоской.
 */
function StudioEnvironment() {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);

  useEffect(() => {
    const virtual = new ThreeScene();
    virtual.background = new Color(STUDIO_ENVIRONMENT.background);

    // Панели берутся из общего описания студии: те же числа разворачивает в
    // отражения растеризатор превью, поэтому галерея не разъезжается со сценой.
    const panels = STUDIO_ENVIRONMENT.panels.map((panel) => {
      const mesh = new Mesh(
        new PlaneGeometry(panel.size[0], panel.size[1]),
        new MeshBasicMaterial({
          color: new Color(panel.color).multiplyScalar(panel.power),
          side: DoubleSide,
        }),
      );

      mesh.position.set(
        panel.position[0],
        panel.position[1],
        panel.position[2],
      );
      // Панель смотрит в центр студии: так её блик попадает на модель.
      mesh.lookAt(0, 0, 0);
      virtual.add(mesh);

      return mesh;
    });

    const generator = new PMREMGenerator(gl);
    const target = generator.fromScene(virtual, 0.04, 0.1, 100);
    generator.dispose();

    scene.environment = target.texture;
    scene.environmentIntensity = STUDIO_ENVIRONMENT.intensity;

    return () => {
      scene.environment = null;
      scene.environmentIntensity = 1;
      target.dispose();
      virtual.background = null;

      for (const panel of panels) {
        panel.geometry.dispose();
        panel.material.dispose();
      }
    };
  }, [gl, scene]);

  return null;
}

type StudioLightProps = {
  /** Радиус студии в миллиметрах. */
  span: number;
  /** Множитель мощности: в режиме подсветки студия гасится. */
  dim?: number;
};

/**
 * Студийный свет без внешних HDR: сцена должна работать без обращений к CDN.
 *
 * Тень отбрасывает только ключевой источник — вторая тень от заполняющего
 * выглядела бы грязью под моделью. Ключ тёплый (`#fff4e6`), заполняющий и
 * контровой холодные: тёплый свет на керамике читается как предметная съёмка,
 * а холодная кромка отделяет деталь от тёмного фона. Контровой стоит за
 * моделью и рисует светлую границу силуэта там, где Fresnel-обводка показала
 * бы край.
 *
 * Суммарная мощность источников невелика, хотя ключ яркий: экспозиция рендера
 * 0.92 и программное окружение (`StudioEnvironment`) добавляют света немного.
 * Если поднять заполняющий и полусферу, керамика уходит в белое и форма
 * пропадает; на стенде .fonttmp разброс яркости внутри силуэта падал с 35 до
 * 23 при том же среднем уровне.
 *
 * Мягкость тени даёт `shadow-radius`: в three r186 встроенный PCF-фильтр
 * сэмплирует карту с шагом радиуса, поэтому край тени размывается, а не
 * повторяет лесенку текселя. Карта 1024 на охвате 440 мм — это 0.43 мм на
 * тексель, и радиус 16 размывает край тени примерно на семь миллиметров: на
 * вазе это мягкая студийная тень, а карта вдвое дешевле 2048 на телефоне.
 *
 * Ключ стоит сбоку (`1.45` по X), а не перед моделью: лобовой свет давал
 * ровный силуэт без светотени.
 *
 * `dim` — множитель для режима подсветки литофана: при полной мощности студии
 * собственное свечение пластика теряется в отражённом свете, и просвет не
 * читается.
 */
function StudioLights({ dim = 1, span }: StudioLightProps) {
  return (
    <>
      {/* Верхний рассеянный: холодное небо сверху, тёмный стол снизу. */}
      <hemisphereLight
        args={[
          STUDIO_LIGHTS.hemisphere.sky,
          STUDIO_LIGHTS.hemisphere.ground,
          STUDIO_LIGHTS.hemisphere.intensity * dim,
        ]}
      />
      {/* Ключевой: единственный источник тени. */}
      <directionalLight
        castShadow
        color={STUDIO_LIGHTS.key.color}
        intensity={STUDIO_LIGHTS.key.intensity * dim}
        position={[
          span * STUDIO_LIGHTS.key.position[0],
          span * STUDIO_LIGHTS.key.position[1],
          span * STUDIO_LIGHTS.key.position[2],
        ]}
        shadow-bias={STUDIO_LIGHTS.key.bias}
        shadow-camera-bottom={-span}
        shadow-camera-far={span * 6}
        shadow-camera-left={-span}
        shadow-camera-right={span}
        shadow-camera-top={span}
        shadow-mapSize-height={STUDIO_LIGHTS.key.mapSize}
        shadow-mapSize-width={STUDIO_LIGHTS.key.mapSize}
        shadow-normalBias={STUDIO_LIGHTS.key.normalBias}
        shadow-radius={STUDIO_LIGHTS.key.radius}
      />
      {/* Заполняющий: мягкий, с противоположной стороны, без тени. */}
      <directionalLight
        color={STUDIO_LIGHTS.fill.color}
        intensity={STUDIO_LIGHTS.fill.intensity * dim}
        position={[
          span * STUDIO_LIGHTS.fill.position[0],
          span * STUDIO_LIGHTS.fill.position[1],
          span * STUDIO_LIGHTS.fill.position[2],
        ]}
      />
      {/* Контровой: кромка силуэта, стоит за моделью. */}
      <directionalLight
        color={STUDIO_LIGHTS.rim.color}
        intensity={STUDIO_LIGHTS.rim.intensity * dim}
        position={[
          span * STUDIO_LIGHTS.rim.position[0],
          span * STUDIO_LIGHTS.rim.position[1],
          span * STUDIO_LIGHTS.rim.position[2],
        ]}
      />
    </>
  );
}

type StudioFloorProps = {
  /** Наибольший горизонтальный размер модели, мм. */
  footprint: number;
};

/**
 * Радиальный градиент 64 × 64 для `alphaMap`: единица в центре, ноль к краю.
 *
 * Одна текстура обслуживает два пятна на полу: тёмное под моделью (контакт) и
 * светлое вокруг (свет софтбокса на столе). 16 КБ в памяти, без картинки в
 * бандле и без canvas.
 */
function useRadialGradient() {
  const texture = useMemo(() => {
    const size = 64;
    const data = new Uint8Array(size * size * 4);

    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const dx = ((x + 0.5) / size) * 2 - 1;
        const dy = ((y + 0.5) / size) * 2 - 1;
        const distance = Math.min(1, Math.hypot(dx, dy));
        // Квадрат затухания: середина плотная, край мягкий.
        const value = Math.round((1 - distance) ** 2 * 255);
        const offset = (y * size + x) * 4;

        data[offset] = value;
        data[offset + 1] = value;
        data[offset + 2] = value;
        data[offset + 3] = 255;
      }
    }

    const created = new DataTexture(data, size, size);
    created.needsUpdate = true;

    return created;
  }, []);

  useEffect(() => () => texture.dispose(), [texture]);

  return texture;
}

/**
 * Бесконечный стол: три плоскости, видимые только там, где темнеет или светлеет.
 *
 * `shadowMaterial` рисует тень от ключевого света, тёмное пятно под деталью
 * прижимает её к плоскости, а слабое светлое пятно вокруг изображает свет
 * софтбокса на столе: без него низ кадра остаётся пустым чёрным полем. Сами
 * плоскости прозрачны, поэтому край стола не виден и модель стоит над
 * градиентом, как на студийном снимке.
 *
 * Сетка-помощник убрана — она давала вид чертежа, а не редактора. Тень лежит на
 * полмиллиметра ниже нуля, чтобы не спорить с нижними гранями лежащих моделей:
 * у брелока и литофана низ идёт ровно по y = 0.
 */
function StudioFloor({ footprint }: StudioFloorProps) {
  const size = Math.max(footprint * 16, 6000);
  const gradient = useRadialGradient();
  const contact = footprint * STUDIO_FLOOR.contactScale;
  const pool = footprint * STUDIO_FLOOR.poolScale;

  return (
    <group>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
        <planeGeometry args={[size, size]} />
        <shadowMaterial
          color={STUDIO_FLOOR.shadowColor}
          opacity={STUDIO_FLOOR.shadowOpacity}
          transparent
        />
      </mesh>
      {/* Свет софтбокса на столе: ниже пятна контакта и мягче его. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.45, 0]}>
        <planeGeometry args={[pool, pool]} />
        <meshBasicMaterial
          alphaMap={gradient}
          color={STUDIO_FLOOR.poolColor}
          depthWrite={false}
          opacity={STUDIO_FLOOR.poolOpacity}
          transparent
        />
      </mesh>
      {/* Пятно контакта выше тени: деталь не парит над столом. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.4, 0]}>
        <planeGeometry args={[contact, contact]} />
        <meshBasicMaterial
          alphaMap={gradient}
          color={STUDIO_FLOOR.contactColor}
          depthWrite={false}
          opacity={STUDIO_FLOOR.contactOpacity}
          transparent
        />
      </mesh>
    </group>
  );
}

type SceneProps = {
  params: ConstructorParams;
  geometry: BufferGeometry;
  framing: Framing;
  /** Показан оборот брелока: сцена переворачивает пластину лицом вниз. */
  keychainBack: boolean;
  /** Включена подсветка литофана: лампа за панелью и просвет в пластике. */
  backlight: boolean;
  /** Показана карта света: панель красится по ровности освещения. */
  heatMap: boolean;
  /** Уменьшенная сетка яркости литофана: из неё собирается карта свечения. */
  lithophaneGlow: LithophaneBrightnessGrid | null;
  /**
   * Кадры граней калейдоскопа для подсветки: у призмы своя текстура на грань.
   *
   * `null` — у панели один кадр, и хватает `lithophaneGlow`.
   */
  lithophaneFaces: LithophaneBrightnessGrid[] | null;
  /** Расчёт света: где стоят лампы и как они освещают панель. */
  lithophaneLight: LithoLightPlan | null;
};

function Scene({
  backlight,
  framing,
  geometry,
  heatMap,
  keychainBack,
  lithophaneFaces,
  lithophaneGlow,
  lithophaneLight,
  params,
}: SceneProps) {
  // Радиус студии считается по габаритам модели: свет и карта теней должны
  // покрывать её целиком при любой высоте и ширине.
  const span = studioSpan(framing.height, framing.footprint);

  /*
    Подсветка есть только у литофана: остальные модели печатают плотными, и
    лампа за ними ничего не проявляет. Где стоят лампы, решает расчёт: у ленты
    это линия точек по каналу, у патрона E27 и USB-лампы — одна точка в гнезде.
    Карта света без подсветки не читается, поэтому включается вместе с ней.
  */
  const backlightOn =
    (backlight || heatMap) && params.model === "lithophane";

  /*
    Запасной свет для сборки без источника: у литофана без рамки, на ножке или с
    «без подсветки» лампу ставить некуда, а посмотреть деталь на просвет всё
    равно хочется — она и стоит за панелью, как окно. Затухание у точечного
    источника физическое, поэтому интенсивность пересчитывается из освещённости
    и расстояния (сцена живёт в миллиметрах).
  */
  const lampDistance = span * STUDIO_BACKLIGHT.distance;

  /*
    Габариты плиты: карта свечения строится под их пропорции, а не под кадр. У
    плафона плита — одна изогнутая панель, поэтому в расчёт входят форма и число
    панелей. Зависимости — только габариты: массив яркости сюда не входит,
    поэтому движение слайдера толщин не пересобирает текстуру.
  */
  const lithophanePlate = useMemo(
    () =>
      params.model === "lithophane"
        ? lithophanePlateSize({
            lithophaneWidth: params.lithophaneWidth,
            lithophaneHeight: params.lithophaneHeight,
            lithophaneMaxThickness: params.lithophaneMaxThickness,
            lithoFrame: params.lithoFrame,
            lithoShape: params.lithoShape,
            lithophanePanels: params.lithophanePanels,
          })
        : null,
    [
      params.model,
      params.lithophaneWidth,
      params.lithophaneHeight,
      params.lithophaneMaxThickness,
      params.lithoFrame,
      params.lithoShape,
      params.lithophanePanels,
    ],
  );

  /*
    Дуга переворота: в полпути пластина стоит на ребре, и подъём должен вынести
    над столом её половину (половину большего габарита), толщину и рельефы.
  */
  const keychainLift = framing.footprint / 2 + framing.height * 2 + 4;

  return (
    <>
      {/*
        Окружение и свет: софтбоксы дают отражения, направленный свет — тень.
        Фон прозрачный, тёмный градиент задаёт обёртка viewport в CSS.
      */}
      <StudioEnvironment />
      <StudioLights
        dim={backlightOn ? STUDIO_BACKLIGHT.studioDim : 1}
        span={span}
      />

      {backlightOn ? (
        lithophaneLight ? (
          <LithophaneBacklight
            heatMap={heatMap}
            plan={lithophaneLight}
            thickness={params.lithophaneMaxThickness}
          />
        ) : (
          /*
            Плана нет — значит, ленту или лампу в этой сборке не ставят. Тогда за
            панелью стоит общий свет, как окно: смотреть деталь на просвет можно,
            но к конкретному креплению он не относится. У плафона лампа встаёт на
            его ось, внутрь пустой камеры, — так светятся все панели сразу. Тень он
            не отбрасывает: у подсветки рассеянный свет, и вторая карта теней
            только удорожала бы кадр.
          */
          <pointLight
            color={STUDIO_BACKLIGHT.color}
            decay={2}
            intensity={STUDIO_BACKLIGHT.illuminance * lampDistance * lampDistance}
            position={
              params.lithoShape === "round"
                ? [0, framing.height * 0.5, 0]
                : [0, framing.height * 0.55, -lampDistance]
            }
          />
        )
      ) : null}

      {params.model === "vase" ? (
        <VaseModel
          faceted={
            resolveSectionSides(params.shape, params.sectionSides) >=
            VASE_SECTION_MIN_SIDES
          }
          geometry={geometry}
        />
      ) : params.model === "keychain" ? (
        <KeychainModel
          back={keychainBack}
          geometry={geometry}
          lift={keychainLift}
          thickness={params.thickness}
        />
      ) : params.model === "stand" ? (
        <StandModel geometry={geometry} />
      ) : params.model === "box" ? (
        <BoxModel geometry={geometry} />
      ) : params.model === "lithophane" ? (
        <LithophaneModel
          backlight={backlightOn}
          faceted={params.lithoShape === "flat"}
          faces={lithophaneFaces}
          geometry={geometry}
          glow={lithophaneGlow}
          plate={lithophanePlate}
        />
      ) : params.model === "planter" ? (
        <ZUpModel color={STUDIO_MODEL_TINTS.planter} geometry={geometry} />
      ) : params.model === "coaster" ? (
        <ZUpModel color={STUDIO_MODEL_TINTS.coaster} geometry={geometry} />
      ) : params.model === "jewelry_stand" ? (
        <ZUpModel color={STUDIO_MODEL_TINTS.jewelry_stand} geometry={geometry} />
      ) : params.model === "pen_holder" ? (
        <ZUpModel color={STUDIO_MODEL_TINTS.pen_holder} geometry={geometry} />
      ) : params.model === "heat_transfer" ? (
        <ZUpModel color={STUDIO_MODEL_TINTS.heat_transfer} geometry={geometry} />
      ) : (
        <SignModel geometry={geometry} />
      )}

      {/* Стол под моделью: принимает тень от ключевого света. */}
      <StudioFloor footprint={framing.footprint} />

      <CameraRig
        flat={framing.flat}
        footprint={framing.footprint}
        height={framing.height}
      />

      {/*
        zoomToCursor — колесо приближает к точке под курсором, а не к центру
        кадра: на длинной вывеске иначе приходится приближать, а потом искать
        деталь заново. Damping с инерцией гасит рывки вращения, поэтому сцена
        крутится плавно.
      */}
      <OrbitControls
        dampingFactor={0.08}
        enableDamping
        enablePan={false}
        makeDefault
        maxDistance={2400}
        maxPolarAngle={Math.PI / 2 - 0.08}
        minDistance={60}
        minPolarAngle={0.15}
        rotateSpeed={0.8}
        zoomSpeed={0.8}
        zoomToCursor
      />
    </>
  );
}

/**
 * 3D-предпросмотр модели.
 *
 * Компонент подключается через next/dynamic с ssr: false: WebGL существует
 * только в браузере, и серверный рендер three.js не нужен. Обёртка задаёт
 * высоту сцены, поэтому Canvas не схлопывается до нуля и не растягивает
 * страницу по горизонтали.
 */
export function Viewport({
  debugLight = false,
  fullscreen = false,
  onKeychainImageReport,
  params,
}: ViewportProps) {
  /**
   * Приёмник отчёта о картинке. Живёт в ref, а не в состоянии: числа пишет
   * сборка геометрии, а показывать их панель будет после коммита — иначе
   * setState из useMemo пересобирал бы сцену на каждом рендере.
   */
  const keychainReport = useRef<KeychainBuildReport>({ decorations: [] });

  /**
   * Какая сторона брелока показана.
   *
   * Рельефы оборота стоят под пластиной и с лица не видны, поэтому у сцены есть
   * переключатель: он переворачивает деталь и показывает оборот так же, как её
   * увидит владелец. Для остальных моделей состояние не нужно — оно сбрасывается
   * при смене модели, чтобы возврат к брелоку начинался с лица.
   */
  const [keychainBack, setKeychainBack] = useState(false);

  /**
   * Показан ли литофан на просвет.
   *
   * По умолчанию выключено: подсветка — это проверка результата, а не рабочий
   * вид сцены. Включённая подсветка ставит лампу за панелью, гасит студию и
   * делает пластик полупрозрачным, поэтому кадр дороже: `transmission` требует
   * дополнительного прохода рендера. Режим не живёт дольше модели — при смене
   * детали он сбрасывается, как и сторона брелока.
   */
  const [lithophaneBacklight, setLithophaneBacklight] = useState(false);

  /**
   * Показана ли карта света: отладочный слой по ровности освещения.
   *
   * Карта отвечает на вопрос «где будет пятно»: панель красится от синего к
   * красному по отношению к средней, а на месте ламп появляются колбы. Режим
   * включает подсветку — на тёмной панели карту не прочитать, — но сам
   * выключается вместе с моделью, как и подсветка.
   */
  const [lithophaneHeatMap, setLithophaneHeatMap] = useState(false);

  /*
    Слой показывается только по адресу `?debug=light`: в обычном сеансе кнопки нет,
    и карта не должна всплыть даже из прошлого состояния — поэтому флаг проверяется
    ещё раз там, где карта попадает в сцену, легенду и подпись для скринридера.
  */
  const heatMap = lithophaneHeatMap && debugLight;

  /**
   * Светотехнический расчёт по параметрам: лампы, карта и предупреждения.
   *
   * Считается здесь, а не в сцене, потому что тех же чисел ждут панель и
   * подпись под канвасом. Функция чистая и на панели 120 × 80 считает карту за
   * доли миллисекунды, поэтому лишний пересчёт на движение слайдера дешевле
   * лишней синхронизации состояния.
   */
  const lithophaneLight = useMemo(
    () => (params.model === "lithophane" ? lithophaneLightPlan(params) : null),
    [params],
  );

  /**
   * Легенда карты света: та же палитра, что у слоя в сцене.
   *
   * Градиент собирается из `lithophaneHeatColor`, поэтому подпись не разойдётся
   * с картой: поменяется палитра — поменяется и полоска.
   */
  const heatLegend = useMemo(() => {
    const stops = [0.25, 0.6, 0.85, 1, 1.3, 1.8, 2.5];
    const colors = stops.map((ratio) => {
      const [red, green, blue] = lithophaneHeatColor(ratio);

      return `rgb(${Math.round(red * 255)} ${Math.round(green * 255)} ${Math.round(blue * 255)})`;
    });

    return `linear-gradient(90deg, ${colors.join(", ")})`;
  }, []);

  /**
   * Панель двигает сторону декораций, а сцена следует за ней: выбрал «Оборот» —
   * пластина перевернулась, и видно, куда встал рельеф. Реагируем только на
   * смену значения у уже существующей декорации: первая сборка проекта и выбор
   * «Авто» взгляд не трогают.
   */
  const decorationSides = useRef(new Map<string, string>());
  useEffect(() => {
    const next = new Map<string, string>(
      params.model === "keychain"
        ? (params.decorations ?? []).map(
            (item) => [item.id, item.side] as const,
          )
        : [],
    );
    let back = false;
    let front = false;

    for (const [id, side] of next) {
      const previous = decorationSides.current.get(id);

      if (previous === undefined || previous === side) {
        continue;
      }

      if (side === "back") {
        back = true;
      } else if (side === "front") {
        front = true;
      }
    }

    decorationSides.current = next;

    if (back) {
      setKeychainBack(true);
    } else if (front) {
      setKeychainBack(false);
    }
  }, [params.model, params.decorations]);

  // Смена модели возвращает лицо: у вазы и подставки оборота нет, а вернувшись к
  // брелоку, пользователь ждёт тот же вид, что и при первом открытии.
  useEffect(() => {
    if (params.model !== "keychain") {
      setKeychainBack(false);
    }
  }, [params.model]);

  /*
    Подсветка и карта света — режимы просмотра одной детали. Ушёл на другую
    модель — режимы сброшены: возвращаясь к литофану, пользователь видит обычную
    студию, а не забытую лампу за панелью.
  */
  useEffect(() => {
    if (params.model !== "lithophane") {
      setLithophaneBacklight(false);
      setLithophaneHeatMap(false);
    }
  }, [params.model]);

  /*
    Карту не на что накладывать, если источник убрали: «без подсветки», ножка или
    массивная база. Тогда режим гаснет сам — иначе остался бы включённым флаг
    без слоя, и кнопка вернулась бы уже нажатой.
  */
  useEffect(() => {
    if (!lithophaneLight) {
      setLithophaneHeatMap(false);
    }
  }, [lithophaneLight]);

  /**
   * Какие шрифты нужны модели.
   *
   * Вывеска подписывается одним набором из `signFont`, брелок — тем, что выбрано в
   * его текстовых декорациях: у надписи может быть PT Serif, а у второй надписи
   * Roboto. Ключ — имя набора, путь — файл: и то и другое берётся из реестра
   * `KEYCHAIN_FONTS`, поэтому панель, сцена и сервер не расходятся.
   */
  const fontRequests = useMemo(() => {
    if (params.model === "sign") {
      return [{ id: params.signFont, url: SIGN_FONT_URLS[params.signFont] }];
    }

    if (params.model === "keychain") {
      return keychainDecorationFonts(params.decorations).map((font) => ({
        id: font,
        url: keychainFontUrl(font),
      }));
    }

    return [];
  }, [params.model, params.signFont, params.decorations]);
  const fontSignature = fontRequests
    .map((request) => `${request.id}|${request.url}`)
    .join(",");
  /**
   * Загруженные шрифты помнят свой набор. Пока новый файл не пришёл, сцена
   * показывает прежние буквы, а не пустоту: переключение шрифта не мигает.
   */
  const [loaded, setLoaded] = useState<{
    fonts: Partial<Record<KeychainFontId, Font>>;
    signature: string;
  } | null>(null);
  const [fontFailed, setFontFailed] = useState(false);
  const fonts = loaded?.fonts ?? null;
  const font =
    params.model === "sign" ? (fonts?.[params.signFont] ?? null) : null;
  /** Плашка «Загружаем шрифт…»: она нужна, пока хоть один набор не пришёл. */
  const needsFont = fontRequests.length > 0;
  const fontsReady =
    fonts !== null &&
    fontRequests.every((request) => fonts[request.id as KeychainFontId]);

  /**
   * Шрифт грузим только при открытии брелока или вывески: вазе и подставке он
   * не нужен, а лишние 130–350 КБ JSON незачем тянуть на первый экран.
   * После загрузки состояние живёт до перезагрузки страницы, поэтому повторное
   * переключение вкладки не делает новый запрос.
   */
  useEffect(() => {
    if (!fontSignature || loaded?.signature === fontSignature) {
      return;
    }

    let active = true;
    const loader = new FontLoader();
    const requests = fontSignature.split(",").map((entry) => {
      const [id, url] = entry.split("|");

      return { id, url };
    });

    setFontFailed(false);
    Promise.all(
      requests.map((request) =>
        loader
          .loadAsync(request.url)
          .then((loadedFont) => [request.id, loadedFont] as const),
      ),
    )
      .then((pairs) => {
        if (active) {
          setLoaded({ fonts: Object.fromEntries(pairs), signature: fontSignature });
          setFontFailed(false);
        }
      })
      .catch(() => {
        if (active) {
          setFontFailed(true);
        }
      });

    return () => {
      active = false;
    };
  }, [fontSignature, loaded]);

  /**
   * Предпросмотр литофана получает уменьшенную копию сетки яркости: полные
   * 400 × 267 заставляют three.js пересобирать десятки тысяч вершин на каждое
   * движение слайдера. Копия считается только при замене картинки — ссылка на
   * массив в состоянии не меняется от правки толщин, поэтому useMemo не
   * пересчитывает усреднение на каждый кадр. Пропорции копии те же, что у
   * источника: сжимается длинная сторона, короткая — во столько же раз.
   */
  const lithophaneBrightness =
    params.model === "lithophane" ? params.lithophaneBrightness : null;
  const lithophaneBrightnessWidth =
    params.model === "lithophane" ? params.lithophaneBrightnessWidth : 0;
  const lithophaneBrightnessHeight =
    params.model === "lithophane" ? params.lithophaneBrightnessHeight : 0;
  const lithophanePreview = useMemo(
    () =>
      lithophaneBrightness
        ? downsampleLithophaneBrightness(
            lithophaneBrightness,
            lithophaneBrightnessWidth,
            lithophaneBrightnessHeight,
            LITHOPHANE_PREVIEW_RESOLUTION,
          )
        : null,
    [
      lithophaneBrightness,
      lithophaneBrightnessWidth,
      lithophaneBrightnessHeight,
    ],
  );

  /**
   * Кадры остальных граней калейдоскопа — тоже уменьшенные.
   *
   * Уменьшение то же, что у основной сетки: полные 400 × 267 на четыре грани
   * заставляли бы three.js пересобирать сотни тысяч вершин на каждое движение
   * слайдера. Ссылка на массив слотов в состоянии не меняется от правки толщин,
   * поэтому усреднение считается только при замене фото.
   */
  const lithophaneSides =
    params.model === "lithophane" ? params.lithophaneSideBrightness : null;
  const lithophaneSidePreview = useMemo(
    () =>
      lithophaneSides
        ? lithophaneSides.map((slot) =>
            slot
              ? downsampleLithophaneBrightness(
                  slot.brightness,
                  slot.width,
                  slot.height,
                  LITHOPHANE_PREVIEW_RESOLUTION,
                )
              : null,
          )
        : [],
    [lithophaneSides],
  );

  /**
   * Кадры панелей: основа и слоты остальных панелей.
   *
   * Пустой слот повторяет предыдущую панель — ровно как в
   * `lithophaneFaceBrightness` при построении геометрии. Поэтому рельеф и
   * текстура на каждой панели совпадают: в предпросмотре видно то же фото, что
   * напечатается.
   */
  /**
   * Сколько панелей у формы: по нему собираются карты панелей и группы сетки.
   */
  const lithophanePanels =
    params.model === "lithophane" ? lithophanePanelCount(params) : 0;

  const lithophaneFaces = useMemo(() => {
    if (
      params.model !== "lithophane" ||
      lithophaneShapeHasFrame(params.lithoShape)
    ) {
      return null;
    }

    if (!lithophanePreview) {
      return null;
    }

    const sides = lithophaneSidePreview ?? [];
    const frames = [lithophanePreview];

    for (let index = 1; index < lithophanePanels; index += 1) {
      frames.push(sides[index - 1] ?? frames[index - 1]);
    }

    return frames;
  }, [
    lithophanePreview,
    lithophaneSidePreview,
    lithophanePanels,
    params.lithoShape,
    params.model,
  ]);

  /**
   * Профиль и сетка пересчитываются только при изменении параметров или
   * загрузке шрифта. Смена камеры, света или материала не создаёт новую
   * геометрию. Пока шрифт не пришёл, брелок показывается без имени, а
   * вывеска — без букв: пустая сетка честнее случайной надписи.
   */
  const geometry = useMemo(() => {
    // Отчёт прошлой сборки не должен переживать смену модели: брелок в сцене
    // остался один, и чужие числа декораций панели не нужны.
    keychainReport.current = { decorations: [] };

    if (params.model === "keychain") {
      return createKeychainGeometry(params, fonts, keychainReport.current);
    }

    if (params.model === "stand") {
      return createStandGeometry(params);
    }

    if (params.model === "sign") {
      return createSignGeometry(params, font);
    }

    if (params.model === "box") {
      return createBoxGeometry(params);
    }

    if (params.model === "lithophane") {
      // В сцену уходит уменьшенная копия, а в запрос STL — полный массив из
      // состояния: предпросмотр быстрый, печать подробная. Размеры копии
      // подменяются вместе с массивом, иначе нормализация не сойдётся с длиной.
      // Кадры остальных граней калейдоскопа уменьшаются так же: пустой слот
      // остаётся пустым и повторяет предыдущую грань.
      return createLithophaneGeometry(
        lithophanePreview
          ? {
              ...params,
              lithophaneBrightness: lithophanePreview.brightness,
              lithophaneBrightnessWidth: lithophanePreview.width,
              lithophaneBrightnessHeight: lithophanePreview.height,
              lithophaneSideBrightness: lithophaneSidePreview,
            }
          : params,
      );
    }

    if (params.model === "planter") {
      return createPlanterGeometry(params);
    }

    if (params.model === "coaster") {
      return createCoasterGeometry(params);
    }

    if (params.model === "jewelry_stand") {
      return createJewelryStandGeometry(params);
    }

    if (params.model === "pen_holder") {
      return createPenHolderGeometry(params);
    }

    if (params.model === "heat_transfer") {
      // Без логотипа у модели нет формы: пустая сетка оставляет сцену, но не
      // роняет предпросмотр исключением из геометрии.
      return params.heatTransferSvg
        ? createHeatTransferGeometry(params)
        : new BufferGeometry();
    }

    // Предпросмотр считает бюджет треугольников по-своему (120 000): модель
    // крутится в браузере, а рельеф высокой частоты поднимает разрешение.
    return createVaseGeometry(createVaseProfile(params), params, {
      budget: "preview",
    });
  }, [font, fonts, lithophanePreview, lithophaneSidePreview, params]);

  // Старая сетка живёт в GPU-буфере: без dispose каждая правка слайдера
  // оставляла бы мусор до перезагрузки страницы.
  useEffect(() => () => geometry.dispose(), [geometry]);

  /**
   * Отчёт о картинке уходит наверх после коммита — когда сетка уже собрана.
   *
   * Зависимость — сама сетка: любая правка, меняющая геометрию, пересчитывает и
   * размещение логотипа, а правка камеры или света сетку не трогает и лишнего
   * обновления не вызовет.
   */
  useEffect(() => {
    onKeychainImageReport?.(keychainReport.current);
  }, [geometry, onKeychainImageReport]);

  /**
   * Габариты для камеры и подписи. У вывески ширина и высота зависят от
   * надписи, у подставки — от наклона, у вазы — от наклона и органики, поэтому
   * здесь они берутся из готовой сетки. Остальные модели считаются по
   * параметрам: bounding box совпадает со слайдерами с точностью до амплитуды
   * узора.
   */
  const framing = useMemo<Framing>(() => {
    if (params.model === "vase") {
      // У наклонённой вазы кромка уходит в сторону (и органика гуляет по
      // окружности), поэтому ширина берётся из готовой сетки, а не из
      // параметра «диаметр»: иначе камера обрезала бы верх модели.
      geometry.computeBoundingBox();
      const box = geometry.boundingBox;
      const width = box ? box.max.x - box.min.x : params.diameter;
      const depth = box ? box.max.z - box.min.z : params.diameter;

      return {
        height: params.height,
        footprint: Math.max(width, depth, params.diameter),
        flat: false,
      };
    }

    if (params.model === "keychain") {
      return {
        height: params.thickness,
        footprint: Math.max(params.length, params.width),
        flat: true,
      };
    }

    if (
      params.model === "stand" ||
      params.model === "planter" ||
      params.model === "coaster" ||
      params.model === "jewelry_stand" ||
      params.model === "pen_holder" ||
      params.model === "heat_transfer"
    ) {
      geometry.computeBoundingBox();
      const box = geometry.boundingBox;

      // Подставка, кашпо, подставка под кружку, стойка украшений,
      // органайзер для ручек и термопринт построены Z-вверх: после поворота
      // меша высотой становится Z, а длиной и шириной — X и Y.
      return {
        height: box ? Math.max(box.max.z - box.min.z, 1) : 1,
        footprint: box
          ? Math.max(box.max.x - box.min.x, box.max.y - box.min.y, 1)
          : 1,
        flat: false,
      };
    }

    if (params.model === "box") {
      geometry.computeBoundingBox();
      const box = geometry.boundingBox;

      // Геометрия коробки построена Z-вверх: после поворота меша высотой
      // становится Z, а длиной и шириной — X и Y.
      return {
        height: box ? Math.max(box.max.z - box.min.z, 1) : 1,
        footprint: box
          ? Math.max(box.max.x - box.min.x, box.max.y - box.min.y, 1)
          : 1,
        flat: false,
      };
    }

    if (params.model === "lithophane") {
      // С подставкой сборка наклонена и стоит на базе 6–9 мм, а у плафона и
      // призмы габарит по X не совпадает с шириной развёртки. В этих случаях
      // габарит берём из готовой сетки — камера не должна обрезать верх.
      if (
        params.lithoShape !== "flat" ||
        lithophaneHasStand(params.lithoMount)
      ) {
        geometry.computeBoundingBox();
        const box = geometry.boundingBox;

        return {
          height: box
            ? Math.max(box.max.y - box.min.y, 1)
            : params.lithophaneHeight,
          footprint: box
            ? Math.max(box.max.x - box.min.x, 1)
            : params.lithophaneWidth,
          flat: false,
        };
      }

      return {
        height: params.lithophaneHeight,
        footprint: params.lithophaneWidth,
        flat: false,
      };
    }

    geometry.computeBoundingBox();
    const box = geometry.boundingBox;

    return {
      height: box ? Math.max(box.max.y - box.min.y, 1) : 1,
      footprint: box ? Math.max(box.max.x - box.min.x, 1) : 1,
      flat: false,
    };
  }, [geometry, params]);

  // Вес в граммах для PLA: объём переводится в см³ и умножается на плотность
  // 1.24 г/см³. Округляем до десятых при выводе, как и остальные размеры.
  const materialWeightGrams = useMemo(
    () => calculateGeometryWeightGrams(geometry),
    [geometry],
  );

  const sizeLabel =
    params.model === "vase"
      ? `${params.height} × Ø ${params.diameter} мм`
      : params.model === "keychain"
        ? `${params.length} × ${params.width} × ${params.thickness} мм`
        : params.model === "stand"
          ? `${params.standWidth} × ${Math.round(framing.height)} мм`
          : params.model === "box"
            ? `${params.boxWidth} × ${params.boxDepth} × ${params.boxHeight} мм`
            : params.model === "lithophane"
              ? `${params.lithophaneWidth} × ${params.lithophaneHeight} × ${params.lithophaneMaxThickness.toFixed(1)} мм`
              : params.model === "planter"
                ? `${params.planterSize} × ${params.planterHeight} мм`
                : params.model === "coaster"
                  ? `${params.coasterSize} × ${params.coasterThickness} мм`
                  : params.model === "jewelry_stand"
                    ? params.jewelryPreset === "leaf_tray"
                      ? `${params.jewelryLeafLength} × ${params.jewelryLeafWidth} мм`
                      : params.jewelryPreset === "deer_bust"
                        ? `${params.deerBaseLength} × ${params.deerBaseWidth} × ${jewelryDeerHeightMm(params)} мм`
                        : `${params.treeBaseDiameter} × ${jewelryTreeHeightMm(params)} мм`
                    : params.model === "pen_holder"
                      ? `${params.penSize} × ${params.penHeight} мм`
                      : params.model === "heat_transfer"
                        ? `${params.heatTransferWidth} × ${params.heatTransferHeight} × ${heatTransferThickness(params.heatTransferLayers).toFixed(1)} мм`
                        : `${Math.round(framing.footprint)} × ${Math.round(framing.height)} мм`;

  const ariaLabel =
    params.model === "vase"
      ? `3D-предпросмотр вазы высотой ${params.height} миллиметров и диаметром ${params.diameter} миллиметров, узор «${vasePatternLabel(params.patterns)}»`
      : params.model === "keychain"
        ? `3D-предпросмотр брелока ${params.length} на ${params.width} миллиметров, форма «${keychainShapeLabel(params)}», имя «${
            keychainTextDecoration(params.decorations)?.content.trim() ||
            "без имени"
          }»${keychainBack ? ", показан оборот" : ", показано лицо"}`
        : params.model === "stand"
          ? `3D-предпросмотр подставки под телефон шириной ${params.standWidth} миллиметров, наклон ${params.standAngle} градусов, толщина телефона ${params.phoneThickness} миллиметров`
          : params.model === "box"
            ? `3D-предпросмотр коробки ${params.boxWidth} на ${params.boxDepth} на ${params.boxHeight} миллиметров, перегородки ${params.boxDividersX} и ${params.boxDividersY}, скругление углов ${params.boxCornerRadius} миллиметров, ${params.hasLid ? "с крышкой" : "без крышки"}${params.boxMagnets ? `, пазы под магниты ${BOX_MAGNET_SIZE_LABELS[params.boxMagnetSize]}` : ""}${params.boxStack ? ", кольцо для штабелирования" : ""}`
            : params.model === "lithophane"
              ? `3D-предпросмотр литофана ${params.lithophaneWidth} на ${params.lithophaneHeight} миллиметров, толщина рельефа от ${params.lithophaneMinThickness} до ${params.lithophaneMaxThickness} миллиметров, форма «${LITHOPHANE_SHAPE_LABELS[params.lithoShape]}»${lithophaneShapeHasFrame(params.lithoShape) ? `, ${params.lithoFrame ? "рамка" : "без рамки"}` : ""}${lithophaneBacklight ? ", включена подсветка на просвет" : ""}${heatMap ? ", включена карта света" : ""}`
              : params.model === "planter"
                ? `3D-предпросмотр кашпо «${PLANTER_SHAPE_LABELS[params.planterShape]}» ${params.planterSize} миллиметров по ключу и высотой ${params.planterHeight} миллиметров, стенка ${params.planterWall} миллиметров, ${params.planterDrainage ? "с дренажными отверстиями и поддоном" : "без поддона"}`
                : params.model === "coaster"
                  ? `3D-предпросмотр подставки под кружку ${params.coasterSize} миллиметров, толщина ${params.coasterThickness} миллиметров, узор «${COASTER_PATTERN_LABELS[params.coasterPattern]}», ${params.coasterRim ? "с бортиком" : "без бортика"}`
                  : params.model === "jewelry_stand"
                    ? params.jewelryPreset === "leaf_tray"
                      ? `3D-предпросмотр лотка для украшений «${JEWELRY_LEAF_TYPE_LABELS[params.jewelryLeafType]}» ${params.jewelryLeafLength} на ${params.jewelryLeafWidth} миллиметров, глубина прожилок ${params.jewelryLeafVeinDepth} миллиметра, горизонтальная плита с плоским дном и крючком для цепочек`
                      : params.jewelryPreset === "deer_bust"
                        ? `3D-предпросмотр бюста «Лесной олень» на овальной базе ${params.deerBaseLength} на ${params.deerBaseWidth} миллиметров, размах рогов ${params.deerAntlerSpread} миллиметров, высота ${jewelryDeerHeightMm(params)} миллиметров, полость под утяжелитель Ø 25 миллиметров`
                        : `3D-предпросмотр подставки «Плетёное древо» высотой ${jewelryTreeHeightMm(params)} миллиметров: чаша-лоток диаметром ${params.treeBaseDiameter} миллиметров, изогнутый ствол с ${params.treeBranchCount} ярусами ветвей, изгиб ветвей ${Math.round(params.treeTwist * 100)} процентов, крючки с бусинами и штыри под кольца`
                    : params.model === "pen_holder"
                      ? `3D-предпросмотр органайзера для ручек «${PEN_SHAPE_LABELS[params.penShape]}» ${params.penSize} миллиметров по ключу и высотой ${params.penHeight} миллиметров, стенка ${params.penWall} миллиметров, ${params.penSections} отделений`
                      : params.model === "heat_transfer"
                        ? `3D-предпросмотр термопринта ${params.heatTransferWidth} на ${params.heatTransferHeight} миллиметров, толщина ${heatTransferThickness(params.heatTransferLayers).toFixed(1)} миллиметра, ${params.heatTransferMirror ? "с зеркалом" : "без зеркала"}, ${params.heatTransferSvg ? "логотип загружен" : "логотип не загружен"}`
                        : `3D-предпросмотр вывески шириной ${Math.round(framing.footprint)} и высотой ${Math.round(framing.height)} миллиметров, надпись «${params.signText.trim() || "без надписи"}», канал ${params.signChannelWidth} миллиметров`;

  return (
    <>
      {/*
        Фон — радиальный градиент в тон сайту: центр сцены светлее краёв, как
        в тёмной студии. Канвас прозрачный (alpha), поэтому градиент живёт в
        CSS и не требует отдельной геометрии в three.js.
      */}
      <div
        className={
          fullscreen
            ? "relative min-h-0 w-full max-w-full flex-1 overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-black/50"
            : "relative h-[min(40vh,20rem)] w-full max-w-full overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-black/50 sm:h-[min(48vh,26rem)] lg:h-auto lg:min-h-[16rem] lg:flex-1"
        }
        style={{ backgroundImage: STUDIO_BACKGROUND_CSS }}
      >
        {/*
          Тени и цветопередача заданы на рендерере: PCF с мягким фильтром даёт
          размытый край тени (PCFSoftShadowMap в three r186 удалён, и рендерер
          сам откатывался к PCF с предупреждением в консоли), а ACES-тонмаппинг
          держит светлую керамику без пересвета. Экспозиция ниже единицы: при
          1.0 освещённая сторона вазы упиралась в белый и полутени исчезали.
        */}
        <Canvas
          aria-label={ariaLabel}
          camera={{ fov: 35, near: 1, far: 6000, position: [0, 180, 320] }}
          dpr={[1, 1.75]}
          fallback={
            <div className="flex h-full items-center justify-center p-6 text-center">
              <p className="max-w-sm text-sm leading-relaxed text-slate-300">
                Браузер не поддерживает WebGL, поэтому 3D-предпросмотр недоступен.
                Попробуйте открыть страницу в другом браузере.
              </p>
            </div>
          }
          gl={{
            alpha: true,
            antialias: true,
            toneMapping: ACESFilmicToneMapping,
            toneMappingExposure: STUDIO_EXPOSURE,
          }}
          shadows={{ enabled: true, type: PCFShadowMap }}
        >
          <Scene
            backlight={lithophaneBacklight}
            framing={framing}
            geometry={geometry}
            heatMap={heatMap}
            keychainBack={keychainBack}
            lithophaneFaces={lithophaneFaces}
            lithophaneGlow={lithophanePreview}
            lithophaneLight={lithophaneLight}
            params={params}
          />
        </Canvas>

        {/*
          Виньетка: края канваса уходят в тот же тон, что и фон страницы.
          Градиент держит взгляд в центре сцены и прячет стык канваса с
          обёрткой на светлых мониторах.
        */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ backgroundImage: STUDIO_VIGNETTE.css }}
        />

        {params.model === "keychain" ? (
          /*
            Переключатель сторон: обычные кнопки поверх канваса, а не часть
            сцены. Виньетка выше лежит с pointer-events-none, поэтому клики
            доходят до них.
          */
          <div
            aria-label="Сторона брелока"
            className="absolute top-3 left-3 flex items-center gap-1 rounded-full border border-white/10 bg-slate-950/70 p-1 text-xs font-medium text-slate-300 backdrop-blur"
            role="group"
          >
            {KEYCHAIN_VIEW_SIDES.map((side) => (
              <button
                aria-pressed={keychainBack === side.back}
                className={
                  keychainBack === side.back
                    ? "rounded-full bg-white/15 px-3 py-1 text-white"
                    : "rounded-full px-3 py-1 text-slate-400 transition hover:text-white"
                }
                key={side.label}
                onClick={() => setKeychainBack(side.back)}
                type="button"
              >
                {side.label}
              </button>
            ))}
          </div>
        ) : null}

        {params.model === "lithophane" ? (
          /*
            Подсветка на просвет и карта света: те же кнопки поверх канваса, что
            и переключатель сторон брелока. Подсветка ставит лампы за панелью,
            гасит студию и делает рельеф полупрозрачным — видно, как деталь будет
            выглядеть у окна. Карта света красит панель по ровности освещения: от
            синего (темно) к красному (пересвет), с колбами на месте ламп.
          */
          <div
            aria-label="Подсветка литофана"
            className="absolute top-3 left-3 flex items-center gap-1 rounded-full border border-white/10 bg-slate-950/70 p-1 text-xs font-medium text-slate-300 backdrop-blur"
            role="group"
          >
            <button
              aria-label="Подсветка (на просвет)"
              aria-pressed={lithophaneBacklight}
              className={
                lithophaneBacklight
                  ? "rounded-full bg-white/15 px-3 py-1 text-white"
                  : "rounded-full px-3 py-1 text-slate-400 transition hover:text-white"
              }
              onClick={() => setLithophaneBacklight((current) => !current)}
              type="button"
            >
              Подсветка
            </button>
            {lithophaneLight && debugLight ? (
              <button
                aria-label="Карта света"
                aria-pressed={lithophaneHeatMap}
                className={
                  lithophaneHeatMap
                    ? "rounded-full bg-white/15 px-3 py-1 text-white"
                    : "rounded-full px-3 py-1 text-slate-400 transition hover:text-white"
                }
                onClick={() => setLithophaneHeatMap((current) => !current)}
                type="button"
              >
                Карта света
              </button>
            ) : null}
          </div>
        ) : null}

        {params.model === "lithophane" && heatMap ? (
          /*
            Легенда карты: полоска той же палитры и подписи краёв. Люксы здесь не
            показываются: карта отвечает на вопрос о ровности, а числа — дело
            расчёта, которого в интерфейсе больше нет.
          */
          <div className="pointer-events-none absolute top-3 right-3 w-40 rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-[0.65rem] text-slate-300 backdrop-blur">
            <div
              className="h-2 w-full rounded-full border border-white/10"
              style={{ backgroundImage: heatLegend }}
            />
            <div className="mt-1 flex justify-between">
              <span>темно</span>
              <span>ровно</span>
              <span>пересвет</span>
            </div>
            <p className="mt-1 leading-snug text-slate-400">
              {lithophaneLight
                ? "Ровность света по панели"
                : "Источника в этой сборке нет"}
            </p>
          </div>
        ) : null}

        {needsFont && !fontsReady ? (
          <div
            className={
              fontFailed
                ? "pointer-events-none absolute top-3 right-3 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-xs font-medium text-amber-100"
                : "pointer-events-none absolute top-3 right-3 rounded-full border border-white/10 bg-slate-950/70 px-3 py-1.5 text-xs font-medium text-slate-300"
            }
            role={fontFailed ? "alert" : "status"}
          >
            {fontFailed
              ? "Шрифт не загрузился: подписи скрыты, STL соберётся на сервере"
              : "Загружаем шрифт…"}
          </div>
        ) : null}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-between gap-2 bg-gradient-to-t from-slate-950/80 to-transparent px-4 pt-10 pb-3 text-xs text-slate-300">
          <span>{sizeLabel}</span>
          <span>Вес пластика: ~{materialWeightGrams.toFixed(1)} г</span>
        </div>

        <p className="sr-only">
          Сцена вращается перетаскиванием, приближается колесом мыши или жестом
          двух пальцев.{" "}
          {params.model === "keychain"
            ? "Кнопки «Лицо» и «Оборот» переворачивают брелок и показывают его обратную сторону. "
            : null}
          {params.model === "lithophane"
            ? `Кнопка «Подсветка» показывает литофан на просвет: светлые участки светятся, тёмные остаются тёмными. ${heatMap ? "Кнопка «Карта света» красит панель по ровности освещения и показывает лампы: синий — темно, зелёный — ровно, красный — пересвет. " : ""}`
            : null}
          {ariaLabel}.
        </p>
      </div>

      {/* Подсказка по управлению: обычный текст под сценой, а не надпись поверх канваса. */}
      {fullscreen ? null : (
        <p className="mt-2 text-sm text-slate-400">
          Вращение — перетаскивание мышью или свайп, зум — колесо или щипок.
          Приближение идёт к точке под курсором.
          {params.model === "keychain"
            ? " Переключатель «Лицо» / «Оборот» показывает рельефы с обратной стороны."
            : null}
          {params.model === "lithophane"
            ? " Кнопка «Подсветка» ставит литофан на просвет, как у окна."
            : null}
        </p>
      )}
    </>
  );
}
