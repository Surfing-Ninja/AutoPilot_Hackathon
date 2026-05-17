'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, useInView } from 'framer-motion'
import apiClient from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CardWatermark } from '@/components/ui/card-watermark'
import { Icons } from '@/components/ui/icons'
import { ActivityChart } from '@/components/ActivityChart'
import { cn } from '@/lib/utils'

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
}

// Animated number component
function AnimatedNumber({
  value,
  suffix = '',
  duration = 1000,
}: {
  value: number
  suffix?: string
  duration?: number
}) {
  const [displayValue, setDisplayValue] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true, amount: 0.5 })
  const hasAnimated = useRef(false)

  useEffect(() => {
    if (!isInView || hasAnimated.current) return
    hasAnimated.current = true

    const startTime = performance.now()

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(2, -10 * progress)

      setDisplayValue(Math.round(eased * value))

      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        setDisplayValue(value)
      }
    }

    requestAnimationFrame(animate)
  }, [value, duration, isInView])

  const formatValue = (num: number): string => {
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K'
    }
    return num.toString()
  }

  return (
    <span ref={ref}>
      {formatValue(displayValue)}
      {suffix}
    </span>
  )
}

// Stats Card Component with Bento styling
interface StatCardProps {
  title: string
  value: number
  suffix?: string
  icon: React.ElementType
  trend?: { value: string; positive: boolean }
  colorClass: string
  delay?: number
}

function StatCard({
  title,
  value,
  suffix = '',
  icon: Icon,
  trend,
  colorClass,
  delay = 0,
}: StatCardProps) {
  return (
    <motion.div
      variants={itemVariants}
      initial='hidden'
      animate='visible'
      transition={{ delay }}
      whileHover={{ y: -4 }}
    >
      <Card className='group relative h-full cursor-default overflow-hidden'>
        {/* Branded watermark texture */}
        <CardWatermark opacity={3} scale={0.9} />
        <CardContent className='relative z-10 p-5'>
          <div className='flex items-start justify-between'>
            <div className='space-y-2'>
              {/* Micro label */}
              <p className='text-micro uppercase text-brand-muted transition-colors duration-200 group-hover:text-brand-cornflower'>
                {title}
              </p>
              {/* Display number */}
              <p className='font-display text-[2.25rem] font-bold leading-none tracking-tight text-brand-navy'>
                <AnimatedNumber value={value} suffix={suffix} />
              </p>
              {/* Trend */}
              {trend && (
                <motion.p
                  className={cn(
                    'flex items-center gap-1 text-xs font-medium',
                    trend.positive ? 'text-emerald-600' : 'text-red-500'
                  )}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: delay + 0.3 }}
                >
                  {trend.positive ? (
                    <Icons.trendingUp className='h-3 w-3' strokeWidth={2} />
                  ) : (
                    <Icons.trendingUp
                      className='h-3 w-3 rotate-180'
                      strokeWidth={2}
                    />
                  )}
                  {trend.value}
                </motion.p>
              )}
            </div>
            {/* Icon */}
            <motion.div
              className={cn(
                'rounded-xl p-2.5 text-white',
                'shadow-lg',
                colorClass
              )}
              whileHover={{ scale: 1.15, rotate: 5 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            >
              <Icon className='h-5 w-5' strokeWidth={1.5} />
            </motion.div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// Hero Section
function HeroSection({ userName }: { userName?: string }) {
  const firstName = userName?.split(' ')[0] || 'there'

  return (
    <motion.div
      className='col-span-12 py-2'
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <h1 className='text-display-3 font-bold tracking-tight text-brand-navy lg:text-display-2'>
        Where Intelligence <br className='hidden sm:block' />
        <span className='text-gradient'>Meets Human.</span>
      </h1>
      <p className='mt-4 text-lg font-light text-muted-foreground'>
        Welcome back, {firstName}. Your AI Command Center is ready.
      </p>
    </motion.div>
  )
}

// Diagnostics types
interface DiagCheck {
  name: string;
  status: 'healthy' | 'warning' | 'error' | 'info';
  detail: string;
  count?: number;
  timestamp?: string;
}

interface DiagResult {
  overall: string;
  checks: DiagCheck[];
  timestamp: string;
}

// Audit log type
interface AuditLogEntry {
  id: number;
  timestamp: string;
  actor_email: string | null;
  action: string;
  category: string;
  description: string;
  success: string;
  endpoint: string | null;
  http_method: string | null;
  response_status: number | null;
  response_time_ms: number | null;
  is_middleware: boolean;
}

const statusColors: Record<string, string> = {
  healthy: 'bg-emerald-500',
  warning: 'bg-amber-500',
  error: 'bg-red-500',
  info: 'bg-blue-500',
};

const statusBg: Record<string, string> = {
  healthy: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  error: 'bg-red-50 text-red-700 border-red-200',
  info: 'bg-blue-50 text-blue-700 border-blue-200',
};

const methodColors: Record<string, string> = {
  GET: 'bg-emerald-100 text-emerald-700',
  POST: 'bg-blue-100 text-blue-700',
  PUT: 'bg-amber-100 text-amber-700',
  DELETE: 'bg-red-100 text-red-700',
};

// Real System Diagnostics Card
function DiagnosticsCard() {
  const [diagResult, setDiagResult] = useState<DiagResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const runDiagnostics = async () => {
    setIsLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';
      const res = await fetch(`${apiUrl}/api/orchestrator/diagnostics`);
      const data = await res.json();
      setDiagResult(data);
    } catch (error) {
      setDiagResult({
        overall: 'error',
        checks: [{ name: 'Backend Connection', status: 'error', detail: error instanceof Error ? error.message : 'Failed to reach backend' }],
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className='relative col-span-12 lg:col-span-5 h-full overflow-hidden'>
      <CardWatermark opacity={3} scale={1.1} />
      <CardHeader className='relative z-10'>
        <CardTitle className='flex items-center gap-2'>
          <Icons.activity className='h-5 w-5 text-brand-cornflower' strokeWidth={1.5} />
          System Diagnostics
          {diagResult && (
            <span className={`ml-auto inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusBg[diagResult.overall] || statusBg.info}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${statusColors[diagResult.overall] || statusColors.info}`} />
              {diagResult.overall.toUpperCase()}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className='relative z-10 space-y-4'>
        <Button
          onClick={runDiagnostics}
          disabled={isLoading}
          variant='gradient'
          className='w-full'
        >
          {isLoading ? (
            <><span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />Running Diagnostics...</>
          ) : (
            <><Icons.activity className='mr-2 h-4 w-4' />Run System Diagnostics</>
          )}
        </Button>

        {diagResult && (
          <div className='space-y-1.5'>
            {diagResult.checks.map((check, i) => (
              <div key={i} className='flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-slate-50 transition-colors'>
                <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${statusColors[check.status] || 'bg-slate-400'}`} />
                <span className='text-sm font-medium text-brand-navy flex-1 truncate'>{check.name}</span>
                <span className='text-xs text-muted-foreground text-right max-w-[200px] truncate'>{check.detail}</span>
              </div>
            ))}
            <p className='text-[10px] text-muted-foreground text-right pt-1'>
              Last checked: {new Date(diagResult.timestamp).toLocaleTimeString()}
            </p>
          </div>
        )}

        {!diagResult && !isLoading && (
          <p className='text-sm text-muted-foreground text-center py-4'>
            Click above to run a live health check against the backend
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// Audit Logs Card
function AuditLogsCard() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';
      const res = await fetch(`${apiUrl}/api/orchestrator/audit-logs?limit=30`);
      const data = await res.json();
      setLogs(data.logs || []);
      setTotal(data.total || 0);
      setHasLoaded(true);
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <Card className='relative col-span-12 lg:col-span-7 h-full overflow-hidden'>
      <CardWatermark opacity={3} scale={1.1} />
      <CardHeader className='relative z-10'>
        <div className='flex items-center justify-between'>
          <CardTitle className='flex items-center gap-2'>
            <Icons.fileText className='h-5 w-5 text-brand-cornflower' strokeWidth={1.5} />
            Audit Logs
            {total > 0 && (
              <span className='ml-2 rounded-full bg-brand-navy/10 px-2.5 py-0.5 text-xs font-semibold text-brand-navy'>
                {total.toLocaleString()} total
              </span>
            )}
          </CardTitle>
          <Button onClick={fetchLogs} disabled={isLoading} variant='outline' size='sm'>
            {isLoading ? <Icons.loader className='h-4 w-4 animate-spin' /> : <Icons.arrowRight className='h-4 w-4' />}
            <span className='ml-1.5'>{hasLoaded ? 'Refresh' : 'Load Logs'}</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className='relative z-10'>
        {!hasLoaded && !isLoading ? (
          <div className='text-center py-8 text-muted-foreground'>
            <Icons.fileText className='mx-auto h-10 w-10 opacity-30 mb-3' />
            <p className='text-sm'>Trigger a pipeline or click Load Logs to see audit entries</p>
          </div>
        ) : isLoading ? (
          <div className='flex items-center justify-center py-8'>
            <Icons.loader className='h-6 w-6 animate-spin text-brand-cornflower' />
          </div>
        ) : logs.length === 0 ? (
          <div className='text-center py-8 text-muted-foreground'>
            <p className='text-sm'>No audit logs yet. Run a pipeline to generate entries.</p>
          </div>
        ) : (
          <div className='overflow-hidden rounded-lg border border-gray-100'>
            <div className='max-h-[400px] overflow-y-auto'>
              <table className='w-full text-left text-sm'>
                <thead className='sticky top-0 border-b border-gray-100 bg-gray-50/95 backdrop-blur'>
                  <tr>
                    <th className='px-3 py-2 text-xs font-medium text-gray-500'>Time</th>
                    <th className='px-3 py-2 text-xs font-medium text-gray-500'>Method</th>
                    <th className='px-3 py-2 text-xs font-medium text-gray-500'>Endpoint</th>
                    <th className='px-3 py-2 text-xs font-medium text-gray-500'>Status</th>
                    <th className='px-3 py-2 text-xs font-medium text-gray-500'>Latency</th>
                  </tr>
                </thead>
                <tbody className='divide-y divide-gray-50'>
                  {logs.map((log) => (
                    <tr key={log.id} className='hover:bg-gray-50/50 transition-colors'>
                      <td className='whitespace-nowrap px-3 py-2 text-xs text-gray-500 font-mono'>
                        {formatTime(log.timestamp)}
                      </td>
                      <td className='px-3 py-2'>
                        {log.http_method && (
                          <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold ${methodColors[log.http_method] || 'bg-gray-100 text-gray-700'}`}>
                            {log.http_method}
                          </span>
                        )}
                      </td>
                      <td className='px-3 py-2 text-xs text-gray-700 font-mono max-w-[220px] truncate' title={log.endpoint || log.description}>
                        {log.endpoint || log.description}
                      </td>
                      <td className='px-3 py-2'>
                        {log.response_status ? (
                          <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            log.response_status >= 500 ? 'bg-red-100 text-red-700' :
                            log.response_status >= 400 ? 'bg-amber-100 text-amber-700' :
                            'bg-emerald-100 text-emerald-700'
                          }`}>
                            {log.response_status}
                          </span>
                        ) : (
                          <span className={`text-xs ${log.success === 'true' ? 'text-emerald-600' : 'text-red-600'}`}>
                            {log.success === 'true' ? '✓' : '✗'}
                          </span>
                        )}
                      </td>
                      <td className='px-3 py-2 text-xs text-gray-500 font-mono'>
                        {log.response_time_ms ? `${log.response_time_ms.toFixed(0)}ms` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface TraceStep {
  agent: string;
  step: string;
  status: string;
  latency_ms: number;
}

interface AgentPayload {
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
  agent_results?: Record<string, AgentPayload>;
  trace?: { total_latency_ms?: number; steps?: TraceStep[] };
}

function WorkflowTrigger() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [orchestratorResult, setOrchestratorResult] = useState<OrchestratorResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'trace' | 'json'>('trace');

  // Load previous result from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("latestOrchestratorResult");
      if (saved) {
        try { setOrchestratorResult(JSON.parse(saved)); } catch (_e) { /* ignore */ }
      }
    }
  }, []);

  const runEnterpriseWorkflow = async () => {
      setIsProcessing(true);
      setError(null);
      
      const mockLeadData = {
          company_name: "Orion Retail Technologies Ltd",
          email_thread: "Client frustrated. Repeatedly asking for contract updates. High urgency.",
          contract_text: "Master Service Agreement... Value USD 185,000. Missing client signature for Michael Carter."
      };

      try {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';
          const response = await fetch(`${apiUrl}/api/orchestrator/process_lead`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(mockLeadData)
          });
          
          const data = await response.json();
          setOrchestratorResult(data);
          
          if (typeof window !== "undefined") {
              localStorage.setItem("latestOrchestratorResult", JSON.stringify(data));
          }
      } catch (err) {
          setError(err instanceof Error ? err.message : "Pipeline failed");
          console.error("Pipeline failed:", err);
      } finally {
          setIsProcessing(false);
      }
  };

  const commandColor: Record<string, string> = {
    ROUTE_TO_WORKBENCH: "from-red-500 to-rose-600",
    TRIGGER_SLACK_ESCALATION: "from-amber-500 to-orange-600",
    ROUTE_TO_CRM_AUTO: "from-emerald-500 to-green-600",
  };

  const statusDot: Record<string, string> = {
    success: "bg-emerald-500",
    error: "bg-red-500",
    executed: "bg-blue-500",
  };

  return (
    <div className="space-y-6">
      {/* Trigger Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-brand-navy via-brand-purple to-brand-cornflower p-8 shadow-xl">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDE4YzAtOS45NC04LjA2LTE4LTE4LTE4UzAgOC4wNiAwIDE4czguMDYgMTggMTggMTggMTgtOC4wNiAxOC0xOHoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-30" />
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Enterprise AI Orchestrator</h2>
            <p className="mt-1 text-white/70 text-sm">
              5-agent hub-and-spoke pipeline • OP1→OP3 parallel • OP4 risk • ORCH-01 governance
            </p>
          </div>
          <button
            onClick={runEnterpriseWorkflow}
            disabled={isProcessing}
            className="inline-flex items-center justify-center gap-3 rounded-xl bg-white px-8 py-4 text-brand-navy font-bold text-lg shadow-lg hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed shrink-0"
          >
            {isProcessing ? (
              <>
                <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-brand-navy border-t-transparent" />
                Executing Workforce...
              </>
            ) : (
              <>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Trigger Full Pipeline
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-700 text-sm">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Execution Flow */}
      {orchestratorResult && (
        <div className="space-y-4">
          {/* Result Summary */}
          <div className={`rounded-xl bg-gradient-to-r ${commandColor[orchestratorResult.system_command] || commandColor.ROUTE_TO_WORKBENCH} p-6 text-white shadow-lg`}>
            <div className="flex flex-wrap gap-6 items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-white/60 font-semibold">System Command</p>
                <p className="text-xl font-bold mt-1">{orchestratorResult.system_command?.replace(/_/g, ' ')}</p>
                <p className="text-sm text-white/80 mt-1">{orchestratorResult.routing_result?.detail}</p>
              </div>
              <div className="flex gap-6">
                <div className="text-center">
                  <p className="text-3xl font-bold">{orchestratorResult.unified_risk_score ?? '—'}</p>
                  <p className="text-xs text-white/60 uppercase tracking-wider">Risk Score</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold">{orchestratorResult.trace?.total_latency_ms?.toFixed(0) ?? '—'}</p>
                  <p className="text-xs text-white/60 uppercase tracking-wider">Latency (ms)</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tab Selection */}
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setActiveTab('trace')}
              className={`px-6 py-2.5 font-bold text-sm transition-all border-b-2 ${activeTab === 'trace' ? 'border-brand-purple text-brand-purple' : 'border-transparent text-muted-foreground hover:text-brand-navy'}`}
            >
              Execution Trace
            </button>
            <button
              onClick={() => setActiveTab('json')}
              className={`px-6 py-2.5 font-bold text-sm transition-all border-b-2 ${activeTab === 'json' ? 'border-brand-purple text-brand-purple' : 'border-transparent text-muted-foreground hover:text-brand-navy'}`}
            >
              Raw JSON Details
            </button>
          </div>

          {/* Conditional Content */}
          {activeTab === 'trace' ? (
            <div className="rounded-xl border bg-white p-6 shadow-sm">
              <h3 className="font-bold text-brand-navy text-lg mb-4">Execution Trace</h3>
              <div className="space-y-2">
                {orchestratorResult.trace?.steps?.map((step, idx) => (
                  <div key={idx} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-slate-50 transition-colors">
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusDot[step.status] || 'bg-slate-400'}`} />
                    <span className="font-semibold text-brand-navy text-sm w-40 shrink-0">{step.agent}</span>
                    <span className="text-sm text-muted-foreground flex-1">{step.step.replace(/_/g, ' ')}</span>
                    <span className="text-xs font-mono text-muted-foreground w-16 text-right">{step.latency_ms}ms</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${step.status === 'success' ? 'bg-emerald-100 text-emerald-700' : step.status === 'error' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                      {step.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border bg-slate-900 p-6 shadow-xl text-white">
              <h3 className="font-bold text-emerald-400 text-lg mb-4">Backend Response Payload</h3>
              <pre className="text-xs font-mono overflow-x-auto p-4 bg-slate-950 rounded-lg leading-relaxed max-h-96 overflow-y-auto">
                {JSON.stringify(orchestratorResult, null, 2)}
              </pre>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex gap-3">
            <a href="/ai/insights" className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border-2 border-brand-navy bg-white px-6 py-3 font-bold text-brand-navy hover:bg-brand-navy hover:text-white transition-all">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" /></svg>
              View Full Agent Trace
            </a>
            <a href="/workbench" className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border-2 border-red-500 bg-white px-6 py-3 font-bold text-red-600 hover:bg-red-500 hover:text-white transition-all">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Exception Queue
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

// Main Dashboard — no auth required, renders directly
export default function HomePage() {
  return (
    <motion.div
      className='space-y-6'
      variants={containerVariants}
      initial='hidden'
      animate='visible'
    >
      {/* Hero Section */}
      <HeroSection userName='Developer' />

      {/* Workflow Trigger */}
      <motion.div variants={itemVariants}>
        <WorkflowTrigger />
      </motion.div>

      {/* Stats Grid - Bento style */}
      <div className='grid grid-cols-2 gap-4 lg:grid-cols-4'>
        <StatCard
          title='Total Users'
          value={10400}
          icon={Icons.users}
          trend={{ value: '+12%', positive: true }}
          colorClass='bg-brand-navy'
          delay={0.1}
        />
        <StatCard
          title='Active Sessions'
          value={524}
          icon={Icons.activity}
          trend={{ value: '+8%', positive: true }}
          colorClass='bg-brand-cornflower'
          delay={0.2}
        />
        <StatCard
          title='Success Rate'
          value={98}
          suffix='%'
          icon={Icons.checkCircle}
          trend={{ value: '+2%', positive: true }}
          colorClass='bg-brand-purple'
          delay={0.3}
        />
        <StatCard
          title='AI Confidence'
          value={96}
          suffix='%'
          icon={Icons.sparkles}
          trend={{ value: 'Stable', positive: true }}
          colorClass='bg-gradient-to-br from-brand-navy to-brand-purple'
          delay={0.4}
        />
      </div>

      {/* Activity Chart - Full Width */}
      <motion.div variants={itemVariants}>
        <ActivityChart className='col-span-12' />
      </motion.div>

      {/* System Diagnostics & Audit Logs — Side by Side */}
      <motion.div
        className='grid gap-6 lg:grid-cols-12'
        variants={itemVariants}
      >
        <DiagnosticsCard />
        <AuditLogsCard />
      </motion.div>
    </motion.div>
  )
}
