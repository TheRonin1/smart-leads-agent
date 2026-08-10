/* Signal Ledger: light editorial enterprise UI; data first, amber signals, explainable interactions.
 * Wired to the real Express/Mongo backend (/api/vacancies, /api/leads/:id, /api/pitch/:hoardingId/:customerId).
 * Every number shown here is either fetched directly or derived deterministically from what was fetched —
 * no invented figures, in line with the rest of this project. */
import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  Activity, ArrowDownUp, ArrowUpRight, BarChart3, Bell, Building2, CalendarDays, Check, ChevronDown,
  ChevronRight, Copy, Filter, Flame, LayoutDashboard, MapPin, Menu, MessageSquareText,
  PanelLeftClose, PanelLeftOpen, Search, Send, Settings, Sparkles, Target, TrendingUp, Users, WalletCards, X, Zap,
} from "lucide-react";
import { toast } from "sonner";
import {
  getLeads, getPitch, getVacancies,
  type LeadDTO, type LeadsResponse, type PitchResponse, type VacancyDTO,
} from "@/api/client";

const USER_NAME = "Yash";
const USER_INITIALS = USER_NAME.slice(0, 2).toUpperCase();

const money = (n: number) => `₹${(n / 100000).toFixed(2)}L`;

// The backend doesn't compute a "priority" field — this derives one from the site's real
// rate-card category, which is already the closest proxy for how much attention a vacancy deserves.
const PRIORITY_FOR_CATEGORY: Record<VacancyDTO["category"], "High" | "Medium" | "Low"> = {
  Premium: "High", Standard: "Medium", Budget: "Low",
};

function daysAgoFromReasons(leads: LeadDTO[], customerId: string): string {
  const lead = leads.find(l => l.customer_id === customerId);
  const match = lead?.reasons.find(r => r.includes("last contacted"))?.match(/last contacted (\d+) days ago/);
  return match ? `${match[1]} days ago` : "—";
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#10233f] shadow-[0_8px_18px_rgba(16,35,63,.22)]">
        <Sparkles size={16} className="text-[#f5b544]" />
      </div>
      {!compact && (
        <div>
          <div className="text-[15px] font-extrabold tracking-[-.03em] text-[#10233f]">Smart Leads</div>
          <div className="font-mono text-[9px] font-semibold uppercase tracking-[.18em] text-[#7890aa]">Agent / OOH</div>
        </div>
      )}
    </div>
  );
}

function Pill({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "amber" | "blue" | "green" }) {
  const styles = {
    slate: "bg-[#f3f6f9] text-[#5c6f83]", amber: "bg-[#fff5dc] text-[#976b11]",
    blue: "bg-[#eaf2ff] text-[#2f62b8]", green: "bg-[#e8f8f1] text-[#287d5d]",
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[.08em] ${styles[tone]}`}>{children}</span>;
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[11px] font-semibold text-[#61738a]"><span>{label}</span><span className="font-mono text-[#1b3150]">{value}%</span></div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[#e7edf3]"><div className="h-full rounded-full bg-[#3f74d8] transition-all duration-500" style={{ width: `${value}%` }} /></div>
    </div>
  );
}

function buildPitchText(customerName: string, p: PitchResponse, tone: string, length: string, channel: string) {
  const firstName = customerName.split(" ")[0];
  const greeting =
    tone === "Friendly" ? `Hi ${firstName} team,\n\nI wanted to share a strong outdoor opportunity for your next campaign.`
    : tone === "Persuasive" ? `Hi ${firstName} team,\n\nThis is a high-conviction opportunity worth acting on quickly.`
    : `Hi ${firstName} team,\n\nWe have a ${p.site_facts.category.toLowerCase()} ${p.site_facts.size} hoarding available in ${p.site_facts.location}.`;

  const { past_bookings, past_value, booked_this_site_before } = p.customer_history;
  const historyLine = past_bookings > 0
    ? `Over ${past_bookings} past booking${past_bookings > 1 ? "s" : ""} with us worth ₹${past_value.toLocaleString("en-IN")} total${booked_this_site_before ? ", including this exact site before" : ""}.`
    : `We'd love to welcome you as a new hoarding partner.`;

  const rateLine = p.discount_pct > 0
    ? `Rate-card price is ₹${p.rate_card_base.toLocaleString("en-IN")}/month — we can offer ₹${p.suggested_rate.toLocaleString("en-IN")}/month (${p.discount_pct}% off card).`
    : `Rate-card price for this site is ₹${p.rate_card_base.toLocaleString("en-IN")}/month.`;

  const detail = length === "Detailed"
    ? ` The site carries a traffic score of ${p.site_facts.traffic_score}/100 in a high-visibility corridor.`
    : "";

  const closing =
    channel === "WhatsApp" ? "Let us know here if you'd like to lock this in before it's offered elsewhere."
    : channel === "LinkedIn" ? "Happy to share more details if this is of interest — let's connect."
    : "Let us know if you'd like to lock this in before it's offered elsewhere.";

  const body = length === "Short"
    ? `\n\n${rateLine} Traffic score ${p.site_facts.traffic_score}/100.\n\n${closing}`
    : `\n\n${historyLine}${detail}\n\n${rateLine}\n\n${closing}`;

  return greeting + body;
}

type ViewName = "Dashboard" | "Vacancies" | "Leads" | "Analytics" | "AI Pitch Studio";

export default function Home() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [view, setView] = useState<ViewName>("Dashboard");

  const [vacancyData, setVacancyData] = useState<Awaited<ReturnType<typeof getVacancies>> | null>(null);
  const [vacanciesError, setVacanciesError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [leadsByHoarding, setLeadsByHoarding] = useState<Record<string, LeadsResponse>>({});
  const [leadsLoading, setLeadsLoading] = useState(false);

  const [drawer, setDrawer] = useState(false);
  const [expanded, setExpanded] = useState(0);
  const [compare, setCompare] = useState(false);
  const [compareRates, setCompareRates] = useState<Record<string, PitchResponse | "loading">>({});

  const [pitchOpen, setPitchOpen] = useState(false);
  const [pitchLoading, setPitchLoading] = useState(false);
  const [pitchData, setPitchData] = useState<PitchResponse | null>(null);
  const [pitchCustomer, setPitchCustomer] = useState<{ id: string; name: string } | null>(null);
  const [pitchText, setPitchText] = useState("");
  const [tone, setTone] = useState("Professional");
  const [length, setLength] = useState("Medium");
  const [channel, setChannel] = useState("Email");

  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState("All");
  const [sort, setSort] = useState("Soonest vacancy");

  // Used by the standalone Leads / AI Pitch Studio pages, so a hoarding can be picked
  // without going through the Dashboard drawer first. Reuses the same leadsByHoarding
  // cache and getLeads() fetch as the rest of the app — no separate data path.
  const [pickerHoardingId, setPickerHoardingId] = useState<string | null>(null);
  const [studioHoardingId, setStudioHoardingId] = useState<string | null>(null);
  const [studioCustomerId, setStudioCustomerId] = useState<string | null>(null);

  function ensureLeadsLoaded(hoardingId: string) {
    if (leadsByHoarding[hoardingId]) return;
    getLeads(hoardingId)
      .then(data => setLeadsByHoarding(prev => ({ ...prev, [hoardingId]: data })))
      .catch(() => toast.error("Could not load ranked leads for this site"));
  }

  // Initial load: vacancies, then leads for the soonest one (also used for the AI insight panel)
  useEffect(() => {
    getVacancies()
      .then(data => {
        setVacancyData(data);
        if (data.vacancies.length > 0) setSelectedId(data.vacancies[0].hoarding_id);
      })
      .catch(() => setVacanciesError("Could not reach the API. Is the backend running on :5000?"));
  }, []);

  useEffect(() => {
    if (!selectedId || leadsByHoarding[selectedId]) return;
    setLeadsLoading(true);
    getLeads(selectedId)
      .then(data => setLeadsByHoarding(prev => ({ ...prev, [selectedId]: data })))
      .catch(() => toast.error("Could not load ranked leads for this site"))
      .finally(() => setLeadsLoading(false));
  }, [selectedId, leadsByHoarding]);

  const vacancies = vacancyData?.vacancies ?? [];
  const selected = vacancies.find(v => v.hoarding_id === selectedId) ?? null;
  const selectedLeads = selectedId ? leadsByHoarding[selectedId] : undefined;
  const topInsightLeads = vacancies[0] ? leadsByHoarding[vacancies[0].hoarding_id] : undefined;

  const filtered = useMemo(() => {
    return [...vacancies]
      .filter(v => {
        const p = PRIORITY_FOR_CATEGORY[v.category];
        const haystack = `${v.hoarding_id} ${v.location} ${v.last_booking.customer_id} ${v.category}`.toLowerCase();
        return (!query || haystack.includes(query.toLowerCase())) && (priority === "All" || priority === p);
      })
      .sort((a, b) =>
        sort === "Highest revenue at risk" ? b.revenue_at_risk_per_month - a.revenue_at_risk_per_month
        : sort === "Highest traffic" ? b.traffic_score - a.traffic_score
        : sort === "Highest priority" ? ({ High: 0, Medium: 1, Low: 2 }[PRIORITY_FOR_CATEGORY[a.category]] - { High: 0, Medium: 1, Low: 2 }[PRIORITY_FOR_CATEGORY[b.category]])
        : a.days_until_vacant - b.days_until_vacant
      );
  }, [vacancies, query, priority, sort]);

  // Real aggregates, computed from whatever the API actually returned — no fabricated history.
  const byCategory = useMemo(() => {
    const buckets: Record<string, { category: string; count: number; risk: number }> = {};
    for (const v of vacancies) {
      buckets[v.category] ??= { category: v.category, count: 0, risk: 0 };
      buckets[v.category].count += 1;
      buckets[v.category].risk += v.revenue_at_risk_per_month;
    }
    return Object.values(buckets);
  }, [vacancies]);

  const highPriorityCount = vacancies.filter(v => PRIORITY_FOR_CATEGORY[v.category] === "High").length;
  const urgentCount = vacancies.filter(v => v.days_until_vacant <= 14).length;
  const avgMatchForSelected = selectedLeads ? Math.round((selectedLeads.leads.reduce((s, l) => s + l.score, 0) / (selectedLeads.leads.length || 1)) * 100) : null;
  const qualifiedForSelected = selectedLeads ? selectedLeads.candidates_considered - selectedLeads.candidates_excluded_on_budget : null;
  const coldForSelected = selectedLeads ? selectedLeads.leads.filter(l => l.is_cold_relationship).length : 0;

  function openOpportunity(v: VacancyDTO) {
    setSelectedId(v.hoarding_id);
    setDrawer(true);
    setExpanded(0);
  }

  function generatePitch(hoardingId: string, customer: { id: string; name: string }) {
    setPitchCustomer(customer);
    setPitchData(null);
    setPitchLoading(true);
    setPitchOpen(true);
    getPitch(hoardingId, customer.id)
      .then(data => {
        setPitchData(data);
        setPitchText(buildPitchText(customer.name, data, tone, length, channel));
      })
      .catch(() => toast.error("Could not generate a pitch for this lead"))
      .finally(() => setPitchLoading(false));
  }

  // Tone/length/channel only re-render the phrasing wrapper around already-fetched, grounded facts —
  // they never trigger a new network call, so the rate/history figures never drift from the API response.
  useEffect(() => {
    if (pitchData && pitchCustomer) setPitchText(buildPitchText(pitchCustomer.name, pitchData, tone, length, channel));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tone, length, channel]);

  function openCompare() {
    setCompare(true);
    if (!selectedLeads) return;
    for (const lead of selectedLeads.leads) {
      if (compareRates[lead.customer_id]) continue;
      setCompareRates(prev => ({ ...prev, [lead.customer_id]: "loading" }));
      getPitch(selectedLeads.hoarding.hoarding_id, lead.customer_id)
        .then(data => setCompareRates(prev => ({ ...prev, [lead.customer_id]: data })))
        .catch(() => setCompareRates(prev => { const next = { ...prev }; delete next[lead.customer_id]; return next; }));
    }
  }

  const nav: { icon: typeof LayoutDashboard; label: ViewName }[] = [
    { icon: LayoutDashboard, label: "Dashboard" },
    { icon: CalendarDays, label: "Vacancies" },
    { icon: Users, label: "Leads" },
    { icon: BarChart3, label: "Analytics" },
    { icon: Sparkles, label: "AI Pitch Studio" },
  ];

  if (vacanciesError) {
    return <div className="grid min-h-screen place-items-center bg-[#f6f8fb] p-8 text-center text-[13px] text-[#7c8fa2]">{vacanciesError}</div>;
  }

  return (
    <div className="min-h-screen bg-[#f6f8fb] text-[#172b46]">
      <aside className={`${collapsed ? "w-[76px]" : "w-[246px]"} fixed inset-y-0 left-0 z-40 hidden border-r border-[#e5ebf1] bg-[#fbfcfd] transition-all duration-300 lg:flex lg:flex-col`}>
        <div className="flex h-[76px] items-center px-5">{collapsed ? <Logo compact /> : <Logo />}</div>
        <div className="px-3 pt-5">
          <div className={`mb-3 px-3 font-mono text-[9px] font-bold uppercase tracking-[.18em] text-[#9aaabd] ${collapsed ? "text-center" : ""}`}>{collapsed ? "···" : "Workspace"}</div>
          {nav.map(({ icon: Icon, label }) => {
            const active = view === label;
            return (
              <button key={label} onClick={() => setView(label)}
                className={`group mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[12px] font-bold transition ${active ? "bg-[#eaf2ff] text-[#2f62b8]" : "text-[#6a7c91] hover:bg-[#f0f4f8] hover:text-[#263f5e]"}`}>
                <Icon size={17} strokeWidth={active ? 2.4 : 1.8} />{!collapsed && <span>{label}</span>}{active && !collapsed && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#3f74d8]" />}
              </button>
            );
          })}
        </div>
        <div className="mt-auto px-3 pb-4">
          <button onClick={() => toast.info("Settings will be connected to your workspace preferences")}
            className={`mb-4 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[12px] font-bold text-[#6a7c91] hover:bg-[#f0f4f8] ${collapsed ? "justify-center" : ""}`}>
            <Settings size={17} />{!collapsed && "Settings"}
          </button>
          <div className={`border-t border-[#e8edf2] pt-4 ${collapsed ? "text-center" : ""}`}>
            <div className="flex items-center gap-3 px-2">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#dbe8f9] text-[11px] font-extrabold text-[#2f62b8]">{USER_INITIALS}</div>
              {!collapsed && <div><div className="text-[11px] font-extrabold">{USER_NAME}</div><div className="mt-0.5 flex items-center gap-1 font-mono text-[9px] text-[#8494a6]"><span className="h-1.5 w-1.5 rounded-full bg-[#35b985]" /> Sales Intelligence</div></div>}
            </div>
          </div>
        </div>
      </aside>

      {mobileNav && (
        <div className="fixed inset-0 z-50 bg-[#10233f]/25 lg:hidden" onClick={() => setMobileNav(false)}>
          <div className="h-full w-[260px] bg-[#fbfcfd] p-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-2 py-3"><Logo /><button onClick={() => setMobileNav(false)}><X size={18} /></button></div>
            {nav.map(({ icon: Icon, label }) => {
              const active = view === label;
              return (
                <button key={label} onClick={() => { setMobileNav(false); setView(label); }}
                  className={`mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[12px] font-bold ${active ? "bg-[#eaf2ff] text-[#2f62b8]" : "text-[#6a7c91]"}`}>
                  <Icon size={17} />{label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <main className={`${collapsed ? "lg:pl-[76px]" : "lg:pl-[246px]"} min-h-screen transition-all duration-300`}>
        <header className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b border-[#e5ebf1] bg-[#fbfcfd]/90 px-5 backdrop-blur-xl lg:px-8">
          <div className="flex items-center gap-3">
            <button className="lg:hidden" onClick={() => setMobileNav(true)}><Menu size={20} /></button>
            <button className="hidden rounded-lg p-2 text-[#71849a] hover:bg-[#edf2f7] lg:block" onClick={() => setCollapsed(!collapsed)}>{collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}</button>
            <div>
              <div className="font-mono text-[9px] font-bold uppercase tracking-[.2em] text-[#91a0b0]">{vacancyData ? `As of ${vacancyData.reference_date}` : "Loading…"}</div>
              <h1 className="mt-1 text-[18px] font-extrabold tracking-[-.03em] text-[#10233f]">Good morning, {USER_NAME} <span className="text-[#f0b238]">.</span></h1>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden items-center gap-2 rounded-xl border border-[#e2e8ef] bg-white px-3 py-2 sm:flex">
              <Search size={15} className="text-[#8da0b3]" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search vacancies, accounts..." className="w-[165px] bg-transparent text-[11px] outline-none placeholder:text-[#a7b3c0]" />
            </div>
            <div className="hidden items-center gap-2 rounded-xl border border-[#e2e8ef] bg-white px-3 py-2 md:flex"><CalendarDays size={14} className="text-[#6e86a1]" /><span className="text-[11px] font-bold">Next 90 days</span></div>
            <button className="relative rounded-xl border border-[#e2e8ef] bg-white p-2.5 text-[#6d8095] hover:bg-[#f1f5f8]" onClick={() => toast.info("You are all caught up")}><Bell size={16} /><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#f0b238]" /></button>
            <div className="hidden h-8 w-8 place-items-center rounded-full bg-[#dbe8f9] text-[10px] font-extrabold text-[#2f62b8] sm:grid">{USER_INITIALS}</div>
          </div>
        </header>

        {view === "Dashboard" && (
        <div className="relative overflow-hidden px-5 py-7 lg:px-8">
          <div className="relative mx-auto max-w-[1460px]">
            <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#35b985] opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-[#35b985]" /></span>
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[.16em] text-[#44856d]">API: {vacancyData ? "Connected" : "Connecting…"}</span>
                </div>
                <h2 className="text-[28px] font-extrabold tracking-[-.055em] text-[#10233f] sm:text-[34px]">Your next best conversations<br className="hidden sm:block" /> are already here.</h2>
                <p className="mt-2 max-w-[530px] text-[12px] leading-6 text-[#708197]">A focused view of the vacancies, accounts, and reasons that matter most to your pipeline this quarter.</p>
              </div>
              {vacancies[0] && (
                <button onClick={() => { const top = topInsightLeads?.leads[0]; if (top) generatePitch(vacancies[0].hoarding_id, { id: top.customer_id, name: top.name }); else { setSelectedId(vacancies[0].hoarding_id); toast.info("Loading leads for the top opportunity…"); } }}
                  className="flex items-center gap-2 rounded-xl bg-[#10233f] px-4 py-3 text-[11px] font-extrabold text-white shadow-[0_10px_24px_rgba(16,35,63,.18)] transition hover:-translate-y-0.5 hover:bg-[#19375e]">
                  <Sparkles size={15} className="text-[#f5b544]" /> Open Pitch Studio <ArrowUpRight size={14} />
                </button>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { icon: CalendarDays, label: "Upcoming Vacancies", value: vacancyData ? String(vacancyData.count) : "—", sub: "Next 90 days", tone: "blue" as const },
                { icon: WalletCards, label: "Revenue at Risk", value: vacancyData ? money(vacancyData.total_revenue_at_risk_per_month) : "—", sub: "Total monthly exposure", tone: "amber" as const },
                { icon: Target, label: "Qualified Leads", value: qualifiedForSelected ?? "—", sub: selected ? `Budget-fit for ${selected.location}` : "Select a site", tone: "green" as const },
                { icon: Activity, label: "Avg. Match (Top 3)", value: avgMatchForSelected !== null ? `${avgMatchForSelected}%` : "—", sub: selected ? `For ${selected.location}` : "Select a site", tone: "blue" as const },
              ].map(({ icon: Icon, label, value, sub, tone: t }) => (
                <div key={label} className="group rounded-2xl border border-[#e5ebf1] bg-white/85 p-4 shadow-[0_8px_24px_rgba(32,63,93,.035)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(32,63,93,.09)]">
                  <div className="flex items-start justify-between">
                    <div className={`grid h-9 w-9 place-items-center rounded-xl ${t === "amber" ? "bg-[#fff5dc] text-[#bd8618]" : t === "green" ? "bg-[#e8f8f1] text-[#2b9b70]" : "bg-[#eaf2ff] text-[#3f74d8]"}`}><Icon size={17} /></div>
                  </div>
                  <div className="mt-5 font-mono text-[28px] font-bold tracking-[-.06em] text-[#10233f]">{value}</div>
                  <div className="mt-1 text-[11px] font-extrabold text-[#4e627a]">{label}</div>
                  <div className="mt-1 text-[10px] text-[#9aa8b7]">{sub}</div>
                </div>
              ))}
            </div>

            <div className="mt-7 grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,.65fr)]">
              <section className="min-w-0">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2"><h3 className="text-[16px] font-extrabold tracking-[-.03em]">Upcoming vacancies</h3><Pill tone="blue">{vacancyData ? `${vacancyData.count} live` : "…"}</Pill></div>
                    <p className="mt-1 text-[11px] text-[#8b9bad]">Prioritized by timing, revenue exposure, and audience demand.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setQuery(""); setPriority("All"); }} className="hidden items-center gap-1.5 rounded-lg px-2 py-2 text-[10px] font-bold text-[#73869b] hover:bg-white sm:flex"><Filter size={13} /> Clear filters</button>
                    <select value={sort} onChange={e => setSort(e.target.value)} className="rounded-lg border border-[#e1e8ef] bg-white px-2.5 py-2 text-[10px] font-bold text-[#5f7288] outline-none">
                      <option>Soonest vacancy</option><option>Highest revenue at risk</option><option>Highest traffic</option><option>Highest priority</option>
                    </select>
                  </div>
                </div>
                <div className="mb-4 flex flex-wrap gap-2">
                  <div className="flex items-center gap-2 rounded-lg border border-[#e1e8ef] bg-white px-2.5 py-2 sm:hidden"><Search size={13} className="text-[#8da0b3]" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search..." className="w-28 bg-transparent text-[10px] outline-none" /></div>
                  {["All", "High", "Medium", "Low"].map(p => (
                    <button key={p} onClick={() => setPriority(p)} className={`rounded-full px-3 py-1.5 text-[10px] font-bold transition ${priority === p ? "bg-[#10233f] text-white" : "bg-white text-[#7c8fa3] hover:bg-[#edf2f7]"}`}>{p === "All" ? "All priorities" : `${p} priority`}</button>
                  ))}
                </div>

                {!vacancyData && <div className="rounded-2xl border border-[#e5ebf1] bg-white p-8 text-center text-[12px] text-[#8b9bad]">Loading vacancies…</div>}

                <div className="space-y-3">
                  {filtered.map(v => {
                    const p = PRIORITY_FOR_CATEGORY[v.category];
                    return (
                      <div key={v.hoarding_id} className="group relative overflow-hidden rounded-2xl border border-[#e5ebf1] bg-white p-4 shadow-[0_6px_20px_rgba(32,63,93,.035)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(32,63,93,.08)]">
                        <div className={`absolute inset-y-0 left-0 w-1 ${p === "High" ? "bg-[#f5b544]" : p === "Medium" ? "bg-[#7aa9e9]" : "bg-[#b7c5d1]"}`} />
                        <div className="flex flex-wrap items-start justify-between gap-3 pl-2">
                          <div className="flex min-w-0 items-start gap-3">
                            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#edf3f8] text-[#65809c]"><Building2 size={17} /></div>
                            <div>
                              <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-[12px] font-bold text-[#203b5e]">{v.hoarding_id}</span><Pill tone={p === "High" ? "amber" : p === "Medium" ? "blue" : "slate"}>{p}</Pill><Pill tone="slate">{v.category}</Pill></div>
                              <div className="mt-1 flex items-center gap-1.5 text-[12px] font-bold text-[#334d69]"><MapPin size={12} className="text-[#7393b7]" />{v.location}<span className="font-normal text-[#a2afbc]">·</span><span className="font-normal text-[#8495a7]">{v.size}</span></div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-mono text-[15px] font-bold text-[#172e4c]">{money(v.monthly_rate)}<span className="font-sans text-[10px] font-medium text-[#91a0b0]"> / mo</span></div>
                            <div className="mt-1 font-mono text-[9px] font-bold uppercase tracking-[.1em] text-[#a1adba]">{v.already_vacant ? "already vacant" : `${v.days_until_vacant} days remaining`}</div>
                          </div>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[#edf1f4] pt-3 sm:grid-cols-4">
                          <div><div className="font-mono text-[9px] uppercase tracking-[.1em] text-[#9ba9b7]">Traffic score</div><div className="mt-1 flex items-center gap-2"><span className="font-mono text-[12px] font-bold text-[#284b73]">{v.traffic_score}</span><div className="h-1.5 w-14 rounded-full bg-[#e7edf3]"><div className="h-full rounded-full bg-[#3f74d8]" style={{ width: `${v.traffic_score}%` }} /></div></div></div>
                          <div><div className="font-mono text-[9px] uppercase tracking-[.1em] text-[#9ba9b7]">Current customer</div><div className="mt-1 text-[11px] font-bold text-[#455c75]">{v.last_booking.customer_id}</div></div>
                          <div><div className="font-mono text-[9px] uppercase tracking-[.1em] text-[#9ba9b7]">Free from</div><div className="mt-1 text-[11px] font-bold text-[#455c75]">{v.free_from}</div></div>
                          <div><div className="font-mono text-[9px] uppercase tracking-[.1em] text-[#9ba9b7]">Revenue at risk</div><div className="mt-1 text-[11px] font-extrabold text-[#b17816]">{money(v.revenue_at_risk_per_month)} / mo</div></div>
                        </div>
                        <div className="mt-4 flex justify-end gap-2">
                          <button onClick={() => openOpportunity(v)} className="flex items-center gap-1.5 rounded-lg bg-[#10233f] px-3 py-2 text-[10px] font-extrabold text-white transition hover:bg-[#1d416e]">View opportunity <ChevronRight size={13} /></button>
                          <button onClick={() => openOpportunity(v)} className="flex items-center gap-1.5 rounded-lg border border-[#dce5ed] bg-white px-3 py-2 text-[10px] font-extrabold text-[#58718e] hover:bg-[#f5f8fa]"><Users size={13} /> Find leads</button>
                        </div>
                      </div>
                    );
                  })}
                  {vacancyData && filtered.length === 0 && <div className="rounded-2xl border border-[#e5ebf1] bg-white p-8 text-center text-[12px] text-[#8b9bad]">No vacancies match these filters.</div>}
                </div>
              </section>

              <aside className="space-y-5">
                <div className="overflow-hidden rounded-2xl bg-[#10233f] p-5 text-white shadow-[0_12px_32px_rgba(16,35,63,.16)]">
                  <div className="mb-5 flex items-center justify-between">
                    <div className="flex items-center gap-2"><div className="grid h-8 w-8 place-items-center rounded-lg bg-[#23456f]"><Sparkles size={15} className="text-[#f5b544]" /></div><div><div className="text-[12px] font-extrabold">AI Opportunity Insight</div><div className="font-mono text-[9px] uppercase tracking-[.12em] text-[#8da9c8]">Model signal / live</div></div></div>
                    {topInsightLeads?.leads[0] && <span className="font-mono text-[10px] font-bold text-[#f5b544]">{Math.round(topInsightLeads.leads[0].score * 100)}% match</span>}
                  </div>
                  {vacancies[0] && topInsightLeads?.leads[0] ? (
                    <>
                      <div className="border-l-2 border-[#f5b544] pl-3">
                        <div className="font-mono text-[10px] font-bold uppercase tracking-[.14em] text-[#91b4dc]">Best opportunity</div>
                        <div className="mt-1 text-[24px] font-extrabold tracking-[-.05em]">{topInsightLeads.leads[0].name} <span className="text-[#f5b544]">/ {vacancies[0].hoarding_id}</span></div>
                      </div>
                      <p className="mt-4 text-[11px] leading-6 text-[#b9cbe0]">{topInsightLeads.leads[0].reasons[0]}</p>
                      <button onClick={() => openOpportunity(vacancies[0])} className="mt-5 flex items-center gap-2 text-[10px] font-extrabold text-[#f5b544] hover:text-white">See why {topInsightLeads.leads[0].name} is #1 <ArrowUpRight size={13} /></button>
                    </>
                  ) : (
                    <p className="text-[11px] leading-6 text-[#b9cbe0]">Scoring the top opportunity…</p>
                  )}
                </div>

                <div className="rounded-2xl border border-[#e5ebf1] bg-white p-5">
                  <div className="flex items-center justify-between"><div><h3 className="text-[14px] font-extrabold">Revenue at risk by category</h3><p className="mt-1 text-[10px] text-[#93a1af]">Monthly exposure · ₹L, current snapshot</p></div><div className="rounded-lg bg-[#fff5dc] p-2 text-[#bd8618]"><TrendingUp size={15} /></div></div>
                  <div className="mt-4 h-[150px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={byCategory.map(b => ({ category: b.category, value: Number((b.risk / 100000).toFixed(1)) }))}>
                        <defs><linearGradient id="fillRisk" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#4c83df" stopOpacity={.22} /><stop offset="100%" stopColor="#4c83df" stopOpacity={0} /></linearGradient></defs>
                        <CartesianGrid vertical={false} stroke="#edf1f4" />
                        <XAxis dataKey="category" tick={{ fontSize: 9, fill: "#97a7b7" }} axisLine={false} tickLine={false} />
                        <YAxis hide />
                        <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #e5ebf1", fontSize: 11 }} formatter={(v: number) => [`₹${v}L`, "Exposure"]} />
                        <Area type="monotone" dataKey="value" stroke="#3f74d8" strokeWidth={2} fill="url(#fillRisk)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </aside>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <div className="rounded-2xl border border-[#e5ebf1] bg-white p-5">
                <div className="flex items-center justify-between"><div><h3 className="text-[14px] font-extrabold">Vacancies by category</h3><p className="mt-1 text-[10px] text-[#93a1af]">Current pipeline, grouped by rate-card tier</p></div><BarChart3 size={16} className="text-[#7894b4]" /></div>
                <div className="mt-5 h-[165px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={byCategory.map(b => ({ category: b.category, count: b.count }))} barSize={28}>
                      <CartesianGrid vertical={false} stroke="#edf1f4" />
                      <XAxis dataKey="category" tick={{ fontSize: 9, fill: "#97a7b7" }} axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <Tooltip cursor={{ fill: "#f8fafc" }} contentStyle={{ borderRadius: 10, border: "1px solid #e5ebf1", fontSize: 11 }} />
                      <Bar dataKey="count" fill="#87aee2" radius={[5, 5, 2, 2]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="rounded-2xl border border-[#e5ebf1] bg-white p-5">
                <div className="flex items-center justify-between"><div><h3 className="text-[14px] font-extrabold">Pipeline pulse</h3><p className="mt-1 text-[10px] text-[#93a1af]">What needs your attention today</p></div><Pill tone="green">Healthy</Pill></div>
                <div className="mt-5 space-y-3">
                  {[
                    { icon: Flame, title: `${highPriorityCount} high-priority sites`, text: "Premium sites — worth a first conversation this week", tone: "amber" as const },
                    { icon: CalendarDays, title: `${urgentCount} vacant within 14 days`, text: "Sites falling vacant soonest across the pipeline", tone: "blue" as const },
                    { icon: MessageSquareText, title: `${coldForSelected} cold relationships`, text: selected ? `Among top leads for ${selected.location}` : "Select a site to see cold leads", tone: "green" as const },
                  ].map(({ icon: Icon, title, text, tone: t }) => (
                    <button key={title} onClick={() => toast.info(text)} className="flex w-full items-center gap-3 rounded-xl bg-[#f8fafc] p-3 text-left transition hover:bg-[#f0f5fa]">
                      <div className={`grid h-8 w-8 place-items-center rounded-lg ${t === "amber" ? "bg-[#fff5dc] text-[#bd8618]" : t === "green" ? "bg-[#e8f8f1] text-[#2b9b70]" : "bg-[#eaf2ff] text-[#3f74d8]"}`}><Icon size={14} /></div>
                      <div><div className="text-[11px] font-extrabold text-[#334d69]">{title}</div><div className="mt-0.5 text-[10px] text-[#8b9bad]">{text}</div></div>
                      <ChevronRight size={14} className="ml-auto text-[#a2afbd]" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
        )}

        {view === "Vacancies" && (
          <div className="px-5 py-7 lg:px-8">
            <div className="mx-auto max-w-[1460px]">
              <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2"><h2 className="text-[22px] font-extrabold tracking-[-.03em] text-[#10233f]">All vacancies</h2><Pill tone="blue">{vacancyData ? `${vacancyData.count} live` : "…"}</Pill></div>
                  <p className="mt-1 text-[12px] text-[#8b9bad]">Every hoarding already vacant or going vacant in the next 90 days, straight from the API.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2 rounded-lg border border-[#e1e8ef] bg-white px-2.5 py-2"><Search size={13} className="text-[#8da0b3]" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search..." className="w-36 bg-transparent text-[10.5px] outline-none" /></div>
                  <select value={sort} onChange={e => setSort(e.target.value)} className="rounded-lg border border-[#e1e8ef] bg-white px-2.5 py-2 text-[10.5px] font-bold text-[#5f7288] outline-none">
                    <option>Soonest vacancy</option><option>Highest revenue at risk</option><option>Highest traffic</option><option>Highest priority</option>
                  </select>
                </div>
              </div>
              <div className="mb-4 flex flex-wrap gap-2">
                {["All", "High", "Medium", "Low"].map(p => (
                  <button key={p} onClick={() => setPriority(p)} className={`rounded-full px-3 py-1.5 text-[10px] font-bold transition ${priority === p ? "bg-[#10233f] text-white" : "bg-white text-[#7c8fa3] hover:bg-[#edf2f7]"}`}>{p === "All" ? "All priorities" : `${p} priority`}</button>
                ))}
              </div>
              {!vacancyData && <div className="rounded-2xl border border-[#e5ebf1] bg-white p-8 text-center text-[12px] text-[#8b9bad]">Loading vacancies…</div>}
              <div className="grid gap-3 lg:grid-cols-2">
                {filtered.map(v => {
                  const p = PRIORITY_FOR_CATEGORY[v.category];
                  return (
                    <div key={v.hoarding_id} className="relative overflow-hidden rounded-2xl border border-[#e5ebf1] bg-white p-4 shadow-[0_6px_20px_rgba(32,63,93,.035)]">
                      <div className={`absolute inset-y-0 left-0 w-1 ${p === "High" ? "bg-[#f5b544]" : p === "Medium" ? "bg-[#7aa9e9]" : "bg-[#b7c5d1]"}`} />
                      <div className="flex items-start justify-between gap-3 pl-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-[12px] font-bold text-[#203b5e]">{v.hoarding_id}</span><Pill tone={p === "High" ? "amber" : p === "Medium" ? "blue" : "slate"}>{p}</Pill></div>
                          <div className="mt-1 flex items-center gap-1.5 text-[12px] font-bold text-[#334d69]"><MapPin size={12} className="text-[#7393b7]" />{v.location}<span className="font-normal text-[#a2afbc]">·</span><span className="font-normal text-[#8495a7]">{v.size}</span></div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-[14px] font-bold text-[#172e4c]">{money(v.monthly_rate)}<span className="font-sans text-[10px] font-medium text-[#91a0b0]">/mo</span></div>
                          <div className="mt-1 font-mono text-[9px] font-bold uppercase tracking-[.1em] text-[#a1adba]">{v.already_vacant ? "already vacant" : `${v.days_until_vacant}d left`}</div>
                        </div>
                      </div>
                      <div className="mt-3 flex justify-end gap-2 pl-2">
                        <button onClick={() => openOpportunity(v)} className="flex items-center gap-1.5 rounded-lg bg-[#10233f] px-3 py-2 text-[10px] font-extrabold text-white hover:bg-[#1d416e]">View opportunity <ChevronRight size={13} /></button>
                      </div>
                    </div>
                  );
                })}
                {vacancyData && filtered.length === 0 && <div className="col-span-2 rounded-2xl border border-[#e5ebf1] bg-white p-8 text-center text-[12px] text-[#8b9bad]">No vacancies match these filters.</div>}
              </div>
            </div>
          </div>
        )}

        {view === "Leads" && (
          <div className="px-5 py-7 lg:px-8">
            <div className="mx-auto max-w-[900px]">
              <h2 className="text-[22px] font-extrabold tracking-[-.03em] text-[#10233f]">Ranked leads</h2>
              <p className="mt-1 text-[12px] text-[#8b9bad]">Pick a vacancy to see its real, scored top-3 customers.</p>
              <select
                value={pickerHoardingId ?? ""}
                onChange={e => { const id = e.target.value || null; setPickerHoardingId(id); if (id) ensureLeadsLoaded(id); }}
                className="mt-4 w-full max-w-sm rounded-lg border border-[#e1e8ef] bg-white px-3 py-2.5 text-[12px] font-bold text-[#3c5672] outline-none"
              >
                <option value="">Select a hoarding…</option>
                {vacancies.map(v => <option key={v.hoarding_id} value={v.hoarding_id}>{v.hoarding_id} — {v.location}</option>)}
              </select>

              {pickerHoardingId && !leadsByHoarding[pickerHoardingId] && <div className="mt-6 text-[12px] text-[#8b9bad]">Scoring candidates…</div>}

              {pickerHoardingId && leadsByHoarding[pickerHoardingId] && (
                <div className="mt-5 space-y-3">
                  {leadsByHoarding[pickerHoardingId].candidates_excluded_on_budget > 0 && (
                    <div className="text-[10px] text-[#9aa8b7]">{leadsByHoarding[pickerHoardingId].candidates_excluded_on_budget} of {leadsByHoarding[pickerHoardingId].candidates_considered} customers excluded — budget band can't cover this site's rate.</div>
                  )}
                  {leadsByHoarding[pickerHoardingId].leads.map((lead, i) => (
                    <div key={lead.customer_id} className="rounded-2xl border border-[#e5ebf1] bg-white p-4">
                      <div className="flex items-start gap-3">
                        <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg font-mono text-[12px] font-extrabold ${i === 0 ? "bg-[#fff5dc] text-[#b57e13]" : "bg-[#edf3f8] text-[#62809f]"}`}>#{i + 1}</div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2"><div className="text-[13px] font-extrabold text-[#203b5e]">{lead.name}</div><div className="font-mono text-[15px] font-bold text-[#2f62b8]">{Math.round(lead.score * 100)}%</div></div>
                          <div className="mt-1 text-[10px] text-[#8496a8]">{lead.industry} · {lead.budget_band} budget · relationship {lead.relationship_score}/10{lead.is_cold_relationship && " · cold"}</div>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">{lead.reasons.slice(0, 2).map(r => <span key={r} className="inline-flex items-center gap-1 rounded-full bg-[#f1f8f5] px-2 py-1 text-[9px] font-bold text-[#347c62]"><Check size={10} />{r}</span>)}</div>
                      <button onClick={() => generatePitch(pickerHoardingId, { id: lead.customer_id, name: lead.name })} className="mt-3 flex items-center gap-1.5 rounded-lg bg-[#10233f] px-3 py-2 text-[10px] font-extrabold text-white hover:bg-[#1d416e]"><Sparkles size={12} className="text-[#f5b544]" /> Generate pitch</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {view === "Analytics" && (
          <div className="px-5 py-7 lg:px-8">
            <div className="mx-auto max-w-[1460px]">
              <h2 className="text-[22px] font-extrabold tracking-[-.03em] text-[#10233f]">Analytics</h2>
              <p className="mt-1 text-[12px] text-[#8b9bad]">Aggregated from the live vacancy list — nothing here is historical or invented.</p>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {[
                  { label: "Upcoming Vacancies", value: vacancyData ? String(vacancyData.count) : "—" },
                  { label: "Revenue at Risk / mo", value: vacancyData ? money(vacancyData.total_revenue_at_risk_per_month) : "—" },
                  { label: "High-priority sites", value: String(highPriorityCount) },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-2xl border border-[#e5ebf1] bg-white p-4">
                    <div className="font-mono text-[26px] font-bold tracking-[-.05em] text-[#10233f]">{value}</div>
                    <div className="mt-1 text-[11px] font-extrabold text-[#4e627a]">{label}</div>
                  </div>
                ))}
              </div>

              <div className="mt-5 grid gap-5 lg:grid-cols-2">
                <div className="rounded-2xl border border-[#e5ebf1] bg-white p-5">
                  <h3 className="text-[14px] font-extrabold">Revenue at risk by category</h3>
                  <p className="mt-1 text-[10px] text-[#93a1af]">Monthly exposure · ₹L, current snapshot</p>
                  <div className="mt-5 h-[220px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={byCategory.map(b => ({ category: b.category, value: Number((b.risk / 100000).toFixed(1)) }))}>
                        <defs><linearGradient id="fillRiskA" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#4c83df" stopOpacity={.22} /><stop offset="100%" stopColor="#4c83df" stopOpacity={0} /></linearGradient></defs>
                        <CartesianGrid vertical={false} stroke="#edf1f4" />
                        <XAxis dataKey="category" tick={{ fontSize: 9, fill: "#97a7b7" }} axisLine={false} tickLine={false} />
                        <YAxis hide />
                        <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #e5ebf1", fontSize: 11 }} formatter={(v: number) => [`₹${v}L`, "Exposure"]} />
                        <Area type="monotone" dataKey="value" stroke="#3f74d8" strokeWidth={2} fill="url(#fillRiskA)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="rounded-2xl border border-[#e5ebf1] bg-white p-5">
                  <h3 className="text-[14px] font-extrabold">Vacancies by category</h3>
                  <p className="mt-1 text-[10px] text-[#93a1af]">Current pipeline, grouped by rate-card tier</p>
                  <div className="mt-5 h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={byCategory.map(b => ({ category: b.category, count: b.count }))} barSize={32}>
                        <CartesianGrid vertical={false} stroke="#edf1f4" />
                        <XAxis dataKey="category" tick={{ fontSize: 9, fill: "#97a7b7" }} axisLine={false} tickLine={false} />
                        <YAxis hide />
                        <Tooltip cursor={{ fill: "#f8fafc" }} contentStyle={{ borderRadius: 10, border: "1px solid #e5ebf1", fontSize: 11 }} />
                        <Bar dataKey="count" fill="#87aee2" radius={[5, 5, 2, 2]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {view === "AI Pitch Studio" && (
          <div className="px-5 py-7 lg:px-8">
            <div className="mx-auto max-w-[640px]">
              <h2 className="text-[22px] font-extrabold tracking-[-.03em] text-[#10233f]">AI Pitch Studio</h2>
              <p className="mt-1 text-[12px] text-[#8b9bad]">Pick a vacancy and a customer, then generate a grounded pitch from the real API.</p>

              <div className="mt-5 space-y-3 rounded-2xl border border-[#e5ebf1] bg-white p-4">
                <label className="block text-[10.5px] font-bold text-[#718399]">Hoarding
                  <select
                    value={studioHoardingId ?? ""}
                    onChange={e => { const id = e.target.value || null; setStudioHoardingId(id); setStudioCustomerId(null); if (id) ensureLeadsLoaded(id); }}
                    className="mt-1 w-full rounded-lg border border-[#e3eaf0] bg-[#f9fbfc] px-3 py-2.5 text-[12px] font-bold text-[#3c5672] outline-none"
                  >
                    <option value="">Select a hoarding…</option>
                    {vacancies.map(v => <option key={v.hoarding_id} value={v.hoarding_id}>{v.hoarding_id} — {v.location}</option>)}
                  </select>
                </label>
                <label className="block text-[10.5px] font-bold text-[#718399]">Customer
                  <select
                    value={studioCustomerId ?? ""}
                    onChange={e => setStudioCustomerId(e.target.value || null)}
                    disabled={!studioHoardingId || !leadsByHoarding[studioHoardingId]}
                    className="mt-1 w-full rounded-lg border border-[#e3eaf0] bg-[#f9fbfc] px-3 py-2.5 text-[12px] font-bold text-[#3c5672] outline-none disabled:opacity-50"
                  >
                    <option value="">{studioHoardingId ? (leadsByHoarding[studioHoardingId] ? "Select a customer…" : "Loading leads…") : "Pick a hoarding first"}</option>
                    {studioHoardingId && leadsByHoarding[studioHoardingId]?.leads.map(l => <option key={l.customer_id} value={l.customer_id}>{l.name} — {Math.round(l.score * 100)}% match</option>)}
                  </select>
                </label>
                <button
                  disabled={!studioHoardingId || !studioCustomerId}
                  onClick={() => { const lead = leadsByHoarding[studioHoardingId!]?.leads.find(l => l.customer_id === studioCustomerId); if (lead) generatePitch(studioHoardingId!, { id: lead.customer_id, name: lead.name }); }}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#10233f] px-3 py-3 text-[11px] font-extrabold text-white hover:bg-[#1d416e] disabled:opacity-40"
                >
                  <Sparkles size={14} className="text-[#f5b544]" /> Generate pitch
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {drawer && selected && (
        <div className="fixed inset-0 z-50 bg-[#10233f]/25" onClick={() => setDrawer(false)}>
          <div className="absolute inset-y-0 right-0 flex w-full max-w-[560px] flex-col overflow-hidden bg-[#fbfcfd] shadow-[-16px_0_40px_rgba(16,35,63,.16)]" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-[#e4ebf1] bg-white px-6 py-5">
              <div>
                <div className="flex items-center gap-2"><span className="font-mono text-[12px] font-bold text-[#27496f]">{selected.hoarding_id}</span><Pill tone={PRIORITY_FOR_CATEGORY[selected.category] === "High" ? "amber" : "blue"}>{PRIORITY_FOR_CATEGORY[selected.category]}</Pill></div>
                <h2 className="mt-2 text-[22px] font-extrabold tracking-[-.045em]">{selected.location}</h2>
                <p className="mt-1 text-[11px] text-[#8999aa]">Opportunity overview · {selected.free_from}</p>
              </div>
              <button onClick={() => setDrawer(false)} className="rounded-lg p-2 text-[#7a8da1] hover:bg-[#f0f4f8]"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[["Size", selected.size], ["Traffic", `${selected.traffic_score}/100`], ["Monthly rate", money(selected.monthly_rate)], ["Current customer", selected.last_booking.customer_id]].map(([l, val]) => (
                  <div key={l} className="rounded-xl bg-white p-3"><div className="font-mono text-[9px] uppercase tracking-[.08em] text-[#99a7b4]">{l}</div><div className="mt-2 truncate text-[11px] font-extrabold text-[#38516e]">{val}</div></div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl border border-[#f1e5c8] bg-[#fffaf0] p-4">
                <div><div className="font-mono text-[9px] uppercase tracking-[.08em] text-[#aa8b4c]">Revenue at risk</div><div className="mt-1 text-[15px] font-extrabold text-[#9d7017]">{money(selected.revenue_at_risk_per_month)}<span className="text-[10px]">/mo</span></div></div>
                <div><div className="font-mono text-[9px] uppercase tracking-[.08em] text-[#aa8b4c]">Days until</div><div className="mt-1 text-[15px] font-extrabold text-[#9d7017]">{selected.already_vacant ? 0 : selected.days_until_vacant}</div></div>
                <div><div className="font-mono text-[9px] uppercase tracking-[.08em] text-[#aa8b4c]">Top match</div><div className="mt-1 text-[15px] font-extrabold text-[#9d7017]">{selectedLeads?.leads[0] ? `${Math.round(selectedLeads.leads[0].score * 100)}%` : "…"}</div></div>
              </div>

              <div className="mt-7 flex items-end justify-between">
                <div><div className="flex items-center gap-2"><h3 className="text-[15px] font-extrabold">Top recommended customers</h3><Pill tone="blue">{selectedLeads ? `${selectedLeads.leads.length} leads` : "…"}</Pill></div><p className="mt-1 text-[10px] text-[#8b9bad]">Ranked by fit, budget, history, and relationship strength.</p></div>
                <button onClick={openCompare} className="flex items-center gap-1.5 rounded-lg border border-[#dce5ed] bg-white px-2.5 py-2 text-[10px] font-extrabold text-[#58718e] hover:bg-[#f0f4f8]"><ArrowDownUp size={13} /> Compare</button>
              </div>

              {leadsLoading && !selectedLeads && <div className="mt-4 text-[11px] text-[#8b9bad]">Scoring candidates…</div>}
              {selectedLeads && selectedLeads.candidates_excluded_on_budget > 0 && (
                <div className="mt-3 text-[10px] text-[#9aa8b7]">{selectedLeads.candidates_excluded_on_budget} of {selectedLeads.candidates_considered} customers excluded — budget band can't cover this site's rate.</div>
              )}

              <div className="mt-4 space-y-3">
                {selectedLeads?.leads.map((lead, i) => (
                  <div key={lead.customer_id} className={`rounded-2xl border bg-white p-4 transition ${expanded === i ? "border-[#a9c5ed] shadow-[0_8px_24px_rgba(54,108,182,.1)]" : "border-[#e5ebf1]"}`}>
                    <button className="flex w-full items-start gap-3 text-left" onClick={() => setExpanded(expanded === i ? -1 : i)}>
                      <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg font-mono text-[12px] font-extrabold ${i === 0 ? "bg-[#fff5dc] text-[#b57e13]" : "bg-[#edf3f8] text-[#62809f]"}`}>#{i + 1}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2"><div className="text-[13px] font-extrabold text-[#203b5e]">{lead.name}</div><div className="font-mono text-[15px] font-bold text-[#2f62b8]">{Math.round(lead.score * 100)}%</div></div>
                        <div className="mt-1 text-[10px] text-[#8496a8]">{lead.industry} · {lead.budget_band} budget · relationship {lead.relationship_score}/10{lead.is_cold_relationship && " · cold"}</div>
                      </div>
                      <ChevronDown size={15} className={`mt-1 text-[#91a3b4] transition ${expanded === i ? "rotate-180" : ""}`} />
                    </button>
                    <div className="mt-3 flex flex-wrap gap-1.5">{lead.reasons.slice(0, 2).map(r => <span key={r} className="inline-flex items-center gap-1 rounded-full bg-[#f1f8f5] px-2 py-1 text-[9px] font-bold text-[#347c62]"><Check size={10} />{r}</span>)}</div>
                    {expanded === i && (
                      <div className="mt-4 border-t border-[#edf1f4] pt-4">
                        <div className="mb-3 flex items-center justify-between"><span className="text-[10px] font-extrabold uppercase tracking-[.1em] text-[#778ba0]">Why this customer?</span><span className="font-mono text-[10px] font-bold text-[#2f62b8]">last contact {daysAgoFromReasons(selectedLeads.leads, lead.customer_id)}</span></div>
                        <div className="space-y-3">
                          <ScoreBar label="Industry fit" value={Math.round(lead.score_breakdown.industryFit * 100)} />
                          <ScoreBar label="Budget fit" value={Math.round(lead.score_breakdown.budgetFit * 100)} />
                          <ScoreBar label="Past booking" value={Math.round(lead.score_breakdown.pastBookingAffinity * 100)} />
                          <ScoreBar label="Relationship" value={Math.round(lead.score_breakdown.relationship * 100)} />
                        </div>
                        <div className="mt-4 space-y-1.5">{lead.reasons.map(r => <p key={r} className="rounded-lg bg-[#f5f8fb] p-2.5 text-[10px] leading-5 text-[#637891]">{r}</p>)}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {selectedLeads?.leads[0] && (
                <div className="mt-5 rounded-2xl bg-[#10233f] p-4 text-white">
                  <div className="flex items-center gap-2"><Sparkles size={15} className="text-[#f5b544]" /><span className="text-[12px] font-extrabold">Ready to make this actionable?</span></div>
                  <p className="mt-2 text-[10px] leading-5 text-[#b9cbe0]">Create a tailored pitch for {selectedLeads.leads[0].name} using the site facts and relationship context above.</p>
                  <button onClick={() => generatePitch(selected.hoarding_id, { id: selectedLeads.leads[0].customer_id, name: selectedLeads.leads[0].name })} className="mt-3 flex items-center gap-2 rounded-lg bg-[#f5b544] px-3 py-2 text-[10px] font-extrabold text-[#172b46] hover:bg-[#ffca63]"><Sparkles size={13} /> Generate personalized pitch</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {compare && selectedLeads && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-[#10233f]/35 p-4" onClick={() => setCompare(false)}>
          <div className="w-full max-w-[760px] rounded-2xl bg-[#fbfcfd] p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between"><div><div className="font-mono text-[9px] font-bold uppercase tracking-[.16em] text-[#8d9dac]">Side-by-side view</div><h2 className="mt-1 text-[20px] font-extrabold tracking-[-.04em]">Compare top leads</h2></div><button onClick={() => setCompare(false)}><X size={18} className="text-[#7c8fa2]" /></button></div>
            <div className="mt-5 overflow-x-auto rounded-xl border border-[#e5ebf1] bg-white">
              <table className="w-full min-w-[620px] text-left">
                <thead className="bg-[#f7f9fb]"><tr><th className="px-4 py-3 font-mono text-[9px] uppercase tracking-[.1em] text-[#94a2af]">Signal</th>{selectedLeads.leads.map((l, i) => <th key={l.customer_id} className="px-4 py-3 text-[11px] font-extrabold text-[#2b4666]">#{i + 1} {l.name}</th>)}</tr></thead>
                <tbody>
                  {[
                    { label: "Match score", render: (l: LeadDTO) => `${Math.round(l.score * 100)}%` },
                    { label: "Industry", render: (l: LeadDTO) => l.industry },
                    { label: "Budget band", render: (l: LeadDTO) => l.budget_band },
                    { label: "Relationship", render: (l: LeadDTO) => `${l.relationship_score}/10` },
                    { label: "Last contact", render: (l: LeadDTO) => daysAgoFromReasons(selectedLeads.leads, l.customer_id) },
                    { label: "Suggested rate", render: (l: LeadDTO) => { const r = compareRates[l.customer_id]; return r === "loading" || !r ? "…" : `₹${r.suggested_rate.toLocaleString("en-IN")}/mo`; } },
                  ].map(row => (
                    <tr key={row.label} className="border-t border-[#edf1f4]"><td className="px-4 py-3 text-[10px] font-bold text-[#8293a3]">{row.label}</td>{selectedLeads.leads.map(l => <td key={l.customer_id} className="px-4 py-3 text-[11px] font-extrabold text-[#39526e]">{row.render(l)}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {pitchOpen && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-[#10233f]/35 p-4" onClick={() => setPitchOpen(false)}>
          <div className="w-full max-w-[620px] rounded-2xl bg-[#fbfcfd] p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2"><div className="grid h-8 w-8 place-items-center rounded-lg bg-[#10233f]"><Sparkles size={15} className="text-[#f5b544]" /></div><div><div className="text-[15px] font-extrabold">AI Pitch Studio</div><div className="font-mono text-[9px] uppercase tracking-[.12em] text-[#8e9dab]">{pitchCustomer?.name} · {pitchData?.hoarding_id}</div></div></div>
              <button onClick={() => setPitchOpen(false)}><X size={18} className="text-[#7c8fa2]" /></button>
            </div>
            <div className="mt-5 grid gap-3 rounded-xl border border-[#e5ebf1] bg-white p-3 sm:grid-cols-3">
              <label className="text-[10px] font-bold text-[#718399]">Tone<select value={tone} onChange={e => setTone(e.target.value)} className="mt-1 w-full rounded-lg border border-[#e3eaf0] bg-[#f9fbfc] px-2 py-2 text-[10px] font-bold text-[#3c5672] outline-none"><option>Professional</option><option>Friendly</option><option>Persuasive</option></select></label>
              <label className="text-[10px] font-bold text-[#718399]">Length<select value={length} onChange={e => setLength(e.target.value)} className="mt-1 w-full rounded-lg border border-[#e3eaf0] bg-[#f9fbfc] px-2 py-2 text-[10px] font-bold text-[#3c5672] outline-none"><option>Short</option><option>Medium</option><option>Detailed</option></select></label>
              <label className="text-[10px] font-bold text-[#718399]">Channel<select value={channel} onChange={e => setChannel(e.target.value)} className="mt-1 w-full rounded-lg border border-[#e3eaf0] bg-[#f9fbfc] px-2 py-2 text-[10px] font-bold text-[#3c5672] outline-none"><option>Email</option><option>WhatsApp</option><option>LinkedIn</option></select></label>
            </div>
            {pitchLoading ? (
              <div className="my-8 space-y-4 text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#eaf2ff] text-[#3f74d8]"><Sparkles size={22} className="animate-pulse" /></div>
                <div className="space-y-1 font-mono text-[10px] font-bold uppercase tracking-[.1em] text-[#7890aa]"><div>Fetching rate-card and history…</div><div>Drafting pitch…</div></div>
              </div>
            ) : pitchData ? (
              <>
                <div className="mt-5 flex items-center justify-between">
                  <div><div className="font-mono text-[9px] font-bold uppercase tracking-[.14em] text-[#8b9bab]">Pitch · {channel}</div><div className="mt-1 text-[14px] font-extrabold">Ready to send</div></div>
                  <Pill tone="green">{pitchData.discount_pct}% off card</Pill>
                </div>
                <textarea value={pitchText} onChange={e => setPitchText(e.target.value)} className="mt-3 min-h-[190px] w-full resize-y rounded-xl border border-[#e4ebf1] bg-white p-4 text-[12px] leading-6 text-[#4d6279] outline-none focus:border-[#83aee6]" />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => { navigator.clipboard?.writeText(pitchText); toast.success("Pitch copied to clipboard"); }} className="flex items-center gap-1.5 rounded-lg bg-[#10233f] px-3 py-2 text-[10px] font-extrabold text-white"><Copy size={13} /> Copy pitch</button>
                  <button onClick={() => pitchCustomer && pitchData && generatePitch(pitchData.hoarding_id, pitchCustomer)} className="flex items-center gap-1.5 rounded-lg border border-[#dce5ed] bg-white px-3 py-2 text-[10px] font-extrabold text-[#58718e]"><Zap size={13} /> Refetch from API</button>
                  <button onClick={() => toast.success("Pitch marked ready for CRM sync")} className="flex items-center gap-1.5 rounded-lg border border-[#dce5ed] bg-white px-3 py-2 text-[10px] font-extrabold text-[#58718e]"><Send size={13} /> Send to CRM</button>
                </div>
              </>
            ) : (
              <div className="my-8 text-center text-[11px] text-[#8b9bad]">Could not generate a pitch.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
