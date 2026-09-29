import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * «Прозвонка цепи»: сверху целая цепь — бегущий импульс и звук, снизу обрыв —
 * тишина, крестик на разрыве и бесконечность на дисплее. Акцент по кругу
 * переходит от верхнего состояния к нижнему и обратно.
 */
export function ProC2C22Animation0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Два состояния прозвонки цепи, которые чередуются по кругу: целая цепь — мультиметр пищит, по проводу бежит зелёный импульс, рядом звучит волна и на дисплее 0 Ом; обрыв — прибор молчит, на дисплее бесконечность, разрыв отмечен красным крестиком и волна звука зачёркнута."
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <style>{`
          .v-c2b-flow { animation: v-c2b-flow 4.6s linear infinite; }
          .v-c2b-wave { animation: v-c2b-wave 4.6s ease-in-out infinite; }
          .v-c2b-mark { animation: v-c2b-mark 4.6s ease-in-out infinite; }
          .v-c2b-panel-a { animation: v-c2b-panel-a 4.6s ease-in-out infinite; }
          .v-c2b-panel-b { animation: v-c2b-panel-b 4.6s ease-in-out infinite; }
          @keyframes v-c2b-flow {
            0% { stroke-dashoffset: 0; opacity: 1; }
            42% { stroke-dashoffset: -24; opacity: 1; }
            58%, 92% { stroke-dashoffset: -24; opacity: 0.25; }
            100% { stroke-dashoffset: 0; opacity: 1; }
          }
          @keyframes v-c2b-wave {
            0%, 42% { opacity: 1; }
            58%, 92% { opacity: 0.25; }
            100% { opacity: 1; }
          }
          @keyframes v-c2b-mark {
            0%, 42% { opacity: 0.25; }
            58%, 92% { opacity: 1; }
            100% { opacity: 0.25; }
          }
          @keyframes v-c2b-panel-a {
            0%, 42% { stroke: #34d399; }
            58%, 92% { stroke: #475569; }
            100% { stroke: #34d399; }
          }
          @keyframes v-c2b-panel-b {
            0%, 42% { stroke: #475569; }
            58%, 92% { stroke: #f87171; }
            100% { stroke: #475569; }
          }
          @media (prefers-reduced-motion: reduce) {
            .v-c2b-flow, .v-c2b-wave, .v-c2b-mark, .v-c2b-panel-a, .v-c2b-panel-b { animation: none; }
            .v-c2b-flow { stroke-dashoffset: 0; opacity: 1; }
            .v-c2b-wave, .v-c2b-mark { opacity: 1; }
            .v-c2b-panel-a { stroke: #34d399; }
            .v-c2b-panel-b { stroke: #f87171; }
          }
        `}</style>

        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="14" fontSize="10" fill="#94a3b8">
          Прозвонка цепи: пищит или молчит
        </text>

        {/* Верхнее состояние: целая цепь */}
        <rect x="12" y="24" width="296" height="64" rx="8" fill="#0f172a" stroke="#475569" strokeWidth="1.4" className="v-c2b-panel-a" />
        <text x="24" y="40" fontSize="9" fill="#34d399">
          цепь целая
        </text>
        <rect x="24" y="46" width="86" height="30" rx="4" fill="#1e293b" stroke="#475569" />
        <text x="30" y="54" fontSize="8" fill="#94a3b8">
          пищит
        </text>
        <text x="30" y="72" fontSize="14" fill="#34d399" fontWeight="600">
          0 Ом
        </text>
        <line x1="126" y1="64" x2="250" y2="64" stroke="#34d399" strokeWidth="2.4" />
        <line
          x1="126"
          y1="64"
          x2="250"
          y2="64"
          stroke="#bbf7d0"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeDasharray="6 18"
          className="v-c2b-flow"
        />
        <line x1="126" y1="64" x2="138" y2="44" stroke="#e2e8f0" strokeWidth="2.2" />
        <line x1="250" y1="64" x2="238" y2="44" stroke="#e2e8f0" strokeWidth="2.2" />
        <polygon points="258,54 266,54 274,46 274,82 266,74 258,74" fill="#334155" stroke="#94a3b8" strokeWidth="1.2" />
        <path d="M280,57 A10,10 0 0 1 280,71" fill="none" stroke="#34d399" strokeWidth="2" className="v-c2b-wave" />
        <path d="M286,52 A16,16 0 0 1 286,76" fill="none" stroke="#34d399" strokeWidth="2" className="v-c2b-wave" />
        {/* Нижнее состояние: обрыв */}
        <rect x="12" y="96" width="296" height="64" rx="8" fill="#0f172a" stroke="#475569" strokeWidth="1.4" className="v-c2b-panel-b" />
        <text x="24" y="112" fontSize="9" fill="#f87171">
          обрыв
        </text>
        <rect x="24" y="118" width="86" height="30" rx="4" fill="#1e293b" stroke="#475569" />
        <text x="30" y="126" fontSize="8" fill="#94a3b8">
          молчит
        </text>
        <text x="30" y="144" fontSize="14" fill="#f87171" fontWeight="600">
          ∞
        </text>
        <line x1="126" y1="136" x2="176" y2="136" stroke="#94a3b8" strokeWidth="2.4" />
        <line x1="200" y1="136" x2="250" y2="136" stroke="#94a3b8" strokeWidth="2.4" />
        <line x1="126" y1="136" x2="138" y2="116" stroke="#e2e8f0" strokeWidth="2.2" />
        <line x1="250" y1="136" x2="238" y2="116" stroke="#e2e8f0" strokeWidth="2.2" />
        <line x1="178" y1="126" x2="198" y2="146" stroke="#f87171" strokeWidth="2.4" className="v-c2b-mark" />
        <line x1="198" y1="126" x2="178" y2="146" stroke="#f87171" strokeWidth="2.4" className="v-c2b-mark" />
        <polygon points="258,126 266,126 274,118 274,154 266,146 258,146" fill="#334155" stroke="#94a3b8" strokeWidth="1.2" />
        <path d="M280,129 A10,10 0 0 1 280,143" fill="none" stroke="#475569" strokeWidth="2" />
        <path d="M286,124 A16,16 0 0 1 286,148" fill="none" stroke="#475569" strokeWidth="2" />
        <line x1="296" y1="120" x2="272" y2="152" stroke="#f87171" strokeWidth="2.4" className="v-c2b-mark" />
      </svg>
    </VisualWrapper>
  );
}
