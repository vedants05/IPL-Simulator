let cachedTeamProfileCareer: {
  userTeamId: string;
  career: object;
} | null = null;

export function cacheTeamProfileCareer<T extends object>(userTeamId: string, career: T) {
  if (!userTeamId) return;
  cachedTeamProfileCareer = { userTeamId, career };
}

export function getCachedTeamProfileCareer<T extends object>(userTeamId: string): T | null {
  if (!userTeamId || cachedTeamProfileCareer?.userTeamId !== userTeamId) return null;
  return cachedTeamProfileCareer.career as T;
}

export function clearCachedTeamProfileCareer(userTeamId?: string) {
  if (!userTeamId || cachedTeamProfileCareer?.userTeamId === userTeamId) {
    cachedTeamProfileCareer = null;
  }
}
