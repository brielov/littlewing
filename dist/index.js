var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: (newValue) => all[name] = () => newValue
    });
};

// src/types.ts
var TokenType;
((TokenType2) => {
  TokenType2["NUMBER"] = "NUMBER";
  TokenType2["IDENTIFIER"] = "IDENTIFIER";
  TokenType2["PLUS"] = "PLUS";
  TokenType2["MINUS"] = "MINUS";
  TokenType2["STAR"] = "STAR";
  TokenType2["SLASH"] = "SLASH";
  TokenType2["PERCENT"] = "PERCENT";
  TokenType2["CARET"] = "CARET";
  TokenType2["EXCLAMATION"] = "EXCLAMATION";
  TokenType2["DOUBLE_EQUALS"] = "DOUBLE_EQUALS";
  TokenType2["NOT_EQUALS"] = "NOT_EQUALS";
  TokenType2["LESS_THAN"] = "LESS_THAN";
  TokenType2["GREATER_THAN"] = "GREATER_THAN";
  TokenType2["LESS_EQUAL"] = "LESS_EQUAL";
  TokenType2["GREATER_EQUAL"] = "GREATER_EQUAL";
  TokenType2["LOGICAL_AND"] = "LOGICAL_AND";
  TokenType2["LOGICAL_OR"] = "LOGICAL_OR";
  TokenType2["LPAREN"] = "LPAREN";
  TokenType2["RPAREN"] = "RPAREN";
  TokenType2["EQUALS"] = "EQUALS";
  TokenType2["COMMA"] = "COMMA";
  TokenType2["QUESTION"] = "QUESTION";
  TokenType2["COLON"] = "COLON";
  TokenType2["EOF"] = "EOF";
})(TokenType ||= {});
function isNumberLiteral(node) {
  return node.type === "NumberLiteral";
}
function isIdentifier(node) {
  return node.type === "Identifier";
}
function isBinaryOp(node) {
  return node.type === "BinaryOp";
}
function isUnaryOp(node) {
  return node.type === "UnaryOp";
}
function isFunctionCall(node) {
  return node.type === "FunctionCall";
}
function isAssignment(node) {
  return node.type === "Assignment";
}
function isProgram(node) {
  return node.type === "Program";
}
function isConditionalExpression(node) {
  return node.type === "ConditionalExpression";
}

// src/visitor.ts
function visit(node, visitor) {
  return visitPartial(node, visitor, (node2) => {
    throw new Error(`No handler for node type: ${node2.type}`);
  });
}
function visitPartial(node, visitor, defaultHandler) {
  const recurse = (n) => visitPartial(n, visitor, defaultHandler);
  switch (node.type) {
    case "Program":
      return visitor.Program ? visitor.Program(node, recurse) : defaultHandler(node, recurse);
    case "NumberLiteral":
      return visitor.NumberLiteral ? visitor.NumberLiteral(node, recurse) : defaultHandler(node, recurse);
    case "Identifier":
      return visitor.Identifier ? visitor.Identifier(node, recurse) : defaultHandler(node, recurse);
    case "BinaryOp":
      return visitor.BinaryOp ? visitor.BinaryOp(node, recurse) : defaultHandler(node, recurse);
    case "UnaryOp":
      return visitor.UnaryOp ? visitor.UnaryOp(node, recurse) : defaultHandler(node, recurse);
    case "FunctionCall":
      return visitor.FunctionCall ? visitor.FunctionCall(node, recurse) : defaultHandler(node, recurse);
    case "Assignment":
      return visitor.Assignment ? visitor.Assignment(node, recurse) : defaultHandler(node, recurse);
    case "ConditionalExpression":
      return visitor.ConditionalExpression ? visitor.ConditionalExpression(node, recurse) : defaultHandler(node, recurse);
  }
}

// src/utils.ts
function evaluateBinaryOperation(operator, left, right) {
  switch (operator) {
    case "+":
      return left + right;
    case "-":
      return left - right;
    case "*":
      return left * right;
    case "/":
      if (right === 0) {
        throw new Error("Division by zero");
      }
      return left / right;
    case "%":
      if (right === 0) {
        throw new Error("Modulo by zero");
      }
      return left % right;
    case "^":
      return left ** right;
    case "==":
      return left === right ? 1 : 0;
    case "!=":
      return left !== right ? 1 : 0;
    case "<":
      return left < right ? 1 : 0;
    case ">":
      return left > right ? 1 : 0;
    case "<=":
      return left <= right ? 1 : 0;
    case ">=":
      return left >= right ? 1 : 0;
    case "&&":
      return left !== 0 && right !== 0 ? 1 : 0;
    case "||":
      return left !== 0 || right !== 0 ? 1 : 0;
    default:
      throw new Error(`Unknown operator: ${operator}`);
  }
}
function getOperatorPrecedence(operator) {
  switch (operator) {
    case "^":
      return 8;
    case "*":
    case "/":
    case "%":
      return 7;
    case "+":
    case "-":
      return 6;
    case "==":
    case "!=":
    case "<":
    case ">":
    case "<=":
    case ">=":
      return 5;
    case "&&":
      return 4;
    case "||":
      return 3;
    default:
      return 0;
  }
}
function collectAllIdentifiers(node) {
  const identifiers = new Set;
  visit(node, {
    Program: (n, recurse) => {
      for (const stmt of n.statements) {
        recurse(stmt);
      }
    },
    NumberLiteral: () => {},
    Identifier: (n) => {
      identifiers.add(n.name);
    },
    BinaryOp: (n, recurse) => {
      recurse(n.left);
      recurse(n.right);
    },
    UnaryOp: (n, recurse) => {
      recurse(n.argument);
    },
    FunctionCall: (n, recurse) => {
      for (const arg of n.arguments) {
        recurse(arg);
      }
    },
    Assignment: (n, recurse) => {
      recurse(n.value);
    },
    ConditionalExpression: (n, recurse) => {
      recurse(n.condition);
      recurse(n.consequent);
      recurse(n.alternate);
    }
  });
  return identifiers;
}
function getTokenPrecedence(type) {
  switch (type) {
    case "EQUALS" /* EQUALS */:
      return 1;
    case "QUESTION" /* QUESTION */:
      return 2;
    case "LOGICAL_OR" /* LOGICAL_OR */:
      return 3;
    case "LOGICAL_AND" /* LOGICAL_AND */:
      return 4;
    case "DOUBLE_EQUALS" /* DOUBLE_EQUALS */:
    case "NOT_EQUALS" /* NOT_EQUALS */:
    case "LESS_THAN" /* LESS_THAN */:
    case "GREATER_THAN" /* GREATER_THAN */:
    case "LESS_EQUAL" /* LESS_EQUAL */:
    case "GREATER_EQUAL" /* GREATER_EQUAL */:
      return 5;
    case "PLUS" /* PLUS */:
    case "MINUS" /* MINUS */:
      return 6;
    case "STAR" /* STAR */:
    case "SLASH" /* SLASH */:
    case "PERCENT" /* PERCENT */:
      return 7;
    case "CARET" /* CARET */:
      return 8;
    default:
      return 0;
  }
}

// src/analyzer.ts
function extractInputVariables(ast) {
  const inputVars = new Set;
  const statements = isProgram(ast) ? ast.statements : [ast];
  for (const statement of statements) {
    if (isAssignment(statement)) {
      if (!containsVariableReference(statement.value)) {
        inputVars.add(statement.name);
      }
    }
  }
  return Array.from(inputVars);
}
function containsVariableReference(node) {
  return collectAllIdentifiers(node).size > 0;
}
// src/ast.ts
var exports_ast = {};
__export(exports_ast, {
  unaryOp: () => unaryOp,
  subtract: () => subtract,
  program: () => program,
  number: () => number,
  notEquals: () => notEquals,
  negate: () => negate,
  multiply: () => multiply,
  modulo: () => modulo,
  logicalOr: () => logicalOr,
  logicalNot: () => logicalNot,
  logicalAnd: () => logicalAnd,
  lessThan: () => lessThan,
  lessEqual: () => lessEqual,
  identifier: () => identifier,
  greaterThan: () => greaterThan,
  greaterEqual: () => greaterEqual,
  functionCall: () => functionCall,
  exponentiate: () => exponentiate,
  equals: () => equals,
  divide: () => divide,
  conditional: () => conditional,
  binaryOp: () => binaryOp,
  assign: () => assign,
  add: () => add
});
function program(statements) {
  return {
    type: "Program",
    statements
  };
}
function number(value) {
  return {
    type: "NumberLiteral",
    value
  };
}
function identifier(name) {
  return {
    type: "Identifier",
    name
  };
}
function binaryOp(left, operator, right) {
  return {
    type: "BinaryOp",
    left,
    operator,
    right
  };
}
function unaryOp(operator, argument) {
  return {
    type: "UnaryOp",
    operator,
    argument
  };
}
function functionCall(name, args = []) {
  return {
    type: "FunctionCall",
    name,
    arguments: args
  };
}
function assign(name, value) {
  return {
    type: "Assignment",
    name,
    value
  };
}
function conditional(condition, consequent, alternate) {
  return {
    type: "ConditionalExpression",
    condition,
    consequent,
    alternate
  };
}
function add(left, right) {
  return binaryOp(left, "+", right);
}
function subtract(left, right) {
  return binaryOp(left, "-", right);
}
function multiply(left, right) {
  return binaryOp(left, "*", right);
}
function divide(left, right) {
  return binaryOp(left, "/", right);
}
function modulo(left, right) {
  return binaryOp(left, "%", right);
}
function exponentiate(left, right) {
  return binaryOp(left, "^", right);
}
function negate(argument) {
  return unaryOp("-", argument);
}
function logicalNot(argument) {
  return unaryOp("!", argument);
}
function equals(left, right) {
  return binaryOp(left, "==", right);
}
function notEquals(left, right) {
  return binaryOp(left, "!=", right);
}
function lessThan(left, right) {
  return binaryOp(left, "<", right);
}
function greaterThan(left, right) {
  return binaryOp(left, ">", right);
}
function lessEqual(left, right) {
  return binaryOp(left, "<=", right);
}
function greaterEqual(left, right) {
  return binaryOp(left, ">=", right);
}
function logicalAnd(left, right) {
  return binaryOp(left, "&&", right);
}
function logicalOr(left, right) {
  return binaryOp(left, "||", right);
}
// src/codegen.ts
class CodeGenerator {
  generate(node) {
    return visit(node, {
      Program: (n, recurse) => {
        return n.statements.map(recurse).join("; ");
      },
      NumberLiteral: (n) => {
        return String(n.value);
      },
      Identifier: (n) => {
        return n.name;
      },
      BinaryOp: (n, recurse) => {
        const left = recurse(n.left);
        const right = recurse(n.right);
        const leftNeedsParens = this.needsParensLeft(n.left, n.operator) || n.operator === "^" && isUnaryOp(n.left);
        const leftCode = leftNeedsParens ? `(${left})` : left;
        const rightNeedsParens = this.needsParensRight(n.right, n.operator);
        const rightCode = rightNeedsParens ? `(${right})` : right;
        return `${leftCode} ${n.operator} ${rightCode}`;
      },
      UnaryOp: (n, recurse) => {
        const arg = recurse(n.argument);
        const needsParens = isBinaryOp(n.argument) || isAssignment(n.argument);
        const argCode = needsParens ? `(${arg})` : arg;
        return `${n.operator}${argCode}`;
      },
      FunctionCall: (n, recurse) => {
        const args = n.arguments.map(recurse).join(", ");
        return `${n.name}(${args})`;
      },
      Assignment: (n, recurse) => {
        const value = recurse(n.value);
        return `${n.name} = ${value}`;
      },
      ConditionalExpression: (n, recurse) => {
        const condition = recurse(n.condition);
        const consequent = recurse(n.consequent);
        const alternate = recurse(n.alternate);
        const conditionNeedsParens = isAssignment(n.condition) || isBinaryOp(n.condition) && getOperatorPrecedence(n.condition.operator) <= 2;
        const conditionCode = conditionNeedsParens ? `(${condition})` : condition;
        return `${conditionCode} ? ${consequent} : ${alternate}`;
      }
    });
  }
  needsParensLeft(node, operator) {
    if (!isBinaryOp(node))
      return false;
    const nodePrecedence = getOperatorPrecedence(node.operator);
    const operatorPrecedence = getOperatorPrecedence(operator);
    if (operator === "^") {
      return nodePrecedence <= operatorPrecedence;
    }
    return nodePrecedence < operatorPrecedence;
  }
  needsParensRight(node, operator) {
    if (!isBinaryOp(node))
      return false;
    const nodePrecedence = getOperatorPrecedence(node.operator);
    const operatorPrecedence = getOperatorPrecedence(operator);
    if (operator === "^") {
      return nodePrecedence < operatorPrecedence;
    }
    return nodePrecedence <= operatorPrecedence;
  }
}
function generate(node) {
  const generator = new CodeGenerator;
  return generator.generate(node);
}
// src/date-utils.ts
var exports_date_utils = {};
__export(exports_date_utils, {
  START_OF_YEAR: () => START_OF_YEAR,
  START_OF_WEEK: () => START_OF_WEEK,
  START_OF_QUARTER: () => START_OF_QUARTER,
  START_OF_MONTH: () => START_OF_MONTH,
  START_OF_DAY: () => START_OF_DAY,
  NOW: () => NOW,
  IS_WEEKEND: () => IS_WEEKEND,
  IS_SAME_DAY: () => IS_SAME_DAY,
  IS_LEAP_YEAR: () => IS_LEAP_YEAR,
  GET_YEAR: () => GET_YEAR,
  GET_WEEKDAY: () => GET_WEEKDAY,
  GET_SECOND: () => GET_SECOND,
  GET_QUARTER: () => GET_QUARTER,
  GET_MONTH: () => GET_MONTH,
  GET_MINUTE: () => GET_MINUTE,
  GET_MILLISECOND: () => GET_MILLISECOND,
  GET_HOUR: () => GET_HOUR,
  GET_DAY_OF_YEAR: () => GET_DAY_OF_YEAR,
  GET_DAY: () => GET_DAY,
  FROM_YEARS: () => FROM_YEARS,
  FROM_WEEKS: () => FROM_WEEKS,
  FROM_MONTHS: () => FROM_MONTHS,
  FROM_DAYS: () => FROM_DAYS,
  END_OF_YEAR: () => END_OF_YEAR,
  END_OF_MONTH: () => END_OF_MONTH,
  END_OF_DAY: () => END_OF_DAY,
  DIFFERENCE_IN_YEARS: () => DIFFERENCE_IN_YEARS,
  DIFFERENCE_IN_WEEKS: () => DIFFERENCE_IN_WEEKS,
  DIFFERENCE_IN_SECONDS: () => DIFFERENCE_IN_SECONDS,
  DIFFERENCE_IN_MONTHS: () => DIFFERENCE_IN_MONTHS,
  DIFFERENCE_IN_MINUTES: () => DIFFERENCE_IN_MINUTES,
  DIFFERENCE_IN_HOURS: () => DIFFERENCE_IN_HOURS,
  DIFFERENCE_IN_DAYS: () => DIFFERENCE_IN_DAYS,
  DATE: () => DATE,
  ADD_YEARS: () => ADD_YEARS,
  ADD_MONTHS: () => ADD_MONTHS,
  ADD_DAYS: () => ADD_DAYS
});
var NOW = () => Date.now();
var DATE = (year, month = 1, day = 1, hour = 0, minute = 0, second = 0) => new Date(year, month - 1, day, hour, minute, second).getTime();
var FROM_DAYS = (d) => d * 24 * 60 * 60 * 1000;
var FROM_WEEKS = (w) => w * 7 * 24 * 60 * 60 * 1000;
var FROM_MONTHS = (months) => months * 30 * 24 * 60 * 60 * 1000;
var FROM_YEARS = (years) => years * 365 * 24 * 60 * 60 * 1000;
var GET_YEAR = (timestamp) => new Date(timestamp).getFullYear();
var GET_MONTH = (timestamp) => new Date(timestamp).getMonth() + 1;
var GET_DAY = (timestamp) => new Date(timestamp).getDate();
var GET_HOUR = (timestamp) => new Date(timestamp).getHours();
var GET_MINUTE = (timestamp) => new Date(timestamp).getMinutes();
var GET_SECOND = (timestamp) => new Date(timestamp).getSeconds();
var GET_MILLISECOND = (timestamp) => new Date(timestamp).getMilliseconds();
var GET_WEEKDAY = (timestamp) => new Date(timestamp).getDay();
var GET_DAY_OF_YEAR = (timestamp) => {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const startOfYear = new Date(year, 0, 1).getTime();
  const diff = timestamp - startOfYear;
  const oneDay = 86400000;
  return Math.floor(diff / oneDay) + 1;
};
var GET_QUARTER = (timestamp) => {
  const month = new Date(timestamp).getMonth();
  return Math.floor(month / 3) + 1;
};
var DIFFERENCE_IN_SECONDS = (ts1, ts2) => Math.ceil(Math.abs(ts1 - ts2) / 1000);
var DIFFERENCE_IN_MINUTES = (ts1, ts2) => Math.ceil(Math.abs(ts1 - ts2) / (60 * 1000));
var DIFFERENCE_IN_HOURS = (ts1, ts2) => Math.ceil(Math.abs(ts1 - ts2) / (60 * 60 * 1000));
var DIFFERENCE_IN_DAYS = (ts1, ts2) => {
  const day1 = START_OF_DAY(ts1);
  const day2 = START_OF_DAY(ts2);
  return Math.floor(Math.abs(day1 - day2) / (24 * 60 * 60 * 1000));
};
var DIFFERENCE_IN_WEEKS = (ts1, ts2) => {
  const days = DIFFERENCE_IN_DAYS(ts1, ts2);
  return Math.floor(days / 7);
};
var DIFFERENCE_IN_MONTHS = (ts1, ts2) => {
  const smaller = Math.min(ts1, ts2);
  const larger = Math.max(ts1, ts2);
  const date1 = new Date(smaller);
  const date2 = new Date(larger);
  const yearDiff = date2.getFullYear() - date1.getFullYear();
  const monthDiff = date2.getMonth() - date1.getMonth();
  let months = yearDiff * 12 + monthDiff;
  if (date2.getDate() < date1.getDate()) {
    months--;
  }
  return months;
};
var DIFFERENCE_IN_YEARS = (ts1, ts2) => {
  return Math.floor(DIFFERENCE_IN_MONTHS(ts1, ts2) / 12);
};
var START_OF_DAY = (timestamp) => {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0).getTime();
};
var END_OF_DAY = (timestamp) => {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999).getTime();
};
var START_OF_WEEK = (timestamp) => {
  const date = new Date(timestamp);
  const dayOfWeek = date.getDay();
  const currentDay = date.getDate();
  const startDay = currentDay - dayOfWeek;
  return new Date(date.getFullYear(), date.getMonth(), startDay, 0, 0, 0, 0).getTime();
};
var START_OF_MONTH = (timestamp) => {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0).getTime();
};
var END_OF_MONTH = (timestamp) => {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
};
var START_OF_YEAR = (timestamp) => {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), 0, 1, 0, 0, 0, 0).getTime();
};
var END_OF_YEAR = (timestamp) => {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999).getTime();
};
var ADD_DAYS = (timestamp, days) => {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds()).getTime();
};
var ADD_MONTHS = (timestamp, months) => {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth() + months, date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds()).getTime();
};
var ADD_YEARS = (timestamp, years) => {
  const date = new Date(timestamp);
  return new Date(date.getFullYear() + years, date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds()).getTime();
};
var IS_SAME_DAY = (ts1, ts2) => {
  const date1 = new Date(ts1);
  const date2 = new Date(ts2);
  return date1.getFullYear() === date2.getFullYear() && date1.getMonth() === date2.getMonth() && date1.getDate() === date2.getDate() ? 1 : 0;
};
var IS_WEEKEND = (timestamp) => {
  const day = new Date(timestamp).getDay();
  return day === 0 || day === 6 ? 1 : 0;
};
var IS_LEAP_YEAR = (timestamp) => {
  const year = new Date(timestamp).getFullYear();
  return year % 4 === 0 && year % 100 !== 0 || year % 400 === 0 ? 1 : 0;
};
var START_OF_QUARTER = (timestamp) => {
  const date = new Date(timestamp);
  const month = date.getMonth();
  const quarterStartMonth = Math.floor(month / 3) * 3;
  return new Date(date.getFullYear(), quarterStartMonth, 1, 0, 0, 0, 0).getTime();
};

// src/defaults.ts
var defaultContext = {
  functions: {
    ABS: Math.abs,
    CEIL: Math.ceil,
    FLOOR: Math.floor,
    ROUND: Math.round,
    SQRT: Math.sqrt,
    MIN: Math.min,
    MAX: Math.max,
    SIN: Math.sin,
    COS: Math.cos,
    TAN: Math.tan,
    LOG: Math.log,
    LOG10: Math.log10,
    EXP: Math.exp,
    CLAMP: (value, min, max) => {
      return value < min ? min : value > max ? max : value;
    },
    ...exports_date_utils
  }
};
// src/humanizer.ts
var DEFAULT_OPERATOR_PHRASES = {
  "+": "plus",
  "-": "minus",
  "*": "times",
  "/": "divided by",
  "%": "modulo",
  "^": "to the power of",
  "==": "equals",
  "!=": "is not equal to",
  "<": "is less than",
  ">": "is greater than",
  "<=": "is less than or equal to",
  ">=": "is greater than or equal to",
  "&&": "and",
  "||": "or"
};
var DEFAULT_FUNCTION_PHRASES = {
  ABS: "the absolute value of",
  CEIL: "the ceiling of",
  FLOOR: "the floor of",
  ROUND: "the rounded value of",
  SQRT: "the square root of",
  MIN: "the minimum of",
  MAX: "the maximum of",
  CLAMP: "clamped",
  SIN: "the sine of",
  COS: "the cosine of",
  TAN: "the tangent of",
  LOG: "the natural logarithm of",
  LOG10: "the base-10 logarithm of",
  EXP: "e raised to the power of",
  NOW: "the current time",
  DATE: "the date",
  GET_YEAR: "the year of",
  GET_MONTH: "the month of",
  GET_DAY: "the day of",
  GET_HOUR: "the hour of",
  GET_MINUTE: "the minute of",
  GET_SECOND: "the second of",
  START_OF_DAY: "the start of day for",
  END_OF_DAY: "the end of day for",
  START_OF_MONTH: "the start of month for",
  END_OF_MONTH: "the end of month for",
  ADD_DAYS: "add days to",
  ADD_MONTHS: "add months to",
  ADD_YEARS: "add years to",
  DIFFERENCE_IN_DAYS: "the difference in days between",
  DIFFERENCE_IN_HOURS: "the difference in hours between",
  DIFFERENCE_IN_MINUTES: "the difference in minutes between",
  IS_WEEKEND: "whether it is a weekend for",
  IS_LEAP_YEAR: "whether it is a leap year for"
};

class Humanizer {
  options;
  operatorPhrases;
  functionPhrases;
  constructor(options = {}) {
    this.options = options;
    this.operatorPhrases = {
      ...DEFAULT_OPERATOR_PHRASES,
      ...options.operatorPhrases
    };
    this.functionPhrases = {
      ...DEFAULT_FUNCTION_PHRASES,
      ...options.functionPhrases
    };
  }
  humanize(node) {
    return visit(node, {
      Program: (n, recurse) => {
        const statements = n.statements.map((stmt) => {
          const text = recurse(stmt);
          return text.charAt(0).toUpperCase() + text.slice(1);
        });
        return statements.join(". ");
      },
      NumberLiteral: (n) => {
        const text = String(n.value);
        return this.wrapHtml(text, "number");
      },
      Identifier: (n) => {
        return this.wrapHtml(n.name, "identifier");
      },
      BinaryOp: (n, recurse) => {
        const left = recurse(n.left);
        const right = recurse(n.right);
        const operator = this.operatorPhrases[n.operator];
        const operatorText = this.wrapHtml(operator, "operator");
        return `${left} ${operatorText} ${right}`;
      },
      UnaryOp: (n, recurse) => {
        const arg = recurse(n.argument);
        if (n.operator === "-") {
          const needsGrouping = !isNumberLiteral(n.argument) && !isIdentifier(n.argument);
          if (needsGrouping) {
            return `the negative of ${arg}`;
          }
          return `negative ${arg}`;
        }
        if (n.operator === "!") {
          return `not ${arg}`;
        }
        throw new Error(`Unknown unary operator: ${n.operator}`);
      },
      FunctionCall: (n, recurse) => {
        const funcName = this.wrapHtml(n.name, "function");
        const args = n.arguments.map(recurse);
        const phrase = this.functionPhrases[n.name];
        if (phrase) {
          if (args.length === 0) {
            return phrase;
          }
          if (args.length === 1) {
            return `${phrase} ${args[0]}`;
          }
          const lastArg2 = args[args.length - 1];
          const otherArgs2 = args.slice(0, -1).join(", ");
          return `${phrase} ${otherArgs2} and ${lastArg2}`;
        }
        if (args.length === 0) {
          return `the result of ${funcName}`;
        }
        if (args.length === 1) {
          return `the result of ${funcName} with ${args[0]}`;
        }
        const lastArg = args[args.length - 1];
        const otherArgs = args.slice(0, -1).join(", ");
        return `the result of ${funcName} with ${otherArgs} and ${lastArg}`;
      },
      Assignment: (n, recurse) => {
        const name = this.wrapHtml(n.name, "identifier");
        const value = recurse(n.value);
        return `set ${name} to ${value}`;
      },
      ConditionalExpression: (n, recurse) => {
        const condition = recurse(n.condition);
        const consequent = recurse(n.consequent);
        const alternate = recurse(n.alternate);
        return `if ${condition} then ${consequent}, otherwise ${alternate}`;
      }
    });
  }
  wrapHtml(text, type) {
    if (!this.options.html) {
      return text;
    }
    const className = this.options.htmlClasses?.[type];
    if (className) {
      return `<span class="${className}">${text}</span>`;
    }
    return `<span>${text}</span>`;
  }
}
function humanize(node, options) {
  const humanizer = new Humanizer(options);
  return humanizer.humanize(node);
}
// src/lexer.ts
class Lexer {
  source;
  position = 0;
  length;
  constructor(source) {
    this.source = source;
    this.length = source.length;
  }
  tokenize() {
    const tokens = [];
    while (true) {
      const token = this.nextToken();
      tokens.push(token);
      if (token.type === "EOF" /* EOF */) {
        break;
      }
    }
    return tokens;
  }
  nextToken() {
    this.skipWhitespaceAndComments();
    if (this.position >= this.length) {
      return { type: "EOF" /* EOF */, value: "", position: this.position };
    }
    const char = this.source[this.position];
    if (char === undefined) {
      return { type: "EOF" /* EOF */, value: "", position: this.position };
    }
    const start = this.position;
    if (this.isDigit(char)) {
      return this.readNumber();
    }
    if (char === ".") {
      const nextChar = this.source[this.position + 1];
      if (nextChar !== undefined && this.isDigit(nextChar)) {
        return this.readNumber();
      }
    }
    if (this.isLetter(char) || char === "_") {
      return this.readIdentifier();
    }
    switch (char) {
      case "+":
        this.position++;
        return { type: "PLUS" /* PLUS */, value: "+", position: start };
      case "-":
        this.position++;
        return { type: "MINUS" /* MINUS */, value: "-", position: start };
      case "*":
        this.position++;
        return { type: "STAR" /* STAR */, value: "*", position: start };
      case "/":
        this.position++;
        return { type: "SLASH" /* SLASH */, value: "/", position: start };
      case "%":
        this.position++;
        return { type: "PERCENT" /* PERCENT */, value: "%", position: start };
      case "^":
        this.position++;
        return { type: "CARET" /* CARET */, value: "^", position: start };
      case "(":
        this.position++;
        return { type: "LPAREN" /* LPAREN */, value: "(", position: start };
      case ")":
        this.position++;
        return { type: "RPAREN" /* RPAREN */, value: ")", position: start };
      case "=":
        if (this.source[this.position + 1] === "=") {
          this.position += 2;
          return { type: "DOUBLE_EQUALS" /* DOUBLE_EQUALS */, value: "==", position: start };
        }
        this.position++;
        return { type: "EQUALS" /* EQUALS */, value: "=", position: start };
      case "!":
        if (this.source[this.position + 1] === "=") {
          this.position += 2;
          return { type: "NOT_EQUALS" /* NOT_EQUALS */, value: "!=", position: start };
        }
        this.position++;
        return { type: "EXCLAMATION" /* EXCLAMATION */, value: "!", position: start };
      case "<":
        if (this.source[this.position + 1] === "=") {
          this.position += 2;
          return { type: "LESS_EQUAL" /* LESS_EQUAL */, value: "<=", position: start };
        }
        this.position++;
        return { type: "LESS_THAN" /* LESS_THAN */, value: "<", position: start };
      case ">":
        if (this.source[this.position + 1] === "=") {
          this.position += 2;
          return { type: "GREATER_EQUAL" /* GREATER_EQUAL */, value: ">=", position: start };
        }
        this.position++;
        return { type: "GREATER_THAN" /* GREATER_THAN */, value: ">", position: start };
      case "?":
        this.position++;
        return { type: "QUESTION" /* QUESTION */, value: "?", position: start };
      case ":":
        this.position++;
        return { type: "COLON" /* COLON */, value: ":", position: start };
      case ",":
        this.position++;
        return { type: "COMMA" /* COMMA */, value: ",", position: start };
      case ";":
        this.position++;
        return this.nextToken();
      case "&":
        if (this.source[this.position + 1] === "&") {
          this.position += 2;
          return { type: "LOGICAL_AND" /* LOGICAL_AND */, value: "&&", position: start };
        }
        throw new Error(`Unexpected character '${char}' at position ${start}`);
      case "|":
        if (this.source[this.position + 1] === "|") {
          this.position += 2;
          return { type: "LOGICAL_OR" /* LOGICAL_OR */, value: "||", position: start };
        }
        throw new Error(`Unexpected character '${char}' at position ${start}`);
      default:
        throw new Error(`Unexpected character '${char}' at position ${start}`);
    }
  }
  skipWhitespaceAndComments() {
    while (this.position < this.length) {
      const char = this.source[this.position];
      if (this.isWhitespace(char)) {
        this.position++;
        continue;
      }
      if (char === "/" && this.source[this.position + 1] === "/") {
        this.position += 2;
        while (this.position < this.length && this.source[this.position] !== `
`) {
          this.position++;
        }
        continue;
      }
      break;
    }
  }
  readNumber() {
    const start = this.position;
    let hasDecimal = false;
    let hasExponent = false;
    if (this.source[this.position] === ".") {
      hasDecimal = true;
      this.position++;
    }
    while (this.position < this.length) {
      const char = this.source[this.position];
      if (this.isDigit(char)) {
        this.position++;
      } else if (char === "." && !hasDecimal && !hasExponent) {
        hasDecimal = true;
        this.position++;
      } else if ((char === "e" || char === "E") && !hasExponent) {
        hasExponent = true;
        this.position++;
        const nextChar = this.source[this.position];
        if (nextChar === "+" || nextChar === "-") {
          this.position++;
        }
        const digitChar = this.source[this.position];
        if (digitChar === undefined || !this.isDigit(digitChar)) {
          throw new Error(`Invalid number: expected digit after exponent at position ${this.position}`);
        }
        while (this.position < this.length && this.isDigit(this.source[this.position])) {
          this.position++;
        }
        break;
      } else {
        break;
      }
    }
    const value = parseFloat(this.source.slice(start, this.position));
    return { type: "NUMBER" /* NUMBER */, value, position: start };
  }
  readIdentifier() {
    const start = this.position;
    while (this.position < this.length) {
      const char = this.source[this.position];
      if (this.isLetter(char) || this.isDigit(char) || char === "_") {
        this.position++;
      } else {
        break;
      }
    }
    const name = this.source.slice(start, this.position);
    return { type: "IDENTIFIER" /* IDENTIFIER */, value: name, position: start };
  }
  isDigit(char) {
    return char !== undefined && char >= "0" && char <= "9";
  }
  isLetter(char) {
    return char !== undefined && (char >= "a" && char <= "z" || char >= "A" && char <= "Z");
  }
  isWhitespace(char) {
    return char !== undefined && (char === " " || char === "\t" || char === `
` || char === "\r");
  }
}

// src/parser.ts
var BINARY_OPERATOR_TOKENS = new Set([
  "PLUS" /* PLUS */,
  "MINUS" /* MINUS */,
  "STAR" /* STAR */,
  "SLASH" /* SLASH */,
  "PERCENT" /* PERCENT */,
  "CARET" /* CARET */,
  "DOUBLE_EQUALS" /* DOUBLE_EQUALS */,
  "NOT_EQUALS" /* NOT_EQUALS */,
  "LESS_THAN" /* LESS_THAN */,
  "GREATER_THAN" /* GREATER_THAN */,
  "LESS_EQUAL" /* LESS_EQUAL */,
  "GREATER_EQUAL" /* GREATER_EQUAL */,
  "LOGICAL_AND" /* LOGICAL_AND */,
  "LOGICAL_OR" /* LOGICAL_OR */
]);

class Parser {
  lexer;
  currentToken;
  constructor(lexer) {
    this.lexer = lexer;
    this.currentToken = lexer.nextToken();
  }
  parse() {
    const statements = [];
    while (this.peek().type !== "EOF" /* EOF */) {
      statements.push(this.parseExpression(0));
    }
    if (statements.length === 0) {
      throw new Error("Empty program");
    }
    if (statements.length === 1) {
      const singleStatement = statements[0];
      if (singleStatement === undefined) {
        throw new Error("Unexpected empty statements array");
      }
      return singleStatement;
    }
    return program(statements);
  }
  parseExpression(minPrecedence) {
    let left = this.parsePrefix();
    while (true) {
      const token = this.peek();
      const precedence = getTokenPrecedence(token.type);
      if (precedence < minPrecedence) {
        break;
      }
      if (token.type === "EQUALS" /* EQUALS */) {
        if (left.type !== "Identifier") {
          throw new Error("Invalid assignment target");
        }
        const identName = left.name;
        this.advance();
        const value = this.parseExpression(precedence);
        left = assign(identName, value);
      } else if (token.type === "QUESTION" /* QUESTION */) {
        this.advance();
        const consequent = this.parseExpression(0);
        if (this.peek().type !== "COLON" /* COLON */) {
          throw new Error("Expected : in ternary expression");
        }
        this.advance();
        const alternate = this.parseExpression(precedence);
        left = conditional(left, consequent, alternate);
      } else if (this.isBinaryOperator(token.type)) {
        const operator = token.value;
        this.advance();
        const isRightAssociative = operator === "^";
        const right = this.parseExpression(isRightAssociative ? precedence : precedence + 1);
        left = binaryOp(left, operator, right);
      } else {
        break;
      }
    }
    return left;
  }
  parsePrefix() {
    const token = this.peek();
    if (token.type === "MINUS" /* MINUS */) {
      this.advance();
      const argument = this.parseExpression(this.getUnaryPrecedence());
      return unaryOp("-", argument);
    }
    if (token.type === "EXCLAMATION" /* EXCLAMATION */) {
      this.advance();
      const argument = this.parseExpression(this.getUnaryPrecedence());
      return unaryOp("!", argument);
    }
    if (token.type === "LPAREN" /* LPAREN */) {
      this.advance();
      const expr = this.parseExpression(0);
      if (this.peek().type !== "RPAREN" /* RPAREN */) {
        throw new Error("Expected closing parenthesis");
      }
      this.advance();
      return expr;
    }
    if (token.type === "NUMBER" /* NUMBER */) {
      this.advance();
      return number(token.value);
    }
    if (token.type === "IDENTIFIER" /* IDENTIFIER */) {
      const name = token.value;
      this.advance();
      if (this.peek().type === "LPAREN" /* LPAREN */) {
        this.advance();
        const args = this.parseFunctionArguments();
        if (this.peek().type !== "RPAREN" /* RPAREN */) {
          throw new Error("Expected closing parenthesis");
        }
        this.advance();
        return functionCall(name, args);
      }
      return identifier(name);
    }
    throw new Error(`Unexpected token: ${token.value}`);
  }
  parseFunctionArguments() {
    const args = [];
    if (this.peek().type === "RPAREN" /* RPAREN */) {
      return args;
    }
    args.push(this.parseExpression(0));
    while (this.peek().type === "COMMA" /* COMMA */) {
      this.advance();
      args.push(this.parseExpression(0));
    }
    return args;
  }
  getUnaryPrecedence() {
    return 7;
  }
  isBinaryOperator(type) {
    return BINARY_OPERATOR_TOKENS.has(type);
  }
  peek() {
    return this.currentToken;
  }
  advance() {
    this.currentToken = this.lexer.nextToken();
  }
}
function parse(source) {
  const lexer = new Lexer(source);
  const parser = new Parser(lexer);
  return parser.parse();
}

// src/interpreter.ts
class Interpreter {
  context;
  variables;
  externalVariables;
  constructor(context = {}) {
    this.context = context;
    this.variables = new Map(Object.entries(context.variables || {}));
    this.externalVariables = new Set(Object.keys(context.variables || {}));
  }
  evaluate(node) {
    return visit(node, {
      Program: (n, recurse) => {
        let result = 0;
        for (const statement of n.statements) {
          result = recurse(statement);
        }
        return result;
      },
      NumberLiteral: (n) => {
        return n.value;
      },
      Identifier: (n) => {
        const value = this.variables.get(n.name);
        if (value === undefined) {
          throw new Error(`Undefined variable: ${n.name}`);
        }
        return value;
      },
      BinaryOp: (n, recurse) => {
        const left = recurse(n.left);
        const right = recurse(n.right);
        return evaluateBinaryOperation(n.operator, left, right);
      },
      UnaryOp: (n, recurse) => {
        const arg = recurse(n.argument);
        if (n.operator === "-") {
          return -arg;
        }
        if (n.operator === "!") {
          return arg === 0 ? 1 : 0;
        }
        throw new Error(`Unknown unary operator: ${n.operator}`);
      },
      FunctionCall: (n, recurse) => {
        const fn = this.context.functions?.[n.name];
        if (fn === undefined) {
          throw new Error(`Undefined function: ${n.name}`);
        }
        if (typeof fn !== "function") {
          throw new Error(`${n.name} is not a function`);
        }
        const args = n.arguments.map(recurse);
        return fn(...args);
      },
      Assignment: (n, recurse) => {
        if (this.externalVariables.has(n.name)) {
          const externalValue = this.variables.get(n.name);
          if (externalValue !== undefined) {
            return externalValue;
          }
        }
        const value = recurse(n.value);
        this.variables.set(n.name, value);
        return value;
      },
      ConditionalExpression: (n, recurse) => {
        const condition = recurse(n.condition);
        return condition !== 0 ? recurse(n.consequent) : recurse(n.alternate);
      }
    });
  }
}
function evaluate(input, context) {
  const node = typeof input === "string" ? parse(input) : input;
  const interpreter = new Interpreter(context);
  return interpreter.evaluate(node);
}
// src/optimizer.ts
function eliminateDeadCode(program2) {
  const statements = program2.statements;
  const liveVars = new Set;
  const keptStatements = [];
  for (let i = statements.length - 1;i >= 0; i--) {
    const stmt = statements[i];
    if (!stmt)
      continue;
    if (i === statements.length - 1) {
      keptStatements.push(stmt);
      const identifiers = collectAllIdentifiers(stmt);
      for (const id of identifiers) {
        liveVars.add(id);
      }
      continue;
    }
    if (stmt.type === "Assignment") {
      if (liveVars.has(stmt.name)) {
        keptStatements.push(stmt);
        const identifiers = collectAllIdentifiers(stmt.value);
        for (const id of identifiers) {
          liveVars.add(id);
        }
      }
    } else {
      keptStatements.push(stmt);
      const identifiers = collectAllIdentifiers(stmt);
      for (const id of identifiers) {
        liveVars.add(id);
      }
    }
  }
  return program(keptStatements.reverse());
}
function optimize(node) {
  const folded = visit(node, {
    NumberLiteral: (n) => n,
    Identifier: (n) => n,
    BinaryOp: (n, recurse) => {
      const left = recurse(n.left);
      const right = recurse(n.right);
      if (isNumberLiteral(left) && isNumberLiteral(right)) {
        const result = evaluateBinaryOperation(n.operator, left.value, right.value);
        return number(result);
      }
      return binaryOp(left, n.operator, right);
    },
    UnaryOp: (n, recurse) => {
      const argument = recurse(n.argument);
      if (isNumberLiteral(argument)) {
        if (n.operator === "-") {
          return number(-argument.value);
        }
        if (n.operator === "!") {
          return number(argument.value === 0 ? 1 : 0);
        }
      }
      return unaryOp(n.operator, argument);
    },
    FunctionCall: (n, recurse) => {
      const optimizedArgs = n.arguments.map(recurse);
      return functionCall(n.name, optimizedArgs);
    },
    Assignment: (n, recurse) => {
      return assign(n.name, recurse(n.value));
    },
    ConditionalExpression: (n, recurse) => {
      const condition = recurse(n.condition);
      if (isNumberLiteral(condition)) {
        return condition.value !== 0 ? recurse(n.consequent) : recurse(n.alternate);
      }
      const consequent = recurse(n.consequent);
      const alternate = recurse(n.alternate);
      return conditional(condition, consequent, alternate);
    },
    Program: (n, recurse) => {
      const optimizedStatements = n.statements.map(recurse);
      return program(optimizedStatements);
    }
  });
  if (isProgram(folded) && folded.statements.length > 0) {
    return eliminateDeadCode(folded);
  }
  return folded;
}
export {
  visitPartial,
  visit,
  parse,
  optimize,
  isUnaryOp,
  isProgram,
  isNumberLiteral,
  isIdentifier,
  isFunctionCall,
  isConditionalExpression,
  isBinaryOp,
  isAssignment,
  humanize,
  generate,
  extractInputVariables,
  evaluate,
  defaultContext,
  exports_ast as ast,
  TokenType
};
