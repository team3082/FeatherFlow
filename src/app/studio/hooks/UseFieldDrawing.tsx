import { useEffect, useRef, RefObject, useCallback } from 'react';
import { SelectedPoint, useStudioStore, Viewport } from '@/store/StudioStore';
import { FIELD_CONFIG } from '@/config/config';
import { AnchorPoint, ControlPoint, Vector2, SnapPoint } from '@/types';
import { inchToCanvas } from '@/config/config';
import { useProjectStore } from '@/store/ProjectStore';

// Drawing functions
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

  // Helper function to interpolate between two colors
  const interpolateColor = (color1: string, color2: string, factor: number) => {
    const c1 = parseInt(color1.slice(1), 16);
    const c2 = parseInt(color2.slice(1), 16);
    
    const r1 = (c1 >> 16) & 0xff;
    const g1 = (c1 >> 8) & 0xff;
    const b1 = c1 & 0xff;
    
    const r2 = (c2 >> 16) & 0xff;
    const g2 = (c2 >> 8) & 0xff;
    const b2 = c2 & 0xff;
    
    const r = Math.round(r1 + (r2 - r1) * factor);
    const g = Math.round(g1 + (g2 - g1) * factor);
    const b = Math.round(b1 + (b2 - b1) * factor);
    
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  };

  // Light to dark blue gradient
  const lightColor = '#5072e4'; // Light blue
  const darkColor = '#1E40AF'; // Dark blue
  const totalSegments = anchorPoints.length - 1;

  // Draw each segment with its own color
  for (let i = 1; i < anchorPoints.length; i++) {
    const prev = anchorPoints[i - 1];
    const curr = anchorPoints[i];
    
    // Calculate progress (0 to 1)
    const progress = (i - 1) / (totalSegments - 1 || 1);
    const segmentColor = interpolateColor(lightColor, darkColor, progress);

    // Convert control points and anchors from inches to canvas
    const start = inchToCanvas(prev.position.x, prev.position.y);
    const cp1 = inchToCanvas(prev.position.x + prev.handleOutOffset.x, prev.position.y + prev.handleOutOffset.y);
    const cp2 = inchToCanvas(curr.position.x + curr.handleInOffset.x, curr.position.y + curr.handleInOffset.y);
    const end = inchToCanvas(curr.position.x, curr.position.y);

    // Draw main path segment
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, end.x, end.y);
    ctx.strokeStyle = segmentColor;
    ctx.lineWidth = 4;
    ctx.stroke();

    // Draw dashed overlay segment
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, end.x, end.y);
    ctx.setLineDash([8, 4]);
    ctx.strokeStyle = segmentColor;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.4;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }
};

const drawControlPoints = (ctx: CanvasRenderingContext2D, controlPoints: ControlPoint[], selectedPoint: SelectedPoint, getPointAtT: (t: number) => Vector2) => {
  controlPoints.forEach(point => {
    const posInches = getPointAtT(point.u);

    if (posInches) {
      const pos = inchToCanvas(posInches.x, posInches.y);
      const isSelected = selectedPoint?.type === 'control' && selectedPoint?.id === point.id;
      
      // Get custom color
      const customColor = point.color || 'blue';
      
      // Color mapping
      const colorMap: Record<string, string> = {
        purple: '#7211b8',
        red: '#EF4444',
        green: '#22C55E',
        blue: '#1256c4'
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

const drawAnchors = (ctx: CanvasRenderingContext2D, anchorPoints: AnchorPoint[], selectedPoint: SelectedPoint) => {
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

const drawSnapPoints = (ctx: CanvasRenderingContext2D, snapPoints: SnapPoint[], selectedPoint: SelectedPoint, snapEnabled: boolean) => {
  const SNAP_COLOR_MAP: Record<string, string> = {
    blue: '#3B82F6',
    red: '#EF4444',
    purple: '#A855F7',
    yellow: '#FACC15',
    cyan: '#06B6D4',
    green: '#10B981',
    orange: '#F97316'
  };

  snapPoints.forEach((snapPoint) => {
    if (!snapPoint.enabled && !snapEnabled) return;

    const pos = inchToCanvas(snapPoint.position.x, snapPoint.position.y);
    const color = SNAP_COLOR_MAP[snapPoint.color || 'blue'];
    const isSelected = selectedPoint?.type === 'snapPoint' && selectedPoint?.id === snapPoint.id;
    const opacity = snapPoint.enabled && snapEnabled ? 1.0 : 0.4;

    ctx.save();
    ctx.globalAlpha = opacity;

    // Draw diamond shape (rotated square)
    const size = isSelected ? 8 : 6;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y - size);
    ctx.lineTo(pos.x + size, pos.y);
    ctx.lineTo(pos.x, pos.y + size);
    ctx.lineTo(pos.x - size, pos.y);
    ctx.closePath();
    ctx.fill();

    // Draw border
    ctx.strokeStyle = isSelected ? '#ffffff' : color;
    ctx.lineWidth = isSelected ? 2.5 : 1.5;
    ctx.stroke();

    // Draw lock indicator if locked
    if (snapPoint.locked) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('L', pos.x, pos.y);
    }

    ctx.restore();
  });
};

const drawRotation = (ctx: CanvasRenderingContext2D, controlPoints: ControlPoint[], getPointAtU: (t: number) => Vector2, selectedPoint: SelectedPoint) => {
  let isInControl: boolean = selectedPoint?.type === 'control';

  if (isInControl && selectedPoint) {
    const controlPoint = controlPoints.find(cp => cp.id === selectedPoint.id);

    if (controlPoint == null) return;

    let rotation = 0;
    const rotationAttribute = controlPoint.attributes.find(attr => attr.type === 'rotate');
    if (rotationAttribute) {
      rotation = rotationAttribute.heading;
    } else {
      return;
    }

    drawRobot(ctx, inchToCanvas(getPointAtU(controlPoint.u).x, getPointAtU(controlPoint.u).y), rotation);

  }

}

const drawRobot = (ctx: CanvasRenderingContext2D, position: Vector2, rotation: number) => {
  const ROBOT_WIDTH = 24;
  const ROBOT_LENGTH = 24;
  const MODULE_SIZE = 6;
  const MODULE_OFFSET_X = ROBOT_LENGTH / 2 - MODULE_SIZE / 2;
  const MODULE_OFFSET_Y = ROBOT_WIDTH / 2 - MODULE_SIZE / 2;

  ctx.save();
  ctx.translate(position.x, position.y);
  ctx.rotate(rotation * Math.PI / 180);

  // --- Main body ---
  ctx.fillStyle = '#6e1aa2';
  ctx.beginPath();
  ctx.roundRect(-ROBOT_LENGTH / 2, -ROBOT_WIDTH / 2, ROBOT_LENGTH, ROBOT_WIDTH, 2);
  ctx.fill();

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.stroke();

  // --- Four swerve module boxes ---
  const modules = [
    { x: -MODULE_OFFSET_X, y: -MODULE_OFFSET_Y },
    { x:  MODULE_OFFSET_X, y: -MODULE_OFFSET_Y },
    { x: -MODULE_OFFSET_X, y:  MODULE_OFFSET_Y },
    { x:  MODULE_OFFSET_X, y:  MODULE_OFFSET_Y },
  ];

  modules.forEach(({ x, y }) => {
    ctx.fillStyle = '#3d0f5e';
    ctx.beginPath();
    ctx.roundRect(x - MODULE_SIZE / 2, y - MODULE_SIZE / 2, MODULE_SIZE, MODULE_SIZE, 1);
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.75;
    ctx.stroke();
  });

  // --- Centered heading arrow ---
  const shaftHalfLen = ROBOT_LENGTH * 0.22;
  const headSize = 4.5;
  const tipX = shaftHalfLen + headSize * 0.6;

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-shaftHalfLen, 0);
  ctx.lineTo(shaftHalfLen, 0);
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(tipX, 0);
  ctx.lineTo(shaftHalfLen - headSize * 0.5, -headSize * 0.65);
  ctx.lineTo(shaftHalfLen - headSize * 0.5,  headSize * 0.65);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
};

export const useFieldDrawing = (
  canvasRef: RefObject<HTMLCanvasElement | null>,
  containerRef: RefObject<HTMLDivElement | null>,
) => {
  const fieldImageRef = useRef<HTMLImageElement | null>(null);
  const viewport = useStudioStore(state => state.viewport);
  const anchorPoints = useStudioStore(state => state.anchorPoints);
  const controlPoints = useStudioStore(state => state.controlPoints);
  const selectedPoint = useStudioStore(state => state.selectedPoint);
  const getPointAtU = useStudioStore(state => state.getPointAtU);
  const resetView = useStudioStore(state => state.resetView);
  
  const snapPoints = useProjectStore(state => state.snapPoints);
  const snapEnabled = useProjectStore(state => state.snapEnabled);

  // Load field image
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      fieldImageRef.current = img;
      if (containerRef.current) {
        const container = containerRef.current.getBoundingClientRect();
        resetView({ width: FIELD_CONFIG.width, height: FIELD_CONFIG.height }, { width: container.width, height: container.height });
      }
    };
    img.onerror = () => {
      console.error(`Failed to load field image: ${FIELD_CONFIG.imagePath}`);
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

    // Draw snap points (under paths)
    drawSnapPoints(ctx, snapPoints, selectedPoint, snapEnabled);

    // Draw paths
    drawPaths(ctx, anchorPoints);

    // Draw anchors
    drawAnchors(ctx, anchorPoints, selectedPoint);

    // Draw control points
    drawControlPoints(ctx, controlPoints, selectedPoint, getPointAtU);

    // Draw robot
    drawRotation(ctx, controlPoints, getPointAtU, selectedPoint);

    //Restore
    ctx.restore();
  }, [canvasRef, viewport, anchorPoints, selectedPoint, controlPoints, getPointAtU, snapPoints, snapEnabled]);

  // Drawing effect
  useEffect(() => {
    draw();
  }, [draw]);

  return { redraw: draw };
};