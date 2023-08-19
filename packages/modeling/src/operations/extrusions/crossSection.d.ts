import type { Geom2, Geom3 } from '../../geometries/types.d.ts'
import type { Plane } from '../../maths/plane/index.d.ts'
import type { RecursiveArray } from '../../utils/recursiveArray.d.ts'

export interface CrossSectionOptions {
  plane?: Plane
}

export function crossSection(options: CrossSectionOptions, geometry: Geom3): Geom2
export function crossSection(options: CrossSectionOptions, ...geometries: RecursiveArray<Geom3>): Array<Geom2>
export function crossSection(options: CrossSectionOptions, ...geometries: RecursiveArray<any>): Array<any>
