import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Play, ArrowUpRight, Box, Layers, Download, Sparkles } from "lucide-react";

const PROMPT_TEXT = "A windswept dune field at dusk, low poly terrain, sharp shadows";

function useTyped(text: string, speed = 38, startDelay = 600) {
  const [out, setOut] = useState("");
  useEffect(() => {
    let i = 0;
    let timer: ReturnType<typeof setInterval>;
    const start = setTimeout(() => {
      timer = setInterval(() => {
        i++;
        setOut(text.slice(0, i));
        if (i >= text.length) clearInterval(timer);
      }, speed);
    }, startDelay);
    return () => {
      clearTimeout(start);
      clearInterval(timer);
    };
  }, [text, speed, startDelay]);
  return out;
}

export default function Hero() {
  const typed = useTyped(PROMPT_TEXT);

  return (
    <section id="top" className="relative pt-32 pb-24 lg:pt-40 lg:pb-32">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-10">
        {/* Eyebrow */}
        <div className="flex items-center gap-2 mb-8 animate-fade-up">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-royal-blue opacity-50 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-royal-blue" />
          </span>
          <span className="font-mono-label text-slate-400">v1.0</span>
          <span className="h-px w-8 bg-royal-blue/40" />
          <span className="font-mono-label text-white">Code-First 3D Engine</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Editorial stack */}
          <div className="lg:col-span-5 animate-fade-up" style={{ animationDelay: "0.1s" }}>
            <h1 className="font-heading text-[2.75rem] leading-[1.02] sm:text-6xl lg:text-[4.25rem] font-bold tracking-[-0.04em] text-white text-balance">
              Create 3D Worlds From a{' '}
              <span className="relative group inline-block cursor-pointer select-none">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-blue-300 to-blue-400 transition-all duration-700 ease-out inline-block">
                  Prompt
                </span>
                <svg className="absolute -bottom-1 left-0 w-full" height="8" viewBox="0 0 200 8" preserveAspectRatio="none" fill="none">
                  <path d="M2 5 C 50 2, 150 2, 198 5" stroke="#60A5FA" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
                <span
                  className="pointer-events-none absolute inset-0 rounded bg-gradient-to-r from-blue-400/0 via-blue-300/30 to-blue-400/0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 animate-shimmer"
                  style={{ mixBlendMode: 'overlay' }}
                />
              </span>
            </h1>
            <p className="mt-6 max-w-md text-base lg:text-lg leading-relaxed text-slate-400">
              No meshes. No black-box AI assets. Every scene is pure Three.js
              code you can read, edit, tune with sliders, and export as .glb,
              .obj, or .stl for any pipeline.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                to="/model"
                className="inline-flex items-center gap-2 rounded-md bg-royal-blue px-5 py-3 text-sm font-medium text-white transition-all duration-300 hover:bg-blue-500 hover:rounded-xl"
              >
                Get Started
                <ArrowUpRight className="h-4 w-4" />
              </Link>
              <a
                href="#workflow"
                className="inline-flex items-center gap-2 rounded-md border hairline border-white/20 px-5 py-3 text-sm font-medium text-white transition-all duration-300 hover:border-white/40 hover:bg-white/5"
              >
                <Play className="h-3.5 w-3.5 fill-white" />
                Watch Demo
              </a>
            </div>

            <div className="mt-10 flex items-center gap-6 font-mono-label text-slate-400">
              <span>Three.js</span>
              <span className="h-3 w-px bg-white/20" />
              <span>WebGL</span>
              <span className="h-3 w-px bg-white/20" />
              <span className="text-royal-blue">Remotion</span>
            </div>
          </div>

          {/* Product mockup */}
          <div className="lg:col-span-7 animate-fade-up" style={{ animationDelay: "0.25s" }}>
            <ProductMockup typed={typed} />
          </div>
        </div>
      </div>
    </section>
  );
}

function ProductMockup({ typed }: { typed: string }) {
  const [activeTab, setActiveTab] = useState<'Model' | 'Video' | 'Export'>('Model');
  const [sliderValues, setSliderValues] = useState({ headSize: 72, armLength: 55, legLength: 65, roughness: 35 });
  const [activeSlider, setActiveSlider] = useState<string | null>(null);

  const handleSliderChange = (name: string, e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.round(Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)));
    setSliderValues(prev => ({ ...prev, [name]: pct }));
  };

  return (
    <div className="relative">
      <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0d0d0f] shadow-[0_1px_2px_rgba(0,0,0,0.3),0_32px_64px_-16px_rgba(0,0,0,0.6)] overflow-hidden">
        {/* Top nav - matches real TopNav */}
        <div className="flex items-center gap-4 border-b border-[rgba(255,255,255,0.08)] bg-[#151517] px-3 py-2">
          <span className="text-[11px] font-semibold text-[#f4f4f5] tracking-wide">zendai</span>
          <nav className="flex gap-0.5">
            {(['Model', 'Video', 'Export'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  activeTab === tab
                    ? 'bg-[#1a1a1d] text-[#f4f4f5]'
                    : 'text-[#a8a8b0] hover:text-[#f4f4f5] hover:bg-[#1a1a1d]/60'
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
          <div className="flex-1" />
          <button className="rounded-md bg-[#4da3ff] px-2 py-0.5 text-[10px] font-medium text-[#0a1220] hover:bg-[#74b8ff] transition-colors">
            Log in
          </button>
        </div>

        {/* Main body: sidebar + viewport */}
        <div className="grid grid-cols-[170px_1px_1fr]">
          {/* Left sidebar */}
          <div className="flex flex-col bg-[#151517]">
            {/* Chat section */}
            <div className="p-2.5 flex flex-col gap-2" style={{ height: 130 }}>
              <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.11em] text-[#74757d]">Model chat</span>
              <div className="flex-1 flex flex-col gap-1 overflow-hidden">
                <p className="m-0 text-[9px] leading-snug text-[#74757d]">Generate builds a new model. Modify edits the current one.</p>
              </div>
              {/* Composer */}
              <div className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0d0d0f] overflow-hidden">
                <div className="px-2 py-1.5 text-[10px] text-[#f4f4f5] leading-tight min-h-[28px]">
                  <span>{typed.slice(0, 36)}</span>
                  <span className="inline-block w-px h-3 bg-white/80 align-middle ml-0.5 animate-pulse" />
                </div>
                <div className="flex items-center justify-end gap-1 px-1.5 pb-1.5">
                  <button className="rounded-md px-2 py-0.5 text-[9px] text-[#a8a8b0] hover:text-[#f4f4f5] hover:bg-[#222226] transition-colors">Modify</button>
                  <button className="rounded-md bg-[#4da3ff] px-2 py-0.5 text-[9px] font-medium text-[#0a1220]">Generate</button>
                </div>
              </div>
            </div>

            {/* Resize handle */}
            <div className="h-px bg-[rgba(255,255,255,0.08)]" />

            {/* Models & Layers */}
            <div className="p-2.5 flex-1 flex flex-col gap-2">
              <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.11em] text-[#74757d]">Models & Layers</span>
              <div className="space-y-1.5">
                {/* Active model */}
                <div className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#222226] px-2 py-1.5 flex items-center gap-1.5">
                  <Box className="h-3 w-3 text-[#4da3ff] shrink-0" />
                  <span className="text-[10px] text-[#4da3ff] font-medium truncate flex-1">Component figure</span>
                  <span className="text-[9px] text-[#74757d] border border-[rgba(255,255,255,0.08)] rounded-full px-1">6</span>
                </div>
                {/* Layers (expanded) */}
                <div className="pl-5 space-y-0.5">
                  {['head', 'torso', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'].map((layer) => (
                    <div key={layer} className="text-[9px] font-mono text-[#a8a8b0] py-0.5 truncate">{layer}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Resize handle */}
          <div className="bg-[rgba(255,255,255,0.08)] hover:bg-[#4da3ff] transition-colors cursor-col-resize" />

          {/* 3D Viewport */}
          <div className="relative bg-[#0d0d0f] overflow-hidden" style={{ minHeight: 280 }}>
            <ViewportGrid />
            <Viewport3D scale={sliderValues.headSize / 72} />

            {/* Floating controls popup */}
            <div className="absolute top-3 right-3 w-[130px] rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#151517] shadow-[0_12px_32px_rgba(0,0,0,0.45)] overflow-hidden">
              <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-[rgba(255,255,255,0.08)] bg-[#1a1a1d]">
                <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.09em] text-[#a8a8b0]">Component figure</span>
              </div>
              <div className="p-2 space-y-2.5">
                {[
                  { key: 'headSize', label: 'Head size' },
                  { key: 'armLength', label: 'Arm length' },
                  { key: 'legLength', label: 'Leg length' },
                  { key: 'roughness', label: 'Roughness' },
                ].map((s) => (
                  <div key={s.key}>
                    <div className="flex justify-between mb-1">
                      <span className="text-[9px] text-[#74757d]">{s.label}</span>
                      <span className="text-[9px] text-[#a8a8b0] font-mono tabular-nums">{(sliderValues[s.key as keyof typeof sliderValues] / 100).toFixed(2)}</span>
                    </div>
                    <div
                      className="h-1.5 rounded-full bg-[rgba(255,255,255,0.06)] cursor-pointer relative group"
                      onMouseDown={(e) => { setActiveSlider(s.key); handleSliderChange(s.key, e); }}
                      onMouseMove={(e) => { if (activeSlider === s.key && e.buttons === 1) handleSliderChange(s.key, e); }}
                      onMouseUp={() => setActiveSlider(null)}
                      onMouseLeave={() => setActiveSlider(null)}
                    >
                      <div className="h-full rounded-full bg-[#4da3ff] transition-[width] duration-75" style={{ width: `${sliderValues[s.key as keyof typeof sliderValues]}%` }} />
                      <div
                        className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white border-2 border-[#4da3ff] shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ left: `calc(${sliderValues[s.key as keyof typeof sliderValues]}% - 5px)` }}
                      />
                    </div>
                  </div>
                ))}
                <button className="w-full mt-0.5 flex items-center justify-center gap-1 rounded-md border border-dashed border-[rgba(255,255,255,0.14)] py-1 text-[9px] text-[#74757d] hover:border-[#a8a8b0] hover:text-[#a8a8b0] transition-colors">
                  + Add custom slider
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ViewportGrid() {
  return (
    <div className="absolute inset-0 opacity-[0.5]">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-royal-blue/20" />
      <div className="absolute top-1/2 left-0 right-0 h-px bg-royal-blue/20" />
    </div>
  );
}

function Viewport3D({ scale = 1 }: { scale?: number }) {
  const headScale = 0.8 + scale * 0.4;
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <svg viewBox="0 0 300 240" className="w-[72%] h-auto" fill="none">
        {/* Ground circle */}
        <ellipse cx="150" cy="200" rx="80" ry="12" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />

        {/* Torso */}
        <g transform="translate(150, 125)">
          <path d="M-18,-28 L18,-28 L18,18 L-18,18 Z" fill="#4da3ff" opacity="0.55" stroke="#74b8ff" strokeWidth="0.7" />
          <path d="M18,-28 L28,-34 L28,12 L18,18 Z" fill="#3b82f6" opacity="0.4" stroke="#74b8ff" strokeWidth="0.4" />
          <path d="M-18,-28 L-8,-34 L28,-34 L18,-28 Z" fill="#93c5fd" opacity="0.2" stroke="#74b8ff" strokeWidth="0.4" />
        </g>

        {/* Head - responsive to slider */}
        <g style={{ transform: `translate(154px, 72px) scale(${headScale})`, transformOrigin: '0 0', transition: 'transform 0.15s ease-out' }}>
          <circle cx="0" cy="0" r="13" fill="#4da3ff" opacity="0.5" stroke="#74b8ff" strokeWidth="0.7" />
          <ellipse cx="-3" cy="-3" rx="5" ry="6" fill="#93c5fd" opacity="0.12" />
        </g>

        {/* Left arm */}
        <rect x="115" y="95" width="9" height="38" rx="3" fill="#4da3ff" opacity="0.4" stroke="#74b8ff" strokeWidth="0.5" transform="rotate(-4, 119, 114)" />
        {/* Right arm */}
        <rect x="176" y="93" width="9" height="38" rx="3" fill="#3b82f6" opacity="0.4" stroke="#74b8ff" strokeWidth="0.5" transform="rotate(4, 180, 112)" />

        {/* Left leg */}
        <rect x="135" y="144" width="11" height="42" rx="3" fill="#4da3ff" opacity="0.35" stroke="#74b8ff" strokeWidth="0.5" />
        {/* Right leg */}
        <rect x="155" y="144" width="11" height="42" rx="3" fill="#3b82f6" opacity="0.35" stroke="#74b8ff" strokeWidth="0.5" />

        {/* Ambient light glow */}
        <circle cx="210" cy="55" r="35" fill="url(#mockLightGlow)" opacity="0.25" />
        <defs>
          <radialGradient id="mockLightGlow">
            <stop offset="0%" stopColor="#4da3ff" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#4da3ff" stopOpacity="0" />
          </radialGradient>
        </defs>
      </svg>
    </div>
  );
}