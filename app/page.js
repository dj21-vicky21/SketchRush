'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { io } from 'socket.io-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function Home() {
  const [socket, setSocket] = useState(null);
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [settings, setSettings] = useState({
    rounds: 3,
    drawTime: 80,
    maxPlayers: 4
  });
  const [error, setError] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Check for any error messages from failed game attempts
    const gameError = localStorage.getItem('gameError');
    if (gameError) {
      setError(gameError);
      localStorage.removeItem('gameError');
    }

    // Initialize socket connection with better error handling
    const newSocket = io({
      transports: ['websocket', 'polling'],
      upgrade: true,
      rememberUpgrade: true
    });
    
    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id);
    });
    
    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setError('Connection failed. Please refresh and try again.');
      setIsConnecting(false);
    });
    
    setSocket(newSocket);

    newSocket.on('room-created', (data) => {
      // Get the player name from sessionStorage to ensure we have it
      const savedPlayerName = sessionStorage.getItem('tempPlayerName') || playerName.trim();
      const gameData = {
        roomId: data.roomId,
        playerName: savedPlayerName,
        isOwner: true
      };
      console.log('Saving game data:', gameData);
      console.log('Player name from session:', savedPlayerName);
      localStorage.setItem('gameData', JSON.stringify(gameData));
      // Clear the temp storage
      sessionStorage.removeItem('tempPlayerName');
      router.push(`/game/${data.roomId}`);
    });

    newSocket.on('room-joined', (data) => {
      // Get the player name from sessionStorage to ensure we have it
      const savedPlayerName = sessionStorage.getItem('tempPlayerName') || playerName.trim();
      const gameData = {
        roomId: data.room.id,
        playerName: savedPlayerName,
        isOwner: false
      };
      console.log('Saving game data:', gameData);
      console.log('Player name from session:', savedPlayerName);
      localStorage.setItem('gameData', JSON.stringify(gameData));
      // Clear the temp storage
      sessionStorage.removeItem('tempPlayerName');
      router.push(`/game/${data.room.id}`);
    });

    newSocket.on('error', (data) => {
      setError(data.message);
      setIsConnecting(false);
    });

    return () => newSocket.close();
  }, []);

  const createRoom = () => {
    const name = playerName.trim();
    if (!name) {
      setError('Please enter your name');
      return;
    }
    setError('');
    setIsConnecting(true);
    console.log('Creating room with player name:', name);
    
    // Store the name temporarily so we can access it in the socket event
    sessionStorage.setItem('tempPlayerName', name);
    socket.emit('create-room', { playerName: name, settings });
  };

  const joinRoom = () => {
    const name = playerName.trim();
    const code = roomCode.trim().toUpperCase();
    
    if (!name) {
      setError('Please enter your name');
      return;
    }
    if (!code) {
      setError('Please enter room code');
      return;
    }
    setError('');
    setIsConnecting(true);
    console.log('Joining room with player name:', name, 'room code:', code);
    
    // Store the name temporarily so we can access it in the socket event
    sessionStorage.setItem('tempPlayerName', name);
    socket.emit('join-room', { roomId: code, playerName: name });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-4xl font-bold text-gray-800 mb-2">SketchRush Clone</CardTitle>
          <CardDescription className="text-gray-600">Draw, guess, and have fun!</CardDescription>
        </CardHeader>
        <CardContent>

        {error && (
          <Badge variant="destructive" className="w-full justify-center mb-4 p-3">
            {error}
          </Badge>
        )}

        <div className="space-y-4">
          <div>
            <label htmlFor="playerName" className="block text-sm font-medium text-gray-700 mb-1">
              Your Name
            </label>
            <Input
              id="playerName"
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter your name"
              maxLength={20}
            />
          </div>

          <div className="flex space-x-2">
            <Button
              onClick={() => setIsCreating(!isCreating)}
              variant={isCreating ? "default" : "outline"}
              className="flex-1"
            >
              Create Room
            </Button>
            <Button
              onClick={() => setIsCreating(false)}
              variant={!isCreating ? "default" : "outline"}
              className="flex-1"
            >
              Join Room
            </Button>
          </div>

          {isCreating ? (
            <Card className="bg-gray-50">
              <CardHeader>
                <CardTitle className="text-lg">Room Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Rounds</label>
                    <select
                      value={settings.rounds}
                      onChange={(e) => setSettings({...settings, rounds: parseInt(e.target.value)})}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                    >
                      <option value={2}>2</option>
                      <option value={3}>3</option>
                      <option value={4}>4</option>
                      <option value={5}>5</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Draw Time</label>
                    <select
                      value={settings.drawTime}
                      onChange={(e) => setSettings({...settings, drawTime: parseInt(e.target.value)})}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                    >
                      <option value={60}>60s</option>
                      <option value={80}>80s</option>
                      <option value={100}>100s</option>
                      <option value={120}>120s</option>
                    </select>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Max Players</label>
                  <select
                    value={settings.maxPlayers}
                    onChange={(e) => setSettings({...settings, maxPlayers: parseInt(e.target.value)})}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                  >
                    <option value={2}>2 Players</option>
                    <option value={3}>3 Players</option>
                    <option value={4}>4 Players</option>
                    <option value={5}>5 Players</option>
                    <option value={6}>6 Players</option>
                    <option value={7}>7 Players</option>
                    <option value={8}>8 Players</option>
                    <option value={9}>9 Players</option>
                    <option value={10}>10 Players</option>
                  </select>
                </div>

                <Button
                  onClick={createRoom}
                  disabled={isConnecting}
                  className="w-full"
                >
                  {isConnecting ? (
                    <div className="flex items-center justify-center">
                      <div className="spinner mr-2"></div>
                      Creating...
                    </div>
                  ) : 'Create Room'}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <div>
                <label htmlFor="roomCode" className="block text-sm font-medium text-gray-700 mb-1">
                  Room Code
                </label>
                <Input
                  id="roomCode"
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="Enter room code"
                  maxLength={6}
                />
              </div>

              <Button
                onClick={joinRoom}
                disabled={isConnecting}
                className="w-full"
                variant="secondary"
              >
                {isConnecting ? (
                  <div className="flex items-center justify-center">
                    <div className="spinner mr-2"></div>
                    Joining...
                  </div>
                ) : 'Join Room'}
              </Button>
            </div>
          )}
        </div>

        <div className="mt-8 text-center text-sm text-gray-500">
          <p>🎨 Draw your imagination</p>
          <p>🔮 Guess the magic</p>
          <p className="mt-2 text-xs">Create a room to get a code, then share it with friends!</p>
        </div>
        </CardContent>
      </Card>
    </div>
  );
}