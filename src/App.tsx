import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import Scanner from '@/components/Scanner';
import Dashboard from '@/components/Dashboard';
import Auth from '@/components/Auth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, ScanLine, BarChart3, Loader2, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      {/* Top Bar with Sign Out */}
      <div className="bg-white/50 backdrop-blur-sm border-b border-gray-200">
        <div className="container mx-auto px-4 py-3 flex items-center justify-end">
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-700">{user.email}</span>
            <Button onClick={handleSignOut} variant="outline" size="default" className="gap-2">
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Shield className="h-10 w-10 text-blue-600" />
            <h1 className="text-5xl font-bold text-black">
              CyberSentinel
            </h1>
          </div>
          <p className="text-gray-600 text-lg">AI-Powered DevSecOps Agent</p>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="scanner" className="w-full max-w-7xl mx-auto">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="scanner" className="flex items-center gap-2">
              <ScanLine className="w-4 h-4" />
              Security Scanner
            </TabsTrigger>
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Dashboard
            </TabsTrigger>
          </TabsList>

          <TabsContent value="scanner">
            <Scanner />
          </TabsContent>

          <TabsContent value="dashboard">
            <Dashboard />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default App;
