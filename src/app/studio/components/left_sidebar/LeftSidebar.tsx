"use client";

import DrawingTools from './DrawingTools';
import PropertiesPanel from './PropertiesPanel';

export function LeftSidebar() {
  return (
    <aside className="w-70 bg-gray-850 border-r border-gray-700 flex flex-col overflow-auto left-scrollbar">
      <DrawingTools />
      <PropertiesPanel />
    </aside>
  );
}