import React from "react";
import Link from "next/link";
import { Metadata } from "next";
import Navbar from "@/components/landing/navbar";
import Footer from "@/components/landing/footer";
import { HelpCircle, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "404 - Page Not Found",
  description: "The page you are looking for does not exist on Dudo. Return home to get back on track.",
  robots: {
    index: false,
    follow: true,
  },
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#FFF8F0] text-zinc-800 font-sans flex flex-col antialiased">
      <Navbar />

      <main className="flex-1 flex items-center justify-center py-20 px-4">
        <div className="max-w-md w-full text-center space-y-8 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="w-16 h-16 rounded-2xl bg-zinc-100 border border-zinc-200 flex items-center justify-center mx-auto text-[#22577A] shadow-xs">
            <HelpCircle size={28} className="stroke-[2]" />
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl font-black text-[#22577A] tracking-tight">Page Not Found</h1>
            <p className="text-sm text-zinc-500 font-semibold max-w-sm mx-auto leading-relaxed">
              We couldn&apos;t find the page you were looking for. It may have been moved, renamed, or no longer exists.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 select-none">
            <Link href="/" className="no-underline w-full sm:w-auto">
              <div className="flex items-center justify-center h-10 px-5 bg-[#22577A] hover:bg-[#1A4461] text-white font-bold rounded-xl text-xs shadow-md transition-all active:scale-95 cursor-pointer">
                Back to Home
              </div>
            </Link>
            <Link href="/resources" className="no-underline w-full sm:w-auto">
              <div className="flex items-center justify-center gap-1.5 h-10 px-5 bg-white hover:bg-zinc-50 text-zinc-700 font-bold rounded-xl text-xs border border-zinc-250 shadow-3xs transition-all active:scale-95 cursor-pointer">
                Browse Resources <ArrowRight size={13} />
              </div>
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
