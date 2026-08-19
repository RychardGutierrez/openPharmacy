export const shiftsKeys = {
  all: ["shifts"] as const,
  current: (userId?: string) => [...shiftsKeys.all, "current", userId ?? "anonymous"] as const,
  reopenRequests: () => [...shiftsKeys.all, "reopen-requests"] as const,
}
