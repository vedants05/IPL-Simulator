"use client";

interface Props {
  rating: number; // 0.5–5.0
  size?: "sm" | "md" | "lg";
}

export default function StarRating({ rating, size = "md" }: Props) {
  const sizes = { sm: "text-xs", md: "text-sm", lg: "text-base" };
  const stars = [];

  for (let i = 1; i <= 5; i++) {
    if (rating >= i) {
      stars.push(<span key={i} className="text-gold">★</span>);
    } else if (rating >= i - 0.5) {
      stars.push(<span key={i} className="text-gold">½</span>);
    } else {
      stars.push(<span key={i} className="text-border">★</span>);
    }
  }

  return (
    <span className={`font-mono ${sizes[size]}`}>
      {stars}
      <span className="ml-1 text-text-secondary">{rating.toFixed(1)}</span>
    </span>
  );
}
