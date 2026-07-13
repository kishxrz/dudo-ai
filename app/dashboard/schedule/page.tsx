'use client';

import { useState, useEffect } from 'react';
import { Clock, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useWorkspace } from '@/hooks/useWorkspace';

// Core UI components
import { PageLayout } from '@/components/ui/PageLayout';
import { Modal } from '@/components/ui/Modal';

function LocalEmptyState({ icon: Icon, title, description }: { icon: any, title: string, description: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center h-[160px] border border-zinc-200/80 rounded-xl bg-white select-none px-6 py-4">
      {Icon && (
        <div className="w-9 h-9 rounded-full bg-zinc-50 flex items-center justify-center mb-2.5 text-zinc-400">
          <Icon size={16} />
        </div>
      )}
      <h3 className="text-[15px] font-semibold text-zinc-900 leading-tight">
        {title}
      </h3>
      <p className="text-[13px] text-zinc-500 mt-1.5 max-w-lg leading-relaxed font-normal">
        {description}
      </p>
    </div>
  );
}

export default function SchedulesPage() {
  const { workspaceId } = useWorkspace();
  const [jobs, setJobs] = useState<{ name: string; rule: string; active: boolean }[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [jobName, setJobName] = useState('');
  const [jobRule, setJobRule] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkPlan() {
      if (!workspaceId) { setLoading(false); return; }
      try {
        const { canUseFeature } = await import('@/lib/billing-entitlements');
        const allowed = await canUseFeature(workspaceId, 'booking');
        setIsLocked(!allowed);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }

    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem('__dudo_dev_scheduled_jobs');
      if (raw) {
        try {
          setJobs(JSON.parse(raw));
        } catch (e) {}
      }
    }
    checkPlan();
  }, [workspaceId]);

  if (loading) {
    return (
      <PageLayout className="max-w-[1200px] w-full mx-auto px-6 py-6 flex items-center justify-center min-h-[400px]">
        <div className="w-5 h-5 rounded-full border-2 border-[#22577A] border-t-transparent animate-spin" />
      </PageLayout>
    );
  }

  if (isLocked) {
    return (
      <PageLayout className="max-w-[1200px] w-full mx-auto px-6 py-12 flex flex-col justify-center items-center min-h-[450px]">
        <div className="flex flex-col items-center justify-center text-center p-8 bg-white border border-zinc-200 rounded-2xl max-w-md shadow-sm gap-4">
          <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-lg text-amber-500 font-bold">
            🔒
          </div>
          <h2 className="text-lg font-bold text-zinc-900 leading-none">Upgrade to Unlock Schedules</h2>
          <p className="text-xs text-zinc-500 leading-normal">
            Schedules and automated task running are only available on the Monthly Plan or 6-Month Pack.
          </p>
          <Link href="/dashboard/billing" className="no-underline">
            <Button className="h-9 px-4.5 bg-[#22577A] hover:bg-[#1A4461] text-white font-bold rounded-xl text-xs border-none cursor-pointer">
              Go to Billing
            </Button>
          </Link>
        </div>
      </PageLayout>
    );
  }

  const handleAddJob = () => {
    if (!jobName.trim() || !jobRule.trim()) return;
    const newJob = { name: jobName.trim(), rule: jobRule.trim(), active: true };
    const updated = [...jobs, newJob];
    setJobs(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('__dudo_dev_scheduled_jobs', JSON.stringify(updated));
    }
    setJobName('');
    setJobRule('');
    setShowModal(false);
  };

  const handleToggleActive = (index: number) => {
    const updated = jobs.map((j, i) => i === index ? { ...j, active: !j.active } : j);
    setJobs(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('__dudo_dev_scheduled_jobs', JSON.stringify(updated));
    }
  };

  const handleDeleteJob = (index: number) => {
    const updated = jobs.filter((_, i) => i !== index);
    setJobs(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('__dudo_dev_scheduled_jobs', JSON.stringify(updated));
    }
  };

  return (
    <PageLayout className="max-w-[1150px] w-full text-left mx-auto gap-5 px-6 box-border">
      {/* 1. Custom Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200/50 pb-5 text-left">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#22577A]/10 flex items-center justify-center shrink-0 text-[#22577A] mt-1">
            <Clock size={20} />
          </div>
          <div>
            <h1 className="text-[24px] font-bold text-zinc-950 tracking-tight leading-none mb-2">
              Scheduled Jobs
            </h1>
            <p className="text-sm text-zinc-500 max-w-2xl leading-relaxed">
              Automate recurring AI tasks - daily digests, follow-ups, reports
            </p>
          </div>
        </div>
        
        <Button
          onClick={() => setShowModal(true)}
          className="h-8.5 px-3.5 bg-[#22577A] hover:bg-[#1A4461] text-white font-semibold rounded-xl shadow-sm text-xs cursor-pointer flex items-center gap-1.5 border-none transition-all shrink-0 hover:scale-[1.01] active:scale-99"
        >
          <Plus size={14} />
          New Job
        </Button>
      </div>

      {/* 2. Main Content Card container */}
      <div className="bg-white border border-zinc-200/60 rounded-xl p-4 shadow-xs text-left mt-2">
        {jobs.length === 0 ? (
          <LocalEmptyState
            icon={Clock}
            title="No scheduled jobs yet"
            description="Create one here or ask your AI agent: 'Remind me at 9:30 AM daily'"
          />
        ) : (
          <div className="space-y-3">
            <h4 className="text-[14px] font-semibold text-zinc-800 mb-2.5">Configure Jobs</h4>
            <div className="space-y-2.5">
              {jobs.map((job, index) => (
                <div 
                  key={index} 
                  className={cn(
                    "flex items-center justify-between border rounded-xl p-3 transition-all",
                    job.active ? "bg-white border-zinc-200/60 shadow-xs" : "bg-zinc-50/50 border-zinc-200/40 opacity-70"
                  )}
                >
                  <div>
                    <div className="text-[13.5px] font-semibold text-zinc-950">{job.name}</div>
                    <div className="text-xs text-zinc-400 mt-1 flex items-center gap-1.5 font-normal select-none">
                      <Clock size={12} className="text-zinc-400" />
                      {job.rule}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 select-none">
                    <button
                      onClick={() => handleToggleActive(index)}
                      className={cn(
                        "h-7 px-2.5 text-[11px] font-semibold rounded-lg border cursor-pointer transition-all flex items-center gap-1 leading-none",
                        job.active 
                          ? "bg-emerald-50 text-emerald-600 border-emerald-200/65 hover:bg-emerald-100/50" 
                          : "bg-zinc-100 text-zinc-500 border-zinc-200/60 hover:bg-zinc-200/50"
                      )}
                    >
                      <span className={cn(
                        "w-1.5 h-1.5 rounded-full shrink-0",
                        job.active ? "bg-emerald-500" : "bg-zinc-400"
                      )} />
                      {job.active ? "Active" : "Disabled"}
                    </button>

                    <button
                      onClick={() => handleDeleteJob(index)}
                      className="w-7 h-7 rounded-lg hover:bg-zinc-50 text-zinc-400 hover:text-red-600 flex items-center justify-center cursor-pointer border-none bg-transparent transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 3. Create Modal overlay */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Create Scheduled Job"
        className="max-w-md"
      >
        <div className="space-y-4 text-left">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-600">Job Name</label>
            <input
              type="text"
              value={jobName}
              onChange={(e) => setJobName(e.target.value)}
              placeholder="e.g. Daily Leads Digest"
              className="w-full bg-white border border-zinc-200 text-zinc-800 placeholder:text-zinc-400 rounded-xl px-3.5 py-2.5 text-sm font-normal outline-none focus:border-[#DBA11A] transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-600">Schedule / Rule</label>
            <input
              type="text"
              value={jobRule}
              onChange={(e) => setJobRule(e.target.value)}
              placeholder="e.g. 9:30 AM daily or Weekly on Friday"
              className="w-full bg-white border border-zinc-200 text-zinc-800 placeholder:text-zinc-400 rounded-xl px-3.5 py-2.5 text-sm font-normal outline-none focus:border-[#DBA11A] transition-colors"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 select-none">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="h-10 text-sm px-4 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-medium border-none cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <Button
              onClick={handleAddJob}
              className="h-10 text-sm px-4 rounded-xl bg-[#22577A] hover:bg-[#1A4461] text-white font-medium border-none cursor-pointer transition-all hover:scale-[1.01]"
            >
              Create Job
            </Button>
          </div>
        </div>
      </Modal>

    </PageLayout>
  );
}
