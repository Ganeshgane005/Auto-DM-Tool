// Pure matching logic: no dependencies, easy to test.

export function normalize(text) {
  return String(text ?? '').toLowerCase().trim();
}

function keywordHit(automation, commentText) {
  const text = normalize(commentText);
  return (automation.keywords || []).some((raw) => {
    const keyword = normalize(raw);
    if (!keyword) return false;
    return automation.matchType === 'exact' ? text === keyword : text.includes(keyword);
  });
}

/**
 * Pick the automation that should fire for a comment.
 * Automations tied to a specific post win over "any post" automations.
 */
export function findAutomation(automations, { text, mediaId }) {
  const candidates = automations
    .filter((a) => a.active !== false)
    .filter((a) => !a.mediaId || a.mediaId === mediaId)
    .sort((a, b) => Number(Boolean(b.mediaId)) - Number(Boolean(a.mediaId)));

  return candidates.find((a) => keywordHit(a, text)) || null;
}
