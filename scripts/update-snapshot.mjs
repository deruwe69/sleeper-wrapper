function buildFreeAgents(rosters, playersById) {
  const rosteredIds = new Set();

  for (const roster of rosters) {
    for (const id of roster.players || []) {
      rosteredIds.add(id);
    }
  }

  return Object.entries(playersById)
    .filter(([playerId, player]) => {
      return (
        !rosteredIds.has(playerId) &&
        isFantasyRelevant(player) &&
        player.team
      );
    })
    .map(([playerId, player]) => ({
      ...normalizePlayer(playerId, playersById),
      search_rank:
        Number.isFinite(player.search_rank)
          ? player.search_rank
          : 999999,
    }))
    .sort((a, b) => {
      if (a.search_rank !== b.search_rank) {
        return a.search_rank - b.search_rank;
      }

      return (a.full_name || "").localeCompare(
        b.full_name || ""
      );
    })
    .slice(0, 300);
}