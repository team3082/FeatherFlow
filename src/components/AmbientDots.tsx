"use client";

import React, { useState, useEffect } from 'react';

interface AmbientDot {
  left: number;
  top: number;
  size: number;
  delay: number;
  duration: number;
  opacity: number;
}

interface AmbientDotsProps {
  count?: number;
  className?: string;
}

/**
 * Makes floating ambient dots for background decoration, THIS IS NEEDED LEXIIIII
 * @param count Number of dots to generate
 */
export default function AmbientDots({count = 24, className = ""}: AmbientDotsProps) {
  const [dots, setDots] = useState<AmbientDot[]>([]);

  useEffect(() => {
    const generatedDots = Array.from({ length: count }, () => ({
      left: Math.random() * 100,
      top: Math.random() * 100,
      size: 1.5 + Math.random() * 5,
      delay: Math.random() * 5,
      duration: 2 + Math.random() * 3,
      opacity: 0.1 + Math.random() * 0.4,
    }));
    setDots(generatedDots);
  }, [count]);

  return (
    <div className={`absolute inset-0 pointer-events-none overflow-hidden z-[0] ${className}`}>
      {dots.map((dot, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-blue-400"
          style={{
                left: `${dot.left}%`,
                top: `${dot.top}%`,
                width: `${dot.size}px`,
                height: `${dot.size}px`,
                opacity: dot.opacity,
                animationDelay: `${dot.delay}s`,
                animationDuration: `${dot.duration}s`,
                animationName: `bob`,
                animationTimingFunction: 'ease-in-out',
                animationIterationCount: 'infinite',
              }}
        />
      ))}
    </div>
  );
};