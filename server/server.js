import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: "https://real-time-collaborative-drawing-can-chi.vercel.app",
    methods: ["GET", "POST"]
  }
});

app.use(cors({
  origin: "https://real-time-collaborative-drawing-can-chi.vercel.app",
  methods: ["GET", "POST"]
}));

app.get("/", (req, res) => res.send("Socket.IO Server running"));

let onlineUsers = 0;

io.on("connection", (socket) => {
  onlineUsers++;
  io.emit("online-count", onlineUsers);

  socket.on("draw-point", (data) => socket.broadcast.emit("draw-point", data));
  socket.on("stroke-end", (stroke) => socket.broadcast.emit("stroke-end", stroke));
  socket.on("undo", (data) => io.emit("undo", data));
  socket.on("redo", (data) => io.emit("redo", data));

  socket.on("disconnect", () => {
    onlineUsers--;
    io.emit("online-count", onlineUsers);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => console.log(`Server running on port ${PORT}`));
