import type { Temporal as Spec } from 'temporal-spec';

/** The `Temporal` of this runtime, which Safari has yet to ship. */
export function temporalApi(): typeof Spec {
	if (typeof Temporal === 'undefined') {
		throw new Error('littlewing/temporal needs Temporal: load temporal-polyfill first');
	}
	return Temporal;
}
