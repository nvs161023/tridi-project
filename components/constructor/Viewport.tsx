"use client";

import { ContactShadows, OrbitControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Vector3 } from "three";
import type { BufferGeometry, PerspectiveCamera } from "three";

import type { VaseShape } from "@/lib/constructor/params";
import {
  calculateGeometryVolumeMm3,
  createVaseGeometry,
} from "@/lib/constructor/vase-geometry";
import { createVaseProfile } from "@/lib/constructor/vase-profile";

type ViewportProps = {
  /** Высота модели, мм. */
  height: number;
  /** Внешний диаметр, мм. */
  diameter: number;
  /** Толщина стенки, мм. */
  wall: number;
  /** Пресет силуэта. */
  shape: VaseShape;
};

/** Для камеры важны только габариты: форма и стенка не меняют кадр. */
type CameraRigProps = Pick<ViewportProps, "height" | "diameter">;

/**
 * Направление, с которого камера смотрит на модель при первом открытии:
 * чуть справа и сверху. Дальше пользователь вращает сцену сам, а мы сохраняем
 * это направление при изменении размеров — камера не прыгает в исходную точку.
 */
const INITIAL_DIRECTION = new Vector3(0.62, 0.3, 0.94).normalize();

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
function CameraRig({ height, diameter }: CameraRigProps) {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const controls = useThree((state) => state.controls) as OrbitControlsLike | null;
  const previous = useRef<{ height: number } | null>(null);

  useEffect(() => {
    const perspective = camera as PerspectiveCamera;
    const verticalFov = (perspective.fov * Math.PI) / 180;
    const aspect = Math.max(size.width / Math.max(size.height, 1), 0.4);

    // Дистанция, при которой модель целиком помещается по высоте и по ширине.
    const fitHeight = height / 2 / Math.tan(verticalFov / 2);
    const fitWidth = diameter / 2 / (Math.tan(verticalFov / 2) * aspect);
    const distance = Math.max(fitHeight, fitWidth) * FRAME_MARGIN;

    // Центр вращения — середина модели по высоте.
    const target = new Vector3(0, height / 2, 0);

    // Сохраняем направление, с которого смотрел пользователь.
    const direction = new Vector3();
    if (previous.current) {
      const previousTarget = new Vector3(0, previous.current.height / 2, 0);
      direction.copy(camera.position).sub(previousTarget);
    }

    if (direction.lengthSq() < 1e-6) {
      direction.copy(INITIAL_DIRECTION);
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

    previous.current = { height };
  }, [camera, controls, diameter, height, size.height, size.width]);

  return null;
}

type VaseModelProps = ViewportProps & {
  geometry: BufferGeometry;
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
}: VaseModelProps) {
  return (
    <group>
      <mesh castShadow geometry={geometry} receiveShadow>
        <meshStandardMaterial color="#60a5fa" metalness={0.05} roughness={0.38} />
      </mesh>

      {/* Тёмный пол: на нём читаются контактные тени. */}
      <mesh position={[0, -0.3, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
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
        key={`${height}-${diameter}-${wall}-${shape}`}
        opacity={0.55}
        position={[0, 0.02, 0]}
        resolution={512}
        scale={Math.max(diameter * 3.2, 480)}
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
      <directionalLight color="#93c5fd" intensity={1.1} position={[-260, 180, -220]} />
    </>
  );
}

type SceneProps = ViewportProps & {
  geometry: BufferGeometry;
};

function Scene({ geometry, height, diameter, wall, shape }: SceneProps) {
  return (
    <>
      <color args={["#020617"]} attach="background" />

      <Lights />
      <VaseModel
        diameter={diameter}
        geometry={geometry}
        height={height}
        shape={shape}
        wall={wall}
      />
      <CameraRig diameter={diameter} height={height} />

      <OrbitControls
        dampingFactor={0.08}
        enableDamping
        enablePan={false}
        makeDefault
        maxDistance={1400}
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
export function Viewport({ height, diameter, wall, shape }: ViewportProps) {
  /**
   * Профиль и сетка пересчитываются только при изменении размеров или формы.
   * Смена камеры, света или материала не создаёт новую геометрию.
   */
  const geometry = useMemo(() => {
    const profile = createVaseProfile({ height, diameter, wall, shape });

    return createVaseGeometry(profile);
  }, [height, diameter, wall, shape]);

  // Старая сетка живёт в GPU-буфере: без dispose каждая правка слайдера
  // оставляла бы мусор до перезагрузки страницы.
  useEffect(() => () => geometry.dispose(), [geometry]);

  const materialVolumeCm3 = useMemo(
    () => Math.round(calculateGeometryVolumeMm3(geometry) / 1000),
    [geometry],
  );

  return (
    <div className="relative h-[24rem] w-full max-w-full overflow-hidden rounded-3xl border border-white/10 bg-slate-950 sm:h-[32rem] lg:h-[38rem]">
      <Canvas
        aria-label={`3D-предпросмотр вазы высотой ${height} миллиметров и диаметром ${diameter} миллиметров`}
        camera={{ fov: 35, near: 1, far: 6000, position: [0, 180, 320] }}
        dpr={[1, 1.75]}
        fallback={
          <div className="flex h-[24rem] items-center justify-center p-6 text-center sm:h-[32rem] lg:h-[38rem]">
            <p className="max-w-sm text-sm leading-relaxed text-slate-400">
              Браузер не поддерживает WebGL, поэтому 3D-предпросмотр недоступен.
              Попробуйте открыть страницу в другом браузере.
            </p>
          </div>
        }
        gl={{ antialias: true }}
      >
        <Scene
          diameter={diameter}
          geometry={geometry}
          height={height}
          shape={shape}
          wall={wall}
        />
      </Canvas>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-between gap-2 bg-gradient-to-t from-slate-950/80 to-transparent px-4 pt-10 pb-3 text-xs text-slate-400">
        <span className="flex flex-wrap items-center gap-x-2">
          <span>
            {height} × Ø {diameter} мм
          </span>
          <span aria-hidden className="text-slate-600">
            •
          </span>
          <span>≈ {materialVolumeCm3} см³ материала</span>
        </span>
        <span className="hidden sm:inline">Вращение — мышь, зум — колесо</span>
      </div>

      <p className="sr-only">
        Сцена вращается перетаскиванием, приближается колесом мыши или жестом
        двух пальцев. Модель высотой {height} миллиметров, диаметром {diameter}{" "}
        миллиметров.
      </p>
    </div>
  );
}
