import type { Scope } from '../memory/index.js'

export interface Persona {
  id: string
  name: string
  createdAt: string
}

export interface Trait {
  id: string
  text: string
  scope: Scope
  sources: string[]
  version: number
  updatedAt: string
}
