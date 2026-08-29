export interface StaffDirectoryPayload {
  members: Array<Record<string, unknown> & { id: string }>;
  assignments: Array<{
    staff_id: string;
    team_id: string;
    role: string;
    start_season: number;
  }>;
  error?: string;
}

let cachedDirectory: StaffDirectoryPayload | null = null;
let directoryRequest: Promise<StaffDirectoryPayload> | null = null;

/** Share the immutable starting directory across every page in this session. */
export function loadStaffDirectory(force = false): Promise<StaffDirectoryPayload> {
  if (force) {
    cachedDirectory = null;
    directoryRequest = null;
  }
  if (cachedDirectory) return Promise.resolve(cachedDirectory);
  if (directoryRequest) return directoryRequest;

  directoryRequest = fetch("/api/staff", { cache: "no-store" })
    .then(async (response) => {
      const result = await response.json() as StaffDirectoryPayload;
      if (!response.ok) throw new Error(result.error || "Unable to load staff");
      if (!result.members?.length) throw new Error(result.error || "The staff directory is empty.");
      cachedDirectory = result;
      return result;
    })
    .finally(() => {
      directoryRequest = null;
    });
  return directoryRequest;
}
