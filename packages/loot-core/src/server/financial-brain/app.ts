import { createApp } from '#server/app';
import { allocateFinancialRecommendations } from '#server/financial-brain/allocator';
import { buildFinancialSnapshot } from '#server/financial-brain/snapshot';
import type {
  FinancialSnapshotAdapterConfig,
  FinancialSnapshotBuildResult,
} from '#server/financial-brain/snapshot';
import type {
  AllocationRequest,
  AllocationResult,
} from '#server/financial-brain/types';

export type FinancialBrainHandlers = {
  'financial-brain-build-snapshot': (
    config: FinancialSnapshotAdapterConfig,
  ) => Promise<FinancialSnapshotBuildResult>;
  'financial-brain-allocate': (
    request: AllocationRequest,
  ) => Promise<AllocationResult>;
};

export const app = createApp<FinancialBrainHandlers>();

app.method('financial-brain-build-snapshot', async (config = {}) => {
  return buildFinancialSnapshot(config);
});

app.method('financial-brain-allocate', async request => {
  return allocateFinancialRecommendations(request);
});
