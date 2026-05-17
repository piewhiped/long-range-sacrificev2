const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http, {
  cors: { origin: "*" }
});

app.use(express.static("public"));

const players = {};

io.on("connection", (socket) => {
  console.log("Player connected:", socket.id);

  const spawnX = Math.random() * 200 - 100;
  const spawnZ = Math.random() * 200 - 100;

  players[socket.id] = {
    x: spawnX,
    y: 1.7,
    z: spawnZ,
    rotY: 0,
    health: 100,
    kills: 0,
    deaths: 0,
    name: "Player_" + socket.id.substring(0, 4)
  };

  socket.emit("init", { id: socket.id, players });

  socket.broadcast.emit("playerJoined", {
    id: socket.id,
    player: players[socket.id]
  });

  socket.on("move", (data) => {
    if (!players[socket.id]) return;
    players[socket.id].x = data.x;
    players[socket.id].y = data.y;
    players[socket.id].z = data.z;
    players[socket.id].rotY = data.rotY;
    socket.broadcast.emit("playerMoved", { id: socket.id, ...data });
  });

  socket.on("shoot", (data) => {
    // data: { ox, oy, oz, dx, dy, dz }
    socket.broadcast.emit("bulletFired", { id: socket.id, ...data });

    // Server-side hit detection
    for (let pid in players) {
      if (pid === socket.id) continue;
      const p = players[pid];
      const hit = rayIntersectsBox(
        { x: data.ox, y: data.oy, z: data.oz },
        { x: data.dx, y: data.dy, z: data.dz },
        { x: p.x - 0.4, y: p.y - 1.7, z: p.z - 0.4 },
        { x: p.x + 0.4, y: p.y + 0.3, z: p.z + 0.4 }
      );
      if (hit) {
        players[pid].health -= 100; // One shot one kill
        if (players[pid].health <= 0) {
          players[pid].health = 100;
          players[pid].x = Math.random() * 200 - 100;
          players[pid].z = Math.random() * 200 - 100;
          players[socket.id].kills = (players[socket.id].kills || 0) + 1;
          players[pid].deaths = (players[pid].deaths || 0) + 1;

          io.emit("playerKilled", {
            killer: socket.id,
            victim: pid,
            killerName: players[socket.id].name,
            victimName: players[pid].name,
            spawnX: players[pid].x,
            spawnZ: players[pid].z
          });
          io.emit("scoreUpdate", {
            id: socket.id,
            kills: players[socket.id].kills,
            id2: pid,
            deaths: players[pid].deaths
          });
        }
        break;
      }
    }
  });

  socket.on("setName", (name) => {
    if (players[socket.id]) {
      players[socket.id].name = name.substring(0, 16);
      socket.broadcast.emit("nameUpdate", { id: socket.id, name: players[socket.id].name });
    }
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
    io.emit("playerLeft", socket.id);
    console.log("Player disconnected:", socket.id);
  });
});

function rayIntersectsBox(origin, dir, min, max) {
  let tmin = -Infinity, tmax = Infinity;
  const axes = ['x', 'y', 'z'];
  for (const a of axes) {
    if (Math.abs(dir[a]) < 1e-8) {
      if (origin[a] < min[a] || origin[a] > max[a]) return false;
    } else {
      let t1 = (min[a] - origin[a]) / dir[a];
      let t2 = (max[a] - origin[a]) / dir[a];
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return false;
    }
  }
  return tmax >= 0 && tmin < 500; // max sniper range
}

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Long Range Sacrifice running on port ${PORT}`);
});
