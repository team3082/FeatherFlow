import { create } from 'zustand';
import { AutoRoutine, AnchorPoint, ControlPoint } from '@/types';
import { useStudioStore } from './StudioStore';
import { 
  writeTextFile, 
  readTextFile,
  readDir,
  exists,
  remove,
  mkdir
} from '@tauri-apps/plugin-fs';
import { open } from '@tauri-apps/plugin-dialog';
import { appDataDir, join } from '@tauri-apps/plugin-path';

export interface ProjectState {
  projectPath: string | null;
  isProjectLoaded: boolean;

  routines: AutoRoutine[];
  currentRoutineId: string | null;

  // Project Management
  selectProjectFolder: () => Promise<void>;
  loadProject: (projectPath: string) => Promise<void>;
  unloadProject: () => void;
  getProjectInfo: () => { path: string; routineCount: number } | null;

  // Routine Management (Auto Paths)
  createRoutine: (name: string) => Promise<AutoRoutine>;
  duplicateRoutine: (routineId: string) => Promise<AutoRoutine>;
  deleteRoutine: (routineId: string) => Promise<void>;
  renameRoutine: (routineId: string, newName: string) => Promise<void>;
  updateDescription: (routineId: string, description: string) => Promise<void>;
  getRoutine: (routineId: string) => AutoRoutine | undefined;
  isNameAvailable: (name: string, excludeId?: string) => boolean;
  getUniqueName: (baseName: string) => string;

  // Current Routine Selection
  setCurrentRoutine: (routineId: string | null) => void;
  getCurrentRoutine: () => AutoRoutine | null;
  getCurrentRoutineName: () => string | null;

  // Studio Integration
  loadRoutineToStudio: (routineId: string) => void;
  syncFromStudio: () => void;
  saveCurrentToProject: () => Promise<void>;

  // Project Persistence
  saveRoutineToFile: (routine: AutoRoutine) => Promise<void>;
  saveProject: () => Promise<void>;
  exportProject: (exportPath: string) => Promise<void>;
}

export const useProjectStore = create<ProjectState>()((set, get) => ({
  // Initial state
  projectPath: null,
  isProjectLoaded: false,
  routines: [],
  currentRoutineId: null,

  // Project Management
  selectProjectFolder: async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select Project Folder'
      });

      if (selected && typeof selected === 'string') {
        await get().loadProject(selected);
      }
    } catch (error) {
      console.error('Failed to select folder:', error);
    }
  },

  loadProject: async (projectPath: string) => {

    try {
      const routinesPath = `${projectPath}/src/main/deploy/FeatherFlow`;
      
      // Check if routines folder exists, create if not
      const routinesFolderExists = await exists(routinesPath);
      if (!routinesFolderExists) {
        await mkdir(routinesPath, { recursive: true });
      }

      // Read all JSON files from the routines folder
      const entries = await readDir(routinesPath);
      const loadedRoutines: AutoRoutine[] = [];

      for (const entry of entries) {
        if (entry.name?.endsWith('.json')) {
          const filePath = `${routinesPath}/${entry.name}`;
          const content = await readTextFile(filePath);
          const routine = JSON.parse(content) as AutoRoutine;
          
          // Convert date strings back to Date objects
          routine.created = new Date(routine.created);
          routine.lastModified = new Date(routine.lastModified);
          
          loadedRoutines.push(routine);
        }
      }

      set({ 
        projectPath, 
        isProjectLoaded: true, 
        routines: loadedRoutines
      });
      
      console.log(`Loaded ${loadedRoutines.length} routines from ${projectPath}`);
    } catch (error) {
      console.error('Failed to load project:', error);
      set({ projectPath, isProjectLoaded: true, routines: [] });
    }
  },

  unloadProject: () => {
    set({ projectPath: null, isProjectLoaded: false, routines: [], currentRoutineId: null });
  },

  getCurrentRoutineName: () => {
    const state = get();
    const currentRoutine = state.currentRoutineId ? state.routines.find(r => r.id === state.currentRoutineId) : null;
    return currentRoutine ? currentRoutine.name : null;
  },

  getProjectInfo: () => {
    const state = get();
    if (!state.isProjectLoaded || !state.projectPath) return null;
    return { path: state.projectPath, routineCount: state.routines.length };
  },

  // Routine Management
  createRoutine: async (name: string) => {
    const state = get();
    const uniqueName = get().getUniqueName(name);
    
    
    const newRoutine: AutoRoutine = {
      id: Date.now().toString(),
      name: uniqueName,
      anchorPoints: [
        {
          "position": {
            "x": 391.94776240091824,
            "y": 241.1387862879399
          },
          "handleOutOffset": {
            "x": 20,
            "y": 0
          },
          "handleInOffset": {
            "x": -20,
            "y": 0
          },
          "isCurved": true,
          "handlesAligned": true,
          "name": ""
        },
        {
          "position": {
            "x": 490.80268935902006,
            "y": 196.870648085471
          },
          "handleOutOffset": {
            "x": 20,
            "y": 0
          },
          "handleInOffset": {
            "x": -20,
            "y": 0
          },
          "isCurved": true,
          "handlesAligned": true,
          "name": ""
        }
      ],
      controlPoints: [
        {
          "id": 1761525063428,
          "u": 0.5,
          "color": "red",
          "attributes": [
            {
              "type": "stop",
              "duration": 1
            }
          ],
          "name": ""
        }
      ],
      created: new Date(),
      lastModified: new Date()
    };
    
    set(state => ({ routines: [...state.routines, newRoutine] }));
    
    // Save to file if project is loaded
    if (state.isProjectLoaded && state.projectPath) {
      await get().saveRoutineToFile(newRoutine);
    }
    
    return newRoutine;
  },

  duplicateRoutine: async (routineId: string) => {
    const state = get();
    const original = state.routines.find(r => r.id === routineId);
    if (!original) throw new Error('Routine not found');

    const baseName = `${original.name} (Copy)`;
    const uniqueName = get().getUniqueName(baseName);

    const duplicate: AutoRoutine = {
      ...original,
      id: Date.now().toString(),
      name: uniqueName,
      created: new Date(),
      lastModified: new Date()
    };

    set(state => ({ routines: [...state.routines, duplicate] }));
    
    // Save to file if project is loaded
    if (state.isProjectLoaded && state.projectPath) {
      await get().saveRoutineToFile(duplicate);
    }
    
    return duplicate;
  },

  deleteRoutine: async (routineId: string) => {
    const state = get();
    const routine = state.routines.find(r => r.id === routineId);
    if (!routine) return;

    // Delete file if project is loaded
    if (state.isProjectLoaded && state.projectPath) {
      try {
        const filePath = `${state.projectPath}/src/main/deploy/FeatherFlow/${routine.name}.json`;
        const fileExists = await exists(filePath);
        if (fileExists) {
          await remove(filePath);
        }
      } catch (error) {
        console.error('Failed to delete routine file:', error);
      }
    }

    set(state => ({
      routines: state.routines.filter(r => r.id !== routineId),
      currentRoutineId: state.currentRoutineId === routineId ? null : state.currentRoutineId
    }));
  },

  renameRoutine: async (routineId: string, newName: string) => {
    const state = get();
    const routine = state.routines.find(r => r.id === routineId);
    if (!routine) return;

    // Check if name is available
    if (!get().isNameAvailable(newName, routineId)) {
      throw new Error('A routine with this name already exists');
    }

    const oldName = routine.name;

    // Update in state
    set(state => ({
      routines: state.routines.map(r =>
        r.id === routineId
          ? { ...r, name: newName, lastModified: new Date() }
          : r
      )
    }));

    // Rename file if project is loaded
    if (state.isProjectLoaded && state.projectPath) {
      try {
        const oldPath = `${state.projectPath}/src/main/deploy/FeatherFlow/${oldName}.json`;
        const newPath = `${state.projectPath}/src/main/deploy/FeatherFlow/${newName}.json`;
        
        const oldFileExists = await exists(oldPath);
        if (oldFileExists) {
          // Read, delete old, write new
          const content = await readTextFile(oldPath);
          const routineData = JSON.parse(content);
          routineData.name = newName;
          routineData.lastModified = new Date().toISOString();
          
          await writeTextFile(newPath, JSON.stringify(routineData, null, 2));
          await remove(oldPath);
        }
      } catch (error) {
        console.error('Failed to rename routine file:', error);
        throw error;
      }
    }
  },

  getRoutine: (routineId: string) => {
    return get().routines.find(r => r.id === routineId);
  },

  updateDescription: async (routineId: string, description: string) => {
    const state = get();
    const routine = state.routines.find(r => r.id === routineId);
    if (!routine) return;

    // Update in state
    set(state => ({
      routines: state.routines.map(r =>
        r.id === routineId
          ? { ...r, description, lastModified: new Date() }
          : r
      )
    }));

    // Save to file if project is loaded
    if (state.isProjectLoaded && state.projectPath) {
      const updatedRoutine = get().routines.find(r => r.id === routineId);
      if (updatedRoutine) {
        await get().saveRoutineToFile(updatedRoutine);
      }
    }
  },

  isNameAvailable: (name: string, excludeId?: string) => {
    const state = get();
    return !state.routines.some(r => r.name === name && r.id !== excludeId);
  },

  getUniqueName: (baseName: string) => {
    let name = baseName;
    let counter = 1;
    
    while (!get().isNameAvailable(name)) {
      name = `${baseName} ${counter}`;
      counter++;
    }
    
    return name;
  },

  // Current Routine Selection
  setCurrentRoutine: (routineId: string | null) => {
    set({ currentRoutineId: routineId });
  },

  getCurrentRoutine: () => {
    const state = get();
    return state.currentRoutineId ? state.routines.find(r => r.id === state.currentRoutineId) || null : null;
  },

  // Studio Integration
  loadRoutineToStudio: (routineId: string) => {
    const routine = get().routines.find(r => r.id === routineId);
    if (!routine) return;

    const studioStore = useStudioStore.getState();
    studioStore.setAnchorPoints(routine.anchorPoints);
    studioStore.setControlPoints(routine.controlPoints);
    studioStore.setSelectedPoint(null);
    
    // Set this as the current routine
    set({ currentRoutineId: routineId });
  },

  syncFromStudio: () => {
    const state = get();
    if (!state.currentRoutineId) return;

    const studioStore = useStudioStore.getState();
    const anchorPoints = studioStore.anchorPoints;
    const controlPoints = studioStore.controlPoints;

    set(state => ({
      routines: state.routines.map(r =>
        r.id === state.currentRoutineId
          ? { 
              ...r, 
              anchorPoints, 
              controlPoints, 
              lastModified: new Date()
            }
          : r
      )
    }));
  },

  saveCurrentToProject: async () => {
    const state = get();
    if (!state.currentRoutineId) return;

    // Sync from studio first
    get().syncFromStudio();

    // Save to file
    const routine = get().routines.find(r => r.id === state.currentRoutineId);
    if (routine && state.isProjectLoaded && state.projectPath) {
      await get().saveRoutineToFile(routine);
    }
  },

  // Helper method to save a routine to file
  saveRoutineToFile: async (routine: AutoRoutine) => {
    const state = get();
    if (!state.isProjectLoaded || !state.projectPath) return;

    try {
      const routinesPath = `${state.projectPath}/src/main/deploy/FeatherFlow`;
      const filePath = `${routinesPath}/${routine.name}.json`;
      
      // Ensure routines folder exists
      const folderExists = await exists(routinesPath);
      if (!folderExists) {
        await mkdir(routinesPath, { recursive: true });
      }

      // Write routine to file
      await writeTextFile(filePath, JSON.stringify(routine, null, 2));
      
      console.log(`Saved routine: ${routine.name}`);
      
      // Mark as not dirty
      set(state => ({
        routines: state.routines.map(r =>
          r.id === routine.id ? { ...r } : r
        )
      }));
    } catch (error) {
      console.error('Failed to save routine to file:', error);
    }
  },

  // Project Persistence
  saveProject: async () => {
    const state = get();
    if (!state.isProjectLoaded || !state.projectPath) return;

    // Save all routines
    for (const routine of state.routines) {
      await get().saveRoutineToFile(routine);
    }
    
    console.log('Project saved successfully');
  },

  exportProject: async (exportPath: string) => {
    // TODO: Export project to specified path
    console.log('Exporting project to:', exportPath);
  }
}));