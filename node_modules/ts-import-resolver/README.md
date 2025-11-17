# ts-import-resolver

[![npm version](https://img.shields.io/npm/v/ts-import-resolver.svg?style=flat-square)](https://www.npmjs.com/package/ts-import-resolver)
[![npm downloads](https://img.shields.io/npm/dm/ts-import-resolver.svg?style=flat-square)](https://www.npmjs.com/package/ts-import-resolver)

Lightweight, fast utility that resolves TypeScript import paths to absolute file paths without TypeScript compiler.

## Installation

```bash
npm install ts-import-resolver
```
## Features

- Resolves TypeScript imports to their absolute file paths
- Supports path aliases, baseUrl, and other module resolution options defined in tsconfig.json
- Lightweight and efficient with zero dependencies
- Blazing fast resolution without TypeScript compiler overhead

## Usage

```typescript
import { resolveTsImportPath } from 'ts-import-resolver';
import fs from 'fs';
import path from 'path';

// Load your tsconfig.json
const tsconfig = JSON.parse(fs.readFileSync('./tsconfig.json', 'utf8'));
const cwd = path.resolve('.');

const absolutePath = resolveTsImportPath({
  path: '@/components/Button',  // The import path to resolve
  importer: '/path/to/your/file.ts',  // The file containing the import
  tsconfig,  // Your parsed tsconfig object
  cwd,  // Project root directory
});

if (absolutePath) {
  console.log(`Resolved to: ${absolutePath}`);
} else {
  console.log('Could not resolve the import');
}
```

## API Reference

### resolveTsImportPath(options)

Resolves a TypeScript import path to its absolute file path.

#### Options

```typescript
interface resolveTsImportPathOptions {
  /**
   * The import path to resolve (e.g., './utils', '@/components', etc.)
   */
  path: string;
  
  /**
   * The absolute path of the file containing the import
   */
  importer: string;
  
  /**
   * The parsed TypeScript configuration object if available
   */
  tsconfig: Record<string, unknown> | null | undefined;
  
  /**
   * The custom root of the project
   */
  cwd: string;
}
```

#### Returns

- `string | null` - The absolute path to the imported module if found, or `null` if it couldn't be resolved.

## License

MIT
