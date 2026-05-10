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
