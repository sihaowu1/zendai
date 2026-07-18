import React from "react";
import { Logo } from "../../components/app/Logo";

export default function Footer() {
  return (
    <footer className="border-t hairline border-white/10 bg-inkwell text-slate-400">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-10 py-12">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-inkwell">
              <Logo size={18} />
            </div>
            <span className="font-heading text-lg font-bold tracking-tight text-white">
              Zendai
            </span>
          </div>

          <nav className="flex flex-wrap items-center gap-x-8 gap-y-3">
            {["Features", "Workflow", "Technology", "Get Started"].map((label) => (
              <a
                key={label}
                href={label === "Get Started" ? "#cta" : `#${label.toLowerCase()}`}
                className="font-mono-label text-slate-400 transition-colors hover:text-white"
              >
                {label}
              </a>
            ))}
          </nav>

          <div className="font-mono-label text-slate-500">
            © 2026 Zendai
          </div>
        </div>
      </div>
    </footer>
  );
}