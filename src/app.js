const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const _ = require("lodash");

const port = process.env.PORT || 4001;

const index = require("./routes/index");

const app = express();
app.use(index);

const server = http.createServer(app);
const io = socketIo(server);

const players = [];
let rooms = 0;

const calculateWinner = (squares) => {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];

  for (let i = 0; i < lines.length; i += 1) {
    const [a, b, c] = lines[i];
    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
      return { winner: squares[a], line: lines[i] };
    }
  }

  return null;
};

const emitNextGame = (data, newData, gameScore, player1, player2) => {
  io.to(data.room).emit('playerTurned', {
    ...newData,
    gameScore,
    player1: {
      ...player1,
      nextTurn: !data.player1.nextTurn,
    },
    player2: {
      ...player2,
      nextTurn: !data.player2.nextTurn,
    },
    winner: null,
    isDraw: false,
    cells: _.fill(Array(9), null),
  });
};

io.on("connection", socket => {
  console.log("New client connected", socket.id);

  socket.on('createGame', (name) => {
    socket.join(++rooms);
    socket.emit('newGame', { name, room: rooms });

    players.push({
      name,
      id: socket.id,
      room: rooms,
    });
  });

  socket.on('joinGame', (data) => {
    const room = io.nsps['/'].adapter.rooms[data.room];

    if (room && room.length === 1) {
      socket.join(data.room);

      players.push({
        name: data.name,
        id: socket.id,
        room: data.room,
      });

      io.to(data.room).emit('startGame');

      const cells = _.fill(Array(9), null);

      const player1 = players[players.findIndex(({id}) => id === Object.keys(room.sockets)[0])];
      const player2 = players[players.findIndex(({id}) => id === Object.keys(room.sockets)[1])];

      const gameData = {
        player1: {
          ...player1,
          icon: 'X',
          nextTurn: true,
        },
        player2: {
          ...player2,
          icon: 'O',
          nextTurn: false,
        },
        cells,
        room: data.room,
        gameScore: {
          [player1.name]: 0,
          [player2.name]: 0,
          draws: 0,
        },
      };

      io.to(data.room).emit('game', gameData);
    }

    else if (room && room.length > 1) {
      socket.emit('joinGameError', { message: 'Sorry, The room is full!' });
    }

    else {
      socket.emit('joinGameError', { message: 'Sorry, there is no such room!' });
    }
  });

  socket.on('playTurn', (data) => {
    const cells = data.cells;
    cells[data.cell] = data.icon;

    const winner = calculateWinner(cells);

    const isDraw = winner ? false : cells.every(line => !!line);

    const player1 = {
      ...data.player1,
      nextTurn: winner || isDraw ? data.player1.nextTurn : !data.player1.nextTurn,
    };

    const player2 = {
      ...data.player2,
      nextTurn: winner || isDraw ? data.player2.nextTurn : !data.player2.nextTurn,
    };

    const newData = {
      ...data,
      cells,
      player1,
      player2,
      winner,
      isDraw,
    };

    io.to(data.room).emit('playerTurned', newData);

    if (winner) {
      _.delay(() => {
        const gameScore = {
          ...data.gameScore,
          [player1.name]: data.player1.icon === winner.winner ? data.gameScore[player1.name] + 1 : data.gameScore[player1.name],
          [player2.name]: data.player2.icon === winner.winner ? data.gameScore[player2.name] + 1 : data.gameScore[player2.name],
        };

        io.to(data.room).emit('winner', gameScore);
        emitNextGame(data, newData, gameScore, player1, player2);
      }, 2500);
    }

    if (isDraw) {
      _.delay(() => {
        const gameScore = {
          ...data.gameScore,
          draws: data.gameScore.draws + 1,
        };

        io.to(data.room).emit('winner', gameScore);
        emitNextGame(data, newData, gameScore, player1, player2);
      }, 2500);
    }
  });

  socket.on('leaveGame', (data) => {
    const index = players.findIndex(({ id }) => id === data.id);

    if (index !== -1) {
      players.splice(index, 1);
    }

    io.to(data.room).emit('playerDisconnected', data);
  });

  socket.on("disconnect", () => {
    const index = players.findIndex(({ id }) => id === socket.id);

    console.log("Client disconnected: ", socket.id);

    if (index !== -1) {
      io.to(players[index].room).emit('playerDisconnected', players[index]);
      players.splice(index, 1);
    }
  });
});

server.listen(port, () => console.log(`Listening on port ${port}`));
