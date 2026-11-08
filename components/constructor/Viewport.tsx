"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ACESFilmicToneMapping,
  BufferGeometry,
  Color,
  DataTexture,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  PCFShadowMap,
  PlaneGeometry,
  PMREMGenerator,
  Scene as ThreeScene,
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
import {
  STUDIO_BACKGROUND_CSS,
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
        color={STUDIO_MODEL_TINTS.lithophane}
        metalness={STUDIO_PLASTIC.metalness}
        roughness={STUDIO_PLASTIC.roughness}
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
 */
function StudioLights({ span }: StudioLightProps) {
  return (
    <>
      {/* Верхний рассеянный: холодное небо сверху, тёмный стол снизу. */}
      <hemisphereLight
        args={[
          STUDIO_LIGHTS.hemisphere.sky,
          STUDIO_LIGHTS.hemisphere.ground,
          STUDIO_LIGHTS.hemisphere.intensity,
        ]}
      />
      {/* Ключевой: единственный источник тени. */}
      <directionalLight
        castShadow
        color={STUDIO_LIGHTS.key.color}
        intensity={STUDIO_LIGHTS.key.intensity}
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
        intensity={STUDIO_LIGHTS.fill.intensity}
        position={[
          span * STUDIO_LIGHTS.fill.position[0],
          span * STUDIO_LIGHTS.fill.position[1],
          span * STUDIO_LIGHTS.fill.position[2],
        ]}
      />
      {/* Контровой: кромка силуэта, стоит за моделью. */}
      <directionalLight
        color={STUDIO_LIGHTS.rim.color}
        intensity={STUDIO_LIGHTS.rim.intensity}
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
};

function Scene({ params, geometry, framing }: SceneProps) {
  // Радиус студии считается по габаритам модели: свет и карта теней должны
  // покрывать её целиком при любой высоте и ширине.
  const span = studioSpan(framing.height, framing.footprint);

  return (
    <>
      {/*
        Окружение и свет: софтбоксы дают отражения, направленный свет — тень.
        Фон прозрачный, тёмный градиент задаёт обёртка viewport в CSS.
      */}
      <StudioEnvironment />
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
      <div
        className="relative h-[min(40vh,20rem)] w-full max-w-full overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-black/50 sm:h-[min(48vh,26rem)] lg:h-auto lg:min-h-[16rem] lg:flex-1"
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
          <Scene framing={framing} geometry={geometry} params={params} />
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
