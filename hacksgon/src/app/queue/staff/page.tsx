"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Users, 
  UserPlus, 
  UserMinus, 
  SkipForward, 
  ArrowRightLeft, 
  Phone, 
  MessageSquare,
  BarChart3,
  Settings,
  ArrowLeft,
  Clock,
  Briefcase
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

interface QueueCustomer {
  id: string;
  name: string;
  priority: 'emergency' | 'vip' | 'elderly' | 'regular';
  position: number;
  estimatedWaitTime: number;
  serviceType: string;
  counterId?: string;
}

interface Counter {
  id: string;
  name: string;
  status: 'open' | 'closed' | 'busy';
  currentCustomerId?: string;
  queueLength: number;
  staffId: string;
}

export default function StaffDashboard() {
  const [queue, setQueue] = useState<QueueCustomer[]>([]);
  const [counters, setCounters] = useState<Counter[]>([]);
  const [selectedCounter, setSelectedCounter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string>('');

  useEffect(() => {
    const fetchStaffData = async () => {
      try {
        const response = await fetch('/api/queue/status?locationId=default');
        const data = await response.json();
        
        if (data.success) {
          setQueue(data.data.queue);
          setCounters(data.data.counters);
        }
      } catch (error) {
        console.error('Error fetching staff data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStaffData();
    const interval = setInterval(fetchStaffData, 3000);
    return () => clearInterval(interval);
  }, []);

  const callNextCustomer = async () => {
    if (!selectedCounter) return;
    
    setActionLoading('call-next');
    try {
      const response = await fetch('/api/queue/call-next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ counterId: selectedCounter })
      });
      
      if (response.ok) {
        // Refresh data
        const statusResponse = await fetch('/api/queue/status?locationId=default');
        const statusData = await statusResponse.json();
        if (statusData.success) {
          setQueue(statusData.data.queue);
          setCounters(statusData.data.counters);
        }
      }
    } catch (error) {
      console.error('Error calling next customer:', error);
    } finally {
      setActionLoading('');
    }
  };

  const skipCustomer = async () => {
    if (!selectedCounter) return;
    
    setActionLoading('skip');
    try {
      const response = await fetch('/api/queue/skip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ counterId: selectedCounter })
      });
      
      if (response.ok) {
        // Refresh data
        const statusResponse = await fetch('/api/queue/status?locationId=default');
        const statusData = await statusResponse.json();
        if (statusData.success) {
          setQueue(statusData.data.queue);
          setCounters(statusData.data.counters);
        }
      }
    } catch (error) {
      console.error('Error skipping customer:', error);
    } finally {
      setActionLoading('');
    }
  };

  const transferCustomer = async (fromCounterId: string, toCounterId: string) => {
    setActionLoading('transfer');
    try {
      const response = await fetch('/api/queue/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromCounterId, toCounterId })
      });
      
      if (response.ok) {
        // Refresh data
        const statusResponse = await fetch('/api/queue/status?locationId=default');
        const statusData = await statusResponse.json();
        if (statusData.success) {
          setQueue(statusData.data.queue);
          setCounters(statusData.data.counters);
        }
      }
    } catch (error) {
      console.error('Error transferring customer:', error);
    } finally {
      setActionLoading('');
    }
  };

  const updateCounterStatus = async (counterId: string, status: 'open' | 'closed' | 'busy') => {
    try {
      const response = await fetch('/api/queue/counter-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ counterId, status })
      });
      
      if (response.ok) {
        // Refresh data
        const statusResponse = await fetch('/api/queue/status?locationId=default');
        const statusData = await statusResponse.json();
        if (statusData.success) {
          setCounters(statusData.data.counters);
        }
      }
    } catch (error) {
      console.error('Error updating counter status:', error);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'emergency': return 'text-red-600 bg-red-100';
      case 'vip': return 'text-primary bg-primary/10';
      case 'elderly': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const currentCounter = counters.find(c => c.id === selectedCounter);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading staff dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8FAFC] via-white to-[#EFF6FF] relative overflow-hidden">
      {/* Animated Background Blobs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <motion.div 
          animate={{ scale: [1, 1.1, 1], x: [0, 50, 0], y: [0, 30, 0] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[10%] right-[10%] w-[40%] h-[40%] bg-[#7C3AED] rounded-full mix-blend-multiply filter blur-[120px] opacity-10"
        />
        <motion.div 
          animate={{ scale: [1, 1.2, 1], x: [0, -50, 0], y: [0, -30, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-[20%] left-[10%] w-[50%] h-[50%] bg-[#2563EB] rounded-full mix-blend-multiply filter blur-[100px] opacity-10"
        />
      </div>

      <header className="bg-white/70 backdrop-blur-xl border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <Link href="/" className="flex items-center space-x-2 group">
              <div className="p-2 bg-gray-50 rounded-full group-hover:bg-blue-50 transition-colors">
                <ArrowLeft className="h-5 w-5 text-slate-500 group-hover:text-blue-600 transition-colors" />
              </div>
              <span className="text-slate-600 font-medium group-hover:text-slate-900 transition-colors">Back</span>
            </Link>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Staff Portal
            </h1>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" className="hidden md:flex rounded-xl bg-card shadow-sm hover:bg-slate-50">
                <Settings className="h-4 w-4 mr-2 text-slate-500" />
                Settings
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">Staff Operations</h2>
            <p className="text-slate-500 text-lg">Manage counters and serve patients efficiently</p>
          </div>
          <Button className="rounded-xl shadow-lg hover:shadow-xl transition-all shadow-blue-500/20 bg-gradient-to-r from-blue-600 to-indigo-600">
            <BarChart3 className="h-4 w-4 mr-2" />
            View Analytics
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
          {/* Counter Selection */}
          <Card className="border-0 shadow-xl shadow-slate-200/50 rounded-2xl bg-white/90 backdrop-blur-sm ring-1 ring-slate-100 h-full">
            <CardHeader className="bg-gradient-to-b from-slate-50/50 to-white px-6 py-5 border-b border-slate-100 rounded-t-2xl">
              <CardTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-indigo-500" />
                My Assigned Counter
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Select Counter</label>
                  <Select value={selectedCounter} onValueChange={setSelectedCounter}>
                    <SelectTrigger className="w-full rounded-xl bg-slate-50/50 border-slate-200 h-12 shadow-sm font-medium focus:ring-2 focus:ring-blue-500/20">
                      <SelectValue placeholder="Choose a counter..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {counters.map((counter) => (
                        <SelectItem key={counter.id} value={counter.id} className="cursor-pointer rounded-lg">
                          <span className="font-semibold">{counter.name}</span> <span className="text-slate-400">({counter.queueLength} waiting)</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {currentCounter ? (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3 mt-4">
                    <div className="flex items-center justify-between p-4 bg-card border border-slate-100 rounded-xl shadow-sm">
                      <span className="font-semibold text-slate-500 text-sm">Status</span>
                      <Badge
                        variant={currentCounter.status === 'open' ? 'default' : currentCounter.status === 'busy' ? 'secondary' : 'destructive'}
                        className={`text-[10px] uppercase font-bold tracking-wider ${
                          currentCounter.status === 'open' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                          currentCounter.status === 'busy' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                          'bg-rose-100 text-rose-700 border-rose-200'
                        }`}
                      >
                        {currentCounter.status}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center justify-between p-4 bg-card border border-slate-100 rounded-xl shadow-sm">
                      <span className="font-semibold text-slate-500 text-sm">Queue Length</span>
                      <span className="font-bold text-xl text-slate-800">{currentCounter.queueLength}</span>
                    </div>

                    {currentCounter.currentCustomerId && (
                      <div className="flex items-center p-4 bg-emerald-50 border border-emerald-100 rounded-xl shadow-inner gap-3">
                         <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-emerald-700 font-bold text-sm">Currently serving patient</span>
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <div className="mt-8 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200 p-6 flex flex-col items-center justify-center space-y-3">
                    <Briefcase className="w-10 h-10 text-slate-300" />
                    <p className="text-slate-500 text-sm font-medium">Please select a counter to begin serving patients and managing the queue.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Queue Actions */}
          <Card className="border-0 shadow-xl shadow-slate-200/50 rounded-2xl bg-white/90 backdrop-blur-sm ring-1 ring-slate-100 flex flex-col h-full">
            <CardHeader className="bg-gradient-to-b from-slate-50/50 to-white px-6 py-5 border-b border-slate-100 rounded-t-2xl">
              <CardTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Settings className="h-5 w-5 text-blue-500" />
                Queue Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 flex-1 flex flex-col justify-center">
              <div className="space-y-4">
                <Button
                  onClick={callNextCustomer}
                  disabled={!selectedCounter || actionLoading === 'call-next'}
                  className={`w-full h-14 rounded-xl font-bold shadow-md transition-all ${
                    !selectedCounter ? 'opacity-50' : 'bg-gradient-to-r from-blue-600 to-blue-500 hover:shadow-lg hover:shadow-blue-500/30 hover:-translate-y-0.5'
                  }`}
                >
                  <UserPlus className="h-5 w-5 mr-2" />
                  {actionLoading === 'call-next' ? 'Calling...' : 'Call Next Patient'}
                </Button>

                <Button
                  onClick={skipCustomer}
                  disabled={!selectedCounter || actionLoading === 'skip'}
                  variant="outline"
                  className="w-full h-12 rounded-xl font-semibold border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm"
                >
                  <SkipForward className="h-4 w-4 mr-2" />
                  {actionLoading === 'skip' ? 'Skipping...' : 'Skip Patient'}
                </Button>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                  <Button
                    onClick={() => updateCounterStatus(selectedCounter, 'open')}
                    disabled={!selectedCounter}
                    variant="outline"
                    className="h-11 rounded-lg font-medium border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                  >
                    Open Counter
                  </Button>
                  <Button
                    onClick={() => updateCounterStatus(selectedCounter, 'closed')}
                    disabled={!selectedCounter}
                    variant="outline"
                    className="h-11 rounded-lg font-medium border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                  >
                    Close Counter
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card className="border-0 shadow-xl shadow-slate-200/50 rounded-2xl bg-white/90 backdrop-blur-sm ring-1 ring-slate-100 h-full">
            <CardHeader className="bg-gradient-to-b from-slate-50/50 to-white px-6 py-5 border-b border-slate-100 rounded-t-2xl">
              <CardTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Quick Stats
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-white border border-blue-100 rounded-xl shadow-sm">
                  <div className="flex items-center">
                    <div className="p-2 bg-blue-100 rounded-lg mr-3">
                      <Users className="h-4 w-4 text-blue-600" />
                    </div>
                    <span className="font-semibold text-slate-700">Total Waiting</span>
                  </div>
                  <span className="text-2xl font-black text-blue-700">{queue.length}</span>
                </div>

                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-emerald-50 to-white border border-emerald-100 rounded-xl shadow-sm">
                  <div className="flex items-center">
                    <div className="p-2 bg-emerald-100 rounded-lg mr-3">
                      <Phone className="h-4 w-4 text-emerald-600" />
                    </div>
                    <span className="font-semibold text-slate-700">Active Counters</span>
                  </div>
                  <span className="text-2xl font-black text-emerald-700">
                    {counters.filter(c => c.status === 'open').length}
                  </span>
                </div>

                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-amber-50 to-white border border-amber-100 rounded-xl shadow-sm">
                  <div className="flex items-center">
                    <div className="p-2 bg-amber-100 rounded-lg mr-3">
                      <Clock className="h-4 w-4 text-amber-600" />
                    </div>
                    <span className="font-semibold text-slate-700">Avg Wait Time</span>
                  </div>
                  <span className="text-2xl font-black text-amber-700">
                    {queue.length > 0 
                      ? Math.round(queue.reduce((sum, c) => sum + c.estimatedWaitTime, 0) / queue.length)
                      : 0
                    } <span className="text-sm font-bold text-amber-600/70">min</span>
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-6 mb-10">
          {/* Current Queue */}
          <Card className="border-0 shadow-xl shadow-slate-200/50 rounded-2xl bg-white/90 backdrop-blur-sm ring-1 ring-slate-100 overflow-hidden flex flex-col h-[500px]">
            <CardHeader className="bg-gradient-to-b from-slate-50/50 to-white px-6 py-5 border-b border-slate-100">
              <CardTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Users className="h-5 w-5 text-indigo-500" />
                Current Patients in Queue
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-y-auto bg-slate-50/30">
              <div className="p-4 space-y-3">
                {queue.length === 0 ? (
                  <div className="text-center py-16 text-slate-500 bg-white/50 rounded-2xl border border-dashed border-slate-200 mx-4 mt-4">
                    <Users className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                    <p className="font-medium text-slate-700">No patients currently waiting</p>
                  </div>
                ) : (
                  <AnimatePresence>
                  {queue.map((customer, index) => (
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      key={customer.id}
                      className="flex items-center justify-between p-4 bg-card border border-slate-200 rounded-xl shadow-sm hover:shadow-md hover:border-indigo-200 transition-all group"
                    >
                      <div className="flex items-center space-x-4">
                        <div className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider w-20 text-center shadow-sm ${
                          customer.priority === 'emergency' ? 'bg-red-100 text-red-700 border border-red-200' :
                           customer.priority === 'vip' ? 'bg-primary/10 text-primary border border-primary/20' :
                           customer.priority === 'elderly' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                          'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}>
                          {customer.priority}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{customer.name}</div>
                          <div className="text-xs font-semibold text-slate-500 mt-1 flex items-center gap-1">
                             <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                             {customer.serviceType}
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end gap-2">
                        <div className="text-xl font-black text-slate-800">#{customer.position}</div>
                        <div className="text-xs font-semibold text-slate-500 flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                          <Clock className="w-3 h-3" />
                          ~{customer.estimatedWaitTime} min
                        </div>
                        {customer.counterId && (
                          <Badge variant="outline" className="mt-1 bg-card shadow-sm border-slate-200 text-[10px] font-bold">
                            C{customer.counterId}
                          </Badge>
                        )}
                      </div>
                    </motion.div>
                  ))}
                  </AnimatePresence>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Transfer Customer */}
          <div className="flex flex-col gap-6">
            <Card className={`border-0 shadow-xl rounded-2xl ring-1 ring-slate-100 overflow-hidden transition-all duration-300 ${!selectedCounter ? 'opacity-50 blur-[1px] pointer-events-none' : 'bg-white/90 backdrop-blur-sm shadow-slate-200/50'}`}>
              <CardHeader className="bg-gradient-to-b from-slate-50/50 to-white px-6 py-5 border-b border-slate-100">
                <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <ArrowRightLeft className="h-5 w-5 text-fuchsia-500" />
                  Transfer Patient
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest ml-1 mb-1.5">
                        Transfer From
                      </label>
                      <Select value={selectedCounter} disabled>
                        <SelectTrigger className="rounded-xl h-11 bg-slate-50 border-slate-200 font-medium">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {counters.map((counter) => (
                            <SelectItem key={counter.id} value={counter.id}>
                              {counter.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest ml-1 mb-1.5">
                        Transfer To Target
                      </label>
                      <Select onValueChange={(toCounterId: string) => transferCustomer(selectedCounter, toCounterId)}>
                        <SelectTrigger className="rounded-xl h-11 border-slate-200 font-medium focus:ring-2 focus:ring-fuchsia-500/20 shadow-sm">
                          <SelectValue placeholder="Select target counter" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {counters
                            .filter(c => c.id !== selectedCounter)
                            .map((counter) => (
                              <SelectItem key={counter.id} value={counter.id} className="cursor-pointer rounded-lg">
                                {counter.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button
                    onClick={() => {
                      const toCounterId = counters.find(c => c.id !== selectedCounter)?.id;
                      if (toCounterId) transferCustomer(selectedCounter, toCounterId);
                    }}
                    disabled={actionLoading === 'transfer'}
                    className="w-full h-12 rounded-xl font-bold bg-gradient-to-r from-fuchsia-600 to-fuchsia-500 hover:shadow-lg hover:shadow-fuchsia-500/30 text-white transition-all shadow-md mt-4"
                  >
                    <ArrowRightLeft className="h-4 w-4 mr-2" />
                    {actionLoading === 'transfer' ? 'Transferring...' : 'Transfer Active Patient'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
