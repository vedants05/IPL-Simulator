-- Verified primary-source seed; does not invent database IDs.
-- Runtime IDs are listed in lib/data/t20iRetirements.json. Resolve each exact unique
-- database name, then update that row. Ambiguous/missing names are left untouched.
-- Russell remains eligible for his final match on 22 July; unavailable from 23 July.
WITH seed(name, effective_on, source_url) AS (VALUES
  ('Virat Kohli', DATE '2024-06-29', 'https://www.icc-cricket.com/news/it-was-now-or-never-departing-kohli-celebrates-india-s-triumph'),
  ('Rohit Sharma', DATE '2024-06-29', 'https://www.icc-cricket.com/tournaments/t20cricketworldcup/news/title-winning-skipper-rohit-sharma-confirms-retirement-from-t20-internationals'),
  ('Ravindra Jadeja', DATE '2024-06-30', 'https://www.icc-cricket.com/news/ravindra-jadeja-announces-t20i-retirement-after-t20-world-cup-victory'),
  ('David Warner', DATE '2024-06-25', 'https://www.icc-cricket.com/news/you-ll-struggle-to-find-a-guy-that-s-had-as-big-an-impact-legend-s-touching-warner-tribute'),
  ('MS Dhoni', DATE '2020-08-15', 'https://www.bcci.tv/news/article/ms-dhoni-retires-from-international-cricket'),
  ('Ravichandran Ashwin', DATE '2024-12-18', 'https://www.icc-cricket.com/news/retirement-shock-as-india-all-rounder-calls-time-on-international-career'),
  ('Moeen Ali', DATE '2024-09-08', 'https://www.icc-cricket.com/news/moeen-ali-announces-retirement-from-international-cricket'),
  ('Sunil Narine', DATE '2023-11-05', 'https://www.windiescricket.com/news/cwi-thanks-sunil-narine-for-his-contribution-to-west-indies-cricket/'),
  ('Nicholas Pooran', DATE '2025-06-09', 'https://www.windiescricket.com/news/cricket-west-indies-thanks-nicholas-pooran-for-his-service/'),
  ('Andre Russell', DATE '2025-07-23', 'https://www.windiescricket.com/news/andre-russells-farewell-a-legends-final-stand-at-sabina-park/'),
  ('Heinrich Klaasen', DATE '2025-06-02', 'https://www.icc-cricket.com/news/klaasen-announces-shock-exit-from-international-cricket')
)
UPDATE public.players AS p SET is_t20i_retired = true,
  t20i_retirement_date = seed.effective_on, t20i_retirement_source_url = seed.source_url
FROM seed WHERE lower(p.name) = lower(seed.name)
  AND (SELECT count(*) FROM public.players AS other WHERE lower(other.name) = lower(seed.name)) = 1
  AND (p.t20i_retirement_date IS NULL OR p.t20i_retirement_date = seed.effective_on);
