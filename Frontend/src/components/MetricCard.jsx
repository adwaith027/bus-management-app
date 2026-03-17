export default function MetricCard({ title, value, iconClass, color, loading }) {
  return (
    <div
      className={[
        "group relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-3 shadow-sm transition",
        "hover:-translate-y-0.5 hover:shadow-lg hover:border-slate-300/80",
        loading ? "animate-pulse opacity-70" : "",
      ].join(" ")}
      aria-busy={loading}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white via-white to-slate-50 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      <div className="relative flex items-center justify-between gap-4">
        <div className="flex flex-col">
          <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.2em]">
            {title}
          </h3>
          <span
            className="text-xl font-bold mt-1 text-slate-900"
            style={{ color: color || "#0f172a" }}
          >
            {value}
          </span>
        </div>

        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-md ring-4 ring-white/80"
          style={{ backgroundColor: color || "#0f172a" }}
        >
          <i className={`${iconClass} text-lg`}></i>
        </div>
      </div>
    </div>
  );
}
