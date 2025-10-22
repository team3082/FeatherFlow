"use client";

import { useEffect, useCallback } from 'react';
import { useStudioStore } from '@/store/StudioStore';
import { canvasToInch } from '@/types';

export function useFieldInteraction(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const viewport = useStudioStore(state => state.viewport);
  const anchorPoints = useStudioStore(state => state.anchorPoints);
  const controlPoints = useStudioStore(state => state.controlPoints);
  const selectedPoint = useStudioStore(state => state.selectedPoint);
  const activeTool = useStudioStore(state => state.activeTool);
  const isDragging = useStudioStore(state => state.isDragging);
  const isPanning = useStudioStore(state => state.isPanning);

  const setSelectedPoint = useStudioStore(state => state.setSelectedPoint);
  const setIsDragging = useStudioStore(state => state.setIsDragging);
  const setCursorPosition = useStudioStore(state => state.setCursorPosition);
  const updateAnchorPoint = useStudioStore(state => state.updateAnchorPoint);
  const updateControlPoint = useStudioStore(state => state.updateControlPoint);
  const addAnchorPoint = useStudioStore(state => state.addAnchorPoint);
  const addControlPoint = useStudioStore(state => state.addControlPoint);
  const deleteAnchorPoint = useStudioStore(state => state.deleteAnchorPoint);
  const deleteControlPoint = useStudioStore(state => state.deleteControlPoint);
  const getPointAtU = useStudioStore(state => state.getPointAtU);
  const startPanning = useStudioStore(state => state.startPanning);
  const updatePanning = useStudioStore(state => state.updatePanning);
  const stopPanning = useStudioStore(state => state.stopPanning);
  const insertAnchorOnCurve = useStudioStore(state => state.insertAnchorOnCurve);

  const findClosestU = useCallback((x: number, y: number) => {
    let closestU = 0;
    let minDistance = Infinity;
    const steps = 100;

    for (let segmentIndex = 0; segmentIndex < anchorPoints.length - 1; segmentIndex++) {
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const u = segmentIndex + t;
        const point = getPointAtU(u);
        if (point) {
          const dist = Math.hypot(x - point.x, y - point.y);
          if (dist < minDistance) {
            minDistance = dist;
            closestU = u;
          }
        }
      }
    }

    return minDistance < 30 ? closestU : null;
  }, [anchorPoints, getPointAtU]);

  // Interaction checking functions
  const checkHandleInteraction = useCallback((x: number, y: number): boolean => {
    if (activeTool !== 'anchorTool') return false;

    // Check handles first (for selected anchor)
    for (let i = 0; i < anchorPoints.length; i++) {
      const anchor = anchorPoints[i];
      if (!anchor.isCurved) continue;

      const isSelected = selectedPoint?.id === i;
      if (!isSelected) continue;

      if (Math.hypot(x - (anchor.position.x + anchor.handleOutOffset.x), y - (anchor.position.y + anchor.handleOutOffset.y)) < 5) {
        setSelectedPoint({ type: 'handleOut', id: i });
        setIsDragging(true);
        return true;
      }
      if (Math.hypot(x - (anchor.position.x + anchor.handleInOffset.x), y - (anchor.position.y + anchor.handleInOffset.y)) < 5) {
        setSelectedPoint({ type: 'handleIn', id: i });
        setIsDragging(true);
        return true;
      }
    }
    return false;
  }, [activeTool, anchorPoints, selectedPoint, setSelectedPoint, setIsDragging]);

  const checkAnchorInteraction = useCallback((x: number, y: number): boolean => {
    if (activeTool !== 'anchorTool') return false;

    // Check anchor points
    for (let i = 0; i < anchorPoints.length; i++) {
      const anchor = anchorPoints[i];
      if (Math.hypot(x - anchor.position.x, y - anchor.position.y) < 5) {
        setSelectedPoint({ type: 'anchor', id: i });
        setIsDragging(true);
        return true;
      }
    }
    return false;
  }, [activeTool, anchorPoints, setSelectedPoint, setIsDragging]);

  const checkControlInteraction = useCallback((x: number, y: number): boolean => {
    if (activeTool !== 'controlTool') return false;

    // Check control points
    for (const point of controlPoints) {
      const pos = getPointAtU(point.u);
      if (pos && Math.hypot(x - pos.x, y - pos.y) < 5) {
        setSelectedPoint({ type: 'control', id: point.id });
        setIsDragging(true);
        return true;
      }
    }
    return false;
  }, [activeTool, controlPoints, getPointAtU, setSelectedPoint, setIsDragging]);

  const checkCurveInteraction = useCallback((x: number, y: number, shiftKey: boolean): boolean => {
    if (activeTool !== 'anchorTool' || !shiftKey) return false;

    // Check if click is near a curve segment
    const u = findClosestU(x, y);
    if (u === null) return false;

    const segmentIndex = Math.floor(u);
    const t = u - segmentIndex;
    const curvePoint = getPointAtU(u);

    // Only insert if click is very close to the curve (within 10 units)
    const distance = Math.hypot(x - curvePoint.x, y - curvePoint.y);
    if (distance > 10) return false;

    // Insert anchor point on curve
    insertAnchorOnCurve(segmentIndex, t);
    // Select the newly inserted anchor point (it will be at segmentIndex + 1)
    setSelectedPoint({ type: 'anchor', id: segmentIndex + 1 });
    return true;
  }, [activeTool, findClosestU, getPointAtU, insertAnchorOnCurve, setSelectedPoint]);

  const handleAddPoint = useCallback(( x: number, y: number, shiftKey: boolean): boolean => {
    if (!shiftKey) return false;

    if (activeTool === 'anchorTool') {
      const newAnchorIndex = anchorPoints.length; // New anchor will be at the end of the array
      addAnchorPoint({
        position: { x, y },
        handleOutOffset: { x: 20, y: 0 },
        handleInOffset: { x: -20, y: 0 },
        isCurved: true,
        handlesAligned: true
      });
      // Select the newly added anchor point
      setSelectedPoint({ type: 'anchor', id: newAnchorIndex });
      return true;
    } else if (activeTool === 'controlTool') {
      const u = findClosestU(x, y);
      if (u !== null) {
        const newControlId = Date.now();
        addControlPoint({
          id: newControlId,
          u,
          color: 'blue',
          attributes: []
        });
        // Select the newly added control point
        setSelectedPoint({ type: 'control', id: newControlId });
        return true;
      }
    }
    return false;
  }, [activeTool, anchorPoints.length, addAnchorPoint, addControlPoint, findClosestU, setSelectedPoint]);

  // Mouse event handlers
  const handleMouseDown = useCallback((e: MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const canvasPos = {
      x: (screenX - viewport.offsetX) / viewport.scale,
      y: (screenY - viewport.offsetY) / viewport.scale
    };

    const inchPos = canvasToInch(canvasPos.x, canvasPos.y);
    const x = inchPos.x;
    const y = inchPos.y;

    // Check interactions in order of priority
    const handleClicked = checkHandleInteraction(x, y);
    if (handleClicked) return;

    const anchorClicked = checkAnchorInteraction(x, y);
    if (anchorClicked) return;

    const controlClicked = checkControlInteraction(x, y);
    if (controlClicked) return;

    // Check curve interaction for inserting anchor points
    const curveClicked = checkCurveInteraction(x, y, e.shiftKey);
    if (curveClicked) return;

    // Handle adding new points with Shift+click
    const pointAdded = handleAddPoint(x, y, e.shiftKey);
    if (pointAdded) return;

    //Start panning if clicking on empty space
    setSelectedPoint(null); 
    startPanning({ x: e.clientX, y: e.clientY });
  }, [canvasRef, viewport, checkHandleInteraction, checkAnchorInteraction, checkControlInteraction, checkCurveInteraction, handleAddPoint, startPanning]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const canvasPos = {
      x: (screenX - viewport.offsetX) / viewport.scale,
      y: (screenY - viewport.offsetY) / viewport.scale
    };

    const inchPos = canvasToInch(canvasPos.x, canvasPos.y);
    setCursorPosition({ x: inchPos.x, y: inchPos.y });

    if (isPanning) {
      updatePanning({ x: e.clientX, y: e.clientY });
    } else if (isDragging && selectedPoint) {
      const x = inchPos.x;
      const y = inchPos.y;

      if (selectedPoint.type === 'anchor') {
        updateAnchorPoint(selectedPoint.id, (current) => ({
          ...current,
          position: { x, y }
        }));
      } else if (selectedPoint.type === 'control') {
        const newU = findClosestU(x, y);
        if (newU !== null) {
          updateControlPoint(selectedPoint.id, { u: newU });
        }
      } else if (selectedPoint.type === 'handleOut') {
        const anchor = anchorPoints[selectedPoint.id];
        if (anchor) {
          const dx = x - anchor.position.x;
          const dy = y - anchor.position.y;
          const inMag = Math.sqrt(anchor.handleInOffset.x * anchor.handleInOffset.x + anchor.handleInOffset.y * anchor.handleInOffset.y);
          const outMag = Math.sqrt(dx * dx + dy * dy);

          updateAnchorPoint(selectedPoint.id, (current) => ({
            ...current,
            handleOutOffset: { x: dx, y: dy },
            handleInOffset: {
              x: -dx * (inMag / (outMag || 1)),
              y: -dy * (inMag / (outMag || 1))
            }
          }));
        }
      } else if (selectedPoint.type === 'handleIn') {
        const anchor = anchorPoints[selectedPoint.id];
        if (anchor) {
          const dx = x - anchor.position.x;
          const dy = y - anchor.position.y;
          const outMag = Math.sqrt(anchor.handleOutOffset.x * anchor.handleOutOffset.x + anchor.handleOutOffset.y * anchor.handleOutOffset.y);
          const inMag = Math.sqrt(dx * dx + dy * dy);

          updateAnchorPoint(selectedPoint.id, (current) => ({
            ...current,
            handleInOffset: { x: dx, y: dy },
            handleOutOffset: {
              x: -dx * (outMag / (inMag || 1)),
              y: -dy * (outMag / (inMag || 1))
            }
          }));
        }
      }
    }
  }, [canvasRef, viewport, isDragging, selectedPoint, setCursorPosition, updateAnchorPoint, updateControlPoint, findClosestU, anchorPoints, isPanning, updatePanning]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    stopPanning();
  }, [setIsDragging, stopPanning]);

  // Keyboard event handler for deleting points
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && e.shiftKey && selectedPoint) {
        e.preventDefault();

        if (selectedPoint.type === 'anchor' && anchorPoints.length > 2) {
          deleteAnchorPoint(selectedPoint.id);
        } else if (selectedPoint.type === 'control') {
          deleteControlPoint(selectedPoint.id);
        }

        setSelectedPoint(null);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedPoint, anchorPoints, controlPoints, setSelectedPoint, deleteAnchorPoint, deleteControlPoint]);

  // Attach mouse event listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseDown, handleMouseMove, handleMouseUp]);

  return {
  };
}