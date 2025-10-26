"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { useProjectStore } from '@/store/ProjectStore';

interface HeaderProps {
    className?: string;
}

    export default function Header({ className }: HeaderProps) {
    const pathname = usePathname();
    const currentRoutineName = useProjectStore(state => state.getCurrentRoutineName());

    return (
        <header className={`relative z-10 flex items-center justify-between px-6 py-3 h-15 bg-gray-800 ${className}`}>
            <div className="text-xl font-semibold text-white">
                Feather Flow
            </div>

            {/* Breadcrumb Navigation - Centered */}
            <div className="flex items-center gap-2 text-base">
                {(pathname === '/studio' || pathname === '/test') && (
                <>
                    <Link
                    href="/project"
                    className="text-white hover:text-gray-300 transition-colors font-medium"
                    >
                    Project
                    </Link>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                    <span className="text-white font-medium">
                        {currentRoutineName || 'Untitled Routine'}
                    </span>
                    <Link href="/command">
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                    </Link>
                </>
                )}
            </div>

            {/* Project Badge */}

            
            <Link
                href="/"
                className="text-xl text-white font-medium"
            >
                2025 Reefscape
            </Link>
        </header>
    );
}