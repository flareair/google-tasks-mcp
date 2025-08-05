/**
 * Google API Type Definitions
 * TypeScript interfaces for Google Tasks API
 */

export interface GoogleTaskList {
  kind: 'tasks#taskList';
  id?: string;
  etag?: string;
  title?: string;
  updated?: string;
  selfLink?: string;
}

export interface GoogleTask {
  kind: 'tasks#task';
  id?: string;
  etag?: string;
  title?: string;
  updated?: string;
  selfLink?: string;
  parent?: string;
  position?: string;
  notes?: string;
  status?: 'needsAction' | 'completed';
  due?: string;
  completed?: string;
  deleted?: boolean;
  hidden?: boolean;
  links?: GoogleTaskLink[];
}

export interface GoogleTaskLink {
  type?: string;
  description?: string;
  link?: string;
}

export interface GoogleTaskListsResponse {
  kind: 'tasks#taskLists';
  etag?: string;
  nextPageToken?: string;
  items?: GoogleTaskList[];
}

export interface GoogleTasksResponse {
  kind: 'tasks#tasks';
  etag?: string;
  nextPageToken?: string;
  items?: GoogleTask[];
}

export interface GoogleApiError {
  error: {
    code: number;
    message: string;
    status: string;
    details?: Array<{
      '@type': string;
      reason?: string;
      domain?: string;
      metadata?: Record<string, string>;
    }>;
  };
}

export interface CreateTaskParams {
  taskListId: string;
  title: string;
  notes?: string | undefined;
  due?: string | undefined;
  parent?: string | undefined;
  previous?: string | undefined;
}

export interface UpdateTaskParams {
  taskListId: string;
  taskId: string;
  title?: string | undefined;
  notes?: string | undefined;
  status?: 'needsAction' | 'completed' | undefined;
  due?: string | undefined;
  completed?: string | undefined;
}

export interface MoveTaskParams {
  taskListId: string;
  taskId: string;
  parent?: string | undefined;
  previous?: string | undefined;
}

export interface BatchOperation {
  operation: 'insert' | 'update' | 'delete';
  taskListId: string;
  taskId?: string;
  task?: Partial<GoogleTask>;
}

export interface BatchResult {
  operations: Array<{
    operation: string;
    success: boolean;
    result?: GoogleTask | undefined;
    error?: GoogleApiError | undefined;
  }>;
}