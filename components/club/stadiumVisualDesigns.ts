// Visual dimensions are game art parameters, not surveyed architectural dimensions.
export const STAND_DESIGNS: Record<string, { tiers: number; boxes: number; style: 'plain' | 'club' | 'heritage' | 'glass' | 'media' | 'premium' | 'landmark'; spacing: number }> = {
  'open-tier': { tiers: 1, boxes: 0, style: 'plain', spacing: .53 },
  'covered-tier': { tiers: 1, boxes: 0, style: 'plain', spacing: .56 },
  'compact-two': { tiers: 2, boxes: 0, style: 'plain', spacing: .5 },
  'standard-two': { tiers: 2, boxes: 0, style: 'plain', spacing: .56 },
  'large-three': { tiers: 3, boxes: 0, style: 'plain', spacing: .56 },
  'four-grandstand': { tiers: 4, boxes: 0, style: 'plain', spacing: .56 },
  pavilion: { tiers: 2, boxes: 4, style: 'club', spacing: .64 },
  heritage: { tiers: 2, boxes: 3, style: 'heritage', spacing: .66 },
  'classical-pavilion': { tiers: 2, boxes: 4, style: 'heritage', spacing: .7 },
  'art-deco-pavilion': { tiers: 3, boxes: 5, style: 'premium', spacing: .72 },
  'garden-pavilion': { tiers: 2, boxes: 4, style: 'club', spacing: .74 },
  'sandstone-arcade': { tiers: 2, boxes: 4, style: 'heritage', spacing: .72 },
  'victorian-pavilion': { tiers: 2, boxes: 4, style: 'heritage', spacing: .68 },
  'glass-sky-lounge': { tiers: 3, boxes: 7, style: 'glass', spacing: .8 },
  'tensile-terrace': { tiers: 1, boxes: 0, style: 'plain', spacing: .62 },
  'asymmetric-grandstand': { tiers: 3, boxes: 3, style: 'landmark', spacing: .64 },
  'hospitality-two': { tiers: 2, boxes: 5, style: 'glass', spacing: .72 },
  'hospitality-three': { tiers: 3, boxes: 6, style: 'glass', spacing: .72 },
  corporate: { tiers: 2, boxes: 7, style: 'glass', spacing: .78 },
  media: { tiers: 2, boxes: 5, style: 'media', spacing: .78 },
  premium: { tiers: 3, boxes: 5, style: 'premium', spacing: .76 },
  landmark: { tiers: 4, boxes: 6, style: 'landmark', spacing: .76 },
};

// CAB, 31 March 2023: eight corporate boxes in B and seven in L.
// Explicit per-section overrides avoid changing the stand's seating template/capacity.
export function edenExistingBoxes(entry: { standName: string; constructionYear?: number; templateId: string; empty?: boolean }): number | undefined {
  if (entry.empty || (entry.constructionYear ?? 9999) > 2023) return undefined;
  if (entry.standName === 'B Stand' && entry.templateId === 'compact-two') return 4;
  if (entry.standName === 'L Stand' && entry.templateId === 'heritage') return 7;
  return undefined;
}
