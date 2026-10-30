import type { InternationalCareerState } from './international';
import type { Player } from '../types';
import type { NewsArticle } from '../../components/news/NewsPage';
import { addNewsDays } from './newsArticlePolicy';
export function buildInternationalRetirementNews(career: InternationalCareerState | null | undefined, players: Record<string, Player>, currentDate: string): NewsArticle[] {
  return (career?.retirements ?? []).filter(event => event.hadInternationalCareer && event.retirement.source === 'simulated' && event.effectiveOn <= currentDate).map(event => ({
    id: event.id, title: `${event.name} retires from T20 internationals`,
    subheading: 'International chapter closes; franchise cricket remains available.',
    content: `${event.name} has retired from T20 international cricket at age ${event.age}. ${event.retirement.reason === 'selection' ? 'The decision follows time outside the national side.' : 'The decision closes an international playing career.'} Existing caps, records and performances remain part of their career history. This decision does not end their franchise career.`,
    category: 'player_news', tag: 'T20I Retirement', publishedAt: event.effectiveOn, timestamp: event.effectiveOn,
    expiresAt: addNewsDays(event.effectiveOn, 30), playerId: event.playerId,
    teamId: event.playerId ? players[event.playerId]?.currentTeamId ?? undefined : undefined,
    associatedEntityIds: { playerId: event.playerId }, author: 'International Cricket Desk', readTime: '1 min read',
  }));
}
