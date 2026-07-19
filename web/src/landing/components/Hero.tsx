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
  return (
    <div className="relative">
      {/* Window chrome */}
      <div className="rounded-xl border hairline border-white/10 bg-[#0d1117] shadow-[0_1px_2px_rgba(0,0,0,0.2),0_24px_60px_-24px_rgba(0,0,0,0.5)] overflow-hidden">
        {/* Top nav bar */}
        <div className="flex items-center justify-between border-b hairline border-white/10 px-4 py-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
            </div>
            <span className="font-mono-label text-white/80 text-[10px] font-semibold tracking-wider">ZENDAI</span>
          </div>
          <div className="flex items-center gap-4 font-mono-label text-[10px]">
            <span className="text-royal-blue border-b border-royal-blue pb-0.5">Model</span>
            <span className="text-slate-500">Video</span>
            <span className="text-slate-500">Export</span>
          </div>
          <button className="flex items-center gap-1.5 rounded-md bg-royal-blue px-2 py-1 text-white font-mono-label text-[10px]">
            <Download className="h-2.5 w-2.5" /> Export
          </button>
        </div>

        {/* Main body: sidebar + viewport */}
        <div className="grid grid-cols-[160px_1fr]">
          {/* Left sidebar */}
          <div className="border-r hairline border-white/10 flex flex-col">
            {/* Chat area */}
            <div className="p-2.5 border-b hairline border-white/10">
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles className="h-3 w-3 text-royal-blue shrink-0" />
                <span className="font-mono-label text-slate-500 text-[9px]">PROMPT</span>
              </div>
              <div className="rounded-md border hairline border-white/10 bg-white/5 px-2 py-1.5">
                <div className="text-[10px] text-slate-300 leading-tight">
                  <span>{typed.slice(0, 40)}</span>
                  <span className="inline-block w-px h-3 bg-white align-middle ml-0.5 animate-pulse" />
                </div>
              </div>
              <button className="mt-2 w-full rounded-md bg-royal-blue/90 px-2 py-1 font-mono-label text-[9px] text-white">
                Generate
              </button>
            </div>

            {/* Models & Layers */}
            <div className="p-2.5 flex-1">
              <div className="font-mono-label text-slate-500 text-[9px] mb-2">MODELS & LAYERS</div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 rounded-md bg-royal-blue/20 border hairline border-royal-blue/40 px-2 py-1">
                  <Box className="h-3 w-3 text-royal-blue" />
                  <span className="text-[10px] text-white truncate">Dune terrain</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-md px-2 py-1 border hairline border-white/5">
                  <Layers className="h-3 w-3 text-slate-600" />
                  <span className="text-[10px] text-slate-400 truncate">Focal pyramid</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-md px-2 py-1 border hairline border-white/5">
                  <Layers className="h-3 w-3 text-slate-600" />
                  <span className="text-[10px] text-slate-400 truncate">Ground plane</span>
                </div>
              </div>
            </div>
          </div>

          {/* 3D Viewport */}
          <div className="relative aspect-[4/3] bg-gradient-to-b from-[#0d1117] to-[#161b22] overflow-hidden">
            <ViewportGrid />
            <Viewport3D />

            {/* Floating controls popup */}
            <div className="absolute top-3 right-3 w-[120px] rounded-lg border hairline border-white/10 bg-[#0d1117]/95 shadow-lg overflow-hidden backdrop-blur-sm">
              <div className="px-2.5 py-1.5 border-b hairline border-white/10">
                <span className="font-mono-label text-[9px] text-slate-400">TUNABLES</span>
              </div>
              <div className="p-2 space-y-2">
                {[
                  { label: "Height", value: 65 },
                  { label: "Roughness", value: 35 },
                  { label: "Scale", value: 80 },
                ].map((slider) => (
                  <div key={slider.label}>
                    <div className="flex justify-between mb-0.5">
                      <span className="text-[9px] text-slate-500">{slider.label}</span>
                      <span className="text-[9px] text-slate-300">{slider.value}%</span>
                    </div>
                    <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full rounded-full bg-royal-blue" style={{ width: `${slider.value}%` }} />
                    </div>
                  </div>
                ))}
                <button className="w-full mt-1 flex items-center justify-center gap-1 rounded border border-dashed border-white/20 py-0.5 text-[8px] text-slate-500 hover:text-slate-300 transition-colors">
                  + Add slider
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

function Viewport3D() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <svg viewBox="0 0 300 240" className="w-[72%] h-auto" fill="none">
        {/* Ground circle */}
        <ellipse cx="150" cy="195" rx="100" ry="18" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />

        {/* Main body - box torso */}
        <g transform="translate(150, 120)">
          {/* Torso front face */}
          <path d="M-20,-30 L20,-30 L20,20 L-20,20 Z" fill="#3B82F6" opacity="0.6" stroke="#60A5FA" strokeWidth="0.6" />
          {/* Torso right face */}
          <path d="M20,-30 L32,-38 L32,12 L20,20 Z" fill="#2563EB" opacity="0.5" stroke="#60A5FA" strokeWidth="0.4" />
          {/* Torso top face */}
          <path d="M-20,-30 L-8,-38 L32,-38 L20,-30 Z" fill="#93C5FD" opacity="0.3" stroke="#60A5FA" strokeWidth="0.4" />
        </g>

        {/* Head - sphere */}
        <circle cx="156" cy="68" r="14" fill="#3B82F6" opacity="0.5" stroke="#60A5FA" strokeWidth="0.6" />
        <ellipse cx="152" cy="65" rx="6" ry="7" fill="#93C5FD" opacity="0.15" />

        {/* Left arm */}
        <rect x="112" y="88" width="10" height="42" rx="3" fill="#3B82F6" opacity="0.45" stroke="#60A5FA" strokeWidth="0.5" transform="rotate(-5, 117, 109)" />

        {/* Right arm */}
        <rect x="178" y="86" width="10" height="42" rx="3" fill="#2563EB" opacity="0.45" stroke="#60A5FA" strokeWidth="0.5" transform="rotate(5, 183, 107)" />

        {/* Left leg */}
        <rect x="133" y="142" width="12" height="44" rx="3" fill="#3B82F6" opacity="0.4" stroke="#60A5FA" strokeWidth="0.5" />

        {/* Right leg */}
        <rect x="157" y="142" width="12" height="44" rx="3" fill="#2563EB" opacity="0.4" stroke="#60A5FA" strokeWidth="0.5" />

        {/* Key light glow */}
        <circle cx="220" cy="50" r="40" fill="url(#lightGlow)" opacity="0.3" />
        <defs>
          <radialGradient id="lightGlow">
            <stop offset="0%" stopColor="#93C5FD" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#93C5FD" stopOpacity="0" />
          </radialGradient>
        </defs>
      </svg>
    </div>
  );
}