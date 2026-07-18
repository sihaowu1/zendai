import React from "react";
import { ArrowUpRight } from "lucide-react";

export default function FinalCTA() {
  return (
    <section id="cta" className="border-t hairline border-white/10 bg-inkwell text-white">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-10 py-28 lg:py-40">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 mb-8">
            <span className="font-mono-label"><span className="text-royal-blue">05</span> <span className="text-slate-400">/ Start</span></span>
            <span className="h-px w-8 bg-royal-blue/50" />
            <span className="font-mono-label text-slate-400">Begin your first scene</span>
          </div>
          <h2 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold tracking-[-0.04em] text-white text-balance">
            Start Building with <span className="text-royal-blue">Zendai</span>
            <span className="inline-block ml-1 animate-fade-up">.</span>
          </h2>
          <p className="mt-6 max-w-xl text-base lg:text-lg leading-relaxed text-slate-400">
            Generate your first 3D world in seconds. No installs, no setup. Just a
            prompt and a viewport.
          </p>

          <div className="mt-10">
            <a
              href="/model"
              className="group inline-flex items-center gap-2 rounded-md bg-white px-6 py-3.5 text-sm font-medium text-inkwell transition-all duration-300 hover:bg-royal-blue hover:text-white hover:rounded-xl"
            >
              Get Started
              <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}