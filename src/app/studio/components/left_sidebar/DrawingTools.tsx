"use client";

import { useStudioStore } from "@/store/StudioStore";
import { Circle, Square } from "lucide-react";

const tools = [
    { 
        type: 'anchorTool' as const, 
        icon: <Square className="mx-auto h-6 w-6"/>, 
        label: 'Anchor Point', 
        desc: 'Draw bezier path' 
    },
    { 
        type: 'controlTool' as const, 
        icon: <Circle className="mx-auto h-6 w-6"/>, 
        label: 'Control Point', 
        desc: 'Define behavior on path' 
    },
];

export default function DrawingTools() {
  const activeTool = useStudioStore(state => state.activeTool);
  const setActiveTool = useStudioStore(state => state.setActiveTool);

  return (
    <section className="p-5">
      <div className="text-xs font-semibold text-gray-300 mb-3 uppercase tracking-wider">Drawing Tools</div>
      <div className="flex flex-col gap-2">
        {tools.map(({ type, icon, label, desc }) => (
          <div
            key={type}
            onClick={() => setActiveTool(type)}
            className={`p-3 rounded-lg cursor-pointer transition-all flex items-center gap-3 ${
              activeTool === type
                ? 'bg-blue-900 border-2 border-blue-500'
                : 'bg-gray-800 border-2 border-gray-700 hover:border-gray-600'
            }`}
          >
            <div className="text-2xl min-w-8 text-center">{icon}</div>
            <div className="flex-1">
              <div className="text-sm font-medium mb-0.5">{label}</div>
              <div className="text-xs text-gray-300">{desc}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}