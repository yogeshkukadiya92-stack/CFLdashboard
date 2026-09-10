export function isHealthyForeverWorkshop(name: string | null | undefined) {
  return String(name ?? "")
    .trim()
    .toLocaleLowerCase("en-IN")
    .replace(/[^a-z0-9]+/g, " ")
    .includes("healthy forever");
}
