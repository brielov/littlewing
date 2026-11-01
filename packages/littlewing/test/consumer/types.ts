// Compiled against the built package as a strict consumer would: no global
// Temporal, no skipLibCheck, isolatedModules on.
import {
	type ASTNode,
	defaultContext,
	evaluate,
	NodeKind,
	parse,
	type PlainDate,
	type RuntimeValue,
} from 'littlewing';

const value: RuntimeValue = evaluate('1', defaultContext);

// @ts-expect-error RuntimeValue must stay a precise union, not collapse to `any`
export const notAString: string = value;

export const isProgram = (node: ASTNode): boolean => node.kind === NodeKind.Program;

export const year = (date: PlainDate): number => date.year;

export const tree: ASTNode = parse('1');
