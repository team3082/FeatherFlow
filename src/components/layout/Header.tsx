"use client";

import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useProjectStore } from '@/store/ProjectStore';
import { UnsavedChangesModal } from '@/components/UnsavedChangesModal';

interface HeaderProps {
    className?: string;
}

export default function Header({ className }: HeaderProps) {
    const router = useRouter();
    const pathname = usePathname();

    // Project and routine data
    const currentRoutineName = useProjectStore(state => state.getCurrentRoutineName());
    const projectPath = useProjectStore(state => state.projectPath);
    const projectName = projectPath ? projectPath.split(/[/\\]/).filter(Boolean).pop() : "Project";

    // Unsaved changes logic now lives in the Header
    const saveCurrentToProject = useProjectStore(state => state.saveCurrentToProject);
    const syncFromStudio = useProjectStore(state => state.syncFromStudio);

    const [showModal, setShowModal] = useState(false);
    const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);

    const handleNavigation = (path: string) => {
        if (pathname === '/studio') {
            setPendingNavigation(path);
            setShowModal(true);
        } else {
            router.push(path);
        }
    };

    const handleSave = async () => {
        syncFromStudio();
        await saveCurrentToProject();
        if (pendingNavigation) {
            router.push(pendingNavigation);
        }
        setShowModal(false);
        setPendingNavigation(null);
    };

    const handleDiscard = () => {
        if (pendingNavigation) {
            router.push(pendingNavigation);
        }
        setShowModal(false);
        setPendingNavigation(null);
    };

    const handleCancel = () => {
        setShowModal(false);
        setPendingNavigation(null);
    };

    return (
        <>
            <header className={`relative z-10 flex items-center justify-between px-6 py-3 h-15 bg-gray-800 ${className}`}>
                <button
                    onClick={() => handleNavigation('/')}
                    className="text-xl text-white font-medium hover:text-gray-300 transition-colors"
                >
                    Feather Flow
                </button>

                {/* Breadcrumb Navigation - Centered */}
                <div className="flex items-center gap-2 text-base">
                    {(pathname === '/studio' || pathname === '/test') && (
                    <>
                        <button
                            onClick={() => handleNavigation('/project')}
                            className="text-white hover:text-gray-300 transition-colors font-medium"
                        >
                            Project
                        </button>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                        <span className="text-white font-medium">
                            {currentRoutineName || 'WELP'}
                        </span>
                    </>
                    )}
                </div>

                {/* Project Badge */}
                <div className="text-xl font-semibold text-white">
                    {projectName}
                </div>
            </header>

            <UnsavedChangesModal
                isOpen={showModal}
                onSave={handleSave}
                onDiscard={handleDiscard}
                onCancel={handleCancel}
            />
        </>
    );
}