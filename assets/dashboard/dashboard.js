var qc = Object.defineProperty;
var Zc = (e, t, n) => t in e ? qc(e, t, { enumerable: !0, configurable: !0, writable: !0, value: n }) : e[t] = n;
var fr = (e, t, n) => (Zc(e, typeof t != "symbol" ? t + "" : t, n), n);
function Jc(e) {
  return e && e.__esModule && Object.prototype.hasOwnProperty.call(e, "default") ? e.default : e;
}
var Ta = { exports: {} }, xl = {}, za = { exports: {} }, F = {};
/**
 * @license React
 * react.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var lr = Symbol.for("react.element"), bc = Symbol.for("react.portal"), ef = Symbol.for("react.fragment"), tf = Symbol.for("react.strict_mode"), nf = Symbol.for("react.profiler"), rf = Symbol.for("react.provider"), lf = Symbol.for("react.context"), of = Symbol.for("react.forward_ref"), sf = Symbol.for("react.suspense"), af = Symbol.for("react.memo"), uf = Symbol.for("react.lazy"), rs = Symbol.iterator;
function cf(e) {
  return e === null || typeof e != "object" ? null : (e = rs && e[rs] || e["@@iterator"], typeof e == "function" ? e : null);
}
var La = { isMounted: function() {
  return !1;
}, enqueueForceUpdate: function() {
}, enqueueReplaceState: function() {
}, enqueueSetState: function() {
} }, Da = Object.assign, Ra = {};
function vn(e, t, n) {
  this.props = e, this.context = t, this.refs = Ra, this.updater = n || La;
}
vn.prototype.isReactComponent = {};
vn.prototype.setState = function(e, t) {
  if (typeof e != "object" && typeof e != "function" && e != null)
    throw Error("setState(...): takes an object of state variables to update or a function which returns an object of state variables.");
  this.updater.enqueueSetState(this, e, t, "setState");
};
vn.prototype.forceUpdate = function(e) {
  this.updater.enqueueForceUpdate(this, e, "forceUpdate");
};
function Ma() {
}
Ma.prototype = vn.prototype;
function so(e, t, n) {
  this.props = e, this.context = t, this.refs = Ra, this.updater = n || La;
}
var ao = so.prototype = new Ma();
ao.constructor = so;
Da(ao, vn.prototype);
ao.isPureReactComponent = !0;
var ls = Array.isArray, Fa = Object.prototype.hasOwnProperty, uo = { current: null }, Ia = { key: !0, ref: !0, __self: !0, __source: !0 };
function $a(e, t, n) {
  var r, l = {}, i = null, o = null;
  if (t != null)
    for (r in t.ref !== void 0 && (o = t.ref), t.key !== void 0 && (i = "" + t.key), t)
      Fa.call(t, r) && !Ia.hasOwnProperty(r) && (l[r] = t[r]);
  var a = arguments.length - 2;
  if (a === 1)
    l.children = n;
  else if (1 < a) {
    for (var u = Array(a), c = 0; c < a; c++)
      u[c] = arguments[c + 2];
    l.children = u;
  }
  if (e && e.defaultProps)
    for (r in a = e.defaultProps, a)
      l[r] === void 0 && (l[r] = a[r]);
  return { $$typeof: lr, type: e, key: i, ref: o, props: l, _owner: uo.current };
}
function ff(e, t) {
  return { $$typeof: lr, type: e.type, key: t, ref: e.ref, props: e.props, _owner: e._owner };
}
function co(e) {
  return typeof e == "object" && e !== null && e.$$typeof === lr;
}
function df(e) {
  var t = { "=": "=0", ":": "=2" };
  return "$" + e.replace(/[=:]/g, function(n) {
    return t[n];
  });
}
var is = /\/+/g;
function Ol(e, t) {
  return typeof e == "object" && e !== null && e.key != null ? df("" + e.key) : t.toString(36);
}
function Rr(e, t, n, r, l) {
  var i = typeof e;
  (i === "undefined" || i === "boolean") && (e = null);
  var o = !1;
  if (e === null)
    o = !0;
  else
    switch (i) {
      case "string":
      case "number":
        o = !0;
        break;
      case "object":
        switch (e.$$typeof) {
          case lr:
          case bc:
            o = !0;
        }
    }
  if (o)
    return o = e, l = l(o), e = r === "" ? "." + Ol(o, 0) : r, ls(l) ? (n = "", e != null && (n = e.replace(is, "$&/") + "/"), Rr(l, t, n, "", function(c) {
      return c;
    })) : l != null && (co(l) && (l = ff(l, n + (!l.key || o && o.key === l.key ? "" : ("" + l.key).replace(is, "$&/") + "/") + e)), t.push(l)), 1;
  if (o = 0, r = r === "" ? "." : r + ":", ls(e))
    for (var a = 0; a < e.length; a++) {
      i = e[a];
      var u = r + Ol(i, a);
      o += Rr(i, t, n, u, l);
    }
  else if (u = cf(e), typeof u == "function")
    for (e = u.call(e), a = 0; !(i = e.next()).done; )
      i = i.value, u = r + Ol(i, a++), o += Rr(i, t, n, u, l);
  else if (i === "object")
    throw t = String(e), Error("Objects are not valid as a React child (found: " + (t === "[object Object]" ? "object with keys {" + Object.keys(e).join(", ") + "}" : t) + "). If you meant to render a collection of children, use an array instead.");
  return o;
}
function dr(e, t, n) {
  if (e == null)
    return e;
  var r = [], l = 0;
  return Rr(e, r, "", "", function(i) {
    return t.call(n, i, l++);
  }), r;
}
function pf(e) {
  if (e._status === -1) {
    var t = e._result;
    t = t(), t.then(function(n) {
      (e._status === 0 || e._status === -1) && (e._status = 1, e._result = n);
    }, function(n) {
      (e._status === 0 || e._status === -1) && (e._status = 2, e._result = n);
    }), e._status === -1 && (e._status = 0, e._result = t);
  }
  if (e._status === 1)
    return e._result.default;
  throw e._result;
}
var pe = { current: null }, Mr = { transition: null }, mf = { ReactCurrentDispatcher: pe, ReactCurrentBatchConfig: Mr, ReactCurrentOwner: uo };
F.Children = { map: dr, forEach: function(e, t, n) {
  dr(e, function() {
    t.apply(this, arguments);
  }, n);
}, count: function(e) {
  var t = 0;
  return dr(e, function() {
    t++;
  }), t;
}, toArray: function(e) {
  return dr(e, function(t) {
    return t;
  }) || [];
}, only: function(e) {
  if (!co(e))
    throw Error("React.Children.only expected to receive a single React element child.");
  return e;
} };
F.Component = vn;
F.Fragment = ef;
F.Profiler = nf;
F.PureComponent = so;
F.StrictMode = tf;
F.Suspense = sf;
F.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = mf;
F.cloneElement = function(e, t, n) {
  if (e == null)
    throw Error("React.cloneElement(...): The argument must be a React element, but you passed " + e + ".");
  var r = Da({}, e.props), l = e.key, i = e.ref, o = e._owner;
  if (t != null) {
    if (t.ref !== void 0 && (i = t.ref, o = uo.current), t.key !== void 0 && (l = "" + t.key), e.type && e.type.defaultProps)
      var a = e.type.defaultProps;
    for (u in t)
      Fa.call(t, u) && !Ia.hasOwnProperty(u) && (r[u] = t[u] === void 0 && a !== void 0 ? a[u] : t[u]);
  }
  var u = arguments.length - 2;
  if (u === 1)
    r.children = n;
  else if (1 < u) {
    a = Array(u);
    for (var c = 0; c < u; c++)
      a[c] = arguments[c + 2];
    r.children = a;
  }
  return { $$typeof: lr, type: e.type, key: l, ref: i, props: r, _owner: o };
};
F.createContext = function(e) {
  return e = { $$typeof: lf, _currentValue: e, _currentValue2: e, _threadCount: 0, Provider: null, Consumer: null, _defaultValue: null, _globalName: null }, e.Provider = { $$typeof: rf, _context: e }, e.Consumer = e;
};
F.createElement = $a;
F.createFactory = function(e) {
  var t = $a.bind(null, e);
  return t.type = e, t;
};
F.createRef = function() {
  return { current: null };
};
F.forwardRef = function(e) {
  return { $$typeof: of, render: e };
};
F.isValidElement = co;
F.lazy = function(e) {
  return { $$typeof: uf, _payload: { _status: -1, _result: e }, _init: pf };
};
F.memo = function(e, t) {
  return { $$typeof: af, type: e, compare: t === void 0 ? null : t };
};
F.startTransition = function(e) {
  var t = Mr.transition;
  Mr.transition = {};
  try {
    e();
  } finally {
    Mr.transition = t;
  }
};
F.unstable_act = function() {
  throw Error("act(...) is not supported in production builds of React.");
};
F.useCallback = function(e, t) {
  return pe.current.useCallback(e, t);
};
F.useContext = function(e) {
  return pe.current.useContext(e);
};
F.useDebugValue = function() {
};
F.useDeferredValue = function(e) {
  return pe.current.useDeferredValue(e);
};
F.useEffect = function(e, t) {
  return pe.current.useEffect(e, t);
};
F.useId = function() {
  return pe.current.useId();
};
F.useImperativeHandle = function(e, t, n) {
  return pe.current.useImperativeHandle(e, t, n);
};
F.useInsertionEffect = function(e, t) {
  return pe.current.useInsertionEffect(e, t);
};
F.useLayoutEffect = function(e, t) {
  return pe.current.useLayoutEffect(e, t);
};
F.useMemo = function(e, t) {
  return pe.current.useMemo(e, t);
};
F.useReducer = function(e, t, n) {
  return pe.current.useReducer(e, t, n);
};
F.useRef = function(e) {
  return pe.current.useRef(e);
};
F.useState = function(e) {
  return pe.current.useState(e);
};
F.useSyncExternalStore = function(e, t, n) {
  return pe.current.useSyncExternalStore(e, t, n);
};
F.useTransition = function() {
  return pe.current.useTransition();
};
F.version = "18.2.0";
za.exports = F;
var T = za.exports;
const Oa = /* @__PURE__ */ Jc(T);
/**
 * @license React
 * react-jsx-runtime.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var hf = T, gf = Symbol.for("react.element"), vf = Symbol.for("react.fragment"), yf = Object.prototype.hasOwnProperty, wf = hf.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner, xf = { key: !0, ref: !0, __self: !0, __source: !0 };
function Ua(e, t, n) {
  var r, l = {}, i = null, o = null;
  n !== void 0 && (i = "" + n), t.key !== void 0 && (i = "" + t.key), t.ref !== void 0 && (o = t.ref);
  for (r in t)
    yf.call(t, r) && !xf.hasOwnProperty(r) && (l[r] = t[r]);
  if (e && e.defaultProps)
    for (r in t = e.defaultProps, t)
      l[r] === void 0 && (l[r] = t[r]);
  return { $$typeof: gf, type: e, key: i, ref: o, props: l, _owner: wf.current };
}
xl.Fragment = vf;
xl.jsx = Ua;
xl.jsxs = Ua;
Ta.exports = xl;
var s = Ta.exports, mi = {}, Aa = { exports: {} }, Ce = {}, Ba = { exports: {} }, Va = {};
/**
 * @license React
 * scheduler.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
(function(e) {
  function t(k, L) {
    var M = k.length;
    k.push(L);
    e:
      for (; 0 < M; ) {
        var X = M - 1 >>> 1, ee = k[X];
        if (0 < l(ee, L))
          k[X] = L, k[M] = ee, M = X;
        else
          break e;
      }
  }
  function n(k) {
    return k.length === 0 ? null : k[0];
  }
  function r(k) {
    if (k.length === 0)
      return null;
    var L = k[0], M = k.pop();
    if (M !== L) {
      k[0] = M;
      e:
        for (var X = 0, ee = k.length, ur = ee >>> 1; X < ur; ) {
          var Et = 2 * (X + 1) - 1, $l = k[Et], _t = Et + 1, cr = k[_t];
          if (0 > l($l, M))
            _t < ee && 0 > l(cr, $l) ? (k[X] = cr, k[_t] = M, X = _t) : (k[X] = $l, k[Et] = M, X = Et);
          else if (_t < ee && 0 > l(cr, M))
            k[X] = cr, k[_t] = M, X = _t;
          else
            break e;
        }
    }
    return L;
  }
  function l(k, L) {
    var M = k.sortIndex - L.sortIndex;
    return M !== 0 ? M : k.id - L.id;
  }
  if (typeof performance == "object" && typeof performance.now == "function") {
    var i = performance;
    e.unstable_now = function() {
      return i.now();
    };
  } else {
    var o = Date, a = o.now();
    e.unstable_now = function() {
      return o.now() - a;
    };
  }
  var u = [], c = [], p = 1, g = null, h = 3, y = !1, v = !1, w = !1, z = typeof setTimeout == "function" ? setTimeout : null, d = typeof clearTimeout == "function" ? clearTimeout : null, f = typeof setImmediate < "u" ? setImmediate : null;
  typeof navigator < "u" && navigator.scheduling !== void 0 && navigator.scheduling.isInputPending !== void 0 && navigator.scheduling.isInputPending.bind(navigator.scheduling);
  function m(k) {
    for (var L = n(c); L !== null; ) {
      if (L.callback === null)
        r(c);
      else if (L.startTime <= k)
        r(c), L.sortIndex = L.expirationTime, t(u, L);
      else
        break;
      L = n(c);
    }
  }
  function x(k) {
    if (w = !1, m(k), !v)
      if (n(u) !== null)
        v = !0, Ke(j);
      else {
        var L = n(c);
        L !== null && _e(x, L.startTime - k);
      }
  }
  function j(k, L) {
    v = !1, w && (w = !1, d(_), _ = -1), y = !0;
    var M = h;
    try {
      for (m(L), g = n(u); g !== null && (!(g.expirationTime > L) || k && !re()); ) {
        var X = g.callback;
        if (typeof X == "function") {
          g.callback = null, h = g.priorityLevel;
          var ee = X(g.expirationTime <= L);
          L = e.unstable_now(), typeof ee == "function" ? g.callback = ee : g === n(u) && r(u), m(L);
        } else
          r(u);
        g = n(u);
      }
      if (g !== null)
        var ur = !0;
      else {
        var Et = n(c);
        Et !== null && _e(x, Et.startTime - L), ur = !1;
      }
      return ur;
    } finally {
      g = null, h = M, y = !1;
    }
  }
  var N = !1, C = null, _ = -1, U = 5, D = -1;
  function re() {
    return !(e.unstable_now() - D < U);
  }
  function $() {
    if (C !== null) {
      var k = e.unstable_now();
      D = k;
      var L = !0;
      try {
        L = C(!0, k);
      } finally {
        L ? E() : (N = !1, C = null);
      }
    } else
      N = !1;
  }
  var E;
  if (typeof f == "function")
    E = function() {
      f($);
    };
  else if (typeof MessageChannel < "u") {
    var R = new MessageChannel(), G = R.port2;
    R.port1.onmessage = $, E = function() {
      G.postMessage(null);
    };
  } else
    E = function() {
      z($, 0);
    };
  function Ke(k) {
    C = k, N || (N = !0, E());
  }
  function _e(k, L) {
    _ = z(function() {
      k(e.unstable_now());
    }, L);
  }
  e.unstable_IdlePriority = 5, e.unstable_ImmediatePriority = 1, e.unstable_LowPriority = 4, e.unstable_NormalPriority = 3, e.unstable_Profiling = null, e.unstable_UserBlockingPriority = 2, e.unstable_cancelCallback = function(k) {
    k.callback = null;
  }, e.unstable_continueExecution = function() {
    v || y || (v = !0, Ke(j));
  }, e.unstable_forceFrameRate = function(k) {
    0 > k || 125 < k ? console.error("forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported") : U = 0 < k ? Math.floor(1e3 / k) : 5;
  }, e.unstable_getCurrentPriorityLevel = function() {
    return h;
  }, e.unstable_getFirstCallbackNode = function() {
    return n(u);
  }, e.unstable_next = function(k) {
    switch (h) {
      case 1:
      case 2:
      case 3:
        var L = 3;
        break;
      default:
        L = h;
    }
    var M = h;
    h = L;
    try {
      return k();
    } finally {
      h = M;
    }
  }, e.unstable_pauseExecution = function() {
  }, e.unstable_requestPaint = function() {
  }, e.unstable_runWithPriority = function(k, L) {
    switch (k) {
      case 1:
      case 2:
      case 3:
      case 4:
      case 5:
        break;
      default:
        k = 3;
    }
    var M = h;
    h = k;
    try {
      return L();
    } finally {
      h = M;
    }
  }, e.unstable_scheduleCallback = function(k, L, M) {
    var X = e.unstable_now();
    switch (typeof M == "object" && M !== null ? (M = M.delay, M = typeof M == "number" && 0 < M ? X + M : X) : M = X, k) {
      case 1:
        var ee = -1;
        break;
      case 2:
        ee = 250;
        break;
      case 5:
        ee = 1073741823;
        break;
      case 4:
        ee = 1e4;
        break;
      default:
        ee = 5e3;
    }
    return ee = M + ee, k = { id: p++, callback: L, priorityLevel: k, startTime: M, expirationTime: ee, sortIndex: -1 }, M > X ? (k.sortIndex = M, t(c, k), n(u) === null && k === n(c) && (w ? (d(_), _ = -1) : w = !0, _e(x, M - X))) : (k.sortIndex = ee, t(u, k), v || y || (v = !0, Ke(j))), k;
  }, e.unstable_shouldYield = re, e.unstable_wrapCallback = function(k) {
    var L = h;
    return function() {
      var M = h;
      h = L;
      try {
        return k.apply(this, arguments);
      } finally {
        h = M;
      }
    };
  };
})(Va);
Ba.exports = Va;
var Sf = Ba.exports;
/**
 * @license React
 * react-dom.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Ha = T, Ne = Sf;
function S(e) {
  for (var t = "https://reactjs.org/docs/error-decoder.html?invariant=" + e, n = 1; n < arguments.length; n++)
    t += "&args[]=" + encodeURIComponent(arguments[n]);
  return "Minified React error #" + e + "; visit " + t + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
}
var Qa = /* @__PURE__ */ new Set(), Bn = {};
function Bt(e, t) {
  cn(e, t), cn(e + "Capture", t);
}
function cn(e, t) {
  for (Bn[e] = t, e = 0; e < t.length; e++)
    Qa.add(t[e]);
}
var be = !(typeof window > "u" || typeof window.document > "u" || typeof window.document.createElement > "u"), hi = Object.prototype.hasOwnProperty, jf = /^[:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD][:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\-.0-9\u00B7\u0300-\u036F\u203F-\u2040]*$/, os = {}, ss = {};
function kf(e) {
  return hi.call(ss, e) ? !0 : hi.call(os, e) ? !1 : jf.test(e) ? ss[e] = !0 : (os[e] = !0, !1);
}
function Nf(e, t, n, r) {
  if (n !== null && n.type === 0)
    return !1;
  switch (typeof t) {
    case "function":
    case "symbol":
      return !0;
    case "boolean":
      return r ? !1 : n !== null ? !n.acceptsBooleans : (e = e.toLowerCase().slice(0, 5), e !== "data-" && e !== "aria-");
    default:
      return !1;
  }
}
function Cf(e, t, n, r) {
  if (t === null || typeof t > "u" || Nf(e, t, n, r))
    return !0;
  if (r)
    return !1;
  if (n !== null)
    switch (n.type) {
      case 3:
        return !t;
      case 4:
        return t === !1;
      case 5:
        return isNaN(t);
      case 6:
        return isNaN(t) || 1 > t;
    }
  return !1;
}
function me(e, t, n, r, l, i, o) {
  this.acceptsBooleans = t === 2 || t === 3 || t === 4, this.attributeName = r, this.attributeNamespace = l, this.mustUseProperty = n, this.propertyName = e, this.type = t, this.sanitizeURL = i, this.removeEmptyString = o;
}
var oe = {};
"children dangerouslySetInnerHTML defaultValue defaultChecked innerHTML suppressContentEditableWarning suppressHydrationWarning style".split(" ").forEach(function(e) {
  oe[e] = new me(e, 0, !1, e, null, !1, !1);
});
[["acceptCharset", "accept-charset"], ["className", "class"], ["htmlFor", "for"], ["httpEquiv", "http-equiv"]].forEach(function(e) {
  var t = e[0];
  oe[t] = new me(t, 1, !1, e[1], null, !1, !1);
});
["contentEditable", "draggable", "spellCheck", "value"].forEach(function(e) {
  oe[e] = new me(e, 2, !1, e.toLowerCase(), null, !1, !1);
});
["autoReverse", "externalResourcesRequired", "focusable", "preserveAlpha"].forEach(function(e) {
  oe[e] = new me(e, 2, !1, e, null, !1, !1);
});
"allowFullScreen async autoFocus autoPlay controls default defer disabled disablePictureInPicture disableRemotePlayback formNoValidate hidden loop noModule noValidate open playsInline readOnly required reversed scoped seamless itemScope".split(" ").forEach(function(e) {
  oe[e] = new me(e, 3, !1, e.toLowerCase(), null, !1, !1);
});
["checked", "multiple", "muted", "selected"].forEach(function(e) {
  oe[e] = new me(e, 3, !0, e, null, !1, !1);
});
["capture", "download"].forEach(function(e) {
  oe[e] = new me(e, 4, !1, e, null, !1, !1);
});
["cols", "rows", "size", "span"].forEach(function(e) {
  oe[e] = new me(e, 6, !1, e, null, !1, !1);
});
["rowSpan", "start"].forEach(function(e) {
  oe[e] = new me(e, 5, !1, e.toLowerCase(), null, !1, !1);
});
var fo = /[\-:]([a-z])/g;
function po(e) {
  return e[1].toUpperCase();
}
"accent-height alignment-baseline arabic-form baseline-shift cap-height clip-path clip-rule color-interpolation color-interpolation-filters color-profile color-rendering dominant-baseline enable-background fill-opacity fill-rule flood-color flood-opacity font-family font-size font-size-adjust font-stretch font-style font-variant font-weight glyph-name glyph-orientation-horizontal glyph-orientation-vertical horiz-adv-x horiz-origin-x image-rendering letter-spacing lighting-color marker-end marker-mid marker-start overline-position overline-thickness paint-order panose-1 pointer-events rendering-intent shape-rendering stop-color stop-opacity strikethrough-position strikethrough-thickness stroke-dasharray stroke-dashoffset stroke-linecap stroke-linejoin stroke-miterlimit stroke-opacity stroke-width text-anchor text-decoration text-rendering underline-position underline-thickness unicode-bidi unicode-range units-per-em v-alphabetic v-hanging v-ideographic v-mathematical vector-effect vert-adv-y vert-origin-x vert-origin-y word-spacing writing-mode xmlns:xlink x-height".split(" ").forEach(function(e) {
  var t = e.replace(
    fo,
    po
  );
  oe[t] = new me(t, 1, !1, e, null, !1, !1);
});
"xlink:actuate xlink:arcrole xlink:role xlink:show xlink:title xlink:type".split(" ").forEach(function(e) {
  var t = e.replace(fo, po);
  oe[t] = new me(t, 1, !1, e, "http://www.w3.org/1999/xlink", !1, !1);
});
["xml:base", "xml:lang", "xml:space"].forEach(function(e) {
  var t = e.replace(fo, po);
  oe[t] = new me(t, 1, !1, e, "http://www.w3.org/XML/1998/namespace", !1, !1);
});
["tabIndex", "crossOrigin"].forEach(function(e) {
  oe[e] = new me(e, 1, !1, e.toLowerCase(), null, !1, !1);
});
oe.xlinkHref = new me("xlinkHref", 1, !1, "xlink:href", "http://www.w3.org/1999/xlink", !0, !1);
["src", "href", "action", "formAction"].forEach(function(e) {
  oe[e] = new me(e, 1, !1, e.toLowerCase(), null, !0, !0);
});
function mo(e, t, n, r) {
  var l = oe.hasOwnProperty(t) ? oe[t] : null;
  (l !== null ? l.type !== 0 : r || !(2 < t.length) || t[0] !== "o" && t[0] !== "O" || t[1] !== "n" && t[1] !== "N") && (Cf(t, n, l, r) && (n = null), r || l === null ? kf(t) && (n === null ? e.removeAttribute(t) : e.setAttribute(t, "" + n)) : l.mustUseProperty ? e[l.propertyName] = n === null ? l.type === 3 ? !1 : "" : n : (t = l.attributeName, r = l.attributeNamespace, n === null ? e.removeAttribute(t) : (l = l.type, n = l === 3 || l === 4 && n === !0 ? "" : "" + n, r ? e.setAttributeNS(r, t, n) : e.setAttribute(t, n))));
}
var rt = Ha.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED, pr = Symbol.for("react.element"), Qt = Symbol.for("react.portal"), Wt = Symbol.for("react.fragment"), ho = Symbol.for("react.strict_mode"), gi = Symbol.for("react.profiler"), Wa = Symbol.for("react.provider"), Ka = Symbol.for("react.context"), go = Symbol.for("react.forward_ref"), vi = Symbol.for("react.suspense"), yi = Symbol.for("react.suspense_list"), vo = Symbol.for("react.memo"), st = Symbol.for("react.lazy"), Ga = Symbol.for("react.offscreen"), as = Symbol.iterator;
function xn(e) {
  return e === null || typeof e != "object" ? null : (e = as && e[as] || e["@@iterator"], typeof e == "function" ? e : null);
}
var K = Object.assign, Ul;
function Pn(e) {
  if (Ul === void 0)
    try {
      throw Error();
    } catch (n) {
      var t = n.stack.trim().match(/\n( *(at )?)/);
      Ul = t && t[1] || "";
    }
  return `
` + Ul + e;
}
var Al = !1;
function Bl(e, t) {
  if (!e || Al)
    return "";
  Al = !0;
  var n = Error.prepareStackTrace;
  Error.prepareStackTrace = void 0;
  try {
    if (t)
      if (t = function() {
        throw Error();
      }, Object.defineProperty(t.prototype, "props", { set: function() {
        throw Error();
      } }), typeof Reflect == "object" && Reflect.construct) {
        try {
          Reflect.construct(t, []);
        } catch (c) {
          var r = c;
        }
        Reflect.construct(e, [], t);
      } else {
        try {
          t.call();
        } catch (c) {
          r = c;
        }
        e.call(t.prototype);
      }
    else {
      try {
        throw Error();
      } catch (c) {
        r = c;
      }
      e();
    }
  } catch (c) {
    if (c && r && typeof c.stack == "string") {
      for (var l = c.stack.split(`
`), i = r.stack.split(`
`), o = l.length - 1, a = i.length - 1; 1 <= o && 0 <= a && l[o] !== i[a]; )
        a--;
      for (; 1 <= o && 0 <= a; o--, a--)
        if (l[o] !== i[a]) {
          if (o !== 1 || a !== 1)
            do
              if (o--, a--, 0 > a || l[o] !== i[a]) {
                var u = `
` + l[o].replace(" at new ", " at ");
                return e.displayName && u.includes("<anonymous>") && (u = u.replace("<anonymous>", e.displayName)), u;
              }
            while (1 <= o && 0 <= a);
          break;
        }
    }
  } finally {
    Al = !1, Error.prepareStackTrace = n;
  }
  return (e = e ? e.displayName || e.name : "") ? Pn(e) : "";
}
function Ef(e) {
  switch (e.tag) {
    case 5:
      return Pn(e.type);
    case 16:
      return Pn("Lazy");
    case 13:
      return Pn("Suspense");
    case 19:
      return Pn("SuspenseList");
    case 0:
    case 2:
    case 15:
      return e = Bl(e.type, !1), e;
    case 11:
      return e = Bl(e.type.render, !1), e;
    case 1:
      return e = Bl(e.type, !0), e;
    default:
      return "";
  }
}
function wi(e) {
  if (e == null)
    return null;
  if (typeof e == "function")
    return e.displayName || e.name || null;
  if (typeof e == "string")
    return e;
  switch (e) {
    case Wt:
      return "Fragment";
    case Qt:
      return "Portal";
    case gi:
      return "Profiler";
    case ho:
      return "StrictMode";
    case vi:
      return "Suspense";
    case yi:
      return "SuspenseList";
  }
  if (typeof e == "object")
    switch (e.$$typeof) {
      case Ka:
        return (e.displayName || "Context") + ".Consumer";
      case Wa:
        return (e._context.displayName || "Context") + ".Provider";
      case go:
        var t = e.render;
        return e = e.displayName, e || (e = t.displayName || t.name || "", e = e !== "" ? "ForwardRef(" + e + ")" : "ForwardRef"), e;
      case vo:
        return t = e.displayName || null, t !== null ? t : wi(e.type) || "Memo";
      case st:
        t = e._payload, e = e._init;
        try {
          return wi(e(t));
        } catch {
        }
    }
  return null;
}
function _f(e) {
  var t = e.type;
  switch (e.tag) {
    case 24:
      return "Cache";
    case 9:
      return (t.displayName || "Context") + ".Consumer";
    case 10:
      return (t._context.displayName || "Context") + ".Provider";
    case 18:
      return "DehydratedFragment";
    case 11:
      return e = t.render, e = e.displayName || e.name || "", t.displayName || (e !== "" ? "ForwardRef(" + e + ")" : "ForwardRef");
    case 7:
      return "Fragment";
    case 5:
      return t;
    case 4:
      return "Portal";
    case 3:
      return "Root";
    case 6:
      return "Text";
    case 16:
      return wi(t);
    case 8:
      return t === ho ? "StrictMode" : "Mode";
    case 22:
      return "Offscreen";
    case 12:
      return "Profiler";
    case 21:
      return "Scope";
    case 13:
      return "Suspense";
    case 19:
      return "SuspenseList";
    case 25:
      return "TracingMarker";
    case 1:
    case 0:
    case 17:
    case 2:
    case 14:
    case 15:
      if (typeof t == "function")
        return t.displayName || t.name || null;
      if (typeof t == "string")
        return t;
  }
  return null;
}
function St(e) {
  switch (typeof e) {
    case "boolean":
    case "number":
    case "string":
    case "undefined":
      return e;
    case "object":
      return e;
    default:
      return "";
  }
}
function Ya(e) {
  var t = e.type;
  return (e = e.nodeName) && e.toLowerCase() === "input" && (t === "checkbox" || t === "radio");
}
function Pf(e) {
  var t = Ya(e) ? "checked" : "value", n = Object.getOwnPropertyDescriptor(e.constructor.prototype, t), r = "" + e[t];
  if (!e.hasOwnProperty(t) && typeof n < "u" && typeof n.get == "function" && typeof n.set == "function") {
    var l = n.get, i = n.set;
    return Object.defineProperty(e, t, { configurable: !0, get: function() {
      return l.call(this);
    }, set: function(o) {
      r = "" + o, i.call(this, o);
    } }), Object.defineProperty(e, t, { enumerable: n.enumerable }), { getValue: function() {
      return r;
    }, setValue: function(o) {
      r = "" + o;
    }, stopTracking: function() {
      e._valueTracker = null, delete e[t];
    } };
  }
}
function mr(e) {
  e._valueTracker || (e._valueTracker = Pf(e));
}
function Xa(e) {
  if (!e)
    return !1;
  var t = e._valueTracker;
  if (!t)
    return !0;
  var n = t.getValue(), r = "";
  return e && (r = Ya(e) ? e.checked ? "true" : "false" : e.value), e = r, e !== n ? (t.setValue(e), !0) : !1;
}
function Kr(e) {
  if (e = e || (typeof document < "u" ? document : void 0), typeof e > "u")
    return null;
  try {
    return e.activeElement || e.body;
  } catch {
    return e.body;
  }
}
function xi(e, t) {
  var n = t.checked;
  return K({}, t, { defaultChecked: void 0, defaultValue: void 0, value: void 0, checked: n ?? e._wrapperState.initialChecked });
}
function us(e, t) {
  var n = t.defaultValue == null ? "" : t.defaultValue, r = t.checked != null ? t.checked : t.defaultChecked;
  n = St(t.value != null ? t.value : n), e._wrapperState = { initialChecked: r, initialValue: n, controlled: t.type === "checkbox" || t.type === "radio" ? t.checked != null : t.value != null };
}
function qa(e, t) {
  t = t.checked, t != null && mo(e, "checked", t, !1);
}
function Si(e, t) {
  qa(e, t);
  var n = St(t.value), r = t.type;
  if (n != null)
    r === "number" ? (n === 0 && e.value === "" || e.value != n) && (e.value = "" + n) : e.value !== "" + n && (e.value = "" + n);
  else if (r === "submit" || r === "reset") {
    e.removeAttribute("value");
    return;
  }
  t.hasOwnProperty("value") ? ji(e, t.type, n) : t.hasOwnProperty("defaultValue") && ji(e, t.type, St(t.defaultValue)), t.checked == null && t.defaultChecked != null && (e.defaultChecked = !!t.defaultChecked);
}
function cs(e, t, n) {
  if (t.hasOwnProperty("value") || t.hasOwnProperty("defaultValue")) {
    var r = t.type;
    if (!(r !== "submit" && r !== "reset" || t.value !== void 0 && t.value !== null))
      return;
    t = "" + e._wrapperState.initialValue, n || t === e.value || (e.value = t), e.defaultValue = t;
  }
  n = e.name, n !== "" && (e.name = ""), e.defaultChecked = !!e._wrapperState.initialChecked, n !== "" && (e.name = n);
}
function ji(e, t, n) {
  (t !== "number" || Kr(e.ownerDocument) !== e) && (n == null ? e.defaultValue = "" + e._wrapperState.initialValue : e.defaultValue !== "" + n && (e.defaultValue = "" + n));
}
var Tn = Array.isArray;
function nn(e, t, n, r) {
  if (e = e.options, t) {
    t = {};
    for (var l = 0; l < n.length; l++)
      t["$" + n[l]] = !0;
    for (n = 0; n < e.length; n++)
      l = t.hasOwnProperty("$" + e[n].value), e[n].selected !== l && (e[n].selected = l), l && r && (e[n].defaultSelected = !0);
  } else {
    for (n = "" + St(n), t = null, l = 0; l < e.length; l++) {
      if (e[l].value === n) {
        e[l].selected = !0, r && (e[l].defaultSelected = !0);
        return;
      }
      t !== null || e[l].disabled || (t = e[l]);
    }
    t !== null && (t.selected = !0);
  }
}
function ki(e, t) {
  if (t.dangerouslySetInnerHTML != null)
    throw Error(S(91));
  return K({}, t, { value: void 0, defaultValue: void 0, children: "" + e._wrapperState.initialValue });
}
function fs(e, t) {
  var n = t.value;
  if (n == null) {
    if (n = t.children, t = t.defaultValue, n != null) {
      if (t != null)
        throw Error(S(92));
      if (Tn(n)) {
        if (1 < n.length)
          throw Error(S(93));
        n = n[0];
      }
      t = n;
    }
    t == null && (t = ""), n = t;
  }
  e._wrapperState = { initialValue: St(n) };
}
function Za(e, t) {
  var n = St(t.value), r = St(t.defaultValue);
  n != null && (n = "" + n, n !== e.value && (e.value = n), t.defaultValue == null && e.defaultValue !== n && (e.defaultValue = n)), r != null && (e.defaultValue = "" + r);
}
function ds(e) {
  var t = e.textContent;
  t === e._wrapperState.initialValue && t !== "" && t !== null && (e.value = t);
}
function Ja(e) {
  switch (e) {
    case "svg":
      return "http://www.w3.org/2000/svg";
    case "math":
      return "http://www.w3.org/1998/Math/MathML";
    default:
      return "http://www.w3.org/1999/xhtml";
  }
}
function Ni(e, t) {
  return e == null || e === "http://www.w3.org/1999/xhtml" ? Ja(t) : e === "http://www.w3.org/2000/svg" && t === "foreignObject" ? "http://www.w3.org/1999/xhtml" : e;
}
var hr, ba = function(e) {
  return typeof MSApp < "u" && MSApp.execUnsafeLocalFunction ? function(t, n, r, l) {
    MSApp.execUnsafeLocalFunction(function() {
      return e(t, n, r, l);
    });
  } : e;
}(function(e, t) {
  if (e.namespaceURI !== "http://www.w3.org/2000/svg" || "innerHTML" in e)
    e.innerHTML = t;
  else {
    for (hr = hr || document.createElement("div"), hr.innerHTML = "<svg>" + t.valueOf().toString() + "</svg>", t = hr.firstChild; e.firstChild; )
      e.removeChild(e.firstChild);
    for (; t.firstChild; )
      e.appendChild(t.firstChild);
  }
});
function Vn(e, t) {
  if (t) {
    var n = e.firstChild;
    if (n && n === e.lastChild && n.nodeType === 3) {
      n.nodeValue = t;
      return;
    }
  }
  e.textContent = t;
}
var Dn = {
  animationIterationCount: !0,
  aspectRatio: !0,
  borderImageOutset: !0,
  borderImageSlice: !0,
  borderImageWidth: !0,
  boxFlex: !0,
  boxFlexGroup: !0,
  boxOrdinalGroup: !0,
  columnCount: !0,
  columns: !0,
  flex: !0,
  flexGrow: !0,
  flexPositive: !0,
  flexShrink: !0,
  flexNegative: !0,
  flexOrder: !0,
  gridArea: !0,
  gridRow: !0,
  gridRowEnd: !0,
  gridRowSpan: !0,
  gridRowStart: !0,
  gridColumn: !0,
  gridColumnEnd: !0,
  gridColumnSpan: !0,
  gridColumnStart: !0,
  fontWeight: !0,
  lineClamp: !0,
  lineHeight: !0,
  opacity: !0,
  order: !0,
  orphans: !0,
  tabSize: !0,
  widows: !0,
  zIndex: !0,
  zoom: !0,
  fillOpacity: !0,
  floodOpacity: !0,
  stopOpacity: !0,
  strokeDasharray: !0,
  strokeDashoffset: !0,
  strokeMiterlimit: !0,
  strokeOpacity: !0,
  strokeWidth: !0
}, Tf = ["Webkit", "ms", "Moz", "O"];
Object.keys(Dn).forEach(function(e) {
  Tf.forEach(function(t) {
    t = t + e.charAt(0).toUpperCase() + e.substring(1), Dn[t] = Dn[e];
  });
});
function eu(e, t, n) {
  return t == null || typeof t == "boolean" || t === "" ? "" : n || typeof t != "number" || t === 0 || Dn.hasOwnProperty(e) && Dn[e] ? ("" + t).trim() : t + "px";
}
function tu(e, t) {
  e = e.style;
  for (var n in t)
    if (t.hasOwnProperty(n)) {
      var r = n.indexOf("--") === 0, l = eu(n, t[n], r);
      n === "float" && (n = "cssFloat"), r ? e.setProperty(n, l) : e[n] = l;
    }
}
var zf = K({ menuitem: !0 }, { area: !0, base: !0, br: !0, col: !0, embed: !0, hr: !0, img: !0, input: !0, keygen: !0, link: !0, meta: !0, param: !0, source: !0, track: !0, wbr: !0 });
function Ci(e, t) {
  if (t) {
    if (zf[e] && (t.children != null || t.dangerouslySetInnerHTML != null))
      throw Error(S(137, e));
    if (t.dangerouslySetInnerHTML != null) {
      if (t.children != null)
        throw Error(S(60));
      if (typeof t.dangerouslySetInnerHTML != "object" || !("__html" in t.dangerouslySetInnerHTML))
        throw Error(S(61));
    }
    if (t.style != null && typeof t.style != "object")
      throw Error(S(62));
  }
}
function Ei(e, t) {
  if (e.indexOf("-") === -1)
    return typeof t.is == "string";
  switch (e) {
    case "annotation-xml":
    case "color-profile":
    case "font-face":
    case "font-face-src":
    case "font-face-uri":
    case "font-face-format":
    case "font-face-name":
    case "missing-glyph":
      return !1;
    default:
      return !0;
  }
}
var _i = null;
function yo(e) {
  return e = e.target || e.srcElement || window, e.correspondingUseElement && (e = e.correspondingUseElement), e.nodeType === 3 ? e.parentNode : e;
}
var Pi = null, rn = null, ln = null;
function ps(e) {
  if (e = sr(e)) {
    if (typeof Pi != "function")
      throw Error(S(280));
    var t = e.stateNode;
    t && (t = Cl(t), Pi(e.stateNode, e.type, t));
  }
}
function nu(e) {
  rn ? ln ? ln.push(e) : ln = [e] : rn = e;
}
function ru() {
  if (rn) {
    var e = rn, t = ln;
    if (ln = rn = null, ps(e), t)
      for (e = 0; e < t.length; e++)
        ps(t[e]);
  }
}
function lu(e, t) {
  return e(t);
}
function iu() {
}
var Vl = !1;
function ou(e, t, n) {
  if (Vl)
    return e(t, n);
  Vl = !0;
  try {
    return lu(e, t, n);
  } finally {
    Vl = !1, (rn !== null || ln !== null) && (iu(), ru());
  }
}
function Hn(e, t) {
  var n = e.stateNode;
  if (n === null)
    return null;
  var r = Cl(n);
  if (r === null)
    return null;
  n = r[t];
  e:
    switch (t) {
      case "onClick":
      case "onClickCapture":
      case "onDoubleClick":
      case "onDoubleClickCapture":
      case "onMouseDown":
      case "onMouseDownCapture":
      case "onMouseMove":
      case "onMouseMoveCapture":
      case "onMouseUp":
      case "onMouseUpCapture":
      case "onMouseEnter":
        (r = !r.disabled) || (e = e.type, r = !(e === "button" || e === "input" || e === "select" || e === "textarea")), e = !r;
        break e;
      default:
        e = !1;
    }
  if (e)
    return null;
  if (n && typeof n != "function")
    throw Error(S(231, t, typeof n));
  return n;
}
var Ti = !1;
if (be)
  try {
    var Sn = {};
    Object.defineProperty(Sn, "passive", { get: function() {
      Ti = !0;
    } }), window.addEventListener("test", Sn, Sn), window.removeEventListener("test", Sn, Sn);
  } catch {
    Ti = !1;
  }
function Lf(e, t, n, r, l, i, o, a, u) {
  var c = Array.prototype.slice.call(arguments, 3);
  try {
    t.apply(n, c);
  } catch (p) {
    this.onError(p);
  }
}
var Rn = !1, Gr = null, Yr = !1, zi = null, Df = { onError: function(e) {
  Rn = !0, Gr = e;
} };
function Rf(e, t, n, r, l, i, o, a, u) {
  Rn = !1, Gr = null, Lf.apply(Df, arguments);
}
function Mf(e, t, n, r, l, i, o, a, u) {
  if (Rf.apply(this, arguments), Rn) {
    if (Rn) {
      var c = Gr;
      Rn = !1, Gr = null;
    } else
      throw Error(S(198));
    Yr || (Yr = !0, zi = c);
  }
}
function Vt(e) {
  var t = e, n = e;
  if (e.alternate)
    for (; t.return; )
      t = t.return;
  else {
    e = t;
    do
      t = e, t.flags & 4098 && (n = t.return), e = t.return;
    while (e);
  }
  return t.tag === 3 ? n : null;
}
function su(e) {
  if (e.tag === 13) {
    var t = e.memoizedState;
    if (t === null && (e = e.alternate, e !== null && (t = e.memoizedState)), t !== null)
      return t.dehydrated;
  }
  return null;
}
function ms(e) {
  if (Vt(e) !== e)
    throw Error(S(188));
}
function Ff(e) {
  var t = e.alternate;
  if (!t) {
    if (t = Vt(e), t === null)
      throw Error(S(188));
    return t !== e ? null : e;
  }
  for (var n = e, r = t; ; ) {
    var l = n.return;
    if (l === null)
      break;
    var i = l.alternate;
    if (i === null) {
      if (r = l.return, r !== null) {
        n = r;
        continue;
      }
      break;
    }
    if (l.child === i.child) {
      for (i = l.child; i; ) {
        if (i === n)
          return ms(l), e;
        if (i === r)
          return ms(l), t;
        i = i.sibling;
      }
      throw Error(S(188));
    }
    if (n.return !== r.return)
      n = l, r = i;
    else {
      for (var o = !1, a = l.child; a; ) {
        if (a === n) {
          o = !0, n = l, r = i;
          break;
        }
        if (a === r) {
          o = !0, r = l, n = i;
          break;
        }
        a = a.sibling;
      }
      if (!o) {
        for (a = i.child; a; ) {
          if (a === n) {
            o = !0, n = i, r = l;
            break;
          }
          if (a === r) {
            o = !0, r = i, n = l;
            break;
          }
          a = a.sibling;
        }
        if (!o)
          throw Error(S(189));
      }
    }
    if (n.alternate !== r)
      throw Error(S(190));
  }
  if (n.tag !== 3)
    throw Error(S(188));
  return n.stateNode.current === n ? e : t;
}
function au(e) {
  return e = Ff(e), e !== null ? uu(e) : null;
}
function uu(e) {
  if (e.tag === 5 || e.tag === 6)
    return e;
  for (e = e.child; e !== null; ) {
    var t = uu(e);
    if (t !== null)
      return t;
    e = e.sibling;
  }
  return null;
}
var cu = Ne.unstable_scheduleCallback, hs = Ne.unstable_cancelCallback, If = Ne.unstable_shouldYield, $f = Ne.unstable_requestPaint, q = Ne.unstable_now, Of = Ne.unstable_getCurrentPriorityLevel, wo = Ne.unstable_ImmediatePriority, fu = Ne.unstable_UserBlockingPriority, Xr = Ne.unstable_NormalPriority, Uf = Ne.unstable_LowPriority, du = Ne.unstable_IdlePriority, Sl = null, Qe = null;
function Af(e) {
  if (Qe && typeof Qe.onCommitFiberRoot == "function")
    try {
      Qe.onCommitFiberRoot(Sl, e, void 0, (e.current.flags & 128) === 128);
    } catch {
    }
}
var Oe = Math.clz32 ? Math.clz32 : Hf, Bf = Math.log, Vf = Math.LN2;
function Hf(e) {
  return e >>>= 0, e === 0 ? 32 : 31 - (Bf(e) / Vf | 0) | 0;
}
var gr = 64, vr = 4194304;
function zn(e) {
  switch (e & -e) {
    case 1:
      return 1;
    case 2:
      return 2;
    case 4:
      return 4;
    case 8:
      return 8;
    case 16:
      return 16;
    case 32:
      return 32;
    case 64:
    case 128:
    case 256:
    case 512:
    case 1024:
    case 2048:
    case 4096:
    case 8192:
    case 16384:
    case 32768:
    case 65536:
    case 131072:
    case 262144:
    case 524288:
    case 1048576:
    case 2097152:
      return e & 4194240;
    case 4194304:
    case 8388608:
    case 16777216:
    case 33554432:
    case 67108864:
      return e & 130023424;
    case 134217728:
      return 134217728;
    case 268435456:
      return 268435456;
    case 536870912:
      return 536870912;
    case 1073741824:
      return 1073741824;
    default:
      return e;
  }
}
function qr(e, t) {
  var n = e.pendingLanes;
  if (n === 0)
    return 0;
  var r = 0, l = e.suspendedLanes, i = e.pingedLanes, o = n & 268435455;
  if (o !== 0) {
    var a = o & ~l;
    a !== 0 ? r = zn(a) : (i &= o, i !== 0 && (r = zn(i)));
  } else
    o = n & ~l, o !== 0 ? r = zn(o) : i !== 0 && (r = zn(i));
  if (r === 0)
    return 0;
  if (t !== 0 && t !== r && !(t & l) && (l = r & -r, i = t & -t, l >= i || l === 16 && (i & 4194240) !== 0))
    return t;
  if (r & 4 && (r |= n & 16), t = e.entangledLanes, t !== 0)
    for (e = e.entanglements, t &= r; 0 < t; )
      n = 31 - Oe(t), l = 1 << n, r |= e[n], t &= ~l;
  return r;
}
function Qf(e, t) {
  switch (e) {
    case 1:
    case 2:
    case 4:
      return t + 250;
    case 8:
    case 16:
    case 32:
    case 64:
    case 128:
    case 256:
    case 512:
    case 1024:
    case 2048:
    case 4096:
    case 8192:
    case 16384:
    case 32768:
    case 65536:
    case 131072:
    case 262144:
    case 524288:
    case 1048576:
    case 2097152:
      return t + 5e3;
    case 4194304:
    case 8388608:
    case 16777216:
    case 33554432:
    case 67108864:
      return -1;
    case 134217728:
    case 268435456:
    case 536870912:
    case 1073741824:
      return -1;
    default:
      return -1;
  }
}
function Wf(e, t) {
  for (var n = e.suspendedLanes, r = e.pingedLanes, l = e.expirationTimes, i = e.pendingLanes; 0 < i; ) {
    var o = 31 - Oe(i), a = 1 << o, u = l[o];
    u === -1 ? (!(a & n) || a & r) && (l[o] = Qf(a, t)) : u <= t && (e.expiredLanes |= a), i &= ~a;
  }
}
function Li(e) {
  return e = e.pendingLanes & -1073741825, e !== 0 ? e : e & 1073741824 ? 1073741824 : 0;
}
function pu() {
  var e = gr;
  return gr <<= 1, !(gr & 4194240) && (gr = 64), e;
}
function Hl(e) {
  for (var t = [], n = 0; 31 > n; n++)
    t.push(e);
  return t;
}
function ir(e, t, n) {
  e.pendingLanes |= t, t !== 536870912 && (e.suspendedLanes = 0, e.pingedLanes = 0), e = e.eventTimes, t = 31 - Oe(t), e[t] = n;
}
function Kf(e, t) {
  var n = e.pendingLanes & ~t;
  e.pendingLanes = t, e.suspendedLanes = 0, e.pingedLanes = 0, e.expiredLanes &= t, e.mutableReadLanes &= t, e.entangledLanes &= t, t = e.entanglements;
  var r = e.eventTimes;
  for (e = e.expirationTimes; 0 < n; ) {
    var l = 31 - Oe(n), i = 1 << l;
    t[l] = 0, r[l] = -1, e[l] = -1, n &= ~i;
  }
}
function xo(e, t) {
  var n = e.entangledLanes |= t;
  for (e = e.entanglements; n; ) {
    var r = 31 - Oe(n), l = 1 << r;
    l & t | e[r] & t && (e[r] |= t), n &= ~l;
  }
}
var O = 0;
function mu(e) {
  return e &= -e, 1 < e ? 4 < e ? e & 268435455 ? 16 : 536870912 : 4 : 1;
}
var hu, So, gu, vu, yu, Di = !1, yr = [], pt = null, mt = null, ht = null, Qn = /* @__PURE__ */ new Map(), Wn = /* @__PURE__ */ new Map(), ut = [], Gf = "mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset submit".split(" ");
function gs(e, t) {
  switch (e) {
    case "focusin":
    case "focusout":
      pt = null;
      break;
    case "dragenter":
    case "dragleave":
      mt = null;
      break;
    case "mouseover":
    case "mouseout":
      ht = null;
      break;
    case "pointerover":
    case "pointerout":
      Qn.delete(t.pointerId);
      break;
    case "gotpointercapture":
    case "lostpointercapture":
      Wn.delete(t.pointerId);
  }
}
function jn(e, t, n, r, l, i) {
  return e === null || e.nativeEvent !== i ? (e = { blockedOn: t, domEventName: n, eventSystemFlags: r, nativeEvent: i, targetContainers: [l] }, t !== null && (t = sr(t), t !== null && So(t)), e) : (e.eventSystemFlags |= r, t = e.targetContainers, l !== null && t.indexOf(l) === -1 && t.push(l), e);
}
function Yf(e, t, n, r, l) {
  switch (t) {
    case "focusin":
      return pt = jn(pt, e, t, n, r, l), !0;
    case "dragenter":
      return mt = jn(mt, e, t, n, r, l), !0;
    case "mouseover":
      return ht = jn(ht, e, t, n, r, l), !0;
    case "pointerover":
      var i = l.pointerId;
      return Qn.set(i, jn(Qn.get(i) || null, e, t, n, r, l)), !0;
    case "gotpointercapture":
      return i = l.pointerId, Wn.set(i, jn(Wn.get(i) || null, e, t, n, r, l)), !0;
  }
  return !1;
}
function wu(e) {
  var t = Lt(e.target);
  if (t !== null) {
    var n = Vt(t);
    if (n !== null) {
      if (t = n.tag, t === 13) {
        if (t = su(n), t !== null) {
          e.blockedOn = t, yu(e.priority, function() {
            gu(n);
          });
          return;
        }
      } else if (t === 3 && n.stateNode.current.memoizedState.isDehydrated) {
        e.blockedOn = n.tag === 3 ? n.stateNode.containerInfo : null;
        return;
      }
    }
  }
  e.blockedOn = null;
}
function Fr(e) {
  if (e.blockedOn !== null)
    return !1;
  for (var t = e.targetContainers; 0 < t.length; ) {
    var n = Ri(e.domEventName, e.eventSystemFlags, t[0], e.nativeEvent);
    if (n === null) {
      n = e.nativeEvent;
      var r = new n.constructor(n.type, n);
      _i = r, n.target.dispatchEvent(r), _i = null;
    } else
      return t = sr(n), t !== null && So(t), e.blockedOn = n, !1;
    t.shift();
  }
  return !0;
}
function vs(e, t, n) {
  Fr(e) && n.delete(t);
}
function Xf() {
  Di = !1, pt !== null && Fr(pt) && (pt = null), mt !== null && Fr(mt) && (mt = null), ht !== null && Fr(ht) && (ht = null), Qn.forEach(vs), Wn.forEach(vs);
}
function kn(e, t) {
  e.blockedOn === t && (e.blockedOn = null, Di || (Di = !0, Ne.unstable_scheduleCallback(Ne.unstable_NormalPriority, Xf)));
}
function Kn(e) {
  function t(l) {
    return kn(l, e);
  }
  if (0 < yr.length) {
    kn(yr[0], e);
    for (var n = 1; n < yr.length; n++) {
      var r = yr[n];
      r.blockedOn === e && (r.blockedOn = null);
    }
  }
  for (pt !== null && kn(pt, e), mt !== null && kn(mt, e), ht !== null && kn(ht, e), Qn.forEach(t), Wn.forEach(t), n = 0; n < ut.length; n++)
    r = ut[n], r.blockedOn === e && (r.blockedOn = null);
  for (; 0 < ut.length && (n = ut[0], n.blockedOn === null); )
    wu(n), n.blockedOn === null && ut.shift();
}
var on = rt.ReactCurrentBatchConfig, Zr = !0;
function qf(e, t, n, r) {
  var l = O, i = on.transition;
  on.transition = null;
  try {
    O = 1, jo(e, t, n, r);
  } finally {
    O = l, on.transition = i;
  }
}
function Zf(e, t, n, r) {
  var l = O, i = on.transition;
  on.transition = null;
  try {
    O = 4, jo(e, t, n, r);
  } finally {
    O = l, on.transition = i;
  }
}
function jo(e, t, n, r) {
  if (Zr) {
    var l = Ri(e, t, n, r);
    if (l === null)
      bl(e, t, r, Jr, n), gs(e, r);
    else if (Yf(l, e, t, n, r))
      r.stopPropagation();
    else if (gs(e, r), t & 4 && -1 < Gf.indexOf(e)) {
      for (; l !== null; ) {
        var i = sr(l);
        if (i !== null && hu(i), i = Ri(e, t, n, r), i === null && bl(e, t, r, Jr, n), i === l)
          break;
        l = i;
      }
      l !== null && r.stopPropagation();
    } else
      bl(e, t, r, null, n);
  }
}
var Jr = null;
function Ri(e, t, n, r) {
  if (Jr = null, e = yo(r), e = Lt(e), e !== null)
    if (t = Vt(e), t === null)
      e = null;
    else if (n = t.tag, n === 13) {
      if (e = su(t), e !== null)
        return e;
      e = null;
    } else if (n === 3) {
      if (t.stateNode.current.memoizedState.isDehydrated)
        return t.tag === 3 ? t.stateNode.containerInfo : null;
      e = null;
    } else
      t !== e && (e = null);
  return Jr = e, null;
}
function xu(e) {
  switch (e) {
    case "cancel":
    case "click":
    case "close":
    case "contextmenu":
    case "copy":
    case "cut":
    case "auxclick":
    case "dblclick":
    case "dragend":
    case "dragstart":
    case "drop":
    case "focusin":
    case "focusout":
    case "input":
    case "invalid":
    case "keydown":
    case "keypress":
    case "keyup":
    case "mousedown":
    case "mouseup":
    case "paste":
    case "pause":
    case "play":
    case "pointercancel":
    case "pointerdown":
    case "pointerup":
    case "ratechange":
    case "reset":
    case "resize":
    case "seeked":
    case "submit":
    case "touchcancel":
    case "touchend":
    case "touchstart":
    case "volumechange":
    case "change":
    case "selectionchange":
    case "textInput":
    case "compositionstart":
    case "compositionend":
    case "compositionupdate":
    case "beforeblur":
    case "afterblur":
    case "beforeinput":
    case "blur":
    case "fullscreenchange":
    case "focus":
    case "hashchange":
    case "popstate":
    case "select":
    case "selectstart":
      return 1;
    case "drag":
    case "dragenter":
    case "dragexit":
    case "dragleave":
    case "dragover":
    case "mousemove":
    case "mouseout":
    case "mouseover":
    case "pointermove":
    case "pointerout":
    case "pointerover":
    case "scroll":
    case "toggle":
    case "touchmove":
    case "wheel":
    case "mouseenter":
    case "mouseleave":
    case "pointerenter":
    case "pointerleave":
      return 4;
    case "message":
      switch (Of()) {
        case wo:
          return 1;
        case fu:
          return 4;
        case Xr:
        case Uf:
          return 16;
        case du:
          return 536870912;
        default:
          return 16;
      }
    default:
      return 16;
  }
}
var ft = null, ko = null, Ir = null;
function Su() {
  if (Ir)
    return Ir;
  var e, t = ko, n = t.length, r, l = "value" in ft ? ft.value : ft.textContent, i = l.length;
  for (e = 0; e < n && t[e] === l[e]; e++)
    ;
  var o = n - e;
  for (r = 1; r <= o && t[n - r] === l[i - r]; r++)
    ;
  return Ir = l.slice(e, 1 < r ? 1 - r : void 0);
}
function $r(e) {
  var t = e.keyCode;
  return "charCode" in e ? (e = e.charCode, e === 0 && t === 13 && (e = 13)) : e = t, e === 10 && (e = 13), 32 <= e || e === 13 ? e : 0;
}
function wr() {
  return !0;
}
function ys() {
  return !1;
}
function Ee(e) {
  function t(n, r, l, i, o) {
    this._reactName = n, this._targetInst = l, this.type = r, this.nativeEvent = i, this.target = o, this.currentTarget = null;
    for (var a in e)
      e.hasOwnProperty(a) && (n = e[a], this[a] = n ? n(i) : i[a]);
    return this.isDefaultPrevented = (i.defaultPrevented != null ? i.defaultPrevented : i.returnValue === !1) ? wr : ys, this.isPropagationStopped = ys, this;
  }
  return K(t.prototype, { preventDefault: function() {
    this.defaultPrevented = !0;
    var n = this.nativeEvent;
    n && (n.preventDefault ? n.preventDefault() : typeof n.returnValue != "unknown" && (n.returnValue = !1), this.isDefaultPrevented = wr);
  }, stopPropagation: function() {
    var n = this.nativeEvent;
    n && (n.stopPropagation ? n.stopPropagation() : typeof n.cancelBubble != "unknown" && (n.cancelBubble = !0), this.isPropagationStopped = wr);
  }, persist: function() {
  }, isPersistent: wr }), t;
}
var yn = { eventPhase: 0, bubbles: 0, cancelable: 0, timeStamp: function(e) {
  return e.timeStamp || Date.now();
}, defaultPrevented: 0, isTrusted: 0 }, No = Ee(yn), or = K({}, yn, { view: 0, detail: 0 }), Jf = Ee(or), Ql, Wl, Nn, jl = K({}, or, { screenX: 0, screenY: 0, clientX: 0, clientY: 0, pageX: 0, pageY: 0, ctrlKey: 0, shiftKey: 0, altKey: 0, metaKey: 0, getModifierState: Co, button: 0, buttons: 0, relatedTarget: function(e) {
  return e.relatedTarget === void 0 ? e.fromElement === e.srcElement ? e.toElement : e.fromElement : e.relatedTarget;
}, movementX: function(e) {
  return "movementX" in e ? e.movementX : (e !== Nn && (Nn && e.type === "mousemove" ? (Ql = e.screenX - Nn.screenX, Wl = e.screenY - Nn.screenY) : Wl = Ql = 0, Nn = e), Ql);
}, movementY: function(e) {
  return "movementY" in e ? e.movementY : Wl;
} }), ws = Ee(jl), bf = K({}, jl, { dataTransfer: 0 }), ed = Ee(bf), td = K({}, or, { relatedTarget: 0 }), Kl = Ee(td), nd = K({}, yn, { animationName: 0, elapsedTime: 0, pseudoElement: 0 }), rd = Ee(nd), ld = K({}, yn, { clipboardData: function(e) {
  return "clipboardData" in e ? e.clipboardData : window.clipboardData;
} }), id = Ee(ld), od = K({}, yn, { data: 0 }), xs = Ee(od), sd = {
  Esc: "Escape",
  Spacebar: " ",
  Left: "ArrowLeft",
  Up: "ArrowUp",
  Right: "ArrowRight",
  Down: "ArrowDown",
  Del: "Delete",
  Win: "OS",
  Menu: "ContextMenu",
  Apps: "ContextMenu",
  Scroll: "ScrollLock",
  MozPrintableKey: "Unidentified"
}, ad = {
  8: "Backspace",
  9: "Tab",
  12: "Clear",
  13: "Enter",
  16: "Shift",
  17: "Control",
  18: "Alt",
  19: "Pause",
  20: "CapsLock",
  27: "Escape",
  32: " ",
  33: "PageUp",
  34: "PageDown",
  35: "End",
  36: "Home",
  37: "ArrowLeft",
  38: "ArrowUp",
  39: "ArrowRight",
  40: "ArrowDown",
  45: "Insert",
  46: "Delete",
  112: "F1",
  113: "F2",
  114: "F3",
  115: "F4",
  116: "F5",
  117: "F6",
  118: "F7",
  119: "F8",
  120: "F9",
  121: "F10",
  122: "F11",
  123: "F12",
  144: "NumLock",
  145: "ScrollLock",
  224: "Meta"
}, ud = { Alt: "altKey", Control: "ctrlKey", Meta: "metaKey", Shift: "shiftKey" };
function cd(e) {
  var t = this.nativeEvent;
  return t.getModifierState ? t.getModifierState(e) : (e = ud[e]) ? !!t[e] : !1;
}
function Co() {
  return cd;
}
var fd = K({}, or, { key: function(e) {
  if (e.key) {
    var t = sd[e.key] || e.key;
    if (t !== "Unidentified")
      return t;
  }
  return e.type === "keypress" ? (e = $r(e), e === 13 ? "Enter" : String.fromCharCode(e)) : e.type === "keydown" || e.type === "keyup" ? ad[e.keyCode] || "Unidentified" : "";
}, code: 0, location: 0, ctrlKey: 0, shiftKey: 0, altKey: 0, metaKey: 0, repeat: 0, locale: 0, getModifierState: Co, charCode: function(e) {
  return e.type === "keypress" ? $r(e) : 0;
}, keyCode: function(e) {
  return e.type === "keydown" || e.type === "keyup" ? e.keyCode : 0;
}, which: function(e) {
  return e.type === "keypress" ? $r(e) : e.type === "keydown" || e.type === "keyup" ? e.keyCode : 0;
} }), dd = Ee(fd), pd = K({}, jl, { pointerId: 0, width: 0, height: 0, pressure: 0, tangentialPressure: 0, tiltX: 0, tiltY: 0, twist: 0, pointerType: 0, isPrimary: 0 }), Ss = Ee(pd), md = K({}, or, { touches: 0, targetTouches: 0, changedTouches: 0, altKey: 0, metaKey: 0, ctrlKey: 0, shiftKey: 0, getModifierState: Co }), hd = Ee(md), gd = K({}, yn, { propertyName: 0, elapsedTime: 0, pseudoElement: 0 }), vd = Ee(gd), yd = K({}, jl, {
  deltaX: function(e) {
    return "deltaX" in e ? e.deltaX : "wheelDeltaX" in e ? -e.wheelDeltaX : 0;
  },
  deltaY: function(e) {
    return "deltaY" in e ? e.deltaY : "wheelDeltaY" in e ? -e.wheelDeltaY : "wheelDelta" in e ? -e.wheelDelta : 0;
  },
  deltaZ: 0,
  deltaMode: 0
}), wd = Ee(yd), xd = [9, 13, 27, 32], Eo = be && "CompositionEvent" in window, Mn = null;
be && "documentMode" in document && (Mn = document.documentMode);
var Sd = be && "TextEvent" in window && !Mn, ju = be && (!Eo || Mn && 8 < Mn && 11 >= Mn), js = " ", ks = !1;
function ku(e, t) {
  switch (e) {
    case "keyup":
      return xd.indexOf(t.keyCode) !== -1;
    case "keydown":
      return t.keyCode !== 229;
    case "keypress":
    case "mousedown":
    case "focusout":
      return !0;
    default:
      return !1;
  }
}
function Nu(e) {
  return e = e.detail, typeof e == "object" && "data" in e ? e.data : null;
}
var Kt = !1;
function jd(e, t) {
  switch (e) {
    case "compositionend":
      return Nu(t);
    case "keypress":
      return t.which !== 32 ? null : (ks = !0, js);
    case "textInput":
      return e = t.data, e === js && ks ? null : e;
    default:
      return null;
  }
}
function kd(e, t) {
  if (Kt)
    return e === "compositionend" || !Eo && ku(e, t) ? (e = Su(), Ir = ko = ft = null, Kt = !1, e) : null;
  switch (e) {
    case "paste":
      return null;
    case "keypress":
      if (!(t.ctrlKey || t.altKey || t.metaKey) || t.ctrlKey && t.altKey) {
        if (t.char && 1 < t.char.length)
          return t.char;
        if (t.which)
          return String.fromCharCode(t.which);
      }
      return null;
    case "compositionend":
      return ju && t.locale !== "ko" ? null : t.data;
    default:
      return null;
  }
}
var Nd = { color: !0, date: !0, datetime: !0, "datetime-local": !0, email: !0, month: !0, number: !0, password: !0, range: !0, search: !0, tel: !0, text: !0, time: !0, url: !0, week: !0 };
function Ns(e) {
  var t = e && e.nodeName && e.nodeName.toLowerCase();
  return t === "input" ? !!Nd[e.type] : t === "textarea";
}
function Cu(e, t, n, r) {
  nu(r), t = br(t, "onChange"), 0 < t.length && (n = new No("onChange", "change", null, n, r), e.push({ event: n, listeners: t }));
}
var Fn = null, Gn = null;
function Cd(e) {
  Iu(e, 0);
}
function kl(e) {
  var t = Xt(e);
  if (Xa(t))
    return e;
}
function Ed(e, t) {
  if (e === "change")
    return t;
}
var Eu = !1;
if (be) {
  var Gl;
  if (be) {
    var Yl = "oninput" in document;
    if (!Yl) {
      var Cs = document.createElement("div");
      Cs.setAttribute("oninput", "return;"), Yl = typeof Cs.oninput == "function";
    }
    Gl = Yl;
  } else
    Gl = !1;
  Eu = Gl && (!document.documentMode || 9 < document.documentMode);
}
function Es() {
  Fn && (Fn.detachEvent("onpropertychange", _u), Gn = Fn = null);
}
function _u(e) {
  if (e.propertyName === "value" && kl(Gn)) {
    var t = [];
    Cu(t, Gn, e, yo(e)), ou(Cd, t);
  }
}
function _d(e, t, n) {
  e === "focusin" ? (Es(), Fn = t, Gn = n, Fn.attachEvent("onpropertychange", _u)) : e === "focusout" && Es();
}
function Pd(e) {
  if (e === "selectionchange" || e === "keyup" || e === "keydown")
    return kl(Gn);
}
function Td(e, t) {
  if (e === "click")
    return kl(t);
}
function zd(e, t) {
  if (e === "input" || e === "change")
    return kl(t);
}
function Ld(e, t) {
  return e === t && (e !== 0 || 1 / e === 1 / t) || e !== e && t !== t;
}
var Ae = typeof Object.is == "function" ? Object.is : Ld;
function Yn(e, t) {
  if (Ae(e, t))
    return !0;
  if (typeof e != "object" || e === null || typeof t != "object" || t === null)
    return !1;
  var n = Object.keys(e), r = Object.keys(t);
  if (n.length !== r.length)
    return !1;
  for (r = 0; r < n.length; r++) {
    var l = n[r];
    if (!hi.call(t, l) || !Ae(e[l], t[l]))
      return !1;
  }
  return !0;
}
function _s(e) {
  for (; e && e.firstChild; )
    e = e.firstChild;
  return e;
}
function Ps(e, t) {
  var n = _s(e);
  e = 0;
  for (var r; n; ) {
    if (n.nodeType === 3) {
      if (r = e + n.textContent.length, e <= t && r >= t)
        return { node: n, offset: t - e };
      e = r;
    }
    e: {
      for (; n; ) {
        if (n.nextSibling) {
          n = n.nextSibling;
          break e;
        }
        n = n.parentNode;
      }
      n = void 0;
    }
    n = _s(n);
  }
}
function Pu(e, t) {
  return e && t ? e === t ? !0 : e && e.nodeType === 3 ? !1 : t && t.nodeType === 3 ? Pu(e, t.parentNode) : "contains" in e ? e.contains(t) : e.compareDocumentPosition ? !!(e.compareDocumentPosition(t) & 16) : !1 : !1;
}
function Tu() {
  for (var e = window, t = Kr(); t instanceof e.HTMLIFrameElement; ) {
    try {
      var n = typeof t.contentWindow.location.href == "string";
    } catch {
      n = !1;
    }
    if (n)
      e = t.contentWindow;
    else
      break;
    t = Kr(e.document);
  }
  return t;
}
function _o(e) {
  var t = e && e.nodeName && e.nodeName.toLowerCase();
  return t && (t === "input" && (e.type === "text" || e.type === "search" || e.type === "tel" || e.type === "url" || e.type === "password") || t === "textarea" || e.contentEditable === "true");
}
function Dd(e) {
  var t = Tu(), n = e.focusedElem, r = e.selectionRange;
  if (t !== n && n && n.ownerDocument && Pu(n.ownerDocument.documentElement, n)) {
    if (r !== null && _o(n)) {
      if (t = r.start, e = r.end, e === void 0 && (e = t), "selectionStart" in n)
        n.selectionStart = t, n.selectionEnd = Math.min(e, n.value.length);
      else if (e = (t = n.ownerDocument || document) && t.defaultView || window, e.getSelection) {
        e = e.getSelection();
        var l = n.textContent.length, i = Math.min(r.start, l);
        r = r.end === void 0 ? i : Math.min(r.end, l), !e.extend && i > r && (l = r, r = i, i = l), l = Ps(n, i);
        var o = Ps(
          n,
          r
        );
        l && o && (e.rangeCount !== 1 || e.anchorNode !== l.node || e.anchorOffset !== l.offset || e.focusNode !== o.node || e.focusOffset !== o.offset) && (t = t.createRange(), t.setStart(l.node, l.offset), e.removeAllRanges(), i > r ? (e.addRange(t), e.extend(o.node, o.offset)) : (t.setEnd(o.node, o.offset), e.addRange(t)));
      }
    }
    for (t = [], e = n; e = e.parentNode; )
      e.nodeType === 1 && t.push({ element: e, left: e.scrollLeft, top: e.scrollTop });
    for (typeof n.focus == "function" && n.focus(), n = 0; n < t.length; n++)
      e = t[n], e.element.scrollLeft = e.left, e.element.scrollTop = e.top;
  }
}
var Rd = be && "documentMode" in document && 11 >= document.documentMode, Gt = null, Mi = null, In = null, Fi = !1;
function Ts(e, t, n) {
  var r = n.window === n ? n.document : n.nodeType === 9 ? n : n.ownerDocument;
  Fi || Gt == null || Gt !== Kr(r) || (r = Gt, "selectionStart" in r && _o(r) ? r = { start: r.selectionStart, end: r.selectionEnd } : (r = (r.ownerDocument && r.ownerDocument.defaultView || window).getSelection(), r = { anchorNode: r.anchorNode, anchorOffset: r.anchorOffset, focusNode: r.focusNode, focusOffset: r.focusOffset }), In && Yn(In, r) || (In = r, r = br(Mi, "onSelect"), 0 < r.length && (t = new No("onSelect", "select", null, t, n), e.push({ event: t, listeners: r }), t.target = Gt)));
}
function xr(e, t) {
  var n = {};
  return n[e.toLowerCase()] = t.toLowerCase(), n["Webkit" + e] = "webkit" + t, n["Moz" + e] = "moz" + t, n;
}
var Yt = { animationend: xr("Animation", "AnimationEnd"), animationiteration: xr("Animation", "AnimationIteration"), animationstart: xr("Animation", "AnimationStart"), transitionend: xr("Transition", "TransitionEnd") }, Xl = {}, zu = {};
be && (zu = document.createElement("div").style, "AnimationEvent" in window || (delete Yt.animationend.animation, delete Yt.animationiteration.animation, delete Yt.animationstart.animation), "TransitionEvent" in window || delete Yt.transitionend.transition);
function Nl(e) {
  if (Xl[e])
    return Xl[e];
  if (!Yt[e])
    return e;
  var t = Yt[e], n;
  for (n in t)
    if (t.hasOwnProperty(n) && n in zu)
      return Xl[e] = t[n];
  return e;
}
var Lu = Nl("animationend"), Du = Nl("animationiteration"), Ru = Nl("animationstart"), Mu = Nl("transitionend"), Fu = /* @__PURE__ */ new Map(), zs = "abort auxClick cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(" ");
function kt(e, t) {
  Fu.set(e, t), Bt(t, [e]);
}
for (var ql = 0; ql < zs.length; ql++) {
  var Zl = zs[ql], Md = Zl.toLowerCase(), Fd = Zl[0].toUpperCase() + Zl.slice(1);
  kt(Md, "on" + Fd);
}
kt(Lu, "onAnimationEnd");
kt(Du, "onAnimationIteration");
kt(Ru, "onAnimationStart");
kt("dblclick", "onDoubleClick");
kt("focusin", "onFocus");
kt("focusout", "onBlur");
kt(Mu, "onTransitionEnd");
cn("onMouseEnter", ["mouseout", "mouseover"]);
cn("onMouseLeave", ["mouseout", "mouseover"]);
cn("onPointerEnter", ["pointerout", "pointerover"]);
cn("onPointerLeave", ["pointerout", "pointerover"]);
Bt("onChange", "change click focusin focusout input keydown keyup selectionchange".split(" "));
Bt("onSelect", "focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(" "));
Bt("onBeforeInput", ["compositionend", "keypress", "textInput", "paste"]);
Bt("onCompositionEnd", "compositionend focusout keydown keypress keyup mousedown".split(" "));
Bt("onCompositionStart", "compositionstart focusout keydown keypress keyup mousedown".split(" "));
Bt("onCompositionUpdate", "compositionupdate focusout keydown keypress keyup mousedown".split(" "));
var Ln = "abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(" "), Id = new Set("cancel close invalid load scroll toggle".split(" ").concat(Ln));
function Ls(e, t, n) {
  var r = e.type || "unknown-event";
  e.currentTarget = n, Mf(r, t, void 0, e), e.currentTarget = null;
}
function Iu(e, t) {
  t = (t & 4) !== 0;
  for (var n = 0; n < e.length; n++) {
    var r = e[n], l = r.event;
    r = r.listeners;
    e: {
      var i = void 0;
      if (t)
        for (var o = r.length - 1; 0 <= o; o--) {
          var a = r[o], u = a.instance, c = a.currentTarget;
          if (a = a.listener, u !== i && l.isPropagationStopped())
            break e;
          Ls(l, a, c), i = u;
        }
      else
        for (o = 0; o < r.length; o++) {
          if (a = r[o], u = a.instance, c = a.currentTarget, a = a.listener, u !== i && l.isPropagationStopped())
            break e;
          Ls(l, a, c), i = u;
        }
    }
  }
  if (Yr)
    throw e = zi, Yr = !1, zi = null, e;
}
function B(e, t) {
  var n = t[Ai];
  n === void 0 && (n = t[Ai] = /* @__PURE__ */ new Set());
  var r = e + "__bubble";
  n.has(r) || ($u(t, e, 2, !1), n.add(r));
}
function Jl(e, t, n) {
  var r = 0;
  t && (r |= 4), $u(n, e, r, t);
}
var Sr = "_reactListening" + Math.random().toString(36).slice(2);
function Xn(e) {
  if (!e[Sr]) {
    e[Sr] = !0, Qa.forEach(function(n) {
      n !== "selectionchange" && (Id.has(n) || Jl(n, !1, e), Jl(n, !0, e));
    });
    var t = e.nodeType === 9 ? e : e.ownerDocument;
    t === null || t[Sr] || (t[Sr] = !0, Jl("selectionchange", !1, t));
  }
}
function $u(e, t, n, r) {
  switch (xu(t)) {
    case 1:
      var l = qf;
      break;
    case 4:
      l = Zf;
      break;
    default:
      l = jo;
  }
  n = l.bind(null, t, n, e), l = void 0, !Ti || t !== "touchstart" && t !== "touchmove" && t !== "wheel" || (l = !0), r ? l !== void 0 ? e.addEventListener(t, n, { capture: !0, passive: l }) : e.addEventListener(t, n, !0) : l !== void 0 ? e.addEventListener(t, n, { passive: l }) : e.addEventListener(t, n, !1);
}
function bl(e, t, n, r, l) {
  var i = r;
  if (!(t & 1) && !(t & 2) && r !== null)
    e:
      for (; ; ) {
        if (r === null)
          return;
        var o = r.tag;
        if (o === 3 || o === 4) {
          var a = r.stateNode.containerInfo;
          if (a === l || a.nodeType === 8 && a.parentNode === l)
            break;
          if (o === 4)
            for (o = r.return; o !== null; ) {
              var u = o.tag;
              if ((u === 3 || u === 4) && (u = o.stateNode.containerInfo, u === l || u.nodeType === 8 && u.parentNode === l))
                return;
              o = o.return;
            }
          for (; a !== null; ) {
            if (o = Lt(a), o === null)
              return;
            if (u = o.tag, u === 5 || u === 6) {
              r = i = o;
              continue e;
            }
            a = a.parentNode;
          }
        }
        r = r.return;
      }
  ou(function() {
    var c = i, p = yo(n), g = [];
    e: {
      var h = Fu.get(e);
      if (h !== void 0) {
        var y = No, v = e;
        switch (e) {
          case "keypress":
            if ($r(n) === 0)
              break e;
          case "keydown":
          case "keyup":
            y = dd;
            break;
          case "focusin":
            v = "focus", y = Kl;
            break;
          case "focusout":
            v = "blur", y = Kl;
            break;
          case "beforeblur":
          case "afterblur":
            y = Kl;
            break;
          case "click":
            if (n.button === 2)
              break e;
          case "auxclick":
          case "dblclick":
          case "mousedown":
          case "mousemove":
          case "mouseup":
          case "mouseout":
          case "mouseover":
          case "contextmenu":
            y = ws;
            break;
          case "drag":
          case "dragend":
          case "dragenter":
          case "dragexit":
          case "dragleave":
          case "dragover":
          case "dragstart":
          case "drop":
            y = ed;
            break;
          case "touchcancel":
          case "touchend":
          case "touchmove":
          case "touchstart":
            y = hd;
            break;
          case Lu:
          case Du:
          case Ru:
            y = rd;
            break;
          case Mu:
            y = vd;
            break;
          case "scroll":
            y = Jf;
            break;
          case "wheel":
            y = wd;
            break;
          case "copy":
          case "cut":
          case "paste":
            y = id;
            break;
          case "gotpointercapture":
          case "lostpointercapture":
          case "pointercancel":
          case "pointerdown":
          case "pointermove":
          case "pointerout":
          case "pointerover":
          case "pointerup":
            y = Ss;
        }
        var w = (t & 4) !== 0, z = !w && e === "scroll", d = w ? h !== null ? h + "Capture" : null : h;
        w = [];
        for (var f = c, m; f !== null; ) {
          m = f;
          var x = m.stateNode;
          if (m.tag === 5 && x !== null && (m = x, d !== null && (x = Hn(f, d), x != null && w.push(qn(f, x, m)))), z)
            break;
          f = f.return;
        }
        0 < w.length && (h = new y(h, v, null, n, p), g.push({ event: h, listeners: w }));
      }
    }
    if (!(t & 7)) {
      e: {
        if (h = e === "mouseover" || e === "pointerover", y = e === "mouseout" || e === "pointerout", h && n !== _i && (v = n.relatedTarget || n.fromElement) && (Lt(v) || v[et]))
          break e;
        if ((y || h) && (h = p.window === p ? p : (h = p.ownerDocument) ? h.defaultView || h.parentWindow : window, y ? (v = n.relatedTarget || n.toElement, y = c, v = v ? Lt(v) : null, v !== null && (z = Vt(v), v !== z || v.tag !== 5 && v.tag !== 6) && (v = null)) : (y = null, v = c), y !== v)) {
          if (w = ws, x = "onMouseLeave", d = "onMouseEnter", f = "mouse", (e === "pointerout" || e === "pointerover") && (w = Ss, x = "onPointerLeave", d = "onPointerEnter", f = "pointer"), z = y == null ? h : Xt(y), m = v == null ? h : Xt(v), h = new w(x, f + "leave", y, n, p), h.target = z, h.relatedTarget = m, x = null, Lt(p) === c && (w = new w(d, f + "enter", v, n, p), w.target = m, w.relatedTarget = z, x = w), z = x, y && v)
            t: {
              for (w = y, d = v, f = 0, m = w; m; m = Ht(m))
                f++;
              for (m = 0, x = d; x; x = Ht(x))
                m++;
              for (; 0 < f - m; )
                w = Ht(w), f--;
              for (; 0 < m - f; )
                d = Ht(d), m--;
              for (; f--; ) {
                if (w === d || d !== null && w === d.alternate)
                  break t;
                w = Ht(w), d = Ht(d);
              }
              w = null;
            }
          else
            w = null;
          y !== null && Ds(g, h, y, w, !1), v !== null && z !== null && Ds(g, z, v, w, !0);
        }
      }
      e: {
        if (h = c ? Xt(c) : window, y = h.nodeName && h.nodeName.toLowerCase(), y === "select" || y === "input" && h.type === "file")
          var j = Ed;
        else if (Ns(h))
          if (Eu)
            j = zd;
          else {
            j = Pd;
            var N = _d;
          }
        else
          (y = h.nodeName) && y.toLowerCase() === "input" && (h.type === "checkbox" || h.type === "radio") && (j = Td);
        if (j && (j = j(e, c))) {
          Cu(g, j, n, p);
          break e;
        }
        N && N(e, h, c), e === "focusout" && (N = h._wrapperState) && N.controlled && h.type === "number" && ji(h, "number", h.value);
      }
      switch (N = c ? Xt(c) : window, e) {
        case "focusin":
          (Ns(N) || N.contentEditable === "true") && (Gt = N, Mi = c, In = null);
          break;
        case "focusout":
          In = Mi = Gt = null;
          break;
        case "mousedown":
          Fi = !0;
          break;
        case "contextmenu":
        case "mouseup":
        case "dragend":
          Fi = !1, Ts(g, n, p);
          break;
        case "selectionchange":
          if (Rd)
            break;
        case "keydown":
        case "keyup":
          Ts(g, n, p);
      }
      var C;
      if (Eo)
        e: {
          switch (e) {
            case "compositionstart":
              var _ = "onCompositionStart";
              break e;
            case "compositionend":
              _ = "onCompositionEnd";
              break e;
            case "compositionupdate":
              _ = "onCompositionUpdate";
              break e;
          }
          _ = void 0;
        }
      else
        Kt ? ku(e, n) && (_ = "onCompositionEnd") : e === "keydown" && n.keyCode === 229 && (_ = "onCompositionStart");
      _ && (ju && n.locale !== "ko" && (Kt || _ !== "onCompositionStart" ? _ === "onCompositionEnd" && Kt && (C = Su()) : (ft = p, ko = "value" in ft ? ft.value : ft.textContent, Kt = !0)), N = br(c, _), 0 < N.length && (_ = new xs(_, e, null, n, p), g.push({ event: _, listeners: N }), C ? _.data = C : (C = Nu(n), C !== null && (_.data = C)))), (C = Sd ? jd(e, n) : kd(e, n)) && (c = br(c, "onBeforeInput"), 0 < c.length && (p = new xs("onBeforeInput", "beforeinput", null, n, p), g.push({ event: p, listeners: c }), p.data = C));
    }
    Iu(g, t);
  });
}
function qn(e, t, n) {
  return { instance: e, listener: t, currentTarget: n };
}
function br(e, t) {
  for (var n = t + "Capture", r = []; e !== null; ) {
    var l = e, i = l.stateNode;
    l.tag === 5 && i !== null && (l = i, i = Hn(e, n), i != null && r.unshift(qn(e, i, l)), i = Hn(e, t), i != null && r.push(qn(e, i, l))), e = e.return;
  }
  return r;
}
function Ht(e) {
  if (e === null)
    return null;
  do
    e = e.return;
  while (e && e.tag !== 5);
  return e || null;
}
function Ds(e, t, n, r, l) {
  for (var i = t._reactName, o = []; n !== null && n !== r; ) {
    var a = n, u = a.alternate, c = a.stateNode;
    if (u !== null && u === r)
      break;
    a.tag === 5 && c !== null && (a = c, l ? (u = Hn(n, i), u != null && o.unshift(qn(n, u, a))) : l || (u = Hn(n, i), u != null && o.push(qn(n, u, a)))), n = n.return;
  }
  o.length !== 0 && e.push({ event: t, listeners: o });
}
var $d = /\r\n?/g, Od = /\u0000|\uFFFD/g;
function Rs(e) {
  return (typeof e == "string" ? e : "" + e).replace($d, `
`).replace(Od, "");
}
function jr(e, t, n) {
  if (t = Rs(t), Rs(e) !== t && n)
    throw Error(S(425));
}
function el() {
}
var Ii = null, $i = null;
function Oi(e, t) {
  return e === "textarea" || e === "noscript" || typeof t.children == "string" || typeof t.children == "number" || typeof t.dangerouslySetInnerHTML == "object" && t.dangerouslySetInnerHTML !== null && t.dangerouslySetInnerHTML.__html != null;
}
var Ui = typeof setTimeout == "function" ? setTimeout : void 0, Ud = typeof clearTimeout == "function" ? clearTimeout : void 0, Ms = typeof Promise == "function" ? Promise : void 0, Ad = typeof queueMicrotask == "function" ? queueMicrotask : typeof Ms < "u" ? function(e) {
  return Ms.resolve(null).then(e).catch(Bd);
} : Ui;
function Bd(e) {
  setTimeout(function() {
    throw e;
  });
}
function ei(e, t) {
  var n = t, r = 0;
  do {
    var l = n.nextSibling;
    if (e.removeChild(n), l && l.nodeType === 8)
      if (n = l.data, n === "/$") {
        if (r === 0) {
          e.removeChild(l), Kn(t);
          return;
        }
        r--;
      } else
        n !== "$" && n !== "$?" && n !== "$!" || r++;
    n = l;
  } while (n);
  Kn(t);
}
function gt(e) {
  for (; e != null; e = e.nextSibling) {
    var t = e.nodeType;
    if (t === 1 || t === 3)
      break;
    if (t === 8) {
      if (t = e.data, t === "$" || t === "$!" || t === "$?")
        break;
      if (t === "/$")
        return null;
    }
  }
  return e;
}
function Fs(e) {
  e = e.previousSibling;
  for (var t = 0; e; ) {
    if (e.nodeType === 8) {
      var n = e.data;
      if (n === "$" || n === "$!" || n === "$?") {
        if (t === 0)
          return e;
        t--;
      } else
        n === "/$" && t++;
    }
    e = e.previousSibling;
  }
  return null;
}
var wn = Math.random().toString(36).slice(2), He = "__reactFiber$" + wn, Zn = "__reactProps$" + wn, et = "__reactContainer$" + wn, Ai = "__reactEvents$" + wn, Vd = "__reactListeners$" + wn, Hd = "__reactHandles$" + wn;
function Lt(e) {
  var t = e[He];
  if (t)
    return t;
  for (var n = e.parentNode; n; ) {
    if (t = n[et] || n[He]) {
      if (n = t.alternate, t.child !== null || n !== null && n.child !== null)
        for (e = Fs(e); e !== null; ) {
          if (n = e[He])
            return n;
          e = Fs(e);
        }
      return t;
    }
    e = n, n = e.parentNode;
  }
  return null;
}
function sr(e) {
  return e = e[He] || e[et], !e || e.tag !== 5 && e.tag !== 6 && e.tag !== 13 && e.tag !== 3 ? null : e;
}
function Xt(e) {
  if (e.tag === 5 || e.tag === 6)
    return e.stateNode;
  throw Error(S(33));
}
function Cl(e) {
  return e[Zn] || null;
}
var Bi = [], qt = -1;
function Nt(e) {
  return { current: e };
}
function V(e) {
  0 > qt || (e.current = Bi[qt], Bi[qt] = null, qt--);
}
function A(e, t) {
  qt++, Bi[qt] = e.current, e.current = t;
}
var jt = {}, ce = Nt(jt), ye = Nt(!1), It = jt;
function fn(e, t) {
  var n = e.type.contextTypes;
  if (!n)
    return jt;
  var r = e.stateNode;
  if (r && r.__reactInternalMemoizedUnmaskedChildContext === t)
    return r.__reactInternalMemoizedMaskedChildContext;
  var l = {}, i;
  for (i in n)
    l[i] = t[i];
  return r && (e = e.stateNode, e.__reactInternalMemoizedUnmaskedChildContext = t, e.__reactInternalMemoizedMaskedChildContext = l), l;
}
function we(e) {
  return e = e.childContextTypes, e != null;
}
function tl() {
  V(ye), V(ce);
}
function Is(e, t, n) {
  if (ce.current !== jt)
    throw Error(S(168));
  A(ce, t), A(ye, n);
}
function Ou(e, t, n) {
  var r = e.stateNode;
  if (t = t.childContextTypes, typeof r.getChildContext != "function")
    return n;
  r = r.getChildContext();
  for (var l in r)
    if (!(l in t))
      throw Error(S(108, _f(e) || "Unknown", l));
  return K({}, n, r);
}
function nl(e) {
  return e = (e = e.stateNode) && e.__reactInternalMemoizedMergedChildContext || jt, It = ce.current, A(ce, e), A(ye, ye.current), !0;
}
function $s(e, t, n) {
  var r = e.stateNode;
  if (!r)
    throw Error(S(169));
  n ? (e = Ou(e, t, It), r.__reactInternalMemoizedMergedChildContext = e, V(ye), V(ce), A(ce, e)) : V(ye), A(ye, n);
}
var Ye = null, El = !1, ti = !1;
function Uu(e) {
  Ye === null ? Ye = [e] : Ye.push(e);
}
function Qd(e) {
  El = !0, Uu(e);
}
function Ct() {
  if (!ti && Ye !== null) {
    ti = !0;
    var e = 0, t = O;
    try {
      var n = Ye;
      for (O = 1; e < n.length; e++) {
        var r = n[e];
        do
          r = r(!0);
        while (r !== null);
      }
      Ye = null, El = !1;
    } catch (l) {
      throw Ye !== null && (Ye = Ye.slice(e + 1)), cu(wo, Ct), l;
    } finally {
      O = t, ti = !1;
    }
  }
  return null;
}
var Zt = [], Jt = 0, rl = null, ll = 0, Pe = [], Te = 0, $t = null, qe = 1, Ze = "";
function Tt(e, t) {
  Zt[Jt++] = ll, Zt[Jt++] = rl, rl = e, ll = t;
}
function Au(e, t, n) {
  Pe[Te++] = qe, Pe[Te++] = Ze, Pe[Te++] = $t, $t = e;
  var r = qe;
  e = Ze;
  var l = 32 - Oe(r) - 1;
  r &= ~(1 << l), n += 1;
  var i = 32 - Oe(t) + l;
  if (30 < i) {
    var o = l - l % 5;
    i = (r & (1 << o) - 1).toString(32), r >>= o, l -= o, qe = 1 << 32 - Oe(t) + l | n << l | r, Ze = i + e;
  } else
    qe = 1 << i | n << l | r, Ze = e;
}
function Po(e) {
  e.return !== null && (Tt(e, 1), Au(e, 1, 0));
}
function To(e) {
  for (; e === rl; )
    rl = Zt[--Jt], Zt[Jt] = null, ll = Zt[--Jt], Zt[Jt] = null;
  for (; e === $t; )
    $t = Pe[--Te], Pe[Te] = null, Ze = Pe[--Te], Pe[Te] = null, qe = Pe[--Te], Pe[Te] = null;
}
var ke = null, je = null, H = !1, $e = null;
function Bu(e, t) {
  var n = ze(5, null, null, 0);
  n.elementType = "DELETED", n.stateNode = t, n.return = e, t = e.deletions, t === null ? (e.deletions = [n], e.flags |= 16) : t.push(n);
}
function Os(e, t) {
  switch (e.tag) {
    case 5:
      var n = e.type;
      return t = t.nodeType !== 1 || n.toLowerCase() !== t.nodeName.toLowerCase() ? null : t, t !== null ? (e.stateNode = t, ke = e, je = gt(t.firstChild), !0) : !1;
    case 6:
      return t = e.pendingProps === "" || t.nodeType !== 3 ? null : t, t !== null ? (e.stateNode = t, ke = e, je = null, !0) : !1;
    case 13:
      return t = t.nodeType !== 8 ? null : t, t !== null ? (n = $t !== null ? { id: qe, overflow: Ze } : null, e.memoizedState = { dehydrated: t, treeContext: n, retryLane: 1073741824 }, n = ze(18, null, null, 0), n.stateNode = t, n.return = e, e.child = n, ke = e, je = null, !0) : !1;
    default:
      return !1;
  }
}
function Vi(e) {
  return (e.mode & 1) !== 0 && (e.flags & 128) === 0;
}
function Hi(e) {
  if (H) {
    var t = je;
    if (t) {
      var n = t;
      if (!Os(e, t)) {
        if (Vi(e))
          throw Error(S(418));
        t = gt(n.nextSibling);
        var r = ke;
        t && Os(e, t) ? Bu(r, n) : (e.flags = e.flags & -4097 | 2, H = !1, ke = e);
      }
    } else {
      if (Vi(e))
        throw Error(S(418));
      e.flags = e.flags & -4097 | 2, H = !1, ke = e;
    }
  }
}
function Us(e) {
  for (e = e.return; e !== null && e.tag !== 5 && e.tag !== 3 && e.tag !== 13; )
    e = e.return;
  ke = e;
}
function kr(e) {
  if (e !== ke)
    return !1;
  if (!H)
    return Us(e), H = !0, !1;
  var t;
  if ((t = e.tag !== 3) && !(t = e.tag !== 5) && (t = e.type, t = t !== "head" && t !== "body" && !Oi(e.type, e.memoizedProps)), t && (t = je)) {
    if (Vi(e))
      throw Vu(), Error(S(418));
    for (; t; )
      Bu(e, t), t = gt(t.nextSibling);
  }
  if (Us(e), e.tag === 13) {
    if (e = e.memoizedState, e = e !== null ? e.dehydrated : null, !e)
      throw Error(S(317));
    e: {
      for (e = e.nextSibling, t = 0; e; ) {
        if (e.nodeType === 8) {
          var n = e.data;
          if (n === "/$") {
            if (t === 0) {
              je = gt(e.nextSibling);
              break e;
            }
            t--;
          } else
            n !== "$" && n !== "$!" && n !== "$?" || t++;
        }
        e = e.nextSibling;
      }
      je = null;
    }
  } else
    je = ke ? gt(e.stateNode.nextSibling) : null;
  return !0;
}
function Vu() {
  for (var e = je; e; )
    e = gt(e.nextSibling);
}
function dn() {
  je = ke = null, H = !1;
}
function zo(e) {
  $e === null ? $e = [e] : $e.push(e);
}
var Wd = rt.ReactCurrentBatchConfig;
function Fe(e, t) {
  if (e && e.defaultProps) {
    t = K({}, t), e = e.defaultProps;
    for (var n in e)
      t[n] === void 0 && (t[n] = e[n]);
    return t;
  }
  return t;
}
var il = Nt(null), ol = null, bt = null, Lo = null;
function Do() {
  Lo = bt = ol = null;
}
function Ro(e) {
  var t = il.current;
  V(il), e._currentValue = t;
}
function Qi(e, t, n) {
  for (; e !== null; ) {
    var r = e.alternate;
    if ((e.childLanes & t) !== t ? (e.childLanes |= t, r !== null && (r.childLanes |= t)) : r !== null && (r.childLanes & t) !== t && (r.childLanes |= t), e === n)
      break;
    e = e.return;
  }
}
function sn(e, t) {
  ol = e, Lo = bt = null, e = e.dependencies, e !== null && e.firstContext !== null && (e.lanes & t && (ve = !0), e.firstContext = null);
}
function De(e) {
  var t = e._currentValue;
  if (Lo !== e)
    if (e = { context: e, memoizedValue: t, next: null }, bt === null) {
      if (ol === null)
        throw Error(S(308));
      bt = e, ol.dependencies = { lanes: 0, firstContext: e };
    } else
      bt = bt.next = e;
  return t;
}
var Dt = null;
function Mo(e) {
  Dt === null ? Dt = [e] : Dt.push(e);
}
function Hu(e, t, n, r) {
  var l = t.interleaved;
  return l === null ? (n.next = n, Mo(t)) : (n.next = l.next, l.next = n), t.interleaved = n, tt(e, r);
}
function tt(e, t) {
  e.lanes |= t;
  var n = e.alternate;
  for (n !== null && (n.lanes |= t), n = e, e = e.return; e !== null; )
    e.childLanes |= t, n = e.alternate, n !== null && (n.childLanes |= t), n = e, e = e.return;
  return n.tag === 3 ? n.stateNode : null;
}
var at = !1;
function Fo(e) {
  e.updateQueue = { baseState: e.memoizedState, firstBaseUpdate: null, lastBaseUpdate: null, shared: { pending: null, interleaved: null, lanes: 0 }, effects: null };
}
function Qu(e, t) {
  e = e.updateQueue, t.updateQueue === e && (t.updateQueue = { baseState: e.baseState, firstBaseUpdate: e.firstBaseUpdate, lastBaseUpdate: e.lastBaseUpdate, shared: e.shared, effects: e.effects });
}
function Je(e, t) {
  return { eventTime: e, lane: t, tag: 0, payload: null, callback: null, next: null };
}
function vt(e, t, n) {
  var r = e.updateQueue;
  if (r === null)
    return null;
  if (r = r.shared, I & 2) {
    var l = r.pending;
    return l === null ? t.next = t : (t.next = l.next, l.next = t), r.pending = t, tt(e, n);
  }
  return l = r.interleaved, l === null ? (t.next = t, Mo(r)) : (t.next = l.next, l.next = t), r.interleaved = t, tt(e, n);
}
function Or(e, t, n) {
  if (t = t.updateQueue, t !== null && (t = t.shared, (n & 4194240) !== 0)) {
    var r = t.lanes;
    r &= e.pendingLanes, n |= r, t.lanes = n, xo(e, n);
  }
}
function As(e, t) {
  var n = e.updateQueue, r = e.alternate;
  if (r !== null && (r = r.updateQueue, n === r)) {
    var l = null, i = null;
    if (n = n.firstBaseUpdate, n !== null) {
      do {
        var o = { eventTime: n.eventTime, lane: n.lane, tag: n.tag, payload: n.payload, callback: n.callback, next: null };
        i === null ? l = i = o : i = i.next = o, n = n.next;
      } while (n !== null);
      i === null ? l = i = t : i = i.next = t;
    } else
      l = i = t;
    n = { baseState: r.baseState, firstBaseUpdate: l, lastBaseUpdate: i, shared: r.shared, effects: r.effects }, e.updateQueue = n;
    return;
  }
  e = n.lastBaseUpdate, e === null ? n.firstBaseUpdate = t : e.next = t, n.lastBaseUpdate = t;
}
function sl(e, t, n, r) {
  var l = e.updateQueue;
  at = !1;
  var i = l.firstBaseUpdate, o = l.lastBaseUpdate, a = l.shared.pending;
  if (a !== null) {
    l.shared.pending = null;
    var u = a, c = u.next;
    u.next = null, o === null ? i = c : o.next = c, o = u;
    var p = e.alternate;
    p !== null && (p = p.updateQueue, a = p.lastBaseUpdate, a !== o && (a === null ? p.firstBaseUpdate = c : a.next = c, p.lastBaseUpdate = u));
  }
  if (i !== null) {
    var g = l.baseState;
    o = 0, p = c = u = null, a = i;
    do {
      var h = a.lane, y = a.eventTime;
      if ((r & h) === h) {
        p !== null && (p = p.next = {
          eventTime: y,
          lane: 0,
          tag: a.tag,
          payload: a.payload,
          callback: a.callback,
          next: null
        });
        e: {
          var v = e, w = a;
          switch (h = t, y = n, w.tag) {
            case 1:
              if (v = w.payload, typeof v == "function") {
                g = v.call(y, g, h);
                break e;
              }
              g = v;
              break e;
            case 3:
              v.flags = v.flags & -65537 | 128;
            case 0:
              if (v = w.payload, h = typeof v == "function" ? v.call(y, g, h) : v, h == null)
                break e;
              g = K({}, g, h);
              break e;
            case 2:
              at = !0;
          }
        }
        a.callback !== null && a.lane !== 0 && (e.flags |= 64, h = l.effects, h === null ? l.effects = [a] : h.push(a));
      } else
        y = { eventTime: y, lane: h, tag: a.tag, payload: a.payload, callback: a.callback, next: null }, p === null ? (c = p = y, u = g) : p = p.next = y, o |= h;
      if (a = a.next, a === null) {
        if (a = l.shared.pending, a === null)
          break;
        h = a, a = h.next, h.next = null, l.lastBaseUpdate = h, l.shared.pending = null;
      }
    } while (!0);
    if (p === null && (u = g), l.baseState = u, l.firstBaseUpdate = c, l.lastBaseUpdate = p, t = l.shared.interleaved, t !== null) {
      l = t;
      do
        o |= l.lane, l = l.next;
      while (l !== t);
    } else
      i === null && (l.shared.lanes = 0);
    Ut |= o, e.lanes = o, e.memoizedState = g;
  }
}
function Bs(e, t, n) {
  if (e = t.effects, t.effects = null, e !== null)
    for (t = 0; t < e.length; t++) {
      var r = e[t], l = r.callback;
      if (l !== null) {
        if (r.callback = null, r = n, typeof l != "function")
          throw Error(S(191, l));
        l.call(r);
      }
    }
}
var Wu = new Ha.Component().refs;
function Wi(e, t, n, r) {
  t = e.memoizedState, n = n(r, t), n = n == null ? t : K({}, t, n), e.memoizedState = n, e.lanes === 0 && (e.updateQueue.baseState = n);
}
var _l = { isMounted: function(e) {
  return (e = e._reactInternals) ? Vt(e) === e : !1;
}, enqueueSetState: function(e, t, n) {
  e = e._reactInternals;
  var r = de(), l = wt(e), i = Je(r, l);
  i.payload = t, n != null && (i.callback = n), t = vt(e, i, l), t !== null && (Ue(t, e, l, r), Or(t, e, l));
}, enqueueReplaceState: function(e, t, n) {
  e = e._reactInternals;
  var r = de(), l = wt(e), i = Je(r, l);
  i.tag = 1, i.payload = t, n != null && (i.callback = n), t = vt(e, i, l), t !== null && (Ue(t, e, l, r), Or(t, e, l));
}, enqueueForceUpdate: function(e, t) {
  e = e._reactInternals;
  var n = de(), r = wt(e), l = Je(n, r);
  l.tag = 2, t != null && (l.callback = t), t = vt(e, l, r), t !== null && (Ue(t, e, r, n), Or(t, e, r));
} };
function Vs(e, t, n, r, l, i, o) {
  return e = e.stateNode, typeof e.shouldComponentUpdate == "function" ? e.shouldComponentUpdate(r, i, o) : t.prototype && t.prototype.isPureReactComponent ? !Yn(n, r) || !Yn(l, i) : !0;
}
function Ku(e, t, n) {
  var r = !1, l = jt, i = t.contextType;
  return typeof i == "object" && i !== null ? i = De(i) : (l = we(t) ? It : ce.current, r = t.contextTypes, i = (r = r != null) ? fn(e, l) : jt), t = new t(n, i), e.memoizedState = t.state !== null && t.state !== void 0 ? t.state : null, t.updater = _l, e.stateNode = t, t._reactInternals = e, r && (e = e.stateNode, e.__reactInternalMemoizedUnmaskedChildContext = l, e.__reactInternalMemoizedMaskedChildContext = i), t;
}
function Hs(e, t, n, r) {
  e = t.state, typeof t.componentWillReceiveProps == "function" && t.componentWillReceiveProps(n, r), typeof t.UNSAFE_componentWillReceiveProps == "function" && t.UNSAFE_componentWillReceiveProps(n, r), t.state !== e && _l.enqueueReplaceState(t, t.state, null);
}
function Ki(e, t, n, r) {
  var l = e.stateNode;
  l.props = n, l.state = e.memoizedState, l.refs = Wu, Fo(e);
  var i = t.contextType;
  typeof i == "object" && i !== null ? l.context = De(i) : (i = we(t) ? It : ce.current, l.context = fn(e, i)), l.state = e.memoizedState, i = t.getDerivedStateFromProps, typeof i == "function" && (Wi(e, t, i, n), l.state = e.memoizedState), typeof t.getDerivedStateFromProps == "function" || typeof l.getSnapshotBeforeUpdate == "function" || typeof l.UNSAFE_componentWillMount != "function" && typeof l.componentWillMount != "function" || (t = l.state, typeof l.componentWillMount == "function" && l.componentWillMount(), typeof l.UNSAFE_componentWillMount == "function" && l.UNSAFE_componentWillMount(), t !== l.state && _l.enqueueReplaceState(l, l.state, null), sl(e, n, l, r), l.state = e.memoizedState), typeof l.componentDidMount == "function" && (e.flags |= 4194308);
}
function Cn(e, t, n) {
  if (e = n.ref, e !== null && typeof e != "function" && typeof e != "object") {
    if (n._owner) {
      if (n = n._owner, n) {
        if (n.tag !== 1)
          throw Error(S(309));
        var r = n.stateNode;
      }
      if (!r)
        throw Error(S(147, e));
      var l = r, i = "" + e;
      return t !== null && t.ref !== null && typeof t.ref == "function" && t.ref._stringRef === i ? t.ref : (t = function(o) {
        var a = l.refs;
        a === Wu && (a = l.refs = {}), o === null ? delete a[i] : a[i] = o;
      }, t._stringRef = i, t);
    }
    if (typeof e != "string")
      throw Error(S(284));
    if (!n._owner)
      throw Error(S(290, e));
  }
  return e;
}
function Nr(e, t) {
  throw e = Object.prototype.toString.call(t), Error(S(31, e === "[object Object]" ? "object with keys {" + Object.keys(t).join(", ") + "}" : e));
}
function Qs(e) {
  var t = e._init;
  return t(e._payload);
}
function Gu(e) {
  function t(d, f) {
    if (e) {
      var m = d.deletions;
      m === null ? (d.deletions = [f], d.flags |= 16) : m.push(f);
    }
  }
  function n(d, f) {
    if (!e)
      return null;
    for (; f !== null; )
      t(d, f), f = f.sibling;
    return null;
  }
  function r(d, f) {
    for (d = /* @__PURE__ */ new Map(); f !== null; )
      f.key !== null ? d.set(f.key, f) : d.set(f.index, f), f = f.sibling;
    return d;
  }
  function l(d, f) {
    return d = xt(d, f), d.index = 0, d.sibling = null, d;
  }
  function i(d, f, m) {
    return d.index = m, e ? (m = d.alternate, m !== null ? (m = m.index, m < f ? (d.flags |= 2, f) : m) : (d.flags |= 2, f)) : (d.flags |= 1048576, f);
  }
  function o(d) {
    return e && d.alternate === null && (d.flags |= 2), d;
  }
  function a(d, f, m, x) {
    return f === null || f.tag !== 6 ? (f = ai(m, d.mode, x), f.return = d, f) : (f = l(f, m), f.return = d, f);
  }
  function u(d, f, m, x) {
    var j = m.type;
    return j === Wt ? p(d, f, m.props.children, x, m.key) : f !== null && (f.elementType === j || typeof j == "object" && j !== null && j.$$typeof === st && Qs(j) === f.type) ? (x = l(f, m.props), x.ref = Cn(d, f, m), x.return = d, x) : (x = Qr(m.type, m.key, m.props, null, d.mode, x), x.ref = Cn(d, f, m), x.return = d, x);
  }
  function c(d, f, m, x) {
    return f === null || f.tag !== 4 || f.stateNode.containerInfo !== m.containerInfo || f.stateNode.implementation !== m.implementation ? (f = ui(m, d.mode, x), f.return = d, f) : (f = l(f, m.children || []), f.return = d, f);
  }
  function p(d, f, m, x, j) {
    return f === null || f.tag !== 7 ? (f = Ft(m, d.mode, x, j), f.return = d, f) : (f = l(f, m), f.return = d, f);
  }
  function g(d, f, m) {
    if (typeof f == "string" && f !== "" || typeof f == "number")
      return f = ai("" + f, d.mode, m), f.return = d, f;
    if (typeof f == "object" && f !== null) {
      switch (f.$$typeof) {
        case pr:
          return m = Qr(f.type, f.key, f.props, null, d.mode, m), m.ref = Cn(d, null, f), m.return = d, m;
        case Qt:
          return f = ui(f, d.mode, m), f.return = d, f;
        case st:
          var x = f._init;
          return g(d, x(f._payload), m);
      }
      if (Tn(f) || xn(f))
        return f = Ft(f, d.mode, m, null), f.return = d, f;
      Nr(d, f);
    }
    return null;
  }
  function h(d, f, m, x) {
    var j = f !== null ? f.key : null;
    if (typeof m == "string" && m !== "" || typeof m == "number")
      return j !== null ? null : a(d, f, "" + m, x);
    if (typeof m == "object" && m !== null) {
      switch (m.$$typeof) {
        case pr:
          return m.key === j ? u(d, f, m, x) : null;
        case Qt:
          return m.key === j ? c(d, f, m, x) : null;
        case st:
          return j = m._init, h(
            d,
            f,
            j(m._payload),
            x
          );
      }
      if (Tn(m) || xn(m))
        return j !== null ? null : p(d, f, m, x, null);
      Nr(d, m);
    }
    return null;
  }
  function y(d, f, m, x, j) {
    if (typeof x == "string" && x !== "" || typeof x == "number")
      return d = d.get(m) || null, a(f, d, "" + x, j);
    if (typeof x == "object" && x !== null) {
      switch (x.$$typeof) {
        case pr:
          return d = d.get(x.key === null ? m : x.key) || null, u(f, d, x, j);
        case Qt:
          return d = d.get(x.key === null ? m : x.key) || null, c(f, d, x, j);
        case st:
          var N = x._init;
          return y(d, f, m, N(x._payload), j);
      }
      if (Tn(x) || xn(x))
        return d = d.get(m) || null, p(f, d, x, j, null);
      Nr(f, x);
    }
    return null;
  }
  function v(d, f, m, x) {
    for (var j = null, N = null, C = f, _ = f = 0, U = null; C !== null && _ < m.length; _++) {
      C.index > _ ? (U = C, C = null) : U = C.sibling;
      var D = h(d, C, m[_], x);
      if (D === null) {
        C === null && (C = U);
        break;
      }
      e && C && D.alternate === null && t(d, C), f = i(D, f, _), N === null ? j = D : N.sibling = D, N = D, C = U;
    }
    if (_ === m.length)
      return n(d, C), H && Tt(d, _), j;
    if (C === null) {
      for (; _ < m.length; _++)
        C = g(d, m[_], x), C !== null && (f = i(C, f, _), N === null ? j = C : N.sibling = C, N = C);
      return H && Tt(d, _), j;
    }
    for (C = r(d, C); _ < m.length; _++)
      U = y(C, d, _, m[_], x), U !== null && (e && U.alternate !== null && C.delete(U.key === null ? _ : U.key), f = i(U, f, _), N === null ? j = U : N.sibling = U, N = U);
    return e && C.forEach(function(re) {
      return t(d, re);
    }), H && Tt(d, _), j;
  }
  function w(d, f, m, x) {
    var j = xn(m);
    if (typeof j != "function")
      throw Error(S(150));
    if (m = j.call(m), m == null)
      throw Error(S(151));
    for (var N = j = null, C = f, _ = f = 0, U = null, D = m.next(); C !== null && !D.done; _++, D = m.next()) {
      C.index > _ ? (U = C, C = null) : U = C.sibling;
      var re = h(d, C, D.value, x);
      if (re === null) {
        C === null && (C = U);
        break;
      }
      e && C && re.alternate === null && t(d, C), f = i(re, f, _), N === null ? j = re : N.sibling = re, N = re, C = U;
    }
    if (D.done)
      return n(
        d,
        C
      ), H && Tt(d, _), j;
    if (C === null) {
      for (; !D.done; _++, D = m.next())
        D = g(d, D.value, x), D !== null && (f = i(D, f, _), N === null ? j = D : N.sibling = D, N = D);
      return H && Tt(d, _), j;
    }
    for (C = r(d, C); !D.done; _++, D = m.next())
      D = y(C, d, _, D.value, x), D !== null && (e && D.alternate !== null && C.delete(D.key === null ? _ : D.key), f = i(D, f, _), N === null ? j = D : N.sibling = D, N = D);
    return e && C.forEach(function($) {
      return t(d, $);
    }), H && Tt(d, _), j;
  }
  function z(d, f, m, x) {
    if (typeof m == "object" && m !== null && m.type === Wt && m.key === null && (m = m.props.children), typeof m == "object" && m !== null) {
      switch (m.$$typeof) {
        case pr:
          e: {
            for (var j = m.key, N = f; N !== null; ) {
              if (N.key === j) {
                if (j = m.type, j === Wt) {
                  if (N.tag === 7) {
                    n(d, N.sibling), f = l(N, m.props.children), f.return = d, d = f;
                    break e;
                  }
                } else if (N.elementType === j || typeof j == "object" && j !== null && j.$$typeof === st && Qs(j) === N.type) {
                  n(d, N.sibling), f = l(N, m.props), f.ref = Cn(d, N, m), f.return = d, d = f;
                  break e;
                }
                n(d, N);
                break;
              } else
                t(d, N);
              N = N.sibling;
            }
            m.type === Wt ? (f = Ft(m.props.children, d.mode, x, m.key), f.return = d, d = f) : (x = Qr(m.type, m.key, m.props, null, d.mode, x), x.ref = Cn(d, f, m), x.return = d, d = x);
          }
          return o(d);
        case Qt:
          e: {
            for (N = m.key; f !== null; ) {
              if (f.key === N)
                if (f.tag === 4 && f.stateNode.containerInfo === m.containerInfo && f.stateNode.implementation === m.implementation) {
                  n(d, f.sibling), f = l(f, m.children || []), f.return = d, d = f;
                  break e;
                } else {
                  n(d, f);
                  break;
                }
              else
                t(d, f);
              f = f.sibling;
            }
            f = ui(m, d.mode, x), f.return = d, d = f;
          }
          return o(d);
        case st:
          return N = m._init, z(d, f, N(m._payload), x);
      }
      if (Tn(m))
        return v(d, f, m, x);
      if (xn(m))
        return w(d, f, m, x);
      Nr(d, m);
    }
    return typeof m == "string" && m !== "" || typeof m == "number" ? (m = "" + m, f !== null && f.tag === 6 ? (n(d, f.sibling), f = l(f, m), f.return = d, d = f) : (n(d, f), f = ai(m, d.mode, x), f.return = d, d = f), o(d)) : n(d, f);
  }
  return z;
}
var pn = Gu(!0), Yu = Gu(!1), ar = {}, We = Nt(ar), Jn = Nt(ar), bn = Nt(ar);
function Rt(e) {
  if (e === ar)
    throw Error(S(174));
  return e;
}
function Io(e, t) {
  switch (A(bn, t), A(Jn, e), A(We, ar), e = t.nodeType, e) {
    case 9:
    case 11:
      t = (t = t.documentElement) ? t.namespaceURI : Ni(null, "");
      break;
    default:
      e = e === 8 ? t.parentNode : t, t = e.namespaceURI || null, e = e.tagName, t = Ni(t, e);
  }
  V(We), A(We, t);
}
function mn() {
  V(We), V(Jn), V(bn);
}
function Xu(e) {
  Rt(bn.current);
  var t = Rt(We.current), n = Ni(t, e.type);
  t !== n && (A(Jn, e), A(We, n));
}
function $o(e) {
  Jn.current === e && (V(We), V(Jn));
}
var Q = Nt(0);
function al(e) {
  for (var t = e; t !== null; ) {
    if (t.tag === 13) {
      var n = t.memoizedState;
      if (n !== null && (n = n.dehydrated, n === null || n.data === "$?" || n.data === "$!"))
        return t;
    } else if (t.tag === 19 && t.memoizedProps.revealOrder !== void 0) {
      if (t.flags & 128)
        return t;
    } else if (t.child !== null) {
      t.child.return = t, t = t.child;
      continue;
    }
    if (t === e)
      break;
    for (; t.sibling === null; ) {
      if (t.return === null || t.return === e)
        return null;
      t = t.return;
    }
    t.sibling.return = t.return, t = t.sibling;
  }
  return null;
}
var ni = [];
function Oo() {
  for (var e = 0; e < ni.length; e++)
    ni[e]._workInProgressVersionPrimary = null;
  ni.length = 0;
}
var Ur = rt.ReactCurrentDispatcher, ri = rt.ReactCurrentBatchConfig, Ot = 0, W = null, J = null, te = null, ul = !1, $n = !1, er = 0, Kd = 0;
function se() {
  throw Error(S(321));
}
function Uo(e, t) {
  if (t === null)
    return !1;
  for (var n = 0; n < t.length && n < e.length; n++)
    if (!Ae(e[n], t[n]))
      return !1;
  return !0;
}
function Ao(e, t, n, r, l, i) {
  if (Ot = i, W = t, t.memoizedState = null, t.updateQueue = null, t.lanes = 0, Ur.current = e === null || e.memoizedState === null ? qd : Zd, e = n(r, l), $n) {
    i = 0;
    do {
      if ($n = !1, er = 0, 25 <= i)
        throw Error(S(301));
      i += 1, te = J = null, t.updateQueue = null, Ur.current = Jd, e = n(r, l);
    } while ($n);
  }
  if (Ur.current = cl, t = J !== null && J.next !== null, Ot = 0, te = J = W = null, ul = !1, t)
    throw Error(S(300));
  return e;
}
function Bo() {
  var e = er !== 0;
  return er = 0, e;
}
function Ve() {
  var e = { memoizedState: null, baseState: null, baseQueue: null, queue: null, next: null };
  return te === null ? W.memoizedState = te = e : te = te.next = e, te;
}
function Re() {
  if (J === null) {
    var e = W.alternate;
    e = e !== null ? e.memoizedState : null;
  } else
    e = J.next;
  var t = te === null ? W.memoizedState : te.next;
  if (t !== null)
    te = t, J = e;
  else {
    if (e === null)
      throw Error(S(310));
    J = e, e = { memoizedState: J.memoizedState, baseState: J.baseState, baseQueue: J.baseQueue, queue: J.queue, next: null }, te === null ? W.memoizedState = te = e : te = te.next = e;
  }
  return te;
}
function tr(e, t) {
  return typeof t == "function" ? t(e) : t;
}
function li(e) {
  var t = Re(), n = t.queue;
  if (n === null)
    throw Error(S(311));
  n.lastRenderedReducer = e;
  var r = J, l = r.baseQueue, i = n.pending;
  if (i !== null) {
    if (l !== null) {
      var o = l.next;
      l.next = i.next, i.next = o;
    }
    r.baseQueue = l = i, n.pending = null;
  }
  if (l !== null) {
    i = l.next, r = r.baseState;
    var a = o = null, u = null, c = i;
    do {
      var p = c.lane;
      if ((Ot & p) === p)
        u !== null && (u = u.next = { lane: 0, action: c.action, hasEagerState: c.hasEagerState, eagerState: c.eagerState, next: null }), r = c.hasEagerState ? c.eagerState : e(r, c.action);
      else {
        var g = {
          lane: p,
          action: c.action,
          hasEagerState: c.hasEagerState,
          eagerState: c.eagerState,
          next: null
        };
        u === null ? (a = u = g, o = r) : u = u.next = g, W.lanes |= p, Ut |= p;
      }
      c = c.next;
    } while (c !== null && c !== i);
    u === null ? o = r : u.next = a, Ae(r, t.memoizedState) || (ve = !0), t.memoizedState = r, t.baseState = o, t.baseQueue = u, n.lastRenderedState = r;
  }
  if (e = n.interleaved, e !== null) {
    l = e;
    do
      i = l.lane, W.lanes |= i, Ut |= i, l = l.next;
    while (l !== e);
  } else
    l === null && (n.lanes = 0);
  return [t.memoizedState, n.dispatch];
}
function ii(e) {
  var t = Re(), n = t.queue;
  if (n === null)
    throw Error(S(311));
  n.lastRenderedReducer = e;
  var r = n.dispatch, l = n.pending, i = t.memoizedState;
  if (l !== null) {
    n.pending = null;
    var o = l = l.next;
    do
      i = e(i, o.action), o = o.next;
    while (o !== l);
    Ae(i, t.memoizedState) || (ve = !0), t.memoizedState = i, t.baseQueue === null && (t.baseState = i), n.lastRenderedState = i;
  }
  return [i, r];
}
function qu() {
}
function Zu(e, t) {
  var n = W, r = Re(), l = t(), i = !Ae(r.memoizedState, l);
  if (i && (r.memoizedState = l, ve = !0), r = r.queue, Vo(ec.bind(null, n, r, e), [e]), r.getSnapshot !== t || i || te !== null && te.memoizedState.tag & 1) {
    if (n.flags |= 2048, nr(9, bu.bind(null, n, r, l, t), void 0, null), ne === null)
      throw Error(S(349));
    Ot & 30 || Ju(n, t, l);
  }
  return l;
}
function Ju(e, t, n) {
  e.flags |= 16384, e = { getSnapshot: t, value: n }, t = W.updateQueue, t === null ? (t = { lastEffect: null, stores: null }, W.updateQueue = t, t.stores = [e]) : (n = t.stores, n === null ? t.stores = [e] : n.push(e));
}
function bu(e, t, n, r) {
  t.value = n, t.getSnapshot = r, tc(t) && nc(e);
}
function ec(e, t, n) {
  return n(function() {
    tc(t) && nc(e);
  });
}
function tc(e) {
  var t = e.getSnapshot;
  e = e.value;
  try {
    var n = t();
    return !Ae(e, n);
  } catch {
    return !0;
  }
}
function nc(e) {
  var t = tt(e, 1);
  t !== null && Ue(t, e, 1, -1);
}
function Ws(e) {
  var t = Ve();
  return typeof e == "function" && (e = e()), t.memoizedState = t.baseState = e, e = { pending: null, interleaved: null, lanes: 0, dispatch: null, lastRenderedReducer: tr, lastRenderedState: e }, t.queue = e, e = e.dispatch = Xd.bind(null, W, e), [t.memoizedState, e];
}
function nr(e, t, n, r) {
  return e = { tag: e, create: t, destroy: n, deps: r, next: null }, t = W.updateQueue, t === null ? (t = { lastEffect: null, stores: null }, W.updateQueue = t, t.lastEffect = e.next = e) : (n = t.lastEffect, n === null ? t.lastEffect = e.next = e : (r = n.next, n.next = e, e.next = r, t.lastEffect = e)), e;
}
function rc() {
  return Re().memoizedState;
}
function Ar(e, t, n, r) {
  var l = Ve();
  W.flags |= e, l.memoizedState = nr(1 | t, n, void 0, r === void 0 ? null : r);
}
function Pl(e, t, n, r) {
  var l = Re();
  r = r === void 0 ? null : r;
  var i = void 0;
  if (J !== null) {
    var o = J.memoizedState;
    if (i = o.destroy, r !== null && Uo(r, o.deps)) {
      l.memoizedState = nr(t, n, i, r);
      return;
    }
  }
  W.flags |= e, l.memoizedState = nr(1 | t, n, i, r);
}
function Ks(e, t) {
  return Ar(8390656, 8, e, t);
}
function Vo(e, t) {
  return Pl(2048, 8, e, t);
}
function lc(e, t) {
  return Pl(4, 2, e, t);
}
function ic(e, t) {
  return Pl(4, 4, e, t);
}
function oc(e, t) {
  if (typeof t == "function")
    return e = e(), t(e), function() {
      t(null);
    };
  if (t != null)
    return e = e(), t.current = e, function() {
      t.current = null;
    };
}
function sc(e, t, n) {
  return n = n != null ? n.concat([e]) : null, Pl(4, 4, oc.bind(null, t, e), n);
}
function Ho() {
}
function ac(e, t) {
  var n = Re();
  t = t === void 0 ? null : t;
  var r = n.memoizedState;
  return r !== null && t !== null && Uo(t, r[1]) ? r[0] : (n.memoizedState = [e, t], e);
}
function uc(e, t) {
  var n = Re();
  t = t === void 0 ? null : t;
  var r = n.memoizedState;
  return r !== null && t !== null && Uo(t, r[1]) ? r[0] : (e = e(), n.memoizedState = [e, t], e);
}
function cc(e, t, n) {
  return Ot & 21 ? (Ae(n, t) || (n = pu(), W.lanes |= n, Ut |= n, e.baseState = !0), t) : (e.baseState && (e.baseState = !1, ve = !0), e.memoizedState = n);
}
function Gd(e, t) {
  var n = O;
  O = n !== 0 && 4 > n ? n : 4, e(!0);
  var r = ri.transition;
  ri.transition = {};
  try {
    e(!1), t();
  } finally {
    O = n, ri.transition = r;
  }
}
function fc() {
  return Re().memoizedState;
}
function Yd(e, t, n) {
  var r = wt(e);
  if (n = { lane: r, action: n, hasEagerState: !1, eagerState: null, next: null }, dc(e))
    pc(t, n);
  else if (n = Hu(e, t, n, r), n !== null) {
    var l = de();
    Ue(n, e, r, l), mc(n, t, r);
  }
}
function Xd(e, t, n) {
  var r = wt(e), l = { lane: r, action: n, hasEagerState: !1, eagerState: null, next: null };
  if (dc(e))
    pc(t, l);
  else {
    var i = e.alternate;
    if (e.lanes === 0 && (i === null || i.lanes === 0) && (i = t.lastRenderedReducer, i !== null))
      try {
        var o = t.lastRenderedState, a = i(o, n);
        if (l.hasEagerState = !0, l.eagerState = a, Ae(a, o)) {
          var u = t.interleaved;
          u === null ? (l.next = l, Mo(t)) : (l.next = u.next, u.next = l), t.interleaved = l;
          return;
        }
      } catch {
      } finally {
      }
    n = Hu(e, t, l, r), n !== null && (l = de(), Ue(n, e, r, l), mc(n, t, r));
  }
}
function dc(e) {
  var t = e.alternate;
  return e === W || t !== null && t === W;
}
function pc(e, t) {
  $n = ul = !0;
  var n = e.pending;
  n === null ? t.next = t : (t.next = n.next, n.next = t), e.pending = t;
}
function mc(e, t, n) {
  if (n & 4194240) {
    var r = t.lanes;
    r &= e.pendingLanes, n |= r, t.lanes = n, xo(e, n);
  }
}
var cl = { readContext: De, useCallback: se, useContext: se, useEffect: se, useImperativeHandle: se, useInsertionEffect: se, useLayoutEffect: se, useMemo: se, useReducer: se, useRef: se, useState: se, useDebugValue: se, useDeferredValue: se, useTransition: se, useMutableSource: se, useSyncExternalStore: se, useId: se, unstable_isNewReconciler: !1 }, qd = { readContext: De, useCallback: function(e, t) {
  return Ve().memoizedState = [e, t === void 0 ? null : t], e;
}, useContext: De, useEffect: Ks, useImperativeHandle: function(e, t, n) {
  return n = n != null ? n.concat([e]) : null, Ar(
    4194308,
    4,
    oc.bind(null, t, e),
    n
  );
}, useLayoutEffect: function(e, t) {
  return Ar(4194308, 4, e, t);
}, useInsertionEffect: function(e, t) {
  return Ar(4, 2, e, t);
}, useMemo: function(e, t) {
  var n = Ve();
  return t = t === void 0 ? null : t, e = e(), n.memoizedState = [e, t], e;
}, useReducer: function(e, t, n) {
  var r = Ve();
  return t = n !== void 0 ? n(t) : t, r.memoizedState = r.baseState = t, e = { pending: null, interleaved: null, lanes: 0, dispatch: null, lastRenderedReducer: e, lastRenderedState: t }, r.queue = e, e = e.dispatch = Yd.bind(null, W, e), [r.memoizedState, e];
}, useRef: function(e) {
  var t = Ve();
  return e = { current: e }, t.memoizedState = e;
}, useState: Ws, useDebugValue: Ho, useDeferredValue: function(e) {
  return Ve().memoizedState = e;
}, useTransition: function() {
  var e = Ws(!1), t = e[0];
  return e = Gd.bind(null, e[1]), Ve().memoizedState = e, [t, e];
}, useMutableSource: function() {
}, useSyncExternalStore: function(e, t, n) {
  var r = W, l = Ve();
  if (H) {
    if (n === void 0)
      throw Error(S(407));
    n = n();
  } else {
    if (n = t(), ne === null)
      throw Error(S(349));
    Ot & 30 || Ju(r, t, n);
  }
  l.memoizedState = n;
  var i = { value: n, getSnapshot: t };
  return l.queue = i, Ks(ec.bind(
    null,
    r,
    i,
    e
  ), [e]), r.flags |= 2048, nr(9, bu.bind(null, r, i, n, t), void 0, null), n;
}, useId: function() {
  var e = Ve(), t = ne.identifierPrefix;
  if (H) {
    var n = Ze, r = qe;
    n = (r & ~(1 << 32 - Oe(r) - 1)).toString(32) + n, t = ":" + t + "R" + n, n = er++, 0 < n && (t += "H" + n.toString(32)), t += ":";
  } else
    n = Kd++, t = ":" + t + "r" + n.toString(32) + ":";
  return e.memoizedState = t;
}, unstable_isNewReconciler: !1 }, Zd = {
  readContext: De,
  useCallback: ac,
  useContext: De,
  useEffect: Vo,
  useImperativeHandle: sc,
  useInsertionEffect: lc,
  useLayoutEffect: ic,
  useMemo: uc,
  useReducer: li,
  useRef: rc,
  useState: function() {
    return li(tr);
  },
  useDebugValue: Ho,
  useDeferredValue: function(e) {
    var t = Re();
    return cc(t, J.memoizedState, e);
  },
  useTransition: function() {
    var e = li(tr)[0], t = Re().memoizedState;
    return [e, t];
  },
  useMutableSource: qu,
  useSyncExternalStore: Zu,
  useId: fc,
  unstable_isNewReconciler: !1
}, Jd = { readContext: De, useCallback: ac, useContext: De, useEffect: Vo, useImperativeHandle: sc, useInsertionEffect: lc, useLayoutEffect: ic, useMemo: uc, useReducer: ii, useRef: rc, useState: function() {
  return ii(tr);
}, useDebugValue: Ho, useDeferredValue: function(e) {
  var t = Re();
  return J === null ? t.memoizedState = e : cc(t, J.memoizedState, e);
}, useTransition: function() {
  var e = ii(tr)[0], t = Re().memoizedState;
  return [e, t];
}, useMutableSource: qu, useSyncExternalStore: Zu, useId: fc, unstable_isNewReconciler: !1 };
function hn(e, t) {
  try {
    var n = "", r = t;
    do
      n += Ef(r), r = r.return;
    while (r);
    var l = n;
  } catch (i) {
    l = `
Error generating stack: ` + i.message + `
` + i.stack;
  }
  return { value: e, source: t, stack: l, digest: null };
}
function oi(e, t, n) {
  return { value: e, source: null, stack: n ?? null, digest: t ?? null };
}
function Gi(e, t) {
  try {
    console.error(t.value);
  } catch (n) {
    setTimeout(function() {
      throw n;
    });
  }
}
var bd = typeof WeakMap == "function" ? WeakMap : Map;
function hc(e, t, n) {
  n = Je(-1, n), n.tag = 3, n.payload = { element: null };
  var r = t.value;
  return n.callback = function() {
    dl || (dl = !0, ro = r), Gi(e, t);
  }, n;
}
function gc(e, t, n) {
  n = Je(-1, n), n.tag = 3;
  var r = e.type.getDerivedStateFromError;
  if (typeof r == "function") {
    var l = t.value;
    n.payload = function() {
      return r(l);
    }, n.callback = function() {
      Gi(e, t);
    };
  }
  var i = e.stateNode;
  return i !== null && typeof i.componentDidCatch == "function" && (n.callback = function() {
    Gi(e, t), typeof r != "function" && (yt === null ? yt = /* @__PURE__ */ new Set([this]) : yt.add(this));
    var o = t.stack;
    this.componentDidCatch(t.value, { componentStack: o !== null ? o : "" });
  }), n;
}
function Gs(e, t, n) {
  var r = e.pingCache;
  if (r === null) {
    r = e.pingCache = new bd();
    var l = /* @__PURE__ */ new Set();
    r.set(t, l);
  } else
    l = r.get(t), l === void 0 && (l = /* @__PURE__ */ new Set(), r.set(t, l));
  l.has(n) || (l.add(n), e = pp.bind(null, e, t, n), t.then(e, e));
}
function Ys(e) {
  do {
    var t;
    if ((t = e.tag === 13) && (t = e.memoizedState, t = t !== null ? t.dehydrated !== null : !0), t)
      return e;
    e = e.return;
  } while (e !== null);
  return null;
}
function Xs(e, t, n, r, l) {
  return e.mode & 1 ? (e.flags |= 65536, e.lanes = l, e) : (e === t ? e.flags |= 65536 : (e.flags |= 128, n.flags |= 131072, n.flags &= -52805, n.tag === 1 && (n.alternate === null ? n.tag = 17 : (t = Je(-1, 1), t.tag = 2, vt(n, t, 1))), n.lanes |= 1), e);
}
var ep = rt.ReactCurrentOwner, ve = !1;
function fe(e, t, n, r) {
  t.child = e === null ? Yu(t, null, n, r) : pn(t, e.child, n, r);
}
function qs(e, t, n, r, l) {
  n = n.render;
  var i = t.ref;
  return sn(t, l), r = Ao(e, t, n, r, i, l), n = Bo(), e !== null && !ve ? (t.updateQueue = e.updateQueue, t.flags &= -2053, e.lanes &= ~l, nt(e, t, l)) : (H && n && Po(t), t.flags |= 1, fe(e, t, r, l), t.child);
}
function Zs(e, t, n, r, l) {
  if (e === null) {
    var i = n.type;
    return typeof i == "function" && !Zo(i) && i.defaultProps === void 0 && n.compare === null && n.defaultProps === void 0 ? (t.tag = 15, t.type = i, vc(e, t, i, r, l)) : (e = Qr(n.type, null, r, t, t.mode, l), e.ref = t.ref, e.return = t, t.child = e);
  }
  if (i = e.child, !(e.lanes & l)) {
    var o = i.memoizedProps;
    if (n = n.compare, n = n !== null ? n : Yn, n(o, r) && e.ref === t.ref)
      return nt(e, t, l);
  }
  return t.flags |= 1, e = xt(i, r), e.ref = t.ref, e.return = t, t.child = e;
}
function vc(e, t, n, r, l) {
  if (e !== null) {
    var i = e.memoizedProps;
    if (Yn(i, r) && e.ref === t.ref)
      if (ve = !1, t.pendingProps = r = i, (e.lanes & l) !== 0)
        e.flags & 131072 && (ve = !0);
      else
        return t.lanes = e.lanes, nt(e, t, l);
  }
  return Yi(e, t, n, r, l);
}
function yc(e, t, n) {
  var r = t.pendingProps, l = r.children, i = e !== null ? e.memoizedState : null;
  if (r.mode === "hidden")
    if (!(t.mode & 1))
      t.memoizedState = { baseLanes: 0, cachePool: null, transitions: null }, A(tn, Se), Se |= n;
    else {
      if (!(n & 1073741824))
        return e = i !== null ? i.baseLanes | n : n, t.lanes = t.childLanes = 1073741824, t.memoizedState = { baseLanes: e, cachePool: null, transitions: null }, t.updateQueue = null, A(tn, Se), Se |= e, null;
      t.memoizedState = { baseLanes: 0, cachePool: null, transitions: null }, r = i !== null ? i.baseLanes : n, A(tn, Se), Se |= r;
    }
  else
    i !== null ? (r = i.baseLanes | n, t.memoizedState = null) : r = n, A(tn, Se), Se |= r;
  return fe(e, t, l, n), t.child;
}
function wc(e, t) {
  var n = t.ref;
  (e === null && n !== null || e !== null && e.ref !== n) && (t.flags |= 512, t.flags |= 2097152);
}
function Yi(e, t, n, r, l) {
  var i = we(n) ? It : ce.current;
  return i = fn(t, i), sn(t, l), n = Ao(e, t, n, r, i, l), r = Bo(), e !== null && !ve ? (t.updateQueue = e.updateQueue, t.flags &= -2053, e.lanes &= ~l, nt(e, t, l)) : (H && r && Po(t), t.flags |= 1, fe(e, t, n, l), t.child);
}
function Js(e, t, n, r, l) {
  if (we(n)) {
    var i = !0;
    nl(t);
  } else
    i = !1;
  if (sn(t, l), t.stateNode === null)
    Br(e, t), Ku(t, n, r), Ki(t, n, r, l), r = !0;
  else if (e === null) {
    var o = t.stateNode, a = t.memoizedProps;
    o.props = a;
    var u = o.context, c = n.contextType;
    typeof c == "object" && c !== null ? c = De(c) : (c = we(n) ? It : ce.current, c = fn(t, c));
    var p = n.getDerivedStateFromProps, g = typeof p == "function" || typeof o.getSnapshotBeforeUpdate == "function";
    g || typeof o.UNSAFE_componentWillReceiveProps != "function" && typeof o.componentWillReceiveProps != "function" || (a !== r || u !== c) && Hs(t, o, r, c), at = !1;
    var h = t.memoizedState;
    o.state = h, sl(t, r, o, l), u = t.memoizedState, a !== r || h !== u || ye.current || at ? (typeof p == "function" && (Wi(t, n, p, r), u = t.memoizedState), (a = at || Vs(t, n, a, r, h, u, c)) ? (g || typeof o.UNSAFE_componentWillMount != "function" && typeof o.componentWillMount != "function" || (typeof o.componentWillMount == "function" && o.componentWillMount(), typeof o.UNSAFE_componentWillMount == "function" && o.UNSAFE_componentWillMount()), typeof o.componentDidMount == "function" && (t.flags |= 4194308)) : (typeof o.componentDidMount == "function" && (t.flags |= 4194308), t.memoizedProps = r, t.memoizedState = u), o.props = r, o.state = u, o.context = c, r = a) : (typeof o.componentDidMount == "function" && (t.flags |= 4194308), r = !1);
  } else {
    o = t.stateNode, Qu(e, t), a = t.memoizedProps, c = t.type === t.elementType ? a : Fe(t.type, a), o.props = c, g = t.pendingProps, h = o.context, u = n.contextType, typeof u == "object" && u !== null ? u = De(u) : (u = we(n) ? It : ce.current, u = fn(t, u));
    var y = n.getDerivedStateFromProps;
    (p = typeof y == "function" || typeof o.getSnapshotBeforeUpdate == "function") || typeof o.UNSAFE_componentWillReceiveProps != "function" && typeof o.componentWillReceiveProps != "function" || (a !== g || h !== u) && Hs(t, o, r, u), at = !1, h = t.memoizedState, o.state = h, sl(t, r, o, l);
    var v = t.memoizedState;
    a !== g || h !== v || ye.current || at ? (typeof y == "function" && (Wi(t, n, y, r), v = t.memoizedState), (c = at || Vs(t, n, c, r, h, v, u) || !1) ? (p || typeof o.UNSAFE_componentWillUpdate != "function" && typeof o.componentWillUpdate != "function" || (typeof o.componentWillUpdate == "function" && o.componentWillUpdate(r, v, u), typeof o.UNSAFE_componentWillUpdate == "function" && o.UNSAFE_componentWillUpdate(r, v, u)), typeof o.componentDidUpdate == "function" && (t.flags |= 4), typeof o.getSnapshotBeforeUpdate == "function" && (t.flags |= 1024)) : (typeof o.componentDidUpdate != "function" || a === e.memoizedProps && h === e.memoizedState || (t.flags |= 4), typeof o.getSnapshotBeforeUpdate != "function" || a === e.memoizedProps && h === e.memoizedState || (t.flags |= 1024), t.memoizedProps = r, t.memoizedState = v), o.props = r, o.state = v, o.context = u, r = c) : (typeof o.componentDidUpdate != "function" || a === e.memoizedProps && h === e.memoizedState || (t.flags |= 4), typeof o.getSnapshotBeforeUpdate != "function" || a === e.memoizedProps && h === e.memoizedState || (t.flags |= 1024), r = !1);
  }
  return Xi(e, t, n, r, i, l);
}
function Xi(e, t, n, r, l, i) {
  wc(e, t);
  var o = (t.flags & 128) !== 0;
  if (!r && !o)
    return l && $s(t, n, !1), nt(e, t, i);
  r = t.stateNode, ep.current = t;
  var a = o && typeof n.getDerivedStateFromError != "function" ? null : r.render();
  return t.flags |= 1, e !== null && o ? (t.child = pn(t, e.child, null, i), t.child = pn(t, null, a, i)) : fe(e, t, a, i), t.memoizedState = r.state, l && $s(t, n, !0), t.child;
}
function xc(e) {
  var t = e.stateNode;
  t.pendingContext ? Is(e, t.pendingContext, t.pendingContext !== t.context) : t.context && Is(e, t.context, !1), Io(e, t.containerInfo);
}
function bs(e, t, n, r, l) {
  return dn(), zo(l), t.flags |= 256, fe(e, t, n, r), t.child;
}
var qi = { dehydrated: null, treeContext: null, retryLane: 0 };
function Zi(e) {
  return { baseLanes: e, cachePool: null, transitions: null };
}
function Sc(e, t, n) {
  var r = t.pendingProps, l = Q.current, i = !1, o = (t.flags & 128) !== 0, a;
  if ((a = o) || (a = e !== null && e.memoizedState === null ? !1 : (l & 2) !== 0), a ? (i = !0, t.flags &= -129) : (e === null || e.memoizedState !== null) && (l |= 1), A(Q, l & 1), e === null)
    return Hi(t), e = t.memoizedState, e !== null && (e = e.dehydrated, e !== null) ? (t.mode & 1 ? e.data === "$!" ? t.lanes = 8 : t.lanes = 1073741824 : t.lanes = 1, null) : (o = r.children, e = r.fallback, i ? (r = t.mode, i = t.child, o = { mode: "hidden", children: o }, !(r & 1) && i !== null ? (i.childLanes = 0, i.pendingProps = o) : i = Ll(o, r, 0, null), e = Ft(e, r, n, null), i.return = t, e.return = t, i.sibling = e, t.child = i, t.child.memoizedState = Zi(n), t.memoizedState = qi, e) : Qo(t, o));
  if (l = e.memoizedState, l !== null && (a = l.dehydrated, a !== null))
    return tp(e, t, o, r, a, l, n);
  if (i) {
    i = r.fallback, o = t.mode, l = e.child, a = l.sibling;
    var u = { mode: "hidden", children: r.children };
    return !(o & 1) && t.child !== l ? (r = t.child, r.childLanes = 0, r.pendingProps = u, t.deletions = null) : (r = xt(l, u), r.subtreeFlags = l.subtreeFlags & 14680064), a !== null ? i = xt(a, i) : (i = Ft(i, o, n, null), i.flags |= 2), i.return = t, r.return = t, r.sibling = i, t.child = r, r = i, i = t.child, o = e.child.memoizedState, o = o === null ? Zi(n) : { baseLanes: o.baseLanes | n, cachePool: null, transitions: o.transitions }, i.memoizedState = o, i.childLanes = e.childLanes & ~n, t.memoizedState = qi, r;
  }
  return i = e.child, e = i.sibling, r = xt(i, { mode: "visible", children: r.children }), !(t.mode & 1) && (r.lanes = n), r.return = t, r.sibling = null, e !== null && (n = t.deletions, n === null ? (t.deletions = [e], t.flags |= 16) : n.push(e)), t.child = r, t.memoizedState = null, r;
}
function Qo(e, t) {
  return t = Ll({ mode: "visible", children: t }, e.mode, 0, null), t.return = e, e.child = t;
}
function Cr(e, t, n, r) {
  return r !== null && zo(r), pn(t, e.child, null, n), e = Qo(t, t.pendingProps.children), e.flags |= 2, t.memoizedState = null, e;
}
function tp(e, t, n, r, l, i, o) {
  if (n)
    return t.flags & 256 ? (t.flags &= -257, r = oi(Error(S(422))), Cr(e, t, o, r)) : t.memoizedState !== null ? (t.child = e.child, t.flags |= 128, null) : (i = r.fallback, l = t.mode, r = Ll({ mode: "visible", children: r.children }, l, 0, null), i = Ft(i, l, o, null), i.flags |= 2, r.return = t, i.return = t, r.sibling = i, t.child = r, t.mode & 1 && pn(t, e.child, null, o), t.child.memoizedState = Zi(o), t.memoizedState = qi, i);
  if (!(t.mode & 1))
    return Cr(e, t, o, null);
  if (l.data === "$!") {
    if (r = l.nextSibling && l.nextSibling.dataset, r)
      var a = r.dgst;
    return r = a, i = Error(S(419)), r = oi(i, r, void 0), Cr(e, t, o, r);
  }
  if (a = (o & e.childLanes) !== 0, ve || a) {
    if (r = ne, r !== null) {
      switch (o & -o) {
        case 4:
          l = 2;
          break;
        case 16:
          l = 8;
          break;
        case 64:
        case 128:
        case 256:
        case 512:
        case 1024:
        case 2048:
        case 4096:
        case 8192:
        case 16384:
        case 32768:
        case 65536:
        case 131072:
        case 262144:
        case 524288:
        case 1048576:
        case 2097152:
        case 4194304:
        case 8388608:
        case 16777216:
        case 33554432:
        case 67108864:
          l = 32;
          break;
        case 536870912:
          l = 268435456;
          break;
        default:
          l = 0;
      }
      l = l & (r.suspendedLanes | o) ? 0 : l, l !== 0 && l !== i.retryLane && (i.retryLane = l, tt(e, l), Ue(r, e, l, -1));
    }
    return qo(), r = oi(Error(S(421))), Cr(e, t, o, r);
  }
  return l.data === "$?" ? (t.flags |= 128, t.child = e.child, t = mp.bind(null, e), l._reactRetry = t, null) : (e = i.treeContext, je = gt(l.nextSibling), ke = t, H = !0, $e = null, e !== null && (Pe[Te++] = qe, Pe[Te++] = Ze, Pe[Te++] = $t, qe = e.id, Ze = e.overflow, $t = t), t = Qo(t, r.children), t.flags |= 4096, t);
}
function ea(e, t, n) {
  e.lanes |= t;
  var r = e.alternate;
  r !== null && (r.lanes |= t), Qi(e.return, t, n);
}
function si(e, t, n, r, l) {
  var i = e.memoizedState;
  i === null ? e.memoizedState = { isBackwards: t, rendering: null, renderingStartTime: 0, last: r, tail: n, tailMode: l } : (i.isBackwards = t, i.rendering = null, i.renderingStartTime = 0, i.last = r, i.tail = n, i.tailMode = l);
}
function jc(e, t, n) {
  var r = t.pendingProps, l = r.revealOrder, i = r.tail;
  if (fe(e, t, r.children, n), r = Q.current, r & 2)
    r = r & 1 | 2, t.flags |= 128;
  else {
    if (e !== null && e.flags & 128)
      e:
        for (e = t.child; e !== null; ) {
          if (e.tag === 13)
            e.memoizedState !== null && ea(e, n, t);
          else if (e.tag === 19)
            ea(e, n, t);
          else if (e.child !== null) {
            e.child.return = e, e = e.child;
            continue;
          }
          if (e === t)
            break e;
          for (; e.sibling === null; ) {
            if (e.return === null || e.return === t)
              break e;
            e = e.return;
          }
          e.sibling.return = e.return, e = e.sibling;
        }
    r &= 1;
  }
  if (A(Q, r), !(t.mode & 1))
    t.memoizedState = null;
  else
    switch (l) {
      case "forwards":
        for (n = t.child, l = null; n !== null; )
          e = n.alternate, e !== null && al(e) === null && (l = n), n = n.sibling;
        n = l, n === null ? (l = t.child, t.child = null) : (l = n.sibling, n.sibling = null), si(t, !1, l, n, i);
        break;
      case "backwards":
        for (n = null, l = t.child, t.child = null; l !== null; ) {
          if (e = l.alternate, e !== null && al(e) === null) {
            t.child = l;
            break;
          }
          e = l.sibling, l.sibling = n, n = l, l = e;
        }
        si(t, !0, n, null, i);
        break;
      case "together":
        si(t, !1, null, null, void 0);
        break;
      default:
        t.memoizedState = null;
    }
  return t.child;
}
function Br(e, t) {
  !(t.mode & 1) && e !== null && (e.alternate = null, t.alternate = null, t.flags |= 2);
}
function nt(e, t, n) {
  if (e !== null && (t.dependencies = e.dependencies), Ut |= t.lanes, !(n & t.childLanes))
    return null;
  if (e !== null && t.child !== e.child)
    throw Error(S(153));
  if (t.child !== null) {
    for (e = t.child, n = xt(e, e.pendingProps), t.child = n, n.return = t; e.sibling !== null; )
      e = e.sibling, n = n.sibling = xt(e, e.pendingProps), n.return = t;
    n.sibling = null;
  }
  return t.child;
}
function np(e, t, n) {
  switch (t.tag) {
    case 3:
      xc(t), dn();
      break;
    case 5:
      Xu(t);
      break;
    case 1:
      we(t.type) && nl(t);
      break;
    case 4:
      Io(t, t.stateNode.containerInfo);
      break;
    case 10:
      var r = t.type._context, l = t.memoizedProps.value;
      A(il, r._currentValue), r._currentValue = l;
      break;
    case 13:
      if (r = t.memoizedState, r !== null)
        return r.dehydrated !== null ? (A(Q, Q.current & 1), t.flags |= 128, null) : n & t.child.childLanes ? Sc(e, t, n) : (A(Q, Q.current & 1), e = nt(e, t, n), e !== null ? e.sibling : null);
      A(Q, Q.current & 1);
      break;
    case 19:
      if (r = (n & t.childLanes) !== 0, e.flags & 128) {
        if (r)
          return jc(e, t, n);
        t.flags |= 128;
      }
      if (l = t.memoizedState, l !== null && (l.rendering = null, l.tail = null, l.lastEffect = null), A(Q, Q.current), r)
        break;
      return null;
    case 22:
    case 23:
      return t.lanes = 0, yc(e, t, n);
  }
  return nt(e, t, n);
}
var kc, Ji, Nc, Cc;
kc = function(e, t) {
  for (var n = t.child; n !== null; ) {
    if (n.tag === 5 || n.tag === 6)
      e.appendChild(n.stateNode);
    else if (n.tag !== 4 && n.child !== null) {
      n.child.return = n, n = n.child;
      continue;
    }
    if (n === t)
      break;
    for (; n.sibling === null; ) {
      if (n.return === null || n.return === t)
        return;
      n = n.return;
    }
    n.sibling.return = n.return, n = n.sibling;
  }
};
Ji = function() {
};
Nc = function(e, t, n, r) {
  var l = e.memoizedProps;
  if (l !== r) {
    e = t.stateNode, Rt(We.current);
    var i = null;
    switch (n) {
      case "input":
        l = xi(e, l), r = xi(e, r), i = [];
        break;
      case "select":
        l = K({}, l, { value: void 0 }), r = K({}, r, { value: void 0 }), i = [];
        break;
      case "textarea":
        l = ki(e, l), r = ki(e, r), i = [];
        break;
      default:
        typeof l.onClick != "function" && typeof r.onClick == "function" && (e.onclick = el);
    }
    Ci(n, r);
    var o;
    n = null;
    for (c in l)
      if (!r.hasOwnProperty(c) && l.hasOwnProperty(c) && l[c] != null)
        if (c === "style") {
          var a = l[c];
          for (o in a)
            a.hasOwnProperty(o) && (n || (n = {}), n[o] = "");
        } else
          c !== "dangerouslySetInnerHTML" && c !== "children" && c !== "suppressContentEditableWarning" && c !== "suppressHydrationWarning" && c !== "autoFocus" && (Bn.hasOwnProperty(c) ? i || (i = []) : (i = i || []).push(c, null));
    for (c in r) {
      var u = r[c];
      if (a = l != null ? l[c] : void 0, r.hasOwnProperty(c) && u !== a && (u != null || a != null))
        if (c === "style")
          if (a) {
            for (o in a)
              !a.hasOwnProperty(o) || u && u.hasOwnProperty(o) || (n || (n = {}), n[o] = "");
            for (o in u)
              u.hasOwnProperty(o) && a[o] !== u[o] && (n || (n = {}), n[o] = u[o]);
          } else
            n || (i || (i = []), i.push(
              c,
              n
            )), n = u;
        else
          c === "dangerouslySetInnerHTML" ? (u = u ? u.__html : void 0, a = a ? a.__html : void 0, u != null && a !== u && (i = i || []).push(c, u)) : c === "children" ? typeof u != "string" && typeof u != "number" || (i = i || []).push(c, "" + u) : c !== "suppressContentEditableWarning" && c !== "suppressHydrationWarning" && (Bn.hasOwnProperty(c) ? (u != null && c === "onScroll" && B("scroll", e), i || a === u || (i = [])) : (i = i || []).push(c, u));
    }
    n && (i = i || []).push("style", n);
    var c = i;
    (t.updateQueue = c) && (t.flags |= 4);
  }
};
Cc = function(e, t, n, r) {
  n !== r && (t.flags |= 4);
};
function En(e, t) {
  if (!H)
    switch (e.tailMode) {
      case "hidden":
        t = e.tail;
        for (var n = null; t !== null; )
          t.alternate !== null && (n = t), t = t.sibling;
        n === null ? e.tail = null : n.sibling = null;
        break;
      case "collapsed":
        n = e.tail;
        for (var r = null; n !== null; )
          n.alternate !== null && (r = n), n = n.sibling;
        r === null ? t || e.tail === null ? e.tail = null : e.tail.sibling = null : r.sibling = null;
    }
}
function ae(e) {
  var t = e.alternate !== null && e.alternate.child === e.child, n = 0, r = 0;
  if (t)
    for (var l = e.child; l !== null; )
      n |= l.lanes | l.childLanes, r |= l.subtreeFlags & 14680064, r |= l.flags & 14680064, l.return = e, l = l.sibling;
  else
    for (l = e.child; l !== null; )
      n |= l.lanes | l.childLanes, r |= l.subtreeFlags, r |= l.flags, l.return = e, l = l.sibling;
  return e.subtreeFlags |= r, e.childLanes = n, t;
}
function rp(e, t, n) {
  var r = t.pendingProps;
  switch (To(t), t.tag) {
    case 2:
    case 16:
    case 15:
    case 0:
    case 11:
    case 7:
    case 8:
    case 12:
    case 9:
    case 14:
      return ae(t), null;
    case 1:
      return we(t.type) && tl(), ae(t), null;
    case 3:
      return r = t.stateNode, mn(), V(ye), V(ce), Oo(), r.pendingContext && (r.context = r.pendingContext, r.pendingContext = null), (e === null || e.child === null) && (kr(t) ? t.flags |= 4 : e === null || e.memoizedState.isDehydrated && !(t.flags & 256) || (t.flags |= 1024, $e !== null && (oo($e), $e = null))), Ji(e, t), ae(t), null;
    case 5:
      $o(t);
      var l = Rt(bn.current);
      if (n = t.type, e !== null && t.stateNode != null)
        Nc(e, t, n, r, l), e.ref !== t.ref && (t.flags |= 512, t.flags |= 2097152);
      else {
        if (!r) {
          if (t.stateNode === null)
            throw Error(S(166));
          return ae(t), null;
        }
        if (e = Rt(We.current), kr(t)) {
          r = t.stateNode, n = t.type;
          var i = t.memoizedProps;
          switch (r[He] = t, r[Zn] = i, e = (t.mode & 1) !== 0, n) {
            case "dialog":
              B("cancel", r), B("close", r);
              break;
            case "iframe":
            case "object":
            case "embed":
              B("load", r);
              break;
            case "video":
            case "audio":
              for (l = 0; l < Ln.length; l++)
                B(Ln[l], r);
              break;
            case "source":
              B("error", r);
              break;
            case "img":
            case "image":
            case "link":
              B(
                "error",
                r
              ), B("load", r);
              break;
            case "details":
              B("toggle", r);
              break;
            case "input":
              us(r, i), B("invalid", r);
              break;
            case "select":
              r._wrapperState = { wasMultiple: !!i.multiple }, B("invalid", r);
              break;
            case "textarea":
              fs(r, i), B("invalid", r);
          }
          Ci(n, i), l = null;
          for (var o in i)
            if (i.hasOwnProperty(o)) {
              var a = i[o];
              o === "children" ? typeof a == "string" ? r.textContent !== a && (i.suppressHydrationWarning !== !0 && jr(r.textContent, a, e), l = ["children", a]) : typeof a == "number" && r.textContent !== "" + a && (i.suppressHydrationWarning !== !0 && jr(
                r.textContent,
                a,
                e
              ), l = ["children", "" + a]) : Bn.hasOwnProperty(o) && a != null && o === "onScroll" && B("scroll", r);
            }
          switch (n) {
            case "input":
              mr(r), cs(r, i, !0);
              break;
            case "textarea":
              mr(r), ds(r);
              break;
            case "select":
            case "option":
              break;
            default:
              typeof i.onClick == "function" && (r.onclick = el);
          }
          r = l, t.updateQueue = r, r !== null && (t.flags |= 4);
        } else {
          o = l.nodeType === 9 ? l : l.ownerDocument, e === "http://www.w3.org/1999/xhtml" && (e = Ja(n)), e === "http://www.w3.org/1999/xhtml" ? n === "script" ? (e = o.createElement("div"), e.innerHTML = "<script><\/script>", e = e.removeChild(e.firstChild)) : typeof r.is == "string" ? e = o.createElement(n, { is: r.is }) : (e = o.createElement(n), n === "select" && (o = e, r.multiple ? o.multiple = !0 : r.size && (o.size = r.size))) : e = o.createElementNS(e, n), e[He] = t, e[Zn] = r, kc(e, t, !1, !1), t.stateNode = e;
          e: {
            switch (o = Ei(n, r), n) {
              case "dialog":
                B("cancel", e), B("close", e), l = r;
                break;
              case "iframe":
              case "object":
              case "embed":
                B("load", e), l = r;
                break;
              case "video":
              case "audio":
                for (l = 0; l < Ln.length; l++)
                  B(Ln[l], e);
                l = r;
                break;
              case "source":
                B("error", e), l = r;
                break;
              case "img":
              case "image":
              case "link":
                B(
                  "error",
                  e
                ), B("load", e), l = r;
                break;
              case "details":
                B("toggle", e), l = r;
                break;
              case "input":
                us(e, r), l = xi(e, r), B("invalid", e);
                break;
              case "option":
                l = r;
                break;
              case "select":
                e._wrapperState = { wasMultiple: !!r.multiple }, l = K({}, r, { value: void 0 }), B("invalid", e);
                break;
              case "textarea":
                fs(e, r), l = ki(e, r), B("invalid", e);
                break;
              default:
                l = r;
            }
            Ci(n, l), a = l;
            for (i in a)
              if (a.hasOwnProperty(i)) {
                var u = a[i];
                i === "style" ? tu(e, u) : i === "dangerouslySetInnerHTML" ? (u = u ? u.__html : void 0, u != null && ba(e, u)) : i === "children" ? typeof u == "string" ? (n !== "textarea" || u !== "") && Vn(e, u) : typeof u == "number" && Vn(e, "" + u) : i !== "suppressContentEditableWarning" && i !== "suppressHydrationWarning" && i !== "autoFocus" && (Bn.hasOwnProperty(i) ? u != null && i === "onScroll" && B("scroll", e) : u != null && mo(e, i, u, o));
              }
            switch (n) {
              case "input":
                mr(e), cs(e, r, !1);
                break;
              case "textarea":
                mr(e), ds(e);
                break;
              case "option":
                r.value != null && e.setAttribute("value", "" + St(r.value));
                break;
              case "select":
                e.multiple = !!r.multiple, i = r.value, i != null ? nn(e, !!r.multiple, i, !1) : r.defaultValue != null && nn(
                  e,
                  !!r.multiple,
                  r.defaultValue,
                  !0
                );
                break;
              default:
                typeof l.onClick == "function" && (e.onclick = el);
            }
            switch (n) {
              case "button":
              case "input":
              case "select":
              case "textarea":
                r = !!r.autoFocus;
                break e;
              case "img":
                r = !0;
                break e;
              default:
                r = !1;
            }
          }
          r && (t.flags |= 4);
        }
        t.ref !== null && (t.flags |= 512, t.flags |= 2097152);
      }
      return ae(t), null;
    case 6:
      if (e && t.stateNode != null)
        Cc(e, t, e.memoizedProps, r);
      else {
        if (typeof r != "string" && t.stateNode === null)
          throw Error(S(166));
        if (n = Rt(bn.current), Rt(We.current), kr(t)) {
          if (r = t.stateNode, n = t.memoizedProps, r[He] = t, (i = r.nodeValue !== n) && (e = ke, e !== null))
            switch (e.tag) {
              case 3:
                jr(r.nodeValue, n, (e.mode & 1) !== 0);
                break;
              case 5:
                e.memoizedProps.suppressHydrationWarning !== !0 && jr(r.nodeValue, n, (e.mode & 1) !== 0);
            }
          i && (t.flags |= 4);
        } else
          r = (n.nodeType === 9 ? n : n.ownerDocument).createTextNode(r), r[He] = t, t.stateNode = r;
      }
      return ae(t), null;
    case 13:
      if (V(Q), r = t.memoizedState, e === null || e.memoizedState !== null && e.memoizedState.dehydrated !== null) {
        if (H && je !== null && t.mode & 1 && !(t.flags & 128))
          Vu(), dn(), t.flags |= 98560, i = !1;
        else if (i = kr(t), r !== null && r.dehydrated !== null) {
          if (e === null) {
            if (!i)
              throw Error(S(318));
            if (i = t.memoizedState, i = i !== null ? i.dehydrated : null, !i)
              throw Error(S(317));
            i[He] = t;
          } else
            dn(), !(t.flags & 128) && (t.memoizedState = null), t.flags |= 4;
          ae(t), i = !1;
        } else
          $e !== null && (oo($e), $e = null), i = !0;
        if (!i)
          return t.flags & 65536 ? t : null;
      }
      return t.flags & 128 ? (t.lanes = n, t) : (r = r !== null, r !== (e !== null && e.memoizedState !== null) && r && (t.child.flags |= 8192, t.mode & 1 && (e === null || Q.current & 1 ? b === 0 && (b = 3) : qo())), t.updateQueue !== null && (t.flags |= 4), ae(t), null);
    case 4:
      return mn(), Ji(e, t), e === null && Xn(t.stateNode.containerInfo), ae(t), null;
    case 10:
      return Ro(t.type._context), ae(t), null;
    case 17:
      return we(t.type) && tl(), ae(t), null;
    case 19:
      if (V(Q), i = t.memoizedState, i === null)
        return ae(t), null;
      if (r = (t.flags & 128) !== 0, o = i.rendering, o === null)
        if (r)
          En(i, !1);
        else {
          if (b !== 0 || e !== null && e.flags & 128)
            for (e = t.child; e !== null; ) {
              if (o = al(e), o !== null) {
                for (t.flags |= 128, En(i, !1), r = o.updateQueue, r !== null && (t.updateQueue = r, t.flags |= 4), t.subtreeFlags = 0, r = n, n = t.child; n !== null; )
                  i = n, e = r, i.flags &= 14680066, o = i.alternate, o === null ? (i.childLanes = 0, i.lanes = e, i.child = null, i.subtreeFlags = 0, i.memoizedProps = null, i.memoizedState = null, i.updateQueue = null, i.dependencies = null, i.stateNode = null) : (i.childLanes = o.childLanes, i.lanes = o.lanes, i.child = o.child, i.subtreeFlags = 0, i.deletions = null, i.memoizedProps = o.memoizedProps, i.memoizedState = o.memoizedState, i.updateQueue = o.updateQueue, i.type = o.type, e = o.dependencies, i.dependencies = e === null ? null : { lanes: e.lanes, firstContext: e.firstContext }), n = n.sibling;
                return A(Q, Q.current & 1 | 2), t.child;
              }
              e = e.sibling;
            }
          i.tail !== null && q() > gn && (t.flags |= 128, r = !0, En(i, !1), t.lanes = 4194304);
        }
      else {
        if (!r)
          if (e = al(o), e !== null) {
            if (t.flags |= 128, r = !0, n = e.updateQueue, n !== null && (t.updateQueue = n, t.flags |= 4), En(i, !0), i.tail === null && i.tailMode === "hidden" && !o.alternate && !H)
              return ae(t), null;
          } else
            2 * q() - i.renderingStartTime > gn && n !== 1073741824 && (t.flags |= 128, r = !0, En(i, !1), t.lanes = 4194304);
        i.isBackwards ? (o.sibling = t.child, t.child = o) : (n = i.last, n !== null ? n.sibling = o : t.child = o, i.last = o);
      }
      return i.tail !== null ? (t = i.tail, i.rendering = t, i.tail = t.sibling, i.renderingStartTime = q(), t.sibling = null, n = Q.current, A(Q, r ? n & 1 | 2 : n & 1), t) : (ae(t), null);
    case 22:
    case 23:
      return Xo(), r = t.memoizedState !== null, e !== null && e.memoizedState !== null !== r && (t.flags |= 8192), r && t.mode & 1 ? Se & 1073741824 && (ae(t), t.subtreeFlags & 6 && (t.flags |= 8192)) : ae(t), null;
    case 24:
      return null;
    case 25:
      return null;
  }
  throw Error(S(156, t.tag));
}
function lp(e, t) {
  switch (To(t), t.tag) {
    case 1:
      return we(t.type) && tl(), e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
    case 3:
      return mn(), V(ye), V(ce), Oo(), e = t.flags, e & 65536 && !(e & 128) ? (t.flags = e & -65537 | 128, t) : null;
    case 5:
      return $o(t), null;
    case 13:
      if (V(Q), e = t.memoizedState, e !== null && e.dehydrated !== null) {
        if (t.alternate === null)
          throw Error(S(340));
        dn();
      }
      return e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
    case 19:
      return V(Q), null;
    case 4:
      return mn(), null;
    case 10:
      return Ro(t.type._context), null;
    case 22:
    case 23:
      return Xo(), null;
    case 24:
      return null;
    default:
      return null;
  }
}
var Er = !1, ue = !1, ip = typeof WeakSet == "function" ? WeakSet : Set, P = null;
function en(e, t) {
  var n = e.ref;
  if (n !== null)
    if (typeof n == "function")
      try {
        n(null);
      } catch (r) {
        Y(e, t, r);
      }
    else
      n.current = null;
}
function bi(e, t, n) {
  try {
    n();
  } catch (r) {
    Y(e, t, r);
  }
}
var ta = !1;
function op(e, t) {
  if (Ii = Zr, e = Tu(), _o(e)) {
    if ("selectionStart" in e)
      var n = { start: e.selectionStart, end: e.selectionEnd };
    else
      e: {
        n = (n = e.ownerDocument) && n.defaultView || window;
        var r = n.getSelection && n.getSelection();
        if (r && r.rangeCount !== 0) {
          n = r.anchorNode;
          var l = r.anchorOffset, i = r.focusNode;
          r = r.focusOffset;
          try {
            n.nodeType, i.nodeType;
          } catch {
            n = null;
            break e;
          }
          var o = 0, a = -1, u = -1, c = 0, p = 0, g = e, h = null;
          t:
            for (; ; ) {
              for (var y; g !== n || l !== 0 && g.nodeType !== 3 || (a = o + l), g !== i || r !== 0 && g.nodeType !== 3 || (u = o + r), g.nodeType === 3 && (o += g.nodeValue.length), (y = g.firstChild) !== null; )
                h = g, g = y;
              for (; ; ) {
                if (g === e)
                  break t;
                if (h === n && ++c === l && (a = o), h === i && ++p === r && (u = o), (y = g.nextSibling) !== null)
                  break;
                g = h, h = g.parentNode;
              }
              g = y;
            }
          n = a === -1 || u === -1 ? null : { start: a, end: u };
        } else
          n = null;
      }
    n = n || { start: 0, end: 0 };
  } else
    n = null;
  for ($i = { focusedElem: e, selectionRange: n }, Zr = !1, P = t; P !== null; )
    if (t = P, e = t.child, (t.subtreeFlags & 1028) !== 0 && e !== null)
      e.return = t, P = e;
    else
      for (; P !== null; ) {
        t = P;
        try {
          var v = t.alternate;
          if (t.flags & 1024)
            switch (t.tag) {
              case 0:
              case 11:
              case 15:
                break;
              case 1:
                if (v !== null) {
                  var w = v.memoizedProps, z = v.memoizedState, d = t.stateNode, f = d.getSnapshotBeforeUpdate(t.elementType === t.type ? w : Fe(t.type, w), z);
                  d.__reactInternalSnapshotBeforeUpdate = f;
                }
                break;
              case 3:
                var m = t.stateNode.containerInfo;
                m.nodeType === 1 ? m.textContent = "" : m.nodeType === 9 && m.documentElement && m.removeChild(m.documentElement);
                break;
              case 5:
              case 6:
              case 4:
              case 17:
                break;
              default:
                throw Error(S(163));
            }
        } catch (x) {
          Y(t, t.return, x);
        }
        if (e = t.sibling, e !== null) {
          e.return = t.return, P = e;
          break;
        }
        P = t.return;
      }
  return v = ta, ta = !1, v;
}
function On(e, t, n) {
  var r = t.updateQueue;
  if (r = r !== null ? r.lastEffect : null, r !== null) {
    var l = r = r.next;
    do {
      if ((l.tag & e) === e) {
        var i = l.destroy;
        l.destroy = void 0, i !== void 0 && bi(t, n, i);
      }
      l = l.next;
    } while (l !== r);
  }
}
function Tl(e, t) {
  if (t = t.updateQueue, t = t !== null ? t.lastEffect : null, t !== null) {
    var n = t = t.next;
    do {
      if ((n.tag & e) === e) {
        var r = n.create;
        n.destroy = r();
      }
      n = n.next;
    } while (n !== t);
  }
}
function eo(e) {
  var t = e.ref;
  if (t !== null) {
    var n = e.stateNode;
    switch (e.tag) {
      case 5:
        e = n;
        break;
      default:
        e = n;
    }
    typeof t == "function" ? t(e) : t.current = e;
  }
}
function Ec(e) {
  var t = e.alternate;
  t !== null && (e.alternate = null, Ec(t)), e.child = null, e.deletions = null, e.sibling = null, e.tag === 5 && (t = e.stateNode, t !== null && (delete t[He], delete t[Zn], delete t[Ai], delete t[Vd], delete t[Hd])), e.stateNode = null, e.return = null, e.dependencies = null, e.memoizedProps = null, e.memoizedState = null, e.pendingProps = null, e.stateNode = null, e.updateQueue = null;
}
function _c(e) {
  return e.tag === 5 || e.tag === 3 || e.tag === 4;
}
function na(e) {
  e:
    for (; ; ) {
      for (; e.sibling === null; ) {
        if (e.return === null || _c(e.return))
          return null;
        e = e.return;
      }
      for (e.sibling.return = e.return, e = e.sibling; e.tag !== 5 && e.tag !== 6 && e.tag !== 18; ) {
        if (e.flags & 2 || e.child === null || e.tag === 4)
          continue e;
        e.child.return = e, e = e.child;
      }
      if (!(e.flags & 2))
        return e.stateNode;
    }
}
function to(e, t, n) {
  var r = e.tag;
  if (r === 5 || r === 6)
    e = e.stateNode, t ? n.nodeType === 8 ? n.parentNode.insertBefore(e, t) : n.insertBefore(e, t) : (n.nodeType === 8 ? (t = n.parentNode, t.insertBefore(e, n)) : (t = n, t.appendChild(e)), n = n._reactRootContainer, n != null || t.onclick !== null || (t.onclick = el));
  else if (r !== 4 && (e = e.child, e !== null))
    for (to(e, t, n), e = e.sibling; e !== null; )
      to(e, t, n), e = e.sibling;
}
function no(e, t, n) {
  var r = e.tag;
  if (r === 5 || r === 6)
    e = e.stateNode, t ? n.insertBefore(e, t) : n.appendChild(e);
  else if (r !== 4 && (e = e.child, e !== null))
    for (no(e, t, n), e = e.sibling; e !== null; )
      no(e, t, n), e = e.sibling;
}
var le = null, Ie = !1;
function it(e, t, n) {
  for (n = n.child; n !== null; )
    Pc(e, t, n), n = n.sibling;
}
function Pc(e, t, n) {
  if (Qe && typeof Qe.onCommitFiberUnmount == "function")
    try {
      Qe.onCommitFiberUnmount(Sl, n);
    } catch {
    }
  switch (n.tag) {
    case 5:
      ue || en(n, t);
    case 6:
      var r = le, l = Ie;
      le = null, it(e, t, n), le = r, Ie = l, le !== null && (Ie ? (e = le, n = n.stateNode, e.nodeType === 8 ? e.parentNode.removeChild(n) : e.removeChild(n)) : le.removeChild(n.stateNode));
      break;
    case 18:
      le !== null && (Ie ? (e = le, n = n.stateNode, e.nodeType === 8 ? ei(e.parentNode, n) : e.nodeType === 1 && ei(e, n), Kn(e)) : ei(le, n.stateNode));
      break;
    case 4:
      r = le, l = Ie, le = n.stateNode.containerInfo, Ie = !0, it(e, t, n), le = r, Ie = l;
      break;
    case 0:
    case 11:
    case 14:
    case 15:
      if (!ue && (r = n.updateQueue, r !== null && (r = r.lastEffect, r !== null))) {
        l = r = r.next;
        do {
          var i = l, o = i.destroy;
          i = i.tag, o !== void 0 && (i & 2 || i & 4) && bi(n, t, o), l = l.next;
        } while (l !== r);
      }
      it(e, t, n);
      break;
    case 1:
      if (!ue && (en(n, t), r = n.stateNode, typeof r.componentWillUnmount == "function"))
        try {
          r.props = n.memoizedProps, r.state = n.memoizedState, r.componentWillUnmount();
        } catch (a) {
          Y(n, t, a);
        }
      it(e, t, n);
      break;
    case 21:
      it(e, t, n);
      break;
    case 22:
      n.mode & 1 ? (ue = (r = ue) || n.memoizedState !== null, it(e, t, n), ue = r) : it(e, t, n);
      break;
    default:
      it(e, t, n);
  }
}
function ra(e) {
  var t = e.updateQueue;
  if (t !== null) {
    e.updateQueue = null;
    var n = e.stateNode;
    n === null && (n = e.stateNode = new ip()), t.forEach(function(r) {
      var l = hp.bind(null, e, r);
      n.has(r) || (n.add(r), r.then(l, l));
    });
  }
}
function Me(e, t) {
  var n = t.deletions;
  if (n !== null)
    for (var r = 0; r < n.length; r++) {
      var l = n[r];
      try {
        var i = e, o = t, a = o;
        e:
          for (; a !== null; ) {
            switch (a.tag) {
              case 5:
                le = a.stateNode, Ie = !1;
                break e;
              case 3:
                le = a.stateNode.containerInfo, Ie = !0;
                break e;
              case 4:
                le = a.stateNode.containerInfo, Ie = !0;
                break e;
            }
            a = a.return;
          }
        if (le === null)
          throw Error(S(160));
        Pc(i, o, l), le = null, Ie = !1;
        var u = l.alternate;
        u !== null && (u.return = null), l.return = null;
      } catch (c) {
        Y(l, t, c);
      }
    }
  if (t.subtreeFlags & 12854)
    for (t = t.child; t !== null; )
      Tc(t, e), t = t.sibling;
}
function Tc(e, t) {
  var n = e.alternate, r = e.flags;
  switch (e.tag) {
    case 0:
    case 11:
    case 14:
    case 15:
      if (Me(t, e), Be(e), r & 4) {
        try {
          On(3, e, e.return), Tl(3, e);
        } catch (w) {
          Y(e, e.return, w);
        }
        try {
          On(5, e, e.return);
        } catch (w) {
          Y(e, e.return, w);
        }
      }
      break;
    case 1:
      Me(t, e), Be(e), r & 512 && n !== null && en(n, n.return);
      break;
    case 5:
      if (Me(t, e), Be(e), r & 512 && n !== null && en(n, n.return), e.flags & 32) {
        var l = e.stateNode;
        try {
          Vn(l, "");
        } catch (w) {
          Y(e, e.return, w);
        }
      }
      if (r & 4 && (l = e.stateNode, l != null)) {
        var i = e.memoizedProps, o = n !== null ? n.memoizedProps : i, a = e.type, u = e.updateQueue;
        if (e.updateQueue = null, u !== null)
          try {
            a === "input" && i.type === "radio" && i.name != null && qa(l, i), Ei(a, o);
            var c = Ei(a, i);
            for (o = 0; o < u.length; o += 2) {
              var p = u[o], g = u[o + 1];
              p === "style" ? tu(l, g) : p === "dangerouslySetInnerHTML" ? ba(l, g) : p === "children" ? Vn(l, g) : mo(l, p, g, c);
            }
            switch (a) {
              case "input":
                Si(l, i);
                break;
              case "textarea":
                Za(l, i);
                break;
              case "select":
                var h = l._wrapperState.wasMultiple;
                l._wrapperState.wasMultiple = !!i.multiple;
                var y = i.value;
                y != null ? nn(l, !!i.multiple, y, !1) : h !== !!i.multiple && (i.defaultValue != null ? nn(
                  l,
                  !!i.multiple,
                  i.defaultValue,
                  !0
                ) : nn(l, !!i.multiple, i.multiple ? [] : "", !1));
            }
            l[Zn] = i;
          } catch (w) {
            Y(e, e.return, w);
          }
      }
      break;
    case 6:
      if (Me(t, e), Be(e), r & 4) {
        if (e.stateNode === null)
          throw Error(S(162));
        l = e.stateNode, i = e.memoizedProps;
        try {
          l.nodeValue = i;
        } catch (w) {
          Y(e, e.return, w);
        }
      }
      break;
    case 3:
      if (Me(t, e), Be(e), r & 4 && n !== null && n.memoizedState.isDehydrated)
        try {
          Kn(t.containerInfo);
        } catch (w) {
          Y(e, e.return, w);
        }
      break;
    case 4:
      Me(t, e), Be(e);
      break;
    case 13:
      Me(t, e), Be(e), l = e.child, l.flags & 8192 && (i = l.memoizedState !== null, l.stateNode.isHidden = i, !i || l.alternate !== null && l.alternate.memoizedState !== null || (Go = q())), r & 4 && ra(e);
      break;
    case 22:
      if (p = n !== null && n.memoizedState !== null, e.mode & 1 ? (ue = (c = ue) || p, Me(t, e), ue = c) : Me(t, e), Be(e), r & 8192) {
        if (c = e.memoizedState !== null, (e.stateNode.isHidden = c) && !p && e.mode & 1)
          for (P = e, p = e.child; p !== null; ) {
            for (g = P = p; P !== null; ) {
              switch (h = P, y = h.child, h.tag) {
                case 0:
                case 11:
                case 14:
                case 15:
                  On(4, h, h.return);
                  break;
                case 1:
                  en(h, h.return);
                  var v = h.stateNode;
                  if (typeof v.componentWillUnmount == "function") {
                    r = h, n = h.return;
                    try {
                      t = r, v.props = t.memoizedProps, v.state = t.memoizedState, v.componentWillUnmount();
                    } catch (w) {
                      Y(r, n, w);
                    }
                  }
                  break;
                case 5:
                  en(h, h.return);
                  break;
                case 22:
                  if (h.memoizedState !== null) {
                    ia(g);
                    continue;
                  }
              }
              y !== null ? (y.return = h, P = y) : ia(g);
            }
            p = p.sibling;
          }
        e:
          for (p = null, g = e; ; ) {
            if (g.tag === 5) {
              if (p === null) {
                p = g;
                try {
                  l = g.stateNode, c ? (i = l.style, typeof i.setProperty == "function" ? i.setProperty("display", "none", "important") : i.display = "none") : (a = g.stateNode, u = g.memoizedProps.style, o = u != null && u.hasOwnProperty("display") ? u.display : null, a.style.display = eu("display", o));
                } catch (w) {
                  Y(e, e.return, w);
                }
              }
            } else if (g.tag === 6) {
              if (p === null)
                try {
                  g.stateNode.nodeValue = c ? "" : g.memoizedProps;
                } catch (w) {
                  Y(e, e.return, w);
                }
            } else if ((g.tag !== 22 && g.tag !== 23 || g.memoizedState === null || g === e) && g.child !== null) {
              g.child.return = g, g = g.child;
              continue;
            }
            if (g === e)
              break e;
            for (; g.sibling === null; ) {
              if (g.return === null || g.return === e)
                break e;
              p === g && (p = null), g = g.return;
            }
            p === g && (p = null), g.sibling.return = g.return, g = g.sibling;
          }
      }
      break;
    case 19:
      Me(t, e), Be(e), r & 4 && ra(e);
      break;
    case 21:
      break;
    default:
      Me(
        t,
        e
      ), Be(e);
  }
}
function Be(e) {
  var t = e.flags;
  if (t & 2) {
    try {
      e: {
        for (var n = e.return; n !== null; ) {
          if (_c(n)) {
            var r = n;
            break e;
          }
          n = n.return;
        }
        throw Error(S(160));
      }
      switch (r.tag) {
        case 5:
          var l = r.stateNode;
          r.flags & 32 && (Vn(l, ""), r.flags &= -33);
          var i = na(e);
          no(e, i, l);
          break;
        case 3:
        case 4:
          var o = r.stateNode.containerInfo, a = na(e);
          to(e, a, o);
          break;
        default:
          throw Error(S(161));
      }
    } catch (u) {
      Y(e, e.return, u);
    }
    e.flags &= -3;
  }
  t & 4096 && (e.flags &= -4097);
}
function sp(e, t, n) {
  P = e, zc(e);
}
function zc(e, t, n) {
  for (var r = (e.mode & 1) !== 0; P !== null; ) {
    var l = P, i = l.child;
    if (l.tag === 22 && r) {
      var o = l.memoizedState !== null || Er;
      if (!o) {
        var a = l.alternate, u = a !== null && a.memoizedState !== null || ue;
        a = Er;
        var c = ue;
        if (Er = o, (ue = u) && !c)
          for (P = l; P !== null; )
            o = P, u = o.child, o.tag === 22 && o.memoizedState !== null ? oa(l) : u !== null ? (u.return = o, P = u) : oa(l);
        for (; i !== null; )
          P = i, zc(i), i = i.sibling;
        P = l, Er = a, ue = c;
      }
      la(e);
    } else
      l.subtreeFlags & 8772 && i !== null ? (i.return = l, P = i) : la(e);
  }
}
function la(e) {
  for (; P !== null; ) {
    var t = P;
    if (t.flags & 8772) {
      var n = t.alternate;
      try {
        if (t.flags & 8772)
          switch (t.tag) {
            case 0:
            case 11:
            case 15:
              ue || Tl(5, t);
              break;
            case 1:
              var r = t.stateNode;
              if (t.flags & 4 && !ue)
                if (n === null)
                  r.componentDidMount();
                else {
                  var l = t.elementType === t.type ? n.memoizedProps : Fe(t.type, n.memoizedProps);
                  r.componentDidUpdate(l, n.memoizedState, r.__reactInternalSnapshotBeforeUpdate);
                }
              var i = t.updateQueue;
              i !== null && Bs(t, i, r);
              break;
            case 3:
              var o = t.updateQueue;
              if (o !== null) {
                if (n = null, t.child !== null)
                  switch (t.child.tag) {
                    case 5:
                      n = t.child.stateNode;
                      break;
                    case 1:
                      n = t.child.stateNode;
                  }
                Bs(t, o, n);
              }
              break;
            case 5:
              var a = t.stateNode;
              if (n === null && t.flags & 4) {
                n = a;
                var u = t.memoizedProps;
                switch (t.type) {
                  case "button":
                  case "input":
                  case "select":
                  case "textarea":
                    u.autoFocus && n.focus();
                    break;
                  case "img":
                    u.src && (n.src = u.src);
                }
              }
              break;
            case 6:
              break;
            case 4:
              break;
            case 12:
              break;
            case 13:
              if (t.memoizedState === null) {
                var c = t.alternate;
                if (c !== null) {
                  var p = c.memoizedState;
                  if (p !== null) {
                    var g = p.dehydrated;
                    g !== null && Kn(g);
                  }
                }
              }
              break;
            case 19:
            case 17:
            case 21:
            case 22:
            case 23:
            case 25:
              break;
            default:
              throw Error(S(163));
          }
        ue || t.flags & 512 && eo(t);
      } catch (h) {
        Y(t, t.return, h);
      }
    }
    if (t === e) {
      P = null;
      break;
    }
    if (n = t.sibling, n !== null) {
      n.return = t.return, P = n;
      break;
    }
    P = t.return;
  }
}
function ia(e) {
  for (; P !== null; ) {
    var t = P;
    if (t === e) {
      P = null;
      break;
    }
    var n = t.sibling;
    if (n !== null) {
      n.return = t.return, P = n;
      break;
    }
    P = t.return;
  }
}
function oa(e) {
  for (; P !== null; ) {
    var t = P;
    try {
      switch (t.tag) {
        case 0:
        case 11:
        case 15:
          var n = t.return;
          try {
            Tl(4, t);
          } catch (u) {
            Y(t, n, u);
          }
          break;
        case 1:
          var r = t.stateNode;
          if (typeof r.componentDidMount == "function") {
            var l = t.return;
            try {
              r.componentDidMount();
            } catch (u) {
              Y(t, l, u);
            }
          }
          var i = t.return;
          try {
            eo(t);
          } catch (u) {
            Y(t, i, u);
          }
          break;
        case 5:
          var o = t.return;
          try {
            eo(t);
          } catch (u) {
            Y(t, o, u);
          }
      }
    } catch (u) {
      Y(t, t.return, u);
    }
    if (t === e) {
      P = null;
      break;
    }
    var a = t.sibling;
    if (a !== null) {
      a.return = t.return, P = a;
      break;
    }
    P = t.return;
  }
}
var ap = Math.ceil, fl = rt.ReactCurrentDispatcher, Wo = rt.ReactCurrentOwner, Le = rt.ReactCurrentBatchConfig, I = 0, ne = null, Z = null, ie = 0, Se = 0, tn = Nt(0), b = 0, rr = null, Ut = 0, zl = 0, Ko = 0, Un = null, ge = null, Go = 0, gn = 1 / 0, Ge = null, dl = !1, ro = null, yt = null, _r = !1, dt = null, pl = 0, An = 0, lo = null, Vr = -1, Hr = 0;
function de() {
  return I & 6 ? q() : Vr !== -1 ? Vr : Vr = q();
}
function wt(e) {
  return e.mode & 1 ? I & 2 && ie !== 0 ? ie & -ie : Wd.transition !== null ? (Hr === 0 && (Hr = pu()), Hr) : (e = O, e !== 0 || (e = window.event, e = e === void 0 ? 16 : xu(e.type)), e) : 1;
}
function Ue(e, t, n, r) {
  if (50 < An)
    throw An = 0, lo = null, Error(S(185));
  ir(e, n, r), (!(I & 2) || e !== ne) && (e === ne && (!(I & 2) && (zl |= n), b === 4 && ct(e, ie)), xe(e, r), n === 1 && I === 0 && !(t.mode & 1) && (gn = q() + 500, El && Ct()));
}
function xe(e, t) {
  var n = e.callbackNode;
  Wf(e, t);
  var r = qr(e, e === ne ? ie : 0);
  if (r === 0)
    n !== null && hs(n), e.callbackNode = null, e.callbackPriority = 0;
  else if (t = r & -r, e.callbackPriority !== t) {
    if (n != null && hs(n), t === 1)
      e.tag === 0 ? Qd(sa.bind(null, e)) : Uu(sa.bind(null, e)), Ad(function() {
        !(I & 6) && Ct();
      }), n = null;
    else {
      switch (mu(r)) {
        case 1:
          n = wo;
          break;
        case 4:
          n = fu;
          break;
        case 16:
          n = Xr;
          break;
        case 536870912:
          n = du;
          break;
        default:
          n = Xr;
      }
      n = Oc(n, Lc.bind(null, e));
    }
    e.callbackPriority = t, e.callbackNode = n;
  }
}
function Lc(e, t) {
  if (Vr = -1, Hr = 0, I & 6)
    throw Error(S(327));
  var n = e.callbackNode;
  if (an() && e.callbackNode !== n)
    return null;
  var r = qr(e, e === ne ? ie : 0);
  if (r === 0)
    return null;
  if (r & 30 || r & e.expiredLanes || t)
    t = ml(e, r);
  else {
    t = r;
    var l = I;
    I |= 2;
    var i = Rc();
    (ne !== e || ie !== t) && (Ge = null, gn = q() + 500, Mt(e, t));
    do
      try {
        fp();
        break;
      } catch (a) {
        Dc(e, a);
      }
    while (!0);
    Do(), fl.current = i, I = l, Z !== null ? t = 0 : (ne = null, ie = 0, t = b);
  }
  if (t !== 0) {
    if (t === 2 && (l = Li(e), l !== 0 && (r = l, t = io(e, l))), t === 1)
      throw n = rr, Mt(e, 0), ct(e, r), xe(e, q()), n;
    if (t === 6)
      ct(e, r);
    else {
      if (l = e.current.alternate, !(r & 30) && !up(l) && (t = ml(e, r), t === 2 && (i = Li(e), i !== 0 && (r = i, t = io(e, i))), t === 1))
        throw n = rr, Mt(e, 0), ct(e, r), xe(e, q()), n;
      switch (e.finishedWork = l, e.finishedLanes = r, t) {
        case 0:
        case 1:
          throw Error(S(345));
        case 2:
          zt(e, ge, Ge);
          break;
        case 3:
          if (ct(e, r), (r & 130023424) === r && (t = Go + 500 - q(), 10 < t)) {
            if (qr(e, 0) !== 0)
              break;
            if (l = e.suspendedLanes, (l & r) !== r) {
              de(), e.pingedLanes |= e.suspendedLanes & l;
              break;
            }
            e.timeoutHandle = Ui(zt.bind(null, e, ge, Ge), t);
            break;
          }
          zt(e, ge, Ge);
          break;
        case 4:
          if (ct(e, r), (r & 4194240) === r)
            break;
          for (t = e.eventTimes, l = -1; 0 < r; ) {
            var o = 31 - Oe(r);
            i = 1 << o, o = t[o], o > l && (l = o), r &= ~i;
          }
          if (r = l, r = q() - r, r = (120 > r ? 120 : 480 > r ? 480 : 1080 > r ? 1080 : 1920 > r ? 1920 : 3e3 > r ? 3e3 : 4320 > r ? 4320 : 1960 * ap(r / 1960)) - r, 10 < r) {
            e.timeoutHandle = Ui(zt.bind(null, e, ge, Ge), r);
            break;
          }
          zt(e, ge, Ge);
          break;
        case 5:
          zt(e, ge, Ge);
          break;
        default:
          throw Error(S(329));
      }
    }
  }
  return xe(e, q()), e.callbackNode === n ? Lc.bind(null, e) : null;
}
function io(e, t) {
  var n = Un;
  return e.current.memoizedState.isDehydrated && (Mt(e, t).flags |= 256), e = ml(e, t), e !== 2 && (t = ge, ge = n, t !== null && oo(t)), e;
}
function oo(e) {
  ge === null ? ge = e : ge.push.apply(ge, e);
}
function up(e) {
  for (var t = e; ; ) {
    if (t.flags & 16384) {
      var n = t.updateQueue;
      if (n !== null && (n = n.stores, n !== null))
        for (var r = 0; r < n.length; r++) {
          var l = n[r], i = l.getSnapshot;
          l = l.value;
          try {
            if (!Ae(i(), l))
              return !1;
          } catch {
            return !1;
          }
        }
    }
    if (n = t.child, t.subtreeFlags & 16384 && n !== null)
      n.return = t, t = n;
    else {
      if (t === e)
        break;
      for (; t.sibling === null; ) {
        if (t.return === null || t.return === e)
          return !0;
        t = t.return;
      }
      t.sibling.return = t.return, t = t.sibling;
    }
  }
  return !0;
}
function ct(e, t) {
  for (t &= ~Ko, t &= ~zl, e.suspendedLanes |= t, e.pingedLanes &= ~t, e = e.expirationTimes; 0 < t; ) {
    var n = 31 - Oe(t), r = 1 << n;
    e[n] = -1, t &= ~r;
  }
}
function sa(e) {
  if (I & 6)
    throw Error(S(327));
  an();
  var t = qr(e, 0);
  if (!(t & 1))
    return xe(e, q()), null;
  var n = ml(e, t);
  if (e.tag !== 0 && n === 2) {
    var r = Li(e);
    r !== 0 && (t = r, n = io(e, r));
  }
  if (n === 1)
    throw n = rr, Mt(e, 0), ct(e, t), xe(e, q()), n;
  if (n === 6)
    throw Error(S(345));
  return e.finishedWork = e.current.alternate, e.finishedLanes = t, zt(e, ge, Ge), xe(e, q()), null;
}
function Yo(e, t) {
  var n = I;
  I |= 1;
  try {
    return e(t);
  } finally {
    I = n, I === 0 && (gn = q() + 500, El && Ct());
  }
}
function At(e) {
  dt !== null && dt.tag === 0 && !(I & 6) && an();
  var t = I;
  I |= 1;
  var n = Le.transition, r = O;
  try {
    if (Le.transition = null, O = 1, e)
      return e();
  } finally {
    O = r, Le.transition = n, I = t, !(I & 6) && Ct();
  }
}
function Xo() {
  Se = tn.current, V(tn);
}
function Mt(e, t) {
  e.finishedWork = null, e.finishedLanes = 0;
  var n = e.timeoutHandle;
  if (n !== -1 && (e.timeoutHandle = -1, Ud(n)), Z !== null)
    for (n = Z.return; n !== null; ) {
      var r = n;
      switch (To(r), r.tag) {
        case 1:
          r = r.type.childContextTypes, r != null && tl();
          break;
        case 3:
          mn(), V(ye), V(ce), Oo();
          break;
        case 5:
          $o(r);
          break;
        case 4:
          mn();
          break;
        case 13:
          V(Q);
          break;
        case 19:
          V(Q);
          break;
        case 10:
          Ro(r.type._context);
          break;
        case 22:
        case 23:
          Xo();
      }
      n = n.return;
    }
  if (ne = e, Z = e = xt(e.current, null), ie = Se = t, b = 0, rr = null, Ko = zl = Ut = 0, ge = Un = null, Dt !== null) {
    for (t = 0; t < Dt.length; t++)
      if (n = Dt[t], r = n.interleaved, r !== null) {
        n.interleaved = null;
        var l = r.next, i = n.pending;
        if (i !== null) {
          var o = i.next;
          i.next = l, r.next = o;
        }
        n.pending = r;
      }
    Dt = null;
  }
  return e;
}
function Dc(e, t) {
  do {
    var n = Z;
    try {
      if (Do(), Ur.current = cl, ul) {
        for (var r = W.memoizedState; r !== null; ) {
          var l = r.queue;
          l !== null && (l.pending = null), r = r.next;
        }
        ul = !1;
      }
      if (Ot = 0, te = J = W = null, $n = !1, er = 0, Wo.current = null, n === null || n.return === null) {
        b = 1, rr = t, Z = null;
        break;
      }
      e: {
        var i = e, o = n.return, a = n, u = t;
        if (t = ie, a.flags |= 32768, u !== null && typeof u == "object" && typeof u.then == "function") {
          var c = u, p = a, g = p.tag;
          if (!(p.mode & 1) && (g === 0 || g === 11 || g === 15)) {
            var h = p.alternate;
            h ? (p.updateQueue = h.updateQueue, p.memoizedState = h.memoizedState, p.lanes = h.lanes) : (p.updateQueue = null, p.memoizedState = null);
          }
          var y = Ys(o);
          if (y !== null) {
            y.flags &= -257, Xs(y, o, a, i, t), y.mode & 1 && Gs(i, c, t), t = y, u = c;
            var v = t.updateQueue;
            if (v === null) {
              var w = /* @__PURE__ */ new Set();
              w.add(u), t.updateQueue = w;
            } else
              v.add(u);
            break e;
          } else {
            if (!(t & 1)) {
              Gs(i, c, t), qo();
              break e;
            }
            u = Error(S(426));
          }
        } else if (H && a.mode & 1) {
          var z = Ys(o);
          if (z !== null) {
            !(z.flags & 65536) && (z.flags |= 256), Xs(z, o, a, i, t), zo(hn(u, a));
            break e;
          }
        }
        i = u = hn(u, a), b !== 4 && (b = 2), Un === null ? Un = [i] : Un.push(i), i = o;
        do {
          switch (i.tag) {
            case 3:
              i.flags |= 65536, t &= -t, i.lanes |= t;
              var d = hc(i, u, t);
              As(i, d);
              break e;
            case 1:
              a = u;
              var f = i.type, m = i.stateNode;
              if (!(i.flags & 128) && (typeof f.getDerivedStateFromError == "function" || m !== null && typeof m.componentDidCatch == "function" && (yt === null || !yt.has(m)))) {
                i.flags |= 65536, t &= -t, i.lanes |= t;
                var x = gc(i, a, t);
                As(i, x);
                break e;
              }
          }
          i = i.return;
        } while (i !== null);
      }
      Fc(n);
    } catch (j) {
      t = j, Z === n && n !== null && (Z = n = n.return);
      continue;
    }
    break;
  } while (!0);
}
function Rc() {
  var e = fl.current;
  return fl.current = cl, e === null ? cl : e;
}
function qo() {
  (b === 0 || b === 3 || b === 2) && (b = 4), ne === null || !(Ut & 268435455) && !(zl & 268435455) || ct(ne, ie);
}
function ml(e, t) {
  var n = I;
  I |= 2;
  var r = Rc();
  (ne !== e || ie !== t) && (Ge = null, Mt(e, t));
  do
    try {
      cp();
      break;
    } catch (l) {
      Dc(e, l);
    }
  while (!0);
  if (Do(), I = n, fl.current = r, Z !== null)
    throw Error(S(261));
  return ne = null, ie = 0, b;
}
function cp() {
  for (; Z !== null; )
    Mc(Z);
}
function fp() {
  for (; Z !== null && !If(); )
    Mc(Z);
}
function Mc(e) {
  var t = $c(e.alternate, e, Se);
  e.memoizedProps = e.pendingProps, t === null ? Fc(e) : Z = t, Wo.current = null;
}
function Fc(e) {
  var t = e;
  do {
    var n = t.alternate;
    if (e = t.return, t.flags & 32768) {
      if (n = lp(n, t), n !== null) {
        n.flags &= 32767, Z = n;
        return;
      }
      if (e !== null)
        e.flags |= 32768, e.subtreeFlags = 0, e.deletions = null;
      else {
        b = 6, Z = null;
        return;
      }
    } else if (n = rp(n, t, Se), n !== null) {
      Z = n;
      return;
    }
    if (t = t.sibling, t !== null) {
      Z = t;
      return;
    }
    Z = t = e;
  } while (t !== null);
  b === 0 && (b = 5);
}
function zt(e, t, n) {
  var r = O, l = Le.transition;
  try {
    Le.transition = null, O = 1, dp(e, t, n, r);
  } finally {
    Le.transition = l, O = r;
  }
  return null;
}
function dp(e, t, n, r) {
  do
    an();
  while (dt !== null);
  if (I & 6)
    throw Error(S(327));
  n = e.finishedWork;
  var l = e.finishedLanes;
  if (n === null)
    return null;
  if (e.finishedWork = null, e.finishedLanes = 0, n === e.current)
    throw Error(S(177));
  e.callbackNode = null, e.callbackPriority = 0;
  var i = n.lanes | n.childLanes;
  if (Kf(e, i), e === ne && (Z = ne = null, ie = 0), !(n.subtreeFlags & 2064) && !(n.flags & 2064) || _r || (_r = !0, Oc(Xr, function() {
    return an(), null;
  })), i = (n.flags & 15990) !== 0, n.subtreeFlags & 15990 || i) {
    i = Le.transition, Le.transition = null;
    var o = O;
    O = 1;
    var a = I;
    I |= 4, Wo.current = null, op(e, n), Tc(n, e), Dd($i), Zr = !!Ii, $i = Ii = null, e.current = n, sp(n), $f(), I = a, O = o, Le.transition = i;
  } else
    e.current = n;
  if (_r && (_r = !1, dt = e, pl = l), i = e.pendingLanes, i === 0 && (yt = null), Af(n.stateNode), xe(e, q()), t !== null)
    for (r = e.onRecoverableError, n = 0; n < t.length; n++)
      l = t[n], r(l.value, { componentStack: l.stack, digest: l.digest });
  if (dl)
    throw dl = !1, e = ro, ro = null, e;
  return pl & 1 && e.tag !== 0 && an(), i = e.pendingLanes, i & 1 ? e === lo ? An++ : (An = 0, lo = e) : An = 0, Ct(), null;
}
function an() {
  if (dt !== null) {
    var e = mu(pl), t = Le.transition, n = O;
    try {
      if (Le.transition = null, O = 16 > e ? 16 : e, dt === null)
        var r = !1;
      else {
        if (e = dt, dt = null, pl = 0, I & 6)
          throw Error(S(331));
        var l = I;
        for (I |= 4, P = e.current; P !== null; ) {
          var i = P, o = i.child;
          if (P.flags & 16) {
            var a = i.deletions;
            if (a !== null) {
              for (var u = 0; u < a.length; u++) {
                var c = a[u];
                for (P = c; P !== null; ) {
                  var p = P;
                  switch (p.tag) {
                    case 0:
                    case 11:
                    case 15:
                      On(8, p, i);
                  }
                  var g = p.child;
                  if (g !== null)
                    g.return = p, P = g;
                  else
                    for (; P !== null; ) {
                      p = P;
                      var h = p.sibling, y = p.return;
                      if (Ec(p), p === c) {
                        P = null;
                        break;
                      }
                      if (h !== null) {
                        h.return = y, P = h;
                        break;
                      }
                      P = y;
                    }
                }
              }
              var v = i.alternate;
              if (v !== null) {
                var w = v.child;
                if (w !== null) {
                  v.child = null;
                  do {
                    var z = w.sibling;
                    w.sibling = null, w = z;
                  } while (w !== null);
                }
              }
              P = i;
            }
          }
          if (i.subtreeFlags & 2064 && o !== null)
            o.return = i, P = o;
          else
            e:
              for (; P !== null; ) {
                if (i = P, i.flags & 2048)
                  switch (i.tag) {
                    case 0:
                    case 11:
                    case 15:
                      On(9, i, i.return);
                  }
                var d = i.sibling;
                if (d !== null) {
                  d.return = i.return, P = d;
                  break e;
                }
                P = i.return;
              }
        }
        var f = e.current;
        for (P = f; P !== null; ) {
          o = P;
          var m = o.child;
          if (o.subtreeFlags & 2064 && m !== null)
            m.return = o, P = m;
          else
            e:
              for (o = f; P !== null; ) {
                if (a = P, a.flags & 2048)
                  try {
                    switch (a.tag) {
                      case 0:
                      case 11:
                      case 15:
                        Tl(9, a);
                    }
                  } catch (j) {
                    Y(a, a.return, j);
                  }
                if (a === o) {
                  P = null;
                  break e;
                }
                var x = a.sibling;
                if (x !== null) {
                  x.return = a.return, P = x;
                  break e;
                }
                P = a.return;
              }
        }
        if (I = l, Ct(), Qe && typeof Qe.onPostCommitFiberRoot == "function")
          try {
            Qe.onPostCommitFiberRoot(Sl, e);
          } catch {
          }
        r = !0;
      }
      return r;
    } finally {
      O = n, Le.transition = t;
    }
  }
  return !1;
}
function aa(e, t, n) {
  t = hn(n, t), t = hc(e, t, 1), e = vt(e, t, 1), t = de(), e !== null && (ir(e, 1, t), xe(e, t));
}
function Y(e, t, n) {
  if (e.tag === 3)
    aa(e, e, n);
  else
    for (; t !== null; ) {
      if (t.tag === 3) {
        aa(t, e, n);
        break;
      } else if (t.tag === 1) {
        var r = t.stateNode;
        if (typeof t.type.getDerivedStateFromError == "function" || typeof r.componentDidCatch == "function" && (yt === null || !yt.has(r))) {
          e = hn(n, e), e = gc(t, e, 1), t = vt(t, e, 1), e = de(), t !== null && (ir(t, 1, e), xe(t, e));
          break;
        }
      }
      t = t.return;
    }
}
function pp(e, t, n) {
  var r = e.pingCache;
  r !== null && r.delete(t), t = de(), e.pingedLanes |= e.suspendedLanes & n, ne === e && (ie & n) === n && (b === 4 || b === 3 && (ie & 130023424) === ie && 500 > q() - Go ? Mt(e, 0) : Ko |= n), xe(e, t);
}
function Ic(e, t) {
  t === 0 && (e.mode & 1 ? (t = vr, vr <<= 1, !(vr & 130023424) && (vr = 4194304)) : t = 1);
  var n = de();
  e = tt(e, t), e !== null && (ir(e, t, n), xe(e, n));
}
function mp(e) {
  var t = e.memoizedState, n = 0;
  t !== null && (n = t.retryLane), Ic(e, n);
}
function hp(e, t) {
  var n = 0;
  switch (e.tag) {
    case 13:
      var r = e.stateNode, l = e.memoizedState;
      l !== null && (n = l.retryLane);
      break;
    case 19:
      r = e.stateNode;
      break;
    default:
      throw Error(S(314));
  }
  r !== null && r.delete(t), Ic(e, n);
}
var $c;
$c = function(e, t, n) {
  if (e !== null)
    if (e.memoizedProps !== t.pendingProps || ye.current)
      ve = !0;
    else {
      if (!(e.lanes & n) && !(t.flags & 128))
        return ve = !1, np(e, t, n);
      ve = !!(e.flags & 131072);
    }
  else
    ve = !1, H && t.flags & 1048576 && Au(t, ll, t.index);
  switch (t.lanes = 0, t.tag) {
    case 2:
      var r = t.type;
      Br(e, t), e = t.pendingProps;
      var l = fn(t, ce.current);
      sn(t, n), l = Ao(null, t, r, e, l, n);
      var i = Bo();
      return t.flags |= 1, typeof l == "object" && l !== null && typeof l.render == "function" && l.$$typeof === void 0 ? (t.tag = 1, t.memoizedState = null, t.updateQueue = null, we(r) ? (i = !0, nl(t)) : i = !1, t.memoizedState = l.state !== null && l.state !== void 0 ? l.state : null, Fo(t), l.updater = _l, t.stateNode = l, l._reactInternals = t, Ki(t, r, e, n), t = Xi(null, t, r, !0, i, n)) : (t.tag = 0, H && i && Po(t), fe(null, t, l, n), t = t.child), t;
    case 16:
      r = t.elementType;
      e: {
        switch (Br(e, t), e = t.pendingProps, l = r._init, r = l(r._payload), t.type = r, l = t.tag = vp(r), e = Fe(r, e), l) {
          case 0:
            t = Yi(null, t, r, e, n);
            break e;
          case 1:
            t = Js(null, t, r, e, n);
            break e;
          case 11:
            t = qs(null, t, r, e, n);
            break e;
          case 14:
            t = Zs(null, t, r, Fe(r.type, e), n);
            break e;
        }
        throw Error(S(
          306,
          r,
          ""
        ));
      }
      return t;
    case 0:
      return r = t.type, l = t.pendingProps, l = t.elementType === r ? l : Fe(r, l), Yi(e, t, r, l, n);
    case 1:
      return r = t.type, l = t.pendingProps, l = t.elementType === r ? l : Fe(r, l), Js(e, t, r, l, n);
    case 3:
      e: {
        if (xc(t), e === null)
          throw Error(S(387));
        r = t.pendingProps, i = t.memoizedState, l = i.element, Qu(e, t), sl(t, r, null, n);
        var o = t.memoizedState;
        if (r = o.element, i.isDehydrated)
          if (i = { element: r, isDehydrated: !1, cache: o.cache, pendingSuspenseBoundaries: o.pendingSuspenseBoundaries, transitions: o.transitions }, t.updateQueue.baseState = i, t.memoizedState = i, t.flags & 256) {
            l = hn(Error(S(423)), t), t = bs(e, t, r, n, l);
            break e;
          } else if (r !== l) {
            l = hn(Error(S(424)), t), t = bs(e, t, r, n, l);
            break e;
          } else
            for (je = gt(t.stateNode.containerInfo.firstChild), ke = t, H = !0, $e = null, n = Yu(t, null, r, n), t.child = n; n; )
              n.flags = n.flags & -3 | 4096, n = n.sibling;
        else {
          if (dn(), r === l) {
            t = nt(e, t, n);
            break e;
          }
          fe(e, t, r, n);
        }
        t = t.child;
      }
      return t;
    case 5:
      return Xu(t), e === null && Hi(t), r = t.type, l = t.pendingProps, i = e !== null ? e.memoizedProps : null, o = l.children, Oi(r, l) ? o = null : i !== null && Oi(r, i) && (t.flags |= 32), wc(e, t), fe(e, t, o, n), t.child;
    case 6:
      return e === null && Hi(t), null;
    case 13:
      return Sc(e, t, n);
    case 4:
      return Io(t, t.stateNode.containerInfo), r = t.pendingProps, e === null ? t.child = pn(t, null, r, n) : fe(e, t, r, n), t.child;
    case 11:
      return r = t.type, l = t.pendingProps, l = t.elementType === r ? l : Fe(r, l), qs(e, t, r, l, n);
    case 7:
      return fe(e, t, t.pendingProps, n), t.child;
    case 8:
      return fe(e, t, t.pendingProps.children, n), t.child;
    case 12:
      return fe(e, t, t.pendingProps.children, n), t.child;
    case 10:
      e: {
        if (r = t.type._context, l = t.pendingProps, i = t.memoizedProps, o = l.value, A(il, r._currentValue), r._currentValue = o, i !== null)
          if (Ae(i.value, o)) {
            if (i.children === l.children && !ye.current) {
              t = nt(e, t, n);
              break e;
            }
          } else
            for (i = t.child, i !== null && (i.return = t); i !== null; ) {
              var a = i.dependencies;
              if (a !== null) {
                o = i.child;
                for (var u = a.firstContext; u !== null; ) {
                  if (u.context === r) {
                    if (i.tag === 1) {
                      u = Je(-1, n & -n), u.tag = 2;
                      var c = i.updateQueue;
                      if (c !== null) {
                        c = c.shared;
                        var p = c.pending;
                        p === null ? u.next = u : (u.next = p.next, p.next = u), c.pending = u;
                      }
                    }
                    i.lanes |= n, u = i.alternate, u !== null && (u.lanes |= n), Qi(
                      i.return,
                      n,
                      t
                    ), a.lanes |= n;
                    break;
                  }
                  u = u.next;
                }
              } else if (i.tag === 10)
                o = i.type === t.type ? null : i.child;
              else if (i.tag === 18) {
                if (o = i.return, o === null)
                  throw Error(S(341));
                o.lanes |= n, a = o.alternate, a !== null && (a.lanes |= n), Qi(o, n, t), o = i.sibling;
              } else
                o = i.child;
              if (o !== null)
                o.return = i;
              else
                for (o = i; o !== null; ) {
                  if (o === t) {
                    o = null;
                    break;
                  }
                  if (i = o.sibling, i !== null) {
                    i.return = o.return, o = i;
                    break;
                  }
                  o = o.return;
                }
              i = o;
            }
        fe(e, t, l.children, n), t = t.child;
      }
      return t;
    case 9:
      return l = t.type, r = t.pendingProps.children, sn(t, n), l = De(l), r = r(l), t.flags |= 1, fe(e, t, r, n), t.child;
    case 14:
      return r = t.type, l = Fe(r, t.pendingProps), l = Fe(r.type, l), Zs(e, t, r, l, n);
    case 15:
      return vc(e, t, t.type, t.pendingProps, n);
    case 17:
      return r = t.type, l = t.pendingProps, l = t.elementType === r ? l : Fe(r, l), Br(e, t), t.tag = 1, we(r) ? (e = !0, nl(t)) : e = !1, sn(t, n), Ku(t, r, l), Ki(t, r, l, n), Xi(null, t, r, !0, e, n);
    case 19:
      return jc(e, t, n);
    case 22:
      return yc(e, t, n);
  }
  throw Error(S(156, t.tag));
};
function Oc(e, t) {
  return cu(e, t);
}
function gp(e, t, n, r) {
  this.tag = e, this.key = n, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.ref = null, this.pendingProps = t, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = r, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
}
function ze(e, t, n, r) {
  return new gp(e, t, n, r);
}
function Zo(e) {
  return e = e.prototype, !(!e || !e.isReactComponent);
}
function vp(e) {
  if (typeof e == "function")
    return Zo(e) ? 1 : 0;
  if (e != null) {
    if (e = e.$$typeof, e === go)
      return 11;
    if (e === vo)
      return 14;
  }
  return 2;
}
function xt(e, t) {
  var n = e.alternate;
  return n === null ? (n = ze(e.tag, t, e.key, e.mode), n.elementType = e.elementType, n.type = e.type, n.stateNode = e.stateNode, n.alternate = e, e.alternate = n) : (n.pendingProps = t, n.type = e.type, n.flags = 0, n.subtreeFlags = 0, n.deletions = null), n.flags = e.flags & 14680064, n.childLanes = e.childLanes, n.lanes = e.lanes, n.child = e.child, n.memoizedProps = e.memoizedProps, n.memoizedState = e.memoizedState, n.updateQueue = e.updateQueue, t = e.dependencies, n.dependencies = t === null ? null : { lanes: t.lanes, firstContext: t.firstContext }, n.sibling = e.sibling, n.index = e.index, n.ref = e.ref, n;
}
function Qr(e, t, n, r, l, i) {
  var o = 2;
  if (r = e, typeof e == "function")
    Zo(e) && (o = 1);
  else if (typeof e == "string")
    o = 5;
  else
    e:
      switch (e) {
        case Wt:
          return Ft(n.children, l, i, t);
        case ho:
          o = 8, l |= 8;
          break;
        case gi:
          return e = ze(12, n, t, l | 2), e.elementType = gi, e.lanes = i, e;
        case vi:
          return e = ze(13, n, t, l), e.elementType = vi, e.lanes = i, e;
        case yi:
          return e = ze(19, n, t, l), e.elementType = yi, e.lanes = i, e;
        case Ga:
          return Ll(n, l, i, t);
        default:
          if (typeof e == "object" && e !== null)
            switch (e.$$typeof) {
              case Wa:
                o = 10;
                break e;
              case Ka:
                o = 9;
                break e;
              case go:
                o = 11;
                break e;
              case vo:
                o = 14;
                break e;
              case st:
                o = 16, r = null;
                break e;
            }
          throw Error(S(130, e == null ? e : typeof e, ""));
      }
  return t = ze(o, n, t, l), t.elementType = e, t.type = r, t.lanes = i, t;
}
function Ft(e, t, n, r) {
  return e = ze(7, e, r, t), e.lanes = n, e;
}
function Ll(e, t, n, r) {
  return e = ze(22, e, r, t), e.elementType = Ga, e.lanes = n, e.stateNode = { isHidden: !1 }, e;
}
function ai(e, t, n) {
  return e = ze(6, e, null, t), e.lanes = n, e;
}
function ui(e, t, n) {
  return t = ze(4, e.children !== null ? e.children : [], e.key, t), t.lanes = n, t.stateNode = { containerInfo: e.containerInfo, pendingChildren: null, implementation: e.implementation }, t;
}
function yp(e, t, n, r, l) {
  this.tag = t, this.containerInfo = e, this.finishedWork = this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = -1, this.callbackNode = this.pendingContext = this.context = null, this.callbackPriority = 0, this.eventTimes = Hl(0), this.expirationTimes = Hl(-1), this.entangledLanes = this.finishedLanes = this.mutableReadLanes = this.expiredLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = Hl(0), this.identifierPrefix = r, this.onRecoverableError = l, this.mutableSourceEagerHydrationData = null;
}
function Jo(e, t, n, r, l, i, o, a, u) {
  return e = new yp(e, t, n, a, u), t === 1 ? (t = 1, i === !0 && (t |= 8)) : t = 0, i = ze(3, null, null, t), e.current = i, i.stateNode = e, i.memoizedState = { element: r, isDehydrated: n, cache: null, transitions: null, pendingSuspenseBoundaries: null }, Fo(i), e;
}
function wp(e, t, n) {
  var r = 3 < arguments.length && arguments[3] !== void 0 ? arguments[3] : null;
  return { $$typeof: Qt, key: r == null ? null : "" + r, children: e, containerInfo: t, implementation: n };
}
function Uc(e) {
  if (!e)
    return jt;
  e = e._reactInternals;
  e: {
    if (Vt(e) !== e || e.tag !== 1)
      throw Error(S(170));
    var t = e;
    do {
      switch (t.tag) {
        case 3:
          t = t.stateNode.context;
          break e;
        case 1:
          if (we(t.type)) {
            t = t.stateNode.__reactInternalMemoizedMergedChildContext;
            break e;
          }
      }
      t = t.return;
    } while (t !== null);
    throw Error(S(171));
  }
  if (e.tag === 1) {
    var n = e.type;
    if (we(n))
      return Ou(e, n, t);
  }
  return t;
}
function Ac(e, t, n, r, l, i, o, a, u) {
  return e = Jo(n, r, !0, e, l, i, o, a, u), e.context = Uc(null), n = e.current, r = de(), l = wt(n), i = Je(r, l), i.callback = t ?? null, vt(n, i, l), e.current.lanes = l, ir(e, l, r), xe(e, r), e;
}
function Dl(e, t, n, r) {
  var l = t.current, i = de(), o = wt(l);
  return n = Uc(n), t.context === null ? t.context = n : t.pendingContext = n, t = Je(i, o), t.payload = { element: e }, r = r === void 0 ? null : r, r !== null && (t.callback = r), e = vt(l, t, o), e !== null && (Ue(e, l, o, i), Or(e, l, o)), o;
}
function hl(e) {
  if (e = e.current, !e.child)
    return null;
  switch (e.child.tag) {
    case 5:
      return e.child.stateNode;
    default:
      return e.child.stateNode;
  }
}
function ua(e, t) {
  if (e = e.memoizedState, e !== null && e.dehydrated !== null) {
    var n = e.retryLane;
    e.retryLane = n !== 0 && n < t ? n : t;
  }
}
function bo(e, t) {
  ua(e, t), (e = e.alternate) && ua(e, t);
}
function xp() {
  return null;
}
var Bc = typeof reportError == "function" ? reportError : function(e) {
  console.error(e);
};
function es(e) {
  this._internalRoot = e;
}
Rl.prototype.render = es.prototype.render = function(e) {
  var t = this._internalRoot;
  if (t === null)
    throw Error(S(409));
  Dl(e, t, null, null);
};
Rl.prototype.unmount = es.prototype.unmount = function() {
  var e = this._internalRoot;
  if (e !== null) {
    this._internalRoot = null;
    var t = e.containerInfo;
    At(function() {
      Dl(null, e, null, null);
    }), t[et] = null;
  }
};
function Rl(e) {
  this._internalRoot = e;
}
Rl.prototype.unstable_scheduleHydration = function(e) {
  if (e) {
    var t = vu();
    e = { blockedOn: null, target: e, priority: t };
    for (var n = 0; n < ut.length && t !== 0 && t < ut[n].priority; n++)
      ;
    ut.splice(n, 0, e), n === 0 && wu(e);
  }
};
function ts(e) {
  return !(!e || e.nodeType !== 1 && e.nodeType !== 9 && e.nodeType !== 11);
}
function Ml(e) {
  return !(!e || e.nodeType !== 1 && e.nodeType !== 9 && e.nodeType !== 11 && (e.nodeType !== 8 || e.nodeValue !== " react-mount-point-unstable "));
}
function ca() {
}
function Sp(e, t, n, r, l) {
  if (l) {
    if (typeof r == "function") {
      var i = r;
      r = function() {
        var c = hl(o);
        i.call(c);
      };
    }
    var o = Ac(t, r, e, 0, null, !1, !1, "", ca);
    return e._reactRootContainer = o, e[et] = o.current, Xn(e.nodeType === 8 ? e.parentNode : e), At(), o;
  }
  for (; l = e.lastChild; )
    e.removeChild(l);
  if (typeof r == "function") {
    var a = r;
    r = function() {
      var c = hl(u);
      a.call(c);
    };
  }
  var u = Jo(e, 0, !1, null, null, !1, !1, "", ca);
  return e._reactRootContainer = u, e[et] = u.current, Xn(e.nodeType === 8 ? e.parentNode : e), At(function() {
    Dl(t, u, n, r);
  }), u;
}
function Fl(e, t, n, r, l) {
  var i = n._reactRootContainer;
  if (i) {
    var o = i;
    if (typeof l == "function") {
      var a = l;
      l = function() {
        var u = hl(o);
        a.call(u);
      };
    }
    Dl(t, o, e, l);
  } else
    o = Sp(n, t, e, l, r);
  return hl(o);
}
hu = function(e) {
  switch (e.tag) {
    case 3:
      var t = e.stateNode;
      if (t.current.memoizedState.isDehydrated) {
        var n = zn(t.pendingLanes);
        n !== 0 && (xo(t, n | 1), xe(t, q()), !(I & 6) && (gn = q() + 500, Ct()));
      }
      break;
    case 13:
      At(function() {
        var r = tt(e, 1);
        if (r !== null) {
          var l = de();
          Ue(r, e, 1, l);
        }
      }), bo(e, 1);
  }
};
So = function(e) {
  if (e.tag === 13) {
    var t = tt(e, 134217728);
    if (t !== null) {
      var n = de();
      Ue(t, e, 134217728, n);
    }
    bo(e, 134217728);
  }
};
gu = function(e) {
  if (e.tag === 13) {
    var t = wt(e), n = tt(e, t);
    if (n !== null) {
      var r = de();
      Ue(n, e, t, r);
    }
    bo(e, t);
  }
};
vu = function() {
  return O;
};
yu = function(e, t) {
  var n = O;
  try {
    return O = e, t();
  } finally {
    O = n;
  }
};
Pi = function(e, t, n) {
  switch (t) {
    case "input":
      if (Si(e, n), t = n.name, n.type === "radio" && t != null) {
        for (n = e; n.parentNode; )
          n = n.parentNode;
        for (n = n.querySelectorAll("input[name=" + JSON.stringify("" + t) + '][type="radio"]'), t = 0; t < n.length; t++) {
          var r = n[t];
          if (r !== e && r.form === e.form) {
            var l = Cl(r);
            if (!l)
              throw Error(S(90));
            Xa(r), Si(r, l);
          }
        }
      }
      break;
    case "textarea":
      Za(e, n);
      break;
    case "select":
      t = n.value, t != null && nn(e, !!n.multiple, t, !1);
  }
};
lu = Yo;
iu = At;
var jp = { usingClientEntryPoint: !1, Events: [sr, Xt, Cl, nu, ru, Yo] }, _n = { findFiberByHostInstance: Lt, bundleType: 0, version: "18.2.0", rendererPackageName: "react-dom" }, kp = { bundleType: _n.bundleType, version: _n.version, rendererPackageName: _n.rendererPackageName, rendererConfig: _n.rendererConfig, overrideHookState: null, overrideHookStateDeletePath: null, overrideHookStateRenamePath: null, overrideProps: null, overridePropsDeletePath: null, overridePropsRenamePath: null, setErrorHandler: null, setSuspenseHandler: null, scheduleUpdate: null, currentDispatcherRef: rt.ReactCurrentDispatcher, findHostInstanceByFiber: function(e) {
  return e = au(e), e === null ? null : e.stateNode;
}, findFiberByHostInstance: _n.findFiberByHostInstance || xp, findHostInstancesForRefresh: null, scheduleRefresh: null, scheduleRoot: null, setRefreshHandler: null, getCurrentFiber: null, reconcilerVersion: "18.2.0-next-9e3b772b8-20220608" };
if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u") {
  var Pr = __REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (!Pr.isDisabled && Pr.supportsFiber)
    try {
      Sl = Pr.inject(kp), Qe = Pr;
    } catch {
    }
}
Ce.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = jp;
Ce.createPortal = function(e, t) {
  var n = 2 < arguments.length && arguments[2] !== void 0 ? arguments[2] : null;
  if (!ts(t))
    throw Error(S(200));
  return wp(e, t, null, n);
};
Ce.createRoot = function(e, t) {
  if (!ts(e))
    throw Error(S(299));
  var n = !1, r = "", l = Bc;
  return t != null && (t.unstable_strictMode === !0 && (n = !0), t.identifierPrefix !== void 0 && (r = t.identifierPrefix), t.onRecoverableError !== void 0 && (l = t.onRecoverableError)), t = Jo(e, 1, !1, null, null, n, !1, r, l), e[et] = t.current, Xn(e.nodeType === 8 ? e.parentNode : e), new es(t);
};
Ce.findDOMNode = function(e) {
  if (e == null)
    return null;
  if (e.nodeType === 1)
    return e;
  var t = e._reactInternals;
  if (t === void 0)
    throw typeof e.render == "function" ? Error(S(188)) : (e = Object.keys(e).join(","), Error(S(268, e)));
  return e = au(t), e = e === null ? null : e.stateNode, e;
};
Ce.flushSync = function(e) {
  return At(e);
};
Ce.hydrate = function(e, t, n) {
  if (!Ml(t))
    throw Error(S(200));
  return Fl(null, e, t, !0, n);
};
Ce.hydrateRoot = function(e, t, n) {
  if (!ts(e))
    throw Error(S(405));
  var r = n != null && n.hydratedSources || null, l = !1, i = "", o = Bc;
  if (n != null && (n.unstable_strictMode === !0 && (l = !0), n.identifierPrefix !== void 0 && (i = n.identifierPrefix), n.onRecoverableError !== void 0 && (o = n.onRecoverableError)), t = Ac(t, null, e, 1, n ?? null, l, !1, i, o), e[et] = t.current, Xn(e), r)
    for (e = 0; e < r.length; e++)
      n = r[e], l = n._getVersion, l = l(n._source), t.mutableSourceEagerHydrationData == null ? t.mutableSourceEagerHydrationData = [n, l] : t.mutableSourceEagerHydrationData.push(
        n,
        l
      );
  return new Rl(t);
};
Ce.render = function(e, t, n) {
  if (!Ml(t))
    throw Error(S(200));
  return Fl(null, e, t, !1, n);
};
Ce.unmountComponentAtNode = function(e) {
  if (!Ml(e))
    throw Error(S(40));
  return e._reactRootContainer ? (At(function() {
    Fl(null, null, e, !1, function() {
      e._reactRootContainer = null, e[et] = null;
    });
  }), !0) : !1;
};
Ce.unstable_batchedUpdates = Yo;
Ce.unstable_renderSubtreeIntoContainer = function(e, t, n, r) {
  if (!Ml(n))
    throw Error(S(200));
  if (e == null || e._reactInternals === void 0)
    throw Error(S(38));
  return Fl(e, t, n, !1, r);
};
Ce.version = "18.2.0-next-9e3b772b8-20220608";
function Vc() {
  if (!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u" || typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE != "function"))
    try {
      __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(Vc);
    } catch (e) {
      console.error(e);
    }
}
Vc(), Aa.exports = Ce;
var Np = Aa.exports, fa = Np;
mi.createRoot = fa.createRoot, mi.hydrateRoot = fa.hydrateRoot;
const da = ["Tutti", "P", "D", "C", "A"], gl = {
  P: "Portiere",
  D: "Difensore",
  C: "Centrocampista",
  A: "Attaccante",
  U: "Altro"
}, pa = {
  P: 1,
  D: 2,
  C: 3,
  A: 4,
  U: 5
}, vl = {
  P: "lf-role-badge lf-role-badge--p",
  D: "lf-role-badge lf-role-badge--d",
  C: "lf-role-badge lf-role-badge--c",
  A: "lf-role-badge lf-role-badge--a",
  U: "lf-role-badge lf-role-badge--u"
}, lt = (e) => ({
  width: e,
  height: e,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": !0
});
function Cp({ size: e = 24, ...t }) {
  return /* @__PURE__ */ s.jsxs("svg", { ...lt(e), ...t, children: [
    /* @__PURE__ */ s.jsx("path", { d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" }),
    /* @__PURE__ */ s.jsx("circle", { cx: "9", cy: "7", r: "4" }),
    /* @__PURE__ */ s.jsx("path", { d: "M22 21v-2a4 4 0 0 0-3-3.87" }),
    /* @__PURE__ */ s.jsx("path", { d: "M16 3.13a4 4 0 0 1 0 7.75" })
  ] });
}
function ma({ size: e = 20, ...t }) {
  return /* @__PURE__ */ s.jsxs("svg", { ...lt(e), ...t, children: [
    /* @__PURE__ */ s.jsx("circle", { cx: "11", cy: "11", r: "8" }),
    /* @__PURE__ */ s.jsx("path", { d: "m21 21-4.3-4.3" })
  ] });
}
function Ep({ size: e = 20, ...t }) {
  return /* @__PURE__ */ s.jsxs("svg", { ...lt(e), ...t, children: [
    /* @__PURE__ */ s.jsx("path", { d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" }),
    /* @__PURE__ */ s.jsx("circle", { cx: "9", cy: "7", r: "4" }),
    /* @__PURE__ */ s.jsx("path", { d: "m17 8 5 5" }),
    /* @__PURE__ */ s.jsx("path", { d: "m22 8-5 5" })
  ] });
}
function Hc({ size: e = 20, ...t }) {
  return /* @__PURE__ */ s.jsxs("svg", { ...lt(e), ...t, children: [
    /* @__PURE__ */ s.jsx("path", { d: "M18 6 6 18" }),
    /* @__PURE__ */ s.jsx("path", { d: "m6 6 12 12" })
  ] });
}
function Xe({ size: e = 18, ...t }) {
  return /* @__PURE__ */ s.jsx("svg", { ...lt(e), ...t, children: /* @__PURE__ */ s.jsx("path", { d: "m6 9 6 6 6-6" }) });
}
function _p({ size: e = 16, ...t }) {
  return /* @__PURE__ */ s.jsx("svg", { ...lt(e), ...t, children: /* @__PURE__ */ s.jsx("path", { d: "m18 15-6-6-6 6" }) });
}
function yl({ size: e = 24, ...t }) {
  return /* @__PURE__ */ s.jsx("svg", { ...lt(e), ...t, children: /* @__PURE__ */ s.jsx("path", { d: "M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3v8Z" }) });
}
function Pp({ size: e = 18, ...t }) {
  return /* @__PURE__ */ s.jsxs("svg", { ...lt(e), ...t, children: [
    /* @__PURE__ */ s.jsx("circle", { cx: "8", cy: "8", r: "6" }),
    /* @__PURE__ */ s.jsx("path", { d: "M18.1 8.4A6 6 0 1 1 8.4 18.1" }),
    /* @__PURE__ */ s.jsx("path", { d: "M6 8h4M8 6v4" })
  ] });
}
function Tp({ size: e = 18, ...t }) {
  return /* @__PURE__ */ s.jsxs("svg", { ...lt(e), ...t, children: [
    /* @__PURE__ */ s.jsx("circle", { cx: "12", cy: "12", r: "10" }),
    /* @__PURE__ */ s.jsx("path", { d: "M12 8v4" }),
    /* @__PURE__ */ s.jsx("path", { d: "M12 16h.01" })
  ] });
}
function ha() {
  return { players: {} };
}
function zp(e) {
  var t;
  return ((t = window.LineupClubKeys) == null ? void 0 : t.key(e)) || String(e || "").toLowerCase().trim();
}
function Lp(e, t) {
  var n;
  return ((n = window.LineupPlayerMedia) == null ? void 0 : n.playerKey(e, t)) || `${String(e || "").toLowerCase().trim()}|${zp(t)}`;
}
function Qc(e, t) {
  const [n, r] = T.useState(() => {
    var a;
    return ((a = window.LineupPlayerMedia) == null ? void 0 : a.payload(t)) || ha();
  }), [l, i] = T.useState(0), o = T.useMemo(() => e.map((a) => `${a.displayName}|${a.realTeam}|${a.type}`).join(`
`), [e]);
  return T.useEffect(() => {
    var u, c;
    if (!t || !e.length)
      return;
    (u = window.LineupPlayerMedia) == null || u.load(t, e);
    const a = (c = window.LineupPlayerMedia) == null ? void 0 : c.payload(t);
    a && r(a);
  }, [o, e, t]), T.useEffect(() => {
    const a = (c) => {
      const p = c.detail;
      (p == null ? void 0 : p.leagueId) === t && r(p.payload || ha());
    }, u = () => i((c) => c + 1);
    return window.addEventListener("lineup:player-media-ready", a), window.addEventListener("lineup:kickoff-clubs-ready", u), () => {
      window.removeEventListener("lineup:player-media-ready", a), window.removeEventListener("lineup:kickoff-clubs-ready", u);
    };
  }, [t]), T.useMemo(() => ({
    player(a, u) {
      var c;
      return n.players[Lp(a, u)] || ((c = window.LineupPlayerMedia) == null ? void 0 : c.player(a, u, t)) || null;
    },
    crest(a) {
      var u;
      return ((u = window.LineupPlayerMedia) == null ? void 0 : u.crest(a)) || "";
    }
  }), [l, t, n]);
}
function Dp(e) {
  return e.split(/\s+-\s+/).map((t) => t.trim()).filter(Boolean);
}
function ga({ asset: e, expanded: t, onToggle: n, crestUrl: r, media: l }) {
  const i = Dp(e.displayName);
  return /* @__PURE__ */ s.jsxs("div", { children: [
    /* @__PURE__ */ s.jsxs("button", { type: "button", onClick: n, className: "tw-hidden tw-w-full tw-grid-cols-12 tw-gap-4 tw-px-6 tw-py-4 tw-text-left tw-transition hover:tw-bg-slate-50 md:tw-grid", children: [
      /* @__PURE__ */ s.jsxs("div", { className: "tw-col-span-4 tw-flex tw-min-w-0 tw-items-center tw-gap-3", children: [
        /* @__PURE__ */ s.jsx("div", { className: `lf-player-avatar ${r ? "has-photo lf-player-avatar--crest" : ""}`, children: r ? /* @__PURE__ */ s.jsx("img", { src: r, alt: "", loading: "lazy", decoding: "async" }) : /* @__PURE__ */ s.jsx(yl, { size: 22 }) }),
        /* @__PURE__ */ s.jsxs("div", { className: "tw-min-w-0", children: [
          /* @__PURE__ */ s.jsxs("div", { className: "tw-truncate tw-font-semibold tw-text-slate-900", children: [
            "Blocco ",
            e.realTeam || e.displayName
          ] }),
          /* @__PURE__ */ s.jsxs("div", { className: "tw-flex tw-items-center tw-gap-1 tw-text-sm tw-text-slate-500", children: [
            i.length,
            " portieri",
            /* @__PURE__ */ s.jsx(Xe, { size: 15, className: `tw-transition ${t ? "tw-rotate-180" : ""}` })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ s.jsx("div", { className: "tw-col-span-2 tw-flex tw-items-center", children: /* @__PURE__ */ s.jsx("span", { className: "lf-role-badge lf-role-badge--p", children: "Portiere" }) }),
      /* @__PURE__ */ s.jsx("div", { className: "tw-col-span-2 tw-flex tw-items-center tw-justify-center tw-text-xl tw-font-black tw-text-slate-900", children: e.quotation || "—" }),
      /* @__PURE__ */ s.jsx("div", { className: "tw-col-span-2 tw-flex tw-items-center tw-justify-center tw-text-lg tw-font-bold tw-text-[var(--primary)]", children: e.purchasePrice || "—" }),
      /* @__PURE__ */ s.jsx("div", { className: `tw-col-span-2 tw-flex tw-items-center tw-truncate tw-text-sm ${e.ownerTag ? "tw-text-slate-600" : "tw-italic tw-text-slate-400"}`, children: e.ownerTag || "Svincolato" })
    ] }),
    /* @__PURE__ */ s.jsxs("button", { type: "button", onClick: n, className: "tw-flex tw-w-full tw-items-start tw-gap-3 tw-p-3 tw-text-left tw-transition hover:tw-bg-slate-50 md:tw-hidden", children: [
      /* @__PURE__ */ s.jsx("div", { className: `lf-player-avatar lf-player-avatar--mobile ${r ? "has-photo lf-player-avatar--crest" : ""}`, children: r ? /* @__PURE__ */ s.jsx("img", { src: r, alt: "", loading: "lazy", decoding: "async" }) : /* @__PURE__ */ s.jsx(yl, { size: 22 }) }),
      /* @__PURE__ */ s.jsxs("div", { className: "tw-min-w-0 tw-flex-1", children: [
        /* @__PURE__ */ s.jsxs("div", { className: "tw-mb-1 tw-flex tw-items-center tw-justify-between tw-gap-2", children: [
          /* @__PURE__ */ s.jsxs("strong", { className: "tw-min-w-0 tw-truncate tw-text-slate-900", children: [
            "Blocco ",
            e.realTeam || e.displayName
          ] }),
          /* @__PURE__ */ s.jsx("span", { className: "lf-role-badge lf-role-badge--p tw-shrink-0", children: "Portiere" })
        ] }),
        /* @__PURE__ */ s.jsxs("div", { className: "tw-flex tw-items-center tw-gap-1 tw-text-xs tw-text-slate-500", children: [
          i.length,
          " portieri ",
          /* @__PURE__ */ s.jsx(Xe, { size: 14, className: `tw-transition ${t ? "tw-rotate-180" : ""}` })
        ] }),
        /* @__PURE__ */ s.jsxs("div", { className: "tw-mt-1 tw-flex tw-flex-wrap tw-gap-x-4 tw-gap-y-0.5 tw-text-xs", children: [
          /* @__PURE__ */ s.jsxs("span", { children: [
            /* @__PURE__ */ s.jsx("span", { className: "tw-text-slate-400", children: "Quot:" }),
            " ",
            /* @__PURE__ */ s.jsx("strong", { children: e.quotation || "—" })
          ] }),
          /* @__PURE__ */ s.jsxs("span", { children: [
            /* @__PURE__ */ s.jsx("span", { className: "tw-text-slate-400", children: "Acq:" }),
            " ",
            /* @__PURE__ */ s.jsx("strong", { className: "tw-text-[var(--primary)]", children: e.purchasePrice || "—" })
          ] })
        ] }),
        /* @__PURE__ */ s.jsx("div", { className: "tw-mt-1 tw-text-sm", children: /* @__PURE__ */ s.jsxs("span", { className: `tw-truncate ${e.ownerTag ? "tw-text-slate-500" : "tw-italic tw-text-slate-400"}`, children: [
          "👤 ",
          e.ownerTag || "Svincolato"
        ] }) })
      ] })
    ] }),
    t && /* @__PURE__ */ s.jsx("div", { className: "lf-block-expanded", children: i.map((o) => {
      var u;
      const a = (u = l.player(o, e.realTeam)) == null ? void 0 : u.photoUrl;
      return /* @__PURE__ */ s.jsxs("div", { className: "tw-flex tw-items-center tw-gap-3 tw-px-3 tw-py-3 md:tw-px-6", children: [
        /* @__PURE__ */ s.jsx("div", { className: `lf-mini-avatar ${a ? "has-photo" : ""}`, children: a ? /* @__PURE__ */ s.jsx("img", { src: a, alt: "", loading: "lazy", decoding: "async" }) : "P" }),
        /* @__PURE__ */ s.jsxs("div", { className: "tw-min-w-0", children: [
          /* @__PURE__ */ s.jsx("div", { className: "tw-truncate tw-font-medium tw-text-slate-800", children: o }),
          /* @__PURE__ */ s.jsx("div", { className: "tw-text-xs tw-text-slate-500", children: e.realTeam || "Portiere" })
        ] })
      ] }, o);
    }) })
  ] });
}
function Rp(e) {
  return e.split(/\s+/).filter(Boolean).slice(0, 2).map((t) => {
    var n;
    return (n = t[0]) == null ? void 0 : n.toUpperCase();
  }).join("") || "?";
}
function Mp({ player: e, media: t, crestUrl: n }) {
  return /* @__PURE__ */ s.jsxs("div", { className: "tw-group tw-grid tw-grid-cols-12 tw-gap-4 tw-px-6 tw-py-4 tw-transition hover:tw-bg-slate-50", children: [
    /* @__PURE__ */ s.jsxs("div", { className: "tw-col-span-4 tw-flex tw-min-w-0 tw-items-center tw-gap-3", children: [
      /* @__PURE__ */ s.jsx("div", { className: `lf-player-avatar ${t != null && t.photoUrl ? "has-photo" : ""}`, "aria-hidden": "true", children: t != null && t.photoUrl ? /* @__PURE__ */ s.jsx("img", { src: t.photoUrl, alt: "", loading: "lazy", decoding: "async" }) : Rp(e.displayName) }),
      /* @__PURE__ */ s.jsxs("div", { className: "tw-min-w-0", children: [
        /* @__PURE__ */ s.jsxs("div", { className: `tw-truncate tw-font-semibold tw-transition group-hover:tw-text-[var(--primary)] ${e.active ? "tw-text-slate-900" : "tw-italic tw-text-slate-400"}`, children: [
          e.displayName,
          !e.active && " *"
        ] }),
        /* @__PURE__ */ s.jsxs("div", { className: "lf-player-club-line", children: [
          n && /* @__PURE__ */ s.jsx("img", { src: n, alt: "", loading: "lazy", decoding: "async" }),
          /* @__PURE__ */ s.jsx("span", { children: e.realTeam || "—" })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ s.jsx("div", { className: "tw-col-span-2 tw-flex tw-items-center", children: /* @__PURE__ */ s.jsx("span", { className: vl[e.role] ?? vl.U, children: gl[e.role] ?? "?" }) }),
    /* @__PURE__ */ s.jsx("div", { className: "tw-col-span-2 tw-flex tw-items-center tw-justify-center", children: /* @__PURE__ */ s.jsx("span", { className: "tw-text-xl tw-font-black tw-text-slate-900", children: e.quotation || "—" }) }),
    /* @__PURE__ */ s.jsx("div", { className: "tw-col-span-2 tw-flex tw-items-center tw-justify-center", children: /* @__PURE__ */ s.jsx("span", { className: e.purchasePrice ? "tw-text-lg tw-font-bold tw-text-[var(--primary)]" : "tw-text-slate-400", children: e.purchasePrice || "—" }) }),
    /* @__PURE__ */ s.jsx("div", { className: "tw-col-span-2 tw-flex tw-items-center tw-min-w-0", children: /* @__PURE__ */ s.jsx("span", { className: `tw-truncate tw-text-sm ${e.ownerTag ? "tw-text-slate-600" : "tw-italic tw-text-slate-400"}`, children: e.ownerTag || "Svincolato" }) })
  ] });
}
function Fp({
  teams: e,
  owners: t,
  currentRole: n,
  currentTeam: r,
  currentOwner: l,
  hasActiveFilters: i,
  onRoleChange: o,
  onTeamChange: a,
  onOwnerChange: u,
  onResetFilters: c
}) {
  return /* @__PURE__ */ s.jsxs("div", { className: "tw-mb-5 sm:tw-mb-6", children: [
    /* @__PURE__ */ s.jsxs("div", { className: "tw-hidden tw-items-center tw-justify-between tw-gap-4 md:tw-flex", children: [
      /* @__PURE__ */ s.jsx("div", { className: "tw-flex tw-flex-wrap tw-gap-2", children: da.map((p) => /* @__PURE__ */ s.jsx(
        "button",
        {
          type: "button",
          onClick: () => o(p),
          className: `lf-role-pill ${n === p ? "lf-role-pill--active" : ""}`,
          children: p === "Tutti" ? "Tutti" : gl[p]
        },
        p
      )) }),
      /* @__PURE__ */ s.jsxs("div", { className: "tw-flex tw-items-center tw-gap-2", children: [
        /* @__PURE__ */ s.jsxs("label", { className: "lf-select-wrap", children: [
          /* @__PURE__ */ s.jsx("span", { "aria-hidden": "true", children: "🏟️" }),
          /* @__PURE__ */ s.jsxs("select", { value: r, onChange: (p) => a(p.target.value), "aria-label": "Filtra per squadra reale", children: [
            /* @__PURE__ */ s.jsx("option", { value: "Tutti", children: "Squadra" }),
            e.map((p) => /* @__PURE__ */ s.jsx("option", { value: p, children: p }, p))
          ] }),
          /* @__PURE__ */ s.jsx(Xe, { size: 14 })
        ] }),
        /* @__PURE__ */ s.jsxs("label", { className: "lf-select-wrap", children: [
          /* @__PURE__ */ s.jsx("span", { "aria-hidden": "true", children: "👤" }),
          /* @__PURE__ */ s.jsxs("select", { value: l, onChange: (p) => u(p.target.value), "aria-label": "Filtra per proprietario", children: [
            /* @__PURE__ */ s.jsx("option", { value: "Tutti", children: "Proprietario" }),
            t.map((p) => /* @__PURE__ */ s.jsx("option", { value: p, children: p }, p))
          ] }),
          /* @__PURE__ */ s.jsx(Xe, { size: 14 })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ s.jsx("div", { className: "lf-mobile-filters md:tw-hidden", children: /* @__PURE__ */ s.jsxs("div", { className: "tw-flex tw-flex-col tw-gap-2", children: [
      /* @__PURE__ */ s.jsxs("label", { className: "lf-select-wrap lf-select-wrap--mobile lf-select-wrap--full", children: [
        /* @__PURE__ */ s.jsx("span", { "aria-hidden": "true", children: "🎯" }),
        /* @__PURE__ */ s.jsx("select", { value: n, onChange: (p) => o(p.target.value), "aria-label": "Filtra per ruolo", children: da.map((p) => /* @__PURE__ */ s.jsx("option", { value: p, children: p === "Tutti" ? "Tutti" : gl[p] }, p)) }),
        /* @__PURE__ */ s.jsx(Xe, { size: 14 })
      ] }),
      /* @__PURE__ */ s.jsxs("div", { className: "tw-flex tw-gap-2", children: [
        /* @__PURE__ */ s.jsxs("label", { className: "lf-select-wrap lf-select-wrap--mobile", children: [
          /* @__PURE__ */ s.jsx("span", { "aria-hidden": "true", children: "🏟️" }),
          /* @__PURE__ */ s.jsxs("select", { value: r, onChange: (p) => a(p.target.value), "aria-label": "Filtra per squadra reale", children: [
            /* @__PURE__ */ s.jsx("option", { value: "Tutti", children: "Squadra" }),
            e.map((p) => /* @__PURE__ */ s.jsx("option", { value: p, children: p }, p))
          ] }),
          /* @__PURE__ */ s.jsx(Xe, { size: 14 })
        ] }),
        /* @__PURE__ */ s.jsxs("label", { className: "lf-select-wrap lf-select-wrap--mobile", children: [
          /* @__PURE__ */ s.jsx("span", { "aria-hidden": "true", children: "👤" }),
          /* @__PURE__ */ s.jsxs("select", { value: l, onChange: (p) => u(p.target.value), "aria-label": "Filtra per proprietario", children: [
            /* @__PURE__ */ s.jsx("option", { value: "Tutti", children: "Proprietario" }),
            t.map((p) => /* @__PURE__ */ s.jsx("option", { value: p, children: p }, p))
          ] }),
          /* @__PURE__ */ s.jsx(Xe, { size: 14 })
        ] })
      ] })
    ] }) }),
    i && /* @__PURE__ */ s.jsxs("button", { type: "button", onClick: c, className: "lf-mobile-reset md:tw-hidden", children: [
      /* @__PURE__ */ s.jsx(Hc, { size: 15 }),
      " Azzera filtri"
    ] })
  ] });
}
function ci({ active: e, direction: t }) {
  return e ? t === "asc" ? /* @__PURE__ */ s.jsx(_p, { size: 14 }) : /* @__PURE__ */ s.jsx(Xe, { size: 14 }) : null;
}
function Ip({ sortKey: e, sortDirection: t, onSort: n }) {
  return /* @__PURE__ */ s.jsxs("div", { className: "tw-hidden tw-grid-cols-12 tw-gap-4 tw-border-b tw-border-slate-200 tw-bg-slate-50 tw-px-6 tw-py-4 tw-text-xs tw-font-bold tw-uppercase tw-tracking-wider tw-text-slate-500 md:tw-grid", children: [
    /* @__PURE__ */ s.jsx("div", { className: "tw-col-span-4", children: "Giocatore" }),
    /* @__PURE__ */ s.jsxs("button", { type: "button", className: "lf-sort tw-col-span-2", onClick: () => n("position"), children: [
      "Ruolo ",
      /* @__PURE__ */ s.jsx(ci, { active: e === "position", direction: t })
    ] }),
    /* @__PURE__ */ s.jsxs("button", { type: "button", className: "lf-sort tw-col-span-2 tw-justify-center", onClick: () => n("quotation"), children: [
      "Quot. ",
      /* @__PURE__ */ s.jsx(ci, { active: e === "quotation", direction: t })
    ] }),
    /* @__PURE__ */ s.jsxs("button", { type: "button", className: "lf-sort tw-col-span-2 tw-justify-center", onClick: () => n("purchasePrice"), children: [
      "Prezzo ",
      /* @__PURE__ */ s.jsx(ci, { active: e === "purchasePrice", direction: t })
    ] }),
    /* @__PURE__ */ s.jsx("div", { className: "tw-col-span-2", children: "Proprietario" })
  ] });
}
function $p(e) {
  return e.split(/\s+/).filter(Boolean).slice(0, 2).map((t) => {
    var n;
    return (n = t[0]) == null ? void 0 : n.toUpperCase();
  }).join("") || "?";
}
function Op({ player: e, media: t, crestUrl: n }) {
  return /* @__PURE__ */ s.jsx("article", { className: "tw-p-3 tw-transition hover:tw-bg-slate-50", children: /* @__PURE__ */ s.jsxs("div", { className: "tw-flex tw-items-start tw-gap-3", children: [
    /* @__PURE__ */ s.jsx("div", { className: `lf-player-avatar lf-player-avatar--mobile ${t != null && t.photoUrl ? "has-photo" : ""}`, "aria-hidden": "true", children: t != null && t.photoUrl ? /* @__PURE__ */ s.jsx("img", { src: t.photoUrl, alt: "", loading: "lazy", decoding: "async" }) : $p(e.displayName) }),
    /* @__PURE__ */ s.jsxs("div", { className: "tw-min-w-0 tw-flex-1", children: [
      /* @__PURE__ */ s.jsxs("div", { className: "tw-mb-1 tw-flex tw-items-center tw-justify-between tw-gap-2", children: [
        /* @__PURE__ */ s.jsxs("span", { className: `tw-min-w-0 tw-truncate tw-font-semibold ${e.active ? "tw-text-slate-900" : "tw-italic tw-text-slate-400"}`, children: [
          e.displayName,
          !e.active && " *"
        ] }),
        /* @__PURE__ */ s.jsx("span", { className: `${vl[e.role] ?? vl.U} tw-shrink-0`, children: gl[e.role] ?? e.role ?? "?" })
      ] }),
      /* @__PURE__ */ s.jsxs("div", { className: "lf-player-club-line lf-player-club-line--mobile", children: [
        n && /* @__PURE__ */ s.jsx("img", { src: n, alt: "", loading: "lazy", decoding: "async" }),
        /* @__PURE__ */ s.jsx("span", { children: e.realTeam || "—" })
      ] }),
      /* @__PURE__ */ s.jsxs("div", { className: "tw-mt-1 tw-flex tw-flex-wrap tw-items-center tw-gap-x-4 tw-gap-y-0.5 tw-text-xs", children: [
        /* @__PURE__ */ s.jsxs("span", { children: [
          /* @__PURE__ */ s.jsx("span", { className: "tw-text-slate-400", children: "Quot:" }),
          " ",
          /* @__PURE__ */ s.jsx("strong", { className: "tw-text-slate-900", children: e.quotation || "—" })
        ] }),
        /* @__PURE__ */ s.jsxs("span", { children: [
          /* @__PURE__ */ s.jsx("span", { className: "tw-text-slate-400", children: "Acq:" }),
          " ",
          /* @__PURE__ */ s.jsx("strong", { className: "tw-text-[var(--primary)]", children: e.purchasePrice || "—" })
        ] })
      ] }),
      /* @__PURE__ */ s.jsx("div", { className: "tw-mt-1 tw-text-sm", children: /* @__PURE__ */ s.jsxs("span", { className: `tw-max-w-full tw-truncate ${e.ownerTag ? "tw-text-slate-500" : "tw-italic tw-text-slate-400"}`, children: [
        "👤 ",
        e.ownerTag || "Svincolato"
      ] }) })
    ] })
  ] }) });
}
function va(e) {
  return e.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/Ø/g, "O").replace(/ø/g, "o").toLowerCase();
}
function ya(e) {
  return e.type === "goalkeeper_block" || e.role === "P" && /\s+-\s+/.test(e.displayName);
}
function Up({ assets: e }) {
  var re, $;
  const t = (($ = (re = window.LINEUP_FANTA) == null ? void 0 : re.league) == null ? void 0 : $.id) ?? "", n = Qc(e, t), [r, l] = T.useState(""), [i, o] = T.useState("Tutti"), [a, u] = T.useState("Tutti"), [c, p] = T.useState("Tutti"), [g, h] = T.useState(!1), [y, v] = T.useState("position"), [w, z] = T.useState("asc"), [d, f] = T.useState(/* @__PURE__ */ new Set()), m = T.useMemo(() => [...new Set(e.map((E) => E.realTeam).filter(Boolean))].sort((E, R) => E.localeCompare(R, "it")), [e]), x = T.useMemo(() => [...new Set(e.map((E) => E.ownerTag).filter(Boolean))].sort((E, R) => E.localeCompare(R, "it")), [e]), j = T.useMemo(() => {
    const E = va(r.trim());
    return e.filter((R) => !(E && !va(`${R.displayName} ${R.realTeam} ${R.ownerTag}`).includes(E) || g && !R.isFreeAgent || i !== "Tutti" && R.role !== i || a !== "Tutti" && R.realTeam !== a || c !== "Tutti" && R.ownerTag !== c));
  }, [e, c, i, r, g, a]), N = T.useMemo(() => [...j].sort((E, R) => {
    if (y === "position") {
      const Ke = (pa[E.role] ?? 9) - (pa[R.role] ?? 9), _e = w === "asc" ? Ke : -Ke;
      if (_e !== 0)
        return _e;
      const k = E.realTeam.localeCompare(R.realTeam, "it");
      if (k !== 0)
        return k;
      const L = R.quotation - E.quotation;
      return L !== 0 ? L : E.displayName.localeCompare(R.displayName, "it");
    }
    const G = (E[y] || 0) - (R[y] || 0);
    return w === "asc" ? G : -G;
  }), [j, w, y]), C = !!(r || i !== "Tutti" || a !== "Tutti" || c !== "Tutti" || g), _ = () => {
    l(""), o("Tutti"), u("Tutti"), p("Tutti"), h(!1), v("position"), z("asc");
  }, U = (E) => {
    if (y === E) {
      w === "desc" || v("position"), z("asc");
      return;
    }
    v(E), z("desc");
  }, D = (E) => {
    f((R) => {
      const G = new Set(R);
      return G.has(E) ? G.delete(E) : G.add(E), G;
    });
  };
  return /* @__PURE__ */ s.jsx("div", { className: "tw-px-2 tw-py-3 sm:tw-px-5 sm:tw-py-7 lg:tw-px-7", children: /* @__PURE__ */ s.jsxs("section", { className: "lf-dashboard-card tw-mx-auto tw-max-w-7xl", children: [
    /* @__PURE__ */ s.jsx("div", { className: "tw-flex tw-justify-center tw-p-4 sm:tw-p-6 lg:tw-p-8", children: /* @__PURE__ */ s.jsxs("div", { className: "tw-flex tw-w-full tw-flex-wrap tw-items-stretch tw-gap-2 lg:tw-w-auto lg:tw-justify-center", children: [
      /* @__PURE__ */ s.jsxs("label", { className: "lf-search tw-min-w-0 tw-flex-1 lg:tw-w-80 lg:tw-flex-none", children: [
        /* @__PURE__ */ s.jsx(ma, { size: 20 }),
        /* @__PURE__ */ s.jsx("input", { type: "search", placeholder: "Cerca giocatore...", value: r, onChange: (E) => l(E.target.value) })
      ] }),
      /* @__PURE__ */ s.jsxs("button", { type: "button", onClick: () => h((E) => !E), className: `lf-action-button ${g ? "lf-action-button--active" : ""}`, title: "Mostra solo giocatori svincolati", children: [
        /* @__PURE__ */ s.jsx(Ep, { size: 20 }),
        /* @__PURE__ */ s.jsx("span", { className: "tw-hidden sm:tw-inline", children: "Svincolati" })
      ] }),
      C && /* @__PURE__ */ s.jsx("button", { type: "button", onClick: _, className: "lf-reset-button tw-hidden md:tw-flex", title: "Azzera filtri", children: /* @__PURE__ */ s.jsx(Hc, { size: 20 }) })
    ] }) }),
    /* @__PURE__ */ s.jsxs("div", { className: "tw-px-3 sm:tw-px-6 lg:tw-px-8", children: [
      /* @__PURE__ */ s.jsx(
        Fp,
        {
          teams: m,
          owners: x,
          currentRole: i,
          currentTeam: a,
          currentOwner: c,
          hasActiveFilters: C,
          onRoleChange: o,
          onTeamChange: u,
          onOwnerChange: p,
          onResetFilters: _
        }
      ),
      /* @__PURE__ */ s.jsxs("div", { className: "tw-mb-3 tw-flex tw-items-center tw-justify-between tw-text-xs tw-font-semibold tw-text-slate-500", children: [
        /* @__PURE__ */ s.jsxs("span", { children: [
          N.length,
          " risultati"
        ] }),
        N.length !== e.length && /* @__PURE__ */ s.jsxs("span", { children: [
          "su ",
          e.length
        ] })
      ] }),
      /* @__PURE__ */ s.jsxs("div", { className: "lf-list-table", children: [
        /* @__PURE__ */ s.jsx(Ip, { sortKey: y, sortDirection: w, onSort: U }),
        /* @__PURE__ */ s.jsx("div", { className: "tw-hidden tw-divide-y tw-divide-slate-100 md:tw-block", children: N.map((E) => ya(E) ? /* @__PURE__ */ s.jsx(ga, { asset: E, expanded: d.has(E.assetCode), onToggle: () => D(E.assetCode), crestUrl: n.crest(E.realTeam), media: n }, E.assetCode) : /* @__PURE__ */ s.jsx(Mp, { player: E, media: n.player(E.displayName, E.realTeam), crestUrl: n.crest(E.realTeam) }, E.assetCode)) }),
        /* @__PURE__ */ s.jsx("div", { className: "tw-divide-y tw-divide-slate-100 md:tw-hidden", children: N.map((E) => ya(E) ? /* @__PURE__ */ s.jsx(ga, { asset: E, expanded: d.has(E.assetCode), onToggle: () => D(E.assetCode), crestUrl: n.crest(E.realTeam), media: n }, E.assetCode) : /* @__PURE__ */ s.jsx(Op, { player: E, media: n.player(E.displayName, E.realTeam), crestUrl: n.crest(E.realTeam) }, E.assetCode)) }),
        N.length === 0 && /* @__PURE__ */ s.jsxs("div", { className: "tw-px-6 tw-py-14 tw-text-center", children: [
          /* @__PURE__ */ s.jsx(ma, { size: 34, className: "tw-mx-auto tw-mb-3 tw-text-slate-300" }),
          /* @__PURE__ */ s.jsx("h2", { className: "tw-m-0 tw-text-lg tw-font-bold tw-text-slate-800", children: "Nessun giocatore trovato" }),
          /* @__PURE__ */ s.jsx("p", { className: "tw-mb-0 tw-mt-1 tw-text-sm tw-text-slate-500", children: "Prova a modificare i filtri di ricerca." })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ s.jsx("div", { className: "tw-h-4 sm:tw-h-6" })
  ] }) });
}
function Ap(e) {
  return e.map((t) => ({
    ...t,
    purchasePrice: t.purchasePrice ?? 0,
    managerCredits: t.managerCredits ?? null
  }));
}
function fi() {
  var e, t, n, r;
  return {
    state: ((t = (e = window.LineupLeagueData) == null ? void 0 : e.getState) == null ? void 0 : t.call(e)) ?? { status: "idle" },
    assets: Ap(((r = (n = window.LineupLeagueData) == null ? void 0 : n.getAssets) == null ? void 0 : r.call(n)) ?? [])
  };
}
function Wc() {
  var o;
  const e = T.useMemo(fi, []), [t, n] = T.useState(e.state), [r, l] = T.useState(e.assets), i = (o = window.LINEUP_FANTA) == null ? void 0 : o.league;
  return T.useEffect(() => {
    let a = !1, u = 0;
    const c = () => {
      if (a)
        return;
      const g = fi();
      n(g.state), l(g.assets), u += 1, g.state.status !== "ready" && u < 20 && window.setTimeout(c, 150);
    }, p = (g) => {
      if (g.detail.leagueId !== (i == null ? void 0 : i.id))
        return;
      const h = fi();
      n(h.state), l(h.assets);
    };
    return document.addEventListener("lineup:league-assets-ready", p), c(), () => {
      a = !0, document.removeEventListener("lineup:league-assets-ready", p);
    };
  }, [i == null ? void 0 : i.id]), { state: t, assets: r, league: i };
}
function Bp() {
  const { state: e, assets: t } = Wc();
  return e.status === "error" ? /* @__PURE__ */ s.jsx("div", { className: "tw-p-4", children: /* @__PURE__ */ s.jsxs("section", { className: "lf-dashboard-card tw-mx-auto tw-max-w-4xl tw-p-7 tw-text-center", children: [
    /* @__PURE__ */ s.jsx("h2", { className: "tw-m-0 tw-text-lg tw-font-bold tw-text-red-600", children: "Errore nel caricamento del Listone" }),
    /* @__PURE__ */ s.jsx("p", { className: "tw-mb-0 tw-mt-2 tw-text-sm tw-text-slate-500", children: "Controlla il CSV della lega e ricarica la pagina." })
  ] }) }) : e.status !== "ready" ? /* @__PURE__ */ s.jsx("div", { className: "tw-p-4", children: /* @__PURE__ */ s.jsxs("section", { className: "lf-dashboard-card tw-mx-auto tw-max-w-4xl tw-p-7 tw-text-center", children: [
    /* @__PURE__ */ s.jsx("div", { className: "lf-spinner tw-mx-auto tw-mb-3" }),
    /* @__PURE__ */ s.jsx("p", { className: "tw-m-0 tw-text-sm tw-font-semibold tw-text-slate-500", children: "Caricamento del Listone…" })
  ] }) }) : /* @__PURE__ */ s.jsx(Up, { assets: t });
}
const Vp = "lineup:debug";
function wa() {
  try {
    return new URLSearchParams(window.location.search).get("debug") === "1";
  } catch {
    return !1;
  }
}
function Hp() {
  try {
    return wa() || window.localStorage.getItem(Vp) === "1";
  } catch {
    return wa();
  }
}
function Tr(e, t, n, r) {
  if (e === "debug" && !Hp())
    return;
  const l = `[Lineup:${t}]`;
  r === void 0 ? console[e](l, n) : console[e](l, n, r);
}
function Il(e) {
  return {
    debug: (t, n) => Tr("debug", e, t, n),
    info: (t, n) => Tr("info", e, t, n),
    warn: (t, n) => Tr("warn", e, t, n),
    error: (t, n) => Tr("error", e, t, n)
  };
}
function Qp(e) {
  return e.split(/\s+-\s+/).map((t) => t.trim()).filter(Boolean);
}
function Wp(e) {
  return e.split(/\s+/).filter(Boolean).slice(0, 2).map((t) => {
    var n;
    return (n = t[0]) == null ? void 0 : n.toUpperCase();
  }).join("") || "?";
}
function Kp({ name: e, team: t, role: n, media: r }) {
  var i;
  const l = (i = r.player(e, t)) == null ? void 0 : i.photoUrl;
  return /* @__PURE__ */ s.jsx("div", { className: `lf-squad-avatar lf-squad-avatar--${n.toLowerCase()} ${l ? "has-photo" : ""}`, "aria-hidden": "true", children: l ? /* @__PURE__ */ s.jsx("img", { src: l, alt: "", loading: "lazy", decoding: "async" }) : Wp(e) });
}
function zr({ players: e, role: t, label: n, media: r }) {
  const [l, i] = T.useState(/* @__PURE__ */ new Set()), o = e.filter((u) => u.role === t).sort((u, c) => {
    const p = c.purchasePrice - u.purchasePrice;
    return p !== 0 ? p : u.displayName.localeCompare(c.displayName, "it");
  }), a = (u) => {
    i((c) => {
      const p = new Set(c);
      return p.has(u) ? p.delete(u) : p.add(u), p;
    });
  };
  return /* @__PURE__ */ s.jsxs("section", { className: "lf-squad-section", children: [
    /* @__PURE__ */ s.jsxs("div", { className: "lf-squad-section__title", children: [
      n,
      t === "P" ? " (Blocchi)" : ""
    ] }),
    o.length === 0 ? /* @__PURE__ */ s.jsx("div", { className: "lf-squad-empty", children: "—" }) : /* @__PURE__ */ s.jsx("div", { className: "lf-squad-list", children: o.map((u) => {
      const c = t === "P" && (u.type === "goalkeeper_block" || /\s+-\s+/.test(u.displayName)), p = l.has(u.assetCode), g = c ? Qp(u.displayName) : [], h = r.crest(u.realTeam), y = /* @__PURE__ */ s.jsxs(s.Fragment, { children: [
        /* @__PURE__ */ s.jsxs("div", { className: "lf-squad-item__left", children: [
          c ? /* @__PURE__ */ s.jsx("div", { className: `lf-squad-block-crest ${h ? "has-crest" : ""}`, "aria-hidden": "true", children: h ? /* @__PURE__ */ s.jsx("img", { src: h, alt: "", loading: "lazy", decoding: "async" }) : /* @__PURE__ */ s.jsx(yl, { size: 17 }) }) : /* @__PURE__ */ s.jsx(Kp, { name: u.displayName, team: u.realTeam, role: t, media: r }),
          /* @__PURE__ */ s.jsxs("div", { className: "lf-squad-item__copy", children: [
            /* @__PURE__ */ s.jsxs("div", { className: "lf-squad-item__name", children: [
              c ? `Blocco ${u.realTeam || u.displayName}` : u.displayName,
              !u.active && " *",
              c && /* @__PURE__ */ s.jsx(Xe, { size: 14, className: p ? "lf-chevron-open" : "" })
            ] }),
            /* @__PURE__ */ s.jsxs("div", { className: `lf-squad-item__team ${c ? "lf-squad-item__team--block" : ""}`, children: [
              !c && h && /* @__PURE__ */ s.jsx("img", { className: "lf-squad-club-crest", src: h, alt: "", loading: "lazy", decoding: "async" }),
              /* @__PURE__ */ s.jsx("span", { children: c ? `${g.length} portieri` : u.realTeam || "—" })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ s.jsxs("div", { className: "lf-squad-values", children: [
          /* @__PURE__ */ s.jsxs("span", { children: [
            /* @__PURE__ */ s.jsx("small", { children: "Q" }),
            /* @__PURE__ */ s.jsx("strong", { children: u.quotation || "—" })
          ] }),
          /* @__PURE__ */ s.jsxs("span", { children: [
            /* @__PURE__ */ s.jsx("small", { children: "P" }),
            /* @__PURE__ */ s.jsx("strong", { className: "lf-squad-price", children: u.purchasePrice || "—" })
          ] })
        ] })
      ] });
      return /* @__PURE__ */ s.jsxs("div", { className: "lf-squad-item-wrap", children: [
        c ? /* @__PURE__ */ s.jsx("button", { type: "button", className: "lf-squad-item lf-squad-item--clickable", onClick: () => a(u.assetCode), "aria-expanded": p, children: y }) : /* @__PURE__ */ s.jsx("div", { className: "lf-squad-item", children: y }),
        c && p && /* @__PURE__ */ s.jsx("div", { className: "lf-squad-goalkeepers", children: g.map((v) => {
          var z;
          const w = (z = r.player(v, u.realTeam)) == null ? void 0 : z.photoUrl;
          return /* @__PURE__ */ s.jsxs("div", { className: "lf-squad-goalkeeper", children: [
            /* @__PURE__ */ s.jsx("div", { className: `lf-squad-goalkeeper__avatar ${w ? "has-photo" : ""}`, children: w ? /* @__PURE__ */ s.jsx("img", { src: w, alt: "", loading: "lazy", decoding: "async" }) : "P" }),
            /* @__PURE__ */ s.jsx("span", { children: v })
          ] }, v);
        }) })
      ] }, u.assetCode);
    }) })
  ] });
}
function Gp(e, t, n) {
  const { data: r } = e.getImageData(0, 0, t, n), l = [r[0], r[1], r[2], r[3]];
  let i = t, o = n, a = -1, u = -1;
  for (let v = 0; v < n; v += 1)
    for (let w = 0; w < t; w += 1) {
      const z = (v * t + w) * 4, d = r[z + 3];
      if (d <= 12)
        continue;
      const f = Math.abs(r[z] - l[0]) + Math.abs(r[z + 1] - l[1]) + Math.abs(r[z + 2] - l[2]) + Math.abs(d - l[3]);
      (l[3] <= 20 || f > 34) && (i = Math.min(i, w), o = Math.min(o, v), a = Math.max(a, w), u = Math.max(u, v));
    }
  if (a < i || u < o)
    return { x: 0, y: 0, width: t, height: n };
  const c = a - i + 1, p = u - o + 1, g = Math.max(2, Math.round(Math.max(c, p) * 0.035)), h = Math.max(0, i - g), y = Math.max(0, o - g);
  return {
    x: h,
    y,
    width: Math.min(t - h, c + g * 2),
    height: Math.min(n - y, p + g * 2)
  };
}
async function Yp(e) {
  if (!e.type.startsWith("image/"))
    throw new Error("Seleziona un file immagine.");
  if (e.size > 8 * 1024 * 1024)
    throw new Error("L'immagine originale è troppo pesante.");
  const t = await createImageBitmap(e), n = document.createElement("canvas");
  n.width = t.width, n.height = t.height;
  const r = n.getContext("2d", { willReadFrequently: !0 });
  if (!r)
    throw new Error("Impossibile elaborare l'immagine.");
  r.drawImage(t, 0, 0), t.close();
  const l = Gp(r, n.width, n.height), i = 256, o = document.createElement("canvas");
  o.width = i, o.height = i;
  const a = o.getContext("2d");
  if (!a)
    throw new Error("Impossibile elaborare l'immagine.");
  a.clearRect(0, 0, i, i);
  const u = Math.max(i / l.width, i / l.height), c = l.width * u, p = l.height * u;
  a.drawImage(
    n,
    l.x,
    l.y,
    l.width,
    l.height,
    (i - c) / 2,
    (i - p) / 2,
    c,
    p
  );
  const g = o.toDataURL("image/png", 0.92);
  return { mimeType: "image/png", dataBase64: g.split(",")[1], previewUrl: g };
}
async function Xp(e, t, n, r) {
  const l = await fetch("/api/team-logo", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ leagueId: e, teamName: t, code: n, upload: { mimeType: r.mimeType, dataBase64: r.dataBase64 } })
  }), i = await l.json().catch(() => ({}));
  if (!l.ok)
    throw new Error(i.error || `HTTP ${l.status}`);
  const o = String(i.logoUrl || "");
  return window.dispatchEvent(new CustomEvent("lineup:team-logo-updated", {
    detail: { leagueId: e, teamName: t, logoUrl: o }
  })), o;
}
function qp({ open: e, leagueId: t, teamName: n, currentLogo: r, onClose: l, onUpdated: i }) {
  const o = T.useRef(null), [a, u] = T.useState(""), [c, p] = T.useState(null), [g, h] = T.useState(""), [y, v] = T.useState(!1);
  T.useEffect(() => {
    const d = o.current;
    d && (e && !d.open && d.showModal(), !e && d.open && d.close());
  }, [e]);
  async function w(d) {
    if (d) {
      h("");
      try {
        p(await Yp(d));
      } catch (f) {
        h(f instanceof Error ? f.message : "Immagine non valida");
      }
    }
  }
  async function z() {
    if (!c) {
      h("Seleziona prima il nuovo stemma.");
      return;
    }
    if (!/^\d{6}$/.test(a)) {
      h("Inserisci il codice stemma di 6 cifre.");
      return;
    }
    v(!0), h("");
    try {
      const d = await Xp(t, n, a, c);
      i(d), p(null), u(""), l();
    } catch (d) {
      h(d instanceof Error ? d.message : "Caricamento non riuscito");
    } finally {
      v(!1);
    }
  }
  return /* @__PURE__ */ s.jsxs("dialog", { ref: o, className: "lf-logo-dialog", onClose: l, onCancel: (d) => {
    d.preventDefault(), l();
  }, children: [
    /* @__PURE__ */ s.jsxs("div", { className: "lf-logo-dialog__head", children: [
      /* @__PURE__ */ s.jsxs("div", { children: [
        /* @__PURE__ */ s.jsx("small", { children: "STEMMA FANTASQUADRA" }),
        /* @__PURE__ */ s.jsx("h3", { children: n })
      ] }),
      /* @__PURE__ */ s.jsx("button", { type: "button", onClick: l, "aria-label": "Chiudi", children: "×" })
    ] }),
    /* @__PURE__ */ s.jsx("div", { className: "lf-logo-dialog__preview", children: c != null && c.previewUrl || r ? /* @__PURE__ */ s.jsx("img", { src: (c == null ? void 0 : c.previewUrl) || r, alt: "Anteprima stemma" }) : /* @__PURE__ */ s.jsx("span", { children: n.charAt(0).toUpperCase() }) }),
    /* @__PURE__ */ s.jsxs("label", { className: "lf-logo-file", children: [
      "Scegli immagine",
      /* @__PURE__ */ s.jsx("input", { type: "file", accept: "image/png,image/jpeg,image/webp", onChange: (d) => {
        var f;
        return w((f = d.target.files) == null ? void 0 : f[0]);
      } })
    ] }),
    /* @__PURE__ */ s.jsxs("label", { className: "lf-logo-code", children: [
      "Codice stemma",
      /* @__PURE__ */ s.jsx("input", { inputMode: "numeric", pattern: "[0-9]*", maxLength: 6, value: a, onChange: (d) => u(d.target.value.replace(/\D/g, "").slice(0, 6)), placeholder: "000000" })
    ] }),
    g && /* @__PURE__ */ s.jsx("p", { className: "lf-logo-dialog__status", children: g }),
    /* @__PURE__ */ s.jsx("button", { className: "lf-logo-dialog__save", type: "button", disabled: y, onClick: z, children: y ? "Caricamento…" : "Aggiorna stemma" }),
    /* @__PURE__ */ s.jsx("p", { className: "lf-logo-dialog__help", children: "Il codice modifica soltanto lo stemma di questa fantasquadra." })
  ] });
}
const di = { P: 2, D: 8, C: 8, A: 6 }, Zp = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2 });
function Jp({ team: e, leagueId: t, media: n, onLogoUpdated: r }) {
  const [l, i] = T.useState("ALL"), [o, a] = T.useState(!1), [u, c] = T.useState(!1), p = (y) => {
    i((v) => v === y ? "ALL" : y);
  }, g = !!(e.logoUrl && !o), h = e.credits === null ? "—" : Zp.format(e.credits);
  return /* @__PURE__ */ s.jsxs("article", { className: "lf-team-card", children: [
    /* @__PURE__ */ s.jsxs("header", { className: "lf-team-card__header", children: [
      /* @__PURE__ */ s.jsxs("div", { className: "lf-team-card__identity", children: [
        /* @__PURE__ */ s.jsxs("button", { type: "button", className: `lf-team-card__avatar lf-team-card__avatar--editable ${g ? "has-logo" : ""}`, onClick: () => c(!0), title: "Cambia stemma", children: [
          g ? /* @__PURE__ */ s.jsx("img", { src: e.logoUrl, alt: `Logo di ${e.managerName}`, loading: "lazy", referrerPolicy: "no-referrer", onError: () => a(!0) }) : e.managerName.charAt(0).toUpperCase(),
          /* @__PURE__ */ s.jsx("span", { className: "lf-team-card__avatar-edit", "aria-hidden": "true", children: "✎" })
        ] }),
        /* @__PURE__ */ s.jsxs("div", { className: "lf-team-card__copy", children: [
          /* @__PURE__ */ s.jsx("span", { className: "lf-team-card__eyebrow", children: "Allenatore" }),
          /* @__PURE__ */ s.jsx("h2", { title: e.managerName, children: e.managerName })
        ] })
      ] }),
      /* @__PURE__ */ s.jsxs("div", { className: "lf-team-card__meta", children: [
        /* @__PURE__ */ s.jsxs("div", { className: "lf-team-card__credits", children: [
          /* @__PURE__ */ s.jsx("span", { children: "Crediti" }),
          /* @__PURE__ */ s.jsxs("strong", { children: [
            /* @__PURE__ */ s.jsx(Pp, { size: 16 }),
            " ",
            h
          ] })
        ] }),
        /* @__PURE__ */ s.jsxs("div", { className: `lf-team-status ${e.isComplete ? "lf-team-status--complete" : "lf-team-status--incomplete"}`, children: [
          e.isComplete ? /* @__PURE__ */ s.jsx(yl, { size: 13 }) : /* @__PURE__ */ s.jsx(Tp, { size: 13 }),
          e.isComplete ? "ROSA COMPLETA" : "INCOMPLETA"
        ] })
      ] })
    ] }),
    /* @__PURE__ */ s.jsx("div", { className: "lf-team-role-filters", "aria-label": `Filtra la rosa di ${e.managerName} per ruolo`, children: Object.keys(di).map((y) => {
      const v = e.roleCounts[y] === di[y];
      return /* @__PURE__ */ s.jsxs(
        "button",
        {
          type: "button",
          onClick: () => p(y),
          className: `${l === y ? "is-active" : ""} ${v ? "is-complete" : ""}`,
          children: [
            y,
            ": ",
            e.roleCounts[y],
            "/",
            di[y]
          ]
        },
        y
      );
    }) }),
    /* @__PURE__ */ s.jsx("div", { className: "lf-team-roster-frame", children: /* @__PURE__ */ s.jsxs("div", { className: "lf-team-roster", children: [
      (l === "ALL" || l === "P") && /* @__PURE__ */ s.jsx(zr, { players: e.players, role: "P", label: "Portieri", media: n }),
      (l === "ALL" || l === "D") && /* @__PURE__ */ s.jsx(zr, { players: e.players, role: "D", label: "Difensori", media: n }),
      (l === "ALL" || l === "C") && /* @__PURE__ */ s.jsx(zr, { players: e.players, role: "C", label: "Centrocampisti", media: n }),
      (l === "ALL" || l === "A") && /* @__PURE__ */ s.jsx(zr, { players: e.players, role: "A", label: "Attaccanti", media: n })
    ] }) }),
    /* @__PURE__ */ s.jsx(qp, { open: u, leagueId: t, teamName: e.managerName, currentLogo: e.logoUrl, onClose: () => c(!1), onUpdated: (y) => {
      a(!1), r(y);
    } })
  ] });
}
function pi(e) {
  return !!e && typeof e == "object" && !Array.isArray(e);
}
function bp(e) {
  if (typeof e == "number" && Number.isFinite(e))
    return e;
  if (typeof e == "string" && e.trim() !== "") {
    const t = Number(e.trim().replace(",", "."));
    return Number.isFinite(t) ? t : null;
  }
  return null;
}
function xa(e) {
  if (!pi(e))
    return {};
  const t = pi(e.teams) ? e.teams : e;
  return Object.entries(t).reduce((n, [r, l]) => {
    if (!pi(l))
      return n;
    const i = l, o = i.logoUrl ?? i.logo_url;
    return n[r] = {
      credits: bp(i.credits),
      logoUrl: typeof o == "string" ? o.trim() : ""
    }, n;
  }, {});
}
async function Kc(e, t) {
  if (!e)
    return {};
  try {
    const o = await fetch(`/api/settings?league=${encodeURIComponent(e)}&_lf=${Date.now()}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache, no-store, max-age=0", Pragma: "no-cache" }
    });
    if (o.ok) {
      const a = await o.json();
      return xa({ teams: a.teams });
    }
  } catch {
  }
  const n = t || `/data/${encodeURIComponent(e)}/teams.json`, r = n.includes("?") ? "&" : "?", l = `${n}${r}_lf=${Date.now()}`, i = await fetch(l, {
    cache: "no-store",
    headers: { "Cache-Control": "no-cache, no-store, max-age=0", Pragma: "no-cache" }
  });
  if (i.status === 404)
    return {};
  if (!i.ok)
    throw new Error(`Impossibile caricare i profili rose: HTTP ${i.status}`);
  return xa(await i.json());
}
class em extends Error {
  constructor(n, r) {
    super(`HTTP ${n}: ${r}`);
    fr(this, "status");
    fr(this, "url");
    this.name = "HttpError", this.status = n, this.url = r;
  }
}
function tm(e, t = "_lf") {
  const n = e.includes("?") ? "&" : "?";
  return `${e}${n}${encodeURIComponent(t)}=${Date.now()}`;
}
async function nm(e, t) {
  const n = tm(e), r = await fetch(n, {
    cache: "no-store",
    signal: t,
    headers: {
      "Cache-Control": "no-cache, no-store, max-age=0",
      Pragma: "no-cache"
    }
  });
  if (!r.ok)
    throw new em(r.status, e);
  return r.text();
}
function rm() {
  return document.documentElement.dataset.leagueSection ?? "formation";
}
function Gc(e, t = 3e4) {
  const [n, r] = T.useState(0);
  return T.useEffect(() => {
    const l = () => r((u) => u + 1), i = (u) => {
      const c = u.detail;
      (c == null ? void 0 : c.section) === e && l();
    }, o = () => {
      !document.hidden && rm() === e && l();
    }, a = window.setInterval(o, t);
    return window.addEventListener("lineup:league-section-change", i), window.addEventListener("focus", o), document.addEventListener("visibilitychange", o), () => {
      window.clearInterval(a), window.removeEventListener("lineup:league-section-change", i), window.removeEventListener("focus", o), document.removeEventListener("visibilitychange", o);
    };
  }, [t, e]), n;
}
const Sa = nm, ja = { P: 2, D: 8, C: 8, A: 6 }, lm = Il("teams");
function im({ assets: e, leagueId: t, profilesUrl: n }) {
  const [r, l] = T.useState({}), i = Gc("rose"), o = Qc(e, t);
  T.useEffect(() => {
    let u = !1;
    return Kc(t, n).then((c) => {
      u || l(c);
    }).catch((c) => {
      lm.warn("profiles load failed", c), u || l({});
    }), () => {
      u = !0;
    };
  }, [t, n, i]);
  const a = T.useMemo(() => {
    const u = /* @__PURE__ */ new Map();
    return e.forEach((p) => {
      if (p.isFreeAgent || !p.ownerTag)
        return;
      const g = p.ownerTag.trim();
      if (!g)
        return;
      const h = u.get(g) ?? [];
      h.push(p), u.set(g, h);
    }), [...u.entries()].map(([p, g]) => {
      var z;
      const h = { P: 0, D: 0, C: 0, A: 0 };
      g.forEach((d) => {
        d.role in h && (h[d.role] += 1);
      });
      const y = Object.keys(ja).every((d) => h[d] === ja[d]), v = r[p], w = ((z = g.find((d) => d.managerCredits !== null)) == null ? void 0 : z.managerCredits) ?? null;
      return {
        managerName: p,
        credits: w ?? (v == null ? void 0 : v.credits) ?? null,
        logoUrl: (v == null ? void 0 : v.logoUrl) ?? "",
        players: g,
        isComplete: y,
        roleCounts: h,
        totalPlayers: g.length
      };
    }).sort((p, g) => {
      const h = p.managerName.includes("-"), y = g.managerName.includes("-");
      return h !== y ? h ? 1 : -1 : p.managerName.localeCompare(g.managerName, "it");
    });
  }, [e, r]);
  return /* @__PURE__ */ s.jsx("div", { className: "tw-px-2 tw-py-3 sm:tw-px-5 sm:tw-py-7 lg:tw-px-7", children: /* @__PURE__ */ s.jsx("section", { className: "lf-dashboard-card tw-mx-auto tw-max-w-7xl", children: a.length > 0 ? /* @__PURE__ */ s.jsx("div", { className: "lf-teams-grid", children: a.map((u) => /* @__PURE__ */ s.jsx(Jp, { team: u, leagueId: t, media: o, onLogoUpdated: (c) => l((p) => ({ ...p, [u.managerName]: { ...p[u.managerName] || { credits: u.credits }, logoUrl: c } })) }, u.managerName)) }) : /* @__PURE__ */ s.jsxs("div", { className: "lf-teams-empty", children: [
    /* @__PURE__ */ s.jsx(Cp, { size: 34 }),
    /* @__PURE__ */ s.jsx("h2", { children: "Nessuna rosa disponibile" }),
    /* @__PURE__ */ s.jsx("p", { children: "Nel CSV non risultano asset assegnati a un proprietario." })
  ] }) }) });
}
function om() {
  var r;
  const { state: e, assets: t, league: n } = Wc();
  return e.status === "error" ? /* @__PURE__ */ s.jsx("div", { className: "tw-p-4", children: /* @__PURE__ */ s.jsxs("section", { className: "lf-dashboard-card tw-mx-auto tw-max-w-4xl tw-p-7 tw-text-center", children: [
    /* @__PURE__ */ s.jsx("h2", { className: "tw-m-0 tw-text-lg tw-font-bold tw-text-red-600", children: "Errore nel caricamento delle Rose" }),
    /* @__PURE__ */ s.jsx("p", { className: "tw-mb-0 tw-mt-2 tw-text-sm tw-text-slate-500", children: "Controlla il CSV della lega e ricarica la pagina." })
  ] }) }) : e.status !== "ready" ? /* @__PURE__ */ s.jsx("div", { className: "tw-p-4", children: /* @__PURE__ */ s.jsxs("section", { className: "lf-dashboard-card tw-mx-auto tw-max-w-4xl tw-p-7 tw-text-center", children: [
    /* @__PURE__ */ s.jsx("div", { className: "lf-spinner tw-mx-auto tw-mb-3" }),
    /* @__PURE__ */ s.jsx("p", { className: "tw-m-0 tw-text-sm tw-font-semibold tw-text-slate-500", children: "Caricamento delle Rose…" })
  ] }) }) : /* @__PURE__ */ s.jsx(im, { assets: t, leagueId: (n == null ? void 0 : n.id) ?? "", profilesUrl: (r = n == null ? void 0 : n.leagueData) == null ? void 0 : r.teamProfilesUrl });
}
function sm(e) {
  const t = [];
  let n = [], r = "", l = !1;
  const i = String(e ?? "").replace(/^\uFEFF/, "");
  for (let o = 0; o < i.length; o += 1) {
    const a = i[o];
    if (a === '"') {
      l && i[o + 1] === '"' ? (r += '"', o += 1) : l = !l;
      continue;
    }
    if (a === "," && !l) {
      n.push(r.trim()), r = "";
      continue;
    }
    if ((a === `
` || a === "\r") && !l) {
      a === "\r" && i[o + 1] === `
` && (o += 1), n.push(r.trim()), n.some((u) => u.length > 0) && t.push(n), n = [], r = "";
      continue;
    }
    r += a;
  }
  return n.push(r.trim()), n.some((o) => o.length > 0) && t.push(n), t;
}
function un(e) {
  return String(e ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}
function Lr(e) {
  return un(e).replace(/[‐‑‒–—]/g, "-").replace(/\s*-\s*/g, "-").replace(/[^a-z0-9-]/g, "");
}
function Wr(e) {
  const t = String(e ?? "").trim().replace(/\s+/g, "").replace(",", ".");
  if (!t)
    return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
function Pt(e) {
  const t = Wr(e);
  return t === null ? null : Math.trunc(t);
}
function he(e, t, n = 0) {
  const r = un(t);
  for (let l = n; l < e.length; l += 1)
    if (un(e[l]) === r)
      return l;
  return -1;
}
function am(e) {
  const t = sm(e), n = [
    "Nome",
    "Punti",
    "Vittorie",
    "Pareggi",
    "Sconfitte",
    "Gol Fatti",
    "Gol Subiti",
    "Differenza Reti",
    "Fanta Punti"
  ], r = t.findIndex(
    (v) => n.every((w) => he(v, w) >= 0)
  );
  if (r < 0)
    throw new Error("Il CSV Classifica non contiene le colonne richieste.");
  const l = t[r], i = {
    name: he(l, "Nome"),
    points: he(l, "Punti"),
    wins: he(l, "Vittorie"),
    draws: he(l, "Pareggi"),
    losses: he(l, "Sconfitte"),
    goalsFor: he(l, "Gol Fatti"),
    goalsAgainst: he(l, "Gol Subiti"),
    goalDifference: he(l, "Differenza Reti"),
    fantasyPoints: he(l, "Fanta Punti")
  }, o = [];
  for (const v of t.slice(r + 1)) {
    const w = String(v[i.name] ?? "").trim();
    if (v.map(un).join("|").includes("classifica per fp"))
      break;
    if (!w)
      continue;
    const d = Pt(v[i.points]), f = Pt(v[i.wins]), m = Pt(v[i.draws]), x = Pt(v[i.losses]), j = Pt(v[i.goalsFor]), N = Pt(v[i.goalsAgainst]), C = Pt(v[i.goalDifference]), _ = Wr(v[i.fantasyPoints]);
    d === null || f === null || m === null || x === null || j === null || N === null || _ === null || o.push({
      team: w,
      points: d,
      wins: f,
      draws: m,
      losses: x,
      goalsFor: j,
      goalsAgainst: N,
      goalDifference: C ?? j - N,
      fantasyPoints: _,
      played: f + m + x
    });
  }
  const a = t.findIndex(
    (v) => v.some((w) => un(w) === "classifica per fp")
  ), u = /* @__PURE__ */ new Map(), c = [];
  if (a >= 0) {
    const v = t.findIndex((w, z) => {
      if (z <= a)
        return !1;
      const d = w.map(un);
      return d.filter((f) => f === "nome").length >= 2 && d.includes("fanta punti") && d.includes("penalita");
    });
    if (v >= 0) {
      const w = t[v], z = he(w, "Nome"), d = he(w, "Fanta Punti", z + 1), f = he(w, "Nome", d + 1), m = he(w, "Penalità", f + 1);
      for (const x of t.slice(v + 1)) {
        const j = String(x[z] ?? "").trim(), N = Wr(x[d]);
        j && N !== null && c.push({ team: j, fantasyPoints: N });
        const C = String(x[f] ?? "").trim(), _ = Wr(x[m]);
        C && _ !== null && _ !== 0 && u.set(Lr(C), Math.abs(_));
      }
    }
  }
  const p = o.map((v, w) => ({
    ...v,
    position: w + 1,
    penalty: u.get(Lr(v.team)) ?? 0
  })), g = new Map(
    p.map((v) => [Lr(v.team), v])
  ), y = (c.length > 0 ? c : p.map((v) => ({ team: v.team, fantasyPoints: v.fantasyPoints })).sort((v, w) => w.fantasyPoints - v.fantasyPoints)).map((v, w) => {
    var z;
    return {
      position: w + 1,
      team: v.team,
      fantasyPoints: v.fantasyPoints,
      leaguePosition: ((z = g.get(Lr(v.team))) == null ? void 0 : z.position) ?? null
    };
  });
  return { league: p, fantasy: y };
}
function ka(e) {
  return new Intl.NumberFormat("it-IT", {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(e) ? 0 : 1
  }).format(e);
}
function um(e) {
  return e > 0 ? `+${e}` : String(e);
}
function cm(e) {
  return e.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, " ").trim().toLowerCase();
}
function Na({ team: e, teamLogos: t = {}, penalty: n = 0 }) {
  const r = e.trim().charAt(0).toUpperCase() || "?", l = t[cm(e)] || "";
  return /* @__PURE__ */ s.jsxs("div", { className: "lf-standings-team-cell", children: [
    /* @__PURE__ */ s.jsx("span", { className: `lf-standings-team-mark ${l ? "has-logo" : ""}`, "aria-hidden": "true", children: l ? /* @__PURE__ */ s.jsx("img", { src: l, alt: "", loading: "lazy", referrerPolicy: "no-referrer" }) : r }),
    /* @__PURE__ */ s.jsx("strong", { children: e }),
    n > 0 && /* @__PURE__ */ s.jsxs("span", { className: "lf-standings-penalty", title: `${n} ${n === 1 ? "punto" : "punti"} di penalizzazione`, children: [
      "−",
      n
    ] })
  ] });
}
function fm(e, t) {
  return t ? [...e].sort((n, r) => (t.direction === "desc" ? r[t.key] - n[t.key] : n[t.key] - r[t.key]) || n.position - r.position) : e;
}
function Ca({
  label: e,
  sortKey: t,
  sort: n,
  onSort: r
}) {
  const l = (n == null ? void 0 : n.key) === t, i = l ? n.direction === "desc" ? "descending" : "ascending" : "none", o = l ? n.direction === "desc" ? "decrescente" : "crescente" : "ordine classifica";
  return /* @__PURE__ */ s.jsx("th", { scope: "col", "aria-sort": i, className: l ? "is-sorted" : "", children: /* @__PURE__ */ s.jsxs(
    "button",
    {
      type: "button",
      className: "lf-standings-sort-button",
      onClick: () => r(t),
      title: `${e}: ${o}`,
      "aria-label": `Ordina ${e}. Stato attuale: ${o}.`,
      children: [
        /* @__PURE__ */ s.jsx("span", { children: e }),
        /* @__PURE__ */ s.jsx("span", { className: "lf-standings-sort-icon", "aria-hidden": "true", children: l ? n.direction === "desc" ? "↓" : "↑" : "↕" })
      ]
    }
  ) });
}
function dm({ data: e, leagueName: t, teamLogos: n = {} }) {
  const [r, l] = T.useState("league"), [i, o] = T.useState(null), a = T.useMemo(
    () => fm(e.league, i),
    [e.league, i]
  );
  function u(c) {
    o((p) => !p || p.key !== c ? { key: c, direction: "desc" } : p.direction === "desc" ? { key: c, direction: "asc" } : null);
  }
  return e.league.length === 0 ? /* @__PURE__ */ s.jsx("div", { className: "lf-standings-shell", children: /* @__PURE__ */ s.jsxs("section", { className: "lf-dashboard-card lf-standings-state", children: [
    /* @__PURE__ */ s.jsx("strong", { children: "Classifica non ancora disponibile" }),
    /* @__PURE__ */ s.jsxs("p", { children: [
      "La fonte di ",
      t,
      " non è stata ancora configurata."
    ] })
  ] }) }) : /* @__PURE__ */ s.jsx("div", { className: "lf-standings-shell", children: /* @__PURE__ */ s.jsxs("section", { className: "lf-dashboard-card lf-standings-card", children: [
    /* @__PURE__ */ s.jsxs("div", { className: "lf-standings-toolbar", role: "tablist", "aria-label": "Tipo di classifica", children: [
      /* @__PURE__ */ s.jsx(
        "button",
        {
          type: "button",
          className: r === "league" ? "is-active" : "",
          role: "tab",
          "aria-selected": r === "league",
          onClick: () => l("league"),
          children: "Classifica"
        }
      ),
      /* @__PURE__ */ s.jsx(
        "button",
        {
          type: "button",
          className: r === "fantasy" ? "is-active" : "",
          role: "tab",
          "aria-selected": r === "fantasy",
          onClick: () => l("fantasy"),
          children: "Fanta punti"
        }
      )
    ] }),
    r === "league" ? /* @__PURE__ */ s.jsx(s.Fragment, { children: /* @__PURE__ */ s.jsx("div", { className: "lf-standings-table-wrap", role: "region", "aria-label": "Classifica generale", tabIndex: 0, children: /* @__PURE__ */ s.jsxs("table", { className: "lf-standings-table", children: [
      /* @__PURE__ */ s.jsx("thead", { children: /* @__PURE__ */ s.jsxs("tr", { children: [
        /* @__PURE__ */ s.jsx("th", { className: "lf-standings-rank-col", scope: "col", children: "#" }),
        /* @__PURE__ */ s.jsx("th", { className: "lf-standings-team-col", scope: "col", children: "Squadra" }),
        /* @__PURE__ */ s.jsx("th", { className: "is-points", scope: "col", children: "Pt" }),
        /* @__PURE__ */ s.jsx("th", { scope: "col", children: "G" }),
        /* @__PURE__ */ s.jsx("th", { scope: "col", children: "V" }),
        /* @__PURE__ */ s.jsx("th", { scope: "col", children: "N" }),
        /* @__PURE__ */ s.jsx("th", { scope: "col", children: "P" }),
        /* @__PURE__ */ s.jsx(Ca, { label: "GF", sortKey: "goalsFor", sort: i, onSort: u }),
        /* @__PURE__ */ s.jsx(Ca, { label: "GS", sortKey: "goalsAgainst", sort: i, onSort: u }),
        /* @__PURE__ */ s.jsx("th", { scope: "col", children: "DR" }),
        /* @__PURE__ */ s.jsx("th", { scope: "col", children: "FP" })
      ] }) }),
      /* @__PURE__ */ s.jsx("tbody", { children: a.map((c, p) => {
        const g = i ? p + 1 : c.position;
        return /* @__PURE__ */ s.jsxs("tr", { className: g <= 3 ? `is-top-${g}` : "", children: [
          /* @__PURE__ */ s.jsx("td", { className: "lf-standings-rank-col", children: /* @__PURE__ */ s.jsx("b", { children: g }) }),
          /* @__PURE__ */ s.jsx("td", { className: "lf-standings-team-col", children: /* @__PURE__ */ s.jsx(Na, { team: c.team, teamLogos: n, penalty: c.penalty }) }),
          /* @__PURE__ */ s.jsx("td", { className: "is-points", children: /* @__PURE__ */ s.jsx("strong", { children: c.points }) }),
          /* @__PURE__ */ s.jsx("td", { children: c.played }),
          /* @__PURE__ */ s.jsx("td", { children: c.wins }),
          /* @__PURE__ */ s.jsx("td", { children: c.draws }),
          /* @__PURE__ */ s.jsx("td", { children: c.losses }),
          /* @__PURE__ */ s.jsx("td", { children: c.goalsFor }),
          /* @__PURE__ */ s.jsx("td", { children: c.goalsAgainst }),
          /* @__PURE__ */ s.jsx("td", { className: c.goalDifference > 0 ? "is-positive" : c.goalDifference < 0 ? "is-negative" : "", children: um(c.goalDifference) }),
          /* @__PURE__ */ s.jsx("td", { children: ka(c.fantasyPoints) })
        ] }, c.team);
      }) })
    ] }) }) }) : /* @__PURE__ */ s.jsx("div", { className: "lf-standings-fantasy-wrap", children: /* @__PURE__ */ s.jsxs("table", { className: "lf-standings-table lf-standings-table--fantasy", children: [
      /* @__PURE__ */ s.jsx("thead", { children: /* @__PURE__ */ s.jsxs("tr", { children: [
        /* @__PURE__ */ s.jsx("th", { scope: "col", children: "#" }),
        /* @__PURE__ */ s.jsx("th", { scope: "col", children: "Squadra" }),
        /* @__PURE__ */ s.jsx("th", { scope: "col", children: "Fanta punti" })
      ] }) }),
      /* @__PURE__ */ s.jsx("tbody", { children: e.fantasy.map((c) => /* @__PURE__ */ s.jsxs("tr", { className: c.position <= 3 ? `is-top-${c.position}` : "", children: [
        /* @__PURE__ */ s.jsx("td", { children: /* @__PURE__ */ s.jsx("b", { children: c.position }) }),
        /* @__PURE__ */ s.jsx("td", { children: /* @__PURE__ */ s.jsx(Na, { team: c.team, teamLogos: n }) }),
        /* @__PURE__ */ s.jsx("td", { className: "is-fantasy-points", children: /* @__PURE__ */ s.jsx("strong", { children: ka(c.fantasyPoints) }) })
      ] }, c.team)) })
    ] }) })
  ] }) });
}
const Ea = /* @__PURE__ */ new Map();
function pm(e) {
  var i;
  const t = String(e || "").toLowerCase();
  if (!t)
    return Promise.reject(new Error("Lega non disponibile"));
  const n = Ea.get(t);
  if (n)
    return n;
  const r = (i = window.LINEUP_FANTA) == null ? void 0 : i.league, l = fetch(`/api/settings?league=${encodeURIComponent(t)}&_lf=${Date.now()}`, {
    cache: "no-store",
    headers: { Accept: "application/json", "Cache-Control": "no-cache" }
  }).then(async (o) => {
    if (!o.ok)
      throw new Error(`HTTP ${o.status}`);
    return o.json();
  }).catch(() => {
    var o;
    return {
      leagueId: t,
      listoneCsvUrl: (r == null ? void 0 : r.csvUrl) ?? "",
      standingsCsvUrl: ((o = r == null ? void 0 : r.leagueData) == null ? void 0 : o.standingsCsvUrl) ?? "",
      disciplineDocUrl: "",
      teams: {}
    };
  });
  return Ea.set(t, l), l;
}
const mm = 5 * 6e4;
function Yc(e) {
  return `lineup-fanta-discipline-v4:${e}`;
}
function Xc(e, t = !0) {
  try {
    const n = JSON.parse(localStorage.getItem(Yc(e)) || "null");
    return !(n != null && n.data) || !Number.isFinite(n.savedAt) || !t && Date.now() - n.savedAt >= mm ? null : n;
  } catch {
    return null;
  }
}
function hm(e, t) {
  try {
    localStorage.setItem(Yc(e), JSON.stringify({ savedAt: Date.now(), data: t }));
  } catch {
  }
}
async function gm(e, t) {
  const n = Xc(e, !1);
  if (n)
    return n.data;
  const r = await fetch(`/api/discipline?league=${encodeURIComponent(e)}`, {
    cache: "default",
    signal: t,
    headers: { Accept: "application/json" }
  });
  if (!r.ok)
    throw new Error(`HTTP ${r.status}`);
  const l = await r.json();
  return hm(e, l), l;
}
function ot({ text: e }) {
  return /* @__PURE__ */ s.jsx("p", { className: "lf-discipline-empty", children: e });
}
function vm(e) {
  const t = String(e || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!t)
    return e || "";
  const n = t[3].length === 2 ? 2e3 + Number(t[3]) : Number(t[3]), r = new Date(Date.UTC(n, Number(t[2]) - 1, Number(t[1])));
  return Number.isNaN(r.getTime()) ? e || "" : new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(r);
}
function ym(e, t) {
  return String(e || "").replace(/^\d{1,2}\/\d{1,2}\/\d{2,4}\s*[-–—]?\s*/i, "").replace(/^.*?\s+(?:riceve|ha ricevuto)\s*/i, "").replace(/^un\s+richiamo\s+per\s+/i, "").replace(/^una?\s+penalizzazione(?:\s+di\s+-?\d+\s+punt[io])?\s*(?:per)?\s*/i, "").replace(/\(\s*\d+\s+richiam[oi]\s*\)\s*$/i, "").trim() || (t === "penalty" ? "Penalizzazione prevista dal regolamento" : "Richiamo disciplinare");
}
function _a({ name: e, date: t, reason: n, note: r, type: l }) {
  return /* @__PURE__ */ s.jsxs("div", { className: "lf-discipline-item-copy", children: [
    /* @__PURE__ */ s.jsx("strong", { children: e }),
    /* @__PURE__ */ s.jsx("span", { children: n || ym(r, l) }),
    t && /* @__PURE__ */ s.jsx("time", { children: vm(t) })
  ] });
}
function wm({ data: e, loading: t, error: n }) {
  return /* @__PURE__ */ s.jsxs("section", { className: "lf-dashboard-card lf-discipline-card", "aria-label": "Richiami e penalizzazioni", children: [
    /* @__PURE__ */ s.jsxs("div", { className: "lf-discipline-column", children: [
      /* @__PURE__ */ s.jsxs("header", { children: [
        /* @__PURE__ */ s.jsx("span", { children: "!" }),
        /* @__PURE__ */ s.jsx("h3", { children: "Richiami" })
      ] }),
      t ? /* @__PURE__ */ s.jsx(ot, { text: "Caricamento…" }) : n ? /* @__PURE__ */ s.jsx(ot, { text: n }) : e.configured ? e.recalls.length ? /* @__PURE__ */ s.jsx("div", { className: "lf-discipline-list", children: e.recalls.map((r, l) => /* @__PURE__ */ s.jsxs("article", { children: [
        /* @__PURE__ */ s.jsx(_a, { name: r.name, date: r.date, reason: r.reason, note: r.note, type: "recall" }),
        /* @__PURE__ */ s.jsxs("b", { title: `${r.count}° richiamo`, children: [
          r.count,
          "° richiamo"
        ] })
      ] }, `${r.name}-${r.date || l}-${l}`)) }) : /* @__PURE__ */ s.jsx(ot, { text: "Nessun richiamo." }) : /* @__PURE__ */ s.jsx(ot, { text: "Documento non configurato." })
    ] }),
    /* @__PURE__ */ s.jsxs("div", { className: "lf-discipline-column lf-discipline-column--penalties", children: [
      /* @__PURE__ */ s.jsxs("header", { children: [
        /* @__PURE__ */ s.jsx("span", { children: "−" }),
        /* @__PURE__ */ s.jsx("h3", { children: "Penalizzazioni" })
      ] }),
      t ? /* @__PURE__ */ s.jsx(ot, { text: "Caricamento…" }) : n ? /* @__PURE__ */ s.jsx(ot, { text: n }) : e.configured ? e.penalties.length ? /* @__PURE__ */ s.jsx("div", { className: "lf-discipline-list", children: e.penalties.map((r, l) => {
        const i = typeof r.points == "number" ? Math.abs(r.points) : null, o = i === null ? "Penalità" : `−${i} ${i === 1 ? "punto" : "punti"}`;
        return /* @__PURE__ */ s.jsxs("article", { children: [
          /* @__PURE__ */ s.jsx(_a, { name: r.name, date: r.date, reason: r.reason, note: r.note, type: "penalty" }),
          /* @__PURE__ */ s.jsx("b", { title: i === null ? "Penalizzazione" : `${i} ${i === 1 ? "punto" : "punti"} di penalizzazione`, children: o })
        ] }, `${r.name}-${r.date || l}-${l}`);
      }) }) : /* @__PURE__ */ s.jsx(ot, { text: "Nessuna penalizzazione." }) : /* @__PURE__ */ s.jsx(ot, { text: "Documento non configurato." })
    ] })
  ] });
}
const Pa = { league: [], fantasy: [] }, xm = { recalls: [], penalties: [], configured: !1 }, Dr = Il("standings");
function Sm() {
  var _, U, D, re;
  const e = (_ = window.LINEUP_FANTA) == null ? void 0 : _.league, t = (e == null ? void 0 : e.id) ?? "", n = ((U = e == null ? void 0 : e.leagueData) == null ? void 0 : U.standingsFallbackUrl) ?? "", [r, l] = T.useState("loading"), [i, o] = T.useState(Pa), [a, u] = T.useState(""), c = ((D = Xc(t)) == null ? void 0 : D.data) ?? null, [p, g] = T.useState(c ?? xm), [h, y] = T.useState(!c), [v, w] = T.useState(""), [z, d] = T.useState({}), f = T.useRef(!1), m = T.useRef(!!c), x = T.useRef(""), j = Gc("classifica");
  T.useEffect(() => {
    const $ = new AbortController();
    async function E() {
      !f.current && l("loading"), u("");
      try {
        const Ke = (await pm(t)).standingsCsvUrl;
        if (!Ke)
          o(Pa), l("ready");
        else {
          let _e;
          try {
            _e = await Sa(Ke, $.signal);
          } catch (k) {
            if (!n || $.signal.aborted)
              throw k;
            Dr.warn("primary source unavailable; using fallback", k), _e = await Sa(n, $.signal);
          }
          if (_e !== x.current) {
            const k = am(_e);
            if (k.league.length === 0 && f.current)
              throw new Error("Aggiornamento vuoto della Classifica");
            x.current = _e, o(k);
          }
          f.current = !0, l("ready");
        }
      } catch (G) {
        $.signal.aborted || (Dr.error("load failed", G), f.current || (u("La Classifica non è disponibile. Controlla la fonte configurata e riprova."), l("error")));
      }
    }
    return E(), () => $.abort();
  }, [t, n, j]), T.useEffect(() => {
    var E;
    let $ = !1;
    return Kc(t, (E = e == null ? void 0 : e.leagueData) == null ? void 0 : E.teamProfilesUrl).then((R) => {
      $ || d(R);
    }).catch((R) => {
      Dr.warn("team profiles load failed", R);
    }), () => {
      $ = !0;
    };
  }, [t, (re = e == null ? void 0 : e.leagueData) == null ? void 0 : re.teamProfilesUrl, j]), T.useEffect(() => {
    const $ = (E) => {
      const R = E.detail;
      !R || R.leagueId !== t || !R.teamName || d((G) => ({
        ...G,
        [R.teamName]: {
          ...G[R.teamName] || { credits: null, logoUrl: "" },
          logoUrl: R.logoUrl
        }
      }));
    };
    return window.addEventListener("lineup:team-logo-updated", $), () => window.removeEventListener("lineup:team-logo-updated", $);
  }, [t]), T.useEffect(() => {
    const $ = new AbortController();
    return (async () => {
      const R = !m.current;
      R && y(!0);
      try {
        const G = await gm(t, $.signal);
        $.signal.aborted || (g(G), w(""), m.current = !0);
      } catch (G) {
        $.signal.aborted || (Dr.warn("discipline load failed", G), m.current || w("Richiami e penalizzazioni non disponibili"));
      } finally {
        !$.signal.aborted && R && y(!1);
      }
    })(), () => $.abort();
  }, [t, j]);
  const N = T.useMemo(() => (e == null ? void 0 : e.label) ?? (e == null ? void 0 : e.name) ?? "Lega", [e]), C = T.useMemo(() => Object.entries(z).reduce(($, [E, R]) => {
    const G = E.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, " ").trim().toLowerCase();
    return R.logoUrl && ($[G] = R.logoUrl), $;
  }, {}), [z]);
  return r === "loading" ? /* @__PURE__ */ s.jsx("div", { className: "lf-standings-shell", children: /* @__PURE__ */ s.jsxs("section", { className: "lf-dashboard-card lf-standings-state", children: [
    /* @__PURE__ */ s.jsx("div", { className: "lf-spinner" }),
    /* @__PURE__ */ s.jsx("p", { children: "Caricamento della Classifica…" })
  ] }) }) : r === "error" ? /* @__PURE__ */ s.jsx("div", { className: "lf-standings-shell", children: /* @__PURE__ */ s.jsxs("section", { className: "lf-dashboard-card lf-standings-state lf-standings-state--error", children: [
    /* @__PURE__ */ s.jsx("strong", { children: "Errore nel caricamento" }),
    /* @__PURE__ */ s.jsx("p", { children: a })
  ] }) }) : /* @__PURE__ */ s.jsxs("div", { children: [
    /* @__PURE__ */ s.jsx(dm, { data: i, leagueName: N, teamLogos: C }),
    /* @__PURE__ */ s.jsx("div", { className: "lf-standings-shell lf-standings-shell--discipline", children: /* @__PURE__ */ s.jsx(wm, { data: p, loading: h, error: v }) })
  ] });
}
const jm = Il("react-boundary");
class km extends Oa.Component {
  constructor() {
    super(...arguments);
    fr(this, "state", { error: null });
  }
  static getDerivedStateFromError(n) {
    return { error: n };
  }
  componentDidCatch(n, r) {
    jm.error(`${this.props.name} crashed`, { error: n, componentStack: r.componentStack });
  }
  render() {
    return this.state.error ? /* @__PURE__ */ s.jsxs("section", { className: "lf-dashboard-card lf-runtime-error", role: "alert", children: [
      /* @__PURE__ */ s.jsx("strong", { children: "Questa sezione non è stata caricata." }),
      /* @__PURE__ */ s.jsxs("p", { children: [
        "Ricarica la pagina. Con ",
        /* @__PURE__ */ s.jsx("code", { children: "?debug=1" }),
        " trovi più dettagli nella console."
      ] }),
      /* @__PURE__ */ s.jsx("button", { type: "button", onClick: () => window.location.reload(), children: "Ricarica" })
    ] }) : this.props.children;
  }
}
const wl = Il("bootstrap");
function ns(e, t, n) {
  const r = document.getElementById(e);
  if (!r) {
    wl.debug("root not present", { rootId: e, name: t });
    return;
  }
  mi.createRoot(r).render(
    /* @__PURE__ */ s.jsx(Oa.StrictMode, { children: /* @__PURE__ */ s.jsx(km, { name: t, children: n }) })
  ), wl.debug("mounted", { rootId: e, name: t });
}
window.addEventListener("error", (e) => {
  wl.error("unhandled window error", e.error ?? e.message);
});
window.addEventListener("unhandledrejection", (e) => {
  wl.error("unhandled promise rejection", e.reason);
});
ns("league-dashboard-root", "Listone", /* @__PURE__ */ s.jsx(Bp, {}));
ns("league-rose-root", "Rose", /* @__PURE__ */ s.jsx(om, {}));
ns("league-standings-root", "Classifica", /* @__PURE__ */ s.jsx(Sm, {}));
