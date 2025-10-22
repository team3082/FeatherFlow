import { create } from 'zustand';
import { AnchorPoint } from '@/types/AnchorPoint';
import { BezierCurve } from '@/types/BezierCurve';
import { Vector2 } from '@/types/Vector2';
import { ControlPoint } from '@/types/ControlPoint';

type ActiveToolType = 'anchorTool' | 'controlTool';

export type SelectedPoint = {
  type: 'anchor' | 'handleOut' | 'handleIn' | 'control';
  id: number;
} | null;

export interface Viewport {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface StudioState {
  // State
  anchorPoints: AnchorPoint[];
  controlPoints: ControlPoint[];
  selectedPoint: SelectedPoint;
  activeTool: ActiveToolType;

  // Pan & Zoom
  viewport: Viewport;
  isPanning: boolean;
  lastPanPosition: Vector2;

  //mouse
  cursorPosition: Vector2;
  isDragging: boolean;
  
  // Anchor Point Actions
  addAnchorPoint: (point: Omit<AnchorPoint, 'name'>) => void;
  updateAnchorPoint: (id: number, updater: (current: AnchorPoint) => AnchorPoint) => void;
  deleteAnchorPoint: (id: number) => void;
  moveAnchorPoint: (id: number, newPosition: Vector2) => void;
  insertAnchorOnCurve: (segmentIndex: number, t: number) => void;
  toggleAnchorCurve: (id: number) => void;
  
  // Control Point Actions
  addControlPoint: (point: Omit<ControlPoint, 'name'>) => void;
  updateControlPoint: (id: number, updates: Partial<ControlPoint>) => void;
  deleteControlPoint: (id: number) => void;
  moveControlPoint: (id: number, newT: number) => void;
  
  // Attribute Actions
  addAttribute: (pointId: number, attribute: any) => void;
  updateAttribute: (pointId: number, attrIndex: number, updates: any) => void;
  removeAttribute: (pointId: number, attrIndex: number) => void;
  
  // Selection & UI Actions
  setSelectedPoint: (point: SelectedPoint) => void;
  setActiveTool: (tool: StudioState['activeTool']) => void;
  setViewport: (viewport: Viewport) => void;

  setCursorPosition: (position: Vector2) => void;
  setIsDragging: (isDragging: boolean) => void;

	//Panning
	startPanning: (point: Vector2) => void;
  updatePanning: (point: Vector2) => void;
  stopPanning: () => void;
	zoom: (delta: number, center: Vector2) => void;
  resetView: (fieldDimensions: { width: number; height: number }, containerSize: { width: number; height: number }) => void;
  
  // Derived State
  getCurveSegments: () => BezierCurve[];
  getPointAtU: (u: number) => Vector2;
  getSelectedAnchor: () => AnchorPoint | undefined;
}

export const useStudioStore = create<StudioState>((set, get) => ({
  // Initial state
  anchorPoints: [
    { position: { x: 325.68, y: 241.64 }, handleOutOffset: { x: 0, y: 0 }, handleInOffset: { x: 0, y: 0 }, isCurved: false, handlesAligned: true, name: 'Start' },
    { position: { x: 365.20, y: 241.64 }, handleOutOffset: { x: 0, y: 0 }, handleInOffset: { x: 0, y: 0 }, isCurved: false, handlesAligned: true, name: '' },
    { position: { x: 455.15, y: 317.15 }, handleOutOffset: { x: 54, y: 0 }, handleInOffset: { x: -54, y: 0 }, isCurved: true, handlesAligned: false, name: 'End' }
  ],
  controlPoints: [
    { id: 1, u: 0.3, name: '', attributes: [{ type: 'rotate', heading: 180 }], color: 'purple' },
    { id: 2, u: 0.65, name: '', attributes: [{ type: 'stop', duration: 1.5 }], color: 'red' }
  ],
  selectedPoint: null,
  activeTool: 'anchorTool',
  viewport: { scale: 1, offsetX: 0, offsetY: 0 },
  isPanning: false,
	lastPanPosition: { x: 0, y: 0 },
  cursorPosition: { x: 0, y: 0 },
  isDragging: false,

  // Anchor Point Actions
  addAnchorPoint: (point) => {
    set((state) => ({
      anchorPoints: [...state.anchorPoints, { ...point, name: '' }]
    }));
  },

  updateAnchorPoint: (id, updater) => {
    set((state) => ({
      anchorPoints: state.anchorPoints.map((point, index) =>
        index === id ? updater(point) : point
      )
    }));
  },

  deleteAnchorPoint: (id) => {
    set((state) => ({
      anchorPoints: state.anchorPoints.filter((_, index) => index !== id),
      selectedPoint: state.selectedPoint?.type === 'anchor' && state.selectedPoint.id === id ? null : state.selectedPoint
    }));
  },

  moveAnchorPoint: (id, newPosition) => {
    // Implementation needed
  },

  insertAnchorOnCurve: (segmentIndex, t) => {
    set((state) => {
      const prev = state.anchorPoints[segmentIndex];
      const next = state.anchorPoints[segmentIndex + 1];
      
      if (!prev || !next) return state;

      // Calculate the point on the curve
      const p1 = { x: prev.position.x + prev.handleOutOffset.x, y: prev.position.y + prev.handleOutOffset.y };
      const p2 = { x: next.position.x + next.handleInOffset.x, y: next.position.y + next.handleInOffset.y };
      
      // De Casteljau's algorithm to split the curve
      const lerp = (a: Vector2, b: Vector2, t: number) => ({
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t
      });
      
      const p01 = lerp(prev.position, p1, t);
      const p12 = lerp(p1, p2, t);
      const p23 = lerp(p2, next.position, t);
      const p012 = lerp(p01, p12, t);
      const p123 = lerp(p12, p23, t);
      const newPoint = lerp(p012, p123, t);
      
      // Create new anchor point
      const newAnchor: AnchorPoint = {
        position: newPoint,
        handleInOffset: { x: p012.x - newPoint.x, y: p012.y - newPoint.y },
        handleOutOffset: { x: p123.x - newPoint.x, y: p123.y - newPoint.y },
        isCurved: true,
        handlesAligned: true,
        name: ''
      };
      
      // Update the previous anchor's handle
      const updatedPrev = {
        ...prev,
        handleOutOffset: { x: p01.x - prev.position.x, y: p01.y - prev.position.y }
      };
      
      // Update the next anchor's handle
      const updatedNext = {
        ...next,
        handleInOffset: { x: p23.x - next.position.x, y: p23.y - next.position.y }
      };
      
      // Insert the new anchor
      const newAnchorPoints = [...state.anchorPoints];
      newAnchorPoints[segmentIndex] = updatedPrev;
      newAnchorPoints[segmentIndex + 1] = updatedNext;
      newAnchorPoints.splice(segmentIndex + 1, 0, newAnchor);
      
      return {
        ...state,
        anchorPoints: newAnchorPoints
      };
    });
  },

  toggleAnchorCurve: (id) => {
    
    set((state) => ({
      anchorPoints: state.anchorPoints.map((point, index) =>
        index === id ? { ...point, isCurved: !point.isCurved, handleInOffset: !point.isCurved ? { x: -30, y: 0 } : { x: 0, y: 0 }, handleOutOffset: !point.isCurved ? { x: 30, y: 0 } : { x: 0, y: 0 } } : point
      )
    }));
  },

  // Control Point Actions
  addControlPoint: (point) => {
    set((state) => ({
      controlPoints: [...state.controlPoints, { ...point, name: '' }]
    }));
  },

  updateControlPoint: (id, updates) => {
    set((state) => ({
      controlPoints: state.controlPoints.map(cp =>
        cp.id === id ? { ...cp, ...updates } : cp
      )
    }));
  },

  deleteControlPoint: (id) => {
    set((state) => ({
      controlPoints: state.controlPoints.filter(cp => cp.id !== id),
      selectedPoint: state.selectedPoint?.type === 'control' && state.selectedPoint.id === id ? null : state.selectedPoint
    }));
  },

  moveControlPoint: (id, newT) => {
    // Implementation needed
  },

  // Selection & UI Actions
  setSelectedPoint: (point) => {
    set({ selectedPoint: point });
  },

  setActiveTool: (tool) => {
    if(tool === get().activeTool) return;
    set({ activeTool: tool });
    set({ selectedPoint: null });
  },

  setViewport: (viewport) => {
    set({ viewport });
  },

	startPanning: (point) => set({ isPanning: true, lastPanPosition: point }),
  updatePanning: (point) => set((state) => {
    if (!state.isPanning) return state;
    const deltaX = point.x - state.lastPanPosition.x;
    const deltaY = point.y - state.lastPanPosition.y;
    return {
      viewport: {
        ...state.viewport,
        offsetX: state.viewport.offsetX + deltaX,
        offsetY: state.viewport.offsetY + deltaY
      },
      lastPanPosition: point
    };
  }),
  stopPanning: () => set({ isPanning: false }),

	zoom: (delta, center) => {
		const ZOOM_IN_FACTOR = 1.05;
		const ZOOM_OUT_FACTOR = 0.95;
		const MIN_SCALE = 0.25;
		const MAX_SCALE = 5;

     const state = get();
    const scaleFactor = delta > 0 ? ZOOM_IN_FACTOR : ZOOM_OUT_FACTOR;
    const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, state.viewport.scale * scaleFactor));
		
    set((state) => ({
      viewport: {
        scale: newScale,
        offsetX: center.x - (center.x - state.viewport.offsetX) * (newScale / state.viewport.scale),
        offsetY: center.y - (center.y - state.viewport.offsetY) * (newScale / state.viewport.scale)
      }
    }));
  },

  setCursorPosition: (position) => {
    set({ cursorPosition: position });
  },

  setIsDragging: (isDragging: boolean) => {
    set({ isDragging });
  },

  resetView: (fieldDimensions, containerSize) => {
    const scaleX = containerSize.width / fieldDimensions.width;
    const scaleY = containerSize.height / fieldDimensions.height;
    const scale = Math.min(scaleX, scaleY, 1);

    set({
      viewport: {
        scale,
        offsetX: (containerSize.width - fieldDimensions.width * scale) / 2,
        offsetY: (containerSize.height - fieldDimensions.height * scale) / 2
      }
    });
  },


  // Derived State
  getCurveSegments: () => {
    // Implementation needed
    return [];
  },

  getPointAtU: (u: number) => {
    const state = get();

    if (state.anchorPoints.length < 2) return { x: 0, y: 0 };

    const segmentIndex = Math.min(Math.floor(u), state.anchorPoints.length - 2);
    const t = Math.min(u - segmentIndex, 1.0);

    const p0 = state.anchorPoints[segmentIndex];
    const p3 = state.anchorPoints[segmentIndex + 1];
    const p1 = { x: p0.position.x + p0.handleOutOffset.x, y: p0.position.y + p0.handleOutOffset.y };
    const p2 = { x: p3.position.x + p3.handleInOffset.x, y: p3.position.y + p3.handleInOffset.y };

    const bezierCurve : BezierCurve = { p0: p0.position, p1, p2, p3: p3.position };
    return BezierCurve.evaluateAtT(bezierCurve, t);
  },

  getSelectedAnchor: () => {
    const state = get();
    if (state.selectedPoint && (state.selectedPoint.type === 'anchor' || state.selectedPoint.type === 'handleOut' || state.selectedPoint.type === 'handleIn')) {
      return state.anchorPoints[state.selectedPoint.id];
    }
    return undefined;
  },

  // Attribute Actions
  addAttribute: (pointId, attribute) => {
    set((state) => ({
      controlPoints: state.controlPoints.map(cp =>
        cp.id === pointId
          ? { ...cp, attributes: [...cp.attributes, attribute] }
          : cp
      )
    }));
  },

  updateAttribute: (pointId, attrIndex, updates) => {
    set((state) => ({
      controlPoints: state.controlPoints.map(cp =>
        cp.id === pointId
          ? {
              ...cp,
              attributes: cp.attributes.map((attr, i) =>
                i === attrIndex ? { ...attr, ...updates } : attr
              )
            }
          : cp
      )
    }));
  },

  removeAttribute: (pointId, attrIndex) => {
    set((state) => ({
      controlPoints: state.controlPoints.map(cp =>
        cp.id === pointId
          ? {
              ...cp,
              attributes: cp.attributes.filter((_, i) => i !== attrIndex)
            }
          : cp
      )
    }));
  }
}));