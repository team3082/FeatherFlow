"use client";

import { inchToCanvas } from "@/config/config";
import { useStudioStore } from "@/store/StudioStore";

export default function Footer() {
	const cursorPosition = useStudioStore(state => state.cursorPosition);
	const selectedPoint = useStudioStore(state => state.selectedPoint);
	const anchorPoints = useStudioStore(state => state.anchorPoints);
	const controlPoints = useStudioStore(state => state.controlPoints);
	const viewport = useStudioStore(state => state.viewport);
	const time = useStudioStore(state => state.trajectoryTime);
	const showingVelocity = useStudioStore(state => state.showingVelocity);
	const setShowingVelocity = useStudioStore(state => state.setShowingVelocity);

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
		<div className="grid grid-cols-3 px-6 py-3 bg-gray-800 border-t border-gray-700 text-sm font-medium">
				<div className="flex items-center gap-6 text-gray-300">
					<span>Cursor: ({cursorPosition.x.toFixed(2)}, {cursorPosition.y.toFixed(2)}) in</span>
					<span>Time: {time.toFixed(2)}s</span>
					<button
						onClick={() => setShowingVelocity(!showingVelocity)}
						className="hover:text-gray-100 transition-colors underline-offset-2"
					>
						Velocity: {showingVelocity ? "On" : "Off"}
					</button>
				</div>

				<div className="text-center ju text-gray-300">
					Selected: {getSelectedDisplay()}
				</div>

				<div className="flex items-center justify-end gap-6 text-gray-300">
					<span>Anchors: {anchorPoints.length}</span>
					<span>Controls: {controlPoints.length}</span>
					<span>Zoom: {(viewport.scale * 100).toFixed(0)}%</span>
			</div>
		</div>
	);
}
