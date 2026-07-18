import React, { useEffect, useRef, useState } from "react";
import { PenLine, Wand2, SlidersHorizontal, Download } from "lucide-react";

const STEPS = [
  {
    icon: PenLine,
    label: "Prompt",
    description: "Describe the world you want: terrain, mood, materials, motion.",
  },
  {
    icon: Wand2,
    label: "Generate",
    description: "Zendai assembles geometry, lighting, and camera into an editable scene.",
  },
  {
    icon: SlidersHorizontal,
    label: "Edit",
    description: "Refine on the timeline. Tweak meshes, keyframes, and properties directly.",
  },
  {
    icon: Download,
    label: "Export",
    description: "Ship as Three.js code or render a cinematic MP4 through Remotion.",
  },
];

export default function Workflow() {
  const sectionRef = useRef(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const el = sectionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const viewport = window.innerHeight;
      const scrolled = viewport - rect.top;
      const total = rect.height * 1.35;
      const p = Math.min(1, Math.max(0, scrolled / total));
      setProgress(p);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <section id="workflow" ref={sectionRef} className="border-t hairline border-white/10 bg-inkwell text-white">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-10 py-24 lg:py-32">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 mb-16">
          <div className="lg:col-span-4">
            <span className="font-mono-label"><span className="text-royal-blue">03</span> <span className="text-slate-400">/ Workflow</span></span>
          </div>
          <div className="lg:col-span-8">
            <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold tracking-[-0.03em] text-white text-balance">
              Four steps from sentence to scene.
            </h2>
          </div>
        </div>

        {/* Timeline track */}
        <div className="relative">
          {/* base line */}
          <div className="absolute left-0 right-0 top-7 h-px bg-white/15" />
          {/* fill line */}
          <div
            className="absolute left-0 top-7 h-px bg-royal-blue transition-[width] duration-150"
            style={{ width: `${progress * 100}%` }}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-6">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              const stepProgress = (i + 1) / STEPS.length;
              const active = progress >= stepProgress - 0.05;
              return (
                <div key={step.label} className="relative pt-0">
                  {/* node */}
                  <div
                    className={`relative z-10 flex h-14 w-14 items-center justify-center rounded-full border transition-all duration-500 ${
                      active
                        ? "border-royal-blue bg-royal-blue scale-105"
                        : "border-white/20 bg-inkwell"
                    }`}
                  >
                    <Icon className="h-5 w-5 text-white" strokeWidth={1.6} />
                  </div>
                  <div className="mt-6">
                    <div className="font-mono-label mb-2">
                      <span className="text-royal-blue">Step {String(i + 1).padStart(2, "0")}</span>
                    </div>
                    <h3 className="font-heading text-xl font-semibold tracking-tight text-white mb-2">
                      {step.label}
                    </h3>
                    <p className="text-sm leading-relaxed text-slate-400 max-w-xs">
                      {step.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}