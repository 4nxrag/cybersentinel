export interface AuditRequest {
  type: 'repo' | 'snippet';
  content: string;
}

export interface Finding {
  file: string;
  line: number;
  severity: 'Critical' | 'High' | 'Low';
  issue: string;
  fix_suggestion: string;
}

export interface AuditResponse {
  success: boolean;
  report_id: string;
  findings: Finding[];
  summary: {
    total: number;
    critical: number;
    high: number;
    low: number;
  };
}
