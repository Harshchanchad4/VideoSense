const STATUS_CONFIG = {
  pending:    { label: 'Pending',    classes: 'bg-gray-100 text-gray-700 border-gray-300' },
  processing: { label: 'Processing', classes: 'bg-yellow-100 text-yellow-800 border-yellow-300 animate-pulse' },
  safe:       { label: 'Safe',       classes: 'bg-green-100 text-green-800 border-green-300' },
  flagged:    { label: 'Flagged',    classes: 'bg-red-100 text-red-800 border-red-300' },
  error:      { label: 'Error',      classes: 'bg-orange-100 text-orange-800 border-orange-300' },
};

// Human-readable reason labels
const REASON_LABELS = {
  nudity:            'Nudity',
  violence:          'Violence',
  'offensive content': 'Offensive',
  gore:              'Gore',
  simulated:         'Simulated',
};

const StatusBadge = ({ status, reason, size = 'sm' }) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const sizeClasses = size === 'lg' ? 'text-sm px-3 py-1' : 'text-xs px-2 py-0.5';
  const reasonLabel = reason ? REASON_LABELS[reason] || reason : null;

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border font-medium ${sizeClasses} ${config.classes}`}>
      {status === 'processing' && (
        <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {config.label}
      {status === 'flagged' && reasonLabel && (
        <span className="ml-0.5 opacity-75">· {reasonLabel}</span>
      )}
    </span>
  );
};

export default StatusBadge;
