type WorkshopPayment = { id: string; minimumPartPayment?: string | number };

export function configuredPartPayment(workshops: WorkshopPayment[], workshopId: string, fullAmount: number): number {
  const amount = Number(workshops.find((workshop) => workshop.id === workshopId)?.minimumPartPayment);
  return Number.isFinite(amount) && amount > 0 && fullAmount > 0 ? Math.min(amount, fullAmount) : 0;
}
