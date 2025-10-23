"use client";

import React from 'react';
import { AutoRoutine } from '@/types';

interface DeleteConfirmationModalProps {
  routine: AutoRoutine | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  routine,
  onCancel,
  onConfirm
}) => {
  if (!routine) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-gray-900/90 to-gray-900/60 backdrop-blur border border-gray-800/50 rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Content */}
        <div className="px-6 py-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/10">
              <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-100 mb-2">Delete Auto</h3>
            <p className="text-gray-300 mb-6 leading-relaxed">
              Are you sure you want to delete <span className="font-semibold text-blue-400">{routine.name}</span>?
            </p>
            <p className="text-sm text-gray-400">This action cannot be undone.</p>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-900/30 border-t border-gray-700/50 px-6 py-5 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-5 py-3 bg-gray-700/80 hover:bg-gray-600/80 text-gray-300 rounded-lg font-semibold transition-all duration-200 hover:shadow-lg"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-5 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition-all duration-200 hover:shadow-lg"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};