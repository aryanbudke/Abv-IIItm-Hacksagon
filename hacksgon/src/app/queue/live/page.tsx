"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Clock, AlertTriangle, TrendingUp, Activity, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

interface QueueCustomer {
  id: string;
  name: string;
  priority: 'emergency' | 'vip' | 'elderly' | 'regular';
  arrivalTime: string;
  estimatedWaitTime: number;
  serviceType: string;
  position?: number;
}

interface Counter {
  id: string;
  name: string;
  status: 'open' | 'closed' | 'busy';
  currentCustomerId?: string;
  queueLength: number;
  averageServiceTime: number;
}

interface QueueMetrics {
  totalCustomers: number;
  averageWaitTime: number;
  longestWaitTime: number;
  customersServedPerHour: number;
  queueLength: number;
  serviceRate: number;
}

export default function LiveQueuePage() {
  const [queue, setQueue] = useState<QueueCustomer[]>([]);
  const [counters, setCounters] = useState<Counter[]>([]);
  const [metrics, setMetrics] = useState<QueueMetrics | null>(null);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState('default');

  useEffect(() => {
    const fetchQueueStatus = async () => {
      try {
        const response = await fetch(`/api/queue/status?locationId=${selectedLocation}`);
        const data = await response.json();
        
        if (data.success) {
          setQueue(data.data.queue);
          setCounters(data.data.counters);
          setMetrics(data.data.metrics);
          setRecommendations(data.data.recommendations);
        }
      } catch (error) {
        console.error('Error fetching queue status:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchQueueStatus();
    
    // Set up real-time updates
    const interval = setInterval(fetchQueueStatus, 5000); // Update every 5 seconds
    
    return () => clearInterval(interval);
  }, [selectedLocation]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'emergency': return 'bg-red-500';
      case 'vip': return 'bg-primary';
      case 'elderly': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'emergency': return { text: 'Emergency', color: 'destructive' };
      case 'vip': return { text: 'VIP', color: 'default' };
      case 'elderly': return { text: 'Elderly', color: 'secondary' };
      default: return { text: 'Regular', color: 'outline' };
    }
  };

  const formatWaitTime = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading queue status...</p>
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
          className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-[#2563EB] rounded-full mix-blend-multiply filter blur-[100px] opacity-10"
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
              Platform Status
            </h1>
            <div className="w-24"></div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
          <div>
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">Live Queue Status</h2>
            <p className="text-slate-500 text-lg">Real-time monitoring of all facility queues</p>
          </div>
          <div className="flex items-center space-x-4 bg-white/60 backdrop-blur-md p-2 rounded-2xl border border-slate-200 shadow-sm">
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="px-4 py-2 border-0 bg-transparent text-slate-700 font-medium focus:ring-0 cursor-pointer outline-none"
            >
              <option value="default">Main Location</option>
              <option value="branch1">Branch 1</option>
              <option value="branch2">Branch 2</option>
            </select>
            <div className="flex items-center px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-bold border border-emerald-100">
              <span className="relative flex h-2 w-2 mr-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Live Sync
            </div>
          </div>
        </div>

        {/* Metrics Overview */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
              <Card className="border-0 shadow-lg shadow-blue-500/10 hover:shadow-xl hover:shadow-blue-500/20 rounded-2xl bg-white/90 backdrop-blur-sm transition-all hover:-translate-y-1">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-blue-50 rounded-xl">
                      <Users className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                  <div>
                    <div className="text-4xl font-bold text-slate-900 tracking-tight mb-1">{metrics.totalCustomers}</div>
                    <p className="text-sm font-medium text-slate-500">Total in Queue</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
              <Card className="border-0 shadow-lg shadow-orange-500/10 hover:shadow-xl hover:shadow-orange-500/20 rounded-2xl bg-white/90 backdrop-blur-sm transition-all hover:-translate-y-1">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-orange-50 rounded-xl">
                      <Clock className="h-6 w-6 text-orange-600" />
                    </div>
                  </div>
                  <div>
                    <div className="text-4xl font-bold text-slate-900 tracking-tight mb-1">{formatWaitTime(metrics.averageWaitTime)}</div>
                    <p className="text-sm font-medium text-slate-500">Avg Wait Time</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.3 }}>
              <Card className="border-0 shadow-lg shadow-emerald-500/10 hover:shadow-xl hover:shadow-emerald-500/20 rounded-2xl bg-white/90 backdrop-blur-sm transition-all hover:-translate-y-1">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-emerald-50 rounded-xl">
                      <TrendingUp className="h-6 w-6 text-emerald-600" />
                    </div>
                  </div>
                  <div>
                    <div className="text-4xl font-bold text-slate-900 tracking-tight mb-1">{metrics.customersServedPerHour} <span className="text-xl font-medium text-slate-500">/hr</span></div>
                    <p className="text-sm font-medium text-slate-500">Service Rate</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.4 }}>
              <Card className="border-0 shadow-lg shadow-red-500/10 hover:shadow-xl hover:shadow-red-500/20 rounded-2xl bg-white/90 backdrop-blur-sm transition-all hover:-translate-y-1">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-red-50 rounded-xl">
                      <AlertTriangle className="h-6 w-6 text-red-600" />
                    </div>
                  </div>
                  <div>
                    <div className="text-4xl font-bold text-slate-900 tracking-tight mb-1">{formatWaitTime(metrics.longestWaitTime)}</div>
                    <p className="text-sm font-medium text-slate-500">Longest Wait</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        )}

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-orange-600">
                <AlertTriangle className="h-5 w-5 mr-2" />
                Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {recommendations.map((rec, index) => (
                  <li key={index} className="flex items-center p-3 bg-orange-50 rounded-lg">
                    <div className="w-2 h-2 bg-orange-400 rounded-full mr-3"></div>
                    <span className="text-orange-800">{rec}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
          {/* Queue List */}
          <Card className="border-0 shadow-xl shadow-slate-200/50 rounded-2xl bg-white/90 backdrop-blur-sm ring-1 ring-slate-100 overflow-hidden flex flex-col h-[600px]">
            <CardHeader className="bg-gradient-to-b from-slate-50/50 to-white px-6 py-5 border-b border-slate-100">
              <CardTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                Current Queue List
              </CardTitle>
              <CardDescription className="text-slate-500 mt-1">Live updates of patients waiting</CardDescription>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-y-auto bg-slate-50/30">
              <div className="divide-y divide-slate-100 p-4 space-y-3">
                {queue.length === 0 ? (
                  <div className="text-center py-16 text-slate-500">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Users className="h-8 w-8 text-slate-300" />
                    </div>
                    <p className="text-lg font-medium text-slate-700">No customers in queue</p>
                    <p className="text-sm text-slate-500 mt-1">Ready for new arrivals</p>
                  </div>
                ) : (
                  <AnimatePresence>
                  {queue.map((customer, index) => {
                    const badge = getPriorityBadge(customer.priority);
                    return (
                      <motion.div
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        key={customer.id}
                        className="flex items-center justify-between p-4 bg-card border border-slate-200 rounded-xl shadow-sm hover:shadow-md hover:border-blue-200 transition-all group"
                      >
                        <div className="flex items-center space-x-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-sm ${
                            customer.priority === 'emergency' ? 'bg-red-100 text-red-700' :
                            index === 0 ? 'bg-blue-600 text-white shadow-blue-500/30 border border-blue-500' :
                            'bg-slate-50 text-slate-700 border border-slate-200'
                          }`}>
                            #{index + 1}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{customer.name}</div>
                            <div className="text-xs font-medium text-slate-500 mt-0.5">{customer.serviceType}</div>
                          </div>
                        </div>
                        <div className="text-right flex flex-col items-end gap-2">
                          <Badge variant={badge.color as any} className={`text-[10px] uppercase font-bold tracking-wider ${
                            badge.color === 'destructive' ? 'bg-red-50 text-red-700 border-red-200' :
                            badge.color === 'default' ? 'bg-primary/10 text-primary border-primary/20' :
                            badge.color === 'secondary' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            'bg-slate-50 text-slate-600 border-slate-200'
                          }`}>
                            {badge.text}
                          </Badge>
                          <div className="text-xs font-medium text-slate-500 flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-md">
                            <Clock className="w-3 h-3" />
                            ~{formatWaitTime(customer.estimatedWaitTime)}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                  </AnimatePresence>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Counters */}
          <Card className="border-0 shadow-xl shadow-slate-200/50 rounded-2xl bg-white/90 backdrop-blur-sm ring-1 ring-slate-100 overflow-hidden flex flex-col h-[600px]">
            <CardHeader className="bg-gradient-to-b from-slate-50/50 to-white px-6 py-5 border-b border-slate-100">
              <CardTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Activity className="h-5 w-5 text-emerald-600" />
                Service Counters
              </CardTitle>
              <CardDescription className="text-slate-500 mt-1">Status of individual active counters</CardDescription>
            </CardHeader>
            <CardContent className="p-6 overflow-y-auto">
              <div className="grid grid-cols-1 gap-4">
                {counters.map((counter, i) => (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.1 }}
                    key={counter.id}
                    className={`p-5 rounded-xl border relative overflow-hidden transition-all hover:shadow-md ${
                      counter.status === 'open'
                        ? 'border-emerald-200 bg-gradient-to-br from-white to-emerald-50/50 shadow-sm'
                        : counter.status === 'busy'
                        ? 'border-amber-200 bg-gradient-to-br from-white to-amber-50/50 shadow-sm'
                        : 'border-rose-200 bg-gradient-to-br from-white to-rose-50/50 opacity-75'
                    }`}
                  >
                    {counter.status === 'busy' && (
                       <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />
                    )}
                    {counter.status === 'open' && (
                       <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
                    )}
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-slate-900 text-lg tracking-tight">{counter.name}</h3>
                      <Badge
                        variant={counter.status === 'open' ? 'default' : counter.status === 'busy' ? 'secondary' : 'destructive'}
                        className={`text-[10px] uppercase font-bold tracking-wider ${
                           counter.status === 'open' ? 'bg-emerald-100 text-emerald-700 border-none' :
                           counter.status === 'busy' ? 'bg-amber-100 text-amber-700 border-none' :
                           'bg-rose-100 text-rose-700 border-none'
                        }`}
                      >
                        {counter.status}
                      </Badge>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-2 rounded-lg bg-card shadow-sm border border-slate-100">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Queue Length</span>
                        <span className="font-bold text-slate-900">{counter.queueLength} waiting</span>
                      </div>
                      <div className="flex justify-between items-center p-2 rounded-lg bg-card shadow-sm border border-slate-100">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Service Time</span>
                        <span className="font-bold text-slate-900">{counter.averageServiceTime} min avg</span>
                      </div>
                      {counter.currentCustomerId && (
                        <div className="flex justify-between items-center p-2 rounded-lg bg-emerald-50 shadow-sm border border-emerald-100 mt-2">
                          <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide flex items-center gap-1">
                             <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                             Status
                          </span>
                          <span className="font-bold text-emerald-700">Currently Serving</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
