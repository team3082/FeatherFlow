'use client';

import AmbientDots from "@/components/AmbientDots";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  const handleLoadProject = () => {
    console.log("IM LAZY AND DONT WANT TO IMPLEMENT THIS NOW");
  };

  const handleLoadLast = () => {
    console.log("IM LAZY AND DONT WANT TO IMPLEMENT THIS NOW");
    router.push('/project?from=landing');
  };
 
  return (
    <div
      className={`relative flex min-h-screen flex-col items-center justify-center bg-slate-950 text-gray-100 overflow-hidden transition-opacity duration-500`}
    >
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-950/30 via-slate-950 to-cyan-950/20" />
      
      {/* Radial gradient overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-transparent" />

      {/* Floating dots background */}
      <AmbientDots count={48} />

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(56,189,248,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(56,189,248,0.03)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]" />

      {/* Main content */}
      <div className="relative z-10 text-center max-w-2xl px-6">

        {/* Title */}
        <h1 className="text-7xl font-black mb-2 opacity-0 animate-fade-in">
          <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 text-transparent bg-clip-text">
            Feather Flow
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mt-6 text-gray-400 text-xl md:text-2xl font-light tracking-wide animate-fade-in opacity-0 [animation-delay:200ms] [animation-fill-mode:forwards]">
          Auto Planner by 3082
        </p>
        
        {/* Actions */}
        <div className="mt-12 flex flex-col items-center gap-5 animate-fade-in opacity-0 [animation-delay:400ms] [animation-fill-mode:forwards]">
          <button
            onClick={handleLoadLast}
            className="relative group px-10 py-4 rounded-2xl border border-blue-500/40 hover:border-blue-400/70 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 hover:from-blue-500/20 hover:to-cyan-500/20 transition-all duration-300 text-lg font-medium shadow-lg shadow-blue-500/5 hover:shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98]"
          >
            <span className="relative z-10 bg-gradient-to-r from-white to-blue-100 text-transparent bg-clip-text group-hover:from-blue-200 group-hover:to-cyan-200 transition">
              Continue with{" "}
              <span className="text-blue-400 group-hover:text-blue-300 font-medium transition">
                2025Reefscape
              </span>
            </span>
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-600/0 via-blue-500/20 to-cyan-600/0 opacity-0 group-hover:opacity-100 blur-xl transition duration-500" />
          </button>

          <button
            onClick={handleLoadProject}
            className="relative group px-10 py-4 rounded-2xl border border-blue-500/40 hover:border-blue-400/70 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 hover:from-blue-500/20 hover:to-cyan-500/20 transition-all duration-300 text-lg font-medium shadow-lg shadow-blue-500/5 hover:shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98]"
          >
            <span className="relative z-10 bg-gradient-to-r from-white to-blue-100 text-transparent bg-clip-text group-hover:from-blue-200 group-hover:to-cyan-200 transition">
              Open WPILib project folder
            </span>
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-600/0 via-blue-500/20 to-cyan-600/0 opacity-0 group-hover:opacity-100 blur-xl transition duration-500" />
          </button>
        </div>

        {/* Version info */}
        <div className="mt-24 text-gray-600 text-xs tracking-wider animate-fade-in opacity-0 [animation-delay:600ms] [animation-fill-mode:forwards]">
          v0.1.0-alpha
        </div>
      </div>

      {/* Animations */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes bob {
          0%, 100% {
            transform: translate(0, 0);
          }
          50% {
            transform: translate(0, -12px);
          }
        }

        .animate-fade-in {
          animation: fadeIn 1.2s ease-out forwards;
          opacity: 0;
          transform: translateY(20px);
        }

        .animate-bob {
          animation: bob infinite ease-in-out alternate;
        }
      `}</style>
    </div>
  );
}