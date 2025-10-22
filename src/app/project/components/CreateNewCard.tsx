"use client";

import React from 'react';

interface CreateNewCardProps {
  onClick: () => void;
}

export const CreateNewCard: React.FC<CreateNewCardProps> = ({ onClick }) => {
  return (
    <div
      onClick={onClick}
      className="bg-gradient-to-br from-gray-900/40 to-gray-900/20 backdrop-blur border-2 border-dashed border-gray-800/50 rounded-2xl hover:border-blue-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10 cursor-pointer group hover:-translate-y-1 flex flex-col relative"
    >
      <div className="aspect-[3/2]">
        {/* Empty space */}
      </div>
      <div className="p-5">
        {/* Empty space */}
      </div>
      {/* Centered icon overlay */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-24 h-24 rounded-2xl bg-gray-800/80 group-hover:bg-blue-500/20 border-2 border-gray-700/80 group-hover:border-blue-500/60 flex items-center justify-center transition-all duration-300 group-hover:scale-110 shadow-lg">
          <svg className="w-12 h-12 text-gray-400 group-hover:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
        </div>
      </div>
    </div>
  );
};