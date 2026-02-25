import { Temporal } from 'temporal-polyfill'

Object.defineProperty(globalThis, 'Temporal', {
	value: Temporal,
	writable: false,
	enumerable: false,
	configurable: true,
})
