export { Vector2 } from './Vector2';
export { BezierCurve } from './BezierCurve';
export type { ControlPoint } from './ControlPoint';
export type { AnchorPoint } from './AnchorPoint';
export type { AutoRoutine } from './AutoRoutine';

// Reference points
const canvasRef1 = { x: 174.73, y: 587.47 };
const canvasRef2 = { x: 1139.20, y: 144.38};

const inchRef1 = { x: 0, y: 0 };
const inchRef2 = { x: 690.625, y: 317 };

// Compute scale and offset
const scaleX = (inchRef2.x - inchRef1.x) / (canvasRef2.x - canvasRef1.x);
const scaleY = (inchRef2.y - inchRef1.y) / (canvasRef2.y - canvasRef1.y);

const offsetX = inchRef1.x - canvasRef1.x * scaleX;
const offsetY = inchRef1.y - canvasRef1.y * scaleY;

// Function: Canvas -> Inch
export function canvasToInch(x: number, y: number): { x: number; y: number } {
    return {
        x: x * scaleX + offsetX,
        y: y * scaleY + offsetY
    };
}

// Function: Inch -> Canvas
export function inchToCanvas(x: number, y: number): { x: number; y: number } {
    return {
        x: (x - offsetX) / scaleX,
        y: (y - offsetY) / scaleY
    };
}