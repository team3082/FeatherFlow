import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useStudioStore } from '@/store/StudioStore';
import type { AnchorPoint } from '@/types/AnchorPoint';
import type { TrajectoryResult } from '@/types/PathPoint';
import AnchorPointsList from './AnchorPointsList';
import ControlPointsList from './ControlPointsList';

// GA Hyperparameters
const POPULATION_SIZE = 28;
const GENERATIONS = 80;
const ELITE_COUNT = 3;
const TOURNAMENT_SIZE = 4;
const BASE_MUTATION_RATE = 0.24;
const MIN_MUTATION_RATE = 0.06;
const BASE_MUTATION_STRENGTH = 18.0;
const MIN_MUTATION_STRENGTH = 1.2;
const MAX_HANDLE_OFFSET = 280;
const NO_IMPROVEMENT_LIMIT = 20;
const COST_EVAL_CONCURRENCY = 6;

export default function RightSidebar() {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [bestTravelTime, setBestTravelTime] = useState<number | null>(null);

  const anchorPoints = useStudioStore((state) => state.anchorPoints);
  const controlPoints = useStudioStore((state) => state.controlPoints);
  const setAnchorPoints = useStudioStore((state) => state.setAnchorPoints);
  const invokeTrajectoryComputation = useStudioStore((state) => state.invokeTrajectoryComputation);

  // Helper to clone full point sets
  const cloneIndividual = (anchors: AnchorPoint[]): AnchorPoint[] =>
    anchors.map((a) => ({
      ...a,
      position: { ...a.position },
      handleInOffset: { ...a.handleInOffset },
      handleOutOffset: { ...a.handleOutOffset },
    }));

  const clampHandleOffset = (offset: { x: number; y: number }) => {
    const magnitude = Math.hypot(offset.x, offset.y);
    if (magnitude <= MAX_HANDLE_OFFSET || magnitude === 0) {
      return offset;
    }

    const scale = MAX_HANDLE_OFFSET / magnitude;
    return {
      x: offset.x * scale,
      y: offset.y * scale,
    };
  };

  const individualKey = (anchors: AnchorPoint[]) =>
    anchors
      .map((anchor) => {
        const p = anchor.position;
        const hIn = anchor.handleInOffset;
        const hOut = anchor.handleOutOffset;
        return [
          p.x.toFixed(3), p.y.toFixed(3),
          hIn.x.toFixed(3), hIn.y.toFixed(3),
          hOut.x.toFixed(3), hOut.y.toFixed(3),
          anchor.isCurved ? '1' : '0',
          anchor.handlesAligned ? '1' : '0',
        ].join(',');
      })
      .join('|');

  const computeCost = async (anchors: AnchorPoint[], cache: Map<string, number>) => {
    const key = individualKey(anchors);
    const cachedCost = cache.get(key);
    if (cachedCost !== undefined) {
      return cachedCost;
    }

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

  const selectParent = (ranked: { ind: AnchorPoint[]; cost: number }[]) => {
    let winner = ranked[Math.floor(Math.random() * ranked.length)];
    for (let i = 1; i < TOURNAMENT_SIZE; i += 1) {
      const contender = ranked[Math.floor(Math.random() * ranked.length)];
      if (contender.cost < winner.cost) {
        winner = contender;
      }
    }
    return winner.ind;
  };

  // MUTATION: Randomly wiggle handles
  const mutate = (anchors: AnchorPoint[], mutationRate: number, mutationStrength: number) => {
    return anchors.map((anchor) => {
      const baseAnchor = {
        ...anchor,
        position: { ...anchor.position },
        handleInOffset: { ...anchor.handleInOffset },
        handleOutOffset: { ...anchor.handleOutOffset },
      };

      if (Math.random() > mutationRate) return baseAnchor;

      const mutated = baseAnchor;
      const dx = (Math.random() * 2 - 1) * mutationStrength;
      const dy = (Math.random() * 2 - 1) * mutationStrength;

      const canMutateHandle = anchor.isCurved || Math.random() < 0.15;
      if (!canMutateHandle) {
        return mutated;
      }

      // Mutate one handle, maintain alignment if necessary
      if (Math.random() > 0.5) {
        mutated.handleInOffset = clampHandleOffset({
          x: anchor.handleInOffset.x + dx,
          y: anchor.handleInOffset.y + dy,
        });
        if (anchor.handlesAligned) {
          // Calculate the angle of the handle that WASN'T just wiggled
          const angleIn = Math.atan2(mutated.handleInOffset.y, mutated.handleInOffset.x);
          
          // Force the other handle to the opposite angle (angle + PI)
          const lengthOut = Math.hypot(mutated.handleOutOffset.x, mutated.handleOutOffset.y);
          
          mutated.handleOutOffset = {
            x: -Math.cos(angleIn) * lengthOut,
            y: -Math.sin(angleIn) * lengthOut,
          };
        }
      } else {
        mutated.handleOutOffset = clampHandleOffset({
          x: anchor.handleOutOffset.x + dx,
          y: anchor.handleOutOffset.y + dy,
        });
        if (anchor.handlesAligned) {
          mutated.handleInOffset = { x: -mutated.handleOutOffset.x, y: -mutated.handleOutOffset.y };
        }
      }
      return mutated;
    });
  };

  // CROSSOVER: Mix handles from two parents
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

  const handleGeneticOptimize = async () => {
    if (anchorPoints.length < 2) return;

    setIsOptimizing(true);
    setGeneration(0);
    setBestTravelTime(null);

    try {
      const costCache = new Map<string, number>();
      const baseline = cloneIndividual(anchorPoints);
      let population = Array.from({ length: POPULATION_SIZE }, (_, i) => {
        if (i === 0) return cloneIndividual(baseline);
        return mutate(cloneIndividual(baseline), BASE_MUTATION_RATE, BASE_MUTATION_STRENGTH);
      });

      let bestEverIndividual = cloneIndividual(baseline);
      let bestEverCost = Number.POSITIVE_INFINITY;
      let generationsWithoutImprovement = 0;

      for (let gen = 0; gen < GENERATIONS; gen++) {
        setGeneration(gen + 1);

        const progress = gen / Math.max(1, GENERATIONS - 1);
        const mutationRate = BASE_MUTATION_RATE - (BASE_MUTATION_RATE - MIN_MUTATION_RATE) * progress;
        const mutationStrength = BASE_MUTATION_STRENGTH - (BASE_MUTATION_STRENGTH - MIN_MUTATION_STRENGTH) * progress;

        const costs = await evaluatePopulation(population, costCache);

        const ranked = population
          .map((ind, i) => ({ ind, cost: costs[i] }))
          .sort((a, b) => a.cost - b.cost);

        const bestOfGen = ranked[0];
        if (bestOfGen.cost < bestEverCost) {
          bestEverCost = bestOfGen.cost;
          bestEverIndividual = cloneIndividual(bestOfGen.ind);
          generationsWithoutImprovement = 0;
        } else {
          generationsWithoutImprovement += 1;
        }

        setBestTravelTime(bestEverCost);
        setAnchorPoints(bestEverIndividual);
        invokeTrajectoryComputation();

        if (generationsWithoutImprovement >= NO_IMPROVEMENT_LIMIT) {
          break;
        }

        const newPopulation: AnchorPoint[][] = ranked
          .slice(0, ELITE_COUNT)
          .map((item) => cloneIndividual(item.ind));

        while (newPopulation.length < POPULATION_SIZE) {
          const parentA = selectParent(ranked);
          const parentB = selectParent(ranked);

          let child = crossover(parentA, parentB);
          child = mutate(child, mutationRate, mutationStrength);
          newPopulation.push(child);
        }

        // Inject one immigrant periodically to preserve diversity.
        if ((gen + 1) % 10 === 0 && newPopulation.length > ELITE_COUNT) {
          newPopulation[newPopulation.length - 1] = mutate(
            cloneIndividual(baseline),
            BASE_MUTATION_RATE,
            BASE_MUTATION_STRENGTH
          );
        }

        population = newPopulation;
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      setAnchorPoints(bestEverIndividual);
      invokeTrajectoryComputation();
      setBestTravelTime(bestEverCost);
    } catch (error) {
      console.error('Genetic optimization failed:', error);
      alert('Failed to optimize path. Please try again.');
    } finally {
      setIsOptimizing(false);
    }
  };

  return (
    <aside className="w-75 bg-gray-850 border-l border-gray-700 flex flex-col overflow-auto">
      <div className="p-5">            
        <AnchorPointsList />
        <ControlPointsList />
        <div className="p-5">
          <button
            onClick={handleGeneticOptimize}
            disabled={isOptimizing}
            className="w-full p-2 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
          >
            {isOptimizing ? `Evolving Gen ${generation}...` : 'Genetic Optimize'}
          </button>

          {isOptimizing && (
            <div className="mt-4 p-3 bg-gray-900 border border-gray-700 rounded text-xs">
              <p>Generation: {generation} / {GENERATIONS}</p>
              <p className="text-green-400">Best Time: {bestTravelTime?.toFixed(3)}s</p>
            </div>
          )}
        </div>
      </div>
    </aside>

    
  );
}