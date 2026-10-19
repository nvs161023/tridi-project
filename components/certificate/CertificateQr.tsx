"use client";

import { QRCodeSVG } from "qrcode.react";

type CertificateQrProps = {
  /** Публичная ссылка /verify/[id], которая кодируется в QR. */
  value: string;
  className?: string;
};

/**
 * QR-код сертификата.
 *
 * `qrcode.react` использует хуки, поэтому компонент помечен как клиентский:
 * страница сертификата — async server component и не может вызывать хуки сама.
 * Рендерим именно SVG, а не canvas: он остаётся резким при печати и в PDF,
 * масштабируется без потери качества и не зависит от devicePixelRatio.
 *
 * Белое поле вокруг кода — обязательная «тихая зона» для сканеров. Уровень
 * коррекции M позволяет прочитать код даже на слегка помятом или заламинированном
 * листе.
 */
export function CertificateQr({ value, className = "" }: CertificateQrProps) {
  return (
    <div
      className={`overflow-hidden rounded-[2px] bg-white shadow-[0_0_0_1px_rgba(255,255,255,0.18)] ${className}`}
    >
      <QRCodeSVG
        value={value}
        size={160}
        level="M"
        marginSize={4}
        bgColor="#ffffff"
        fgColor="#0f172a"
        title="QR-код для публичной проверки сертификата TriDi"
        className="block h-auto w-full"
      />
    </div>
  );
}
