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

const DEFAULT_PSO_CONFIG = {
  swarmSize: 24,
  iterations: 120,
  inertia: 0.72,
  cognitive: 1.45,
  social: 1.55,
  maxMagnitudeVelocity: 14.0,
  maxAngleVelocity: 0.22,
};

const MAX_HANDLE_MAGNITUDE = 280;
const COST_EVAL_CONCURRENCY = 6;
type HandleAdjustMode = 'both' | 'magnitude' | 'rotation';
type OptimizerKind = 'ga' | 'sa' | 'pso';

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
  
  const [gaConfig] = useState(DEFAULT_GA_CONFIG);
  const [gaBestTime, setGaBestTime] = useState<number | null>(null);
  
  const [saIterations, setSaIterations] = useState(300);
  const [saMutationStrength, setSaMutationStrength] = useState(8.0);
  const [saBestTime, setSaBestTime] = useState<number | null>(null);

  const [psoIterations, setPsoIterations] = useState(DEFAULT_PSO_CONFIG.iterations);
  const [psoSwarmSize, setPsoSwarmSize] = useState(DEFAULT_PSO_CONFIG.swarmSize);
  const [psoBestTime, setPsoBestTime] = useState<number | null>(null);
  
  const [sequentialResults, setSequentialResults] = useState<{ ga: number | null; sa: number | null; improvement: number | null }>({
    ga: null,
    sa: null,
    improvement: null
  });

  const anchorPoints = useStudioStore((state) => state.anchorPoints);
  const controlPoints = useStudioStore((state) => state.controlPoints);
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

  const shortestAngleDelta = (target: number, current: number) => wrapAngle(target - current);

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
    
    const costCache = new Map<string, number>();
    const baseline = cloneHandlesOnly(anchorPoints);
    let population = Array.from({ length: DEFAULT_GA_CONFIG.populationSize }, (_, i) => {
      if (i === 0) return cloneHandlesOnly(baseline);
      return mutateGA(
        cloneHandlesOnly(baseline),
        DEFAULT_GA_CONFIG.baseMutationRate,
        DEFAULT_GA_CONFIG.baseMutationStrength,
        handleAdjustMode,
      );
    });

    let bestEverIndividual = cloneHandlesOnly(baseline);
    let bestEverCost = Number.POSITIVE_INFINITY;
    let generationsWithoutImprovement = 0;

    for (let gen = 0; gen < DEFAULT_GA_CONFIG.generations; gen++) {
      setCurrentIteration(gen + 1);
      setProgress((gen + 1) / DEFAULT_GA_CONFIG.generations);

      const progress = gen / Math.max(1, DEFAULT_GA_CONFIG.generations - 1);
      const mutationRate = DEFAULT_GA_CONFIG.baseMutationRate - (DEFAULT_GA_CONFIG.baseMutationRate - DEFAULT_GA_CONFIG.minMutationRate) * progress;
      const mutationStrength = DEFAULT_GA_CONFIG.baseMutationStrength - (DEFAULT_GA_CONFIG.baseMutationStrength - DEFAULT_GA_CONFIG.minMutationStrength) * progress;

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

      if (generationsWithoutImprovement >= DEFAULT_GA_CONFIG.noImprovementLimit) break;

      const newPopulation: AnchorPoint[][] = ranked.slice(0, DEFAULT_GA_CONFIG.eliteCount).map(item => cloneHandlesOnly(item.ind));
      
      while (newPopulation.length < DEFAULT_GA_CONFIG.populationSize) {
        const parentA = selectParent(ranked, DEFAULT_GA_CONFIG.tournamentSize);
        const parentB = selectParent(ranked, DEFAULT_GA_CONFIG.tournamentSize);
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

  const runParticleSwarmOptimization = async (): Promise<{ individual: AnchorPoint[]; cost: number } | null> => {
    if (anchorPoints.length < 2) return null;

    type PsoHandleVelocity = { magnitude: number; angle: number };
    type PsoVelocityFrame = { handleIn: PsoHandleVelocity; handleOut: PsoHandleVelocity };
    type PsoParticle = {
      position: AnchorPoint[];
      velocity: PsoVelocityFrame[];
      bestPosition: AnchorPoint[];
      bestCost: number;
    };

    const costCache = new Map<string, number>();
    const baseline = cloneHandlesOnly(anchorPoints);
    const actualSwarmSize = Math.max(8, psoSwarmSize);

    const makeVelocityFrame = (): PsoVelocityFrame => ({
      handleIn: {
        magnitude: (Math.random() * 2 - 1) * (DEFAULT_PSO_CONFIG.maxMagnitudeVelocity * 0.2),
        angle: (Math.random() * 2 - 1) * (DEFAULT_PSO_CONFIG.maxAngleVelocity * 0.2),
      },
      handleOut: {
        magnitude: (Math.random() * 2 - 1) * (DEFAULT_PSO_CONFIG.maxMagnitudeVelocity * 0.2),
        angle: (Math.random() * 2 - 1) * (DEFAULT_PSO_CONFIG.maxAngleVelocity * 0.2),
      },
    });

    const seedPositions = Array.from({ length: actualSwarmSize }, (_, i) => {
      if (i === 0) return cloneHandlesOnly(baseline);
      return mutateGA(cloneHandlesOnly(baseline), 0.34, 12.0, handleAdjustMode);
    });

    const initialCosts = await evaluatePopulation(seedPositions, costCache);
    const particles: PsoParticle[] = seedPositions.map((position, i) => ({
      position,
      velocity: position.map(() => makeVelocityFrame()),
      bestPosition: cloneHandlesOnly(position),
      bestCost: initialCosts[i],
    }));

    let globalBest = particles.reduce((best, particle) =>
      particle.bestCost < best.bestCost ? particle : best,
    particles[0]);
    let globalBestPosition = cloneHandlesOnly(globalBest.bestPosition);
    let globalBestCost = globalBest.bestCost;

    setBestTravelTime(globalBestCost);
    setPsoBestTime(globalBestCost);
    setAnchorPoints(globalBestPosition);
    invokeTrajectoryComputation();

    const updateHandleWithPso = (
      currentOffset: { x: number; y: number },
      personalBestOffset: { x: number; y: number },
      globalBestOffset: { x: number; y: number },
      velocity: PsoHandleVelocity,
      mode: HandleAdjustMode,
    ) => {
      const current = offsetToMagnitudeAngle(currentOffset);
      const personalBest = offsetToMagnitudeAngle(personalBestOffset);
      const swarmBest = offsetToMagnitudeAngle(globalBestOffset);

      let nextMagnitudeVelocity = velocity.magnitude;
      let nextAngleVelocity = velocity.angle;

      if (mode === 'both' || mode === 'magnitude') {
        const r1 = Math.random();
        const r2 = Math.random();
        nextMagnitudeVelocity =
          DEFAULT_PSO_CONFIG.inertia * velocity.magnitude +
          DEFAULT_PSO_CONFIG.cognitive * r1 * (personalBest.magnitude - current.magnitude) +
          DEFAULT_PSO_CONFIG.social * r2 * (swarmBest.magnitude - current.magnitude);
        nextMagnitudeVelocity = Math.max(
          -DEFAULT_PSO_CONFIG.maxMagnitudeVelocity,
          Math.min(DEFAULT_PSO_CONFIG.maxMagnitudeVelocity, nextMagnitudeVelocity),
        );
      } else {
        nextMagnitudeVelocity = 0;
      }

      if (mode === 'both' || mode === 'rotation') {
        const r1 = Math.random();
        const r2 = Math.random();
        nextAngleVelocity =
          DEFAULT_PSO_CONFIG.inertia * velocity.angle +
          DEFAULT_PSO_CONFIG.cognitive * r1 * shortestAngleDelta(personalBest.angle, current.angle) +
          DEFAULT_PSO_CONFIG.social * r2 * shortestAngleDelta(swarmBest.angle, current.angle);
        nextAngleVelocity = Math.max(
          -DEFAULT_PSO_CONFIG.maxAngleVelocity,
          Math.min(DEFAULT_PSO_CONFIG.maxAngleVelocity, nextAngleVelocity),
        );
      } else {
        nextAngleVelocity = 0;
      }

      const nextMagnitude = mode === 'both' || mode === 'magnitude'
        ? Math.max(0, current.magnitude + nextMagnitudeVelocity)
        : current.magnitude;
      const nextAngle = mode === 'both' || mode === 'rotation'
        ? wrapAngle(current.angle + nextAngleVelocity)
        : current.angle;

      return {
        offset: magnitudeAngleToOffset(nextMagnitude, nextAngle),
        velocity: {
          magnitude: nextMagnitudeVelocity,
          angle: nextAngleVelocity,
        },
      };
    };

    for (let iter = 0; iter < psoIterations; iter++) {
      setCurrentIteration(iter + 1);
      setProgress((iter + 1) / psoIterations);

      particles.forEach((particle) => {
        particle.position = particle.position.map((anchor, idx) => {
          const nextAnchor = {
            ...anchor,
            position: { ...anchor.position },
            handleInOffset: { ...anchor.handleInOffset },
            handleOutOffset: { ...anchor.handleOutOffset },
          };

          const personalBestAnchor = particle.bestPosition[idx];
          const globalBestAnchor = globalBestPosition[idx];

          const shouldSkip = !nextAnchor.isCurved && Math.random() > 0.2;
          if (shouldSkip) return nextAnchor;

          const inUpdate = updateHandleWithPso(
            nextAnchor.handleInOffset,
            personalBestAnchor.handleInOffset,
            globalBestAnchor.handleInOffset,
            particle.velocity[idx].handleIn,
            handleAdjustMode,
          );
          nextAnchor.handleInOffset = inUpdate.offset;
          particle.velocity[idx].handleIn = inUpdate.velocity;

          const outUpdate = updateHandleWithPso(
            nextAnchor.handleOutOffset,
            personalBestAnchor.handleOutOffset,
            globalBestAnchor.handleOutOffset,
            particle.velocity[idx].handleOut,
            handleAdjustMode,
          );
          nextAnchor.handleOutOffset = outUpdate.offset;
          particle.velocity[idx].handleOut = outUpdate.velocity;

          if (nextAnchor.handlesAligned) {
            const inMag = Math.hypot(nextAnchor.handleInOffset.x, nextAnchor.handleInOffset.y);
            const outMag = Math.hypot(nextAnchor.handleOutOffset.x, nextAnchor.handleOutOffset.y);
            const inAngle = Math.atan2(nextAnchor.handleInOffset.y, nextAnchor.handleInOffset.x);
            nextAnchor.handleInOffset = magnitudeAngleToOffset(inMag, inAngle);
            nextAnchor.handleOutOffset = magnitudeAngleToOffset(outMag, inAngle + Math.PI);
            particle.velocity[idx].handleOut.angle = particle.velocity[idx].handleIn.angle;
          }

          return nextAnchor;
        });
      });

      const costs = await evaluatePopulation(particles.map((p) => p.position), costCache);

      for (let i = 0; i < particles.length; i++) {
        const particleCost = costs[i];
        if (particleCost < particles[i].bestCost) {
          particles[i].bestCost = particleCost;
          particles[i].bestPosition = cloneHandlesOnly(particles[i].position);
        }

        if (particleCost < globalBestCost) {
          globalBestCost = particleCost;
          globalBestPosition = cloneHandlesOnly(particles[i].position);
          setBestTravelTime(globalBestCost);
          setPsoBestTime(globalBestCost);
          setAnchorPoints(globalBestPosition);
          invokeTrajectoryComputation();
        }
      }

      if ((iter + 1) % 8 === 0) {
        setAnchorPoints(globalBestPosition);
        invokeTrajectoryComputation();
      }

      await new Promise(resolve => setTimeout(resolve, 0));
    }

    setAnchorPoints(globalBestPosition);
    invokeTrajectoryComputation();
    setBestTravelTime(globalBestCost);
    setPsoBestTime(globalBestCost);

    return { individual: globalBestPosition, cost: globalBestCost };
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

  const handleRunPSO = async () => {
    setOptimizationStatus('running');
    setActiveOptimizer('pso');
    setBestTravelTime(null);
    setProgress(0);
    setCurrentIteration(0);

    try {
      const result = await runParticleSwarmOptimization();
      if (result) {
        setPsoBestTime(result.cost);
        setBestTravelTime(result.cost);
        setAnchorPoints(result.individual);
        invokeTrajectoryComputation();
      }
    } catch (error) {
      console.error('PSO failed:', error);
      alert('Particle Swarm optimization failed');
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
        
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-300">Optimize Handles</h3>

          <div className="bg-gray-900 rounded-lg p-3 space-y-2">
            <h4 className="text-sm font-medium text-gray-300">Adjust Mode</h4>
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
                  className={`py-1.5 rounded text-xs font-medium transition-colors ${
                    handleAdjustMode === option.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  } disabled:opacity-50`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400">
              Choose whether optimization mutates handle length, handle angle, or both.
            </p>
          </div>
          
          <div className="bg-gray-900 rounded-lg p-3">
            <button
              onClick={handleRunGA}
              disabled={optimizationStatus === 'running' || anchorPoints.length < 2}
              className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-medium disabled:opacity-50"
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

          <div className="bg-gray-900 rounded-lg p-3 space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="text-cyan-400 font-medium text-sm">Particle Swarm</h4>
            </div>

            <div className="space-y-2">
              <div>
                <label className="text-xs text-gray-400 block mb-1">
                  Iterations: {psoIterations}
                </label>
                <input
                  type="range"
                  value={psoIterations}
                  onChange={e => setPsoIterations(parseInt(e.target.value, 10))}
                  min={60}
                  max={260}
                  step={20}
                  className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  disabled={optimizationStatus === 'running'}
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">
                  Swarm Size: {psoSwarmSize}
                </label>
                <input
                  type="range"
                  value={psoSwarmSize}
                  onChange={e => setPsoSwarmSize(parseInt(e.target.value, 10))}
                  min={8}
                  max={40}
                  step={2}
                  className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  disabled={optimizationStatus === 'running'}
                />
              </div>
            </div>

            <button
              onClick={handleRunPSO}
              disabled={optimizationStatus === 'running' || anchorPoints.length < 2}
              className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-sm font-medium disabled:opacity-50"
            >
              Run Particle Swarm
            </button>

            {psoBestTime && (
              <p className="text-xs text-cyan-300 text-center">
                Best: {psoBestTime.toFixed(3)}s
              </p>
            )}
          </div>
          
          <div className="bg-gray-900 rounded-lg p-3 space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="text-indigo-400 font-medium text-sm">Simulated Annealing</h4>
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
                  className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"
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
                  className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"
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
              className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-medium disabled:opacity-50"
            >
              Run Handle Fine-tuning
            </button>
          </div>
          
          <div className="bg-gradient-to-r from-blue-900/30 to-indigo-900/30 rounded-lg p-3 border border-blue-700/30">
            <button
              onClick={handleSequentialOptimization}
              disabled={optimizationStatus === 'running' || anchorPoints.length < 2}
              className="w-full py-2 bg-green-600 hover:bg-green-500 text-white rounded text-sm font-medium disabled:opacity-50"
            >
              Full Optimization (GA → Fine-tune)
            </button>
            
            {sequentialResults.sa && (
              <div className="mt-2 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-blue-400">GA:</span>
                  <span>{sequentialResults.ga?.toFixed(3)}s</span>
                  <span className="text-indigo-400">Fine-tuned:</span>
                  <span>{sequentialResults.sa?.toFixed(3)}s</span>
                </div>
                <div className="flex justify-between text-green-400">
                  <span>Improvement:</span>
                  <span>{sequentialResults.improvement?.toFixed(2)}%</span>
                </div>
              </div>
            )}
          </div>
          
          {optimizationStatus === 'running' && (
            <div className="bg-gray-900 rounded-lg p-3">
              <div className="text-xs space-y-1">
                <div className="flex justify-between">
                  <span className={
                    activeOptimizer === 'ga'
                      ? 'text-blue-400'
                      : activeOptimizer === 'pso'
                        ? 'text-cyan-400'
                        : 'text-indigo-400'
                  }>
                    {activeOptimizer === 'ga'
                      ? 'GA'
                      : activeOptimizer === 'pso'
                        ? 'PSO'
                        : 'Fine-tuning'} {Math.round(progress * 100)}%
                  </span>
                  <span className="text-gray-400">Iteration {currentIteration}</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-1.5">
                  <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${progress * 100}%` }} />
                </div>
                {bestTravelTime && (
                  <div className="text-green-400 text-center mt-1">
                    Best: {bestTravelTime.toFixed(3)}s
                  </div>
                )}
              </div>
            </div>
          )}
          
          {optimizationStatus === 'complete' && bestTravelTime && (
            <div className="bg-green-900/30 border border-green-700 rounded-lg p-2 text-center text-xs">
              ✓ Complete - Best: {bestTravelTime.toFixed(3)}s
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}