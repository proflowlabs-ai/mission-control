import Link from "next/link";
import { useRouter } from "next/router";
import { PropsWithChildren } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/projects", label: "Projects" },
  { href: "/tasks", label: "Tasks" },
  { href: "/scheduler", label: "Scheduler" },
  { href: "/agents", label: "Agents" },
  { href: "/settings", label: "Settings" },
];

export function MissionControlLayout({ children }: PropsWithChildren) {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="grid min-h-screen md:grid-cols-[240px_1fr]">
        <aside className="border-r border-slate-800 bg-slate-900/60 p-4">
          <div className="mb-8">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Mission</p>
            <h1 className="text-xl font-semibold text-slate-100">Control</h1>
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const active = item.href === "/"
                ? router.pathname === "/"
                : router.pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "block rounded-md px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-slate-700/70 text-white"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <section className="flex min-h-screen flex-col">
          <header className="flex h-14 items-center justify-between border-b border-slate-800 bg-slate-950/80 px-6 backdrop-blur">
            <div className="text-sm text-slate-300">Mission Control · Operations Dashboard</div>
            <Badge variant="outline" className="border-emerald-600/50 bg-emerald-950 text-emerald-300">Live</Badge>
          </header>
          <main className="flex-1 p-6">{children}</main>
        </section>
      </div>
    </div>
  );
}
