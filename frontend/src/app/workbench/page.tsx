'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
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
    transition: { staggerChildren: 0.1 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
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
  orchestratorResult: OrchestratorResult;
}

export default function WorkbenchPage() {
  const [items, setItems] = useState<WorkbenchItemData[]>([]);
  const [loading, setLoading] = useState(true);
  
  const fetchItems = async () => {
    try {
      const data = await apiClient.get<WorkbenchItemData[]>('/api/orchestrator/workbench-items');
      setItems(data);
    } catch (e) {
      console.error("Failed to fetch workbench items:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleApprove = async (id: string) => {
    try {
      await apiClient.post(`/api/orchestrator/workbench-items/${id}/approve`);
      // Remove item from UI or refetch
      await fetchItems();
    } catch (e) {
      console.error("Failed to approve item:", e);
    }
  };

  return (
    <motion.div
      className='space-y-8'
      variants={containerVariants}
      initial='hidden'
      animate='visible'
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <h1 className='text-display-3 font-bold tracking-tight text-brand-navy'>
          Workbench
        </h1>
        <p className='mt-2 text-lg text-muted-foreground'>
          Exception Queue — Human-in-the-loop review for AI-flagged items.
        </p>
      </motion.div>

      {/* Exception Cards */}
      <motion.div variants={itemVariants} className="space-y-4">
        {loading ? (
          <div className="text-center py-12">
            <Icons.loader className="mx-auto h-8 w-8 animate-spin text-brand-cornflower mb-4" />
            <p className="text-muted-foreground">Loading exceptions from Database...</p>
          </div>
        ) : items.length > 0 ? (
          items.map((item) => {
            const riskFactors = item.risk_factors || [];
            const missingFields = item.missing_fields || [];
            const orchestratorResult = item.orchestratorResult;

            return (
              <Card key={item.id} className="border-l-4 border-red-500 shadow-xl relative overflow-hidden mb-6">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-red-600 flex items-center gap-2 text-xl">
                      <Icons.alertCircle className="h-6 w-6" />
                      [URGENT REVIEW] {item.company_name}
                    </CardTitle>
                    <span className="px-3 py-1 text-xs font-bold bg-red-100 text-red-700 rounded-full uppercase tracking-wider">
                      High Risk
                    </span>
                  </div>
                  <CardDescription className="text-base text-slate-600 mt-2">
                    Deal flagged by AI Governance due to multiple risk indicators.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Risk Score */}
                  <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-red-600">{orchestratorResult?.unified_risk_score ?? '—'}</p>
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
                            {factor}
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
                            {field}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                    <div className="text-sm text-slate-500 font-medium">
                      Command: <span className="font-mono text-xs bg-slate-200 px-2 py-1 rounded text-slate-700">{orchestratorResult?.system_command}</span>
                    </div>
                    <div className="space-x-3">
                      <Button variant="outline" onClick={() => window.location.href = '/ai/insights'}>
                        View Full Trace
                      </Button>
                      <Button
                        variant="default"
                        className="bg-red-600 hover:bg-red-700 text-white font-bold"
                        onClick={() => handleApprove(item.id)}
                      >
                        Override &amp; Approve
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card>
            <CardContent className="p-16 text-center text-muted-foreground">
              <Icons.checkCircle className="mx-auto h-12 w-12 text-emerald-500 mb-4 opacity-50" />
              <p className="text-lg font-medium text-slate-700">All clear!</p>
              <p className="text-sm">No exceptions currently in the database. Run a pipeline from the Dashboard to see results here.</p>
            </CardContent>
          </Card>
        )}
      </motion.div>
    </motion.div>
  )
}
