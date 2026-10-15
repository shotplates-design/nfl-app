export default function L() {
  return <div aria-busy="true" aria-label="Loading">
    <div className="skeleton h-8 w-40 mb-3"/>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">{[0, 1, 2, 3].map(i => <div key={i} className="skeleton h-24"/>)}</div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">{[0, 1, 2, 3].map(i => <div key={i} className="skeleton h-72"/>)}</div>
  </div>;
}
