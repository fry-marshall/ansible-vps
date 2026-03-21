const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const hostsRoutes = require('./routes/hosts');
const sshRoutes = require('./routes/ssh');
const configRoutes = require('./routes/config');
const deployRoutes = require('./routes/deploy');
const statusRoutes = require('./routes/status');
const { setupDeploySocket } = require('./services/ansible');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(express.json());

app.use('/api/hosts', hostsRoutes);
app.use('/api/ssh', sshRoutes);
app.use('/api/config', configRoutes);
app.use('/api/deploy', deployRoutes);
app.use('/api/status', statusRoutes);
app.get('/api/health', (req, res) => res.json({ ok: true }));

io.on('connection', (socket) => {
  setupDeploySocket(socket, io);
  socket.on('disconnect', () => {});
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));

module.exports = { io };
