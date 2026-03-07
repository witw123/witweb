import { VideoTaskCoreRepository } from "./video-task-repository.tasks";
import { VideoTaskStudioRepository } from "./video-task-repository.studio";

export type {
  CreateVideoTaskData,
  UpdateVideoTaskData,
  CreateCharacterData,
} from "./video-task-repository.types";

export class VideoTaskRepository extends VideoTaskCoreRepository {
  private readonly studio = new VideoTaskStudioRepository();

  listCharacters = this.studio.listCharacters.bind(this.studio);
  getCharacterById = this.studio.getCharacterById.bind(this.studio);
  createCharacter = this.studio.createCharacter.bind(this.studio);
  updateCharacterName = this.studio.updateCharacterName.bind(this.studio);
  deleteCharacter = this.studio.deleteCharacter.bind(this.studio);
  addActiveTask = this.studio.addActiveTask.bind(this.studio);
  removeActiveTask = this.studio.removeActiveTask.bind(this.studio);
  getActiveTasks = this.studio.getActiveTasks.bind(this.studio);
  getConfig = this.studio.getConfig.bind(this.studio);
  getConfigValue = this.studio.getConfigValue.bind(this.studio);
  setConfigValue = this.studio.setConfigValue.bind(this.studio);
  deleteConfig = this.studio.deleteConfig.bind(this.studio);
  addHistory = this.studio.addHistory.bind(this.studio);
  getHistory = this.studio.getHistory.bind(this.studio);
  getHistoryByTaskId = this.studio.getHistoryByTaskId.bind(this.studio);
  deleteHistory = this.studio.deleteHistory.bind(this.studio);
  deleteHistoryByFile = this.studio.deleteHistoryByFile.bind(this.studio);
  recordTaskTime = this.studio.recordTaskTime.bind(this.studio);
  getTaskTime = this.studio.getTaskTime.bind(this.studio);
  deleteTaskTime = this.studio.deleteTaskTime.bind(this.studio);
}

export const videoTaskRepository = new VideoTaskRepository();
