(function exposeFormationDb(global) {
  "use strict";

  const ROLE_ORDER = Object.freeze({ P: 1, D: 2, C: 3, A: 4, U: 5 });

  function goalkeeperEntries(asset) {
    const parts = asset.displayName.split(/\s+-\s+/).map((part) => part.trim()).filter(Boolean);
    const first = parts[0] || asset.displayName;
    const second = parts[1] || "";
    const base = { r: asset.role, t: asset.realTeam || "", gkBlock: asset.displayName, isGkBlock: true };
    return [
      { ...base, n: first, gkPartner: second },
      ...(second ? [{ ...base, n: second, gkPartner: first }] : [])
    ];
  }

  function buildFormationDb(assets) {
    const db = Object.create(null);

    assets.forEach((asset) => {
      if (!asset.active || asset.isFreeAgent || asset.isExtra || !asset.ownerTag) return;
      if (!Object.hasOwn(db, asset.ownerTag)) db[asset.ownerTag] = { players: [] };

      const entries = asset.type === "goalkeeper_block"
        ? goalkeeperEntries(asset)
        : [{ n: asset.displayName, r: asset.role, t: asset.realTeam || "" }];
      db[asset.ownerTag].players.push(...entries);
    });

    Object.values(db).forEach((team) => {
      team.players.sort((left, right) => (
        (ROLE_ORDER[left.r] || 9) - (ROLE_ORDER[right.r] || 9)
      ));
    });

    return db;
  }

  const api = Object.freeze({ buildFormationDb });

  if (typeof module === "object" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.LineupFormationDb = api;
})(typeof window !== "undefined" ? window : globalThis);
