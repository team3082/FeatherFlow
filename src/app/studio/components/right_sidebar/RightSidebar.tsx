import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useStudioStore } from '@/store/StudioStore';
import type { AnchorPoint } from '@/types/AnchorPoint';
import type { TrajectoryResult } from '@/types/PathPoint';
import AnchorPointsList from './AnchorPointsList';
import ControlPointsList from './ControlPointsList';

// Default GA Hyperparameters
const DEFAULT_GA_CONFIG = {
  populationSize: 28,
  generations: 80,
  eliteCount: 3,
  tournamentSize: 4,
  baseMutationRate: 0.24,
  minMutationRate: 0.06,
  baseMutationStrength: 18.0,
  minMutationStrength: 1.2,
  noImprovementLimit: 20,
};

// Default SA Hyperparameters
const DEFAULT_SA_CONFIG = {
  iterations: 300,
  initialTemperature: 1.5,
  coolingRate: 0.99,
  mutationStrength: 8.0,
};

const MAX_HANDLE_MAGNITUDE = 280;
const COST_EVAL_CONCURRENCY = 6;
type HandleAdjustMode = 'both' | 'magnitude' | 'rotation';
type OptimizerKind = 'ga' | 'sa';

// Helper: Convert x,y offset to magnitude + angle
const offsetToMagnitudeAngle = (offset: { x: number; y: number }) => {
  const magnitude = Math.hypot(offset.x, offset.y);
  const angle = Math.atan2(offset.y, offset.x);
  return { magnitude, angle };
};

// Helper: Convert magnitude + angle to x,y offset
const magnitudeAngleToOffset = (magnitude: number, angle: number) => {
  // Clamp magnitude to max
  const clampedMag = Math.min(magnitude, MAX_HANDLE_MAGNITUDE);
  return {
    x: Math.cos(angle) * clampedMag,
    y: Math.sin(angle) * clampedMag,
  };
};

// Helper: Get handle representation (magnitude + angle)
const getHandleRepresentation = (offset: { x: number; y: number }) => {
  const mag = Math.hypot(offset.x, offset.y);
  const angle = Math.atan2(offset.y, offset.x);
  return { magnitude: mag, angle };
};

export default function RightSidebar() {
  const [optimizationStatus, setOptimizationStatus] = useState<'idle' | 'running' | 'complete'>('idle');
  const [activeOptimizer, setActiveOptimizer] = useState<OptimizerKind | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentIteration, setCurrentIteration] = useState(0);
  const [bestTravelTime, setBestTravelTime] = useState<number | null>(null);
  const [handleAdjustMode, setHandleAdjustMode] = useState<HandleAdjustMode>('both');
  
  const [gaConfig, setGaConfig] = useState(DEFAULT_GA_CONFIG);
  const [gaBestTime, setGaBestTime] = useState<number | null>(null);
  
  const [saIterations, setSaIterations] = useState(300);
  const [saMutationStrength, setSaMutationStrength] = useState(8.0);
  const [saBestTime, setSaBestTime] = useState<number | null>(null);
  
  const [sequentialResults, setSequentialResults] = useState<{ ga: number | null; sa: number | null; improvement: number | null }>({
    ga: null,
    sa: null,
    improvement: null
  });

  const anchorPoints = useStudioStore((state) => state.anchorPoints);
  const controlPoints = useStudioStore((state) => state.controlPoints);
  const motionSettings = useStudioStore((state) => state.motionSettings);
  const setAnchorPoints = useStudioStore((state) => state.setAnchorPoints);
  const invokeTrajectoryComputation = useStudioStore((state) => state.invokeTrajectoryComputation);

  // Clone anchors preserving positions and handles
  const cloneHandlesOnly = (anchors: AnchorPoint[]): AnchorPoint[] =>
    anchors.map((a) => ({
      ...a,
      position: { ...a.position },
      handleInOffset: { ...a.handleInOffset },
      handleOutOffset: { ...a.handleOutOffset },
    }));

  const gaussianNoise = () => {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  };

  const wrapAngle = (angle: number) => {
    let next = angle;
    while (next > Math.PI) next -= Math.PI * 2;
    while (next < -Math.PI) next += Math.PI * 2;
    return next;
  };

  const individualKey = (anchors: AnchorPoint[]) =>
    anchors.map((anchor) => {
      const p = anchor.position;
      const hIn = getHandleRepresentation(anchor.handleInOffset);
      const hOut = getHandleRepresentation(anchor.handleOutOffset);
      return [
        p.x.toFixed(3), p.y.toFixed(3),
        hIn.magnitude.toFixed(3), hIn.angle.toFixed(6),
        hOut.magnitude.toFixed(3), hOut.angle.toFixed(6),
        anchor.isCurved ? '1' : '0',
        anchor.handlesAligned ? '1' : '0',
      ].join(',');
    }).join('|');

  const computeCost = async (anchors: AnchorPoint[], cache: Map<string, number>) => {
    const key = individualKey(anchors);
    const cachedCost = cache.get(key);
    if (cachedCost !== undefined) return cachedCost;

    const result = await invoke('compute_travel_time', {
      anchors,
      controlPoints: controlPoints.length > 0 ? controlPoints : undefined,
      motionSettings,
    });
    const totalTime = (result as TrajectoryResult).totalTime;
    cache.set(key, totalTime);
    return totalTime;
  };

  const evaluatePopulation = async (population: AnchorPoint[][], cache: Map<string, number>) => {
    const costs = new Array<number>(population.length);
    let nextIndex = 0;
    const worker = async () => {
      while (nextIndex < population.length) {
        const current = nextIndex;
        nextIndex += 1;
        costs[current] = await computeCost(population[current], cache);
      }
    };
    const workerCount = Math.min(COST_EVAL_CONCURRENCY, population.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    return costs;
  };

  const selectParent = (ranked: { ind: AnchorPoint[]; cost: number }[], tournamentSize: number) => {
    let winner = ranked[Math.floor(Math.random() * ranked.length)];
    for (let i = 1; i < tournamentSize; i += 1) {
      const contender = ranked[Math.floor(Math.random() * ranked.length)];
      if (contender.cost < winner.cost) winner = contender;
    }
    return winner.ind;
  };

  // Mutate handle using magnitude + angle representation
  const mutateHandle = (
    offset: { x: number; y: number }, 
    mutationStrength: number,
    mode: HandleAdjustMode = 'both'
  ): { x: number; y: number } => {
    const { magnitude, angle } = offsetToMagnitudeAngle(offset);

    let newMagnitude = magnitude;
    let newAngle = angle;

    if (mode === 'both' || mode === 'magnitude') {
      // Mutate magnitude (always positive)
      newMagnitude = Math.max(0, magnitude + gaussianNoise() * mutationStrength);
    }

    if (mode === 'both' || mode === 'rotation') {
      // Mutate angle (wrap around -PI to PI)
      newAngle = angle + gaussianNoise() * (mutationStrength / 20); // Angle noise scaled down
      // Normalize angle to [-PI, PI]
      while (newAngle > Math.PI) newAngle -= Math.PI * 2;
      while (newAngle < -Math.PI) newAngle += Math.PI * 2;
    }
    
    return magnitudeAngleToOffset(newMagnitude, newAngle);
  };

  // GA Mutation - Mutates handles using magnitude/angle
  const mutateGA = (
    anchors: AnchorPoint[],
    mutationRate: number,
    mutationStrength: number,
    mode: HandleAdjustMode,
  ) => {
    return anchors.map((anchor) => {
      if (Math.random() > mutationRate) {
        return {
          ...anchor,
          position: { ...anchor.position },
          handleInOffset: { ...anchor.handleInOffset },
          handleOutOffset: { ...anchor.handleOutOffset },
        };
      }
      
      // Only mutate curved points
      if (!anchor.isCurved && Math.random() > 0.15) {
        return {
          ...anchor,
          position: { ...anchor.position },
          handleInOffset: { ...anchor.handleInOffset },
          handleOutOffset: { ...anchor.handleOutOffset },
        };
      }
      
      const mutated = {
        ...anchor,
        position: { ...anchor.position },
        handleInOffset: { ...anchor.handleInOffset },
        handleOutOffset: { ...anchor.handleOutOffset },
      };
      
      // Mutate one handle
      if (Math.random() > 0.5) {
        mutated.handleInOffset = mutateHandle(anchor.handleInOffset, mutationStrength, mode);
        
        if (anchor.handlesAligned) {
          // Keep same magnitude for out handle, opposite angle
          const outMag = Math.hypot(anchor.handleOutOffset.x, anchor.handleOutOffset.y);
          const inAngle = Math.atan2(mutated.handleInOffset.y, mutated.handleInOffset.x);
          mutated.handleOutOffset = magnitudeAngleToOffset(outMag, inAngle + Math.PI);
        }
      } else {
        mutated.handleOutOffset = mutateHandle(anchor.handleOutOffset, mutationStrength, mode);
        
        if (anchor.handlesAligned) {
          const inMag = Math.hypot(anchor.handleInOffset.x, anchor.handleInOffset.y);
          const outAngle = Math.atan2(mutated.handleOutOffset.y, mutated.handleOutOffset.x);
          mutated.handleInOffset = magnitudeAngleToOffset(inMag, outAngle + Math.PI);
        }
      }
      
      return mutated;
    });
  };

  const crossover = (p1: AnchorPoint[], p2: AnchorPoint[]): AnchorPoint[] => {
    return p1.map((anchor, i) => {
      const source = Math.random() > 0.5 ? anchor : p2[i];
      return {
        ...source,
        position: { ...source.position },
        handleInOffset: { ...source.handleInOffset },
        handleOutOffset: { ...source.handleOutOffset },
      };
    });
  };

  // SA Perturbation using magnitude/angle
  const perturbHandles = (
    anchors: AnchorPoint[],
    temperature: number,
    maxStrength: number,
    mode: HandleAdjustMode,
  ) => {
    const next = cloneHandlesOnly(anchors);
    if (next.length === 0) return next;
    
    // Scale mutation strength by temperature
    const normalizedTemp = Math.max(0, Math.min(1, temperature / DEFAULT_SA_CONFIG.initialTemperature));
    const stepSize = maxStrength * (0.3 + normalizedTemp * 0.7);
    
    // Only mutate curved points
    const curvedIndices = next.map((anchor, index) => anchor.isCurved ? index : -1).filter(i => i >= 0);
    const sourceIndices = curvedIndices.length > 0 ? curvedIndices : next.map((_, index) => index);
    
    const mutationCount = Math.random() > 0.7 ? 2 : 1;
    
    for (let mutation = 0; mutation < mutationCount; mutation++) {
      const idx = sourceIndices[Math.floor(Math.random() * sourceIndices.length)];
      const anchor = next[idx];
      
      // Randomly pick which handle to mutate
      if (Math.random() > 0.5) {
        anchor.handleInOffset = mutateHandle(anchor.handleInOffset, stepSize, mode);
        
        if (anchor.handlesAligned) {
          const outMag = Math.hypot(anchor.handleOutOffset.x, anchor.handleOutOffset.y);
          const inAngle = Math.atan2(anchor.handleInOffset.y, anchor.handleInOffset.x);
          anchor.handleOutOffset = magnitudeAngleToOffset(outMag, inAngle + Math.PI);
        }
      } else {
        anchor.handleOutOffset = mutateHandle(anchor.handleOutOffset, stepSize, mode);
        
        if (anchor.handlesAligned) {
          const inMag = Math.hypot(anchor.handleInOffset.x, anchor.handleInOffset.y);
          const outAngle = Math.atan2(anchor.handleOutOffset.y, anchor.handleOutOffset.x);
          anchor.handleInOffset = magnitudeAngleToOffset(inMag, outAngle + Math.PI);
        }
      }
    }
    
    return next;
  };

  const runGeneticAlgorithm = async (): Promise<{ individual: AnchorPoint[]; cost: number } | null> => {
    if (anchorPoints.length < 2) return null;

    const populationSize = Math.max(8, Math.round(gaConfig.populationSize));
    const generations = Math.max(10, Math.round(gaConfig.generations));
    const eliteCount = Math.min(Math.max(1, Math.round(gaConfig.eliteCount)), Math.max(1, populationSize - 1));
    const tournamentSize = Math.min(Math.max(2, Math.round(gaConfig.tournamentSize)), populationSize);
    const baseMutationRate = Math.max(0.01, gaConfig.baseMutationRate);
    const minMutationRate = Math.min(Math.max(0.001, gaConfig.minMutationRate), baseMutationRate);
    const baseMutationStrength = Math.max(0.1, gaConfig.baseMutationStrength);
    const minMutationStrength = Math.min(Math.max(0.05, gaConfig.minMutationStrength), baseMutationStrength);
    const noImprovementLimit = Math.max(3, Math.round(gaConfig.noImprovementLimit));
    
    const costCache = new Map<string, number>();
    const baseline = cloneHandlesOnly(anchorPoints);
    let population = Array.from({ length: populationSize }, (_, i) => {
      if (i === 0) return cloneHandlesOnly(baseline);
      return mutateGA(
        cloneHandlesOnly(baseline),
        baseMutationRate,
        baseMutationStrength,
        handleAdjustMode,
      );
    });

    let bestEverIndividual = cloneHandlesOnly(baseline);
    let bestEverCost = Number.POSITIVE_INFINITY;
    let generationsWithoutImprovement = 0;

    for (let gen = 0; gen < generations; gen++) {
      setCurrentIteration(gen + 1);
      setProgress((gen + 1) / generations);

      const progress = gen / Math.max(1, generations - 1);
      const mutationRate = baseMutationRate - (baseMutationRate - minMutationRate) * progress;
      const mutationStrength = baseMutationStrength - (baseMutationStrength - minMutationStrength) * progress;

      const costs = await evaluatePopulation(population, costCache);
      const ranked = population.map((ind, i) => ({ ind, cost: costs[i] })).sort((a, b) => a.cost - b.cost);

      const bestOfGen = ranked[0];
      if (bestOfGen.cost < bestEverCost) {
        bestEverCost = bestOfGen.cost;
        bestEverIndividual = cloneHandlesOnly(bestOfGen.ind);
        generationsWithoutImprovement = 0;
        setBestTravelTime(bestEverCost);
        setAnchorPoints(bestEverIndividual);
        invokeTrajectoryComputation();
      } else {
        generationsWithoutImprovement += 1;
      }

      if (generationsWithoutImprovement >= noImprovementLimit) break;

      const newPopulation: AnchorPoint[][] = ranked.slice(0, eliteCount).map(item => cloneHandlesOnly(item.ind));
      
      while (newPopulation.length < populationSize) {
        const parentA = selectParent(ranked, tournamentSize);
        const parentB = selectParent(ranked, tournamentSize);
        let child = crossover(parentA, parentB);
        child = mutateGA(child, mutationRate, mutationStrength, handleAdjustMode);
        newPopulation.push(child);
      }

      population = newPopulation;
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    return { individual: bestEverIndividual, cost: bestEverCost };
  };

  const runSimulatedAnnealing = async (startIndividual: AnchorPoint[]): Promise<{ individual: AnchorPoint[]; cost: number } | null> => {
    if (anchorPoints.length < 2) return null;
    
    const cache = new Map<string, number>();
    let current = cloneHandlesOnly(startIndividual);
    let best = cloneHandlesOnly(startIndividual);
    let currentCost = await computeCost(current, cache);
    let bestCost = currentCost;
    let temperature = DEFAULT_SA_CONFIG.initialTemperature;

    for (let i = 0; i < saIterations; i++) {
      setCurrentIteration(i + 1);
      setProgress((i + 1) / saIterations);
      
      const candidate = perturbHandles(current, temperature, saMutationStrength, handleAdjustMode);
      const candidateCost = await computeCost(candidate, cache);
      const delta = candidateCost - currentCost;
      const accept = delta <= 0 || Math.random() < Math.exp(-delta / Math.max(temperature, 1e-9));
      
      if (accept) {
        current = candidate;
        currentCost = candidateCost;
        if ((i + 1) % 5 === 0) {
          setAnchorPoints(current);
          invokeTrajectoryComputation();
        }
      }
      
      if (candidateCost < bestCost) {
        best = cloneHandlesOnly(candidate);
        bestCost = candidateCost;
        setBestTravelTime(bestCost);
        setAnchorPoints(best);
        invokeTrajectoryComputation();
      }
      
      setSaBestTime(bestCost);
      temperature = Math.max(1e-4, temperature * DEFAULT_SA_CONFIG.coolingRate);
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    setAnchorPoints(best);
    invokeTrajectoryComputation();
    setBestTravelTime(bestCost);
    
    return { individual: best, cost: bestCost };
  };

  const handleRunGA = async () => {
    setOptimizationStatus('running');
    setActiveOptimizer('ga');
    setBestTravelTime(null);
    setProgress(0);
    setCurrentIteration(0);
    
    try {
      const result = await runGeneticAlgorithm();
      if (result) {
        setGaBestTime(result.cost);
        setBestTravelTime(result.cost);
      }
    } catch (error) {
      console.error('GA failed:', error);
      alert('Genetic Algorithm optimization failed');
    } finally {
      setOptimizationStatus('complete');
      setActiveOptimizer(null);
    }
  };

  const handleRunSA = async () => {
    setOptimizationStatus('running');
    setActiveOptimizer('sa');
    setBestTravelTime(null);
    setProgress(0);
    setCurrentIteration(0);
    
    try {
      const result = await runSimulatedAnnealing(anchorPoints);
      if (result) {
        setSaBestTime(result.cost);
        setBestTravelTime(result.cost);
        setAnchorPoints(result.individual);
        invokeTrajectoryComputation();
      }
    } catch (error) {
      console.error('SA failed:', error);
      alert('Simulated Annealing optimization failed');
    } finally {
      setOptimizationStatus('complete');
      setActiveOptimizer(null);
    }
  };

  const handleSequentialOptimization = async () => {
    setOptimizationStatus('running');
    setActiveOptimizer('ga');
    setBestTravelTime(null);
    setSequentialResults({ ga: null, sa: null, improvement: null });
    
    try {
      const gaResult = await runGeneticAlgorithm();
      if (!gaResult) throw new Error('GA failed');
      
      setSequentialResults(prev => ({ ...prev, ga: gaResult.cost }));
      setBestTravelTime(gaResult.cost);
      
      setActiveOptimizer('sa');
      setProgress(0);
      setCurrentIteration(0);
      
      const saResult = await runSimulatedAnnealing(gaResult.individual);
      if (saResult) {
        const improvement = ((gaResult.cost - saResult.cost) / gaResult.cost) * 100;
        setSequentialResults({
          ga: gaResult.cost,
          sa: saResult.cost,
          improvement: improvement
        });
        setBestTravelTime(saResult.cost);
        setAnchorPoints(saResult.individual);
        invokeTrajectoryComputation();
      }
    } catch (error) {
      console.error('Sequential optimization failed:', error);
      alert('Optimization failed');
    } finally {
      setOptimizationStatus('complete');
      setActiveOptimizer(null);
    }
  };

  return (
    <aside className="w-80 bg-gray-850 border-l border-gray-700 flex flex-col overflow-auto">
      <div className="p-4 space-y-4">
        <AnchorPointsList />
        <ControlPointsList />
        
        <div className="space-y-3 rounded-sm">
          <div className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-1.5">
            OPTIMIZE HANDLES
          </div>

          <div className="px-1 py-1.5 space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-300">Adjust Mode</h4>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: 'both', label: 'Both' },
                { value: 'magnitude', label: 'Magnitude' },
                { value: 'rotation', label: 'Rotation' },
              ] as const).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setHandleAdjustMode(option.value)}
                  disabled={optimizationStatus === 'running'}
                  className={`py-1.5 rounded-sm text-xs font-medium transition-colors ${
                    handleAdjustMode === option.value
                      ? 'bg-blue-600 text-white shadow-[0_0_0_1px_rgba(96,165,250,0.25)]'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-blue-200'
                  } disabled:opacity-50`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          
          <div className="border-t border-blue-900/30 pt-3 px-1 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-gray-300 font-medium text-sm">Genetic Algorithm</h4>
            </div>

            <div className="space-y-2">
              <div>
                <label className="text-xs text-gray-400 block mb-1">
                  Population Size: {gaConfig.populationSize}
                </label>
                <input
                  type="range"
                  value={gaConfig.populationSize}
                  onChange={e => setGaConfig(prev => ({ ...prev, populationSize: parseInt(e.target.value, 10) }))}
                  min={12}
                  max={64}
                  step={2}
                  className="w-full h-1.5 bg-gray-700 rounded-sm appearance-none cursor-pointer"
                  disabled={optimizationStatus === 'running'}
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">
                  Generations: {gaConfig.generations}
                </label>
                <input
                  type="range"
                  value={gaConfig.generations}
                  onChange={e => setGaConfig(prev => ({ ...prev, generations: parseInt(e.target.value, 10) }))}
                  min={30}
                  max={220}
                  step={10}
                  className="w-full h-1.5 bg-gray-700 rounded-sm appearance-none cursor-pointer"
                  disabled={optimizationStatus === 'running'}
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">
                  Mutation Strength: {gaConfig.baseMutationStrength.toFixed(1)}px
                </label>
                <input
                  type="range"
                  value={gaConfig.baseMutationStrength}
                  onChange={e => setGaConfig(prev => ({ ...prev, baseMutationStrength: parseFloat(e.target.value) }))}
                  min={4}
                  max={28}
                  step={1}
                  className="w-full h-1.5 bg-gray-700 rounded-sm appearance-none cursor-pointer"
                  disabled={optimizationStatus === 'running'}
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">
                  Mutation Rate: {gaConfig.baseMutationRate.toFixed(2)}
                </label>
                <input
                  type="range"
                  value={gaConfig.baseMutationRate}
                  onChange={e => setGaConfig(prev => ({
                    ...prev,
                    baseMutationRate: parseFloat(e.target.value),
                    minMutationRate: Math.min(prev.minMutationRate, parseFloat(e.target.value)),
                  }))}
                  min={0.05}
                  max={0.5}
                  step={0.01}
                  className="w-full h-1.5 bg-gray-700 rounded-sm appearance-none cursor-pointer"
                  disabled={optimizationStatus === 'running'}
                />
              </div>
            </div>

            <button
              onClick={handleRunGA}
              disabled={optimizationStatus === 'running' || anchorPoints.length < 2}
              className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-sm text-sm font-medium disabled:opacity-50"
            >
              Genetic Algorithm (Global)
            </button>
            <p className="text-xs text-gray-400 mt-1 text-center">
              Finds good handle positions globally
            </p>
            {gaBestTime && (
              <p className="text-xs text-blue-300 mt-1 text-center">
                Best: {gaBestTime.toFixed(3)}s
              </p>
            )}
          </div>

          <div className="border-t border-blue-900/30 pt-3 px-1 space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="text-white-300 font-medium text-sm">Simulated Annealing</h4>
            </div>
            
            <div className="space-y-2">
              <div>
                <label className="text-xs text-gray-400 block mb-1">
                  Iterations: {saIterations}
                </label>
                <input 
                  type="range" 
                  value={saIterations} 
                  onChange={e => setSaIterations(parseInt(e.target.value))}
                  min={100} 
                  max={500} 
                  step={50}
                  className="w-full h-1.5 bg-gray-700 rounded-sm appearance-none cursor-pointer"
                  disabled={optimizationStatus === 'running'}
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Fast</span>
                  <span>Thorough</span>
                </div>
              </div>
              
              <div>
                <label className="text-xs text-gray-400 block mb-1">
                  Handle Movement: {saMutationStrength.toFixed(1)}px
                </label>
                <input 
                  type="range" 
                  value={saMutationStrength} 
                  onChange={e => setSaMutationStrength(parseFloat(e.target.value))}
                  min={2} 
                  max={20} 
                  step={1}
                  className="w-full h-1.5 bg-gray-700 rounded-sm appearance-none cursor-pointer"
                  disabled={optimizationStatus === 'running'}
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Fine</span>
                  <span>Broad</span>
                </div>
              </div>
            </div>
            
            <button
              onClick={handleRunSA}
              disabled={optimizationStatus === 'running' || anchorPoints.length < 2}
              className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-sm text-sm font-medium disabled:opacity-50"
            >
              Run Handle Fine-tuning
            </button>
          </div>
          
          <div className="border-t border-blue-900/30 pt-3 px-1">
            <button
              onClick={handleSequentialOptimization}
              disabled={optimizationStatus === 'running' || anchorPoints.length < 2}
              className="w-full py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-sm text-sm font-medium disabled:opacity-50"
            >
              Full Optimization (GA → Fine-tune)
            </button>
            
            {sequentialResults.sa && (
              <div className="mt-2 rounded-xl bg-blue-950/30 px-2.5 py-2 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-blue-400">GA:</span>
                  <span>{sequentialResults.ga?.toFixed(3)}s</span>
                  <span className="text-blue-300">Fine-tuned:</span>
                  <span>{sequentialResults.sa?.toFixed(3)}s</span>
                </div>
                <div className="flex justify-between text-blue-300">
                  <span>Improvement:</span>
                  <span>{sequentialResults.improvement?.toFixed(2)}%</span>
                </div>
              </div>
            )}
          </div>
          
          {optimizationStatus === 'running' && (
            <div className="rounded-2xl border border-blue-900/40 bg-gray-900/90 p-3">
            <div className="border-t border-blue-900/30 pt-3 px-1">
                <div className="flex justify-between">
                  <span className={
                    activeOptimizer === 'ga'
                      ? 'text-blue-400'
                        : 'text-blue-300'
                  }>
                    {activeOptimizer === 'ga'
                      ? 'GA'
                      : 'Fine-tuning'} {Math.round(progress * 100)}%
                  </span>
                  <span className="text-gray-400">Iteration {currentIteration}</span>
                </div>
                <div className="w-full bg-gray-700 rounded-sm h-1.5">
                  <div className="bg-blue-500 h-1.5 rounded-sm transition-all" style={{ width: `${progress * 100}%` }} />
                </div>
                {bestTravelTime && (
                  <div className="text-blue-300 text-center mt-1">
                    Best: {bestTravelTime.toFixed(3)}s
                  </div>
                )}
              </div>
            </div>
          )}
          
          {optimizationStatus === 'complete' && bestTravelTime && (
            <div className="rounded-sm bg-blue-950/30 p-2 text-center text-xs text-blue-200">
              ✓ Complete - Best: {bestTravelTime.toFixed(3)}s
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}