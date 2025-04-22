import PropTypes from 'prop-types';

const Leaderboard = ({ leaderboard }) => (
  <div className="space-y-2">
    {leaderboard.map((player, idx) => (
      <div
        key={player.email || idx}
        className="flex justify-between items-center bg-gray-700/30 p-4 rounded-xl border border-white/10 hover:border-amber-400/30 transition-colors"
      >
        <span className="text-gray-200">{player.email}</span>
        <span className="text-amber-400 font-medium flex items-center gap-2">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          {player.score}
        </span>
      </div>
    ))}
  </div>
);

Leaderboard.propTypes = {
  leaderboard: PropTypes.arrayOf(
    PropTypes.shape({
      email: PropTypes.string,
      score: PropTypes.number,
    })
  ).isRequired,
};

export default Leaderboard;
