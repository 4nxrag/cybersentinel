import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Shield, Mail, Lock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Eye, EyeOff } from 'lucide-react';


export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);


  const fillDemoCredentials = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    // Update these setters to match your actual state names
    setEmail("test@example.com"); 
    setPassword("password123");
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (isSignUp) {
        // Sign Up
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) throw error;

        if (data.user) {
          setMessage({
            type: 'success',
            text: 'Account created! Check your email to verify (or sign in directly if email confirmation is disabled)',
          });
        }
      } else {
        // Sign In
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        if (data.user) {
          setMessage({ type: 'success', text: 'Signed in successfully!' });
        }
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Shield className="w-12 h-12 text-blue-600" />
            <h1 className="text-5xl font-bold">CyberSentinel</h1>
          </div>
          <p className="text-gray-600">AI-Powered Security Vulnerability Auditor</p>
        </div>

        {/* Auth Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-200">
          <h2 className="text-2xl font-bold mb-6 text-center">
            {isSignUp ? 'Create Account' : 'Sign In'}
          </h2>

          <form onSubmit={handleAuth} className="space-y-4">
            {/* Email */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email
              </label>
              <Input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

{/* Password */}
<div className="space-y-2">
  <label className="text-sm font-medium flex items-center gap-2">
    <Lock className="w-4 h-4" />
    Password
  </label>
  <div className="relative">
    <Input
      type={showPassword ? "text" : "password"}
      placeholder="••••••••"
      value={password}
        onChange={(e) => {
    // Remove ALL spaces (leading, trailing, middle)
    const noSpaces = e.target.value.replace(/\s/g, '');
    setPassword(noSpaces);
  }}
      required
      disabled={loading}
      minLength={6}
      className="pr-10"  
    />
    <Button
      type="button"
      variant="default"
      size="default"
      className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0 hover:bg-transparent"
      onClick={() => setShowPassword(!showPassword)}
      disabled={loading}
    >
      {showPassword ? (
        <EyeOff className="h-4 w-4" />
      ) : (
        <Eye className="h-4 w-4" />
      )}
    </Button>
  </div>
  {isSignUp && (
    <p className="text-xs text-gray-500">Minimum 6 characters</p>
  )}
</div>


<div className="mb-4 flex justify-center">
  <button
    type="button"
    onClick={fillDemoCredentials}
    className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-md border border-blue-100"
  >
    <span>🚀</span>
    <span>Click here to auto-fill Demo Credentials</span>
  </button>
</div>

            {/* Submit Button */}
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Please wait...
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4 mr-2" />
                  {isSignUp ? 'Create Account' : 'Sign In'}
                </>
              )}
            </Button>
          </form>

          {/* Message Display */}
          {message && (
            <div
              className={`mt-4 p-3 rounded-lg text-sm ${
                message.type === 'error'
                  ? 'bg-red-50 text-red-800 border border-red-200'
                  : 'bg-green-50 text-green-800 border border-green-200'
              }`}
            >
              {message.text}
            </div>
          )}

          {/* Toggle Sign Up/In */}
          <div className="mt-6 text-center text-sm">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setMessage(null);
              }}
              className="text-blue-600 hover:text-blue-700 font-medium"
              disabled={loading}
            >
              {isSignUp
                ? 'Already have an account? Sign in'
                : "Don't have an account? Sign up"}
            </button>
          </div>
        </div>

        {/* Demo credentials */}
              
          <div className="mt-4 text-center text-xs text-gray-500">
                <p>Demo: test@example.com / password123</p>
          </div>

      </div>
    </div>
  );
}
