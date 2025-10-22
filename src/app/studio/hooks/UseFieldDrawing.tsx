import { useEffect, useRef, useState, RefObject, useCallback, use } from 'react';
import { useStudioStore } from '@/store/StudioStore';
import { FIELD_CONFIG } from '@/config/config';
import { inchToCanvas, Vector2 } from '@/types';

// Drawing functions
const setupTransform = (ctx: CanvasRenderingContext2D, viewport: any) => {
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

const drawPaths = (ctx: CanvasRenderingContext2D, anchorPoints: any[]) => {
  if (anchorPoints.length < 2) return;

  ctx.beginPath();
  const startCanvas = inchToCanvas(anchorPoints[0].position.x, anchorPoints[0].position.y);
  ctx.moveTo(startCanvas.x, startCanvas.y);

  for (let i = 1; i < anchorPoints.length; i++) {
    const prev = anchorPoints[i - 1];
    const curr = anchorPoints[i];

    // Convert control points and anchors from inches to canvas
    const cp1 = inchToCanvas(prev.position.x + prev.handleOutOffset.x, prev.position.y + prev.handleOutOffset.y);
    const cp2 = inchToCanvas(curr.position.x + curr.handleInOffset.x, curr.position.y + curr.handleInOffset.y);
    const end = inchToCanvas(curr.position.x, curr.position.y);

    ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, end.x, end.y);
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

const drawControlPoints = (ctx: CanvasRenderingContext2D, controlPoints: any[], selectedPoint: any, getPointAtT: (t: number) => Vector2) => {
  controlPoints.forEach(point => {
    const posInches = getPointAtT(point.u);

    if (posInches) {
      const pos = inchToCanvas(posInches.x, posInches.y);
      const isSelected = selectedPoint?.type === 'control' && selectedPoint?.id === point.id;
      
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
      const radius = isSelected ? 6 : 5;
      
      // Draw base circle for control point
      ctx.fillStyle = baseColor;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw white center dot
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, isSelected ? 2 : 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  });
};

const drawAnchors = (ctx: CanvasRenderingContext2D, anchorPoints: any[], selectedPoint: any) => {
  // Color constants
  const HANDLE_LINE_COLOR = '#374151';
  const ANCHOR_COLOR = '#3B82F6';
  const HANDLE_SELECTED_COLOR = '#3B82F6';
  const HANDLE_UNSELECTED_COLOR = '#185cc9';
  const SELECTION_HIGHLIGHT_COLOR = '#fff';

  anchorPoints.forEach((anchor, index) => {
    const isAnchorSelected = selectedPoint?.type === 'anchor' && selectedPoint?.id === index;
    const isHandleSelected = (selectedPoint?.type === 'handleOut' || selectedPoint?.type === 'handleIn') && selectedPoint?.id === index;

    const anchorCanvas = inchToCanvas(anchor.position.x, anchor.position.y);

    // Draw handles if anchor selected or handle is being edited, and anchor is curved
    if ((isAnchorSelected || isHandleSelected) && anchor.isCurved) {
      const handleOutCanvas = inchToCanvas(anchor.position.x + anchor.handleOutOffset.x, anchor.position.y + anchor.handleOutOffset.y);
      const handleInCanvas = inchToCanvas(anchor.position.x + anchor.handleInOffset.x, anchor.position.y + anchor.handleInOffset.y);

      ctx.strokeStyle = HANDLE_LINE_COLOR;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(anchorCanvas.x, anchorCanvas.y);
      ctx.lineTo(handleOutCanvas.x, handleOutCanvas.y);
      ctx.moveTo(anchorCanvas.x, anchorCanvas.y);
      ctx.lineTo(handleInCanvas.x, handleInCanvas.y);
      ctx.stroke();

      // Handle circles - highlight the one being edited
      const isEditingOut = selectedPoint?.type === 'handleOut' && selectedPoint?.id === index;
      const isEditingIn = selectedPoint?.type === 'handleIn' && selectedPoint?.id === index;

      // Out handle
      ctx.fillStyle = isEditingOut ? HANDLE_SELECTED_COLOR : HANDLE_UNSELECTED_COLOR;
      ctx.beginPath();
      ctx.arc(handleOutCanvas.x, handleOutCanvas.y, 5, 0, Math.PI * 2);
      ctx.fill();

      // In handle
      ctx.fillStyle = isEditingIn ? HANDLE_SELECTED_COLOR : HANDLE_UNSELECTED_COLOR;
      ctx.beginPath();
      ctx.arc(handleInCanvas.x, handleInCanvas.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw anchor point
    ctx.fillStyle = ANCHOR_COLOR;
    ctx.beginPath();
    const size = isAnchorSelected ? 10 : 10;
    ctx.rect(anchorCanvas.x - size/2, anchorCanvas.y - size/2, size, size);
    ctx.fill();

    if (isAnchorSelected) {
      ctx.strokeStyle = SELECTION_HIGHLIGHT_COLOR;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  });
};

export const useFieldDrawing = (
  canvasRef: RefObject<HTMLCanvasElement | null>,
  containerRef: RefObject<HTMLDivElement | null>,
) => {
  const [fieldImageLoaded, setFieldImageLoaded] = useState(false);
  const fieldImageRef = useRef<HTMLImageElement | null>(null);
  const viewport = useStudioStore(state => state.viewport);
  const anchorPoints = useStudioStore(state => state.anchorPoints);
  const controlPoints = useStudioStore(state => state.controlPoints);
  const selectedPoint = useStudioStore(state => state.selectedPoint);
  const getPointAtU = useStudioStore(state => state.getPointAtU);
  const resetView = useStudioStore(state => state.resetView);

  // Load field image
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setFieldImageLoaded(true);
      fieldImageRef.current = img;
      if (containerRef.current) {
        const container = containerRef.current.getBoundingClientRect();
        resetView({ width: FIELD_CONFIG.width, height: FIELD_CONFIG.height }, { width: container.width, height: container.height });
      }
    };
    img.onerror = () => {
      console.error(`Failed to load field image: ${FIELD_CONFIG.imagePath}`);
      setFieldImageLoaded(false);
    };
    img.src = FIELD_CONFIG.imagePath;
  }, [containerRef, resetView]);

  // Memoized drawing function
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    setupTransform(ctx, viewport);

    // Draw field
    drawField(ctx, fieldImageRef.current, FIELD_CONFIG);

    // Draw paths
    drawPaths(ctx, anchorPoints);

    // Draw anchors
    drawAnchors(ctx, anchorPoints, selectedPoint);

    // Draw control points
    drawControlPoints(ctx, controlPoints, selectedPoint, getPointAtU);

    //Restore
    ctx.restore();
  }, [canvasRef, fieldImageLoaded, viewport, anchorPoints, selectedPoint, controlPoints]);

  // Drawing effect
  useEffect(() => {
    draw();
  }, [draw]);

  return { redraw: draw };
};