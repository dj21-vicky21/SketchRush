const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = process.env.PORT || 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Game state management
const gameRooms = new Map();
const WORDS = [
  'cat', 'dog', 'house', 'car', 'tree', 'sun', 'moon', 'star', 'flower', 'bird',
  'fish', 'apple', 'cake', 'book', 'chair', 'table', 'phone', 'computer', 'pizza', 'guitar',
  'mountain', 'ocean', 'butterfly', 'rainbow', 'elephant', 'giraffe', 'penguin', 'dinosaur',
  'rocket', 'castle', 'princess', 'dragon', 'wizard', 'treasure', 'island', 'bridge',
  'bicycle', 'airplane', 'train', 'boat', 'umbrella', 'glasses', 'hat', 'shoe', 'watch',
  'camera', 'headphones', 'microphone', 'television', 'refrigerator', 'sandwich'
];

function createRoom(roomId, settings = {}) {
  const room = {
    id: roomId,
    players: new Map(),
    gameState: 'lobby', // lobby, playing, ended
    currentDrawer: null,
    currentWord: null,
    wordChoices: [],
    roundStartTime: null,
    scores: new Map(),
    settings: {
      rounds: settings.rounds || 3,
      drawTime: settings.drawTime || 80,
      maxPlayers: settings.maxPlayers || 8,
      ...settings
    },
    currentRound: 0,
    guessedPlayers: new Set(),
    gameHistory: [],
    lastDisconnect: {}, // Track disconnect timestamps to prevent spam
    roundTimer: null // Track the current round timer
  };
  gameRooms.set(roomId, room);
  return room;
}

function generateRoomId() {
  return Math.random().toString(36).substr(2, 6).toUpperCase();
}

function getRandomWords(count = 3) {
  const shuffled = [...WORDS].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

function calculatePoints(isDrawer, guessTime, maxTime) {
  if (isDrawer) {
    return Math.floor(50 + (guessTime / maxTime) * 50); // Drawer gets points for successful guesses
  } else {
    return Math.floor(100 - (guessTime / maxTime) * 50); // Guesser gets more points for faster guesses
  }
}

function isCloseGuess(guess, correctWord) {
  const guessLower = guess.toLowerCase().trim();
  const wordLower = correctWord.toLowerCase().trim();
  
  // Exact match - not close, it's correct!
  if (guessLower === wordLower) {
    return false;
  }
  
  // Check various "close" conditions
  
  // 1. Same length and mostly similar characters (for typos)
  if (Math.abs(guessLower.length - wordLower.length) <= 1) {
    let differences = 0;
    const maxLen = Math.max(guessLower.length, wordLower.length);
    
    for (let i = 0; i < maxLen; i++) {
      if (guessLower[i] !== wordLower[i]) {
        differences++;
      }
    }
    
    // Allow 1-2 character differences for same length words
    if (differences <= 2) {
      return true;
    }
  }
  
  // 2. One word contains the other (partial matches)
  if (wordLower.includes(guessLower) || guessLower.includes(wordLower)) {
    // Only if the difference isn't too big
    if (Math.abs(guessLower.length - wordLower.length) <= 3) {
      return true;
    }
  }
  
  // 3. Plural/singular variations
  if ((guessLower + 's' === wordLower) || (guessLower === wordLower + 's')) {
    return true;
  }
  
  // 4. Common letter swaps or missing letters
  if (Math.abs(guessLower.length - wordLower.length) <= 1) {
    // Check if it's just a missing/extra letter
    const longer = guessLower.length > wordLower.length ? guessLower : wordLower;
    const shorter = guessLower.length > wordLower.length ? wordLower : guessLower;
    
    for (let i = 0; i < longer.length; i++) {
      const withoutChar = longer.substring(0, i) + longer.substring(i + 1);
      if (withoutChar === shorter) {
        return true;
      }
    }
  }
  
  return false;
}

function getCloseMessage() {
  const messages = [
    'Close!',
    'So close!',
    'Almost!',
    'You\'re getting warmer!',
    'Very close!',
    'Nearly there!',
    'Close guess!',
    'Warm!'
  ];
  return messages[Math.floor(Math.random() * messages.length)];
}

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('create-room', (data) => {
      const roomId = generateRoomId();
      const room = createRoom(roomId, data.settings);
      
      console.log(`Creating room: ${roomId} by ${data.playerName}`);
      
      socket.join(roomId);
      socket.roomId = roomId;
      socket.playerName = data.playerName;
      
      room.players.set(socket.id, {
        id: socket.id,
        name: data.playerName,
        score: 0,
        isOwner: true
      });
      
      room.scores.set(socket.id, 0);
      
      console.log(`Room ${roomId} created successfully with player ${data.playerName}`);
      console.log(`Total rooms now:`, gameRooms.size);
      
      socket.emit('room-created', { roomId, room: { id: roomId, ...room } });
      socket.emit('players-updated', Array.from(room.players.values()));
    });

    socket.on('join-room', (data) => {
      const { roomId, playerName } = data;
      
      console.log(`Join room attempt: ${roomId} by "${playerName}"`);
      console.log(`Player name length:`, playerName ? playerName.length : 'undefined');
      
      if (!playerName || playerName.trim() === '') {
        socket.emit('error', { message: 'Player name is required. Please enter your name and try again.' });
        return;
      }
      
      const room = gameRooms.get(roomId);
      console.log(`Room exists:`, !!room);
      console.log(`Available rooms:`, Array.from(gameRooms.keys()));
      
      if (!room) {
        socket.emit('error', { message: 'Room not found. Please create a new room or check the room code.' });
        return;
      }
      
      if (room.players.size >= room.settings.maxPlayers) {
        socket.emit('error', { message: 'Room is full' });
        return;
      }
      
      // Check for reconnection scenarios only (allow duplicate names)
      let existingPlayer = null;
      let oldSocketId = null;
      let isReconnection = false;
      
      // Only check for reconnection if there's a recent disconnect with same socket
      if (room.lastDisconnect) {
        for (const [id, disconnectTime] of Object.entries(room.lastDisconnect)) {
          const timeSinceDisconnect = Date.now() - disconnectTime;
          if (timeSinceDisconnect <= 120000) { // 2 minutes - allow reconnection
            const player = room.players.get(id);
            if (player && player.name === playerName) {
              existingPlayer = player;
              oldSocketId = id;
              isReconnection = true;
              room.players.delete(id); // Remove old entry
              console.log(`Player ${playerName} reconnecting to room ${roomId}`);
              break;
            }
          }
        }
      }
      
      socket.join(roomId);
      socket.roomId = roomId;
      socket.playerName = playerName;
      
      room.players.set(socket.id, {
        id: socket.id,
        name: playerName,
        score: existingPlayer ? existingPlayer.score : 0,
        isOwner: existingPlayer ? existingPlayer.isOwner : false
      });
      
      if (!existingPlayer) {
        room.scores.set(socket.id, 0);
      } else {
        room.scores.set(socket.id, existingPlayer.score);
      }
      
      socket.emit('room-joined', { room });
      io.to(roomId).emit('players-updated', Array.from(room.players.values()));
      
      // Only send join message for genuinely new players
      if (!existingPlayer) {
        io.to(roomId).emit('chat-message', {
          type: 'system',
          message: `${playerName} joined the room`
        });
      } else {
        // For reconnections, only send message if it's been more than 10 seconds
        const now = Date.now();
        const timeSinceDisconnect = room.lastDisconnect && room.lastDisconnect[oldSocketId] ? 
          now - room.lastDisconnect[oldSocketId] : 0;
          
        console.log(`${playerName} reconnection - time since disconnect: ${timeSinceDisconnect}ms`);
        
        if (timeSinceDisconnect > 10000) { // 10 seconds threshold
          io.to(roomId).emit('chat-message', {
            type: 'system',
            message: `${playerName} reconnected`
          });
        } else {
          console.log(`${playerName} quick reconnection - no message sent`);
        }
        
        // Clear the disconnect timestamp
        if (room.lastDisconnect && room.lastDisconnect[oldSocketId]) {
          delete room.lastDisconnect[oldSocketId];
        }
      }
    });

    socket.on('start-game', () => {
      const room = gameRooms.get(socket.roomId);
      if (!room || room.gameState !== 'lobby') return;
      
      const player = room.players.get(socket.id);
      if (!player || !player.isOwner) return;
      
      // Check minimum players (at least 2)
      if (room.players.size < 2) {
        socket.emit('error', { message: 'Need at least 2 players to start the game!' });
        return;
      }
      
      room.gameState = 'playing';
      room.currentRound = 1;
      
      startNewRound(room);
      
      io.to(socket.roomId).emit('game-started');
    });

    socket.on('choose-word', (data) => {
      const room = gameRooms.get(socket.roomId);
      if (!room || room.currentDrawer !== socket.id) return;
      
      room.currentWord = data.word;
      room.roundStartTime = Date.now();
      room.guessedPlayers.clear();
      
      io.to(socket.roomId).emit('word-chosen', {
        drawer: socket.playerName,
        drawerId: socket.id,
        wordHint: data.word.replace(/./g, '_'),
        timeLeft: room.settings.drawTime
      });
      
      socket.emit('your-word', { word: data.word });
      
      // Clear any existing timer first
      if (room.roundTimer) {
        clearTimeout(room.roundTimer);
        room.roundTimer = null;
      }
      
      // Start new round timer
      room.roundTimer = setTimeout(() => {
        endRound(room);
      }, room.settings.drawTime * 1000);
    });

    socket.on('draw', (data) => {
      const room = gameRooms.get(socket.roomId);
      if (!room || room.currentDrawer !== socket.id) return;
      
      socket.to(socket.roomId).emit('draw', data);
    });

    socket.on('clear-canvas', () => {
      const room = gameRooms.get(socket.roomId);
      if (!room || room.currentDrawer !== socket.id) return;
      
      // Broadcast clear canvas to all players in the room (including the sender)
      io.to(socket.roomId).emit('clear-canvas');
    });

    socket.on('undo', (data) => {
      const room = gameRooms.get(socket.roomId);
      if (!room || room.currentDrawer !== socket.id) return;
      
      // Broadcast undo to all other players in the room
      socket.to(socket.roomId).emit('undo', {
        historyStep: data.historyStep,
        canvasData: data.canvasData
      });
    });

    socket.on('redo', (data) => {
      const room = gameRooms.get(socket.roomId);
      if (!room || room.currentDrawer !== socket.id) return;
      
      // Broadcast redo to all other players in the room
      socket.to(socket.roomId).emit('redo', {
        historyStep: data.historyStep,
        canvasData: data.canvasData
      });
    });

    socket.on('chat-message', (data) => {
      const room = gameRooms.get(socket.roomId);
      if (!room) return;
      
      const player = room.players.get(socket.id);
      if (!player) return;
      
      // Check if it's a guess
      if (room.gameState === 'playing' && room.currentDrawer !== socket.id && room.currentWord) {
        const guess = data.message.toLowerCase().trim();
        const word = room.currentWord.toLowerCase();
        
        if (guess === word && !room.guessedPlayers.has(socket.id)) {
          // Correct guess!
          room.guessedPlayers.add(socket.id);
          
          const elapsedTime = Date.now() - room.roundStartTime;
          const points = calculatePoints(false, elapsedTime, room.settings.drawTime * 1000);
          
          room.scores.set(socket.id, room.scores.get(socket.id) + points);
          player.score = room.scores.get(socket.id);
          
          // Give points to drawer too
          const drawerPoints = calculatePoints(true, elapsedTime, room.settings.drawTime * 1000);
          const drawerId = room.currentDrawer;
          room.scores.set(drawerId, room.scores.get(drawerId) + drawerPoints);
          room.players.get(drawerId).score = room.scores.get(drawerId);
          
          io.to(socket.roomId).emit('correct-guess', {
            player: player.name,
            points: points
          });
          
          io.to(socket.roomId).emit('players-updated', Array.from(room.players.values()));
          
          // Check if everyone guessed
          if (room.guessedPlayers.size === room.players.size - 1) {
            endRound(room);
          }
          
          return;
        } else if (!room.guessedPlayers.has(socket.id) && isCloseGuess(data.message, room.currentWord)) {
          // Close guess - send encouraging message
          io.to(socket.roomId).emit('chat-message', {
            type: 'close',
            player: player.name,
            message: data.message,
            closeMessage: getCloseMessage()
          });
          return;
        }
      }
      
      // Regular chat message
      io.to(socket.roomId).emit('chat-message', {
        type: 'player',
        player: player.name,
        message: data.message
      });
    });

    socket.on('reset-game', () => {
      const room = gameRooms.get(socket.roomId);
      if (!room) return;
      
      // Reset game state
      room.gameState = 'lobby';
      room.currentRound = 0;
      room.currentDrawer = null;
      room.currentWord = null;
      room.wordChoices = [];
      room.roundStartTime = null;
      room.guessedPlayers.clear();
      room.gameHistory = [];
      
      // Clear round timer if exists
      if (room.roundTimer) {
        clearTimeout(room.roundTimer);
        room.roundTimer = null;
      }
      
      // Reset all player scores
      room.players.forEach(player => {
        player.score = 0;
      });
      room.scores.clear();
      
      // Broadcast reset to all players
      io.to(socket.roomId).emit('game-reset');
      io.to(socket.roomId).emit('players-updated', Array.from(room.players.values()));
    });

    socket.on('reaction', (data) => {
      const room = gameRooms.get(socket.roomId);
      if (!room || room.gameState !== 'playing') return;
      
      // Don't allow drawer to react to their own drawing
      if (room.currentDrawer === socket.id) return;
      
      // Broadcast reaction to all players in the room
      io.to(socket.roomId).emit('reaction', {
        playerId: data.playerId,
        reaction: data.reaction
      });
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id, socket.playerName);
      
      if (socket.roomId) {
        const room = gameRooms.get(socket.roomId);
        if (room) {
          const player = room.players.get(socket.id);
          
          if (player) {
            // Track disconnect time to prevent spam messages (use socket ID for unique tracking)
            if (!room.lastDisconnect) room.lastDisconnect = {};
            room.lastDisconnect[socket.id] = Date.now();
          }
          
          // Don't immediately remove the player if they're the owner of a lobby game
          // Give them a chance to reconnect
          if (player && player.isOwner && room.gameState === 'lobby') {
            console.log(`Room owner ${player.name} disconnected from room ${socket.roomId}, keeping room alive for 30 seconds`);
            
            setTimeout(() => {
              const currentRoom = gameRooms.get(socket.roomId);
              if (currentRoom && currentRoom.players.has(socket.id)) {
                // They didn't reconnect, remove them
                currentRoom.players.delete(socket.id);
                currentRoom.scores.delete(socket.id);
                
                // Only show leave message if they were disconnected for more than 5 seconds
                const now = Date.now();
                if (!currentRoom.lastDisconnect[socket.id] || (now - currentRoom.lastDisconnect[socket.id]) > 5000) {
                  io.to(socket.roomId).emit('chat-message', {
                    type: 'system',
                    message: `${player.name} left the room`
                  });
                }
                
                io.to(socket.roomId).emit('players-updated', Array.from(currentRoom.players.values()));
                
                if (currentRoom.players.size === 0) {
                  console.log(`Cleaning up empty room: ${socket.roomId}`);
                  gameRooms.delete(socket.roomId);
                }
              }
            }, 30000);
            
            return;
          }
          
          room.players.delete(socket.id);
          room.scores.delete(socket.id);
          
          if (player) {
            // Only show leave message if they were disconnected for more than 5 seconds
            const now = Date.now();
            if (!room.lastDisconnect[socket.id] || (now - room.lastDisconnect[socket.id]) > 5000) {
              io.to(socket.roomId).emit('chat-message', {
                type: 'system',
                message: `${player.name} left the room`
              });
            }
          }
          
          io.to(socket.roomId).emit('players-updated', Array.from(room.players.values()));
          
          // If drawer left, end round
          if (room.currentDrawer === socket.id && room.gameState === 'playing') {
            endRound(room);
          }
          
          // Clean up empty rooms
          if (room.players.size === 0) {
            console.log(`Cleaning up empty room: ${socket.roomId}`);
            gameRooms.delete(socket.roomId);
          }
        }
      }
    });
  });

  function startNewRound(room) {
    // Clear any existing timer first
    if (room.roundTimer) {
      clearTimeout(room.roundTimer);
      room.roundTimer = null;
    }
    
    const playerIds = Array.from(room.players.keys());
    const drawerIndex = (room.currentRound - 1) % playerIds.length;
    room.currentDrawer = playerIds[drawerIndex];
    room.wordChoices = getRandomWords(3);
    room.currentWord = null;
    room.guessedPlayers.clear();
    
    const drawer = room.players.get(room.currentDrawer);
    
    io.to(room.id).emit('new-round', {
      round: room.currentRound,
      totalRounds: room.settings.rounds,
      drawer: drawer.name,
      drawerId: room.currentDrawer
    });
    
    io.to(room.currentDrawer).emit('choose-word', {
      words: room.wordChoices
    });
    
    io.to(room.id).emit('clear-canvas');
  }

  function endRound(room) {
    if (room.gameState !== 'playing') return;
    
    // Clear the round timer
    if (room.roundTimer) {
      clearTimeout(room.roundTimer);
      room.roundTimer = null;
    }
    
    room.gameHistory.push({
      round: room.currentRound,
      word: room.currentWord,
      drawer: room.players.get(room.currentDrawer)?.name,
      guessedPlayers: Array.from(room.guessedPlayers).map(id => room.players.get(id)?.name)
    });
    
    io.to(room.id).emit('round-ended', {
      word: room.currentWord,
      drawer: room.players.get(room.currentDrawer)?.name,
      scores: Array.from(room.players.values()).sort((a, b) => b.score - a.score)
    });
    
    if (room.currentRound >= room.settings.rounds) {
      // Game ended
      room.gameState = 'ended';
      const finalScores = Array.from(room.players.values()).sort((a, b) => b.score - a.score);
      
      io.to(room.id).emit('game-ended', {
        winner: finalScores[0],
        scores: finalScores,
        gameHistory: room.gameHistory
      });
    } else {
      // Next round
      room.currentRound++;
      setTimeout(() => {
        startNewRound(room);
      }, 5000); // 5 second break between rounds
    }
  }

  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
