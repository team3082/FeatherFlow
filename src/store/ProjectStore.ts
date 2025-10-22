import { create } from 'zustand';
import { AutoRoutine, AnchorPoint, ControlPoint } from '@/types';


export interface ProjectState {
  projectPath: string | null;
  isProjectLoaded: boolean;

  routines: AutoRoutine[];
  currentRoutineIndex: number | null;

  // Project Management
  loadProject: (projectPath: string) => Promise<void>;
  unloadProject: () => void;
  getProjectInfo: () => { path: string; routineCount: number } | null;

  // Routine Management (Auto Paths)
  createRoutine: (name: string) => AutoRoutine;
  duplicateRoutine: (routineId: string) => AutoRoutine;
  deleteRoutine: (routineId: string) => void;
  renameRoutine: (routineId: string, newName: string) => void;
  getRoutine: (routineId: string) => AutoRoutine | undefined;

  // Current Routine Selection
  setCurrentRoutine: (routineIndex: number) => void;
  getCurrentRoutine: () => AutoRoutine | null;

  // Studio Integration
  loadRoutineToStudio: (routineId: string) => void;
  syncFromStudio: () => void;
  saveCurrentToProject: () => void;

  // Project Persistence
  saveProject: () => Promise<void>;
  exportProject: (exportPath: string) => Promise<void>;
}

// Dummy data for development, is this bad practice, kinda...
const createDummyRoutines = (): AutoRoutine[] => [
  {
    id: '1',
    name: "4-Piece Auto",
    description: "Scores 4 pieces",
    anchorPoints: [
      { position: { x: 366.13828550008844, y: 240.93461530073677 }, handleOutOffset: { x: 0, y: 0 }, handleInOffset: { x: 0, y: 0 }, isCurved: false, handlesAligned: true, name: "Start" },
      { position: { x: 493.5433739495908, y: 194.54501650342553 }, handleOutOffset: { x: 0, y: 0 }, handleInOffset: { x: 0, y: 0 }, isCurved: false, handlesAligned: true, name: "" },
      { position: { x: 564.5950689188593, y: 245.7681328913397 }, handleInOffset: { x: -38.70994649565053, y: -23.560957160250084 }, handleOutOffset: { x: 46.00624093102715, y: 28.00187470685003 }, isCurved: true, handlesAligned: true, name: "" },
      { position: { x: 644.0924430946956, y: 280.63839196024725 }, handleOutOffset: { x: 0, y: 0 }, handleInOffset: { x: 0, y: 0 }, isCurved: false, handlesAligned: false, name: "End" },
      { position: { x: 536.2774802375741, y: 194.54501650342553 }, handleOutOffset: { x: 0, y: 0 }, handleInOffset: { x: 0, y: 0 }, isCurved: false, handlesAligned: true, name: "" }
    ],
    controlPoints: [
      { id: 3, u: 0.5, name: '', attributes: [{ type: 'command', action: 'intake' }], color: 'purple' },
      { id: 4, u: 1, name: '', attributes: [{ type: 'stop', duration: 2.0 }], color: 'red' },
      { id: 7, u: 3, name: '', attributes: [{ type: 'stop', duration: 2.0 }], color: 'purple' },
      { id: 5, u: 5, name: '', attributes: [{ type: 'stop', duration: 2.0 }], color: 'green' }
    ],
    created: new Date('2025-10-15'),
    lastModified: new Date('2025-10-15'),
    isDirty: false
  },
  {
    id: '2',
    name: "3-Piece Auto",
    description: "Quick 3 piece",
    anchorPoints: [
      { position: { x: 366.13828550008844, y: 240.93461530073677 }, handleOutOffset: { x: 0, y: 0 }, handleInOffset: { x: 0, y: 0 }, isCurved: false, handlesAligned: true, name: "Start" },
      { position: { x: 493.5433739495908, y: 194.54501650342553 }, handleOutOffset: { x: 0, y: 0 }, handleInOffset: { x: 0, y: 0 }, isCurved: false, handlesAligned: true, name: "" },
      { position: { x: 564.5950689188593, y: 245.7681328913397 }, handleInOffset: { x: -38.70994649565053, y: -23.560957160250084 }, handleOutOffset: { x: 46.00624093102715, y: 28.00187470685003 }, isCurved: true, handlesAligned: true, name: "" },
      { position: { x: 644.0924430946956, y: 280.63839196024725 }, handleOutOffset: { x: 0, y: 0 }, handleInOffset: { x: 0, y: 0 }, isCurved: false, handlesAligned: false, name: "End" },
      { position: { x: 536.2774802375741, y: 194.54501650342553 }, handleOutOffset: { x: 0, y: 0 }, handleInOffset: { x: 0, y: 0 }, isCurved: false, handlesAligned: true, name: "" }
    ],
    controlPoints: [
      { id: 3, u: 0.5, name: '', attributes: [{ type: 'command', action: 'intake' }], color: 'red' },
      { id: 4, u: 1, name: '', attributes: [{ type: 'stop', duration: 2.0 }], color: 'purple' },
      { id: 7, u: 3, name: '', attributes: [{ type: 'stop', duration: 2.0 }], color: 'green' },
      { id: 5, u: 5, name: '', attributes: [{ type: 'stop', duration: 2.0 }], color: 'red' }
    ],
    created: new Date('2025-10-14'),
    lastModified: new Date('2025-10-14'),
    isDirty: false
  },
  {
    id: '3',
    name: "One Piece",
    description: "Scores One Piece",
    anchorPoints: [
      { position: { x: 366.13828550008844, y: 240.93461530073677 }, handleOutOffset: { x: 0, y: 0 }, handleInOffset: { x: 0, y: 0 }, isCurved: false, handlesAligned: true, name: "Start" },
      { position: { x: 493.5433739495908, y: 194.54501650342553 }, handleOutOffset: { x: 0, y: 0 }, handleInOffset: { x: 0, y: 0 }, isCurved: false, handlesAligned: true, name: "" },
    ],
    controlPoints: [
      { id: 3, u: 0.5, name: '', attributes: [{ type: 'command', action: 'intake' }], color: 'red' },
      { id: 4, u: 1, name: '', attributes: [{ type: 'stop', duration: 2.0 }], color: 'purple' },
    ],
    created: new Date('2025-10-13'),
    lastModified: new Date('2025-10-13'),
    isDirty: false
  }
];

export const useProjectStore = create<ProjectState>()((set, get) => ({
  // Initial state
  projectPath: null,
  isProjectLoaded: false,
  routines: createDummyRoutines(),
  currentRoutineIndex: null,

  // Project Management
  loadProject: async (projectPath: string) => {
    set({ projectPath, isProjectLoaded: true });
    // TODO: Load actual project data
  },

  unloadProject: () => {
    set({ projectPath: null, isProjectLoaded: false, routines: [], currentRoutineIndex: null });
  },

  getProjectInfo: () => {
    const state = get();
    if (!state.isProjectLoaded || !state.projectPath) return null;
    return { path: state.projectPath, routineCount: state.routines.length };
  },

  // Routine Management
  createRoutine: (name: string) => {
    const newRoutine: AutoRoutine = {
      id: Date.now().toString(),
      name,
      anchorPoints: [],
      controlPoints: [],
      created: new Date(),
      lastModified: new Date(),
      isDirty: true
    };
    set(state => ({ routines: [...state.routines, newRoutine] }));
    return newRoutine;
  },

  duplicateRoutine: (routineId: string) => {
    const state = get();
    const original = state.routines.find(r => r.id === routineId);
    if (!original) throw new Error('Routine not found');

    const duplicate: AutoRoutine = {
      ...original,
      id: Date.now().toString(),
      name: `${original.name} (Copy)`,
      created: new Date(),
      lastModified: new Date(),
      isDirty: true
    };

    set(state => ({ routines: [...state.routines, duplicate] }));
    return duplicate;
  },

  deleteRoutine: (routineId: string) => {
    set(state => ({
      routines: state.routines.filter(r => r.id !== routineId),
      currentRoutineIndex: state.currentRoutineIndex !== null &&
        state.routines[state.currentRoutineIndex]?.id === routineId
        ? null : state.currentRoutineIndex
    }));
  },

  renameRoutine: (routineId: string, newName: string) => {
    set(state => ({
      routines: state.routines.map(r =>
        r.id === routineId
          ? { ...r, name: newName, lastModified: new Date(), isDirty: true }
          : r
      )
    }));
  },

  getRoutine: (routineId: string) => {
    return get().routines.find(r => r.id === routineId);
  },

  // Current Routine Selection
  setCurrentRoutine: (routineIndex: number) => {
    set({ currentRoutineIndex: routineIndex });
  },

  getCurrentRoutine: () => {
    const state = get();
    return state.currentRoutineIndex !== null ? state.routines[state.currentRoutineIndex] || null : null;
  },

  // Studio Integration
  loadRoutineToStudio: (routineId: string) => {
    // TODO: Load routine data into studio store
    console.log('Loading routine to studio:', routineId);
  },

  syncFromStudio: () => {
    // TODO: Sync changes from studio back to project
    console.log('Syncing from studio');
  },

  saveCurrentToProject: () => {
    // TODO: Save current studio state to project
    console.log('Saving current to project');
  },

  // Project Persistence
  saveProject: async () => {
    // TODO: Save project to file system
    console.log('Saving project');
  },

  exportProject: async (exportPath: string) => {
    // TODO: Export project to specified path
    console.log('Exporting project to:', exportPath);
  }
}));