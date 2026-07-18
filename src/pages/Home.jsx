import React from "react";
import Nav from "@/components/zendai/Nav";
import Hero from "@/components/zendai/Hero";
import Features from "@/components/zendai/Features";
import Workflow from "@/components/zendai/Workflow";
import Technologies from "@/components/zendai/Technologies";
import FinalCTA from "@/components/zendai/FinalCTA";
import Footer from "@/components/zendai/Footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-inkwell text-white">
      <Nav />
      <main>
        <Hero />
        <Features />
        <Workflow />
        <Technologies />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}