'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { io } from 'socket.io-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const canvasRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [gameData, setGameData] = useState(null);
  const [gameState, setGameState] = useState('lobby');
  const [players, setPlayers] = useState([]);
  const [currentDrawer, setCurrentDrawer] = useState('');
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentWord, setCurrentWord] = useState('');
  const [wordHint, setWordHint] = useState('');
  const [wordChoices, setWordChoices] = useState([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [round, setRound] = useState(0);
  const [totalRounds, setTotalRounds] = useState(0);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);
  const [winner, setWinner] = useState(null);
  const [currentTimer, setCurrentTimer] = useState(null);
  
  // Name input dialog state
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [nameDialogResolver, setNameDialogResolver] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [lobbyCountdown, setLobbyCountdown] = useState(3);
  const [reactions, setReactions] = useState({}); // { playerId: 'thumbsUp' | 'thumbsDown' | null }
  const [wordSelectionTimer, setWordSelectionTimer] = useState(15);
  const [wordSelectionInterval, setWordSelectionInterval] = useState(null);

  // Drawing state
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [currentColor, setCurrentColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(5);
  const [currentTool, setCurrentTool] = useState('brush'); // 'brush' or 'bucket'
  const [lastX, setLastX] = useState(0);
  const [lastY, setLastY] = useState(0);
  const [canvasHistory, setCanvasHistory] = useState([]);
  const [historyStep, setHistoryStep] = useState(-1);

  const colors = [
    '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00',
    '#FF00FF', '#00FFFF', '#FFA500', '#800080', '#FFC0CB', '#A52A2A'
  ];

  // Function to show name input dialog
  const showNameInputDialog = (message = 'Enter your name to join the room:') => {
    return new Promise((resolve) => {
      console.log('Showing name dialog...');
      setNameInput('');
      setShowNameDialog(true);
      setNameDialogResolver(() => resolve);
    });
  };

  // Handle name dialog submission
  const handleNameSubmit = () => {
    if (nameInput.trim()) {
      setShowNameDialog(false);
      if (nameDialogResolver) {
        nameDialogResolver(nameInput.trim());
        setNameDialogResolver(null);
      }
    }
  };

  // Handle name dialog cancel
  const handleNameCancel = () => {
    setShowNameDialog(false);
    if (nameDialogResolver) {
      nameDialogResolver(null);
      setNameDialogResolver(null);
    }
  };

  // Handle reactions
  const sendReaction = (reactionType) => {
    if (!socket || !gameData || isDrawingMode) return;
    
    socket.emit('reaction', {
      playerId: gameData.playerName,
      reaction: reactionType
    });
  };

  // Initialize game data on mount
  useEffect(() => {
    const initializeGameData = async () => {
      try {
        // Get game data from localStorage
        const savedGameData = localStorage.getItem('gameData');
        console.log('Retrieved game data:', savedGameData);
        
        let parsedGameData;
        
        if (!savedGameData) {
          // No game data found - this could be a direct link access
          // Create temporary game data and prompt for name
          console.log('No saved game data, showing name dialog...');
          const playerName = await showNameInputDialog('Enter your name to join the room:');
          console.log('Received player name:', playerName);
          if (!playerName || playerName.trim() === '') {
            localStorage.setItem('gameError', 'Please enter your name to join the room.');
            router.push('/');
            return;
          }
        
        parsedGameData = {
          roomId: params.roomId,
          playerName: playerName.trim(),
          isOwner: false
        };
        
        // Save the game data for future use
        localStorage.setItem('gameData', JSON.stringify(parsedGameData));
      } else {
        try {
          parsedGameData = JSON.parse(savedGameData);
          console.log('Parsed game data:', parsedGameData);
        } catch (e) {
          console.error('Failed to parse game data:', e);
          localStorage.removeItem('gameData');
          localStorage.setItem('gameError', 'Invalid game data. Please try again.');
          router.push('/');
          return;
        }
        
        // Check if the URL room ID matches the saved game data
        if (parsedGameData.roomId !== params.roomId) {
          // Different room - prompt for name for this new room
          const playerName = await showNameInputDialog('Enter your name to join this room:');
          if (!playerName || playerName.trim() === '') {
            localStorage.setItem('gameError', 'Please enter your name to join the room.');
            router.push('/');
            return;
          }
          
          parsedGameData = {
            roomId: params.roomId,
            playerName: playerName.trim(),
            isOwner: false
          };
          
          // Update the game data
          localStorage.setItem('gameData', JSON.stringify(parsedGameData));
        }
        
        // Validate player name
        if (!parsedGameData.playerName || parsedGameData.playerName.trim() === '') {
          const playerName = await showNameInputDialog('Enter your name to join the room:');
          if (!playerName || playerName.trim() === '') {
            localStorage.setItem('gameError', 'Please enter your name to join the room.');
            router.push('/');
            return;
          }
          
          parsedGameData.playerName = playerName.trim();
          localStorage.setItem('gameData', JSON.stringify(parsedGameData));
        }
      }
      
        setGameData(parsedGameData);
        setIsInitializing(false);
      } catch (error) {
        console.error('Error initializing game data:', error);
        localStorage.setItem('gameError', 'Failed to initialize game. Please try again.');
        router.push('/');
      }
    };

    initializeGameData();
  }, [params.roomId, router]);

  // Initialize socket connection when gameData is available
  useEffect(() => {
    if (!gameData) return;

    // Initialize socket connection with better error handling
    const newSocket = io({
      transports: ['websocket', 'polling'],
      upgrade: true,
      rememberUpgrade: true
    });
    
    newSocket.on('connect', () => {
      console.log('Game socket connected:', newSocket.id);
    });
    
    newSocket.on('connect_error', (error) => {
      console.error('Game socket connection error:', error);
      localStorage.setItem('gameError', 'Connection failed. Please try again from the lobby.');
      router.push('/');
      return;
    });
    
    setSocket(newSocket);

    // Socket event listeners
    newSocket.on('players-updated', (updatedPlayers) => {
      setPlayers(updatedPlayers);
    });

    newSocket.on('game-started', () => {
      setGameState('playing');
      setMessages(prev => [...prev, { type: 'system', message: 'Game started!' }]);
    });

    newSocket.on('new-round', (data) => {
      // Clear any existing timer
      if (currentTimer) {
        clearInterval(currentTimer);
        setCurrentTimer(null);
      }
      
      setRound(data.round);
      setTotalRounds(data.totalRounds);
      setCurrentDrawer(data.drawer);
      setIsMyTurn(data.drawerId === newSocket.id);
      setWordHint('');
      setCurrentWord('');
      setWordChoices([]);
      setTimeLeft(0);
      setReactions({});
      
      // Reset canvas and drawing settings
      clearCanvas();
      setBrushSize(5);
      setCurrentColor('#000000');
      setCurrentTool('brush');
      setIsDrawingMode(false);
      
      // Reset canvas history for new round
      setTimeout(() => {
        const canvas = canvasRef.current;
        if (canvas) {
          const initialState = canvas.toDataURL();
          setCanvasHistory([initialState]);
          setHistoryStep(0);
        }
      }, 200);
      
      setMessages(prev => [...prev, { 
        type: 'system', 
        message: `Round ${data.round}/${data.totalRounds} - ${data.drawer} is drawing` 
      }]);
    });

    newSocket.on('choose-word', (data) => {
      setWordChoices(data.words);
    });

    newSocket.on('word-chosen', (data) => {
      // Clear any existing timer first
      if (currentTimer) {
        clearInterval(currentTimer);
        setCurrentTimer(null);
      }
      
      setCurrentDrawer(data.drawer);
      setWordHint(data.wordHint);
      setTimeLeft(data.timeLeft);
      setIsDrawingMode(data.drawerId === newSocket.id);
      
      // Reset canvas for new drawer
      clearCanvas();
      setBrushSize(5);
      setCurrentColor('#000000');
      setCurrentTool('brush');
      
      // Reset canvas history for new turn
      setTimeout(() => {
        const canvas = canvasRef.current;
        if (canvas) {
          const initialState = canvas.toDataURL();
          setCanvasHistory([initialState]);
          setHistoryStep(0);
        }
      }, 100);
      
      if (data.drawerId === newSocket.id) {
        setMessages(prev => [...prev, { type: 'system', message: 'Your turn! Start drawing!' }]);
      } else {
        setMessages(prev => [...prev, { type: 'system', message: `${data.drawer} is drawing: ${data.wordHint}` }]);
      }

      // Start new timer countdown
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            setCurrentTimer(null);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      setCurrentTimer(timer);
    });

    newSocket.on('your-word', (data) => {
      setCurrentWord(data.word);
    });

    newSocket.on('draw', (data) => {
      drawOnCanvas(data);
    });

    newSocket.on('clear-canvas', () => {
      clearCanvas();
    });

    newSocket.on('undo', (data) => {
      if (data.canvasData) {
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          const img = new Image();
          img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
          };
          img.src = data.canvasData;
        }
      }
    });

    newSocket.on('redo', (data) => {
      if (data.canvasData) {
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          const img = new Image();
          img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
          };
          img.src = data.canvasData;
        }
      }
    });

    newSocket.on('chat-message', (data) => {
      setMessages(prev => [...prev, data]);
    });

    newSocket.on('correct-guess', (data) => {
      setMessages(prev => [...prev, { 
        type: 'correct', 
        message: `${data.player} guessed correctly! (+${data.points} points)` 
      }]);
    });

    newSocket.on('round-ended', (data) => {
      setMessages(prev => [...prev, { 
        type: 'system', 
        message: `Round ended! The word was: ${data.word}` 
      }]);
      setIsDrawingMode(false);
      setWordChoices([]);
      setCurrentWord('');
      setWordHint('');
    });

    newSocket.on('game-ended', (data) => {
      setGameEnded(true);
      setWinner(data.winner);
      setGameState('ended');
      setMessages(prev => [...prev, { 
        type: 'system', 
        message: `Game ended! Winner: ${data.winner.name} with ${data.winner.score} points!` 
      }]);
    });

    newSocket.on('error', (data) => {
      // Store error message in localStorage so we can show it on the home page
      localStorage.setItem('gameError', data.message);
      router.push('/');
    });

    newSocket.on('game-reset', () => {
      // Handle game reset from server
      setGameEnded(false);
      setGameState('lobby');
      setWinner(null);
      setRound(0);
      setTotalRounds(0);
      setCurrentDrawer('');
      setWordHint('');
      setCurrentWord('');
      setTimeLeft(0);
      setIsDrawingMode(false);
      setWordChoices([]);
      setCurrentWord('');
      setReactions({});
      
      // Reset canvas
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalCompositeOperation = 'source-over';
      }
      
      // Reset drawing settings
      setBrushSize(5);
      setCurrentColor('#000000');
      setCurrentTool('brush');
      setCanvasHistory([]);
      setHistoryStep(-1);
    });

    newSocket.on('reaction', (data) => {
      setReactions(prev => ({
        ...prev,
        [data.playerId]: data.reaction
      }));
      
      // Clear reaction after 3 seconds
      setTimeout(() => {
        setReactions(prev => ({
          ...prev,
          [data.playerId]: null
        }));
      }, 3000);
    });

    // Rejoin room 
    console.log('Attempting to join room:', gameData.roomId, 'with player name:', gameData.playerName);
    
    if (!gameData.playerName || gameData.playerName.trim() === '') {
      localStorage.setItem('gameError', 'Invalid player name. Please try again from the lobby.');
      router.push('/');
      return;
    }
    
    newSocket.emit('join-room', {
      roomId: gameData.roomId,
      playerName: gameData.playerName
    });

    return () => {
      newSocket.close();
    };
  }, [gameData, router]);

  // Auto return to lobby when game ends
  useEffect(() => {
    if (gameEnded) {
      setLobbyCountdown(3); // Reset countdown
      
      const countdownInterval = setInterval(() => {
        setLobbyCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            // Return to lobby
            setGameEnded(false);
            setGameState('lobby');
            setWinner(null);
            setRound(0);
            setTotalRounds(0);
            setCurrentDrawer('');
            setWordHint('');
            setCurrentWord('');
            setTimeLeft(0);
            // Reset canvas and drawing settings
            const canvas = canvasRef.current;
            if (canvas) {
              const ctx = canvas.getContext('2d');
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.lineCap = 'round';
              ctx.lineJoin = 'round';
              ctx.globalCompositeOperation = 'source-over';
            }
            setBrushSize(5);
            setCurrentColor('#000000');
            setCurrentTool('brush');
            setCanvasHistory([]);
            setHistoryStep(-1);
            // Reset player scores locally and notify server
            setPlayers(prev => prev.map(player => ({ ...player, score: 0 })));
            // Tell server to reset the game
            if (socket) {
              socket.emit('reset-game');
            }
            setMessages(prev => [...prev, { type: 'system', message: 'Ready for another game!' }]);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(countdownInterval);
    }
  }, [gameEnded]);

  // Word selection timer
  useEffect(() => {
    if (wordChoices.length > 0) {
      setWordSelectionTimer(15);
      
      const interval = setInterval(() => {
        setWordSelectionTimer(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            setWordSelectionInterval(null);
            
            // Auto-select a random word
            if (wordChoices.length > 0 && socket) {
              const randomWord = wordChoices[Math.floor(Math.random() * wordChoices.length)];
              socket.emit('choose-word', { word: randomWord });
              setWordChoices([]);
            }
            
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      setWordSelectionInterval(interval);
      
      return () => {
        clearInterval(interval);
        setWordSelectionInterval(null);
      };
    } else {
      // Clear timer when no word choices
      if (wordSelectionInterval) {
        clearInterval(wordSelectionInterval);
        setWordSelectionInterval(null);
      }
      setWordSelectionTimer(15);
    }
  }, [wordChoices, socket]);

  // Initialize canvas when component mounts
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalCompositeOperation = 'source-over';
      
      // Save initial canvas state
      const initialState = canvas.toDataURL();
      setCanvasHistory([initialState]);
      setHistoryStep(0);
    }
  }, []);

  const startGame = () => {
    if (socket && gameData?.isOwner) {
      socket.emit('start-game');
    }
  };

  const chooseWord = useCallback((word) => {
    if (socket) {
      socket.emit('choose-word', { word });
      setWordChoices([]);
      
      // Clear word selection timer
      if (wordSelectionInterval) {
        clearInterval(wordSelectionInterval);
        setWordSelectionInterval(null);
      }
      setWordSelectionTimer(15);
    }
  }, [socket, wordSelectionInterval]);

  const saveCanvasState = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const dataURL = canvas.toDataURL();
      
      // Don't save duplicate states
      if (canvasHistory.length > 0 && canvasHistory[canvasHistory.length - 1] === dataURL) {
        return;
      }
      
      const newHistory = canvasHistory.slice(0, historyStep + 1);
      newHistory.push(dataURL);
      setCanvasHistory(newHistory);
      setHistoryStep(newHistory.length - 1);
      
      // Limit history to 20 states to prevent memory issues
      if (newHistory.length > 20) {
        const trimmedHistory = newHistory.slice(-20);
        setCanvasHistory(trimmedHistory);
        setHistoryStep(trimmedHistory.length - 1);
      }
    }
  }, [canvasHistory, historyStep]);

  const undo = useCallback(() => {
    if (historyStep > 0 && isDrawingMode) {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
        };
        img.src = canvasHistory[historyStep - 1];
        setHistoryStep(historyStep - 1);
        
        // Emit undo to other players with canvas data
        socket?.emit('undo', { 
          historyStep: historyStep - 1,
          canvasData: canvasHistory[historyStep - 1]
        });
      }
    }
  }, [historyStep, canvasHistory, socket, isDrawingMode]);

  const redo = useCallback(() => {
    if (historyStep < canvasHistory.length - 1 && isDrawingMode) {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
        };
        img.src = canvasHistory[historyStep + 1];
        setHistoryStep(historyStep + 1);
        
        // Emit redo to other players with canvas data
        socket?.emit('redo', { 
          historyStep: historyStep + 1,
          canvasData: canvasHistory[historyStep + 1]
        });
      }
    }
  }, [historyStep, canvasHistory, socket, isDrawingMode]);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      // Save state before clearing
      saveCanvasState();
      
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Reset drawing properties
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalCompositeOperation = 'source-over';
      
      // Save state after clearing
      setTimeout(() => saveCanvasState(), 100);
    }
  }, [saveCanvasState]);

  const drawOnCanvas = useCallback((data) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    // Since coordinates are already in canvas space, use them directly
    if (data.type === 'start') {
      ctx.beginPath();
      ctx.strokeStyle = data.color;
      ctx.lineWidth = data.size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(data.x, data.y);
    } else if (data.type === 'draw') {
      ctx.lineTo(data.x, data.y);
      ctx.stroke();
      ctx.beginPath(); // Start new path to prevent color bleeding
      ctx.strokeStyle = data.color;
      ctx.lineWidth = data.size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(data.x, data.y);
    } else if (data.type === 'end') {
      // End the current path
      ctx.stroke();
    } else if (data.type === 'fill') {
      floodFill(ctx, data.x, data.y, data.color);
    }
  }, []);

  // Flood fill algorithm for paint bucket
  const floodFill = useCallback((ctx, startX, startY, fillColor) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const width = canvas.width;
    const height = canvas.height;

    // Convert fill color to RGB
    const fillColorRgb = hexToRgb(fillColor);
    if (!fillColorRgb) return;

    // Get the color at the starting point
    const startIndex = (Math.floor(startY) * width + Math.floor(startX)) * 4;
    const startR = data[startIndex];
    const startG = data[startIndex + 1];
    const startB = data[startIndex + 2];
    const startA = data[startIndex + 3];

    // If the starting color is the same as fill color, don't fill
    if (startR === fillColorRgb.r && startG === fillColorRgb.g && startB === fillColorRgb.b) {
      return;
    }

    // Stack-based flood fill to avoid recursion limits
    const stack = [[Math.floor(startX), Math.floor(startY)]];
    const visited = new Set();

    while (stack.length > 0) {
      const [x, y] = stack.pop();
      
      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      
      const key = `${x},${y}`;
      if (visited.has(key)) continue;
      visited.add(key);

      const index = (y * width + x) * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const a = data[index + 3];

      // Check if this pixel matches the starting color
      if (r === startR && g === startG && b === startB && a === startA) {
        // Fill this pixel
        data[index] = fillColorRgb.r;
        data[index + 1] = fillColorRgb.g;
        data[index + 2] = fillColorRgb.b;
        data[index + 3] = 255;

        // Add neighboring pixels to stack
        stack.push([x + 1, y]);
        stack.push([x - 1, y]);
        stack.push([x, y + 1]);
        stack.push([x, y - 1]);
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }, []);

  // Helper function to convert hex to RGB
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  };

  const getCanvasCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    
    // Handle both mouse and touch events
    const clientX = e.clientX || (e.touches && e.touches[0]?.clientX) || 0;
    const clientY = e.clientY || (e.touches && e.touches[0]?.clientY) || 0;
    
    // Get the actual displayed size vs canvas resolution
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    // Calculate precise coordinates with proper rounding
    const x = Math.round((clientX - rect.left) * scaleX);
    const y = Math.round((clientY - rect.top) * scaleY);
    
    // Ensure coordinates are within canvas bounds
    const boundedX = Math.max(0, Math.min(canvas.width - 1, x));
    const boundedY = Math.max(0, Math.min(canvas.height - 1, y));
    
    return { x: boundedX, y: boundedY };
  };

  const handleMouseDown = (e) => {
    if (!isDrawingMode) return;
    
    e.preventDefault(); // Prevent scrolling on touch devices
    const { x, y } = getCanvasCoordinates(e);
    
    if (currentTool === 'bucket') {
      // Save state before fill operation
      saveCanvasState();
      
      // Paint bucket tool - fill area
      const fillData = { type: 'fill', x, y, color: currentColor };
      socket?.emit('draw', fillData);
      drawOnCanvas(fillData); // Also fill locally
      // Save canvas state after fill
      setTimeout(() => saveCanvasState(), 100);
    } else {
      // Save state before starting to draw
      if (!isDrawing) {
        saveCanvasState();
      }
      
      // Brush tool - start drawing
      setIsDrawing(true);
      setLastX(x);
      setLastY(y);
      
      const drawData = { type: 'start', x, y, color: currentColor, size: brushSize };
      socket?.emit('draw', drawData);
      drawOnCanvas(drawData); // Also draw locally
    }
  };

  const handleMouseMove = (e) => {
    if (!isDrawing || !isDrawingMode || currentTool !== 'brush') return;
    
    e.preventDefault(); // Prevent scrolling on touch devices
    const { x, y } = getCanvasCoordinates(e);
    
    const drawData = { type: 'draw', x, y, color: currentColor, size: brushSize };
    socket?.emit('draw', drawData);
    drawOnCanvas(drawData); // Also draw locally
    
    setLastX(x);
    setLastY(y);
  };

  const handleMouseUp = () => {
    if (isDrawing && isDrawingMode) {
      // Send end event to notify other players that the stroke is complete
      socket?.emit('draw', { type: 'end' });
      // Save canvas state after drawing stroke
      setTimeout(() => saveCanvasState(), 100);
    }
    setIsDrawing(false);
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (socket && inputMessage.trim()) {
      socket.emit('chat-message', { message: inputMessage.trim() });
      setInputMessage('');
    }
  };

  if (!gameData || isInitializing) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading game...</p>
        </div>
        
        {/* Name Input Dialog - Show even during loading */}
        <Dialog open={showNameDialog} onOpenChange={setShowNameDialog}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Join Room</DialogTitle>
              <DialogDescription>
                Enter your name to join this room and start playing!
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="name" className="text-right">
                  Name
                </label>
                <Input
                  id="name"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleNameSubmit()}
                  className="col-span-3"
                  placeholder="Enter your name..."
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleNameCancel}>
                Cancel
              </Button>
              <Button type="submit" onClick={handleNameSubmit} disabled={!nameInput.trim()}>
                Join Room
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 shadow-xl border-b border-white/20">
        <div className="px-4 py-4 max-w-7xl mx-auto">
          {/* Top Row - Room Info and Leave Button */}
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center space-x-3 text-white">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm border border-white/30">
                <span className="text-xl">🎨</span>
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold tracking-wide">Room: {params.roomId}</h1>
                {gameState === 'playing' && (
                  <div className="flex items-center space-x-2 text-xs text-purple-100">
                    <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
                    <span>Round {round}/{totalRounds}</span>
                    <span>•</span>
                    <span className="text-green-300">{currentDrawer} is drawing</span>
                  </div>
                )}
              </div>
            </div>
            
            <Button
              onClick={() => router.push('/')}
              variant="destructive"
              size="sm"
              className="bg-red-500/80 hover:bg-red-500 backdrop-blur-sm border-red-400/30"
            >
              <span className="text-lg mr-1">🚪</span>
              Leave
            </Button>
          </div>

          {/* Bottom Row - Game Status Badges */}
          {gameState === 'playing' && (
            <div className="flex items-center justify-center space-x-3 flex-wrap gap-2">
              {timeLeft > 0 && (
                <Badge 
                  variant="outline"
                  className={`text-sm font-bold px-4 py-2 border-2 transition-all duration-300 ${
                    timeLeft <= 10 
                      ? 'bg-red-500 text-white border-red-300 animate-bounce shadow-lg' 
                      : timeLeft <= 30
                      ? 'bg-orange-500 text-white border-orange-300 shadow-lg'
                      : 'bg-emerald-500 text-white border-emerald-300 shadow-lg'
                  }`}
                >
                  <span className="text-lg mr-1">⏱</span>
                  <span className="font-black">{timeLeft}s</span>
                </Badge>
              )}

              {wordHint && (
                <Badge 
                  variant="outline"
                  className="bg-yellow-400 text-yellow-900 px-4 py-2 font-bold shadow-lg border-yellow-300 tracking-wider text-sm"
                >
                  <span className="mr-1">💡</span>
                  <span>{wordHint}</span>
                </Badge>
              )}

              {currentWord && isMyTurn && (
                <Badge 
                  variant="outline"
                  className="bg-white/95 text-emerald-700 px-4 py-2 font-bold shadow-lg backdrop-blur-sm border-white/40 text-sm"
                >
                  <span className="mr-1">🎯</span>
                  <span>Your word: {currentWord}</span>
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row max-w-7xl mx-auto p-4 gap-4">
        {/* Players Panel */}
        <Card className="w-full lg:w-64 bg-white/10 backdrop-blur-sm border-white/20 h-fit">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-white">
              <span className="text-2xl">👥</span>
              <span>Players ({players.filter(p => p.name && p.name.trim()).length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {players.filter(player => player.name && player.name.trim()).sort((a, b) => b.score - a.score).map((player, index) => (
                <div
                  key={player.id}
                  className={`flex justify-between items-center p-4 rounded-xl transition-all duration-300 hover:scale-105 shadow-lg ${
                    player.name === currentDrawer 
                      ? 'bg-gradient-to-r from-blue-500 to-purple-600 shadow-blue-500/30 border border-blue-400' 
                      : index === 0 
                      ? 'bg-gradient-to-r from-yellow-400 to-orange-500 shadow-yellow-500/30' 
                      : index === 1 
                      ? 'bg-gradient-to-r from-gray-300 to-gray-400 shadow-gray-400/20'
                      : index === 2
                      ? 'bg-gradient-to-r from-orange-400 to-yellow-600 shadow-orange-400/20'
                      : 'bg-white/20 backdrop-blur-sm border border-white/30'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white shadow-lg ${
                      player.name === currentDrawer ? 'bg-blue-700 animate-pulse' :
                      index === 0 ? 'bg-yellow-600' : 
                      index === 1 ? 'bg-gray-600' :
                      index === 2 ? 'bg-orange-600' :
                      'bg-purple-600'
                    }`}>
                      {player.name === currentDrawer ? '🎨' :
                       index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                    </div>
                    <div>
                      <span className={`font-bold ${
                        index < 3 || player.name === currentDrawer ? 'text-gray-900' : 'text-white'
                      }`}>
                        {player.name}
                      </span>
                      {player.isOwner && (
                        <div className="flex items-center space-x-1">
                          <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded-full font-bold">👑 HOST</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className={`text-lg font-black ${
                    index < 3 || player.name === currentDrawer ? 'text-gray-900' : 'text-white'
                  } bg-black/20 px-3 py-1 rounded-lg`}>
                    {player.score || 0}
                  </div>
                </div>
              ))}
            </div>

            {gameState === 'lobby' && gameData.isOwner && (
              <div className="space-y-3 mt-4">
                <Button
                  onClick={() => {
                    // Get the current URL and construct the room link
                    const protocol = window.location.protocol;
                    const host = window.location.host;
                    const roomUrl = `${protocol}//${host}/game/${params.roomId}`;
                    
                    console.log('Copying room URL:', roomUrl); // Debug log
                    
                    navigator.clipboard.writeText(roomUrl).then(() => {
                      toast.success('Room link copied to clipboard!', {
                        description: roomUrl,
                        duration: 3000,
                      });
                    }).catch((err) => {
                      console.error('Clipboard API failed:', err);
                      // Fallback for older browsers
                      try {
                        const textArea = document.createElement('textarea');
                        textArea.value = roomUrl;
                        textArea.style.position = 'fixed';
                        textArea.style.left = '-999999px';
                        textArea.style.top = '-999999px';
                        document.body.appendChild(textArea);
                        textArea.focus();
                        textArea.select();
                        const successful = document.execCommand('copy');
                        document.body.removeChild(textArea);
                        
                        if (successful) {
                          toast.success('Room link copied to clipboard!', {
                            description: roomUrl,
                            duration: 3000,
                          });
                        } else {
                          // If copy fails, show error toast
                          toast.error('Failed to copy link', {
                            description: 'Please copy the link manually: ' + roomUrl,
                            duration: 5000,
                          });
                        }
                      } catch (fallbackErr) {
                        console.error('Fallback copy failed:', fallbackErr);
                        // Last resort - show error toast
                        toast.error('Failed to copy link', {
                          description: 'Please copy the link manually: ' + roomUrl,
                          duration: 5000,
                        });
                      }
                    });
                  }}
                  variant="outline"
                  className="w-full bg-white/20 text-white hover:bg-white/30 border-white/30"
                  size="sm"
                >
                  <span className="text-lg mr-2">🔗</span>
                  Copy Room Link
                </Button>
                
                <div className="space-y-2">
                  <Button
                    onClick={startGame}
                    disabled={players.length < 2}
                    className={`w-full py-4 text-lg ${
                      players.length < 2 
                        ? 'bg-gray-400 text-gray-600 cursor-not-allowed' 
                        : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white'
                    }`}
                    size="lg"
                  >
                    <span className="text-2xl mr-2">🚀</span>
                    {players.length < 2 ? 'Need 2+ Players' : 'Start Game'}
                  </Button>
                  {players.length < 2 && (
                    <p className="text-sm text-white/70 text-center">
                      Share the room link to invite more players!
                    </p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Main Game Area */}
        <div className="flex-1 space-y-6">

          {/* Canvas */}
          <Card className="bg-white/10 backdrop-blur-md border-white/30">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <CardTitle className="flex items-center space-x-2 text-white">
                  <span className="text-2xl">🖼</span>
                  <span>Drawing Canvas</span>
                </CardTitle>
                {gameState === 'playing' && (
                  <Badge 
                    variant={isDrawingMode ? "default" : "secondary"}
                    className={`${
                      isDrawingMode 
                        ? 'bg-green-500 hover:bg-green-600 animate-pulse' 
                        : 'bg-blue-500 hover:bg-blue-600'
                    } text-white`}
                  >
                    {isDrawingMode ? '🎨 Your Turn' : '👀 Watching'}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
            <div className="relative">
              <canvas
                ref={canvasRef}
                width={1000}
                height={700}
                className={`w-full h-auto block rounded-xl shadow-2xl border-4 ${
                  isDrawingMode 
                    ? currentTool === 'bucket' 
                      ? 'cursor-pointer border-green-400 shadow-green-500/20' 
                      : 'cursor-crosshair border-green-400 shadow-green-500/20'
                    : 'cursor-default border-blue-400 shadow-blue-500/20'
                } transition-all duration-300`}
                style={{ 
                  touchAction: 'none',
                  maxHeight: '600px',
                  maxWidth: '100%',
                  backgroundColor: 'white',
                  imageRendering: 'pixelated'
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleMouseDown}
                onTouchMove={handleMouseMove}
                onTouchEnd={handleMouseUp}
              />
              
              {/* Reaction Buttons - Only show for non-drawers when someone is drawing */}
              {gameState === 'playing' && !isDrawingMode && currentDrawer && (
                <div className="absolute top-4 right-4 flex space-x-2">
                  <Button
                    onClick={() => sendReaction('thumbsUp')}
                    className="bg-green-500/90 hover:bg-green-500 text-white border-none shadow-lg backdrop-blur-sm transition-all duration-200 hover:scale-110"
                    size="sm"
                  >
                    👍
                  </Button>
                  <Button
                    onClick={() => sendReaction('thumbsDown')}
                    className="bg-red-500/90 hover:bg-red-500 text-white border-none shadow-lg backdrop-blur-sm transition-all duration-200 hover:scale-110"
                    size="sm"
                  >
                    👎
                  </Button>
                </div>
              )}
              
              {/* Show reactions from other players */}
              {gameState === 'playing' && Object.keys(reactions).length > 0 && (
                <div className="absolute bottom-4 left-4 flex flex-wrap gap-2">
                  {Object.entries(reactions).map(([playerId, reaction]) => 
                    reaction && (
                      <div
                        key={playerId}
                        className="bg-black/50 backdrop-blur-sm rounded-full px-3 py-1 flex items-center space-x-2 animate-bounce"
                      >
                        <span className="text-lg">
                          {reaction === 'thumbsUp' ? '👍' : '👎'}
                        </span>
                        <span className="text-white text-sm font-medium">
                          {playerId}
                        </span>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
            </CardContent>
          </Card>

          {/* Drawing Tools */}
          {isDrawingMode && (
            <Card className="bg-white/15 backdrop-blur-md border-white/30">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-white">
                  <span className="text-2xl">🛠</span>
                  <span>Drawing Tools</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Main Tools Row - Tools, History, and Actions */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                  {/* Tool Selection */}
                  <div className="flex items-center justify-center lg:justify-start space-x-2">
                    <Button
                      onClick={() => setCurrentTool('brush')}
                      variant={currentTool === 'brush' ? 'default' : 'outline'}
                      size="sm"
                      className={`flex items-center space-x-1 ${
                        currentTool === 'brush' 
                          ? 'bg-blue-500 hover:bg-blue-600 text-white' 
                          : 'bg-white/20 text-white hover:bg-white/30'
                      }`}
                    >
                      <span>🖌</span>
                      <span className="hidden sm:inline">Brush</span>
                    </Button>
                    <Button
                      onClick={() => setCurrentTool('bucket')}
                      variant={currentTool === 'bucket' ? 'default' : 'outline'}
                      size="sm"
                      className={`flex items-center space-x-1 ${
                        currentTool === 'bucket' 
                          ? 'bg-green-500 hover:bg-green-600 text-white' 
                          : 'bg-white/20 text-white hover:bg-white/30'
                      }`}
                    >
                      <span>🪣</span>
                      <span className="hidden sm:inline">Fill</span>
                    </Button>
                  </div>

                  {/* Undo/Redo Buttons */}
                  <div className="flex items-center justify-center space-x-2">
                    <Button
                      onClick={undo}
                      disabled={historyStep <= 0}
                      variant="outline"
                      size="sm"
                      className="bg-white/20 text-white hover:bg-white/30 disabled:opacity-50"
                    >
                      <span>↶</span>
                      <span className="hidden sm:inline ml-1">Undo</span>
                    </Button>
                    <Button
                      onClick={redo}
                      disabled={historyStep >= canvasHistory.length - 1}
                      variant="outline"
                      size="sm"
                      className="bg-white/20 text-white hover:bg-white/30 disabled:opacity-50"
                    >
                      <span>↷</span>
                      <span className="hidden sm:inline ml-1">Redo</span>
                    </Button>
                  </div>

                  {/* Clear Button */}
                  <div className="flex items-center justify-center lg:justify-end">
                    <Button
                      onClick={() => {
                        if (isDrawingMode) {
                          socket?.emit('clear-canvas');
                        }
                      }}
                      variant="destructive"
                      disabled={!isDrawingMode}
                      size="sm"
                      className="flex items-center space-x-1"
                    >
                      <span>🧹</span>
                      <span className="hidden sm:inline">Clear</span>
                    </Button>
                  </div>
                </div>

                {/* Colors Palette */}
                <div className="space-y-2">
                  <label className="text-white font-semibold text-sm flex items-center justify-center lg:justify-start">
                    <span className="mr-2">🎨</span>
                    Colors
                  </label>
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {colors.map((color) => (
                      <button
                        key={color}
                        onClick={() => setCurrentColor(color)}
                        className={`w-7 h-7 rounded-full transition-all duration-200 hover:scale-110 shadow-md border-2 ${
                          currentColor === color 
                            ? 'border-white shadow-lg scale-110 ring-2 ring-white/50' 
                            : 'border-white/30 hover:border-white/70'
                        }`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
                
                {/* Brush Size (only when brush tool is selected) */}
                {currentTool === 'brush' && (
                  <div className="flex items-center justify-between bg-white/10 rounded-lg px-3 py-2">
                    <label className="text-white font-semibold text-sm flex items-center">
                      <span className="mr-2">📏</span>
                      Size
                    </label>
                    <div className="flex items-center space-x-3">
                      <Slider
                        value={[brushSize]}
                        onValueChange={(value) => setBrushSize(value[0])}
                        max={20}
                        min={1}
                        step={1}
                        className="w-24 lg:w-32"
                      />
                      <Badge variant="secondary" className="min-w-[45px] text-center font-bold">
                        {brushSize}px
                      </Badge>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Chat Panel */}
        <Card className="w-full lg:w-72 bg-white/10 backdrop-blur-sm border-white/20">
          <CardHeader className="border-b border-white/20">
            <CardTitle className="flex items-center space-x-2 text-white">
              <span className="text-2xl">💬</span>
              <span>Chat & Guesses</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] lg:h-[400px] flex flex-col p-0">
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {messages.map((msg, index) => (
                <div key={index} className={`message-enter ${
                  msg.type === 'system' ? 'text-purple-200 italic text-center' :
                  msg.type === 'correct' ? 'bg-green-500/20 border border-green-400/30 rounded-lg p-2' :
                  msg.type === 'close' ? 'bg-orange-500/20 border border-orange-400/30 rounded-lg p-2' :
                  'bg-white/10 rounded-lg p-2 backdrop-blur-sm border border-white/20'
                }`}>
                  {msg.type === 'player' && msg.player && msg.message ? (
                    <div className="text-white text-sm">
                      <span className="font-bold text-blue-300">{msg.player}:</span> 
                      <span className="ml-1">{msg.message}</span>
                    </div>
                  ) : msg.type === 'correct' && msg.player && msg.message ? (
                    <div className="text-green-100 font-medium flex items-center space-x-2 text-sm">
                      <span className="text-lg">✅</span>
                      <div>
                        <span className="font-bold text-green-200">{msg.player}:</span> 
                        <span className="ml-1">{msg.message}</span>
                        <div className="text-xs text-green-300 mt-1">Correct guess!</div>
                      </div>
                    </div>
                  ) : msg.type === 'close' && msg.player && msg.message && msg.closeMessage ? (
                    <div className="text-orange-100 font-medium text-sm">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-orange-200">{msg.player}:</span> 
                        <span>{msg.message}</span>
                      </div>
                      <div className="mt-2 flex items-center space-x-2">
                        <span className="px-3 py-1 bg-orange-500 text-white text-xs rounded-full font-bold close-message-badge flex items-center space-x-1">
                          <span>🔥</span>
                          <span>{msg.closeMessage}</span>
                        </span>
                      </div>
                    </div>
                  ) : msg.type === 'system' ? (
                    <div className="flex items-center justify-center space-x-1">
                      <span className="text-sm">ℹ️</span>
                      <span className="text-sm">{msg.message}</span>
                    </div>
                  ) : msg.message ? (
                    <span className="text-white text-sm">{msg.message}</span>
                  ) : (
                    <span className="text-red-400 italic text-sm">Invalid message</span>
                  )}
                </div>
              ))}
            </div>

            <form onSubmit={sendMessage} className="p-4 border-t border-white/20">
              <div className="flex space-x-3">
                <Input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder={isMyTurn ? "🎨 You're drawing!" : "💭 Type your guess..."}
                  disabled={isMyTurn}
                  className="flex-1 bg-white/20 border-white/30 text-white placeholder:text-white/60 disabled:bg-white/10"
                  maxLength={50}
                />
                <Button
                  type="submit"
                  disabled={isMyTurn || !inputMessage.trim()}
                  className="bg-blue-500 hover:bg-blue-600 border-blue-400/30"
                >
                  <span className="text-lg mr-1">🚀</span>
                  Send
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Game End Modal */}
      {gameEnded && (
        <div className="fixed inset-0 bg-black bg-opacity-50 modal-backdrop flex items-center justify-center z-50">
          <Card className="max-w-md w-full mx-4">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Game Over!</CardTitle>
              {winner && (
                <div className="text-center">
                  <div className="text-6xl mb-2">🏆</div>
                  <p className="text-lg">
                    <span className="font-bold text-yellow-600">{winner.name}</span> wins!
                  </p>
                  <p className="text-gray-600">{winner.score} points</p>
                </div>
              )}
            </CardHeader>
            
            <CardContent>
              <div className="mb-4">
                <h3 className="font-medium mb-2">Final Scores:</h3>
                <div className="space-y-1">
                  {players.sort((a, b) => b.score - a.score).map((player, index) => (
                    <div key={player.id} className="flex justify-between items-center">
                      <span className={index === 0 ? 'font-bold text-yellow-600' : ''}>
                        {index + 1}. {player.name}
                      </span>
                      <Badge variant="outline">{player.score}</Badge>
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-center mt-4">
                <p className="text-sm text-gray-600">
                  Returning to lobby in {lobbyCountdown} second{lobbyCountdown !== 1 ? 's' : ''}...
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Word Selection Modal */}
      <Dialog open={wordChoices.length > 0} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-[600px] bg-gradient-to-br from-yellow-400 via-orange-400 to-red-500 border-yellow-300">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between text-gray-900 text-2xl">
              <div className="flex items-center space-x-3">
                <span className="text-4xl">🎯</span>
                <span>Choose your word to draw:</span>
              </div>
              <div className={`flex items-center space-x-2 px-3 py-1 rounded-full ${
                wordSelectionTimer <= 5 
                  ? 'bg-red-600 text-white animate-pulse' 
                  : 'bg-white/20 text-gray-900'
              }`}>
                <span className="text-lg">⏰</span>
                <span className="font-bold">{wordSelectionTimer}s</span>
              </div>
            </DialogTitle>
            <DialogDescription className="text-gray-800 text-lg">
              Select one of the words below to start drawing. Other players will try to guess what you&apos;re drawing!
              {wordSelectionTimer <= 5 && (
                <span className="block mt-1 text-red-800 font-semibold">
                  Hurry up! A random word will be chosen in {wordSelectionTimer} seconds!
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {wordChoices.map((word, index) => (
                <Button
                  key={index}
                  onClick={() => chooseWord(word)}
                  variant="outline"
                  className="h-16 px-6 py-4 bg-white/95 hover:bg-white border-2 border-white/70 hover:border-yellow-300 hover:shadow-lg font-bold text-gray-800 text-xl transition-all duration-200 hover:scale-105"
                  size="lg"
                >
                  {word}
                </Button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
