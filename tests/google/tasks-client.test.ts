/**
 * Tests for GoogleTasksClient
 * Comprehensive Google Tasks API client testing
 */

import { GoogleTasksClient } from '../../src/google/tasks-client';
import { OAuthManager } from '../../src/auth/oauth-manager';
import { GoogleApiErrorHandler } from '../../src/google/error-handler';
import { TokenSet } from '../../src/auth/auth-types';

// Mock dependencies
jest.mock('../../src/auth/oauth-manager');
jest.mock('googleapis');

const mockOAuthManager = {
  getClientId: jest.fn().mockReturnValue('test-client-id'),
  getRedirectUri: jest.fn().mockReturnValue('http://localhost:8080/callback'),
  getValidTokens: jest.fn()
};

const mockOAuth2Client = {
  setCredentials: jest.fn()
};

const mockTasksApi = {
  context: { _options: { auth: mockOAuth2Client } },
  tasklists: {
    list: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  },
  tasks: {
    list: jest.fn(),
    get: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    move: jest.fn(),
    clear: jest.fn()
  }
};

const mockRateLimiter = jest.fn().mockResolvedValue(undefined);

describe('GoogleTasksClient', () => {
  let client: GoogleTasksClient;
  let mockExecuteWithRetry: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock GoogleApiErrorHandler only for this test suite
    mockExecuteWithRetry = jest.fn();
    jest.spyOn(GoogleApiErrorHandler, 'executeWithRetry').mockImplementation(mockExecuteWithRetry);
    jest.spyOn(GoogleApiErrorHandler, 'createRateLimiter').mockReturnValue(mockRateLimiter);
    jest.spyOn(GoogleApiErrorHandler, 'parseGoogleApiError');

    // Mock googleapis
    const { google } = require('googleapis');
    google.auth.OAuth2 = jest.fn().mockReturnValue(mockOAuth2Client);
    google.tasks = jest.fn().mockReturnValue(mockTasksApi);

    client = new GoogleTasksClient(mockOAuthManager as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with OAuth manager', () => {
      expect(mockOAuthManager.getClientId).toHaveBeenCalled();
      expect(mockOAuthManager.getRedirectUri).toHaveBeenCalled();
      expect(GoogleApiErrorHandler.createRateLimiter).toHaveBeenCalled();
    });
  });

  describe('ensureAuthenticated', () => {
    it('should set credentials when tokens are valid', async () => {
      const tokens: TokenSet = {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_in: 3600,
        token_type: 'Bearer'
      };

      mockOAuthManager.getValidTokens.mockResolvedValue(tokens);

      await (client as any).ensureAuthenticated();

      expect(mockOAuthManager.getValidTokens).toHaveBeenCalled();
    });

    it('should throw error when not authenticated', async () => {
      mockOAuthManager.getValidTokens.mockResolvedValue(null);

      await expect((client as any).ensureAuthenticated()).rejects.toThrow(
        'Not authenticated. Please authenticate first.'
      );
    });
  });

  describe('getTaskLists', () => {
    it('should fetch task lists successfully', async () => {
      const mockTaskLists = [
        { id: 'list1', title: 'My Tasks' },
        { id: 'list2', title: 'Work Tasks' }
      ];

      mockOAuthManager.getValidTokens.mockResolvedValue({
        access_token: 'token'
      });

      mockExecuteWithRetry.mockImplementation(async (operation) => {
        return operation();
      });

      mockTasksApi.tasklists.list.mockResolvedValue({
        data: { items: mockTaskLists }
      });

      const result = await client.getTaskLists();

      expect(mockRateLimiter).toHaveBeenCalled();
      expect(mockExecuteWithRetry).toHaveBeenCalledWith(
        expect.any(Function),
        'fetching task lists'
      );
      expect(result).toEqual(mockTaskLists);
    });

    it('should return empty array when no task lists', async () => {
      mockOAuthManager.getValidTokens.mockResolvedValue({
        access_token: 'token'
      });

      mockExecuteWithRetry.mockImplementation(async (operation) => {
        return operation();
      });

      mockTasksApi.tasklists.list.mockResolvedValue({
        data: {}
      });

      const result = await client.getTaskLists();
      expect(result).toEqual([]);
    });
  });

  describe('createTaskList', () => {
    it('should create task list successfully', async () => {
      const newTaskList = { id: 'new-list', title: 'New List' };

      mockOAuthManager.getValidTokens.mockResolvedValue({
        access_token: 'token'
      });

      mockExecuteWithRetry.mockImplementation(async (operation) => {
        return operation();
      });

      mockTasksApi.tasklists.insert.mockResolvedValue({
        data: newTaskList
      });

      const result = await client.createTaskList('New List');

      expect(mockTasksApi.tasklists.insert).toHaveBeenCalledWith({
        requestBody: { title: 'New List' }
      });
      expect(result).toEqual(newTaskList);
    });
  });

  describe('getTasks', () => {
    it('should fetch tasks successfully', async () => {
      const mockTasks = [
        { id: 'task1', title: 'Task 1' },
        { id: 'task2', title: 'Task 2' }
      ];

      mockOAuthManager.getValidTokens.mockResolvedValue({
        access_token: 'token'
      });

      mockExecuteWithRetry.mockImplementation(async (operation) => {
        return operation();
      });

      mockTasksApi.tasks.list.mockResolvedValue({
        data: { items: mockTasks }
      });

      const result = await client.getTasks('list1');

      expect(mockTasksApi.tasks.list).toHaveBeenCalledWith({
        tasklist: 'list1',
        maxResults: 100,
        showCompleted: false,
        showDeleted: false,
        showHidden: false
      });
      expect(result).toEqual(mockTasks);
    });

    it('should fetch tasks with custom options', async () => {
      mockOAuthManager.getValidTokens.mockResolvedValue({
        access_token: 'token'
      });

      mockExecuteWithRetry.mockImplementation(async (operation) => {
        return operation();
      });

      mockTasksApi.tasks.list.mockResolvedValue({
        data: { items: [] }
      });

      await client.getTasks('list1', true, true);

      expect(mockTasksApi.tasks.list).toHaveBeenCalledWith({
        tasklist: 'list1',
        maxResults: 100,
        showCompleted: true,
        showDeleted: true,
        showHidden: false
      });
    });
  });

  describe('createTask', () => {
    it('should create task with required fields', async () => {
      const newTask = { id: 'new-task', title: 'New Task' };

      mockOAuthManager.getValidTokens.mockResolvedValue({
        access_token: 'token'
      });

      mockExecuteWithRetry.mockImplementation(async (operation) => {
        return operation();
      });

      mockTasksApi.tasks.insert.mockResolvedValue({
        data: newTask
      });

      const result = await client.createTask({
        taskListId: 'list1',
        title: 'New Task'
      });

      expect(mockTasksApi.tasks.insert).toHaveBeenCalledWith({
        tasklist: 'list1',
        parent: undefined,
        previous: undefined,
        requestBody: { title: 'New Task' }
      });
      expect(result).toEqual(newTask);
    });

    it('should create task with optional fields', async () => {
      const newTask = { id: 'new-task', title: 'New Task' };

      mockOAuthManager.getValidTokens.mockResolvedValue({
        access_token: 'token'
      });

      mockExecuteWithRetry.mockImplementation(async (operation) => {
        return operation();
      });

      mockTasksApi.tasks.insert.mockResolvedValue({
        data: newTask
      });

      const result = await client.createTask({
        taskListId: 'list1',
        title: 'New Task',
        notes: 'Task notes',
        due: '2023-12-31T00:00:00.000Z',
        parent: 'parent-task',
        previous: 'prev-task'
      });

      expect(mockTasksApi.tasks.insert).toHaveBeenCalledWith({
        tasklist: 'list1',
        parent: 'parent-task',
        previous: 'prev-task',
        requestBody: {
          title: 'New Task',
          notes: 'Task notes',
          due: '2023-12-31T00:00:00.000Z'
        }
      });
      expect(result).toEqual(newTask);
    });
  });

  describe('updateTask', () => {
    it('should update task successfully', async () => {
      const updatedTask = { id: 'task1', title: 'Updated Task' };

      mockOAuthManager.getValidTokens.mockResolvedValue({
        access_token: 'token'
      });

      mockExecuteWithRetry.mockImplementation(async (operation) => {
        return operation();
      });

      mockTasksApi.tasks.update.mockResolvedValue({
        data: updatedTask
      });

      const result = await client.updateTask({
        taskListId: 'list1',
        taskId: 'task1',
        title: 'Updated Task',
        status: 'completed'
      });

      expect(mockTasksApi.tasks.update).toHaveBeenCalledWith({
        tasklist: 'list1',
        task: 'task1',
        requestBody: {
          id: 'task1',
          title: 'Updated Task',
          status: 'completed'
        }
      });
      expect(result).toEqual(updatedTask);
    });
  });

  describe('deleteTask', () => {
    it('should delete task successfully', async () => {
      mockOAuthManager.getValidTokens.mockResolvedValue({
        access_token: 'token'
      });

      mockExecuteWithRetry.mockImplementation(async (operation) => {
        return operation();
      });

      mockTasksApi.tasks.delete.mockResolvedValue({});

      await client.deleteTask('list1', 'task1');

      expect(mockTasksApi.tasks.delete).toHaveBeenCalledWith({
        tasklist: 'list1',
        task: 'task1'
      });
    });
  });

  describe('completeTask', () => {
    it('should complete task successfully', async () => {
      const completedTask = { id: 'task1', status: 'completed' };

      mockOAuthManager.getValidTokens.mockResolvedValue({
        access_token: 'token'
      });

      mockExecuteWithRetry.mockImplementation(async (operation) => {
        return operation();
      });

      mockTasksApi.tasks.update.mockResolvedValue({
        data: completedTask
      });

      const result = await client.completeTask('list1', 'task1');

      expect(mockTasksApi.tasks.update).toHaveBeenCalledWith({
        tasklist: 'list1',
        task: 'task1',
        requestBody: expect.objectContaining({
          id: 'task1',
          status: 'completed',
          completed: expect.any(String)
        })
      });
      expect(result).toEqual(completedTask);
    });
  });

  describe('moveTask', () => {
    it('should move task successfully', async () => {
      const movedTask = { id: 'task1', parent: 'new-parent' };

      mockOAuthManager.getValidTokens.mockResolvedValue({
        access_token: 'token'
      });

      mockExecuteWithRetry.mockImplementation(async (operation) => {
        return operation();
      });

      mockTasksApi.tasks.move.mockResolvedValue({
        data: movedTask
      });

      const result = await client.moveTask({
        taskListId: 'list1',
        taskId: 'task1',
        parent: 'new-parent',
        previous: 'prev-task'
      });

      expect(mockTasksApi.tasks.move).toHaveBeenCalledWith({
        tasklist: 'list1',
        task: 'task1',
        parent: 'new-parent',
        previous: 'prev-task'
      });
      expect(result).toEqual(movedTask);
    });
  });

  describe('batchUpdateTasks', () => {
    beforeEach(() => {
      mockOAuthManager.getValidTokens.mockResolvedValue({
        access_token: 'token'
      });

      mockExecuteWithRetry.mockImplementation(async (operation) => {
        return operation();
      });
    });

    it('should handle batch insert operations', async () => {
      const newTask = { id: 'new-task', title: 'New Task' };
      mockTasksApi.tasks.insert.mockResolvedValue({ data: newTask });

      const operations = [{
        operation: 'insert' as const,
        taskListId: 'list1',
        task: { title: 'New Task' }
      }];

      const result = await client.batchUpdateTasks(operations);

      expect(result.operations).toHaveLength(1);
      expect(result.operations[0]).toEqual({
        operation: 'insert',
        success: true,
        result: newTask
      });
    });

    it('should handle batch update operations', async () => {
      const updatedTask = { id: 'task1', title: 'Updated Task' };
      mockTasksApi.tasks.update.mockResolvedValue({ data: updatedTask });

      const operations = [{
        operation: 'update' as const,
        taskListId: 'list1',
        taskId: 'task1',
        task: { title: 'Updated Task' }
      }];

      const result = await client.batchUpdateTasks(operations);

      expect(result.operations).toHaveLength(1);
      expect(result.operations[0]).toEqual({
        operation: 'update',
        success: true,
        result: updatedTask
      });
    });

    it('should handle batch delete operations', async () => {
      mockTasksApi.tasks.delete.mockResolvedValue({});

      const operations = [{
        operation: 'delete' as const,
        taskListId: 'list1',
        taskId: 'task1'
      }];

      const result = await client.batchUpdateTasks(operations);

      expect(result.operations).toHaveLength(1);
      expect(result.operations[0]).toEqual({
        operation: 'delete',
        success: true,
        result: undefined
      });
    });

    it('should handle errors in batch operations', async () => {
      const error = new Error('API Error');
      mockTasksApi.tasks.insert.mockRejectedValue(error);

      (GoogleApiErrorHandler.parseGoogleApiError as jest.Mock).mockReturnValue({
        error: { code: 400, message: 'Bad Request', status: 'INVALID_ARGUMENT' }
      });

      const operations = [{
        operation: 'insert' as const,
        taskListId: 'list1',
        task: { title: 'New Task' }
      }];

      const result = await client.batchUpdateTasks(operations);

      expect(result.operations).toHaveLength(1);
      expect(result.operations[0]).toEqual({
        operation: 'insert',
        success: false,
        error: {
          error: { code: 400, message: 'Bad Request', status: 'INVALID_ARGUMENT' }
        }
      });
    });

    it('should validate required fields for insert', async () => {
      const operations = [{
        operation: 'insert' as const,
        taskListId: 'list1',
        task: {} // Missing title
      }];

      const result = await client.batchUpdateTasks(operations);

      expect(result.operations[0]?.success).toBe(false);
    });

    it('should validate required fields for update', async () => {
      const operations = [{
        operation: 'update' as const,
        taskListId: 'list1',
        // Missing taskId
        task: { title: 'Updated Task' }
      }];

      const result = await client.batchUpdateTasks(operations);

      expect(result.operations[0]?.success).toBe(false);
    });
  });
});