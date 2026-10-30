/** Send a person without a profile through sign-up, then back to this path. */
export function gatePath(path: string, profileSet: boolean): string {
  if (profileSet) return path;
  return `/get-started?next=${encodeURIComponent(path)}`;
}
