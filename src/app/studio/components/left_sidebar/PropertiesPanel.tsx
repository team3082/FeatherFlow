"use client";

import { useStudioStore } from "@/store/StudioStore";
import AnchorProperties from "./AnchorProperties";
import ControlPointProperties from "./ControlPointProperties";
import { Eye } from "lucide-react";

export default function PropertiesPanel() {
  const selectedPoint = useStudioStore(state => state.selectedPoint);

  return (
    <div className="border-t border-gray-700 p-5">
      <div className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wide">Properties</div>

      <div className="flex flex-col gap-3">
        {selectedPoint ? (
          <>
            {['anchor', 'handleOut', 'handleIn'].includes(selectedPoint.type) && <AnchorProperties />}
            {selectedPoint.type === 'control' && <ControlPointProperties />}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="text-gray-400 mb-2">
              <Eye className="w-12 h-12 mx-auto mb-3 opacity-50" />
            </div>
            <div className="text-sm text-gray-500 mb-1 font-medium">No Selection</div>
            <div className="text-xs text-gray-600 max-w-48">Click on an anchor or control point to see properties</div>
          </div>
        )}
      </div>
    </div>
  );
}