export const NEWS_REPEAT_COOLDOWN_DAYS = 7;

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
  if (input.isFinalRunnerUp) return addNewsDays(input.publishedDate, 14);
  if (input.isRetirement) {
    // Expiry is inclusive: 364 is the final visible day in a 365-day window.
    return input.isLegendRetirement
      ? addNewsDays(input.nextSeasonStartDate, -1)
      : addNewsDays(input.nextRetentionDate, -1);
  }
  if (input.isPostAuction) return input.postAuctionCutoffDate;
  if (input.isFixtureAnnouncement) return addNewsDays(input.seasonStartDate, -1);
  return addNewsDays(input.publishedDate, input.durationDays);
}
