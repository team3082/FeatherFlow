export interface Field {
    imagePath: string;
    width: number;
    height: number;
    canvasRef1: { x: number; y: number };
    canvasRef2: { x: number; y: number };
    inchRef1: { x: number; y: number };
    inchRef2: { x: number; y: number };
}

export const REEFSCAPE_FIELD: Field = {
    imagePath: '/reefscape_field.png',
    width: 1314,
    height: 732,
    canvasRef1: { x: 174.73, y: 587.47 },
    canvasRef2: { x: 1139.20, y: 144.38},
    inchRef1: { x: 0, y: 0 },
    inchRef2: { x: 690.625, y: 317 }
};

export const REBUILT_FIELD: Field = {
    imagePath: '/rebuilt_field.png',
    width: 4131/3,
    height: 1671/3,
    canvasRef1: { x: 185.021, y: 524.081 },
    canvasRef2: { x: 1191.912, y: 32.632},
    inchRef1: { x: 0, y: 0 },
    inchRef2: { x: 651.22, y: 317.69 }
};

export const colorMap: Record<string, { bg: string; border: string; dot: string; color: string }> = {
    purple: { bg: 'bg-purple-900', border: 'border-purple-400', dot: 'bg-purple-500', color: 'text-purple-400 hover:text-purple-300' },
    red: { bg: 'bg-red-900', border: 'border-red-400', dot: 'bg-red-500', color: 'text-red-400 hover:text-red-300' },
    green: { bg: 'bg-green-800', border: 'border-green-600', dot: 'bg-green-600', color: 'text-green-400 hover:text-green-300' },
    blue: { bg: 'bg-blue-900', border: 'border-blue-600', dot: 'bg-blue-600', color: 'text-blue-600 hover:text-blue-500' }
};

export const FIELD_CONFIG: Field = REBUILT_FIELD;

const scaleX = (FIELD_CONFIG.inchRef2.x - FIELD_CONFIG.inchRef1.x) / (FIELD_CONFIG.canvasRef2.x - FIELD_CONFIG.canvasRef1.x);
const scaleY = (FIELD_CONFIG.inchRef2.y - FIELD_CONFIG.inchRef1.y) / (FIELD_CONFIG.canvasRef2.y - FIELD_CONFIG.canvasRef1.y);

const offsetX = FIELD_CONFIG.inchRef1.x - FIELD_CONFIG.canvasRef1.x * scaleX;
const offsetY = FIELD_CONFIG.inchRef1.y - FIELD_CONFIG.canvasRef1.y * scaleY;

export function canvasToInch(x: number, y: number): { x: number; y: number } {
    return {
        x: x * scaleX + offsetX,
        y: y * scaleY + offsetY
    };
}

export function inchToCanvas(x: number, y: number): { x: number; y: number } {
    return {
        x: (x - offsetX) / scaleX,
        y: (y - offsetY) / scaleY
    };
}