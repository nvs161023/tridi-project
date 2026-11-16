"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import { ACESFilmicToneMapping, type BufferGeometry } from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";

/**
 * 3D-предпросмотр готовой модели из «мясорубки».
 *
 * Роут `/api/generated-stl/[file]` отдаёт уже собранный печатный STL в
 * миллиметрах, поэтому камера и свет считаются от габарита самой сетки:
 * `STLLoader` читает буфер, `center()` ставит модель в начало координат, а
 * bounding sphere задают расстояние камеры — ваза на 120 мм и сувенир на 40 мм
 * попадают в кадр одинаково.
 *
 * Сцена грузится только в браузере: генератор подключает модуль через
 * `next/dynamic` с `ssr: false`, как и основная сцена конструктора.
 */

type GeneratedModelViewerProps = {
  /** Ссылка на готовый STL — та же, что в кнопке «Скачать STL». */
  url: string;
};

/** Подсказка вместо канваса, пока сетка не загружена или упала. */
function ViewerPlaceholder({
  message,
  tone,
}: {
  message: string;
  tone: "loading" | "error";
}) {
  return (
    <div
      aria-live={tone === "error" ? "assertive" : "polite"}
      className="flex h-64 items-center justify-center px-4 text-center"
      role={tone === "error" ? "alert" : "status"}
    >
      <p
        className={
          tone === "error"
            ? "max-w-xs text-sm leading-relaxed text-rose-200"
            : "max-w-xs text-sm leading-relaxed text-slate-300"
        }
      >
        {tone === "loading" ? `🌀 ${message}` : message}
      </p>
    </div>
  );
}

export function GeneratedModelViewer({ url }: GeneratedModelViewerProps) {
  const [geometry, setGeometry] = useState<BufferGeometry | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    setGeometry(null);
    setFailed(false);

    const load = async () => {
      try {
        const response = await fetch(url, { signal: controller.signal });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const buffer = await response.arrayBuffer();
        const parsed = new STLLoader().parse(buffer);

        // Модель из сети стоит где угодно: центр ставим в начало координат,
        // чтобы вращение шло вокруг неё, а не вокруг угла стола.
        parsed.center();
        parsed.computeVertexNormals();

        if (cancelled) {
          parsed.dispose();
          return;
        }

        setGeometry(parsed);
      } catch {
        if (!cancelled) {
          setFailed(true);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [url]);

  // Буферы three.js живут в памяти GPU: освобождаем их при смене модели.
  useEffect(() => () => geometry?.dispose(), [geometry]);

  /** Радиус модели: от него зависят камера, свет и пределы зума. */
  const radius = useMemo(() => {
    if (!geometry) {
      return 0;
    }

    geometry.computeBoundingSphere();

    return geometry.boundingSphere?.radius || 1;
  }, [geometry]);

  if (failed) {
    return (
      <ViewerPlaceholder
        message="Не удалось показать модель. Файл можно скачать кнопкой ниже."
        tone="error"
      />
    );
  }

  if (!geometry) {
    return <ViewerPlaceholder message="Загружаем модель…" tone="loading" />;
  }

  return (
    <Canvas
      camera={{
        far: radius * 40,
        fov: 35,
        near: radius / 20,
        position: [radius * 1.5, radius * 1.1, radius * 1.9],
      }}
      dpr={[1, 1.75]}
      fallback={
        <div className="flex h-full items-center justify-center p-6 text-center">
          <p className="max-w-sm text-sm leading-relaxed text-slate-300">
            Браузер не поддерживает WebGL, поэтому 3D-предпросмотр недоступен.
            Скачайте STL и откройте его в слайсере.
          </p>
        </div>
      }
      gl={{
        alpha: true,
        antialias: true,
        toneMapping: ACESFilmicToneMapping,
        toneMappingExposure: 0.92,
      }}
    >
      <color args={["#0b1120"]} attach="background" />
      <ambientLight intensity={0.9} />
      <hemisphereLight args={["#dbeafe", "#0b1120", 0.8]} />
      <directionalLight
        intensity={2.2}
        position={[radius * 2, radius * 3, radius * 2]}
      />

      <mesh geometry={geometry}>
        <meshStandardMaterial
          color="#dbe3ee"
          metalness={0.1}
          roughness={0.55}
        />
      </mesh>

      <OrbitControls
        autoRotate
        autoRotateSpeed={0.9}
        dampingFactor={0.08}
        enableDamping
        enablePan={false}
        makeDefault
        maxDistance={radius * 8}
        minDistance={radius * 1.3}
        rotateSpeed={0.8}
        zoomSpeed={0.8}
      />
    </Canvas>
  );
}
