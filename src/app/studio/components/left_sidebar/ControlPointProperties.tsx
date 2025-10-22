"use client";

import { useState } from 'react';
import { useStudioStore } from "@/store/StudioStore";
import { Trash, X } from "lucide-react";

export default function ControlPointProperties() {
  const selectedPoint = useStudioStore(state => state.selectedPoint);
  const controlPoints = useStudioStore(state => state.controlPoints);
  const updateControlPoint = useStudioStore(state => state.updateControlPoint);
  const addAttribute = useStudioStore(state => state.addAttribute);
  const updateAttribute = useStudioStore(state => state.updateAttribute);
  const removeAttribute = useStudioStore(state => state.removeAttribute);

  const [showAttributeMenu, setShowAttributeMenu] = useState<boolean>(false);

  if (!selectedPoint || selectedPoint.type !== 'control') {
    return null;
  }

  const point = controlPoints.find(cp => cp.id === selectedPoint.id);
  if (!point) return <div className="text-xs text-gray-300">Point not found</div>;

  return (
    <>
      {/* Basic control point properties */}
      <div>
        <label className="block text-xs text-gray-300 font-medium mb-1.5">Name</label>
        <input
          type="text"
          value={point.name || ''}
          onChange={(e) => updateControlPoint(point.id, { name: e.target.value })}
          placeholder="Optional label..."
          className="w-full px-2 py-2 bg-gray-800 border border-gray-700 rounded text-gray-100 text-sm focus:outline-none focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-300 font-medium mb-1.5">u (curve parameter)</label>
        <input
          type="number"
          step="0.01"
          value={point.u.toFixed(2)}
          onChange={(e) => updateControlPoint(point.id, { u: parseFloat(e.target.value || '0') })}
          className="w-full px-2 py-2 bg-gray-800 border border-gray-700 rounded text-gray-100 text-sm focus:outline-none focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-300 font-medium mb-1.5">Color</label>
        <select
          value={point.color || 'purple'}
          onChange={(e) => updateControlPoint(point.id, { color: e.target.value as any })}
          className="w-full px-2 py-2 bg-gray-800 border border-gray-700 rounded text-gray-100 text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="purple">Purple</option>
          <option value="red">Red</option>
          <option value="green">Green</option>
          <option value="blue">Blue</option>
        </select>
      </div>

      {/* Render each attribute as a parameter line */}
      {point.attributes.map((attr, attrIndex) => (
        <div key={attrIndex}>
          {attr.type === 'stop' && (
            <>
              <label className="text-xs text-white mb-1.5 flex items-center justify-between">
                <span>Stop Duration (seconds)</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeAttribute(point.id, attrIndex);
                  }}
                  className="text-blue-500 hover:text-blue-400 text-sm px-1"
                  title="Remove attribute"
                >
                  <Trash className='w-3 h-3'/>
                </button>
              </label>
              <input
                type="number"
                step="0.1"
                value={attr.duration}
                onChange={(e) => updateAttribute(point.id, attrIndex, { duration: parseFloat(e.target.value || '0') })}
                className="w-full px-2 py-2 bg-gray-800 border border-gray-700 rounded text-gray-100 text-sm focus:outline-none focus:border-blue-500"
              />
            </>
          )}

          {attr.type === 'rotate' && (
            <>
              <label className="text-xs text-white mb-1.5 flex items-center justify-between">
                <span>Rotate Heading (degrees)</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeAttribute(point.id, attrIndex);
                  }}
                  className="text-blue-500 hover:text-blue-400 text-sm px-1"
                  title="Remove attribute"
                >
                  <X className='w-3 h-3'/>
                </button>
              </label>
              <input
                type="number"
                step="1"
                value={attr.heading}
                onChange={(e) => updateAttribute(point.id, attrIndex, { heading: parseFloat(e.target.value || '0') })}
                className="w-full px-2 py-2 bg-gray-800 border border-gray-700 rounded text-gray-100 text-sm focus:outline-none focus:border-blue-500"
              />
            </>
          )}

          {attr.type === 'command' && (
            <>
              <label className="text-xs text-white mb-1.5 flex items-center justify-between">
                <span>Command Action</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeAttribute(point.id, attrIndex);
                  }}
                  className="text-blue-500 hover:text-blue-400 text-sm px-1"
                  title="Remove attribute"
                >
                  <Trash className='w-3 h-3'/>
                </button>
              </label>
              <input
                type="text"
                value={attr.action}
                onChange={(e) => updateAttribute(point.id, attrIndex, { action: e.target.value })}
                placeholder="e.g., intake, shoot, deploy"
                className="w-full px-2 py-2 bg-gray-800 border border-gray-700 rounded text-gray-100 text-sm focus:outline-none focus:border-blue-500"
              />
            </>
          )}

          {attr.type === 'loop' && (
            <>
              <label className="text-xs text-white mb-1.5 flex items-center justify-between">
                <span>Loop Bounces</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeAttribute(point.id, attrIndex);
                  }}
                  className="text-blue-500 hover:text-blue-400 text-sm px-1"
                  title="Remove attribute"
                >
                  <Trash className='w-3 h-3'/>
                </button>
              </label>
              <input
                type="number"
                step="1"
                min="1"
                value={attr.bounces}
                onChange={(e) => updateAttribute(point.id, attrIndex, { bounces: parseInt(e.target.value || '1') })}
                className="w-full px-2 py-2 bg-gray-800 border border-gray-700 rounded text-gray-100 text-sm focus:outline-none focus:border-blue-500"
              />
              <label className="text-xs text-white mb-1.5 mt-3 flex items-center justify-between">
                <span>Target Loop</span>
              </label>
              <input
                type="text"
                value={attr.targetLoopId ?? ''}
                onChange={(e) => updateAttribute(point.id, attrIndex, { targetLoopId: e.target.value ? parseInt(e.target.value) : null })}
                placeholder="Optional"
                className="w-full px-2 py-2 bg-gray-800 border border-gray-700 rounded text-gray-100 text-sm focus:outline-none focus:border-blue-500"
              />
            </>
          )}
        </div>
      ))}

      {/* Add Attribute Button */}
      {point.attributes.length < 4 && (
        <div className="pt-2 border-t border-gray-700">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowAttributeMenu(true);
            }}
            className="w-full px-3 py-2 bg-gray-700 text-gray-200 text-sm rounded hover:bg-gray-600 transition-colors"
          >
            + Add Attribute
          </button>

          {/* Attribute type selection menu */}
          {showAttributeMenu && (
            <div className="mt-2 p-2 bg-gray-900 rounded border border-gray-700">
              <div className="text-xs text-gray-400 mb-2">Select attribute type:</div>
              <div className="space-y-1">
                {!point.attributes.some(a => a.type === 'stop') && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      addAttribute(point.id, { type: 'stop', duration: 1.0 });
                      setShowAttributeMenu(false);
                    }}
                    className="w-full px-3 py-2 bg-gray-800 text-gray-200 text-sm rounded hover:bg-gray-700 transition-colors text-left"
                  >
                    Stop
                  </button>
                )}
                {!point.attributes.some(a => a.type === 'rotate') && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      addAttribute(point.id, { type: 'rotate', heading: 0 });
                      setShowAttributeMenu(false);
                    }}
                    className="w-full px-3 py-2 bg-gray-800 text-gray-200 text-sm rounded hover:bg-gray-700 transition-colors text-left"
                  >
                    Rotate
                  </button>
                )}
                {!point.attributes.some(a => a.type === 'command') && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      addAttribute(point.id, { type: 'command', action: '' });
                      setShowAttributeMenu(false);
                    }}
                    className="w-full px-3 py-2 bg-gray-800 text-gray-200 text-sm rounded hover:bg-gray-700 transition-colors text-left"
                  >
                    Command
                  </button>
                )}
                {!point.attributes.some(a => a.type === 'loop') && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      addAttribute(point.id, { type: 'loop', bounces: 3, targetLoopId: null });
                      setShowAttributeMenu(false);
                    }}
                    className="w-full px-3 py-2 bg-gray-800 text-gray-200 text-sm rounded hover:bg-gray-700 transition-colors text-left"
                  >
                    Loop
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}