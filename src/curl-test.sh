#!/bin/bash

curl -X POST -H "Content-Type: application/json" -d '{"task_description": "Test task"}' http://localhost:8080/add_new_todo
curl -X POST -H "Content-Type: application/json" -d '{"task_identifier": "Test task"}' http://localhost:8080/mark_todo_done
curl http://localhost:8080/summarize_my_todos
curl -X POST -H "Content-Type: application/json" -d '{"task_identifier": "Test task", "new_position": 1}' http://localhost:8080/reorder_todo
