import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET","POST"] }
});

app.use(express.static("client"));

let onlineUsers = 0;

io.on("connection", socket => {
    console.log("a user connected");
    onlineUsers++;
    io.emit("online-count", onlineUsers);

    socket.on("draw-point", data => socket.broadcast.emit("draw-point", data));
    socket.on("stroke-end", stroke => socket.broadcast.emit("stroke-end", stroke));

    // Global Undo/Redo Sync
    socket.on("undo", data => {
        // broadcast to everyone (including sender) — clients will ignore if needed
        io.emit("undo", data);
    });
    socket.on("redo", data => {
        io.emit("redo", data);
    });

    socket.on("disconnect", () => {
        console.log("user disconnected");
        onlineUsers--;
        io.emit("online-count", onlineUsers);
    });
});

server.listen(3000, () => console.log("Server running at http://localhost:3000"));
