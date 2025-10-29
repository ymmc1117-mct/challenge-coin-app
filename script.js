// 音階データ
const scales = [
    // 長調
    { german: 'C dur', japanese: 'ハ長調' },
    { german: 'G dur', japanese: 'ト長調' },
    { german: 'D dur', japanese: 'ニ長調' },
    { german: 'A dur', japanese: 'イ長調' },
    { german: 'E dur', japanese: 'ホ長調' },
    { german: 'B dur', japanese: 'ロ長調' },
    { german: 'F# dur', japanese: '嬰ヘ長調' },
    { german: 'Des dur', japanese: '変ニ長調' },
    { german: 'As dur', japanese: '変イ長調' },
    { german: 'Es dur', japanese: '変ホ長調' },
    { german: 'B dur', japanese: '変ロ長調' },
    { german: 'F dur', japanese: 'ヘ長調' },
    // 短調
    { german: 'a moll', japanese: 'イ短調' },
    { german: 'e moll', japanese: 'ホ短調' },
    { german: 'h moll', japanese: 'ロ短調' },
    { german: 'fis moll', japanese: '嬰ヘ短調' },
    { german: 'cis moll', japanese: '嬰ハ短調' },
    { german: 'gis moll', japanese: '嬰ト短調' },
    { german: 'dis moll', japanese: '嬰ニ短調' },
    { german: 'b moll', japanese: '変ロ短調' },
    { german: 'f moll', japanese: 'ヘ短調' },
    { german: 'c moll', japanese: 'ハ短調' },
    { german: 'g moll', japanese: 'ト短調' },
    { german: 'd moll', japanese: 'ニ短調' }
];

// 状態管理
let isSpinning = false;
let currentScale = null;
let history = [];
let showHistory = false;
let showTable = false;

// DOM要素
const slotList = document.getElementById('slotList');
const startButton = document.getElementById('startButton');
const resultContainer = document.getElementById('resultContainer');
const resultGerman = document.getElementById('resultGerman');
const resultJapanese = document.getElementById('resultJapanese');
const historyButton = document.getElementById('historyButton');
const historyButtonText = document.getElementById('historyButtonText');
const historyContainer = document.getElementById('historyContainer');
const historyListElement = document.getElementById('historyList');
const tableButton = document.getElementById('tableButton');
const tableButtonText = document.getElementById('tableButtonText');
const tableContainer = document.getElementById('tableContainer');

// 初期化
function init() {
    loadHistory();
    initSlotList();
    startButton.addEventListener('click', spin);
    historyButton.addEventListener('click', toggleHistory);
    tableButton.addEventListener('click', toggleTable);
}

// スロットリストの初期化
function initSlotList() {
    const extendedScales = [...scales, ...scales, ...scales];
    slotList.innerHTML = extendedScales.map((scale, index) => 
        `<div class="slot-item" data-index="${index}">${scale.german}</div>`
    ).join('');
    // 初期位置を中央に設定
    slotList.style.transform = 'translateY(80px)';
    updateOpacity();
}

// 不透明度の更新
function updateOpacity() {
    const items = document.querySelectorAll('.slot-item');
    const containerRect = document.querySelector('.slot-window').getBoundingClientRect();
    const centerY = containerRect.top + containerRect.height / 2;
    
    items.forEach(item => {
        const itemRect = item.getBoundingClientRect();
        const itemCenterY = itemRect.top + itemRect.height / 2;
        const distance = Math.abs(centerY - itemCenterY);
        
        if (distance < 40) {
            item.style.opacity = '1';
        } else {
            item.style.opacity = '0.3';
        }
    });
}

// 履歴の読み込み
function loadHistory() {
    const saved = localStorage.getItem('piano-scale-history');
    if (saved) {
        try {
            history = JSON.parse(saved);
        } catch (e) {
            history = [];
        }
    }
}

// 履歴の保存
function saveHistory(scale) {
    const newEntry = {
        date: new Date().toISOString(),
        scale: scale
    };
    history = [newEntry, ...history].slice(0, 50);
    localStorage.setItem('piano-scale-history', JSON.stringify(history));
}

// スロット回転
function spin() {
    if (isSpinning) return;
    
    isSpinning = true;
    startButton.disabled = true;
    resultContainer.style.display = 'none';
    
    const finalIndex = Math.floor(Math.random() * scales.length);
    const finalScale = scales[finalIndex];
    
    // 拡張リストを再生成
    const extendedScales = [...scales, ...scales, ...scales, ...scales];
    slotList.innerHTML = extendedScales.map(scale => 
        `<div class="slot-item">${scale.german}</div>`
    ).join('');
    
    const targetPosition = scales.length * 2 + finalIndex;
    const spinDuration = 3000;
    const startTime = Date.now();
    
    function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / spinDuration, 1);
        
        // イージング（最初は速く、最後はゆっくり）
        const easeOut = 1 - Math.pow(1 - progress, 3);
        
        const currentPos = easeOut * targetPosition;
        const offset = currentPos * 80;
        slotList.style.transform = `translateY(calc(-${offset}px + 80px))`;
        
        updateOpacity();
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            currentScale = finalScale;
            isSpinning = false;
            startButton.disabled = false;
            showResult(finalScale);
            saveHistory(finalScale);
        }
    }
    
    slotList.style.transition = 'none';
    animate();
}

// 結果表示
function showResult(scale) {
    resultGerman.textContent = scale.german;
    resultJapanese.textContent = scale.japanese;
    resultContainer.style.display = 'block';
}

// 履歴の表示/非表示
function toggleHistory() {
    showHistory = !showHistory;
    if (showHistory) {
        historyButtonText.textContent = '履歴を閉じる';
        historyContainer.style.display = 'block';
        renderHistory();
    } else {
        historyButtonText.textContent = '練習履歴を見る';
        historyContainer.style.display = 'none';
    }
}

// 履歴のレンダリング
function renderHistory() {
    if (history.length === 0) {
        historyListElement.innerHTML = '<p class="history-empty">まだ履歴がありません</p>';
        return;
    }
    
    historyListElement.innerHTML = history.map((entry, index) => {
        const date = new Date(entry.date);
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const hours = date.getHours();
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const formattedDate = `${month}/${day} ${hours}:${minutes}`;
        
        return `
            <div class="history-item">
                <div class="history-content">
                    <span class="history-date">${formattedDate}</span>
                    <span class="history-scale-german">${entry.scale.german}</span>
                    <span class="history-scale-japanese">${entry.scale.japanese}</span>
                </div>
                <button class="history-delete-button" onclick="deleteHistoryItem(${index})" aria-label="削除">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                </button>
            </div>
        `;
    }).join('');
}

// 履歴アイテムの削除
function deleteHistoryItem(index) {
    history.splice(index, 1);
    localStorage.setItem('piano-scale-history', JSON.stringify(history));
    renderHistory();
}

// 一覧表の表示/非表示
function toggleTable() {
    showTable = !showTable;
    if (showTable) {
        tableButtonText.textContent = '一覧表を閉じる';
        tableContainer.style.display = 'block';
    } else {
        tableButtonText.textContent = '音階一覧表を見る';
        tableContainer.style.display = 'none';
    }
}

// 初期化実行
init();