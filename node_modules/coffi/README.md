# coffi

[![npm version](https://img.shields.io/npm/v/coffi.svg?style=flat-square)](https://www.npmjs.com/package/coffi)
[![npm downloads](https://img.shields.io/npm/dm/coffi.svg?style=flat-square)](https://www.npmjs.com/package/coffi)

⚡️ A fast, lightweight, easy-to-use, configuration files loader 📄

## Installation

```bash
npm install coffi
```

## Usage

### Basic Usage

```typescript
import { loadConfig } from "coffi";

// Loads config from the first matching file extension (see priority list below)
const { config, filepath } = await loadConfig("app.config");

// Or specify custom extensions to search for (in priority order)
const { config } = await loadConfig("tsconfig", [".json"]);
```

### File Priority

The loader checks files in this order:

1. `.ts` files
2. `.mts` files
3. `.cts` files
4. `.js` files
5. `.mjs` files
6. `.cjs` files
7. `.json` files

You can customize this order using the `extensions` option.

### Options

```typescript
import { loadConfig } from "coffi";
import path from "node:path";

const { config } = await loadConfig({
  name: "database.config",
  extensions: [".js", ".json", ".ts"],
  cwd: path.join(__dirname, "config"),
  maxDepth: 1, // (set to 1 to search only in current directory)
  preferredPath: "path/to/config.js", // Skip search and load from this path
  packageJsonProperty: "myConfig", // Load configuration from package.json
});
```

The `preferredPath` option allows you to specify an exact file path to load, bypassing the normal file search process. When provided, coffi will directly load the configuration from this path.

The `packageJsonProperty` option allows you to load configuration directly from a property in your project's package.json file. When specified, coffi will look for a property with this name in the nearest package.json file, and if found, will use its value as the configuration. This takes precedence over all other configuration sources, making it convenient for projects where you prefer to keep configuration in package.json.
