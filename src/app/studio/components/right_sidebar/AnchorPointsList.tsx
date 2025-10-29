"use client";

import { useStudioStore } from "@/store/StudioStore";
import { Trash } from "lucide-react";

export default function AnchorPointsList() {
	const anchorPoints = useStudioStore(state => state.anchorPoints);
	const selectedPoint = useStudioStore(state => state.selectedPoint);
	const setSelectedPoint = useStudioStore(state => state.setSelectedPoint);
	const setActiveTool = useStudioStore(state => state.setActiveTool);
	const deleteAnchorPoint = useStudioStore(state => state.deleteAnchorPoint);

	return (
		<div className="mb-6">
			<div className="text-xs font-semibold text-gray-300 mb-2 flex items-center gap-1.5">
				ANCHOR POINTS ({anchorPoints.length})
			</div>
			<div className="flex flex-col gap-1.5">
				{anchorPoints.map((point, index) => {
					const isSelected = selectedPoint?.type === 'anchor' && selectedPoint?.id === index;
					return (
						<div
							key={index}
							onClick={() => {
								setActiveTool('anchorTool');
								setSelectedPoint({ type: 'anchor', id: index });
							}}
							className={`px-3 py-2.5 rounded-md cursor-pointer transition-all flex justify-between items-center ${
								isSelected 
									? 'bg-blue-900 border-2 border-blue-500' 
									: 'bg-gray-800 border-2 border-gray-700 hover:border-gray-600'
							}`}
						>
							<div>
								<div className="text-sm font-semibold mb-0.5">
									{point.name || `Anchor ${index + 1}`}
								</div>
								<div className="text-xs text-gray-300 font-medium">
									({point.position.x.toFixed(2)}, {point.position.y.toFixed(2)})
								</div>
							</div>
							<button
								onClick={(e) => { e.stopPropagation(); deleteAnchorPoint(index); }}
								className={`bg-transparent border-none cursor-pointer text-base px-1 flex-shrink-0 ${isSelected ? 'text-blue-500 hover:text-blue-400' : 'text-gray-500 hover:text-gray-400'}`}
							>
								<Trash className="w-4.5 h-4.5" />
							</button>
						</div>
					);
				})}
			</div>
		</div>
	);
}