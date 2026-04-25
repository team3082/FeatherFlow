"use client";

import React from 'react';
import { X, Plus, Trash2, Lock, Unlock } from 'lucide-react';
import { useProjectStore } from '@/store/ProjectStore';
import { MotionSettings, SnapPointColor } from '@/types';

interface SnapPointsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SNAP_COLORS: SnapPointColor[] = ['blue', 'red', 'purple', 'yellow', 'cyan', 'green', 'orange'];

const COLOR_MAP: Record<SnapPointColor, string> = {
  blue: '#3B82F6',
  red: '#EF4444',
  purple: '#A855F7',
  yellow: '#FACC15',
  cyan: '#06B6D4',
  green: '#10B981',
  orange: '#F97316'
};

export const SnapPointsModal: React.FC<SnapPointsModalProps> = ({ isOpen, onClose }) => {
  const {
    snapPoints,
    snapEnabled,
    snapRadius,
    motionSettings,
    addSnapPoint,
    updateSnapPoint,
    deleteSnapPoint,
    toggleSnapEnabled,
    setSnapRadius,
    setMotionSettings,
  } = useProjectStore();

  if (!isOpen) return null;

  const handleAddSnapPoint = async () => {
    await addSnapPoint({
      position: { x: 350, y: 150 },
      name: `Snap Point ${snapPoints.length + 1}`,
      color: 'blue',
      enabled: true,
      locked: false
    });
  };

  const handleUpdateName = async (id: string, name: string) => {
    await updateSnapPoint(id, { name });
  };

  const handleUpdatePosition = async (id: string, axis: 'x' | 'y', value: string) => {
    const snapPoint = snapPoints.find(sp => sp.id === id);
    if (!snapPoint || snapPoint.locked) return;

    const numValue = parseFloat(value);
    if (isNaN(numValue)) return;

    const newPosition = { ...snapPoint.position };
    newPosition[axis] = numValue;
    await updateSnapPoint(id, { position: newPosition });
  };

  const handleUpdateColor = async (id: string, color: SnapPointColor) => {
    await updateSnapPoint(id, { color });
  };

  const handleToggleEnabled = async (id: string) => {
    const snapPoint = snapPoints.find(sp => sp.id === id);
    if (!snapPoint) return;
    await updateSnapPoint(id, { enabled: !snapPoint.enabled });
  };

  const handleToggleLocked = async (id: string) => {
    const snapPoint = snapPoints.find(sp => sp.id === id);
    if (!snapPoint) return;
    await updateSnapPoint(id, { locked: !snapPoint.locked });
  };

  const handleDelete = async (id: string) => {
    await deleteSnapPoint(id);
  };

  const handleRadiusChange = async (value: string) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return;
    await setSnapRadius(numValue);
  };

  const handleMotionSettingChange = async (key: keyof MotionSettings, value: string) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return;
    await setMotionSettings({ [key]: numValue });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-gray-900/90 to-gray-900/60 backdrop-blur border border-gray-800/50 rounded-2xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-700/50 flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-100">Snap Point Settings</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700/50 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Global Settings */}
          <div className="mb-6 p-4 rounded-xl border border-gray-700/50 bg-gray-800/20">
            <h4 className="text-sm font-semibold text-gray-200 mb-3">Global Motion + Snap Settings</h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
              <div className="space-y-1">
                <label className="text-xs text-gray-400">Snap Enabled</label>
                <button
                  onClick={toggleSnapEnabled}
                  className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    snapEnabled
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 hover:bg-blue-500/30'
                      : 'bg-gray-700/50 text-gray-300 border border-gray-600 hover:bg-gray-700'
                  }`}
                >
                  {snapEnabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-gray-400">Snap Radius</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  step="0.5"
                  value={snapRadius}
                  onChange={(e) => handleRadiusChange(e.target.value)}
                  className="w-full px-2.5 py-2 bg-gray-700/50 border border-gray-600 rounded text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-gray-400">Max Velocity</label>
                <input
                  type="number"
                  step="0.1"
                  min={0.001}
                  value={motionSettings.maxTranslationalVelocity}
                  onChange={(e) => handleMotionSettingChange('maxTranslationalVelocity', e.target.value)}
                  className="w-full px-2.5 py-2 bg-gray-700/50 border border-gray-600 rounded text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-gray-400">Max Acceleration</label>
                <input
                  type="number"
                  step="0.1"
                  min={0.001}
                  value={motionSettings.maxAcceleration}
                  onChange={(e) => handleMotionSettingChange('maxAcceleration', e.target.value)}
                  className="w-full px-2.5 py-2 bg-gray-700/50 border border-gray-600 rounded text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-gray-400">Max Rotational Velocity</label>
                <input
                  type="number"
                  step="0.1"
                  min={0.001}
                  value={motionSettings.maxRotationalVelocity}
                  onChange={(e) => handleMotionSettingChange('maxRotationalVelocity', e.target.value)}
                  className="w-full px-2.5 py-2 bg-gray-700/50 border border-gray-600 rounded text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-gray-400">Max Wheel Speed</label>
                <input
                  type="number"
                  step="0.1"
                  min={0.001}
                  value={motionSettings.maxWheelSpeed}
                  onChange={(e) => handleMotionSettingChange('maxWheelSpeed', e.target.value)}
                  className="w-full px-2.5 py-2 bg-gray-700/50 border border-gray-600 rounded text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-gray-400">Max Lateral Accel</label>
                <input
                  type="number"
                  step="0.1"
                  min={0.001}
                  value={motionSettings.maxLateralAcceleration}
                  onChange={(e) => handleMotionSettingChange('maxLateralAcceleration', e.target.value)}
                  className="w-full px-2.5 py-2 bg-gray-700/50 border border-gray-600 rounded text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-gray-400">Swerve Radius</label>
                <input
                  type="number"
                  step="0.1"
                  min={0.001}
                  value={motionSettings.swerveRadius}
                  onChange={(e) => handleMotionSettingChange('swerveRadius', e.target.value)}
                  className="w-full px-2.5 py-2 bg-gray-700/50 border border-gray-600 rounded text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Snap Points List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-300">Snap Points ({snapPoints.length})</h4>
              <button
                onClick={handleAddSnapPoint}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Snap Point
              </button>
            </div>

            {snapPoints.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No snap points yet. Click &quot;Add Snap Point&quot; to create one.
              </div>
            ) : (
              <div className="space-y-2">
                {snapPoints.map((snapPoint) => (
                  <div
                    key={snapPoint.id}
                    className={`p-3 rounded-lg border transition-colors ${
                      snapPoint.enabled
                        ? 'bg-gray-800/40 border-gray-700/50'
                        : 'bg-gray-800/20 border-gray-700/30 opacity-60'
                    }`}
                  >
                    <div className="grid grid-cols-12 gap-3 items-center">
                      {/* Color Indicator */}
                      <div className="col-span-1 flex justify-center">
                        <div
                          className="w-6 h-6 rounded-full border-2 border-gray-600"
                          style={{ backgroundColor: COLOR_MAP[snapPoint.color || 'blue'] }}
                        />
                      </div>

                      {/* Name */}
                      <div className="col-span-3">
                        <input
                          type="text"
                          value={snapPoint.name}
                          onChange={(e) => handleUpdateName(snapPoint.id, e.target.value)}
                          className="w-full px-2 py-1 bg-gray-700/50 border border-gray-600 rounded text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Name"
                        />
                      </div>

                      {/* X Position */}
                      <div className="col-span-2">
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-500">X:</span>
                          <input
                            type="number"
                            step="0.1"
                            value={snapPoint.position.x.toFixed(1)}
                            onChange={(e) => handleUpdatePosition(snapPoint.id, 'x', e.target.value)}
                            disabled={snapPoint.locked}
                            className={`w-full px-2 py-1 bg-gray-700/50 border border-gray-600 rounded text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                              snapPoint.locked ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                          />
                        </div>
                      </div>

                      {/* Y Position */}
                      <div className="col-span-2">
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-500">Y:</span>
                          <input
                            type="number"
                            step="0.1"
                            value={snapPoint.position.y.toFixed(1)}
                            onChange={(e) => handleUpdatePosition(snapPoint.id, 'y', e.target.value)}
                            disabled={snapPoint.locked}
                            className={`w-full px-2 py-1 bg-gray-700/50 border border-gray-600 rounded text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                              snapPoint.locked ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                          />
                        </div>
                      </div>

                      {/* Color Dropdown */}
                      <div className="col-span-2">
                        <select
                          value={snapPoint.color || 'blue'}
                          onChange={(e) => handleUpdateColor(snapPoint.id, e.target.value as SnapPointColor)}
                          className="w-full px-2 py-1 bg-gray-700/50 border border-gray-600 rounded text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {SNAP_COLORS.map((color) => (
                            <option key={color} value={color}>
                              {color.charAt(0).toUpperCase() + color.slice(1)}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Actions */}
                      <div className="col-span-2 flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleToggleEnabled(snapPoint.id)}
                          className={`p-1.5 rounded transition-colors ${
                            snapPoint.enabled
                              ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                              : 'bg-gray-700/50 text-gray-500 hover:bg-gray-700'
                          }`}
                          title={snapPoint.enabled ? 'Enabled' : 'Disabled'}
                        >
                          <div className="w-3 h-3 rounded-full border-2" />
                        </button>
                        <button
                          onClick={() => handleToggleLocked(snapPoint.id)}
                          className="p-1.5 hover:bg-gray-700/50 rounded transition-colors text-gray-400"
                          title={snapPoint.locked ? 'Locked' : 'Unlocked'}
                        >
                          {snapPoint.locked ? (
                            <Lock className="w-4 h-4" />
                          ) : (
                            <Unlock className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDelete(snapPoint.id)}
                          className="p-1.5 hover:bg-blue-500/20 text-blue-400 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-900/30 border-t border-gray-700/50 px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition-all duration-200 hover:shadow-lg"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
