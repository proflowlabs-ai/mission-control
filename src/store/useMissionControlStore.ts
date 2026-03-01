import { create } from "zustand";

interface MissionControlState {
  selectedProjectId: string | null;
  selectedTaskId: string | null;
  logs: Record<string, string[]>;
  setSelectedProjectId: (id: string | null) => void;
  setSelectedTaskId: (id: string | null) => void;
  appendLog: (runId: string, line: string) => void;
}

export const useMissionControlStore = create<MissionControlState>((set) => ({
  selectedProjectId: null,
  selectedTaskId: null,
  logs: {},
  setSelectedProjectId: (selectedProjectId) => set({ selectedProjectId }),
  setSelectedTaskId: (selectedTaskId) => set({ selectedTaskId }),
  appendLog: (runId, line) =>
    set((state) => ({
      logs: {
        ...state.logs,
        [runId]: [...(state.logs[runId] ?? []), line],
      },
    })),
}));
