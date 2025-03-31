import React from 'react';

const GuessHistory = ({ history }) => (
  <div className="bg-slate-700/50 p-4 rounded-lg">
    <h3 className="text-sm text-slate-400 mb-2">Previous guesses:</h3>
    <div className="space-y-2">
      {history.map((entry) => (
        <div
          key={entry.attempt}
          className="flex items-center justify-between px-3 py-2 bg-slate-800 rounded-md"
        >
          <span className="text-sm text-slate-300">
            {entry.type === 'skip' ? 'Skipped' : entry.value}
          </span>
          <span className="text-xs text-slate-500">Attempt {entry.attempt}</span>
        </div>
      ))}
    </div>
  </div>
);

export default GuessHistory;
