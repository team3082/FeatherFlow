"use client";

import { useStudioStore } from "@/store/StudioStore";

export default function AnchorProperties() {
  const selectedPoint = useStudioStore(state => state.selectedPoint);

  //Use full selector for renders, for some reason when this was not here it would not update changes
  const anchorPoints = useStudioStore(state => state.anchorPoints);
  const updateAnchorPoint = useStudioStore(state => state.updateAnchorPoint);
  const toggleAnchorCurve = useStudioStore(state => state.toggleAnchorCurve);

  if (!selectedPoint || !['anchor', 'handleOut', 'handleIn'].includes(selectedPoint.type)) {
    return null;
  }

  const anchor = anchorPoints[selectedPoint.id];
  if (!anchor) return <div className="text-xs text-gray-500">Anchor not found</div>;

  return (
    <>
      <button
        onClick={() => toggleAnchorCurve(selectedPoint.id)}
        className="w-full px-3 py-2 bg-blue-500 border-none rounded text-white cursor-pointer text-sm font-medium mb-3 hover:bg-blue-600 transition-colors"
      >
        Toggle Curve/Straight
      </button>

      <div>
        <label className="block text-xs  mb-1.5">Name</label>
        <input
          type="text"
          value={anchor.name || ''}
          onChange={(e) => {
            updateAnchorPoint(selectedPoint.id, cur => ({ ...cur, name: e.target.value }));
          }}
          placeholder="Optional label..."
          className="w-full px-2 py-2 bg-gray-800 border border-gray-700 rounded text-gray-100 text-sm focus:outline-none focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-xs mb-1.5">X Position (in)</label>
        <input
          type="number"
          step="0.1"
          value={Number(anchor.position.x.toFixed(2))}
          onChange={(e) => {
            const val = parseFloat(e.target.value || '0');
            updateAnchorPoint(selectedPoint.id, cur => ({ ...cur, position: { ...cur.position, x: val } }));
          }}
          className="w-full px-2 py-2 bg-gray-800 border border-gray-700 rounded text-gray-100 text-sm focus:outline-none focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-xs 300 mb-1.5">Y Position (in)</label>
        <input
          type="number"
          step="0.1"
          value={Number(anchor.position.y.toFixed(2))}
          onChange={(e) => {
            const val = parseFloat(e.target.value || '0');
            updateAnchorPoint(selectedPoint.id, cur => ({ ...cur, position: { ...cur.position, y: val } }));
          }}
          className="w-full px-2 py-2 bg-gray-800 border border-gray-700 rounded text-gray-100 text-sm focus:outline-none focus:border-blue-500"
        />
      </div>

      {anchor.isCurved && (
        <>
          <div className="mt-2 text-xs font-medium text-gray-300">Handle Out (in)</div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              step="0.1"
              value={Number(anchor.handleOutOffset.x.toFixed(2))}
              onChange={(e) => {
                const val = parseFloat(e.target.value || '0');
                const dx = val;
                const dy = anchor.handleOutOffset.y;
                const inMag = Math.sqrt(anchor.handleInOffset.x * anchor.handleInOffset.x + anchor.handleInOffset.y * anchor.handleInOffset.y);
                const outMag = Math.sqrt(dx * dx + dy * dy);
                updateAnchorPoint(selectedPoint.id, cur => ({
                  ...cur,
                  handleOutOffset: { x: dx, y: dy },
                  handleInOffset: cur.isCurved ? { x: -dx * (inMag / (outMag || 1)), y: -dy * (inMag / (outMag || 1)) } : cur.handleInOffset
                }));
              }}
              className="w-full px-2 py-2 bg-gray-800 border border-gray-700 rounded text-gray-100 text-sm"
            />
            <input
              type="number"
              step="0.1"
              value={Number(anchor.handleOutOffset.y.toFixed(2))}
              onChange={(e) => {
                const val = parseFloat(e.target.value || '0');
                const dy = val;
                const dx = anchor.handleOutOffset.x;
                const inMag = Math.sqrt(anchor.handleInOffset.x * anchor.handleInOffset.x + anchor.handleInOffset.y * anchor.handleInOffset.y);
                const outMag = Math.sqrt(dx * dx + dy * dy);
                updateAnchorPoint(selectedPoint.id, cur => ({
                  ...cur,
                  handleOutOffset: { x: dx, y: dy },
                  handleInOffset: cur.isCurved ? { x: -dx * (inMag / (outMag || 1)), y: -dy * (inMag / (outMag || 1)) } : cur.handleInOffset
                }));
              }}
              className="w-full px-2 py-2 bg-gray-800 border border-gray-700 rounded text-gray-100 text-sm"
            />
          </div>

          <div className="mt-2 text-xs font-medium text-gray-300">Handle In (in)</div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              step="0.1"
              value={Number(anchor.handleInOffset.x.toFixed(2))}
              onChange={(e) => {
                const val = parseFloat(e.target.value || '0');
                const dx = val;
                const dy = anchor.handleInOffset.y;
                const outMag = Math.sqrt(anchor.handleOutOffset.x * anchor.handleOutOffset.x + anchor.handleOutOffset.y * anchor.handleOutOffset.y);
                const inMag = Math.sqrt(dx * dx + dy * dy);
                updateAnchorPoint(selectedPoint.id, cur => ({
                  ...cur,
                  handleInOffset: { x: dx, y: dy },
                  handleOutOffset: cur.isCurved ? { x: -dx * (outMag / (inMag || 1)), y: -dy * (outMag / (inMag || 1)) } : cur.handleOutOffset
                }));
              }}
              className="w-full px-2 py-2 bg-gray-800 border border-gray-700 rounded text-gray-100 text-sm"
            />
            <input
              type="number"
              step="0.1"
              value={Number(anchor.handleInOffset.y.toFixed(2))}
              onChange={(e) => {
                const val = parseFloat(e.target.value || '0');
                const dy = val;
                const dx = anchor.handleInOffset.x;
                const outMag = Math.sqrt(anchor.handleOutOffset.x * anchor.handleOutOffset.x + anchor.handleOutOffset.y * anchor.handleOutOffset.y);
                const inMag = Math.sqrt(dx * dx + dy * dy);
                updateAnchorPoint(selectedPoint.id, cur => ({
                  ...cur,
                  handleInOffset: { x: dx, y: dy },
                  handleOutOffset: cur.isCurved ? { x: -dx * (outMag / (inMag || 1)), y: -dy * (outMag / (inMag || 1)) } : cur.handleOutOffset
                }));
              }}
              className="w-full px-2 py-2 bg-gray-800 border border-gray-700 rounded text-gray-100 text-sm"
            />
          </div>
        </>
      )}
    </>
  );
}