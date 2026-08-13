export type DashboardClient = {
  id?: number | string;
};

export type DashboardWorkshop = {
  facilitator?: string;
  id: string;
  name: string;
};

export type DashboardRegistration = {
  amountDue?: number;
  amountPaid?: number;
  createdAt?: string;
  fullName?: string;
  status?: string;
  workshopId?: string;
  workshopTitle?: string;
};

export type DashboardSchedule = {
  batch?: string;
  facilitator?: string;
  selectedEvent?: string;
};

export type DashboardEventRow = {
  dateRange: string;
  latest: string;
  name: string;
  newCount: number;
  registrations: number;
};

export type DashboardSnapshot = {
  clientCount: number;
  due: number;
  eventRows: DashboardEventRow[];
  nextEvent: string;
  nextFacilitator: string;
  paidRegistrations: number;
  registrationCount: number;
  revenue: number;
  scheduleCount: number;
  workshopCount: number;
};

export function buildDashboardSnapshot(
  clients: DashboardClient[],
  workshops: DashboardWorkshop[],
  registrations: DashboardRegistration[],
  schedules: DashboardSchedule[],
  now = new Date(),
  clientCount = clients.length,
): DashboardSnapshot {
  const rows = workshops.map<DashboardEventRow>((workshop) => ({
    dateRange: "Main batch",
    latest: "No registration",
    name: workshop.name,
    newCount: 0,
    registrations: 0,
  }));
  const workshopIndexesById = new Map<string, number[]>();
  const workshopIndexesByName = new Map<string, number[]>();

  workshops.forEach((workshop, index) => {
    const idIndexes = workshopIndexesById.get(workshop.id) ?? [];
    idIndexes.push(index);
    workshopIndexesById.set(workshop.id, idIndexes);

    const nameIndexes = workshopIndexesByName.get(workshop.name) ?? [];
    nameIndexes.push(index);
    workshopIndexesByName.set(workshop.name, nameIndexes);
  });

  const firstScheduleByEvent = new Map<string, DashboardSchedule>();
  schedules.forEach((schedule) => {
    if (schedule.selectedEvent && !firstScheduleByEvent.has(schedule.selectedEvent)) {
      firstScheduleByEvent.set(schedule.selectedEvent, schedule);
    }
  });
  workshops.forEach((workshop, index) => {
    rows[index].dateRange = firstScheduleByEvent.get(workshop.name)?.batch || "Main batch";
  });

  const recentCutoff = new Date(now.getTime() - 7 * 86_400_000).toISOString().slice(0, 10);
  let revenue = 0;
  let due = 0;
  let paidRegistrations = 0;

  registrations.forEach((registration) => {
    revenue += Number(registration.amountPaid) || 0;
    due += Number(registration.amountDue) || 0;
    if (registration.status === "Paid") paidRegistrations += 1;

    const matchingIndexes = new Set<number>();
    if (registration.workshopId) {
      workshopIndexesById.get(registration.workshopId)?.forEach((index) => matchingIndexes.add(index));
    }
    if (registration.workshopTitle) {
      workshopIndexesByName.get(registration.workshopTitle)?.forEach((index) => matchingIndexes.add(index));
    }
    matchingIndexes.forEach((index) => {
      const row = rows[index];
      row.registrations += 1;
      if (row.latest === "No registration") row.latest = registration.fullName || "No registration";
      if ((registration.createdAt || "") >= recentCutoff) row.newCount += 1;
    });
  });

  return {
    clientCount,
    due,
    eventRows: rows,
    nextEvent: schedules[0]?.selectedEvent || workshops[0]?.name || "",
    nextFacilitator: schedules[0]?.facilitator || workshops[0]?.facilitator || "Not assigned",
    paidRegistrations,
    registrationCount: registrations.length,
    revenue,
    scheduleCount: schedules.length,
    workshopCount: workshops.length,
  };
}
