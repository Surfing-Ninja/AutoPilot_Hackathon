'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'

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

interface TraceStep {
  agent: string;
  step: string;
  status: string;
  latency_ms: number;
}

interface AgentResultPayload {
  agent_alias: string;
  status: string;
  latency_ms: number;
  payload: {
    chain_of_thought?: string[];
    source?: string;
    [key: string]: unknown;
  };
}

interface OrchestratorResult {
  success: boolean;
  system_command: string;
  unified_risk_score: number | null;
  routing_result?: { detail?: string; command?: string };
  orchestrator_decision?: Record<string, unknown>;
  agent_results?: Record<string, AgentResultPayload>;
  trace?: { total_latency_ms?: number; steps?: TraceStep[] };
}

const statusColor: Record<string, string> = {
  success: 'bg-emerald-500/10 text-emerald-600 border border-emerald-200',
  error: 'bg-red-500/10 text-red-600 border border-red-200',
  executed: 'bg-blue-500/10 text-blue-600 border border-blue-200',
}

export default function TracePage() {
  const [orchestratorResult, setOrchestratorResult] = useState<OrchestratorResult | null>(null);
  
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem('latestOrchestratorResult');
      if (saved) {
        try {
          setOrchestratorResult(JSON.parse(saved));
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, []);

  return (
    <motion.div className="space-y-6" variants={containerVariants} initial="hidden" animate="visible">
      <motion.div variants={itemVariants}>
        <h1 className="text-display-3 font-bold tracking-tight text-brand-navy lg:text-display-2">
          Live Execution Logs &amp; Trace
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Step-by-step reasoning from OP-01 through ORCH-01. Full AI transparency.
        </p>
      </motion.div>

      {orchestratorResult ? (
        <div className="space-y-6">
          {/* Summary banner */}
          <motion.div variants={itemVariants}>
            <Card className="bg-gradient-to-r from-brand-navy to-brand-purple text-white shadow-xl">
              <CardContent className="p-6 flex flex-wrap gap-8 items-center justify-between">
                <div>
                  <p className="text-sm text-white/70 uppercase tracking-wider font-semibold">Pipeline Result</p>
                  <p className="text-2xl font-bold mt-1">{orchestratorResult.system_command?.replace(/_/g, ' ')}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-white/70 uppercase tracking-wider font-semibold">Unified Risk Score</p>
                  <p className="text-3xl font-bold mt-1">{orchestratorResult.unified_risk_score ?? 'N/A'}<span className="text-lg text-white/60">/100</span></p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-white/70 uppercase tracking-wider font-semibold">Total Latency</p>
                  <p className="text-2xl font-bold mt-1">{orchestratorResult.trace?.total_latency_ms?.toFixed(0) ?? '—'} ms</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Execution Trace Steps */}
          <motion.div variants={itemVariants}>
            <h2 className="text-xl font-bold text-brand-navy mb-4">Execution Trace</h2>
            <div className="space-y-3">
              {orchestratorResult.trace?.steps?.map((step: TraceStep, idx: number) => (
                <Card key={idx} className="relative overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-brand-navy text-white text-sm font-bold">
                          {idx + 1}
                        </div>
                        <div>
                          <h3 className="font-bold text-base text-brand-navy">{step.agent}</h3>
                          <p className="text-sm text-muted-foreground">{step.step.replace(/_/g, ' ')}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${statusColor[step.status] || statusColor.success}`}>
                          {step.status}
                        </span>
                        <span className="text-sm font-mono text-muted-foreground w-20 text-right">{step.latency_ms} ms</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.div>

          {/* Agent Chain of Thought — The real AI transparency */}
          {orchestratorResult.agent_results && (
            <motion.div variants={itemVariants}>
              <h2 className="text-xl font-bold text-brand-navy mb-4">Agent Chain of Thought</h2>
              <div className="space-y-4">
                {Object.entries(orchestratorResult.agent_results).map(([key, agent]) => (
                  <Card key={key} className="overflow-hidden shadow-sm">
                    <div className="bg-slate-50 px-5 py-3 border-b flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${agent.status === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        <h3 className="font-bold text-brand-navy">{agent.agent_alias}</h3>
                      </div>
                      <span className="text-xs font-mono text-muted-foreground">{agent.latency_ms} ms</span>
                    </div>
                    <CardContent className="p-5">
                      {agent.payload?.chain_of_thought ? (
                        <div className="space-y-2">
                          {agent.payload.chain_of_thought.map((thought: string, i: number) => (
                            <div key={i} className="flex items-start gap-3">
                              <span className="text-brand-cornflower font-mono text-sm font-bold mt-0.5 shrink-0">
                                {String(i + 1).padStart(2, '0')}
                              </span>
                              <p className="text-sm text-slate-700">{thought}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">No chain of thought available for this agent.</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </motion.div>
          )}

          {/* Final Orchestrator Decision */}
          <motion.div variants={itemVariants}>
            <Card className="bg-slate-800 text-white shadow-xl">
              <CardContent className="p-6">
                <h3 className="font-bold text-lg mb-4 text-emerald-400">Final Governance Decision</h3>
                <pre className="text-xs overflow-x-auto p-4 bg-slate-900 rounded-lg leading-relaxed">
                  {JSON.stringify(orchestratorResult.orchestrator_decision, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      ) : (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <p className="text-lg font-medium text-slate-700 mb-2">No trace available</p>
            <p className="text-sm">Run the pipeline from the Dashboard first by clicking &quot;Analyze Pending Enterprise Deal&quot;.</p>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
