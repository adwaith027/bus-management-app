import React from 'react';

/**
 * SearchBar component for filtering lists
 * @param {string} searchTerm - Current search term value
 * @param {Function} onSearchChange - Callback when search term changes
 * @param {Function} onReset - Callback for reset button
 * @param {string} placeholder - Input placeholder text
 */
const SearchBar = ({ searchTerm, onSearchChange, onReset, placeholder = 'Search...' }) => {
  return (
    <div className="flex gap-2 mb-6">
      <div className="relative flex-1">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg
            className="w-5 h-5 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
        />
      </div>
      <button
        onClick={onReset}
        className="px-4 py-2.5 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors font-medium"
      >
        Reset
      </button>
    </div>
  );
};

export default SearchBar;
