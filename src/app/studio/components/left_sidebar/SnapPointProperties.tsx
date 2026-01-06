"use client";

import { useStudioStore } from "@/store/StudioStore";
import { useProjectStore } from "@/store/ProjectStore";
import { Diamond } from "lucide-react";

export default function SnapPointProperties() {
  const selectedPoint = useStudioStore(state => state.selectedPoint);
  const snapPoints = useProjectStore(state => state.snapPoints);
  
  // Get the selected snap point
  const snapPoint = snapPoints.find(sp => sp.id === selectedPoint?.id);

  if (!snapPoint) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-blue-400">
        <Diamond className="w-4 h-4" />
        <span className="font-medium">Snap Point</span>
      </div>

      <div className="space-y-2">
        <div className="text-xs text-gray-400 uppercase tracking-wide">Name</div>
        <div className="text-sm text-gray-200">{snapPoint.name}</div>
      </div>

      <div className="space-y-2">
        <div className="text-xs text-gray-400 uppercase tracking-wide">Position</div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-gray-800 px-3 py-2 rounded">
            <div className="text-xs text-gray-500 mb-1">X</div>
            <div className="text-sm text-gray-200">{snapPoint.position.x.toFixed(2)}"</div>
          </div>
          <div className="bg-gray-800 px-3 py-2 rounded">
            <div className="text-xs text-gray-500 mb-1">Y</div>
            <div className="text-sm text-gray-200">{snapPoint.position.y.toFixed(2)}"</div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs text-gray-400 uppercase tracking-wide">Status</div>
        <div className="flex gap-2">
          <div className={`px-2 py-1 rounded text-xs ${snapPoint.enabled ? 'bg-green-900 text-green-200' : 'bg-gray-700 text-gray-400'}`}>
            {snapPoint.enabled ? 'Enabled' : 'Disabled'}
          </div>
          <div className={`px-2 py-1 rounded text-xs ${snapPoint.locked ? 'bg-red-900 text-red-200' : 'bg-gray-700 text-gray-400'}`}>
            {snapPoint.locked ? 'Locked' : 'Unlocked'}
          </div>
        </div>
      </div>

      {snapPoint.color && (
        <div className="space-y-2">
          <div className="text-xs text-gray-400 uppercase tracking-wide">Color</div>
          <div className="text-sm text-gray-200 capitalize">{snapPoint.color}</div>
        </div>
      )}

      <div className="pt-2 border-t border-gray-700">
        <div className="text-xs text-gray-500 italic">
          Edit snap point properties in the settings modal
        </div>
      </div>
    </div>
  );
}
