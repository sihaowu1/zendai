import React from "react";
import { Code2, PencilRuler, MonitorPlay, FileCode2, ArrowUpRight } from "lucide-react";

const FEATURES = [
  {
    icon: Code2,
    title: "Code, Not Meshes",
    description:
      "Other AI tools spit out opaque meshes you can't touch. Zendai generates real Three.js code — every vertex, every material, every light is a line you can read and change.",
  },
  {
    icon: PencilRuler,
    title: "Tune With Sliders",
    description:
      "Every parameter — size, color, roughness, position — is exposed as a live slider. Tweak one value without regenerating the entire scene.",
  },
  {
    icon: MonitorPlay,
    title: "Instant Live Preview",
    description:
      "Edits render in real time in your browser. No upload, no queue, no waiting. Change the code and see it immediately in the viewport.",
  },
  {
    icon: FileCode2,
    title: "Export as 3D Models",
    description:
      "Download your scene as .glb for Unity and Blender, .obj for CAD pipelines, or .stl for 3D printing. Or grab the raw code and drop it into any web project.",
  },
];

export default function Features() {
  return (
    <section id="features" className="border-t hairline border-white/10">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-10 py-24 lg:py-32">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 mb-16">
          <div className="lg:col-span-4">
            <span className="font-mono-label"><span className="text-royal-blue">02</span> <span className="text-slate-400">/ Features</span></span>
          </div>
          <div className="lg:col-span-8">
            <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold tracking-[-0.03em] text-white text-balance">

              Pure code. Zero black boxes.
            </h2>
            <p className="mt-4 max-w-xl text-slate-400 leading-relaxed">
              AI-generated meshes are impossible to edit. Code-generated scenes
              are impossible to break. That's the difference.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 border-t border-l hairline border-white/10">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="group relative border-r border-b hairline border-white/10 p-8 lg:p-10 transition-colors duration-300 hover:bg-white/[0.02]"
              >
                <span className="absolute top-7 left-7 h-1.5 w-1.5 rounded-full bg-royal-blue/0 group-hover:bg-royal-blue transition-colors duration-300" />
                <div className="flex items-start justify-between mb-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md border hairline border-white/10 bg-white/5 transition-all duration-300 group-hover:border-royal-blue group-hover:bg-royal-blue">
                    <Icon className="h-5 w-5 text-white group-hover:text-white transition-colors duration-300" strokeWidth={1.6} />
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-white/20 transition-all duration-300 group-hover:text-royal-blue group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
                <div className="flex items-center gap-1.5 font-mono-label text-slate-500 mb-2">
                  <span>{f.title.replace(/[^A-Z]/g, "").slice(0, 3)}</span>
                </div>
                <h3 className="font-heading text-xl font-semibold tracking-tight text-white mb-3">
                  {f.title}<span className="text-royal-blue">.</span>
                </h3>
                <p className="text-sm leading-relaxed text-slate-400 max-w-sm">
                  {f.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}