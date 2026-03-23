var ho = Object.defineProperty;
var fo = (t, e, n) => e in t ? ho(t, e, { enumerable: !0, configurable: !0, writable: !0, value: n }) : t[e] = n;
var b = (t, e, n) => fo(t, typeof e != "symbol" ? e + "" : e, n);
class po {
  constructor(e = "nostrpass-lite") {
    this.prefix = e;
  }
  withPrefix(e) {
    return `${this.prefix}:${e}`;
  }
  async get(e) {
    var r;
    const n = (r = globalThis.localStorage) == null ? void 0 : r.getItem(this.withPrefix(e));
    return n ? JSON.parse(n) : null;
  }
  async set(e, n) {
    var r;
    (r = globalThis.localStorage) == null || r.setItem(this.withPrefix(e), JSON.stringify(n));
  }
  async remove(e) {
    var n;
    (n = globalThis.localStorage) == null || n.removeItem(this.withPrefix(e));
  }
}
function Tr(t) {
  if (!Number.isSafeInteger(t) || t < 0)
    throw new Error(`Wrong positive integer: ${t}`);
}
function ci(t, ...e) {
  if (!(t instanceof Uint8Array))
    throw new Error("Expected Uint8Array");
  if (e.length > 0 && !e.includes(t.length))
    throw new Error(`Expected Uint8Array of length ${e}, not of length=${t.length}`);
}
function go(t) {
  if (typeof t != "function" || typeof t.create != "function")
    throw new Error("Hash should be wrapped by utils.wrapConstructor");
  Tr(t.outputLen), Tr(t.blockLen);
}
function Ot(t, e = !0) {
  if (t.destroyed)
    throw new Error("Hash instance has been destroyed");
  if (e && t.finished)
    throw new Error("Hash#digest() has already been called");
}
function yo(t, e) {
  ci(t);
  const n = e.outputLen;
  if (t.length < n)
    throw new Error(`digestInto() expects output buffer of length at least ${n}`);
}
const fn = typeof globalThis == "object" && "crypto" in globalThis ? globalThis.crypto : void 0;
/*! noble-hashes - MIT License (c) 2022 Paul Miller (paulmillr.com) */
const li = (t) => t instanceof Uint8Array, dn = (t) => new DataView(t.buffer, t.byteOffset, t.byteLength), ie = (t, e) => t << 32 - e | t >>> e, wo = new Uint8Array(new Uint32Array([287454020]).buffer)[0] === 68;
if (!wo)
  throw new Error("Non little-endian hardware is not supported");
function bo(t) {
  if (typeof t != "string")
    throw new Error(`utf8ToBytes expected string, got ${typeof t}`);
  return new Uint8Array(new TextEncoder().encode(t));
}
function Vn(t) {
  if (typeof t == "string" && (t = bo(t)), !li(t))
    throw new Error(`expected Uint8Array, got ${typeof t}`);
  return t;
}
function mo(...t) {
  const e = new Uint8Array(t.reduce((r, i) => r + i.length, 0));
  let n = 0;
  return t.forEach((r) => {
    if (!li(r))
      throw new Error("Uint8Array expected");
    e.set(r, n), n += r.length;
  }), e;
}
let ui = class {
  // Safe version that clones internal state
  clone() {
    return this._cloneInto();
  }
};
function vo(t) {
  const e = (r) => t().update(Vn(r)).digest(), n = t();
  return e.outputLen = n.outputLen, e.blockLen = n.blockLen, e.create = () => t(), e;
}
function hi(t = 32) {
  if (fn && typeof fn.getRandomValues == "function")
    return fn.getRandomValues(new Uint8Array(t));
  throw new Error("crypto.getRandomValues must be defined");
}
function Eo(t, e, n, r) {
  if (typeof t.setBigUint64 == "function")
    return t.setBigUint64(e, n, r);
  const i = BigInt(32), s = BigInt(4294967295), o = Number(n >> i & s), a = Number(n & s), c = r ? 4 : 0, u = r ? 0 : 4;
  t.setUint32(e + c, o, r), t.setUint32(e + u, a, r);
}
let xo = class extends ui {
  constructor(e, n, r, i) {
    super(), this.blockLen = e, this.outputLen = n, this.padOffset = r, this.isLE = i, this.finished = !1, this.length = 0, this.pos = 0, this.destroyed = !1, this.buffer = new Uint8Array(e), this.view = dn(this.buffer);
  }
  update(e) {
    Ot(this);
    const { view: n, buffer: r, blockLen: i } = this;
    e = Vn(e);
    const s = e.length;
    for (let o = 0; o < s; ) {
      const a = Math.min(i - this.pos, s - o);
      if (a === i) {
        const c = dn(e);
        for (; i <= s - o; o += i)
          this.process(c, o);
        continue;
      }
      r.set(e.subarray(o, o + a), this.pos), this.pos += a, o += a, this.pos === i && (this.process(n, 0), this.pos = 0);
    }
    return this.length += e.length, this.roundClean(), this;
  }
  digestInto(e) {
    Ot(this), yo(e, this), this.finished = !0;
    const { buffer: n, view: r, blockLen: i, isLE: s } = this;
    let { pos: o } = this;
    n[o++] = 128, this.buffer.subarray(o).fill(0), this.padOffset > i - o && (this.process(r, 0), o = 0);
    for (let l = o; l < i; l++)
      n[l] = 0;
    Eo(r, i - 8, BigInt(this.length * 8), s), this.process(r, 0);
    const a = dn(e), c = this.outputLen;
    if (c % 4)
      throw new Error("_sha2: outputLen should be aligned to 32bit");
    const u = c / 4, h = this.get();
    if (u > h.length)
      throw new Error("_sha2: outputLen bigger than state");
    for (let l = 0; l < u; l++)
      a.setUint32(4 * l, h[l], s);
  }
  digest() {
    const { buffer: e, outputLen: n } = this;
    this.digestInto(e);
    const r = e.slice(0, n);
    return this.destroy(), r;
  }
  _cloneInto(e) {
    e || (e = new this.constructor()), e.set(...this.get());
    const { blockLen: n, buffer: r, length: i, finished: s, destroyed: o, pos: a } = this;
    return e.length = i, e.pos = a, e.finished = s, e.destroyed = o, i % n && e.buffer.set(r), e;
  }
};
const So = (t, e, n) => t & e ^ ~t & n, Ao = (t, e, n) => t & e ^ t & n ^ e & n, _o = /* @__PURE__ */ new Uint32Array([
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
]), Pe = /* @__PURE__ */ new Uint32Array([
  1779033703,
  3144134277,
  1013904242,
  2773480762,
  1359893119,
  2600822924,
  528734635,
  1541459225
]), $e = /* @__PURE__ */ new Uint32Array(64);
let Lo = class extends xo {
  constructor() {
    super(64, 32, 8, !1), this.A = Pe[0] | 0, this.B = Pe[1] | 0, this.C = Pe[2] | 0, this.D = Pe[3] | 0, this.E = Pe[4] | 0, this.F = Pe[5] | 0, this.G = Pe[6] | 0, this.H = Pe[7] | 0;
  }
  get() {
    const { A: e, B: n, C: r, D: i, E: s, F: o, G: a, H: c } = this;
    return [e, n, r, i, s, o, a, c];
  }
  // prettier-ignore
  set(e, n, r, i, s, o, a, c) {
    this.A = e | 0, this.B = n | 0, this.C = r | 0, this.D = i | 0, this.E = s | 0, this.F = o | 0, this.G = a | 0, this.H = c | 0;
  }
  process(e, n) {
    for (let l = 0; l < 16; l++, n += 4)
      $e[l] = e.getUint32(n, !1);
    for (let l = 16; l < 64; l++) {
      const d = $e[l - 15], p = $e[l - 2], g = ie(d, 7) ^ ie(d, 18) ^ d >>> 3, f = ie(p, 17) ^ ie(p, 19) ^ p >>> 10;
      $e[l] = f + $e[l - 7] + g + $e[l - 16] | 0;
    }
    let { A: r, B: i, C: s, D: o, E: a, F: c, G: u, H: h } = this;
    for (let l = 0; l < 64; l++) {
      const d = ie(a, 6) ^ ie(a, 11) ^ ie(a, 25), p = h + d + So(a, c, u) + _o[l] + $e[l] | 0, f = (ie(r, 2) ^ ie(r, 13) ^ ie(r, 22)) + Ao(r, i, s) | 0;
      h = u, u = c, c = a, a = o + p | 0, o = s, s = i, i = r, r = p + f | 0;
    }
    r = r + this.A | 0, i = i + this.B | 0, s = s + this.C | 0, o = o + this.D | 0, a = a + this.E | 0, c = c + this.F | 0, u = u + this.G | 0, h = h + this.H | 0, this.set(r, i, s, o, a, c, u, h);
  }
  roundClean() {
    $e.fill(0);
  }
  destroy() {
    this.set(0, 0, 0, 0, 0, 0, 0, 0), this.buffer.fill(0);
  }
};
const Pn = /* @__PURE__ */ vo(() => new Lo());
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
const fi = BigInt(0), jt = BigInt(1), ko = BigInt(2), Gt = (t) => t instanceof Uint8Array, Io = /* @__PURE__ */ Array.from({ length: 256 }, (t, e) => e.toString(16).padStart(2, "0"));
function lt(t) {
  if (!Gt(t))
    throw new Error("Uint8Array expected");
  let e = "";
  for (let n = 0; n < t.length; n++)
    e += Io[t[n]];
  return e;
}
function di(t) {
  const e = t.toString(16);
  return e.length & 1 ? `0${e}` : e;
}
function zn(t) {
  if (typeof t != "string")
    throw new Error("hex string expected, got " + typeof t);
  return BigInt(t === "" ? "0" : `0x${t}`);
}
function ut(t) {
  if (typeof t != "string")
    throw new Error("hex string expected, got " + typeof t);
  const e = t.length;
  if (e % 2)
    throw new Error("padded hex string expected, got unpadded hex of length " + e);
  const n = new Uint8Array(e / 2);
  for (let r = 0; r < n.length; r++) {
    const i = r * 2, s = t.slice(i, i + 2), o = Number.parseInt(s, 16);
    if (Number.isNaN(o) || o < 0)
      throw new Error("Invalid byte sequence");
    n[r] = o;
  }
  return n;
}
function J(t) {
  return zn(lt(t));
}
function Fn(t) {
  if (!Gt(t))
    throw new Error("Uint8Array expected");
  return zn(lt(Uint8Array.from(t).reverse()));
}
function He(t, e) {
  return ut(t.toString(16).padStart(e * 2, "0"));
}
function Wn(t, e) {
  return He(t, e).reverse();
}
function To(t) {
  return ut(di(t));
}
function W(t, e, n) {
  let r;
  if (typeof e == "string")
    try {
      r = ut(e);
    } catch (s) {
      throw new Error(`${t} must be valid hex string, got "${e}". Cause: ${s}`);
    }
  else if (Gt(e))
    r = Uint8Array.from(e);
  else
    throw new Error(`${t} must be hex string or Uint8Array`);
  const i = r.length;
  if (typeof n == "number" && i !== n)
    throw new Error(`${t} expected ${n} bytes, got ${i}`);
  return r;
}
function Ge(...t) {
  const e = new Uint8Array(t.reduce((r, i) => r + i.length, 0));
  let n = 0;
  return t.forEach((r) => {
    if (!Gt(r))
      throw new Error("Uint8Array expected");
    e.set(r, n), n += r.length;
  }), e;
}
function Po(t, e) {
  if (t.length !== e.length)
    return !1;
  for (let n = 0; n < t.length; n++)
    if (t[n] !== e[n])
      return !1;
  return !0;
}
function $o(t) {
  if (typeof t != "string")
    throw new Error(`utf8ToBytes expected string, got ${typeof t}`);
  return new Uint8Array(new TextEncoder().encode(t));
}
function Bo(t) {
  let e;
  for (e = 0; t > fi; t >>= jt, e += 1)
    ;
  return e;
}
function Uo(t, e) {
  return t >> BigInt(e) & jt;
}
const No = (t, e, n) => t | (n ? jt : fi) << BigInt(e), jn = (t) => (ko << BigInt(t - 1)) - jt, pn = (t) => new Uint8Array(t), Pr = (t) => Uint8Array.from(t);
function pi(t, e, n) {
  if (typeof t != "number" || t < 2)
    throw new Error("hashLen must be a number");
  if (typeof e != "number" || e < 2)
    throw new Error("qByteLen must be a number");
  if (typeof n != "function")
    throw new Error("hmacFn must be a function");
  let r = pn(t), i = pn(t), s = 0;
  const o = () => {
    r.fill(1), i.fill(0), s = 0;
  }, a = (...l) => n(i, r, ...l), c = (l = pn()) => {
    i = a(Pr([0]), l), r = a(), l.length !== 0 && (i = a(Pr([1]), l), r = a());
  }, u = () => {
    if (s++ >= 1e3)
      throw new Error("drbg: tried 1000 values");
    let l = 0;
    const d = [];
    for (; l < e; ) {
      r = a();
      const p = r.slice();
      d.push(p), l += r.length;
    }
    return Ge(...d);
  };
  return (l, d) => {
    o(), c(l);
    let p;
    for (; !(p = d(u())); )
      c();
    return o(), p;
  };
}
const Ro = {
  bigint: (t) => typeof t == "bigint",
  function: (t) => typeof t == "function",
  boolean: (t) => typeof t == "boolean",
  string: (t) => typeof t == "string",
  stringOrUint8Array: (t) => typeof t == "string" || t instanceof Uint8Array,
  isSafeInteger: (t) => Number.isSafeInteger(t),
  array: (t) => Array.isArray(t),
  field: (t, e) => e.Fp.isValid(t),
  hash: (t) => typeof t == "function" && Number.isSafeInteger(t.outputLen)
};
function Et(t, e, n = {}) {
  const r = (i, s, o) => {
    const a = Ro[s];
    if (typeof a != "function")
      throw new Error(`Invalid validator "${s}", expected function`);
    const c = t[i];
    if (!(o && c === void 0) && !a(c, t))
      throw new Error(`Invalid param ${String(i)}=${c} (${typeof c}), expected ${s}`);
  };
  for (const [i, s] of Object.entries(e))
    r(i, s, !1);
  for (const [i, s] of Object.entries(n))
    r(i, s, !0);
  return t;
}
const Oo = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  bitGet: Uo,
  bitLen: Bo,
  bitMask: jn,
  bitSet: No,
  bytesToHex: lt,
  bytesToNumberBE: J,
  bytesToNumberLE: Fn,
  concatBytes: Ge,
  createHmacDrbg: pi,
  ensureBytes: W,
  equalBytes: Po,
  hexToBytes: ut,
  hexToNumber: zn,
  numberToBytesBE: He,
  numberToBytesLE: Wn,
  numberToHexUnpadded: di,
  numberToVarBytesBE: To,
  utf8ToBytes: $o,
  validateObject: Et
}, Symbol.toStringTag, { value: "Module" }));
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
const z = BigInt(0), V = BigInt(1), Fe = BigInt(2), Co = BigInt(3), $n = BigInt(4), $r = BigInt(5), Br = BigInt(8);
BigInt(9);
BigInt(16);
function F(t, e) {
  const n = t % e;
  return n >= z ? n : e + n;
}
function Ho(t, e, n) {
  if (n <= z || e < z)
    throw new Error("Expected power/modulo > 0");
  if (n === V)
    return z;
  let r = V;
  for (; e > z; )
    e & V && (r = r * t % n), t = t * t % n, e >>= V;
  return r;
}
function Y(t, e, n) {
  let r = t;
  for (; e-- > z; )
    r *= r, r %= n;
  return r;
}
function Bn(t, e) {
  if (t === z || e <= z)
    throw new Error(`invert: expected positive integers, got n=${t} mod=${e}`);
  let n = F(t, e), r = e, i = z, s = V;
  for (; n !== z; ) {
    const a = r / n, c = r % n, u = i - s * a;
    r = n, n = c, i = s, s = u;
  }
  if (r !== V)
    throw new Error("invert: does not exist");
  return F(i, e);
}
function Mo(t) {
  const e = (t - V) / Fe;
  let n, r, i;
  for (n = t - V, r = 0; n % Fe === z; n /= Fe, r++)
    ;
  for (i = Fe; i < t && Ho(i, e, t) !== t - V; i++)
    ;
  if (r === 1) {
    const o = (t + V) / $n;
    return function(c, u) {
      const h = c.pow(u, o);
      if (!c.eql(c.sqr(h), u))
        throw new Error("Cannot find square root");
      return h;
    };
  }
  const s = (n + V) / Fe;
  return function(a, c) {
    if (a.pow(c, e) === a.neg(a.ONE))
      throw new Error("Cannot find square root");
    let u = r, h = a.pow(a.mul(a.ONE, i), n), l = a.pow(c, s), d = a.pow(c, n);
    for (; !a.eql(d, a.ONE); ) {
      if (a.eql(d, a.ZERO))
        return a.ZERO;
      let p = 1;
      for (let f = a.sqr(d); p < u && !a.eql(f, a.ONE); p++)
        f = a.sqr(f);
      const g = a.pow(h, V << BigInt(u - p - 1));
      h = a.sqr(g), l = a.mul(l, g), d = a.mul(d, h), u = p;
    }
    return l;
  };
}
function Ko(t) {
  if (t % $n === Co) {
    const e = (t + V) / $n;
    return function(r, i) {
      const s = r.pow(i, e);
      if (!r.eql(r.sqr(s), i))
        throw new Error("Cannot find square root");
      return s;
    };
  }
  if (t % Br === $r) {
    const e = (t - $r) / Br;
    return function(r, i) {
      const s = r.mul(i, Fe), o = r.pow(s, e), a = r.mul(i, o), c = r.mul(r.mul(a, Fe), o), u = r.mul(a, r.sub(c, r.ONE));
      if (!r.eql(r.sqr(u), i))
        throw new Error("Cannot find square root");
      return u;
    };
  }
  return Mo(t);
}
const Do = [
  "create",
  "isValid",
  "is0",
  "neg",
  "inv",
  "sqrt",
  "sqr",
  "eql",
  "add",
  "sub",
  "mul",
  "pow",
  "div",
  "addN",
  "subN",
  "mulN",
  "sqrN"
];
function qo(t) {
  const e = {
    ORDER: "bigint",
    MASK: "bigint",
    BYTES: "isSafeInteger",
    BITS: "isSafeInteger"
  }, n = Do.reduce((r, i) => (r[i] = "function", r), e);
  return Et(t, n);
}
function Vo(t, e, n) {
  if (n < z)
    throw new Error("Expected power > 0");
  if (n === z)
    return t.ONE;
  if (n === V)
    return e;
  let r = t.ONE, i = e;
  for (; n > z; )
    n & V && (r = t.mul(r, i)), i = t.sqr(i), n >>= V;
  return r;
}
function zo(t, e) {
  const n = new Array(e.length), r = e.reduce((s, o, a) => t.is0(o) ? s : (n[a] = s, t.mul(s, o)), t.ONE), i = t.inv(r);
  return e.reduceRight((s, o, a) => t.is0(o) ? s : (n[a] = t.mul(s, n[a]), t.mul(s, o)), i), n;
}
function gi(t, e) {
  const n = e !== void 0 ? e : t.toString(2).length, r = Math.ceil(n / 8);
  return { nBitLength: n, nByteLength: r };
}
function Fo(t, e, n = !1, r = {}) {
  if (t <= z)
    throw new Error(`Expected Field ORDER > 0, got ${t}`);
  const { nBitLength: i, nByteLength: s } = gi(t, e);
  if (s > 2048)
    throw new Error("Field lengths over 2048 bytes are not supported");
  const o = Ko(t), a = Object.freeze({
    ORDER: t,
    BITS: i,
    BYTES: s,
    MASK: jn(i),
    ZERO: z,
    ONE: V,
    create: (c) => F(c, t),
    isValid: (c) => {
      if (typeof c != "bigint")
        throw new Error(`Invalid field element: expected bigint, got ${typeof c}`);
      return z <= c && c < t;
    },
    is0: (c) => c === z,
    isOdd: (c) => (c & V) === V,
    neg: (c) => F(-c, t),
    eql: (c, u) => c === u,
    sqr: (c) => F(c * c, t),
    add: (c, u) => F(c + u, t),
    sub: (c, u) => F(c - u, t),
    mul: (c, u) => F(c * u, t),
    pow: (c, u) => Vo(a, c, u),
    div: (c, u) => F(c * Bn(u, t), t),
    // Same as above, but doesn't normalize
    sqrN: (c) => c * c,
    addN: (c, u) => c + u,
    subN: (c, u) => c - u,
    mulN: (c, u) => c * u,
    inv: (c) => Bn(c, t),
    sqrt: r.sqrt || ((c) => o(a, c)),
    invertBatch: (c) => zo(a, c),
    // TODO: do we really need constant cmov?
    // We don't have const-time bigints anyway, so probably will be not very useful
    cmov: (c, u, h) => h ? u : c,
    toBytes: (c) => n ? Wn(c, s) : He(c, s),
    fromBytes: (c) => {
      if (c.length !== s)
        throw new Error(`Fp.fromBytes: expected ${s}, got ${c.length}`);
      return n ? Fn(c) : J(c);
    }
  });
  return Object.freeze(a);
}
function yi(t) {
  if (typeof t != "bigint")
    throw new Error("field order must be bigint");
  const e = t.toString(2).length;
  return Math.ceil(e / 8);
}
function wi(t) {
  const e = yi(t);
  return e + Math.ceil(e / 2);
}
function Wo(t, e, n = !1) {
  const r = t.length, i = yi(e), s = wi(e);
  if (r < 16 || r < s || r > 1024)
    throw new Error(`expected ${s}-1024 bytes of input, got ${r}`);
  const o = n ? J(t) : Fn(t), a = F(o, e - V) + V;
  return n ? Wn(a, i) : He(a, i);
}
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
const jo = BigInt(0), gn = BigInt(1);
function Go(t, e) {
  const n = (i, s) => {
    const o = s.negate();
    return i ? o : s;
  }, r = (i) => {
    const s = Math.ceil(e / i) + 1, o = 2 ** (i - 1);
    return { windows: s, windowSize: o };
  };
  return {
    constTimeNegate: n,
    // non-const time multiplication ladder
    unsafeLadder(i, s) {
      let o = t.ZERO, a = i;
      for (; s > jo; )
        s & gn && (o = o.add(a)), a = a.double(), s >>= gn;
      return o;
    },
    /**
     * Creates a wNAF precomputation window. Used for caching.
     * Default window size is set by `utils.precompute()` and is equal to 8.
     * Number of precomputed points depends on the curve size:
     * 2^(𝑊−1) * (Math.ceil(𝑛 / 𝑊) + 1), where:
     * - 𝑊 is the window size
     * - 𝑛 is the bitlength of the curve order.
     * For a 256-bit curve and window size 8, the number of precomputed points is 128 * 33 = 4224.
     * @returns precomputed point tables flattened to a single array
     */
    precomputeWindow(i, s) {
      const { windows: o, windowSize: a } = r(s), c = [];
      let u = i, h = u;
      for (let l = 0; l < o; l++) {
        h = u, c.push(h);
        for (let d = 1; d < a; d++)
          h = h.add(u), c.push(h);
        u = h.double();
      }
      return c;
    },
    /**
     * Implements ec multiplication using precomputed tables and w-ary non-adjacent form.
     * @param W window size
     * @param precomputes precomputed tables
     * @param n scalar (we don't check here, but should be less than curve order)
     * @returns real and fake (for const-time) points
     */
    wNAF(i, s, o) {
      const { windows: a, windowSize: c } = r(i);
      let u = t.ZERO, h = t.BASE;
      const l = BigInt(2 ** i - 1), d = 2 ** i, p = BigInt(i);
      for (let g = 0; g < a; g++) {
        const f = g * c;
        let y = Number(o & l);
        o >>= p, y > c && (y -= d, o += gn);
        const w = f, m = f + Math.abs(y) - 1, S = g % 2 !== 0, L = y < 0;
        y === 0 ? h = h.add(n(S, s[w])) : u = u.add(n(L, s[m]));
      }
      return { p: u, f: h };
    },
    wNAFCached(i, s, o, a) {
      const c = i._WINDOW_SIZE || 1;
      let u = s.get(i);
      return u || (u = this.precomputeWindow(i, c), c !== 1 && s.set(i, a(u))), this.wNAF(c, u, o);
    }
  };
}
function bi(t) {
  return qo(t.Fp), Et(t, {
    n: "bigint",
    h: "bigint",
    Gx: "field",
    Gy: "field"
  }, {
    nBitLength: "isSafeInteger",
    nByteLength: "isSafeInteger"
  }), Object.freeze({
    ...gi(t.n, t.nBitLength),
    ...t,
    p: t.Fp.ORDER
  });
}
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
function Zo(t) {
  const e = bi(t);
  Et(e, {
    a: "field",
    b: "field"
  }, {
    allowedPrivateKeyLengths: "array",
    wrapPrivateKey: "boolean",
    isTorsionFree: "function",
    clearCofactor: "function",
    allowInfinityPoint: "boolean",
    fromBytes: "function",
    toBytes: "function"
  });
  const { endo: n, Fp: r, a: i } = e;
  if (n) {
    if (!r.eql(i, r.ZERO))
      throw new Error("Endomorphism can only be defined for Koblitz curves that have a=0");
    if (typeof n != "object" || typeof n.beta != "bigint" || typeof n.splitScalar != "function")
      throw new Error("Expected endomorphism with beta: bigint and splitScalar: function");
  }
  return Object.freeze({ ...e });
}
const { bytesToNumberBE: Jo, hexToBytes: Yo } = Oo, je = {
  // asn.1 DER encoding utils
  Err: class extends Error {
    constructor(e = "") {
      super(e);
    }
  },
  _parseInt(t) {
    const { Err: e } = je;
    if (t.length < 2 || t[0] !== 2)
      throw new e("Invalid signature integer tag");
    const n = t[1], r = t.subarray(2, n + 2);
    if (!n || r.length !== n)
      throw new e("Invalid signature integer: wrong length");
    if (r[0] & 128)
      throw new e("Invalid signature integer: negative");
    if (r[0] === 0 && !(r[1] & 128))
      throw new e("Invalid signature integer: unnecessary leading zero");
    return { d: Jo(r), l: t.subarray(n + 2) };
  },
  toSig(t) {
    const { Err: e } = je, n = typeof t == "string" ? Yo(t) : t;
    if (!(n instanceof Uint8Array))
      throw new Error("ui8a expected");
    let r = n.length;
    if (r < 2 || n[0] != 48)
      throw new e("Invalid signature tag");
    if (n[1] !== r - 2)
      throw new e("Invalid signature: incorrect length");
    const { d: i, l: s } = je._parseInt(n.subarray(2)), { d: o, l: a } = je._parseInt(s);
    if (a.length)
      throw new e("Invalid signature: left bytes after parsing");
    return { r: i, s: o };
  },
  hexFromSig(t) {
    const e = (u) => Number.parseInt(u[0], 16) & 8 ? "00" + u : u, n = (u) => {
      const h = u.toString(16);
      return h.length & 1 ? `0${h}` : h;
    }, r = e(n(t.s)), i = e(n(t.r)), s = r.length / 2, o = i.length / 2, a = n(s), c = n(o);
    return `30${n(o + s + 4)}02${c}${i}02${a}${r}`;
  }
}, be = BigInt(0), X = BigInt(1);
BigInt(2);
const Ur = BigInt(3);
BigInt(4);
function Xo(t) {
  const e = Zo(t), { Fp: n } = e, r = e.toBytes || ((g, f, y) => {
    const w = f.toAffine();
    return Ge(Uint8Array.from([4]), n.toBytes(w.x), n.toBytes(w.y));
  }), i = e.fromBytes || ((g) => {
    const f = g.subarray(1), y = n.fromBytes(f.subarray(0, n.BYTES)), w = n.fromBytes(f.subarray(n.BYTES, 2 * n.BYTES));
    return { x: y, y: w };
  });
  function s(g) {
    const { a: f, b: y } = e, w = n.sqr(g), m = n.mul(w, g);
    return n.add(n.add(m, n.mul(g, f)), y);
  }
  if (!n.eql(n.sqr(e.Gy), s(e.Gx)))
    throw new Error("bad generator point: equation left != right");
  function o(g) {
    return typeof g == "bigint" && be < g && g < e.n;
  }
  function a(g) {
    if (!o(g))
      throw new Error("Expected valid bigint: 0 < bigint < curve.n");
  }
  function c(g) {
    const { allowedPrivateKeyLengths: f, nByteLength: y, wrapPrivateKey: w, n: m } = e;
    if (f && typeof g != "bigint") {
      if (g instanceof Uint8Array && (g = lt(g)), typeof g != "string" || !f.includes(g.length))
        throw new Error("Invalid key");
      g = g.padStart(y * 2, "0");
    }
    let S;
    try {
      S = typeof g == "bigint" ? g : J(W("private key", g, y));
    } catch {
      throw new Error(`private key must be ${y} bytes, hex or bigint, not ${typeof g}`);
    }
    return w && (S = F(S, m)), a(S), S;
  }
  const u = /* @__PURE__ */ new Map();
  function h(g) {
    if (!(g instanceof l))
      throw new Error("ProjectivePoint expected");
  }
  class l {
    constructor(f, y, w) {
      if (this.px = f, this.py = y, this.pz = w, f == null || !n.isValid(f))
        throw new Error("x required");
      if (y == null || !n.isValid(y))
        throw new Error("y required");
      if (w == null || !n.isValid(w))
        throw new Error("z required");
    }
    // Does not validate if the point is on-curve.
    // Use fromHex instead, or call assertValidity() later.
    static fromAffine(f) {
      const { x: y, y: w } = f || {};
      if (!f || !n.isValid(y) || !n.isValid(w))
        throw new Error("invalid affine point");
      if (f instanceof l)
        throw new Error("projective point not allowed");
      const m = (S) => n.eql(S, n.ZERO);
      return m(y) && m(w) ? l.ZERO : new l(y, w, n.ONE);
    }
    get x() {
      return this.toAffine().x;
    }
    get y() {
      return this.toAffine().y;
    }
    /**
     * Takes a bunch of Projective Points but executes only one
     * inversion on all of them. Inversion is very slow operation,
     * so this improves performance massively.
     * Optimization: converts a list of projective points to a list of identical points with Z=1.
     */
    static normalizeZ(f) {
      const y = n.invertBatch(f.map((w) => w.pz));
      return f.map((w, m) => w.toAffine(y[m])).map(l.fromAffine);
    }
    /**
     * Converts hash string or Uint8Array to Point.
     * @param hex short/long ECDSA hex
     */
    static fromHex(f) {
      const y = l.fromAffine(i(W("pointHex", f)));
      return y.assertValidity(), y;
    }
    // Multiplies generator point by privateKey.
    static fromPrivateKey(f) {
      return l.BASE.multiply(c(f));
    }
    // "Private method", don't use it directly
    _setWindowSize(f) {
      this._WINDOW_SIZE = f, u.delete(this);
    }
    // A point on curve is valid if it conforms to equation.
    assertValidity() {
      if (this.is0()) {
        if (e.allowInfinityPoint && !n.is0(this.py))
          return;
        throw new Error("bad point: ZERO");
      }
      const { x: f, y } = this.toAffine();
      if (!n.isValid(f) || !n.isValid(y))
        throw new Error("bad point: x or y not FE");
      const w = n.sqr(y), m = s(f);
      if (!n.eql(w, m))
        throw new Error("bad point: equation left != right");
      if (!this.isTorsionFree())
        throw new Error("bad point: not in prime-order subgroup");
    }
    hasEvenY() {
      const { y: f } = this.toAffine();
      if (n.isOdd)
        return !n.isOdd(f);
      throw new Error("Field doesn't support isOdd");
    }
    /**
     * Compare one point to another.
     */
    equals(f) {
      h(f);
      const { px: y, py: w, pz: m } = this, { px: S, py: L, pz: I } = f, x = n.eql(n.mul(y, I), n.mul(S, m)), A = n.eql(n.mul(w, I), n.mul(L, m));
      return x && A;
    }
    /**
     * Flips point to one corresponding to (x, -y) in Affine coordinates.
     */
    negate() {
      return new l(this.px, n.neg(this.py), this.pz);
    }
    // Renes-Costello-Batina exception-free doubling formula.
    // There is 30% faster Jacobian formula, but it is not complete.
    // https://eprint.iacr.org/2015/1060, algorithm 3
    // Cost: 8M + 3S + 3*a + 2*b3 + 15add.
    double() {
      const { a: f, b: y } = e, w = n.mul(y, Ur), { px: m, py: S, pz: L } = this;
      let I = n.ZERO, x = n.ZERO, A = n.ZERO, _ = n.mul(m, m), U = n.mul(S, S), B = n.mul(L, L), T = n.mul(m, S);
      return T = n.add(T, T), A = n.mul(m, L), A = n.add(A, A), I = n.mul(f, A), x = n.mul(w, B), x = n.add(I, x), I = n.sub(U, x), x = n.add(U, x), x = n.mul(I, x), I = n.mul(T, I), A = n.mul(w, A), B = n.mul(f, B), T = n.sub(_, B), T = n.mul(f, T), T = n.add(T, A), A = n.add(_, _), _ = n.add(A, _), _ = n.add(_, B), _ = n.mul(_, T), x = n.add(x, _), B = n.mul(S, L), B = n.add(B, B), _ = n.mul(B, T), I = n.sub(I, _), A = n.mul(B, U), A = n.add(A, A), A = n.add(A, A), new l(I, x, A);
    }
    // Renes-Costello-Batina exception-free addition formula.
    // There is 30% faster Jacobian formula, but it is not complete.
    // https://eprint.iacr.org/2015/1060, algorithm 1
    // Cost: 12M + 0S + 3*a + 3*b3 + 23add.
    add(f) {
      h(f);
      const { px: y, py: w, pz: m } = this, { px: S, py: L, pz: I } = f;
      let x = n.ZERO, A = n.ZERO, _ = n.ZERO;
      const U = e.a, B = n.mul(e.b, Ur);
      let T = n.mul(y, S), H = n.mul(w, L), M = n.mul(m, I), q = n.add(y, w), v = n.add(S, L);
      q = n.mul(q, v), v = n.add(T, H), q = n.sub(q, v), v = n.add(y, m);
      let E = n.add(S, I);
      return v = n.mul(v, E), E = n.add(T, M), v = n.sub(v, E), E = n.add(w, m), x = n.add(L, I), E = n.mul(E, x), x = n.add(H, M), E = n.sub(E, x), _ = n.mul(U, v), x = n.mul(B, M), _ = n.add(x, _), x = n.sub(H, _), _ = n.add(H, _), A = n.mul(x, _), H = n.add(T, T), H = n.add(H, T), M = n.mul(U, M), v = n.mul(B, v), H = n.add(H, M), M = n.sub(T, M), M = n.mul(U, M), v = n.add(v, M), T = n.mul(H, v), A = n.add(A, T), T = n.mul(E, v), x = n.mul(q, x), x = n.sub(x, T), T = n.mul(q, H), _ = n.mul(E, _), _ = n.add(_, T), new l(x, A, _);
    }
    subtract(f) {
      return this.add(f.negate());
    }
    is0() {
      return this.equals(l.ZERO);
    }
    wNAF(f) {
      return p.wNAFCached(this, u, f, (y) => {
        const w = n.invertBatch(y.map((m) => m.pz));
        return y.map((m, S) => m.toAffine(w[S])).map(l.fromAffine);
      });
    }
    /**
     * Non-constant-time multiplication. Uses double-and-add algorithm.
     * It's faster, but should only be used when you don't care about
     * an exposed private key e.g. sig verification, which works over *public* keys.
     */
    multiplyUnsafe(f) {
      const y = l.ZERO;
      if (f === be)
        return y;
      if (a(f), f === X)
        return this;
      const { endo: w } = e;
      if (!w)
        return p.unsafeLadder(this, f);
      let { k1neg: m, k1: S, k2neg: L, k2: I } = w.splitScalar(f), x = y, A = y, _ = this;
      for (; S > be || I > be; )
        S & X && (x = x.add(_)), I & X && (A = A.add(_)), _ = _.double(), S >>= X, I >>= X;
      return m && (x = x.negate()), L && (A = A.negate()), A = new l(n.mul(A.px, w.beta), A.py, A.pz), x.add(A);
    }
    /**
     * Constant time multiplication.
     * Uses wNAF method. Windowed method may be 10% faster,
     * but takes 2x longer to generate and consumes 2x memory.
     * Uses precomputes when available.
     * Uses endomorphism for Koblitz curves.
     * @param scalar by which the point would be multiplied
     * @returns New point
     */
    multiply(f) {
      a(f);
      let y = f, w, m;
      const { endo: S } = e;
      if (S) {
        const { k1neg: L, k1: I, k2neg: x, k2: A } = S.splitScalar(y);
        let { p: _, f: U } = this.wNAF(I), { p: B, f: T } = this.wNAF(A);
        _ = p.constTimeNegate(L, _), B = p.constTimeNegate(x, B), B = new l(n.mul(B.px, S.beta), B.py, B.pz), w = _.add(B), m = U.add(T);
      } else {
        const { p: L, f: I } = this.wNAF(y);
        w = L, m = I;
      }
      return l.normalizeZ([w, m])[0];
    }
    /**
     * Efficiently calculate `aP + bQ`. Unsafe, can expose private key, if used incorrectly.
     * Not using Strauss-Shamir trick: precomputation tables are faster.
     * The trick could be useful if both P and Q are not G (not in our case).
     * @returns non-zero affine point
     */
    multiplyAndAddUnsafe(f, y, w) {
      const m = l.BASE, S = (I, x) => x === be || x === X || !I.equals(m) ? I.multiplyUnsafe(x) : I.multiply(x), L = S(this, y).add(S(f, w));
      return L.is0() ? void 0 : L;
    }
    // Converts Projective point to affine (x, y) coordinates.
    // Can accept precomputed Z^-1 - for example, from invertBatch.
    // (x, y, z) ∋ (x=x/z, y=y/z)
    toAffine(f) {
      const { px: y, py: w, pz: m } = this, S = this.is0();
      f == null && (f = S ? n.ONE : n.inv(m));
      const L = n.mul(y, f), I = n.mul(w, f), x = n.mul(m, f);
      if (S)
        return { x: n.ZERO, y: n.ZERO };
      if (!n.eql(x, n.ONE))
        throw new Error("invZ was invalid");
      return { x: L, y: I };
    }
    isTorsionFree() {
      const { h: f, isTorsionFree: y } = e;
      if (f === X)
        return !0;
      if (y)
        return y(l, this);
      throw new Error("isTorsionFree() has not been declared for the elliptic curve");
    }
    clearCofactor() {
      const { h: f, clearCofactor: y } = e;
      return f === X ? this : y ? y(l, this) : this.multiplyUnsafe(e.h);
    }
    toRawBytes(f = !0) {
      return this.assertValidity(), r(l, this, f);
    }
    toHex(f = !0) {
      return lt(this.toRawBytes(f));
    }
  }
  l.BASE = new l(e.Gx, e.Gy, n.ONE), l.ZERO = new l(n.ZERO, n.ONE, n.ZERO);
  const d = e.nBitLength, p = Go(l, e.endo ? Math.ceil(d / 2) : d);
  return {
    CURVE: e,
    ProjectivePoint: l,
    normPrivateKeyToScalar: c,
    weierstrassEquation: s,
    isWithinCurveOrder: o
  };
}
function Qo(t) {
  const e = bi(t);
  return Et(e, {
    hash: "hash",
    hmac: "function",
    randomBytes: "function"
  }, {
    bits2int: "function",
    bits2int_modN: "function",
    lowS: "boolean"
  }), Object.freeze({ lowS: !0, ...e });
}
function ea(t) {
  const e = Qo(t), { Fp: n, n: r } = e, i = n.BYTES + 1, s = 2 * n.BYTES + 1;
  function o(v) {
    return be < v && v < n.ORDER;
  }
  function a(v) {
    return F(v, r);
  }
  function c(v) {
    return Bn(v, r);
  }
  const { ProjectivePoint: u, normPrivateKeyToScalar: h, weierstrassEquation: l, isWithinCurveOrder: d } = Xo({
    ...e,
    toBytes(v, E, k) {
      const $ = E.toAffine(), P = n.toBytes($.x), N = Ge;
      return k ? N(Uint8Array.from([E.hasEvenY() ? 2 : 3]), P) : N(Uint8Array.from([4]), P, n.toBytes($.y));
    },
    fromBytes(v) {
      const E = v.length, k = v[0], $ = v.subarray(1);
      if (E === i && (k === 2 || k === 3)) {
        const P = J($);
        if (!o(P))
          throw new Error("Point is not on curve");
        const N = l(P);
        let K = n.sqrt(N);
        const O = (K & X) === X;
        return (k & 1) === 1 !== O && (K = n.neg(K)), { x: P, y: K };
      } else if (E === s && k === 4) {
        const P = n.fromBytes($.subarray(0, n.BYTES)), N = n.fromBytes($.subarray(n.BYTES, 2 * n.BYTES));
        return { x: P, y: N };
      } else
        throw new Error(`Point of length ${E} was invalid. Expected ${i} compressed bytes or ${s} uncompressed bytes`);
    }
  }), p = (v) => lt(He(v, e.nByteLength));
  function g(v) {
    const E = r >> X;
    return v > E;
  }
  function f(v) {
    return g(v) ? a(-v) : v;
  }
  const y = (v, E, k) => J(v.slice(E, k));
  class w {
    constructor(E, k, $) {
      this.r = E, this.s = k, this.recovery = $, this.assertValidity();
    }
    // pair (bytes of r, bytes of s)
    static fromCompact(E) {
      const k = e.nByteLength;
      return E = W("compactSignature", E, k * 2), new w(y(E, 0, k), y(E, k, 2 * k));
    }
    // DER encoded ECDSA signature
    // https://bitcoin.stackexchange.com/questions/57644/what-are-the-parts-of-a-bitcoin-transaction-input-script
    static fromDER(E) {
      const { r: k, s: $ } = je.toSig(W("DER", E));
      return new w(k, $);
    }
    assertValidity() {
      if (!d(this.r))
        throw new Error("r must be 0 < r < CURVE.n");
      if (!d(this.s))
        throw new Error("s must be 0 < s < CURVE.n");
    }
    addRecoveryBit(E) {
      return new w(this.r, this.s, E);
    }
    recoverPublicKey(E) {
      const { r: k, s: $, recovery: P } = this, N = A(W("msgHash", E));
      if (P == null || ![0, 1, 2, 3].includes(P))
        throw new Error("recovery id invalid");
      const K = P === 2 || P === 3 ? k + e.n : k;
      if (K >= n.ORDER)
        throw new Error("recovery id 2 or 3 invalid");
      const O = P & 1 ? "03" : "02", ee = u.fromHex(O + p(K)), Ie = c(K), Xe = a(-N * Ie), dt = a($ * Ie), Te = u.BASE.multiplyAndAddUnsafe(ee, Xe, dt);
      if (!Te)
        throw new Error("point at infinify");
      return Te.assertValidity(), Te;
    }
    // Signatures should be low-s, to prevent malleability.
    hasHighS() {
      return g(this.s);
    }
    normalizeS() {
      return this.hasHighS() ? new w(this.r, a(-this.s), this.recovery) : this;
    }
    // DER-encoded
    toDERRawBytes() {
      return ut(this.toDERHex());
    }
    toDERHex() {
      return je.hexFromSig({ r: this.r, s: this.s });
    }
    // padded bytes of r, then padded bytes of s
    toCompactRawBytes() {
      return ut(this.toCompactHex());
    }
    toCompactHex() {
      return p(this.r) + p(this.s);
    }
  }
  const m = {
    isValidPrivateKey(v) {
      try {
        return h(v), !0;
      } catch {
        return !1;
      }
    },
    normPrivateKeyToScalar: h,
    /**
     * Produces cryptographically secure private key from random of size
     * (groupLen + ceil(groupLen / 2)) with modulo bias being negligible.
     */
    randomPrivateKey: () => {
      const v = wi(e.n);
      return Wo(e.randomBytes(v), e.n);
    },
    /**
     * Creates precompute table for an arbitrary EC point. Makes point "cached".
     * Allows to massively speed-up `point.multiply(scalar)`.
     * @returns cached point
     * @example
     * const fast = utils.precompute(8, ProjectivePoint.fromHex(someonesPubKey));
     * fast.multiply(privKey); // much faster ECDH now
     */
    precompute(v = 8, E = u.BASE) {
      return E._setWindowSize(v), E.multiply(BigInt(3)), E;
    }
  };
  function S(v, E = !0) {
    return u.fromPrivateKey(v).toRawBytes(E);
  }
  function L(v) {
    const E = v instanceof Uint8Array, k = typeof v == "string", $ = (E || k) && v.length;
    return E ? $ === i || $ === s : k ? $ === 2 * i || $ === 2 * s : v instanceof u;
  }
  function I(v, E, k = !0) {
    if (L(v))
      throw new Error("first arg must be private key");
    if (!L(E))
      throw new Error("second arg must be public key");
    return u.fromHex(E).multiply(h(v)).toRawBytes(k);
  }
  const x = e.bits2int || function(v) {
    const E = J(v), k = v.length * 8 - e.nBitLength;
    return k > 0 ? E >> BigInt(k) : E;
  }, A = e.bits2int_modN || function(v) {
    return a(x(v));
  }, _ = jn(e.nBitLength);
  function U(v) {
    if (typeof v != "bigint")
      throw new Error("bigint expected");
    if (!(be <= v && v < _))
      throw new Error(`bigint expected < 2^${e.nBitLength}`);
    return He(v, e.nByteLength);
  }
  function B(v, E, k = T) {
    if (["recovered", "canonical"].some((De) => De in k))
      throw new Error("sign() legacy options not supported");
    const { hash: $, randomBytes: P } = e;
    let { lowS: N, prehash: K, extraEntropy: O } = k;
    N == null && (N = !0), v = W("msgHash", v), K && (v = W("prehashed msgHash", $(v)));
    const ee = A(v), Ie = h(E), Xe = [U(Ie), U(ee)];
    if (O != null) {
      const De = O === !0 ? P(n.BYTES) : O;
      Xe.push(W("extraEntropy", De));
    }
    const dt = Ge(...Xe), Te = ee;
    function hn(De) {
      const Qe = x(De);
      if (!d(Qe))
        return;
      const Lr = c(Qe), et = u.BASE.multiply(Qe).toAffine(), te = a(et.x);
      if (te === be)
        return;
      const tt = a(Lr * a(Te + te * Ie));
      if (tt === be)
        return;
      let kr = (et.x === te ? 0 : 2) | Number(et.y & X), Ir = tt;
      return N && g(tt) && (Ir = f(tt), kr ^= 1), new w(te, Ir, kr);
    }
    return { seed: dt, k2sig: hn };
  }
  const T = { lowS: e.lowS, prehash: !1 }, H = { lowS: e.lowS, prehash: !1 };
  function M(v, E, k = T) {
    const { seed: $, k2sig: P } = B(v, E, k), N = e;
    return pi(N.hash.outputLen, N.nByteLength, N.hmac)($, P);
  }
  u.BASE._setWindowSize(8);
  function q(v, E, k, $ = H) {
    var et;
    const P = v;
    if (E = W("msgHash", E), k = W("publicKey", k), "strict" in $)
      throw new Error("options.strict was renamed to lowS");
    const { lowS: N, prehash: K } = $;
    let O, ee;
    try {
      if (typeof P == "string" || P instanceof Uint8Array)
        try {
          O = w.fromDER(P);
        } catch (te) {
          if (!(te instanceof je.Err))
            throw te;
          O = w.fromCompact(P);
        }
      else if (typeof P == "object" && typeof P.r == "bigint" && typeof P.s == "bigint") {
        const { r: te, s: tt } = P;
        O = new w(te, tt);
      } else
        throw new Error("PARSE");
      ee = u.fromHex(k);
    } catch (te) {
      if (te.message === "PARSE")
        throw new Error("signature must be Signature instance, Uint8Array or hex string");
      return !1;
    }
    if (N && O.hasHighS())
      return !1;
    K && (E = e.hash(E));
    const { r: Ie, s: Xe } = O, dt = A(E), Te = c(Xe), hn = a(dt * Te), De = a(Ie * Te), Qe = (et = u.BASE.multiplyAndAddUnsafe(ee, hn, De)) == null ? void 0 : et.toAffine();
    return Qe ? a(Qe.x) === Ie : !1;
  }
  return {
    CURVE: e,
    getPublicKey: S,
    getSharedSecret: I,
    sign: M,
    verify: q,
    ProjectivePoint: u,
    Signature: w,
    utils: m
  };
}
let mi = class extends ui {
  constructor(e, n) {
    super(), this.finished = !1, this.destroyed = !1, go(e);
    const r = Vn(n);
    if (this.iHash = e.create(), typeof this.iHash.update != "function")
      throw new Error("Expected instance of class which extends utils.Hash");
    this.blockLen = this.iHash.blockLen, this.outputLen = this.iHash.outputLen;
    const i = this.blockLen, s = new Uint8Array(i);
    s.set(r.length > i ? e.create().update(r).digest() : r);
    for (let o = 0; o < s.length; o++)
      s[o] ^= 54;
    this.iHash.update(s), this.oHash = e.create();
    for (let o = 0; o < s.length; o++)
      s[o] ^= 106;
    this.oHash.update(s), s.fill(0);
  }
  update(e) {
    return Ot(this), this.iHash.update(e), this;
  }
  digestInto(e) {
    Ot(this), ci(e, this.outputLen), this.finished = !0, this.iHash.digestInto(e), this.oHash.update(e), this.oHash.digestInto(e), this.destroy();
  }
  digest() {
    const e = new Uint8Array(this.oHash.outputLen);
    return this.digestInto(e), e;
  }
  _cloneInto(e) {
    e || (e = Object.create(Object.getPrototypeOf(this), {}));
    const { oHash: n, iHash: r, finished: i, destroyed: s, blockLen: o, outputLen: a } = this;
    return e = e, e.finished = i, e.destroyed = s, e.blockLen = o, e.outputLen = a, e.oHash = n._cloneInto(e.oHash), e.iHash = r._cloneInto(e.iHash), e;
  }
  destroy() {
    this.destroyed = !0, this.oHash.destroy(), this.iHash.destroy();
  }
};
const vi = (t, e, n) => new mi(t, e).update(n).digest();
vi.create = (t, e) => new mi(t, e);
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
function ta(t) {
  return {
    hash: t,
    hmac: (e, ...n) => vi(t, e, mo(...n)),
    randomBytes: hi
  };
}
function na(t, e) {
  const n = (r) => ea({ ...t, ...ta(r) });
  return Object.freeze({ ...n(e), create: n });
}
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
const Zt = BigInt("0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f"), Ct = BigInt("0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141"), Ei = BigInt(1), Ht = BigInt(2), Nr = (t, e) => (t + e / Ht) / e;
function xi(t) {
  const e = Zt, n = BigInt(3), r = BigInt(6), i = BigInt(11), s = BigInt(22), o = BigInt(23), a = BigInt(44), c = BigInt(88), u = t * t * t % e, h = u * u * t % e, l = Y(h, n, e) * h % e, d = Y(l, n, e) * h % e, p = Y(d, Ht, e) * u % e, g = Y(p, i, e) * p % e, f = Y(g, s, e) * g % e, y = Y(f, a, e) * f % e, w = Y(y, c, e) * y % e, m = Y(w, a, e) * f % e, S = Y(m, n, e) * h % e, L = Y(S, o, e) * g % e, I = Y(L, r, e) * u % e, x = Y(I, Ht, e);
  if (!Un.eql(Un.sqr(x), t))
    throw new Error("Cannot find square root");
  return x;
}
const Un = Fo(Zt, void 0, void 0, { sqrt: xi }), Ae = na({
  a: BigInt(0),
  b: BigInt(7),
  Fp: Un,
  n: Ct,
  // Base point (x, y) aka generator point
  Gx: BigInt("55066263022277343669578718895168534326250603453777594175500187360389116729240"),
  Gy: BigInt("32670510020758816978083085130507043184471273380659243275938904335757337482424"),
  h: BigInt(1),
  lowS: !0,
  /**
   * secp256k1 belongs to Koblitz curves: it has efficiently computable endomorphism.
   * Endomorphism uses 2x less RAM, speeds up precomputation by 2x and ECDH / key recovery by 20%.
   * For precomputed wNAF it trades off 1/2 init time & 1/3 ram for 20% perf hit.
   * Explanation: https://gist.github.com/paulmillr/eb670806793e84df628a7c434a873066
   */
  endo: {
    beta: BigInt("0x7ae96a2b657c07106e64479eac3434e99cf0497512f58995c1396c28719501ee"),
    splitScalar: (t) => {
      const e = Ct, n = BigInt("0x3086d221a7d46bcde86c90e49284eb15"), r = -Ei * BigInt("0xe4437ed6010e88286f547fa90abfe4c3"), i = BigInt("0x114ca50f7a8e2f3f657c1108d9d44cfd8"), s = n, o = BigInt("0x100000000000000000000000000000000"), a = Nr(s * t, e), c = Nr(-r * t, e);
      let u = F(t - a * n - c * i, e), h = F(-a * r - c * s, e);
      const l = u > o, d = h > o;
      if (l && (u = e - u), d && (h = e - h), u > o || h > o)
        throw new Error("splitScalar: Endomorphism failed, k=" + t);
      return { k1neg: l, k1: u, k2neg: d, k2: h };
    }
  }
}, Pn), Jt = BigInt(0), Si = (t) => typeof t == "bigint" && Jt < t && t < Zt, ra = (t) => typeof t == "bigint" && Jt < t && t < Ct, Rr = {};
function Mt(t, ...e) {
  let n = Rr[t];
  if (n === void 0) {
    const r = Pn(Uint8Array.from(t, (i) => i.charCodeAt(0)));
    n = Ge(r, r), Rr[t] = n;
  }
  return Pn(Ge(n, ...e));
}
const Gn = (t) => t.toRawBytes(!0).slice(1), Nn = (t) => He(t, 32), yn = (t) => F(t, Zt), bt = (t) => F(t, Ct), Zn = Ae.ProjectivePoint, ia = (t, e, n) => Zn.BASE.multiplyAndAddUnsafe(t, e, n);
function Rn(t) {
  let e = Ae.utils.normPrivateKeyToScalar(t), n = Zn.fromPrivateKey(e);
  return { scalar: n.hasEvenY() ? e : bt(-e), bytes: Gn(n) };
}
function Ai(t) {
  if (!Si(t))
    throw new Error("bad x: need 0 < x < p");
  const e = yn(t * t), n = yn(e * t + BigInt(7));
  let r = xi(n);
  r % Ht !== Jt && (r = yn(-r));
  const i = new Zn(t, r, Ei);
  return i.assertValidity(), i;
}
function _i(...t) {
  return bt(J(Mt("BIP0340/challenge", ...t)));
}
function sa(t) {
  return Rn(t).bytes;
}
function oa(t, e, n = hi(32)) {
  const r = W("message", t), { bytes: i, scalar: s } = Rn(e), o = W("auxRand", n, 32), a = Nn(s ^ J(Mt("BIP0340/aux", o))), c = Mt("BIP0340/nonce", a, i, r), u = bt(J(c));
  if (u === Jt)
    throw new Error("sign failed: k is zero");
  const { bytes: h, scalar: l } = Rn(u), d = _i(h, i, r), p = new Uint8Array(64);
  if (p.set(h, 0), p.set(Nn(bt(l + d * s)), 32), !Li(p, r, i))
    throw new Error("sign: Invalid signature produced");
  return p;
}
function Li(t, e, n) {
  const r = W("signature", t, 64), i = W("message", e), s = W("publicKey", n, 32);
  try {
    const o = Ai(J(s)), a = J(r.subarray(0, 32));
    if (!Si(a))
      return !1;
    const c = J(r.subarray(32, 64));
    if (!ra(c))
      return !1;
    const u = _i(Nn(a), Gn(o), i), h = ia(o, c, bt(-u));
    return !(!h || !h.hasEvenY() || h.toAffine().x !== a);
  } catch {
    return !1;
  }
}
const ce = {
  getPublicKey: sa,
  sign: oa,
  verify: Li,
  utils: {
    randomPrivateKey: Ae.utils.randomPrivateKey,
    lift_x: Ai,
    pointToBytes: Gn,
    numberToBytesBE: He,
    bytesToNumberBE: J,
    taggedHash: Mt,
    mod: F
  }
}, wn = typeof globalThis == "object" && "crypto" in globalThis ? globalThis.crypto : void 0;
/*! noble-hashes - MIT License (c) 2022 Paul Miller (paulmillr.com) */
const Jn = (t) => t instanceof Uint8Array, bn = (t) => new DataView(t.buffer, t.byteOffset, t.byteLength), se = (t, e) => t << 32 - e | t >>> e, aa = new Uint8Array(new Uint32Array([287454020]).buffer)[0] === 68;
if (!aa)
  throw new Error("Non little-endian hardware is not supported");
const ca = Array.from({ length: 256 }, (t, e) => e.toString(16).padStart(2, "0"));
function C(t) {
  if (!Jn(t))
    throw new Error("Uint8Array expected");
  let e = "";
  for (let n = 0; n < t.length; n++)
    e += ca[t[n]];
  return e;
}
function Ze(t) {
  if (typeof t != "string")
    throw new Error("hex string expected, got " + typeof t);
  const e = t.length;
  if (e % 2)
    throw new Error("padded hex string expected, got unpadded hex of length " + e);
  const n = new Uint8Array(e / 2);
  for (let r = 0; r < n.length; r++) {
    const i = r * 2, s = t.slice(i, i + 2), o = Number.parseInt(s, 16);
    if (Number.isNaN(o) || o < 0)
      throw new Error("Invalid byte sequence");
    n[r] = o;
  }
  return n;
}
function la(t) {
  if (typeof t != "string")
    throw new Error(`utf8ToBytes expected string, got ${typeof t}`);
  return new Uint8Array(new TextEncoder().encode(t));
}
function mt(t) {
  if (typeof t == "string" && (t = la(t)), !Jn(t))
    throw new Error(`expected Uint8Array, got ${typeof t}`);
  return t;
}
function Ye(...t) {
  const e = new Uint8Array(t.reduce((r, i) => r + i.length, 0));
  let n = 0;
  return t.forEach((r) => {
    if (!Jn(r))
      throw new Error("Uint8Array expected");
    e.set(r, n), n += r.length;
  }), e;
}
let ki = class {
  // Safe version that clones internal state
  clone() {
    return this._cloneInto();
  }
};
function Ii(t) {
  const e = (r) => t().update(mt(r)).digest(), n = t();
  return e.outputLen = n.outputLen, e.blockLen = n.blockLen, e.create = () => t(), e;
}
function Yt(t = 32) {
  if (wn && typeof wn.getRandomValues == "function")
    return wn.getRandomValues(new Uint8Array(t));
  throw new Error("crypto.getRandomValues must be defined");
}
function On(t) {
  if (!Number.isSafeInteger(t) || t < 0)
    throw new Error(`Wrong positive integer: ${t}`);
}
function ua(t) {
  if (typeof t != "boolean")
    throw new Error(`Expected boolean, not ${t}`);
}
function Ti(t, ...e) {
  if (!(t instanceof Uint8Array))
    throw new Error("Expected Uint8Array");
  if (e.length > 0 && !e.includes(t.length))
    throw new Error(`Expected Uint8Array of length ${e}, not of length=${t.length}`);
}
function ha(t) {
  if (typeof t != "function" || typeof t.create != "function")
    throw new Error("Hash should be wrapped by utils.wrapConstructor");
  On(t.outputLen), On(t.blockLen);
}
function fa(t, e = !0) {
  if (t.destroyed)
    throw new Error("Hash instance has been destroyed");
  if (e && t.finished)
    throw new Error("Hash#digest() has already been called");
}
function da(t, e) {
  Ti(t);
  const n = e.outputLen;
  if (t.length < n)
    throw new Error(`digestInto() expects output buffer of length at least ${n}`);
}
const ue = {
  number: On,
  bool: ua,
  bytes: Ti,
  hash: ha,
  exists: fa,
  output: da
};
function pa(t, e, n, r) {
  if (typeof t.setBigUint64 == "function")
    return t.setBigUint64(e, n, r);
  const i = BigInt(32), s = BigInt(4294967295), o = Number(n >> i & s), a = Number(n & s), c = r ? 4 : 0, u = r ? 0 : 4;
  t.setUint32(e + c, o, r), t.setUint32(e + u, a, r);
}
class ga extends ki {
  constructor(e, n, r, i) {
    super(), this.blockLen = e, this.outputLen = n, this.padOffset = r, this.isLE = i, this.finished = !1, this.length = 0, this.pos = 0, this.destroyed = !1, this.buffer = new Uint8Array(e), this.view = bn(this.buffer);
  }
  update(e) {
    ue.exists(this);
    const { view: n, buffer: r, blockLen: i } = this;
    e = mt(e);
    const s = e.length;
    for (let o = 0; o < s; ) {
      const a = Math.min(i - this.pos, s - o);
      if (a === i) {
        const c = bn(e);
        for (; i <= s - o; o += i)
          this.process(c, o);
        continue;
      }
      r.set(e.subarray(o, o + a), this.pos), this.pos += a, o += a, this.pos === i && (this.process(n, 0), this.pos = 0);
    }
    return this.length += e.length, this.roundClean(), this;
  }
  digestInto(e) {
    ue.exists(this), ue.output(e, this), this.finished = !0;
    const { buffer: n, view: r, blockLen: i, isLE: s } = this;
    let { pos: o } = this;
    n[o++] = 128, this.buffer.subarray(o).fill(0), this.padOffset > i - o && (this.process(r, 0), o = 0);
    for (let l = o; l < i; l++)
      n[l] = 0;
    pa(r, i - 8, BigInt(this.length * 8), s), this.process(r, 0);
    const a = bn(e), c = this.outputLen;
    if (c % 4)
      throw new Error("_sha2: outputLen should be aligned to 32bit");
    const u = c / 4, h = this.get();
    if (u > h.length)
      throw new Error("_sha2: outputLen bigger than state");
    for (let l = 0; l < u; l++)
      a.setUint32(4 * l, h[l], s);
  }
  digest() {
    const { buffer: e, outputLen: n } = this;
    this.digestInto(e);
    const r = e.slice(0, n);
    return this.destroy(), r;
  }
  _cloneInto(e) {
    e || (e = new this.constructor()), e.set(...this.get());
    const { blockLen: n, buffer: r, length: i, finished: s, destroyed: o, pos: a } = this;
    return e.length = i, e.pos = a, e.finished = s, e.destroyed = o, i % n && e.buffer.set(r), e;
  }
}
const ya = (t, e, n) => t & e ^ ~t & n, wa = (t, e, n) => t & e ^ t & n ^ e & n, ba = new Uint32Array([
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
]), Be = new Uint32Array([
  1779033703,
  3144134277,
  1013904242,
  2773480762,
  1359893119,
  2600822924,
  528734635,
  1541459225
]), Ue = new Uint32Array(64);
let Pi = class extends ga {
  constructor() {
    super(64, 32, 8, !1), this.A = Be[0] | 0, this.B = Be[1] | 0, this.C = Be[2] | 0, this.D = Be[3] | 0, this.E = Be[4] | 0, this.F = Be[5] | 0, this.G = Be[6] | 0, this.H = Be[7] | 0;
  }
  get() {
    const { A: e, B: n, C: r, D: i, E: s, F: o, G: a, H: c } = this;
    return [e, n, r, i, s, o, a, c];
  }
  // prettier-ignore
  set(e, n, r, i, s, o, a, c) {
    this.A = e | 0, this.B = n | 0, this.C = r | 0, this.D = i | 0, this.E = s | 0, this.F = o | 0, this.G = a | 0, this.H = c | 0;
  }
  process(e, n) {
    for (let l = 0; l < 16; l++, n += 4)
      Ue[l] = e.getUint32(n, !1);
    for (let l = 16; l < 64; l++) {
      const d = Ue[l - 15], p = Ue[l - 2], g = se(d, 7) ^ se(d, 18) ^ d >>> 3, f = se(p, 17) ^ se(p, 19) ^ p >>> 10;
      Ue[l] = f + Ue[l - 7] + g + Ue[l - 16] | 0;
    }
    let { A: r, B: i, C: s, D: o, E: a, F: c, G: u, H: h } = this;
    for (let l = 0; l < 64; l++) {
      const d = se(a, 6) ^ se(a, 11) ^ se(a, 25), p = h + d + ya(a, c, u) + ba[l] + Ue[l] | 0, f = (se(r, 2) ^ se(r, 13) ^ se(r, 22)) + wa(r, i, s) | 0;
      h = u, u = c, c = a, a = o + p | 0, o = s, s = i, i = r, r = p + f | 0;
    }
    r = r + this.A | 0, i = i + this.B | 0, s = s + this.C | 0, o = o + this.D | 0, a = a + this.E | 0, c = c + this.F | 0, u = u + this.G | 0, h = h + this.H | 0, this.set(r, i, s, o, a, c, u, h);
  }
  roundClean() {
    Ue.fill(0);
  }
  destroy() {
    this.set(0, 0, 0, 0, 0, 0, 0, 0), this.buffer.fill(0);
  }
};
class ma extends Pi {
  constructor() {
    super(), this.A = -1056596264, this.B = 914150663, this.C = 812702999, this.D = -150054599, this.E = -4191439, this.F = 1750603025, this.G = 1694076839, this.H = -1090891868, this.outputLen = 28;
  }
}
const re = Ii(() => new Pi());
Ii(() => new ma());
/*! scure-base - MIT License (c) 2022 Paul Miller (paulmillr.com) */
function ht(t) {
  if (!Number.isSafeInteger(t))
    throw new Error(`Wrong integer: ${t}`);
}
function _e(...t) {
  const e = (i, s) => (o) => i(s(o)), n = Array.from(t).reverse().reduce((i, s) => i ? e(i, s.encode) : s.encode, void 0), r = t.reduce((i, s) => i ? e(i, s.decode) : s.decode, void 0);
  return { encode: n, decode: r };
}
function Le(t) {
  return {
    encode: (e) => {
      if (!Array.isArray(e) || e.length && typeof e[0] != "number")
        throw new Error("alphabet.encode input should be an array of numbers");
      return e.map((n) => {
        if (ht(n), n < 0 || n >= t.length)
          throw new Error(`Digit index outside alphabet: ${n} (alphabet: ${t.length})`);
        return t[n];
      });
    },
    decode: (e) => {
      if (!Array.isArray(e) || e.length && typeof e[0] != "string")
        throw new Error("alphabet.decode input should be array of strings");
      return e.map((n) => {
        if (typeof n != "string")
          throw new Error(`alphabet.decode: not string element=${n}`);
        const r = t.indexOf(n);
        if (r === -1)
          throw new Error(`Unknown letter: "${n}". Allowed: ${t}`);
        return r;
      });
    }
  };
}
function ke(t = "") {
  if (typeof t != "string")
    throw new Error("join separator should be string");
  return {
    encode: (e) => {
      if (!Array.isArray(e) || e.length && typeof e[0] != "string")
        throw new Error("join.encode input should be array of strings");
      for (let n of e)
        if (typeof n != "string")
          throw new Error(`join.encode: non-string input=${n}`);
      return e.join(t);
    },
    decode: (e) => {
      if (typeof e != "string")
        throw new Error("join.decode input should be string");
      return e.split(t);
    }
  };
}
function Xt(t, e = "=") {
  if (ht(t), typeof e != "string")
    throw new Error("padding chr should be string");
  return {
    encode(n) {
      if (!Array.isArray(n) || n.length && typeof n[0] != "string")
        throw new Error("padding.encode input should be array of strings");
      for (let r of n)
        if (typeof r != "string")
          throw new Error(`padding.encode: non-string input=${r}`);
      for (; n.length * t % 8; )
        n.push(e);
      return n;
    },
    decode(n) {
      if (!Array.isArray(n) || n.length && typeof n[0] != "string")
        throw new Error("padding.encode input should be array of strings");
      for (let i of n)
        if (typeof i != "string")
          throw new Error(`padding.decode: non-string input=${i}`);
      let r = n.length;
      if (r * t % 8)
        throw new Error("Invalid padding: string should have whole number of bytes");
      for (; r > 0 && n[r - 1] === e; r--)
        if (!((r - 1) * t % 8))
          throw new Error("Invalid padding: string has too much padding");
      return n.slice(0, r);
    }
  };
}
function $i(t) {
  if (typeof t != "function")
    throw new Error("normalize fn should be function");
  return { encode: (e) => e, decode: (e) => t(e) };
}
function Or(t, e, n) {
  if (e < 2)
    throw new Error(`convertRadix: wrong from=${e}, base cannot be less than 2`);
  if (n < 2)
    throw new Error(`convertRadix: wrong to=${n}, base cannot be less than 2`);
  if (!Array.isArray(t))
    throw new Error("convertRadix: data should be array");
  if (!t.length)
    return [];
  let r = 0;
  const i = [], s = Array.from(t);
  for (s.forEach((o) => {
    if (ht(o), o < 0 || o >= e)
      throw new Error(`Wrong integer: ${o}`);
  }); ; ) {
    let o = 0, a = !0;
    for (let c = r; c < s.length; c++) {
      const u = s[c], h = e * o + u;
      if (!Number.isSafeInteger(h) || e * o / e !== o || h - u !== e * o)
        throw new Error("convertRadix: carry overflow");
      if (o = h % n, s[c] = Math.floor(h / n), !Number.isSafeInteger(s[c]) || s[c] * n + o !== h)
        throw new Error("convertRadix: carry overflow");
      if (a)
        s[c] ? a = !1 : r = c;
      else continue;
    }
    if (i.push(o), a)
      break;
  }
  for (let o = 0; o < t.length - 1 && t[o] === 0; o++)
    i.push(0);
  return i.reverse();
}
const Bi = (t, e) => e ? Bi(e, t % e) : t, Kt = (t, e) => t + (e - Bi(t, e));
function Cn(t, e, n, r) {
  if (!Array.isArray(t))
    throw new Error("convertRadix2: data should be array");
  if (e <= 0 || e > 32)
    throw new Error(`convertRadix2: wrong from=${e}`);
  if (n <= 0 || n > 32)
    throw new Error(`convertRadix2: wrong to=${n}`);
  if (Kt(e, n) > 32)
    throw new Error(`convertRadix2: carry overflow from=${e} to=${n} carryBits=${Kt(e, n)}`);
  let i = 0, s = 0;
  const o = 2 ** n - 1, a = [];
  for (const c of t) {
    if (ht(c), c >= 2 ** e)
      throw new Error(`convertRadix2: invalid data word=${c} from=${e}`);
    if (i = i << e | c, s + e > 32)
      throw new Error(`convertRadix2: carry overflow pos=${s} from=${e}`);
    for (s += e; s >= n; s -= n)
      a.push((i >> s - n & o) >>> 0);
    i &= 2 ** s - 1;
  }
  if (i = i << n - s & o, !r && s >= e)
    throw new Error("Excess padding");
  if (!r && i)
    throw new Error(`Non-zero padding: ${i}`);
  return r && s > 0 && a.push(i >>> 0), a;
}
function va(t) {
  return ht(t), {
    encode: (e) => {
      if (!(e instanceof Uint8Array))
        throw new Error("radix.encode input should be Uint8Array");
      return Or(Array.from(e), 2 ** 8, t);
    },
    decode: (e) => {
      if (!Array.isArray(e) || e.length && typeof e[0] != "number")
        throw new Error("radix.decode input should be array of strings");
      return Uint8Array.from(Or(e, t, 2 ** 8));
    }
  };
}
function Ke(t, e = !1) {
  if (ht(t), t <= 0 || t > 32)
    throw new Error("radix2: bits should be in (0..32]");
  if (Kt(8, t) > 32 || Kt(t, 8) > 32)
    throw new Error("radix2: carry overflow");
  return {
    encode: (n) => {
      if (!(n instanceof Uint8Array))
        throw new Error("radix2.encode input should be Uint8Array");
      return Cn(Array.from(n), 8, t, !e);
    },
    decode: (n) => {
      if (!Array.isArray(n) || n.length && typeof n[0] != "number")
        throw new Error("radix2.decode input should be array of strings");
      return Uint8Array.from(Cn(n, t, 8, e));
    }
  };
}
function Cr(t) {
  if (typeof t != "function")
    throw new Error("unsafeWrapper fn should be function");
  return function(...e) {
    try {
      return t.apply(null, e);
    } catch {
    }
  };
}
const Ea = _e(Ke(4), Le("0123456789ABCDEF"), ke("")), xa = _e(Ke(5), Le("ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"), Xt(5), ke(""));
_e(Ke(5), Le("0123456789ABCDEFGHIJKLMNOPQRSTUV"), Xt(5), ke(""));
_e(Ke(5), Le("0123456789ABCDEFGHJKMNPQRSTVWXYZ"), ke(""), $i((t) => t.toUpperCase().replace(/O/g, "0").replace(/[IL]/g, "1")));
const G = _e(Ke(6), Le("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"), Xt(6), ke("")), Sa = _e(Ke(6), Le("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"), Xt(6), ke("")), Yn = (t) => _e(va(58), Le(t), ke("")), Hn = Yn("123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz");
Yn("123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ");
Yn("rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz");
const Hr = [0, 2, 3, 5, 6, 7, 9, 10, 11], Aa = {
  encode(t) {
    let e = "";
    for (let n = 0; n < t.length; n += 8) {
      const r = t.subarray(n, n + 8);
      e += Hn.encode(r).padStart(Hr[r.length], "1");
    }
    return e;
  },
  decode(t) {
    let e = [];
    for (let n = 0; n < t.length; n += 11) {
      const r = t.slice(n, n + 11), i = Hr.indexOf(r.length), s = Hn.decode(r);
      for (let o = 0; o < s.length - i; o++)
        if (s[o] !== 0)
          throw new Error("base58xmr: wrong padding");
      e = e.concat(Array.from(s.slice(s.length - i)));
    }
    return Uint8Array.from(e);
  }
}, Mn = _e(Le("qpzry9x8gf2tvdw0s3jn54khce6mua7l"), ke("")), Mr = [996825010, 642813549, 513874426, 1027748829, 705979059];
function pt(t) {
  const e = t >> 25;
  let n = (t & 33554431) << 5;
  for (let r = 0; r < Mr.length; r++)
    (e >> r & 1) === 1 && (n ^= Mr[r]);
  return n;
}
function Kr(t, e, n = 1) {
  const r = t.length;
  let i = 1;
  for (let s = 0; s < r; s++) {
    const o = t.charCodeAt(s);
    if (o < 33 || o > 126)
      throw new Error(`Invalid prefix (${t})`);
    i = pt(i) ^ o >> 5;
  }
  i = pt(i);
  for (let s = 0; s < r; s++)
    i = pt(i) ^ t.charCodeAt(s) & 31;
  for (let s of e)
    i = pt(i) ^ s;
  for (let s = 0; s < 6; s++)
    i = pt(i);
  return i ^= n, Mn.encode(Cn([i % 2 ** 30], 30, 5, !1));
}
function Ui(t) {
  const e = t === "bech32" ? 1 : 734539939, n = Ke(5), r = n.decode, i = n.encode, s = Cr(r);
  function o(h, l, d = 90) {
    if (typeof h != "string")
      throw new Error(`bech32.encode prefix should be string, not ${typeof h}`);
    if (!Array.isArray(l) || l.length && typeof l[0] != "number")
      throw new Error(`bech32.encode words should be array of numbers, not ${typeof l}`);
    const p = h.length + 7 + l.length;
    if (d !== !1 && p > d)
      throw new TypeError(`Length ${p} exceeds limit ${d}`);
    return h = h.toLowerCase(), `${h}1${Mn.encode(l)}${Kr(h, l, e)}`;
  }
  function a(h, l = 90) {
    if (typeof h != "string")
      throw new Error(`bech32.decode input should be string, not ${typeof h}`);
    if (h.length < 8 || l !== !1 && h.length > l)
      throw new TypeError(`Wrong string length: ${h.length} (${h}). Expected (8..${l})`);
    const d = h.toLowerCase();
    if (h !== d && h !== h.toUpperCase())
      throw new Error("String must be lowercase or uppercase");
    h = d;
    const p = h.lastIndexOf("1");
    if (p === 0 || p === -1)
      throw new Error('Letter "1" must be present between prefix and data only');
    const g = h.slice(0, p), f = h.slice(p + 1);
    if (f.length < 6)
      throw new Error("Data must be at least 6 characters long");
    const y = Mn.decode(f).slice(0, -6), w = Kr(g, y, e);
    if (!f.endsWith(w))
      throw new Error(`Invalid checksum in ${h}: expected "${w}"`);
    return { prefix: g, words: y };
  }
  const c = Cr(a);
  function u(h) {
    const { prefix: l, words: d } = a(h, !1);
    return { prefix: l, words: d, bytes: r(d) };
  }
  return { encode: o, decode: a, decodeToBytes: u, decodeUnsafe: c, fromWords: r, fromWordsUnsafe: s, toWords: i };
}
const Me = Ui("bech32");
Ui("bech32m");
const _a = {
  encode: (t) => new TextDecoder().decode(t),
  decode: (t) => new TextEncoder().encode(t)
}, La = _e(Ke(4), Le("0123456789abcdef"), ke(""), $i((t) => {
  if (typeof t != "string" || t.length % 2)
    throw new TypeError(`hex.decode: expected string, got ${typeof t} with length ${t.length}`);
  return t.toLowerCase();
})), ka = {
  utf8: _a,
  hex: La,
  base16: Ea,
  base32: xa,
  base64: G,
  base64url: Sa,
  base58: Hn,
  base58xmr: Aa
};
`${Object.keys(ka).join(", ")}`;
function mn(t) {
  if (!Number.isSafeInteger(t) || t < 0)
    throw new Error(`positive integer expected, not ${t}`);
}
function Dr(t) {
  if (typeof t != "boolean")
    throw new Error(`boolean expected, not ${t}`);
}
function Ia(t) {
  return t instanceof Uint8Array || t != null && typeof t == "object" && t.constructor.name === "Uint8Array";
}
function he(t, ...e) {
  if (!Ia(t))
    throw new Error("Uint8Array expected");
  if (e.length > 0 && !e.includes(t.length))
    throw new Error(`Uint8Array expected of length ${e}, not of length=${t.length}`);
}
/*! noble-ciphers - MIT License (c) 2023 Paul Miller (paulmillr.com) */
const j = (t) => new Uint32Array(t.buffer, t.byteOffset, Math.floor(t.byteLength / 4)), Ta = new Uint8Array(new Uint32Array([287454020]).buffer)[0] === 68;
if (!Ta)
  throw new Error("Non little-endian hardware is not supported");
const Pa = /* @__PURE__ */ Array.from({ length: 256 }, (t, e) => e.toString(16).padStart(2, "0"));
function nt(t) {
  he(t);
  let e = "";
  for (let n = 0; n < t.length; n++)
    e += Pa[t[n]];
  return e;
}
const pe = { _0: 48, _9: 57, _A: 65, _F: 70, _a: 97, _f: 102 };
function qr(t) {
  if (t >= pe._0 && t <= pe._9)
    return t - pe._0;
  if (t >= pe._A && t <= pe._F)
    return t - (pe._A - 10);
  if (t >= pe._a && t <= pe._f)
    return t - (pe._a - 10);
}
function Ni(t) {
  if (typeof t != "string")
    throw new Error("hex string expected, got " + typeof t);
  const e = t.length, n = e / 2;
  if (e % 2)
    throw new Error("padded hex string expected, got unpadded hex of length " + e);
  const r = new Uint8Array(n);
  for (let i = 0, s = 0; i < n; i++, s += 2) {
    const o = qr(t.charCodeAt(s)), a = qr(t.charCodeAt(s + 1));
    if (o === void 0 || a === void 0) {
      const c = t[s] + t[s + 1];
      throw new Error('hex string expected, got non-hex character "' + c + '" at index ' + s);
    }
    r[i] = o * 16 + a;
  }
  return r;
}
function $a(t, e) {
  if (e == null || typeof e != "object")
    throw new Error("options must be defined");
  return Object.assign(t, e);
}
function Ri(t, e) {
  if (t.length !== e.length)
    return !1;
  let n = 0;
  for (let r = 0; r < t.length; r++)
    n |= t[r] ^ e[r];
  return n === 0;
}
const Ba = /* @__NO_SIDE_EFFECTS__ */ (t, e) => (Object.assign(e, t), e), Ce = 16, Ua = 283;
function Xn(t) {
  return t << 1 ^ Ua & -(t >> 7);
}
function at(t, e) {
  let n = 0;
  for (; e > 0; e >>= 1)
    n ^= t & -(e & 1), t = Xn(t);
  return n;
}
const Kn = /* @__PURE__ */ (() => {
  let t = new Uint8Array(256);
  for (let n = 0, r = 1; n < 256; n++, r ^= Xn(r))
    t[n] = r;
  const e = new Uint8Array(256);
  e[0] = 99;
  for (let n = 0; n < 255; n++) {
    let r = t[255 - n];
    r |= r << 8, e[t[n]] = (r ^ r >> 4 ^ r >> 5 ^ r >> 6 ^ r >> 7 ^ 99) & 255;
  }
  return e;
})(), Na = /* @__PURE__ */ Kn.map((t, e) => Kn.indexOf(e)), Ra = (t) => t << 24 | t >>> 8, vn = (t) => t << 8 | t >>> 24;
function Oi(t, e) {
  if (t.length !== 256)
    throw new Error("Wrong sbox length");
  const n = new Uint32Array(256).map((u, h) => e(t[h])), r = n.map(vn), i = r.map(vn), s = i.map(vn), o = new Uint32Array(256 * 256), a = new Uint32Array(256 * 256), c = new Uint16Array(256 * 256);
  for (let u = 0; u < 256; u++)
    for (let h = 0; h < 256; h++) {
      const l = u * 256 + h;
      o[l] = n[u] ^ r[h], a[l] = i[u] ^ s[h], c[l] = t[u] << 8 | t[h];
    }
  return { sbox: t, sbox2: c, T0: n, T1: r, T2: i, T3: s, T01: o, T23: a };
}
const Qn = /* @__PURE__ */ Oi(Kn, (t) => at(t, 3) << 24 | t << 16 | t << 8 | at(t, 2)), Ci = /* @__PURE__ */ Oi(Na, (t) => at(t, 11) << 24 | at(t, 13) << 16 | at(t, 9) << 8 | at(t, 14)), Oa = /* @__PURE__ */ (() => {
  const t = new Uint8Array(16);
  for (let e = 0, n = 1; e < 16; e++, n = Xn(n))
    t[e] = n;
  return t;
})();
function Hi(t) {
  he(t);
  const e = t.length;
  if (![16, 24, 32].includes(e))
    throw new Error(`aes: wrong key size: should be 16, 24 or 32, got: ${e}`);
  const { sbox2: n } = Qn, r = j(t), i = r.length, s = (a) => fe(n, a, a, a, a), o = new Uint32Array(e + 28);
  o.set(r);
  for (let a = i; a < o.length; a++) {
    let c = o[a - 1];
    a % i === 0 ? c = s(Ra(c)) ^ Oa[a / i - 1] : i > 6 && a % i === 4 && (c = s(c)), o[a] = o[a - i] ^ c;
  }
  return o;
}
function Ca(t) {
  const e = Hi(t), n = e.slice(), r = e.length, { sbox2: i } = Qn, { T0: s, T1: o, T2: a, T3: c } = Ci;
  for (let u = 0; u < r; u += 4)
    for (let h = 0; h < 4; h++)
      n[u + h] = e[r - u - 4 + h];
  e.fill(0);
  for (let u = 4; u < r - 4; u++) {
    const h = n[u], l = fe(i, h, h, h, h);
    n[u] = s[l & 255] ^ o[l >>> 8 & 255] ^ a[l >>> 16 & 255] ^ c[l >>> 24];
  }
  return n;
}
function Oe(t, e, n, r, i, s) {
  return t[n << 8 & 65280 | r >>> 8 & 255] ^ e[i >>> 8 & 65280 | s >>> 24 & 255];
}
function fe(t, e, n, r, i) {
  return t[e & 255 | n & 65280] | t[r >>> 16 & 255 | i >>> 16 & 65280] << 16;
}
function Vr(t, e, n, r, i) {
  const { sbox2: s, T01: o, T23: a } = Qn;
  let c = 0;
  e ^= t[c++], n ^= t[c++], r ^= t[c++], i ^= t[c++];
  const u = t.length / 4 - 2;
  for (let g = 0; g < u; g++) {
    const f = t[c++] ^ Oe(o, a, e, n, r, i), y = t[c++] ^ Oe(o, a, n, r, i, e), w = t[c++] ^ Oe(o, a, r, i, e, n), m = t[c++] ^ Oe(o, a, i, e, n, r);
    e = f, n = y, r = w, i = m;
  }
  const h = t[c++] ^ fe(s, e, n, r, i), l = t[c++] ^ fe(s, n, r, i, e), d = t[c++] ^ fe(s, r, i, e, n), p = t[c++] ^ fe(s, i, e, n, r);
  return { s0: h, s1: l, s2: d, s3: p };
}
function Ha(t, e, n, r, i) {
  const { sbox2: s, T01: o, T23: a } = Ci;
  let c = 0;
  e ^= t[c++], n ^= t[c++], r ^= t[c++], i ^= t[c++];
  const u = t.length / 4 - 2;
  for (let g = 0; g < u; g++) {
    const f = t[c++] ^ Oe(o, a, e, i, r, n), y = t[c++] ^ Oe(o, a, n, e, i, r), w = t[c++] ^ Oe(o, a, r, n, e, i), m = t[c++] ^ Oe(o, a, i, r, n, e);
    e = f, n = y, r = w, i = m;
  }
  const h = t[c++] ^ fe(s, e, i, r, n), l = t[c++] ^ fe(s, n, e, i, r), d = t[c++] ^ fe(s, r, n, e, i), p = t[c++] ^ fe(s, i, r, n, e);
  return { s0: h, s1: l, s2: d, s3: p };
}
function Mi(t, e) {
  if (!e)
    return new Uint8Array(t);
  if (he(e), e.length < t)
    throw new Error(`aes: wrong destination length, expected at least ${t}, got: ${e.length}`);
  return e;
}
function Ma(t) {
  if (he(t), t.length % Ce !== 0)
    throw new Error(`aes/(cbc-ecb).decrypt ciphertext should consist of blocks with size ${Ce}`);
}
function Ka(t, e, n) {
  let r = t.length;
  const i = r % Ce;
  if (!e && i !== 0)
    throw new Error("aec/(cbc-ecb): unpadded plaintext with disabled padding");
  const s = j(t);
  if (e) {
    let c = Ce - i;
    c || (c = Ce), r = r + c;
  }
  const o = Mi(r, n), a = j(o);
  return { b: s, o: a, out: o };
}
function Da(t, e) {
  if (!e)
    return t;
  const n = t.length;
  if (!n)
    throw new Error("aes/pcks5: empty ciphertext not allowed");
  const r = t[n - 1];
  if (r <= 0 || r > 16)
    throw new Error(`aes/pcks5: wrong padding byte: ${r}`);
  const i = t.subarray(0, -r);
  for (let s = 0; s < r; s++)
    if (t[n - s - 1] !== r)
      throw new Error("aes/pcks5: wrong padding");
  return i;
}
function qa(t) {
  const e = new Uint8Array(16), n = j(e);
  e.set(t);
  const r = Ce - t.length;
  for (let i = Ce - r; i < Ce; i++)
    e[i] = r;
  return n;
}
const Qt = /* @__PURE__ */ Ba({ blockSize: 16, nonceLength: 16 }, function(e, n, r = {}) {
  he(e), he(n, 16);
  const i = !r.disablePadding;
  return {
    encrypt: (s, o) => {
      const a = Hi(e), { b: c, o: u, out: h } = Ka(s, i, o), l = j(n);
      let d = l[0], p = l[1], g = l[2], f = l[3], y = 0;
      for (; y + 4 <= c.length; )
        d ^= c[y + 0], p ^= c[y + 1], g ^= c[y + 2], f ^= c[y + 3], { s0: d, s1: p, s2: g, s3: f } = Vr(a, d, p, g, f), u[y++] = d, u[y++] = p, u[y++] = g, u[y++] = f;
      if (i) {
        const w = qa(s.subarray(y * 4));
        d ^= w[0], p ^= w[1], g ^= w[2], f ^= w[3], { s0: d, s1: p, s2: g, s3: f } = Vr(a, d, p, g, f), u[y++] = d, u[y++] = p, u[y++] = g, u[y++] = f;
      }
      return a.fill(0), h;
    },
    decrypt: (s, o) => {
      Ma(s);
      const a = Ca(e), c = j(n), u = Mi(s.length, o), h = j(s), l = j(u);
      let d = c[0], p = c[1], g = c[2], f = c[3];
      for (let y = 0; y + 4 <= h.length; ) {
        const w = d, m = p, S = g, L = f;
        d = h[y + 0], p = h[y + 1], g = h[y + 2], f = h[y + 3];
        const { s0: I, s1: x, s2: A, s3: _ } = Ha(a, d, p, g, f);
        l[y++] = I ^ w, l[y++] = x ^ m, l[y++] = A ^ S, l[y++] = _ ^ L;
      }
      return a.fill(0), Da(u, i);
    }
  };
}), Ki = (t) => Uint8Array.from(t.split("").map((e) => e.charCodeAt(0))), Va = Ki("expand 16-byte k"), za = Ki("expand 32-byte k"), Fa = j(Va), Di = j(za);
Di.slice();
function R(t, e) {
  return t << e | t >>> 32 - e;
}
function Dn(t) {
  return t.byteOffset % 4 === 0;
}
const St = 64, Wa = 16, qi = 2 ** 32 - 1, zr = new Uint32Array();
function ja(t, e, n, r, i, s, o, a) {
  const c = i.length, u = new Uint8Array(St), h = j(u), l = Dn(i) && Dn(s), d = l ? j(i) : zr, p = l ? j(s) : zr;
  for (let g = 0; g < c; o++) {
    if (t(e, n, r, h, o, a), o >= qi)
      throw new Error("arx: counter overflow");
    const f = Math.min(St, c - g);
    if (l && f === St) {
      const y = g / 4;
      if (g % 4 !== 0)
        throw new Error("arx: invalid block position");
      for (let w = 0, m; w < Wa; w++)
        m = y + w, p[m] = d[m] ^ h[w];
      g += St;
      continue;
    }
    for (let y = 0, w; y < f; y++)
      w = g + y, s[w] = i[w] ^ u[y];
    g += f;
  }
}
function Ga(t, e) {
  const { allowShortKeys: n, extendNonceFn: r, counterLength: i, counterRight: s, rounds: o } = $a({ allowShortKeys: !1, counterLength: 8, counterRight: !1, rounds: 20 }, e);
  if (typeof t != "function")
    throw new Error("core must be a function");
  return mn(i), mn(o), Dr(s), Dr(n), (a, c, u, h, l = 0) => {
    he(a), he(c), he(u);
    const d = u.length;
    if (h || (h = new Uint8Array(d)), he(h), mn(l), l < 0 || l >= qi)
      throw new Error("arx: counter overflow");
    if (h.length < d)
      throw new Error(`arx: output (${h.length}) is shorter than data (${d})`);
    const p = [];
    let g = a.length, f, y;
    if (g === 32)
      f = a.slice(), p.push(f), y = Di;
    else if (g === 16 && n)
      f = new Uint8Array(32), f.set(a), f.set(a, 16), y = Fa, p.push(f);
    else
      throw new Error(`arx: invalid 32-byte key, got length=${g}`);
    Dn(c) || (c = c.slice(), p.push(c));
    const w = j(f);
    if (r) {
      if (c.length !== 24)
        throw new Error("arx: extended nonce must be 24 bytes");
      r(y, w, j(c.subarray(0, 16)), w), c = c.subarray(16);
    }
    const m = 16 - i;
    if (m !== c.length)
      throw new Error(`arx: nonce must be ${m} or 16 bytes`);
    if (m !== 12) {
      const L = new Uint8Array(12);
      L.set(c, s ? 0 : 12 - c.length), c = L, p.push(c);
    }
    const S = j(c);
    for (ja(t, y, w, S, u, h, l, o); p.length > 0; )
      p.pop().fill(0);
    return h;
  };
}
function Za(t, e, n, r, i, s = 20) {
  let o = t[0], a = t[1], c = t[2], u = t[3], h = e[0], l = e[1], d = e[2], p = e[3], g = e[4], f = e[5], y = e[6], w = e[7], m = i, S = n[0], L = n[1], I = n[2], x = o, A = a, _ = c, U = u, B = h, T = l, H = d, M = p, q = g, v = f, E = y, k = w, $ = m, P = S, N = L, K = I;
  for (let ee = 0; ee < s; ee += 2)
    x = x + B | 0, $ = R($ ^ x, 16), q = q + $ | 0, B = R(B ^ q, 12), x = x + B | 0, $ = R($ ^ x, 8), q = q + $ | 0, B = R(B ^ q, 7), A = A + T | 0, P = R(P ^ A, 16), v = v + P | 0, T = R(T ^ v, 12), A = A + T | 0, P = R(P ^ A, 8), v = v + P | 0, T = R(T ^ v, 7), _ = _ + H | 0, N = R(N ^ _, 16), E = E + N | 0, H = R(H ^ E, 12), _ = _ + H | 0, N = R(N ^ _, 8), E = E + N | 0, H = R(H ^ E, 7), U = U + M | 0, K = R(K ^ U, 16), k = k + K | 0, M = R(M ^ k, 12), U = U + M | 0, K = R(K ^ U, 8), k = k + K | 0, M = R(M ^ k, 7), x = x + T | 0, K = R(K ^ x, 16), E = E + K | 0, T = R(T ^ E, 12), x = x + T | 0, K = R(K ^ x, 8), E = E + K | 0, T = R(T ^ E, 7), A = A + H | 0, $ = R($ ^ A, 16), k = k + $ | 0, H = R(H ^ k, 12), A = A + H | 0, $ = R($ ^ A, 8), k = k + $ | 0, H = R(H ^ k, 7), _ = _ + M | 0, P = R(P ^ _, 16), q = q + P | 0, M = R(M ^ q, 12), _ = _ + M | 0, P = R(P ^ _, 8), q = q + P | 0, M = R(M ^ q, 7), U = U + B | 0, N = R(N ^ U, 16), v = v + N | 0, B = R(B ^ v, 12), U = U + B | 0, N = R(N ^ U, 8), v = v + N | 0, B = R(B ^ v, 7);
  let O = 0;
  r[O++] = o + x | 0, r[O++] = a + A | 0, r[O++] = c + _ | 0, r[O++] = u + U | 0, r[O++] = h + B | 0, r[O++] = l + T | 0, r[O++] = d + H | 0, r[O++] = p + M | 0, r[O++] = g + q | 0, r[O++] = f + v | 0, r[O++] = y + E | 0, r[O++] = w + k | 0, r[O++] = m + $ | 0, r[O++] = S + P | 0, r[O++] = L + N | 0, r[O++] = I + K | 0;
}
const en = /* @__PURE__ */ Ga(Za, {
  counterRight: !1,
  counterLength: 4,
  allowShortKeys: !1
});
let Vi = class extends ki {
  constructor(e, n) {
    super(), this.finished = !1, this.destroyed = !1, ue.hash(e);
    const r = mt(n);
    if (this.iHash = e.create(), typeof this.iHash.update != "function")
      throw new Error("Expected instance of class which extends utils.Hash");
    this.blockLen = this.iHash.blockLen, this.outputLen = this.iHash.outputLen;
    const i = this.blockLen, s = new Uint8Array(i);
    s.set(r.length > i ? e.create().update(r).digest() : r);
    for (let o = 0; o < s.length; o++)
      s[o] ^= 54;
    this.iHash.update(s), this.oHash = e.create();
    for (let o = 0; o < s.length; o++)
      s[o] ^= 106;
    this.oHash.update(s), s.fill(0);
  }
  update(e) {
    return ue.exists(this), this.iHash.update(e), this;
  }
  digestInto(e) {
    ue.exists(this), ue.bytes(e, this.outputLen), this.finished = !0, this.iHash.digestInto(e), this.oHash.update(e), this.oHash.digestInto(e), this.destroy();
  }
  digest() {
    const e = new Uint8Array(this.oHash.outputLen);
    return this.digestInto(e), e;
  }
  _cloneInto(e) {
    e || (e = Object.create(Object.getPrototypeOf(this), {}));
    const { oHash: n, iHash: r, finished: i, destroyed: s, blockLen: o, outputLen: a } = this;
    return e = e, e.finished = i, e.destroyed = s, e.blockLen = o, e.outputLen = a, e.oHash = n._cloneInto(e.oHash), e.iHash = r._cloneInto(e.iHash), e;
  }
  destroy() {
    this.destroyed = !0, this.oHash.destroy(), this.iHash.destroy();
  }
};
const xt = (t, e, n) => new Vi(t, e).update(n).digest();
xt.create = (t, e) => new Vi(t, e);
function zi(t, e, n) {
  return ue.hash(t), xt(t, mt(n), mt(e));
}
const En = new Uint8Array([0]), Fr = new Uint8Array();
function Fi(t, e, n, r = 32) {
  if (ue.hash(t), ue.number(r), r > 255 * t.outputLen)
    throw new Error("Length should be <= 255*HashLen");
  const i = Math.ceil(r / t.outputLen);
  n === void 0 && (n = Fr);
  const s = new Uint8Array(i * t.outputLen), o = xt.create(t, e), a = o._cloneInto(), c = new Uint8Array(o.outputLen);
  for (let u = 0; u < i; u++)
    En[0] = u + 1, a.update(u === 0 ? Fr : c).update(n).update(En).digestInto(c), s.set(c, t.outputLen * u), o._cloneInto(a);
  return o.destroy(), a.destroy(), c.fill(0), En.fill(0), s.slice(0, r);
}
var Ja = Object.defineProperty, D = (t, e) => {
  for (var n in e)
    Ja(t, n, { get: e[n], enumerable: !0 });
}, ze = Symbol("verified"), Ya = (t) => t instanceof Object;
function er(t) {
  if (!Ya(t) || typeof t.kind != "number" || typeof t.content != "string" || typeof t.created_at != "number" || typeof t.pubkey != "string" || !t.pubkey.match(/^[a-f0-9]{64}$/) || !Array.isArray(t.tags))
    return !1;
  for (let e = 0; e < t.tags.length; e++) {
    let n = t.tags[e];
    if (!Array.isArray(n))
      return !1;
    for (let r = 0; r < n.length; r++)
      if (typeof n[r] != "string")
        return !1;
  }
  return !0;
}
var Xa = {};
D(Xa, {
  Queue: () => ji,
  QueueNode: () => Wi,
  binarySearch: () => tr,
  bytesToHex: () => C,
  hexToBytes: () => Ze,
  insertEventIntoAscendingList: () => ec,
  insertEventIntoDescendingList: () => Qa,
  normalizeURL: () => We,
  utf8Decoder: () => ve,
  utf8Encoder: () => ne
});
var ve = new TextDecoder("utf-8"), ne = new TextEncoder();
function We(t) {
  try {
    t.indexOf("://") === -1 && (t = "wss://" + t);
    let e = new URL(t);
    return e.protocol === "http:" ? e.protocol = "ws:" : e.protocol === "https:" && (e.protocol = "wss:"), e.pathname = e.pathname.replace(/\/+/g, "/"), e.pathname.endsWith("/") && (e.pathname = e.pathname.slice(0, -1)), (e.port === "80" && e.protocol === "ws:" || e.port === "443" && e.protocol === "wss:") && (e.port = ""), e.searchParams.sort(), e.hash = "", e.toString();
  } catch {
    throw new Error(`Invalid URL: ${t}`);
  }
}
function Qa(t, e) {
  const [n, r] = tr(t, (i) => e.id === i.id ? 0 : e.created_at === i.created_at ? -1 : i.created_at - e.created_at);
  return r || t.splice(n, 0, e), t;
}
function ec(t, e) {
  const [n, r] = tr(t, (i) => e.id === i.id ? 0 : e.created_at === i.created_at ? -1 : e.created_at - i.created_at);
  return r || t.splice(n, 0, e), t;
}
function tr(t, e) {
  let n = 0, r = t.length - 1;
  for (; n <= r; ) {
    const i = Math.floor((n + r) / 2), s = e(t[i]);
    if (s === 0)
      return [i, !0];
    s < 0 ? r = i - 1 : n = i + 1;
  }
  return [n, !1];
}
var Wi = class {
  constructor(t) {
    b(this, "value");
    b(this, "next", null);
    b(this, "prev", null);
    this.value = t;
  }
}, ji = class {
  constructor() {
    b(this, "first");
    b(this, "last");
    this.first = null, this.last = null;
  }
  enqueue(t) {
    const e = new Wi(t);
    return this.last ? this.last === this.first ? (this.last = e, this.last.prev = this.first, this.first.next = e) : (e.prev = this.last, this.last.next = e, this.last = e) : (this.first = e, this.last = e), !0;
  }
  dequeue() {
    if (!this.first)
      return null;
    if (this.first === this.last) {
      const e = this.first;
      return this.first = null, this.last = null, e.value;
    }
    const t = this.first;
    return this.first = t.next, this.first && (this.first.prev = null), t.value;
  }
}, tc = class {
  generateSecretKey() {
    return ce.utils.randomPrivateKey();
  }
  getPublicKey(e) {
    return C(ce.getPublicKey(e));
  }
  finalizeEvent(e, n) {
    const r = e;
    return r.pubkey = C(ce.getPublicKey(n)), r.id = $t(r), r.sig = C(ce.sign($t(r), n)), r[ze] = !0, r;
  }
  verifyEvent(e) {
    if (typeof e[ze] == "boolean")
      return e[ze];
    const n = $t(e);
    if (n !== e.id)
      return e[ze] = !1, !1;
    try {
      const r = ce.verify(e.sig, n, e.pubkey);
      return e[ze] = r, r;
    } catch {
      return e[ze] = !1, !1;
    }
  }
};
function nc(t) {
  if (!er(t))
    throw new Error("can't serialize event with wrong or missing properties");
  return JSON.stringify([0, t.pubkey, t.created_at, t.kind, t.tags, t.content]);
}
function $t(t) {
  let e = re(ne.encode(nc(t)));
  return C(e);
}
var tn = new tc(), Bt = tn.generateSecretKey, nr = tn.getPublicKey, de = tn.finalizeEvent, nn = tn.verifyEvent, rc = {};
D(rc, {
  Application: () => nl,
  BadgeAward: () => hc,
  BadgeDefinition: () => Zc,
  BlockedRelaysList: () => Uc,
  BookmarkList: () => Pc,
  Bookmarksets: () => Wc,
  Calendar: () => ll,
  CalendarEventRSVP: () => ul,
  ChannelCreation: () => Qi,
  ChannelHideMessage: () => ns,
  ChannelMessage: () => ts,
  ChannelMetadata: () => es,
  ChannelMuteUser: () => rs,
  ClassifiedListing: () => sl,
  ClientAuth: () => ss,
  CommunitiesList: () => $c,
  CommunityDefinition: () => dl,
  CommunityPostApproval: () => mc,
  Contacts: () => cc,
  CreateOrUpdateProduct: () => Xc,
  CreateOrUpdateStall: () => Yc,
  Curationsets: () => jc,
  Date: () => al,
  DirectMessageRelaysList: () => Cc,
  DraftClassifiedListing: () => ol,
  DraftLong: () => el,
  Emojisets: () => tl,
  EncryptedDirectMessage: () => lc,
  EventDeletion: () => uc,
  FileMetadata: () => dc,
  FileServerPreference: () => Hc,
  Followsets: () => Vc,
  GenericRepost: () => ar,
  Genericlists: () => zc,
  GiftWrap: () => is,
  HTTPAuth: () => cr,
  Handlerinformation: () => fl,
  Handlerrecommendation: () => hl,
  Highlights: () => Lc,
  InterestsList: () => Rc,
  Interestsets: () => Jc,
  JobFeedback: () => xc,
  JobRequest: () => vc,
  JobResult: () => Ec,
  Label: () => bc,
  LightningPubRPC: () => Kc,
  LiveChatMessage: () => pc,
  LiveEvent: () => rl,
  LongFormArticle: () => Qc,
  Metadata: () => oc,
  Mutelist: () => kc,
  NWCWalletInfo: () => Mc,
  NWCWalletRequest: () => os,
  NWCWalletResponse: () => Dc,
  NostrConnect: () => qc,
  OpenTimestamps: () => fc,
  Pinlist: () => Ic,
  PrivateDirectMessage: () => Xi,
  ProblemTracker: () => gc,
  ProfileBadges: () => Gc,
  PublicChatsList: () => Bc,
  Reaction: () => or,
  RecommendRelay: () => ac,
  RelayList: () => Tc,
  Relaysets: () => Fc,
  Report: () => yc,
  Reporting: () => wc,
  Repost: () => sr,
  Seal: () => Yi,
  SearchRelaysList: () => Nc,
  ShortTextNote: () => Ji,
  Time: () => cl,
  UserEmojiList: () => Oc,
  UserStatuses: () => il,
  Zap: () => _c,
  ZapGoal: () => Sc,
  ZapRequest: () => Ac,
  classifyKind: () => ic,
  isAddressableKind: () => ir,
  isEphemeralKind: () => Zi,
  isKind: () => sc,
  isRegularKind: () => Gi,
  isReplaceableKind: () => rr
});
function Gi(t) {
  return t < 1e4 && t !== 0 && t !== 3;
}
function rr(t) {
  return t === 0 || t === 3 || 1e4 <= t && t < 2e4;
}
function Zi(t) {
  return 2e4 <= t && t < 3e4;
}
function ir(t) {
  return 3e4 <= t && t < 4e4;
}
function ic(t) {
  return Gi(t) ? "regular" : rr(t) ? "replaceable" : Zi(t) ? "ephemeral" : ir(t) ? "parameterized" : "unknown";
}
function sc(t, e) {
  const n = e instanceof Array ? e : [e];
  return er(t) && n.includes(t.kind) || !1;
}
var oc = 0, Ji = 1, ac = 2, cc = 3, lc = 4, uc = 5, sr = 6, or = 7, hc = 8, Yi = 13, Xi = 14, ar = 16, Qi = 40, es = 41, ts = 42, ns = 43, rs = 44, fc = 1040, is = 1059, dc = 1063, pc = 1311, gc = 1971, yc = 1984, wc = 1984, bc = 1985, mc = 4550, vc = 5999, Ec = 6999, xc = 7e3, Sc = 9041, Ac = 9734, _c = 9735, Lc = 9802, kc = 1e4, Ic = 10001, Tc = 10002, Pc = 10003, $c = 10004, Bc = 10005, Uc = 10006, Nc = 10007, Rc = 10015, Oc = 10030, Cc = 10050, Hc = 10096, Mc = 13194, Kc = 21e3, ss = 22242, os = 23194, Dc = 23195, qc = 24133, cr = 27235, Vc = 3e4, zc = 30001, Fc = 30002, Wc = 30003, jc = 30004, Gc = 30008, Zc = 30009, Jc = 30015, Yc = 30017, Xc = 30018, Qc = 30023, el = 30024, tl = 30030, nl = 30078, rl = 30311, il = 30315, sl = 30402, ol = 30403, al = 31922, cl = 31923, ll = 31924, ul = 31925, hl = 31989, fl = 31990, dl = 34550;
function pl(t, e) {
  if (t.ids && t.ids.indexOf(e.id) === -1 || t.kinds && t.kinds.indexOf(e.kind) === -1 || t.authors && t.authors.indexOf(e.pubkey) === -1)
    return !1;
  for (let n in t)
    if (n[0] === "#") {
      let r = n.slice(1), i = t[`#${r}`];
      if (i && !e.tags.find(([s, o]) => s === n.slice(1) && i.indexOf(o) !== -1))
        return !1;
    }
  return !(t.since && e.created_at < t.since || t.until && e.created_at > t.until);
}
function gl(t, e) {
  for (let n = 0; n < t.length; n++)
    if (pl(t[n], e))
      return !0;
  return !1;
}
var yl = {};
D(yl, {
  getHex64: () => rn,
  getInt: () => as,
  getSubscriptionId: () => cs,
  matchEventId: () => wl,
  matchEventKind: () => ml,
  matchEventPubkey: () => bl
});
function rn(t, e) {
  let n = e.length + 3, r = t.indexOf(`"${e}":`) + n, i = t.slice(r).indexOf('"') + r + 1;
  return t.slice(i, i + 64);
}
function as(t, e) {
  let n = e.length, r = t.indexOf(`"${e}":`) + n + 3, i = t.slice(r), s = Math.min(i.indexOf(","), i.indexOf("}"));
  return parseInt(i.slice(0, s), 10);
}
function cs(t) {
  let e = t.slice(0, 22).indexOf('"EVENT"');
  if (e === -1)
    return null;
  let n = t.slice(e + 7 + 1).indexOf('"');
  if (n === -1)
    return null;
  let r = e + 7 + 1 + n, i = t.slice(r + 1, 80).indexOf('"');
  if (i === -1)
    return null;
  let s = r + 1 + i;
  return t.slice(r + 1, s);
}
function wl(t, e) {
  return e === rn(t, "id");
}
function bl(t, e) {
  return e === rn(t, "pubkey");
}
function ml(t, e) {
  return e === as(t, "kind");
}
var vl = {};
D(vl, {
  makeAuthEvent: () => ls
});
function ls(t, e) {
  return {
    kind: ss,
    created_at: Math.floor(Date.now() / 1e3),
    tags: [
      ["relay", t],
      ["challenge", e]
    ],
    content: ""
  };
}
async function El() {
  return new Promise((t, e) => {
    try {
      if (typeof MessageChannel < "u") {
        const n = new MessageChannel(), r = () => {
          n.port1.removeEventListener("message", r), t();
        };
        n.port1.addEventListener("message", r), n.port2.postMessage(0), n.port1.start();
      } else
        typeof setImmediate < "u" ? setImmediate(t) : typeof setTimeout < "u" ? setTimeout(t, 0) : t();
    } catch (n) {
      console.error("during yield: ", n), e(n);
    }
  });
}
var xl = (t) => (t[ze] = !0, !0), us = class extends Error {
  constructor(t, e) {
    super(`Tried to send message '${t} on a closed connection to ${e}.`), this.name = "SendingOnClosedConnection";
  }
}, hs = class {
  constructor(t, e) {
    b(this, "url");
    b(this, "_connected", !1);
    b(this, "onclose", null);
    b(this, "onnotice", (t) => console.debug(`NOTICE from ${this.url}: ${t}`));
    b(this, "baseEoseTimeout", 4400);
    b(this, "connectionTimeout", 4400);
    b(this, "publishTimeout", 4400);
    b(this, "pingFrequency", 2e4);
    b(this, "pingTimeout", 2e4);
    b(this, "resubscribeBackoff", [1e4, 1e4, 1e4, 2e4, 2e4, 3e4, 6e4]);
    b(this, "openSubs", /* @__PURE__ */ new Map());
    b(this, "enablePing");
    b(this, "enableReconnect");
    b(this, "connectionTimeoutHandle");
    b(this, "reconnectTimeoutHandle");
    b(this, "pingTimeoutHandle");
    b(this, "reconnectAttempts", 0);
    b(this, "closedIntentionally", !1);
    b(this, "connectionPromise");
    b(this, "openCountRequests", /* @__PURE__ */ new Map());
    b(this, "openEventPublishes", /* @__PURE__ */ new Map());
    b(this, "ws");
    b(this, "incomingMessageQueue", new ji());
    b(this, "queueRunning", !1);
    b(this, "challenge");
    b(this, "authPromise");
    b(this, "serial", 0);
    b(this, "verifyEvent");
    b(this, "_WebSocket");
    this.url = We(t), this.verifyEvent = e.verifyEvent, this._WebSocket = e.websocketImplementation || WebSocket, this.enablePing = e.enablePing, this.enableReconnect = e.enableReconnect || !1;
  }
  static async connect(t, e) {
    const n = new hs(t, e);
    return await n.connect(), n;
  }
  closeAllSubscriptions(t) {
    for (let [e, n] of this.openSubs)
      n.close(t);
    this.openSubs.clear();
    for (let [e, n] of this.openEventPublishes)
      n.reject(new Error(t));
    this.openEventPublishes.clear();
    for (let [e, n] of this.openCountRequests)
      n.reject(new Error(t));
    this.openCountRequests.clear();
  }
  get connected() {
    return this._connected;
  }
  async reconnect() {
    const t = this.resubscribeBackoff[Math.min(this.reconnectAttempts, this.resubscribeBackoff.length - 1)];
    this.reconnectAttempts++, this.reconnectTimeoutHandle = setTimeout(async () => {
      try {
        await this.connect();
      } catch {
      }
    }, t);
  }
  handleHardClose(t) {
    var n;
    this.pingTimeoutHandle && (clearTimeout(this.pingTimeoutHandle), this.pingTimeoutHandle = void 0), this._connected = !1, this.connectionPromise = void 0;
    const e = this.closedIntentionally;
    this.closedIntentionally = !1, (n = this.onclose) == null || n.call(this), this.enableReconnect && !e ? this.reconnect() : this.closeAllSubscriptions(t);
  }
  async connect() {
    return this.connectionPromise ? this.connectionPromise : (this.challenge = void 0, this.authPromise = void 0, this.connectionPromise = new Promise((t, e) => {
      this.connectionTimeoutHandle = setTimeout(() => {
        var n;
        e("connection timed out"), this.connectionPromise = void 0, (n = this.onclose) == null || n.call(this), this.closeAllSubscriptions("relay connection timed out");
      }, this.connectionTimeout);
      try {
        this.ws = new this._WebSocket(this.url);
      } catch (n) {
        clearTimeout(this.connectionTimeoutHandle), e(n);
        return;
      }
      this.ws.onopen = () => {
        this.reconnectTimeoutHandle && (clearTimeout(this.reconnectTimeoutHandle), this.reconnectTimeoutHandle = void 0), clearTimeout(this.connectionTimeoutHandle), this._connected = !0, this.reconnectAttempts = 0;
        for (const n of this.openSubs.values())
          n.eosed = !1, typeof this.enableReconnect == "function" && (n.filters = this.enableReconnect(n.filters)), n.fire();
        this.enablePing && this.pingpong(), t();
      }, this.ws.onerror = (n) => {
        clearTimeout(this.connectionTimeoutHandle), e(n.message || "websocket error"), this.handleHardClose("relay connection errored");
      }, this.ws.onclose = (n) => {
        clearTimeout(this.connectionTimeoutHandle), e(n.message || "websocket closed"), this.handleHardClose("relay connection closed");
      }, this.ws.onmessage = this._onmessage.bind(this);
    }), this.connectionPromise);
  }
  waitForPingPong() {
    return new Promise((t) => {
      this.ws.once("pong", () => t(!0)), this.ws.ping();
    });
  }
  async waitForDummyReq() {
    return new Promise((t, e) => {
      const n = this.subscribe([{ ids: ["a".repeat(64)] }], {
        oneose: () => {
          n.close(), t(!0);
        },
        eoseTimeout: this.pingTimeout + 1e3
      });
    });
  }
  async pingpong() {
    var t, e, n;
    ((t = this.ws) == null ? void 0 : t.readyState) === 1 && (await Promise.any([
      this.ws && this.ws.ping && this.ws.once ? this.waitForPingPong() : this.waitForDummyReq(),
      new Promise((i) => setTimeout(() => i(!1), this.pingTimeout))
    ]) ? this.pingTimeoutHandle = setTimeout(() => this.pingpong(), this.pingFrequency) : ((e = this.ws) == null ? void 0 : e.readyState) === this._WebSocket.OPEN && ((n = this.ws) == null || n.close()));
  }
  async runQueue() {
    for (this.queueRunning = !0; this.handleNext() !== !1; )
      await El();
    this.queueRunning = !1;
  }
  handleNext() {
    var n, r, i;
    const t = this.incomingMessageQueue.dequeue();
    if (!t)
      return !1;
    const e = cs(t);
    if (e) {
      const s = this.openSubs.get(e);
      if (!s)
        return;
      const o = rn(t, "id"), a = (n = s.alreadyHaveEvent) == null ? void 0 : n.call(s, o);
      if ((r = s.receivedEvent) == null || r.call(s, this, o), a)
        return;
    }
    try {
      let s = JSON.parse(t);
      switch (s[0]) {
        case "EVENT": {
          const o = this.openSubs.get(s[1]), a = s[2];
          this.verifyEvent(a) && gl(o.filters, a) && o.onevent(a);
          return;
        }
        case "COUNT": {
          const o = s[1], a = s[2], c = this.openCountRequests.get(o);
          c && (c.resolve(a.count), this.openCountRequests.delete(o));
          return;
        }
        case "EOSE": {
          const o = this.openSubs.get(s[1]);
          if (!o)
            return;
          o.receivedEose();
          return;
        }
        case "OK": {
          const o = s[1], a = s[2], c = s[3], u = this.openEventPublishes.get(o);
          u && (clearTimeout(u.timeout), a ? u.resolve(c) : u.reject(new Error(c)), this.openEventPublishes.delete(o));
          return;
        }
        case "CLOSED": {
          const o = s[1], a = this.openSubs.get(o);
          if (!a)
            return;
          a.closed = !0, a.close(s[2]);
          return;
        }
        case "NOTICE": {
          this.onnotice(s[1]);
          return;
        }
        case "AUTH": {
          this.challenge = s[1];
          return;
        }
        default: {
          const o = this.openSubs.get(s[1]);
          (i = o == null ? void 0 : o.oncustom) == null || i.call(o, s);
          return;
        }
      }
    } catch {
      return;
    }
  }
  async send(t) {
    if (!this.connectionPromise)
      throw new us(t, this.url);
    this.connectionPromise.then(() => {
      var e;
      (e = this.ws) == null || e.send(t);
    });
  }
  async auth(t) {
    const e = this.challenge;
    if (!e)
      throw new Error("can't perform auth, no challenge was received");
    return this.authPromise ? this.authPromise : (this.authPromise = new Promise(async (n, r) => {
      try {
        let i = await t(ls(this.url, e)), s = setTimeout(() => {
          let o = this.openEventPublishes.get(i.id);
          o && (o.reject(new Error("auth timed out")), this.openEventPublishes.delete(i.id));
        }, this.publishTimeout);
        this.openEventPublishes.set(i.id, { resolve: n, reject: r, timeout: s }), this.send('["AUTH",' + JSON.stringify(i) + "]");
      } catch (i) {
        console.warn("subscribe auth function failed:", i);
      }
    }), this.authPromise);
  }
  async publish(t) {
    const e = new Promise((n, r) => {
      const i = setTimeout(() => {
        const s = this.openEventPublishes.get(t.id);
        s && (s.reject(new Error("publish timed out")), this.openEventPublishes.delete(t.id));
      }, this.publishTimeout);
      this.openEventPublishes.set(t.id, { resolve: n, reject: r, timeout: i });
    });
    return this.send('["EVENT",' + JSON.stringify(t) + "]"), e;
  }
  async count(t, e) {
    this.serial++;
    const n = (e == null ? void 0 : e.id) || "count:" + this.serial, r = new Promise((i, s) => {
      this.openCountRequests.set(n, { resolve: i, reject: s });
    });
    return this.send('["COUNT","' + n + '",' + JSON.stringify(t).substring(1)), r;
  }
  subscribe(t, e) {
    const n = this.prepareSubscription(t, e);
    return n.fire(), n;
  }
  prepareSubscription(t, e) {
    this.serial++;
    const n = e.id || (e.label ? e.label + ":" : "sub:") + this.serial, r = new Sl(this, n, t, e);
    return this.openSubs.set(n, r), r;
  }
  close() {
    var t, e, n;
    this.closedIntentionally = !0, this.reconnectTimeoutHandle && (clearTimeout(this.reconnectTimeoutHandle), this.reconnectTimeoutHandle = void 0), this.pingTimeoutHandle && (clearTimeout(this.pingTimeoutHandle), this.pingTimeoutHandle = void 0), this.closeAllSubscriptions("relay connection closed by us"), this._connected = !1, (t = this.onclose) == null || t.call(this), ((e = this.ws) == null ? void 0 : e.readyState) === this._WebSocket.OPEN && ((n = this.ws) == null || n.close());
  }
  _onmessage(t) {
    this.incomingMessageQueue.enqueue(t.data), this.queueRunning || this.runQueue();
  }
}, Sl = class {
  constructor(t, e, n, r) {
    b(this, "relay");
    b(this, "id");
    b(this, "closed", !1);
    b(this, "eosed", !1);
    b(this, "filters");
    b(this, "alreadyHaveEvent");
    b(this, "receivedEvent");
    b(this, "onevent");
    b(this, "oneose");
    b(this, "onclose");
    b(this, "oncustom");
    b(this, "eoseTimeout");
    b(this, "eoseTimeoutHandle");
    if (n.length === 0)
      throw new Error("subscription can't be created with zero filters");
    this.relay = t, this.filters = n, this.id = e, this.alreadyHaveEvent = r.alreadyHaveEvent, this.receivedEvent = r.receivedEvent, this.eoseTimeout = r.eoseTimeout || t.baseEoseTimeout, this.oneose = r.oneose, this.onclose = r.onclose, this.onevent = r.onevent || ((i) => {
      console.warn(
        `onevent() callback not defined for subscription '${this.id}' in relay ${this.relay.url}. event received:`,
        i
      );
    });
  }
  fire() {
    this.relay.send('["REQ","' + this.id + '",' + JSON.stringify(this.filters).substring(1)), this.eoseTimeoutHandle = setTimeout(this.receivedEose.bind(this), this.eoseTimeout);
  }
  receivedEose() {
    var t;
    this.eosed || (clearTimeout(this.eoseTimeoutHandle), this.eosed = !0, (t = this.oneose) == null || t.call(this));
  }
  close(t = "closed by caller") {
    var e;
    if (!this.closed && this.relay.connected) {
      try {
        this.relay.send('["CLOSE",' + JSON.stringify(this.id) + "]");
      } catch (n) {
        if (!(n instanceof us)) throw n;
      }
      this.closed = !0;
    }
    this.relay.openSubs.delete(this.id), (e = this.onclose) == null || e.call(this, t);
  }
}, Al;
try {
  Al = WebSocket;
} catch {
}
var _l = class {
  constructor(t) {
    b(this, "relays", /* @__PURE__ */ new Map());
    b(this, "seenOn", /* @__PURE__ */ new Map());
    b(this, "trackRelays", !1);
    b(this, "verifyEvent");
    b(this, "enablePing");
    b(this, "enableReconnect");
    b(this, "trustedRelayURLs", /* @__PURE__ */ new Set());
    b(this, "_WebSocket");
    this.verifyEvent = t.verifyEvent, this._WebSocket = t.websocketImplementation, this.enablePing = t.enablePing, this.enableReconnect = t.enableReconnect;
  }
  async ensureRelay(t, e) {
    t = We(t);
    let n = this.relays.get(t);
    return n || (n = new hs(t, {
      verifyEvent: this.trustedRelayURLs.has(t) ? xl : this.verifyEvent,
      websocketImplementation: this._WebSocket,
      enablePing: this.enablePing,
      enableReconnect: this.enableReconnect
    }), n.onclose = () => {
      n && !n.enableReconnect && this.relays.delete(t);
    }, e != null && e.connectionTimeout && (n.connectionTimeout = e.connectionTimeout), this.relays.set(t, n)), await n.connect(), n;
  }
  close(t) {
    t.map(We).forEach((e) => {
      var n;
      (n = this.relays.get(e)) == null || n.close(), this.relays.delete(e);
    });
  }
  subscribe(t, e, n) {
    n.onauth = n.onauth || n.doauth;
    const r = [];
    for (let i = 0; i < t.length; i++) {
      const s = We(t[i]);
      r.find((o) => o.url === s) || r.push({ url: s, filter: e });
    }
    return this.subscribeMap(r, n);
  }
  subscribeMany(t, e, n) {
    n.onauth = n.onauth || n.doauth;
    const r = [], i = [];
    for (let s = 0; s < t.length; s++) {
      const o = We(t[s]);
      i.indexOf(o) === -1 && (i.push(o), r.push({ url: o, filter: e }));
    }
    return this.subscribeMap(r, n);
  }
  subscribeMap(t, e) {
    e.onauth = e.onauth || e.doauth;
    const n = /* @__PURE__ */ new Map();
    for (const d of t) {
      const { url: p, filter: g } = d;
      n.has(p) || n.set(p, []), n.get(p).push(g);
    }
    const r = Array.from(n.entries()).map(([d, p]) => ({ url: d, filters: p }));
    this.trackRelays && (e.receivedEvent = (d, p) => {
      let g = this.seenOn.get(p);
      g || (g = /* @__PURE__ */ new Set(), this.seenOn.set(p, g)), g.add(d);
    });
    const i = /* @__PURE__ */ new Set(), s = [], o = [];
    let a = (d) => {
      var p;
      o[d] || (o[d] = !0, o.filter((g) => g).length === r.length && ((p = e.oneose) == null || p.call(e), a = () => {
      }));
    };
    const c = [];
    let u = (d, p) => {
      var g;
      c[d] || (a(d), c[d] = p, c.filter((f) => f).length === r.length && ((g = e.onclose) == null || g.call(e, c), u = () => {
      }));
    };
    const h = (d) => {
      var g;
      if ((g = e.alreadyHaveEvent) != null && g.call(e, d))
        return !0;
      const p = i.has(d);
      return i.add(d), p;
    }, l = Promise.all(
      r.map(async ({ url: d, filters: p }, g) => {
        let f;
        try {
          f = await this.ensureRelay(d, {
            connectionTimeout: e.maxWait ? Math.max(e.maxWait * 0.8, e.maxWait - 1e3) : void 0
          });
        } catch (w) {
          u(g, (w == null ? void 0 : w.message) || String(w));
          return;
        }
        let y = f.subscribe(p, {
          ...e,
          oneose: () => a(g),
          onclose: (w) => {
            w.startsWith("auth-required: ") && e.onauth ? f.auth(e.onauth).then(() => {
              f.subscribe(p, {
                ...e,
                oneose: () => a(g),
                onclose: (m) => {
                  u(g, m);
                },
                alreadyHaveEvent: h,
                eoseTimeout: e.maxWait
              });
            }).catch((m) => {
              u(g, `auth was required and attempted, but failed with: ${m}`);
            }) : u(g, w);
          },
          alreadyHaveEvent: h,
          eoseTimeout: e.maxWait
        });
        s.push(y);
      })
    );
    return {
      async close(d) {
        await l, s.forEach((p) => {
          p.close(d);
        });
      }
    };
  }
  subscribeEose(t, e, n) {
    n.onauth = n.onauth || n.doauth;
    const r = this.subscribe(t, e, {
      ...n,
      oneose() {
        r.close("closed automatically on eose");
      }
    });
    return r;
  }
  subscribeManyEose(t, e, n) {
    n.onauth = n.onauth || n.doauth;
    const r = this.subscribeMany(t, e, {
      ...n,
      oneose() {
        r.close("closed automatically on eose");
      }
    });
    return r;
  }
  async querySync(t, e, n) {
    return new Promise(async (r) => {
      const i = [];
      this.subscribeEose(t, e, {
        ...n,
        onevent(s) {
          i.push(s);
        },
        onclose(s) {
          r(i);
        }
      });
    });
  }
  async get(t, e, n) {
    e.limit = 1;
    const r = await this.querySync(t, e, n);
    return r.sort((i, s) => s.created_at - i.created_at), r[0] || null;
  }
  publish(t, e, n) {
    return t.map(We).map(async (r, i, s) => {
      if (s.indexOf(r) !== i)
        return Promise.reject("duplicate url");
      let o = await this.ensureRelay(r);
      return o.publish(e).catch(async (a) => {
        if (a instanceof Error && a.message.startsWith("auth-required: ") && (n != null && n.onauth))
          return await o.auth(n.onauth), o.publish(e);
        throw a;
      }).then((a) => {
        if (this.trackRelays) {
          let c = this.seenOn.get(e.id);
          c || (c = /* @__PURE__ */ new Set(), this.seenOn.set(e.id, c)), c.add(o);
        }
        return a;
      });
    });
  }
  listConnectionStatus() {
    const t = /* @__PURE__ */ new Map();
    return this.relays.forEach((e, n) => t.set(n, e.connected)), t;
  }
  destroy() {
    this.relays.forEach((t) => t.close()), this.relays = /* @__PURE__ */ new Map();
  }
}, fs;
try {
  fs = WebSocket;
} catch {
}
var Wr = class extends _l {
  constructor(t) {
    super({ verifyEvent: nn, websocketImplementation: fs, ...t });
  }
}, Ll = {};
D(Ll, {
  BECH32_REGEX: () => ds,
  Bech32MaxSize: () => lr,
  NostrTypeGuard: () => kl,
  decode: () => sn,
  decodeNostrURI: () => Tl,
  encodeBytes: () => an,
  naddrEncode: () => Rl,
  neventEncode: () => Nl,
  noteEncode: () => Bl,
  nprofileEncode: () => Ul,
  npubEncode: () => $l,
  nsecEncode: () => Pl
});
var kl = {
  isNProfile: (t) => /^nprofile1[a-z\d]+$/.test(t || ""),
  isNEvent: (t) => /^nevent1[a-z\d]+$/.test(t || ""),
  isNAddr: (t) => /^naddr1[a-z\d]+$/.test(t || ""),
  isNSec: (t) => /^nsec1[a-z\d]{58}$/.test(t || ""),
  isNPub: (t) => /^npub1[a-z\d]{58}$/.test(t || ""),
  isNote: (t) => /^note1[a-z\d]+$/.test(t || ""),
  isNcryptsec: (t) => /^ncryptsec1[a-z\d]+$/.test(t || "")
}, lr = 5e3, ds = /[\x21-\x7E]{1,83}1[023456789acdefghjklmnpqrstuvwxyz]{6,}/;
function Il(t) {
  const e = new Uint8Array(4);
  return e[0] = t >> 24 & 255, e[1] = t >> 16 & 255, e[2] = t >> 8 & 255, e[3] = t & 255, e;
}
function Tl(t) {
  try {
    return t.startsWith("nostr:") && (t = t.substring(6)), sn(t);
  } catch {
    return { type: "invalid", data: null };
  }
}
function sn(t) {
  var i, s, o, a, c, u, h;
  let { prefix: e, words: n } = Me.decode(t, lr), r = new Uint8Array(Me.fromWords(n));
  switch (e) {
    case "nprofile": {
      let l = xn(r);
      if (!((i = l[0]) != null && i[0]))
        throw new Error("missing TLV 0 for nprofile");
      if (l[0][0].length !== 32)
        throw new Error("TLV 0 should be 32 bytes");
      return {
        type: "nprofile",
        data: {
          pubkey: C(l[0][0]),
          relays: l[1] ? l[1].map((d) => ve.decode(d)) : []
        }
      };
    }
    case "nevent": {
      let l = xn(r);
      if (!((s = l[0]) != null && s[0]))
        throw new Error("missing TLV 0 for nevent");
      if (l[0][0].length !== 32)
        throw new Error("TLV 0 should be 32 bytes");
      if (l[2] && l[2][0].length !== 32)
        throw new Error("TLV 2 should be 32 bytes");
      if (l[3] && l[3][0].length !== 4)
        throw new Error("TLV 3 should be 4 bytes");
      return {
        type: "nevent",
        data: {
          id: C(l[0][0]),
          relays: l[1] ? l[1].map((d) => ve.decode(d)) : [],
          author: (o = l[2]) != null && o[0] ? C(l[2][0]) : void 0,
          kind: (a = l[3]) != null && a[0] ? parseInt(C(l[3][0]), 16) : void 0
        }
      };
    }
    case "naddr": {
      let l = xn(r);
      if (!((c = l[0]) != null && c[0]))
        throw new Error("missing TLV 0 for naddr");
      if (!((u = l[2]) != null && u[0]))
        throw new Error("missing TLV 2 for naddr");
      if (l[2][0].length !== 32)
        throw new Error("TLV 2 should be 32 bytes");
      if (!((h = l[3]) != null && h[0]))
        throw new Error("missing TLV 3 for naddr");
      if (l[3][0].length !== 4)
        throw new Error("TLV 3 should be 4 bytes");
      return {
        type: "naddr",
        data: {
          identifier: ve.decode(l[0][0]),
          pubkey: C(l[2][0]),
          kind: parseInt(C(l[3][0]), 16),
          relays: l[1] ? l[1].map((d) => ve.decode(d)) : []
        }
      };
    }
    case "nsec":
      return { type: e, data: r };
    case "npub":
    case "note":
      return { type: e, data: C(r) };
    default:
      throw new Error(`unknown prefix ${e}`);
  }
}
function xn(t) {
  let e = {}, n = t;
  for (; n.length > 0; ) {
    let r = n[0], i = n[1], s = n.slice(2, 2 + i);
    if (n = n.slice(2 + i), s.length < i)
      throw new Error(`not enough data to read on TLV ${r}`);
    e[r] = e[r] || [], e[r].push(s);
  }
  return e;
}
function Pl(t) {
  return an("nsec", t);
}
function $l(t) {
  return an("npub", Ze(t));
}
function Bl(t) {
  return an("note", Ze(t));
}
function on(t, e) {
  let n = Me.toWords(e);
  return Me.encode(t, n, lr);
}
function an(t, e) {
  return on(t, e);
}
function Ul(t) {
  let e = ur({
    0: [Ze(t.pubkey)],
    1: (t.relays || []).map((n) => ne.encode(n))
  });
  return on("nprofile", e);
}
function Nl(t) {
  let e;
  t.kind !== void 0 && (e = Il(t.kind));
  let n = ur({
    0: [Ze(t.id)],
    1: (t.relays || []).map((r) => ne.encode(r)),
    2: t.author ? [Ze(t.author)] : [],
    3: e ? [new Uint8Array(e)] : []
  });
  return on("nevent", n);
}
function Rl(t) {
  let e = new ArrayBuffer(4);
  new DataView(e).setUint32(0, t.kind, !1);
  let n = ur({
    0: [ne.encode(t.identifier)],
    1: (t.relays || []).map((r) => ne.encode(r)),
    2: [Ze(t.pubkey)],
    3: [new Uint8Array(e)]
  });
  return on("naddr", n);
}
function ur(t) {
  let e = [];
  return Object.entries(t).reverse().forEach(([n, r]) => {
    r.forEach((i) => {
      let s = new Uint8Array(i.length + 2);
      s.set([parseInt(n)], 0), s.set([i.length], 1), s.set(i, 2), e.push(s);
    });
  }), Ye(...e);
}
var Ol = {};
D(Ol, {
  decrypt: () => Cl,
  encrypt: () => ps
});
function ps(t, e, n) {
  const r = t instanceof Uint8Array ? C(t) : t, i = Ae.getSharedSecret(r, "02" + e), s = gs(i);
  let o = Uint8Array.from(Yt(16)), a = ne.encode(n), c = Qt(s, o).encrypt(a), u = G.encode(new Uint8Array(c)), h = G.encode(new Uint8Array(o.buffer));
  return `${u}?iv=${h}`;
}
function Cl(t, e, n) {
  const r = t instanceof Uint8Array ? C(t) : t;
  let [i, s] = n.split("?iv="), o = Ae.getSharedSecret(r, "02" + e), a = gs(o), c = G.decode(s), u = G.decode(i), h = Qt(a, c).decrypt(u);
  return ve.decode(h);
}
function gs(t) {
  return t.slice(1, 33);
}
var Hl = {};
D(Hl, {
  NIP05_REGEX: () => hr,
  isNip05: () => Ml,
  isValid: () => ql,
  queryProfile: () => ys,
  searchDomain: () => Dl,
  useFetchImplementation: () => Kl
});
var hr = /^(?:([\w.+-]+)@)?([\w_-]+(\.[\w_-]+)+)$/, Ml = (t) => hr.test(t || ""), cn;
try {
  cn = fetch;
} catch {
}
function Kl(t) {
  cn = t;
}
async function Dl(t, e = "") {
  try {
    const n = `https://${t}/.well-known/nostr.json?name=${e}`, r = await cn(n, { redirect: "manual" });
    if (r.status !== 200)
      throw Error("Wrong response code");
    return (await r.json()).names;
  } catch {
    return {};
  }
}
async function ys(t) {
  var i;
  const e = t.match(hr);
  if (!e)
    return null;
  const [, n = "_", r] = e;
  try {
    const s = `https://${r}/.well-known/nostr.json?name=${n}`, o = await cn(s, { redirect: "manual" });
    if (o.status !== 200)
      throw Error("Wrong response code");
    const a = await o.json(), c = a.names[n];
    return c ? { pubkey: c, relays: (i = a.relays) == null ? void 0 : i[c] } : null;
  } catch {
    return null;
  }
}
async function ql(t, e) {
  const n = await ys(e);
  return n ? n.pubkey === t : !1;
}
var Vl = {};
D(Vl, {
  parse: () => zl
});
function zl(t) {
  const e = {
    reply: void 0,
    root: void 0,
    mentions: [],
    profiles: [],
    quotes: []
  };
  let n, r;
  for (let i = t.tags.length - 1; i >= 0; i--) {
    const s = t.tags[i];
    if (s[0] === "e" && s[1]) {
      const [o, a, c, u, h] = s, l = {
        id: a,
        relays: c ? [c] : [],
        author: h
      };
      if (u === "root") {
        e.root = l;
        continue;
      }
      if (u === "reply") {
        e.reply = l;
        continue;
      }
      if (u === "mention") {
        e.mentions.push(l);
        continue;
      }
      n ? r = l : n = l, e.mentions.push(l);
      continue;
    }
    if (s[0] === "q" && s[1]) {
      const [o, a, c] = s;
      e.quotes.push({
        id: a,
        relays: c ? [c] : []
      });
    }
    if (s[0] === "p" && s[1]) {
      e.profiles.push({
        pubkey: s[1],
        relays: s[2] ? [s[2]] : []
      });
      continue;
    }
  }
  return e.root || (e.root = r || n || e.reply), e.reply || (e.reply = n || e.root), [e.reply, e.root].forEach((i) => {
    if (!i)
      return;
    let s = e.mentions.indexOf(i);
    if (s !== -1 && e.mentions.splice(s, 1), i.author) {
      let o = e.profiles.find((a) => a.pubkey === i.author);
      o && o.relays && (i.relays || (i.relays = []), o.relays.forEach((a) => {
        var c;
        ((c = i.relays) == null ? void 0 : c.indexOf(a)) === -1 && i.relays.push(a);
      }), o.relays = i.relays);
    }
  }), e.mentions.forEach((i) => {
    if (i.author) {
      let s = e.profiles.find((o) => o.pubkey === i.author);
      s && s.relays && (i.relays || (i.relays = []), s.relays.forEach((o) => {
        i.relays.indexOf(o) === -1 && i.relays.push(o);
      }), s.relays = i.relays);
    }
  }), e;
}
var Fl = {};
D(Fl, {
  fetchRelayInformation: () => jl,
  useFetchImplementation: () => Wl
});
var ws;
try {
  ws = fetch;
} catch {
}
function Wl(t) {
  ws = t;
}
async function jl(t) {
  return await (await fetch(t.replace("ws://", "http://").replace("wss://", "https://"), {
    headers: { Accept: "application/nostr+json" }
  })).json();
}
var Gl = {};
D(Gl, {
  fastEventHash: () => ms,
  getPow: () => bs,
  minePow: () => Zl
});
function bs(t) {
  let e = 0;
  for (let n = 0; n < 64; n += 8) {
    const r = parseInt(t.substring(n, n + 8), 16);
    if (r === 0)
      e += 32;
    else {
      e += Math.clz32(r);
      break;
    }
  }
  return e;
}
function Zl(t, e) {
  let n = 0;
  const r = t, i = ["nonce", n.toString(), e.toString()];
  for (r.tags.push(i); ; ) {
    const s = Math.floor((/* @__PURE__ */ new Date()).getTime() / 1e3);
    if (s !== r.created_at && (n = 0, r.created_at = s), i[1] = (++n).toString(), r.id = ms(r), bs(r.id) >= e)
      break;
  }
  return r;
}
function ms(t) {
  return C(
    re(ne.encode(JSON.stringify([0, t.pubkey, t.created_at, t.kind, t.tags, t.content])))
  );
}
var Jl = {};
D(Jl, {
  unwrapEvent: () => cu,
  unwrapManyEvents: () => lu,
  wrapEvent: () => Bs,
  wrapManyEvents: () => au
});
var Yl = {};
D(Yl, {
  createRumor: () => Is,
  createSeal: () => Ts,
  createWrap: () => Ps,
  unwrapEvent: () => yr,
  unwrapManyEvents: () => $s,
  wrapEvent: () => Dt,
  wrapManyEvents: () => su
});
var Xl = {};
D(Xl, {
  decrypt: () => gr,
  encrypt: () => pr,
  getConversationKey: () => fr,
  v2: () => ru
});
var vs = 1, Es = 65535;
function fr(t, e) {
  const n = Ae.getSharedSecret(t, "02" + e).subarray(1, 33);
  return zi(re, n, "nip44-v2");
}
function xs(t, e) {
  const n = Fi(re, t, e, 76);
  return {
    chacha_key: n.subarray(0, 32),
    chacha_nonce: n.subarray(32, 44),
    hmac_key: n.subarray(44, 76)
  };
}
function dr(t) {
  if (!Number.isSafeInteger(t) || t < 1)
    throw new Error("expected positive integer");
  if (t <= 32)
    return 32;
  const e = 1 << Math.floor(Math.log2(t - 1)) + 1, n = e <= 256 ? 32 : e / 8;
  return n * (Math.floor((t - 1) / n) + 1);
}
function Ql(t) {
  if (!Number.isSafeInteger(t) || t < vs || t > Es)
    throw new Error("invalid plaintext size: must be between 1 and 65535 bytes");
  const e = new Uint8Array(2);
  return new DataView(e.buffer).setUint16(0, t, !1), e;
}
function eu(t) {
  const e = ne.encode(t), n = e.length, r = Ql(n), i = new Uint8Array(dr(n) - n);
  return Ye(r, e, i);
}
function tu(t) {
  const e = new DataView(t.buffer).getUint16(0), n = t.subarray(2, 2 + e);
  if (e < vs || e > Es || n.length !== e || t.length !== 2 + dr(e))
    throw new Error("invalid padding");
  return ve.decode(n);
}
function Ss(t, e, n) {
  if (n.length !== 32)
    throw new Error("AAD associated data must be 32 bytes");
  const r = Ye(n, e);
  return xt(re, t, r);
}
function nu(t) {
  if (typeof t != "string")
    throw new Error("payload must be a valid string");
  const e = t.length;
  if (e < 132 || e > 87472)
    throw new Error("invalid payload length: " + e);
  if (t[0] === "#")
    throw new Error("unknown encryption version");
  let n;
  try {
    n = G.decode(t);
  } catch (s) {
    throw new Error("invalid base64: " + s.message);
  }
  const r = n.length;
  if (r < 99 || r > 65603)
    throw new Error("invalid data length: " + r);
  const i = n[0];
  if (i !== 2)
    throw new Error("unknown encryption version " + i);
  return {
    nonce: n.subarray(1, 33),
    ciphertext: n.subarray(33, -32),
    mac: n.subarray(-32)
  };
}
function pr(t, e, n = Yt(32)) {
  const { chacha_key: r, chacha_nonce: i, hmac_key: s } = xs(e, n), o = eu(t), a = en(r, i, o), c = Ss(s, a, n);
  return G.encode(Ye(new Uint8Array([2]), n, a, c));
}
function gr(t, e) {
  const { nonce: n, ciphertext: r, mac: i } = nu(t), { chacha_key: s, chacha_nonce: o, hmac_key: a } = xs(e, n), c = Ss(a, r, n);
  if (!Ri(c, i))
    throw new Error("invalid MAC");
  const u = en(s, o, r);
  return tu(u);
}
var ru = {
  utils: {
    getConversationKey: fr,
    calcPaddedLen: dr
  },
  encrypt: pr,
  decrypt: gr
}, iu = 2 * 24 * 60 * 60, As = () => Math.round(Date.now() / 1e3), _s = () => Math.round(As() - Math.random() * iu), Ls = (t, e) => fr(t, e), ks = (t, e, n) => pr(JSON.stringify(t), Ls(e, n)), jr = (t, e) => JSON.parse(gr(t.content, Ls(e, t.pubkey)));
function Is(t, e) {
  const n = {
    created_at: As(),
    content: "",
    tags: [],
    ...t,
    pubkey: nr(e)
  };
  return n.id = $t(n), n;
}
function Ts(t, e, n) {
  return de(
    {
      kind: Yi,
      content: ks(t, e, n),
      created_at: _s(),
      tags: []
    },
    e
  );
}
function Ps(t, e) {
  const n = Bt();
  return de(
    {
      kind: is,
      content: ks(t, n, e),
      created_at: _s(),
      tags: [["p", e]]
    },
    n
  );
}
function Dt(t, e, n) {
  const r = Is(t, e), i = Ts(r, e, n);
  return Ps(i, n);
}
function su(t, e, n) {
  if (!n || n.length === 0)
    throw new Error("At least one recipient is required.");
  const r = nr(e), i = [Dt(t, e, r)];
  return n.forEach((s) => {
    i.push(Dt(t, e, s));
  }), i;
}
function yr(t, e) {
  const n = jr(t, e);
  return jr(n, e);
}
function $s(t, e) {
  let n = [];
  return t.forEach((r) => {
    n.push(yr(r, e));
  }), n.sort((r, i) => r.created_at - i.created_at), n;
}
function ou(t, e, n, r) {
  const i = {
    created_at: Math.ceil(Date.now() / 1e3),
    kind: Xi,
    tags: [],
    content: e
  };
  return (Array.isArray(t) ? t : [t]).forEach(({ publicKey: o, relayUrl: a }) => {
    i.tags.push(a ? ["p", o, a] : ["p", o]);
  }), r && i.tags.push(["e", r.eventId, r.relayUrl || "", "reply"]), n && i.tags.push(["subject", n]), i;
}
function Bs(t, e, n, r, i) {
  const s = ou(e, n, r, i);
  return Dt(s, t, e.publicKey);
}
function au(t, e, n, r, i) {
  if (!e || e.length === 0)
    throw new Error("At least one recipient is required.");
  return [{ publicKey: nr(t) }, ...e].map(
    (o) => Bs(t, o, n, r, i)
  );
}
var cu = yr, lu = $s, uu = {};
D(uu, {
  finishRepostEvent: () => hu,
  getRepostedEvent: () => fu,
  getRepostedEventPointer: () => Us
});
function hu(t, e, n, r) {
  var o;
  let i;
  const s = [...t.tags ?? [], ["e", e.id, n], ["p", e.pubkey]];
  return e.kind === Ji ? i = sr : (i = ar, s.push(["k", String(e.kind)])), de(
    {
      kind: i,
      tags: s,
      content: t.content === "" || (o = e.tags) != null && o.find((a) => a[0] === "-") ? "" : JSON.stringify(e),
      created_at: t.created_at
    },
    r
  );
}
function Us(t) {
  if (![sr, ar].includes(t.kind))
    return;
  let e, n;
  for (let r = t.tags.length - 1; r >= 0 && (e === void 0 || n === void 0); r--) {
    const i = t.tags[r];
    i.length >= 2 && (i[0] === "e" && e === void 0 ? e = i : i[0] === "p" && n === void 0 && (n = i));
  }
  if (e !== void 0)
    return {
      id: e[1],
      relays: [e[2], n == null ? void 0 : n[2]].filter((r) => typeof r == "string"),
      author: n == null ? void 0 : n[1]
    };
}
function fu(t, { skipVerification: e } = {}) {
  const n = Us(t);
  if (n === void 0 || t.content === "")
    return;
  let r;
  try {
    r = JSON.parse(t.content);
  } catch {
    return;
  }
  if (r.id === n.id && !(!e && !nn(r)))
    return r;
}
var du = {};
D(du, {
  NOSTR_URI_REGEX: () => wr,
  parse: () => gu,
  test: () => pu
});
var wr = new RegExp(`nostr:(${ds.source})`);
function pu(t) {
  return typeof t == "string" && new RegExp(`^${wr.source}$`).test(t);
}
function gu(t) {
  const e = t.match(new RegExp(`^${wr.source}$`));
  if (!e)
    throw new Error(`Invalid Nostr URI: ${t}`);
  return {
    uri: e[0],
    value: e[1],
    decoded: sn(e[1])
  };
}
var yu = {};
D(yu, {
  finishReactionEvent: () => wu,
  getReactedEventPointer: () => bu
});
function wu(t, e, n) {
  const r = e.tags.filter((i) => i.length >= 2 && (i[0] === "e" || i[0] === "p"));
  return de(
    {
      ...t,
      kind: or,
      tags: [...t.tags ?? [], ...r, ["e", e.id], ["p", e.pubkey]],
      content: t.content ?? "+"
    },
    n
  );
}
function bu(t) {
  if (t.kind !== or)
    return;
  let e, n;
  for (let r = t.tags.length - 1; r >= 0 && (e === void 0 || n === void 0); r--) {
    const i = t.tags[r];
    i.length >= 2 && (i[0] === "e" && e === void 0 ? e = i : i[0] === "p" && n === void 0 && (n = i));
  }
  if (!(e === void 0 || n === void 0))
    return {
      id: e[1],
      relays: [e[2], n[2]].filter((r) => r !== void 0),
      author: n[1]
    };
}
var mu = {};
D(mu, {
  parse: () => Eu
});
var Gr = /\W/m, Zr = /\W |\W$|$|,| /m, vu = 42;
function* Eu(t) {
  let e = [];
  if (typeof t != "string") {
    for (let s = 0; s < t.tags.length; s++) {
      const o = t.tags[s];
      o[0] === "emoji" && o.length >= 3 && e.push({ type: "emoji", shortcode: o[1], url: o[2] });
    }
    t = t.content;
  }
  const n = t.length;
  let r = 0, i = 0;
  e:
    for (; i < n; ) {
      const s = t.indexOf(":", i), o = t.indexOf("#", i);
      if (s === -1 && o === -1)
        break e;
      if (s === -1 || o >= 0 && o < s) {
        if (o === 0 || t[o - 1] === " ") {
          const a = t.slice(o + 1, o + vu).match(Gr), c = a ? o + 1 + a.index : n;
          yield { type: "text", text: t.slice(r, o) }, yield { type: "hashtag", value: t.slice(o + 1, c) }, i = c, r = i;
          continue e;
        }
        i = o + 1;
        continue e;
      }
      if (t.slice(s - 5, s) === "nostr") {
        const a = t.slice(s + 60).match(Gr), c = a ? s + 60 + a.index : n;
        try {
          let u, { data: h, type: l } = sn(t.slice(s + 1, c));
          switch (l) {
            case "npub":
              u = { pubkey: h };
              break;
            case "nsec":
            case "note":
              i = c + 1;
              continue;
            default:
              u = h;
          }
          r !== s - 5 && (yield { type: "text", text: t.slice(r, s - 5) }), yield { type: "reference", pointer: u }, i = c, r = i;
          continue e;
        } catch {
          i = s + 1;
          continue e;
        }
      } else if (t.slice(s - 5, s) === "https" || t.slice(s - 4, s) === "http") {
        const a = t.slice(s + 4).match(Zr), c = a ? s + 4 + a.index : n, u = t[s - 1] === "s" ? 5 : 4;
        try {
          let h = new URL(t.slice(s - u, c));
          if (h.hostname.indexOf(".") === -1)
            throw new Error("invalid url");
          if (r !== s - u && (yield { type: "text", text: t.slice(r, s - u) }), /\.(png|jpe?g|gif|webp|heic|svg)$/i.test(h.pathname)) {
            yield { type: "image", url: h.toString() }, i = c, r = i;
            continue e;
          }
          if (/\.(mp4|avi|webm|mkv|mov)$/i.test(h.pathname)) {
            yield { type: "video", url: h.toString() }, i = c, r = i;
            continue e;
          }
          if (/\.(mp3|aac|ogg|opus|wav|flac)$/i.test(h.pathname)) {
            yield { type: "audio", url: h.toString() }, i = c, r = i;
            continue e;
          }
          yield { type: "url", url: h.toString() }, i = c, r = i;
          continue e;
        } catch {
          i = c + 1;
          continue e;
        }
      } else if (t.slice(s - 3, s) === "wss" || t.slice(s - 2, s) === "ws") {
        const a = t.slice(s + 4).match(Zr), c = a ? s + 4 + a.index : n, u = t[s - 1] === "s" ? 3 : 2;
        try {
          let h = new URL(t.slice(s - u, c));
          if (h.hostname.indexOf(".") === -1)
            throw new Error("invalid ws url");
          r !== s - u && (yield { type: "text", text: t.slice(r, s - u) }), yield { type: "relay", url: h.toString() }, i = c, r = i;
          continue e;
        } catch {
          i = c + 1;
          continue e;
        }
      } else {
        for (let a = 0; a < e.length; a++) {
          const c = e[a];
          if (t[s + c.shortcode.length + 1] === ":" && t.slice(s + 1, s + c.shortcode.length + 1) === c.shortcode) {
            r !== s && (yield { type: "text", text: t.slice(r, s) }), yield c, i = s + c.shortcode.length + 2, r = i;
            continue e;
          }
        }
        i = s + 1;
        continue e;
      }
    }
  r !== n && (yield { type: "text", text: t.slice(r) });
}
var xu = {};
D(xu, {
  channelCreateEvent: () => Su,
  channelHideMessageEvent: () => Lu,
  channelMessageEvent: () => _u,
  channelMetadataEvent: () => Au,
  channelMuteUserEvent: () => ku
});
var Su = (t, e) => {
  let n;
  if (typeof t.content == "object")
    n = JSON.stringify(t.content);
  else if (typeof t.content == "string")
    n = t.content;
  else
    return;
  return de(
    {
      kind: Qi,
      tags: [...t.tags ?? []],
      content: n,
      created_at: t.created_at
    },
    e
  );
}, Au = (t, e) => {
  let n;
  if (typeof t.content == "object")
    n = JSON.stringify(t.content);
  else if (typeof t.content == "string")
    n = t.content;
  else
    return;
  return de(
    {
      kind: es,
      tags: [["e", t.channel_create_event_id], ...t.tags ?? []],
      content: n,
      created_at: t.created_at
    },
    e
  );
}, _u = (t, e) => {
  const n = [["e", t.channel_create_event_id, t.relay_url, "root"]];
  return t.reply_to_channel_message_event_id && n.push(["e", t.reply_to_channel_message_event_id, t.relay_url, "reply"]), de(
    {
      kind: ts,
      tags: [...n, ...t.tags ?? []],
      content: t.content,
      created_at: t.created_at
    },
    e
  );
}, Lu = (t, e) => {
  let n;
  if (typeof t.content == "object")
    n = JSON.stringify(t.content);
  else if (typeof t.content == "string")
    n = t.content;
  else
    return;
  return de(
    {
      kind: ns,
      tags: [["e", t.channel_message_event_id], ...t.tags ?? []],
      content: n,
      created_at: t.created_at
    },
    e
  );
}, ku = (t, e) => {
  let n;
  if (typeof t.content == "object")
    n = JSON.stringify(t.content);
  else if (typeof t.content == "string")
    n = t.content;
  else
    return;
  return de(
    {
      kind: rs,
      tags: [["p", t.pubkey_to_mute], ...t.tags ?? []],
      content: n,
      created_at: t.created_at
    },
    e
  );
}, Iu = {};
D(Iu, {
  EMOJI_SHORTCODE_REGEX: () => Ns,
  matchAll: () => Tu,
  regex: () => br,
  replaceAll: () => Pu
});
var Ns = /:(\w+):/, br = () => new RegExp(`\\B${Ns.source}\\B`, "g");
function* Tu(t) {
  const e = t.matchAll(br());
  for (const n of e)
    try {
      const [r, i] = n;
      yield {
        shortcode: r,
        name: i,
        start: n.index,
        end: n.index + r.length
      };
    } catch {
    }
}
function Pu(t, e) {
  return t.replaceAll(br(), (n, r) => e({
    shortcode: n,
    name: r
  }));
}
var $u = {};
D($u, {
  useFetchImplementation: () => Bu,
  validateGithub: () => Uu
});
var mr;
try {
  mr = fetch;
} catch {
}
function Bu(t) {
  mr = t;
}
async function Uu(t, e, n) {
  try {
    return await (await mr(`https://gist.github.com/${e}/${n}/raw`)).text() === `Verifying that I control the following Nostr public key: ${t}`;
  } catch {
    return !1;
  }
}
var Nu = {};
D(Nu, {
  makeNwcRequestEvent: () => Ou,
  parseConnectionString: () => Ru
});
function Ru(t) {
  const { host: e, pathname: n, searchParams: r } = new URL(t), i = n || e, s = r.get("relay"), o = r.get("secret");
  if (!i || !s || !o)
    throw new Error("invalid connection string");
  return { pubkey: i, relay: s, secret: o };
}
async function Ou(t, e, n) {
  const i = ps(e, t, JSON.stringify({
    method: "pay_invoice",
    params: {
      invoice: n
    }
  })), s = {
    kind: os,
    created_at: Math.round(Date.now() / 1e3),
    content: i,
    tags: [["p", t]]
  };
  return de(s, e);
}
var Cu = {};
D(Cu, {
  normalizeIdentifier: () => Hu
});
function Hu(t) {
  return t = t.trim().toLowerCase(), t = t.normalize("NFKC"), Array.from(t).map((e) => new RegExp("\\p{Letter}", "u").test(e) || new RegExp("\\p{Number}", "u").test(e) ? e : "-").join("");
}
var Mu = {};
D(Mu, {
  getSatoshisAmountFromBolt11: () => Fu,
  getZapEndpoint: () => Du,
  makeZapReceipt: () => zu,
  makeZapRequest: () => qu,
  useFetchImplementation: () => Ku,
  validateZapRequest: () => Vu
});
var vr;
try {
  vr = fetch;
} catch {
}
function Ku(t) {
  vr = t;
}
async function Du(t) {
  try {
    let e = "", { lud06: n, lud16: r } = JSON.parse(t.content);
    if (r) {
      let [o, a] = r.split("@");
      e = new URL(`/.well-known/lnurlp/${o}`, `https://${a}`).toString();
    } else if (n) {
      let { words: o } = Me.decode(n, 1e3), a = Me.fromWords(o);
      e = ve.decode(a);
    } else
      return null;
    let s = await (await vr(e)).json();
    if (s.allowsNostr && s.nostrPubkey)
      return s.callback;
  } catch {
  }
  return null;
}
function qu(t) {
  let e = {
    kind: 9734,
    created_at: Math.round(Date.now() / 1e3),
    content: t.comment || "",
    tags: [
      ["p", "pubkey" in t ? t.pubkey : t.event.pubkey],
      ["amount", t.amount.toString()],
      ["relays", ...t.relays]
    ]
  };
  if ("event" in t) {
    if (e.tags.push(["e", t.event.id]), rr(t.event.kind)) {
      const n = ["a", `${t.event.kind}:${t.event.pubkey}:`];
      e.tags.push(n);
    } else if (ir(t.event.kind)) {
      let n = t.event.tags.find(([i, s]) => i === "d" && s);
      if (!n)
        throw new Error("d tag not found or is empty");
      const r = ["a", `${t.event.kind}:${t.event.pubkey}:${n[1]}`];
      e.tags.push(r);
    }
    e.tags.push(["k", t.event.kind.toString()]);
  }
  return e;
}
function Vu(t) {
  let e;
  try {
    e = JSON.parse(t);
  } catch {
    return "Invalid zap request JSON.";
  }
  if (!er(e))
    return "Zap request is not a valid Nostr event.";
  if (!nn(e))
    return "Invalid signature on zap request.";
  let n = e.tags.find(([s, o]) => s === "p" && o);
  if (!n)
    return "Zap request doesn't have a 'p' tag.";
  if (!n[1].match(/^[a-f0-9]{64}$/))
    return "Zap request 'p' tag is not valid hex.";
  let r = e.tags.find(([s, o]) => s === "e" && o);
  return r && !r[1].match(/^[a-f0-9]{64}$/) ? "Zap request 'e' tag is not valid hex." : e.tags.find(([s, o]) => s === "relays" && o) ? null : "Zap request doesn't have a 'relays' tag.";
}
function zu({
  zapRequest: t,
  preimage: e,
  bolt11: n,
  paidAt: r
}) {
  let i = JSON.parse(t), s = i.tags.filter(([a]) => a === "e" || a === "p" || a === "a"), o = {
    kind: 9735,
    created_at: Math.round(r.getTime() / 1e3),
    content: "",
    tags: [...s, ["P", i.pubkey], ["bolt11", n], ["description", t]]
  };
  return e && o.tags.push(["preimage", e]), o;
}
function Fu(t) {
  if (t.length < 50)
    return 0;
  t = t.substring(0, 50);
  const e = t.lastIndexOf("1");
  if (e === -1)
    return 0;
  const n = t.substring(0, e);
  if (!n.startsWith("lnbc"))
    return 0;
  const r = n.substring(4);
  if (r.length < 1)
    return 0;
  const i = r[r.length - 1], s = i.charCodeAt(0) - 48, o = s >= 0 && s <= 9;
  let a = r.length - 1;
  if (o && a++, a < 1)
    return 0;
  const c = parseInt(r.substring(0, a));
  switch (i) {
    case "m":
      return c * 1e5;
    case "u":
      return c * 100;
    case "n":
      return c / 10;
    case "p":
      return c / 1e4;
    default:
      return c * 1e8;
  }
}
var Wu = {};
D(Wu, {
  Negentropy: () => Os,
  NegentropyStorageVector: () => Zu,
  NegentropySync: () => Ju
});
var Sn = 97, ct = 32, Rs = 16, qe = {
  Skip: 0,
  Fingerprint: 1,
  IdList: 2
}, me = class {
  constructor(t) {
    b(this, "_raw");
    b(this, "length");
    typeof t == "number" ? (this._raw = new Uint8Array(t), this.length = 0) : t instanceof Uint8Array ? (this._raw = new Uint8Array(t), this.length = t.length) : (this._raw = new Uint8Array(512), this.length = 0);
  }
  unwrap() {
    return this._raw.subarray(0, this.length);
  }
  get capacity() {
    return this._raw.byteLength;
  }
  extend(t) {
    if (t instanceof me && (t = t.unwrap()), typeof t.length != "number")
      throw Error("bad length");
    const e = t.length + this.length;
    if (this.capacity < e) {
      const n = this._raw, r = Math.max(this.capacity * 2, e);
      this._raw = new Uint8Array(r), this._raw.set(n);
    }
    this._raw.set(t, this.length), this.length += t.length;
  }
  shift() {
    const t = this._raw[0];
    return this._raw = this._raw.subarray(1), this.length--, t;
  }
  shiftN(t = 1) {
    const e = this._raw.subarray(0, t);
    return this._raw = this._raw.subarray(t), this.length -= t, e;
  }
};
function At(t) {
  let e = 0;
  for (; ; ) {
    if (t.length === 0)
      throw Error("parse ends prematurely");
    let n = t.shift();
    if (e = e << 7 | n & 127, !(n & 128))
      break;
  }
  return e;
}
function ye(t) {
  if (t === 0)
    return new me(new Uint8Array([0]));
  let e = [];
  for (; t !== 0; )
    e.push(t & 127), t >>>= 7;
  e.reverse();
  for (let n = 0; n < e.length - 1; n++)
    e[n] |= 128;
  return new me(new Uint8Array(e));
}
function ju(t) {
  return Ut(t, 1)[0];
}
function Ut(t, e) {
  if (t.length < e)
    throw Error("parse ends prematurely");
  return t.shiftN(e);
}
var Gu = class {
  constructor() {
    b(this, "buf");
    this.setToZero();
  }
  setToZero() {
    this.buf = new Uint8Array(ct);
  }
  add(t) {
    let e = 0, n = 0, r = new DataView(this.buf.buffer), i = new DataView(t.buffer);
    for (let s = 0; s < 8; s++) {
      let o = s * 4, a = r.getUint32(o, !0), c = i.getUint32(o, !0), u = a;
      u += e, u += c, u > 4294967295 && (n = 1), r.setUint32(o, u & 4294967295, !0), e = n, n = 0;
    }
  }
  negate() {
    let t = new DataView(this.buf.buffer);
    for (let n = 0; n < 8; n++) {
      let r = n * 4;
      t.setUint32(r, ~t.getUint32(r, !0));
    }
    let e = new Uint8Array(ct);
    e[0] = 1, this.add(e);
  }
  getFingerprint(t) {
    let e = new me();
    return e.extend(this.buf), e.extend(ye(t)), re(e.unwrap()).subarray(0, Rs);
  }
}, Zu = class {
  constructor() {
    b(this, "items");
    b(this, "sealed");
    this.items = [], this.sealed = !1;
  }
  insert(t, e) {
    if (this.sealed)
      throw Error("already sealed");
    const n = Ni(e);
    if (n.byteLength !== ct)
      throw Error("bad id size for added item");
    this.items.push({ timestamp: t, id: n });
  }
  seal() {
    if (this.sealed)
      throw Error("already sealed");
    this.sealed = !0, this.items.sort(An);
    for (let t = 1; t < this.items.length; t++)
      if (An(this.items[t - 1], this.items[t]) === 0)
        throw Error("duplicate item inserted");
  }
  unseal() {
    this.sealed = !1;
  }
  size() {
    return this._checkSealed(), this.items.length;
  }
  getItem(t) {
    if (this._checkSealed(), t >= this.items.length)
      throw Error("out of range");
    return this.items[t];
  }
  iterate(t, e, n) {
    this._checkSealed(), this._checkBounds(t, e);
    for (let r = t; r < e && n(this.items[r], r); ++r)
      ;
  }
  findLowerBound(t, e, n) {
    return this._checkSealed(), this._checkBounds(t, e), this._binarySearch(this.items, t, e, (r) => An(r, n) < 0);
  }
  fingerprint(t, e) {
    let n = new Gu();
    return n.setToZero(), this.iterate(t, e, (r) => (n.add(r.id), !0)), n.getFingerprint(e - t);
  }
  _checkSealed() {
    if (!this.sealed)
      throw Error("not sealed");
  }
  _checkBounds(t, e) {
    if (t > e || e > this.items.length)
      throw Error("bad range");
  }
  _binarySearch(t, e, n, r) {
    let i = n - e;
    for (; i > 0; ) {
      let s = e, o = Math.floor(i / 2);
      s += o, r(t[s]) ? (e = ++s, i -= o + 1) : i = o;
    }
    return e;
  }
}, Os = class {
  constructor(t, e = 6e4) {
    b(this, "storage");
    b(this, "frameSizeLimit");
    b(this, "lastTimestampIn");
    b(this, "lastTimestampOut");
    if (e < 4096)
      throw Error("frameSizeLimit too small");
    this.storage = t, this.frameSizeLimit = e, this.lastTimestampIn = 0, this.lastTimestampOut = 0;
  }
  _bound(t, e) {
    return { timestamp: t, id: e || new Uint8Array(0) };
  }
  initiate() {
    let t = new me();
    return t.extend(new Uint8Array([Sn])), this.splitRange(0, this.storage.size(), this._bound(Number.MAX_VALUE), t), nt(t.unwrap());
  }
  reconcile(t, e, n) {
    const r = new me(Ni(t));
    this.lastTimestampIn = this.lastTimestampOut = 0;
    let i = new me();
    i.extend(new Uint8Array([Sn]));
    let s = ju(r);
    if (s < 96 || s > 111)
      throw Error("invalid negentropy protocol version byte");
    if (s !== Sn)
      throw Error("unsupported negentropy protocol version requested: " + (s - 96));
    let o = this.storage.size(), a = this._bound(0), c = 0, u = !1;
    for (; r.length !== 0; ) {
      let h = new me(), l = () => {
        u && (u = !1, h.extend(this.encodeBound(a)), h.extend(ye(qe.Skip)));
      }, d = this.decodeBound(r), p = At(r), g = c, f = this.storage.findLowerBound(c, o, d);
      if (p === qe.Skip)
        u = !0;
      else if (p === qe.Fingerprint) {
        let y = Ut(r, Rs), w = this.storage.fingerprint(g, f);
        Cs(y, w) !== 0 ? (l(), this.splitRange(g, f, d, h)) : u = !0;
      } else if (p === qe.IdList) {
        let y = At(r), w = {};
        for (let m = 0; m < y; m++) {
          let S = Ut(r, ct);
          w[nt(S)] = S;
        }
        if (u = !0, this.storage.iterate(g, f, (m) => {
          let S = m.id;
          const L = nt(S);
          return w[L] ? delete w[nt(S)] : e == null || e(L), !0;
        }), n)
          for (let m of Object.values(w))
            n(nt(m));
      } else
        throw Error("unexpected mode");
      if (this.exceededFrameSizeLimit(i.length + h.length)) {
        let y = this.storage.fingerprint(f, o);
        i.extend(this.encodeBound(this._bound(Number.MAX_VALUE))), i.extend(ye(qe.Fingerprint)), i.extend(y);
        break;
      } else
        i.extend(h);
      c = f, a = d;
    }
    return i.length === 1 ? null : nt(i.unwrap());
  }
  splitRange(t, e, n, r) {
    let i = e - t, s = 16;
    if (i < s * 2)
      r.extend(this.encodeBound(n)), r.extend(ye(qe.IdList)), r.extend(ye(i)), this.storage.iterate(t, e, (o) => (r.extend(o.id), !0));
    else {
      let o = Math.floor(i / s), a = i % s, c = t;
      for (let u = 0; u < s; u++) {
        let h = o + (u < a ? 1 : 0), l = this.storage.fingerprint(c, c + h);
        c += h;
        let d;
        if (c === e)
          d = n;
        else {
          let p, g;
          this.storage.iterate(c - 1, c + 1, (f, y) => (y === c - 1 ? p = f : g = f, !0)), d = this.getMinimalBound(p, g);
        }
        r.extend(this.encodeBound(d)), r.extend(ye(qe.Fingerprint)), r.extend(l);
      }
    }
  }
  exceededFrameSizeLimit(t) {
    return t > this.frameSizeLimit - 200;
  }
  decodeTimestampIn(t) {
    let e = At(t);
    return e = e === 0 ? Number.MAX_VALUE : e - 1, this.lastTimestampIn === Number.MAX_VALUE || e === Number.MAX_VALUE ? (this.lastTimestampIn = Number.MAX_VALUE, Number.MAX_VALUE) : (e += this.lastTimestampIn, this.lastTimestampIn = e, e);
  }
  decodeBound(t) {
    let e = this.decodeTimestampIn(t), n = At(t);
    if (n > ct)
      throw Error("bound key too long");
    let r = Ut(t, n);
    return { timestamp: e, id: r };
  }
  encodeTimestampOut(t) {
    if (t === Number.MAX_VALUE)
      return this.lastTimestampOut = Number.MAX_VALUE, ye(0);
    let e = t;
    return t -= this.lastTimestampOut, this.lastTimestampOut = e, ye(t + 1);
  }
  encodeBound(t) {
    let e = new me();
    return e.extend(this.encodeTimestampOut(t.timestamp)), e.extend(ye(t.id.length)), e.extend(t.id), e;
  }
  getMinimalBound(t, e) {
    if (e.timestamp !== t.timestamp)
      return this._bound(e.timestamp);
    {
      let n = 0, r = e.id, i = t.id;
      for (let s = 0; s < ct && r[s] === i[s]; s++)
        n++;
      return this._bound(e.timestamp, e.id.subarray(0, n + 1));
    }
  }
};
function Cs(t, e) {
  for (let n = 0; n < t.byteLength; n++) {
    if (t[n] < e[n])
      return -1;
    if (t[n] > e[n])
      return 1;
  }
  return t.byteLength > e.byteLength ? 1 : t.byteLength < e.byteLength ? -1 : 0;
}
function An(t, e) {
  return t.timestamp === e.timestamp ? Cs(t.id, e.id) : t.timestamp - e.timestamp;
}
var Ju = class {
  constructor(t, e, n, r = {}) {
    b(this, "relay");
    b(this, "storage");
    b(this, "neg");
    b(this, "filter");
    b(this, "subscription");
    b(this, "onhave");
    b(this, "onneed");
    this.relay = t, this.storage = e, this.neg = new Os(e), this.onhave = r.onhave, this.onneed = r.onneed, this.filter = n, this.subscription = this.relay.prepareSubscription([{}], { label: r.label || "negentropy" }), this.subscription.oncustom = (i) => {
      var s, o, a, c;
      switch (i[0]) {
        case "NEG-MSG": {
          i.length < 3 && console.warn(`got invalid NEG-MSG from ${this.relay.url}: ${i}`);
          try {
            const u = this.neg.reconcile(i[2], this.onhave, this.onneed);
            u ? this.relay.send(`["NEG-MSG", "${this.subscription.id}", "${u}"]`) : (this.close(), (s = r.onclose) == null || s.call(r));
          } catch (u) {
            console.error("negentropy reconcile error:", u), (o = r == null ? void 0 : r.onclose) == null || o.call(r, `reconcile error: ${u}`);
          }
          break;
        }
        case "NEG-CLOSE": {
          const u = i[2];
          console.warn("negentropy error:", u), (a = r.onclose) == null || a.call(r, u);
          break;
        }
        case "NEG-ERR":
          (c = r.onclose) == null || c.call(r);
      }
    };
  }
  async start() {
    const t = this.neg.initiate();
    this.relay.send(`["NEG-OPEN","${this.subscription.id}",${JSON.stringify(this.filter)},"${t}"]`);
  }
  close() {
    this.relay.send(`["NEG-CLOSE","${this.subscription.id}"]`), this.subscription.close();
  }
}, Yu = {};
D(Yu, {
  getToken: () => Xu,
  hashPayload: () => Er,
  unpackEventFromToken: () => Ms,
  validateEvent: () => Fs,
  validateEventKind: () => Ds,
  validateEventMethodTag: () => Vs,
  validateEventPayloadTag: () => zs,
  validateEventTimestamp: () => Ks,
  validateEventUrlTag: () => qs,
  validateToken: () => Qu
});
var Hs = "Nostr ";
async function Xu(t, e, n, r = !1, i) {
  const s = {
    kind: cr,
    tags: [
      ["u", t],
      ["method", e]
    ],
    created_at: Math.round((/* @__PURE__ */ new Date()).getTime() / 1e3),
    content: ""
  };
  i && s.tags.push(["payload", Er(i)]);
  const o = await n(s);
  return (r ? Hs : "") + G.encode(ne.encode(JSON.stringify(o)));
}
async function Qu(t, e, n) {
  const r = await Ms(t).catch((s) => {
    throw s;
  });
  return await Fs(r, e, n).catch((s) => {
    throw s;
  });
}
async function Ms(t) {
  if (!t)
    throw new Error("Missing token");
  t = t.replace(Hs, "");
  const e = ve.decode(G.decode(t));
  if (!e || e.length === 0 || !e.startsWith("{"))
    throw new Error("Invalid token");
  return JSON.parse(e);
}
function Ks(t) {
  return t.created_at ? Math.round((/* @__PURE__ */ new Date()).getTime() / 1e3) - t.created_at < 60 : !1;
}
function Ds(t) {
  return t.kind === cr;
}
function qs(t, e) {
  const n = t.tags.find((r) => r[0] === "u");
  return n ? n.length > 0 && n[1] === e : !1;
}
function Vs(t, e) {
  const n = t.tags.find((r) => r[0] === "method");
  return n ? n.length > 0 && n[1].toLowerCase() === e.toLowerCase() : !1;
}
function Er(t) {
  const e = re(ne.encode(JSON.stringify(t)));
  return C(e);
}
function zs(t, e) {
  const n = t.tags.find((i) => i[0] === "payload");
  if (!n)
    return !1;
  const r = Er(e);
  return n.length > 0 && n[1] === r;
}
async function Fs(t, e, n, r) {
  if (!nn(t))
    throw new Error("Invalid nostr event, signature invalid");
  if (!Ds(t))
    throw new Error("Invalid nostr event, kind invalid");
  if (!Ks(t))
    throw new Error("Invalid nostr event, created_at timestamp invalid");
  if (!qs(t, e))
    throw new Error("Invalid nostr event, url tag invalid");
  if (!Vs(t, n))
    throw new Error("Invalid nostr event, method tag invalid");
  if (r && typeof r == "object" && Object.keys(r).length > 0 && !zs(t, r))
    throw new Error("Invalid nostr event, payload tag does not match request body hash");
  return !0;
}
class eh {
  constructor(e) {
    this.relays = e;
  }
  async getLatest(e) {
    const n = new Wr(), r = {
      kinds: e.kinds,
      authors: e.authors,
      "#d": e.dTags,
      limit: e.limit ?? 10
    };
    try {
      const i = await n.querySync(this.relays, r);
      if (!i.length)
        return null;
      const s = [...i].sort((o, a) => a.created_at - o.created_at)[0];
      return {
        content: s.content,
        createdAt: s.created_at * 1e3,
        pubkey: s.pubkey
      };
    } finally {
      n.close(this.relays);
    }
  }
  async publish(e) {
    const n = new Wr(), r = [];
    try {
      return await Promise.all(
        this.relays.map(async (i) => {
          try {
            const s = n.publish([i], e);
            await Promise.all(s), r.push(i);
          } catch {
          }
        })
      ), r;
    } finally {
      n.close(this.relays);
    }
  }
}
/*! noble-ciphers - MIT License (c) 2023 Paul Miller (paulmillr.com) */
function th(t) {
  return t instanceof Uint8Array || ArrayBuffer.isView(t) && t.constructor.name === "Uint8Array";
}
function Z(t, e, n = "") {
  const r = th(t), i = t == null ? void 0 : t.length, s = e !== void 0;
  if (!r || s && i !== e) {
    const o = n && `"${n}" `, a = s ? ` of length ${e}` : "", c = r ? `length=${i}` : `type=${typeof t}`;
    throw new Error(o + "expected Uint8Array" + a + ", got " + c);
  }
  return t;
}
function qt(t, e = !0) {
  if (t.destroyed)
    throw new Error("Hash instance has been destroyed");
  if (e && t.finished)
    throw new Error("Hash#digest() has already been called");
}
function Ws(t, e) {
  Z(t, void 0, "output");
  const n = e.outputLen;
  if (t.length < n)
    throw new Error("digestInto() expects output buffer of length at least " + n);
}
function nh(t) {
  return new Uint8Array(t.buffer, t.byteOffset, t.byteLength);
}
function xe(t) {
  return new Uint32Array(t.buffer, t.byteOffset, Math.floor(t.byteLength / 4));
}
function Se(...t) {
  for (let e = 0; e < t.length; e++)
    t[e].fill(0);
}
function ln(t) {
  return new DataView(t.buffer, t.byteOffset, t.byteLength);
}
const rh = new Uint8Array(new Uint32Array([287454020]).buffer)[0] === 68;
function ih(t, e) {
  if (t.length !== e.length)
    return !1;
  let n = 0;
  for (let r = 0; r < t.length; r++)
    n |= t[r] ^ e[r];
  return n === 0;
}
const sh = /* @__NO_SIDE_EFFECTS__ */ (t, e) => {
  function n(r, ...i) {
    if (Z(r, void 0, "key"), !rh)
      throw new Error("Non little-endian hardware is not yet supported");
    if (t.nonceLength !== void 0) {
      const h = i[0];
      Z(h, t.varSizeNonce ? void 0 : t.nonceLength, "nonce");
    }
    const s = t.tagLength;
    s && i[1] !== void 0 && Z(i[1], void 0, "AAD");
    const o = e(r, ...i), a = (h, l) => {
      if (l !== void 0) {
        if (h !== 2)
          throw new Error("cipher output not supported");
        Z(l, void 0, "output");
      }
    };
    let c = !1;
    return {
      encrypt(h, l) {
        if (c)
          throw new Error("cannot encrypt() twice with same key + nonce");
        return c = !0, Z(h), a(o.encrypt.length, l), o.encrypt(h, l);
      },
      decrypt(h, l) {
        if (Z(h), s && h.length < s)
          throw new Error('"ciphertext" expected length bigger than tagLength=' + s);
        return a(o.decrypt.length, l), o.decrypt(h, l);
      }
    };
  }
  return Object.assign(n, t), n;
};
function oh(t, e, n = !0) {
  if (e === void 0)
    return new Uint8Array(t);
  if (e.length !== t)
    throw new Error('"output" expected Uint8Array of length ' + t + ", got: " + e.length);
  if (n && !Vt(e))
    throw new Error("invalid output, must be aligned");
  return e;
}
function ah(t, e, n) {
  const r = new Uint8Array(16), i = ln(r);
  return i.setBigUint64(0, BigInt(e), n), i.setBigUint64(8, BigInt(t), n), r;
}
function Vt(t) {
  return t.byteOffset % 4 === 0;
}
function Je(t) {
  return Uint8Array.from(t);
}
const we = 16, xr = /* @__PURE__ */ new Uint8Array(16), le = xe(xr), ch = 225, lh = (t, e, n, r) => {
  const i = r & 1;
  return {
    s3: n << 31 | r >>> 1,
    s2: e << 31 | n >>> 1,
    s1: t << 31 | e >>> 1,
    s0: t >>> 1 ^ ch << 24 & -(i & 1)
    // reduce % poly
  };
}, Q = (t) => (t >>> 0 & 255) << 24 | (t >>> 8 & 255) << 16 | (t >>> 16 & 255) << 8 | t >>> 24 & 255 | 0;
function uh(t) {
  t.reverse();
  const e = t[15] & 1;
  let n = 0;
  for (let r = 0; r < t.length; r++) {
    const i = t[r];
    t[r] = i >>> 1 | n, n = (i & 1) << 7;
  }
  return t[0] ^= -e & 225, t;
}
const hh = (t) => t > 64 * 1024 ? 8 : t > 1024 ? 4 : 2;
class js {
  // We select bits per window adaptively based on expectedLength
  constructor(e, n) {
    b(this, "blockLen", we);
    b(this, "outputLen", we);
    b(this, "s0", 0);
    b(this, "s1", 0);
    b(this, "s2", 0);
    b(this, "s3", 0);
    b(this, "finished", !1);
    b(this, "t");
    b(this, "W");
    b(this, "windowSize");
    Z(e, 16, "key"), e = Je(e);
    const r = ln(e);
    let i = r.getUint32(0, !1), s = r.getUint32(4, !1), o = r.getUint32(8, !1), a = r.getUint32(12, !1);
    const c = [];
    for (let g = 0; g < 128; g++)
      c.push({ s0: Q(i), s1: Q(s), s2: Q(o), s3: Q(a) }), { s0: i, s1: s, s2: o, s3: a } = lh(i, s, o, a);
    const u = hh(n || 1024);
    if (![1, 2, 4, 8].includes(u))
      throw new Error("ghash: invalid window size, expected 2, 4 or 8");
    this.W = u;
    const l = 128 / u, d = this.windowSize = 2 ** u, p = [];
    for (let g = 0; g < l; g++)
      for (let f = 0; f < d; f++) {
        let y = 0, w = 0, m = 0, S = 0;
        for (let L = 0; L < u; L++) {
          if (!(f >>> u - L - 1 & 1))
            continue;
          const { s0: x, s1: A, s2: _, s3: U } = c[u * g + L];
          y ^= x, w ^= A, m ^= _, S ^= U;
        }
        p.push({ s0: y, s1: w, s2: m, s3: S });
      }
    this.t = p;
  }
  _updateBlock(e, n, r, i) {
    e ^= this.s0, n ^= this.s1, r ^= this.s2, i ^= this.s3;
    const { W: s, t: o, windowSize: a } = this;
    let c = 0, u = 0, h = 0, l = 0;
    const d = (1 << s) - 1;
    let p = 0;
    for (const g of [e, n, r, i])
      for (let f = 0; f < 4; f++) {
        const y = g >>> 8 * f & 255;
        for (let w = 8 / s - 1; w >= 0; w--) {
          const m = y >>> s * w & d, { s0: S, s1: L, s2: I, s3: x } = o[p * a + m];
          c ^= S, u ^= L, h ^= I, l ^= x, p += 1;
        }
      }
    this.s0 = c, this.s1 = u, this.s2 = h, this.s3 = l;
  }
  update(e) {
    qt(this), Z(e), e = Je(e);
    const n = xe(e), r = Math.floor(e.length / we), i = e.length % we;
    for (let s = 0; s < r; s++)
      this._updateBlock(n[s * 4 + 0], n[s * 4 + 1], n[s * 4 + 2], n[s * 4 + 3]);
    return i && (xr.set(e.subarray(r * we)), this._updateBlock(le[0], le[1], le[2], le[3]), Se(le)), this;
  }
  destroy() {
    const { t: e } = this;
    for (const n of e)
      n.s0 = 0, n.s1 = 0, n.s2 = 0, n.s3 = 0;
  }
  digestInto(e) {
    qt(this), Ws(e, this), this.finished = !0;
    const { s0: n, s1: r, s2: i, s3: s } = this, o = xe(e);
    return o[0] = n, o[1] = r, o[2] = i, o[3] = s, e;
  }
  digest() {
    const e = new Uint8Array(we);
    return this.digestInto(e), this.destroy(), e;
  }
}
class fh extends js {
  constructor(e, n) {
    Z(e);
    const r = uh(Je(e));
    super(r, n), Se(r);
  }
  update(e) {
    qt(this), Z(e), e = Je(e);
    const n = xe(e), r = e.length % we, i = Math.floor(e.length / we);
    for (let s = 0; s < i; s++)
      this._updateBlock(Q(n[s * 4 + 3]), Q(n[s * 4 + 2]), Q(n[s * 4 + 1]), Q(n[s * 4 + 0]));
    return r && (xr.set(e.subarray(i * we)), this._updateBlock(Q(le[3]), Q(le[2]), Q(le[1]), Q(le[0])), Se(le)), this;
  }
  digestInto(e) {
    qt(this), Ws(e, this), this.finished = !0;
    const { s0: n, s1: r, s2: i, s3: s } = this, o = xe(e);
    return o[0] = n, o[1] = r, o[2] = i, o[3] = s, e.reverse();
  }
}
function Gs(t) {
  const e = (r, i) => t(i, r.length).update(r).digest(), n = t(new Uint8Array(16), 0);
  return e.outputLen = n.outputLen, e.blockLen = n.blockLen, e.create = (r, i) => t(r, i), e;
}
const Jr = Gs((t, e) => new js(t, e));
Gs((t, e) => new fh(t, e));
const qn = 16, dh = 4, _t = /* @__PURE__ */ new Uint8Array(qn), ph = 283;
function gh(t) {
  if (![16, 24, 32].includes(t.length))
    throw new Error('"aes key" expected Uint8Array of length 16/24/32, got length=' + t.length);
}
function Sr(t) {
  return t << 1 ^ ph & -(t >> 7);
}
function Yr(t, e) {
  let n = 0;
  for (; e > 0; e >>= 1)
    n ^= t & -(e & 1), t = Sr(t);
  return n;
}
const yh = /* @__PURE__ */ (() => {
  const t = new Uint8Array(256);
  for (let n = 0, r = 1; n < 256; n++, r ^= Sr(r))
    t[n] = r;
  const e = new Uint8Array(256);
  e[0] = 99;
  for (let n = 0; n < 255; n++) {
    let r = t[255 - n];
    r |= r << 8, e[t[n]] = (r ^ r >> 4 ^ r >> 5 ^ r >> 6 ^ r >> 7 ^ 99) & 255;
  }
  return Se(t), e;
})(), wh = (t) => t << 24 | t >>> 8, _n = (t) => t << 8 | t >>> 24;
function bh(t, e) {
  if (t.length !== 256)
    throw new Error("Wrong sbox length");
  const n = new Uint32Array(256).map((u, h) => e(t[h])), r = n.map(_n), i = r.map(_n), s = i.map(_n), o = new Uint32Array(256 * 256), a = new Uint32Array(256 * 256), c = new Uint16Array(256 * 256);
  for (let u = 0; u < 256; u++)
    for (let h = 0; h < 256; h++) {
      const l = u * 256 + h;
      o[l] = n[u] ^ r[h], a[l] = i[u] ^ s[h], c[l] = t[u] << 8 | t[h];
    }
  return { sbox: t, sbox2: c, T0: n, T1: r, T2: i, T3: s, T01: o, T23: a };
}
const Zs = /* @__PURE__ */ bh(yh, (t) => Yr(t, 3) << 24 | t << 16 | t << 8 | Yr(t, 2)), mh = /* @__PURE__ */ (() => {
  const t = new Uint8Array(16);
  for (let e = 0, n = 1; e < 16; e++, n = Sr(n))
    t[e] = n;
  return t;
})();
function vh(t) {
  Z(t);
  const e = t.length;
  gh(t);
  const { sbox2: n } = Zs, r = [];
  Vt(t) || r.push(t = Je(t));
  const i = xe(t), s = i.length, o = (c) => yt(n, c, c, c, c), a = new Uint32Array(e + 28);
  a.set(i);
  for (let c = s; c < a.length; c++) {
    let u = a[c - 1];
    c % s === 0 ? u = o(wh(u)) ^ mh[c / s - 1] : s > 6 && c % s === 4 && (u = o(u)), a[c] = a[c - s] ^ u;
  }
  return Se(...r), a;
}
function Lt(t, e, n, r, i, s) {
  return t[n << 8 & 65280 | r >>> 8 & 255] ^ e[i >>> 8 & 65280 | s >>> 24 & 255];
}
function yt(t, e, n, r, i) {
  return t[e & 255 | n & 65280] | t[r >>> 16 & 255 | i >>> 16 & 65280] << 16;
}
function Xr(t, e, n, r, i) {
  const { sbox2: s, T01: o, T23: a } = Zs;
  let c = 0;
  e ^= t[c++], n ^= t[c++], r ^= t[c++], i ^= t[c++];
  const u = t.length / 4 - 2;
  for (let g = 0; g < u; g++) {
    const f = t[c++] ^ Lt(o, a, e, n, r, i), y = t[c++] ^ Lt(o, a, n, r, i, e), w = t[c++] ^ Lt(o, a, r, i, e, n), m = t[c++] ^ Lt(o, a, i, e, n, r);
    e = f, n = y, r = w, i = m;
  }
  const h = t[c++] ^ yt(s, e, n, r, i), l = t[c++] ^ yt(s, n, r, i, e), d = t[c++] ^ yt(s, r, i, e, n), p = t[c++] ^ yt(s, i, e, n, r);
  return { s0: h, s1: l, s2: d, s3: p };
}
function kt(t, e, n, r, i) {
  Z(n, qn, "nonce"), Z(r), i = oh(r.length, i);
  const s = n, o = xe(s), a = ln(s), c = xe(r), u = xe(i), h = e ? 0 : 12, l = r.length;
  let d = a.getUint32(h, e), { s0: p, s1: g, s2: f, s3: y } = Xr(t, o[0], o[1], o[2], o[3]);
  for (let m = 0; m + 4 <= c.length; m += 4)
    u[m + 0] = c[m + 0] ^ p, u[m + 1] = c[m + 1] ^ g, u[m + 2] = c[m + 2] ^ f, u[m + 3] = c[m + 3] ^ y, d = d + 1 >>> 0, a.setUint32(h, d, e), { s0: p, s1: g, s2: f, s3: y } = Xr(t, o[0], o[1], o[2], o[3]);
  const w = qn * Math.floor(c.length / dh);
  if (w < l) {
    const m = new Uint32Array([p, g, f, y]), S = nh(m);
    for (let L = w, I = 0; L < l; L++, I++)
      i[L] = r[L] ^ S[I];
    Se(m);
  }
  return i;
}
function Eh(t, e, n, r, i) {
  const s = i ? i.length : 0, o = t.create(n, r.length + s);
  i && o.update(i);
  const a = ah(8 * r.length, 8 * s, e);
  o.update(r), o.update(a);
  const c = o.digest();
  return Se(a), c;
}
const Js = /* @__PURE__ */ sh({ blockSize: 16, nonceLength: 12, tagLength: 16, varSizeNonce: !0 }, function(e, n, r) {
  if (n.length < 8)
    throw new Error("aes/gcm: invalid nonce length");
  const i = 16;
  function s(a, c, u) {
    const h = Eh(Jr, !1, a, u, r);
    for (let l = 0; l < c.length; l++)
      h[l] ^= c[l];
    return h;
  }
  function o() {
    const a = vh(e), c = _t.slice(), u = _t.slice();
    if (kt(a, !1, u, u, c), n.length === 12)
      u.set(n);
    else {
      const l = _t.slice();
      ln(l).setBigUint64(8, BigInt(n.length * 8), !1);
      const p = Jr.create(c).update(n).update(l);
      p.digestInto(u), p.destroy();
    }
    const h = kt(a, !1, u, _t);
    return { xk: a, authKey: c, counter: u, tagMask: h };
  }
  return {
    encrypt(a) {
      const { xk: c, authKey: u, counter: h, tagMask: l } = o(), d = new Uint8Array(a.length + i), p = [c, u, h, l];
      Vt(a) || p.push(a = Je(a)), kt(c, !1, h, a, d.subarray(0, a.length));
      const g = s(u, l, d.subarray(0, d.length - i));
      return p.push(g), d.set(g, a.length), Se(...p), d;
    },
    decrypt(a) {
      const { xk: c, authKey: u, counter: h, tagMask: l } = o(), d = [c, u, l, h];
      Vt(a) || d.push(a = Je(a));
      const p = a.subarray(0, -i), g = a.subarray(-i), f = s(u, l, p);
      if (d.push(f), !ih(f, g))
        throw new Error("aes/gcm: invalid ghash tag");
      const y = kt(c, !1, h, p);
      return Se(...d), y;
    }
  };
}), rt = typeof globalThis == "object" && "crypto" in globalThis ? globalThis.crypto : void 0;
/*! noble-hashes - MIT License (c) 2022 Paul Miller (paulmillr.com) */
function xh(t) {
  return t instanceof Uint8Array || ArrayBuffer.isView(t) && t.constructor.name === "Uint8Array";
}
function wt(t) {
  if (!Number.isSafeInteger(t) || t < 0)
    throw new Error("positive integer expected, got " + t);
}
function ft(t, ...e) {
  if (!xh(t))
    throw new Error("Uint8Array expected");
  if (e.length > 0 && !e.includes(t.length))
    throw new Error("Uint8Array expected of length " + e + ", got length=" + t.length);
}
function Ys(t) {
  if (typeof t != "function" || typeof t.create != "function")
    throw new Error("Hash should be wrapped by utils.createHasher");
  wt(t.outputLen), wt(t.blockLen);
}
function zt(t, e = !0) {
  if (t.destroyed)
    throw new Error("Hash instance has been destroyed");
  if (e && t.finished)
    throw new Error("Hash#digest() has already been called");
}
function Sh(t, e) {
  ft(t);
  const n = e.outputLen;
  if (t.length < n)
    throw new Error("digestInto() expects output buffer of length at least " + n);
}
function vt(...t) {
  for (let e = 0; e < t.length; e++)
    t[e].fill(0);
}
function Nt(t) {
  return new DataView(t.buffer, t.byteOffset, t.byteLength);
}
function oe(t, e) {
  return t << 32 - e | t >>> e;
}
const Xs = /* @ts-ignore */ typeof Uint8Array.from([]).toHex == "function" && typeof Uint8Array.fromHex == "function", Ah = /* @__PURE__ */ Array.from({ length: 256 }, (t, e) => e.toString(16).padStart(2, "0"));
function Ee(t) {
  if (ft(t), Xs)
    return t.toHex();
  let e = "";
  for (let n = 0; n < t.length; n++)
    e += Ah[t[n]];
  return e;
}
const ge = { _0: 48, _9: 57, A: 65, F: 70, a: 97, f: 102 };
function Qr(t) {
  if (t >= ge._0 && t <= ge._9)
    return t - ge._0;
  if (t >= ge.A && t <= ge.F)
    return t - (ge.A - 10);
  if (t >= ge.a && t <= ge.f)
    return t - (ge.a - 10);
}
function ae(t) {
  if (typeof t != "string")
    throw new Error("hex string expected, got " + typeof t);
  if (Xs)
    return Uint8Array.fromHex(t);
  const e = t.length, n = e / 2;
  if (e % 2)
    throw new Error("hex string expected, got unpadded hex of length " + e);
  const r = new Uint8Array(n);
  for (let i = 0, s = 0; i < n; i++, s += 2) {
    const o = Qr(t.charCodeAt(s)), a = Qr(t.charCodeAt(s + 1));
    if (o === void 0 || a === void 0) {
      const c = t[s] + t[s + 1];
      throw new Error('hex string expected, got non-hex character "' + c + '" at index ' + s);
    }
    r[i] = o * 16 + a;
  }
  return r;
}
function Qs(t) {
  if (typeof t != "string")
    throw new Error("string expected");
  return new Uint8Array(new TextEncoder().encode(t));
}
function Ar(t) {
  return typeof t == "string" && (t = Qs(t)), ft(t), t;
}
function ei(t) {
  return typeof t == "string" && (t = Qs(t)), ft(t), t;
}
function _h(t, e) {
  if (e !== void 0 && {}.toString.call(e) !== "[object Object]")
    throw new Error("options should be object or undefined");
  return Object.assign(t, e);
}
class eo {
}
function Lh(t) {
  const e = (r) => t().update(Ar(r)).digest(), n = t();
  return e.outputLen = n.outputLen, e.blockLen = n.blockLen, e.create = () => t(), e;
}
function Ft(t = 32) {
  if (rt && typeof rt.getRandomValues == "function")
    return rt.getRandomValues(new Uint8Array(t));
  if (rt && typeof rt.randomBytes == "function")
    return Uint8Array.from(rt.randomBytes(t));
  throw new Error("crypto.getRandomValues must be defined");
}
class to extends eo {
  constructor(e, n) {
    super(), this.finished = !1, this.destroyed = !1, Ys(e);
    const r = Ar(n);
    if (this.iHash = e.create(), typeof this.iHash.update != "function")
      throw new Error("Expected instance of class which extends utils.Hash");
    this.blockLen = this.iHash.blockLen, this.outputLen = this.iHash.outputLen;
    const i = this.blockLen, s = new Uint8Array(i);
    s.set(r.length > i ? e.create().update(r).digest() : r);
    for (let o = 0; o < s.length; o++)
      s[o] ^= 54;
    this.iHash.update(s), this.oHash = e.create();
    for (let o = 0; o < s.length; o++)
      s[o] ^= 106;
    this.oHash.update(s), vt(s);
  }
  update(e) {
    return zt(this), this.iHash.update(e), this;
  }
  digestInto(e) {
    zt(this), ft(e, this.outputLen), this.finished = !0, this.iHash.digestInto(e), this.oHash.update(e), this.oHash.digestInto(e), this.destroy();
  }
  digest() {
    const e = new Uint8Array(this.oHash.outputLen);
    return this.digestInto(e), e;
  }
  _cloneInto(e) {
    e || (e = Object.create(Object.getPrototypeOf(this), {}));
    const { oHash: n, iHash: r, finished: i, destroyed: s, blockLen: o, outputLen: a } = this;
    return e = e, e.finished = i, e.destroyed = s, e.blockLen = o, e.outputLen = a, e.oHash = n._cloneInto(e.oHash), e.iHash = r._cloneInto(e.iHash), e;
  }
  clone() {
    return this._cloneInto();
  }
  destroy() {
    this.destroyed = !0, this.oHash.destroy(), this.iHash.destroy();
  }
}
const no = (t, e, n) => new to(t, e).update(n).digest();
no.create = (t, e) => new to(t, e);
function kh(t, e, n, r) {
  Ys(t);
  const i = _h({ dkLen: 32, asyncTick: 10 }, r), { c: s, dkLen: o, asyncTick: a } = i;
  if (wt(s), wt(o), wt(a), s < 1)
    throw new Error("iterations (c) should be >= 1");
  const c = ei(e), u = ei(n), h = new Uint8Array(o), l = no.create(t, c), d = l._cloneInto().update(u);
  return { c: s, dkLen: o, asyncTick: a, DK: h, PRF: l, PRFSalt: d };
}
function Ih(t, e, n, r, i) {
  return t.destroy(), e.destroy(), r && r.destroy(), vt(i), n;
}
function Th(t, e, n, r) {
  const { c: i, dkLen: s, DK: o, PRF: a, PRFSalt: c } = kh(t, e, n, r);
  let u;
  const h = new Uint8Array(4), l = Nt(h), d = new Uint8Array(a.outputLen);
  for (let p = 1, g = 0; g < s; p++, g += a.outputLen) {
    const f = o.subarray(g, g + a.outputLen);
    l.setInt32(0, p, !1), (u = c._cloneInto(u)).update(h).digestInto(d), f.set(d.subarray(0, f.length));
    for (let y = 1; y < i; y++) {
      a._cloneInto(u).update(d).digestInto(d);
      for (let w = 0; w < f.length; w++)
        f[w] ^= d[w];
    }
  }
  return Ih(a, c, o, u, d);
}
function Ph(t, e, n, r) {
  if (typeof t.setBigUint64 == "function")
    return t.setBigUint64(e, n, r);
  const i = BigInt(32), s = BigInt(4294967295), o = Number(n >> i & s), a = Number(n & s), c = r ? 4 : 0, u = r ? 0 : 4;
  t.setUint32(e + c, o, r), t.setUint32(e + u, a, r);
}
function $h(t, e, n) {
  return t & e ^ ~t & n;
}
function Bh(t, e, n) {
  return t & e ^ t & n ^ e & n;
}
class Uh extends eo {
  constructor(e, n, r, i) {
    super(), this.finished = !1, this.length = 0, this.pos = 0, this.destroyed = !1, this.blockLen = e, this.outputLen = n, this.padOffset = r, this.isLE = i, this.buffer = new Uint8Array(e), this.view = Nt(this.buffer);
  }
  update(e) {
    zt(this), e = Ar(e), ft(e);
    const { view: n, buffer: r, blockLen: i } = this, s = e.length;
    for (let o = 0; o < s; ) {
      const a = Math.min(i - this.pos, s - o);
      if (a === i) {
        const c = Nt(e);
        for (; i <= s - o; o += i)
          this.process(c, o);
        continue;
      }
      r.set(e.subarray(o, o + a), this.pos), this.pos += a, o += a, this.pos === i && (this.process(n, 0), this.pos = 0);
    }
    return this.length += e.length, this.roundClean(), this;
  }
  digestInto(e) {
    zt(this), Sh(e, this), this.finished = !0;
    const { buffer: n, view: r, blockLen: i, isLE: s } = this;
    let { pos: o } = this;
    n[o++] = 128, vt(this.buffer.subarray(o)), this.padOffset > i - o && (this.process(r, 0), o = 0);
    for (let l = o; l < i; l++)
      n[l] = 0;
    Ph(r, i - 8, BigInt(this.length * 8), s), this.process(r, 0);
    const a = Nt(e), c = this.outputLen;
    if (c % 4)
      throw new Error("_sha2: outputLen should be aligned to 32bit");
    const u = c / 4, h = this.get();
    if (u > h.length)
      throw new Error("_sha2: outputLen bigger than state");
    for (let l = 0; l < u; l++)
      a.setUint32(4 * l, h[l], s);
  }
  digest() {
    const { buffer: e, outputLen: n } = this;
    this.digestInto(e);
    const r = e.slice(0, n);
    return this.destroy(), r;
  }
  _cloneInto(e) {
    e || (e = new this.constructor()), e.set(...this.get());
    const { blockLen: n, buffer: r, length: i, finished: s, destroyed: o, pos: a } = this;
    return e.destroyed = o, e.finished = s, e.length = i, e.pos = a, i % n && e.buffer.set(r), e;
  }
  clone() {
    return this._cloneInto();
  }
}
const Ne = /* @__PURE__ */ Uint32Array.from([
  1779033703,
  3144134277,
  1013904242,
  2773480762,
  1359893119,
  2600822924,
  528734635,
  1541459225
]), Nh = /* @__PURE__ */ Uint32Array.from([
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
]), Re = /* @__PURE__ */ new Uint32Array(64);
class Rh extends Uh {
  constructor(e = 32) {
    super(64, e, 8, !1), this.A = Ne[0] | 0, this.B = Ne[1] | 0, this.C = Ne[2] | 0, this.D = Ne[3] | 0, this.E = Ne[4] | 0, this.F = Ne[5] | 0, this.G = Ne[6] | 0, this.H = Ne[7] | 0;
  }
  get() {
    const { A: e, B: n, C: r, D: i, E: s, F: o, G: a, H: c } = this;
    return [e, n, r, i, s, o, a, c];
  }
  // prettier-ignore
  set(e, n, r, i, s, o, a, c) {
    this.A = e | 0, this.B = n | 0, this.C = r | 0, this.D = i | 0, this.E = s | 0, this.F = o | 0, this.G = a | 0, this.H = c | 0;
  }
  process(e, n) {
    for (let l = 0; l < 16; l++, n += 4)
      Re[l] = e.getUint32(n, !1);
    for (let l = 16; l < 64; l++) {
      const d = Re[l - 15], p = Re[l - 2], g = oe(d, 7) ^ oe(d, 18) ^ d >>> 3, f = oe(p, 17) ^ oe(p, 19) ^ p >>> 10;
      Re[l] = f + Re[l - 7] + g + Re[l - 16] | 0;
    }
    let { A: r, B: i, C: s, D: o, E: a, F: c, G: u, H: h } = this;
    for (let l = 0; l < 64; l++) {
      const d = oe(a, 6) ^ oe(a, 11) ^ oe(a, 25), p = h + d + $h(a, c, u) + Nh[l] + Re[l] | 0, f = (oe(r, 2) ^ oe(r, 13) ^ oe(r, 22)) + Bh(r, i, s) | 0;
      h = u, u = c, c = a, a = o + p | 0, o = s, s = i, i = r, r = p + f | 0;
    }
    r = r + this.A | 0, i = i + this.B | 0, s = s + this.C | 0, o = o + this.D | 0, a = a + this.E | 0, c = c + this.F | 0, u = u + this.G | 0, h = h + this.H | 0, this.set(r, i, s, o, a, c, u, h);
  }
  roundClean() {
    vt(Re);
  }
  destroy() {
    this.set(0, 0, 0, 0, 0, 0, 0, 0), vt(this.buffer);
  }
}
const Oh = /* @__PURE__ */ Lh(() => new Rh()), ro = Oh;
var It = new TextDecoder("utf-8");
new TextEncoder();
var Ch = 5e3;
function Hh(t) {
  var i, s, o, a, c, u, h;
  let { prefix: e, words: n } = Me.decode(t, Ch), r = new Uint8Array(Me.fromWords(n));
  switch (e) {
    case "nprofile": {
      let l = Ln(r);
      if (!((i = l[0]) != null && i[0]))
        throw new Error("missing TLV 0 for nprofile");
      if (l[0][0].length !== 32)
        throw new Error("TLV 0 should be 32 bytes");
      return {
        type: "nprofile",
        data: {
          pubkey: C(l[0][0]),
          relays: l[1] ? l[1].map((d) => It.decode(d)) : []
        }
      };
    }
    case "nevent": {
      let l = Ln(r);
      if (!((s = l[0]) != null && s[0]))
        throw new Error("missing TLV 0 for nevent");
      if (l[0][0].length !== 32)
        throw new Error("TLV 0 should be 32 bytes");
      if (l[2] && l[2][0].length !== 32)
        throw new Error("TLV 2 should be 32 bytes");
      if (l[3] && l[3][0].length !== 4)
        throw new Error("TLV 3 should be 4 bytes");
      return {
        type: "nevent",
        data: {
          id: C(l[0][0]),
          relays: l[1] ? l[1].map((d) => It.decode(d)) : [],
          author: (o = l[2]) != null && o[0] ? C(l[2][0]) : void 0,
          kind: (a = l[3]) != null && a[0] ? parseInt(C(l[3][0]), 16) : void 0
        }
      };
    }
    case "naddr": {
      let l = Ln(r);
      if (!((c = l[0]) != null && c[0]))
        throw new Error("missing TLV 0 for naddr");
      if (!((u = l[2]) != null && u[0]))
        throw new Error("missing TLV 2 for naddr");
      if (l[2][0].length !== 32)
        throw new Error("TLV 2 should be 32 bytes");
      if (!((h = l[3]) != null && h[0]))
        throw new Error("missing TLV 3 for naddr");
      if (l[3][0].length !== 4)
        throw new Error("TLV 3 should be 4 bytes");
      return {
        type: "naddr",
        data: {
          identifier: It.decode(l[0][0]),
          pubkey: C(l[2][0]),
          kind: parseInt(C(l[3][0]), 16),
          relays: l[1] ? l[1].map((d) => It.decode(d)) : []
        }
      };
    }
    case "nsec":
      return { type: e, data: r };
    case "npub":
    case "note":
      return { type: e, data: C(r) };
    default:
      throw new Error(`unknown prefix ${e}`);
  }
}
function Ln(t) {
  let e = {}, n = t;
  for (; n.length > 0; ) {
    let r = n[0], i = n[1], s = n.slice(2, 2 + i);
    if (n = n.slice(2 + i), s.length < i)
      throw new Error(`not enough data to read on TLV ${r}`);
    e[r] = e[r] || [], e[r].push(s);
  }
  return e;
}
var it = Symbol("verified"), Mh = (t) => t instanceof Object;
function Kh(t) {
  if (!Mh(t) || typeof t.kind != "number" || typeof t.content != "string" || typeof t.created_at != "number" || typeof t.pubkey != "string" || !t.pubkey.match(/^[a-f0-9]{64}$/) || !Array.isArray(t.tags))
    return !1;
  for (let e = 0; e < t.tags.length; e++) {
    let n = t.tags[e];
    if (!Array.isArray(n))
      return !1;
    for (let r = 0; r < n.length; r++)
      if (typeof n[r] != "string")
        return !1;
  }
  return !0;
}
new TextDecoder("utf-8");
var Dh = new TextEncoder(), qh = class {
  generateSecretKey() {
    return ce.utils.randomPrivateKey();
  }
  getPublicKey(t) {
    return C(ce.getPublicKey(t));
  }
  finalizeEvent(t, e) {
    const n = t;
    return n.pubkey = C(ce.getPublicKey(e)), n.id = kn(n), n.sig = C(ce.sign(kn(n), e)), n[it] = !0, n;
  }
  verifyEvent(t) {
    if (typeof t[it] == "boolean")
      return t[it];
    const e = kn(t);
    if (e !== t.id)
      return t[it] = !1, !1;
    try {
      const n = ce.verify(t.sig, e, t.pubkey);
      return t[it] = n, n;
    } catch {
      return t[it] = !1, !1;
    }
  }
};
function Vh(t) {
  if (!Kh(t))
    throw new Error("can't serialize event with wrong or missing properties");
  return JSON.stringify([0, t.pubkey, t.created_at, t.kind, t.tags, t.content]);
}
function kn(t) {
  let e = re(Dh.encode(Vh(t)));
  return C(e);
}
var un = new qh();
un.generateSecretKey;
var io = un.getPublicKey, Tt = un.finalizeEvent;
un.verifyEvent;
function so(t, e) {
  const n = e ? ae(e) : Ft(16);
  return { key: Th(ro, new TextEncoder().encode(t), n, {
    c: 1e5,
    dkLen: 32
  }), saltHex: Ee(n) };
}
function st(t, e, n) {
  const { key: r, saltHex: i } = so(e, n), s = Ft(12), a = Js(r, s).encrypt(new TextEncoder().encode(t)), c = {
    salt: i,
    iv: Ee(s),
    data: Ee(a)
  };
  return JSON.stringify(c);
}
function gt(t, e) {
  const n = JSON.parse(t), { key: r } = so(e, n.salt), s = Js(r, ae(n.iv)).decrypt(ae(n.data));
  return new TextDecoder().decode(s);
}
function zh(t) {
  if (t.format === "hex") {
    const r = t.value.trim().replace(/^0x/i, "").toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(r))
      throw new Error("Invalid hex private key. Expected 64 hex characters.");
    return ti(r), r;
  }
  const e = Hh(t.value.trim());
  if (e.type !== "nsec")
    throw new Error("Invalid nsec value.");
  const n = Ee(e.data);
  return ti(n), n;
}
function Rt(t) {
  return io(ae(t));
}
function ti(t) {
  Rt(t);
}
function Wt(t) {
  return Ee(ro(new TextEncoder().encode(t))).slice(0, 32);
}
function ni(t, e, n, r) {
  return `${t}:lite:login:${e}:${Wt(n)}:${r}`;
}
function Fh(t, e, n) {
  return `${t}:lite:vault:${Wt(e)}:${n}`;
}
var Wh = new TextDecoder("utf-8"), jh = new TextEncoder();
function Gh(t, e, n) {
  const r = t instanceof Uint8Array ? C(t) : t, i = Ae.getSharedSecret(r, "02" + e), s = oo(i);
  let o = Uint8Array.from(Yt(16)), a = jh.encode(n), c = Qt(s, o).encrypt(a), u = G.encode(new Uint8Array(c)), h = G.encode(new Uint8Array(o.buffer));
  return `${u}?iv=${h}`;
}
function Zh(t, e, n) {
  const r = t instanceof Uint8Array ? C(t) : t;
  let [i, s] = n.split("?iv="), o = Ae.getSharedSecret(r, "02" + e), a = oo(o), c = G.decode(s), u = G.decode(i), h = Qt(a, c).decrypt(u);
  return Wh.decode(h);
}
function oo(t) {
  return t.slice(1, 33);
}
var Jh = new TextDecoder("utf-8"), Yh = new TextEncoder(), ao = 1, co = 65535;
function Xh(t, e) {
  const n = Ae.getSharedSecret(t, "02" + e).subarray(1, 33);
  return zi(re, n, "nip44-v2");
}
function lo(t, e) {
  const n = Fi(re, t, e, 76);
  return {
    chacha_key: n.subarray(0, 32),
    chacha_nonce: n.subarray(32, 44),
    hmac_key: n.subarray(44, 76)
  };
}
function _r(t) {
  if (!Number.isSafeInteger(t) || t < 1)
    throw new Error("expected positive integer");
  if (t <= 32)
    return 32;
  const e = 1 << Math.floor(Math.log2(t - 1)) + 1, n = e <= 256 ? 32 : e / 8;
  return n * (Math.floor((t - 1) / n) + 1);
}
function Qh(t) {
  if (!Number.isSafeInteger(t) || t < ao || t > co)
    throw new Error("invalid plaintext size: must be between 1 and 65535 bytes");
  const e = new Uint8Array(2);
  return new DataView(e.buffer).setUint16(0, t, !1), e;
}
function ef(t) {
  const e = Yh.encode(t), n = e.length, r = Qh(n), i = new Uint8Array(_r(n) - n);
  return Ye(r, e, i);
}
function tf(t) {
  const e = new DataView(t.buffer).getUint16(0), n = t.subarray(2, 2 + e);
  if (e < ao || e > co || n.length !== e || t.length !== 2 + _r(e))
    throw new Error("invalid padding");
  return Jh.decode(n);
}
function uo(t, e, n) {
  if (n.length !== 32)
    throw new Error("AAD associated data must be 32 bytes");
  const r = Ye(n, e);
  return xt(re, t, r);
}
function nf(t) {
  if (typeof t != "string")
    throw new Error("payload must be a valid string");
  const e = t.length;
  if (e < 132 || e > 87472)
    throw new Error("invalid payload length: " + e);
  if (t[0] === "#")
    throw new Error("unknown encryption version");
  let n;
  try {
    n = G.decode(t);
  } catch (s) {
    throw new Error("invalid base64: " + s.message);
  }
  const r = n.length;
  if (r < 99 || r > 65603)
    throw new Error("invalid data length: " + r);
  const i = n[0];
  if (i !== 2)
    throw new Error("unknown encryption version " + i);
  return {
    nonce: n.subarray(1, 33),
    ciphertext: n.subarray(33, -32),
    mac: n.subarray(-32)
  };
}
function rf(t, e, n = Yt(32)) {
  const { chacha_key: r, chacha_nonce: i, hmac_key: s } = lo(e, n), o = ef(t), a = en(r, i, o), c = uo(s, a, n);
  return G.encode(Ye(new Uint8Array([2]), n, a, c));
}
function sf(t, e) {
  const { nonce: n, ciphertext: r, mac: i } = nf(t), { chacha_key: s, chacha_nonce: o, hmac_key: a } = lo(e, n), c = uo(a, r, n);
  if (!Ri(c, i))
    throw new Error("invalid MAC");
  const u = en(s, o, r);
  return tf(u);
}
var Pt = {
  utils: {
    getConversationKey: Xh,
    calcPaddedLen: _r
  },
  encrypt: rf,
  decrypt: sf
};
const Ve = 30078, ri = "auth-state", of = "cache:login", af = "cache:vault", cf = 60;
class lf {
  constructor(e) {
    b(this, "storage");
    b(this, "relayClient");
    b(this, "namespace");
    b(this, "environment");
    b(this, "defaultRelays");
    b(this, "allowOffline");
    b(this, "minRelayAcks");
    b(this, "now");
    b(this, "session", null);
    b(this, "authState", {
      initialized: !1,
      isAuthenticated: !1,
      isLocked: !0
    });
    b(this, "pendingPermissionRequests", /* @__PURE__ */ new Map());
    b(this, "sessionPermissionGrants", /* @__PURE__ */ new Map());
    this.storage = e.storage, this.relayClient = e.relayClient, this.namespace = e.namespace ?? "nostrpass.com", this.environment = e.environment ?? "production", this.defaultRelays = e.relays ?? [
      "wss://relay.damus.io",
      "wss://nos.lol",
      "wss://relay.nostr.band"
    ], this.allowOffline = e.allowOffline ?? !1, this.minRelayAcks = Math.max(
      0,
      Math.floor(e.minRelayAcks ?? 1)
    ), this.now = e.now ?? (() => Date.now());
  }
  async initialize() {
    this.logStep("initialize:start");
    const e = await this.storage.get(ri);
    return e ? this.authState = {
      initialized: !0,
      isAuthenticated: !1,
      isLocked: !0,
      authMethod: e.authMethod,
      identifier: e.identifier,
      publicKey: e.publicKey
    } : this.authState.initialized = !0, await this.persistAuthState(), this.logStep("initialize:done", this.authState), this.getAuthState();
  }
  getAuthState() {
    return { ...this.authState };
  }
  getPendingPermissionRequest(e) {
    if (e)
      return this.pendingPermissionRequests.get(e) ?? null;
    const n = this.pendingPermissionRequests.values().next();
    return n.done ? null : n.value;
  }
  async enrollWithPassword(e) {
    return this.enroll({ ...e, authMethod: "password" });
  }
  async enrollWithGoogle(e) {
    return this.enroll({ ...e, authMethod: "google" });
  }
  async loginWithPassword(e) {
    return this.login({ ...e, authMethod: "password" });
  }
  async loginWithGoogle(e) {
    return this.login({ ...e, authMethod: "google" });
  }
  async importKey(e) {
    this.logStep("importKey:start", {
      authMethod: e.authMethod,
      identifier: e.identifier,
      format: e.format
    });
    const n = zh({ format: e.format, value: e.value });
    return this.logStep("importKey:keyNormalized", {
      pubkey: Rt(n)
    }), this.enroll({
      ...e,
      privateKeyHex: n
    });
  }
  async login(e) {
    this.logStep("login:start", {
      authMethod: e.authMethod,
      identifier: e.identifier
    }), this.assertNonEmpty(e.identifier, "Identifier is required"), this.assertNonEmpty(e.authSecret, "Auth secret is required");
    const n = e.relays ?? this.defaultRelays, r = ni(
      this.namespace,
      e.authMethod,
      e.identifier,
      this.environment
    ), i = await this.fetchLoginRecord(r);
    if (!i)
      return this.logStep("login:missingLoginRecord", { loginDTag: r }), this.errorState("No login record found", "NOT_FOUND");
    this.logStep("login:loginRecordFound", {
      loginDTag: r,
      createdAt: i.createdAt
    });
    let s;
    try {
      const h = gt(i.content, e.authSecret);
      s = JSON.parse(h);
    } catch {
      return this.logStep("login:loginDecryptFailed"), this.errorState("Unable to decrypt login record", "INVALID_INPUT");
    }
    this.logStep("login:loginDecrypted", {
      publicKey: s.publicKey,
      storagePublicKey: s.storagePublicKey
    });
    const o = await this.relayClient.getLatest({
      kinds: [Ve],
      authors: [s.storagePublicKey],
      dTags: [s.vaultDTag],
      limit: 20
    }) ?? await this.storage.get(
      this.vaultCacheKey(s.publicKey)
    );
    if (!o)
      return this.logStep("login:missingVaultRecord", {
        vaultDTag: s.vaultDTag
      }), this.errorState("Vault record not found", "NOT_FOUND");
    this.logStep("login:vaultRecordFound", {
      createdAt: o.createdAt,
      pubkey: o.pubkey
    });
    let a, c, u;
    try {
      a = gt(s.vaultSecretEncrypted, e.authSecret), c = gt(
        s.storagePrivateKeyEncrypted,
        e.authSecret
      ), u = JSON.parse(gt(o.content, a));
    } catch {
      return this.logStep("login:vaultDecryptFailed"), this.errorState("Unable to decrypt vault", "INVALID_INPUT");
    }
    return this.logStep("login:vaultDecrypted", {
      publicKey: u.publicKey
    }), this.session = {
      authMethod: e.authMethod,
      identifier: e.identifier,
      authSecret: e.authSecret,
      relays: n,
      loginPayload: s,
      vaultSecret: a,
      storagePrivateKey: c,
      vaultPayload: u
    }, this.sessionPermissionGrants.clear(), this.authState = {
      initialized: !0,
      isAuthenticated: !0,
      isLocked: !0,
      authMethod: e.authMethod,
      identifier: e.identifier,
      publicKey: u.publicKey
    }, await this.cacheLoginAndVault(r, i.content, s.publicKey, o.content), await this.persistAuthState(), this.logStep("login:done", this.authState), this.getAuthState();
  }
  async unlock(e) {
    this.logStep("unlock:start"), this.assertSession(), this.assertNonEmpty(e.pin, "PIN is required");
    try {
      const n = gt(
        this.session.vaultPayload.privateKeyEncrypted,
        e.pin
      ), r = Rt(n);
      if (r !== this.session.vaultPayload.publicKey)
        return this.logStep("unlock:pubkeyMismatch", {
          expected: this.session.vaultPayload.publicKey,
          got: r
        }), this.errorState("PIN unlock validation failed", "INVALID_INPUT");
      this.session.unlockedPrivateKey = n;
    } catch {
      return this.logStep("unlock:decryptFailed"), this.errorState("Invalid PIN", "INVALID_INPUT");
    }
    return this.authState.isLocked = !1, await this.persistAuthState(), this.logStep("unlock:done", this.authState), this.getAuthState();
  }
  async lock() {
    return this.session && delete this.session.unlockedPrivateKey, this.sessionPermissionGrants.clear(), this.authState.isAuthenticated && (this.authState.isLocked = !0), await this.persistAuthState(), this.getAuthState();
  }
  async logout() {
    return this.session = null, this.pendingPermissionRequests.clear(), this.sessionPermissionGrants.clear(), this.authState = {
      initialized: !0,
      isAuthenticated: !1,
      isLocked: !0
    }, await this.persistAuthState(), this.getAuthState();
  }
  async requestOperation(e) {
    if (this.logStep("operation:start", {
      origin: e.origin,
      operation: e.operation
    }), !this.session)
      return this.logStep("operation:blocked:notAuthenticated"), {
        success: !1,
        error: "Not authenticated",
        errorCode: "NOT_AUTHENTICATED"
      };
    if (e.operation !== "getPublicKey" && !this.session.unlockedPrivateKey)
      return this.logStep("operation:blocked:locked"), {
        success: !1,
        error: "Vault is locked",
        errorCode: "LOCKED"
      };
    if (this.hasValidSessionPermission(e.origin, e.operation))
      return this.logStep("operation:allowed:sessionGrant"), this.executeOperation(e);
    const n = this.resolvePermissionLevel(e.origin, e.operation);
    if (n === "DENY")
      return this.logStep("operation:blocked:denied"), {
        success: !1,
        error: "Permission denied",
        errorCode: "PERMISSION_DENIED"
      };
    if (n === "ASK_EVERYTIME" || n === "ASK_PER_SESSION") {
      const r = this.createRequestId();
      return this.logStep("operation:permissionRequired", { requestId: r }), this.pendingPermissionRequests.set(r, {
        id: r,
        origin: e.origin,
        operation: e.operation,
        payload: e.payload,
        createdAt: this.now()
      }), {
        success: !1,
        error: "Permission required",
        errorCode: "PERMISSION_REQUIRED",
        requestId: r
      };
    }
    return this.logStep("operation:allowed"), this.executeOperation(e);
  }
  async resolvePermission(e) {
    this.logStep("permission:resolve:start", e);
    const n = this.pendingPermissionRequests.get(e.requestId);
    if (!n)
      return this.logStep("permission:resolve:notFound", { requestId: e.requestId }), {
        success: !1,
        error: "Pending permission request not found",
        errorCode: "NOT_FOUND"
      };
    if (this.pendingPermissionRequests.delete(e.requestId), !e.granted)
      return this.logStep("permission:resolve:denied"), {
        success: !1,
        error: "Permission denied",
        errorCode: "PERMISSION_DENIED"
      };
    if (e.remember) {
      const r = e.level ?? "ALLOW";
      if (r === "ASK_PER_SESSION") {
        const i = Math.max(
          1,
          Math.floor(e.sessionDurationMinutes ?? cf)
        ), s = this.now() + i * 60 * 1e3;
        this.sessionPermissionGrants.set(
          this.permissionSessionKey(n.origin, n.operation),
          s
        ), this.logStep("permission:resolve:sessionGrant", {
          origin: n.origin,
          operation: n.operation,
          expiresAt: s
        });
      } else {
        this.assertSession();
        const i = this.session.vaultPayload.permissions[n.origin] ?? {};
        i[n.operation] = r, this.session.vaultPayload.permissions[n.origin] = i, await this.persistVault(), this.logStep("permission:resolve:remembered", {
          origin: n.origin,
          operation: n.operation,
          level: r
        });
      }
    }
    return this.logStep("permission:resolve:executing"), this.executeOperation({
      origin: n.origin,
      operation: n.operation,
      payload: n.payload
    });
  }
  async enroll(e) {
    this.logStep("enroll:start", {
      authMethod: e.authMethod,
      identifier: e.identifier,
      byok: !!e.privateKeyHex
    }), this.assertNonEmpty(e.identifier, "Identifier is required"), this.assertNonEmpty(e.authSecret, "Auth secret is required"), this.assertNonEmpty(e.pin, "PIN is required");
    const n = this.now(), r = e.relays ?? this.defaultRelays, i = e.privateKeyHex ?? Ee(Bt()), s = Rt(i), o = ni(
      this.namespace,
      e.authMethod,
      e.identifier,
      this.environment
    ), a = Fh(this.namespace, s, this.environment);
    if (await this.relayClient.getLatest({
      kinds: [Ve],
      dTags: [o],
      limit: 10
    }) && !e.overwriteExistingLogin)
      throw this.logStep("enroll:conflict:loginRecordExists"), this.conflictError("Login record already exists");
    if (await this.relayClient.getLatest({
      kinds: [Ve],
      dTags: [a],
      limit: 10
    }) && !e.overwriteExistingVault)
      throw this.logStep("enroll:conflict:vaultRecordExists"), this.conflictError("Vault record already exists for this key");
    const h = Ee(Ft(16)), l = st(i, e.pin, h), d = {
      version: 1,
      publicKey: s,
      privateKeyEncrypted: l,
      pinSalt: h,
      permissions: {},
      createdAt: n,
      updatedAt: n
    }, p = Ee(Ft(32)), g = st(
      JSON.stringify(d),
      p
    ), f = Ee(Bt()), y = io(ae(f)), w = {
      kind: Ve,
      created_at: Math.floor(n / 1e3),
      tags: [
        ["d", a],
        ["client", this.namespace],
        ["schema", "nostrpass-lite-v1"]
      ],
      content: g
    }, m = Tt(
      w,
      ae(f)
    ), S = await this.relayClient.publish(m);
    if (!S.length && !this.allowOffline)
      throw this.logStep("enroll:vaultPublishFailed"), new Error("Failed to publish vault event to relays");
    this.assertRelayDurability({
      operation: "enroll.vault",
      relayCount: S.length,
      relayTarget: r.length
    }), this.logStep("enroll:vaultPublished", {
      relayCount: S.length,
      offlineFallback: S.length === 0
    });
    const L = {
      version: 1,
      authMethod: e.authMethod,
      identifier: e.identifier,
      publicKey: s,
      storagePublicKey: y,
      storagePrivateKeyEncrypted: st(f, e.authSecret),
      vaultSecretEncrypted: st(p, e.authSecret),
      vaultDTag: a,
      createdAt: n,
      updatedAt: n
    }, I = st(
      JSON.stringify(L),
      e.authSecret
    ), x = Bt(), A = {
      kind: Ve,
      created_at: Math.floor(n / 1e3),
      tags: [
        ["d", o],
        ["client", this.namespace],
        ["schema", "nostrpass-lite-v1"],
        ["auth", e.authMethod],
        ["identifier-hash", Wt(e.identifier)]
      ],
      content: I
    }, _ = Tt(A, x), U = await this.relayClient.publish(_);
    if (!U.length && !this.allowOffline)
      throw this.logStep("enroll:loginPublishFailed"), new Error("Failed to publish login event to relays");
    return this.assertRelayDurability({
      operation: "enroll.login",
      relayCount: U.length,
      relayTarget: r.length
    }), this.logStep("enroll:loginPublished", {
      relayCount: U.length,
      offlineFallback: U.length === 0
    }), this.session = {
      authMethod: e.authMethod,
      identifier: e.identifier,
      authSecret: e.authSecret,
      relays: r,
      loginPayload: L,
      vaultSecret: p,
      storagePrivateKey: f,
      vaultPayload: d,
      unlockedPrivateKey: i
    }, this.sessionPermissionGrants.clear(), this.authState = {
      initialized: !0,
      isAuthenticated: !0,
      isLocked: !1,
      authMethod: e.authMethod,
      identifier: e.identifier,
      publicKey: s
    }, await this.cacheLoginAndVault(o, I, s, g), await this.persistAuthState(), this.logStep("enroll:done", this.authState), {
      authState: this.getAuthState(),
      publicKey: s
    };
  }
  async fetchLoginRecord(e) {
    this.logStep("loginRecord:fetch:start", { loginDTag: e });
    const n = await this.relayClient.getLatest({
      kinds: [Ve],
      dTags: [e],
      limit: 20
    });
    if (n)
      return this.logStep("loginRecord:fetch:relayHit"), await this.storage.set(this.loginCacheKey(e), n), n;
    const r = await this.storage.get(
      this.loginCacheKey(e)
    );
    return this.logStep("loginRecord:fetch:cache", { hit: !!r }), r;
  }
  async cacheLoginAndVault(e, n, r, i) {
    var s;
    await this.storage.set(this.loginCacheKey(e), {
      content: n,
      createdAt: this.now(),
      pubkey: ""
    }), await this.storage.set(this.vaultCacheKey(r), {
      content: i,
      createdAt: this.now(),
      pubkey: ((s = this.session) == null ? void 0 : s.loginPayload.storagePublicKey) ?? ""
    });
  }
  resolvePermissionLevel(e, n) {
    this.assertSession();
    const r = this.session.vaultPayload.permissions[e];
    return (r == null ? void 0 : r[n]) ?? "ASK_EVERYTIME";
  }
  hasValidSessionPermission(e, n) {
    const r = this.permissionSessionKey(e, n), i = this.sessionPermissionGrants.get(r);
    return i ? this.now() > i ? (this.sessionPermissionGrants.delete(r), !1) : !0 : !1;
  }
  permissionSessionKey(e, n) {
    return `${e}::${n}`;
  }
  async executeOperation(e) {
    var n, r, i, s, o, a, c, u, h;
    this.assertSession();
    try {
      switch (e.operation) {
        case "getPublicKey":
          return this.logStep("operation:execute:getPublicKey"), { success: !0, data: this.session.vaultPayload.publicKey };
        case "signEvent": {
          this.logStep("operation:execute:signEvent");
          const l = (n = e.payload) == null ? void 0 : n.event;
          if (!l || typeof l != "object")
            return {
              success: !1,
              error: "Missing event payload",
              errorCode: "INVALID_INPUT"
            };
          const d = {
            kind: Number(l.kind ?? 1),
            created_at: Number(l.created_at ?? Math.floor(this.now() / 1e3)),
            tags: l.tags ?? [],
            content: String(l.content ?? "")
          };
          return { success: !0, data: Tt(d, ae(this.session.unlockedPrivateKey)) };
        }
        case "nip04.encrypt": {
          this.logStep("operation:execute:nip04.encrypt");
          const l = String(((r = e.payload) == null ? void 0 : r.pubkey) ?? ""), d = String(((i = e.payload) == null ? void 0 : i.plaintext) ?? "");
          return { success: !0, data: await Gh(
            this.session.unlockedPrivateKey,
            l,
            d
          ) };
        }
        case "nip04.decrypt": {
          this.logStep("operation:execute:nip04.decrypt");
          const l = String(((s = e.payload) == null ? void 0 : s.pubkey) ?? ""), d = String(((o = e.payload) == null ? void 0 : o.ciphertext) ?? "");
          return { success: !0, data: await Zh(
            this.session.unlockedPrivateKey,
            l,
            d
          ) };
        }
        case "nip44.encrypt": {
          this.logStep("operation:execute:nip44.encrypt");
          const l = String(((a = e.payload) == null ? void 0 : a.pubkey) ?? ""), d = String(((c = e.payload) == null ? void 0 : c.plaintext) ?? ""), p = Pt.utils.getConversationKey(
            ae(this.session.unlockedPrivateKey),
            l
          );
          return {
            success: !0,
            data: Pt.encrypt(d, p)
          };
        }
        case "nip44.decrypt": {
          this.logStep("operation:execute:nip44.decrypt");
          const l = String(((u = e.payload) == null ? void 0 : u.pubkey) ?? ""), d = String(((h = e.payload) == null ? void 0 : h.ciphertext) ?? ""), p = Pt.utils.getConversationKey(
            ae(this.session.unlockedPrivateKey),
            l
          );
          return {
            success: !0,
            data: Pt.decrypt(d, p)
          };
        }
        default:
          return {
            success: !1,
            error: `Unsupported operation: ${e.operation}`,
            errorCode: "INVALID_INPUT"
          };
      }
    } catch (l) {
      return {
        success: !1,
        error: l instanceof Error ? l.message : "Operation failed",
        errorCode: "INTERNAL_ERROR"
      };
    }
  }
  async persistVault() {
    this.logStep("vault:persist:start"), this.assertSession(), this.session.vaultPayload.updatedAt = this.now();
    const e = st(
      JSON.stringify(this.session.vaultPayload),
      this.session.vaultSecret
    ), n = {
      kind: Ve,
      created_at: Math.floor(this.now() / 1e3),
      tags: [
        ["d", this.session.loginPayload.vaultDTag],
        ["client", this.namespace],
        ["schema", "nostrpass-lite-v1"]
      ],
      content: e
    }, r = Tt(n, ae(this.session.storagePrivateKey)), i = await this.relayClient.publish(r);
    if (!i.length && !this.allowOffline)
      throw this.logStep("vault:persist:publishFailed"), new Error("Failed to publish updated vault event to relays");
    this.assertRelayDurability({
      operation: "vault.persist",
      relayCount: i.length,
      relayTarget: this.session.relays.length
    }), this.logStep("vault:persist:published", {
      relayCount: i.length,
      offlineFallback: i.length === 0
    }), await this.storage.set(this.vaultCacheKey(this.session.vaultPayload.publicKey), {
      content: e,
      createdAt: this.now(),
      pubkey: this.session.loginPayload.storagePublicKey
    });
  }
  async persistAuthState() {
    await this.storage.set(ri, this.authState);
  }
  createRequestId() {
    return `lite-pr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
  loginCacheKey(e) {
    return `${of}:${e}`;
  }
  vaultCacheKey(e) {
    return `${af}:${Wt(e)}`;
  }
  assertSession() {
    if (!this.session)
      throw new Error("Not authenticated");
  }
  assertNonEmpty(e, n) {
    if (!e.trim())
      throw new Error(n);
  }
  conflictError(e) {
    const n = new Error(e);
    return n.code = "CONFLICT", n;
  }
  assertRelayDurability(e) {
    if (e.relayCount >= this.minRelayAcks)
      return;
    const n = new Error(
      `Durability check failed for ${e.operation}: published to ${e.relayCount}/${e.relayTarget} relays, requires at least ${this.minRelayAcks}.`
    );
    throw n.code = "RELAY_DURABILITY_FAILED", n;
  }
  errorState(e, n) {
    throw this.logStep("errorState", { message: e, code: n }), this.authState = {
      initialized: !0,
      isAuthenticated: !1,
      isLocked: !0
    }, this.session = null, this.sessionPermissionGrants.clear(), this.persistAuthState(), Object.assign(new Error(e), { code: n });
  }
  logStep(e, n) {
    if (n === void 0) {
      console.info(`[LiteCore] ${e}`);
      return;
    }
    console.info(`[LiteCore] ${e}`, this.redactForLog(n));
  }
  redactForLog(e) {
    const n = /* @__PURE__ */ new Set([
      "password",
      "pin",
      "authSecret",
      "privateKeyHex",
      "storagePrivateKey",
      "storagePrivateKeyEncrypted",
      "unlockedPrivateKey",
      "vaultSecret",
      "vaultPayload",
      "loginPayload",
      "encryptedNsec",
      "nsec",
      "xpriv",
      "xprivEncrypted",
      "salt",
      "pinSalt",
      "passwordSalt"
    ]), r = (i) => {
      if (!i || typeof i != "object")
        return i;
      if (Array.isArray(i))
        return i.map(r);
      const s = {};
      for (const [o, a] of Object.entries(i))
        s[o] = n.has(o) ? "[REDACTED]" : r(a);
      return s;
    };
    return r(e);
  }
}
async function ot(t, e, n, r) {
  var h;
  console.info("[LiteAPI] operation:start", { operation: e });
  const i = ((h = r.originResolver) == null ? void 0 : h.call(r)) ?? window.location.origin, s = await t.requestOperation({
    origin: i,
    operation: e,
    payload: n
  });
  if (s.success)
    return console.info("[LiteAPI] operation:done", { operation: e, immediate: !0 }), s.data;
  if (s.errorCode !== "PERMISSION_REQUIRED" || !s.requestId)
    throw new Error(s.error ?? "Operation failed");
  if (!r.onPermissionPrompt)
    throw new Error("Permission required but no prompt handler is configured");
  const o = t.getPendingPermissionRequest(s.requestId);
  if (!o)
    throw new Error("Pending permission request was not found");
  const a = await r.onPermissionPrompt({
    requestId: s.requestId,
    origin: o.origin,
    operation: o.operation
  }), c = {
    requestId: s.requestId,
    granted: a.granted,
    remember: a.remember,
    level: a.level,
    sessionDurationMinutes: a.sessionDurationMinutes
  }, u = await t.resolvePermission(c);
  if (!u.success)
    throw new Error(u.error ?? "Operation denied");
  return console.info("[LiteAPI] operation:done", { operation: e, immediate: !1 }), u.data;
}
function uf(t, e = {}) {
  return {
    async getPublicKey(n) {
      return ot(t, "getPublicKey", {}, e);
    },
    async signEvent(n, r) {
      return ot(t, "signEvent", { event: n }, e);
    },
    nip04: {
      async encrypt(n, r, i) {
        return ot(
          t,
          "nip04.encrypt",
          { pubkey: n, plaintext: r },
          e
        );
      },
      async decrypt(n, r, i) {
        return ot(
          t,
          "nip04.decrypt",
          { pubkey: n, ciphertext: r },
          e
        );
      }
    },
    nip44: {
      async encrypt(n, r, i) {
        return ot(
          t,
          "nip44.encrypt",
          { pubkey: n, plaintext: r },
          e
        );
      },
      async decrypt(n, r, i) {
        return ot(
          t,
          "nip44.decrypt",
          { pubkey: n, ciphertext: r },
          e
        );
      }
    }
  };
}
const hf = ["wss://relay.damus.io", "wss://nos.lol", "wss://relay.nostr.band"], ii = "nostrpass-lite:status", si = "nostrpass-lite-button-styles";
function In(t) {
  var e;
  if (!t)
    return typeof window < "u" && ((e = window.location) != null && e.origin) ? window.location.origin : "unknown";
  try {
    return new URL(t).origin;
  } catch {
    return t;
  }
}
function oi(t) {
  if (!t || typeof t != "object")
    return !1;
  const e = t;
  return typeof e.initialized == "boolean" && typeof e.isAuthenticated == "boolean" && typeof e.isLocked == "boolean";
}
function ff() {
  if (typeof document > "u" || document.getElementById(si))
    return;
  const t = document.createElement("style");
  t.id = si, t.textContent = `
  .nostrpass-lite-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    min-height: 34px;
    border-radius: 10px;
    border: 1px solid #0f172a;
    background: linear-gradient(180deg, #111827 0%, #0f172a 100%);
    color: #f8fafc;
    font-family: "IBM Plex Sans", "Inter", "Segoe UI", sans-serif;
    font-size: 0.82rem;
    font-weight: 600;
    letter-spacing: 0.01em;
    padding: 0.45rem 0.78rem;
    box-shadow: 0 10px 20px -16px rgba(15, 23, 42, 0.9);
    cursor: pointer;
    transition: transform 120ms ease, box-shadow 120ms ease, filter 120ms ease;
    white-space: nowrap;
  }
  .nostrpass-lite-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 18px 28px -20px rgba(15, 23, 42, 0.95);
  }
  .nostrpass-lite-btn:active {
    transform: translateY(0);
  }
  .nostrpass-lite-btn[data-auth="locked"] {
    border-color: #fbbf24;
    background: linear-gradient(180deg, #854d0e 0%, #713f12 100%);
  }
  .nostrpass-lite-btn[data-auth="signed-in"] {
    border-color: #22c55e;
    background: linear-gradient(180deg, #166534 0%, #14532d 100%);
  }
  .nostrpass-lite-btn[data-busy="true"] {
    opacity: 0.88;
    cursor: progress;
    filter: saturate(0.9);
  }
  `, document.head.appendChild(t);
}
class df {
  constructor(e = {}) {
    b(this, "config");
    b(this, "core");
    b(this, "nostrApi");
    b(this, "provider");
    b(this, "initialized", !1);
    b(this, "providerInstalled", !1);
    b(this, "previousProvider");
    this.config = e;
    const n = e.relays ?? hf;
    this.core = new lf({
      storage: new po(e.storagePrefix ?? "nostrpass-lite-embassy"),
      relayClient: new eh(n),
      namespace: e.namespace ?? "nostrpass-lite",
      environment: e.environment ?? "production",
      relays: n,
      minRelayAcks: e.minRelayAcks ?? 1
    }), this.nostrApi = uf(this.core, {
      originResolver: () => this.resolveOrigin(),
      onPermissionPrompt: (r) => this.handlePermissionPrompt(r)
    }), this.provider = {
      getPublicKey: (r) => this.getPublicKey(r),
      signEvent: (r, i) => this.signEvent(r, i),
      nip04: {
        encrypt: (r, i, s) => this.nip04Encrypt(r, i, s),
        decrypt: (r, i, s) => this.nip04Decrypt(r, i, s)
      },
      nip44: {
        encrypt: (r, i, s) => this.nip44Encrypt(r, i, s),
        decrypt: (r, i, s) => this.nip44Decrypt(r, i, s)
      },
      createNostrPassLiteButton: (r) => this.createNostrPassLiteButton(r)
    };
  }
  async initialize() {
    if (this.initialized)
      return this.core.getAuthState();
    this.emitStatus("processing", { action: "initialize" });
    const e = await this.core.initialize();
    return this.initialized = !0, this.emitAuthDrivenStatus(e, "ready", { action: "initialize" }), (this.config.installProviderOnInit ?? !0) && this.installNostrProvider({
      overrideExisting: this.config.overrideExistingProvider ?? !1
    }), e;
  }
  getAuthState() {
    return this.core.getAuthState();
  }
  async enrollWithPassword(e) {
    return this.runAction("enroll", () => this.core.enrollWithPassword(e));
  }
  async importKey(e) {
    return this.runAction(
      "importKey",
      () => this.core.importKey({
        authMethod: "password",
        ...e
      })
    );
  }
  async loginWithPassword(e) {
    return this.runAction("login", () => this.core.loginWithPassword(e));
  }
  async unlock(e) {
    return this.runAction("unlock", () => this.core.unlock(e));
  }
  async lock() {
    return this.runAction("lock", () => this.core.lock());
  }
  async logout() {
    return this.runAction("logout", () => this.core.logout());
  }
  async getPublicKey(e) {
    return this.runNostrOperation("getPublicKey", () => this.nostrApi.getPublicKey());
  }
  async signEvent(e, n) {
    return this.runNostrOperation(
      "signEvent",
      () => this.nostrApi.signEvent(e)
    );
  }
  async nip04Encrypt(e, n, r) {
    return this.runNostrOperation(
      "nip04.encrypt",
      () => this.nostrApi.nip04.encrypt(e, n)
    );
  }
  async nip04Decrypt(e, n, r) {
    return this.runNostrOperation(
      "nip04.decrypt",
      () => this.nostrApi.nip04.decrypt(e, n)
    );
  }
  async nip44Encrypt(e, n, r) {
    return this.runNostrOperation(
      "nip44.encrypt",
      () => this.nostrApi.nip44.encrypt(e, n)
    );
  }
  async nip44Decrypt(e, n, r) {
    return this.runNostrOperation(
      "nip44.decrypt",
      () => this.nostrApi.nip44.decrypt(e, n)
    );
  }
  installNostrProvider(e = {}) {
    if (typeof window > "u")
      return !1;
    const n = e.overrideExisting ?? !1, r = window;
    return r.nostr && !n ? (this.debug("Provider already exists, install skipped"), !1) : (this.providerInstalled || (this.previousProvider = r.nostr), r.nostr = this.provider, this.providerInstalled = !0, window.dispatchEvent(new Event("nostr-ready")), this.emitStatus("ready", { action: "install-provider" }), this.debug("Installed window.nostr provider"), !0);
  }
  uninstallNostrProvider() {
    if (typeof window > "u" || !this.providerInstalled)
      return;
    const e = window;
    this.previousProvider === void 0 ? delete e.nostr : e.nostr = this.previousProvider, this.providerInstalled = !1, this.debug("Uninstalled window.nostr provider");
  }
  createNostrPassLiteButton(e = {}) {
    if (typeof document > "u")
      throw new Error("Buttons require a browser environment");
    ff();
    const n = document.createElement("button");
    n.type = "button", n.className = ["nostrpass-lite-btn", e.className ?? ""].join(" ").trim();
    const r = () => {
      const o = this.core.getAuthState();
      if (!o.isAuthenticated) {
        n.dataset.auth = "signed-out", n.textContent = e.labelSignedOut ?? "Use NostrPass";
        return;
      }
      if (o.isLocked) {
        n.dataset.auth = "locked", n.textContent = e.labelLocked ?? "Unlock NostrPass";
        return;
      }
      n.dataset.auth = "signed-in", n.textContent = e.labelSignedIn ?? "Connected";
    }, i = this.config.statusEventName ?? ii, s = (o) => {
      var c;
      const a = (c = o.detail) == null ? void 0 : c.kind;
      n.dataset.busy = a === "processing" ? "true" : "false", r();
    };
    if (n.addEventListener("click", () => {
      const o = this.core.getAuthState();
      e.onClick ? e.onClick(this, o) : o.isAuthenticated ? o.isLocked ? this.emitStatus("pin_required", { source: "button" }, o) : this.emitStatus("ready", { source: "button" }, o) : this.emitStatus("auth_required", { source: "button" }, o);
    }), window.addEventListener(i, s), r(), e.appendTo)
      if (typeof e.appendTo == "string") {
        const o = document.querySelector(e.appendTo);
        o == null || o.appendChild(n);
      } else
        e.appendTo.appendChild(n);
    return {
      element: n,
      refresh: r,
      destroy: () => {
        window.removeEventListener(i, s), n.remove();
      }
    };
  }
  async runAction(e, n) {
    await this.ensureInitialized(), this.emitStatus("processing", { action: e });
    try {
      const r = await n(), i = this.extractAuthState(r) ?? this.core.getAuthState();
      return this.emitAuthDrivenStatus(i, "success", { action: e }), r;
    } catch (r) {
      throw this.emitStatus("error", {
        action: e,
        message: r instanceof Error ? r.message : String(r)
      }), r;
    }
  }
  async runNostrOperation(e, n) {
    await this.ensureInitialized(), this.emitStatus("processing", { operation: e });
    try {
      const r = await n();
      return this.emitAuthDrivenStatus(this.core.getAuthState(), "success", { operation: e }), r;
    } catch (r) {
      throw this.emitStatus("error", {
        operation: e,
        message: r instanceof Error ? r.message : String(r)
      }), r;
    }
  }
  async ensureInitialized() {
    this.initialized || await this.initialize();
  }
  resolveOrigin() {
    return this.config.originResolver ? In(this.config.originResolver()) : this.config.appDomain ? In(this.config.appDomain) : typeof window < "u" ? In(window.location.origin) : "unknown";
  }
  async handlePermissionPrompt(e) {
    var i;
    this.emitStatus("permission_required", {
      operation: e.operation,
      origin: e.origin,
      requestId: e.requestId
    });
    const n = (i = this.config.permissionDefaults) == null ? void 0 : i[e.operation];
    return n === "DENY" ? { granted: !1 } : n === "ALLOW" || n === "ASK_PER_SESSION" ? {
      granted: !0,
      remember: !0,
      level: n,
      sessionDurationMinutes: n === "ASK_PER_SESSION" ? this.config.permissionSessionMinutes ?? 60 : void 0
    } : this.config.onPermissionPrompt ? this.config.onPermissionPrompt(e) : typeof window > "u" || typeof window.confirm != "function" ? { granted: !1 } : window.confirm(
      `Allow ${e.origin} to call ${e.operation}?
(OK = allow, Cancel = deny)`
    ) ? {
      granted: !0,
      remember: this.config.rememberByDefault ?? !0,
      level: "ALLOW"
    } : { granted: !1 };
  }
  extractAuthState(e) {
    if (oi(e))
      return e;
    if (!e || typeof e != "object")
      return null;
    const n = e.authState;
    return oi(n) ? n : null;
  }
  emitAuthDrivenStatus(e, n, r) {
    if (!e.isAuthenticated) {
      this.emitStatus("auth_required", r, e);
      return;
    }
    if (e.isLocked) {
      this.emitStatus("pin_required", r, e);
      return;
    }
    this.emitStatus(n, r, e);
  }
  emitStatus(e, n, r) {
    var s, o;
    const i = {
      kind: e,
      timestamp: Date.now(),
      auth: r ?? this.core.getAuthState(),
      detail: n
    };
    if ((o = (s = this.config).onStatusChange) == null || o.call(s, i), typeof window < "u") {
      const a = this.config.statusEventName ?? ii;
      window.dispatchEvent(new CustomEvent(a, { detail: i }));
    }
    this.debug("status", i);
  }
  debug(e, n) {
    if (this.config.debug) {
      if (n === void 0) {
        console.info("[LiteEmbassy]", e);
        return;
      }
      console.info("[LiteEmbassy]", e, n);
    }
  }
}
let Tn = null;
async function pf(t = {}, e = {}) {
  if (!e.forceNewInstance && Tn)
    return Tn;
  const n = new df(t);
  return await n.initialize(), Tn = n, typeof window < "u" && (window.nostrPassLite = n), n;
}
typeof window < "u" && (window.initNostrPassLite = pf);
var ai;
typeof document < "u" && ((ai = document.currentScript) != null && ai.hasAttribute("data-auto-init")) && typeof window < "u" && typeof window.initNostrPassLite == "function" && window.initNostrPassLite();
export {
  df as NostrPassLiteEmbassy,
  pf as initNostrPassLite
};
//# sourceMappingURL=lite-embassy.js.map
