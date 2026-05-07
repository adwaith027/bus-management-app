export default function UserHome() {
  const storedUser = localStorage.getItem("user")
    ? JSON.parse(localStorage.getItem("user"))
    : null;

  const username = storedUser?.username || "User";

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="max-w-[1200px] mx-auto p-4">
        
        {/* Header Card */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <h1 className="text-2xl font-bold text-slate-800">
            Welcome, {username}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Have a productive day 👋
          </p>
        </div>

      </div>
    </div>
  );
}
