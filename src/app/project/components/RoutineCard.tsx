"use client";

import React, { useState } from 'react';
import { AutoRoutine } from '@/types';
import { PathPreviewCanvas } from './PathPreviewCanvas';
import { Ellipsis, Settings } from 'lucide-react';

interface RoutineCardProps {
  routine: AutoRoutine;
  index: number;
  onEdit: (routineId: string) => void;
  onDuplicate: (routineId: string) => void;
  onDelete: (routineId: string) => void;
  onStartEdit: (routineId: string, field: 'name' | 'description', currentValue: string) => void;
  editingId: string | null;
  editingField: 'name' | 'description' | null;
  editValue: string;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onEditValueChange: (value: string) => void;
}

export const RoutineCard: React.FC<RoutineCardProps> = ({
  routine,
  index,
  onEdit,
  onDuplicate,
  onDelete,
  onStartEdit,
  editingId,
  editingField,
  editValue,
  onSaveEdit,
  onCancelEdit,
  onEditValueChange
}) => {
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const handleEditAuto = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(routine.id);
  };

  return (
    <div
      onMouseEnter={() => setHoveredCard(index)}
      onMouseLeave={() => setHoveredCard(null)}
      className="bg-gray-900/20 backdrop-blur border border-gray-800/30 rounded-2xl overflow-hidden hover:border-blue-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10 group hover:-translate-y-1"
    >
      {/* Preview Canvas */}
      <div className="aspect-[3/2] bg-[#0e111b] relative overflow-hidden flex items-center justify-center">
          <PathPreviewCanvas routine={routine} onClick={handleEditAuto} />
      </div>

      {/* Card Content */}
      <div className="p-5 relative">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1" onClick={(e) => e.stopPropagation()}>
            {editingId === routine.id && editingField === 'name' ? (
              <input
                type="text"
                value={editValue}
                onChange={(e) => onEditValueChange(e.target.value)}
                onBlur={onSaveEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSaveEdit();
                  if (e.key === 'Escape') onCancelEdit();
                }}
                autoFocus
                className="w-full text-lg font-bold text-gray-100 bg-gray-800 border border-blue-500 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <h3 className="text-lg font-bold text-gray-100 mb-1.5 group-hover:text-blue-400 transition-colors line-clamp-1">
                {routine.name}
              </h3>
            )}

            {editingId === routine.id && editingField === 'description' ? (
              <textarea
                value={editValue}
                onChange={(e) => onEditValueChange(e.target.value)}
                onBlur={onSaveEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e as any).metaKey) onSaveEdit();
                  if (e.key === 'Escape') onCancelEdit();
                }}
                autoFocus
                rows={2}
                className="w-full text-sm text-gray-300 bg-gray-800 border border-blue-500 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            ) : (
              <p className="text-sm text-gray-500 leading-relaxed line-clamp-2">{routine.description || 'No description'}</p>
            )}
          </div>

          {/* Three Dot Menu */}
          <div className="relative flex-shrink-0 z-30">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setOpenMenuId(openMenuId === routine.id ? null : routine.id);
              }}
              className="w-8 h-8 bg-gray-800/50 hover:bg-gray-700 border border-gray-700/50 hover:border-gray-600 text-gray-400 hover:text-gray-300 rounded-lg transition-all flex items-center justify-center"
            >
              <Ellipsis />
            </button>

            {/* Dropdown Menu */}
            {openMenuId === routine.id && (
              <>
                {/* Backdrop to close menu */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenMenuId(null);
                  }}
                />

                <div className="absolute right-0 bottom-full mb-2 z-50 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl shadow-black/50 overflow-hidden">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onStartEdit(routine.id, 'name', routine.name);
                      setOpenMenuId(null);
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors flex items-center gap-3"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit Title
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onStartEdit(routine.id, 'description', routine.description || '');
                      setOpenMenuId(null);
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors flex items-center gap-3"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                    </svg>
                    Edit Description
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDuplicate(routine.id);
                      setOpenMenuId(null);
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors flex items-center gap-3"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Duplicate
                  </button>

                  <div className="border-t border-gray-700"></div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(routine.id);
                      setOpenMenuId(null);
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-blue-400 hover:bg-blue-500/10 hover:text-blue-300 transition-colors flex items-center gap-3"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};