"use client";

import { Plus } from 'lucide-react';

const commandTypes = [
  { name: 'elevatorRaise', label: 'ElevatorRaise' },
  { name: 'coralDrop', label: 'CoralDrop' },
  { name: 'alignToApril', label: 'AlignToApril' },
  { name: 'elevatorLower', label: 'ElevatorLower' },
  { name: 'shoot', label: 'Shoot' },
];

export function LeftSidebar({ addNode }: { addNode: (type: string) => void }) {
  return (
    <aside className="w-64  bg-gray-850 border-l border-gray-700 p-4">
      <h2 className="text-lg font-bold mb-4">Commands</h2>
      <div className="space-y-2">
        {commandTypes.map(cmd => (
          <button
            key={cmd.name}
            onClick={() => addNode(cmd.name)}
            className="w-full px-4 py-3 rounded-lg font-medium text-white transition-transform flex items-center gap-3 bg-gray-800 border-2 border-gray-700"
          >
            <Plus size={18} />
            {cmd.label}
          </button>
        ))}
      </div>
    </aside>
  );
}
