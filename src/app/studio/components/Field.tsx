"use client";

import React, { useRef, useEffect } from 'react';
import { HomeIcon } from 'lucide-react';
import { useStudioStore } from '@/store/StudioStore';
import { canvasToInch } from '@/types';
import { FIELD_CONFIG } from '@/config/config';
import { useFieldDrawing } from '../hooks/UseFieldDrawing';
import { useFieldInteraction } from '../hooks/UseFieldInteraction';

export function Field() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const viewport = useStudioStore(state => state.viewport);
  const zoom = useStudioStore(state => state.zoom);
  const resetView = useStudioStore(state => state.resetView);
  const isDragging = useStudioStore(state => state.isDragging);

  const isPanning = useStudioStore(state => state.isPanning);

  // Resize canvas to fit container
  useEffect(() => {
    const updateCanvasSize = () => {
      if (!(containerRef.current && canvasRef.current)) return;

			const rect = containerRef.current.getBoundingClientRect();
			canvasRef.current.width = rect.width;
			canvasRef.current.height = rect.height;

      resetView({ width: FIELD_CONFIG.width, height: FIELD_CONFIG.height }, { width: rect.width, height: rect.height });
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, [resetView]);

  // Drawing
  useFieldDrawing(canvasRef, containerRef);

  //Interaction
  useFieldInteraction(canvasRef);
  
  // Wheel event for zooming
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    zoom(-e.deltaY, { x: mouseX, y: mouseY });
  };

	const handleZoomClick = (delta: number) => {
		const canvas = canvasRef.current;
		if (canvas) {
			zoom(delta, { x: canvas.width / 2, y: canvas.height / 2 });
		}
	};

  const grabbing = isPanning || isDragging;

  return (
    <div ref={containerRef} className="flex-1 relative bg-[#0e111b] overflow-hidden">
      <canvas
        ref={canvasRef}
        onWheel={handleWheel}
        className="w-full h-full cursor-grab"
        style={{ cursor: grabbing ? 'grabbing' : 'grab' }}
      />

      {/* Zoom Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-20">
        <button
						onClick={() => handleZoomClick(1)}
          className="w-9 h-9 bg-gray-800 border border-gray-700 rounded-md text-gray-100 cursor-pointer text-lg hover:bg-gray-700 transition-colors"
        >
          +
        </button>
        <button
          onClick={() => handleZoomClick(-1)}
          className="w-9 h-9 bg-gray-800 border border-gray-700 rounded-md text-gray-100 cursor-pointer text-lg hover:bg-gray-700 transition-colors"
        >
          −
        </button>
        <button
          onClick={() => resetView({ width: FIELD_CONFIG.width, height: FIELD_CONFIG.height }, containerRef.current?.getBoundingClientRect() || { width: 0, height: 0 })}
          className="w-9 h-9 bg-gray-800 border border-gray-700 rounded-md text-gray-100 cursor-pointer text-lg hover:bg-gray-700 transition-colors"
        >
          <HomeIcon className="mx-auto h-4.5 w-4.5"/>
        </button>
      </div>
    </div>
  );
}