"use client";
import { Star } from "lucide-react";

interface Props {
  rating: number; // 0.5–5.0
  size?: "sm" | "md" | "lg";
}

export default function StarRating({ rating, size = "md" }: Props) {
  const pixelSizes = { sm: 12, md: 14, lg: 16 };
  const px = pixelSizes[size];
  const stars = [];

  for (let i = 1; i <= 5; i++) {
    if (rating >= i) {
      // Full star
      stars.push(
        <Star
          key={i}
          size={px}
          className="inline text-gold"
          fill="currentColor"
          strokeWidth={0}
        />
      );
    } else if (rating >= i - 0.5) {
      // Half star — clip to 50% width
      stars.push(
        <span key={i} className="inline-block relative" style={{ width: px, height: px }}>
          {/* Empty star underneath */}
          <Star size={px} className="text-border absolute inset-0" fill="none" strokeWidth={1.5} />
          {/* Filled star clipped to left 50% */}
          <span className="absolute inset-0 overflow-hidden" style={{ width: "50%" }}>
            <Star size={px} className="text-gold" fill="currentColor" strokeWidth={0} />
          </span>
        </span>
      );
    } else {
      // Empty star
      stars.push(
        <Star
          key={i}
          size={px}
          className="inline text-border"
          fill="none"
          strokeWidth={1.5}
        />
      );
    }
  }

  return (
    <span className="inline-flex items-center gap-0.5">
      {stars}
      <span className="ml-1 text-text-secondary" style={{ fontSize: px - 2 }}>{rating.toFixed(1)}</span>
    </span>
  );
}
