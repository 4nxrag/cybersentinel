// supabase/functions/audit-code/index.ts
/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);


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
  const groqKey = Deno.env.get('GROQ_API_KEY');
  
  if (!groqKey) {
    console.error('GROQ_API_KEY not set');
    return [{
      file: 'configuration',
      line: 0,
      severity: 'Low' as const,
      issue: 'AI API key not configured',
      fix_suggestion: 'Set GROQ_API_KEY in Supabase secrets',
    }];
  }

  const systemPrompt = `You are an elite cybersecurity auditor performing SAST (Static Application Security Testing). Analyze the provided code with EXTREME precision.

**YOUR TASK:** Identify ONLY genuine security vulnerabilities from OWASP Top 10:

1. **SQL Injection (SQLi)** - Unsanitized user input in SQL queries
2. **Cross-Site Scripting (XSS)** - Unescaped output to HTML/JavaScript
3. **Broken Authentication** - Weak passwords, session fixation, insecure token storage
4. **Sensitive Data Exposure** - Hardcoded API keys, passwords, secrets in code
5. **Security Misconfiguration** - Debug mode enabled, default credentials
6. **Insecure Deserialization** - Unsafe pickle/eval usage
7. **Using Components with Known Vulnerabilities** - Outdated dependencies
8. **Insufficient Logging & Monitoring** - Missing security event logging
9. **Server-Side Request Forgery (SSRF)** - Unvalidated URL fetching
10. **Command Injection** - Unsanitized shell execution

**CRITICAL RULES:**
- Be STRICT: Only flag ACTUAL vulnerabilities with exploitable code
- Provide EXACT line numbers (count from 1)
- Give ACTIONABLE fixes with code examples
- Ignore comments, test files, and false positives
- Focus on HIGH IMPACT issues

**OUTPUT FORMAT (strict JSON only, no markdown):**
[
  {
    "file": "auth/login.js",
    "line": 23,
    "severity": "Critical",
    "issue": "SQL Injection via string concatenation in login query",
    "fix_suggestion": "Use parameterized query: db.query('SELECT * FROM users WHERE email = $1', [email])"
  },
  {
    "file": "config/secrets.ts",
    "line": 5,
    "severity": "High",
    "issue": "Hardcoded AWS secret key exposed in source code",
    "fix_suggestion": "Move to environment variables: process.env.AWS_SECRET_KEY"
  }
]

**SEVERITY LEVELS:**
- **Critical**: Directly exploitable (SQLi, RCE, auth bypass, hardcoded secrets)
- **High**: Significant risk (XSS, weak crypto, exposed endpoints)
- **Low**: Best practice violations (missing validation, weak logging)

If code is secure, return empty array: []

**CODE TO ANALYZE:**
`;

  try {
    console.log('🚀 Starting Groq security analysis (Llama 3.3 70B)...');
    
    // Truncate to fit context window (Groq supports 128K tokens)
    const maxCodeLength = 100000;
    const truncatedCode = codeContent.slice(0, maxCodeLength);
    
    if (codeContent.length > maxCodeLength) {
      console.log(`⚠️  Code truncated: ${codeContent.length} → ${maxCodeLength} chars`);
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: truncatedCode }
        ],
        temperature: 0.1,
        max_tokens: 8192,
        top_p: 0.95,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Groq API error:', response.status, errorText);
      throw new Error(`Groq API returned ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ Groq response received');

    // Extract content from Groq response
    if (!data.choices || data.choices.length === 0) {
      console.error('❌ No choices in response:', data);
      return [];
    }

    let content = data.choices[0].message?.content || '[]';
    console.log('📄 Raw response preview:', content.slice(0, 200));

    // Clean markdown code blocks
content = content
  .replace(/```javascript\s*/gi, '')
  .replace(/```/g, '')
  .trim();


    // Extract JSON array (handles extra text before/after)
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      content = jsonMatch;
    }

    console.log('🧹 Cleaned content:', content.slice(0, 300));

    // Parse findings
    let findings: any[];
    try {
      findings = JSON.parse(content);
    } catch (parseError) {
      console.error('⚠️  JSON parse failed, attempting repair...');
      // Fix common JSON issues
      content = content
        .replace(/,\s*]/g, ']')      // Remove trailing commas in arrays
        .replace(/,\s*}/g, '}')      // Remove trailing commas in objects
        .replace(/'/g, '"')          // Replace single quotes
        .replace(/\n/g, ' ');        // Remove newlines
      
      try {
        findings = JSON.parse(content);
      } catch (retryError) {
        console.error('❌ JSON parse failed after repair:', content);
        return [{
          file: 'parser',
          line: 0,
          severity: 'Low' as const,
          issue: 'Failed to parse AI response',
          fix_suggestion: 'Check Edge Function logs for details',
        }];
      }
    }

    if (!Array.isArray(findings)) {
      console.error('❌ Response is not an array:', findings);
      return [];
    }

    // Validate and normalize findings
    const validatedFindings = findings
      .filter((f: any) => f.issue && f.severity)
      .map((f: any) => ({
        file: String(f.file || 'unknown'),
        line: Math.max(1, parseInt(f.line) || 1),
        severity: ['Critical', 'High', 'Low'].includes(f.severity) ? f.severity : 'Low',
        issue: String(f.issue).slice(0, 250),
        fix_suggestion: String(f.fix_suggestion || 'Review and address this vulnerability').slice(0, 400),
      }));

    console.log(`🎯 Analysis complete: ${validatedFindings.length} vulnerabilities found`);
    
    // Log summary by severity
    const summary = validatedFindings.reduce((acc: any, f: any) => {
      acc[f.severity] = (acc[f.severity] || 0) + 1;
      return acc;
    }, {});
    console.log('📊 Severity breakdown:', summary);

    return validatedFindings;

  } catch (error: any) {
    console.error('❌ Groq analysis error:', error.message);
    console.error('Full error:', error);

    return [{
      file: 'error',
      line: 0,
      severity: 'Low' as const,
      issue: 'Security analysis failed',
      fix_suggestion: `Error: ${error.message}. Check Edge Function logs.`,
    }];
  }
}





// GitHub fetcher with DevSecOps priorities
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

    //  Added timeout wrapper
  const fetchWithTimeout = async (url: string, timeout = 10000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, { 
        headers, 
        signal: controller.signal 
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('GitHub API timeout - repository may be too large');
      }
      throw error;
    }
  };

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
  
  // ✅ PRIORITY PATTERNS (scan these FIRST - auth & security critical)
  const highPriorityPatterns = [
    /auth/i,
    /login/i,
    /signin/i,
    /signup/i,
    /jwt/i,
    /token/i,
    /password/i,
    /session/i,
    /credential/i,
    /oauth/i,
    /api\/.*key/i,
  ];
  
  const mediumPriorityPatterns = [
    /middleware/i,
    /route/i,
    /api/i,
    /security/i,
    /config/i,
    /\.env/i,
    /database/i,
    /db/i,
  ];
  
  // ✅ EXCLUDE PATTERNS (skip these entirely)
  const excludePatterns = [
    /node_modules\//,
    /\.git\//,
    /dist\//,
    /build\//,
    /out\//,
    /\.next\//,
    /coverage\//,
    /\.vscode\//,
    /\.idea\//,
    /__pycache__\//,
    /\.pytest_cache\//,
    /venv\//,
    /env\//,
    /__tests__\//,
    /\.test\.[jt]sx?$/,
    /\.spec\.[jt]sx?$/,
    /test\//i,
    /package-lock\.json$/,
    /yarn\.lock$/,
    /pnpm-lock\.yaml$/,
    /\.min\./,
    /\.bundle\./,
    /\.map$/,
  ];
  
  const supportedExtensions = ['.js', '.ts', '.py', '.jsx', '.tsx', '.go', '.java', '.php', '.rb'];
  
  const highPriorityFiles: any[] = [];
  const mediumPriorityFiles: any[] = [];
  const regularFiles: any[] = [];
  
  // Categorize files by priority
  for (const item of treeData.tree || []) {
    if (item.type !== 'blob') continue;
    
    // Skip excluded paths
    if (excludePatterns.some(pattern => pattern.test(item.path))) {
      continue;
    }
    
    // Only supported extensions
    if (!supportedExtensions.some(ext => item.path.endsWith(ext))) {
      continue;
    }
    
    // Categorize by priority
    if (highPriorityPatterns.some(pattern => pattern.test(item.path))) {
      highPriorityFiles.push(item);
    } else if (mediumPriorityPatterns.some(pattern => pattern.test(item.path))) {
      mediumPriorityFiles.push(item);
    } else {
      regularFiles.push(item);
    }
  }
  
  // ✅ Smart file selection: prioritize security-critical files
  // Take up to 12 high priority, 6 medium, 2 regular (total 20 files max)
  const filesToScan = [
    ...highPriorityFiles.slice(0, 12),
    ...mediumPriorityFiles.slice(0, 6),
    ...regularFiles.slice(0, 2),
  ];
  
  console.log(`📊 File Analysis: ${highPriorityFiles.length} critical, ${mediumPriorityFiles.length} medium, ${regularFiles.length} regular`);
  console.log(`🎯 Scanning ${filesToScan.length} files (prioritized)`);
  
  const files: { file: string; content: string }[] = [];
  
  for (const item of filesToScan) {
    try {
      const fileResponse = await fetch(item.url, { headers });
      if (fileResponse.ok) {
        const fileData = await fileResponse.json();
        let content = fileData.content;
        
        if (fileData.encoding === 'base64') {
          content = atob(content.replace(/\n/g, ''));
        }
        
        // Skip overly large files (> 100KB)
        if (content.length > 100000) {
          console.log(`⚠️  Skipping large file: ${item.path}`);
          continue;
        }
        
        files.push({ 
          file: item.path, 
          content: content 
        });
      }
    } catch (error) {
      console.error(`❌ Error fetching ${item.path}:`, error);
    }
  }

  if (files.length === 0) {
    throw new Error('No supported code files found in repository');
  }

  console.log(`✅ Successfully fetched ${files.length} files for analysis`);
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
        codeToAnalyze = files.map((f) => `--- FILE: ${f.file} ---\n${f.content}`).join('\n\n');
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

    // Save scan to history
try {
  const { error: historyError } = await supabaseAdmin
    .from('scan_history')
    .insert({
      repo_name: payload.type === 'repo' 
        ? payload.content.split('/').slice(-2).join('/') // e.g., "username/repo"
        : 'code-snippet',
      repo_url: payload.type === 'repo' ? payload.content : null,
      total_issues: findings.length,
      critical_count: severityCounts.critical,
      high_count: severityCounts.high,
      low_count: severityCounts.low,
      findings: findings,
      status: 'completed',
    });

  if (historyError) {
    console.error('Failed to save scan history:', historyError);
  }
} catch (err) {
  console.error('Error saving history:', err);
  // Don't fail the request if history save fails
}


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
