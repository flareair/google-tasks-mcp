# Intelligent Task Assistant MCP Server (with some logic built-in)

Description: This server adds a layer of intelligence within the MCP server itself. Instead of just exposing raw API calls, it exposes higher-level "intent-based" tools that might combine multiple Google Tasks API calls or perform more complex logic.

## Tools Exposed (examples):

add_new_todo(task_description: string, list_name?: string, due_date?: string): This single tool could handle creating a task, optionally finding or creating a task list, and setting a due date.

mark_todo_done(task_identifier: string): The server could intelligently search across your task lists to find the task matching task_identifier (e.g., "the email task", "the report due tomorrow") and then mark it complete.

summarize_my_todos(list_name?: string, status?: "completed" | "needsAction"): Fetches tasks and performs a basic summarization or categorization within the server before returning.

reorder_todo(task_identifier: string, new_position: number): Moves a task within a list.
