import { create } from "zustand";

export interface JobUpdate {
  fileId?: string;
  jobId?: string;
  status: string;
  progress?: number;
  message?: string;
}

interface ProcessingState {
  updates: Record<string, JobUpdate>;
  setUpdate: (update: JobUpdate) => void;
}

export const useProcessingStore = create<ProcessingState>((set) => ({
  updates: {},
  setUpdate: (update) =>
    set((state) => ({
      updates: {
        ...state.updates,
        [update.fileId ?? update.jobId ?? "global"]: update
      }
    }))
}));
