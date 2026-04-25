import { create } from 'zustand';
import { AutoRoutine, SnapPoint, ProjectConfig, DeployCommandDefinition, CompiledTrajectoryFile } from '@/types';
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
import { invoke } from '@tauri-apps/api/core';

export interface ProjectState {
  projectPath: string | null;
  isProjectLoaded: boolean;

  routines: AutoRoutine[];
  currentRoutineId: string | null;
  deployCommands: DeployCommandDefinition[];

  // Snap Points (from global config)
  snapPoints: SnapPoint[];
  snapEnabled: boolean;
  snapRadius: number;

  // Snap Point Management
  loadConfig: () => Promise<void>;
  saveConfig: () => Promise<void>;
  loadDeployCommands: () => Promise<void>;
  addSnapPoint: (snapPoint: Omit<SnapPoint, 'id'>) => Promise<void>;
  updateSnapPoint: (id: string, updates: Partial<SnapPoint>) => Promise<void>;
  deleteSnapPoint: (id: string) => Promise<void>;
  toggleSnapEnabled: () => Promise<void>;
  setSnapRadius: (radius: number) => Promise<void>;
  getSnapPoint: (id: string) => SnapPoint | undefined;
  syncAnchorsToSnapPoint: (snapPointId: string) => Promise<void>;

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
}

export const useProjectStore = create<ProjectState>()((set, get) => ({
  // Initial state
  projectPath: null,
  isProjectLoaded: false,
  routines: [],
  currentRoutineId: null,
  deployCommands: [],
  snapPoints: [],
  snapEnabled: true,
  snapRadius: 6,

  loadDeployCommands: async () => {
    const state = get();
    if (!state.projectPath) return;

    const deployRoot = `${state.projectPath}/src/main/deploy`;

    try {
      const deployExists = await exists(deployRoot);
      if (!deployExists) {
        set({ deployCommands: [] });
        return;
      }

      const entries = await readDir(deployRoot);
      const loadedCommands: DeployCommandDefinition[] = [];

      for (const entry of entries) {
        if (!entry.name || !entry.name.toLowerCase().endsWith('.json')) {
          continue;
        }

        const filePath = `${deployRoot}/${entry.name}`;

        try {
          const content = await readTextFile(filePath);
          const parsed = JSON.parse(content);

          if (!Array.isArray(parsed)) {
            continue;
          }

          for (const rawCommand of parsed) {
            if (!rawCommand || typeof rawCommand !== 'object') {
              continue;
            }

            const candidate = rawCommand as {
              name?: unknown;
              parameters?: unknown;
            };

            if (typeof candidate.name !== 'string' || candidate.name.trim().length === 0) {
              continue;
            }

            const parameters = Array.isArray(candidate.parameters)
              ? candidate.parameters.reduce<{ name: string; type: string }[]>((result, parameter) => {
                  if (
                    parameter &&
                    typeof parameter === 'object' &&
                    typeof (parameter as { name?: unknown }).name === 'string' &&
                    typeof (parameter as { type?: unknown }).type === 'string'
                  ) {
                    result.push({
                      name: (parameter as { name: string }).name,
                      type: (parameter as { type: string }).type,
                    });
                  }

                  return result;
                }, [])
              : [];

            loadedCommands.push({
              name: candidate.name,
              parameters,
              sourceFile: entry.name,
            });
          }
        } catch (error) {
          console.error(`Failed to parse deploy command manifest ${filePath}:`, error);
        }
      }

      set({ deployCommands: loadedCommands });
    } catch (error) {
      console.error('Failed to load deploy commands:', error);
      set({ deployCommands: [] });
    }
  },

  // Snap Point Management
  loadConfig: async () => {
    const state = get();
    if (!state.projectPath) return;

    try {
      const configPath = `${state.projectPath}/src/main/deploy/FeatherFlow/config.json`;
      const configExists = await exists(configPath);

      if (configExists) {
        const content = await readTextFile(configPath);
        const config: ProjectConfig = JSON.parse(content);
        
        set({
          snapPoints: config.snapPoints || [],
          snapEnabled: config.snapSettings?.enabled ?? true,
          snapRadius: config.snapSettings?.radius ?? 6
        });
      } else {
        // Create default config
        set({
          snapPoints: [],
          snapEnabled: true,
          snapRadius: 6
        });
        await get().saveConfig();
      }
    } catch (error) {
      console.error('Failed to load config:', error);
      set({
        snapPoints: [],
        snapEnabled: true,
        snapRadius: 6
      });
    }
  },

  saveConfig: async () => {
    const state = get();
    if (!state.projectPath) return;

    try {
      const routinesPath = `${state.projectPath}/src/main/deploy/FeatherFlow`;
      const configPath = `${routinesPath}/config.json`;

      // Ensure folder exists
      const folderExists = await exists(routinesPath);
      if (!folderExists) {
        await mkdir(routinesPath, { recursive: true });
      }

      const config: ProjectConfig = {
        snapPoints: state.snapPoints,
        snapSettings: {
          enabled: state.snapEnabled,
          radius: state.snapRadius
        }
      };

      await writeTextFile(configPath, JSON.stringify(config, null, 2));
      console.log('Config saved successfully');
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  },

  addSnapPoint: async (snapPoint: Omit<SnapPoint, 'id'>) => {
    const newSnapPoint: SnapPoint = {
      ...snapPoint,
      id: `snap-${Date.now()}`
    };

    set(state => ({
      snapPoints: [...state.snapPoints, newSnapPoint]
    }));

    await get().saveConfig();
  },

  updateSnapPoint: async (id: string, updates: Partial<SnapPoint>) => {
    const state = get();
    const snapPoint = state.snapPoints.find(sp => sp.id === id);
    if (!snapPoint) return;

    // Check if position changed
    const positionChanged = updates.position && 
      (updates.position.x !== snapPoint.position.x || updates.position.y !== snapPoint.position.y);

    set(state => ({
      snapPoints: state.snapPoints.map(sp =>
        sp.id === id ? { ...sp, ...updates } : sp
      )
    }));

    await get().saveConfig();

    // If position changed, sync all anchors using this snap point
    if (positionChanged) {
      await get().syncAnchorsToSnapPoint(id);
    }
  },

  deleteSnapPoint: async (id: string) => {
    // Remove snap point from config
    set(state => ({
      snapPoints: state.snapPoints.filter(sp => sp.id !== id)
    }));

    await get().saveConfig();

    // Remove snapPointId references from all routines
    const state = get();
    for (const routine of state.routines) {
      let updated = false;
      const updatedAnchorPoints = routine.anchorPoints.map(anchor => {
        if (anchor.snapPointId === id) {
          updated = true;
          const { snapPointId, ...rest } = anchor;
          return rest;
        }
        return anchor;
      });

      if (updated) {
        const updatedRoutine = {
          ...routine,
          anchorPoints: updatedAnchorPoints,
          lastModified: new Date()
        };
        
        set(state => ({
          routines: state.routines.map(r => r.id === routine.id ? updatedRoutine : r)
        }));

        await get().saveRoutineToFile(updatedRoutine);
      }
    }
  },

  toggleSnapEnabled: async () => {
    set(state => ({ snapEnabled: !state.snapEnabled }));
    await get().saveConfig();
  },

  setSnapRadius: async (radius: number) => {
    set({ snapRadius: Math.max(1, Math.min(20, radius)) });
    await get().saveConfig();
  },

  getSnapPoint: (id: string) => {
    return get().snapPoints.find(sp => sp.id === id);
  },

  syncAnchorsToSnapPoint: async (snapPointId: string) => {
    const state = get();
    const snapPoint = state.snapPoints.find(sp => sp.id === snapPointId);
    if (!snapPoint) return;

    // Update all routines that have anchors referencing this snap point
    for (const routine of state.routines) {
      let updated = false;
      const updatedAnchorPoints = routine.anchorPoints.map(anchor => {
        if (anchor.snapPointId === snapPointId) {
          updated = true;
          return {
            ...anchor,
            position: { ...snapPoint.position }
          };
        }
        return anchor;
      });

      if (updated) {
        const updatedRoutine = {
          ...routine,
          anchorPoints: updatedAnchorPoints,
          lastModified: new Date()
        };
        
        set(state => ({
          routines: state.routines.map(r => r.id === routine.id ? updatedRoutine : r)
        }));

        await get().saveRoutineToFile(updatedRoutine);

        // If this is the current routine, update studio too
        if (state.currentRoutineId === routine.id) {
          const studioStore = useStudioStore.getState();
          studioStore.setAnchorPoints(updatedAnchorPoints);
        }
      }
    }
  },

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
        if (entry.name?.endsWith('.ff')) {
          const filePath = `${routinesPath}/${entry.name}`;
          const content = await readTextFile(filePath);
          const routine = JSON.parse(content) as AutoRoutine;
          
          // Convert date strings back to Date objects
          routine.created = new Date(routine.created);
          routine.lastModified = new Date(routine.lastModified);
          
          // Check for matching compiled artifact
          const baseName = entry.name.replace('.ff', '');
          const compiledPath = `${routinesPath}/${baseName}.fftraj.json`;
          const compiledExists = await exists(compiledPath);
          
          if (compiledExists) {
            try {
              const compiledContent = await readTextFile(compiledPath);
              const compiled = JSON.parse(compiledContent);
              routine.compiledVersion = compiled.formatVersion;
              routine.compiledAt = new Date(compiled.generatedAtUtc);
              routine.compiledFileName = `${baseName}.fftraj.json`;
            } catch (e) {
              console.warn(`Failed to parse compiled artifact for ${baseName}:`, e);
            }
          }
          
          loadedRoutines.push(routine);
        }
      }

      set({ 
        projectPath, 
        isProjectLoaded: true, 
        routines: loadedRoutines,
        deployCommands: []
      });
      
      // Load config after loading routines
      await get().loadConfig();
      await get().loadDeployCommands();
      
      console.log(`Loaded ${loadedRoutines.length} routines from ${projectPath}`);
    } catch (error) {
      console.error('Failed to load project:', error);
      set({ projectPath, isProjectLoaded: true, routines: [], deployCommands: [] });
    }
  },

  unloadProject: () => {
    set({ projectPath: null, isProjectLoaded: false, routines: [], deployCommands: [], currentRoutineId: null });
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
        const filePath = `${state.projectPath}/src/main/deploy/FeatherFlow/${routine.name}.ff`;
        const compiledPath = `${state.projectPath}/src/main/deploy/FeatherFlow/${routine.name}.fftraj.json`;
        const fileExists = await exists(filePath);
        if (fileExists) {
          await remove(filePath);
        }

        const compiledExists = await exists(compiledPath);
        if (compiledExists) {
          await remove(compiledPath);
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
        const oldPath = `${state.projectPath}/src/main/deploy/FeatherFlow/${oldName}.ff`;
        const newPath = `${state.projectPath}/src/main/deploy/FeatherFlow/${newName}.ff`;
        const oldCompiledPath = `${state.projectPath}/src/main/deploy/FeatherFlow/${oldName}.fftraj.json`;
        const newCompiledPath = `${state.projectPath}/src/main/deploy/FeatherFlow/${newName}.fftraj.json`;
        
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

        const oldCompiledExists = await exists(oldCompiledPath);
        if (oldCompiledExists) {
          const compiledContent = await readTextFile(oldCompiledPath);
          const compiledData = JSON.parse(compiledContent);
          compiledData.sourceRoutineName = newName;
          compiledData.generatedAtUtc = new Date().toISOString();

          await writeTextFile(newCompiledPath, JSON.stringify(compiledData, null, 2));
          await remove(oldCompiledPath);
        }

        set(state => ({
          routines: state.routines.map(r =>
            r.id === routineId
              ? {
                  ...r,
                  compiledFileName: `${newName}.fftraj.json`,
                }
              : r
          )
        }));
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
      const filePath = `${routinesPath}/${routine.name}.ff`;
      
      // Ensure routines folder exists
      const folderExists = await exists(routinesPath);
      if (!folderExists) {
        await mkdir(routinesPath, { recursive: true });
      }

      // Write source .ff file
      await writeTextFile(filePath, JSON.stringify(routine, null, 2));
      console.log(`Saved routine source: ${routine.name}.ff`);

      // Compile using the routine being saved, not whatever is currently loaded in Studio.
      const compiled = await invoke<CompiledTrajectoryFile>(
        'compile_routine_runtime',
        {
          anchors: routine.anchorPoints,
          controlPoints: routine.controlPoints,
          routineId: routine.id,
          routineName: routine.name,
          generatorVersion: '1.0.0', // TODO: Use actual app version
        }
      );

      // Write compiled artifact
      const compiledPath = `${routinesPath}/${routine.name}.fftraj.json`;
      await writeTextFile(compiledPath, JSON.stringify(compiled, null, 2));
      console.log(`Saved compiled trajectory: ${routine.name}.fftraj.json`);

      // Update routine metadata with compilation info
      set(state => ({
        routines: state.routines.map(r =>
          r.id === routine.id
            ? {
                ...r,
                compiledVersion: compiled.formatVersion,
                compiledAt: new Date(compiled.generatedAtUtc),
                compiledFileName: `${routine.name}.fftraj.json`,
              }
            : r
        )
      }));
    } catch (error) {
      console.error('Failed to save routine to file:', error);
      throw error; // Surface compile errors to user
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
  }
}));