import type { CareerStaffState } from "./staffContracts";
import { addNewsDays, newsWindowEnd } from "./newsArticlePolicy";

/** Staff news describes the dated event, never an inferred current vacancy. */
export function buildStaffNewsArticles(
  staff: Pick<CareerStaffState, "newsEvents"> & {
    contracts: Record<string, { fullName: string }>;
    generatedProfiles: Record<string, { full_name: string }>;
  },
  teamName: (id: string) => string,
  userTeamId: string,
  currentDate: string,
) {
  const events = staff.newsEvents.filter((event) => event.publishedOn <= currentDate);
  const name = (id: string | null | undefined) => id
    ? staff.contracts[id]?.fullName ?? staff.generatedProfiles[id]?.full_name ?? "A staff member"
    : "The head coach";
  const dismissalFor = (event: typeof events[number]) => events
    .filter((candidate) => candidate.kind === "head_coach_sacked" && candidate.teamId === event.teamId
      && candidate.publishedOn <= event.publishedOn
      && event.publishedOn <= addNewsDays(candidate.publishedOn, 7)
      && !events.some((appointment) => appointment.teamId === event.teamId
        && appointment.kind === "head_coach_appointed" && appointment.publishedOn > candidate.publishedOn
        && appointment.publishedOn <= event.publishedOn))
    .sort((a, b) => b.publishedOn.localeCompare(a.publishedOn))[0];

  return events.flatMap((event) => {
    const club = teamName(event.teamId);
    const person = name(event.staffId);
    const dismissal = event.kind === "head_coach_vacancy" ? dismissalFor(event) : undefined;
    if (event.kind === "head_coach_sacked" && events.some((candidate) =>
      candidate.kind === "head_coach_vacancy" && dismissalFor(candidate)?.id === event.id)) return [];

    let title: string;
    let subheading: string;
    let content: string;
    let priority = 60;
    let duration = 14;
    switch (event.kind) {
      case "staff_retired":
        title = `${person} retires${event.teamId === "league" ? " from coaching" : ` from ${club}'s staff`}`;
        subheading = "A coaching career comes to a close.";
        content = `${person} has retired from staff duties${event.teamId === "league" ? "" : ` with ${club}`}. The departure has been confirmed in the league's staff records.`;
        break;
      case "staff_poached": {
        const former = event.sourceTeamId ? ` from ${teamName(event.sourceTeamId)}` : "";
        title = `${club} recruit ${person}${former}`;
        subheading = "The staff move has been completed.";
        content = `${club} have completed the recruitment of ${person}${former}. The move is now confirmed.`;
        break;
      }
      case "head_coach_appointed":
        title = `${club} appoint ${person} as head coach`;
        subheading = "The permanent head-coach appointment is confirmed.";
        content = `${club} have appointed ${person} as head coach. The appointment was confirmed on ${event.publishedOn}.`;
        priority = 80;
        duration = 21;
        break;
      case "head_coach_sacked":
        title = `${club} dismiss ${person}`;
        subheading = "The franchise has confirmed a head-coach change.";
        content = `${club} have dismissed ${person} as head coach following a review of the team's performance.`;
        priority = 85;
        duration = 21;
        break;
      case "head_coach_vacancy": {
        const interim = event.staffId ? `${person} takes interim charge` : "a permanent replacement is sought";
        title = dismissal ? `${club} dismiss ${name(dismissal.staffId)}; ${interim}`
          : event.staffId ? `${club} name ${person} interim head coach` : `${club} open head-coach search`;
        subheading = "The franchise is recruiting a permanent head coach.";
        content = `${dismissal ? `${club} have dismissed ${name(dismissal.staffId)}. ` : ""}${event.staffId
          ? `${person} will oversee the team while ${club} search for a permanent head coach.`
          : `${club} are searching for a permanent head coach. No interim appointment has been confirmed.`}`;
        priority = dismissal ? 85 : 60;
        break;
      }
      default:
        return [];
    }
    let expiresAt = newsWindowEnd(event.publishedOn, duration);
    // A vacancy stops being current when an appointment is confirmed.
    if (event.kind === "head_coach_vacancy") {
      const appointment = events.filter((candidate) => candidate.teamId === event.teamId
        && candidate.kind === "head_coach_appointed" && candidate.publishedOn >= event.publishedOn)
        .sort((a, b) => a.publishedOn.localeCompare(b.publishedOn))[0];
      if (appointment) expiresAt = [expiresAt, addNewsDays(appointment.publishedOn, -1)].sort()[0];
    }
    return [{
      id: event.id, title, subheading, content,
      category: event.teamId === userTeamId ? "user_team" as const : "transfers_auctions" as const,
      tag: event.kind === "staff_retired" ? "Staff Retirement" : "Staff Market",
      publishedAt: event.publishedOn, expiresAt, priority,
      teamId: event.teamId, associatedEntityIds: { teamId: event.teamId },
      author: "IPL News Desk", readTime: "1 min read", isBreaking: priority >= 80,
    }];
  });
}
