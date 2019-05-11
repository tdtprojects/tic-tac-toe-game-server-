const _ = require("lodash");

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

const emitNextGame = (data, newData, gameScore, player1, player2, io) => {
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

module.exports = {
  calculateWinner,
  emitNextGame,
};
