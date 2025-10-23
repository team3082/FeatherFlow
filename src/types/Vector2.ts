/* eslint-disable @typescript-eslint/no-namespace */

/**
 * Represent a 2D vector; oftentimes used for 2D point representation in space.
 * Contains useful methods for vector manipulation.
 */
export interface Vector2 {
	x: number;
	y: number;
}

/**
 * A collection of functions for working with 2D vectors.
 */
export namespace Vector2 {

	/**
	 * Linearly interpolates between two vectors.
	 * @param p1 The first vector.
	 * @param p2 The second vector.
	 * @param t The interpolation factor (0 <= t <= 1).
	 * @returns A new Vector2 representing the interpolated vector.
	 */
	export function lerp(p1: Vector2, p2: Vector2, t: number): Vector2 {
		return add(multiply(p1, 1 - t), multiply(p2, t));
	}

	/**
	 * Creates a deep copy of the vector.
	 * @param vector The vector to clone.
	 * @returns A new Vector2 with the same x and y values.
	 */
	export function clone(vector: Vector2): Vector2 {
		return { x: vector.x, y: vector.y };
	}

	/**
	 * Checks if two vectors are equal.
	 * @param v1 The first vector.
	 * @param v2 The second vector.
	 * @returns True if x and y match; false otherwise.
	 */
	export function equals(v1: Vector2, v2: Vector2): boolean {
		return v1.x === v2.x && v1.y === v2.y;
	}

	/**
	 * Converts the vector to a readable string format.
	 * @param vector The vector to convert.
	 * @returns A string in the form "(x, y)".
	 */
	export function toString(vector: Vector2): string {
		return `(${vector.x}, ${vector.y})`;
	}

	/**
	 * Adds two vectors.
	 * @param v1 The first vector.
	 * @param v2 The second vector.
	 * @returns A new Vector2 representing the sum.
	 */
	export function add(v1: Vector2, v2: Vector2): Vector2 {
		return { x: v1.x + v2.x, y: v1.y + v2.y };
	}

	/**
	 * Subtracts one vector from another.
	 * @param v1 The vector to subtract from.
	 * @param v2 The vector to subtract.
	 * @returns A new Vector2 representing the difference.
	 */
	export function subtract(v1: Vector2, v2: Vector2): Vector2 {
		return { x: v1.x - v2.x, y: v1.y - v2.y };
	}

	/**
	 * Multiplies a vector by a scalar.
	 * @param vector The vector to multiply.
	 * @param scalar The scalar to multiply by.
	 * @returns A new Vector2 representing the product.
	 */
	export function multiply(vector: Vector2, scalar: number): Vector2 {
		return { x: vector.x * scalar, y: vector.y * scalar };
	}

	/**
	 * Divides a vector by a scalar.
	 * @param vector The vector to divide.
	 * @param scalar The scalar to divide by.
	 * @returns A new Vector2 representing the quotient.
	 */
	export function divide(vector: Vector2, scalar: number): Vector2 {
		if (scalar === 0) {
			throw new Error("Cannot divide by zero");
		}
		return { x: vector.x / scalar, y: vector.y / scalar };
	}

	/**
	 * Calculates the magnitude of a vector.
	 * @param vector The vector to calculate the magnitude for.
	 * @returns The magnitude of the vector.
	 */
	export function magnitude(vector: Vector2): number {
		return Math.sqrt(vector.x * vector.x + vector.y * vector.y);
	}

	/**
	 * Normalizes a vector.
	 * @param vector The vector to normalize.
	 * @returns A new Vector2 representing the normalized vector.
	 */
	export function normalize(vector: Vector2): Vector2 {
		const mag = magnitude(vector);
		if (mag === 0) {
			return { x: 0, y: 0 };
		}

		return divide(vector, mag);
	}
}

