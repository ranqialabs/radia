import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Dashboard",
}

export default function Page() {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-medium tracking-tight">Dashboard</h1>
      <p className="text-sm text-muted-foreground">Coming soon.</p>
    </div>
  )
}
