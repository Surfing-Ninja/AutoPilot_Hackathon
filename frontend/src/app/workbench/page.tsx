'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/ui/icons'
import { apiClient } from '@/lib/api-client'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, x: -100, transition: { duration: 0.3 } },
}

interface OrchestratorResult {
  system_command: string;
  unified_risk_score: number | null;
  routing_result?: { detail?: string; command?: string };
  agent_results?: Record<string, {
    agent_alias: string;
    status: string;
    payload: {
      risk_assessment?: {
        risk_factors?: string[];
        risk_level?: string;
      };
      extraction?: {
        missing_fields?: string[];
        contract_value?: string;
      };
      analysis?: {
        sentiment?: string;
        urgency_level?: string;
      };
      [key: string]: unknown;
    };
  }>;
}

interface WorkbenchItemData {
  id: string;
  company_name: string;
  status: string;
  risk_factors: string[];
  missing_fields: string[];
  created_at: string;
  resolved_at: string | null;
  orchestratorResult: OrchestratorResult;
}

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

const statusTabs: { key: StatusFilter; label: string; icon: React.ElementType }[] = [
  { key: 'all', label: 'All Items', icon: Icons.layers },
  { key: 'pending', label: 'Pending Review', icon: Icons.clock },
  { key: 'approved', label: 'Approved', icon: Icons.checkCircle },
  { key: 'rejected', label: 'Rejected', icon: Icons.xCircle },
];

const statusBadge: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 border-amber-300',
  approved: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  rejected: 'bg-red-100 text-red-700 border-red-300',
};

const statusBorderColor: Record<string, string> = {
  pending: 'border-l-amber-500',
  approved: 'border-l-emerald-500',
  rejected: 'border-l-red-400',
};

export default function WorkbenchPage() {
  const [items, setItems] = useState<WorkbenchItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<StatusFilter>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const query = activeFilter === 'all' ? '' : `?status_filter=${activeFilter}`;
      const data = await apiClient.get<WorkbenchItemData[]>(`/api/orchestrator/workbench-items${query}`);
      setItems(data);
    } catch (e) {
      console.error("Failed to fetch workbench items:", e);
    } finally {
      setLoading(false);
    }
  }, [activeFilter]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      await apiClient.post(`/api/orchestrator/workbench-items/${id}/approve`);
      await fetchItems();
    } catch (e) {
      console.error("Failed to approve item:", e);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    setActionLoading(id);
    try {
      await apiClient.post(`/api/orchestrator/workbench-items/${id}/reject`);
      await fetchItems();
    } catch (e) {
      console.error("Failed to reject item:", e);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Permanently remove this item from the workbench?')) return;
    setActionLoading(id);
    try {
      await apiClient.delete(`/api/orchestrator/workbench-items/${id}`);
      await fetchItems();
    } catch (e) {
      console.error("Failed to delete item:", e);
    } finally {
      setActionLoading(null);
    }
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString([], {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const pendingCount = items.filter(i => i.status === 'pending').length;

  return (
    <motion.div
      className='space-y-8'
      variants={containerVariants}
      initial='hidden'
      animate='visible'
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className='text-display-3 font-bold tracking-tight text-brand-navy'>
              Workbench
            </h1>
            <p className='mt-2 text-lg text-muted-foreground'>
              Exception Queue — Human-in-the-loop review for AI-flagged items.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {pendingCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 border border-amber-300 px-3 py-1 text-sm font-semibold text-amber-700">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                {pendingCount} pending
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={fetchItems}
              disabled={loading}
            >
              {loading ? <Icons.loader className="h-4 w-4 animate-spin mr-1.5" /> : <Icons.arrowRight className="h-4 w-4 mr-1.5" />}
              Refresh
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Status Filter Tabs */}
      <motion.div variants={itemVariants}>
        <div className="flex border-b border-slate-200 gap-1">
          {statusTabs.map((tab) => {
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveFilter(tab.key)}
                className={`flex items-center gap-2 px-5 py-2.5 font-semibold text-sm transition-all border-b-2 ${
                  activeFilter === tab.key
                    ? 'border-brand-purple text-brand-purple'
                    : 'border-transparent text-muted-foreground hover:text-brand-navy'
                }`}
              >
                <TabIcon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* Items List */}
      <motion.div variants={itemVariants} className="space-y-4">
        {loading ? (
          <div className="text-center py-12">
            <Icons.loader className="mx-auto h-8 w-8 animate-spin text-brand-cornflower mb-4" />
            <p className="text-muted-foreground">Loading from database...</p>
          </div>
        ) : items.length > 0 ? (
          <AnimatePresence mode="popLayout">
            {items.map((item) => {
              const riskFactors = item.risk_factors || [];
              const missingFields = item.missing_fields || [];
              const orchestratorResult = item.orchestratorResult;
              const isPending = item.status === 'pending';
              const isItemLoading = actionLoading === item.id;

              return (
                <motion.div
                  key={item.id}
                  variants={itemVariants}
                  exit="exit"
                  layout
                >
                  <Card className={`border-l-4 ${statusBorderColor[item.status] || 'border-l-slate-300'} shadow-lg relative overflow-hidden`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <CardTitle className="text-brand-navy flex items-center gap-2 text-xl">
                          {item.status === 'pending' && <Icons.alertCircle className="h-5 w-5 text-amber-500" />}
                          {item.status === 'approved' && <Icons.checkCircle className="h-5 w-5 text-emerald-500" />}
                          {item.status === 'rejected' && <Icons.xCircle className="h-5 w-5 text-red-500" />}
                          {item.company_name}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <span className={`px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wider border ${statusBadge[item.status] || 'bg-slate-100 text-slate-600'}`}>
                            {item.status}
                          </span>
                        </div>
                      </div>
                      <CardDescription className="text-sm text-slate-500 mt-1">
                        Created: {formatTime(item.created_at)}
                        {item.resolved_at && <> • Resolved: {formatTime(item.resolved_at)}</>}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Risk Score */}
                      <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
                        <div className="text-center">
                          <p className={`text-3xl font-bold ${
                            (orchestratorResult?.unified_risk_score ?? 0) >= 70 ? 'text-red-600' :
                            (orchestratorResult?.unified_risk_score ?? 0) >= 40 ? 'text-amber-600' :
                            'text-emerald-600'
                          }`}>
                            {orchestratorResult?.unified_risk_score ?? '—'}
                          </p>
                          <p className="text-xs text-slate-500 uppercase font-semibold">Risk Score</p>
                        </div>
                        <div className="flex-1 h-3 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-yellow-400 via-orange-500 to-red-600 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(orchestratorResult?.unified_risk_score ?? 0, 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* Risk Factors */}
                      {riskFactors.length > 0 && (
                        <div>
                          <p className="text-sm font-semibold text-slate-700 mb-2">Risk Factors Identified:</p>
                          <ul className="space-y-1">
                            {riskFactors.map((factor: string, i: number) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                                <Icons.alertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                                {typeof factor === 'string' ? factor : JSON.stringify(factor)}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Missing Fields */}
                      {missingFields.length > 0 && (
                        <div>
                          <p className="text-sm font-semibold text-slate-700 mb-2">Missing Contract Fields:</p>
                          <ul className="space-y-1">
                            {missingFields.map((field: string, i: number) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                                <Icons.fileText className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                                {typeof field === 'string' ? field : JSON.stringify(field)}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex justify-between items-center pt-4 border-t border-slate-100 flex-wrap gap-3">
                        <div className="text-sm text-slate-500 font-medium">
                          Command: <span className="font-mono text-xs bg-slate-200 px-2 py-1 rounded text-slate-700">{orchestratorResult?.system_command || 'N/A'}</span>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          {isPending ? (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={isItemLoading}
                                onClick={() => handleReject(item.id)}
                                className="text-red-600 border-red-200 hover:bg-red-50"
                              >
                                {isItemLoading ? <Icons.loader className="h-4 w-4 animate-spin mr-1" /> : <Icons.xCircle className="h-4 w-4 mr-1" />}
                                Reject
                              </Button>
                              <Button
                                variant="default"
                                size="sm"
                                disabled={isItemLoading}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                                onClick={() => handleApprove(item.id)}
                              >
                                {isItemLoading ? <Icons.loader className="h-4 w-4 animate-spin mr-1" /> : <Icons.checkCircle className="h-4 w-4 mr-1" />}
                                Approve
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isItemLoading}
                              onClick={() => handleDelete(item.id)}
                              className="text-slate-500 hover:text-red-600 hover:border-red-200"
                            >
                              {isItemLoading ? <Icons.loader className="h-4 w-4 animate-spin mr-1" /> : <Icons.trash className="h-4 w-4 mr-1" />}
                              Remove
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        ) : (
          <Card>
            <CardContent className="p-16 text-center text-muted-foreground">
              <Icons.checkCircle className="mx-auto h-12 w-12 text-emerald-500 mb-4 opacity-50" />
              <p className="text-lg font-medium text-slate-700">
                {activeFilter === 'all' ? 'All clear!' : `No ${activeFilter} items`}
              </p>
              <p className="text-sm mt-1">
                {activeFilter === 'pending'
                  ? 'No items awaiting review. Run a pipeline from the Dashboard to generate exceptions.'
                  : activeFilter === 'all'
                    ? 'No exceptions in the database. Run a pipeline from the Dashboard to see results here.'
                    : `No items with status "${activeFilter}" found.`
                }
              </p>
            </CardContent>
          </Card>
        )}
      </motion.div>
    </motion.div>
  )
}
