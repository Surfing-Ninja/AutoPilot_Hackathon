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

// Diagnostics Card
function DiagnosticsCard() {
  const [apiResponse, setApiResponse] = useState<string>('')
  const [adminResponse, setAdminResponse] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)

  const callApi = async (
    endpoint: string,
    setter: React.Dispatch<React.SetStateAction<string>>
  ) => {
    setIsLoading(true)
    setter('Loading...')
    try {
      const data = await apiClient(endpoint)
      setter(JSON.stringify(data, null, 2))
    } catch (error) {
      setter(
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className='relative col-span-12 h-full overflow-hidden'>
      <CardWatermark opacity={3} scale={1.1} />
      <CardHeader className='relative z-10'>
        <CardTitle className='flex items-center gap-2'>
          <Icons.activity
            className='h-5 w-5 text-brand-cornflower'
            strokeWidth={1.5}
          />
          System Diagnostics
        </CardTitle>
      </CardHeader>
      <CardContent className='relative z-10 space-y-6'>
        <div className='space-y-3'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-sm font-medium text-foreground'>
                Standard Authorization
              </p>
              <p className='mt-0.5 font-mono text-xs text-muted-foreground'>
                /api/test
              </p>
            </div>
          </div>
          <Button
            onClick={() => callApi('/api/test', setApiResponse)}
            disabled={isLoading}
            variant='outline'
            className='w-full'
          >
            {isLoading ? 'Running...' : 'Run Diagnostics'}
          </Button>
          {apiResponse && (
            <div className='rounded-xl border border-border/50 bg-muted/30 p-4'>
              <pre className='overflow-x-auto font-mono text-xs text-muted-foreground'>
                <code>{apiResponse}</code>
              </pre>
            </div>
          )}
        </div>

        <div className='h-px bg-border/50' />

        <div className='space-y-3'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-sm font-medium text-foreground'>
                Admin Verification
              </p>
              <p className='mt-0.5 font-mono text-xs text-muted-foreground'>
                /api/admin/dashboard
              </p>
            </div>
          </div>
          <Button
            onClick={() => callApi('/api/admin/dashboard', setAdminResponse)}
            disabled={isLoading}
            variant='gradient'
            className='w-full'
          >
            {isLoading ? 'Verifying...' : 'Verify Admin Access'}
            <Icons.arrowRight className='ml-2 h-4 w-4' />
          </Button>
          {adminResponse && (
            <div className='rounded-xl border border-border/50 bg-muted/30 p-4'>
              <pre className='overflow-x-auto font-mono text-xs text-muted-foreground'>
                <code>{adminResponse}</code>
              </pre>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
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

          {/* Trace Timeline */}
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

      {/* System Diagnostics */}
      <motion.div
        className='grid gap-6 lg:grid-cols-12'
        variants={itemVariants}
      >
        <DiagnosticsCard />
      </motion.div>
    </motion.div>
  )
}
