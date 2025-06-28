Socratic-Quantum Forge: Studio Simulator
1. Project Overview
Socratic-Quantum Forge: Studio Simulator is an interactive, browser-based simulation game that puts you in the role of a creative director at a game studio. Your goal is to guide a project from its initial concept to a successful release. You do this by making declarations about the game's design, which are then processed by a team of AI agents. These agents will build the game, ask clarifying questions, and generate market hype.

The simulation visualizes the entire process, providing real-time feedback on your project's progress, budget, design completeness, and more.

2. How to Play
The simulation is primarily controlled through a command input field. Here's how to get started:

Open index.html in your web browser. You will see the main simulation interface.

Start the Simulation: Click the "Start Sim" button. This will begin the weekly game development cycle.

Define Your Game: Use the command input box to make declarations about your game. The two primary commands are:

/declare [your design idea]: Use this to add a core concept or "Design Fact" to the game's design document (the "Quantum Core").

Example: /declare The game is a first-person shooter.

/answer [question ID] [your answer]: When the "Inquisitor" agent needs more information, it will post a question with a unique ID. Use this command to provide an answer.

Example: /answer uq-f4x1mpl3 The core mechanic involves time manipulation.

Manage the Simulation:

Toggle Sim: Start and stop the automatic weekly progression.

Turn Speed: Adjust the slider to change how fast the weeks pass (from 1 to 5 seconds per week).

Monitor Progress: Keep an eye on the various panels to track your game's development:

Agent Status: See the latest actions taken by your AI team.

Core Metrics: Monitor key performance indicators like Design Completeness, Build Progress, Market Hype, Budget, and Bugs.

Quantum Core: View the list of all the design facts you've declared.

Unanswered Questions: See the list of open questions from the Inquisitor.

Game Release: The game automatically releases when the "Build Progress" reaches 100%. Your final score is calculated based on design completeness, market hype, and the number of bugs.

3. The Simulation Engine
The simulation is driven by a state machine that tracks every aspect of your game project. Each "week," a series of events occurs, and agents perform their roles.

The Agents
Your virtual studio is staffed by four AI agents:

Translator: This agent parses your /declare and /answer commands. It translates your natural language descriptions into structured "quanta" (design facts) that are added to the Quantum Core.

Inquisitor: This agent analyzes the design facts in the Quantum Core. If it finds ambiguities or missing details, it generates questions to help you flesh out the game's design. Answering these questions is crucial for improving your "Design Completeness" score.

Producer: The Producer manages the budget and the development team. Each week, it spends a portion of the budget to increase the "Build Progress." The rate of progress is affected by the number of unanswered questions—more open questions lead to slower progress and more bugs!

Marketing: This agent becomes active a few weeks into the project. It works to build "Market Hype" for your game, which is essential for a high final score.

Core Concepts
Quantum Core: This is the single source of truth for your game's design. It's a database of all the "quanta" or design facts you have declared. A rich and detailed Quantum Core leads to a better game.

Quanta: A single, atomic piece of design information (e.g., genre, a specific mechanic, a character's name).

Game State: A comprehensive JSON object that holds all the current information about the simulation, including the week number, budget, agent activities, and the contents of the Quantum Core.

4. Technical Details
Frontend: The entire simulation is built with HTML5, CSS3, and vanilla JavaScript.

Rendering: The user interface is drawn on an HTML5 <canvas> element, providing a dynamic and visually engaging display.

Local Execution: The simulation runs entirely in your browser. No internet connection is required after the initial page load.

(Note: The queryAgent function suggests an intended integration with a local AI model via an API, but this feature is not fully implemented in the provided code and the simul
