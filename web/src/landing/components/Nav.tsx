import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Logo } from "../../components/app/Logo";
import { useAuth } from "../../auth/useAuth";

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const { configured, isAuthenticated, isLoading, login } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const ctaClass =
    "inline-flex h-9 items-center justify-center rounded-md bg-royal-blue px-4 text-sm font-medium text-white transition-all duration-300 hover:bg-blue-500 hover:rounded-xl";

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-inkwell/80 backdrop-blur-md border-b hairline border-white/10"
          : "bg-transparent border-b hairline border-transparent"
      }`}
    >
      <div className="mx-auto max-w-[1400px] px-6 lg:px-10">
        <div className="flex h-16 items-center justify-between">
          <a href="#top" className="flex items-center gap-2.5 group">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-inkwell">
              <Logo size={18} />
            </div>
            <span className="font-heading text-lg font-bold tracking-tight text-white">
              Zendai
            </span>
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-royal-blue opacity-60 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-royal-blue" />
            </span>
          </a>

          <nav className="hidden md:flex items-center gap-8">
            {[
              ["Features", "#features"],
              ["Workflow", "#workflow"],
              ["Technology", "#technology"],
            ].map(([label, href]) => (
              <a
                key={label}
                href={href}
                className="font-mono-label text-slate-400 transition-colors hover:text-white"
              >
                {label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {configured && !isLoading && !isAuthenticated && (
              <button
                type="button"
                onClick={() => void login({ screenHint: "login" })}
                className={ctaClass}
              >
                Sign in
              </button>
            )}
            <Link to="/model" className={ctaClass}>
              {isAuthenticated ? "Open editor" : "Get Started"}
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
