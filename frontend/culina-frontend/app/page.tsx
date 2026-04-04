import Link from "next/link";
import {
  Building2,
  CheckCircle2,
  Clock3,
  Layers3,
  ShieldCheck,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const FEATURES = [
  {
    title: "Live Service Visibility",
    description:
      "Track table lifecycle, kitchen readiness, and billing signals in real time across every shift.",
    icon: Layers3,
  },
  {
    title: "Team Performance Intelligence",
    description:
      "Measure staff load, output, and service bottlenecks with dashboards built for operational decisions.",
    icon: Users,
  },
  {
    title: "Inventory And Recipe Control",
    description:
      "Connect stock, restocks, and recipes so managers can prevent shortages before service is affected.",
    icon: Building2,
  },
];

const STEPS = [
  {
    title: "Connect Your Restaurant",
    description:
      "Set up locations, tables, and menus in minutes with a guided onboarding flow.",
  },
  {
    title: "Run Every Shift From One Surface",
    description:
      "Empower managers and waitstaff with focused dashboards for service, inventory, and billing.",
  },
  {
    title: "Scale With Confidence",
    description:
      "Use consistent operating data and standardized workflows across one location or many.",
  },
];

const PRICING = [
  {
    name: "Starter",
    price: "INR 4,999",
    cadence: "/month",
    description: "For single-location teams that need clear shift control.",
    points: [
      "Manager and waiter dashboards",
      "Live table and billing tracking",
      "Core inventory and recipe modules",
    ],
  },
  {
    name: "Growth",
    price: "INR 11,999",
    cadence: "/month",
    description: "For growing operations that need deeper control and reporting.",
    points: [
      "Everything in Starter",
      "Advanced shift performance insights",
      "Multi-role operational workflows",
    ],
    featured: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    cadence: "pricing",
    description: "For chains and complex organizations with custom requirements.",
    points: [
      "Everything in Growth",
      "Multi-location rollout support",
      "Priority onboarding and success manager",
    ],
  },
];

const FAQS = [
  {
    q: "How fast can we go live?",
    a: "Most teams can launch their first location in less than a week, including menu and table setup.",
  },
  {
    q: "Is Culina.ai built for multi-location brands?",
    a: "Yes. Culina.ai supports standardized operations across multiple restaurants with centralized visibility.",
  },
  {
    q: "Do you provide onboarding support?",
    a: "Yes. Every plan includes guided onboarding, and higher tiers include dedicated implementation support.",
  },
  {
    q: "Can we start with one location and expand later?",
    a: "Absolutely. You can begin with one site and scale to additional locations without changing systems.",
  },
];

export default function Page() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="relative overflow-hidden border-b border-border/70 bg-linear-to-b from-background via-background to-blue-50/30 dark:to-blue-950/20">
        <div className="pointer-events-none absolute inset-0 opacity-90 [background:radial-gradient(circle_at_18%_20%,color-mix(in_oklab,var(--accent)_34%,transparent)_0%,transparent_44%),radial-gradient(circle_at_82%_28%,color-mix(in_oklab,var(--primary)_18%,transparent)_0%,transparent_42%),radial-gradient(circle_at_55%_78%,rgba(56,189,248,0.16)_0%,transparent_40%)]" />

        <div className="relative mx-auto flex w-full max-w-6xl flex-col px-6 py-6 sm:px-8">
          <nav className="flex items-center justify-between gap-4 py-2">
            <div className="flex items-center gap-2">
              <div className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/80 bg-card text-sm font-semibold">
                C
              </div>
              <span className="text-sm font-semibold tracking-wide">Culina.ai</span>
            </div>

            <div className="flex items-center gap-2">
              <details className="group relative">
                <summary className="inline-flex h-8 cursor-pointer list-none items-center justify-center rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted [&::-webkit-details-marker]:hidden">
                  Contact Us
                </summary>
                <div className="absolute right-0 z-20 mt-2 w-80 rounded-xl border border-border bg-card p-4 shadow-xl">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Phone</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1 text-sm">
                    <a href="tel:+918780885684" className="text-primary hover:underline">+918780885684</a>
                    <span className="text-muted-foreground">/</span>
                    <a href="tel:+917990718452" className="text-primary hover:underline">+917990718452</a>
                  </div>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1 text-sm">
                    <a href="mailto:patelharshil2005@gmail.com" className="text-primary hover:underline">patelharshil2005@gmail.com</a>
                    <span className="text-muted-foreground">/</span>
                    <a href="mailto:prachiigohil06@gmail.com" className="text-primary hover:underline">prachiigohil06@gmail.com</a>
                  </div>
                </div>
              </details>
              <Button asChild variant="ghost" size="sm">
                <Link href="/staff-login">Sign In</Link>
              </Button>
            </div>
          </nav>

          <section className="grid gap-8 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="space-y-6">
              <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">
                Restaurant Operations Platform
              </Badge>

              <div className="space-y-4">
                <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
                  Run Service, Staff, And Inventory From One Premium Control Surface
                </h1>
                <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
                  Culina.ai helps owners, managers, and chains orchestrate faster shifts, clearer accountability, and better margins with a single SaaS operating layer.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button asChild variant="outline" size="lg">
                  <Link href="/staff-login">View Product</Link>
                </Button>
              </div>

              <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
                <div className="rounded-lg border border-sky-300/50 bg-sky-50/80 px-4 py-3 dark:border-sky-500/30 dark:bg-sky-900/25">Live floor intelligence</div>
                <div className="rounded-lg border border-indigo-300/50 bg-indigo-50/80 px-4 py-3 dark:border-indigo-500/30 dark:bg-indigo-900/25">Multi-role workflows</div>
                <div className="rounded-lg border border-emerald-300/50 bg-emerald-50/80 px-4 py-3 dark:border-emerald-500/30 dark:bg-emerald-900/25">Chain-ready scale</div>
              </div>
            </div>

            <Card className="border-blue-300/45 bg-linear-to-b from-card to-blue-50/35 dark:border-blue-500/30 dark:to-blue-950/30">
              <CardHeader>
                <CardTitle className="text-xl">Operational Snapshot</CardTitle>
                <CardDescription>What leaders see with Culina.ai in every shift.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-sky-300/40 bg-sky-50/70 px-4 py-3 dark:border-sky-500/25 dark:bg-sky-900/30">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Table Throughput</p>
                    <p className="mt-1 text-2xl font-semibold">+27%</p>
                  </div>
                  <div className="rounded-lg border border-indigo-300/40 bg-indigo-50/70 px-4 py-3 dark:border-indigo-500/25 dark:bg-indigo-900/30">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Waste Reduction</p>
                    <p className="mt-1 text-2xl font-semibold">-31%</p>
                  </div>
                </div>
                <div className="rounded-lg border border-emerald-300/40 bg-emerald-50/70 px-4 py-3 dark:border-emerald-500/25 dark:bg-emerald-900/30">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Inventory Alerts</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Prevent outages before service impact with reorder and recipe-linked stock signals.
                  </p>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-6 py-16 sm:px-8">
        <section className="space-y-8">
          <div className="space-y-3">
            <Badge variant="outline" className="rounded-full">Features</Badge>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Purpose-built for modern restaurant operations</h2>
          </div>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <Card key={feature.title} className="border-border/70 bg-linear-to-b from-card to-accent/5 dark:to-accent/10">
                <CardHeader className="space-y-3">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-accent/40 bg-accent/10 dark:bg-accent/15">
                    <feature.icon className="size-5 text-accent" />
                  </div>
                  <CardTitle>{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        <Separator />

        <section className="space-y-8">
          <div className="space-y-3">
            <Badge variant="outline" className="rounded-full">How It Works</Badge>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">From setup to scale in three clear steps</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <Card key={step.title} className="border-border/70 bg-linear-to-b from-card to-blue-50/25 dark:to-blue-950/20">
                <CardHeader>
                  <div className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-accent/40 bg-accent/10 text-xs font-semibold text-accent">
                    0{index + 1}
                  </div>
                  <CardTitle className="pt-1 text-xl">{step.title}</CardTitle>
                  <CardDescription>{step.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        <Separator />

        <section className="space-y-8">
          <div className="space-y-3">
            <Badge variant="outline" className="rounded-full">Pricing</Badge>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Flexible plans for single sites and multi-location brands</h2>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {PRICING.map((plan) => (
              <Card
                key={plan.name}
                className={`border-border/70 bg-linear-to-b from-card to-violet-50/20 dark:to-violet-950/20 ${plan.featured ? "ring-2 ring-accent/40" : ""}`}
              >
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle>{plan.name}</CardTitle>
                    {plan.featured ? <Badge>Most Popular</Badge> : null}
                  </div>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-3xl font-semibold">
                    {plan.price}
                    <span className="pl-1 text-sm font-medium text-muted-foreground">{plan.cadence}</span>
                  </p>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {plan.points.map((point) => (
                      <li key={point} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 size-4 text-accent" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <Separator />

        <section className="space-y-6">
          <div className="space-y-3">
            <Badge variant="outline" className="rounded-full">FAQ</Badge>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Answers for operators evaluating Culina.ai</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {FAQS.map((item) => (
              <Card key={item.q} className="border-border/70 bg-linear-to-b from-card to-cyan-50/20 dark:to-cyan-950/20">
                <CardHeader>
                  <CardTitle className="text-lg">{item.q}</CardTitle>
                  <CardDescription>{item.a}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-indigo-300/50 bg-linear-to-br from-indigo-50 via-sky-50 to-cyan-50 px-6 py-8 sm:px-10 sm:py-10 dark:border-indigo-500/30 dark:from-indigo-950/40 dark:via-sky-950/30 dark:to-cyan-950/30">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">Ready To See It Live?</p>
              <h3 className="text-3xl font-semibold tracking-tight">Book a tailored demo for your restaurant operations</h3>
              <p className="text-muted-foreground">
                See how Culina.ai can improve service pacing, staff coordination, and inventory control across your business.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild variant="outline" size="lg">
                <Link href="/staff-login">Go To Login</Link>
              </Button>
            </div>
          </div>

          <Separator className="my-6" />

          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-3.5" />Secure workflows</span>
            <span className="inline-flex items-center gap-1.5"><Clock3 className="size-3.5" />Real-time operations</span>
            <span className="inline-flex items-center gap-1.5"><Users className="size-3.5" />Built for teams and chains</span>
          </div>
        </section>
      </div>
    </main>
  );
}
