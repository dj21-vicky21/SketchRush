k# 🎨 SketchRush.io Clone

A real-time multiplayer drawing and guessing game built with Next.js and Socket.io, inspired by the popular SketchRush.io game.

## ✨ Features

### 🎮 Core Gameplay
- **Real-time Multiplayer**: Up to 10 players per room
- **Drawing & Guessing**: One player draws while others guess the word
- **Scoring System**: Points awarded based on guessing speed and drawing accuracy
- **Multiple Rounds**: Customizable number of rounds (2-5)
- **Timer System**: Adjustable drawing time (60-120 seconds)

### 🎯 Game Features
- **Word Selection**: Choose from 3 random words each turn
- **Live Drawing**: Real-time canvas synchronization across all players
- **Chat System**: Integrated chat for guessing and communication
- **Player Rankings**: Live scoreboard with winner celebration
- **Room System**: Create private rooms or join existing ones

### 🛠️ Tools & Interface
- **Drawing Tools**: 
  - 12 colors to choose from
  - Adjustable brush size (1-20px)
  - Clear canvas button
- **Modern UI**: 
  - Responsive design for desktop and mobile
  - Beautiful gradients and animations
  - Real-time game state updates

## 🚀 How to Play

### Starting a Game

1. **Enter Your Name**: Type your nickname on the home page
2. **Create Room**: 
   - Click "Create Room"
   - Choose game settings:
     - Number of rounds (2-5)
     - Drawing time per round (60-120s)
     - Maximum players (4-10)
   - Click "Create Room" to generate a room code
3. **Join Room**: 
   - Click "Join Room"
   - Enter the 6-character room code
   - Click "Join Room"

### Gameplay

1. **Waiting**: Players gather in the lobby until the host starts the game
2. **Drawing Turn**: 
   - When it's your turn, choose one of 3 words
   - Use drawing tools to illustrate your chosen word
   - You have the set time limit to draw
3. **Guessing Turn**: 
   - Watch other players draw
   - Type your guesses in the chat
   - Faster correct guesses earn more points
4. **Scoring**: 
   - Guessers get points for correct answers (more points for faster guesses)
   - Drawers get points when others guess correctly
5. **Winner**: Player with the most points after all rounds wins!

## 🏗️ Technical Implementation

### Architecture
- **Frontend**: Next.js 15 with React 19
- **Backend**: Node.js with Socket.io
- **Styling**: Tailwind CSS with custom animations
- **State Management**: In-memory game state (no database required)

### Key Features
- **Real-time Communication**: Socket.io handles all multiplayer interactions
- **Canvas Drawing**: HTML5 Canvas with mouse event handling
- **Room Management**: Dynamic room creation and joining
- **Game State**: Comprehensive game flow management
- **Responsive Design**: Works on desktop and mobile devices

### Socket Events
- Room creation and joining
- Real-time drawing synchronization  
- Chat and guessing messages
- Game state updates (rounds, scoring, timers)
- Player management (join/leave/scoring)

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

1. **Clone the repository** (if from git):
   ```bash
   git clone <repository-url>
   cd scribble_clone
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```

4. **Open your browser**:
   - Go to `http://localhost:3000`
   - Open multiple tabs/browsers to test multiplayer functionality

### Production Deployment

```bash
npm run build
npm start
```

## 🎨 Game Screenshots & Flow

### Home Page
- Clean, modern interface for joining/creating rooms
- Animated gradient background
- Room settings configuration

### Game Page  
- **Left Panel**: Player list with live scores and rankings
- **Center**: Drawing canvas with tools and timer
- **Right Panel**: Chat/guessing area with message history

### Game States
1. **Lobby**: Players wait for game to start
2. **Word Selection**: Current drawer chooses from 3 words  
3. **Drawing Phase**: Active drawing with timer countdown
4. **Round End**: Word reveal and score updates
5. **Game End**: Final scores and winner announcement

## 🔧 Customization

### Adding More Words
Edit the `WORDS` array in `server.js`:
```javascript
const WORDS = [
  'cat', 'dog', 'house', 'car', 'tree',
  // Add your custom words here
];
```

### Adjusting Game Settings
Modify default settings in `server.js`:
```javascript
settings: {
  rounds: settings.rounds || 3,
  drawTime: settings.drawTime || 80,
  maxPlayers: settings.maxPlayers || 8,
}
```

## 🤝 Multiplayer Testing

To test the multiplayer functionality:
1. Open multiple browser tabs/windows
2. Create a room in one tab
3. Join the room from other tabs using the room code
4. Start a game and test drawing/guessing functionality

## 🐛 Troubleshooting

### Common Issues
- **Can't join room**: Make sure the room code is correct (6 characters)
- **Drawing not syncing**: Check browser console for Socket.io connection errors
- **Game not starting**: Ensure you're the room owner to start games
- **Mobile issues**: Some mobile browsers may have Canvas touch limitations

### Browser Compatibility
- Chrome/Safari/Firefox (latest versions)
- Mobile browsers (iOS Safari, Chrome Mobile)
- Canvas drawing works best on desktop/tablet

## 🎯 Future Enhancements

Potential improvements for the game:
- Custom word lists per room
- Avatar customization  
- Game replay system
- Spectator mode
- Additional drawing tools (shapes, patterns)
- Voice chat integration
- Tournament/bracket system

## 📝 License

This project is open source and available under the MIT License.

---

**Enjoy your drawing and guessing adventures! 🎨✨**