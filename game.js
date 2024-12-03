// 전역 변수
let player;
let isJumping = false;
let gameActive = false;
let currentStage = 1;
let hearts = 3;
let gameTime = 60;
let timer;
let obstacles = [];
let obstacleIntervals = [];
let currentObstacle = null;
let passedObstacles = new Set();
let runningAnimation;
let playerX = 100;  // 캐릭터의 X 위치
let playerY = 50;   // 캐릭터의 Y 위치
let moveLeft = false;
let moveRight = false;
const MOVE_SPEED = 5;  // 이동 속도
const JUMP_POWER = 150;  // 점프 높이

const playerImages = [
    'images/run1.png',
    'images/run2.png',
    'images/run3.png',
    'images/run4.png'
];
let currentFrame = 0;

// 장애물 타입 정의
const OBSTACLE_TYPES = {
    MOVING: 'moving',
    POPUP: 'popup'
};

// 전역 변수 추가
let caughtThieves = 0;

// 전역 변수 추가 (파일 상단에 추가)
let lastTime = 0;

// 전역 변수로 Stage 관리
let stageDisplay = document.getElementById('stage');  // Stage 표시 요소

// 페처블머신에서 내보낸 모델 URL을 로컬 경로로 변경
const URL = "./model/";
let model, webcam, maxPredictions;

async function initPoseModel() {
    const modelURL = URL + "model.json";
    const metadataURL = URL + "metadata.json";

    // 모델 로드
    model = await tmPose.load(modelURL, metadataURL);
    maxPredictions = model.getTotalClasses();

    // 웹캠 설정
    const size = 200;
    const flip = true;
    webcam = new tmPose.Webcam(size, size, flip);
    await webcam.setup();
    await webcam.play();
    
    // DOM에 웹캠 추가
    const webcamContainer = document.getElementById("webcam-container");
    webcamContainer.appendChild(webcam.canvas);

    // 예측 루프 시작
    window.requestAnimationFrame(poseLoop);
}

async function poseLoop() {
    webcam.update();
    await predictPose();
    window.requestAnimationFrame(poseLoop);
}

async function predictPose() {
    const { pose, posenetOutput } = await model.estimatePose(webcam.canvas);
    const prediction = await model.predict(posenetOutput);

    // 예측 결과에 따라 캐릭터 이동
    prediction.forEach(pred => {
        if (pred.probability > 0.8) { // 80% 이상의 확률일 때만 동작
            if (pred.className === "right") {
                moveRight = true;
                moveLeft = false;
            } else if (pred.className === "left") {
                moveLeft = true;
                moveRight = false;
            } else {
                moveLeft = false;
                moveRight = false;
            }
        }
    });
}

// 페이지 로드 시 실행
window.onload = function() {
    // 입력 필드와 버튼 요소 가져오기
    const playerNameInput = document.getElementById('playerName');
    const startButton = document.getElementById('startButton');

    // 입력 필드의 값이 변경될 때마다 실행
    playerNameInput.addEventListener('input', function() {
        // 입력값이 있으면 버튼 활성화, 없으면 비활성화
        startButton.disabled = !this.value.trim();
        console.log('Input changed:', this.value.trim(), 'Button disabled:', startButton.disabled);
    });

    // 시작 버튼 클릭 시 실행
    startButton.addEventListener('click', function() {
        const playerName = playerNameInput.value.trim();
        if (playerName) {
            startGame(playerName);
        }
    });

    initPoseModel(); // 포즈 모델 초기화
};

// 게임 초기화
function startGame(playerName) {
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('gameScreen').style.display = 'block';
    
    gameActive = true;
    player = document.getElementById('player');
    
    // 초기 상태 설정
    updateHearts(3);
    updateTimer(60);
    
    // 초기 위치 설정
    playerX = 100;
    playerY = 50;
    player.style.left = playerX + 'px';
    player.style.bottom = playerY + 'px';
    
    // 달리기 애니메이션 시작
    startRunningAnimation();
    
    // 타이머 시작
    timer = setInterval(() => {
        if (gameTime > 0) {
            gameTime--;
            updateTimer(gameTime);
        } else {
            nextStage();
        }
    }, 1000);
    
    // 장애물 성 시작
    spawnObstacles();
    
    // 점프 이벤트 리스너
    document.addEventListener('keydown', function(event) {
        if (!gameActive) return;
        
        switch(event.code) {
            case 'ArrowLeft':
                moveLeft = true;
                break;
            case 'ArrowRight':
                moveRight = true;
                break;
            case 'Space':
                if (!isJumping) {
                    jump();
                }
                break;
        }
    });

    document.addEventListener('keyup', function(event) {
        switch(event.code) {
            case 'ArrowLeft':
                moveLeft = false;
                break;
            case 'ArrowRight':
                moveRight = false;
                break;
        }
    });

    // 게임 루프 시작
    gameLoop();

    caughtThieves = 0;  // 도둑 잡은 수 초기화
    document.getElementById('caughtCount').textContent = caughtThieves;

    initMobileControls();

    // 게임 초기화
    currentStage = 1;  // Stage 1부터 시작
    stageDisplay.textContent = currentStage;  // Stage 표시 업데이트
}

// 달리기 애니메이션
function startRunningAnimation() {
    runningAnimation = setInterval(() => {
        if (gameActive) {
            const playerImg = player.querySelector('.player-img');
            currentFrame = (currentFrame + 1) % playerImages.length;
            playerImg.src = playerImages[currentFrame];
        }
    }, 100);
}

// 캐릭터 이동 함수
function movePlayer() {
    if (!gameActive) return;

    if (moveLeft && playerX > 0) {
        playerX -= MOVE_SPEED;
        player.style.transform = 'scaleX(-1)';  // 캐릭터 좌측 방향
    }
    if (moveRight && playerX < 700) {  // 게임 컨테이너 너비(800) - 캐릭터 너비(100)
        playerX += MOVE_SPEED;
        player.style.transform = 'scaleX(1)';   // 캐릭터 우측 방향
    }

    player.style.left = playerX + 'px';
}

// 점프 함수 수정
function jump() {
    if (isJumping) return;
    
    isJumping = true;
    let jumpHeight = 0;
    let jumpUp = true;
    const jumpInterval = setInterval(() => {
        if (jumpUp) {
            jumpHeight += 5;
            if (jumpHeight >= JUMP_POWER) {
                jumpUp = false;
            }
        } else {
            jumpHeight -= 5;
            if (jumpHeight <= 0) {
                clearInterval(jumpInterval);
                isJumping = false;
                jumpHeight = 0;
            }
        }
        playerY = 50 + jumpHeight;
        player.style.bottom = playerY + 'px';
    }, 20);
}

// 게임 루프 함수 추가
function gameLoop(currentTime) {
    if (!lastTime) {
        lastTime = currentTime;
    }

    const deltaTime = currentTime - lastTime;
    
    if (gameActive) {
        movePlayer();
    }
    
    lastTime = currentTime;
    requestAnimationFrame(gameLoop);
}

// 장애물 생성
function spawnObstacles() {
    const spawnInterval = setInterval(() => {
        if (gameActive) {
            // 랜덤하게 장애물 타입 선택
            const obstacleType = Math.random() < 0.5 ? OBSTACLE_TYPES.MOVING : OBSTACLE_TYPES.POPUP;
            createObstacle(obstacleType);
        }
    }, 4000);
}

// 장애물 생성 함수
function createObstacle(type) {
    const obstacle = document.createElement('div');
    obstacle.className = 'obstacle';
    
    if (type === OBSTACLE_TYPES.MOVING) {
        // 오른쪽에서 이동하는 장애물
        obstacle.style.left = '800px';
        obstacle.style.bottom = '50px';
        document.getElementById('gameContainer').appendChild(obstacle);
        
        let position = 800;
        const moveInterval = setInterval(() => {
            if (!gameActive) return;
            
            if (position < -60) {
                clearInterval(moveInterval);
                passedObstacles.delete(obstacle);
                obstacle.remove();
                const index = obstacleIntervals.indexOf(moveInterval);
                if (index > -1) {
                    obstacleIntervals.splice(index, 1);
                }
            } else {
                position -= 5;
                obstacle.style.left = position + 'px';
                if (!passedObstacles.has(obstacle)) {
                    checkCollision(obstacle);
                }
            }
        }, 20);
        
        obstacleIntervals.push(moveInterval);
    } else {
        // 아래에서 올라왔다 내려가는 장애물
        const randomX = Math.floor(Math.random() * 600) + 100; // 100px ~ 700px
        obstacle.style.left = randomX + 'px';
        obstacle.style.bottom = '-100px';
        document.getElementById('gameContainer').appendChild(obstacle);
        
        let isRising = true;
        let position = -100;
        const popupInterval = setInterval(() => {
            if (!gameActive) return;
            
            if (isRising) {
                position += 10;
                if (position >= 50) {
                    isRising = false;
                    // 1초 동안 대기
                    setTimeout(() => {
                        isRising = null;
                    }, 1000);
                }
            } else if (isRising === null) {
                isRising = false;
            } else {
                position -= 10;
                if (position <= -100) {
                    clearInterval(popupInterval);
                    passedObstacles.delete(obstacle);
                    obstacle.remove();
                    const index = obstacleIntervals.indexOf(popupInterval);
                    if (index > -1) {
                        obstacleIntervals.splice(index, 1);
                    }
                }
            }
            
            obstacle.style.bottom = position + 'px';
            if (!passedObstacles.has(obstacle)) {
                checkCollision(obstacle);
            }
        }, 50);
        
        obstacleIntervals.push(popupInterval);
    }
}

// 충돌 감지
function checkCollision(obstacle) {
    if (passedObstacles.has(obstacle)) {
        return;
    }

    const playerRect = player.getBoundingClientRect();
    const obstacleRect = obstacle.getBoundingClientRect();
    
    // 히트박스 여유 공간 조정 (숫자를 조절하여 히트박스 크기 미세조정 가능)
    const hitboxTolerance = 10;
    
    // 충돌 판정을 위한 히트박스 계산
    const collision = !(
        playerRect.right - hitboxTolerance < obstacleRect.left + hitboxTolerance ||  // 플레이어 오른쪽
        playerRect.left + hitboxTolerance > obstacleRect.right - hitboxTolerance ||  // 플레이어 왼쪽
        playerRect.bottom - hitboxTolerance < obstacleRect.top + hitboxTolerance ||  // 플레이어 아래
        playerRect.top + hitboxTolerance > obstacleRect.bottom - hitboxTolerance     // 플레이어 위
    );

    if (collision && !currentObstacle) {
        currentObstacle = obstacle;
        showMathProblem();
    }
}

// 디버그 히트박스 표시 (개발 중에만 사용)
function drawHitbox(element, color) {
    const rect = element.getBoundingClientRect();
    const hitbox = document.createElement('div');
    hitbox.style.position = 'absolute';
    hitbox.style.left = rect.left + 'px';
    hitbox.style.top = rect.top + 'px';
    hitbox.style.width = rect.width + 'px';
    hitbox.style.height = rect.height + 'px';
    hitbox.style.border = `2px solid ${color}`;
    hitbox.style.pointerEvents = 'none';
    document.body.appendChild(hitbox);
    setTimeout(() => hitbox.remove(), 100);
}

// 수학 문제 표시
function showMathProblem() {
    gameActive = false;
    clearInterval(runningAnimation);
    
    // generateProblem 함수를 사용하여 문제 생성
    const problem = generateProblem();
    
    document.getElementById('problem').textContent = problem.question;
    
    const choiceButtons = document.querySelectorAll('.choice-btn');
    problem.choices.forEach((choice, index) => {
        choiceButtons[index].textContent = choice;
        choiceButtons[index].value = choice;
    });
    
    document.getElementById('mathProblem').style.display = 'block';
    
    let problemTimer = 10;
    const timerElement = document.getElementById('timeLeft');
    
    const countDown = setInterval(() => {
        timerElement.textContent = `남은 시간: ${problemTimer}초`;
        if (problemTimer <= 0) {
            clearInterval(countDown);
            wrongAnswer();
        }
        problemTimer--;
    }, 1000);

    window.currentProblem = {
        answer: problem.answer,
        timer: countDown
    };

    console.log('출제된 문제:', {
        stage: currentStage,
        question: problem.question,
        answer: problem.answer,
        choices: problem.choices
    });
}

// 보기 생성
function generateChoices(correctAnswer, maxNum) {
    let choices = [correctAnswer];
    
    while (choices.length < 4) {
        let wrongAnswer = correctAnswer + Math.floor(Math.random() * 10) - 5;
        if (wrongAnswer > 0 && !choices.includes(wrongAnswer) && wrongAnswer !== correctAnswer) {
            choices.push(wrongAnswer);
        }
    }
    
    return shuffleArray(choices);
}

// 배열 섞기
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// 정답 체크
function checkAnswer(buttonElement) {
    const userAnswer = parseInt(buttonElement.value);
    const correctAnswer = window.currentProblem.answer;
    
    clearInterval(window.currentProblem.timer);
    
    if (userAnswer === correctAnswer) {
        document.getElementById('mathProblem').style.display = 'none';
        
        // 도둑 잡은 수 증가 및 UI 업데이트
        caughtThieves++;
        document.getElementById('caughtCount').textContent = caughtThieves;
        
        // 성공 효과 애니메이션
        const successMessage = document.getElementById('successMessage');
        successMessage.style.display = 'block';
        
        if (currentObstacle) {
            currentObstacle.classList.add('passed');
            passedObstacles.add(currentObstacle);
        }
        
        setTimeout(() => {
            successMessage.style.display = 'none';
            gameActive = true;
            startRunningAnimation();
            currentObstacle = null;
        }, 3000);
    } else {
        wrongAnswer();
    }

    if (thievesInCurrentStage >= 4) {
        console.log(`Stage ${currentStage} 완료, 다음 Stage로 이동`);  // 디버깅용
        setTimeout(() => {
            nextStage();
        }, 1000);
    }
}

// 오답 처리
function wrongAnswer() {
    hearts--;
    updateHearts(hearts);
    document.getElementById('mathProblem').style.display = 'none';
    
    if (currentObstacle) {
        currentObstacle.classList.add('passed');
        passedObstacles.add(currentObstacle);
    }
    
    if (hearts <= 0) {
        gameOver();
    } else {
        gameActive = true;
        startRunningAnimation();
        currentObstacle = null;
    }

    console.log('Hearts remaining:', hearts);
}

// 다음 스테이지
function nextStage() {
    currentStage++;  // Stage 증가
    stageDisplay.textContent = currentStage;  // Stage 표시 업데이트
    thievesInCurrentStage = 0;  // 새 스테이지 도둑 카운트 초기화
    
    console.log(`Stage 변경: ${currentStage}`);  // 디버깅용
    
    gameTime = 60;
    hearts = 3;
    updateHearts(hearts);
    updateTimer(gameTime);
    
    // 스테이지 변경 효과
    const stageElement = document.getElementById('stage');
    stageElement.style.transform = 'scale(1.5)';
    setTimeout(() => {
        stageElement.style.transform = 'scale(1)';
    }, 500);
}

// 게임 오버
function gameOver() {
    gameActive = false;
    clearInterval(timer);
    clearInterval(runningAnimation);
    
    const playerName = document.getElementById('playerName').value;
    alert(`게임 오버!\n플레이어: ${playerName}\n달성 스테이지: ${currentStage}\n잡은 도둑: ${caughtThieves}명`);
    
    document.getElementById('gameScreen').style.display = 'none';
    document.getElementById('startScreen').style.display = 'flex';
    document.getElementById('playerName').value = '';
    document.getElementById('startButton').disabled = true;
}

// 하트 업데이트
function updateHearts(count) {
    const hearts = document.querySelectorAll('.heart');
    hearts.forEach((heart, index) => {
        if (index < count) {
            heart.innerHTML = '❤️';
            heart.classList.remove('heart-empty');
        } else {
            heart.innerHTML = '🖤';
            heart.classList.add('heart-empty');
        }
    });
}

// 타이머 업데이트
function updateTimer(time) {
    const percentage = (time / 60) * 100;
    const timerFill = document.querySelector('.timer-fill');
    if (timerFill) {
        timerFill.style.width = `${percentage}%`;
        
        if (percentage > 60) {
            timerFill.style.backgroundColor = '#4CAF50';
        } else if (percentage > 30) {
            timerFill.style.backgroundColor = '#FFA500';
        } else {
            timerFill.style.backgroundColor = '#FF0000';
        }
    }
}

// CSS 정
const style = document.createElement('style');
style.textContent = `
    .obstacle {
        width: 60px;
        height: 100px;
        position: absolute;
        background: url('./images/obstacle.png') no-repeat center;
        background-size: contain;
        transition: bottom 0.05s linear;
    }

    #player {
        width: 100px;
        height: 100px;
        position: absolute;
        bottom: 50px;
        left: 100px;
        transition: transform 0.1s;
        /* 히트박스 확인용 테두리 (개발 중에만 사용) */
        /* border: 1px solid blue; */
    }

    #successMessage {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(76, 175, 80, 0.9);
        color: white;
        padding: 20px 40px;
        border-radius: 15px;
        font-size: 24px;
        display: none;
        animation: fadeInOut 3s ease;
    }

    @keyframes fadeInOut {
        0% { opacity: 0; }
        10% { opacity: 1; }
        90% { opacity: 1; }
        100% { opacity: 0; }
    }
`;
document.head.appendChild(style);

// 모바일 컨트롤 초기화 함수
function initMobileControls() {
    const leftBtn = document.getElementById('leftBtn');
    const rightBtn = document.getElementById('rightBtn');
    const jumpBtn = document.getElementById('jumpBtn');

    // 왼쪽 버튼
    leftBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        moveLeft = true;
    });
    leftBtn.addEventListener('touchend', () => {
        moveLeft = false;
    });

    // 오른쪽 버튼
    rightBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        moveRight = true;
    });
    rightBtn.addEventListener('touchend', () => {
        moveRight = false;
    });

    // 점프 버튼
    jumpBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (!isJumping) {
            jump();
        }
    });

    // 기본 터치 동작 방지
    document.addEventListener('touchmove', (e) => {
        if (e.target.closest('#mobileControls')) {
            e.preventDefault();
        }
    }, { passive: false });
}

// 모바일 기기 감지
function isMobileDevice() {
    return (typeof window.orientation !== "undefined") 
        || (navigator.userAgent.indexOf('IEMobile') !== -1);
}

// 화면 크기 조정 시 게임 요소 재조정
window.addEventListener('resize', () => {
    const gameContainer = document.getElementById('gameContainer');
    if (window.innerWidth <= 768) {
        gameContainer.style.width = '100%';
        // 다른 요소들의 크기도 조정
    }
});

// 이미지 프리로딩
function preloadImages() {
    const images = [
        'images/run1.png',
        'images/run2.png',
        'images/run3.png',
        'images/run4.png',
        'images/obstacle.png',
        'images/background.png'
    ];
    
    images.forEach(src => {
        const img = new Image();
        img.src = src;
    });
}

// 화면 크기에 따른 게임 요소 조정
function adjustGameElements() {
    if (window.innerWidth <= 768) {
        const gameContainer = document.getElementById('gameContainer');
        gameContainer.style.width = '100%';
        // 필요한 경우 다른 요소들의 크기도 조정
    }
}

window.addEventListener('resize', adjustGameElements);

// 문제 생성 함수 수정
function generateProblem() {
    let num1, num2, operator;
    
    console.log(`문제 생성 시작: 현재 Stage = ${currentStage}`);

    // Stage 1: 몇백+몇백몇십 (받아올림 없음)
    if (currentStage === 1) {
        do {
            num1 = Math.floor(Math.random() * 9 + 1) * 100;  // 100~900
            let tens = Math.floor(Math.random() * 10) * 10;  // 0~90
            let hundreds = Math.floor(Math.random() * 9 + 1) * 100;  // 100~900
            num2 = hundreds + tens;
        } while (num1 + num2 >= 1000);  // 받아올림이 없도록 합이 1000 미만
        operator = '+';
        console.log(`Stage 1 문제: ${num1} + ${num2} = ${num1 + num2}`);
    }
    // Stage 2: 몇백-몇백몇십 (받아내림 없음)
    else if (currentStage === 2) {
        let hundreds = Math.floor(Math.random() * 9 + 1) * 100;  // 100~900
        let tens = Math.floor(Math.random() * 10) * 10;  // 0~90
        num1 = hundreds + tens;
        do {
            num2 = Math.floor(Math.random() * (hundreds/100)) * 100 + 
                   Math.floor(Math.random() * (tens/10)) * 10;
        } while (num2 >= num1);  // 받아내림이 없도록 num2가 num1보다 작게
        operator = '-';
        console.log(`Stage 2 문제: ${num1} - ${num2} = ${num1 - num2}`);
    }
    // Stage 3: 몇십×몇
    else if (currentStage === 3) {
        num1 = Math.floor(Math.random() * 9 + 1) * 10;  // 10~90
        num2 = Math.floor(Math.random() * 9 + 1);       // 1~9
        operator = '×';
        console.log(`Stage 3 문제: ${num1} × ${num2} = ${num1 * num2}`);
    }
    // Stage 4: 몇십÷몇 (나머지 없음)
    else if (currentStage === 4) {
        num2 = Math.floor(Math.random() * 9 + 1);       // 1~9
        let result = Math.floor(Math.random() * 9 + 1) * 10;  // 10~90
        num1 = result * num2;  // 나머지가 없도록 역산
        operator = '÷';
        console.log(`Stage 4 문제: ${num1} ÷ ${num2} = ${num1 / num2}`);
    }
    // Stage 5: 두 자리 수의 덧셈 (받아올림 있음)
    else if (currentStage === 5) {
        num1 = Math.floor(Math.random() * 90 + 10);  // 10~99
        num2 = Math.floor(Math.random() * 90 + 10);  // 10~99
        operator = '+';
        console.log(`Stage 5 문제: ${num1} + ${num2} = ${num1 + num2}`);
    }
    // Stage 6: 두 자리 수의 뺄셈 (받아내림 있음)
    else if (currentStage === 6) {
        do {
            num1 = Math.floor(Math.random() * 90 + 10);  // 10~99
            num2 = Math.floor(Math.random() * 90 + 10);  // 10~99
        } while (num2 >= num1);  // num2가 num1보다 작게
        operator = '-';
        console.log(`Stage 6 문제: ${num1} - ${num2} = ${num1 - num2}`);
    }
    // Stage 7: 두 자리 수와 한 자리 수의 곱셈
    else if (currentStage === 7) {
        num1 = Math.floor(Math.random() * 90 + 10);  // 10~99
        num2 = Math.floor(Math.random() * 9 + 1);    // 1~9
        operator = '×';
        console.log(`Stage 7 문제: ${num1} × ${num2} = ${num1 * num2}`);
    }
    // Stage 8: 두 자리 수와 한 자리 수의 나눗셈 (나머지 있음)
    else if (currentStage === 8) {
        num2 = Math.floor(Math.random() * 9 + 1);    // 1~9
        num1 = Math.floor(Math.random() * 90 + 10);  // 10~99
        operator = '÷';
        console.log(`Stage 8 문제: ${num1} ÷ ${num2} = ${Math.floor(num1 / num2)}`);
    }

    // 정답 계산
    const answer = operator === '+' ? num1 + num2 : 
                  operator === '-' ? num1 - num2 : 
                  operator === '×' ? num1 * num2 :
                  Math.floor(num1 / num2);

    // 오답 생성
    let wrongAnswers = [];
    while (wrongAnswers.length < 3) {
        let wrongAnswer;
        let variation;
        
        // 각 단계별로 적절한 오답 범위 설정
        if (currentStage <= 5) {
            variation = Math.floor(Math.random() * 20 + 10);  // 10~30 차이
        } else if (currentStage <= 6) {
            variation = Math.floor(Math.random() * 15 + 5);   // 5~20 차이
        } else if (currentStage <= 7) {
            variation = Math.floor(Math.random() * 50 + 10);  // 10~60 차이
        } else {
            variation = Math.floor(Math.random() * 5 + 1);    // 1~5 차이
        }

        if (Math.random() < 0.5) {
            wrongAnswer = answer + variation;
        } else {
            wrongAnswer = answer - variation;
        }

        if (wrongAnswer !== answer && 
            !wrongAnswers.includes(wrongAnswer) && 
            wrongAnswer > 0) {
            wrongAnswers.push(wrongAnswer);
        }
    }

    // 보기 배열 생성 및 섞기
    const choices = [...wrongAnswers, answer];
    for (let i = choices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [choices[i], choices[j]] = [choices[j], choices[i]];
    }

    return {
        question: `${num1} ${operator} ${num2} = ?`,
        choices: choices,
        answer: answer
    };
}