// src/App.tsx
import Scanner from '@/components/Scanner';
import Dashboard from '@/components/Dashboard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, ScanLine, BarChart3 } from 'lucide-react';

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Shield className="h-10 w-10 text-blue-600" />
<h1 className="text-5xl font-bold text-black">
  CyberSentinel
</h1>

          </div>
          <p className="text-gray-600 text-lg">AI-DevSecOps Agent</p>
        </div>

        {/* Main Tabs - Same style as sub-tabs */}
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
