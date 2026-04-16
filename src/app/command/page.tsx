"use client";

import { useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Background,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type Node,
  type NodeProps,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import Header from '@/components/layout/Header';
import {
  defaultParameterValue,
  getCommandTemplates,
  useCommandStore,
  type CommandNodeData,
  type CommandTemplate,
} from '@/store/CommandStore';
import { useProjectStore } from '@/store/ProjectStore';

function StartNode({ selected }: NodeProps<Node<CommandNodeData>>) {
  return (
    <div className="relative flex items-center justify-center">
      <Handle type="source" position={Position.Right} className="!size-3 !border-0 !bg-[#66a9f0]" />
      <div
        className={`flex size-16 items-center justify-center rounded-full border shadow-lg transition ${
          selected
            ? 'border-[#7eb7f4] bg-[#17345a] ring-2 ring-[#4e9deb]/60'
            : 'border-[#2a4b73] bg-[#12233a]'
        }`}
      >
        <div className="ml-1 h-0 w-0 border-y-[9px] border-y-transparent border-l-[15px] border-l-[#d8eaff]" />
      </div>
    </div>
  );
}

function CommandNodeCard({ data, selected }: NodeProps<Node<CommandNodeData>>) {
  return (
    <div
      className={`min-w-[200px] rounded-xl border px-3 py-2 shadow-lg transition ${
        selected
          ? 'border-[#66a9f0] bg-[#12233a]/95 ring-2 ring-[#4e9deb]/60'
          : 'border-[#2a4b73] bg-[#12233a]/90'
      }`}
    >
      <Handle type="target" position={Position.Left} className="!size-3 !border-0 !bg-[#2f5f95]" />
      <div className="text-sm font-semibold text-[#e2efff]">{data.label}</div>
      <div className="mt-1 text-xs text-[#8cb4e5]">{data.description}</div>
      <div className="mt-2 rounded-md bg-[#1b3656]/80 px-2 py-1 text-[10px] uppercase tracking-wide text-[#b6d4f5]">
        {data.kind}
      </div>
      <Handle type="source" position={Position.Right} className="!size-3 !border-0 !bg-[#66a9f0]" />
    </div>
  );
}

function ConditionalNodeCard({ data, selected }: NodeProps<Node<CommandNodeData>>) {
  return (
    <div className="relative mx-auto w-24 py-2">
      <Handle type="target" position={Position.Left} className="!size-3 !border-0 !bg-[#2f5f95]" />
      <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-5 text-[10px] font-semibold text-blue-300">
        T
      </span>
      <div
        className={`mx-auto flex h-24 w-24 items-center justify-center border text-center text-xs font-semibold text-[#e2efff] shadow-lg transition [clip-path:polygon(50%_0%,100%_50%,50%_100%,0%_50%)] ${
          selected
            ? 'border-[#7eb7f4] bg-[#17345a] ring-2 ring-[#4e9deb]/60'
            : 'border-[#2a4b73] bg-[#12233a]'
        }`}
      >
        {data.label}
      </div>
      <Handle
        id="true"
        type="source"
        position={Position.Top}
        style={{ top: 0 }}
        className="!size-3 !border-0 !bg-[#66a9f0]"
      />
      <Handle
        id="false"
        type="source"
        position={Position.Bottom}
        style={{ bottom: 0 }}
        className="!size-3 !border-0 !bg-[#66a9f0]"
      />
      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-5 text-[10px] font-semibold text-blue-300">
        F
      </span>
    </div>
  );
}

const nodeTypes: NodeTypes = {
  start: StartNode,
  command: CommandNodeCard,
  conditional: ConditionalNodeCard,
};

function isTextInputTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || target.isContentEditable;
}

function CommandCanvas() {
  const { screenToFlowPosition } = useReactFlow();
  const nodes = useCommandStore(state => state.nodes);
  const edges = useCommandStore(state => state.edges);
  const selectedNodeId = useCommandStore(state => state.selectedNodeId);
  const setSelectedNodeId = useCommandStore(state => state.setSelectedNodeId);
  const applyGraphNodeChanges = useCommandStore(state => state.applyGraphNodeChanges);
  const applyGraphEdgeChanges = useCommandStore(state => state.applyGraphEdgeChanges);
  const connectNodes = useCommandStore(state => state.connectNodes);
  const addNodeFromTemplate = useCommandStore(state => state.addNodeFromTemplate);
  const updateSelectedNodeLabel = useCommandStore(state => state.updateSelectedNodeLabel);
  const updateSelectedNodeParameter = useCommandStore(state => state.updateSelectedNodeParameter);
  const getCompileResult = useCommandStore(state => state.getCompileResult);
  const undo = useCommandStore(state => state.undo);
  const redo = useCommandStore(state => state.redo);
  const resetGraph = useCommandStore(state => state.resetGraph);

  const deployCommands = useProjectStore(state => state.deployCommands);
  const dragGhostRef = useRef<HTMLCanvasElement | null>(null);

  const selectedNode = useMemo(
    () => nodes.find(node => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId]
  );
  const commandTemplates = useMemo(() => getCommandTemplates(deployCommands), [deployCommands]);
  const compileResult = useMemo(() => getCompileResult(), [edges, getCompileResult, nodes]);

  useEffect(() => {
    resetGraph();
  }, [resetGraph]);

  useEffect(() => {
    const dragGhost = document.createElement('canvas');
    dragGhost.width = 1;
    dragGhost.height = 1;
    dragGhost.style.position = 'fixed';
    dragGhost.style.top = '-100px';
    dragGhost.style.left = '-100px';
    dragGhost.style.opacity = '0';
    dragGhost.style.pointerEvents = 'none';
    document.body.appendChild(dragGhost);
    dragGhostRef.current = dragGhost;

    return () => {
      if (dragGhostRef.current) {
        document.body.removeChild(dragGhostRef.current);
        dragGhostRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || isTextInputTarget(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();
      const wantsUndo = key === 'z' && !event.shiftKey;
      const wantsRedo = (key === 'z' && event.shiftKey) || key === 'y';

      if (wantsUndo) {
        event.preventDefault();
        undo();
      }

      if (wantsRedo) {
        event.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [redo, undo]);

  const onConnect = (connection: Connection) => {
    connectNodes(connection);
  };

  const onDragStart = (event: React.DragEvent<HTMLButtonElement>, template: CommandTemplate) => {
    event.dataTransfer.setData('application/command-template', JSON.stringify(template));
    event.dataTransfer.effectAllowed = 'move';
    event.currentTarget.style.opacity = '0';

    if (dragGhostRef.current) {
      event.dataTransfer.setDragImage(dragGhostRef.current, 0, 0);
    }
  };

  const onDragEnd = (event: React.DragEvent<HTMLButtonElement>) => {
    event.currentTarget.style.opacity = '1';
  };

  const onDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();

    const rawTemplate = event.dataTransfer.getData('application/command-template');
    if (!rawTemplate) {
      return;
    }

    const template: CommandTemplate = JSON.parse(rawTemplate);
    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    addNodeFromTemplate(template, position);
  };

  return (
    <main className="flex flex-1 overflow-hidden">
      <aside className="w-72 border-r border-gray-700 bg-gray-850 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-200">Command Palette</h2>
        <p className="mt-1 text-xs text-gray-400">Drag commands into the graph to plan autonomous flow.</p>
        <div className="mt-4 space-y-2">
          {commandTemplates.map((template, index) => (
            <button
              key={`${template.id}-${index}`}
              type="button"
              draggable
              onDragStart={event => onDragStart(event, template)}
              onDragEnd={onDragEnd}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-left transition hover:border-gray-500 hover:bg-gray-750"
            >
              <div className="text-sm font-medium text-gray-100">{template.label}</div>
              <div className="text-xs text-gray-400">{template.description}</div>
              {template.commandName && (
                <div className="mt-1 text-[10px] uppercase tracking-wide text-blue-300">{template.commandName}</div>
              )}
            </button>
          ))}
        </div>
      </aside>

      <section className="relative flex-1" onDragOver={onDragOver} onDrop={onDrop}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={applyGraphNodeChanges}
          onEdgesChange={applyGraphEdgeChanges}
          onConnect={onConnect}
          onNodeClick={(_, node) => setSelectedNodeId(node.id)}
          onPaneClick={() => setSelectedNodeId(null)}
          fitView
          proOptions={{ hideAttribution: true }}
          nodeTypes={nodeTypes}
          defaultEdgeOptions={{ type: 'smoothstep' }}
          className="bg-[radial-gradient(circle_at_30%_20%,rgba(78,157,235,0.22),transparent_35%),radial-gradient(circle_at_80%_80%,rgba(35,104,180,0.22),transparent_40%),#091425]"
        >
          <Background gap={26} size={1} color="#2a4b73" />
        </ReactFlow>
      </section>

      <aside className="w-72 border-l border-gray-700 bg-gray-850 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-200">Inspector</h2>
        <p className="mt-1 text-xs text-gray-400">Ctrl/Cmd+Z undo, Ctrl+Y or Cmd/Ctrl+Shift+Z redo.</p>
        {selectedNode ? (
          <div className="mt-3 space-y-2 rounded-lg border border-gray-700 bg-gray-800/90 p-3">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-gray-400">Name</p>
              {selectedNode.data.kind === 'start' ? (
                <p className="text-sm font-medium text-gray-500">Start node</p>
              ) : (
                <input
                  type="text"
                  value={selectedNode.data.label}
                  onChange={event => updateSelectedNodeLabel(event.target.value)}
                  placeholder="Enter node name"
                  className="mt-1 w-full rounded-md border border-gray-600 bg-gray-900 px-2 py-1 text-sm text-gray-100 outline-none focus:border-blue-400"
                />
              )}
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-gray-400">Node Type</p>
              <p className="text-sm text-blue-300">{selectedNode.data.kind}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-gray-400">Description</p>
              <p className="text-sm text-gray-200">{selectedNode.data.description}</p>
            </div>
            {selectedNode.data.kind === 'command' &&
              selectedNode.data.parameters &&
              selectedNode.data.parameters.length > 0 && (
                <div className="space-y-2 pt-2">
                  <p className="text-[11px] uppercase tracking-wide text-gray-400">Parameters</p>
                  {selectedNode.data.parameters.map((parameter, index) => (
                    <div key={`${parameter.name}-${index}`}>
                      <label className="mb-1.5 block text-xs font-medium text-gray-300">
                        {parameter.name} ({parameter.type})
                      </label>
                      <input
                        type="text"
                        value={parameter.value}
                        onChange={event => updateSelectedNodeParameter(index, event.target.value)}
                        placeholder={defaultParameterValue(parameter.type)}
                        className="w-full rounded-md border border-gray-600 bg-gray-900 px-2 py-1 text-sm text-gray-100 outline-none focus:border-blue-400"
                      />
                    </div>
                  ))}
                </div>
              )}
          </div>
        ) : (
          <p className="mt-3 text-sm text-gray-400">Select a node to inspect its details.</p>
        )}

        <div className="mt-4 border-t border-gray-700 pt-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-200">Text Output</h3>
          <p className="mt-1 text-xs text-gray-400">WPILib-style composition from current graph.</p>
          {compileResult.errors.length > 0 && (
            <div className="mt-2 rounded-md border border-red-500/40 bg-red-950/40 p-2 text-xs text-red-200">
              {compileResult.errors.map(error => (
                <p key={error}>- {error}</p>
              ))}
            </div>
          )}
          <textarea
            readOnly
            value={compileResult.output}
            className="mt-2 h-200 w-full resize-none rounded-md border border-gray-700 bg-gray-900 p-2 font-mono text-xs text-gray-200"
          />
        </div>
      </aside>
    </main>
  );
}

export default function CommandPage() {
  const router = useRouter();
  const isProjectLoaded = useProjectStore(state => state.isProjectLoaded);

  useEffect(() => {
    if (!isProjectLoaded) {
      router.push('/');
    }
  }, [isProjectLoaded, router]);

  if (!isProjectLoaded) {
    return null;
  }

  return (
    <div className="flex h-screen flex-col bg-gray-900 text-gray-100">
      <Header />
      <ReactFlowProvider>
        <CommandCanvas />
      </ReactFlowProvider>
    </div>
  );
}
