"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ACESFilmicToneMapping,
  BufferGeometry,
  PCFShadowMap,
  Vector3,
} from "three";
import type { PerspectiveCamera } from "three";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import type { Font } from "three/examples/jsm/loaders/FontLoader.js";

import {
  COASTER_PATTERN_LABELS,
  JEWELRY_CONFIG_LABELS,
  LITHOPHANE_MOUNT_LABELS,
  LITHOPHANE_PREVIEW_RESOLUTION,
  PEN_SHAPE_LABELS,
  PLANTER_SHAPE_LABELS,
  downsampleLithophaneBrightness,
  keychainShapeTitle,
  vasePatternLabel,
  type ConstructorParams,
} from "@/lib/constructor/params";
import { calculateGeometryWeightGrams } from "@/lib/constructor/geometry-volume";
import {
  KEYCHAIN_FONT_URL,
  createKeychainGeometry,
} from "@/lib/constructor/keychain-geometry";
import { createBoxGeometry } from "@/lib/constructor/box-geometry";
import { createCoasterGeometry } from "@/lib/constructor/coaster-geometry";
import {
  createHeatTransferGeometry,
  heatTransferThickness,
} from "@/lib/constructor/heat-transfer-geometry";
import { createJewelryStandGeometry } from "@/lib/constructor/jewelry-stand-geometry";
import { createLithophaneGeometry } from "@/lib/constructor/lithophane-geometry";
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

/** Параметры выбранной модели: сцена пересобирается при любом изменении. */
type ViewportProps = {
  /** Все параметры выбранной модели: сцена читает их вместе с геометрией. */
  params: ConstructorParams;
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
const INITIAL_DIRECTION = new Vector3(0.62, 0.3, 0.94).normalize();

/**
 * Для лежащего брелока взгляд должен быть круче: при 15° над столом тонкая
 * пластина видна почти с ребра, и имя не читается. При смене модели камера
 * возвращается к подходящему ракурсу, а слайдеры направление не сбивают.
 */
const FLAT_DIRECTION = new Vector3(0.55, 0.85, 0.75).normalize();

/** Запас вокруг модели, чтобы она не касалась краёв кадра. */
const FRAME_MARGIN = 1.35;

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
      <meshStandardMaterial
        color="#e2e8f0"
        flatShading={faceted}
        metalness={0.1}
        roughness={0.7}
      />
    </mesh>
  );
}

type KeychainModelProps = {
  geometry: BufferGeometry;
};

/**
 * Брелок лежит на столе лицевой стороной вверх.
 *
 * Геометрия построена в плоскости XY с толщиной по Z — так её удобно печатать.
 * Поворот на -90° вокруг X ставит толщину по Y: нижняя грань касается стола,
 * а имя смотрит на камеру.
 */
function KeychainModel({ geometry }: KeychainModelProps) {
  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      <mesh castShadow geometry={geometry} receiveShadow>
        <meshStandardMaterial
          color="#f59e0b"
          metalness={0.1}
          roughness={0.7}
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
          color="#38bdf8"
          metalness={0.1}
          roughness={0.7}
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
          color="#34d399"
          metalness={0.1}
          roughness={0.7}
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
          metalness={0.1}
          roughness={0.7}
        />
      </mesh>
    </group>
  );
}

type LithophaneModelProps = {
  geometry: BufferGeometry;
};

/**
 * Литофан стоит на столе лицевой стороной к камере.
 *
 * Геометрия уже построена в плоскости XY нижней кромкой на Y = 0, поэтому
 * поворот не нужен: рамка и рельеф смотрят в +Z. Материал почти белый и
 * матовый — так на выступах читается светотень, а тонкие участки выглядят
 * светлее.
 */
function LithophaneModel({ geometry }: LithophaneModelProps) {
  return (
    <mesh castShadow geometry={geometry} receiveShadow>
      <meshStandardMaterial
        color="#f1f5f9"
        metalness={0.1}
        roughness={0.7}
      />
    </mesh>
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
        color="#a78bfa"
        metalness={0.1}
        roughness={0.7}
      />
    </mesh>
  );
}

/**
 * Радиус студии: по нему настраиваются свет и карта теней.
 *
 * Модели живут в миллиметрах, и ваза 120 мм с вывеской 400 мм требуют разного
 * удаления лампы и разного охвата тени: иначе тень либо не попадает в кадр,
 * либо размывается в серое пятно.
 */
function studioSpan(height: number, footprint: number): number {
  return Math.max(footprint * 1.8, height * 1.6, 220);
}

type StudioLightProps = {
  /** Радиус студии в миллиметрах. */
  span: number;
};

/**
 * Студийный свет без внешних HDR: сцена должна работать без обращений к CDN.
 *
 * Тень отбрасывает только ключевой источник — вторая тень от заполняющего
 * выглядела бы грязью под моделью. Контровой свет стоит за моделью и рисует
 * светлую кромку по силуэту: на матовой керамике он подчёркивает рёбра
 * фасеток там, где Fresnel-обводка показала бы край.
 *
 * Мягкость тени даёт `shadow-radius`: в three r186 встроенный PCF-фильтр
 * сэмплирует карту с шагом радиуса, поэтому край тени размывается, а не
 * повторяет лесенку текселя. Карта 1024 на охвате 440 мм — это 0.43 мм на
 * тексель, и радиус 10 размывает край тени примерно на четыре миллиметра: на
 * вазе это мягкая студийная тень, а карта вдвое дешевле 2048 на телефоне.
 */
function StudioLights({ span }: StudioLightProps) {
  return (
    <>
      {/* Верхний рассеянный: холодное небо сверху, тёмный стол снизу. */}
      <hemisphereLight args={["#dbeafe", "#0b1120", 0.75]} />
      {/* Ключевой: единственный источник тени. */}
      <directionalLight
        castShadow
        intensity={2.6}
        position={[span * 1.1, span * 1.7, span * 0.6]}
        shadow-bias={-0.0005}
        shadow-camera-bottom={-span}
        shadow-camera-far={span * 6}
        shadow-camera-left={-span}
        shadow-camera-right={span}
        shadow-camera-top={span}
        shadow-mapSize-height={1024}
        shadow-mapSize-width={1024}
        shadow-normalBias={0.02}
        shadow-radius={10}
      />
      {/* Заполняющий: мягкий, с противоположной стороны, без тени. */}
      <directionalLight
        color="#c7d2fe"
        intensity={0.8}
        position={[-span * 1.2, span * 0.5, span * 0.9]}
      />
      {/* Контровой: кромка силуэта, стоит за моделью. */}
      <directionalLight
        color="#93c5fd"
        intensity={1.3}
        position={[-span * 0.35, span * 0.85, -span * 1.25]}
      />
    </>
  );
}

type StudioFloorProps = {
  /** Наибольший горизонтальный размер модели, мм. */
  footprint: number;
};

/**
 * Бесконечный стол: одна большая плоскость, видимая только в пятне тени.
 *
 * `shadowMaterial` рисует только тень, сама плоскость прозрачна: край не виден,
 * и модель стоит над градиентом, как на студийном снимке. Сетка-помощник
 * убрана — она давала вид чертежа, а не редактора. Плоскость на полмиллиметра
 * ниже нуля, чтобы не спорить с нижними гранями лежащих моделей: у брелока и
 * литофана низ идёт ровно по y = 0.
 */
function StudioFloor({ footprint }: StudioFloorProps) {
  const size = Math.max(footprint * 16, 6000);

  return (
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
      <planeGeometry args={[size, size]} />
      <shadowMaterial color="#020617" transparent opacity={0.55} />
    </mesh>
  );
}

type SceneProps = {
  params: ConstructorParams;
  geometry: BufferGeometry;
  framing: Framing;
};

function Scene({ params, geometry, framing }: SceneProps) {
  // Радиус студии считается по габаритам модели: свет и карта теней должны
  // покрывать её целиком при любой высоте и ширине.
  const span = studioSpan(framing.height, framing.footprint);

  return (
    <>
      {/* Фон прозрачный: тёмный градиент задаёт обёртка viewport в CSS. */}
      <StudioLights span={span} />

      {params.model === "vase" ? (
        <VaseModel
          faceted={
            resolveSectionSides(params.shape, params.sectionSides) >=
            VASE_SECTION_MIN_SIDES
          }
          geometry={geometry}
        />
      ) : params.model === "keychain" ? (
        <KeychainModel geometry={geometry} />
      ) : params.model === "stand" ? (
        <StandModel geometry={geometry} />
      ) : params.model === "box" ? (
        <BoxModel geometry={geometry} />
      ) : params.model === "lithophane" ? (
        <LithophaneModel geometry={geometry} />
      ) : params.model === "planter" ? (
        <ZUpModel color="#fbbf24" geometry={geometry} />
      ) : params.model === "coaster" ? (
        <ZUpModel color="#fb7185" geometry={geometry} />
      ) : params.model === "jewelry_stand" ? (
        <ZUpModel color="#c084fc" geometry={geometry} />
      ) : params.model === "pen_holder" ? (
        <ZUpModel color="#60a5fa" geometry={geometry} />
      ) : params.model === "heat_transfer" ? (
        <ZUpModel color="#f97316" geometry={geometry} />
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
export function Viewport({ params }: ViewportProps) {
  /**
   * Брелок и вывеска подписываются шрифтом, остальным моделям он не нужен. У
   * вывески шрифт выбирает пользователь, поэтому путь зависит от signFont:
   * смена шрифта в панели загружает другой JSON.
   */
  const fontUrl =
    params.model === "sign"
      ? SIGN_FONT_URLS[params.signFont]
      : params.model === "keychain"
        ? KEYCHAIN_FONT_URL
        : null;
  const needsFont = fontUrl !== null;
  /**
   * Загруженный шрифт помнит свой путь. Пока новый файл не пришёл, сцена
   * показывает прежние буквы, а не пустоту: переключение шрифта не мигает.
   */
  const [loaded, setLoaded] = useState<{ url: string; font: Font } | null>(null);
  const [fontFailed, setFontFailed] = useState(false);
  const font = loaded?.font ?? null;

  /**
   * Шрифт грузим только при открытии брелока или вывески: вазе и подставке он
   * не нужен, а лишние 130 КБ JSON незачем тянуть на первый экран.
   * После загрузки состояние живёт до перезагрузки страницы, поэтому повторное
   * переключение вкладки не делает новый запрос.
   */
  useEffect(() => {
    if (!fontUrl || loaded?.url === fontUrl) {
      return;
    }

    let active = true;
    const loader = new FontLoader();

    setFontFailed(false);
    loader.load(
      fontUrl,
      (font) => {
        if (active) {
          setLoaded({ url: fontUrl, font });
          setFontFailed(false);
        }
      },
      undefined,
      () => {
        if (active) {
          setFontFailed(true);
        }
      },
    );

    return () => {
      active = false;
    };
  }, [fontUrl, loaded]);

  /**
   * Предпросмотр литофана получает уменьшенную копию яркости: полные 400 × 400
   * заставляют three.js пересобирать 160 801 вершину на каждое движение
   * слайдера. Копия считается только при замене картинки — ссылка на массив в
   * состоянии не меняется от правки толщин, поэтому useMemo не пересчитывает
   * усреднение на каждый кадр.
   */
  const lithophaneBrightness =
    params.model === "lithophane" ? params.lithophaneBrightness : null;
  const lithophanePreviewBrightness = useMemo(
    () =>
      lithophaneBrightness
        ? downsampleLithophaneBrightness(
            lithophaneBrightness,
            LITHOPHANE_PREVIEW_RESOLUTION,
          )
        : null,
    [lithophaneBrightness],
  );

  /**
   * Профиль и сетка пересчитываются только при изменении параметров или
   * загрузке шрифта. Смена камеры, света или материала не создаёт новую
   * геометрию. Пока шрифт не пришёл, брелок показывается без имени, а
   * вывеска — без букв: пустая сетка честнее случайной надписи.
   */
  const geometry = useMemo(() => {
    if (params.model === "keychain") {
      return createKeychainGeometry(params, font);
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
      // состояния: предпросмотр быстрый, печать подробная.
      return createLithophaneGeometry(
        lithophanePreviewBrightness
          ? { ...params, lithophaneBrightness: lithophanePreviewBrightness }
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
  }, [font, lithophanePreviewBrightness, params]);

  // Старая сетка живёт в GPU-буфере: без dispose каждая правка слайдера
  // оставляла бы мусор до перезагрузки страницы.
  useEffect(() => () => geometry.dispose(), [geometry]);

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
      // С подставкой сборка наклонена и стоит на базе 6 мм, поэтому габарит
      // берём из готовой сетки: камера не должна обрезать верх рамки.
      if (params.lithoMount === "stand") {
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
            ? `${params.boxLength} × ${params.boxWidth} × ${params.boxHeight} мм`
            : params.model === "lithophane"
              ? `${params.lithophaneWidth} × ${params.lithophaneHeight} × ${params.lithophaneMaxThickness.toFixed(1)} мм`
              : params.model === "planter"
                ? `${params.planterSize} × ${params.planterHeight} мм`
                : params.model === "coaster"
                  ? `${params.coasterSize} × ${params.coasterThickness} мм`
                  : params.model === "jewelry_stand"
                    ? `${params.jewelryBase} × ${params.jewelryHeight} мм`
                    : params.model === "pen_holder"
                      ? `${params.penSize} × ${params.penHeight} мм`
                      : params.model === "heat_transfer"
                        ? `${params.heatTransferWidth} × ${params.heatTransferHeight} × ${heatTransferThickness(params.heatTransferLayers).toFixed(1)} мм`
                        : `${Math.round(framing.footprint)} × ${Math.round(framing.height)} мм`;

  const ariaLabel =
    params.model === "vase"
      ? `3D-предпросмотр вазы высотой ${params.height} миллиметров и диаметром ${params.diameter} миллиметров, узор «${vasePatternLabel(params.patterns)}»`
      : params.model === "keychain"
        ? `3D-предпросмотр брелока ${params.length} на ${params.width} миллиметров, форма «${keychainShapeTitle(params)}», имя «${params.text.trim() || "без имени"}»`
        : params.model === "stand"
          ? `3D-предпросмотр подставки под телефон шириной ${params.standWidth} миллиметров, наклон ${params.standAngle} градусов, толщина телефона ${params.phoneThickness} миллиметров`
          : params.model === "box"
            ? `3D-предпросмотр коробки ${params.boxLength} на ${params.boxWidth} на ${params.boxHeight} миллиметров, сетка ${params.gridX} на ${params.gridY} ячеек, ${params.hasLid ? "с крышкой" : "без крышки"}`
            : params.model === "lithophane"
              ? `3D-предпросмотр литофана ${params.lithophaneWidth} на ${params.lithophaneHeight} миллиметров, толщина рельефа от ${params.lithophaneMinThickness} до ${params.lithophaneMaxThickness} миллиметров, ${params.lithoFrame ? `рамка, крепление «${LITHOPHANE_MOUNT_LABELS[params.lithoMount]}»` : "без рамки"}`
              : params.model === "planter"
                ? `3D-предпросмотр кашпо «${PLANTER_SHAPE_LABELS[params.planterShape]}» ${params.planterSize} миллиметров по ключу и высотой ${params.planterHeight} миллиметров, стенка ${params.planterWall} миллиметров, ${params.planterDrainage ? "с дренажными отверстиями и поддоном" : "без поддона"}`
                : params.model === "coaster"
                  ? `3D-предпросмотр подставки под кружку ${params.coasterSize} миллиметров, толщина ${params.coasterThickness} миллиметров, узор «${COASTER_PATTERN_LABELS[params.coasterPattern]}», ${params.coasterRim ? "с бортиком" : "без бортика"}`
                  : params.model === "jewelry_stand"
                    ? `3D-предпросмотр подставки для украшений высотой ${params.jewelryHeight} миллиметров на основании ${params.jewelryBase} миллиметров, «${JEWELRY_CONFIG_LABELS[params.jewelryConfig]}»`
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
      <div className="relative h-[min(40vh,20rem)] w-full max-w-full overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_50%_16%,#1e293b_0%,#0f172a_46%,#050a14_100%)] shadow-2xl shadow-black/50 sm:h-[min(48vh,26rem)] lg:h-auto lg:min-h-[16rem] lg:flex-1">
        {/*
          Тени и цветопередача заданы на рендерере: PCF с мягким фильтром даёт
          размытый край тени (PCFSoftShadowMap в three r186 удалён, и рендерер
          сам откатывался к PCF с предупреждением в консоли), а ACES-тонмаппинг с
          экспозицией 1 держит светлую керамику без пересвета и оставляет тёмный
          фон глубоким.
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
            toneMappingExposure: 1,
          }}
          shadows={{ enabled: true, type: PCFShadowMap }}
        >
          <Scene framing={framing} geometry={geometry} params={params} />
        </Canvas>

        {needsFont && !font ? (
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
          двух пальцев. {ariaLabel}.
        </p>
      </div>

      {/* Подсказка по управлению: обычный текст под сценой, а не надпись поверх канваса. */}
      <p className="mt-2 text-sm text-slate-400">
        Вращение — перетаскивание мышью или свайп, зум — колесо или щипок.
        Приближение идёт к точке под курсором.
      </p>
    </>
  );
}
