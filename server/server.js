import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
const server = createServer(app);

const FRONTEND_ORIGIN = "https://real-time-collaborative-drawing-can-chi.vercel.app/";

app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    methods: ["GET", "POST"]
  })
);

//app.use(express.static("./client"));

const io = new Server(server, {
  cors: {
    origin: FRONTEND_ORIGIN,
    methods: ["GET", "POST"]
  }
});

let onlineUsers = 0;

io.on("connection", (socket) => {
  console.log("a user connected");
  onlineUsers++;
  io.emit("online-count", onlineUsers);

  socket.on("draw-point", (data) => socket.broadcast.emit("draw-point", data));
  socket.on("stroke-end", (stroke) => socket.broadcast.emit("stroke-end", stroke));

  socket.on("undo", (data) => io.emit("undo", data));
  socket.on("redo", (data) => io.emit("redo", data));

  socket.on("disconnect", () => {
    console.log("user disconnected");
    onlineUsers--;
    io.emit("online-count", onlineUsers);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
