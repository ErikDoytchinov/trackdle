const multiplayerService = require('../services/multiplayerService');
const logger = require('../config/logger');
const socketService = require('../services/socketService');
const MultiplayerGame = require('../models/multiplayerGameModel');

/**
 * POST /multiplayer/lobby
 * Creates a new multiplayer lobby
 */
const createLobby = async (req, res) => {
  try {
    const { maxPlayers, songCount, maxAttempts } = req.body;
    const settings = {
      maxPlayers: maxPlayers || 4,
      songCount: songCount || 5,
      maxAttempts: maxAttempts || 5,
    };

    const lobby = await multiplayerService.createLobby(req.user._id, settings);

    res.status(201).json({
      success: true,
      lobbyId: lobby._id,
      lobbyCode: lobby._id.toString().slice(-6).toUpperCase(), // Short code for easy sharing
      ownerId: lobby.ownerId,
      players: lobby.players,
      maxPlayers: lobby.maxPlayers,
      gameSettings: lobby.gameSettings,
    });
  } catch (err) {
    logger.error(`Error creating lobby: ${err.message}`);
    res.status(400).json({ success: false, message: 'Request failed.' });
  }
};

/**
 * GET /multiplayer/lobby/:lobbyId
 * Get specific lobby details
 */
const getLobby = async (req, res) => {
  try {
    const lobby = await multiplayerService.getLobby(req.params.lobbyId);

    const formattedPlayers = lobby.players.map((player) => ({
      id: player.userId,
      email: player.email,
      ready: player.ready,
      score: player.score,
      isOwner: lobby.ownerId.toString() === player.userId.toString(),
    }));

    res.json({
      success: true,
      lobby: {
        id: lobby._id,
        lobbyCode: lobby._id.toString().slice(-6).toUpperCase(),
        status: lobby.status,
        players: formattedPlayers,
        maxPlayers: lobby.maxPlayers,
        ownerId: lobby.ownerId,
        gameSettings: lobby.gameSettings,
        activeGameId: lobby.activeGameId,
      },
    });
  } catch (err) {
    logger.error(`Error getting lobby: ${err.message}`);
    res.status(400).json({ success: false, message: 'Request failed.' });
  }
};

/**
 * POST /multiplayer/game/:lobbyId
 * Start a multiplayer game session
 */
const postGameSession = async (req, res) => {
  try {
    const { lobbyId } = req.params;
    const game = await multiplayerService.startGame(lobbyId, req.user._id);

    const gameData = {
      success: true,
      gameId: game._id,
    };

    res.status(201).json(gameData);

    logger.info(`Game started for lobby ${lobbyId}, game ID: ${game._id}`);

    try {
      const io = socketService.getIO();

      if (io) {
        logger.info(`Broadcasting game-started event to lobby: ${lobbyId}`);
        io.to(lobbyId.toString()).emit('game-started', {
          gameId: game._id,
          lobbyId: lobbyId,
          totalSongs: game.targetSongs.length,
          songs: game.songs,
          leaderboard: game.playerStates.map((ps) => ({
            userId: ps.userId,
            email: ps.userEmail,
            score: ps.score,
          })),
          gameStarted: true,
          currentPreviewUrl: game.targetSongs[0]?.preview_url,
        });
      }
    } catch (socketError) {
      logger.error(
        `Error broadcasting game-started event: ${socketError.message}`
      );
    }
  } catch (err) {
    logger.error(`Error starting game session: ${err.message}`);
    res.status(400).json({ success: false, message: 'Request failed.' });
  }
};

/**
 * POST /multiplayer/game/:gameId/guess
 * Processes a guess for the multiplayer session, updates the guess for the specific user.
 */
const postGuess = async (req, res) => {
  try {
    const { gameId } = req.params;
    const userId = req.user._id;
    const { guess, skip } = req.body;

    if (!guess && !skip) {
      return res.status(400).json({
        success: false,
        message: 'Either guess or skip parameter is required',
      });
    }

    const game = await MultiplayerGame.findById(gameId);
    if (!game) throw new Error('Game not found');

    const playerState = game.playerStates.find(
      (state) => state.userId.toString() === userId.toString()
    );
    if (!playerState) throw new Error('Player not found in game');

    // this is the song that the player is currently guessing
    const currentSongIndex = playerState.currentSongIndex;

    // Make sure we haven't exceeded the song count
    if (currentSongIndex >= game.targetSongs.length) {
      return res.status(200).json({
        success: true,
        message: 'Game completed for this player',
        gameOver: true,
        gameCompleted: true,
      });
    }

    const currentSong = game.targetSongs[currentSongIndex];
    if (!currentSong) throw new Error('Current song not found');

    if (skip) {
      playerState.currentSongAttempts++;
      if (playerState.currentSongAttempts >= game.maxAttempts) {
        // the attempt limit has been reached, move to the next song
        playerState.completedSongs.push({
          songIndex: currentSongIndex,
          correct: false,
          attempts: playerState.currentSongAttempts,
        });
        playerState.currentSongIndex++;
        playerState.currentSongAttempts = 0;
        await game.save();

        // Check if player has completed all songs
        const isGameOver =
          playerState.currentSongIndex >= game.targetSongs.length;

        // Generate leaderboard data for all players
        // First get fresh game data from database to ensure latest scores
        const freshGame = await MultiplayerGame.findById(game._id);
        const leaderboard = freshGame.playerStates.map((ps) => ({
          userId: ps.userId,
          email: ps.userEmail,
          score: ps.score,
        }));

        // Sort by score in descending order
        leaderboard.sort((a, b) => b.score - a.score);

        // Try to broadcast updated leaderboard to all players
        try {
          const io = socketService.getIO();
          if (io) {
            io.to(freshGame.lobbyId.toString()).emit('leaderboard-update', {
              leaderboard: leaderboard,
              gameId: freshGame._id,
            });
          }
        } catch (socketError) {
          logger.error(
            `Error broadcasting leaderboard update: ${socketError.message}`
          );
        }

        // after all guess/skip/advance logic, check if all players are finished
        // (i.e., their currentSongIndex >= game.targetSongs.length)
        const freshGameFinal = await MultiplayerGame.findById(game._id);
        const allPlayersFinished = freshGameFinal.playerStates.every(
          (ps) => ps.currentSongIndex >= freshGameFinal.targetSongs.length
        );
        if (allPlayersFinished && freshGameFinal.status !== 'completed') {
          freshGameFinal.status = 'completed';
          freshGameFinal.completedAt = new Date();
          await freshGameFinal.save();
          const finalLeaderboard = freshGameFinal.playerStates
            .map((ps) => ({
              userId: ps.userId,
              email: ps.userEmail,
              score: ps.score,
            }))
            .sort((a, b) => b.score - a.score);
          try {
            const io = socketService.getIO();
            if (io) {
              io.to(freshGameFinal.lobbyId.toString()).emit('game-over', {
                leaderboard: finalLeaderboard,
                gameId: freshGameFinal._id,
              });
            }
          } catch (socketError) {
            logger.error(
              `Error broadcasting game-over event: ${socketError.message}`
            );
          }
        }

        return res.status(200).json({
          success: true,
          correct: false,
          song: currentSong,
          gameOver: true,
          gameCompleted: isGameOver,
          leaderboard,
        });
      } else {
        // the attempt limit has not been reached, return the current song increment the attempts
        await game.save();
        return res.status(200).json({
          success: true,
          correct: false,
          gameOver: false,
        });
      }
    } else {
      // process an actual guess
      const correctTitle = currentSong.name.toLowerCase().trim();
      const userGuess = guess.toLowerCase().trim();

      if (userGuess === correctTitle) {
        // correct guess
        playerState.completedSongs.push({
          songIndex: currentSongIndex,
          correct: true,
          attempts: playerState.currentSongAttempts + 1,
        });

        // Add points (fewer attempts means more points)
        const pointsEarned = game.maxAttempts - playerState.currentSongAttempts;
        playerState.score += pointsEarned;

        playerState.currentSongIndex++;
        playerState.currentSongAttempts = 0;
        await game.save();

        const isGameOver =
          playerState.currentSongIndex >= game.targetSongs.length;
        const freshGame = await MultiplayerGame.findById(game._id);
        const leaderboard = freshGame.playerStates.map((ps) => ({
          userId: ps.userId,
          email: ps.userEmail,
          score: ps.score,
        }));

        leaderboard.sort((a, b) => b.score - a.score);

        try {
          const io = socketService.getIO();
          if (io) {
            io.to(freshGame.lobbyId.toString()).emit('leaderboard-update', {
              leaderboard: leaderboard,
              gameId: freshGame._id,
            });
          }
        } catch (socketError) {
          logger.error(
            `Error broadcasting leaderboard update: ${socketError.message}`
          );
        }

        // After all guess/skip/advance logic, check if all players are finished
        // (i.e., their currentSongIndex >= game.targetSongs.length)
        const freshGameFinal = await MultiplayerGame.findById(game._id);
        const allPlayersFinished = freshGameFinal.playerStates.every(
          (ps) => ps.currentSongIndex >= freshGameFinal.targetSongs.length
        );
        if (allPlayersFinished && freshGameFinal.status !== 'completed') {
          freshGameFinal.status = 'completed';
          freshGameFinal.completedAt = new Date();
          await freshGameFinal.save();
          // Prepare final leaderboard
          const finalLeaderboard = freshGameFinal.playerStates
            .map((ps) => ({
              userId: ps.userId,
              email: ps.userEmail,
              score: ps.score,
            }))
            .sort((a, b) => b.score - a.score);
          // Emit game-over event to all players in the lobby
          try {
            const io = socketService.getIO();
            if (io) {
              io.to(freshGameFinal.lobbyId.toString()).emit('game-over', {
                leaderboard: finalLeaderboard,
                gameId: freshGameFinal._id,
              });
            }
          } catch (socketError) {
            logger.error(
              `Error broadcasting game-over event: ${socketError.message}`
            );
          }
        }

        return res.status(200).json({
          success: true,
          correct: true,
          song: currentSong,
          gameOver: false,
          gameCompleted: isGameOver,
          pointsEarned,
          leaderboard,
        });
      } else {
        // incorrect guess
        playerState.currentSongAttempts++;
        if (playerState.currentSongAttempts >= game.maxAttempts) {
          // the attempt limit has been reached, move to the next song
          playerState.completedSongs.push({
            songIndex: currentSongIndex,
            correct: false,
            attempts: playerState.currentSongAttempts,
          });
          playerState.currentSongIndex++;
          playerState.currentSongAttempts = 0;
          await game.save();

          // check if player has completed all songs
          const isGameOver =
            playerState.currentSongIndex >= game.targetSongs.length;

          // Generate leaderboard data for all players
          // First get fresh game data from database to ensure latest scores
          const freshGame = await MultiplayerGame.findById(game._id);
          const leaderboard = freshGame.playerStates.map((ps) => ({
            userId: ps.userId,
            email: ps.userEmail,
            score: ps.score,
          }));

          // Sort by score in descending order
          leaderboard.sort((a, b) => b.score - a.score);

          // Try to broadcast updated leaderboard to all players
          try {
            const io = socketService.getIO();
            if (io) {
              io.to(freshGame.lobbyId.toString()).emit('leaderboard-update', {
                leaderboard: leaderboard,
                gameId: freshGame._id,
              });
            }
          } catch (socketError) {
            logger.error(
              `Error broadcasting leaderboard update: ${socketError.message}`
            );
          }

          // After all guess/skip/advance logic, check if all players are finished
          // (i.e., their currentSongIndex >= game.targetSongs.length)
          const freshGameFinal = await MultiplayerGame.findById(game._id);
          const allPlayersFinished = freshGameFinal.playerStates.every(
            (ps) => ps.currentSongIndex >= freshGameFinal.targetSongs.length
          );
          if (allPlayersFinished && freshGameFinal.status !== 'completed') {
            freshGameFinal.status = 'completed';
            freshGameFinal.completedAt = new Date();
            await freshGameFinal.save();
            // Prepare final leaderboard
            const finalLeaderboard = freshGameFinal.playerStates
              .map((ps) => ({
                userId: ps.userId,
                email: ps.userEmail,
                score: ps.score,
              }))
              .sort((a, b) => b.score - a.score);
            // Emit game-over event to all players in the lobby
            try {
              const io = socketService.getIO();
              if (io) {
                io.to(freshGameFinal.lobbyId.toString()).emit('game-over', {
                  leaderboard: finalLeaderboard,
                  gameId: freshGameFinal._id,
                });
              }
            } catch (socketError) {
              logger.error(
                `Error broadcasting game-over event: ${socketError.message}`
              );
            }
          }

          return res.status(200).json({
            success: true,
            correct: false,
            song: currentSong,
            gameOver: true,
            gameCompleted: isGameOver,
            leaderboard,
          });
        } else {
          // the attempt limit has not been reached
          await game.save();
          return res.status(200).json({
            success: true,
            correct: false,
            gameOver: false,
          });
        }
      }
    }
  } catch (err) {
    logger.error(`Error posting guess: ${err.message}`);
    res.status(400).json({ success: false, message: 'Request failed.' });
  }
};

/**
 * GET /multiplayer/game/:gameId/next
 * Gets the next song for the player in a multiplayer game
 */
const getNextSong = async (req, res) => {
  try {
    const { gameId } = req.params;
    const userId = req.user._id;

    const game = await MultiplayerGame.findById(gameId);
    if (!game) {
      return res.status(404).json({
        success: false,
        message: 'Game not found',
      });
    }
    const playerState = game.playerStates.find(
      (state) => state.userId.toString() === userId.toString()
    );
    if (!playerState) {
      return res.status(404).json({
        success: false,
        message: 'Player not found in game',
      });
    }

    if (playerState.currentSongIndex >= game.targetSongs.length) {
      const leaderboard = game.playerStates.map((ps) => ({
        userId: ps.userId,
        score: ps.score,
        email: ps.userEmail,
      }));

      leaderboard.sort((a, b) => b.score - a.score);

      return res.status(200).json({
        success: true,
        message: 'Game completed',
        gameCompleted: true,
        leaderboard,
      });
    }

    const nextSong = game.targetSongs[playerState.currentSongIndex];
    if (!nextSong) {
      return res.status(404).json({
        success: false,
        message: 'Next song not found',
      });
    }

    const leaderboard = game.playerStates.map((ps) => ({
      userId: ps.userId,
      score: ps.score,
      email: ps.userEmail,
    }));

    leaderboard.sort((a, b) => b.score - a.score);

    return res.status(200).json({
      success: true,
      song: nextSong,
      currentSongIndex: playerState.currentSongIndex,
      totalSongs: game.targetSongs.length,
      leaderboard,
    });
  } catch (err) {
    logger.error(`Error getting next song: ${err.message}`);
    res.status(400).json({ success: false, message: 'Request failed.' });
  }
};

module.exports = {
  createLobby,
  getLobby,
  postGameSession,
  postGuess,
  getNextSong,
};
