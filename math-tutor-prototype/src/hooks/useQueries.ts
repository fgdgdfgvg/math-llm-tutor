import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { knowledgeApi, interactiveLearningApi } from '../services/api';
import { useCognitiveStore, useGraphStore } from '../stores';
import type { CognitiveState, DynamicGraphResponse, KnowledgeGraph, ScenarioSummary } from '../types';

export function useKnowledgeGraph() {
  const { setGraphData, setMastery } = useGraphStore();

  return useQuery<KnowledgeGraph>({
    queryKey: ['knowledgeGraph'],
    queryFn: async () => {
      const data = await knowledgeApi.getGraph();
      setGraphData(data.nodes, data.edges);
      return data;
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}

export function useDynamicGraph(params?: Record<string, string>) {
  const { setDynamicData, setMastery } = useGraphStore();

  return useQuery<DynamicGraphResponse>({
    queryKey: ['dynamicGraph', params],
    queryFn: async () => {
      const data = await interactiveLearningApi.getDynamicGraph(params);
      setDynamicData(data);
      const mastery: Record<string, number> = {};
      data.nodes.forEach((n) => { mastery[n.id] = n.masteryLevel; });
      setMastery(mastery);
      return data;
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useCognitiveState() {
  const { setCognitiveState } = useCognitiveStore();

  return useQuery<CognitiveState>({
    queryKey: ['cognitiveState'],
    queryFn: async () => {
      const state = await interactiveLearningApi.getCognitiveState();
      setCognitiveState(state);
      return state;
    },
    staleTime: 2 * 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
    retry: 1,
  });
}

export function useScenarios(area?: string) {
  return useQuery<ScenarioSummary[]>({
    queryKey: ['scenarios', area],
    queryFn: () => area
      ? interactiveLearningApi.getScenariosByArea(area)
      : interactiveLearningApi.getScenarios(),
    staleTime: 10 * 60 * 1000,
  });
}

export function useConceptDetail(id: string | null) {
  return useQuery({
    queryKey: ['concept', id],
    queryFn: () => knowledgeApi.getConcept(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

export function usePrerequisites(id: string | null) {
  return useQuery({
    queryKey: ['prerequisites', id],
    queryFn: () => knowledgeApi.getPrerequisites(id!),
    enabled: !!id,
  });
}

export function useDependents(id: string | null) {
  return useQuery({
    queryKey: ['dependents', id],
    queryFn: () => knowledgeApi.getDependents(id!),
    enabled: !!id,
  });
}

export function useLearningPath(id: string | null) {
  return useQuery({
    queryKey: ['learningPath', id],
    queryFn: () => knowledgeApi.getLearningPath(id!),
    enabled: !!id,
  });
}

export function useRecordInteraction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: interactiveLearningApi.recordInteraction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cognitiveState'] });
      queryClient.invalidateQueries({ queryKey: ['dynamicGraph'] });
    },
  });
}
