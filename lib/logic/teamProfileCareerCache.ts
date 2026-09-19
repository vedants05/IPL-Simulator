let cachedTeamProfileCareer: {
  saveId: string;
  userTeamId: string;
  career: object;
} | null = null;

export function cacheTeamProfileCareer<T extends object>(saveId: string, userTeamId: string, career: T) {
  if (!saveId || !userTeamId) return;
  cachedTeamProfileCareer = { saveId, userTeamId, career };
}

export function getCachedTeamProfileCareer<T extends object>(saveId: string, userTeamId: string): T | null {
  if (!saveId || !userTeamId || cachedTeamProfileCareer?.saveId !== saveId || cachedTeamProfileCareer.userTeamId !== userTeamId) return null;
  return cachedTeamProfileCareer.career as T;
}

export function clearCachedTeamProfileCareer(saveId?: string) {
  if (!saveId || cachedTeamProfileCareer?.saveId === saveId) {
    cachedTeamProfileCareer = null;
  }
}
