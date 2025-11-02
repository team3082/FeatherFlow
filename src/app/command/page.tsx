"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useProjectStore } from '@/store/ProjectStore';
import Header from '@/components/layout/Header';
import Footer from './components/Footer';
import { LeftSidebar } from './components/LeftSidebar';
import RightSidebar from './components/RightSidebar';
import { CommandField } from './components/CommandField';
import { useNodesState, useEdgesState, addEdge, Node, Edge, Connection } from 'reactflow';

const initialNodes: Node[] = [
  { id: '1', position: { x: 0, y: 0 }, data: { label: 'Start' } },
];

export default function CommandPage() {
  const router = useRouter();
  const isProjectLoaded = useProjectStore(state => state.isProjectLoaded);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const addNode = (type: string) => {
    const newNode: Node = {
      id: `${Date.now()}`,
      type: 'default',
      position: { 
        x: Math.random() * 400,
        y: Math.random() * 400,
       },
      data: { label: `${type} node` },
    };
    setNodes((nds) => nds.concat(newNode));
      console.log('Current nodes:', nodes);

  };


  const onConnect = (params: Connection | Edge) => setEdges((eds) => addEdge(params, eds));

  useEffect(() => {
    if (!isProjectLoaded) {
      router.push('/');
    }
  }, [isProjectLoaded, router]);

  if (!isProjectLoaded) {
    return null; // Or a loading spinner
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-100">
      <Header />
      <main className="flex flex-1 overflow-hidden">
        <LeftSidebar addNode={addNode} />
        <CommandField 
          nodes={nodes} 
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
        />
        <RightSidebar />
      </main>
      <Footer />
    </div>
  );
}
