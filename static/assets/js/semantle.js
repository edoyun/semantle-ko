/*
    Copyright (c) 2022, Newsjelly, forked from Semantlich by Johannes Gätjen semantlich.johannesgaetjen.de and Semantle by David Turner <novalis@novalis.org> semantle.novalis.org

    This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, version 3.

    This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

    You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>.
*/
'use strict';

let gameOver = false;
let guesses = [];
let hint = [];
let guessed = new Set();
let guessCount = 0;
let hintCount = 0;
let model = null;
let numPuzzles = 4650;
const now = Date.now();
const initialDate = new Date('2022-04-01T00:00:00+09:00');
let puzzleNumber = Math.floor((new Date() - initialDate) / 86400000) % numPuzzles;
const yesterdayPuzzleNumber = (puzzleNumber + numPuzzles - 1) % numPuzzles;
const storage = window.localStorage;
let chrono_forward = 1;
let prefersDarkColorScheme = false;
// settings
let darkMode = storage.getItem("darkMode") === 'true';
let shareGuesses = storage.getItem("shareGuesses") === 'false' ? false: true;
let shareTime = storage.getItem("shareTime") === 'false' ? false: true;
let shareTopGuess = storage.getItem("shareTopGuess") === 'false' ? false: true;

const options = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
};

const hint_table_form = `<tr><th>#</th><th>힌트 단어</th><th>유사도</th><th>유사도 순위</th></tr>`
function $(id) {
    if (id.charAt(0) !== '#') return false;
    return document.getElementById(id.substring(1));
}

function share() {
    // We use the stored guesses here, because those are not updated again
    // once you win -- we don't want to include post-win guesses here.
    const text = solveStory(JSON.parse(storage.getItem("guesses")), puzzleNumber);
    const copied = ClipboardJS.copy(text);

    if (copied) {
        gtag('event', 'share');
        alert("클립보드로 복사했습니다.");
    }
    else {
        alert("클립보드에 복사할 수 없습니다.");
    }
}

const words_selected = [];
let cache = {};
let similarityStory = null;

function guessRow(similarity, oldGuess, percentile, guessNumber, guess) {
    let percentileText = percentile;
    let progress = "";
    let closeClass = "";
    if (similarity >= similarityStory.rest * 100 && percentile === '1000위 이상') {
        percentileText = '<span class="weirdWord">????<span class="tooltiptext">이 단어는 사전에는 없지만, 데이터셋에 포함되어 있으며 1,000위 이내입니다.</span></span>';
    }
    if (typeof percentile === 'number') {
            closeClass = "close";
            percentileText = `<span class="percentile">${percentile}</span>&nbsp;`;
            progress = ` <span class="progress-container">
<span class="progress-bar" style="width:${(1001 - percentile)/10}%">&nbsp;</span>
</span>`;
    }
    let style = '';
    if (oldGuess === guess) {
        style = 'style="color: #f7617a;font-weight: 600;"';
    }
    return `<tr><td>${guessNumber}</td><td ${style}>${oldGuess}</td><td>${similarity.toFixed(2)}</td><td class="${closeClass}">${percentileText}${progress}
</td></tr>`;

}

function getUpdateTimeHours() {
    const midnightUtc = new Date();
    midnightUtc.setUTCHours(24 - 9, 0, 0, 0);
    return midnightUtc.getHours();
}

function solveStory(guesses, puzzleNumber) {
    let guess_count = guesses.length - 1;
    let is_win = storage.getItem("winState") == 1;
    if (is_win) {
        guess_count += 1
        if (guess_count == 1) {
            return `이럴 수가! 첫번째 추측에서 ${puzzleNumber}번째 꼬맨틀 정답 단어를 맞혔습니다!\nhttps://semantle-ko.newsjel.ly/`;
        }
    }
    if (guess_count == 0) {
        return `${puzzleNumber}번째 꼬맨틀을 시도하지 않고 바로 포기했어요.\nhttps://semantle-ko.newsjel.ly/`;
    }

    let describe = function(similarity, percentile) {
        let out = `${similarity.toFixed(2)}`;
        if (percentile != '1000위 이상') {
            out += ` (순위 ${percentile})`;
        }
        return out;
    }

    let time = storage.getItem('endTime') - storage.getItem('startTime');
    let timeFormatted = new Date(time).toISOString().substr(11, 8).replace(":", "시간").replace(":", "분");
    let timeInfo = `소요 시간: ${timeFormatted}초\n`
    if (time > 24 * 3600000) {
        timeInfo = '소요 시간: 24시간 이상\n'
    }
    if (!shareTime) {
        timeInfo = ''
    }

    let topGuessMsg = ''
    const topGuesses = guesses.slice();
    if (shareTopGuess) {
        topGuesses.sort(function(a, b){return b[0]-a[0]});
        const topGuess = topGuesses[1];
        let [similarity, old_guess, percentile, guess_number] = topGuess;
        topGuessMsg = `최대 유사도: ${describe(similarity, percentile)}\n`;
    }
    let guessCountInfo = '';
    if (shareGuesses) {
        guessCountInfo = `추측 횟수: ${guess_count}\n`;
    }

    if (is_win) {
        return `${puzzleNumber}번째 꼬맨틀을 풀었습니다!\n${guessCountInfo}` +
            `${timeInfo}${topGuessMsg}https://semantle-ko.newsjel.ly/`;
    }

    return `저런… ${puzzleNumber}번째 꼬맨틀을 포기했어요..ㅠ\n${guessCountInfo}` +
            `${timeInfo}${topGuessMsg}https://semantle-ko.newsjel.ly/`;
}
//암호화 관련 함수
//====================================================================================================
const secretKey = 'semantle-korea'; // 암호화에 사용할 비밀 키

// 암호화 함수
function encryptText(data) {
    try {
        const jsonString = JSON.stringify(data);
        const encrypted = CryptoJS.AES.encrypt(jsonString, secretKey).toString();
        return encrypted;
    } catch (error) {
        alert('공유 코드 생성 오류');
        return null;
    }
}

// 복호화 함수
function decryptText(encryptedText) {
    try {
        const bytes = CryptoJS.AES.decrypt(encryptedText, secretKey);
        const decrypted = bytes.toString(CryptoJS.enc.Utf8);
        return JSON.parse(decrypted);
    } catch (error) {
        alert('공유 코드 복호화 오류');
        return null;
    }
}
//====================================================================================================
let Semantle = (function() {
    async function getSimilarityStory(puzzleNumber) {
        const url = "/similarity/" + puzzleNumber;
        const response = await fetch(url);
        try {
            return await response.json();
        } catch (e) {
            return null;
        }
    }

    async function submitGuess(word) {
        if (cache.hasOwnProperty(word)) {
            return cache[word];
        }
        const url = "/guess/" + puzzleNumber + "/" + word;
        const response = await fetch(url);
        gtag('event', 'guess', {
            'event_category' : 'game_event',
            'event_label' : word,
        });
        try {
            return await response.json();
        } catch (e) {
            return null;
        }
    }

    async function getNearby(word) {
        const url = "/nearby/" + word ;
        const response = await fetch(url);
        try {
            return await response.json();
        } catch (e) {
            return null;
        }
    }

    async function getYesterday() {
        const url = "/yesterday/" + puzzleNumber
        try {
            return (await fetch(url)).text();
        } catch (e) {
            return null;
        }
    }

    async function init() {
        let yesterday = await getYesterday()
        const today = new Date(now);
        const formattedDate = today.toLocaleDateString('ko-KR', options);
        $('#today-number').innerHTML = `${formattedDate} 꼬맨틀 번호 : <b>${puzzleNumber}</b>`;
        try {
            similarityStory = await getSimilarityStory(puzzleNumber);
            $('#similarity-story').innerHTML = `
            <b>${puzzleNumber}</b>번째 꼬맨틀의 정답 단어를 맞혀보세요.<br/>
            정답 단어와 가장 유사한 단어의 유사도는 <b>${(similarityStory.top * 100).toFixed(2)}</b> 입니다.
            10번째로 유사한 단어의 유사도는 ${(similarityStory.top10 * 100).toFixed(2)}이고,
            1,000번째로 유사한 단어의 유사도는 ${(similarityStory.rest * 100).toFixed(2)} 입니다.`;
        } catch {
            // we can live without this in the event that something is broken
        }

        const storagePuzzleNumber = storage.getItem("puzzleNumber");
        if (storagePuzzleNumber != puzzleNumber) {
            storage.removeItem("guesses");
            storage.removeItem("winState");
            storage.removeItem("startTime");
            storage.removeItem("endTime");
            storage.setItem("puzzleNumber", puzzleNumber);
        }
        const storageHistory = storage.getItem('history');
        if (storageHistory === null) {
            storage.setItem('history', JSON.stringify([]));
        }
        loadHistory(puzzleNumber);

        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            prefersDarkColorScheme = true;
        }

        $("#settings-button").addEventListener('click', openSettings);
        $("#history-button").addEventListener('click', openHistory);

        document.querySelectorAll(".dialog-underlay, .dialog-close").forEach((el) => {
            el.addEventListener('click', () => {
                document.body.classList.remove('dialog-open', 'settings-open');
                document.body.classList.remove('dialog-open', 'history-open');
            });
        });

        document.querySelectorAll(".dialog").forEach((el) => {
            el.addEventListener("click", (event) => {
                // prevents click from propagating to the underlay, which closes the dialog
                event.stopPropagation();
            });
        });

        $('#dark-mode').addEventListener('click', function(event) {
            storage.setItem('darkMode', event.target.checked);
            toggleDarkMode(event.target.checked);
        });

        toggleDarkMode(darkMode);

        $('#share-guesses').addEventListener('click', function(event) {
            storage.setItem('shareGuesses', event.target.checked);
            shareGuesses = event.target.checked;
        });

        $('#share-time').addEventListener('click', function(event) {
            storage.setItem('shareTime', event.target.checked);
            shareTime = event.target.checked;
        });

        $('#share-top-guess').addEventListener('click', function(event) {
            storage.setItem('shareTopGuess', event.target.checked);
            shareTopGuess = event.target.checked;
        });

        $('#dark-mode').checked = darkMode;
        $('#share-guesses').checked = shareGuesses;
        $('#share-time').checked = shareTime;
        $('#share-top-guess').checked = shareTopGuess;

        $('#export-history-btn').addEventListener('click', async function(event) {
            const semantleHistory = JSON.parse(storage.getItem('history')) || [];
            let history_data = {};
            history_data['history'] = semantleHistory;
            for (let entry of semantleHistory) { //각 회차별 기록을 순회하며
                const [number, result, guessCount, hintCount] = entry;
                const storageGuesses = JSON.parse(storage.getItem(`${number}_guesses`));
                const storageHints = JSON.parse(storage.getItem(`${number}_hints`));
                if (storageGuesses !== null) {
                    history_data[`${number}_guesses`] = storageGuesses;
                }
                if (storageHints !== null) {
                    history_data[`${number}_hints`] = storageHints;
                }
            }
            console.log(history_data);
            const encryptedText = encryptText(history_data);
            document.getElementById('history-input').value = encryptedText;
            //클립보드 복사 기능
            const copied = ClipboardJS.copy(encryptedText);
            if (copied) {
                alert("클립보드로 복사했습니다.");
            }
        });
        $('#import-history-btn').addEventListener('click', async function(event) {
            const encryptedText = document.getElementById('history-input').value;
            if (encryptText === null || encryptedText === '') {
                alert("공유 코드를 입력해주세요.");
                return;
            }
            if(confirm("기존 기록은 삭제됩니다. 계속하시겠습니까?")) {
                let history_data = decryptText(encryptedText);
                //데이터 유효성 검사 추가
                const semantleHistory = history_data['history'];
                storage.setItem('history', JSON.stringify(semantleHistory));
                for (let entry of semantleHistory) {
                    const [number, result, guessCount, hintCount] = entry;
                    if (history_data.hasOwnProperty(`${number}_guesses`)) {
                        storage.setItem(`${number}_guesses`, JSON.stringify(history_data[`${number}_guesses`]));
                    }
                    if (history_data.hasOwnProperty(`${number}_hints`)) {
                        storage.setItem(`${number}_hints`, JSON.stringify(history_data[`${number}_hints`]));
                    }
                }
                updateHistory();
                loadHistory(puzzleNumber);
            }
        });

        $('#give-up-btn').addEventListener('click', async function(event) {
            if (!gameOver) {
                if (confirm("정말로 포기하시겠습니까?")) {
                    const url = '/giveup/' + puzzleNumber;
                    const secret = await (await fetch(url)).text();
                    guessed.add(secret);
                    guessCount += 1;
                    const newEntry = [100, secret, '정답', guessCount];
                    guesses.push(newEntry);
                    guesses.sort(function(a, b){return b[0]-a[0]});
                    updateGuesses(guess);
                    endGame(false, true);
                    gtag('event', 'giveup', {
                        'event_category' : 'game_event',
                        'event_label' : 'giveup',
                    });
                    gtag('event', 'giveup', {
                        'event_category' : 'game_event',
                        'event_label' : 'guess_count',
                        'value' : guessCount,
                    });
                }
            }
        });

        $('#form').addEventListener('submit', async function(event) {
            event.preventDefault();
            $('#error').textContent = "";
            let guess = $('#guess').value.trim().replace("!", "").replace("*", "").replaceAll("/", "");
            if (!guess) {
                return false;
            }

            $('#guess').value = "";

            $('#dummy').focus(); // to fix ios buffer issue
            $('#guess').focus();

            const guessData = await submitGuess(guess);

            if (guessData == null) {
                $('#error').textContent = `서버가 응답하지 않습니다. 나중에 다시 시도해보세요.`
                return false;
            }
            if (guessData.error == "unknown") {
                $('#error').textContent = `${guess}은(는) 알 수 없는 단어입니다.`;
                return false;
            }

            guess = guessData.guess
            cache[guess] = guessData;

            let percentile = guessData.rank;
            let similarity = guessData.sim * 100.0;
            if (!guessed.has(guess)) {
                if (guessCount == 0) {
                    storage.setItem('startTime', Date.now())
                }
                guessCount += 1;
                gtag('event', 'nth_guess', {
                    'event_category' : 'game_event',
                    'event_label' : guess,
                    'value' : guessCount,
                });
                guessed.add(guess);

                const newEntry = [similarity, guess, percentile, guessCount];
                guesses.push(newEntry);

                if (!gameOver) {
                    const stats = getStats();
                    stats['totalGuesses'] += 1;
                    storage.setItem('stats', JSON.stringify(stats));
                }
            }
            guesses.sort(function(a, b){return b[0]-a[0]});

            if (!gameOver) {
                saveGame(-1, -1);
            }

            chrono_forward = 1;

            updateGuesses(guess);

            const semantleHistory = JSON.parse(storage.getItem('history')) || [];  // 문자열을 JSON으로 파싱
            const exists = semantleHistory.findIndex(entry => entry[0] === puzzleNumber);  // puzzleNumber와 일치하는 인덱스 찾기
            if (!gameOver) {
                const newEntry = [puzzleNumber, 'solving', guessCount, hintCount];
                if (exists === -1) {
                    // 정보 추가
                    semantleHistory.push(newEntry);
                } else {
                    // 정보 업데이트
                    semantleHistory[exists] = newEntry;
                }
                semantleHistory.sort(function(a, b){return a[0]-b[0]});
                storage.setItem('history', JSON.stringify(semantleHistory));
                storage.setItem(`${puzzleNumber}_guesses`, JSON.stringify(guesses.slice(0, 20)));
            }
            
            if (guessData.sim == 1 && !gameOver) {
                endGame(true, true);
                gtag('event', 'win', {
                    'event_category' : 'game_event',
                    'event_label' : 'win',
                });
                gtag('event', 'win', {
                    'event_category' : 'game_event',
                    'event_label' : 'guess_count',
                    'value' : guessCount,
                });
            }
            return false;
        });

        const winState = storage.getItem("winState");
        if (winState != null) {
            guesses = JSON.parse(storage.getItem("guesses"));
            for (let guess of guesses) {
                guessed.add(guess[1]);
            }
            guessCount = guessed.size;
            updateGuesses("");
            if (winState != -1) {
                endGame(winState > 0, false);
            }
        }
        //추가한 부분
        //====================================================================================================
        $('#load-puzzle-btn').addEventListener('click', async function(event) {
            puzzleNumber = Number(document.getElementById('puzzle-number').value);
            fetch(`/new_puzzle/${puzzleNumber}`)
                .then(response => response.json())
                .then(data => {
                    storage.removeItem("guesses");
                    storage.removeItem("winState");
                    storage.removeItem("startTime");
                    storage.removeItem("endTime");
                    storage.setItem("puzzleNumber", puzzleNumber);
                    gameOver = false;
                    guesses = [];
                    guessCount = 0;
                    cache = {};
                    guessed.clear();
                    hintCount = 0;
                    $('#give-up-btn').style = "display:block;";
                    $('#response').classList.remove("gaveup");
                    $('#response').innerHTML = '';
                    let inner = `<tr><th id="chronoOrder">#</th><th id="alphaOrder">추측한 단어</th><th id="similarityOrder">유사도</th><th>유사도 순위</th></tr>`;
                    $('#guesses').innerHTML = inner;
                    $('#hint-history').innerHTML = '';
                    hint = [];
                    //기록 존재시 기록 불러오기
                    loadHistory(puzzleNumber);
                    //회차 정보 업데이트
                    fetch(`/similarity/${puzzleNumber}`)
                        .then(response => response.json())
                        .then(async data => {
                            similarityStory = data;
                            $('#similarity-story').innerHTML = `
                            <b>${puzzleNumber}</b>번째 꼬맨틀의 정답 단어를 맞혀보세요.<br/>
                            정답 단어와 가장 유사한 단어의 유사도는 <b>${(similarityStory.top * 100).toFixed(2)}</b> 입니다.
                            10번째로 유사한 단어의 유사도는 ${(similarityStory.top10 * 100).toFixed(2)}이고,
                            1,000번째로 유사한 단어의 유사도는 ${(similarityStory.rest * 100).toFixed(2)} 입니다.`;
                        })
                        .catch(error => console.error('Error:', error));
                })
                .catch(error => console.error('Error:', error));
        });
    
        $('#hint-btn').addEventListener('click', async function(event) {
            let start = (9-hintCount)*100+1;
            let end = (10-hintCount)*100;
            let random = Math.floor(Math.random() * (end - start + 1) + start);
            if (hintCount >= 10) {
                alert('더 이상 힌트를 제공할 수 없습니다.');
                return;
            }
            fetch(`/hint/${puzzleNumber}/${random}`)
                .then(response => response.json())
                .then(data => {
                    const newEntry = [data[0].word, data[0].similarity, data[0].rank];
                    hint.push(newEntry);
                    hint.sort(function(a, b){return b[1]-a[1]});
                    let hint_history = hint_table_form;
                    for (let entry of hint) {
                        hint_history += `<tr><td>${hint.indexOf(entry) + 1}</td><td>${entry[0]}</td><td>${entry[1]}</td><td>${entry[2]}</td></tr>`;
                    }
                    $('#hint-history').innerHTML = hint_history;
                    hintCount += 1;
                    start = (9-hintCount)*100+1;
                    end = (10-hintCount)*100;
                    if (hintCount >= 10) {
                        $('#hint-info').innerHTML = `힌트 횟수를 모두 사용했습니다.`;
                    }
                    else {
                        $('#hint-info').innerHTML = `유사도 ${start}~${end}위 사이 단어를 보여줍니다. 남은 힌트 횟수: ${10-hintCount}`;
                    }
                    storage.setItem(`${puzzleNumber}_hints`, JSON.stringify(hint.slice(0, 10)));
                    //history 추가
                    let semantleHistory = JSON.parse(storage.getItem('history')) || [];  // 문자열을 JSON으로 파싱
                    let exists = semantleHistory.findIndex(entry => entry[0] === puzzleNumber);  // puzzleNumber와 일치하는 인덱스 찾기
                    if (exists === -1 && !gameOver) {
                        semantleHistory.push([puzzleNumber, 'solving', guessCount, hintCount]);
                    }
                    else {
                        semantleHistory[exists] = [puzzleNumber, 'solving', guessCount, hintCount];
                    }
                    semantleHistory.sort(function(a, b){return a[0]-b[0]});
                    storage.setItem('history', JSON.stringify(semantleHistory));
                })
                .catch(error => console.error('Error:', error));
        });
        //====================================================================================================
    }

    function openSettings() {
        document.body.classList.add('dialog-open', 'settings-open');
    }

    function openHistory() {
        document.body.classList.add('dialog-open', 'history-open');
        updateHistory();
    }
    function updateHistory() {
        $('#history-table').innerHTML = `<tr><th>회차</th><th>결과</th><th>추측 횟수</th><th>힌트 횟수</th></tr>`;
        const semantleHistory = JSON.parse(storage.getItem('history')) || [];
        let totalGuessCount = 0;
        let totalHintCount = 0;
        let totalWinCount = 0;
        let totalGiveupCount = 0;
        let totalSolvingCount = 0;
        for (let entry of semantleHistory) {
            let [number, result, guessCount, hintCount] = entry;
            let resultText;
            if (result === 'win') { 
                resultText = '<td style="color: #4caf50">정답</td>'; 
                totalWinCount += 1;
            }
            else if (result === 'giveup') {
                resultText = '<td style="color: #f44336">포기</td>';
                totalGiveupCount += 1;
            }
            else if (result === 'solving') {
                resultText = '<td style="color: #2196f3">진행중</td>'; 
                totalSolvingCount += 1;
            }
            else {
                resultText = '알 수 없음'; 
            }
            $('#history-table').innerHTML += `<tr><td>${number}</td>${resultText}<td>${guessCount}</td><td>${hintCount}</td></tr>`;
            totalGuessCount += guessCount;
            totalHintCount += hintCount;
        }
        $('#history-sum').innerHTML = `총 ${semantleHistory.length}회차의 기록이 있습니다.</br>
        <span style="color: #2196f3">진행중</span> : ${totalSolvingCount}, 
        <span style="color: #4caf50">정답</span> : ${totalWinCount}, 
        <span style="color: #f44336">포기</span> : ${totalGiveupCount}</br>
        총 추측 횟수 : ${totalGuessCount}회, 
        총 힌트 횟수 : ${totalHintCount}회`;
    }

    function updateGuesses(guess) {
        let inner = `<tr><th id="chronoOrder">#</th><th id="alphaOrder">추측한 단어</th><th id="similarityOrder">유사도</th><th>유사도 순위</th></tr>`;
        /* This is dumb: first we find the most-recent word, and put
           it at the top.  Then we do the rest. */
        for (let entry of guesses) {
            let [similarity, oldGuess, percentile, guessNumber] = entry;
            if (oldGuess == guess) {
                inner += guessRow(similarity, oldGuess, percentile, guessNumber, guess);
            }
        }
        inner += "<tr><td colspan=4><hr></td></tr>";
        for (let entry of guesses) {
            let [similarity, oldGuess, percentile, guessNumber] = entry;
            if (oldGuess != guess) {
                inner += guessRow(similarity, oldGuess, percentile, guessNumber);
            }
        }
        $('#guesses').innerHTML = inner;
        $('#chronoOrder').addEventListener('click', event => {
            guesses.sort(function(a, b){return chrono_forward * (a[3]-b[3])});
            chrono_forward *= -1;
            updateGuesses(guess);
        });
        $('#alphaOrder').addEventListener('click', event => {
            guesses.sort(function(a, b){return a[1].localeCompare(b[1])});
            chrono_forward = 1;
            updateGuesses(guess);
        });
        $('#similarityOrder').addEventListener('click', event => {
            guesses.sort(function(a, b){return b[0]-a[0]});
            chrono_forward = 1;
            updateGuesses(guess);
        });
    }

    function toggleDarkMode(on) {
        document.body.classList[on ? 'add' : 'remove']('dark');
        const darkModeCheckbox = $("#dark-mode");
        darkMode = on;
        // this runs before the DOM is ready, so we need to check
        if (darkModeCheckbox) {
            darkModeCheckbox.checked = on;
        }
    }

    function checkMedia() {
        let darkMode = storage.getItem("darkMode") === 'true';
        toggleDarkMode(darkMode);
    }

    function setSnowMode() {
        let days = Math.floor(Date.now() / 1000 / 60 / 60 / 24)
        let on = days % 3 === 0
        document.body.classList[on ? 'add' : 'remove']('snow');
    }

    function saveGame(guessCount, winState) {
        // If we are in a tab still open from yesterday, we're done here.
        // Don't save anything because we may overwrite today's game!
        let savedPuzzleNumber = storage.getItem("puzzleNumber");
        if (savedPuzzleNumber != puzzleNumber) { return }

        storage.setItem("winState", winState);
        storage.setItem("guesses", JSON.stringify(guesses));
    }

    function getStats() {
        const oldStats = storage.getItem("stats");
        if (oldStats == null) {
            const stats = {
                'firstPlay' : puzzleNumber,
                'lastEnd' : puzzleNumber - 1,
                'lastPlay' : puzzleNumber,
                'winStreak' : 0,
                'playStreak' : 0,
                'totalGuesses' : 0,
                'wins' : 0,
                'giveups' : 0,
                'abandons' : 0,
                'totalPlays' : 0,
            };
            storage.setItem("stats", JSON.stringify(stats));
            return stats;
        } else {
            const stats = JSON.parse(oldStats);
            if (stats['lastPlay'] != puzzleNumber) {
                const onStreak = (stats['lastPlay'] == puzzleNumber - 1);
                if (onStreak) {
                    stats['playStreak'] += 1;
                }
                stats['totalPlays'] += 1;
                if (stats['lastEnd'] != puzzleNumber - 1) {
                    stats['abandons'] += 1;
                }
                stats['lastPlay'] = puzzleNumber;
            }
            return stats;
        }
    }

    function endGame(won, countStats) {
        let stats = getStats();
        if (storage.getItem('endTime') == null) {
            storage.setItem('endTime', Date.now())
        }
        if (countStats) {
            const onStreak = (stats['lastEnd'] == puzzleNumber - 1);

            stats['lastEnd'] = puzzleNumber;
            if (won) {
                if (onStreak) {
                    stats['winStreak'] += 1;
                } else {
                stats['winStreak'] = 1;
                }
                stats['wins'] += 1;
            } else {
                stats['winStreak'] = 0;
                stats['giveups'] += 1;
            }
            storage.setItem("stats", JSON.stringify(stats));
        }

        $('#give-up-btn').style = "display:none;";
        $('#response').classList.add("gaveup");
        gameOver = true;
        let response;
        if (won) {
            response = `<p><b>정답 단어를 맞혔습니다. ${guesses.length}번째 추측만에 정답을 맞혔네요!</b><br/>`;
        } else {
            response = `<p><b>${guesses.length - 1}번째 추측에서 포기했습니다!</b><br/>`;
        }
        const commonResponse = `정답 단어와 비슷한, <a href="/nearest1k/${puzzleNumber}">상위 1,000개의 단어</a>를 확인해보세요.</p>`
        response += commonResponse;
        response += `<input type="button" value="기록 복사하기" id="result" onclick="share()" class="button"><br />`
        const totalGames = stats['wins'] + stats['giveups'] + stats['abandons'];
        response += `<br/>
        <b>나의 플레이 기록</b>: <br/>
        <table>
        <tr><th>가장 처음 풀었던 꼬맨틀 번호:</th><td>${stats['firstPlay']}</td></tr>
        <tr><th>도전한 게임 횟수:</th><td>${totalGames}</td></tr>
        <tr><th>정답 횟수:</th><td>${stats['wins']}</td></tr>
        <tr><th>연속 정답 횟수:</th><td>${stats['winStreak']}</td></tr>
        <tr><th>포기 횟수:</th><td>${stats['giveups']}</td></tr>
        <tr><th>지금까지 추측 단어 총 갯수:</th><td>${stats['totalGuesses']}</td></tr>
        </table>
        <b>회차별 플레이 기록은 상단 기록 아이콘 클릭으로 확인할 수 있습니다.</b>
        `;
        $('#response').innerHTML = response;

        if (countStats) {
            saveGame(guesses.length, won ? 1 : 0);
        }
        // 기록 저장
        let semantleHistory = JSON.parse(storage.getItem('history')) || [];  // 문자열을 JSON으로 파싱
        let exists = semantleHistory.findIndex(entry => entry[0] === puzzleNumber);  // puzzleNumber와 일치하는 인덱스 찾기
        if (exists === -1) {
            // 정보 추가
            const newEntry = [Number(puzzleNumber), won ? 'win' : 'giveup', guessCount, hintCount];
            semantleHistory.push(newEntry);
        } else {
            // 정보 업데이트
            semantleHistory[exists] = [puzzleNumber, won ? 'win' : 'giveup', guessCount, hintCount];
        }
        storage.setItem('history', JSON.stringify(semantleHistory));
        storage.removeItem(`${puzzleNumber}_hints`);
        storage.removeItem(`${puzzleNumber}_guesses`);
    }
    function loadHistory(number) {
        const storageHistory = JSON.parse(storage.getItem('history')) || [];
        const exists = storageHistory.findIndex(entry => entry[0] === number);
        if (exists !== -1 && storageHistory[exists][1] !== 'win') {
            const storageGuesses = JSON.parse(storage.getItem(`${number}_guesses`));
            const storageHints = JSON.parse(storage.getItem(`${number}_hints`));
            if (storageGuesses !== null) {
                guessCount = storageHistory[exists][2];
                guesses = storageGuesses;
                guessed = new Set();
                for (let guess of guesses) {
                    guessed.add(guess[1]);
                }
                updateGuesses("");
            }
            if(storageHints !== null) {
                hintCount = storageHistory[exists][3];
                hint = storageHints;
                let hint_history = hint_table_form;
                for (let entry of hint) {
                    hint_history += `<tr><td>${hint.indexOf(entry) + 1}</td><td>${entry[0]}</td><td>${entry[1]}</td><td>${entry[2]}</td></tr>`;
                }
                $('#hint-history').innerHTML = hint_history;
            }
            
            
        }
        let start = (9-hintCount)*100+1;
        let end = (10-hintCount)*100;
        if (hintCount >= 10) {
            $('#hint-info').innerHTML = `힌트 횟수를 모두 사용했습니다.`;
        }
        else {
            $('#hint-info').innerHTML = `유사도 ${start}~${end}위 사이 단어를 보여줍니다. 남은 힌트 횟수: ${10-hintCount}`;
        }
    }
    return {
        init: init,
        checkMedia: checkMedia,
        setSnowMode: setSnowMode,
    };
})();

// do this when the file loads instead of waiting for DOM to be ready to avoid
// a flash of unstyled content
Semantle.checkMedia();
// Semantle.setSnowMode();
    
window.addEventListener('load', async () => { Semantle.init() });
