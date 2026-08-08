"use strict";

// ---------------------------------------------------------------------------
// Public facade for the BSD direct pipeline.
//
// Re-exports the full public API of the media layer (previously a single
// 1500-line module) from the modular implementation in lib/media/. The export
// surface is intentionally identical to the historical monolith so that the
// API routes and integration tests keep working unchanged.
//
// Modules:
//   bsd-provider.cjs     - pipeline core: constants, normalization, BSD HTTP,
//                          team directory/resolution, scoring + selection,
//                          squad refresh (standalone)
//   name-matching.cjs    - query + Listone matching helpers
//   manifest-state.cjs   - manifest/catalog, direct state, persistence,
//                          public projections, links
//   diagnostics.cjs      - read-only reports (fresh matching, team selection)
// ---------------------------------------------------------------------------

const provider = require("./media/bsd-provider.cjs");
const matching = require("./media/name-matching.cjs");
const manifest = require("./media/manifest-state.cjs");
const diagnostics = require("./media/diagnostics.cjs");

// Deprecated legacy entry points. The direct pipeline is the only
// implementation; these names are kept so the historical integration tests
// keep pinning the same behaviors. Thin wrappers, scheduled for removal
// together with the tests that exercise them.
async function legacyStartMissingSync(rawLeagueId) {
  return manifest.publicManifest(await manifest.refreshDirectManifest(rawLeagueId));
}

async function legacyProcessFullSync(rawLeagueId) {
  return manifest.publicManifest(await manifest.refreshDirectManifest(rawLeagueId));
}

module.exports = {
  // Constants
  CATALOG_VERSION: provider.CATALOG_VERSION,
  FULL_SYNC_DATES: provider.FULL_SYNC_DATES,
  MANIFEST_VERSION: provider.MANIFEST_VERSION,
  PROVIDER: provider.PROVIDER,

  // Provider core
  bestProviderTeam: provider.bestProviderTeam,
  clubKey: provider.clubKey,
  collectBsdPlayers: provider.collectBsdPlayers,
  collectBsdTeams: provider.collectBsdTeams,
  isCurrentBsdEntry: provider.isCurrentBsdEntry,
  isNonFirstTeamName: provider.isNonFirstTeamName,
  isResolvedEntry: provider.isResolvedEntry,
  persistedTeamOverrideNeedsRepair: provider.persistedTeamOverrideNeedsRepair,
  playerKey: provider.playerKey,
  playerPhotoUrl: provider.providerImageUrl,
  providerTeamCandidates: provider.providerTeamCandidates,
  refreshTeamSquad: provider.refreshTeamSquad,
  resolveProviderTeam: provider.resolveProviderTeam,

  // Matching / selection
  chooseCandidate: provider.chooseCandidate,
  keepExistingOrUnresolved: provider.keepExistingOrUnresolved,

  // Manifest / state
  assertPublishableManifest: manifest.assertPublishableManifest,
  buildDirectState: manifest.buildDirectState,
  directLinkManual: manifest.directLinkManual,
  directLinkTeam: manifest.directLinkTeam,
  directMediaStatus: manifest.directMediaStatus,
  directReadManifest: manifest.directReadManifest,
  directSearchProvider: manifest.directSearchProvider,
  directSearchProviderTeams: manifest.directSearchProviderTeams,
  directSyncMissing: manifest.directSyncMissing,
  isFullSyncDate: manifest.isFullSyncDate,
  publicManifest: manifest.publicManifest,
  refreshDirectManifest: manifest.refreshDirectManifest,
  refreshDirectStep: manifest.refreshDirectStep,
  summary: manifest.summary,

  // Diagnostics
  diagnoseFreshMatching: diagnostics.diagnoseFreshMatching,
  diagnoseProviderTeamSelection: diagnostics.diagnoseProviderTeamSelection,

  // Legacy aliases
  linkTeamManual: manifest.directLinkTeam,
  processFullSync: legacyProcessFullSync,
  readManifest: manifest.directReadManifest,
  searchProvider: manifest.directSearchProvider,
  searchProviderTeams: manifest.directSearchProviderTeams,
  startMissingSync: legacyStartMissingSync,
  syncMissing: manifest.directSyncMissing
};
