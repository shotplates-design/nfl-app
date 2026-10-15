export default function LineCards({ groups }: { groups: { name: string; chips: string[] }[] }) {
  if (!groups.length) return null;
  return <ul className="space-y-2">{groups.map(g => <li key={g.name} className="card !p-3 min-w-0">
    <div className="font-semibold break-anywhere">{g.name}</div>
    <div className="mt-1.5 flex flex-wrap gap-1.5">{g.chips.map(c => <span key={c} className="text-xs leading-snug rounded-full bg-slate-800 border border-slate-700 px-2 py-1">{c}</span>)}</div>
  </li>)}</ul>;
}
