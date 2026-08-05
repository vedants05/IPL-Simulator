export function calculateBasePrice(
  isCapped: boolean,
  nationality: string,
  rating: number,
  reputation: number,
): number {
  if (isCapped) {
    if (nationality === "Overseas") {
      return reputation >= 7 && rating >= 81 ? 200 : 100;
    }

    const priceBands = [50, 75, 100, 150, 200];
    let bandIndex = rating >= 83
      ? 4
      : rating >= 80
        ? 3
        : rating >= 77
          ? 2
          : rating >= 73
            ? 1
            : 0;
    if (reputation >= 9) bandIndex = Math.min(priceBands.length - 1, bandIndex + 1);
    if (reputation <= 4) bandIndex = Math.max(0, bandIndex - 1);
    return priceBands[bandIndex];
  }

  if (rating >= 77) return 100;
  if (rating >= 74 || reputation >= 5) return 50;
  if (rating >= 71 || reputation >= 4) return 40;
  return 30;
}
