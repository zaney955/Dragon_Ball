import * as THREE from 'three';

// Reference identities matter: a projectile source can be the fighter's live attack,
// and hit sets/control/grabs contain live fighters. JSON cloning loses those links.
export function stateCodec(externals = new Map()) {
  const reverse = new Map([...externals].map(([name, value]) => [value, name]));
  const types = ['Vector2', 'Vector3', 'Quaternion', 'Euler', 'Color', 'Matrix4', 'Box3'];
  function encode(root) {
    const nodes = [],
      seen = new Map();
    function value(v) {
      if (v === undefined) return { atom: 'undefined' };
      if (typeof v === 'number' && !Number.isFinite(v)) return { atom: String(v) };
      if (v === null || ['string', 'number', 'boolean'].includes(typeof v)) return v;
      if (reverse.has(v)) return { external: reverse.get(v) };
      if (typeof v !== 'object') throw new Error('Unregistered battle-state value');
      if (seen.has(v)) return { node: seen.get(v) };
      if (nodes.length >= 30000) throw new Error('Battle-state graph is too large');
      const id = nodes.length;
      seen.set(v, id);
      nodes.push(null);
      let node;
      const type = types.find((name) => v['is' + name]);
      if (type === 'Box3') node = { type, data: [value(v.min), value(v.max)] };
      else if (type) node = { type, data: v.toArray() };
      else if (v instanceof Set) node = { type: 'Set', data: [...v].map(value) };
      else if (v instanceof Map)
        node = { type: 'Map', data: [...v].map(([k, x]) => [value(k), value(x)]) };
      else if (Array.isArray(v)) node = { type: 'Array', data: v.map(value) };
      else {
        if (![Object.prototype, null].includes(Object.getPrototypeOf(v)))
          throw new Error('Unsupported battle-state object: ' + v.constructor?.name);
        node = {
          type: 'Object',
          data: Object.keys(v)
            .sort()
            .map((k) => [k, value(v[k])]),
        };
      }
      nodes[id] = node;
      return { node: id };
    }
    return { root: value(root), nodes };
  }
  function decode(graph) {
    if (!Array.isArray(graph?.nodes) || graph.nodes.length > 30000)
      throw new Error('Invalid battle-state graph');
    const values = graph.nodes.map((n) => {
      if (!Array.isArray(n.data)) throw new Error('Invalid battle-state node');
      if (types.includes(n.type)) return new THREE[n.type]();
      if (n.type === 'Set') return new Set();
      if (n.type === 'Map') return new Map();
      if (n.type === 'Array') return [];
      if (n.type === 'Object') return {};
      throw new Error('Unknown battle-state node');
    });
    function value(v) {
      if (v === null || typeof v !== 'object') return v;
      if ('atom' in v) {
        if (v.atom === 'undefined') return undefined;
        if (v.atom === 'Infinity') return Infinity;
        if (v.atom === '-Infinity') return -Infinity;
        if (v.atom === 'NaN') return NaN;
        throw new Error('Invalid battle-state atom');
      }
      if ('external' in v) {
        if (!externals.has(v.external))
          throw new Error('Missing battle-state reference: ' + v.external);
        return externals.get(v.external);
      }
      if (!Number.isInteger(v.node) || !values[v.node])
        throw new Error('Invalid battle-state reference');
      return values[v.node];
    }
    graph.nodes.forEach((n, i) => {
      const target = values[i];
      if (n.type === 'Box3') {
        target.min = value(n.data[0]);
        target.max = value(n.data[1]);
      } else if (types.includes(n.type)) target.fromArray(n.data);
      else if (n.type === 'Set') n.data.forEach((x) => target.add(value(x)));
      else if (n.type === 'Map') n.data.forEach(([k, x]) => target.set(value(k), value(x)));
      else if (n.type === 'Array') n.data.forEach((x) => target.push(value(x)));
      else
        n.data.forEach(([k, x]) => {
          if (['__proto__', 'constructor', 'prototype'].includes(k))
            throw new Error('Unsafe battle-state key');
          target[k] = value(x);
        });
    });
    return value(graph.root);
  }
  return { encode, decode };
}
