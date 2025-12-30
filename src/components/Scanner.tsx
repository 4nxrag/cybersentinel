// src/components/Scanner.tsx
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Shield, Github, Code, AlertTriangle, Loader2, LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import ReportCard from './ReportCard';

interface Finding {
  file: string;
  line: number;
  severity: 'Critical' | 'High' | 'Low';
  issue: string;
  fix_suggestion: string;
}

interface AuditResponse {
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

export default function Scanner() {
  const [mode, setMode] = useState<'repo' | 'snippet'>('repo');
  const [repoUrl, setRepoUrl] = useState('');
  const [codeSnippet, setCodeSnippet] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AuditResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

 

const handleScan = async () => {
  setLoading(true);
  setError(null);
  setResults(null);

  const content = mode === 'repo' ? repoUrl : codeSnippet;

  if (!content.trim()) {
    setError('Please provide input to scan');
    setLoading(false);
    return;
  }

  try {
    console.log('🚀 Calling Edge Function...');

    // ✅ FIXED: Use fetch directly with anon key instead of supabase.functions.invoke
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
    const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const response = await fetch(`${SUPABASE_URL}/functions/v1/audit-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, // ✅ Use anon key
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        type: mode,
        content: content,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Scan failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();

    if (!data || !data.success) {
      throw new Error('Invalid response from server');
    }

    console.log('✅ Scan complete:', data);
    setResults(data);

  } catch (err: any) {
    console.error('❌ Scan error:', err);
    setError(err.message || 'An error occurred during scanning');
  } finally {
    setLoading(false);
  }
};




  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header with Sign Out */}

      {/* Scanner Interface */}
      <Tabs value={mode} onValueChange={(v) => setMode(v as 'repo' | 'snippet')} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="repo" className="flex items-center gap-2">
            <Github className="w-4 h-4" />
            Scan Repository
          </TabsTrigger>
          <TabsTrigger value="snippet" className="flex items-center gap-2">
            <Code className="w-4 h-4" />
            Paste Code
          </TabsTrigger>
        </TabsList>

        {/* Repository Mode */}
        <TabsContent value="repo" className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">GitHub Repository URL</label>
            <Input
              placeholder="https://github.com/username/repository"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              className="font-mono"
            />
            <p className="text-xs text-gray-500">
              Public repositories only. Max 20 files, depth 3 levels.
            </p>
          </div>
        </TabsContent>

        {/* Snippet Mode */}
        <TabsContent value="snippet" className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Paste Your Code</label>
            <Textarea
              placeholder="// Paste your JavaScript, TypeScript, or Python code here..."
              value={codeSnippet}
              onChange={(e) => setCodeSnippet(e.target.value)}
              rows={12}
              className="font-mono text-sm"
            />
            <p className="text-xs text-gray-500">
              Maximum 50KB. Supports JS, TS, Python.
            </p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Scan Button */}
      <Button
        onClick={handleScan}
        disabled={loading}
        className="w-full"
        size="lg"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Analyzing Code...
          </>
        ) : (
          <>
            <Shield className="w-4 h-4 mr-2" />
            Run Security Audit
          </>
        )}
      </Button>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900">Scan Failed</h3>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Results Display */}
      {results && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 border border-blue-200">
            <h2 className="text-xl font-bold mb-4">Audit Summary</h2>
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-800">{results.summary.total}</div>
                <div className="text-sm text-gray-600">Total Issues</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-red-600">{results.summary.critical}</div>
                <div className="text-sm text-gray-600">Critical</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-orange-600">{results.summary.high}</div>
                <div className="text-sm text-gray-600">High</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-600">{results.summary.low}</div>
                <div className="text-sm text-gray-600">Low</div>
              </div>
            </div>
          </div>

          {/* Findings */}
          <div className="space-y-3">
            <h2 className="text-xl font-bold">Vulnerabilities Detected</h2>
            {results.findings.length === 0 ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                <Shield className="w-12 h-12 text-green-600 mx-auto mb-2" />
                <p className="text-green-800 font-medium">No security vulnerabilities detected!</p>
              </div>
            ) : (
              results.findings.map((finding, idx) => (
                <ReportCard key={idx} finding={finding} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
