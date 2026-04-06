"use client"

import { createContext, useContext } from "react"

type Integrations = {
  driveConnected: boolean
  docsConnected: boolean
  meetConnected: boolean
  driveMeetConnected: boolean
}

const IntegrationsContext = createContext<Integrations>({
  driveConnected: false,
  docsConnected: false,
  meetConnected: false,
  driveMeetConnected: false,
})

export function IntegrationsProvider({
  children,
  value,
}: {
  children: React.ReactNode
  value: Integrations
}) {
  return (
    <IntegrationsContext.Provider value={value}>
      {children}
    </IntegrationsContext.Provider>
  )
}

export function useIntegrations() {
  return useContext(IntegrationsContext)
}
