"use client";

import React from 'react';
import ReactFlow, {
  Controls,
  Background,
  Node,
  Edge,
  Connection,
  OnNodesChange,
  OnEdgesChange,
} from 'reactflow';
import 'reactflow/dist/style.css';

interface CommandFieldProps {
    nodes: Node[];
    edges: Edge[];
    onNodesChange: OnNodesChange;
    onEdgesChange: OnEdgesChange;
    onConnect: (params: Connection | Edge) => void;
}

export function CommandField({ nodes, edges, onNodesChange, onEdgesChange, onConnect }: CommandFieldProps) {
    return (
        <div className="flex-1 bg-[#0e111b]">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                fitView
            >
                <Controls />
                <Background
                    color="#0e111b"
                />
            </ReactFlow>
        </div>
    );
}
