export function SidebarNav({
  items
}: {
  items: string[];
}) {
  return (
    <aside className="rounded-lg bg-white p-4 shadow-sm">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-indigo-500">Admin Panel</p>
      <nav className="space-y-2">
        {items.map((item, index) => (
          <button
            className={`w-full rounded-md px-3 py-2 text-left text-sm font-medium transition ${
              index === 1 ? "bg-indigo-50 text-indigo-700" : "text-gray-700 hover:bg-gray-100"
            }`}
            key={item}
            type="button"
          >
            {item}
          </button>
        ))}
      </nav>
    </aside>
  );
}

