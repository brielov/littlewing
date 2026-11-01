import { describe, expect, test } from 'bun:test';
import { Decimal, EvaluationError } from '../src/index.ts';
import { LimitExceededError, setBudget } from '../src/limits.ts';
import type { Num, RoundingMode } from '../src/number.ts';
import {
	add,
	compare,
	div,
	equals,
	fromDouble,
	isInteger,
	mod,
	mul,
	neg,
	parseNumber,
	pow,
	round,
	sub,
	toDouble,
	toFixed,
	toText,
} from '../src/number.ts';
import vectors from './fixtures/decimal.json';

const n = (text: string): Num => {
	const value = parseNumber(text);
	if (value === undefined) throw new Error(`not a number: ${text}`);
	return value;
};

/** A form that compares exactly: digits and exponent, with nothing stripped twice. */
function canon(value: Num): string {
	if (value === 0) return '0';
	if (typeof value === 'number') {
		const digits = String(Math.abs(value));
		const stripped = digits.replace(/0+$/, '');
		return `${value < 0 ? '-' : ''}${stripped}e${digits.length - stripped.length}`;
	}
	return `${value.c}e${value.e}`;
}

function outcome(run: () => Num): string {
	try {
		return canon(run());
	} catch (error) {
		if (error instanceof EvaluationError) return error.code;
		throw error;
	}
}

function codeOf(run: () => unknown): string {
	try {
		run();
	} catch (error) {
		if (error instanceof EvaluationError) return error.code;
		throw error;
	}
	return 'no failure';
}

const OPERATIONS = { '+': add, '-': sub, '*': mul, '/': div } as const;

describe('differential, against exact fractions', () => {
	test('arithmetic', () => {
		const failures: string[] = [];
		for (const [a, op, b, want] of vectors.arith as [
			string,
			keyof typeof OPERATIONS,
			string,
			string,
		][]) {
			const got = outcome(() => OPERATIONS[op](n(a), n(b)));
			if (got !== want) failures.push(`${a} ${op} ${b}: got ${got}, want ${want}`);
		}
		expect(failures.slice(0, 5)).toEqual([]);
	});

	test('modulo', () => {
		const failures: string[] = [];
		for (const [a, b, want] of vectors.mod as [string, string, string][]) {
			const got = outcome(() => mod(n(a), n(b)));
			if (got !== want) failures.push(`${a} % ${b}: got ${got}, want ${want}`);
		}
		expect(failures.slice(0, 5)).toEqual([]);
	});

	test('powers', () => {
		const failures: string[] = [];
		for (const [a, b, want] of vectors.pow as [string, string, string][]) {
			// Under a budget, so a loop that should end fails instead of hanging
			setBudget(1_000_000);
			try {
				const got = outcome(() => pow(n(a), n(b)));
				if (got !== want) failures.push(`${a} ^ ${b}: got ${got}, want ${want}`);
			} finally {
				setBudget(Number.POSITIVE_INFINITY);
			}
		}
		expect(failures.slice(0, 5)).toEqual([]);
	});

	test('reading and writing', () => {
		const failures: string[] = [];
		for (const [text, want] of vectors.text as [string, string][]) {
			const value = n(text);
			if (canon(value) !== want) failures.push(`${text}: got ${canon(value)}, want ${want}`);
			const again = parseNumber(toText(value));
			if (again === undefined || !equals(again, value)) failures.push(`${text} did not round trip`);
		}
		expect(failures.slice(0, 5)).toEqual([]);
	});

	test('rounding', () => {
		const failures: string[] = [];
		for (const [text, digits, mode, want, fixed] of vectors.round as [
			string,
			number,
			RoundingMode,
			string,
			string | null,
		][]) {
			const got = canon(round(n(text), digits, mode));
			if (got !== want) failures.push(`round ${text} ${digits} ${mode}: got ${got}, want ${want}`);
			if (fixed !== null) {
				const written = toFixed(n(text), digits, mode);
				if (written !== fixed)
					failures.push(`fixed ${text} ${digits} ${mode}: ${written}, ${fixed}`);
			}
		}
		expect(failures.slice(0, 5)).toEqual([]);
	});
});

describe('the examples of the spec', () => {
	test('section 4.1', () => {
		expect(toText(add(n('0.1'), n('0.2')))).toBe('0.3');
		expect(toText(mul(n('4.35'), 100))).toBe('435');
		expect(toText(div(10, 3))).toBe('3.333333333333333333333333333333333');
		expect(toText(mul(div(1, 3), 3))).toBe('0.9999999999999999999999999999999999');
		expect(toText(pow(2, n('0.5')))).toBe('1.414213562373095048801688724209698');
	});

	test('rounds once, at the bottom of the range', () => {
		// 1.4999...e-6176 goes to 1e-6176, not through 1.5e-6176 to 2e-6176
		const result = mul(n('5e-6176'), n('0.2999999999999999999999999999999999'));
		expect(canon(result)).toBe('1e-6176');
		expect(mul(n('1e-6176'), n('0.4'))).toBe(0);
		expect(canon(mul(n('1e-6176'), n('0.6')))).toBe('1e-6176');
	});

	test('a tie in a power rounds to even', () => {
		expect(toText(pow(n('6.2500000002500000000025'), n('1.5')))).toBe(
			'15.62500000093750000001875000000012',
		);
	});

	test('section 4.7', () => {
		expect(toText(n('1.50'))).toBe('1.5');
		expect(toText(n('0.0000001'))).toBe('0.0000001');
		expect(toText(n('1e33'))).toBe('1000000000000000000000000000000000');
		expect(toText(n('1e34'))).toBe('1e34');
		expect(toText(n('-1.5e-40'))).toBe('-1.5e-40');
		expect(toText(n('1e-34'))).toBe(`0.${'0'.repeat(33)}1`);
		expect(toText(n('1e-35'))).toBe('1e-35');
	});

	test('rounding modes', () => {
		const cases: [RoundingMode, number, number][] = [
			['half_away', 3, -3],
			['half_even', 2, -2],
			['floor', 2, -3],
			['ceil', 3, -2],
			['trunc', 2, -2],
		];
		for (const [mode, up, down] of cases) {
			expect(round(n('2.5'), 0, mode)).toBe(up);
			expect(round(n('-2.5'), 0, mode)).toBe(down);
		}
		expect(toText(round(n('1.005'), 2))).toBe('1.01');
		expect(round(1234, -2)).toBe(1200);
		expect(toFixed(n('1.1'), 2)).toBe('1.10');
		expect(toFixed(n('-2.5'), 0)).toBe('-3');
		expect(toFixed(n('-0.4'), 0)).toBe('0');
		expect(toFixed(0, 2)).toBe('0.00');
		expect(toFixed(n('1e40'), 1)).toBe(`1${'0'.repeat(40)}.0`);
	});

	test('remainders take the sign of the dividend', () => {
		expect(mod(-7, 3)).toBe(-1);
		expect(mod(7, -3)).toBe(1);
		expect(mod(n('1e35'), 3)).toBe(1);
		expect(mod(n('1.1'), n('0.1'))).toBe(0);
	});

	test('powers of nothing and of one', () => {
		expect(pow(0, 0)).toBe(1);
		expect(pow(n('2.5'), 0)).toBe(1);
		expect(pow(1, n('1e6000'))).toBe(1);
		expect(pow(0, 3)).toBe(0);
		expect(pow(-2, 3)).toBe(-8);
		expect(pow(-2, 2)).toBe(4);
		expect(codeOf(() => pow(0, -1))).toBe('invalid-power');
		expect(codeOf(() => pow(-8, n('0.5')))).toBe('invalid-power');
	});

	test('failures', () => {
		expect(codeOf(() => div(1, 0))).toBe('division-by-zero');
		expect(codeOf(() => mod(1, 0))).toBe('modulo-by-zero');
		const largest = n('9.999999999999999999999999999999999e6144');
		expect(codeOf(() => mul(largest, 10))).toBe('overflow');
		expect(codeOf(() => add(largest, n('1e6111')))).toBe('overflow');
		expect(codeOf(() => pow(10, 7000))).toBe('overflow');
		expect(codeOf(() => pow(n('1.000000000000000000000000000000001'), n('1e6000')))).toBe(
			'overflow',
		);
		expect(pow(n('0.999999999999999999999999999999999'), n('1e6000'))).toBe(0);
		expect(pow(10, -7000)).toBe(0);
	});
});

describe('metering', () => {
	/** The steps `run` spends. */
	function stepsOf(run: () => unknown): number {
		const budget = 1e12;
		setBudget(budget);
		try {
			run();
			const left = setBudget(Number.POSITIVE_INFINITY);
			return budget - left;
		} finally {
			setBudget(Number.POSITIVE_INFINITY);
		}
	}

	test('fixed text is paid for before it is built', () => {
		expect(stepsOf(() => toFixed(n('1.5'), 1000))).toBeGreaterThan(100);
		expect(stepsOf(() => toFixed(n('1e6144'), 0))).toBeGreaterThan(700);

		setBudget(1000);
		try {
			expect(() => toFixed(n('1.5'), 1e8)).toThrow(LimitExceededError);
			expect(() => toFixed(0, 1e8)).toThrow(LimitExceededError);
		} finally {
			setBudget(Number.POSITIVE_INFINITY);
		}
	});

	test('text past what an engine can hold is a limit, whatever the budget', () => {
		expect(codeOf(() => toFixed(n('1.5'), 2 ** 31))).toBe('limit-exceeded');
		expect(codeOf(() => toFixed(n('1.5'), 1e300))).toBe('limit-exceeded');
		const digits = 1e15;
		expect(codeOf(() => Decimal.from('1.5').toFixed(digits))).toBe('limit-exceeded');
	});

	test('work pays for itself', () => {
		expect(stepsOf(() => round(n('1.5')))).toBeGreaterThan(0);
		expect(stepsOf(() => pow(n('152415787532388345526596755677489'), n('11.5')))).toBeGreaterThan(
			40,
		);
		expect(stepsOf(() => pow(n('1.5'), n('2.5')))).toBeGreaterThan(256);
		expect(stepsOf(() => mod(n('1e6111'), n('3e-6176')))).toBeGreaterThan(1000);
	});

	test('integers cost nothing extra', () => {
		expect(stepsOf(() => add(3e12, 5e12))).toBe(0);
		expect(stepsOf(() => mul(3e12, 100))).toBe(0);
		expect(stepsOf(() => div(19000000001, 100))).toBe(0);
	});
});

describe('representation', () => {
	test('a safe integer is a JS number, and nothing else is', () => {
		expect(typeof add(n('1.5'), n('1.5'))).toBe('number');
		expect(typeof mul(n('2.5'), 2)).toBe('number');
		expect(typeof div(10, 4)).toBe('object');
		expect(n('1.50')).toEqual(n('15e-1'));
		expect(typeof add(Number.MAX_SAFE_INTEGER, 2)).toBe('object');
		expect(toText(add(Number.MAX_SAFE_INTEGER, 2))).toBe('9007199254740993');
		expect(mul(0, -5)).toBe(0);
		expect(Object.is(neg(0), 0)).toBe(true);
	});

	test('literals outside the value set are refused', () => {
		expect(parseNumber('1234567890123456789012345678901234')).toBeDefined();
		expect(parseNumber('12345678901234567890123456789012345')).toBeUndefined();
		expect(parseNumber('1.500000000000000000000000000000000000000')).toEqual(n('1.5'));
		expect(parseNumber('1e6145')).toBeUndefined();
		expect(parseNumber('1e-6177')).toBeUndefined();
		expect(parseNumber('0e999999')).toBe(0);
		expect(parseNumber('')).toBeUndefined();
		expect(parseNumber('.')).toBeUndefined();
		expect(parseNumber('e5')).toBeUndefined();
	});

	test('compare and equals agree across representations', () => {
		const values = ['-1e40', '-1.5', '-1', '0', '0.5', '1', '1.5', '9007199254740993', '1e40'].map(
			n,
		);
		for (const [i, a] of values.entries()) {
			for (const [j, b] of values.entries()) {
				expect(compare(a, b)).toBe(i < j ? -1 : i > j ? 1 : 0);
				expect(equals(a, b)).toBe(i === j);
			}
		}
	});

	test('integers', () => {
		expect(isInteger(n('1e40'))).toBe(true);
		expect(isInteger(n('1.5'))).toBe(false);
		expect(isInteger(n('15e-1'))).toBe(false);
	});

	test('doubles', () => {
		expect(fromDouble(0.1)).toEqual(n('0.1'));
		expect(fromDouble(1e21)).toEqual(n('1e21'));
		expect(Object.is(fromDouble(-0), 0)).toBe(true);
		expect(toDouble(n('0.1'))).toBe(0.1);
		expect(Object.is(toDouble(n('-1e-400')), 0)).toBe(true);
		expect(codeOf(() => toDouble(n('1e400')))).toBe('overflow');
	});
});

describe('Decimal', () => {
	test('wraps the language', () => {
		const third = Decimal.from(1).div(3);
		expect(third.times(3).toString()).toBe('0.9999999999999999999999999999999999');
		expect(Decimal.from('19.99').times(3).toString()).toBe('59.97');
		expect(Decimal.from(0.1).plus('0.2').equals('0.3')).toBe(true);
		expect(Decimal.from('2.5').round().toString()).toBe('3');
		expect(Decimal.from('2.5').round(0, 'half_even').toString()).toBe('2');
		expect(Decimal.from('1.1').toFixed(2)).toBe('1.10');
		expect(Decimal.from('  12.5\n').toNumber()).toBe(12.5);
		expect(Decimal.from('+5').toNumber()).toBe(5);
		expect(Decimal.from('\u00855 ').toNumber()).toBe(5);
		expect(Decimal.from(5).compare('5.0')).toBe(0);
		expect(Decimal.from(2).pow(10).neg().mod(7).toString()).toBe('-2');
		expect(Decimal.from('1e34').isInteger()).toBe(true);
	});

	test('JSON and templates give the text form', () => {
		expect(JSON.stringify({ a: Decimal.from('1.10') })).toBe('{"a":"1.1"}');
		// oxlint-disable-next-line typescript/restrict-template-expressions
		expect(`${Decimal.from('2.50')}`).toBe('2.5');
	});

	test('JavaScript operators fail rather than go wrong', () => {
		const ten = Decimal.from(10);
		const nine = Decimal.from(9);
		expect(() => (ten as unknown as number) > (nine as unknown as number)).toThrow(TypeError);
		expect(() => (ten as unknown as number) * 2).toThrow(TypeError);
		expect(() => (ten as unknown as number) + 2).toThrow(TypeError);
	});

	test('rejects what is not a number', () => {
		for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, 'x', '', '1_000', '1e6145']) {
			expect(codeOf(() => Decimal.from(bad))).toBe('invalid-argument');
		}
		expect(codeOf(() => Decimal.from(null as unknown as number))).toBe('invalid-argument');
		expect(codeOf(() => Decimal.from(1).round(1.5))).toBe('invalid-argument');
		expect(codeOf(() => Decimal.from(1).toFixed(-1))).toBe('invalid-argument');
		expect(codeOf(() => Decimal.from(1).round(0, 'nearest' as RoundingMode))).toBe(
			'invalid-argument',
		);
		expect(codeOf(() => Decimal.from(1).div(0))).toBe('division-by-zero');
	});

	test('a fake is recognized by its missing brand', () => {
		const fake = Object.create(Decimal.prototype) as Decimal;
		expect(codeOf(() => Decimal.from(fake))).toBe('invalid-argument');
		const derived = Object.create(Object.create(Decimal.prototype) as object) as Decimal;
		expect(codeOf(() => Decimal.from(derived))).toBe('invalid-argument');
	});

	test('cannot be constructed around the checks', () => {
		const Raw = Decimal as unknown as new (value: unknown) => Decimal;
		expect(() => new Raw(0.5)).toThrow(TypeError);
		expect(() => new Raw(Number.NaN)).toThrow(TypeError);
	});

	test('is immutable', () => {
		const a = Decimal.from(1);
		a.plus(2);
		expect(a.toString()).toBe('1');
	});
});
