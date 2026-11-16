import { ImageResponse } from "next/og";

/**
 * Картинка превью для соцсетей и мессенджеров.
 *
 * Next.js сам подставляет её в og:image и twitter:image всех страниц. Рисуем
 * абстрактный тёмно-синий кадр с логотипом TriDi: он не зависит от внешних
 * файлов и всегда отдаётся как PNG 1200×630.
 *
 * Надписи на картинке латиницей: встроенный в ImageResponse шрифт не содержит
 * кириллицы, и русский текст отрисовался бы пустыми прямоугольниками. Alt при
 * этом русский — его читают поисковики и скринридеры, а не рендерер.
 */
export const alt = "TriDi — Конструктор 3D и генератор по фото";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          padding: "64px 72px",
          position: "relative",
          overflow: "hidden",
          background:
            "linear-gradient(135deg, #020617 0%, #0f172a 55%, #1e1b4b 100%)",
          color: "#f8fafc",
          fontFamily: "sans-serif",
        }}
      >
        {/* Абстрактные окружности вместо стоковой картинки. */}
        <div
          style={{
            position: "absolute",
            top: "-190px",
            right: "-110px",
            width: "620px",
            height: "620px",
            display: "flex",
            borderRadius: "50%",
            border: "1px solid rgba(96, 165, 250, 0.35)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "-70px",
            right: "10px",
            width: "380px",
            height: "380px",
            display: "flex",
            borderRadius: "50%",
            border: "1px solid rgba(167, 139, 250, 0.3)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-170px",
            left: "-90px",
            width: "440px",
            height: "440px",
            display: "flex",
            borderRadius: "50%",
            background: "rgba(37, 99, 235, 0.18)",
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            height: "100%",
            position: "relative",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
            <div
              style={{
                width: "74px",
                height: "74px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "20px",
                background: "#0055FF",
              }}
            >
              <div
                style={{
                  width: "34px",
                  height: "34px",
                  display: "flex",
                  borderRadius: "9px",
                  border: "7px solid #ffffff",
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                fontSize: "50px",
                fontWeight: 800,
                letterSpacing: "-1px",
              }}
            >
              <span>tridi</span>
              <span style={{ color: "#93c5fd" }}>-print</span>
              <span
                style={{
                  marginLeft: "6px",
                  fontSize: "24px",
                  color: "#94a3b8",
                }}
              >
                .ru
              </span>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              maxWidth: "940px",
            }}
          >
            <div
              style={{
                fontSize: "76px",
                fontWeight: 800,
                letterSpacing: "-3px",
                lineHeight: 1,
              }}
            >
              3D models from photos
            </div>
            <div
              style={{
                fontSize: "76px",
                fontWeight: 800,
                letterSpacing: "-3px",
                lineHeight: 1,
                color: "#bfdbfe",
              }}
            >
              or from parameters.
            </div>
            <div
              style={{
                fontSize: "76px",
                fontWeight: 800,
                letterSpacing: "-3px",
                lineHeight: 1,
              }}
            >
              Ready-to-print STL.
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: "26px",
              color: "#cbd5e1",
            }}
          >
            <div style={{ display: "flex", gap: "10px" }}>
              <span>10 model types</span>
              <span style={{ color: "#64748b" }}>·</span>
              <span>AI generation</span>
              <span style={{ color: "#64748b" }}>·</span>
              <span>ready STL</span>
            </div>
            <div
              style={{
                display: "flex",
                padding: "10px 20px",
                borderRadius: "999px",
                border: "1px solid rgba(255, 255, 255, 0.18)",
                color: "#e2e8f0",
              }}
            >
              tridi-print.ru
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
