// Re-export from modular structure for backwards compatibility
// This file is kept for backward compatibility - new imports should use @/lib/agent/goals

export {
  // Types
  type GoalExecutionMode,
  type ContentTaskType,
  type GoalStepKind,
  type GoalStepStatus,
  type PlannedStep,
  type StoredPlan,
  // Constants
  CONTENT_TASK_TYPES,
  plannerResponseSchema,
  // Public APIs
  createAgentGoal,
  approveAgentAction,
  rejectAgentAction,
  executeAgentGoal,
  getAgentGoalTimeline,
  listAgentGoalGalleryItems,
  // Utilities
  inferAutonomousTaskType,
  nowIso,
  parseJson,
  asRecord,
  readString,
  readTagList,
  previewUnknown,
  type GoalEventReporter,
} from "./agent/goals";
