"use client";

import React, { useRef, useEffect, useState } from 'react';
import { AnchorPoint, AutoRoutine, ControlPoint } from '@/types';
import { FIELD_CONFIG } from '@/config/config';
import { inchToCanvas, Vector2 } from '@/types';
import { Viewport } from '@/store/StudioStore';

// Drawing functions adapted from UseFieldDrawing.tsx
const setupTransform = (ctx: CanvasRenderingContext2D, viewport: Viewport) => {
  ctx.save();
  ctx.translate(viewport.offsetX, viewport.offsetY);
  ctx.scale(viewport.scale, viewport.scale);
};

const drawField = (ctx: CanvasRenderingContext2D, image: HTMLImageElement | null, config: typeof FIELD_CONFIG) => {
  if (image) {
    ctx.drawImage(image, 0, 0, config.width, config.height);
  } else {
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, config.width, config.height);
  }
};

const drawPaths = (ctx: CanvasRenderingContext2D, anchorPoints: AnchorPoint[]) => {
  if (anchorPoints.length < 2) return;

  ctx.beginPath();
  const startCanvas = inchToCanvas(anchorPoints[0].position.x, anchorPoints[0].position.y);
  ctx.moveTo(startCanvas.x, startCanvas.y);

  for (let i = 1; i < anchorPoints.length; i++) {
    const prev = anchorPoints[i - 1];
    const curr = anchorPoints[i];
    const end = inchToCanvas(curr.position.x, curr.position.y);

    if (curr.isCurved) {
      // Draw Bezier curve
      const cp1 = inchToCanvas(prev.position.x + prev.handleOutOffset.x, prev.position.y + prev.handleOutOffset.y);
      const cp2 = inchToCanvas(curr.position.x + curr.handleInOffset.x, curr.position.y + curr.handleInOffset.y);
      ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, end.x, end.y);
    } else {
      // Draw straight line
      ctx.lineTo(end.x, end.y);
    }
  }

  ctx.strokeStyle = '#3B82F6';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Draw dashed overlay
  ctx.setLineDash([8, 4]);
  ctx.strokeStyle = '#3B82F6';
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.4;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
};

const drawControlPoints = (ctx: CanvasRenderingContext2D, controlPoints: ControlPoint[], getPointAtT: (t: number) => Vector2) => {
  controlPoints.forEach(point => {
    const posInches = getPointAtT(point.u);

    if (posInches) {
      const pos = inchToCanvas(posInches.x, posInches.y);

      // Get custom color
      const customColor = point.color || 'blue';

      // Color mapping
      const colorMap: Record<string, string> = {
        purple: '#A855F7',
        red: '#EF4444',
        green: '#22C55E',
        blue: '#3B82F6'
      };

      const baseColor = colorMap[customColor] || colorMap.blue;
      const radius = 5;

      // Draw base circle for control point
      ctx.fillStyle = baseColor;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
      ctx.fill();

      // Draw white center dot
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  });
};

const drawAnchors = (ctx: CanvasRenderingContext2D, anchorPoints: AnchorPoint[]) => {
  // Color constants
  const ANCHOR_COLOR = '#3B82F6';

  anchorPoints.forEach((anchor) => {
    const anchorCanvas = inchToCanvas(anchor.position.x, anchor.position.y);

    // Draw anchor point
    ctx.fillStyle = ANCHOR_COLOR;
    ctx.beginPath();
    const size = 10;
    ctx.rect(anchorCanvas.x - size/2, anchorCanvas.y - size/2, size, size);
    ctx.fill();
  });
};

// Simple Bezier evaluation for preview
const evaluateBezierAtT = (p0: Vector2, p1: Vector2, p2: Vector2, p3: Vector2, t: number): Vector2 => {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;

  return {
    x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
    y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y
  };
};

const getPointAtT = (anchorPoints: AnchorPoint[], t: number): Vector2 => {
  if (anchorPoints.length < 2) return { x: 0, y: 0 };

  const segmentIndex = Math.min(Math.floor(t * (anchorPoints.length - 1)), anchorPoints.length - 2);
  const localT = (t * (anchorPoints.length - 1)) - segmentIndex;

  const p0 = anchorPoints[segmentIndex];
  const p3 = anchorPoints[segmentIndex + 1];
  const p1 = { x: p0.position.x + p0.handleOutOffset.x, y: p0.position.y + p0.handleOutOffset.y };
  const p2 = { x: p3.position.x + p3.handleInOffset.x, y: p3.position.y + p3.handleInOffset.y };

  return evaluateBezierAtT(p0.position, p1, p2, p3.position, localT);
};

interface PathPreviewCanvasProps {
  routine: AutoRoutine;
  onClick?: (e: React.MouseEvent) => void;
}

export const PathPreviewCanvas: React.FC<PathPreviewCanvasProps> = ({ routine, onClick }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fieldImageRef = useRef<HTMLImageElement | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Load field image
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setImageLoaded(true);
      fieldImageRef.current = img;
    };
    img.onerror = () => {
      console.error(`Failed to load field image: ${FIELD_CONFIG.imagePath}`);
      setImageLoaded(false);
    };
    img.src = FIELD_CONFIG.imagePath;
  }, []);

  // Draw the path
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Calculate scale to fit field in canvas while maintaining aspect ratio
      const scaleX = canvas.width / FIELD_CONFIG.width;
      const scaleY = canvas.height / FIELD_CONFIG.height;
      const scale = Math.min(scaleX, scaleY);

      // Center the field in the canvas
      const offsetX = (canvas.width - FIELD_CONFIG.width * scale) / 2;
      const offsetY = (canvas.height - FIELD_CONFIG.height * scale) / 2;

      const viewport = {
        offsetX,
        offsetY,
        scale
      };

      setupTransform(ctx, viewport);

      // Draw field
      drawField(ctx, fieldImageRef.current, FIELD_CONFIG);

      // Draw paths
      drawPaths(ctx, routine.anchorPoints);

      // Draw anchors
      drawAnchors(ctx, routine.anchorPoints);

      // Draw control points
      drawControlPoints(ctx, routine.controlPoints, (t) => getPointAtT(routine.anchorPoints, t));

      // Restore
      ctx.restore();
    } catch (error) {
      console.error('Error drawing path preview:', error);
      // Fallback: just draw a simple placeholder
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ffffff';
      ctx.font = '20px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Preview Error', canvas.width / 2, canvas.height / 2);
    }
  }, [routine, imageLoaded]);

  return (
    <canvas
      ref={canvasRef}
      width={900}
      height={600}
      onClick={onClick}
      className="w-full h-full object-contain cursor-pointer"
    />
  );
};