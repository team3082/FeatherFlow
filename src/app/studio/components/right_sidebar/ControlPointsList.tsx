"use client";

import { colorMap } from "@/config/config";
import { useStudioStore } from "@/store/StudioStore";
import { Trash, X } from "lucide-react";

export default function ControlPointsList() {
	const controlPoints = useStudioStore(state => state.controlPoints);
	const selectedPoint = useStudioStore(state => state.selectedPoint);
	const setSelectedPoint = useStudioStore(state => state.setSelectedPoint);
	const setActiveTool = useStudioStore(state => state.setActiveTool);
	const deleteControlPoint = useStudioStore(state => state.deleteControlPoint);

	return (
		<div>
			<div className="text-xs font-semibold text-gray-300 mb-2 flex items-center gap-1.5">
				CONTROL POINTS ({controlPoints.length})
			</div>
			<div className="flex flex-col gap-1.5">
				{controlPoints.sort((a, b) => a.u - b.u).map((point, index) => {
					const isSelected = selectedPoint?.type === 'control' && selectedPoint?.id === point.id;
					const pos = { x: 0, y: 0 };

					const customColor = point.color;
				
					const colors = colorMap[customColor] || colorMap.blue;
					const bgColor = isSelected ? colors.bg : 'bg-gray-800';
					const borderColor = isSelected ? colors.border : 'border-gray-700 hover:border-gray-600';
					const attributeBorderColor = isSelected ? colors.border : 'border-gray-600';
					
					return (
						<div
							key={index}
							onClick={() => {
								setActiveTool('controlTool');
								setSelectedPoint({ type: 'control', id: point.id });
							}}
							className={`px-3 py-2.5 rounded-md cursor-pointer transition-all flex justify-between items-center ${bgColor} border-2 ${borderColor}`}
						>
							<div className="flex items-center gap-2.5 h-14 flex-1">
								<div className={`w-3 h-3 rounded-full ${colors.dot} flex-shrink-0`}></div>
								<div className="flex-1">
									<div className="text-sm font-medium mb-0.5">
										{point.name || `Control Point ${index + 1}`}
									</div>
									<div className="text-xs text-gray-300 font-medium mb-1">
										U = {point.u.toFixed(3)} 
									</div>
									{point.attributes.length > 0 && (
										<div className="flex flex-wrap gap-1">
											{point.attributes.map((attr, i) => (
												<span
													key={i}
													className={`px-1.5 rounded mb-0.4 text-xs ${bgColor} border-[1.5px] ${attributeBorderColor} text-gray-300 flex items-center justify-center font-medium`}
												>
													{attr.type.toUpperCase()[0] + attr.type.toLocaleLowerCase().slice(1)}
												</span>
											))}
										</div>
									)}
								</div>
							</div>
							<button
								onClick={(e) => { e.stopPropagation(); deleteControlPoint(point.id); }}
								className={`bg-transparent border-none cursor-pointer text-base px-1 flex-shrink-0 ${isSelected ? colors.color : 'text-gray-500 hover:text-gray-400'}`}
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