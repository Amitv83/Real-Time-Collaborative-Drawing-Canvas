const socket = io('http://localhost:3000');

const canvas = document.querySelector("canvas"),
      toolBtns = document.querySelectorAll(".tool"),
      sizeSlider = document.querySelector("#size-slider"),
      colorBtns = document.querySelectorAll(".colors .option"),
      colorPicker = document.querySelector("#color-picker"),
      clearCanvas = document.querySelector(".clear-canvas"),
      saveImg = document.querySelector(".save-img"),
      undoBtn = document.querySelector(".undo-btn"),
      redoBtn = document.querySelector(".redo-btn"),
      onlineCount = document.querySelector("#online-count"),
      ctx = canvas.getContext("2d");

let isDrawing = false,
    selectedTool = "brush",
    brushWidth = 5,
    selectedColor = '#000',
    strokes = [],        // all strokes drawn (global)
    myStrokes = [],      // only your strokes (ordered)
    redoStrokes = [],    // redo stack (your undone strokes)
    currentStroke = null;

// helper: generate unique stroke id
const makeStrokeId = () => `${socket.id}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;

// Setup canvas
window.addEventListener("load", () => {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
});

// Start drawing
const startDraw = (e) => {
    isDrawing = true;
    currentStroke = {
        id: socket.id,               // owner socket id
        strokeId: makeStrokeId(),    // unique stroke id
        type: 'stroke',
        color: selectedTool === "eraser" ? "#fff" : selectedColor,
        width: brushWidth,
        points: [{ x: e.offsetX, y: e.offsetY }]
    };

    // no emit on start — we emit points as they come and final stroke on stop
};

// Drawing - local and broadcast points
const drawing = (e) => {
    if (!isDrawing || !currentStroke) return;
    const point = { x: e.offsetX, y: e.offsetY };
    const points = currentStroke.points;
    points.push(point);

    // Draw locally
    ctx.strokeStyle = currentStroke.color;
    ctx.lineWidth = currentStroke.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(points[points.length - 2].x, points[points.length - 2].y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();

    // Broadcast this segment (include strokeId so receivers can keep consistency)
    socket.emit('draw-point', {
        id: socket.id,
        strokeId: currentStroke.strokeId,
        x1: points[points.length - 2].x,
        y1: points[points.length - 2].y,
        x2: point.x,
        y2: point.y,
        color: currentStroke.color,
        width: currentStroke.width
    });
};

// Stop draw: finalize stroke and broadcast it
const stopDraw = () => {
    if (!isDrawing || !currentStroke) return;
    isDrawing = false;

    // push to local structures
    strokes.push(currentStroke);
    myStrokes.push(currentStroke);
    redoStrokes = []; // clear redo on new action

    // broadcast final stroke object (so others can add it to their stroke lists)
    socket.emit('stroke-end', currentStroke);

    currentStroke = null;
};

// Redraw all strokes (used after undo/redo/clear)
const redrawCanvas = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (const stroke of strokes) {
        if (stroke.type === 'stroke') {
            ctx.strokeStyle = stroke.color;
            ctx.lineWidth = stroke.width;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.beginPath();
            stroke.points.forEach((p, i) => {
                if (i === 0) ctx.moveTo(p.x, p.y);
                else ctx.lineTo(p.x, p.y);
            });
            ctx.stroke();
        }
    }
};

// --- Undo/Redo (emit events so change is global) ---

const undo = () => {
    if (!myStrokes.length) return;
    const lastStroke = myStrokes.pop();
    redoStrokes.push(lastStroke);

    // remove from global strokes by strokeId
    strokes = strokes.filter(s => s.strokeId !== lastStroke.strokeId);
    redrawCanvas();

    // inform server & everyone which strokeId to remove
    socket.emit('undo', { userId: socket.id, strokeId: lastStroke.strokeId });
};

const redo = () => {
    if (!redoStrokes.length) return;
    const nextStroke = redoStrokes.pop();
    myStrokes.push(nextStroke);

    // add to global strokes
    strokes.push(nextStroke);
    redrawCanvas();

    // inform server & everyone to re-add this stroke
    socket.emit('redo', { userId: socket.id, stroke: nextStroke });
};

// Clear only on this tab (but you can change to emit if you want global clear)
const clearLocal = () => {
    if (strokes.length === 0) return;
    myStrokes.push({ id: socket.id, type: 'clear', snapshot: strokes.slice(), actionId: makeStrokeId() });
    redoStrokes = [];
    strokes = [];
    redrawCanvas();
};

canvas.addEventListener("mousedown", startDraw);
canvas.addEventListener("mousemove", drawing);
canvas.addEventListener("mouseup", stopDraw);
canvas.addEventListener("mouseout", stopDraw);

undoBtn.addEventListener("click", undo);
redoBtn.addEventListener("click", redo);
document.addEventListener("keydown", e => {
    if (e.ctrlKey && e.key === "z") undo();
    if (e.ctrlKey && (e.key === "y" || e.key === "Z")) redo();
});

toolBtns.forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelector(".options .active")?.classList.remove("active");
        btn.classList.add("active");
        selectedTool = btn.id;
    });
});

sizeSlider.addEventListener("change", () => brushWidth = Number(sizeSlider.value));

colorBtns.forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelector(".options .selected")?.classList.remove("selected");
        btn.classList.add("selected");
        selectedColor = window.getComputedStyle(btn).getPropertyValue("background-color");
    });
});

colorPicker.addEventListener("change", () => {
    selectedColor = colorPicker.value;
    colorPicker.parentElement.style.background = colorPicker.value;
});

clearCanvas.addEventListener("click", clearLocal);

saveImg.addEventListener("click", () => {
    const link = document.createElement("a");
    link.download = "drawing.png";
    link.href = canvas.toDataURL();
    link.click();
});


socket.on('draw-point', data => {
    ctx.save();
    ctx.strokeStyle = data.color;
    ctx.lineWidth = data.width;
    ctx.beginPath();
    ctx.moveTo(data.x1, data.y1);
    ctx.lineTo(data.x2, data.y2);
    ctx.stroke();
    ctx.restore();
});

socket.on('stroke-end', stroke => {
    if (stroke.id === socket.id) return;
    strokes.push(stroke);
});

socket.on('undo', ({ userId, strokeId }) => {
    strokes = strokes.filter(s => s.strokeId !== strokeId);
    redrawCanvas();
});

socket.on('redo', ({ userId, stroke }) => {
    if (!strokes.find(s => s.strokeId === stroke.strokeId)) {
        strokes.push(stroke);
        redrawCanvas();
    }
});

socket.on('clear', data => {
    strokes = [];
    redrawCanvas();
});

socket.on('online-count', count => onlineCount.textContent = `Online: ${count}`);
