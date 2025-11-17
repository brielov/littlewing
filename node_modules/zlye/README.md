# zlye ✨

**The fastest, most type-safe CLI framework for Node.js**

## Performance

|   | CLI Framework | ops/sec    | Average Time (ns)     | Margin   | Samples  |
|---|---------------|------------|-----------------------|----------|----------|
| 0 | yargs         | 18,955     | 52,754.48             | ±1.09%   | 9,478    |
| 1 | commander     | 355,143    | 2,815.76              | ±1.06%   | 177,582  |
| 2 | cac           | 633,631    | 1,578.20              | ±0.70%   | 316,816  |
| 3 | zlye          | 1,403,217  | 712.65                | ±0.90%   | 701,609  |

**zlye** achieves over **1.4 million ops/sec** in benchmarks, more than 74× faster than yargs, 4× faster than commander, and 2× faster than cac.  

Run benchmarks yourself: `bun run bench`

## Why zlye?

- ✨ **Type-safe from input to output** - Full TypeScript support with inferred types  
- 🚀 **Blazing fast** - 74x faster than yargs, 4x faster than commander  
- 🎯 **Zod-like schema validation** - Familiar, powerful validation API  
- 🎨 **Beautiful help & errors** - Gorgeous, helpful CLI output with smart suggestions  
- 📦 **Zero dependencies** - Lightweight and reliable  
- 🔧 **Flexible** - Supports commands, flags, positionals, unions, and more  

## Getting Started

### Installation

```bash
npm install zlye
# or
yarn add zlye
# or
bun add zlye
```

### Your First CLI

```typescript
import { cli, z } from 'zlye'

const app = cli()
  .name('greet')
  .version('1.0.0')
  .description('A friendly greeting CLI')
  .option('name', z.string().default('World').describe('Name to greet'))
  .option('excited', z.boolean().describe('Add excitement!'))
  .parse()

if (app) {
  const greeting = `Hello, ${app.options.name}${app.options.excited ? '!!!' : '!'}`
  console.log(greeting)
}
```

```bash
$ greet --name Alice --excited
Hello, Alice!!!

$ greet --help

A friendly greeting CLI (1.0.0)

Usage: greet [...flags]

Flags:
      --name     <val>  Name to greet (default: "World")
      --excited         Add excitement!
  -h, --help            Display this menu and exit
```

## Schema Validation

zlye uses a Zod-like validation system that ensures your CLI inputs are always type-safe.

### String Validation

```typescript
cli()
  .option('name', z.string())
  .option('email', z.string().regex(/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/))
  .option('username', z.string().min(3).max(20))
  .option('role', z.string().choices(['admin', 'user', 'guest']))
```

### Number Validation

```typescript
cli()
  .option('port', z.number().min(1024).max(65535).default(3000))
  .option('threads', z.number().int().positive())
  .option('temperature', z.number().min(-273.15).describe('In Celsius'))
```

### Boolean Flags

```typescript
cli()
  .option('verbose', z.boolean().alias('v'))
  .option('quiet', z.boolean().alias('q'))
  .option('force', z.boolean().describe('Skip confirmations'))
```

### Arrays

```typescript
cli()
  .option('tags', z.array(z.string()).describe('Add multiple tags'))
  .option('ports', z.array(z.number().int()).min(1).max(10))
```

```bash
$ myapp --tags foo,bar,baz
$ myapp --ports 3000,3001,3002
```

### Default Values

Set default values for options with optional custom messages:

```typescript
cli()
  .option('port', z.number().default(3000))
  .option('config', z.string())
  .option('env', z.string().default(process.env.NODE_ENV, 'process.env.NODE_ENV by default'))
  .option('verbose', z.boolean().default(false))
```

When you provide a custom message as the second parameter to `.default()`, it will be shown in the help output instead of the raw default value. This is useful for providing more descriptive help text:

```bash
$ myapp --help

Flags:
      --port     <n>     Server port (default: 3000)  
      --config   <val>   Configuration file
      --env      <val>   Environment mode (process.env.NODE_ENV by default)
      --verbose          Enable verbose output (default: false)
```

### Objects

```typescript
// Structured objects with specific properties
cli()
  .option('config', z.object({
    host: z.string().default('localhost'),
    port: z.number().default(3000),
    secure: z.boolean().default(false)
  }))

// Dynamic objects with any keys
cli()
  .option('env', z.object(z.string()).describe('Environment variables'))
```

```bash
$ myapp --config.host api.example.com --config.port 443 --config.secure
$ myapp --env.NODE_ENV production --env.DEBUG true
```

### Unions

Combine multiple types for ultimate flexibility:

```typescript
cli()
  .option('input', z.union(
    z.boolean().describe('Enable input'),
    z.string().describe('File path'),
    z.object({
      file: z.string().describe('File path'),
      encoding: z.string().choices(['utf8', 'utf16', 'ascii']).default('utf8').describe('File encoding')
    })
  ))
```

```bash
$ myapp --input              # boolean: true
$ myapp --input file.txt     # string: "file.txt"
$ myapp --input.file data.json --input.encoding utf16  # object
```

## Commands

Build complex CLI applications with subcommands:

```typescript
import { cli, z } from 'zlye'

cli()
  .name('docker')
  .version('2.0.0')
  .command('build', {
    file: z.string().alias('f').default('Dockerfile'),
    tag: z.string().alias('t').describe('Image tag'),
    noCache: z.boolean().describe('Do not use cache')
  })
  .positional('context', z.string().describe('Build context directory'))
  .action(({ options, positionals }) => {
    console.log(`Building ${positionals[0]} with ${options.file}`)
    if (options.tag) console.log(`Tagging as ${options.tag}`)
  })
  
  .command('run', {
    port: z.array(z.string()).alias('p').describe('Port mapping'),
    volume: z.array(z.string()).alias('v').describe('Volume mounting'),
    detach: z.boolean().alias('d').describe('Run in background')
  })
  .positional('image', z.string())
  .rest('cmd', z.string())
  .action(({ options, positionals, rest }) => {
    console.log(`Running ${positionals[0]}`)
    if (rest.length) console.log(`Command: ${rest.join(' ')}`)
  })
  
  .parse()
```

## Beautiful Help Output

zlye automatically generates gorgeous help menus:

```bash
$ myapp --help

My awesome CLI tool (v2.1.0)

Usage: myapp <command> [...flags]

Commands:
  build    docker build .              Build a Docker image
  run      docker run ubuntu:latest    Run a container
  <command> --help                     Print help text for command.

Flags:
  -c, --config    <val>           Path to configuration file (default: "./config.json")
  -p, --port      <n>             Server port (min: 1024, max: 65535, default: 3000)
      --features  <val,...>       List of features to enable
      --mode      <dev|test|prod> Select mode
  -h, --help                      Display this menu and exit

Examples:
  myapp --verbose
  myapp build --output dist/
```

### Command-specific Help

```bash
$ myapp build --help

Usage: myapp build [...flags] <context>

  Build a Docker image

Arguments:
  <context>  Build context directory

Flags:
  -f, --file         <val>        Dockerfile path (default: "./Dockerfile")
  -t, --tag          <val>        Image tag
  -c, --cache        <val>        Cache directory (default: "./cache")
      --no-cache                  Do not use cache
      --env.<key>    <val>        Set environment variables
  -h, --help                      Display this menu and exit

Examples:
  myapp build .
  myapp build --tag myapp:latest .
  myapp build --file ./custom.Dockerfile --no-cache .
```

## Smart Error Messages

zlye provides incredibly helpful error messages with suggestions:

```bash
$ myapp --porrt 3000

Error: --porrt is not recognized

  Available options:
    --port
    --prod
    --profile

  Did you mean --port?
```

```bash
$ myapp --port abc

Error: --port expects a numeric value

  Received: --port "abc"
  Expected: --port 3000
```

```bash
$ myapp --mode development

Error: --mode must be one of: dev, test, prod

  Received: --mode development
  Expected: --mode dev

  Did you mean dev?
```

```bash
$ myapp -s

Error: -s is not recognized

  Available aliases:
    -v for --verbose
    -q for --quiet

Run with --help for usage information
```

## Options

zlye provides configuration options to customize parsing behavior:

### ignoreOptionDefaultValue

When set to `true`, default values defined with `.default()` will not be included in the parsed result. Only explicitly provided values will be returned. Default values will still be shown in the help output.

This is useful when you need to distinguish between user-provided values and defaults, for example when merging CLI arguments with configuration files or environment variables.

```typescript
import { cli, z } from 'zlye'

const app = cli()
  .option('port', z.number().default(3000))
  .option('host', z.string().default('localhost'))
  .with({ ignoreOptionDefaultValue: true })
  .parse()

// When parsing with no arguments
// app.options will be {} instead of { port: 3000, host: 'localhost' }

// When providing explicit values: --port 8080
// app.options will be { port: 8080 }
```

## Advanced Features

### Transform Values

Transform parsed values with full type safety:

```typescript
cli()
  .option('date', 
    z.string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .transform(str => new Date(str))
  )
  .option('json',
    z.string()
      .transform(str => JSON.parse(str))
  )
  .parse()
```

#### Custom Validation & Operations

Transform functions can perform any operation and throw descriptive errors:

```typescript
import { readFileSync } from 'fs'

cli()
  .option('config', z.string()
    .transform(path => {
      if (!readFileSync(path, 'utf8')) {
        throw new Error(`Config file not found: ${path}`)
      }
      return JSON.parse(readFileSync(path, 'utf8'))
    })
  )
  .parse()
```

### Negation Flags

Automatically handle `--no-` prefixes for boolean flags:

```typescript
cli()
  .option('color', z.boolean().default(true))
  .parse()
```

```bash
$ myapp             # color: true (default)
$ myapp --no-color  # color: false
```

### Positional Arguments

```typescript
cli()
  .positional('source', z.string().describe('Source file'))
  .positional('dest', z.string().describe('Destination'))
  .parse()
```

```bash
$ myapp input.txt output.txt
```

### Variadic Arguments

Collect remaining arguments:

```typescript
cli()
  .positional('script', z.string())
  .rest('args', z.string())
  .parse()
```

```bash
$ myapp build.js --watch --verbose
# script: "build.js"
# rest: ["--watch", "--verbose"]
```

`.rest()` is particularly useful when you need to accept multiple values that can appear anywhere in the command line (beginning, middle, end), unlike positional arguments which are order-dependent and limited in count.

```typescript
// Simple build tool example
const { rest: entries } = cli()
  .option('minify', z.boolean())
  .option('watch', z.boolean())
  .rest('entries', z.string())
  .parse()
```

```bash
$ build src/index.ts src/cli.ts --minify
# entries: ["src/index.ts", "src/cli.ts"]

$ build --minify --watch src/app.ts src/utils.ts  
# entries: ["src/app.ts", "src/utils.ts"]
```

### Custom Validation Messages

```typescript
cli()
  .option('age', 
    z.number()
      .min(18, 'Must be an adult')
      .max(120, 'Invalid age')
  )
  .option('password',
    z.string()
      .min(8, 'Password too short')
      .regex(/[A-Z]/, 'Must contain uppercase')
  )
```

---

<div align="center">
Built with ❤️ for the TypeScript community
</div>
