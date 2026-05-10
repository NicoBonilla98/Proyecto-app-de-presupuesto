const collectionKeys = ["transactions", "goals", "fixedItems", "investments"];

export function mergeStateCopies(primaryState = {}, secondaryState = {}) {
  const deletedItemIds = mergeDeletedIds(primaryState.deletedItemIds, secondaryState.deletedItemIds);
  const deletedItems = new Set(deletedItemIds);

  return {
    ...secondaryState,
    ...primaryState,
    deletedItemIds,
    transactions: mergeCollections(primaryState.transactions, secondaryState.transactions, deletedItems),
    goals: mergeCollections(primaryState.goals, secondaryState.goals, deletedItems),
    fixedItems: mergeCollections(primaryState.fixedItems, secondaryState.fixedItems, deletedItems),
    investments: mergeCollections(primaryState.investments, secondaryState.investments, deletedItems),
    liquiditySettings: {
      ...(secondaryState.liquiditySettings || {}),
      ...(primaryState.liquiditySettings || {})
    }
  };
}

export function hasStoredRecords(state = {}) {
  return collectionKeys.some((key) => Array.isArray(state[key]) && state[key].length > 0);
}

export function hasAllSharedRecords(sourceState = {}, targetState = {}) {
  const sourceDeletedIds = new Set(asArray(sourceState.deletedItemIds));
  const targetDeletedIds = new Set(asArray(targetState.deletedItemIds));
  const targetIds = new Set(
    collectionKeys.flatMap((key) => asArray(targetState[key]).map((item) => item?.id).filter(Boolean))
  );

  for (const key of collectionKeys) {
    for (const item of asArray(sourceState[key])) {
      if (!item?.id || sourceDeletedIds.has(item.id)) continue;
      if (!targetIds.has(item.id)) return false;
    }
  }

  for (const id of sourceDeletedIds) {
    if (!targetDeletedIds.has(id)) return false;
  }

  return true;
}

export function stateFingerprint(state = {}) {
  return JSON.stringify({
    period: state.period,
    deletedItemIds: asArray(state.deletedItemIds).sort(),
    transactions: collectionFingerprint(state.transactions),
    goals: collectionFingerprint(state.goals),
    fixedItems: collectionFingerprint(state.fixedItems),
    investments: collectionFingerprint(state.investments),
    liquiditySettings: state.liquiditySettings || {}
  });
}

function mergeCollections(primaryValue, secondaryValue, deletedItems) {
  const records = [];
  const seen = new Set();

  for (const item of [...asArray(primaryValue), ...asArray(secondaryValue)]) {
    if (!item) continue;
    const key = item.id || JSON.stringify(item);
    if (deletedItems.has(key)) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    records.push(item);
  }

  return records;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function mergeDeletedIds(primaryValue, secondaryValue) {
  return [...new Set([...asArray(primaryValue), ...asArray(secondaryValue)])];
}

function collectionFingerprint(value) {
  return asArray(value)
    .map((item) => item || {})
    .sort((a, b) => String(a.id || "").localeCompare(String(b.id || "")));
}
