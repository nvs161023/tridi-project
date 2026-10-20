"use client";

import { ContactShadows, OrbitControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { Vector3 } from "three";
import type { BufferGeometry, PerspectiveCamera } from "three";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import type { Font } from "three/examples/jsm/loaders/FontLoader.js";

import {
  KEYCHAIN_SHAPE_LABELS,
  LAMP_MOUNT_LABELS,
  VASE_PATTERN_LABELS,
  type ConstructorParams,
  type KeychainShape,
  type LampMount,
  type VasePattern,
  type VaseShape,
} from "@/lib/constructor/params";
import { calculateGeometryVolumeMm3 } from "@/lib/constructor/geometry-volume";
import {
  KEYCHAIN_FONT_URL,
  createKeychainGeometry,
} from "@/lib/constructor/keychain-geometry";
import { createLampGeometry } from "@/lib/constructor/lamp-geometry";
import {
  SIGN_FONT_URL,
  createSignGeometry,
} from "@/lib/constructor/sign-geometry";
import { createVaseGeometry } from "@/lib/constructor/vase-geometry";
import { createVaseProfile } from "@/lib/constructor/vase-profile";

type ViewportProps = {
  /** Все параметры выбранной модели: ваза, брелок, светильник или вывеска. */
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
  height: number;
  diameter: number;
  wall: number;
  shape: VaseShape;
  pattern: VasePattern;
  patternIntensity: number;
  patternFrequency: number;
};

/**
 * Ваза из LatheGeometry с толщиной стенки и дном.
 *
 * Геометрию создаёт и освобождает Viewport: меш только подключает готовый
 * BufferGeometry. Так старая сетка освобождается в одном месте, а не при
 * каждом обновлении материала или света.
 */
function VaseModel({
  geometry,
  height,
  diameter,
  wall,
  shape,
  pattern,
  patternIntensity,
  patternFrequency,
}: VaseModelProps) {
  return (
    <group>
      <mesh castShadow geometry={geometry} receiveShadow>
        <meshStandardMaterial
          color="#60a5fa"
          metalness={0.05}
          roughness={0.38}
        />
      </mesh>

      {/* Тёмный пол: на нём читаются контактные тени. */}
      <mesh
        position={[0, -0.3, 0]}
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[Math.max(diameter * 2.2, 320), 64]} />
        <meshStandardMaterial color="#0b1220" roughness={1} />
      </mesh>

      <gridHelper
        args={[Math.max(diameter * 6, 1200), 24, "#1e293b", "#0f172a"]}
        position={[0, 0.01, 0]}
      />

      {/*
        frames={1} — тень пересчитывается один раз. Ключ перезапускает расчёт
        при изменении размеров, формы или стенки: силуэт меняется, и старая
        тень стала бы неверной. Постоянно считать её каждый кадр не нужно.
      */}
      <ContactShadows
        blur={2.6}
        far={Math.max(height * 0.9, 120)}
        frames={1}
        key={`${height}-${diameter}-${wall}-${shape}-${pattern}-${patternIntensity}-${patternFrequency}`}
        opacity={0.55}
        position={[0, 0.02, 0]}
        resolution={512}
        scale={Math.max(diameter * 3.2, 480)}
      />
    </group>
  );
}

type KeychainModelProps = {
  geometry: BufferGeometry;
  length: number;
  width: number;
  thickness: number;
  shapeType: KeychainShape;
  text: string;
};

/**
 * Брелок лежит на столе лицевой стороной вверх.
 *
 * Геометрия построена в плоскости XY с толщиной по Z — так её удобно печатать.
 * Поворот на -90° вокруг X ставит толщину по Y: нижняя грань касается стола,
 * а имя смотрит на камеру. Тень пересчитывается при смене размеров, формы и
 * текста, потому что силуэт и рельеф меняются.
 */
function KeychainModel({
  geometry,
  length,
  width,
  thickness,
  shapeType,
  text,
}: KeychainModelProps) {
  const footprint = Math.max(length, width);

  return (
    <group>
      <group rotation={[-Math.PI / 2, 0, 0]}>
        <mesh castShadow geometry={geometry} receiveShadow>
          <meshStandardMaterial
            color="#f59e0b"
            metalness={0.08}
            roughness={0.34}
          />
        </mesh>
      </group>

      {/* Тёмный пол: на нём читаются контактные тени. */}
      <mesh
        position={[0, -0.3, 0]}
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[Math.max(footprint * 2.2, 160), 64]} />
        <meshStandardMaterial color="#0b1220" roughness={1} />
      </mesh>

      <gridHelper
        args={[Math.max(footprint * 6, 480), 24, "#1e293b", "#0f172a"]}
        position={[0, 0.01, 0]}
      />

      <ContactShadows
        blur={2.6}
        far={Math.max(thickness * 20, 80)}
        frames={1}
        key={`keychain-${length}-${width}-${thickness}-${shapeType}-${text}`}
        opacity={0.5}
        position={[0, 0.02, 0]}
        resolution={512}
        scale={Math.max(footprint * 2.6, 320)}
      />
    </group>
  );
}

type LampModelProps = {
  geometry: BufferGeometry;
  height: number;
  diameter: number;
  pattern: VasePattern;
  mount: LampMount;
};

/**
 * Абажур стоит на столе так же, как ваза: гнездо патрона сверху, свет уходит
 * вниз. Материал светлее и с лёгким свечением — по нему видно, что деталь
 * относится к светильнику, а не к вазе.
 *
 * Тень пересчитывается при смене высоты, диаметра, узора и патрона: силуэт
 * меняется, а при постоянном расчёте тень стоила бы кадрового времени.
 */
function LampModel({
  geometry,
  height,
  diameter,
  pattern,
  mount,
}: LampModelProps) {
  return (
    <group>
      <mesh castShadow geometry={geometry} receiveShadow>
        <meshStandardMaterial
          color="#fbbf24"
          emissive="#f59e0b"
          emissiveIntensity={0.12}
          metalness={0.05}
          roughness={0.42}
        />
      </mesh>

      {/* Тёмный пол: на нём читаются контактные тени. */}
      <mesh
        position={[0, -0.3, 0]}
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[Math.max(diameter * 2.2, 320), 64]} />
        <meshStandardMaterial color="#0b1220" roughness={1} />
      </mesh>

      <gridHelper
        args={[Math.max(diameter * 6, 1200), 24, "#1e293b", "#0f172a"]}
        position={[0, 0.01, 0]}
      />

      <ContactShadows
        blur={2.6}
        far={Math.max(height * 0.9, 120)}
        frames={1}
        key={`lamp-${height}-${diameter}-${pattern}-${mount}`}
        opacity={0.55}
        position={[0, 0.02, 0]}
        resolution={512}
        scale={Math.max(diameter * 3.2, 480)}
      />
    </group>
  );
}

type SignModelProps = {
  geometry: BufferGeometry;
  fontSize: number;
  depth: number;
  channelWidth: number;
  text: string;
  /** Фактическая ширина с учётом автоподбора кегля, мм. */
  width: number;
};

/**
 * Вывеска стоит на столе вертикально: плита построена в плоскости XY, поэтому
 * поворот не нужен — так же деталь ложится в STL.
 *
 * Ключ тени включает текст, кегль, выступ и канал: любая правка меняет
 * силуэт, и старая тень стала бы неверной.
 */
function SignModel({
  geometry,
  fontSize,
  depth,
  channelWidth,
  text,
  width,
}: SignModelProps) {
  return (
    <group>
      <mesh castShadow geometry={geometry} receiveShadow>
        <meshStandardMaterial
          color="#a78bfa"
          metalness={0.08}
          roughness={0.34}
        />
      </mesh>

      {/* Тёмный пол: на нём читаются контактные тени. */}
      <mesh
        position={[0, -0.3, 0]}
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[Math.max(width * 2.4, 400), 64]} />
        <meshStandardMaterial color="#0b1220" roughness={1} />
      </mesh>

      <gridHelper
        args={[Math.max(width * 4, 1200), 24, "#1e293b", "#0f172a"]}
        position={[0, 0.01, 0]}
      />

      <ContactShadows
        blur={2.6}
        far={Math.max(fontSize * 2, 160)}
        frames={1}
        key={`sign-${text}-${fontSize}-${depth}-${channelWidth}`}
        opacity={0.5}
        position={[0, 0.02, 0]}
        resolution={512}
        scale={Math.max(width * 2.6, 480)}
      />
    </group>
  );
}

/** Свет без внешних HDR: сцена должна работать без обращений к CDN. */
function Lights() {
  return (
    <>
      <ambientLight intensity={0.45} />
      <hemisphereLight args={["#bfdbfe", "#020617", 0.6]} />
      <directionalLight intensity={2.4} position={[200, 320, 260]} />
      <directionalLight
        color="#93c5fd"
        intensity={1.1}
        position={[-260, 180, -220]}
      />
    </>
  );
}

type SceneProps = {
  params: ConstructorParams;
  geometry: BufferGeometry;
  framing: Framing;
};

function Scene({ params, geometry, framing }: SceneProps) {
  return (
    <>
      <color args={["#020617"]} attach="background" />

      <Lights />
      {params.model === "vase" ? (
        <VaseModel
          diameter={params.diameter}
          geometry={geometry}
          height={params.height}
          pattern={params.pattern}
          patternFrequency={params.patternFrequency}
          patternIntensity={params.patternIntensity}
          shape={params.shape}
          wall={params.wall}
        />
      ) : params.model === "keychain" ? (
        <KeychainModel
          geometry={geometry}
          length={params.length}
          shapeType={params.shapeType}
          text={params.text}
          thickness={params.thickness}
          width={params.width}
        />
      ) : params.model === "lamp" ? (
        <LampModel
          diameter={params.lampDiameter}
          geometry={geometry}
          height={params.lampHeight}
          mount={params.lampMount}
          pattern={params.lampPattern}
        />
      ) : (
        <SignModel
          channelWidth={params.signChannelWidth}
          depth={params.signDepth}
          fontSize={params.signFontSize}
          geometry={geometry}
          text={params.signText}
          width={framing.footprint}
        />
      )}
      <CameraRig
        flat={framing.flat}
        footprint={framing.footprint}
        height={framing.height}
      />

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
  /** Брелок и вывеска подписываются шрифтом, остальным моделям он не нужен. */
  const needsFont = params.model === "keychain" || params.model === "sign";
  const [font, setFont] = useState<Font | null>(null);
  const [fontFailed, setFontFailed] = useState(false);

  /**
   * Шрифт грузим только при открытии брелока или вывески: вазе и абажуру он
   * не нужен, а лишние 130 КБ JSON незачем тянуть на первый экран. После
   * загрузки состояние живёт до перезагрузки страницы, поэтому повторное
   * переключение вкладки не делает новый запрос.
   */
  useEffect(() => {
    if (!needsFont || font) {
      return;
    }

    let active = true;
    const loader = new FontLoader();

    loader.load(
      params.model === "sign" ? SIGN_FONT_URL : KEYCHAIN_FONT_URL,
      (loaded) => {
        if (active) {
          setFont(loaded);
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
  }, [font, needsFont, params.model]);

  /**
   * Профиль и сетка пересчитываются только при изменении параметров или
   * загрузке шрифта. Смена камеры, света или материала не создаёт новую
   * геометрию. Пока шрифт не пришёл, брелок показывается без имени, а
   * вывеска — без букв: плита и канал уже видны.
   */
  const geometry = useMemo(() => {
    if (params.model === "keychain") {
      return createKeychainGeometry(params, font);
    }

    if (params.model === "lamp") {
      return createLampGeometry(params);
    }

    if (params.model === "sign") {
      return createSignGeometry(params, font);
    }

    return createVaseGeometry(createVaseProfile(params), params);
  }, [font, params]);

  // Старая сетка живёт в GPU-буфере: без dispose каждая правка слайдера
  // оставляла бы мусор до перезагрузки страницы.
  useEffect(() => () => geometry.dispose(), [geometry]);

  /**
   * Габариты для камеры и подписи. У вывески ширина зависит от надписи, а не
   * только от слайдеров, поэтому её берём из готовой сетки. Остальные модели
   * считаются по параметрам: их bounding box совпадает со слайдерами с
   * точностью до амплитуды узора.
   */
  const framing = useMemo<Framing>(() => {
    if (params.model === "vase") {
      return {
        height: params.height,
        footprint: params.diameter,
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

    if (params.model === "lamp") {
      return {
        height: params.lampHeight,
        footprint: params.lampDiameter,
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

  const materialVolumeCm3 = useMemo(
    () => Math.round(calculateGeometryVolumeMm3(geometry) / 100) / 10,
    [geometry],
  );

  const sizeLabel =
    params.model === "vase"
      ? `${params.height} × Ø ${params.diameter} мм`
      : params.model === "keychain"
        ? `${params.length} × ${params.width} × ${params.thickness} мм`
        : params.model === "lamp"
          ? `${params.lampHeight} × Ø ${params.lampDiameter} мм`
          : `${Math.round(framing.footprint)} × ${Math.round(framing.height)} мм`;

  const ariaLabel =
    params.model === "vase"
      ? `3D-предпросмотр вазы высотой ${params.height} миллиметров и диаметром ${params.diameter} миллиметров, узор «${VASE_PATTERN_LABELS[params.pattern]}»`
      : params.model === "keychain"
        ? `3D-предпросмотр брелока ${params.length} на ${params.width} миллиметров, форма «${KEYCHAIN_SHAPE_LABELS[params.shapeType]}», имя «${params.text.trim() || "без имени"}»`
        : params.model === "lamp"
          ? `3D-предпросмотр абажура высотой ${params.lampHeight} миллиметров и диаметром ${params.lampDiameter} миллиметров, патрон ${LAMP_MOUNT_LABELS[params.lampMount]}, узор «${VASE_PATTERN_LABELS[params.lampPattern]}»`
          : `3D-предпросмотр вывески шириной ${Math.round(framing.footprint)} и высотой ${Math.round(framing.height)} миллиметров, надпись «${params.signText.trim() || "без надписи"}», канал ${params.signChannelWidth} миллиметров`;

  return (
    <div className="relative h-[24rem] w-full max-w-full overflow-hidden rounded-3xl border border-white/10 bg-slate-950 sm:h-[32rem] lg:h-[38rem]">
      <Canvas
        aria-label={ariaLabel}
        camera={{ fov: 35, near: 1, far: 6000, position: [0, 180, 320] }}
        dpr={[1, 1.75]}
        fallback={
          <div className="flex h-[24rem] items-center justify-center p-6 text-center sm:h-[32rem] lg:h-[38rem]">
            <p className="max-w-sm text-sm leading-relaxed text-slate-300">
              Браузер не поддерживает WebGL, поэтому 3D-предпросмотр недоступен.
              Попробуйте открыть страницу в другом браузере.
            </p>
          </div>
        }
        gl={{ antialias: true }}
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
            ? "Шрифт не загрузился: предпросмотр без надписи, STL соберётся на сервере"
            : "Загружаем шрифт…"}
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-between gap-2 bg-gradient-to-t from-slate-950/80 to-transparent px-4 pt-10 pb-3 text-xs text-slate-300">
        <span className="flex flex-wrap items-center gap-x-2">
          <span>{sizeLabel}</span>
          <span aria-hidden className="text-slate-600">
            •
          </span>
          <span>≈ {materialVolumeCm3.toFixed(1)} см³ материала</span>
        </span>
        <span className="hidden sm:inline">Вращение — мышь, зум — колесо</span>
      </div>

      <p className="sr-only">
        Сцена вращается перетаскиванием, приближается колесом мыши или жестом
        двух пальцев. {ariaLabel}.
      </p>
    </div>
  );
}
