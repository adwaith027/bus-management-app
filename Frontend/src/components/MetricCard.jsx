export default function MetricCard({ title, value, iconClass, color, loading }) {
  return (
    <div
      className={`
        rounded-xl bg-white border border-slate-200 shadow-sm p-4 flex items-center justify-between
        transition-all duration-200 
        ${loading ? "animate-pulse opacity-60" : ""}
      `}
    >
      {/* Text Section */}
      <div className="flex flex-col">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          {title}
        </h3>
        <span
          className="text-xl font-bold mt-1"
          style={{ color: color || "#000" }}
        >
          {value}
        </span>
      </div>

      {/* Icon Section */}
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center text-white shadow-md"
        style={{ backgroundColor: color || "#000" }}
      >
        <i className={`${iconClass} text-lg`}></i>
      </div>
    </div>
  );
}
