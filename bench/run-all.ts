import './codegen.bench'
import './integration.bench'
import './interpreter.bench'
import './jit.bench'
import './lexer.bench'
import './optimizer.bench'
import './parser.bench'

import { run } from 'mitata'

// Run with default terminal output format
// The transformation script parses this output and converts it to JSON
run()
