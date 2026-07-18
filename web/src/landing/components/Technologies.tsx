import React from "react";

const TECHS = [
  {
    name: "Blender",
    glyph: (
      <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M12 3.5 L4 9 L4 19 a1 1 0 0 0 1 1 h14 a1 1 0 0 0 1 -1 V9 Z" strokeLinejoin="round" />
        <circle cx="12" cy="13" r="3" />
        <path d="M9.5 13 a2.5 2.5 0 0 1 4 -2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    name: "Three.js",
    glyph: (
      <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.4">
        <polygon points="12,3 21,8 21,16 12,21 3,16 3,8" strokeLinejoin="round" />
        <path d="M12 3 V21 M3 8 L21 16 M21 8 L3 16" strokeLinejoin="round" opacity="0.5" />
      </svg>
    ),
  },
  {
    name: "WebGL",
    glyph: (
      <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.4">
        <circle cx="12" cy="12" r="8" />
        <ellipse cx="12" cy="12" rx="8" ry="3.5" />
        <path d="M12 4 V20" />
      </svg>
    ),
  },
  {
    name: "React",
    glyph: (
      <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.3">
        <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
        <ellipse cx="12" cy="12" rx="10" ry="4" />
        <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)" />
        <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)" />
      </svg>
    ),
  },
  {
    name: "Remotion",
    glyph: (
      <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.4">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M10 9 L15 12 L10 15 Z" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
];

export default function Technologies() {
  return (
    <section id="technology" className="border-t hairline border-white/10">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-10 py-24 lg:py-32">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 mb-14">
          <div className="lg:col-span-4">
            <span className="font-mono-label"><span className="text-royal-blue">04</span> <span className="text-slate-400">/ Technology</span></span>
          </div>
          <div className="lg:col-span-8">
            <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold tracking-[-0.03em] text-white text-balance">
              Built on professional-grade infrastructure.
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 border-t border-l hairline border-white/10">
          {TECHS.map((t) => (
            <div
              key={t.name}
              className="group flex flex-col items-center justify-center gap-3 border-r border-b hairline border-white/10 py-12 transition-colors duration-300 hover:bg-white/[0.02]"
            >
              <div className="text-white transition-all duration-500 group-hover:text-royal-blue group-hover:-translate-y-1 group-hover:rotate-3">
                {t.glyph}
              </div>
              <span className="font-mono-label text-slate-400 group-hover:text-white transition-colors duration-300">{t.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}