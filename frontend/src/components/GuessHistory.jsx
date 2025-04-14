import React from 'react';

const GuessHistory = ({ history }) => (
  <div className="bg-slate-700/50 p-3 rounded-lg">
    <h3 className="text-xs text-slate-400 mb-1.5">Previous guesses:</h3>
    <div className="space-y-1.5">
      {history.map((entry) => (
        <div
          key={entry.attempt}
          className="flex items-center justify-between px-2.5 py-1.5 bg-slate-800 rounded-md"
        >
          <span className="text-xs text-slate-300">
            {entry.type === 'skip' ? 'Skipped' : entry.value}
          </span>
          <span className="text-xs text-slate-500">Attempt {entry.attempt}</span>
        </div>
      ))}
    </div>
  </div>
);

export default GuessHistory;
