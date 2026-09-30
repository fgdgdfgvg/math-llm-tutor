import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface GraphKnowledgeNode {
  id: string
  name: string
  type: string
  description: string
  formula?: string
  latex?: string
  difficulty: string
  tags: string[]
  mastery?: number
  practiceCount?: number
  correctRate?: number
  lastPractice?: string
  dynamicWeight?: number
  relevanceScore?: number
  activationLevel?: number
}

export interface GraphKnowledgeEdge {
  source: string
  target: string
  type: string
  weight?: number
}

export const useGraphStore = defineStore('graph', () => {
  const nodes = ref<GraphKnowledgeNode[]>([])
  const edges = ref<GraphKnowledgeEdge[]>([])
  const mastery = ref<Record<string, number>>({})
  const selectedNodeId = ref<string | null>(null)
  const pathStartId = ref<string | null>(null)
  const pathEndId = ref<string | null>(null)
  const pathResult = ref<string[]>([])
  const layoutMode = ref<'force' | 'circular'>('force')
  const loading = ref(false)
  const error = ref<string | null>(null)

  const setGraphData = (newNodes: GraphKnowledgeNode[], newEdges: GraphKnowledgeEdge[]) => {
    nodes.value = newNodes
    edges.value = newEdges
  }

  const setMastery = (newMastery: Record<string, number>) => {
    mastery.value = newMastery
    nodes.value = nodes.value.map((n) => ({
      ...n,
      mastery: newMastery[n.id] !== undefined ? Math.round(newMastery[n.id] * 100) : n.mastery,
    }))
  }

  const setSelectedNodeId = (id: string | null) => {
    selectedNodeId.value = id
  }

  const setPathEndpoints = (start: string | null, end: string | null) => {
    pathStartId.value = start
    pathEndId.value = end
  }

  const setPathResult = (path: string[]) => {
    pathResult.value = path
  }

  const toggleLayout = () => {
    layoutMode.value = layoutMode.value === 'force' ? 'circular' : 'force'
  }

  const selectedNode = () => {
    if (!selectedNodeId.value) return null
    return nodes.value.find((n) => n.id === selectedNodeId.value) || null
  }

  return {
    nodes,
    edges,
    mastery,
    selectedNodeId,
    pathStartId,
    pathEndId,
    pathResult,
    layoutMode,
    loading,
    error,
    setGraphData,
    setMastery,
    setSelectedNodeId,
    setPathEndpoints,
    setPathResult,
    toggleLayout,
    selectedNode,
  }
})
