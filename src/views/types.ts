import type { Scenario, ScenarioResult } from '../engine';

export interface ViewProps {
  s: Scenario;
  res: ScenarioResult;
  mutate: (fn: (draft: Scenario) => void) => void;
  colors: Record<string, string>;
}
