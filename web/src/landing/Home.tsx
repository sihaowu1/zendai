import React from "react";
import Nav from "./components/Nav";
import Hero from "./components/Hero";
import Features from "./components/Features";
import Workflow from "./components/Workflow";
import Technologies from "./components/Technologies";
import FinalCTA from "./components/FinalCTA";
import Footer from "./components/Footer";

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
