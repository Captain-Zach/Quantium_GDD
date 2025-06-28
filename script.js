// --- CORE SETUP ---
// Get references to all necessary DOM elements
const canvas = document.getElementById('simulationCanvas');
const ctx = canvas.getContext('2d');
const commandInput = document.getElementById('commandInput');
const commandBar = document.getElementById('commandBar');
const submitCommandButton = document.getElementById('submitCommandButton');
const toggleSimButton = document.getElementById('toggleSimButton');
const speedControl = document.getElementById('speedControl');
const speedValue = document.getElementById('speedValue');

// Set canvas dimensions
const canvasWidth = 1280;
const canvasHeight = 720;
canvas.width = canvasWidth;
canvas.height = canvasHeight;

// --- SIMULATION CONTROL ---
let simLoopTimeout = null;
let isSimRunning = false;
let turnIntervalSeconds = 1;

// --- AGENT PERSONALITIES: THE PROMPTS ---
const AGENT_PROMPTS = {
    inquisitor: "You are a critical game designer. Your job is to analyze a new design fact and generate one probing question to expose missing details. Your question must be a single line, and less than 10 words.",
    marketing: "You are a hype-focused marketing agent. Write a short, exciting social media post (140 characters max) about the latest game feature. Include a relevant hashtag like #ProjectChimera.",
    producer: "You are a pragmatic producer. An unresolved design question has caused a bug. Describe the bug in a short, technical-sounding but slightly humorous bug report. Start with 'Bug #[ID]: ' but replace [ID] with a random 3-digit number."
};

// --- SIMULATION STATE: THE SINGLE SOURCE OF TRUTH ---
let simulationState = {
    isWaitingForAgents: false,
    agentStatusText: "Idle",
    gameState: {
        currentWeek: 1,
        projectName: "Project Chimera",
        budget: 1000000,
        designCompleteness: 0,
        buildProgress: 0,
        bugs: 0,
        marketHype: 0,
        weeklySpend: 5000,
        marketingActive: false,
        gameReleased: false,
        finalScore: 0,
        commandQueue: [
            "/declare 'Project Chimera' is a third-person action RPG with stealth elements, set in a cyberpunk fantasy world."
        ],
        lastAgentActivity: {
            translator: "Awaiting input.",
            inquisitor: "Idle.",
            producer: "Awaiting project start.",
            marketing: "Planning phase."
        }
    },
    quantumCore: [],
    unansweredQuestions: [],
    bugReports: [],
};

// --- AGENT BEHAVIOR & SIMULATION LOGIC ---

function generateId(prefix = 'q') {
    return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Asynchronous function to query the local LM Studio model.
 * @param {string} systemPrompt - The instruction/personality for the agent.
 * @param {string} userPrompt - The data for the agent to process.
 * @returns {Promise<string>} The AI-generated text response.
 */
async function queryAgent(systemPrompt, userPrompt) {
    // UPDATED: Point to the local LM Studio server endpoint.
    const endpoint = "http://localhost:1234/v1/chat/completions";

    // UPDATED: Use the OpenAI-compatible message format.
    const payload = {
        model: "local-model", // This field is often ignored by LM Studio but good practice.
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        // LM Studio's server doesn't support streaming from a simple fetch like this.
        stream: false,
    };

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            console.error("API call to local model failed:", response.status, response.statusText);
            return `Fallback: Could not reach the local agent (status: ${response.status}). Is LM Studio running and the server started?`;
        }

        const data = await response.json();
        
        // UPDATED: Parse the response according to OpenAI format.
        if (data.choices && data.choices[0]?.message?.content) {
            return data.choices[0].message.content.trim();
        } else {
            console.error("API Error: Unexpected response format from local model", data);
            return "Fallback: Agent returned an invalid response format.";
        }
    } catch (error) {
        console.error("Failed to connect to LM Studio.", error);
        return "Fallback: The agent is offline. Make sure the LM Studio server is running on http://localhost:1234.";
    }
}


function translatorTurn(input) {
    simulationState.gameState.lastAgentActivity.translator = `Parsing: "${input.substring(0, 30)}..."`;
    const newQuanta = [];
    const lowerInput = input.toLowerCase();

    if (lowerInput.includes('rpg')) newQuanta.push({ quantumType: 'Genre', data: { name: 'Action RPG' } });
    if (lowerInput.includes('stealth')) newQuanta.push({ quantumType: 'MechanicPillar', data: { name: 'Stealth' } });
    if (lowerInput.includes('cyberpunk')) newQuanta.push({ quantumType: 'Setting', data: { name: 'Cyberpunk Fantasy' } });
    if (lowerInput.includes('protagonist')) newQuanta.push({ quantumType: 'Character', data: { name: 'Unit 734' } });
    if (lowerInput.includes('ghostwire')) newQuanta.push({ quantumType: 'Ability', data: { name: 'Ghostwire' } });
    if (lowerInput.includes('art style')) newQuanta.push({ quantumType: 'ArtStyle', data: { name: 'Dystopian Baroque' } });
    if (lowerInput.includes('gameplay loop')) newQuanta.push({ quantumType: 'GameplayLoop', data: { description: 'Explore, Contract, Takedown, Upgrade' } });

    if (newQuanta.length > 0) {
        newQuanta.forEach(q => {
            q.quantumId = generateId();
            q.version = 1;
            q.status = "Active";
            q.createdAt = `Week ${simulationState.gameState.currentWeek}`;
            q.declarationSource = input;
            simulationState.quantumCore.push(q);
        });
        simulationState.gameState.lastAgentActivity.translator = `Created ${newQuanta.length} new quanta.`;
        return true;
    } else {
        simulationState.gameState.lastAgentActivity.translator = `No new quanta defined from input.`;
        return false;
    }
}

async function inquisitorTurn() {
    const recentQuanta = simulationState.quantumCore.filter(q => q.createdAt === `Week ${simulationState.gameState.currentWeek}`);
    if (recentQuanta.length === 0) {
        simulationState.gameState.lastAgentActivity.inquisitor = "No new facts to analyze.";
        return;
    }

    simulationState.gameState.lastAgentActivity.inquisitor = `Analyzing ${recentQuanta.length} new fact(s)...`;
    const newQuestions = [];
    for (const q of recentQuanta) {
        if (q.declarationSource.toLowerCase().startsWith('/answer')) continue;
        const designFact = `[${q.quantumType}] ${q.data.name || q.data.description}`;
        const questionText = await queryAgent(AGENT_PROMPTS.inquisitor, designFact);
        if (!questionText.startsWith("Fallback:") && questionText.length > 10) {
            newQuestions.push({ id: generateId('uq'), text: questionText, status: "Open", sourceQuantumId: q.quantumId });
        }
    }
    if (newQuestions.length > 0) {
        simulationState.unansweredQuestions.push(...newQuestions);
        simulationState.gameState.lastAgentActivity.inquisitor = `Generated ${newQuestions.length} new question(s).`;
    } else {
        simulationState.gameState.lastAgentActivity.inquisitor = "Analysis complete. No new questions.";
    }
}

async function producerTurn() {
    if (simulationState.quantumCore.length === 0 || simulationState.gameState.gameReleased) {
        simulationState.gameState.lastAgentActivity.producer = 'Idle.';
        return;
    }
    simulationState.gameState.budget -= simulationState.gameState.weeklySpend;
    const openQuestions = simulationState.unansweredQuestions.filter(q => q.status === 'Open');
    const progressThisWeek = Math.max(0.5, 5 - (openQuestions.length * 0.5));
    simulationState.gameState.buildProgress = Math.min(100, simulationState.gameState.buildProgress + progressThisWeek);
    let activityLog = `+${progressThisWeek.toFixed(1)}% progress.`;
    if (openQuestions.length > 0 && Math.random() < (openQuestions.length * 0.15)) {
        const questionToBlame = openQuestions[Math.floor(Math.random() * openQuestions.length)];
        const bugText = await queryAgent(AGENT_PROMPTS.producer, `The unresolved question is: "${questionToBlame.text}"`);
        if (!bugText.startsWith("Fallback:")) {
            simulationState.gameState.bugs++;
            simulationState.bugReports.push({ id: generateId('bug'), text: bugText, week: simulationState.gameState.currentWeek, sourceQuestionId: questionToBlame.id });
            activityLog = `A new bug was reported!`;
        }
    }
    simulationState.gameState.lastAgentActivity.producer = activityLog;
    if (simulationState.gameState.buildProgress >= 100) {
        releaseGame();
    }
}

async function marketingTurn() {
    if (!simulationState.gameState.marketingActive || simulationState.gameState.gameReleased) {
        simulationState.gameState.lastAgentActivity.marketing = 'Planning...';
        return;
    }
    const recentQuanta = simulationState.quantumCore.filter(q => q.createdAt === `Week ${simulationState.gameState.currentWeek}`);
    const featureToHype = recentQuanta.find(q => ['Ability', 'Character', 'MechanicPillar', 'Setting'].includes(q.quantumType));
    if (featureToHype) {
        const featureDescription = `The new game feature is a ${featureToHype.quantumType} called '${featureToHype.data.name}'.`;
        const hypeText = await queryAgent(AGENT_PROMPTS.marketing, featureDescription);
        simulationState.gameState.lastAgentActivity.marketing = hypeText.startsWith("Fallback:") ? "Creative block! We'll post something next week." : hypeText;
    }
    const hypeThisWeek = simulationState.quantumCore.length / 2;
    simulationState.gameState.marketHype = Math.min(100, simulationState.gameState.marketHype + hypeThisWeek);
    simulationState.gameState.weeklySpend += 2000;
}

function resolveAnswer(input) {
    const questionIdMatch = input.match(/(\/answer\s+)(uq-[a-z0-9]+)/);
    if (questionIdMatch) {
        const questionId = questionIdMatch[2];
        const question = simulationState.unansweredQuestions.find(q => q.id === questionId);
        if (question) {
            question.status = "Answered";
            translatorTurn(input);
            simulationState.gameState.lastAgentActivity.translator = `Answered question ${questionId}.`
            return true;
        }
    }
    translatorTurn(input);
    return false;
}

async function advanceWeek() {
    if (simulationState.gameState.gameReleased || simulationState.isWaitingForAgents) return;

    const input = simulationState.gameState.commandQueue.shift();
    let processed = false;
    if (input && input.trim() !== '') {
        if (input.startsWith('/declare')) processed = translatorTurn(input);
        else if (input.startsWith('/answer')) processed = resolveAnswer(input);
    }

    setWaitingState(true, "Agents are thinking...");
    
    const agentPromises = [];
    if (processed) {
        agentPromises.push(inquisitorTurn());
    }
    agentPromises.push(producerTurn());
    if (simulationState.gameState.currentWeek > 5) {
        simulationState.gameState.marketingActive = true;
    }
    agentPromises.push(marketingTurn());
    
    await Promise.all(agentPromises);
    
    setWaitingState(false, "Thinking complete. Proceeding to next week.");

    simulationState.gameState.currentWeek++;
    const openQuestions = simulationState.unansweredQuestions.filter(q => q.status === 'Open').length;
    const totalItems = simulationState.quantumCore.length + openQuestions;
    simulationState.gameState.designCompleteness = totalItems > 0 ? (simulationState.quantumCore.length / totalItems) * 100 : (simulationState.quantumCore.length > 0 ? 100 : 0);
    
    updatePlaceholder();
    draw();
}

function setWaitingState(isWaiting, statusText) {
    simulationState.isWaitingForAgents = isWaiting;
    simulationState.agentStatusText = statusText;
    submitCommandButton.disabled = isWaiting;
    toggleSimButton.disabled = isWaiting;
    commandInput.disabled = isWaiting;
    draw();
}

function updatePlaceholder() {
    const openQuestion = simulationState.unansweredQuestions.find(q => q.status === 'Open');
    commandInput.placeholder = openQuestion ? `e.g., /answer ${openQuestion.id} ...` : "e.g., /declare The main villain is...";
}

function releaseGame() {
    simulationState.gameState.gameReleased = true;
    commandBar.style.display = 'none';
    const designScore = simulationState.gameState.designCompleteness;
    const hypeScore = simulationState.gameState.marketHype;
    const qualityScore = Math.max(0, 100 - (simulationState.gameState.bugs * 2));
    simulationState.gameState.finalScore = (designScore * 0.4) + (hypeScore * 0.3) + (qualityScore * 0.3);
    simulationState.gameState.lastAgentActivity.producer = `GAME RELEASED! Final Score: ${simulationState.gameState.finalScore.toFixed(1)}`
}

// --- RENDERING ENGINE ---
function drawPanel(x, y, w, h, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.rect(x, y, w, h); ctx.fill(); }
function drawText(text, x, y, size = 16, color = '#ecf0f1', align = 'left', baseline = 'alphabetic') { ctx.fillStyle = color; ctx.font = `bold ${size}px 'Segoe UI'`; ctx.textAlign = align; ctx.textBaseline = baseline; ctx.fillText(text, x, y); }
function drawProgressBar(label, x, y, w, h, value, color) {
    ctx.fillStyle = '#1a1a1a'; ctx.fillRect(x, y, w, h);
    const fillWidth = (w * value) / 100;
    ctx.fillStyle = color; ctx.fillRect(x, y, fillWidth, h);
    ctx.strokeStyle = '#7f8c8d'; ctx.strokeRect(x, y, w, h);
    const text = `${label}: ${value.toFixed(1)}%`;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillText(text, x + w / 2 + 1, y + h / 2 + 1);
    drawText(text, x + w / 2, y + h / 2, 14, '#ffffff', 'center', 'middle');
}

function draw() {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    const margin = 20;
    const colWidth = (canvasWidth - margin * 3) / 2;
    const rowHeight = 130;

    drawPanel(0, 0, canvasWidth, 60, '#1f2b38');
    drawText(simulationState.gameState.projectName, margin, 35, 32, '#e67e22');
    drawText(`Week: ${simulationState.gameState.currentWeek}`, canvasWidth - margin, 35, 32, '#ecf0f1', 'right');

    drawPanel(margin, 80, colWidth, rowHeight, '#34495e');
    drawText("Command Hub (Your Turn)", margin + 10, 105, 18, '#bdc3c7');

    const rightColX = margin * 2 + colWidth;
    drawPanel(rightColX, 80, colWidth, rowHeight, '#34495e');
    drawText("Agent Status", rightColX + 10, 105, 18, '#bdc3c7');
    drawText(`- Translator: ${simulationState.gameState.lastAgentActivity.translator.substring(0, 65)}`, rightColX + 20, 130, 14);
    drawText(`- Inquisitor: ${simulationState.gameState.lastAgentActivity.inquisitor.substring(0, 65)}`, rightColX + 20, 150, 14);
    drawText(`- Producer: ${simulationState.gameState.lastAgentActivity.producer.substring(0, 65)}`, rightColX + 20, 170, 14);
    const marketingText = simulationState.gameState.lastAgentActivity.marketing;
    drawText(`- Marketing: ${marketingText.substring(0, 65)}`, rightColX + 20, 190, 14);
    if (marketingText.length > 65) drawText(marketingText.substring(65, 130), rightColX + 30, 205, 14);

    const metricsPanelY = 230;
    const metricsPanelHeight = 120;
    drawPanel(margin, metricsPanelY, canvasWidth - margin * 2, metricsPanelHeight, '#34495e');
    drawText("Core Metrics", margin + 10, metricsPanelY + 25, 18, '#bdc3c7');
    const barWidth = 350; const barHeight = 25;
    drawProgressBar("Design Completeness", margin + 20, metricsPanelY + 45, barWidth, barHeight, simulationState.gameState.designCompleteness, '#2980b9');
    drawProgressBar("Build Progress", margin + 20, metricsPanelY + 80, barWidth, barHeight, simulationState.gameState.buildProgress, '#27ae60');
    const textMetricsX = margin + barWidth + 40;
    drawProgressBar("Market Hype", textMetricsX, metricsPanelY + 45, 180, barHeight, simulationState.gameState.marketHype, '#f1c40f');
    drawText(`Budget: $${simulationState.gameState.budget.toLocaleString()}`, textMetricsX, metricsPanelY + 98, 16, '#2ecc71');
    drawText(`Bugs: ${simulationState.gameState.bugs}`, textMetricsX + 200, metricsPanelY + 98, 16, '#e74c3c');

    const dbPanelY = 370;
    const bottomPanelHeight = canvasHeight - dbPanelY - margin;
    const halfHeight = (bottomPanelHeight - margin) / 2;
    drawPanel(margin, dbPanelY, colWidth, bottomPanelHeight, '#34495e');
    drawText("Quantum Core (Design Facts)", margin + 10, dbPanelY + 25, 18, '#bdc3c7');
    simulationState.quantumCore.slice(-12).forEach((q, i) => {
        drawText(`[${q.quantumType}] ${q.data.name || q.data.description || ''}`.substring(0, 60), margin + 20, dbPanelY + 55 + i * 22, 14);
    });

    drawPanel(rightColX, dbPanelY, colWidth, halfHeight, '#34495e');
    drawText("Unanswered Questions", rightColX + 10, dbPanelY + 25, 18, '#bdc3c7');
    simulationState.unansweredQuestions.filter(q => q.status === 'Open').slice(0, 5).forEach((uq, i) => {
        drawText(`${uq.id}: ${uq.text.substring(0, 50)}...`, rightColX + 20, dbPanelY + 55 + i * 22, 14, '#e74c3c');
    });

    const bugPanelY = dbPanelY + halfHeight + margin;
    drawPanel(rightColX, bugPanelY, colWidth, halfHeight, '#34495e');
    drawText("Recent Bug Reports", rightColX + 10, bugPanelY + 25, 18, '#bdc3c7');
    simulationState.bugReports.slice(-5).forEach((bug, i) => {
        drawText(bug.text.substring(0, 65), rightColX + 20, bugPanelY + 55 + i * 22, 14, '#f39c12');
    });

    if (simulationState.isWaitingForAgents) {
        drawPanel(0, 0, canvasWidth, canvasHeight, 'rgba(44, 62, 80, 0.85)');
        drawText(simulationState.agentStatusText, canvasWidth / 2, canvasHeight / 2, 40, '#ecf0f1', 'center');
    }

    if (simulationState.gameState.gameReleased) {
        drawPanel(0, 0, canvasWidth, canvasHeight, 'rgba(44, 62, 80, 0.9)');
        drawText('GAME RELEASED!', canvasWidth / 2, canvasHeight / 2 - 50, 60, '#e67e22', 'center');
        drawText(`Final Score: ${simulationState.gameState.finalScore.toFixed(1)} / 100`, canvasWidth / 2, canvasHeight / 2 + 20, 40, '#ecf0f1', 'center');
        drawText('Refresh the page to start a new project.', canvasWidth / 2, canvasHeight / 2 + 80, 20, '#bdc3c7', 'center');
    }
}

// --- ASYNC-FRIENDLY GAME LOOP ---

function gameLoop() {
    if (!isSimRunning) return;
    advanceWeek().then(() => {
        if (isSimRunning) {
            simLoopTimeout = setTimeout(gameLoop, turnIntervalSeconds * 1000);
        }
    });
}

function toggleSimulation() {
    isSimRunning = !isSimRunning;
    clearTimeout(simLoopTimeout);
    if (isSimRunning) {
        toggleSimButton.textContent = 'Stop Sim';
        toggleSimButton.classList.add('running');
        gameLoop();
    } else {
        toggleSimButton.textContent = 'Start Sim';
        toggleSimButton.classList.remove('running');
    }
}

function updateSpeed() {
    turnIntervalSeconds = speedControl.value;
    speedValue.textContent = `${turnIntervalSeconds}s`;
}

function initialize() {
    const margin = 20;
    const colWidth = (canvasWidth - margin * 3) / 2;
    commandBar.style.left = `${margin + 10}px`;
    commandBar.style.top = `${125}px`;
    commandInput.style.width = `${colWidth - 140}px`;

    submitCommandButton.addEventListener('click', () => {
        submitCommand();
        if (!isSimRunning) advanceWeek();
    });
    commandInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            submitCommand();
            if (!isSimRunning) advanceWeek();
        }
    });
    toggleSimButton.addEventListener('click', toggleSimulation);
    speedControl.addEventListener('input', updateSpeed);

    updatePlaceholder();
    draw();
};

function submitCommand() {
    if (!isSimRunning && simulationState.gameState.commandQueue.length > 0) {
        simulationState.gameState.commandQueue[0] = commandInput.value;
        commandInput.value = '';
        return;
    }
    const command = commandInput.value;
    if (command.trim() !== '') {
        simulationState.gameState.commandQueue.push(command);
        commandInput.value = '';
    }
}

window.onload = initialize;
