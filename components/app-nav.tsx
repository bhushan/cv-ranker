"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  ChartNoAxesColumn,
  Inbox,
  LogOut,
  Upload,
  Users,
} from "lucide-react";
import { Logo } from "./logo";
const items = [
  { href: "/candidates", label: "Candidates", icon: Users },
  { href: "/rankings", label: "Rankings", icon: ChartNoAxesColumn },
  { href: "/outbox", label: "Outbox", icon: Inbox },
  { href: "/upload", label: "Upload CV", icon: Upload },
];
export function AppNav({ email, pending }: { email: string; pending: number }) {
  const path = usePathname();
  const router = useRouter();
  const active = (href: string) => path === href || path.startsWith(href + "/");
  return (
    <aside className="sidebar">
      <Link
        href="/candidates"
        className="sidebar-brand"
        aria-label="Kargo Hiring home"
      >
        <Logo />
      </Link>
      <nav className="nav" aria-label="Main">
        {items.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="nav-link"
            aria-current={active(href) ? "page" : undefined}
          >
            <Icon size={17} />
            <span>{label}</span>
            {href === "/outbox" && pending > 0 && (
              <span className="count" aria-label={`${pending} to review`}>
                {pending}
              </span>
            )}
          </Link>
        ))}
      </nav>
      <div className="sidebar-foot">
        <Link
          href="/rubrics"
          className="nav-link"
          aria-current={active("/rubrics") ? "page" : undefined}
        >
          <BookOpen size={17} />
          <span>Rubrics</span>
        </Link>
        <div className="account">
          <span className="account-email" title={email}>
            {email}
          </span>
          <button
            className="icon-button"
            aria-label="Sign out"
            title="Sign out"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" }).catch(
                () => null,
              );
              router.replace("/login");
              router.refresh();
            }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
