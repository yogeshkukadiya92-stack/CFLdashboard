/** Deep links open a panel once; refreshing should return to the workshop list. */
export function consumeWorkshopPanelUrl(href: string) {
  const url = new URL(href);
  for (const key of ["edit", "workshopId", "id"]) url.searchParams.delete(key);
  return `${url.pathname}${url.search}${url.hash}`;
}
