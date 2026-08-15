/**
 * Clean helper utilities to manage AI Agent Name vs User Name logic.
 *
 * User Name:
 * - Extracted from authenticated user profile (displayName or email prefix).
 * - e.g. "Kishore".
 * - Used for user profile, welcome message, account dropdown.
 *
 * Agent Name:
 * - Custom name saved in Agent Configuration → Personality.
 * - Computed fallback before customization: `${userFirstName}'s AI Assistant` (e.g. "Kishore's AI Assistant").
 * - After customization (e.g. "Dudo Sales Bot"): Displays "Dudo Sales Bot" everywhere.
 */

export const GENERIC_NAMES = [
  'My AI Assistant',
  'My Assistant',
  'Assistant',
  'Dudo AI',
  'Dudo',
  'dudo ai',
  'dudo',
  'Your AI Assistant',
];

export function getUserFirstName(displayName?: string | null, email?: string | null): string {
  const rawDisplay = (displayName && displayName.trim()) || (email && email.split('@')[0]) || 'User';
  const firstName = rawDisplay.split(/[-\s._]/)[0];
  return firstName ? firstName.charAt(0).toUpperCase() + firstName.slice(1) : 'User';
}

export function getAgentDisplayName(
  savedName: string | null | undefined,
  hasCustomName: boolean | undefined | null,
  userFirstName: string
): string {
  const cleanFirstName = userFirstName ? userFirstName.charAt(0).toUpperCase() + userFirstName.slice(1) : 'User';
  const fallback = `${cleanFirstName}'s AI Assistant`;

  if (!savedName) return fallback;

  const trimmed = savedName.trim();
  if (!trimmed) return fallback;

  // If explicitly flagged as custom name and non-empty
  if (hasCustomName && trimmed && !GENERIC_NAMES.includes(trimmed)) {
    return trimmed;
  }

  // If generic default, return computed fallback
  if (GENERIC_NAMES.includes(trimmed)) {
    return fallback;
  }

  // If database string matches fallback format and hasCustomName flag is not set, return computed fallback
  if (trimmed === fallback && !hasCustomName) {
    return fallback;
  }

  // If name is non-empty and not generic, return custom name
  return trimmed;
}
