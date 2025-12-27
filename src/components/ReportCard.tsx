// src/components/ReportCard.tsx
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';

interface Finding {
  file: string;
  line: number;
  severity: 'Critical' | 'High' | 'Low';
  issue: string;
  fix_suggestion: string;
}

interface ReportCardProps {
  finding: Finding;
}

export default function ReportCard({ finding }: ReportCardProps) {
  const severityConfig = {
    Critical: {
      icon: AlertTriangle,
      bg: 'bg-red-50',
      border: 'border-red-300',
      badge: 'bg-red-600 text-white',
      iconColor: 'text-red-600',
    },
    High: {
      icon: AlertCircle,
      bg: 'bg-orange-50',
      border: 'border-orange-300',
      badge: 'bg-orange-600 text-white',
      iconColor: 'text-orange-600',
    },
    Low: {
      icon: Info,
      bg: 'bg-yellow-50',
      border: 'border-yellow-300',
      badge: 'bg-yellow-600 text-white',
      iconColor: 'text-yellow-600',
    },
  };

  const config = severityConfig[finding.severity];
  const Icon = config.icon;

  return (
    <div className={`rounded-lg border-2 ${config.border} ${config.bg} p-4 space-y-3`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1">
          <Icon className={`w-5 h-5 ${config.iconColor} flex-shrink-0 mt-0.5`} />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${config.badge}`}>
                {finding.severity}
              </span>
              <span className="text-sm text-gray-600 font-mono">
                {finding.file}:{finding.line}
              </span>
            </div>
            <h3 className="font-semibold text-gray-900">{finding.issue}</h3>
          </div>
        </div>
      </div>

      {/* Fix Suggestion */}
      <div className="bg-white rounded border border-gray-200 p-3">
        <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Recommended Fix</p>
        <p className="text-sm text-gray-800">{finding.fix_suggestion}</p>
      </div>
    </div>
  );
}
