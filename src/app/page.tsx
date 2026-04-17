'use client';

import AmbientDots from "@/components/AmbientDots";
import { useProjectStore } from "@/store/ProjectStore";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const { selectProjectFolder } = useProjectStore();


  const handleLoadProject = async () => {
    await selectProjectFolder();
    router.push('/project?from=landing');
  };

  const handleLoadLast = () => {
    // I am still lazy and do not want to implement this right ow
    console.log("IM LAZY AND DONT WANT TO IMPLEMENT THIS NOW");
    router.push('/project?from=landing');
  };
 
  return (
    <div
      className={`relative flex min-h-screen flex-col items-center justify-center bg-gray-900 text-gray-100 overflow-hidden`}
    >
      <div className="absolute inset-0 bg-[#0a0e1a]" />

      {/* Floating dots background */}
      {/* <AmbientDots count={48} /> */}

      {/* Main content */}
      <div className="relative z-10 text-center max-w-2xl px-6">

        {/* Title */}
        <h1 className="text-7xl font-black mb-2 text-blue-400">
            Feather Flow
        </h1>

        {/* Subtitle */}
        <p className="mt-6 text-gray-200 text-xl md:text-2xl font-medium tracking-wide">
          Auto Planner by 3082
        </p>
        
        {/* Actions */}
        <div className="mt-12 flex flex-col items-center gap-5">
          <button
            onClick={handleLoadLast}
            className="px-10 py-4 rounded-lg border border-gray-700 bg-gray-800/50 hover:bg-gray-700/60 backdrop-blur-sm transition-all duration-300 text-lg font-medium w-full max-w-sm hover:border-gray-600"
          >
            <span className="text-gray-200">
              Continue with{" "}
              <span className="text-blue-400 font-medium">
                2025Reefscape
              </span>
            </span>
          </button>

          <button
            onClick={handleLoadProject}
            className="px-10 py-4 rounded-lg border border-gray-700 bg-gray-800/50 hover:bg-gray-700/60 backdrop-blur-sm transition-all duration-300 text-lg font-medium w-full max-w-sm hover:border-gray-600"
          >
            <span className="text-gray-200">
              Open WPILib project folder
            </span>
          </button>
        </div>

      </div>
    </div>
  );
}