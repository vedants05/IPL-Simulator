export interface MatchWeatherOvers {
  firstInningsOvers?: number;
  secondInningsOvers?: number;
}

interface WeatherAwareMatch {
  simulation?: {
    conditions?: {
      weather?: MatchWeatherOvers;
    };
  };
  commentary?: string[];
}

export function hasRainReducedOvers(weather?: MatchWeatherOvers): boolean {
  return Boolean(
    weather
    && (
      (typeof weather.firstInningsOvers === "number" && weather.firstInningsOvers < 20)
      || (typeof weather.secondInningsOvers === "number" && weather.secondInningsOvers < 20)
    )
  );
}

export function isRainAffectedMatch(match: WeatherAwareMatch): boolean {
  const weather = match.simulation?.conditions?.weather;
  const hasRecordedAvailability = typeof weather?.firstInningsOvers === "number"
    || typeof weather?.secondInningsOvers === "number";

  if (hasRecordedAvailability) return hasRainReducedOvers(weather);

  // Compatibility for older saves which retained the weather summary but not
  // the structured overs availability. A delay alone is deliberately excluded.
  return Boolean(match.commentary?.some((line) => /rain reduced.+\b\d+(?:\.\d+)?\s*overs?\b/i.test(line)));
}

export function appendRainAffectedResultLabel(resultText: string, rainAffected: boolean): string {
  if (!rainAffected || /rain affected/i.test(resultText)) return resultText;
  return `${resultText} (Rain affected)`;
}
