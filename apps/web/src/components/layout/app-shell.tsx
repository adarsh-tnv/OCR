"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  FileSearch,
  FolderKanban,
  Gauge,
  KeyRound,
  LogOut,
  Settings,
  UploadCloud
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import {
  API_UNAUTHORIZED_EVENT,
  AUTH_TOKEN_CHANGED_EVENT,
  clearAuthToken,
  getAuthToken,
  setAuthToken
} from "@/lib/auth-token";
import { cn } from "@/lib/cn";

const navItems = [
  { href: "/", label: "Dashboard", icon: Gauge },
  { href: "/upload", label: "Upload Center", icon: UploadCloud },
  { href: "/results", label: "OCR Results", icon: FileSearch },
  { href: "/review", label: "Review Queue", icon: FolderKanban },
  { href: "/settings", label: "Settings", icon: Settings }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [token, setTokenState] = useState("");
  const [needsAuth, setNeedsAuth] = useState(false);

  useEffect(() => {
    const syncToken = () => {
      const nextToken = getAuthToken();
      setTokenState(nextToken);
      if (nextToken) setNeedsAuth(false);
    };
    const onUnauthorized = () => setNeedsAuth(true);

    syncToken();
    window.addEventListener(AUTH_TOKEN_CHANGED_EVENT, syncToken);
    window.addEventListener(API_UNAUTHORIZED_EVENT, onUnauthorized);
    return () => {
      window.removeEventListener(AUTH_TOKEN_CHANGED_EVENT, syncToken);
      window.removeEventListener(API_UNAUTHORIZED_EVENT, onUnauthorized);
    };
  }, []);

  const requireToken = needsAuth || (!token && process.env.NODE_ENV === "production");
  if (requireToken) {
    return (
      <AuthTokenPrompt
        onSave={(nextToken) => {
          setAuthToken(nextToken);
          setNeedsAuth(false);
          void queryClient.invalidateQueries();
        }}
      />
    );
  }

  const clearToken = () => {
    clearAuthToken();
    setNeedsAuth(true);
    queryClient.clear();
  };

  return (
    <div className="min-h-screen bg-paper">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white lg:block">
        <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-600 text-white">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">ISO OCR</p>
            <p className="text-xs text-slate-500">Extraction Console</p>
          </div>
        </div>
        <nav className="space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-ink",
                  active && "bg-slate-100 text-ink"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 border-t border-slate-200 p-3">
          <button
            type="button"
            onClick={clearToken}
            className="focus-ring flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-ink"
          >
            <LogOut className="h-4 w-4" />
            API token
          </button>
        </div>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">ISO OCR</span>
            <nav className="flex gap-1">
              {navItems.slice(0, 4).map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} className="rounded-md p-2 text-slate-600 hover:bg-slate-100">
                    <Icon className="h-4 w-4" />
                  </Link>
                );
              })}
              <button type="button" onClick={clearToken} className="rounded-md p-2 text-slate-600 hover:bg-slate-100">
                <KeyRound className="h-4 w-4" />
              </button>
            </nav>
          </div>
        </header>
        <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

function AuthTokenPrompt({ onSave }: { onSave: (token: string) => void }) {
  const [value, setValue] = useState("");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextToken = value.trim();
    if (nextToken) onSave(nextToken);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-md border border-slate-200 bg-white p-6 shadow-soft">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-600 text-white">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-ink">API access token</h1>
            <p className="text-sm text-slate-500">Enter the server token from your environment.</p>
          </div>
        </div>
        <label className="mt-5 block text-sm font-medium text-slate-700" htmlFor="api-token">
          Token
        </label>
        <input
          id="api-token"
          type="password"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="focus-ring mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          autoComplete="current-password"
        />
        <button
          type="submit"
          disabled={!value.trim()}
          className="focus-ring mt-4 w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-60"
        >
          Continue
        </button>
      </form>
    </main>
  );
}
