import { app } from './index';

const port = 8080;

const server = app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
  runTests();
});

async function runTests() {
  const fetch = (await import('node-fetch')).default;
  const baseUrl = 'http://localhost:8080';

  try {
    // Test add_new_todo
    const addTodoRes = await fetch(`${baseUrl}/add_new_todo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_description: 'Test task' }),
    });
    console.log('Add new todo response:', await addTodoRes.json());

    // Test mark_todo_done
    const markDoneRes = await fetch(`${baseUrl}/mark_todo_done`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_identifier: 'Test task' }),
    });
    console.log('Mark todo done response:', await markDoneRes.json());

    // Test summarize_my_todos
    const summarizeRes = await fetch(`${baseUrl}/summarize_my_todos`);
    console.log('Summarize my todos response:', await summarizeRes.json());

    // Test reorder_todo
    const reorderRes = await fetch(`${baseUrl}/reorder_todo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_identifier: 'Test task', new_position: 1 }),
    });
    console.log('Reorder todo response:', await reorderRes.json());
  } catch (error) {
    console.error('Error testing endpoints:', error);
  } finally {
    server.close();
  }
}
