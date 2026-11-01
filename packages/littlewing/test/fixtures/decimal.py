"""Generate decimal.json, the differential test data for src/number.ts.

Run with `python3 -I test/fixtures/decimal.py` from packages/littlewing. Results
come from exact fractions and Python's correctly rounded division, ln and exp, so
they are independent of the code under test.
"""
import json, random, sys
from decimal import Decimal as D, Context, ROUND_HALF_EVEN, Overflow, Inexact, Rounded, Subnormal, Underflow, Clamped, localcontext
from fractions import Fraction as F

sys.set_int_max_str_digits(0)
rnd = random.Random(20261101)
C = Context(prec=34, Emax=6144, Emin=-6143, rounding=ROUND_HALF_EVEN, traps=[Overflow])
WIDE = Context(prec=240, Emax=999999, Emin=-999999, rounding=ROUND_HALF_EVEN, traps=[])

def canon(d):
    if d == 0: return "0"
    sign, digits, exp = d.as_tuple()
    s = "".join(map(str, digits)).rstrip("0")
    exp += len(digits) - len(s)
    return ("-" if sign else "") + s + "e" + str(exp)

def rational(fr):
    """Round an exact fraction, as language section 4.1 says."""
    try:
        return canon(C.divide(D(fr.numerator), D(fr.denominator)))
    except Overflow:
        return "overflow"

def text(fr_or_d):
    return canon(fr_or_d)

def literal():
    k = rnd.random()
    if k < .18: return str(rnd.randint(-10**6, 10**6))
    if k < .36: return f"{rnd.randint(-10**7, 10**7) / 100:.2f}"
    if k < .50: return f"{rnd.randint(-10**16, 10**16)}.{rnd.randint(0, 10**6):06d}"
    if k < .64: return str(D(rnd.randint(-10**15, 10**15)).scaleb(-rnd.randint(0, 12)))
    if k < .78:
        c = rnd.randint(1, 10**34 - 1) * rnd.choice([1, -1])
        return str(D(c).scaleb(rnd.randint(-40, 10)))
    if k < .86:
        c = rnd.randint(1, 10**rnd.randint(1, 34) - 1) * rnd.choice([1, -1])
        return f"{c}e{rnd.randint(-6176, 6111)}"
    if k < .93:
        c = rnd.randint(1, 10**rnd.randint(1, 34) - 1) * rnd.choice([1, -1])
        return f"{c}e{rnd.randint(-6176, -6120)}"
    c = rnd.randint(1, 10**34 - 1) * rnd.choice([1, -1])
    return f"{c}e{rnd.randint(6080, 6111)}"

def valid(s):
    d = D(s)
    return len(d.normalize(WIDE).as_tuple().digits) <= 34 and d.normalize(WIDE).adjusted() <= 6144 and d.normalize(WIDE).as_tuple().exponent >= -6176 or d == 0

out = {"arith": [], "mod": [], "pow": [], "text": [], "round": []}
while len(out["arith"]) < 4000:
    a, b, op = literal(), literal(), rnd.choice("+-*/")
    if not (valid(a) and valid(b)) or (op == "/" and D(b) == 0): continue
    x, y = F(D(a)), F(D(b))
    if abs(D(a).adjusted() - D(b).adjusted()) > 3000 and op in "+-": continue
    r = {"+": x + y, "-": x - y, "*": x * y, "/": x / y if y else None}[op]
    out["arith"].append([a, op, b, rational(r)])

# A quotient just above or below a tie: nothing random lands here, and only the
# digits past the 35th say which way it rounds
M = 2 * 10**34
made = 0
while made < 120:
    d = rnd.randint(10**32, 10**34 - 1) | 1
    if d % 5 == 0: continue
    W = pow(d, -1, M)
    for w, sign in ((W, -1), (M - W, 1)):
        if w < 2 * 10**33: continue
        a = (w * d + sign) // M
        if a == 0 or (w * d + sign) % M != 0 or len(str(a)) > 34: continue
        shift = rnd.randint(-20, 20)
        A, B = f"{a}e{shift}", f"{d}e0"
        out["arith"].append([A, "/", B, rational(F(D(A)) / F(D(B)))])
        made += 1

while len(out["mod"]) < 800:
    a, b = literal(), literal()
    if not (valid(a) and valid(b)) or D(b) == 0: continue
    if abs(D(a).adjusted() - D(b).adjusted()) > 500: continue
    x, y = F(D(a)), F(D(b))
    q = abs(x / y).__floor__()
    r = x - y * (q if (x / y) >= 0 else -q)
    out["mod"].append([a, b, rational(r)])

def power(a, b):
    with localcontext(WIDE):
        return (D(a).ln() * D(b)).exp()

def wide_result(value):
    """Round a value computed at 240 digits, past which no tie is possible here."""
    if value.is_infinite(): return "overflow"
    try:
        return canon(C.plus(value))
    except Overflow:
        return "overflow"

POWERS = [("1.05", "2"), ("2", "0.5"), ("1.1", "0.5"), ("1.000000000000000000000000000000001", "1000000"), ("1.004166666666666666666666666666667", "360"), ("2", "1000"), ("2", "-1000"), ("0.5", "1000"), ("3", "0.3333333333333333333333333333333333"), ("1000", "0.3333333333333333333333333333333333"), ("9.999999999999999999999999999999999", "9.999999999999999999999999999999999"), ("7", "1.5"), ("1.5", "7.5"), ("1e-3", "1.5"), ("0.9", "100.5"), ("10", "0.5"), ("100", "0.25"), ("1.01", "1000.5"), ("0.99", "-1000.5")]
for a, b in POWERS:
    out["pow"].append([a, b, rational(F(power(a, b)))])
while len(out["pow"]) < 500:
    k = rnd.random()
    if k < .4:
        a = str(D(rnd.randint(1, 10**rnd.randint(1, 6))).scaleb(-rnd.randint(0, 4))); b = str(D(rnd.randint(-10**4, 10**4)).scaleb(-rnd.randint(0, 3)))
    elif k < .7:
        a = str(D(1) + D(rnd.randint(1, 10**8)).scaleb(-rnd.randint(9, 33))); b = str(D(rnd.randint(1, 10**6)).scaleb(rnd.randint(0, 6)))
    else:
        a = literal().lstrip("-"); b = str(D(rnd.randint(-10**6, 10**6)).scaleb(-rnd.randint(0, 6)))
    if not valid(a) or D(a) == 0 or D(a) == 1 or D(b) == 0: continue
    if abs(float(D(b)) * float(D(a).ln(WIDE))) > 1e6: continue
    # Exact cases are covered separately: exact integer powers by fractions below
    if D(b) == D(b).to_integral_value() and abs(D(b)) * len(D(a).normalize(WIDE).as_tuple().digits) <= 300:
        out["pow"].append([a, b, rational(F(D(a)) ** int(D(b)))])
    else:
        with localcontext(WIDE):
            value = power(a, b)
        try:
            out["pow"].append([a, b, canon(C.plus(value))])
        except Overflow:
            out["pow"].append([a, b, "overflow"])
for a, b, r in [("1.00000000000000005", "2", None), ("6.2500000002500000000025", "1.5", "15.625000000937500000018750000000125"), ("6.25", "1.5", "15.625"), ("4", "0.5", "2"), ("1e6000", "0.5", "1e3000"), ("1e6000", "2", None), ("1e-5000", "2", None), ("0.25", "-0.5", "2"), ("100", "1.5", "1000"), ("1024", "0.1", "2"), ("8", "0.3333333333333333333333333333333333", None)]:
    if r is None and D(b) == D(b).to_integral_value():
        out["pow"].append([a, b, rational(F(D(a)) ** int(D(b)))])
    elif r is None:
        continue
    else:
        out["pow"].append([a, b, rational(F(D(r)))])

# Results that need every part of the power code to be right
NAMED = [
    ("1.000000000000000000000000000000003", "4.5"),
    ("1.000000000000000000000000000000841", "-1.3e32"),
    ("5.78e-18", "-356478377767.5607989119127410174794"),
    ("7.493475554282626321919641e-6", "1198.560079973673480935967827044305"),
    ("0.9999999999999999999999999999999999", "0.5"),
    ("1.000000000000000000000000000000001", "0.5"),
]
for a, b in NAMED:
    out["pow"].append([a, b, wide_result(power(a, b))])

# Near one, with small half-integer exponents, the digits after the 34th are all
# zeros or nines for a long way
for k in range(1, 240):
    a = f"1.{k:033d}"
    for b in ("0.5", "1.5", "2.5", "3.5", "4.5", "-0.5"):
        out["pow"].append([a, b, wide_result(power(a, b))])

# Results near both ends of the range, which an early exit must not misjudge
near_edge = lambda v: v[2] == "overflow" or (v[2] != "0" and abs(D(v[2]).adjusted()) > 6000)
while sum(map(near_edge, out["pow"])) < 300:
    a = str(D(rnd.randint(11, 10**6)).scaleb(-rnd.randint(1, 5)))
    if D(a) == 1: continue
    target = rnd.choice([rnd.randint(6100, 6150), rnd.randint(-6185, -6130)])
    with localcontext(WIDE):
        b = str(+(D(target) * D(10).ln() / D(a).ln()).quantize(D(1).scaleb(-20)))
    if len(D(b).normalize(WIDE).as_tuple().digits) > 34: continue
    out["pow"].append([a, b, wide_result(power(a, b))])

# Exact results and ties through large roots, as (p^n)^(m/n)
for p_, n in [(5, 40), (2, 100), (2, 64), (3, 25), (7, 16), (5, 32), (2, 80), (3, 20), (11, 10)]:
    a = p_ ** n
    if len(str(a).rstrip("0")) > 34: continue
    for m in range(1, 3 * n, max(1, n // 7)):
        b = F(m, n)
        den = b.denominator
        while den % 2 == 0: den //= 2
        while den % 5 == 0: den //= 5
        if den != 1: continue
        text = format(D(b.numerator) / D(b.denominator), "f")
        out["pow"].append([str(a), text, rational(F(p_) ** m)])
        out["pow"].append([str(a), "-" + text, rational(F(1) / F(p_) ** m)])
out["pow"].append(["5", "49", rational(F(5) ** 49)])
# True ties at 5^49 × 1e-49, through roots past those above
tie = rational(F(1, 2**49))
out["pow"].append([str(2**100), "-0.49", tie])
out["pow"].append([str(2**64), "-0.765625", tie])
out["pow"].append([str(2**80), "-0.6125", tie])
# An even exponent too large to be a safe integer
out["pow"].append(["-1", "3e16", "1e0"])
out["pow"].append(["33550174213429846434008913335195250", "-1", rational(1 / F(33550174213429846434008913335195250))])

while len(out["text"]) < 1200:
    s = literal()
    if not valid(s): continue
    out["text"].append([s, canon(D(s))])

MODES = {"half_away": "ROUND_HALF_UP", "half_even": "ROUND_HALF_EVEN", "floor": "ROUND_FLOOR", "ceil": "ROUND_CEILING", "trunc": "ROUND_DOWN"}
while len(out["round"]) < 1500:
    s = literal(); digits = rnd.randint(-8, 12); mode = rnd.choice(list(MODES))
    if not valid(s) or abs(D(s).adjusted()) > 60: continue
    r = D(s).quantize(D(1).scaleb(-digits), rounding=MODES[mode], context=WIDE)
    fixed = None
    if digits >= 0:
        q = format(r, "f")
        fixed = q if r != 0 else ("0." + "0" * digits if digits else "0")
    out["round"].append([s, digits, mode, canon(r), fixed])

json.dump(out, open("test/fixtures/decimal.json", "w"), separators=(",", ":"))
print({k: len(v) for k, v in out.items()})
