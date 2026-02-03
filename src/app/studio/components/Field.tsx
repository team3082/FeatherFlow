"use client";

import React, { useRef, useEffect } from 'react';
import { HomeIcon } from 'lucide-react';
import { useStudioStore } from '@/store/StudioStore';
import { FIELD_CONFIG } from '@/config/config';
import { useFieldDrawing } from '../hooks/UseFieldDrawing';
import { useFieldInteraction } from '../hooks/UseFieldInteraction';
import { inchToCanvas } from '@/config/config';

export function Field() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const zoom = useStudioStore(state => state.zoom);
  const resetView = useStudioStore(state => state.resetView);
  const isDragging = useStudioStore(state => state.isDragging);

  const isPanning = useStudioStore(state => state.isPanning);
  const showingVelocity = useStudioStore(state => state.showingVelocity);

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

      {showingVelocity && (
        <svg className="absolute top-0 left-0 w-full h-full pointer-events-none">
          <TrajectoryPath />
        </svg>
      )}

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


export function TrajectoryPath() {
  const trajectory = useStudioStore((state) => state.trajectory);
  const viewport = useStudioStore((state) => state.viewport);

  if (!trajectory || trajectory.pathPoints.length < 2) {
    return null;
  }

  // Calculate cumulative distances and time fractions for accurate animation
  const points = trajectory.pathPoints.map(p => inchToCanvas(p.x, p.y));
  let totalDistance = 0;
  const distances: number[] = [0];

  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i-1].x;
    const dy = points[i].y - points[i-1].y;
    const segmentDistance = Math.sqrt(dx * dx + dy * dy);
    totalDistance += segmentDistance;
    distances.push(totalDistance);
  }

  const keyTimes = trajectory.pathPoints.map(p => p.time / trajectory.totalTime).join(';');
  const keyPoints = distances.map(d => d / totalDistance).join(';');

  return (
    <g
      transform={`translate(${viewport.offsetX} ${viewport.offsetY}) scale(${viewport.scale})`}
    >
      {trajectory.pathPoints.slice(0, -1).map((p1, i) => {
        const p2 = trajectory.pathPoints[i + 1];

        const canvasP1 = inchToCanvas(p1.x, p1.y);
        const canvasP2 = inchToCanvas(p2.x, p2.y);

        // Use the velocity magnitude of the start of the segment to color it
        const velocityMagnitude = Math.sqrt(p1.velocity.x ** 2 + p1.velocity.y ** 2);
        const color = velocityToColor(velocityMagnitude, 118.0); // MAX_VELOCITY

        return (
          <line
            key={i}
            x1={canvasP1.x}
            y1={canvasP1.y}
            x2={canvasP2.x}
            y2={canvasP2.y}
            stroke={color}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        );
      })}

      {/* Invisible path for motion animation */}
      <path
        id="trajectoryPath"
        d={`M ${points[0].x} ${points[0].y}` + points.slice(1).map(p => ` L ${p.x} ${p.y}`).join('')}
        fill="none"
        stroke="none"
      />

      {/* Animated dot */}
      <circle r="5" fill="red">
        <animateMotion
          dur={`${trajectory.totalTime}s`}
          repeatCount="indefinite"
          rotate="auto"
          keyTimes={keyTimes}
          keyPoints={keyPoints}
        >
          <mpath href="#trajectoryPath" />
        </animateMotion>
      </circle>
    </g>
  );
}

/**
 * Converts a velocity value to a color in a blue-green-red spectrum.
 * @param velocity The current velocity.
 * @param maxVelocity The maximum possible velocity for the path.
 * @returns An HSL color string (e.g., 'hsl(240, 100%, 50%)').
 */
export function velocityToColor(velocity: number, maxVelocity: number): string {
  if (maxVelocity === 0) {
    return "hsl(240, 100%, 50%)"; // Default to blue
  }
  // Normalize velocity from 0 to 1 and map it to a hue from blue (240) to red (0).
  const ratio = Math.min(velocity / maxVelocity, 1.0);
  const hue = 240 * (1 - ratio);

  return `hsl(${hue}, 100%, 50%)`;
}

// Add CSS animation keyframes
const styles = `
  @keyframes drawPath {
    to {
      stroke-dashoffset: 0;
    }
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement("style");
  styleSheet.type = "text/css";
  styleSheet.innerText = styles;
  document.head.appendChild(styleSheet);
}