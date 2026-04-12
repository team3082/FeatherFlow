"use client";

import { useStudioStore } from "@/store/StudioStore";

export default function Footer() {
	const cursorPosition = useStudioStore(state => state.cursorPosition);
	const selectedPoint = useStudioStore(state => state.selectedPoint);
	const anchorPoints = useStudioStore(state => state.anchorPoints);
	const controlPoints = useStudioStore(state => state.controlPoints);
	const viewport = useStudioStore(state => state.viewport);
	const time = useStudioStore(state => state.trajectoryTime);
	const playbackTime = useStudioStore(state => state.trajectoryPlaybackTime);
	const setTrajectoryPlaybackTime = useStudioStore(state => state.setTrajectoryPlaybackTime);
	const setIsTrajectoryScrubbing = useStudioStore(state => state.setIsTrajectoryScrubbing);
	const showingVelocity = useStudioStore(state => state.showingVelocity);
	const setShowingVelocity = useStudioStore(state => state.setShowingVelocity);
	const inovkeTrajectoryComputation = useStudioStore(state => state.invokeTrajectoryComputation);

	const formatSeconds = (seconds: number) => {
		const safe = Math.max(0, seconds);
		const whole = Math.floor(safe);
		const mins = Math.floor(whole / 60);
		const secs = whole % 60;
		const centis = Math.floor((safe - whole) * 100);
		return `${mins}:${secs.toString().padStart(2, "0")}.${centis.toString().padStart(2, "0")}`;
	};

	// Get selected point display name
	const getSelectedDisplay = () => {
		if (!selectedPoint) return "None";

		if (selectedPoint.type === 'snapPoint') {
			return `Snap Point ${selectedPoint.id}`;
		}

		if (selectedPoint.type === 'anchor' || selectedPoint.type === 'handleOut' || selectedPoint.type === 'handleIn') {
			const anchor = anchorPoints[selectedPoint.id as number];
			return anchor?.name || `Anchor ${(selectedPoint.id as number) + 1}`;
		} else if (selectedPoint.type === 'control') {
			const control = controlPoints.find(cp => cp.id === selectedPoint.id);
			return control?.name || `Control ${control?.id}`;
		}
		return "None";
	};

	return (
		<div className="border-t border-gray-700 bg-gray-800 px-4 py-2.5 text-sm font-medium text-gray-300">
			<div className="grid grid-cols-1 gap-2 lg:grid-cols-[1.35fr_1.75fr_1fr] lg:items-center lg:gap-4">
				<div className="flex flex-wrap items-center gap-x-4 gap-y-1">
					<span className="text-gray-400">Cursor</span>
					<span className="font-mono text-gray-200">
						({cursorPosition.x.toFixed(2)}, {cursorPosition.y.toFixed(2)}) in
					</span>
					<span className="text-gray-400">Selected</span>
					<span className="max-w-[18rem] truncate text-gray-200 xl:max-w-[22rem]">{getSelectedDisplay()}</span>
				</div>

				<div className="flex flex-wrap items-center gap-x-3 gap-y-1 lg:flex-nowrap">
					<button
						onClick={() => {
							setShowingVelocity(!showingVelocity);
							inovkeTrajectoryComputation();
						}}
						className={`shrink-0 rounded-md border-2 px-2.5 py-1 text-xs font-semibold transition-all ${
							showingVelocity
								? "border-blue-500 bg-blue-900 text-blue-100 hover:bg-blue-800"
								: "border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-600"
						}`}
					>
						Profile {showingVelocity ? "On" : "Off"}
					</button>
					<span className="shrink-0 font-mono text-xs text-gray-100">
						{formatSeconds(playbackTime)} / {formatSeconds(time)}
					</span>
					<input
						type="range"
						min={0}
						max={Math.max(time, 0)}
						step={0.01}
						value={Math.min(playbackTime, Math.max(time, 0))}
						onPointerDown={() => setIsTrajectoryScrubbing(true)}
						onPointerUp={() => setIsTrajectoryScrubbing(false)}
						onPointerCancel={() => setIsTrajectoryScrubbing(false)}
						onChange={(e) => setTrajectoryPlaybackTime(Number(e.target.value))}
						disabled={time <= 0 || !showingVelocity}
						className="h-1.5 w-full min-w-40 flex-1 accent-blue-500 disabled:opacity-40"
					/>
				</div>

				<div className="flex flex-wrap items-center justify-start gap-x-4 gap-y-1 lg:justify-end">
					<span>
						<span className="text-gray-400">Anchors</span>{" "}
						<span className="text-gray-100">{anchorPoints.length}</span>
					</span>
					<span>
						<span className="text-gray-400">Controls</span>{" "}
						<span className="text-gray-100">{controlPoints.length}</span>
					</span>
					<span>
						<span className="text-gray-400">Zoom</span>{" "}
						<span className="text-gray-100">{(viewport.scale * 100).toFixed(0)}%</span>
					</span>
				</div>
			</div>
		</div>
	);
}
