/**
 * Google Tasks API Client
 * Complete Google Tasks API integration
 */

import { google, tasks_v1 } from 'googleapis';
import { OAuthManager } from '../auth/oauth-manager';
import { GoogleApiErrorHandler } from './error-handler';
import {
  GoogleTaskList,
  GoogleTask,
  GoogleTaskListsResponse,
  GoogleTasksResponse,
  CreateTaskParams,
  UpdateTaskParams,
  MoveTaskParams,
  BatchOperation,
  BatchResult
} from './api-types';

export class GoogleTasksClient {
  private tasksApi: tasks_v1.Tasks;
  private rateLimiter: () => Promise<void>;
  private oauth2Client: any;

  constructor(private authManager: OAuthManager) {
    this.oauth2Client = new google.auth.OAuth2(
      this.authManager.getClientId(),
      '', // Not needed for PKCE
      this.authManager.getRedirectUri()
    );

    this.tasksApi = google.tasks({ version: 'v1', auth: this.oauth2Client });
    this.rateLimiter = GoogleApiErrorHandler.createRateLimiter();
  }

  private async ensureAuthenticated(): Promise<void> {
    const tokens = await this.authManager.getValidTokens();
    if (!tokens) {
      throw new Error('Not authenticated. Please authenticate first.');
    }

    this.oauth2Client.setCredentials({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_type: 'Bearer'
    });
  }

  async getTaskLists(): Promise<GoogleTaskList[]> {
    await this.rateLimiter();
    await this.ensureAuthenticated();

    return GoogleApiErrorHandler.executeWithRetry(async () => {
      const response = await this.tasksApi.tasklists.list({
        maxResults: 100
      });

      const data = response.data as GoogleTaskListsResponse;
      return data.items || [];
    }, 'fetching task lists');
  }

  async createTaskList(title: string): Promise<GoogleTaskList> {
    await this.rateLimiter();
    await this.ensureAuthenticated();

    return GoogleApiErrorHandler.executeWithRetry(async () => {
      const response = await this.tasksApi.tasklists.insert({
        requestBody: {
          title
        }
      });

      return response.data as GoogleTaskList;
    }, 'creating task list');
  }

  async updateTaskList(listId: string, title: string): Promise<GoogleTaskList> {
    await this.rateLimiter();
    await this.ensureAuthenticated();

    return GoogleApiErrorHandler.executeWithRetry(async () => {
      const response = await this.tasksApi.tasklists.update({
        tasklist: listId,
        requestBody: {
          id: listId,
          title
        }
      });

      return response.data as GoogleTaskList;
    }, 'updating task list');
  }

  async deleteTaskList(listId: string): Promise<void> {
    await this.rateLimiter();
    await this.ensureAuthenticated();

    return GoogleApiErrorHandler.executeWithRetry(async () => {
      await this.tasksApi.tasklists.delete({
        tasklist: listId
      });
    }, 'deleting task list');
  }

  async getTasks(taskListId: string, showCompleted = false, showDeleted = false): Promise<GoogleTask[]> {
    await this.rateLimiter();
    await this.ensureAuthenticated();

    return GoogleApiErrorHandler.executeWithRetry(async () => {
      const response = await this.tasksApi.tasks.list({
        tasklist: taskListId,
        maxResults: 100,
        showCompleted,
        showDeleted,
        showHidden: false
      });

      const data = response.data as GoogleTasksResponse;
      return data.items || [];
    }, 'fetching tasks');
  }

  async getTask(taskListId: string, taskId: string): Promise<GoogleTask> {
    await this.rateLimiter();
    await this.ensureAuthenticated();

    return GoogleApiErrorHandler.executeWithRetry(async () => {
      const response = await this.tasksApi.tasks.get({
        tasklist: taskListId,
        task: taskId
      });

      return response.data as GoogleTask;
    }, 'fetching task');
  }

  async createTask(params: CreateTaskParams): Promise<GoogleTask> {
    await this.rateLimiter();
    await this.ensureAuthenticated();

    return GoogleApiErrorHandler.executeWithRetry(async () => {
      const requestBody: any = {
        title: params.title
      };

      if (params.notes) requestBody.notes = params.notes;
      if (params.due) requestBody.due = params.due;

      const insertParams: any = {
        tasklist: params.taskListId,
        requestBody
      };

      if (params.parent) insertParams.parent = params.parent;
      if (params.previous) insertParams.previous = params.previous;

      const response = await this.tasksApi.tasks.insert(insertParams);

      return response.data as GoogleTask;
    }, 'creating task');
  }

  async updateTask(params: UpdateTaskParams): Promise<GoogleTask> {
    await this.rateLimiter();
    await this.ensureAuthenticated();

    return GoogleApiErrorHandler.executeWithRetry(async () => {
      const requestBody: any = {
        id: params.taskId
      };

      if (params.title !== undefined) requestBody.title = params.title;
      if (params.notes !== undefined) requestBody.notes = params.notes;
      if (params.status !== undefined) requestBody.status = params.status;
      if (params.due !== undefined) requestBody.due = params.due;
      if (params.completed !== undefined) requestBody.completed = params.completed;

      const response = await this.tasksApi.tasks.update({
        tasklist: params.taskListId,
        task: params.taskId,
        requestBody
      });

      return response.data as GoogleTask;
    }, 'updating task');
  }

  async deleteTask(taskListId: string, taskId: string): Promise<void> {
    await this.rateLimiter();
    await this.ensureAuthenticated();

    return GoogleApiErrorHandler.executeWithRetry(async () => {
      await this.tasksApi.tasks.delete({
        tasklist: taskListId,
        task: taskId
      });
    }, 'deleting task');
  }

  async completeTask(taskListId: string, taskId: string): Promise<GoogleTask> {
    return this.updateTask({
      taskListId,
      taskId,
      status: 'completed',
      completed: new Date().toISOString()
    });
  }

  async uncompleteTask(taskListId: string, taskId: string): Promise<GoogleTask> {
    return this.updateTask({
      taskListId,
      taskId,
      status: 'needsAction'
    });
  }

  async moveTask(params: MoveTaskParams): Promise<GoogleTask> {
    await this.rateLimiter();
    await this.ensureAuthenticated();

    return GoogleApiErrorHandler.executeWithRetry(async () => {
      const moveParams: any = {
        tasklist: params.taskListId,
        task: params.taskId
      };

      if (params.parent) moveParams.parent = params.parent;
      if (params.previous) moveParams.previous = params.previous;

      const response = await this.tasksApi.tasks.move(moveParams);

      return response.data as GoogleTask;
    }, 'moving task');
  }

  async clearCompletedTasks(taskListId: string): Promise<void> {
    await this.rateLimiter();
    await this.ensureAuthenticated();

    return GoogleApiErrorHandler.executeWithRetry(async () => {
      await this.tasksApi.tasks.clear({
        tasklist: taskListId
      });
    }, 'clearing completed tasks');
  }

  async batchUpdateTasks(operations: BatchOperation[]): Promise<BatchResult> {
    const results: BatchResult['operations'] = [];

    for (const operation of operations) {
      try {
        let result: GoogleTask | undefined;

        switch (operation.operation) {
          case 'insert':
            if (!operation.task?.title) {
              throw new Error('Task title is required for insert operation');
            }
            const createParams: CreateTaskParams = {
              taskListId: operation.taskListId,
              title: operation.task.title
            };
            if (operation.task.notes) createParams.notes = operation.task.notes;
            if (operation.task.due) createParams.due = operation.task.due;
            if (operation.task.parent) createParams.parent = operation.task.parent;
            
            result = await this.createTask(createParams);
            break;

          case 'update':
            if (!operation.taskId) {
              throw new Error('Task ID is required for update operation');
            }
            const updateParams: UpdateTaskParams = {
              taskListId: operation.taskListId,
              taskId: operation.taskId
            };
            if (operation.task?.title !== undefined) updateParams.title = operation.task.title;
            if (operation.task?.notes !== undefined) updateParams.notes = operation.task.notes;
            if (operation.task?.status !== undefined) updateParams.status = operation.task.status;
            if (operation.task?.due !== undefined) updateParams.due = operation.task.due;
            
            result = await this.updateTask(updateParams);
            break;

          case 'delete':
            if (!operation.taskId) {
              throw new Error('Task ID is required for delete operation');
            }
            await this.deleteTask(operation.taskListId, operation.taskId);
            break;

          default:
            throw new Error(`Unknown operation: ${operation.operation}`);
        }

        results.push({
          operation: operation.operation,
          success: true,
          result
        });
      } catch (error) {
        const googleError = GoogleApiErrorHandler.parseGoogleApiError(error);
        results.push({
          operation: operation.operation,
          success: false,
          error: googleError
        });
      }
    }

    return { operations: results };
  }
}