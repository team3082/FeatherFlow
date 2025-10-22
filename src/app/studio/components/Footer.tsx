"use client";

import { useStudioStore } from "@/store/StudioStore";

export default function Footer() {
	const cursorPosition = useStudioStore(state => state.cursorPosition);
	const selectedPoint = useStudioStore(state => state.selectedPoint);
	const anchorPoints = useStudioStore(state => state.anchorPoints);
	const controlPoints = useStudioStore(state => state.controlPoints);
	const viewport = useStudioStore(state => state.viewport);

	// Get selected point display name
	const getSelectedDisplay = () => {
		if (!selectedPoint) return "None";

		if (selectedPoint.type === 'anchor' || selectedPoint.type === 'handleOut' || selectedPoint.type === 'handleIn') {
			const anchor = anchorPoints[selectedPoint.id];
			return anchor?.name || `Anchor ${selectedPoint.id + 1}`;
		} else if (selectedPoint.type === 'control') {
			const control = controlPoints.find(cp => cp.id === selectedPoint.id);
			return control?.name || `Control ${control?.id}`;
		}
		return "None";
	};

	return (
		<div className="flex items-center justify-between px-6 py-3 bg-gray-800 border-t border-gray-700 text-sm font-medium">
			<div className="text-gray-300">
				Cursor: ({cursorPosition.x.toFixed(1)}, {cursorPosition.y.toFixed(1)}) in
			</div>

			<div className="text-gray-300">
				Selected: {getSelectedDisplay()}
			</div>

			<div className="flex items-center gap-4 text-gray-300">
				<span>Anchors: {anchorPoints.length}</span>
				<span>Controls: {controlPoints.length}</span>
				<span>Zoom: {(viewport.scale * 100).toFixed(0)}%</span>
			</div>
		</div>
	);
}
