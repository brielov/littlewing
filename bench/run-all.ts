import './codegen.bench'
import './integration.bench'
import './interpreter.bench'
import './lexer.bench'
import './optimizer.bench'
import './parser.bench'

import { run } from 'mitata'

await run({ format: 'json' })
