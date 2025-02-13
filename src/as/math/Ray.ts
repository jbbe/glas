import { Vector3 } from './Vector3'
import { Sphere } from './Sphere'
import { Plane } from './Plane'
import { Box3 } from './Box3'
import { Matrix4 } from './Matrix4'

const _vector = new Vector3()
const _segCenter = new Vector3()
const _segDir = new Vector3()
const _diff = new Vector3()

const _edge1 = new Vector3()
const _edge2 = new Vector3()
const _normal = new Vector3()

/**
 * @author bhouston / http://clara.io
 */
export class Ray {
	constructor(public origin: Vector3 = new Vector3(), public direction: Vector3 = new Vector3(0, 0, -1)) {}

	public set(origin: Vector3, direction: Vector3): Ray {
		this.origin.copy(origin)
		this.direction.copy(direction)
		return this
	}

	public clone(): Ray {
		return new Ray().copy(this)
	}

	public copy(ray: Ray): Ray {
		this.origin.copy(ray.origin)
		this.direction.copy(ray.direction)
		return this
	}

	public at(t: f32, target: Vector3): Vector3 {
		// previously it checked to make sure that `target: Vector3` is set.
		// We can assert that Vector3 is a reference with the signature at
		// compile time.

		return target.copy(this.direction).multiplyScalar(t).add(this.origin)
	}

	public lookAt(v: Vector3): Ray {
		this.direction.copy(v).sub(this.origin).normalize()
		return this
	}

	public recast(t: f32): Ray {
		this.origin.copy(this.at(t, _vector))
		return this
	}

	public closestPointToPoint(point: Vector3, target: Vector3): Vector3 {
		target.subVectors(point, this.origin)
		const directionDistance = target.dot(this.direction)
		if (directionDistance < 0) {
			return target.copy(this.origin)
		}
		return target.copy(this.direction).multiplyScalar(directionDistance).add(this.origin)
	}

	public distanceToPoint(point: Vector3): f32 {
		return Mathf.sqrt(this.distanceSqToPoint(point))
	}

	public distanceSqToPoint(point: Vector3): f32 {
		const directionDistance = _vector.subVectors(point, this.origin).dot(this.direction)

		// point behind the ray

		if (directionDistance < 0) {
			return this.origin.distanceToSquared(point)
		}

		_vector.copy(this.direction).multiplyScalar(directionDistance).add(this.origin)

		return _vector.distanceToSquared(point)
	}

	public distanceSqToSegment(
		v0: Vector3,
		v1: Vector3,
		optionalPointOnRay: Vector3 | null,
		optionalPointOnSegment: Vector3 | null
	): f32 {
		// from http://www.geometrictools.com/GTEngine/Include/Mathematics/GteDistRaySegment.h
		// It returns the min distance between the ray and the segment
		// defined by v0 and v1
		// It can also set two optional targets :
		// - The closest point on the ray
		// - The closest point on the segment

		_segCenter.copy(v0).add(v1).multiplyScalar(0.5)
		_segDir.copy(v1).sub(v0).normalize()
		_diff.copy(this.origin).sub(_segCenter)

		const segExtent = v0.distanceTo(v1) * 0.5
		const a01 = -this.direction.dot(_segDir)
		const b0 = _diff.dot(this.direction)
		const b1 = -_diff.dot(_segDir)
		const c = _diff.lengthSq()
		const det = abs<f32>(1 - a01 * a01)
		let s0: f32, s1: f32, sqrDist: f32, extDet: f32

		if (det > 0) {
			// The ray and segment are not parallel.

			s0 = a01 * b1 - b0
			s1 = a01 * b0 - b1
			extDet = segExtent * det

			if (s0 >= 0) {
				if (s1 >= -extDet) {
					if (s1 <= extDet) {
						// region 0
						// Minimum at interior points of ray and segment.

						const invDet = <f32>1 / det
						s0 *= invDet
						s1 *= invDet
						sqrDist = s0 * (s0 + a01 * s1 + 2 * b0) + s1 * (a01 * s0 + s1 + 2 * b1) + c
					} else {
						// region 1

						s1 = segExtent
						s0 = max<f32>(0, -(a01 * s1 + b0))
						sqrDist = -s0 * s0 + s1 * (s1 + 2 * b1) + c
					}
				} else {
					// region 5

					s1 = -segExtent
					s0 = max<f32>(0, -(a01 * s1 + b0))
					sqrDist = -s0 * s0 + s1 * (s1 + 2 * b1) + c
				}
			} else {
				if (s1 <= -extDet) {
					// region 4

					s0 = max<f32>(0, -(-a01 * segExtent + b0))
					s1 = s0 > 0 ? -segExtent : min<f32>(max<f32>(-segExtent, -b1), segExtent)
					sqrDist = -s0 * s0 + s1 * (s1 + 2 * b1) + c
				} else if (s1 <= extDet) {
					// region 3

					s0 = 0
					s1 = min<f32>(max<f32>(-segExtent, -b1), segExtent)
					sqrDist = s1 * (s1 + 2 * b1) + c
				} else {
					// region 2

					s0 = max<f32>(0, -(a01 * segExtent + b0))
					s1 = s0 > 0 ? segExtent : min<f32>(max<f32>(-segExtent, -b1), segExtent)
					sqrDist = -s0 * s0 + s1 * (s1 + 2 * b1) + c
				}
			}
		} else {
			// Ray and segment are parallel.

			s1 = a01 > 0 ? -segExtent : segExtent
			s0 = max<f32>(0, -(a01 * s1 + b0))
			sqrDist = -s0 * s0 + s1 * (s1 + 2 * b1) + c
		}

		if (optionalPointOnRay) {
			optionalPointOnRay.copy(this.direction).multiplyScalar(s0).add(this.origin)
		}

		if (optionalPointOnSegment) {
			optionalPointOnSegment.copy(_segDir).multiplyScalar(s1).add(_segCenter)
		}

		return sqrDist
	}

	public intersectSphere(sphere: Sphere, target: Vector3): Vector3 | null {
		_vector.subVectors(sphere.center, this.origin)
		const tca = _vector.dot(this.direction)
		const d2 = _vector.dot(_vector) - tca * tca
		const radius2 = sphere.radius * sphere.radius

		if (d2 > radius2) return null

		const thc = Mathf.sqrt(radius2 - d2)

		// t0 = first intersect point - entrance on front of sphere
		const t0 = tca - thc

		// t1 = second intersect point - exit point on back of sphere
		const t1 = tca + thc

		// test to see if both t0 and t1 are behind the ray - if so, return null
		if (t0 < 0 && t1 < 0) return null

		// test to see if t0 is behind the ray:
		// if it is, the ray is inside the sphere, so return the second exit point scaled by t1,
		// in order to always return an intersect point that is in front of the ray.

		// else t0 is in front of the ray, so return the first collision point scaled by t0
		return this.at(select<f32>(t1, t0, t0 < 0), target)
	}

	public intersectsSphere(sphere: Sphere): bool {
		return this.distanceSqToPoint(sphere.center) <= sphere.radius * sphere.radius
	}

	/**
	 * This method used to return null, but it never returns a negative number, so a
	 * result of -1 is equivalent to a null result.
	 */
	public distanceToPlane(plane: Plane): f32 {
		const denominator = plane.normal.dot(this.direction)

		if (denominator === 0) {
			// line is coplanar, return origin
			if (plane.distanceToPoint(this.origin) === 0) {
				return 0
			}

			// Null is preferable to undefined since undefined means.... it is undefined
			return -1
		}

		const t = -(this.origin.dot(plane.normal) + plane.constant) / denominator

		// Return if the ray never intersects the plane
		return t >= 0 ? t : -1
	}

	public intersectPlane(plane: Plane, target: Vector3): Vector3 | null {
		const t = this.distanceToPlane(plane)

		// this used to be a null check
		if (t === -1) {
			return null
		}

		return this.at(t, target)
	}

	public intersectsPlane(plane: Plane): bool {
		// check if the ray lies on the plane first

		const distToPoint = plane.distanceToPoint(this.origin)

		if (distToPoint === 0) {
			return true
		}

		const denominator = plane.normal.dot(this.direction)

		if (denominator * distToPoint < 0) {
			return true
		}

		// ray origin is behind the plane (and is pointing behind it)

		return false
	}

	public intersectsBox(box: Box3): bool {
		return this.intersectBox(box, _vector) != null
	}

	public intersectBox(box: Box3, target: Vector3): Vector3 | null {
		let tmin: f32, tmax: f32, tymin: f32, tymax: f32, tzmin: f32, tzmax: f32

		const invdirx = <f32>1 / this.direction.x,
			invdiry = <f32>1 / this.direction.y,
			invdirz = <f32>1 / this.direction.z

		const origin = this.origin

		if (invdirx >= 0) {
			tmin = (box.min.x - origin.x) * invdirx
			tmax = (box.max.x - origin.x) * invdirx
		} else {
			tmin = (box.max.x - origin.x) * invdirx
			tmax = (box.min.x - origin.x) * invdirx
		}

		if (invdiry >= 0) {
			tymin = (box.min.y - origin.y) * invdiry
			tymax = (box.max.y - origin.y) * invdiry
		} else {
			tymin = (box.max.y - origin.y) * invdiry
			tymax = (box.min.y - origin.y) * invdiry
		}

		if (tmin > tymax || tymin > tmax) return null

		// These lines also handle the case where tmin or tmax is NaN
		// (result of 0 * Infinity). x !== x returns true if x is NaN

		if (tymin > tmin || tmin !== tmin) tmin = tymin

		if (tymax < tmax || tmax !== tmax) tmax = tymax

		if (invdirz >= 0) {
			tzmin = (box.min.z - origin.z) * invdirz
			tzmax = (box.max.z - origin.z) * invdirz
		} else {
			tzmin = (box.max.z - origin.z) * invdirz
			tzmax = (box.min.z - origin.z) * invdirz
		}

		if (tmin > tzmax || tzmin > tmax) return null

		if (tzmin > tmin || tmin !== tmin) tmin = tzmin

		if (tzmax < tmax || tmax !== tmax) tmax = tzmax

		//return point closest to the ray (positive side)

		if (tmax < 0) return null

		return this.at(tmin >= 0 ? tmin : tmax, target)
	}

	public intersectTriangle(
		a: Vector3,
		b: Vector3,
		c: Vector3,
		backfaceCulling: bool,
		target: Vector3
	): Vector3 | null {
		// Compute the offset origin, edges, and normal.

		// from http://www.geometrictools.com/GTEngine/Include/Mathematics/GteIntrRay3Triangle3.h

		_edge1.subVectors(b, a)
		_edge2.subVectors(c, a)
		_normal.crossVectors(_edge1, _edge2)

		// Solve Q + t*D = b1*E1 + b2*E2 (Q = kDiff, D = ray direction,
		// E1 = kEdge1, E2 = kEdge2, N = Cross(E1,E2)) by
		//   |Dot(D,N)|*b1 = sign(Dot(D,N))*Dot(D,Cross(Q,E2))
		//   |Dot(D,N)|*b2 = sign(Dot(D,N))*Dot(D,Cross(E1,Q))
		//   |Dot(D,N)|*t = -sign(Dot(D,N))*Dot(Q,N)
		let DdN = this.direction.dot(_normal)
		let sign: f32

		if (DdN > 0) {
			if (backfaceCulling) return null
			sign = 1
		} else if (DdN < 0) {
			sign = -1
			DdN = -DdN
		} else {
			return null
		}

		_diff.subVectors(this.origin, a)
		const DdQxE2 = sign * this.direction.dot(_edge2.crossVectors(_diff, _edge2))

		// b1 < 0, no intersection
		if (DdQxE2 < 0) {
			return null
		}

		const DdE1xQ = sign * this.direction.dot(_edge1.cross(_diff))

		// b2 < 0, no intersection
		if (DdE1xQ < 0) {
			return null
		}

		// b1+b2 > 1, no intersection
		if (DdQxE2 + DdE1xQ > DdN) {
			return null
		}

		// Line intersects triangle, check if ray does.
		const QdN = -sign * _diff.dot(_normal)

		// t < 0, no intersection
		if (QdN < 0) {
			return null
		}

		// Ray intersects triangle.
		return this.at(QdN / DdN, target)
	}

	public applyMatrix4(matrix4: Matrix4): Ray {
		this.origin.applyMatrix4(matrix4)
		this.direction.transformDirection(matrix4)

		return this
	}

	// @operator("==")
	public equals(ray: Ray): bool {
		return ray.origin.equals(this.origin) && ray.direction.equals(this.direction)
	}
}
