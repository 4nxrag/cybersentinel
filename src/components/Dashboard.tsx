import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Download, Activity, AlertTriangle, Shield } from 'lucide-react';

interface ScanHistory {
  id: string;
  repo_name: string;
  scan_date: string;
  total_issues: number;
  critical_count: number;
  high_count: number;
  low_count: number;
  status: string;
  findings: any[];
}

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalScans: 0,
    totalIssues: 0,
    criticalIssues: 0,
  });
  const [recentScans, setRecentScans] = useState<ScanHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: scans, error: fetchError } = await supabase
        .from('scan_history')
        .select('*')
        .order('scan_date', { ascending: false })
        .limit(50);

      if (fetchError) throw fetchError;

      if (scans) {
        const totalScans = scans.length;
        const totalIssues = scans.reduce((sum, s) => sum + (s.total_issues || 0), 0);
        const criticalIssues = scans.reduce((sum, s) => sum + (s.critical_count || 0), 0);

        setStats({ totalScans, totalIssues, criticalIssues });
        setRecentScans(scans.slice(0, 10) as ScanHistory[]);
      }
    } catch (err: any) {
      console.error('Dashboard load error:', err);
      setError(err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const downloadJSONReport = () => {
    const report = {
      generated: new Date().toISOString(),
      stats,
      scans: recentScans,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cybersentinel-report-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadCSVReport = () => {
    const csv = [
      ['Repo', 'Date', 'Total Issues', 'Critical', 'High', 'Low', 'Status'],
      ...recentScans.map(s => [
        s.repo_name,
        new Date(s.scan_date).toLocaleDateString(),
        s.total_issues,
        s.critical_count,
        s.high_count,
        s.low_count,
        s.status,
      ]),
    ]
      .map(row => row.join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cybersentinel-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <p className="font-medium">Error loading dashboard</p>
          <p className="text-sm mt-1">{error}</p>
          <Button onClick={loadDashboard} className="mt-4" variant="outline">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
<h1 className="text-3xl font-bold text-gray-800">
  Security Dashboard
</h1>

        <p className="text-gray-600">Monitor your security scans and vulnerability trends</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-500">Total Scans</h3>
            <Activity className="h-5 w-5 text-green-500" />
          </div>
          <p className="text-3xl font-bold text-green-600">{stats.totalScans}</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-500">Total Issues</h3>
            <Shield className="h-5 w-5 text-blue-500" />
          </div>
          <p className="text-3xl font-bold text-gray-800">{stats.totalIssues}</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-500">Critical Issues</h3>
            <AlertTriangle className="h-5 w-5 text-red-500" />
          </div>
          <p className="text-3xl font-bold text-red-600">{stats.criticalIssues}</p>
        </div>
      </div>

      {/* Recent Scans Table */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold">Recent Scans</h2>
          <div className="flex gap-2">
            <Button onClick={downloadCSVReport} variant="outline" size="default" className="gap-2">
              <Download className="h-4 w-4" />
              CSV
            </Button>
            <Button onClick={downloadJSONReport} size="default" className="gap-2">
              <Download className="h-4 w-4" />
              JSON
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {recentScans.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Shield className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No scans yet. Run your first security scan to see results here.</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-6 font-medium text-gray-700">Repository</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Date</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Total</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Critical</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">High</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentScans.map((scan) => (
                  <tr key={scan.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-4 px-6 font-mono text-sm truncate max-w-[250px]">
                      {scan.repo_name}
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-600">
                      {new Date(scan.scan_date).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-4 px-4 text-sm font-semibold">{scan.total_issues}</td>
                    <td className="py-4 px-4 text-sm text-red-600 font-semibold">
                      {scan.critical_count}
                    </td>
                    <td className="py-4 px-4 text-sm text-orange-600 font-semibold">
                      {scan.high_count}
                    </td>
                    <td className="py-4 px-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          scan.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {scan.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
