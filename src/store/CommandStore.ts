import { create } from 'zustand';
import {
	addEdge,
	applyEdgeChanges,
	applyNodeChanges,
	MarkerType,
	type Connection,
	type Edge,
	type EdgeChange,
	type Node,
	type NodeChange,
	type XYPosition,
} from '@xyflow/react';
import { DeployCommandDefinition } from '@/types';

export type CommandNodeParameter = {
	name: string;
	type: string;
	value: string;
};

export type CommandNodeData = {
	kind: 'start' | 'command' | 'wait' | 'conditional';
	label: string;
	description: string;
	commandName?: string;
	parameters?: CommandNodeParameter[];
};

export type CommandTemplate = {
	id: string;
	label: string;
	description: string;
	commandName?: string;
	parameters?: CommandNodeParameter[];
};

type GraphSnapshot = {
	nodes: Node<CommandNodeData>[];
	edges: Edge[];
	selectedNodeId: string | null;
	nextId: number;
};

export type CompileResult = {
	output: string;
	errors: string[];
};

type CommandState = {
	nodes: Node<CommandNodeData>[];
	edges: Edge[];
	selectedNodeId: string | null;
	nextId: number;
	historyPast: GraphSnapshot[];
	historyFuture: GraphSnapshot[];

	setSelectedNodeId: (id: string | null) => void;
	applyGraphNodeChanges: (changes: NodeChange<Node<CommandNodeData>>[]) => void;
	applyGraphEdgeChanges: (changes: EdgeChange<Edge>[]) => void;
	connectNodes: (connection: Connection) => void;
	addNodeFromTemplate: (template: CommandTemplate, position: XYPosition) => void;
	updateSelectedNodeLabel: (label: string) => void;
	updateSelectedNodeParameter: (index: number, value: string) => void;
	undo: () => void;
	redo: () => void;
	getCompileResult: () => CompileResult;
	resetGraph: () => void;
};

const START_NODE_ID = 'start';
const HISTORY_LIMIT = 150;

const BASE_COMMAND_TEMPLATES: CommandTemplate[] = [
	{ id: 'command', label: 'Command', description: 'Generic robot action step.' },
	{ id: 'wait', label: 'Wait', description: 'Pause for a duration.' },
	{ id: 'conditional', label: 'Conditional', description: 'Branch based on a condition.' },
];

const initialNodes: Node<CommandNodeData>[] = [
	{
		id: START_NODE_ID,
		type: 'start',
		deletable: false,
		position: { x: 120, y: 120 },
		data: {
			kind: 'start',
			label: '',
			description: 'Entry point of command sequence.',
		},
	},
];

const initialEdges: Edge[] = [];

function createSnapshot(state: CommandState): GraphSnapshot {
	return {
		nodes: structuredClone(state.nodes),
		edges: structuredClone(state.edges),
		selectedNodeId: state.selectedNodeId,
		nextId: state.nextId,
	};
}

function withHistory(state: CommandState, updater: (state: CommandState) => Partial<CommandState>): Partial<CommandState> {
	const nextState = updater(state);
	return {
		...nextState,
		historyPast: [...state.historyPast, createSnapshot(state)].slice(-HISTORY_LIMIT),
		historyFuture: [],
	};
}

function sanitizeNodeId(value: string) {
	return value.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function shortCommandLabel(name: string) {
	const segments = name.split('.');
	return segments[segments.length - 1] || name;
}

export function defaultParameterValue(type: string) {
	const normalizedType = type.trim().toLowerCase();
	if (
		normalizedType.includes('int') ||
		normalizedType.includes('double') ||
		normalizedType.includes('float') ||
		normalizedType.includes('long') ||
		normalizedType.includes('short') ||
		normalizedType.includes('byte') ||
		normalizedType.includes('number')
	) {
		return '0';
	}

	if (normalizedType.includes('boolean')) {
		return 'false';
	}

	return '';
}

function toCommandTemplate(command: DeployCommandDefinition): CommandTemplate {
	return {
		id: command.name,
		label: shortCommandLabel(command.name),
		description: command.parameters.length > 0
			? command.parameters.map(parameter => `${parameter.name}: ${parameter.type}`).join(', ')
			: 'No parameters',
		commandName: command.name,
		parameters: command.parameters.map(parameter => ({
			name: parameter.name,
			type: parameter.type,
			value: defaultParameterValue(parameter.type),
		})),
	};
}

export function getCommandTemplates(commands: DeployCommandDefinition[]) {
	return [...BASE_COMMAND_TEMPLATES, ...commands.map(toCommandTemplate)];
}

function safeJavaScriptString(value: string) {
	return JSON.stringify(value);
}

function indentText(value: string, level = 1) {
	const pad = '  '.repeat(level);
	return value
		.split('\n')
		.map(line => (line.length > 0 ? `${pad}${line}` : line))
		.join('\n');
}

function formatCall(name: string, args: string[]) {
	if (args.length === 0) {
		return `${name}()`;
	}

	if (args.length === 1 && !args[0].includes('\n')) {
		return `${name}(${args[0]})`;
	}

	return `${name}(\n${args.map(arg => indentText(arg)).join(',\n')}\n)`;
}

function wrapParallel(parts: string[]) {
	if (parts.length === 0) {
		return 'Commands.none()';
	}

	if (parts.length === 1) {
		return parts[0];
	}

	return formatCall('Commands.parallel', parts);
}

function wrapEither(trueExpr: string, falseExpr: string, conditionExpr: string) {
	return formatCall('Commands.either', [trueExpr, falseExpr, conditionExpr]);
}

function wrapSequence(parts: string[]) {
	if (parts.length === 0) {
		return 'Commands.none()';
	}

	if (parts.length === 1) {
		return parts[0];
	}

	return formatCall('Commands.sequence', parts);
}

function commandExpr(node: Node<CommandNodeData>) {
	if (node.data.kind === 'command') {
		const commandName = node.data.commandName ?? node.data.label;
		const parameters = node.data.parameters ?? [];
		const args = parameters.map(parameter => {
			const normalizedType = parameter.type.trim().toLowerCase();
			const rawValue = parameter.value.trim();

			if (
				normalizedType.includes('int') ||
				normalizedType.includes('double') ||
				normalizedType.includes('float') ||
				normalizedType.includes('long') ||
				normalizedType.includes('short') ||
				normalizedType.includes('byte') ||
				normalizedType.includes('number')
			) {
				return rawValue || '0';
			}

			if (normalizedType.includes('boolean')) {
				return rawValue.toLowerCase() === 'true' ? 'true' : 'false';
			}

			return safeJavaScriptString(rawValue);
		});

		return formatCall(commandName, args);
	}

	if (node.data.kind === 'wait') {
		return 'new WaitCommand(1.0)';
	}

	return 'Commands.none()';
}

function compileGraphToWpilib(nodes: Node<CommandNodeData>[], edges: Edge[]): CompileResult {
	const errors: string[] = [];
	const nodeById = new Map(nodes.map(node => [node.id, node]));
	const incoming = new Map<string, Edge[]>();
	const outgoing = new Map<string, Edge[]>();

	for (const node of nodes) {
		incoming.set(node.id, []);
		outgoing.set(node.id, []);
	}

	for (const edge of edges) {
		if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) {
			errors.push(`Edge ${edge.id} references missing nodes.`);
			continue;
		}

		outgoing.get(edge.source)?.push(edge);
		incoming.get(edge.target)?.push(edge);
	}

	const startNodes = nodes.filter(node => node.data.kind === 'start');
	if (startNodes.length !== 1) {
		errors.push('Graph must contain exactly one start node.');
		return { output: '', errors };
	}

	const startNode = startNodes[0];
	const startOut = outgoing.get(startNode.id) ?? [];
	if (startOut.length !== 1) {
		errors.push('Start node must have exactly one outgoing edge.');
	}

	for (const node of nodes) {
		if (node.data.kind === 'conditional') {
			const nodeOut = outgoing.get(node.id) ?? [];
			const trueOut = nodeOut.filter(edge => edge.sourceHandle === 'true');
			const falseOut = nodeOut.filter(edge => edge.sourceHandle === 'false');
			if (trueOut.length !== 1 || falseOut.length !== 1) {
				errors.push(`Conditional node ${node.id} needs one true and one false output.`);
			}
		}
	}

	for (const node of nodes) {
		if (node.data.kind === 'start') {
			continue;
		}

		if ((incoming.get(node.id) ?? []).length === 0) {
			errors.push(`Node ${node.id} is unreachable from start.`);
		}
	}

	function reachableMap(startId: string, stopId?: string) {
		const dist = new Map<string, number>();
		const queue: string[] = [startId];
		dist.set(startId, 0);

		while (queue.length > 0) {
			const current = queue.shift();
			if (!current) {
				continue;
			}

			if (stopId && current === stopId) {
				continue;
			}

			const currentDist = dist.get(current) ?? 0;
			for (const edge of outgoing.get(current) ?? []) {
				if (!dist.has(edge.target)) {
					dist.set(edge.target, currentDist + 1);
					queue.push(edge.target);
				}
			}
		}

		return dist;
	}

	function findCommonJoin(startIds: string[], stopId?: string) {
		if (startIds.length === 0) {
			return null;
		}

		const maps = startIds.map(id => reachableMap(id, stopId));
		let common = new Set(maps[0].keys());
		for (const map of maps.slice(1)) {
			common = new Set([...common].filter(id => map.has(id)));
		}

		if (stopId && maps.every(map => map.has(stopId))) {
			common.add(stopId);
		}

		const candidates = [...common].filter(id => (incoming.get(id)?.length ?? 0) > 1);
		if (candidates.length === 0) {
			return null;
		}

		let bestId: string | null = null;
		let bestScore = Number.POSITIVE_INFINITY;
		for (const candidate of candidates) {
			let score = 0;
			for (const map of maps) {
				score += map.get(candidate) ?? 100000;
			}

			if (score < bestScore) {
				bestScore = score;
				bestId = candidate;
			}
		}

		return bestId;
	}

	function compileFrom(nodeId: string | null, stopId: string | null, path: Set<string>): string[] {
		if (!nodeId) {
			return [];
		}

		const parts: string[] = [];
		let current: string | null = nodeId;
		const localPath = new Set(path);

		while (current && current !== stopId) {
			if (localPath.has(current)) {
				errors.push(`Cycle detected at node ${current}.`);
				break;
			}

			localPath.add(current);
			const node = nodeById.get(current);
			if (!node) {
				errors.push(`Node ${current} not found.`);
				break;
			}

			const nodeOut: Edge[] = outgoing.get(current) ?? [];

			if (node.data.kind === 'start') {
				current = nodeOut[0]?.target ?? null;
				continue;
			}

			if (node.data.kind === 'conditional') {
				const trueEdge = nodeOut.find(edge => edge.sourceHandle === 'true');
				const falseEdge = nodeOut.find(edge => edge.sourceHandle === 'false');
				if (!trueEdge || !falseEdge) {
					errors.push(`Conditional node ${current} has missing true/false branches.`);
					break;
				}

				const join = findCommonJoin([trueEdge.target, falseEdge.target], stopId ?? undefined);
				const trueParts = compileFrom(trueEdge.target, join, localPath);
				const falseParts = compileFrom(falseEdge.target, join, localPath);
				parts.push(
					wrapEither(
						wrapSequence(trueParts),
						wrapSequence(falseParts),
						`() -> condition_${current.replace(/-/g, '_')}`
					)
				);

				current = join;
				if (!current) {
					break;
				}

				continue;
			}

			if (nodeOut.length > 1) {
				const branchStarts: string[] = nodeOut.map(edge => edge.target);
				const join = findCommonJoin(branchStarts, stopId ?? undefined);
				const branchExprs = branchStarts.map(start =>
					wrapSequence(compileFrom(start, join, localPath))
				);
				parts.push(wrapParallel(branchExprs));
				current = join;
				if (!current) {
					break;
				}

				continue;
			}

			parts.push(commandExpr(node));
			current = nodeOut[0]?.target ?? null;
		}

		return parts;
	}

	const topLevelParts = compileFrom(startNode.id, null, new Set());
	const mainExpr = wrapSequence(topLevelParts);

	const output = [
		'// Generated from command flow graph',
		'// Multi-input node rule: join -> continue sequentially',
		'Command autoRoutine =',
		indentText(mainExpr),
		';',
	].join('\n');

	return { output, errors };
}

function toInitialState() {
	return {
		nodes: structuredClone(initialNodes),
		edges: structuredClone(initialEdges),
		selectedNodeId: START_NODE_ID,
		nextId: 1,
		historyPast: [],
		historyFuture: [],
	};
}

export const useCommandStore = create<CommandState>((set, get) => ({
	...toInitialState(),

	setSelectedNodeId(id) {
		set({ selectedNodeId: id });
	},

	applyGraphNodeChanges(changes) {
		set(state => withHistory(state, () => {
			const filteredChanges = changes.filter(
				change => !(change.type === 'remove' && change.id === START_NODE_ID)
			);

			const nodes = applyNodeChanges(filteredChanges, state.nodes);
			const selectedNodeId = nodes.some(node => node.id === state.selectedNodeId)
				? state.selectedNodeId
				: null;

			return { nodes, selectedNodeId };
		}));
	},

	applyGraphEdgeChanges(changes) {
		set(state => withHistory(state, () => ({
			edges: applyEdgeChanges(changes, state.edges),
		})));
	},

	connectNodes(connection) {
		set(state => withHistory(state, () => ({
			edges: addEdge(
				{
					...connection,
					type: 'smoothstep',
					markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
					style: { stroke: '#3178c6', strokeWidth: 2 },
				},
				state.edges
			),
		})));
	},

	addNodeFromTemplate(template, position) {
		set(state => withHistory(state, () => {
			const id = `${sanitizeNodeId(template.id)}-${state.nextId}`;
			const isConditional = template.id === 'conditional';
			const isWait = template.id === 'wait';

			const newNode: Node<CommandNodeData> = {
				id,
				type: isConditional ? 'conditional' : 'command',
				position,
				data: {
					kind: isConditional ? 'conditional' : isWait ? 'wait' : 'command',
					label: template.label,
					description: template.description,
					commandName: template.commandName,
					parameters: template.parameters,
				},
			};

			return {
				nodes: [...state.nodes, newNode],
				selectedNodeId: id,
				nextId: state.nextId + 1,
			};
		}));
	},

	updateSelectedNodeLabel(label) {
		set(state => {
			if (!state.selectedNodeId) {
				return state;
			}

			return withHistory(state, () => ({
				nodes: state.nodes.map(node =>
					node.id === state.selectedNodeId ? { ...node, data: { ...node.data, label } } : node
				),
			}));
		});
	},

	updateSelectedNodeParameter(index, value) {
		set(state => {
			if (!state.selectedNodeId) {
				return state;
			}

			return withHistory(state, () => ({
				nodes: state.nodes.map(node => {
					if (node.id !== state.selectedNodeId || !node.data.parameters) {
						return node;
					}

					return {
						...node,
						data: {
							...node.data,
							parameters: node.data.parameters.map((parameter, parameterIndex) =>
								parameterIndex === index ? { ...parameter, value } : parameter
							),
						},
					};
				}),
			}));
		});
	},

	undo() {
		const state = get();
		const previous = state.historyPast[state.historyPast.length - 1];
		if (!previous) {
			return;
		}

		const currentSnapshot = createSnapshot(state);
		set({
			nodes: structuredClone(previous.nodes),
			edges: structuredClone(previous.edges),
			selectedNodeId: previous.selectedNodeId,
			nextId: previous.nextId,
			historyPast: state.historyPast.slice(0, -1),
			historyFuture: [currentSnapshot, ...state.historyFuture].slice(0, HISTORY_LIMIT),
		});
	},

	redo() {
		const state = get();
		const next = state.historyFuture[0];
		if (!next) {
			return;
		}

		const currentSnapshot = createSnapshot(state);
		set({
			nodes: structuredClone(next.nodes),
			edges: structuredClone(next.edges),
			selectedNodeId: next.selectedNodeId,
			nextId: next.nextId,
			historyPast: [...state.historyPast, currentSnapshot].slice(-HISTORY_LIMIT),
			historyFuture: state.historyFuture.slice(1),
		});
	},

	getCompileResult() {
		const state = get();
		return compileGraphToWpilib(state.nodes, state.edges);
	},

	resetGraph() {
		set(toInitialState());
	},
}));
