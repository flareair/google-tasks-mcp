import http from 'http';
import { app } from './index';

const server = http.createServer(app);

server.listen(8080, () => {
  console.log('Server is running on http://localhost:8080');
});
