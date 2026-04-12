import { create } from 'zustand';
import { AnchorPoint } from '@/types/AnchorPoint';
import { BezierCurve } from '@/types/BezierCurve';
import { Vector2 } from '@/types/Vector2';
import { ControlPoint, ControlPointAttribute } from '@/types/ControlPoint';
import { TrajectoryResult } from '@/types/PathPoint';
import { invoke } from '@tauri-apps/api/core';

type ActiveToolType = 'anchorTool' | 'controlTool';
const HISTORY_LIMIT = 100;

type StudioSnapshot = {
  anchorPoints: AnchorPoint[];
  controlPoints: ControlPoint[];
  selectedPoint: SelectedPoint;
};

const createSnapshot = (state: Pick<StudioState, 'anchorPoints' | 'controlPoints' | 'selectedPoint'>): StudioSnapshot => ({
  anchorPoints: structuredClone(state.anchorPoints),
  controlPoints: structuredClone(state.controlPoints),
  selectedPoint: state.selectedPoint ? { ...state.selectedPoint } : null
});

const withHistory = (
  state: StudioState,
  updater: (state: StudioState) => Partial<StudioState>
): Partial<StudioState> => {
  const nextState = updater(state);

  return {
    ...nextState,
    historyPast: [...state.historyPast, createSnapshot(state)].slice(-HISTORY_LIMIT),
    historyFuture: []
  };
};

export type SelectedPoint = {
  type: 'anchor' | 'handleOut' | 'handleIn' | 'control' | 'snapPoint';
  id: number | string; // number for anchor/control, string for snapPoint
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
  trajectory: TrajectoryResult | null;
  trajectoryTime: number;
  trajectoryPlaybackTime: number;
  isTrajectoryScrubbing: boolean;
  showingVelocity: boolean;
  historyPast: StudioSnapshot[];
  historyFuture: StudioSnapshot[];

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
  updateAnchorPointTransient: (id: number, updater: (current: AnchorPoint) => AnchorPoint) => void;
  deleteAnchorPoint: (id: number) => void;
  insertAnchorOnCurve: (segmentIndex: number, t: number) => void;
  toggleAnchorCurve: (id: number) => void;
  
  // Control Point Actions
  addControlPoint: (point: Omit<ControlPoint, 'name'>) => void;
  updateControlPoint: (id: number, updates: Partial<ControlPoint>) => void;
  updateControlPointTransient: (id: number, updates: Partial<ControlPoint>) => void;
  deleteControlPoint: (id: number) => void;
  
  // Attribute Actions
  addAttribute: (pointId: number, attribute: ControlPointAttribute) => void;
  updateAttribute: (pointId: number, attrIndex: number, updates:  Partial<ControlPointAttribute>) => void;
  removeAttribute: (pointId: number, attrIndex: number) => void;
  
  // Selection & UI Actions
  setSelectedPoint: (point: SelectedPoint) => void;
  setActiveTool: (tool: StudioState['activeTool']) => void;
  setViewport: (viewport: Viewport) => void;

  setCursorPosition: (position: Vector2) => void;
  setIsDragging: (isDragging: boolean) => void;
  invokeTrajectoryComputation: () => void;

  setTrajectory: (trajectory: TrajectoryResult | null) => void;
  setTrajectoryPlaybackTime: (time: number) => void;
  setIsTrajectoryScrubbing: (scrubbing: boolean) => void;
  setShowingVelocity: (showing: boolean) => void;
  captureHistorySnapshot: () => void;
  undo: () => void;
  redo: () => void;

  // Snap Point Actions
  snapAnchorToPoint: (anchorId: number, snapPointId: string, snapPointPosition: Vector2) => void;
  snapAnchorToPointTransient: (anchorId: number, snapPointId: string, snapPointPosition: Vector2) => void;
  unsnapAnchor: (anchorId: number) => void;
  unsnapAnchorTransient: (anchorId: number) => void;

	//Panning
	startPanning: (point: Vector2) => void;
  updatePanning: (point: Vector2) => void;
  stopPanning: () => void;
	zoom: (delta: number, center: Vector2) => void;
  resetView: (fieldDimensions: { width: number; height: number }, containerSize: { width: number; height: number }) => void;

  // Load/Save Actions
  setAnchorPoints: (points: AnchorPoint[]) => void;
  setControlPoints: (points: ControlPoint[]) => void;
  
  // Derived State
  getCurveSegments: () => BezierCurve[];
  getPointAtU: (u: number) => Vector2;
  getSelectedAnchor: () => AnchorPoint | undefined;
}

export const useStudioStore = create<StudioState>((set, get) => ({
  // Initial state
  anchorPoints: [],
  controlPoints: [],
  selectedPoint: null,
  activeTool: 'anchorTool',
  viewport: { scale: 1, offsetX: 0, offsetY: 0 },
  isPanning: false,
	lastPanPosition: { x: 0, y: 0 },
  cursorPosition: { x: 0, y: 0 },
  isDragging: false,
  trajectory: null,
  trajectoryTime: 0,
  trajectoryPlaybackTime: 0,
  isTrajectoryScrubbing: false,
  showingVelocity: false,
  historyPast: [],
  historyFuture: [],

  setShowingVelocity(showing: boolean) {
    set({ showingVelocity: showing });
  },

  captureHistorySnapshot() {
    set((state) => ({
      historyPast: [...state.historyPast, createSnapshot(state)].slice(-HISTORY_LIMIT),
      historyFuture: []
    }));
  },

  undo() {
    const state = get();
    const previous = state.historyPast[state.historyPast.length - 1];
    if (!previous) return;

    const currentSnapshot = createSnapshot(state);
    set({
      anchorPoints: structuredClone(previous.anchorPoints),
      controlPoints: structuredClone(previous.controlPoints),
      selectedPoint: previous.selectedPoint ? { ...previous.selectedPoint } : null,
      historyPast: state.historyPast.slice(0, -1),
      historyFuture: [currentSnapshot, ...state.historyFuture].slice(0, HISTORY_LIMIT)
    });

    get().invokeTrajectoryComputation();
  },

  redo() {
    const state = get();
    const next = state.historyFuture[0];
    if (!next) return;

    const currentSnapshot = createSnapshot(state);
    set({
      anchorPoints: structuredClone(next.anchorPoints),
      controlPoints: structuredClone(next.controlPoints),
      selectedPoint: next.selectedPoint ? { ...next.selectedPoint } : null,
      historyPast: [...state.historyPast, currentSnapshot].slice(-HISTORY_LIMIT),
      historyFuture: state.historyFuture.slice(1)
    });

    get().invokeTrajectoryComputation();
  },

  setTrajectoryPlaybackTime(time: number) {
    const total = get().trajectoryTime;
    const clamped = total > 0 ? Math.max(0, Math.min(total, time)) : 0;
    set({ trajectoryPlaybackTime: clamped });
  },

  setIsTrajectoryScrubbing(scrubbing: boolean) {
    set({ isTrajectoryScrubbing: scrubbing });
  },

  // Anchor Point Actions
  addAnchorPoint: (point) => {
    set((state) => withHistory(state, () => ({
      anchorPoints: [...state.anchorPoints, { ...point, name: '' }]
    })));
  },

  updateAnchorPoint: (id, updater) => {
    set((state) => withHistory(state, () => ({
      anchorPoints: state.anchorPoints.map((point, index) =>
        index === id ? updater(point) : point
      )
    })));
  },

  updateAnchorPointTransient: (id, updater) => {
    set((state) => ({
      anchorPoints: state.anchorPoints.map((point, index) =>
        index === id ? updater(point) : point
      )
    }));
  },

  deleteAnchorPoint: (id) => {
    set((state) => withHistory(state, () => ({
      anchorPoints: state.anchorPoints.filter((_, index) => index !== id),
      selectedPoint: state.selectedPoint?.type === 'anchor' && state.selectedPoint.id === id ? null : state.selectedPoint
    })));
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
      
      return withHistory(state, () => ({
        anchorPoints: newAnchorPoints
      }));
    });
  },

  toggleAnchorCurve: (id) => {
    
    set((state) => withHistory(state, () => ({
      anchorPoints: state.anchorPoints.map((point, index) =>
        index === id ? { ...point, isCurved: !point.isCurved, handleInOffset: !point.isCurved ? { x: -30, y: 0 } : { x: 0, y: 0 }, handleOutOffset: !point.isCurved ? { x: 30, y: 0 } : { x: 0, y: 0 } } : point
      )
    })));
  },

  // Control Point Actions
  addControlPoint: (point) => {
    set((state) => withHistory(state, () => ({
      controlPoints: [...state.controlPoints, { ...point, name: '' }]
    })));
  },

  updateControlPoint: (id, updates) => {
    set((state) => withHistory(state, () => ({
      controlPoints: state.controlPoints.map(cp =>
        cp.id === id ? { ...cp, ...updates } : cp
      )
    })));
  },

  updateControlPointTransient: (id, updates) => {
    set((state) => ({
      controlPoints: state.controlPoints.map(cp =>
        cp.id === id ? { ...cp, ...updates } : cp
      )
    }));
  },

  deleteControlPoint: (id) => {
    set((state) => withHistory(state, () => ({
      controlPoints: state.controlPoints.filter(cp => cp.id !== id),
      selectedPoint: state.selectedPoint?.type === 'control' && state.selectedPoint.id === id ? null : state.selectedPoint
    })));
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
      return state.anchorPoints[state.selectedPoint.id as number];
    }
    return undefined;
  },

  // Attribute Actions
  addAttribute: (pointId, attribute) => {
    set((state) => withHistory(state, () => ({
      controlPoints: state.controlPoints.map(cp =>
        cp.id === pointId
          ? { ...cp, attributes: [...cp.attributes, attribute] }
          : cp
      )
    })));
  },

  updateAttribute: (pointId, attrIndex, updates) => {
    set((state) => withHistory(state, () => ({
      controlPoints: state.controlPoints.map(cp =>
        cp.id === pointId
          ? {
              ...cp,
              attributes: cp.attributes.map((attr, i) =>
                i === attrIndex ? ({ ...attr, ...updates } as ControlPointAttribute) : attr
              )
            }
          : cp
      )
    })));
  },

  removeAttribute: (pointId, attrIndex) => {
    set((state) => withHistory(state, () => ({
      controlPoints: state.controlPoints.map(cp =>
        cp.id === pointId
          ? {
              ...cp,
              attributes: cp.attributes.filter((_, i) => i !== attrIndex)
            }
          : cp
      )
    })));
  },

  // Snap Point Actions
  snapAnchorToPoint: (anchorId, snapPointId, snapPointPosition) => {
    set((state) => withHistory(state, () => ({
      anchorPoints: state.anchorPoints.map((anchor, index) =>
        index === anchorId
          ? { ...anchor, position: { ...snapPointPosition }, snapPointId }
          : anchor
      )
    })));
  },

  snapAnchorToPointTransient: (anchorId, snapPointId, snapPointPosition) => {
    set((state) => ({
      anchorPoints: state.anchorPoints.map((anchor, index) =>
        index === anchorId
          ? { ...anchor, position: { ...snapPointPosition }, snapPointId }
          : anchor
      )
    }));
  },

  unsnapAnchor: (anchorId) => {
    set((state) => withHistory(state, () => ({
      anchorPoints: state.anchorPoints.map((anchor, index) => {
        if (index === anchorId) {
          const rest = { ...anchor };
          delete rest.snapPointId;
          return rest;
        }
        return anchor;
      })
    })));
  },

  unsnapAnchorTransient: (anchorId) => {
    set((state) => ({
      anchorPoints: state.anchorPoints.map((anchor, index) => {
        if (index === anchorId) {
          const rest = { ...anchor };
          delete rest.snapPointId;
          return rest;
        }
        return anchor;
      })
    }));
  },

  invokeTrajectoryComputation: () => {
    const state = get();
    invoke<TrajectoryResult>("compute_travel_time", {
      anchors: state.anchorPoints,
      controlPoints: state.controlPoints
    })
      .then(result => {
        set({ trajectory: result });
        set({ trajectoryTime: result.totalTime });
        set({ trajectoryPlaybackTime: 0 });
      });
  },

  // Load/Save Actions
  setAnchorPoints: (points) => set({ anchorPoints: points, historyPast: [], historyFuture: [] }),
  setControlPoints: (points) => set({ controlPoints: points, historyPast: [], historyFuture: [] }),
  setTrajectory: (trajectory) => set({ trajectory })
}));