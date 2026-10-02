export const NEWS_REPEAT_COOLDOWN_DAYS = 7;

export interface TimedNewsArticle {
  id: string;
  publishedAt?: string;
  expiresAt?: string;
  isBreaking?: boolean;
  priority?: number;
  category?: string;
  tag?: string;
  requiresFinalResult?: boolean;
}

/** Windows include the publication day: a four-day story expires on day four. */
export const newsWindowEnd = (publishedAt: string, days: number) =>
  addNewsDays(publishedAt, Math.max(1, days) - 1);

export function isNewsPublished(article: TimedNewsArticle, currentDate: string): boolean {
  return Boolean(article.publishedAt && currentDate && article.publishedAt <= currentDate);
}

export function isNewsActive(article: TimedNewsArticle, currentDate: string): boolean {
  return isNewsPublished(article, currentDate) && (!article.expiresAt || currentDate <= article.expiresAt);
}

export function isNewsBreaking(article: TimedNewsArticle, currentDate: string): boolean {
  return Boolean(article.isBreaking && isNewsActive(article, currentDate)
    && currentDate <= newsWindowEnd(article.publishedAt!, 2));
}

export function newsPriority(article: TimedNewsArticle): number {
  if (article.priority !== undefined) return article.priority;
  if (article.requiresFinalResult) return 100;
  if (article.tag?.toLowerCase().includes("final")) return 85;
  if (article.isBreaking) return 70;
  return article.category === "user_team" ? 50 : 30;
}

/** Only recent, unexpired stories receive promotion; old features stay chronological. */
export function compareNewsArticles(a: TimedNewsArticle, b: TimedNewsArticle, currentDate: string): number {
  const promotedScore = (article: TimedNewsArticle) => {
    if (!isNewsActive(article, currentDate) || currentDate > newsWindowEnd(article.publishedAt!, 2)) return -1;
    return newsPriority(article) - (article.publishedAt === currentDate ? 0 : 20);
  };
  const scoreA = promotedScore(a);
  const scoreB = promotedScore(b);
  if (scoreA !== scoreB) return scoreB - scoreA;
  return String(b.publishedAt || "").localeCompare(String(a.publishedAt || "")) || a.id.localeCompare(b.id);
}

export function addNewsDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, (month || 1) - 1, day || 1);
  date.setDate(date.getDate() + days);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function getNewsArticleExpiry(input: {
  publishedDate: string;
  durationDays: number;
  isFinalResult: boolean;
  isFinalRunnerUp: boolean;
  isRetirement: boolean;
  isLegendRetirement: boolean;
  nextRetentionDate: string;
  isPostAuction: boolean;
  postAuctionCutoffDate: string;
  isFixtureAnnouncement: boolean;
  seasonStartDate: string;
  nextSeasonStartDate: string;
}): string {
  if (input.isFinalResult) return addNewsDays(input.nextSeasonStartDate, -1);
  if (input.isFinalRunnerUp) return newsWindowEnd(input.publishedDate, 14);
  if (input.isRetirement) {
    // Expiry is inclusive: 364 is the final visible day in a 365-day window.
    return input.isLegendRetirement
      ? addNewsDays(input.nextSeasonStartDate, -1)
      : addNewsDays(input.nextRetentionDate, -1);
  }
  if (input.isPostAuction) return input.postAuctionCutoffDate;
  if (input.isFixtureAnnouncement) return addNewsDays(input.seasonStartDate, -1);
  return newsWindowEnd(input.publishedDate, input.durationDays);
}
