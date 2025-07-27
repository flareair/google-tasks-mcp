import express from 'express';

export const app = express();
const port = 8080;

app.use(express.json());

import { add_new_todo, mark_todo_done, summarize_my_todos, reorder_todo } from './google-tasks';

app.post('/add_new_todo', async (req, res) => {
  console.log('Request received for /add_new_todo');
  const { task_description, list_name, due_date } = req.body;
  try {
    const result = await add_new_todo(task_description, list_name, due_date);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(result));
  } catch (error) {
    console.error(error);
    res.status(500).send('Error adding new todo');
  }
});

app.post('/mark_todo_done', async (req, res) => {
  console.log('Request received for /mark_todo_done');
  const { task_identifier } = req.body;
  try {
    const result = await mark_todo_done(task_identifier);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(result));
  } catch (error) {
    console.error(error);
    res.status(500).send('Error marking todo as done');
  }
});

app.get('/summarize_my_todos', async (req, res) => {
  console.log('Request received for /summarize_my_todos');
  const { list_name, status } = req.query;
  try {
    const result = await summarize_my_todos(list_name as string, status as "completed" | "needsAction");
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(result));
  } catch (error) {
    console.error(error);
    res.status(500).send('Error summarizing todos');
  }
});

app.post('/reorder_todo', async (req, res) => {
  console.log('Request received for /reorder_todo');
  const { task_identifier, new_position } = req.body;
  try {
    const result = await reorder_todo(task_identifier, new_position);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(result));
  } catch (error) {
    console.error(error);
    res.status(500).send('Error reordering todo');
  }
});

app.use((req, res, next) => {
  console.log('Request received for:', req.url);
  next();
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
  });
}
