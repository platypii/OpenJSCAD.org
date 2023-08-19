import type { Vec2 } from '../maths/vec2/type.d.ts'
import type { Vec3 } from '../maths/vec3/type.d.ts'

// export function connectedComponents(sides: [Vec2, Vec2][]): Vec2[][]
// export function connectedComponents(sides: [Vec3, Vec3][]): Vec3[][]

export function connectedComponents<Vec extends Vec2 | Vec3>(sides: [Vec, Vec][]): Vec[][]
