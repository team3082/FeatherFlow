"use client";

import Header from '@/components/layout/Header';
import AmbientDots from '@/components/AmbientDots';
import React, { useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import { useProjectStore } from '@/store/ProjectStore';
import { RoutineCard } from './components/RoutineCard';
import { CreateNewCard } from './components/CreateNewCard';
import { DeleteConfirmationModal } from './components/DeleteConfirmationModal';

export default function ProjectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromLanding = searchParams.get('from') === 'landing';

  const { routines, createRoutine, duplicateRoutine, deleteRoutine, renameRoutine } = useProjectStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<'name' | 'description' | null>(null);
  const [editValue, setEditValue] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleCreateNew = () => {
    router.push('/studio');
  };

  const handleEditAuto = (routineId: string) => {
    // TODO: Load the routine data into the studio
    router.push('/studio');
  };

  const handleDeleteAuto = (routineId: string) => {
    const routineToDelete = routines.find(r => r.id === routineId);
    if (routineToDelete) {
      deleteRoutine(routineId);
      setDeleteConfirmId(null);
    }
  };

  const handleOpenDeleteConfirm = (routineId: string) => {
    setDeleteConfirmId(routineId);
  };

  const handleCancelDelete = () => {
    setDeleteConfirmId(null);
  };

  const handleDuplicateAuto = (routineId: string) => {
    duplicateRoutine(routineId);
  };

  const handleStartEdit = (routineId: string, field: 'name' | 'description', currentValue: string) => {
    setEditingId(routineId);
    setEditingField(field);
    setEditValue(currentValue);
  };

  const handleSaveEdit = () => {
    if (editingId && editingField) {
      if (editingField === 'name') {
        renameRoutine(editingId, editValue);
      } else {
        // TODO: Handle description editing in the store
        console.log('Description editing not implemented yet');
      }
      setEditingId(null);
      setEditingField(null);
      setEditValue('');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingField(null);
    setEditValue('');
  };

  const routineToDelete = deleteConfirmId ? routines.find(r => r.id === deleteConfirmId) || null : null;

  return (
      <div className={`flex flex-col h-screen bg-[#0a0e1a] transition-opacity duration-500 ${fromLanding ? 'opacity-0 animate-fade-in' : 'opacity-100'}`}>
        <Header />

        {/* Ambient background dots */}
        <AmbientDots />

        <div className="flex-1 overflow-auto">
          {/* Main Content */}
          <div className="max-w-7xl mx-auto px-8 py-8">
            {/* Auto Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {/* Existing Auto Cards */}
              {routines.map((routine, index) => (
                <RoutineCard
                  key={routine.id}
                  routine={routine}
                  index={index}
                  onEdit={handleEditAuto}
                  onDuplicate={handleDuplicateAuto}
                  onDelete={handleOpenDeleteConfirm}
                  onStartEdit={handleStartEdit}
                  editingId={editingId}
                  editingField={editingField}
                  editValue={editValue}
                  onSaveEdit={handleSaveEdit}
                  onCancelEdit={handleCancelEdit}
                  onEditValueChange={function (value: string): void {
                    throw new Error('Function not implemented.');
                  }}              />
              ))}

              {/* Create New Card */}
              <CreateNewCard onClick={handleCreateNew} />
            </div>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        <DeleteConfirmationModal
          routine={routineToDelete}
          onCancel={handleCancelDelete}
          onConfirm={() => handleDeleteAuto(deleteConfirmId!)}
        />
      </div>
  );
}
