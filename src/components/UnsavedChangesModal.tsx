"use client";

import { FileWarning } from 'lucide-react';
import React from 'react';

interface UnsavedChangesModalProps {
  isOpen: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

export const UnsavedChangesModal: React.FC<UnsavedChangesModalProps> = ({
  isOpen,
  onSave,
  onDiscard,
  onCancel
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-gray-900/90 to-gray-900/60 backdrop-blur border border-gray-800/50 rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Content */}
        <div className="px-6 py-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/10">
              <FileWarning className="w-8 h-8 text-blue-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-100 mb-2">Unsaved Changes</h3>
            <p className="text-gray-300 mb-6 leading-relaxed">
              You have unsaved changes. Would you like to save before leaving?
            </p>
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
            onClick={onDiscard}
            className="flex-1 px-5 py-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 rounded-lg font-semibold transition-all duration-200 hover:shadow-lg"
          >
            Don&apos;t Save
          </button>
          <button
            onClick={onSave}
            className="flex-1 px-5 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition-all duration-200 hover:shadow-lg"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};
