// supabase/functions/audit-code/index.ts
/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AuditRequest {
  type: 'repo' | 'snippet';
  content: string;
}

interface AuditResult {
  file: string;
  line: number;
  severity: 'Critical' | 'High' | 'Low';
  issue: string;
  fix_suggestion: string;
}

// Simple validation
function validatePayload(payload: AuditRequest): string | null {
  if (!payload.type || !['repo', 'snippet'].includes(payload.type)) {
    return 'Invalid type. Must be "repo" or "snippet"';
  }
  if (!payload.content || typeof payload.content !== 'string') {
    return 'Missing or invalid content';
  }
  if (payload.type === 'repo') {
    const githubPattern = /github\.com\/[\w-]+\/[\w.-]+/;
    if (!githubPattern.test(payload.content)) {
      return 'Invalid GitHub repository URL format';
    }
  } else {
    if (payload.content.trim().length < 10) {
      return 'Code snippet too short (minimum 10 characters)';
    }
    if (payload.content.length > 50000) {
      return 'Code snippet too large (maximum 50KB)';
    }
  }
  return null;
}

// Simple AI analysis using fetch
async function analyzeCode(codeContent: string): Promise<AuditResult[]> {
  const deepseekKey = Deno.env.get('DEEPSEEK_API_KEY');
  
  if (!deepseekKey) {
    console.error('DEEPSEEK_API_KEY not set');
    return [{
      file: 'configuration',
      line: 0,
      severity: 'Low' as const,
      issue: 'AI API key not configured',
      fix_suggestion: 'Set DEEPSEEK_API_KEY in Supabase secrets',
    }];
  }

  const systemPrompt = `You are an elite cybersecurity auditor performing SAST (Static Application Security Testing). Analyze the provided code with EXTREME precision.

YOUR TASK: Identify ONLY genuine security vulnerabilities from OWASP Top 10:
1. SQL Injection (SQLi)
2. Cross-Site Scripting (XSS)
3. Broken Authentication
4. Sensitive Data Exposure (hardcoded secrets, API keys, passwords)
5. Security Misconfiguration
6. Insecure Deserialization
7. Using Components with Known Vulnerabilities
8. Insufficient Logging & Monitoring
9. Server-Side Request Forgery (SSRF)
10. Command Injection

CRITICAL RULES:
- Be STRICT: Only flag ACTUAL vulnerabilities, not potential or theoretical ones
- Provide EXACT line numbers where the vulnerability exists
- Give ACTIONABLE fix suggestions (not generic advice)
- Focus on HIGH IMPACT issues
- Ignore false positives (example code, comments, test files)

OUTPUT FORMAT (strict JSON, no markdown, no explanations):
[
  {
    "file": "snippet",
    "line": 5,
    "severity": "Critical",
    "issue": "SQL Injection via string concatenation in database query",
    "fix_suggestion": "Replace with prepared statement: db.query('SELECT * FROM users WHERE id = ?', [userId])"
  }
]

SEVERITY LEVELS:
- Critical: Directly exploitable (SQLi, RCE, auth bypass)
- High: Significant risk (exposed secrets, weak crypto)
- Low: Best practice violations (missing validation, weak logging)

If code is secure, return empty array: []`;

  try {
    console.log('Starting DeepSeek security analysis...');
    
    const truncatedCode = codeContent.slice(0, 15000);
    
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${deepseekKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { 
            role: 'user', 
            content: 'Analyze this code for security vulnerabilities:\n\n' + truncatedCode
          }
        ],
        temperature: 0.1,
        max_tokens: 3000,
        top_p: 0.95,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('DeepSeek API error:', response.status, errorText);
      throw new Error(`DeepSeek API returned ${response.status}`);
    }

    const data = await response.json();
    console.log('DeepSeek response received');
    
    let content = data.choices[0].message.content || '[]';
    console.log('Raw response:', content.slice(0, 500));
    
    // Clean markdown - FIXED REGEX
    const codeBlockPattern = /```(?:json)?/gi;
    content = content
      .replace(codeBlockPattern, '')
      .trim();
    
    // Extract JSON array
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      content = jsonMatch;
    }
    
    console.log('Cleaned content:', content);
    
    // Parse findings with error handling
    let findings: any[];
    try {
      findings = JSON.parse(content);
    } catch (parseError) {
      console.error('JSON parse failed, attempting repair...');
      // Fix common JSON issues
      content = content
        .replace(/,\s*\]/g, ']')
        .replace(/,\s*\}/g, '}')
        .replace(/'/g, '"');
      findings = JSON.parse(content);
    }
    
    if (!Array.isArray(findings)) {
      console.error('Response was not an array');
      return [];
    }

    // Validate and normalize
    const validatedFindings = findings
      .filter((f: any) => f.issue && f.severity)
      .map((f: any) => ({
        file: String(f.file || 'snippet'),
        line: Math.max(1, parseInt(f.line) || 1),
        severity: ['Critical', 'High', 'Low'].includes(f.severity) ? f.severity : 'Low',
        issue: String(f.issue).slice(0, 200),
        fix_suggestion: String(f.fix_suggestion || 'Review and address this vulnerability').slice(0, 300),
      }));

    console.log(`Analysis complete: ${validatedFindings.length} vulnerabilities found`);
    return validatedFindings;

  } catch (error: any) {
    console.error('DeepSeek analysis error:', error.message);
    
    return [{
      file: 'error',
      line: 0,
      severity: 'Low' as const,
      issue: 'Security analysis failed',
      fix_suggestion: `Error: ${error.message}. Check Edge Function logs.`,
    }];
  }
}



// GitHub fetcher
async function fetchGitHubRepo(repoUrl: string): Promise<{ file: string; content: string }[]> {
  const urlPattern = /github\.com\/([^\/]+)\/([^\/]+)/;
  const match = repoUrl.match(urlPattern);
  
  if (!match) {
    throw new Error('Invalid GitHub repository URL');
  }

  const [, owner, repo] = match;
  const cleanRepo = repo.replace('.git', '');
  const apiBase = `https://api.github.com/repos/${owner}/${cleanRepo}`;

  const githubToken = Deno.env.get('GITHUB_TOKEN');
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
  };
  
  if (githubToken) {
    headers['Authorization'] = `token ${githubToken}`;
  }

  // Get repo info
  const repoResponse = await fetch(apiBase, { headers });
  if (!repoResponse.ok) {
    throw new Error(`GitHub API error: ${repoResponse.statusText}`);
  }
  
  const repoInfo = await repoResponse.json();
  const defaultBranch = repoInfo.default_branch || 'main';

  // Get tree
  const treeResponse = await fetch(`${apiBase}/git/trees/${defaultBranch}?recursive=1`, { headers });
  if (!treeResponse.ok) {
    throw new Error(`Failed to fetch repository tree: ${treeResponse.statusText}`);
  }

  const treeData = await treeResponse.json();
  const files: { file: string; content: string }[] = [];
  const supportedExtensions = ['.js', '.ts', '.py', '.jsx', '.tsx'];
  
  // Limit to first 10 files for demo
  let count = 0;
  for (const item of treeData.tree || []) {
    if (count >= 10) break;
    
    if (item.type === 'blob' && supportedExtensions.some(ext => item.path.endsWith(ext))) {
      try {
        const fileResponse = await fetch(item.url, { headers });
        if (fileResponse.ok) {
          const fileData = await fileResponse.json();
          let content = fileData.content;
          
          if (fileData.encoding === 'base64') {
            content = atob(content.replace(/\n/g, ''));
          }
          
          files.push({ file: item.path, content });
          count++;
        }
      } catch (error) {
        console.error(`Error fetching ${item.path}:`, error);
      }
    }
  }

  if (files.length === 0) {
    throw new Error('No supported code files found');
  }

  return files;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload: AuditRequest = await req.json();
    const validationError = validatePayload(payload);
    
    if (validationError) {
      return new Response(
        JSON.stringify({ error: validationError }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let codeToAnalyze: string = '';
    
    if (payload.type === 'repo') {
      try {
        const files = await fetchGitHubRepo(payload.content);
        codeToAnalyze = files.map((f) => `--- ${f.file} ---\n${f.content}`).join('\n\n');
      } catch (error: any) {
        return new Response(
          JSON.stringify({ 
            error: 'Failed to fetch repository', 
            details: error.message 
          }),
          { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      codeToAnalyze = payload.content;
    }

    const findings: AuditResult[] = await analyzeCode(codeToAnalyze);

    const severityCounts = findings.reduce(
      (acc, finding) => {
        if (finding.severity === 'Critical') acc.critical++;
        else if (finding.severity === 'High') acc.high++;
        else acc.low++;
        return acc;
      },
      { critical: 0, high: 0, low: 0 }
    );

    return new Response(
      JSON.stringify({
        success: true,
        report_id: `scan-${Date.now()}`,
        findings: findings,
        summary: {
          total: findings.length,
          ...severityCounts,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
