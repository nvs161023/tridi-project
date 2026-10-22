"use client";

import { ContactShadows, OrbitControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { Vector3 } from "three";
import type { BufferGeometry, PerspectiveCamera } from "three";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import type { Font } from "three/examples/jsm/loaders/FontLoader.js";

import {
  COASTER_PATTERN_LABELS,
  GIFT_BOX_SHAPE_LABELS,
  JEWELRY_CONFIG_LABELS,
  KEYCHAIN_SHAPE_LABELS,
  LITHOPHANE_MOUNT_LABELS,
  LITHOPHANE_PREVIEW_RESOLUTION,
  ORNAMENT_SHAPE_LABELS,
  PATCH_SHAPE_LABELS,
  PEN_SHAPE_LABELS,
  PLANTER_SHAPE_LABELS,
  STENCIL_PATTERN_LABELS,
  VASE_PATTERN_LABELS,
  WALL_HOOK_MOUNT_LABELS,
  downsampleLithophaneBrightness,
  type ConstructorParams,
  type KeychainShape,
  type VasePattern,
  type VaseShape,
} from "@/lib/constructor/params";
import { calculateGeometryWeightGrams } from "@/lib/constructor/geometry-volume";
import {
  KEYCHAIN_FONT_URL,
  createKeychainGeometry,
} from "@/lib/constructor/keychain-geometry";
import { createBoxGeometry } from "@/lib/constructor/box-geometry";
import { createCipherBoxGeometry } from "@/lib/constructor/cipher-box-geometry";
import { createClipsGeometry } from "@/lib/constructor/cable-clips-geometry";
import { createCoasterGeometry } from "@/lib/constructor/coaster-geometry";
import { createCupClipGeometry } from "@/lib/constructor/cup-clip-geometry";
import { createFabricPatchGeometry } from "@/lib/constructor/fabric-patch-geometry";
import { createGiftBoxGeometry } from "@/lib/constructor/gift-box-geometry";
import { createJewelryStandGeometry } from "@/lib/constructor/jewelry-stand-geometry";
import { createLithophaneGeometry } from "@/lib/constructor/lithophane-geometry";
import { createOrnamentGeometry } from "@/lib/constructor/ornament-geometry";
import { createPenHolderGeometry } from "@/lib/constructor/pen-holder-geometry";
import { createPlanterGeometry } from "@/lib/constructor/planter-geometry";
import { createStandGeometry } from "@/lib/constructor/phone-stand-geometry";
import {
  SIGN_FONT_URLS,
  createSignGeometry,
} from "@/lib/constructor/sign-geometry";
import { createStencilGeometry } from "@/lib/constructor/stencil-geometry";
import { createStringLightGeometry } from "@/lib/constructor/string-light-geometry";
import { createVaseGeometry } from "@/lib/constructor/vase-geometry";
import { createVaseProfile } from "@/lib/constructor/vase-profile";
import { createWallHookGeometry } from "@/lib/constructor/wall-hook-geometry";

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

type StandModelProps = {
  geometry: BufferGeometry;
  /** Наклон спинки в градусах: от него зависит глубина детали и тень. */
  angle: number;
  /** Толщина телефона, мм: она задаёт глубину жёлоба. */
  thickness: number;
  /** Ширина подставки, мм. */
  width: number;
};

/**
 * Подставка стоит на столе так же, как её печатает слайсер: геометрия
 * построена Z-вверх, поворот на -90° вокруг X поднимает спинку и губу.
 *
 * Цвет холоднее вазы — по нему видно, что деталь относится к подставке.
 * Тень пересчитывается при смене наклона, толщины телефона и ширины: от них
 * зависит силуэт, а при постоянном расчёте тень стоила бы кадрового времени.
 */
function StandModel({ geometry, angle, thickness, width }: StandModelProps) {
  return (
    <group>
      <group rotation={[-Math.PI / 2, 0, 0]}>
        <mesh castShadow geometry={geometry} receiveShadow>
          <meshStandardMaterial
            color="#38bdf8"
            metalness={0.05}
            roughness={0.42}
          />
        </mesh>
      </group>

      {/* Тёмный пол: на нём читаются контактные тени. */}
      <mesh
        position={[0, -0.3, 0]}
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[Math.max(width * 2.2, 320), 64]} />
        <meshStandardMaterial color="#0b1220" roughness={1} />
      </mesh>

      <gridHelper
        args={[Math.max(width * 5, 960), 24, "#1e293b", "#0f172a"]}
        position={[0, 0.01, 0]}
      />

      <ContactShadows
        blur={2.6}
        far={Math.max(width * 1.6, 160)}
        frames={1}
        key={`stand-${angle}-${thickness}-${width}`}
        opacity={0.55}
        position={[0, 0.02, 0]}
        resolution={512}
        scale={Math.max(width * 3, 480)}
      />
    </group>
  );
}

type ClipsModelProps = {
  geometry: BufferGeometry;
  /** Диаметр кабеля, мм: от него зависит дуга зажима. */
  cableDiameter: number;
  /** Сколько зажимов на планке: от этого зависит длина набора. */
  clipCount: number;
  /** Шаг между зажимами, мм. */
  spacing: number;
  /** Длина набора по готовой сетке, мм: из неё считаются пол и тень. */
  footprint: number;
};

/**
 * Клипсы лежат на столе планкой вниз, разрезом вверх: геометрия построена
 * Z-вверх, поворот на -90° вокруг X кладёт её так же, как коробку.
 *
 * Тень пересчитывается при смене диаметра кабеля, числа зажимов и шага: набор
 * меняет длину и силуэт, а старая тень стала бы неверной.
 */
function ClipsModel({
  geometry,
  cableDiameter,
  clipCount,
  spacing,
  footprint,
}: ClipsModelProps) {
  return (
    <group>
      <group rotation={[-Math.PI / 2, 0, 0]}>
        <mesh castShadow geometry={geometry} receiveShadow>
          <meshStandardMaterial
            color="#f472b6"
            metalness={0.05}
            roughness={0.42}
          />
        </mesh>
      </group>

      {/* Тёмный пол: на нём читаются контактные тени. */}
      <mesh
        position={[0, -0.3, 0]}
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[Math.max(footprint * 2.4, 320), 64]} />
        <meshStandardMaterial color="#0b1220" roughness={1} />
      </mesh>

      <gridHelper
        args={[Math.max(footprint * 3, 960), 24, "#1e293b", "#0f172a"]}
        position={[0, 0.01, 0]}
      />

      <ContactShadows
        blur={2.6}
        far={Math.max(cableDiameter * 10, 120)}
        frames={1}
        key={`clips-${cableDiameter}-${clipCount}-${spacing}`}
        opacity={0.55}
        position={[0, 0.02, 0]}
        resolution={512}
        scale={Math.max(footprint * 2.2, 480)}
      />
    </group>
  );
}

type BoxModelProps = {
  geometry: BufferGeometry;
  length: number;
  width: number;
  height: number;
  wall: number;
  gridX: number;
  gridY: number;
  hasLid: boolean;
};

/**
 * Коробка стоит на столе так же, как её печатает слайсер: геометрия построена
 * в плоскости XY с высотой по Z, поворот на -90° вокруг X поднимает стенки.
 * Корпус и крышка уже разложены рядом в одной сетке, поэтому меш один.
 *
 * Ключ тени включает все размеры, сетку и крышку: каждая правка меняет
 * силуэт, и старая контактная тень стала бы неверной.
 */
function BoxModel({
  geometry,
  length,
  width,
  height,
  wall,
  gridX,
  gridY,
  hasLid,
}: BoxModelProps) {
  const footprint = Math.max(length, width);

  return (
    <group>
      <group rotation={[-Math.PI / 2, 0, 0]}>
        <mesh castShadow geometry={geometry} receiveShadow>
          <meshStandardMaterial
            color="#34d399"
            metalness={0.05}
            roughness={0.42}
          />
        </mesh>
      </group>

      {/* Тёмный пол: на нём читаются контактные тени. */}
      <mesh
        position={[0, -0.3, 0]}
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[Math.max(footprint * 2.2, 320), 64]} />
        <meshStandardMaterial color="#0b1220" roughness={1} />
      </mesh>

      <gridHelper
        args={[Math.max(footprint * 5, 960), 24, "#1e293b", "#0f172a"]}
        position={[0, 0.01, 0]}
      />

      <ContactShadows
        blur={2.6}
        far={Math.max(height * 1.2, 120)}
        frames={1}
        key={`box-${length}-${width}-${height}-${wall}-${gridX}-${gridY}-${hasLid}`}
        opacity={0.55}
        position={[0, 0.02, 0]}
        resolution={512}
        scale={Math.max(footprint * 3, 480)}
      />
    </group>
  );
}

type ZUpModelProps = {
  geometry: BufferGeometry;
  /** Высота модели над столом, мм: по ней считается дальность тени. */
  height: number;
  /** Наибольший горизонтальный размер, мм: по нему — пол и сетка. */
  footprint: number;
  /** Цвет пластика: у каждой модели свой, чтобы сцены не путались. */
  color: string;
  /** Подпись набора параметров: меняет силуэт — меняется и тень. */
  shadowKey: string;
};

/**
 * Кашпо, подставка под кружку и подставка для украшений.
 *
 * Геометрия этих моделей построена Z-вверх, как у коробки, поэтому поворот на
 * -90° вокруг X ставит детали на виртуальный стол. Тень пересчитывается при
 * смене параметров: новая форма даёт другой силуэт, и старая тень стала бы
 * неверной.
 */
function ZUpModel({
  geometry,
  height,
  footprint,
  color,
  shadowKey,
}: ZUpModelProps) {
  return (
    <group>
      <group rotation={[-Math.PI / 2, 0, 0]}>
        <mesh castShadow geometry={geometry} receiveShadow>
          <meshStandardMaterial
            color={color}
            metalness={0.05}
            roughness={0.42}
          />
        </mesh>
      </group>

      {/* Тёмный пол: на нём читаются контактные тени. */}
      <mesh
        position={[0, -0.3, 0]}
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[Math.max(footprint * 2.2, 320), 64]} />
        <meshStandardMaterial color="#0b1220" roughness={1} />
      </mesh>

      <gridHelper
        args={[Math.max(footprint * 4, 960), 24, "#1e293b", "#0f172a"]}
        position={[0, 0.01, 0]}
      />

      <ContactShadows
        blur={2.6}
        far={Math.max(height * 1.2, 120)}
        frames={1}
        key={shadowKey}
        opacity={0.55}
        position={[0, 0.02, 0]}
        resolution={512}
        scale={Math.max(footprint * 3, 480)}
      />
    </group>
  );
}

type LithophaneModelProps = {
  geometry: BufferGeometry;
  width: number;
  height: number;
  minThickness: number;
  maxThickness: number;
};

/**
 * Литофан стоит на столе лицевой стороной к камере.
 *
 * Геометрия уже построена в плоскости XY нижней кромкой на Y = 0, поэтому
 * поворот не нужен: рамка и рельеф смотрят в +Z. Материал почти белый и
 * матовый — так на выступах читается светотень, а тонкие участки выглядят
 * светлее. Тень пересчитывается при смене размеров и толщин: каждая правка
 * меняет силуэт и глубину рельефа.
 */
function LithophaneModel({
  geometry,
  width,
  height,
  minThickness,
  maxThickness,
}: LithophaneModelProps) {
  const footprint = Math.max(width, height);

  return (
    <group>
      <mesh castShadow geometry={geometry} receiveShadow>
        <meshStandardMaterial
          color="#f1f5f9"
          metalness={0.02}
          roughness={0.48}
        />
      </mesh>

      {/* Тёмный пол: на нём читаются контактные тени. */}
      <mesh
        position={[0, -0.3, 0]}
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[Math.max(footprint * 2.4, 400), 64]} />
        <meshStandardMaterial color="#0b1220" roughness={1} />
      </mesh>

      <gridHelper
        args={[Math.max(footprint * 4, 1200), 24, "#1e293b", "#0f172a"]}
        position={[0, 0.01, 0]}
      />

      <ContactShadows
        blur={2.6}
        far={Math.max(maxThickness * 24, 120)}
        frames={1}
        key={`lithophane-${width}-${height}-${minThickness}-${maxThickness}`}
        opacity={0.5}
        position={[0, 0.02, 0]}
        resolution={512}
        scale={Math.max(footprint * 2.8, 480)}
      />
    </group>
  );
}

type SignModelProps = {
  geometry: BufferGeometry;
  fontSize: number;
  depth: number;
  channelWidth: number;
  /** Зазор между буквами: он меняет ширину надписи и силуэт тени. */
  letterGap: number;
  /** Сколько букв в блоке: от него зависят плиты и стыки. */
  blockSize: number;
  /** Общее основание под буквами: плита вместо узкой рейки. */
  baseMount: boolean;
  text: string;
  /** Фактическая ширина с учётом автоподбора кегля, мм. */
  width: number;
};

/**
 * Вывеска собирается из блоков: в каждом полые буквы на общей плите, а плиты
 * соседей стыкуются шипом и пазом. Геометрия построена в плоскости XY, поэтому
 * поворот не нужен — так же детали ложатся в STL.
 *
 * Ключ тени включает текст, кегль, выступ, канал, зазор, размер блока и
 * основание: любая правка меняет силуэт, и старая тень стала бы неверной.
 */
function SignModel({
  geometry,
  fontSize,
  depth,
  channelWidth,
  letterGap,
  blockSize,
  baseMount,
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
        key={`sign-${text}-${fontSize}-${depth}-${channelWidth}-${letterGap}-${blockSize}-${baseMount}`}
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
      {/* Фон прозрачный: градиент задаёт обёртка viewport в CSS. */}
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
      ) : params.model === "stand" ? (
        <StandModel
          angle={params.standAngle}
          geometry={geometry}
          thickness={params.phoneThickness}
          width={params.standWidth}
        />
      ) : params.model === "clips" ? (
        <ClipsModel
          cableDiameter={params.cableDiameter}
          clipCount={params.clipCount}
          footprint={framing.footprint}
          geometry={geometry}
          spacing={params.clipSpacing}
        />
      ) : params.model === "box" ? (
        <BoxModel
          geometry={geometry}
          gridX={params.gridX}
          gridY={params.gridY}
          hasLid={params.hasLid}
          height={params.boxHeight}
          length={params.boxLength}
          wall={params.boxWall}
          width={params.boxWidth}
        />
      ) : params.model === "lithophane" ? (
        <LithophaneModel
          geometry={geometry}
          height={params.lithophaneHeight}
          maxThickness={params.lithophaneMaxThickness}
          minThickness={params.lithophaneMinThickness}
          width={params.lithophaneWidth}
        />
      ) : params.model === "planter" ? (
        <ZUpModel
          color="#fbbf24"
          footprint={framing.footprint}
          geometry={geometry}
          height={framing.height}
          shadowKey={`planter-${params.planterSize}-${params.planterHeight}-${params.planterWall}-${params.planterShape}-${params.planterDrainage}`}
        />
      ) : params.model === "coaster" ? (
        <ZUpModel
          color="#fb7185"
          footprint={framing.footprint}
          geometry={geometry}
          height={framing.height}
          shadowKey={`coaster-${params.coasterSize}-${params.coasterThickness}-${params.coasterShape}-${params.coasterPattern}-${params.coasterRim}`}
        />
      ) : params.model === "jewelry_stand" ? (
        <ZUpModel
          color="#c084fc"
          footprint={framing.footprint}
          geometry={geometry}
          height={framing.height}
          shadowKey={`jewelry-${params.jewelryBase}-${params.jewelryHeight}-${params.jewelryConfig}`}
        />
      ) : params.model === "pen_holder" ? (
        <ZUpModel
          color="#60a5fa"
          footprint={framing.footprint}
          geometry={geometry}
          height={framing.height}
          shadowKey={`pen-${params.penSize}-${params.penHeight}-${params.penWall}-${params.penShape}-${params.penSections}`}
        />
      ) : params.model === "fabric_patch" ? (
        <ZUpModel
          color="#4ade80"
          footprint={framing.footprint}
          geometry={geometry}
          height={framing.height}
          shadowKey={`patch-${params.patchSize}-${params.patchThickness}-${params.patchShape}-${params.patchBorder}-${params.patchStitches}`}
        />
      ) : params.model === "string_light" ? (
        <ZUpModel
          color="#fde047"
          footprint={framing.footprint}
          geometry={geometry}
          height={framing.height}
          shadowKey={`light-${params.lightDiameter}-${params.lightHeight}-${params.lightSocket}-${params.lightWall}-${params.lightCount}`}
        />
      ) : params.model === "ornament" ? (
        <ZUpModel
          color="#f472b6"
          footprint={framing.footprint}
          geometry={geometry}
          height={framing.height}
          shadowKey={`ornament-${params.ornamentShape}-${params.ornamentDiameter}-${params.ornamentHeight}-${params.ornamentWall}-${params.ornamentLoop}`}
        />
      ) : params.model === "wall_hook" ? (
        <ZUpModel
          color="#94a3b8"
          footprint={framing.footprint}
          geometry={geometry}
          height={framing.height}
          shadowKey={`hook-${params.hookMount}-${params.hookWidth}-${params.hookHeight}-${params.hookDepth}`}
        />
      ) : params.model === "cup_clip" ? (
        <ZUpModel
          color="#2dd4bf"
          footprint={framing.footprint}
          geometry={geometry}
          height={framing.height}
          shadowKey={`cup-clip-${params.cupRim}-${params.cupClipWidth}-${params.cupClipLength}-${params.cupClipHook}`}
        />
      ) : params.model === "stencil" ? (
        <ZUpModel
          color="#a3e635"
          footprint={framing.footprint}
          geometry={geometry}
          height={framing.height}
          shadowKey={`stencil-${params.stencilPattern}-${params.stencilWidth}-${params.stencilHeight}-${params.stencilThickness}`}
        />
      ) : params.model === "cipher_box" ? (
        <ZUpModel
          color="#f0abfc"
          footprint={framing.footprint}
          geometry={geometry}
          height={framing.height}
          shadowKey={`cipher-${params.cipherSize}-${params.cipherWord}-${params.cipherInserts}-${params.cipherLidText}`}
        />
      ) : params.model === "gift_box" ? (
        <ZUpModel
          color="#fdba74"
          footprint={framing.footprint}
          geometry={geometry}
          height={framing.height}
          shadowKey={`gift-${params.giftSize}-${params.giftShape}-${params.giftScrewLock}-${params.giftFalseBottom}-${params.giftMazeLock}`}
        />
      ) : (
        <SignModel
          baseMount={params.signBaseMount}
          blockSize={params.signBlockSize}
          channelWidth={params.signChannelWidth}
          depth={params.signDepth}
          fontSize={params.signFontSize}
          geometry={geometry}
          letterGap={params.signLetterGap}
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
  /**
   * Брелок, вывеска и шкатулка с кодом подписываются шрифтом, остальным моделям
   * он не нужен. У вывески шрифт выбирает пользователь, поэтому путь зависит от
   * signFont: смена шрифта в панели загружает другой JSON. Шкатулке подходит тот
   * же кириллический шрифт, что и брелоку: буквы кода и надпись на крышке —
   * обычный текст.
   */
  const fontUrl =
    params.model === "sign"
      ? SIGN_FONT_URLS[params.signFont]
      : params.model === "keychain"
        ? KEYCHAIN_FONT_URL
        : params.model === "cipher_box"
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

    if (params.model === "clips") {
      return createClipsGeometry(params);
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

    if (params.model === "fabric_patch") {
      return createFabricPatchGeometry(params);
    }

    if (params.model === "string_light") {
      return createStringLightGeometry(params);
    }

    if (params.model === "ornament") {
      return createOrnamentGeometry(params);
    }

    if (params.model === "wall_hook") {
      return createWallHookGeometry(params);
    }

    if (params.model === "cup_clip") {
      return createCupClipGeometry(params);
    }

    if (params.model === "stencil") {
      return createStencilGeometry(params);
    }

    if (params.model === "cipher_box") {
      return createCipherBoxGeometry(params, font);
    }

    if (params.model === "gift_box") {
      return createGiftBoxGeometry(params);
    }

    return createVaseGeometry(createVaseProfile(params), params);
  }, [font, lithophanePreviewBrightness, params]);

  // Старая сетка живёт в GPU-буфере: без dispose каждая правка слайдера
  // оставляла бы мусор до перезагрузки страницы.
  useEffect(() => () => geometry.dispose(), [geometry]);

  /**
   * Габариты для камеры и подписи. У вывески ширина и высота зависят от
   * надписи, у подставки — от наклона, поэтому их берём из готовой сетки.
   * Остальные модели считаются по параметрам: bounding box совпадает со
   * слайдерами с точностью до амплитуды узора.
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

    if (params.model === "stencil") {
      geometry.computeBoundingBox();
      const box = geometry.boundingBox;

      // Трафарет лежит на столе плашмя, как брелок: иначе тонкая плита видна
      // почти с ребра и прорези узора не читаются.
      return {
        height: box ? Math.max(box.max.z - box.min.z, 1) : 1,
        footprint: box
          ? Math.max(box.max.x - box.min.x, box.max.y - box.min.y, 1)
          : 1,
        flat: true,
      };
    }

    if (
      params.model === "stand" ||
      params.model === "clips" ||
      params.model === "planter" ||
      params.model === "coaster" ||
      params.model === "jewelry_stand" ||
      params.model === "pen_holder" ||
      params.model === "fabric_patch" ||
      params.model === "string_light" ||
      params.model === "ornament" ||
      params.model === "wall_hook" ||
      params.model === "cup_clip" ||
      params.model === "cipher_box" ||
      params.model === "gift_box"
    ) {
      geometry.computeBoundingBox();
      const box = geometry.boundingBox;

      // Подставка, клипсы, кашпо, подставка под кружку, стойка украшений,
      // органайзер для ручек, нашивка, плафоны, игрушка, крючок, клипса
      // кружки, шкатулка с кодом и подарочная коробка построены Z-вверх:
      // после поворота меша высотой становится Z,
      // а длиной и шириной — X и Y.
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
          : params.model === "clips"
            ? `${Math.round(framing.footprint)} × ${Math.round(framing.height)} мм`
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
                      : params.model === "fabric_patch"
                        ? `${params.patchSize} × ${params.patchThickness.toFixed(1)} мм`
                        : params.model === "string_light"
                          ? `${Math.round(framing.footprint)} × ${params.lightHeight} мм`
                          : params.model === "ornament"
                            ? `${params.ornamentDiameter} × ${params.ornamentHeight} мм`
                            : params.model === "wall_hook"
                              ? `${params.hookWidth} × ${params.hookHeight} × ${params.hookDepth} мм`
                              : params.model === "cup_clip"
                                ? `${params.cupClipWidth} × ${params.cupClipLength} мм`
                                : params.model === "stencil"
                                  ? `${params.stencilWidth} × ${params.stencilHeight} × ${params.stencilThickness.toFixed(1)} мм`
                                  : params.model === "cipher_box"
                                    ? `${params.cipherSize} × ${Math.round(framing.height)} мм`
                                    : params.model === "gift_box"
                                      ? `${params.giftSize} × ${Math.round(framing.height)} мм`
                                      : `${Math.round(framing.footprint)} × ${Math.round(framing.height)} мм`;

  const ariaLabel =
    params.model === "vase"
      ? `3D-предпросмотр вазы высотой ${params.height} миллиметров и диаметром ${params.diameter} миллиметров, узор «${VASE_PATTERN_LABELS[params.pattern]}»`
      : params.model === "keychain"
        ? `3D-предпросмотр брелока ${params.length} на ${params.width} миллиметров, форма «${KEYCHAIN_SHAPE_LABELS[params.shapeType]}», имя «${params.text.trim() || "без имени"}»`
        : params.model === "stand"
          ? `3D-предпросмотр подставки под телефон шириной ${params.standWidth} миллиметров, наклон ${params.standAngle} градусов, толщина телефона ${params.phoneThickness} миллиметров`
          : params.model === "clips"
            ? `3D-предпросмотр набора клипс: ${params.clipCount} зажимов под кабель диаметром ${params.cableDiameter} миллиметров с шагом ${params.clipSpacing} миллиметров`
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
                      : params.model === "fabric_patch"
                        ? `3D-предпросмотр нашивки «${PATCH_SHAPE_LABELS[params.patchShape]}» ${params.patchSize} миллиметров, толщина ${params.patchThickness} миллиметров, ${params.patchBorder ? "с бортиком" : "без бортика"}, ${params.patchStitches} стежков`
                        : params.model === "string_light"
                          ? `3D-предпросмотр плафонов для гирлянды: ${params.lightCount} штук, раструб ${params.lightDiameter} миллиметров, высота ${params.lightHeight} миллиметров, отверстие под цоколь ${params.lightSocket} миллиметров`
                          : params.model === "ornament"
                            ? `3D-предпросмотр ёлочной игрушки «${ORNAMENT_SHAPE_LABELS[params.ornamentShape]}» диаметром ${params.ornamentDiameter} миллиметров и высотой ${params.ornamentHeight} миллиметров, стенка ${params.ornamentWall} миллиметров, ${params.ornamentLoop ? "с кольцом под ленту" : "без кольца"}`
                            : params.model === "wall_hook"
                              ? `3D-предпросмотр настенного крючка: плита ${params.hookWidth} на ${params.hookHeight} миллиметров, вынос штыря ${params.hookDepth} миллиметров, крепление «${WALL_HOOK_MOUNT_LABELS[params.hookMount]}»`
                              : params.model === "cup_clip"
                                ? `3D-предпросмотр клипсы для кружки: борт ${params.cupRim} миллиметров, ширина ${params.cupClipWidth} миллиметров, наружная ножка ${params.cupClipLength} миллиметров, ${params.cupClipHook ? "с прорезью под нитку" : "без прорези"}`
                                : params.model === "stencil"
                                  ? `3D-предпросмотр трафарета «${STENCIL_PATTERN_LABELS[params.stencilPattern]}» ${params.stencilWidth} на ${params.stencilHeight} миллиметров, толщина ${params.stencilThickness} миллиметров`
                                  : params.model === "cipher_box"
                                    ? `3D-предпросмотр шкатулки с кодовым замком: корпус ${params.cipherSize} миллиметров, код «${params.cipherWord}», ${Array.from(params.cipherWord).length} кольца, ${params.cipherLidText ? `надпись на крышке «${params.cipherLidText}»` : "крышка без надписи"}`
                                    : params.model === "gift_box"
                                      ? `3D-предпросмотр подарочной коробки «${GIFT_BOX_SHAPE_LABELS[params.giftShape]}» ${params.giftSize} миллиметров, замки: ${[params.giftScrewLock ? "винт" : null, params.giftFalseBottom ? "двойное дно" : null, params.giftMazeLock ? "лабиринт" : null].filter((lock) => lock !== null).join(", ") || "нет"}`
                                      : `3D-предпросмотр вывески шириной ${Math.round(framing.footprint)} и высотой ${Math.round(framing.height)} миллиметров, надпись «${params.signText.trim() || "без надписи"}», канал ${params.signChannelWidth} миллиметров`;

  return (
    <div className="relative h-[24rem] w-full max-w-full overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-blue-900 to-slate-900 shadow-2xl shadow-blue-950/50 sm:h-[32rem] lg:h-[38rem]">
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
        gl={{ antialias: true, alpha: true }}
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
        <span className="flex flex-wrap items-center gap-x-2">
          <span>{sizeLabel}</span>
          <span aria-hidden className="text-slate-600">
            •
          </span>
          <span>Вес пластика: ~{materialWeightGrams.toFixed(1)} г</span>
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
