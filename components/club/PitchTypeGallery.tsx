import { HOME_STADIUMS, type CuratorPitch, type HomeStadium } from "@/lib/data/pitchCurator";
import { deriveCustomPitch, type PitchSliderSettings, type PitchSoil } from "@/lib/logic/pitchCreator";
import PitchSurfaceVisual from "./PitchSurfaceVisual";

type CreatorExample = {
  soil: PitchSoil;
  sliders: PitchSliderSettings;
  reference?: Pick<CuratorPitch, "name" | "type">;
};

const CREATOR_EXAMPLES: readonly CreatorExample[] = [
  { soil: "red", sliders: { compaction: 6, grassCover: 3, moisture: 3, surfaceWear: 7, consistency: 2 } },
  { soil: "black", sliders: { compaction: 3, grassCover: 2, moisture: 2, surfaceWear: 9, consistency: 7 } },
  { soil: "red", sliders: { compaction: 7, grassCover: 10, moisture: 9, surfaceWear: 2, consistency: 9 } },
  { soil: "black", sliders: { compaction: 4, grassCover: 2, moisture: 2, surfaceWear: 8, consistency: 6 } },
  { soil: "red", sliders: { compaction: 10, grassCover: 6, moisture: 4, surfaceWear: 2, consistency: 10 } },
  { soil: "red", sliders: { compaction: 9, grassCover: 3, moisture: 5, surfaceWear: 1, consistency: 9 } },
  { soil: "black", sliders: { compaction: 5, grassCover: 3, moisture: 3, surfaceWear: 7, consistency: 7 } },
  { soil: "red", sliders: { compaction: 8, grassCover: 5, moisture: 5, surfaceWear: 3, consistency: 8 } },
  { soil: "black", sliders: { compaction: 3, grassCover: 3, moisture: 4, surfaceWear: 6, consistency: 5 } },
  { soil: "red", sliders: { compaction: 6, grassCover: 5, moisture: 5, surfaceWear: 4, consistency: 7 } },
  {
    soil: "red",
    sliders: { compaction: 10, grassCover: 1, moisture: 9, surfaceWear: 1, consistency: 10 },
    // The current sliders top out below the 8.8 batting-ease threshold.
    reference: { name: "Highway Belter", type: "Ultra-Flat Batting Track" },
  },
];

type GalleryEntry = { pitch: CuratorPitch; caption: string };

const STADIUM_ENTRIES: GalleryEntry[] = HOME_STADIUMS.flatMap(stadium =>
  stadium.pitches.map(pitch => ({ pitch, caption: stadium.name })),
);

function GalleryGroup({ title, entries, date }: { title: string; entries: GalleryEntry[]; date: string }) {
  return (
    <section>
      <h3 className="mb-2 font-anton text-base uppercase text-text-primary">{title}</h3>
      <ul className="grid gap-3 md:grid-cols-2">
        {entries.map(({ pitch, caption }) => (
          <li key={pitch.id} className="overflow-hidden rounded-lg border border-border bg-surface">
            <div className="px-3 py-2">
              <h4 className="font-anton text-sm uppercase text-text-primary">{pitch.type}</h4>
              <p className="text-xs text-text-secondary">{pitch.name} · {caption}</p>
            </div>
            <PitchSurfaceVisual pitch={pitch} date={date} compact />
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function PitchTypeGallery({ stadium, date }: { stadium: HomeStadium; date: string }) {
  const creatorEntries = CREATOR_EXAMPLES.map(({ soil, sliders, reference }, index): GalleryEntry => {
    const pitch = deriveCustomPitch({
      id: `gallery-example-${index}`,
      teamId: stadium.teamId,
      stadium,
      soil,
      sliders,
      createdOn: date,
    });
    return {
      pitch: { ...pitch, ...reference },
      caption: reference ? "Design reference only" : "Create Pitch example",
    };
  });
  const typeCount = new Set([...STADIUM_ENTRIES, ...creatorEntries].map(({ pitch }) => pitch.type)).size;

  return (
    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto rounded-lg border border-border bg-surface p-3">
      <header>
        <h2 className="font-anton text-xl uppercase text-text-primary">Pitch gallery</h2>
        <p className="text-xs text-text-secondary">{typeCount} pitch types · Stadium surfaces and Create Pitch examples</p>
      </header>
      <GalleryGroup title="Stadium pitches" entries={STADIUM_ENTRIES} date={date} />
      <GalleryGroup title="Create Pitch designs" entries={creatorEntries} date={date} />
    </div>
  );
}
